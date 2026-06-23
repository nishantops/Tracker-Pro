// =========================================================================
// UPSC Tracker - Plans Module (v3) — card grid + drawer + gantt
// =========================================================================

// Module state
var _planDataStore   = {};   // { enc: { title, type, startDate, endDate, category, division, notifEnabled, planSubject, contentType } }
var _activeDrawerPlan = null;
var _activeDrawerTab  = 'tasks';

function openPlannerModal() { document.getElementById('plan-modal').classList.remove('hidden'); }
function closePlannerModal() {
    document.getElementById('plan-modal').classList.add('hidden');
    document.getElementById('modal-plan-title').value = '';
    document.getElementById('modal-plan-start-date').value = '';
    document.getElementById('modal-plan-end-date').value = '';
    var cat = document.getElementById('modal-plan-category');
    var div = document.getElementById('modal-plan-division');
    var notif = document.getElementById('modal-plan-notif');
    var subj = document.getElementById('modal-plan-subject');
    var customName = document.getElementById('modal-plan-custom-name');
    var content = document.getElementById('modal-plan-content');
    if (cat) { cat.value = 'common'; onPlanCategoryChange('common'); }
    if (div) div.value = 'both';
    if (notif) notif.checked = true;
    if (subj) subj.value = '';
    if (customName) customName.value = '';
    if (content) content.value = 'both';
}

function onPlanCategoryChange(val) {
    var subjWrap   = document.getElementById('modal-plan-subject-wrap');
    var customWrap = document.getElementById('modal-plan-custom-name-wrap');
    var subjLabel  = document.getElementById('modal-plan-subject-label');
    var gsLabels   = { gs1:'Subject in GS 1', gs2:'Subject in GS 2', gs3:'Subject in GS 3', gs4:'Subject in GS 4', essay:'Essay Topic / Niche', optional:'Optional Subject', common:'Focus Area (optional)' };
    if (val === 'custom') {
        if (subjWrap)   subjWrap.style.display   = 'none';
        if (customWrap) customWrap.style.display = 'block';
    } else if (['gs1','gs2','gs3','gs4','essay','optional','common'].includes(val)) {
        if (subjWrap)   subjWrap.style.display   = 'block';
        if (customWrap) customWrap.style.display = 'none';
        if (subjLabel)  subjLabel.textContent    = gsLabels[val] || 'Subject / Topic';
    } else {
        if (subjWrap)   subjWrap.style.display   = 'none';
        if (customWrap) customWrap.style.display = 'none';
    }
}

async function executeCreatePlan() {
    var title    = document.getElementById('modal-plan-title').value.trim();
    var type     = document.getElementById('modal-plan-type').value;
    var startDate = document.getElementById('modal-plan-start-date').value || null;
    var endDate   = document.getElementById('modal-plan-end-date').value || null;
    var catEl    = document.getElementById('modal-plan-category');
    var divEl    = document.getElementById('modal-plan-division');
    var notifEl  = document.getElementById('modal-plan-notif');
    var subjEl   = document.getElementById('modal-plan-subject');
    var customNameEl = document.getElementById('modal-plan-custom-name');
    var category = catEl ? catEl.value : 'common';
    var division = divEl ? divEl.value : 'both';
    var notifEnabled = notifEl ? notifEl.checked : true;
    var planSubject  = subjEl && subjEl.value.trim() ? subjEl.value.trim() : '';
    var customName   = customNameEl && customNameEl.value.trim() ? customNameEl.value.trim() : '';
    var contentEl    = document.getElementById('modal-plan-content');
    var contentType  = contentEl ? contentEl.value : 'both';
    if (category === 'custom' && customName) planSubject = customName;

    if (!title) { alert('Plan Title required'); return; }

    var encodedName = btoa(unescape(encodeURIComponent(title)));
    buildPlanCardDOM(title, encodedName, type, startDate, endDate, category, division, notifEnabled, planSubject, contentType);

    if (dbClient) {
        await dbClient.from('upsc_custom_plans').upsert({
            plan_id: encodedName, user_id: currentUserId,
            plan_title: title, plan_type: type,
            start_date: startDate, end_date: endDate,
            plan_category: category, plan_division: division,
            notif_enabled: notifEnabled,
            plan_subject: planSubject || null,
            content_type: contentType
        }, { onConflict: 'plan_id,user_id' });
    }
    closePlannerModal();
}

