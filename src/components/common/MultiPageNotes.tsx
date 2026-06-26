// ─────────────────────────────────────────────────────────────────────────────
// MultiPageNotes — tabbed multi-page notes editor with fullscreen support
//
// Props:
//   pages      {NotesPage[]} — controlled array of pages
//   onChange   {fn}          — called with updated pages array on every change
//   placeholder{string}      — placeholder for empty editor
//   minHeight  {string}      — editor min-height (default '280px')
//   className  {string}      — extra class on wrapper
//
// Data format (stored as JSON in topic_note column):
//   [{ id: string, title: string, html: string }, ...]
//
// Backward compat helper:
//   parseNotePages(raw) — converts old plain-HTML strings to single-page array
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { RTE } from './RTE';

export interface NotesPage {
  id: string;
  title: string;
  html: string;
}

/** Parse a raw topic_note string into a NotesPage array.
 *  Handles both the new JSON array format and old plain-HTML strings. */
export function parseNotePages(raw: string | null | undefined): NotesPage[] {
  if (!raw) return [{ id: 'p_default', title: 'Page 1', html: '' }];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr) && arr.length > 0 && 'html' in arr[0]) return arr;
    } catch { /* fall through */ }
  }
  // Old format: plain HTML → wrap as single page
  return [{ id: 'p_default', title: 'Page 1', html: raw }];
}

interface Props {
  pages: NotesPage[];
  onChange: (pages: NotesPage[]) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

export function MultiPageNotes({
  pages,
  onChange,
  placeholder = 'Start writing your notes here…',
  minHeight = '280px',
  className = '',
}: Props) {
  const [activeId, setActiveId] = useState<string>(() => pages[0]?.id ?? 'p_default');
  const [fullscreen, setFullscreen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  // Keep activeId valid when pages change externally
  useEffect(() => {
    if (pages.length > 0 && !pages.find((p) => p.id === activeId)) {
      setActiveId(pages[0].id);
    }
  }, [pages, activeId]);

  // ESC exits fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreen) { e.stopPropagation(); setFullscreen(false); }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [fullscreen]);

  const activePage = pages.find((p) => p.id === activeId) ?? pages[0];

  const updatePage = useCallback((id: string, html: string) => {
    onChange(pages.map((p) => (p.id === id ? { ...p, html } : p)));
  }, [pages, onChange]);

  const addPage = () => {
    const id = `p_${Date.now()}`;
    const title = `Page ${pages.length + 1}`;
    const newPages = [...pages, { id, title, html: '' }];
    onChange(newPages);
    setActiveId(id);
  };

  const deletePage = (id: string) => {
    if (pages.length <= 1) return;
    const idx = pages.findIndex((p) => p.id === id);
    const newPages = pages.filter((p) => p.id !== id);
    onChange(newPages);
    setActiveId(newPages[Math.max(0, Math.min(idx, newPages.length - 1))].id);
  };

  const startRename = (id: string, title: string) => {
    setRenamingId(id);
    setRenameVal(title);
  };

  const commitRename = (id: string) => {
    const newTitle = renameVal.trim() || 'Page';
    onChange(pages.map((p) => (p.id === id ? { ...p, title: newTitle } : p)));
    setRenamingId(null);
  };

  const content = (
    <div className={`mpn-wrap${fullscreen ? ' mpn-fullscreen' : ''} ${className}`}>
      {/* Top bar */}
      <div className="mpn-topbar">
        <span className="mpn-topbar-title">📝 Notes</span>
        <button
          className="mpn-fs-btn"
          title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
          onClick={() => setFullscreen((f) => !f)}
        >
          {fullscreen ? '⊗ Exit FS' : '⛶ FS'}
        </button>
      </div>

      {/* RTE for active page */}
      {activePage && (
        <RTE
          key={activePage.id}
          full
          value={activePage.html}
          onChange={(html) => updatePage(activePage.id, html)}
          placeholder={placeholder}
          minHeight={fullscreen ? 'calc(100vh - 7rem)' : minHeight}
          className="mpn-rte"
        />
      )}

      {/* Page tabs */}
      <div className="mpn-tabbar">
        {pages.map((p) => (
          <button
            key={p.id}
            className={`mpn-tab${p.id === activeId ? ' active' : ''}`}
            onClick={() => setActiveId(p.id)}
            onDoubleClick={() => startRename(p.id, p.title)}
            title="Double-click to rename"
          >
            {renamingId === p.id ? (
              <input
                className="mpn-tab-input"
                autoFocus
                value={renameVal}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setRenameVal(e.target.value)}
                onBlur={() => commitRename(p.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(p.id);
                  if (e.key === 'Escape') setRenamingId(null);
                }}
              />
            ) : (
              <>
                <span className="mpn-tab-label">{p.title}</span>
                {pages.length > 1 && (
                  <span
                    className="mpn-tab-del"
                    title="Delete page"
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); deletePage(p.id); }}
                  >
                    ×
                  </span>
                )}
              </>
            )}
          </button>
        ))}
        <button className="mpn-tab-add" title="Add new page" onClick={addPage}>
          + Page
        </button>
      </div>
    </div>
  );

  if (fullscreen) return createPortal(content, document.body);
  return content;
}
