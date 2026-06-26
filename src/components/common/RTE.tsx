// ─────────────────────────────────────────────────────────────────────────────
// RTE — Rich Text Editor component
//
// Props:
//   value       {string}    — HTML content (controlled)
//   onChange    {fn}        — called with new HTML string on every input
//   full        {boolean}   — show full toolbar (default: compact mini toolbar)
//   minHeight   {string}    — CSS min-height (default '1.8rem' compact / '90px' full)
//   placeholder {string}    — placeholder text
//   readOnly    {boolean}   — lock editor (adds .locked-note class, disables editing)
//   className   {string}    — extra class on wrapper
//
// Keyboard shortcuts (always active when editor is focused):
//   Ctrl+B         Bold          Ctrl+I          Italic
//   Ctrl+U         Underline     Ctrl+Shift+S    Strikethrough
//   Ctrl+Shift+H   Highlight     Tab             Indent
//   Shift+Tab      Outdent       Ctrl+Z/Y        Undo/Redo
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useEffect, useState, type ChangeEvent, type KeyboardEvent } from 'react';

// Full toolbar items
const FULL_COLORS = [
  { color: '#ef4444', title: 'Red' },
  { color: '#f59e0b', title: 'Amber' },
  { color: '#10b981', title: 'Green' },
  { color: '#3b82f6', title: 'Blue' },
  { color: '#8b5cf6', title: 'Purple' },
  { color: '#f472b6', title: 'Pink' },
];

// Mini toolbar items
const MINI_COLORS = [
  { color: '#ef4444', title: 'Red' },
  { color: '#10b981', title: 'Green' },
  { color: '#3b82f6', title: 'Blue' },
];

const HIGHLIGHT_COLOR = '#fef08a'; // yellow-100

interface RTEProps {
  value?: string;
  onChange?: (html: string) => void;
  full?: boolean;
  minHeight?: string;
  maxHeight?: string;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
}