function buildPlanCardDOM(title, encodedName, type, startDate, endDate, category, division, notifEnabled, planSubject, contentType) {
    if (document.getElementById('plan_card_wrapper_' + encodedName)) return;
    category    = category    || 'common';
    division    = division    || 'both';
    contentType = contentType || 'both';
    notifEnabled = (notifEnabled === false) ? false : true;

    // Cache plan metadata
    _planDataStore[encodedName] = {
        title: title, type: type, startDate: startDate || null, endDate: endDate || null,
        category: category, division: division, notifEnabled: notifEnabled,
        planSubject: planSubject || '', contentType: contentType
    };

    var catStyle = PLAN_CAT_STYLES[category] || PLAN_CAT_STYLES.custom;
    var catLabel = planSubject ? planSubject : (PLAN_CAT_LABELS[category] || category);
    var divLabel = PLAN_DIV_LABELS[division] || division;

    // Date text + days-left badge
    var dateStr = '';
    var daysHtml = '';
    if (startDate || endDate) {
        dateStr = (startDate ? formatPlanDate(startDate) : '?') + (endDate ? ' \u2192 ' + formatPlanDate(endDate) : '');
    }
    if (endDate) {
        var diff = Math.ceil((new Date(endDate + 'T00:00:00') - new Date()) / 86400000);
        var dLabel = diff > 0 ? diff + 'd left' : (diff === 0 ? 'Due today' : Math.abs(diff) + 'd over');
        var dCls   = diff < 0 ? 'pcard-days-over' : (diff <= 7 ? 'pcard-days-warn' : 'pcard-days-ok');
        daysHtml = ' <span class="pcard-days ' + dCls + '">' + dLabel + '</span>';
    }
    var mutedHtml = !notifEnabled ? ' <span class="plan-badge plan-muted-badge">\ud83d\udd15</span>' : '';

    // ── COMPACT CARD (visible in grid) ─────────────────────────────────────
    var cardHtml =
        '<div class="plan-card" onclick="openPlanDrawer(\'' + encodedName + '\')" role="button" tabindex="0" onkeydown="if(event.key===\'Enter\'||event.key===\' \')openPlanDrawer(\'' + encodedName + '\')">'
        + '<div class="plan-card-stripe" style="background:linear-gradient(90deg,' + catStyle.text + '99,' + catStyle.text + '22);"></div>'
        + '<div class="plan-card-inner">'
        +   '<div class="plan-card-top">'
        +     '<span class="plan-card-title">' + title + '</span>'
        +     '<button class="plan-card-del" onclick="event.stopPropagation();eraseCustomNode(\'plan_meta_' + encodedName + '\',this)" title="Delete plan">\xd7</button>'
        +   '</div>'
        +   '<div class="plan-card-badges">'
        +     '<span class="plan-badge plan-type-badge">' + type + '</span>'
        +     '<span class="plan-badge plan-cat-badge plan-cat-' + category + '">' + catLabel + '</span>'
        +     '<span class="plan-badge plan-div-badge">' + divLabel + '</span>'
        +     mutedHtml
        +   '</div>'
        +   (dateStr ? '<div class="plan-card-dates">\ud83d\udcc5 ' + dateStr + daysHtml + '</div>' : '')
        +   '<div class="plan-card-footer">'
        +     '<div class="plan-card-pbar"><div id="pbar-plan-' + encodedName + '" class="plan-card-pbar-fill" style="width:0%"></div></div>'
        +     '<span id="lbl-plan-' + encodedName + '" class="plan-card-pct">0%</span>'
        +   '</div>'
        + '</div>'
        + '</div>';

    // ── HIDDEN DETAIL DOM (moved into drawer when opened) ──────────────────
    var detailHtml =
        '<div id="plan_detail_' + encodedName + '" class="plan-detail-data" style="display:none;">'
        // Note pane
        + '<div id="plan-pane-note-' + encodedName + '" class="plan-detail-pane" style="display:none;padding:0.25rem 0;">'
        +   '<textarea id="note-plan_card_' + encodedName + '" oninput="debouncedSync(\'plan_card_' + encodedName + '\')" rows="5" placeholder="Master strategy / goals for this plan\u2026" '
        +   'style="width:100%;background:var(--inp);border:1px solid var(--bdr);color:var(--t2);border-radius:0.75rem;padding:0.75rem 1rem;font-size:0.8rem;font-family:var(--mono);resize:vertical;outline:none;box-sizing:border-box;" '
        +   'onfocus="this.style.borderColor=\'var(--bdr-h)\'" onblur="this.style.borderColor=\'var(--bdr)\'"></textarea>'
        + '</div>'
        // Tasks pane
        + '<div id="plan-pane-tasks-' + encodedName + '" class="plan-detail-pane">'
        +   '<div id="target-list-' + encodedName + '" class="space-y-2 mb-3"></div>'
        +   '<button onclick="addPlanTaskPrompt(\'' + encodedName + '\')" class="ptask-add-btn" id="ptask-add-btn-' + encodedName + '">'
        +     '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg> Add Sub-Target'
        +   '</button>'
        + '</div>'
        // Table pane
        + '<div id="plan-pane-table-' + encodedName + '" class="plan-detail-pane" style="display:none;">'
        +   '<div id="plan-table-container-' + encodedName + '" class="pt-container">'
        +     '<div class="pt-loading">Loading table\u2026</div>'
        +   '</div>'
        + '</div>'
        // Hidden pie element (for calculatePlanPies backward compat)
        + '<div id="pie-plan-' + encodedName + '" class="pie-chart-frame" style="display:none;width:2.5rem;height:2.5rem;background:var(--surf);"></div>'
        + '</div>';

    var wrapperHtml = '<div id="plan_card_wrapper_' + encodedName + '" class="plan-card-wrapper">'
        + cardHtml + detailHtml + '</div>';

    var grid = document.getElementById('planner-grid');
    if (grid) grid.insertAdjacentHTML('afterbegin', wrapperHtml);
    _updatePlannerEmpty();
}

