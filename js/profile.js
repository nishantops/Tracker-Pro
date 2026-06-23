// =========================================================================
// UPSC Tracker - Profile Module
// =========================================================================

function openProfileEdit() {
    document.getElementById('profile-menu').classList.add('hidden');
    if (currentUserId) localStorage.removeItem('upsc_profile_' + currentUserId);
    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('profile-setup-screen').style.display = 'flex';
    const name = document.getElementById('user-display-name').textContent;
    const age = document.getElementById('user-age-text').textContent;
    const attempt = document.getElementById('user-attempt-text').textContent;
    if (name && name !== 'User') document.getElementById('setup-name').value = name;
    if (age && age !== '--') document.getElementById('setup-age').value = age;
    if (attempt && attempt !== '--') document.getElementById('setup-attempt').value = attempt;
    // Pre-populate optional subject
    try {
        var savedProfile = currentUserId ? JSON.parse(localStorage.getItem('upsc_profile_' + currentUserId) || '{}') : {};
        var optSel = document.getElementById('setup-optional');
        if (optSel && savedProfile.optional_subject) {
            var knownOpts = ['Anthropology','Geography','Public Administration','Sociology','History','Political Science & IR','Philosophy','Law'];
            if (knownOpts.indexOf(savedProfile.optional_subject) !== -1) {
                optSel.value = savedProfile.optional_subject;
            } else if (savedProfile.optional_subject !== 'none') {
                optSel.value = 'custom';
                var custWrap = document.getElementById('setup-optional-custom-wrap');
                if (custWrap) custWrap.style.display = 'block';
                var custInput = document.getElementById('setup-optional-custom');
                if (custInput) custInput.value = savedProfile.optional_subject_custom || savedProfile.optional_subject;
            }
        }
        // Pre-populate phone
        if (savedProfile.phone) {
            var phoneEl = document.getElementById('setup-phone');
            if (phoneEl) phoneEl.value = savedProfile.phone;
        }
    } catch(e) {}
    document.getElementById('setup-submit-btn').innerHTML = '💾 Update Profile';
}

async function showApp(knownEmail) {
    let userEmail = knownEmail || null;
    if (!userEmail) {
        try {
            const { data: { session } } = await dbClient.auth.getSession();
            if (session) userEmail = session.user.email;
        } catch(e) {}
    }

    // Superuser bypasses profile setup entirely
    if (isSuperuser(userEmail)) {
        applyProfileToUI({ display_name: 'Sanit', age: null, attempt: null, features_enabled: SUPERUSER_FEATURES });
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('profile-setup-screen').style.display = 'none';
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById("sync-status-text").innerText = "CONNECTING CLOUD...";
        syncLatestCloudState();
        updateSessionActivity();
        startSessionBadge();
        initFocusMode();
        setTimeout(function() { if (typeof initNotifications === 'function') initNotifications(); }, 2000);
        return;
    }

    // Check localStorage cache first
    const cachedProfile = localStorage.getItem('upsc_profile_' + currentUserId);
    if (cachedProfile) {
        const profile = JSON.parse(cachedProfile);
        applyProfileToUI(profile);
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('profile-setup-screen').style.display = 'none';
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById("sync-status-text").innerText = "CONNECTING CLOUD...";
        syncLatestCloudState();
        updateSessionActivity();
        startSessionBadge();
        initFocusMode();
        setTimeout(function() { if (typeof initNotifications === 'function') initNotifications(); }, 2000);
        return;
    }

    // No cache — check DB
    const profile = await getUserProfile();
    if (!profile) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('profile-setup-screen').style.display = 'flex';
        return;
    }
    localStorage.setItem('upsc_profile_' + currentUserId, JSON.stringify(profile));
    applyProfileToUI(profile);
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('profile-setup-screen').style.display = 'none';
    document.getElementById('app-container').classList.remove('hidden');
    document.getElementById("sync-status-text").innerText = "CONNECTING CLOUD...";
    syncLatestCloudState();
    updateSessionActivity();
    startSessionBadge();
    initFocusMode();
    setTimeout(function() { if (typeof initNotifications === 'function') initNotifications(); }, 2000);
}

function applyProfileToUI(profile) {
    const name = profile.display_name || 'User';
    document.getElementById('user-display-name').textContent = name;
    const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('user-avatar').textContent = initials;
    document.title = name + ' \u2022 UPSC CSE Command Center 2027';

    if (profile.age) {
        document.getElementById('user-age-text').textContent = profile.age;
        document.getElementById('user-age-badge').style.display = 'flex';
    }
    if (profile.attempt) {
        document.getElementById('user-attempt-text').textContent = profile.attempt;
        document.getElementById('user-attempt-badge').style.display = 'flex';
    }
    var optBadge = document.getElementById('user-optional-badge');
    if (optBadge) {
        var optText = profile.optional_subject_custom || profile.optional_subject || '';
        if (optText && optText !== 'none') {
            optBadge.style.display = 'flex';
            var optSpan = optBadge.querySelector('.optional-badge-chip');
            if (optSpan) optSpan.textContent = optText;
            applyOptionalSubjectLabels(optText);
        } else {
            optBadge.style.display = 'none';
        }
    }
    // Apply feature toggles from admin RBAC
    applyFeatureGates(profile.features_enabled);
}

