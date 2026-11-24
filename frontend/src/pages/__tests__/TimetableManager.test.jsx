import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import CoordinatorTimetable from '../coordinator/CoordinatorTimetable.jsx';
import CoordinatorTimetableEditor from '../coordinator/CoordinatorTimetableEditor.jsx';
import FacultyTimetable from '../faculty/FacultyTimetable.jsx';

vi.mock('../../app/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { id: 5, name: 'Prof. Rao', role: 'coordinator', email: 'rao@acadflow.edu', department_id: 1 },
    activeRole: 'coordinator',
  }),
}));

vi.mock('../../api/endpoints.js', () => ({
  coordinatorApi: {
    getOverview: vi.fn().mockResolvedValue({
      data: {
        department_id: 1,
        department_name: 'Computer Science & Engineering',
      },
    }),
    getTeachers: vi.fn().mockResolvedValue({
      data: [
        { id: 2, name: 'Dr. Sharma', email: 'sharma@acadflow.edu' },
        { id: 3, name: 'Prof. Verma', email: 'verma@acadflow.edu' },
      ],
    }),
  },
  courseApi: {
    list: vi.fn().mockResolvedValue({
      data: {
        items: [
          { id: 10, code: 'CS101', name: 'Data Structures', short_name: 'DSA' },
          { id: 11, code: 'CS102', name: 'Algorithms', short_name: 'Algo' },
        ],
      },
    }),
  },
  timetableApi: {
    getVersions: vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'Autumn 2026 Production',
          status: 'published',
          effective_from: '2026-08-01',
          conflicts_count: 0,
          published_at: '2026-08-01T09:00:00Z',
        },
        {
          id: 2,
          name: 'Spring 2027 Draft',
          status: 'draft',
          effective_from: '2027-01-10',
          conflicts_count: 2,
          published_at: null,
        },
      ],
    }),
    getRooms: vi.fn().mockResolvedValue({
      data: [
        { id: 1, name: 'Room B-204', capacity: 60, room_type: 'classroom', department_id: 1 },
        { id: 2, name: 'Hardware Lab 3', capacity: 40, room_type: 'lab', department_id: 1 },
      ],
    }),
    getDraft: vi.fn().mockResolvedValue({
      data: {
        version_id: 2,
        name: 'Spring 2027 Draft',
        status: 'draft',
        slots: [
          {
            id: 101,
            course_id: 10,
            course_code: 'CS101',
            course_name: 'Data Structures',
            teacher_id: 2,
            teacher_name: 'Dr. Sharma',
            room_id: 1,
            room_name: 'Room B-204',
            day: 0,
            period_label: 'P1',
            section: 'A',
            kind: 'lecture',
            is_clash: false,
          },
        ],
        changes_vs_published: [
          'Tue 11:15 CS101 Sec A moved from Mon 09:00, Room B-204',
        ],
      },
    }),
    getVersionDetails: vi.fn().mockResolvedValue({
      data: {
        version: { id: 2, name: 'Spring 2027 Draft', status: 'draft' },
        slots: [],
        periods: [],
        clashes: [],
      },
    }),
    saveDraft: vi.fn().mockResolvedValue({
      data: { saved: true, version_id: 2, slots_count: 1, clashes_count: 0, clashes: [] },
    }),
    publishPreview: vi.fn().mockResolvedValue({
      data: {
        version_id: 2,
        clashes_count: 1,
        diff_summary: ['Tue 11:15 CS101 Sec A moved from Mon 09:00, Room B-204'],
        affected_students_count: 45,
        affected_teachers_count: 2,
      },
    }),
    publish: vi.fn().mockResolvedValue({
      data: {
        published: true,
        version_id: 2,
        affected_students_count: 45,
        affected_teachers_count: 2,
      },
    }),
    restoreVersion: vi.fn().mockResolvedValue({
      data: { restored: true, new_version_id: 3, slots_copied: 1 },
    }),
    createVersion: vi.fn().mockResolvedValue({
      data: { id: 4, name: 'New Semester Schedule', status: 'draft' },
    }),
    createRoom: vi.fn().mockResolvedValue({
      data: { id: 5, name: 'Seminar Hall', capacity: 120, room_type: 'seminar' },
    }),
    updateRoom: vi.fn().mockResolvedValue({
      data: { id: 1, name: 'Room B-204', capacity: 70, room_type: 'classroom' },
    }),
    deleteRoom: vi.fn().mockResolvedValue({ data: { deleted: true } }),
    copyDay: vi.fn().mockResolvedValue({ data: { copied: true, created_count: 3 } }),
    getMyTimetable: vi.fn().mockResolvedValue({
      data: [
        {
          id: 201,
          course_id: 10,
          course_code: 'CS101',
          course_name: 'Data Structures',
          course_short_name: 'DSA',
          section: 'A',
          teacher_id: 5,
          teacher_name: 'Prof. Rao',
          room_name: 'Room B-204',
          day: 0,
          period_label: 'P1',
          kind: 'lecture',
          is_clash: true,
          clash_reason: 'Teacher assigned to multiple classes on Monday P1',
        },
        {
          id: 202,
          course_id: 11,
          course_code: 'CS102',
          course_name: 'Algorithms',
          course_short_name: 'Algo',
          section: 'B',
          teacher_id: 5,
          teacher_name: 'Prof. Rao',
          room_name: 'Lab 2',
          day: 0,
          period_label: 'P1',
          kind: 'lecture',
          is_clash: true,
          clash_reason: 'Teacher assigned to multiple classes on Monday P1',
        },
      ],
    }),
  },
}));