export function RTE({ value = '', onChange, full = false, minHeight, maxHeight, placeholder = '', readOnly = false, className = '' }: RTEProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [toolbarVisible, setToolbarVisible] = useState(full); // full always visible; compact = on focus
  const [customColor, setCustomColor] = useState('#ffffff');
  const lastHtml = useRef(value);
  const savedRange = useRef<Range | null>(null); // saves selection before color picker steals focus
  const minH = minHeight ?? (full ? '90px' : '1.8rem');
  const colors = full ? FULL_COLORS : MINI_COLORS;

  // ── Custom undo/redo stack (character-level) ──────────────────────────────
  // Browser execCommand groups rapid keystrokes into a single undo transaction.
  // We replace it with our own stack so every input event is its own undo step.
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);

  const placeCursorAtEnd = (editor: HTMLDivElement) => {
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(range);
  };

  const customUndo = () => {
    const editor = editorRef.current;
    if (!editor || undoStack.current.length === 0) return;
    redoStack.current.push(editor.innerHTML);
    const prev = undoStack.current.pop()!;
    editor.innerHTML = prev;
    lastHtml.current = prev;
    placeCursorAtEnd(editor);
    onChange?.(prev);
  };

  const customRedo = () => {
    const editor = editorRef.current;
    if (!editor || redoStack.current.length === 0) return;
    undoStack.current.push(editor.innerHTML);
    const next = redoStack.current.pop()!;
    editor.innerHTML = next;
    lastHtml.current = next;
    placeCursorAtEnd(editor);
    onChange?.(next);
  };

  // Sync incoming value → DOM (only when externally driven, not on user input)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (value !== lastHtml.current && document.activeElement !== editor) {
      editor.innerHTML = value;
      lastHtml.current = value;
      // External value change resets history
      undoStack.current = [];
      redoStack.current = [];
    }
  }, [value]);

  // Sync readOnly
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.contentEditable = readOnly ? 'false' : 'true';
    if (readOnly) editor.classList.add('locked-note');
    else editor.classList.remove('locked-note');
  }, [readOnly]);

  const execCmd = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val ?? undefined);
  };

  const handleInput = () => {
    const html = editorRef.current?.innerHTML ?? '';
    // Push the state BEFORE this change so Ctrl+Z restores it
    undoStack.current.push(lastHtml.current);
    if (undoStack.current.length > 500) undoStack.current.shift();
    redoStack.current = []; // any new input clears the redo branch
    lastHtml.current = html;
    onChange?.(html);
  };

  const handleColorChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCustomColor(e.target.value);
    editorRef.current?.focus();
    // Restore selection that was saved before the color picker stole focus
    if (savedRange.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRange.current);
    }
    document.execCommand('foreColor', false, e.target.value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'Tab') {
      e.preventDefault();
      execCmd(e.shiftKey ? 'outdent' : 'indent');
      return;
    }
    // Custom undo/redo — intercept before browser handles it
    if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); customUndo(); return; }
    if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); customRedo(); return; }
    if (ctrl && e.shiftKey && e.key === 'S') { e.preventDefault(); execCmd('strikeThrough'); return; }
    if (ctrl && e.shiftKey && (e.key === 'H' || e.key === 'h')) {
      e.preventDefault();
      execCmd('backColor', HIGHLIGHT_COLOR);
      return;
    }
  };

  return (
    <div className={`rte-wrap${full ? ' rte-full' : ' rte-compact'} ${className}`}>
      {/* ── Toolbar — hidden when read-only ── */}
      <div
        className="rte-tb"
        style={{ display: readOnly ? 'none' : (full || toolbarVisible) ? 'flex' : 'none' }}
        onMouseDown={(e) => e.preventDefault()} // prevent losing focus from editor
      >
        {/* ── Undo / Redo (full only) ── */}
        {full && (<>
          <button type="button" className="rte-tb-btn" title="Undo (Ctrl+Z)"
            onMouseDown={(e) => { e.preventDefault(); customUndo(); }}>
            ↩
          </button>
          <button type="button" className="rte-tb-btn" title="Redo (Ctrl+Y)"
            onMouseDown={(e) => { e.preventDefault(); customRedo(); }}>
            ↪
          </button>
          <span className="rte-tb-sep" />
        </>)}

        {/* ── Heading selector (full only) ── */}
        {full && (<>
          <button type="button" className="rte-tb-btn rte-tb-heading" title="Normal text"
            onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'p'); }}>
            ¶
          </button>
          <button type="button" className="rte-tb-btn rte-tb-heading" title="Heading 1"
            onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'h1'); }}>
            H1
          </button>
          <button type="button" className="rte-tb-btn rte-tb-heading" title="Heading 2"
            onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'h2'); }}>
            H2
          </button>
          <button type="button" className="rte-tb-btn rte-tb-heading" title="Heading 3"
            onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'h3'); }}>
            H3
          </button>
          <span className="rte-tb-sep" />
        </>)}

        {/* ── Bold / Italic / Underline / Strike ── */}
        <button type="button" className="rte-tb-btn" title="Bold (Ctrl+B)"
          onMouseDown={(e) => { e.preventDefault(); execCmd('bold'); }}>
          <b>B</b>
        </button>
        <button type="button" className="rte-tb-btn" title="Italic (Ctrl+I)"
          onMouseDown={(e) => { e.preventDefault(); execCmd('italic'); }}>
          <i>I</i>
        </button>
        <button type="button" className="rte-tb-btn" title="Underline (Ctrl+U)"
          onMouseDown={(e) => { e.preventDefault(); execCmd('underline'); }}>
          <u>U</u>
        </button>
        {full && (
          <button type="button" className="rte-tb-btn" title="Strikethrough (Ctrl+Shift+S)"
            onMouseDown={(e) => { e.preventDefault(); execCmd('strikeThrough'); }}>
            <s>S</s>
          </button>
        )}
        {full && (
          <button type="button" className="rte-tb-btn rte-tb-highlight" title="Highlight (Ctrl+Shift+H)"
            onMouseDown={(e) => { e.preventDefault(); execCmd('backColor', HIGHLIGHT_COLOR); }}>
            H
          </button>
        )}

        <span className="rte-tb-sep" />

        {/* ── Alignment (full only) ── */}
        {full && (<>
          <button type="button" className="rte-tb-btn" title="Align left"
            onMouseDown={(e) => { e.preventDefault(); execCmd('justifyLeft'); }}>
            ⬛◻◻
          </button>
          <button type="button" className="rte-tb-btn" title="Align center"
            onMouseDown={(e) => { e.preventDefault(); execCmd('justifyCenter'); }}>
            ◻⬛◻
          </button>
          <button type="button" className="rte-tb-btn" title="Align right"
            onMouseDown={(e) => { e.preventDefault(); execCmd('justifyRight'); }}>
            ◻◻⬛
          </button>
          <span className="rte-tb-sep" />
        </>)}

        {/* ── Lists ── */}
        <button type="button" className="rte-tb-btn" title="Bullet list"
          onMouseDown={(e) => { e.preventDefault(); execCmd('insertUnorderedList'); }}>
          {full ? '• List' : '•'}
        </button>
        {full && (
          <button type="button" className="rte-tb-btn" title="Ordered list"
            onMouseDown={(e) => { e.preventDefault(); execCmd('insertOrderedList'); }}>
            1. List
          </button>
        )}

        {/* ── Indent / Outdent (full only) ── */}
        {full && (<>
          <button type="button" className="rte-tb-btn" title="Indent (Tab)"
            onMouseDown={(e) => { e.preventDefault(); execCmd('indent'); }}>
            →|
          </button>
          <button type="button" className="rte-tb-btn" title="Outdent (Shift+Tab)"
            onMouseDown={(e) => { e.preventDefault(); execCmd('outdent'); }}>
            |←
          </button>
        </>)}

        <span className="rte-tb-sep" />

        {/* ── Color swatches ── */}
        {colors.map(({ color, title }) => (
          <button
            key={color}
            type="button"
            className="rte-clr-swatch"
            style={{ background: color }}
            title={title}
            onMouseDown={(e) => { e.preventDefault(); execCmd('foreColor', color); }}
          />
        ))}
        {/* Custom color picker (full toolbar only) */}
        {full && (
          <label className="rte-clr-pick" title="Custom colour"
            onMouseDown={() => {
              // Save selection range before color picker dialog steals focus
              const sel = window.getSelection();
              if (sel && sel.rangeCount > 0) {
                savedRange.current = sel.getRangeAt(0).cloneRange();
              }
            }}>
            <span>🎨</span>
            <input
              type="color"
              tabIndex={-1}
              value={customColor}
              onChange={handleColorChange}
            />
          </label>
        )}
        <span className="rte-tb-sep" />

        {/* ── Clear formatting ── */}
        <button type="button" className="rte-tb-btn" title="Clear formatting"
          onMouseDown={(e) => {
            e.preventDefault();
            const editor = editorRef.current;
            if (!editor) return;
            // If nothing is selected, select all content first
            const s = window.getSelection();
            if (!s || s.rangeCount === 0 || s.isCollapsed) {
              const range = document.createRange();
              range.selectNodeContents(editor);
              s?.removeAllRanges();
              s?.addRange(range);
            }
            execCmd('removeFormat');
          }}>
          {full ? '⊘ Clear' : '⊘'}
        </button>
      </div>

      {/* ── Editable area ── */}
      <div
        ref={editorRef}
        className={`rte-editor${full ? ' rte-editor-full' : ' rte-editor-compact'}${readOnly ? ' locked-note' : ''}`}
        contentEditable={readOnly ? 'false' : 'true'}
        spellCheck
        data-placeholder={placeholder}
        style={{ minHeight: minH, ...(maxHeight ? { maxHeight, overflowY: 'auto' } : {}) }}
        onInput={handleInput}
        onKeyDown={readOnly ? undefined : handleKeyDown}
        onFocus={() => { if (!full) setToolbarVisible(true); }}
        onBlur={(e) => {
          if (!full) {
            // Hide toolbar only if focus left the entire wrapper
            setTimeout(() => {
              if (!editorRef.current?.closest('.rte-wrap')?.contains(document.activeElement)) {
                setToolbarVisible(false);
              }
            }, 200);
          }
          handleInput();
          void e; // suppress unused warning
        }}
        suppressContentEditableWarning
      />
    </div>
  );
}
