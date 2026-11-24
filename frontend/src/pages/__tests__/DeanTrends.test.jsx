import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import DeanTrends from '../dean/DeanTrends.jsx';
import { departmentApi } from '../../api/endpoints.js';
import * as AuthContext from '../../app/AuthContext.jsx';

// Mock recharts ResponsiveContainer to avoid size rendering issues in jsdom
vi.mock('recharts', async () => {
  const original = await vi.importActual('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  };
});

vi.mock('../../api/endpoints.js', () => ({
  departmentApi: {
    getTrends: vi.fn(),
    getMentorLoad: vi.fn(),
    exportTrends: vi.fn(),
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

describe('DeanTrends Component (Phase 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { id: 10, role: 'coordinator', department_id: 1, name: 'Dean Grace Hopper' },
    });
  });

  const mockTrendsData = {
    department_id: 1,
    department_name: 'Computer Science',
    department_code: 'CSE',
    weeks_analyzed: 8,
    weekly_risk_trends: [
      {
        week_number: 1,
        week_label: 'Week 1',
        week_start: '2026-10-01',
        week_end: '2026-10-07',
        safe: 20,
        watch: 5,
        at_risk: 2,
        needs_support: 1,
        total_snapshots: 28,
      },
    ],
    top_hotspots: [
      {
        course_id: 101,
        course_code: 'CS401',
        course_name: 'Distributed Systems',
        section: 'A',
        total_students: 40,
        students_needing_support: 12,
        support_share_pct: 30.0,
      },
    ],
    intervention_funnel: {
      flagged: 15,
      contacted: 12,
      recovered: 9,
      contact_rate_pct: 80.0,
      recovery_rate_pct: 75.0,
    },
  };

  const mockMentorLoadData = {
    department_id: 1,
    department_name: 'Computer Science',
    total_mentors: 2,
    total_mentees: 50,
    mentors: [
      {
        mentor_id: 201,
        mentor_name: 'Dr. Alan Turing',
        mentor_email: 'alan@acadflow.edu',
        mentee_count: 25,
        high_risk_mentee_count: 5,
        high_risk_share_pct: 20.0,
        open_interventions_count: 2,
      },
      {
        mentor_id: 202,
        mentor_name: 'Dr. Ada Lovelace',
        mentor_email: 'ada@acadflow.edu',
        mentee_count: 25,
        high_risk_mentee_count: 10,
        high_risk_share_pct: 40.0,
        open_interventions_count: 0,
      },
    ],
  };

  it('renders trends, hotspot courses, and intervention funnel', async () => {
    departmentApi.getTrends.mockResolvedValueOnce({ data: mockTrendsData });
    departmentApi.getMentorLoad.mockResolvedValueOnce({ data: mockMentorLoadData });

    renderWithClient(<DeanTrends />);

    await waitFor(() => {
      expect(screen.getByText(/Computer Science \(CSE\) Standing/i)).toBeInTheDocument();
      expect(screen.getByText(/Weekly Risk Band Trends \(8 Weeks\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Course & Section Hotspots/i)).toBeInTheDocument();
      expect(screen.getByText('CS401')).toBeInTheDocument();
      expect(screen.getByText('Distributed Systems')).toBeInTheDocument();
      expect(screen.getByText(/30%/i)).toBeInTheDocument();
      expect(screen.getByText(/Intervention Funnel/i)).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
    });
  });

  it('switches to mentor load tab and displays mentor stats', async () => {
    departmentApi.getTrends.mockResolvedValueOnce({ data: mockTrendsData });
    departmentApi.getMentorLoad.mockResolvedValueOnce({ data: mockMentorLoadData });

    renderWithClient(<DeanTrends />);

    await waitFor(() => {
      expect(screen.getByText(/Mentor Load Distribution/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Mentor Load Distribution/i));

    await waitFor(() => {
      expect(screen.getByText('Dr. Alan Turing')).toBeInTheDocument();
      expect(screen.getByText('alan@acadflow.edu')).toBeInTheDocument();
      expect(screen.getByText('Dr. Ada Lovelace')).toBeInTheDocument();
      expect(screen.getByText(/40%/i)).toBeInTheDocument();
      expect(screen.getByText(/High support load/i)).toBeInTheDocument();
    });
  });

  it('triggers excel export when clicking export button', async () => {
    departmentApi.getTrends.mockResolvedValueOnce({ data: mockTrendsData });
    departmentApi.getMentorLoad.mockResolvedValueOnce({ data: mockMentorLoadData });
    departmentApi.exportTrends.mockResolvedValueOnce({ data: new Uint8Array([1, 2, 3]) });

    // Mock window.URL methods
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();

    renderWithClient(<DeanTrends />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Export Excel Report/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Export Excel Report/i }));

    await waitFor(() => {
      expect(departmentApi.exportTrends).toHaveBeenCalledWith(1, 8);
    });
  });

  it('renders 403 access restricted view on permission denial', async () => {
    const error403 = { response: { status: 403 } };
    departmentApi.getTrends.mockRejectedValueOnce(error403);
    departmentApi.getMentorLoad.mockResolvedValueOnce({ data: mockMentorLoadData });

    renderWithClient(<DeanTrends />);

    await waitFor(() => {
      expect(screen.getByText(/Access Restricted \(Department Scope 403\)/i)).toBeInTheDocument();
    });
  });
});
