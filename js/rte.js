// =========================================================================
// RTE — Shared Rich Text Editor Utility
// Converts any <input> / <textarea> into a contenteditable editor.
// The original element stays hidden but .value is kept in sync so all
// existing debouncedSync / handleSyncAction / debouncedSyncAssignment
// calls continue to work without modification.
//
// API:
//   RTE.init(elementId, opts)          — attach RTE to element
//   RTE.populate(elementId, html)      — set content (called during cloud load)
//   RTE.lock(elementId, bool)          — lock / unlock editor
//
// opts:
//   opts.full    {bool}  — show full toolbar (default: compact floating toolbar)
//   opts.minH    {str}   — min-height CSS value (default '1.8rem' compact / '90px' full)
// =========================================================================
(function (window) {
    'use strict';

    var _reg = {};   // elementId → { editor, toolbar, wrapper, original }

    // ── Toolbar definitions ───────────────────────────────────────────────
    var FULL_ITEMS = [
        { cmd: 'bold',                icon: '<b>B</b>',            title: 'Bold (Ctrl+B)' },
        { cmd: 'italic',              icon: '<i>I</i>',            title: 'Italic (Ctrl+I)' },
        { cmd: 'underline',           icon: '<u>U</u>',            title: 'Underline (Ctrl+U)' },
        { cmd: 'strikeThrough',       icon: '<s>S</s>',            title: 'Strikethrough' },
        '|',
        { cmd: 'insertUnorderedList', icon: '&#8226; List',        title: 'Bullet list' },
        { cmd: 'insertOrderedList',   icon: '1. List',             title: 'Ordered list' },
        '|',
        { color: '#ef4444', title: 'Red'    },
        { color: '#f59e0b', title: 'Amber'  },
        { color: '#10b981', title: 'Green'  },
        { color: '#3b82f6', title: 'Blue'   },
        { color: '#8b5cf6', title: 'Purple' },
        { color: '#f472b6', title: 'Pink'   },
        { colorPicker: true },
        '|',
        { cmd: 'removeFormat', icon: '\u2298 Clear', title: 'Clear formatting' },
    ];

    var MINI_ITEMS = [
        { cmd: 'bold',          icon: '<b>B</b>', title: 'Bold (Ctrl+B)' },
        { cmd: 'italic',        icon: '<i>I</i>', title: 'Italic (Ctrl+I)' },
        { cmd: 'underline',     icon: '<u>U</u>', title: 'Underline (Ctrl+U)' },
        '|',
        { cmd: 'insertUnorderedList', icon: '&#8226;', title: 'Bullet list' },
        '|',
        { color: '#ef4444', title: 'Red'   },
        { color: '#10b981', title: 'Green' },
        { color: '#3b82f6', title: 'Blue'  },
        '|',
        { cmd: 'removeFormat', icon: '\u2298', title: 'Clear' },
    ];

    // ── Build toolbar DOM ─────────────────────────────────────────────────
    function _buildToolbar(items, editorEl) {
        var tb = document.createElement('div');
        tb.className = 'rte-tb';

        items.forEach(function (item) {
            if (item === '|') {
                var sep = document.createElement('span');
                sep.className = 'rte-tb-sep';
                tb.appendChild(sep);
                return;
            }
            if (item.color) {
                var swatch = document.createElement('button');
                swatch.type = 'button';
                swatch.className = 'rte-clr-swatch';
                swatch.style.background = item.color;
                swatch.title = item.title;
                var _c = item.color;
                swatch.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    document.execCommand('foreColor', false, _c);
                    editorEl.focus();
                });
                tb.appendChild(swatch);
                return;
            }
            if (item.colorPicker) {
                var lbl = document.createElement('label');
                lbl.className = 'rte-clr-pick';
                lbl.title = 'Custom colour';
                lbl.innerHTML = '<span>\ud83c\udfa8</span><input type="color" tabindex="-1">';
                var picker = lbl.querySelector('input');
                picker.addEventListener('input', function () {
                    document.execCommand('foreColor', false, picker.value);
                    editorEl.focus();
                });
                tb.appendChild(lbl);
                return;
            }
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rte-tb-btn';
            btn.innerHTML = item.icon;
            btn.title = item.title;
            var _cmd = item.cmd;
            btn.addEventListener('mousedown', function (e) {
                e.preventDefault();
                document.execCommand(_cmd, false, null);
                editorEl.focus();
            });
            tb.appendChild(btn);
        });
        return tb;
    }

    // ── Core init ─────────────────────────────────────────────────────────
    function init(elementId, opts) {
        var original = document.getElementById(elementId);
        if (!original || _reg[elementId]) return;

        opts = opts || {};
        var full       = !!opts.full;
        var compact    = !full;
        var minH       = opts.minH || (full ? '90px' : '2rem');
        var placeholder = original.placeholder || original.getAttribute('placeholder') || '';
        var initVal    = original.value || (original.tagName === 'TEXTAREA' ? original.textContent : '') || '';

        // Wrapper
        var wrapper = document.createElement('div');
        wrapper.className = 'rte-wrap' + (compact ? ' rte-compact' : ' rte-full');
        wrapper.id = 'rte-wrap-' + elementId;

        // Editor
        var editor = document.createElement('div');
        editor.id = 'rte-editor-' + elementId;
        editor.className = 'rte-editor' + (compact ? ' rte-editor-compact' : ' rte-editor-full');
        editor.contentEditable = 'true';
        editor.spellcheck = true;
        editor.style.minHeight = minH;
        editor.dataset.placeholder = placeholder;
        if (initVal) editor.innerHTML = initVal;

        // Toolbar
        var toolbar = _buildToolbar(full ? FULL_ITEMS : MINI_ITEMS, editor);
        toolbar.id = 'rte-tb-' + elementId;

        if (compact) {
            toolbar.style.display = 'none';
            editor.addEventListener('focus', function () { toolbar.style.display = 'flex'; });
            editor.addEventListener('blur', function () {
                setTimeout(function () {
                    if (!wrapper.contains(document.activeElement)) toolbar.style.display = 'none';
                }, 200);
            });
        }

        // Sync editor → original (keeps .value in sync for all existing handlers)
        editor.addEventListener('input', function () {
            original.value = editor.innerHTML;
            // Re-fire the original element's input event so debouncedSync / debouncedSyncAssignment fires
            try { original.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
        });

        // Mount wrapper before original, then move original inside (hidden)
        original.parentNode.insertBefore(wrapper, original);
        wrapper.appendChild(toolbar);
        wrapper.appendChild(editor);
        original.style.display = 'none';
        wrapper.appendChild(original);

        _reg[elementId] = { editor: editor, toolbar: toolbar, wrapper: wrapper, original: original };
    }

    // ── Public helpers ────────────────────────────────────────────────────
    function populate(elementId, html) {
        var entry = _reg[elementId];
        if (entry) {
            entry.editor.innerHTML = html || '';
            entry.original.value  = html || '';
        } else {
            var el = document.getElementById(elementId);
            if (el) el.value = html || '';
        }
    }

    function lock(elementId, locked) {
        var entry = _reg[elementId];
        if (entry) {
            entry.editor.contentEditable = locked ? 'false' : 'true';
            if (locked) {
                entry.editor.classList.add('locked-note');
                entry.toolbar.style.display = 'none';
            } else {
                entry.editor.classList.remove('locked-note');
            }
        } else {
            var el = document.getElementById(elementId);
            if (el) {
                el.readOnly = locked;
                if (locked) el.classList.add('locked-note'); else el.classList.remove('locked-note');
            }
        }
    }

    window.RTE = { init: init, populate: populate, lock: lock, registry: _reg };
})(window);
