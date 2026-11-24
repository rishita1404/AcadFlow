import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import NeedsAttentionPanel from '../NeedsAttentionPanel.jsx';
import { facultyApi } from '../../api/endpoints.js';

vi.mock('../../api/endpoints.js', () => ({
  facultyApi: {
    getNeedsAttention: vi.fn(),
  },
  interventionApi: {
    create: vi.fn(),
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

describe('NeedsAttentionPanel Component (Phase 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders student cards with consecutive absences and band drops', async () => {
    facultyApi.getNeedsAttention.mockResolvedValueOnce({
      data: [
        {
          student_id: 101,
          roll_no: 'CS101_01',
          name: 'Karan Sharma',
          email: 'karan@acadflow.edu',
          course_id: 1,
          course_code: 'CS101',
          course_name: 'Intro to Programming',
          current_band: 'Critical',
          current_band_label: 'Needs support',
          previous_band: 'Watch',
          consecutive_absences: 2,
          missed_dates: ['2026-11-18', '2026-11-20'],
          reasons: ['consecutive_absences', 'band_drop'],
          what_changed: 'Missed 2 consecutive classes (Nov 18, Nov 20); Risk band dropped from Watch to Needs support since last week',
          suggested_next_step: 'Schedule an in-person discussion or log an intervention',
          score: 82.0,
        },
        {
          student_id: 102,
          roll_no: 'CS101_02',
          name: 'Meera Patel',
          email: 'meera@acadflow.edu',
          course_id: 1,
          course_code: 'CS101',
          course_name: 'Intro to Programming',
          current_band: 'Watch',
          current_band_label: 'Watch',
          previous_band: 'Safe',
          consecutive_absences: 2,
          missed_dates: ['2026-11-19', '2026-11-21'],
          reasons: ['consecutive_absences'],
          what_changed: 'Missed 2 consecutive classes (Nov 19, Nov 21)',
          suggested_next_step: 'Reach out to check in on recent missed classes',
          score: 45.0,
        },
      ],
    });

    renderWithClient(<NeedsAttentionPanel />);

    // Wait for data to load
    expect(await screen.findByText('Karan Sharma')).toBeInTheDocument();
    expect(screen.getByText('Needs Attention This Week')).toBeInTheDocument();
    expect(screen.getByText('2 students')).toBeInTheDocument();

    // Student 1 details
    expect(screen.getByText('(CS101_01)')).toBeInTheDocument();
    expect(screen.getByText('Needs support')).toBeInTheDocument();
    expect(screen.getByText(/Risk band dropped from Watch to Needs support/i)).toBeInTheDocument();
    expect(screen.getByText(/Schedule an in-person discussion or log an intervention/i)).toBeInTheDocument();

    // Student 2 details
    expect(screen.getByText('Meera Patel')).toBeInTheDocument();
    expect(screen.getByText('(CS101_02)')).toBeInTheDocument();
    expect(screen.getByText('Watch')).toBeInTheDocument();
    expect(screen.getByText(/Missed 2 consecutive classes \(Nov 19, Nov 21\)/i)).toBeInTheDocument();

    // Log action buttons
    const logButtons = screen.getAllByRole('button', { name: /Log action/i });
    expect(logButtons.length).toBe(2);
  });

  it('renders supportive empty state when no students require attention', async () => {
    facultyApi.getNeedsAttention.mockResolvedValueOnce({
      data: [],
    });

    renderWithClient(<NeedsAttentionPanel />);

    // Wait for empty state to load
    expect(await screen.findByText('All students are on track this week')).toBeInTheDocument();
    expect(screen.getByText('Needs Attention This Week')).toBeInTheDocument();
    expect(screen.getByText('0 students')).toBeInTheDocument();
    expect(
      screen.getByText('No consecutive absences or risk band drops detected across your enrolled roster.')
    ).toBeInTheDocument();
  });

  it('opens intervention modal when clicking Log action', async () => {
    facultyApi.getNeedsAttention.mockResolvedValueOnce({
      data: [
        {
          student_id: 101,
          roll_no: 'CS101_01',
          name: 'Karan Sharma',
          email: 'karan@acadflow.edu',
          course_id: 1,
          course_code: 'CS101',
          course_name: 'Intro to Programming',
          current_band: 'Critical',
          current_band_label: 'Needs support',
          previous_band: 'Watch',
          consecutive_absences: 2,
          missed_dates: ['2026-11-18', '2026-11-20'],
          reasons: ['consecutive_absences'],
          what_changed: 'Missed 2 consecutive classes (Nov 18, Nov 20)',
          suggested_next_step: 'Schedule an in-person discussion',
          score: 82.0,
        },
      ],
    });

    renderWithClient(<NeedsAttentionPanel />);

    const logBtn = await screen.findByRole('button', { name: /Log action/i });
    fireEvent.click(logBtn);

    // Modal should open with student name
    expect(await screen.findByText(/Log Action for Karan Sharma/i)).toBeInTheDocument();
  });
});
