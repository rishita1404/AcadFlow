import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ComposeNotice from '../notices/ComposeNotice.jsx';

vi.mock('../../app/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { id: 10, name: 'Dr. Sharma', role: 'faculty', email: 'sharma@acadflow.edu' },
  }),
}));

vi.mock('../../api/endpoints.js', () => ({
  noticeApi: {
    previewAudience: vi.fn().mockResolvedValue({
      data: {
        count: 24,
        student_count: 24,
        teacher_count: 0,
        audience_summary: 'Course AIML501 (Intro to AI), Section A',
        recipients_sample: [
          { id: 1, name: 'Riya Sharma', email: 'riya@acadflow.edu', role: 'student', roll_no: '26AIML001', reason: 'Enrolled in AIML501' },
        ],
        excluded: [],
        warning: null,
      },
    }),
    extractDeadlines: vi.fn().mockResolvedValue({
      data: {
        count: 1,
        candidates: [{ label: 'Submission deadline: 15 Dec 2026', at: '2026-12-15T17:00:00+05:30', kind: 'deadline', source: 'detected' }],
      },
    }),
    getPresets: vi.fn().mockResolvedValue({
      data: {
        system_presets: [
          { id: 'my_courses', name: 'My course sections', is_system: true },
          { id: 'my_mentees', name: 'My mentees', is_system: true },
          { id: 'my_support', name: 'My course, needs support', is_system: true },
        ],
        custom_presets: [],
      },
    }),
    getRecentAudiences: vi.fn().mockResolvedValue({ data: [] }),
    create: vi.fn().mockResolvedValue({ data: { id: 101, title: 'Exam Notice' } }),
    savePreset: vi.fn().mockResolvedValue({ data: { saved: true } }),
  },
  facultyApi: {
    getCourses: vi.fn().mockResolvedValue({
      data: [
        { id: 1, code: 'AIML501', name: 'Intro to AI' },
        { id: 2, code: 'AIML502', name: 'DSA' },
      ],
    }),
  },
}));

describe('ComposeNotice 3-Step Wizard Component (Part A)', () => {
  let qc;
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.clearAllMocks();
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <ComposeNotice />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders Step 1 with title, category, priority, body, link, and add-to-deadlines checkbox', () => {
    renderComponent();

    expect(screen.getByText(/Step 1: Notice Message & Details/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. Midterm Examination Schedule/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter announcement text/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/https:\/\/forms\.google\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/Add to deadlines/i)).toBeInTheDocument();
    expect(screen.getByText(/Continue to Audience/i)).toBeInTheDocument();
  });

  it('progresses to Step 2 (Audience Builder) with presets and live audience count', async () => {
    renderComponent();

    const titleInput = screen.getByPlaceholderText(/e\.g\. Midterm Examination Schedule/i);
    const bodyInput = screen.getByPlaceholderText(/Enter announcement text/i);

    fireEvent.change(titleInput, { target: { value: 'Midterm Examination Schedule' } });
    fireEvent.change(bodyInput, { target: { value: 'Please submit your examination forms.' } });

    const continueBtn = screen.getByRole("button", { name: /Continue to Audience/i });
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(screen.getByText(/Step 2: Targeted Audience Builder/i)).toBeInTheDocument();
    });

    // Check presets
    expect(screen.getByText('My course sections')).toBeInTheDocument();
    expect(screen.getByText('My mentees')).toBeInTheDocument();
    expect(screen.getByText('My course, needs support')).toBeInTheDocument();

    // Check live preview counter
    await waitFor(() => {
      expect(screen.getByText(/Live Audience: 24 Recipients/i)).toBeInTheDocument();
    });
  });

  it('progresses to Step 3 (Review and Send) and triggers publish', async () => {
    renderComponent();

    const titleInput = screen.getByPlaceholderText(/e\.g\. Midterm Examination Schedule/i);
    const bodyInput = screen.getByPlaceholderText(/Enter announcement text/i);

    fireEvent.change(titleInput, { target: { value: 'Project Final Phase Notice' } });
    fireEvent.change(bodyInput, { target: { value: 'Project submission deadline is next Friday.' } });

    fireEvent.click(screen.getByText(/Continue to Audience/i));

    await waitFor(() => {
      expect(screen.getByText(/Step 2: Targeted Audience Builder/i)).toBeInTheDocument();
    });

    // Wait for live audience preview to resolve
    expect(await screen.findByText(/Live Audience: 24 Recipients/i)).toBeInTheDocument();

    const reviewBtn = screen.getByRole("button", { name: /Review & Send/i });
    fireEvent.click(reviewBtn);

    await waitFor(() => {
      expect(screen.getByText(/Step 3: Review Notice & Confirm Send/i)).toBeInTheDocument();
      expect(screen.getByText(/Publish Notice Now/i)).toBeInTheDocument();
    });
  });
});
