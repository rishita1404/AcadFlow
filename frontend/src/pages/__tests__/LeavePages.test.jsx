import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StudentLeave from '../student/StudentLeave.jsx';
import FacultyLeaveInbox from '../faculty/FacultyLeaveInbox.jsx';
import DeanCondonationQueue from '../dean/DeanCondonationQueue.jsx';

// ── API mocks ─────────────────────────────────────────────────────────────────
vi.mock('../../api/endpoints', () => ({
  leaveApi: {
    getMyRequests: vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          type: 'medical',
          date_from: '2026-10-10',
          date_to: '2026-10-12',
          reason: 'Viral fever rest',
          status: 'approved',
          decision_note: 'Prescription verified',
          decided_at: '2026-10-14T10:00:00Z',
          created_at: '2026-10-09T10:00:00Z',
        },
      ],
    }),
    submit: vi.fn().mockResolvedValue({ data: { id: 2 } }),
    getInbox: vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          student_id: 1,
          student_name: 'Riya Sharma',
          student_roll_no: '24CAI001',
          type: 'medical',
          date_from: '2026-10-10',
          date_to: '2026-10-12',
          reason: 'Viral fever rest',
          status: 'pending',
          created_at: '2026-10-09T10:00:00Z',
        },
      ],
    }),
    decide: vi.fn().mockResolvedValue({ data: {} }),
  },
  condonationApi: {
    getQueue: vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          student_id: 1,
          student_name: 'Riya Sharma',
          student_roll_no: '24CAI001',
          department_name: 'Computer Science',
          attendance_pct_at_request: 68.5,
          reason: 'Fracture hospitalization',
          status: 'recommended',
          recommended_by_name: 'Prof. Mentor',
          created_at: '2026-10-09T10:00:00Z',
        },
      ],
    }),
    decide: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function wrap(ui) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

// ── StudentLeave ──────────────────────────────────────────────────────────────
describe('StudentLeave page', () => {
  it('renders page title and subtitle', () => {
    wrap(<StudentLeave />);
    expect(screen.getByText('My leave')).toBeDefined();
    expect(screen.getByText(/Request leave for illness or approved duty/i)).toBeDefined();
  });

  it('renders New request and Request history headings', () => {
    wrap(<StudentLeave />);
    expect(screen.getByText('New request')).toBeDefined();
    expect(screen.getByText('Request history')).toBeDefined();
  });

  it('renders segmented control with Medical and Duty options', () => {
    wrap(<StudentLeave />);
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(2);
    expect(screen.getByText('Medical')).toBeDefined();
    expect(screen.getByText('Duty / Event')).toBeDefined();
  });

  it('segmented control responds to arrow-key navigation', () => {
    wrap(<StudentLeave />);
    const [medBtn] = screen.getAllByRole('radio');
    // Medical starts checked
    expect(medBtn.getAttribute('aria-checked')).toBe('true');
    // Arrow right → Duty / Event
    fireEvent.keyDown(medBtn, { key: 'ArrowRight' });
    const [, dutyBtn] = screen.getAllByRole('radio');
    expect(dutyBtn.getAttribute('aria-checked')).toBe('true');
    // Arrow left → back to Medical
    fireEvent.keyDown(dutyBtn, { key: 'ArrowLeft' });
    const [medBtn2] = screen.getAllByRole('radio');
    expect(medBtn2.getAttribute('aria-checked')).toBe('true');
  });

  it('shows inline error when form submitted with empty dates', async () => {
    wrap(<StudentLeave />);
    const btn = screen.getByRole('button', { name: /submit request/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText('Please choose a start date.')).toBeDefined();
    });
  });

  it('shows error when end date is before start date', async () => {
    wrap(<StudentLeave />);
    const inputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(inputs[0], { target: { value: '2026-10-15' } });
    fireEvent.change(inputs[1], { target: { value: '2026-10-10' } });
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }));
    await waitFor(() => {
      expect(screen.getByText('End date cannot be before start date.')).toBeDefined();
    });
  });

  it('shows error when medical file is missing on submit', async () => {
    wrap(<StudentLeave />);
    const inputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(inputs[0], { target: { value: '2026-10-10' } });
    fireEvent.change(inputs[1], { target: { value: '2026-10-12' } });
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }));
    await waitFor(() => {
      expect(screen.getByText('A medical document is required for medical leave.')).toBeDefined();
    });
  });

  it('shows duty fields (event name, club, role) when Duty is selected', () => {
    wrap(<StudentLeave />);
    const [, dutyBtn] = screen.getAllByRole('radio');
    fireEvent.click(dutyBtn);
    expect(screen.getByLabelText(/event \/ duty name/i)).toBeDefined();
    expect(screen.getByLabelText(/club \/ organisation/i)).toBeDefined();
    expect(screen.getByLabelText(/role \/ duty/i)).toBeDefined();
  });

  it('requires event name for duty leave', async () => {
    wrap(<StudentLeave />);
    const [, dutyBtn] = screen.getAllByRole('radio');
    fireEvent.click(dutyBtn);
    const inputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(inputs[0], { target: { value: '2026-10-10' } });
    fireEvent.change(inputs[1], { target: { value: '2026-10-12' } });
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }));
    await waitFor(() => {
      expect(screen.getByText('Please enter the event or duty name.')).toBeDefined();
    });
  });

  it('renders approved history with decision note', async () => {
    wrap(<StudentLeave />);
    expect(await screen.findByText('Prescription verified')).toBeDefined();
    expect(screen.getByText('Approved')).toBeDefined();
  });

  it('shows attendance callout text', () => {
    wrap(<StudentLeave />);
    expect(screen.getByText(/DL and ML count as present only for sessions where you were marked absent/i)).toBeDefined();
  });

  it('requires at least one lecture in Specific lectures mode', async () => {
    wrap(<StudentLeave />);
    fireEvent.click(screen.getByRole('button', { name: /specific lectures/i }));
    const dateInput = document.querySelector('input[type="date"]');
    fireEvent.change(dateInput, { target: { value: '2026-10-10' } });
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }));
    await waitFor(() => {
      expect(screen.getByText('Please select at least one lecture.')).toBeDefined();
    });
  });

  it('renders empty state when no history', async () => {
    const { leaveApi } = await import('../../api/endpoints');
    leaveApi.getMyRequests.mockResolvedValueOnce({ data: [] });
    wrap(<StudentLeave />);
    expect(await screen.findByText('No leave requests yet')).toBeDefined();
    expect(screen.getByText(/Requests you submit appear here/i)).toBeDefined();
  });
});

