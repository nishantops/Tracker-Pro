/**
 * Tests for PlanCard.tsx component
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanCard } from './PlanCard';
import type { Plan } from '../../hooks/usePlans';

// Mock Toast context
vi.mock('../common/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

const basePlan: Plan = {
  plan_id: 'dGVzdA==',
  plan_title: 'Test Plan',
  plan_type: 'weekly',
  start_date: null,
  end_date: null,
  plan_category: 'common',
  plan_division: 'both',
  notif_enabled: true,
  plan_subject: '',
  content_type: 'both',
  taskTotal: 0,
  taskDone: 0,
};

const mockOnOpen = vi.fn();
const mockOnDelete = vi.fn();

function renderCard(plan: Partial<Plan> = {}) {
  return render(
    <PlanCard
      plan={{ ...basePlan, ...plan }}
      onOpen={mockOnOpen}
      onDelete={mockOnDelete}
    />
  );
}

describe('PlanCard rendering', () => {
  it('renders plan title', () => {
    renderCard({ plan_title: 'GS Paper I Weekly' });
    expect(screen.getByText('GS Paper I Weekly')).toBeInTheDocument();
  });

  it('renders delete button', () => {
    renderCard();
    expect(screen.getByTitle('Delete plan')).toBeInTheDocument();
  });

  it('renders progress percentage as 0% when no tasks', () => {
    renderCard({ taskTotal: 0, taskDone: 0 });
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders 50% when half tasks done', () => {
    renderCard({ taskTotal: 10, taskDone: 5 });
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('renders 100% when all tasks done', () => {
    renderCard({ taskTotal: 4, taskDone: 4 });
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('rounds percentage to integer', () => {
    renderCard({ taskTotal: 3, taskDone: 1 });
    expect(screen.getByText('33%')).toBeInTheDocument();
  });
});

describe('PlanCard type labels', () => {
  it('shows "Weekly Sprint" for type=weekly', () => {
    renderCard({ plan_type: 'weekly' });
    expect(screen.getByText('Weekly Sprint')).toBeInTheDocument();
  });

  it('shows "Monthly" for type=monthly', () => {
    renderCard({ plan_type: 'monthly' });
    expect(screen.getByText('Monthly')).toBeInTheDocument();
  });

  it('shows "Custom Block" for type=custom_block', () => {
    renderCard({ plan_type: 'custom_block' });
    expect(screen.getByText('Custom Block')).toBeInTheDocument();
  });

  it('shows "Daily Target" for type=daily', () => {
    renderCard({ plan_type: 'daily' });
    expect(screen.getByText('Daily Target')).toBeInTheDocument();
  });

  it('falls back to raw type for unknown types', () => {
    renderCard({ plan_type: 'unknown_type' });
    expect(screen.getByText('unknown_type')).toBeInTheDocument();
  });
});

describe('PlanCard category labels', () => {
  it('shows "Common" for category=common', () => {
    renderCard({ plan_category: 'common' });
    expect(screen.getByText('Common')).toBeInTheDocument();
  });

  it('shows "GS 1" for category=gs1 (not GS-I)', () => {
    renderCard({ plan_category: 'gs1' });
    expect(screen.getByText('GS 1')).toBeInTheDocument();
  });

  it('shows "GS 2" for category=gs2', () => {
    renderCard({ plan_category: 'gs2' });
    expect(screen.getByText('GS 2')).toBeInTheDocument();
  });

  it('shows "GS 3" for category=gs3', () => {
    renderCard({ plan_category: 'gs3' });
    expect(screen.getByText('GS 3')).toBeInTheDocument();
  });

  it('shows "GS 4" for category=gs4', () => {
    renderCard({ plan_category: 'gs4' });
    expect(screen.getByText('GS 4')).toBeInTheDocument();
  });

  it('shows "Essay" for category=essay', () => {
    renderCard({ plan_category: 'essay' });
    expect(screen.getByText('Essay')).toBeInTheDocument();
  });

  it('shows plan_subject when set (overrides category label)', () => {
    renderCard({ plan_category: 'custom', plan_subject: 'Indian Polity' });
    expect(screen.getByText('Indian Polity')).toBeInTheDocument();
  });
});

describe('PlanCard division labels', () => {
  it('shows "P + M" for division=both', () => {
    renderCard({ plan_division: 'both' });
    expect(screen.getByText('P + M')).toBeInTheDocument();
  });

  it('shows "Prelims" for division=prelims', () => {
    renderCard({ plan_division: 'prelims' });
    expect(screen.getByText('Prelims')).toBeInTheDocument();
  });

  it('shows "Mains" for division=mains', () => {
    renderCard({ plan_division: 'mains' });
    expect(screen.getByText('Mains')).toBeInTheDocument();
  });
});

describe('PlanCard notifications muted badge', () => {
  it('shows mute badge when notif_enabled=false', () => {
    renderCard({ notif_enabled: false });
    expect(screen.getByText('🔕')).toBeInTheDocument();
  });

  it('does not show mute badge when notif_enabled=true', () => {
    renderCard({ notif_enabled: true });
    expect(screen.queryByText('🔕')).not.toBeInTheDocument();
  });
});

describe('PlanCard interaction', () => {
  it('calls onOpen with plan_id on click', () => {
    const onOpen = vi.fn();
    render(
      <PlanCard
        plan={{ ...basePlan, plan_id: 'abc123' }}
        onOpen={onOpen}
        onDelete={mockOnDelete}
      />
    );
    // The plan card div has role="button"; the delete button is a <button> — select by class
    const card = document.querySelector('.plan-card') as HTMLElement;
    fireEvent.click(card);
    expect(onOpen).toHaveBeenCalledWith('abc123');
  });

  it('calls onOpen on Enter key press', () => {
    const onOpen = vi.fn();
    render(
      <PlanCard
        plan={{ ...basePlan, plan_id: 'abc123' }}
        onOpen={onOpen}
        onDelete={mockOnDelete}
      />
    );
    const card = document.querySelector('.plan-card') as HTMLElement;
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith('abc123');
  });

  it('calls onOpen on Space key press', () => {
    const onOpen = vi.fn();
    render(
      <PlanCard
        plan={{ ...basePlan, plan_id: 'abc123' }}
        onOpen={onOpen}
        onDelete={mockOnDelete}
      />
    );
    const card = document.querySelector('.plan-card') as HTMLElement;
    fireEvent.keyDown(card, { key: ' ' });
    expect(onOpen).toHaveBeenCalledWith('abc123');
  });

  it('delete button click does not bubble to card click', () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    render(
      <PlanCard
        plan={{ ...basePlan, plan_id: 'abc123' }}
        onOpen={onOpen}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByTitle('Delete plan'));
    expect(onOpen).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled(); // inline confirm shown, not yet deleted
    fireEvent.click(screen.getByText('Delete')); // confirm the inline prompt
    expect(onDelete).toHaveBeenCalledWith('abc123');
  });

  it('does not delete when confirm is cancelled', () => {
    const onDelete = vi.fn();
    render(
      <PlanCard
        plan={basePlan}
        onOpen={mockOnOpen}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByTitle('Delete plan'));
    fireEvent.click(screen.getByText('Cancel')); // cancel the inline prompt
    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe('PlanCard date display', () => {
  it('shows no date section when no dates are set', () => {
    renderCard({ start_date: null, end_date: null });
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it('shows date range when both dates set', () => {
    renderCard({ start_date: '2026-06-01', end_date: '2026-06-30' });
    expect(screen.getByText(/→/)).toBeInTheDocument();
  });

  it('has tabIndex 0 for keyboard accessibility', () => {
    renderCard();
    const card = document.querySelector('.plan-card') as HTMLElement;
    expect(card).toHaveAttribute('tabIndex', '0');
  });
});
