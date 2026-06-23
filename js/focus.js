// =========================================================================
// UPSC Tracker - Focus Mode Module
// Stores study sessions in Supabase for cross-device sync.
// =========================================================================

let focusIntervalId = null;
let focusSessionId = null;
let focusStartTime = null;

// Called once after login to check for any active cross-device session
async function initFocusMode() {
    if (!dbClient || !currentUserId) return;
    try {
        const { data } = await dbClient
            .from('upsc_focus_sessions')
            .select('*')
            .eq('user_id', currentUserId)
            .is('ended_at', null)
            .order('started_at', { ascending: false })
            .limit(1);

        if (data && data.length > 0) {
            const active = data[0];
            focusSessionId = active.id;
            focusStartTime = new Date(active.started_at).getTime();
            startFocusUI();
        }
        await updateFocusTotals();
    } catch(e) { /* table may not exist yet — safe to ignore */ }
}

// Toggle focus mode on/off
async function toggleFocusMode() {
    if (!dbClient || !currentUserId) return;
    if (focusSessionId) {
        await stopFocusMode();
    } else {
        await startFocusMode();
    }
}

async function startFocusMode() {
    const btn = document.getElementById('focus-mode-btn');
    if (btn) { btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none'; }
    try {
        const now = new Date().toISOString();
        const { data, error } = await dbClient
            .from('upsc_focus_sessions')
            .insert({ user_id: currentUserId, started_at: now })
            .select()
            .single();
        if (error) throw error;
        focusSessionId = data.id;
        focusStartTime = new Date(data.started_at).getTime();
        startFocusUI();
        if (typeof showToast === 'function') showToast('Focus mode started — timer is running', 'focus', 2500);
    } catch(e) {
        showFocusError();
    } finally {
        if (btn) { btn.style.opacity = ''; btn.style.pointerEvents = ''; }
    }
}

async function stopFocusMode() {
    if (!focusSessionId) return;
    const endTime = new Date();
    const durationSeconds = Math.floor((endTime.getTime() - focusStartTime) / 1000);
    const sid = focusSessionId;

    // Clear state and UI immediately for responsiveness
    focusSessionId = null;
    focusStartTime = null;
    stopFocusUI();

    try {
        await dbClient
            .from('upsc_focus_sessions')
            .update({ ended_at: endTime.toISOString(), duration_seconds: durationSeconds })
            .eq('id', sid)
            .eq('user_id', currentUserId);
        await updateFocusTotals();
        const mins = Math.floor(durationSeconds / 60);
        const secs = durationSeconds % 60;
        const label = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        if (typeof showToast === 'function') showToast(`Focus session saved — ${label} studied`, 'success', 3500);
    } catch(e) { /* non-critical, data will be stale but UI is correct */ }
}

function startFocusUI() {
    const btn = document.getElementById('focus-mode-btn');
    const widget = document.getElementById('focus-mode-widget');
    const label = document.getElementById('focus-status-label');

    if (btn) btn.classList.add('focus-active');
    if (widget) widget.classList.add('focus-widget-active');
    if (label) label.textContent = 'STOP';

    if (focusIntervalId) clearInterval(focusIntervalId);
    focusIntervalId = setInterval(updateFocusTimerDisplay, 1000);
    updateFocusTimerDisplay();
}

function stopFocusUI() {
    const btn = document.getElementById('focus-mode-btn');
    const timerEl = document.getElementById('focus-timer-display');
    const widget = document.getElementById('focus-mode-widget');
    const label = document.getElementById('focus-status-label');

    if (btn) btn.classList.remove('focus-active');
    if (widget) widget.classList.remove('focus-widget-active');
    if (label) label.textContent = 'FOCUS';
    if (timerEl) timerEl.textContent = '00:00:00';

    if (focusIntervalId) { clearInterval(focusIntervalId); focusIntervalId = null; }
}

function showFocusError() {
    const timerEl = document.getElementById('focus-timer-display');
    if (timerEl) {
        timerEl.textContent = 'ERR';
        setTimeout(() => { timerEl.textContent = '00:00:00'; }, 2000);
    }
}

function updateFocusTimerDisplay() {
    if (!focusStartTime) return;
    const elapsed = Math.floor((Date.now() - focusStartTime) / 1000);
    const timerEl = document.getElementById('focus-timer-display');
    if (timerEl) timerEl.textContent = formatStudyDuration(elapsed);
}

function formatStudyDuration(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function updateFocusTotals() {
    if (!dbClient || !currentUserId) return;
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data } = await dbClient
            .from('upsc_focus_sessions')
            .select('duration_seconds')
            .eq('user_id', currentUserId)
            .gte('started_at', todayStart.toISOString())
            .not('ended_at', 'is', null);

        if (!data) return;
        const todaySeconds = data.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
        const todayEl = document.getElementById('focus-today-total');
        if (todayEl) {
            if (todaySeconds >= 60) {
                const h = Math.floor(todaySeconds / 3600);
                const m = Math.floor((todaySeconds % 3600) / 60);
                todayEl.textContent = h > 0 ? `${h}h ${m}m today` : `${m}m today`;
            } else if (todaySeconds > 0) {
                todayEl.textContent = `${todaySeconds}s today`;
            } else {
                todayEl.textContent = '';
            }
        }
    } catch(e) { /* non-critical */ }
}