// ── FacultyLeaveInbox ─────────────────────────────────────────────────────────
describe('FacultyLeaveInbox page', () => {
  it('renders page title', () => {
    wrap(<FacultyLeaveInbox />);
    expect(screen.getByText('Mentee leave inbox')).toBeDefined();
  });

  it('renders tab bar with Pending, Decided and All options', () => {
    wrap(<FacultyLeaveInbox />);
    expect(screen.getByRole('button', { name: 'Pending' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Decided' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'All' })).toBeDefined();
  });

  it('renders student row with Approve and Reject buttons', async () => {
    wrap(<FacultyLeaveInbox />);
    expect(await screen.findByText('Riya Sharma')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDefined();
  });

  it('opens decision modal when Approve clicked', async () => {
    wrap(<FacultyLeaveInbox />);
    await screen.findByText('Riya Sharma');
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Approve request')).toBeDefined();
  });

  it('opens decision modal when Reject clicked', async () => {
    wrap(<FacultyLeaveInbox />);
    await screen.findByText('Riya Sharma');
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Reject request')).toBeDefined();
  });

  it('shows empty state when no requests', async () => {
    const { leaveApi } = await import('../../api/endpoints');
    leaveApi.getInbox.mockResolvedValueOnce({ data: [] });
    wrap(<FacultyLeaveInbox />);
    expect(await screen.findByText('No requests in this view')).toBeDefined();
  });
});

// ── DeanCondonationQueue ──────────────────────────────────────────────────────
describe('DeanCondonationQueue page', () => {
  it('renders page title', () => {
    wrap(<DeanCondonationQueue />);
    expect(screen.getByText('Condonation queue')).toBeDefined();
  });

  it('renders policy callout without "never changes attendance percentages"', async () => {
    wrap(<DeanCondonationQueue />);
    expect(screen.getByText(/never changes attendance percentages/i)).toBeDefined();
  });

  it('renders student row with attendance percentage', async () => {
    wrap(<DeanCondonationQueue />);
    expect(await screen.findByText('Fracture hospitalization')).toBeDefined();
    expect(screen.getByText('68.5%')).toBeDefined();
  });

  it('renders Approve and Reject buttons for recommended requests', async () => {
    wrap(<DeanCondonationQueue />);
    await screen.findByText('Riya Sharma');
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDefined();
  });

  it('opens decision modal on Approve click', async () => {
    wrap(<DeanCondonationQueue />);
    await screen.findByText('Riya Sharma');
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Approve condonation')).toBeDefined();
  });

  it('shows empty state when queue is empty', async () => {
    const { condonationApi } = await import('../../api/endpoints');
    condonationApi.getQueue.mockResolvedValueOnce({ data: [] });
    wrap(<DeanCondonationQueue />);
    expect(await screen.findByText('No requests in condonation queue')).toBeDefined();
  });
});
