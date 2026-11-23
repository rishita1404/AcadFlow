import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StudentLeave from '../student/StudentLeave.jsx';
import FacultyLeaveInbox from '../faculty/FacultyLeaveInbox.jsx';
import DeanCondonationQueue from '../dean/DeanCondonationQueue.jsx';

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
          created_at: '2026-10-09T10:00:00Z',
        },
      ],
    }),
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
  },
}));

function renderWithClient(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Phase 2 Pages: Leave & Condonation', () => {
  it('renders StudentLeave form and supportive neutral excusal copy', async () => {
    renderWithClient(<StudentLeave />);
    expect(screen.getByText('My Leave & Attendance Excusal')).toBeDefined();
    expect(screen.getByText('New Leave Request')).toBeDefined();
    expect(screen.getByText(/Approved leaves are purely neutral/i)).toBeDefined();
    expect(await screen.findByText('Prescription verified')).toBeDefined();
  });

  it('renders FacultyLeaveInbox with filter controls and mentee requests', async () => {
    renderWithClient(<FacultyLeaveInbox />);
    expect(screen.getByText('Mentee Leave Inbox')).toBeDefined();
    expect(screen.getByText('Pending Review')).toBeDefined();
    expect(await screen.findByText('Riya Sharma')).toBeDefined();
    expect(screen.getByText('Approve')).toBeDefined();
    expect(screen.getByText('Reject')).toBeDefined();
  });

  it('renders DeanCondonationQueue with policy banner and compliance copy', async () => {
    renderWithClient(<DeanCondonationQueue />);
    expect(screen.getByText('Dean Condonation Queue')).toBeDefined();
    expect(screen.getByText(/never changes attendance percentages/i)).toBeDefined();
    expect(await screen.findByText('Fracture hospitalization')).toBeDefined();
    expect(screen.getByText('68.5%')).toBeDefined();
  });
});
