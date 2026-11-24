import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import FacultyAttendanceUpload from '../faculty/FacultyAttendanceUpload.jsx';
import { attendanceApi, facultyApi, courseApi } from '../../api/endpoints.js';

vi.mock('../../api/endpoints.js', () => ({
  attendanceApi: {
    getDateAttendance: vi.fn(),
    uploadFile: vi.fn(),
    downloadTemplate: vi.fn(),
    downloadExcelTemplate: vi.fn(),
    directMark: vi.fn(),
  },
  facultyApi: {
    getCourses: vi.fn(),
    previewUpload: vi.fn(),
    undoUpload: vi.fn(),
  },
  courseApi: {
    getCourse: vi.fn(),
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

describe('Attendance Upload Preview and Undo (Phase 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    facultyApi.getCourses.mockResolvedValue({
      data: [{ id: 1, code: 'CS101', name: 'Intro to Programming' }],
    });

    courseApi.getCourse.mockResolvedValue({
      data: {
        id: 1,
        code: 'CS101',
        name: 'Intro to Programming',
        students: [
          { id: 101, roll_no: 'CS101_01', name: 'Student One' },
          { id: 102, roll_no: 'CS101_02', name: 'Student Two' },
        ],
      },
    });

    attendanceApi.getDateAttendance.mockResolvedValue({
      data: {
        records: [],
        is_recorded: false,
      },
    });
  });

  it('displays preview warnings when selecting an attendance file', async () => {
    facultyApi.previewUpload.mockResolvedValueOnce({
      data: {
        preview: true,
        course_id: 1,
        total_rows: 3,
        valid_rows: 2,
        quarantined_rows: 1,
        sessions_to_create: 1,
        warnings: {
          unknown_ids: ['UNKNOWN_99'],
          all_present_rows: ['2026-11-20'],
          duplicate_sessions: ['2026-11-15'],
        },
        warning_messages: [
          'Found 1 unknown student ID(s): UNKNOWN_99',
          '100% present attendance detected for session(s) on 2026-11-20.',
          'Session(s) on 2026-11-15 already have recorded attendance.',
        ],
        errors: [{ row: 3, roll_no: 'UNKNOWN_99', reason: 'Not found' }],
      },
    });

    renderWithClient(<FacultyAttendanceUpload />);

    // Switch to Excel / CSV tab
    const excelTab = await screen.findByRole('button', { name: /Option 2: Excel File Upload/i });
    fireEvent.click(excelTab);

    // Simulate file input change
    const fileInput = document.getElementById('faculty-file-input');
    const fakeFile = new File(['roll_no,date,status\nCS101_01,2026-11-20,present'], 'attendance.csv', {
      type: 'text/csv',
    });

    fireEvent.change(fileInput, { target: { files: [fakeFile] } });

    // Verify preview warnings are displayed
    expect(await screen.findByText(/Upload Warnings Detected/i)).toBeInTheDocument();
    expect(screen.getByText(/Found 1 unknown student ID\(s\): UNKNOWN_99/i)).toBeInTheDocument();
    expect(screen.getByText(/100% present attendance detected for session\(s\) on 2026-11-20/i)).toBeInTheDocument();
    expect(screen.getByText(/Session\(s\) on 2026-11-15 already have recorded attendance/i)).toBeInTheDocument();

    // Verify preview chips
    expect(screen.getByText(/Total rows: 3/i)).toBeInTheDocument();
    expect(screen.getByText(/✓ Valid: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/✕ Quarantined: 1/i)).toBeInTheDocument();
  });

  it('renders undo button upon upload and successfully reverts upload', async () => {
    attendanceApi.uploadFile.mockResolvedValueOnce({
      data: {
        course_id: 1,
        batch_id: 42,
        processed: 2,
        sessions_created: 1,
        error_count: 0,
      },
    });

    facultyApi.undoUpload.mockResolvedValueOnce({
      data: {
        success: true,
        batch_id: 42,
        reverted_created: 2,
        reverted_updated: 0,
        message: "Successfully undone attendance upload 'attendance.csv'. Reverted 2 record(s).",
      },
    });

    renderWithClient(<FacultyAttendanceUpload />);

    // Switch to Excel / CSV tab
    const excelTab = await screen.findByRole('button', { name: /Option 2: Excel File Upload/i });
    fireEvent.click(excelTab);

    // Select file
    const fileInput = document.getElementById('faculty-file-input');
    const fakeFile = new File(['roll_no,date,status\nCS101_01,2026-11-20,present'], 'attendance.csv', {
      type: 'text/csv',
    });
    fireEvent.change(fileInput, { target: { files: [fakeFile] } });

    // Submit upload
    const submitBtn = await screen.findByRole('button', { name: /Upload & Save Attendance/i });
    fireEvent.click(submitBtn);

    // Verify upload success banner & Undo button
    expect(await screen.findByText(/Attendance uploaded successfully!/i)).toBeInTheDocument();
    const undoBtn = screen.getByRole('button', { name: /Undo Upload/i });
    expect(undoBtn).toBeInTheDocument();

    // Click Undo
    fireEvent.click(undoBtn);

    // Verify undo result displayed
    expect(await screen.findByText(/Successfully undone attendance upload/i)).toBeInTheDocument();
    expect(facultyApi.undoUpload).toHaveBeenCalledWith(1, 42);
  });
});