describe('Timetable Manager Component Suite (Part B)', () => {
  let qc;
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.clearAllMocks();
  });

  it('renders CoordinatorTimetable entry screen with Option 1 & Option 2 and versions list', async () => {
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <CoordinatorTimetable />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Department Timetable Manager/i)).toBeInTheDocument();
    expect(screen.getByText(/Option 1: Edit Current Timetable/i)).toBeInTheDocument();
    expect(screen.getByText(/Option 2: Create New from Scratch \(5-Step Wizard\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Autumn 2026 Production/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Spring 2027 Draft/i).length).toBeGreaterThanOrEqual(1);
  });

  it('opens 5-Step Scratch Wizard modal when clicking Start 5-Step Scratch Wizard', async () => {
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <CoordinatorTimetable />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const wizardBtn = await screen.findByRole('button', { name: /Start 5-Step Scratch Wizard/i });
    fireEvent.click(wizardBtn);

    await waitFor(() => {
      expect(screen.getByText(/Step 1 of 5/i)).toBeInTheDocument();
      expect(screen.getByText(/Step 1: Department & Scope/i)).toBeInTheDocument();
    });

    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(screen.getByText(/Step 2 of 5/i)).toBeInTheDocument();
      expect(screen.getByText(/Period & Time Structure/i)).toBeInTheDocument();
    });
  });

  it('opens Publish dialog with Audience Impact Preview and conflict confirmation checkbox', async () => {
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <CoordinatorTimetable />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const publishBtn = await screen.findByRole('button', { name: /Publish Timetable/i });
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(screen.getByText(/Audience Impact Preview/i)).toBeInTheDocument();
      expect(screen.getByText(/AFFECTED STUDENTS/i)).toBeInTheDocument();
      expect(screen.getByText(/Non-Blocking Clashes Detected/i)).toBeInTheDocument();
      expect(screen.getByText(/I confirm: Publish with 1 conflict\(s\)/i)).toBeInTheDocument();
    });
  });

  it('toggles to Room Master management tab and shows rooms list with Add New Room', async () => {
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <CoordinatorTimetable />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const roomMasterBtn = await screen.findByRole('button', { name: /Manage Room Master/i });
    fireEvent.click(roomMasterBtn);

    await waitFor(() => {
      expect(screen.getByText(/Room Master Management/i)).toBeInTheDocument();
      expect(screen.getByText(/Room B-204/i)).toBeInTheDocument();
      expect(screen.getByText(/Hardware Lab 3/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add New Room/i })).toBeInTheDocument();
    });
  });

  it('renders CoordinatorTimetableEditor with weekly grid and changes vs published diff panel', async () => {
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <CoordinatorTimetableEditor />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Visual Timetable Grid Editor/i)).toBeInTheDocument();
      expect(screen.getByText(/Changes vs Published Timetable/i)).toBeInTheDocument();
      expect(screen.getByText(/Tue 11:15 CS101 Sec A moved from Mon 09:00/i)).toBeInTheDocument();
    });
  });

  it('renders FacultyTimetable showing both classes in a clashing slot with conflict markers', async () => {
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <FacultyTimetable />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Department Timetable Grid Editor|My Weekly Teaching Schedule/i)).toBeInTheDocument();
    // Both classes should be rendered in the same Monday P1 cell
    expect(screen.getByText('DSA')).toBeInTheDocument();
    expect(screen.getByText('Algo')).toBeInTheDocument();
    // Conflict marker header and badge
    expect(screen.getByText(/Conflict \(2 Classes\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Overlapping class/i).length).toBe(2);
  });
});