// ── Dynamic optional subject labels ──────────────────────────────────────
function applyOptionalSubjectLabels(optText) {
    if (!optText || optText === 'none') optText = 'Optional';
    var shortName = optText.length > 14 ? optText.substring(0, 12) + '…' : optText;

    // Stage III button
    var btnStage = document.getElementById('btn-stage-anthro');
    if (btnStage) btnStage.textContent = 'Stage III: ' + shortName;

    // Panel headings
    var p1 = document.getElementById('panel-anthro-p1');
    if (p1) { var h1 = p1.querySelector('h2'); if (h1) h1.textContent = optText + ': Paper I'; }
    var p2 = document.getElementById('panel-anthro-p2');
    if (p2) { var h2 = p2.querySelector('h2'); if (h2) h2.textContent = optText + ': Paper II'; }

    // Pie chart labels
    var pieA1 = document.getElementById('pie-a1');
    if (pieA1) {
        var card1 = pieA1.closest ? pieA1.closest('.pie-card-dark') : null;
        if (card1) {
            var lbl1 = card1.querySelector('.pie-label');
            if (lbl1) { var sp1 = lbl1.querySelector('span'); lbl1.textContent = shortName + ' P1 '; if (sp1) lbl1.appendChild(sp1); }
        }
    }
    var pieA2 = document.getElementById('pie-a2');
    if (pieA2) {
        var card2 = pieA2.closest ? pieA2.closest('.pie-card-dark') : null;
        if (card2) {
            var lbl2 = card2.querySelector('.pie-label');
            if (lbl2) { var sp2 = lbl2.querySelector('span'); lbl2.textContent = shortName + ' P2 '; if (sp2) lbl2.appendChild(sp2); }
        }
    }

    // Add-topic modal dropdown
    var sel = document.getElementById('modal-select-panel');
    if (sel) {
        sel.querySelectorAll('option').forEach(function(opt) {
            if (opt.value === 'box-anthro-p1') opt.textContent = shortName + ' Paper I';
            if (opt.value === 'box-anthro-p2') opt.textContent = shortName + ' Paper II';
            if (opt.value === 'box-anthro-asn') opt.textContent = shortName + ' Assignments';
        });
    }

    // If NOT Anthropology, clear pre-populated Anthro syllabus topics
    // and show a setup guide so users can add their own topics
    if (optText && optText !== 'Anthropology' && optText !== 'Optional') {
        var b1 = document.getElementById('box-anthro-p1');
        var b2 = document.getElementById('box-anthro-p2');
        var guide = function(label) {
            return '<div style="text-align:center;padding:2rem 1.5rem;color:var(--t3);border:1px dashed var(--bdr);border-radius:1rem;margin-bottom:0.75rem;">'
                + '<div style="font-size:1.5rem;margin-bottom:0.5rem">📚</div>'
                + '<div style="font-size:0.8rem;font-weight:700;color:var(--t2);margin-bottom:0.35rem">' + label + ' — Custom Setup</div>'
                + '<div style="font-size:0.72rem;line-height:1.6">Add your ' + optText + ' ' + label + ' topics below.<br>Click <strong>+ Custom Topic</strong> to start building your syllabus.</div>'
                + '</div>';
        };
        if (b1) b1.innerHTML = guide('Paper I');
        if (b2) b2.innerHTML = guide('Paper II');
    }
}

// Default features for new users — ai_chat OFF until admin enables it
var DEFAULT_FEATURES = { focus: true, plans: true, ai_chat: false, pyq: true, sources: true };
// Superuser always gets everything
var SUPERUSER_FEATURES = { focus: true, plans: true, ai_chat: true, pyq: true, sources: true };

function applyFeatureGates(features) {
    // Merge with defaults so missing keys behave correctly
    var f = Object.assign({}, DEFAULT_FEATURES, features || {});
    // Focus mode
    var focusWidget = document.getElementById('focus-mode-widget');
    if (focusWidget) focusWidget.style.display = f.focus === false ? 'none' : '';
    // Plans tab
    var plansTab = document.querySelector('[onclick*="plans"]');
    if (plansTab) plansTab.style.display = f.plans === false ? 'none' : '';
    // AI Chat fab
    var aiFab = document.getElementById('ai-chat-fab');
    if (aiFab) aiFab.style.display = f.ai_chat === false ? 'none' : '';
    var aiPanel = document.getElementById('ai-chat-panel');
    if (aiPanel && f.ai_chat === false) aiPanel.classList.add('hidden');
    // PYQ tab
    var pyqTab = document.querySelector('[onclick*="pyq"]');
    if (pyqTab) pyqTab.style.display = f.pyq === false ? 'none' : '';
    // Sources tab
    var srcTab = document.querySelector('[onclick*="sources"]');
    if (srcTab) srcTab.style.display = f.sources === false ? 'none' : '';
}

