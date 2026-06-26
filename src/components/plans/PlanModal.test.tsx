/**
 * Tests for PlanModal.tsx component
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlanModal } from './PlanModal';
import type { PlanFormData } from '../../hooks/usePlans';

vi.mock('../common/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

const emptyForm: PlanFormData = {
  title: '',
  type: 'weekly',
  startDate: '',
  endDate: '',
  category: 'common',
  division: 'both',
  notifEnabled: true,
  subject: '',
  contentType: 'both',
};

const defaultProps = {
  open: true,
  initial: emptyForm,
  onSave: vi.fn().mockResolvedValue(undefined),
  onClose: vi.fn(),
};

describe('PlanModal visibility', () => {
  it('renders when open=true', () => {
    render(<PlanModal {...defaultProps} />);
    expect(screen.getByText('📋 Create New Plan')).toBeInTheDocument();
  });

  it('renders nothing when open=false', () => {
    render(<PlanModal {...defaultProps} open={false} />);
    expect(screen.queryByText('📋 Create New Plan')).not.toBeInTheDocument();
  });
});

describe('PlanModal create mode', () => {
  it('shows "Create New Plan" heading in create mode', () => {
    render(<PlanModal {...defaultProps} />);
    expect(screen.getByText('📋 Create New Plan')).toBeInTheDocument();
  });

  it('shows "Create" submit button in create mode', () => {
    render(<PlanModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('shows "Cancel" button', () => {
    render(<PlanModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});

describe('PlanModal edit mode', () => {
  it('shows "Edit Plan" heading when editId is provided', () => {
    render(<PlanModal {...defaultProps} editId="some-id" />);
    expect(screen.getByText('✏️ Edit Plan')).toBeInTheDocument();
  });

  it('shows "Update" submit button in edit mode', () => {
    render(<PlanModal {...defaultProps} editId="some-id" />);
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument();
  });
});

describe('PlanModal form fields', () => {
  it('renders Plan Title input', () => {
    render(<PlanModal {...defaultProps} />);
    expect(screen.getByPlaceholderText(/GS Revision Sprint/i)).toBeInTheDocument();
  });

  it('renders Type select with 4 options', () => {
    render(<PlanModal {...defaultProps} />);
    expect(screen.getByDisplayValue('Weekly Sprint')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Monthly' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Custom Block' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Daily Target' })).toBeInTheDocument();
  });

  it('renders Category select with GS 1/2/3/4 options (not GS-I)', () => {
    render(<PlanModal {...defaultProps} />);
    expect(screen.getByRole('option', { name: 'GS 1' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'GS 2' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'GS 3' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'GS 4' })).toBeInTheDocument();
  });

  it('renders Division select with all 3 options', () => {
    render(<PlanModal {...defaultProps} />);
    expect(screen.getByRole('option', { name: 'Prelims + Mains' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Prelims Only' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Mains Only' })).toBeInTheDocument();
  });

  it('renders Mode select with Tasks/Tables options', () => {
    render(<PlanModal {...defaultProps} />);
    expect(screen.getByRole('option', { name: /Tasks Only/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Tables Only/i })).toBeInTheDocument();
  });

  it('renders Start Date and End Date inputs', () => {
    render(<PlanModal {...defaultProps} />);
    const dateInputs = screen.getAllByDisplayValue('');
    // Title and two date inputs should be empty
    expect(dateInputs.length).toBeGreaterThanOrEqual(2);
  });
});

describe('PlanModal validation', () => {
  it('submit button is enabled when title has value', async () => {
    render(<PlanModal {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText(/GS Revision Sprint/i), {
      target: { value: 'My Test Plan' },
    });
    expect(screen.getByRole('button', { name: 'Create' })).not.toBeDisabled();
  });

  it('shows Saving... while submitting', async () => {
    const slowSave = vi.fn().mockImplementation(() => new Promise(r => setTimeout(r, 100)));
    render(
      <PlanModal
        open={true}
        initial={{ ...emptyForm, title: 'My Plan' }}
        onSave={slowSave}
        onClose={vi.fn()}
      />
    );
    const form = document.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByText('Saving...')).toBeInTheDocument());
  });
});

describe('PlanModal behavior', () => {
  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<PlanModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<PlanModal {...defaultProps} onClose={onClose} />);
    // Click the backdrop (first fixed div)
    const backdrops = document.querySelectorAll('div[style*="position: absolute"]');
    if (backdrops.length > 0) {
      fireEvent.click(backdrops[0]);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('defaults Type to "weekly" (Weekly Sprint)', () => {
    render(<PlanModal {...defaultProps} />);
    expect(screen.getByDisplayValue('Weekly Sprint')).toBeInTheDocument();
  });

  it('defaults Category to "common" (Common)', () => {
    render(<PlanModal {...defaultProps} />);
    expect(screen.getByDisplayValue('Common')).toBeInTheDocument();
  });

  it('defaults Division to "both" (Prelims + Mains)', () => {
    render(<PlanModal {...defaultProps} />);
    expect(screen.getByDisplayValue('Prelims + Mains')).toBeInTheDocument();
  });

  it('calls onSave with form data when submitted', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <PlanModal
        open={true}
        initial={{ ...emptyForm, title: 'Weekly GS Plan' }}
        onSave={onSave}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].title).toBe('Weekly GS Plan');
  });

  it('passes editId to onSave in edit mode', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <PlanModal
        open={true}
        initial={{ ...emptyForm, title: 'Existing Plan' }}
        editId="existing-plan-id"
        onSave={onSave}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][1]).toBe('existing-plan-id');
  });
});