// ── Plan Drawer ─────────────────────────────────────────────────────────────
function openPlanDrawer(encodedName) {
    var plan = _planDataStore[encodedName];
    if (!plan) return;
    var detailEl   = document.getElementById('plan_detail_' + encodedName);
    var drawerBody = document.getElementById('plan-drawer-body');
    if (!detailEl || !drawerBody) return;

    // Populate header
    var catStyle = PLAN_CAT_STYLES[plan.category] || PLAN_CAT_STYLES.custom;
    var catLabel = plan.planSubject || PLAN_CAT_LABELS[plan.category] || plan.category;
    document.getElementById('plan-drawer-title').textContent = plan.title;
    document.getElementById('plan-drawer-badges').innerHTML =
        '<span class="plan-badge plan-type-badge">' + plan.type + '</span>'
        + '<span class="plan-badge plan-cat-badge plan-cat-' + plan.category + '">' + catLabel + '</span>'
        + '<span class="plan-badge plan-div-badge">' + (PLAN_DIV_LABELS[plan.division] || plan.division) + '</span>';
    document.getElementById('plan-drawer-dates').textContent = (plan.startDate || plan.endDate)
        ? '\ud83d\udcc5 ' + (plan.startDate ? formatPlanDate(plan.startDate) : '?') + (plan.endDate ? ' \u2192 ' + formatPlanDate(plan.endDate) : '')
        : '';

    // Show / hide tabs based on contentType
    var ct = plan.contentType || 'both';
    var tdtTasks = document.getElementById('pdt-tasks');
    var tdtTable = document.getElementById('pdt-table');
    if (tdtTasks) tdtTasks.style.display = (ct === 'tables') ? 'none' : '';
    if (tdtTable) tdtTable.style.display = (ct === 'tasks')  ? 'none' : '';

    // Move detail DOM into drawer
    drawerBody.innerHTML = '';
    drawerBody.appendChild(detailEl);
    detailEl.style.display = '';
    _activeDrawerPlan = encodedName;

    // Default tab
    switchDrawerTab(ct === 'tables' ? 'table' : 'tasks');

    // Open drawer
    var drawer  = document.getElementById('plan-drawer');
    var overlay = document.getElementById('plan-drawer-overlay');
    if (drawer)  drawer.style.transform = 'translateX(0)';
    if (overlay) overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closePlanDrawer() {
    var enc = _activeDrawerPlan;
    if (!enc) return;
    var detailEl   = document.getElementById('plan_detail_' + enc);
    var wrapper    = document.getElementById('plan_card_wrapper_' + enc);
    var drawerBody = document.getElementById('plan-drawer-body');

    if (detailEl) {
        detailEl.style.display = 'none';
        if (wrapper) { wrapper.appendChild(detailEl); }
        else if (drawerBody) { drawerBody.innerHTML = ''; }
    }

    var drawer  = document.getElementById('plan-drawer');
    var overlay = document.getElementById('plan-drawer-overlay');
    if (drawer)  drawer.style.transform = 'translateX(100%)';
    if (overlay) overlay.classList.add('hidden');
    document.body.style.overflow = '';
    _activeDrawerPlan = null;
    _activeDrawerTab  = 'tasks';
}

function switchDrawerTab(tab) {
    var enc = _activeDrawerPlan;
    if (!enc) return;
    ['tasks', 'table', 'note'].forEach(function(t) {
        var btn  = document.getElementById('pdt-' + t);
        var pane = document.getElementById('plan-pane-' + t + '-' + enc);
        if (btn)  btn.classList.toggle('active', t === tab);
        if (pane) pane.style.display = (t === tab) ? '' : 'none';
    });
    if (tab === 'table' && typeof loadPlanTables === 'function') loadPlanTables(enc);
    _activeDrawerTab = tab;
}

// ── Gantt Timeline ──────────────────────────────────────────────────────────
function renderGanttTimeline(viewMode) {
    var container = document.getElementById('plan-gantt-container');
    if (!container) return;
    viewMode = viewMode || 'month';
    ['month', 'week'].forEach(function(m) {
        var btn = document.getElementById('gantt-btn-' + m);
        if (btn) btn.classList.toggle('active', m === viewMode);
    });

    var allPlans     = Object.entries(_planDataStore);
    var datedPlans   = allPlans.filter(function(e) { return e[1].startDate && e[1].endDate; });
    var undatedPlans = allPlans.filter(function(e) { return !e[1].startDate || !e[1].endDate; });

    if (allPlans.length === 0) {
        container.innerHTML = '<div class="plan-gantt-empty-msg">No plans yet. Create plans to see the mission timeline.</div>'; return;
    }
    if (datedPlans.length === 0) {
        container.innerHTML = '<div class="plan-gantt-empty-msg">Add start \u2192 end dates to your plans to see them on the timeline.<br><br>'
            + undatedPlans.map(function(e) { return '<span class="plan-badge plan-type-badge" style="cursor:pointer" onclick="openPlanDrawer(\'' + e[0] + '\')">' + e[1].title + '</span>'; }).join(' ')
            + '</div>'; return;
    }

    var now = new Date();
    var allDates = [];
    datedPlans.forEach(function(e) {
        allDates.push(new Date(e[1].startDate + 'T00:00:00'));
        allDates.push(new Date(e[1].endDate   + 'T00:00:00'));
    });
    var minD = new Date(Math.min.apply(null, allDates));
    var maxD = new Date(Math.max.apply(null, allDates));

    var units = _ganttUnits(minD, maxD, viewMode);
    if (units.length > 52) units = units.slice(0, 52);

    var colMin = viewMode === 'month' ? '4.5rem' : '3rem';
    var html = '<div class="plan-gantt-scroll"><div class="plan-gantt-grid" style="grid-template-columns:9rem repeat(' + units.length + ',minmax(' + colMin + ',1fr));">';

    // Header
    html += '<div class="plan-gantt-corner">PLAN</div>';
    units.forEach(function(u) {
        var isNow = _ganttIsNow(u, viewMode, now);
        var label = viewMode === 'month'
            ? u.toLocaleDateString('en-IN', { month: 'short' }) + '<br><span class="plan-gantt-yr">' + u.getFullYear() + '</span>'
            : u.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        html += '<div class="plan-gantt-col-hdr' + (isNow ? ' plan-gantt-now-col' : '') + '">' + label + '</div>';
    });

    // Plan rows
    datedPlans.forEach(function(entry) {
        var enc = entry[0], plan = entry[1];
        var catStyle = PLAN_CAT_STYLES[plan.category] || PLAN_CAT_STYLES.custom;
        var catLabel = plan.planSubject || PLAN_CAT_LABELS[plan.category] || plan.category;
        var boxes = document.querySelectorAll('.plan-task-box-' + enc);
        var total = boxes.length, done = 0;
        boxes.forEach(function(b) { if (b.checked) done++; });
        var pct = total > 0 ? Math.round((done / total) * 100) : -1;

        html += '<div class="plan-gantt-row-label" onclick="openPlanDrawer(\'' + enc + '\')" title="' + plan.title + '">'
            + '<div class="plan-gantt-plan-name">' + plan.title + '</div>'
            + '<div class="plan-gantt-plan-sub" style="color:' + catStyle.text + ';">' + catLabel + '</div>'
            + (pct >= 0 ? '<div class="plan-gantt-pct">' + pct + '%</div>' : '')
            + '</div>';

        var planStart = new Date(plan.startDate + 'T00:00:00');
        var planEnd   = new Date(plan.endDate   + 'T23:59:59');
        units.forEach(function(u, ci) {
            var uEnd = _ganttUnitEnd(u, viewMode);
            if (planStart > uEnd || planEnd < u) { html += '<div class="plan-gantt-empty-cell"></div>'; return; }
            var isFirst = ci === 0 || planStart > _ganttUnitEnd(units[ci - 1], viewMode);
            var isLast  = ci === units.length - 1 || planEnd < units[ci + 1];
            var rL = isFirst ? '0.4rem' : '0', rR = isLast ? '0.4rem' : '0';
            html += '<div class="plan-gantt-bar-cell" style="'
                + 'background:' + catStyle.bg + ';'
                + 'border-top:2px solid ' + catStyle.text + '55;border-bottom:2px solid ' + catStyle.text + '55;'
                + (isFirst ? 'border-left:3px solid ' + catStyle.text + ';' : '')
                + (isLast  ? 'border-right:2px solid ' + catStyle.text + ';' : '')
                + 'border-radius:' + rL + ' ' + rR + ' ' + rR + ' ' + rL + ';'
                + '"></div>';
        });
    });

    html += '</div></div>';
    if (undatedPlans.length > 0) {
        html += '<div class="plan-gantt-undated"><span style="color:var(--t3);font-size:0.65rem;font-family:var(--mono);">No date range:</span> '
            + undatedPlans.map(function(e) { return '<span class="plan-badge plan-type-badge" style="cursor:pointer" onclick="openPlanDrawer(\'' + e[0] + '\')">' + e[1].title + '</span>'; }).join(' ')
            + '</div>';
    }
    container.innerHTML = html;
}

function _ganttUnits(minD, maxD, viewMode) {
    var units = [];
    if (viewMode === 'month') {
        var d = new Date(minD.getFullYear(), minD.getMonth(), 1);
        var end = new Date(maxD.getFullYear(), maxD.getMonth() + 1, 0);
        while (d <= end) { units.push(new Date(d)); d.setMonth(d.getMonth() + 1); }
    } else {
        var d = new Date(minD);
        var day = d.getDay();
        d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        var end = new Date(maxD); end.setDate(end.getDate() + 7);
        while (d <= end) { units.push(new Date(d)); d.setDate(d.getDate() + 7); }
    }
    return units;
}
function _ganttUnitEnd(u, viewMode) {
    if (viewMode === 'month') return new Date(u.getFullYear(), u.getMonth() + 1, 0, 23, 59, 59);
    var e = new Date(u); e.setDate(e.getDate() + 6); e.setHours(23, 59, 59); return e;
}
function _ganttIsNow(u, viewMode, now) {
    if (viewMode === 'month') return u.getFullYear() === now.getFullYear() && u.getMonth() === now.getMonth();
    return now >= u && now <= _ganttUnitEnd(u, viewMode);
}

function _updatePlannerEmpty() {
    var grid  = document.getElementById('planner-grid');
    var empty = document.getElementById('planner-empty');
    if (!grid || !empty) return;
    empty.classList.toggle('hidden', grid.children.length > 0);
}

// ESC closes plan drawer first
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && _activeDrawerPlan) {
        closePlanDrawer(); e.stopImmediatePropagation();
    }
});


    common:   { bg: 'rgba(99,102,241,0.15)',  text: '#818cf8', bdr: 'rgba(99,102,241,0.35)'  },
    gs1:      { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24', bdr: 'rgba(245,158,11,0.35)'  },
    gs2:      { bg: 'rgba(16,185,129,0.15)',  text: '#34d399', bdr: 'rgba(16,185,129,0.35)'  },
    gs3:      { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', bdr: 'rgba(59,130,246,0.35)'  },
    gs4:      { bg: 'rgba(236,72,153,0.15)',  text: '#f472b6', bdr: 'rgba(236,72,153,0.35)'  },
    essay:    { bg: 'rgba(139,92,246,0.15)',  text: '#a78bfa', bdr: 'rgba(139,92,246,0.35)'  },
    optional: { bg: 'rgba(244,63,94,0.15)',   text: '#fb7185', bdr: 'rgba(244,63,94,0.35)'   },
    custom:   { bg: 'rgba(156,163,175,0.15)', text: '#9ca3af', bdr: 'rgba(156,163,175,0.35)' }
};
var PLAN_CAT_LABELS = { common:'Common', gs1:'GS 1', gs2:'GS 2', gs3:'GS 3', gs4:'GS 4', essay:'Essay', optional:'Optional', custom:'Custom' };
var PLAN_DIV_LABELS = { prelims:'Prelims', mains:'Mains', both:'P + M' };

// ── Inline task entry ───────────────────────────────────────────────────────
function addPlanTaskPrompt(planEncodedName) {
    // If inline form already open, just focus it
    var existing = document.getElementById('ptask-inline-' + planEncodedName);
    if (existing) { existing.querySelector('input').focus(); return; }
    // Hide the add button
    var addBtn = document.getElementById('ptask-add-btn-' + planEncodedName);
    if (addBtn) addBtn.style.display = 'none';
    // Build inline form
    var container = document.getElementById('target-list-' + planEncodedName);
    if (!container) return;
    var div = document.createElement('div');
    div.id = 'ptask-inline-' + planEncodedName;
    div.className = 'ptask-inline';
    div.innerHTML = '<input type="text" id="ptask-inline-input-' + planEncodedName
        + '" placeholder="Enter specific target or task…" class="ptask-inline-input">'
        + '<div class="ptask-inline-btns">'
        + '<button onclick="submitInlineTask(\'' + planEncodedName + '\')" class="ptask-submit">Add</button>'
        + '<button onclick="cancelInlineTask(\'' + planEncodedName + '\')" class="ptask-cancel">Cancel</button>'
        + '</div>';
    container.appendChild(div);
    var inp = document.getElementById('ptask-inline-input-' + planEncodedName);
    if (inp) {
        inp.focus();
        inp.addEventListener('keydown', function(e) {
            if (e.key === 'Enter')  submitInlineTask(planEncodedName);
            if (e.key === 'Escape') cancelInlineTask(planEncodedName);
        });
    }
}

function submitInlineTask(planEncodedName) {
    var inp = document.getElementById('ptask-inline-input-' + planEncodedName);
    var taskName = inp ? inp.value.trim() : '';
    cancelInlineTask(planEncodedName);
    if (!taskName) return;
    var taskEncoded = btoa(unescape(encodeURIComponent(taskName)));
    var fullId = 'plan_task_' + planEncodedName + '_' + taskEncoded;
    buildPlanTaskDOM(planEncodedName, taskName, fullId, false, '');
    handleSyncAction(fullId);
}

function cancelInlineTask(planEncodedName) {
    var el = document.getElementById('ptask-inline-' + planEncodedName);
    if (el) el.remove();
    var addBtn = document.getElementById('ptask-add-btn-' + planEncodedName);
    if (addBtn) addBtn.style.display = '';
}

function buildPlanTaskDOM(planEncodedName, taskText, fullId, isChecked, noteText) {
    var container = document.getElementById('target-list-' + planEncodedName);
    if (!container || document.getElementById(fullId)) return;
    var checkAttr = isChecked ? 'checked' : '';
    var lockedAttr = isChecked ? 'readonly' : '';
    var lockedClass = isChecked ? 'locked-note' : '';
    var htmlNode = '<div class="task-row flex flex-col p-3 rounded-xl transition group relative" style="background:var(--surf);border:1px solid var(--bdr);margin-bottom:0.35rem;">'
        + '<div class="flex justify-between items-start w-full">'
        + '<label for="' + fullId + '" class="flex items-start cursor-pointer w-full text-xs sm:text-sm font-bold select-none">'
        + '<input type="checkbox" id="' + fullId + '" onchange="handleSyncAction(\'' + fullId + '\')" class="plan-task-box-' + planEncodedName + ' mt-0.5 mr-3 flex-shrink-0 cursor-pointer" ' + checkAttr + '>'
        + '<span style="color:var(--t1);" class="break-words font-medium transition-all">' + taskText + '</span>'
        + '</label>'
        + '<button onclick="eraseCustomNode(\'' + fullId + '\', this)" class="opacity-0 group-hover:opacity-100 transition cursor-pointer ml-3 flex-shrink-0" style="background:none;border:none;color:var(--t3);">'
        + '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>'
        + '</button></div>'
        + '<div class="mt-2" style="padding-left:1.65rem;">'
        + '<input type="text" id="note-' + fullId + '" oninput="debouncedSync(\'' + fullId + '\')" value="' + (noteText || '') + '" placeholder="Task note..." '
        + 'style="width:100%;background:var(--inp);border:1px solid var(--bdr);color:var(--t2);border-radius:0.4rem;padding:0.3rem 0.6rem;font-size:0.65rem;font-family:var(--mono);outline:none;" '
        + 'class="' + lockedClass + '" ' + lockedAttr + '>'
        + '</div></div>';
    container.insertAdjacentHTML('beforeend', htmlNode);
    calculatePlanPies();
}

function calculatePlanPies() {
    document.querySelectorAll('[id^="pie-plan-"]').forEach(function(pieEl) {
        var encodedName = pieEl.id.replace('pie-plan-', '');
        var taskBoxes = document.querySelectorAll('.plan-task-box-' + encodedName);
        var lblEl  = document.getElementById('lbl-plan-' + encodedName);
        var pbarEl = document.getElementById('pbar-plan-' + encodedName);
        var sTotal = taskBoxes.length, sChecked = 0;
        taskBoxes.forEach(function(b) { if (b.checked) sChecked++; });
        var sPct = sTotal > 0 ? Math.round((sChecked / sTotal) * 100) : 0;
        if (lblEl)  lblEl.innerText = sPct + '%';
        if (pbarEl) pbarEl.style.width = sPct + '%';
        pieEl.style.background = 'conic-gradient(#10b981 ' + sPct + '%, rgba(51,65,85,0.6) 0%)';
    });
}

function formatPlanDate(dateStr) {
    if (!dateStr) return '';
    try {
        var d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch(e) { return dateStr; }
}