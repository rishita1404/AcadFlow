import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import InterventionModal from '../InterventionModal.jsx';
import InterventionTimeline from '../InterventionTimeline.jsx';
import FollowUpsPanel from '../FollowUpsPanel.jsx';
import DeadlineCollisionWarning from '../DeadlineCollisionWarning.jsx';
import { interventionApi } from '../../api/endpoints.js';

vi.mock('../../api/endpoints.js', () => ({
  interventionApi: {
    create: vi.fn(),
    getStudentInterventions: vi.fn(),
    update: vi.fn(),
    getFollowUpsDue: vi.fn(),
  },
}));

function renderWithClient(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe('Phase 3 Frontend Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('InterventionModal', () => {
    it('renders all action types and submits intervention', async () => {
      interventionApi.create.mockResolvedValueOnce({ data: { id: 1 } });
      const handleClose = vi.fn();

      renderWithClient(
        <InterventionModal
          isOpen={true}
          onClose={handleClose}
          studentId={101}
          studentName="Aman Sharma"
          courseId={5}
          courseName="Operating Systems"
        />
      );

      expect(screen.getByText(/Log Action for Aman Sharma/i)).toBeInTheDocument();
      expect(screen.getByText(/Course: Operating Systems/i)).toBeInTheDocument();
      expect(screen.getByText(/In-person Discussion/i)).toBeInTheDocument();
      expect(screen.getByText(/Phone Call/i)).toBeInTheDocument();
      expect(screen.getByText(/Email Outreach/i)).toBeInTheDocument();

      // Switch kind to Call
      fireEvent.click(screen.getByText(/Phone Call/i));

      // Enter action note
      const textarea = screen.getByPlaceholderText(/Detail the discussion/i);
      fireEvent.change(textarea, { target: { value: 'Called student regarding low attendance in lab' } });

      // Enter follow up date
      const dateInput = screen.getByLabelText(/Follow-up Review Date/i);
      fireEvent.change(dateInput, { target: { value: '2026-11-30' } });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /Record Action/i }));

      await waitFor(() => {
        expect(interventionApi.create).toHaveBeenCalledWith({
          student_id: 101,
          course_id: 5,
          kind: 'call',
          note: 'Called student regarding low attendance in lab',
          follow_up_on: '2026-11-30',
        });
        expect(handleClose).toHaveBeenCalled();
      });
    });
  });

  describe('InterventionTimeline', () => {
    it('renders timeline with baseline score, score delta, and human-driven outcome selector', async () => {
      interventionApi.getStudentInterventions.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            student_id: 101,
            created_by: 2,
            created_by_name: 'Prof. Alan Turing',
            kind: 'talk',
            note: 'Agreed on 2-week catch-up study schedule.',
            follow_up_on: '2026-11-28',
            outcome: 'open',
            score_at_creation: 72.0,
            band_at_creation: 'Needs support',
            current_score: 59.5,
            score_change: -12.5,
            created_at: '2026-11-20T10:00:00Z',
          },
        ],
      });

      interventionApi.update.mockResolvedValueOnce({ data: { id: 1, outcome: 'recovered' } });

      renderWithClient(<InterventionTimeline studentId={101} readOnly={false} />);

      await waitFor(() => {
        expect(screen.getByText(/Support Intervention History \(1\)/i)).toBeInTheDocument();
        expect(screen.getByText(/Agreed on 2-week catch-up study schedule\./i)).toBeInTheDocument();
        expect(screen.getByText(/Baseline Score:/i)).toBeInTheDocument();
        expect(screen.getByText(/72\.0/i)).toBeInTheDocument();
        // Check delta display
        expect(screen.getByText(/-12\.5 pts \(Improved\)/i)).toBeInTheDocument();
      });

      // Human outcome change
      const outcomeSelect = screen.getByRole('combobox');
      expect(outcomeSelect).toHaveValue('open');

      fireEvent.change(outcomeSelect, { target: { value: 'recovered' } });

      await waitFor(() => {
        expect(interventionApi.update).toHaveBeenCalledWith(1, { outcome: 'recovered' });
      });
    });
  });

  describe('DeadlineCollisionWarning', () => {
    it('renders non-blocking warning with daily counts and suggested date', () => {
      const handleApply = vi.fn();
      const preview = {
        has_collision_warning: true,
        warning_threshold: 3,
        window_count: 4,
        daily_counts: {
          '2026-11-25': 2,
          '2026-11-26': 1,
          '2026-11-27': 1,
        },
        lightest_nearby_date: '2026-11-29',
        message: 'High collision warning: 4 deadlines already scheduled within 7 days.',
      };

      render(
        <DeadlineCollisionWarning preview={preview} onApplySuggestedDate={handleApply} />
      );

      expect(screen.getByText(/High Deadline Density Detected \(Advisory\)/i)).toBeInTheDocument();
      expect(screen.getByText(/4 deadlines already scheduled/i)).toBeInTheDocument();
      expect(screen.getByText(/2026-11-29/i)).toBeInTheDocument();
      expect(screen.getByText(/This warning is non-blocking/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Use suggested date/i }));
      expect(handleApply).toHaveBeenCalledWith('2026-11-29');
    });

    it('returns null if has_collision_warning is false', () => {
      const preview = { has_collision_warning: false };
      const { container } = render(<DeadlineCollisionWarning preview={preview} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('FollowUpsPanel', () => {
    it('renders follow ups due with quick action button', async () => {
      interventionApi.getFollowUpsDue.mockResolvedValueOnce({
        data: [
          {
            id: 10,
            student_id: 105,
            student_name: 'Rohan Mehra',
            student_roll_no: 'CS-2023-042',
            kind: 'call',
            note: 'Verify attendance recovery after illness.',
            follow_up_on: '2026-11-24',
            outcome: 'open',
            score_at_creation: 68.0,
            band_at_creation: 'Watch',
          },
        ],
      });

      renderWithClient(<FollowUpsPanel daysAhead={7} />);

      await waitFor(() => {
        expect(screen.getByText(/Follow-ups Due \(1\)/i)).toBeInTheDocument();
        expect(screen.getByText(/Rohan Mehra/i)).toBeInTheDocument();
        expect(screen.getByText(/CS-2023-042/i)).toBeInTheDocument();
        expect(screen.getByText(/Verify attendance recovery after illness\./i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /✓ Mark Recovered/i })).toBeInTheDocument();
      });
    });
  });
});
