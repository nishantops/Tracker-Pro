import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../hooks/useTracker', () => ({
  useTracker: () => ({ getGlobalMetrics: () => ({ total: 148, checked: 67 }) }),
}));

import { Countdown } from './Countdown';

describe('Countdown / Global Syllabus Absorption card', () => {
  it('keeps its wording and numbers', () => {
    render(<Countdown />);
    expect(screen.getByText('Global Syllabus Absorption')).toBeInTheDocument();
    expect(screen.getAllByText('45.3%').length).toBeGreaterThan(0);
    expect(screen.getByText('45.3% MATRIX')).toBeInTheDocument();
    expect(screen.getByText(/Prelims 2027/)).toBeInTheDocument();
    expect(screen.getByText(/Mains Phase 2027/)).toBeInTheDocument();
  });

  it('no longer has the reset button (it moved to the settings menu so it cannot be clicked by mistake)', () => {
    render(<Countdown />);
    expect(document.getElementById('clear-progress-btn')).toBeNull();
    expect(screen.queryByTitle('Reset all syllabus progress')).not.toBeInTheDocument();
    expect(screen.queryByText('↻')).not.toBeInTheDocument();
  });
});
