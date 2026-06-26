/**
 * Tests for RTE.tsx Rich Text Editor component
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RTE } from './RTE';

describe('RTE rendering — mini toolbar (full=false)', () => {
  it('renders the editor area', () => {
    render(<RTE />);
    expect(document.querySelector('.rte-editor')).toBeInTheDocument();
  });

  it('has rte-compact class in mini mode', () => {
    render(<RTE />);
    expect(document.querySelector('.rte-compact')).toBeInTheDocument();
  });

  it('does not have rte-full class in mini mode', () => {
    render(<RTE />);
    expect(document.querySelector('.rte-full')).not.toBeInTheDocument();
  });

  it('toolbar is initially hidden in mini mode (display:none)', () => {
    render(<RTE />);
    const toolbar = document.querySelector('.rte-tb') as HTMLElement;
    expect(toolbar.style.display).toBe('none');
  });

  it('shows Bold button', async () => {
    render(<RTE full={false} />);
    // Focus editor to show toolbar
    const editor = document.querySelector('.rte-editor') as HTMLElement;
    fireEvent.focus(editor);
    expect(screen.getByTitle('Bold (Ctrl+B)')).toBeInTheDocument();
  });

  it('shows 3 color swatches in mini mode', async () => {
    render(<RTE full={false} />);
    const editor = document.querySelector('.rte-editor') as HTMLElement;
    fireEvent.focus(editor);
    const swatches = document.querySelectorAll('.rte-clr-swatch');
    expect(swatches.length).toBe(3);
  });

  it('mini toolbar has red, green, and blue swatches', async () => {
    render(<RTE full={false} />);
    const editor = document.querySelector('.rte-editor') as HTMLElement;
    fireEvent.focus(editor);
    expect(screen.getByTitle('Red')).toBeInTheDocument();
    expect(screen.getByTitle('Green')).toBeInTheDocument();
    expect(screen.getByTitle('Blue')).toBeInTheDocument();
  });

  it('does not show Strikethrough in mini mode', async () => {
    render(<RTE full={false} />);
    const editor = document.querySelector('.rte-editor') as HTMLElement;
    fireEvent.focus(editor);
    expect(screen.queryByTitle('Strikethrough (Ctrl+Shift+S)')).not.toBeInTheDocument();
  });

  it('does not show custom color picker in mini mode', async () => {
    render(<RTE full={false} />);
    const editor = document.querySelector('.rte-editor') as HTMLElement;
    fireEvent.focus(editor);
    expect(screen.queryByTitle('Custom colour')).not.toBeInTheDocument();
  });

  it('bullet list button shows bullet only (•) in mini mode', async () => {
    render(<RTE full={false} />);
    const editor = document.querySelector('.rte-editor') as HTMLElement;
    fireEvent.focus(editor);
    expect(screen.getByTitle('Bullet list')).toHaveTextContent('•');
  });

  it('sets data-placeholder attribute', () => {
    render(<RTE placeholder="Type your notes here..." />);
    const editor = document.querySelector('.rte-editor') as HTMLElement;
    expect(editor.getAttribute('data-placeholder')).toBe('Type your notes here...');
  });
});

describe('RTE rendering — full toolbar (full=true)', () => {
  it('has rte-full class in full mode', () => {
    render(<RTE full />);
    expect(document.querySelector('.rte-full')).toBeInTheDocument();
  });

  it('toolbar is always visible in full mode', () => {
    render(<RTE full />);
    const toolbar = document.querySelector('.rte-tb') as HTMLElement;
    expect(toolbar.style.display).toBe('flex');
  });

  it('shows 6 color swatches in full mode', () => {
    render(<RTE full />);
    const swatches = document.querySelectorAll('.rte-clr-swatch');
    expect(swatches.length).toBe(6);
  });

  it('full toolbar has Amber swatch (not in mini)', () => {
    render(<RTE full />);
    expect(screen.getByTitle('Amber')).toBeInTheDocument();
  });

  it('full toolbar has Purple swatch', () => {
    render(<RTE full />);
    expect(screen.getByTitle('Purple')).toBeInTheDocument();
  });

  it('full toolbar has Pink swatch', () => {
    render(<RTE full />);
    expect(screen.getByTitle('Pink')).toBeInTheDocument();
  });

  it('shows Strikethrough button in full mode', () => {
    render(<RTE full />);
    expect(screen.getByTitle('Strikethrough (Ctrl+Shift+S)')).toBeInTheDocument();
  });

  it('shows custom color picker in full mode', () => {
    render(<RTE full />);
    expect(screen.getByTitle('Custom colour')).toBeInTheDocument();
  });

  it('bullet list shows "• List" text in full mode', () => {
    render(<RTE full />);
    expect(screen.getByTitle('Bullet list')).toHaveTextContent('• List');
  });

  it('shows Ordered list button in full mode', () => {
    render(<RTE full />);
    expect(screen.getByTitle('Ordered list')).toBeInTheDocument();
  });

  it('shows Clear formatting button', () => {
    render(<RTE full />);
    expect(screen.getByTitle('Clear formatting')).toBeInTheDocument();
  });

  it('clear button shows "⊘ Clear" in full mode', () => {
    render(<RTE full />);
    expect(screen.getByTitle('Clear formatting')).toHaveTextContent('⊘ Clear');
  });

  it('uses rte-editor-full class on editor in full mode', () => {
    render(<RTE full />);
    expect(document.querySelector('.rte-editor-full')).toBeInTheDocument();
  });

  it('uses rte-editor-compact class on editor in compact mode', () => {
    render(<RTE />);
    expect(document.querySelector('.rte-editor-compact')).toBeInTheDocument();
  });
});

describe('RTE readOnly mode', () => {
  it('adds locked-note class to editor when readOnly', () => {
    render(<RTE readOnly />);
    expect(document.querySelector('.locked-note')).toBeInTheDocument();
  });

  it('sets contentEditable to false when readOnly', () => {
    render(<RTE readOnly />);
    const editor = document.querySelector('.rte-editor') as HTMLElement;
    expect(editor.getAttribute('contenteditable')).toBe('false');
  });

  it('sets contentEditable to true when not readOnly', () => {
    render(<RTE readOnly={false} />);
    const editor = document.querySelector('.rte-editor') as HTMLElement;
    expect(editor.getAttribute('contenteditable')).toBe('true');
  });

  it('does not add locked-note class when not readOnly', () => {
    render(<RTE />);
    expect(document.querySelector('.locked-note')).not.toBeInTheDocument();
  });
});

describe('RTE onChange callback', () => {
  it('calls onChange when user types', () => {
    const onChange = vi.fn();
    render(<RTE onChange={onChange} />);
    const editor = document.querySelector('.rte-editor') as HTMLElement;
    fireEvent.input(editor, { target: { innerHTML: '<p>Hello</p>' } });
    expect(onChange).toHaveBeenCalled();
  });
});

describe('RTE custom class', () => {
  it('applies extra className to wrapper', () => {
    render(<RTE className="my-custom-class" />);
    expect(document.querySelector('.my-custom-class')).toBeInTheDocument();
  });
});

describe('RTE min height', () => {
  it('uses default 1.8rem min-height in compact mode', () => {
    render(<RTE />);
    const editor = document.querySelector('.rte-editor') as HTMLElement;
    expect(editor.style.minHeight).toBe('1.8rem');
  });

  it('uses default 90px min-height in full mode', () => {
    render(<RTE full />);
    const editor = document.querySelector('.rte-editor') as HTMLElement;
    expect(editor.style.minHeight).toBe('90px');
  });

  it('uses custom min-height when provided', () => {
    render(<RTE minHeight="200px" />);
    const editor = document.querySelector('.rte-editor') as HTMLElement;
    expect(editor.style.minHeight).toBe('200px');
  });
});