function handleProfileSetup() {
    const nameInput    = document.getElementById('setup-name');
    const ageInput     = document.getElementById('setup-age');
    const attemptInput = document.getElementById('setup-attempt');
    const phoneInput   = document.getElementById('setup-phone');

    const name    = nameInput.value.trim();
    const age     = parseInt(ageInput.value);
    const attempt = parseInt(attemptInput.value);
    const phone   = phoneInput ? phoneInput.value.trim() : '';

    document.querySelectorAll('.field-error').forEach(el => el.style.display = 'none');
    document.querySelectorAll('#profile-setup-screen input').forEach(el => el.classList.remove('input-error'));

    let hasError = false;

    // Name: 2-50 chars, letters/spaces only
    if (!name || name.length < 2 || !/^[A-Za-z][A-Za-z\s\.'-]{1,49}$/.test(name)) {
        document.getElementById('err-name').style.display = 'block';
        document.getElementById('err-name').textContent = 'Enter a valid full name (letters, spaces, . \' - only; min 2 chars)';
        nameInput.classList.add('input-error');
        hasError = true;
    }
    // Age: 16-45
    if (!age || age < 16 || age > 45) {
        document.getElementById('err-age').style.display = 'block';
        ageInput.classList.add('input-error');
        hasError = true;
    }
    // Attempt: 1-10
    if (!attempt || attempt < 1 || attempt > 10) {
        document.getElementById('err-attempt').style.display = 'block';
        attemptInput.classList.add('input-error');
        hasError = true;
    }
    // Phone: optional, but if provided must be valid 10-digit Indian mobile (starts with 6-9)
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
        document.getElementById('err-phone').style.display = 'block';
        if (phoneInput) phoneInput.classList.add('input-error');
        hasError = true;
    }

    if (hasError) return;

    var optEl     = document.getElementById('setup-optional');
    var optCustEl = document.getElementById('setup-optional-custom');
    var optSubject = optEl ? optEl.value : 'none';
    var optCustom  = (optSubject === 'custom' && optCustEl) ? optCustEl.value.trim() : '';

    const btn = document.getElementById('setup-submit-btn');
    btn.style.opacity = '0.6';
    btn.textContent = '✨ Setting up...';

    saveUserProfile(name, age, attempt, optSubject, optCustom, phone).then(() => {
        const profile = { display_name: name, age, attempt, optional_subject: optSubject, optional_subject_custom: optCustom, phone: phone || '' };
        localStorage.setItem('upsc_profile_' + currentUserId, JSON.stringify(profile));
        applyProfileToUI(profile);
        document.getElementById('profile-setup-screen').style.display = 'none';
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById("sync-status-text").innerText = "CONNECTING CLOUD...";
        syncLatestCloudState();
        updateSessionActivity();
    });
}

async function getUserProfile() {
    if (!dbClient || !currentUserId) return null;
    try {
        const { data, error } = await dbClient.from('upsc_user_profiles').select('*').eq('user_id', currentUserId).maybeSingle();
        if (error) return null;
        if (data && data.display_name) return data;
    } catch(e) {}
    return null;
}

async function saveUserProfile(name, age, attempt, optSubject, optCustom, phone) {
    if (!dbClient || !currentUserId) return;
    try {
        const { data: { session } } = await dbClient.auth.getSession();
        const email = session?.user?.email || null;
        await dbClient.from('upsc_user_profiles').upsert({
            user_id: currentUserId,
            display_name: name,
            age: age,
            attempt: attempt,
            email: email,
            phone: phone || null,
            optional_subject: optSubject || 'none',
            optional_subject_custom: optCustom || ''
        }, { onConflict: 'user_id' });
    } catch(e) { console.error('Failed to save profile:', e); }
}

// Profile setup Enter key navigation
document.getElementById('setup-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('setup-age').focus(); });
document.getElementById('setup-age').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('setup-attempt').focus(); });
document.getElementById('setup-attempt').addEventListener('keydown', (e) => { if (e.key === 'Enter') { var ph = document.getElementById('setup-phone'); ph ? ph.focus() : handleProfileSetup(); } });
document.getElementById('setup-phone') && document.getElementById('setup-phone').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleProfileSetup(); });
document.querySelectorAll('#profile-setup-screen input').forEach(input => {
    input.addEventListener('input', () => {
        input.classList.remove('input-error');
        if (input.nextElementSibling && input.nextElementSibling.classList.contains('field-error')) {
            input.nextElementSibling.style.display = 'none';
        }
    });
});
