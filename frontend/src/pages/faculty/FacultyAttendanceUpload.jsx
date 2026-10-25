import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { courseApi, facultyApi, attendanceApi } from '../../api/endpoints.js';
import { invalidateAttendanceQueries } from '../../utils/format.js';

export default function FacultyAttendanceUpload() {
  const { id: courseIdParam } = useParams();
  const qc = useQueryClient();

  const [selectedCourseId, setSelectedCourseId] = useState(courseIdParam || '');
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('direct'); // 'direct' | 'excel'

  // Direct marking state
  const [studentStatuses, setStudentStatuses] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isSavingDirect, setIsSavingDirect] = useState(false);
  const [directSuccessMessage, setDirectSuccessMessage] = useState(null);
  const [directErrorMessage, setDirectErrorMessage] = useState(null);

  // Excel / CSV upload state
  const [file, setFile] = useState(null);
  const [changeReason, setChangeReason] = useState('');
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState(null);

  // Load courses list for faculty
  const { data: rawCourses = [] } = useQuery({
    queryKey: ['faculty-courses-upload'],
    queryFn: () =>
      facultyApi
        .getCourses()
        .then(r => r.data?.items || (Array.isArray(r.data) ? r.data : []))
        .catch(() => []),
  });
  const courses = Array.isArray(rawCourses) ? rawCourses : rawCourses?.items || [];
  const activeCourseId = selectedCourseId ? Number(selectedCourseId) : courses.length > 0 ? courses[0].id : null;

  // Load course details
  const { data: courseDetail } = useQuery({
    queryKey: ['course-detail-upload', activeCourseId],
    queryFn: () => courseApi.getCourse(activeCourseId).then(r => r.data),
    enabled: !!activeCourseId,
  });

  // Load attendance data for this course & session date
  const {
    data: dateAttendanceData,
    isLoading: isLoadingDateAttendance,
    refetch: refetchDateAttendance,
  } = useQuery({
    queryKey: ['course-date-attendance', activeCourseId, sessionDate],
    queryFn: () => attendanceApi.getDateAttendance(activeCourseId, sessionDate).then(r => r.data),
    enabled: !!activeCourseId && !!sessionDate,
  });

  // Sync loaded roster records into local state
  useEffect(() => {
    if (dateAttendanceData?.records) {
      const map = {};
      dateAttendanceData.records.forEach(r => {
        map[r.student_id] = r.status === 'absent' ? 'absent' : 'present';
      });
      setStudentStatuses(map);
      setDirectSuccessMessage(null);
      setDirectErrorMessage(null);
    } else if (courseDetail?.students) {
      // Default all enrolled to present
      const map = {};
      courseDetail.students.forEach(s => {
        const sid = s.student_id || s.id;
        map[sid] = 'present';
      });
      setStudentStatuses(map);
    }
  }, [dateAttendanceData, courseDetail]);

  // Student list from query or course detail
  const studentList = useMemo(() => {
    if (dateAttendanceData?.records && dateAttendanceData.records.length > 0) {
      return dateAttendanceData.records;
    }
    if (courseDetail?.students && courseDetail.students.length > 0) {
      return courseDetail.students.map(s => ({
        student_id: s.student_id || s.id,
        roll_no: s.roll_no,
        name: s.name,
        status: 'present',
      }));
    }
    return [];
  }, [dateAttendanceData, courseDetail]);

  // Filtered students based on search query
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return studentList;
    const q = searchQuery.toLowerCase();
    return studentList.filter(
      s =>
        (s.roll_no && s.roll_no.toLowerCase().includes(q)) ||
        (s.name && s.name.toLowerCase().includes(q))
    );
  }, [studentList, searchQuery]);

  // Toggle student status (Present <-> Absent)
  function handleToggleStatus(studentId) {
    setStudentStatuses(prev => {
      const current = prev[studentId] || 'present';
      return {
        ...prev,
        [studentId]: current === 'present' ? 'absent' : 'present',
      };
    });
  }

  // Bulk: Mark All Present
  function handleMarkAllPresent() {
    const next = {};
    studentList.forEach(s => {
      next[s.student_id] = 'present';
    });
    setStudentStatuses(next);
  }

  // Bulk: Mark All Absent
  function handleMarkAllAbsent() {
    const next = {};
    studentList.forEach(s => {
      next[s.student_id] = 'absent';
    });
    setStudentStatuses(next);
  }

  // Save Direct Attendance (One-Click)
  async function handleSaveDirectAttendance() {
    if (!activeCourseId) return;
    setIsSavingDirect(true);
    setDirectSuccessMessage(null);
    setDirectErrorMessage(null);

    const records = studentList.map(s => ({
      student_id: s.student_id,
      status: studentStatuses[s.student_id] || 'present',
    }));

    try {
      const res = await attendanceApi.directMark({
        course_id: activeCourseId,
        session_date: sessionDate,
        records,
      });
      setDirectSuccessMessage(
        res.data?.message ||
          `Attendance successfully recorded for ${sessionDate}! Present: ${presentCount}, Absent: ${absentCount}.`
      );
      invalidateAttendanceQueries(qc);
      refetchDateAttendance();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setDirectErrorMessage(
        typeof detail === 'string'
          ? detail
          : detail?.message || 'Failed to save attendance. Please try again.'
      );
    } finally {
      setIsSavingDirect(false);
    }
  }

  // Download Templates
  async function handleDownloadExcelTemplate() {
    try {
      const res = await attendanceApi.downloadExcelTemplate(activeCourseId, sessionDate);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `attendance_template_${courseDetail?.code || 'course'}_${sessionDate}.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to download Excel template.');
    }
  }

  async function handleDownloadCsvTemplate() {
    try {
      const res = await attendanceApi.downloadTemplate(activeCourseId, sessionDate);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `attendance_template_${courseDetail?.code || 'course'}_${sessionDate}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to download CSV template.');
    }
  }

  // Direct File Upload (Option 2 - No verification steps)
  async function handleDirectFileUpload(e) {
    e.preventDefault();
    if (!file || !activeCourseId) return;

    setIsUploadingFile(true);
    setUploadErrorMessage(null);
    setUploadResult(null);

    try {
      const res = await attendanceApi.uploadFile(activeCourseId, file, changeReason);
      setUploadResult(res.data);
      invalidateAttendanceQueries(qc);
      refetchDateAttendance();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setUploadErrorMessage(
        typeof detail === 'string'
          ? detail
          : detail?.message || 'Attendance upload failed. Check file format and columns.'
      );
    } finally {
      setIsUploadingFile(false);
    }
  }

  // Compute counts
  const totalCount = studentList.length;
  const presentCount = studentList.filter(s => (studentStatuses[s.student_id] || 'present') === 'present').length;
  const absentCount = totalCount - presentCount;
  const presentPct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 48, color: 'var(--text)' }}>
      {/* Breadcrumb & Navigation */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          <Link to="/faculty/home" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Home
          </Link>{' '}
          /{' '}
          <Link
            to={`/faculty/courses/${activeCourseId}`}
            style={{ color: 'var(--accent)', textDecoration: 'none' }}
          >
            {courseDetail?.code || 'Course'}
          </Link>{' '}
          / Attendance Manager
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 26,
                fontWeight: 700,
                color: 'var(--ink-900)',
                margin: 0,
              }}
            >
              Mark & Upload Class Attendance
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4, margin: '4px 0 0 0' }}>
              Select a date, tick circles for Present, or upload an Excel spreadsheet. Saves immediately with zero verification steps.
            </p>
          </div>

          {/* Course Selector Dropdown */}
          {courses.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                Course:
              </span>
              <select
                value={activeCourseId || ''}
                onChange={e => setSelectedCourseId(Number(e.target.value))}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Top Configuration Bar: Date Picker & Two Options Tabs */}
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-card)',
          padding: '16px 20px',
          border: '1px solid var(--border)',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* Date Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)' }}>
            Session Date:
          </label>
          <input
            type="date"
            value={sessionDate}
            onChange={e => setSessionDate(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-input)',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 14,
              fontWeight: 600,
            }}
          />
          <button
            onClick={() => setSessionDate(new Date().toISOString().split('T')[0])}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-pill)',
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            Today
          </button>
          {dateAttendanceData?.is_recorded && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--ok-fg)',
                background: 'var(--ok-bg)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              ✓ Recorded
            </span>
          )}
        </div>

        {/* 2 Options Switcher Tabs */}
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--bg)',
            padding: 4,
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border)',
          }}
        >
          <button
            onClick={() => setActiveTab('direct')}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              background: activeTab === 'direct' ? 'var(--surface)' : 'transparent',
              color: activeTab === 'direct' ? 'var(--ink-900)' : 'var(--text-muted)',
              fontWeight: activeTab === 'direct' ? 700 : 500,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: activeTab === 'direct' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: 16 }}>⚪</span>
            Option 1: Direct Mark (Checklist)
          </button>
          <button
            onClick={() => setActiveTab('excel')}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              background: activeTab === 'excel' ? 'var(--surface)' : 'transparent',
              color: activeTab === 'excel' ? 'var(--ink-900)' : 'var(--text-muted)',
              fontWeight: activeTab === 'excel' ? 700 : 500,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: activeTab === 'excel' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: 16 }}>📊</span>
            Option 2: Excel File Upload
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* OPTION 1: Direct Mark with Tick Circle */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'direct' && (
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-card)',
            overflow: 'hidden',
          }}
        >
          {/* Direct Mark Header & Toolbar */}
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
              background: 'var(--surface)',
            }}
          >
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--ink-900)',
                  margin: 0,
                }}
              >
                Roster Checklist — {courseDetail?.name || 'Course'}
              </h2>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Check the tick circle for <strong>Present</strong>, uncheck for <strong>Absent</strong>.
              </div>
            </div>

            {/* Live Attendance Stats Pills */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div
                style={{
                  padding: '6px 14px',
                  background: 'var(--ok-bg)',
                  color: 'var(--ok-fg)',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                ✓ {presentCount} Present ({presentPct}%)
              </div>
              <div
                style={{
                  padding: '6px 14px',
                  background: 'var(--crit-bg)',
                  color: 'var(--crit-fg)',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                ✕ {absentCount} Absent
              </div>
            </div>
          </div>

          {/* Quick Actions & Search Bar */}
          <div
            style={{
              padding: '14px 24px',
              background: 'var(--bg)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {/* Search Input */}
            <div style={{ minWidth: 260, flex: '1 1 260px', maxWidth: 400 }}>
              <input
                type="text"
                placeholder="Search student by name or roll number..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-input)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Bulk Toggle Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleMarkAllPresent}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--ok-fg)',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>✓</span> Mark All Present
              </button>
              <button
                onClick={handleMarkAllAbsent}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--crit-fg)',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>✕</span> Mark All Absent
              </button>
            </div>
          </div>

          {/* Feedback Alerts */}
          {directSuccessMessage && (
            <div
              style={{
                margin: '16px 24px 0 24px',
                padding: '12px 16px',
                background: 'var(--ok-bg)',
                border: '1px solid var(--ok-fg)',
                borderRadius: 'var(--radius-input)',
                color: 'var(--ok-fg)',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>🎉</span>
              <div>{directSuccessMessage}</div>
            </div>
          )}
          {directErrorMessage && (
            <div
              style={{
                margin: '16px 24px 0 24px',
                padding: '12px 16px',
                background: 'var(--crit-bg)',
                border: '1px solid var(--crit-fg)',
                borderRadius: 'var(--radius-input)',
                color: 'var(--crit-fg)',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>⚠️</span>
              <div>{directErrorMessage}</div>
            </div>
          )}

          {/* Roster Table with Tick Circles */}
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: 13,
              }}
            >
              <thead
                style={{
                  background: 'var(--bg)',
                  position: 'sticky',
                  top: 0,
                  borderBottom: '1px solid var(--border)',
                  zIndex: 2,
                }}
              >
                <tr>
                  <th style={{ padding: '12px 20px', width: 90, color: 'var(--ink-900)', fontWeight: 700 }}>
                    Status
                  </th>
                  <th style={{ padding: '12px 16px', width: 140, color: 'var(--ink-900)', fontWeight: 700 }}>
                    Roll No
                  </th>
                  <th style={{ padding: '12px 16px', color: 'var(--ink-900)', fontWeight: 700 }}>
                    Student Name
                  </th>
                  <th style={{ padding: '12px 20px', width: 140, color: 'var(--ink-900)', fontWeight: 700 }}>
                    Current State
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoadingDateAttendance ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                      Loading enrolled students for {sessionDate}...
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No students found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(student => {
                    const isPresent = (studentStatuses[student.student_id] || 'present') === 'present';
                    return (
                      <tr
                        key={student.student_id}
                        onClick={() => handleToggleStatus(student.student_id)}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          background: isPresent ? 'var(--surface)' : 'var(--crit-bg)',
                          cursor: 'pointer',
                          transition: 'background 0.12s ease',
                        }}
                      >
                        {/* Interactive Tick Circle */}
                        <td style={{ padding: '10px 20px' }}>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleToggleStatus(student.student_id);
                            }}
                            title={isPresent ? 'Click to mark Absent' : 'Click to mark Present'}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              border: isPresent ? '2px solid var(--ok-fg)' : '2px solid var(--border)',
                              background: isPresent ? 'var(--ok-fg)' : 'var(--surface)',
                              color: isPresent ? '#ffffff' : 'var(--text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 16,
                              fontWeight: 900,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              outline: 'none',
                              padding: 0,
                            }}
                          >
                            {isPresent ? '✓' : ''}
                          </button>
                        </td>

                        {/* Roll Number */}
                        <td style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--ink-900)', fontFamily: 'monospace' }}>
                          {student.roll_no}
                        </td>

                        {/* Name */}
                        <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 600 }}>
                          {student.name}
                        </td>

                        {/* State Pill */}
                        <td style={{ padding: '10px 20px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 12px',
                              borderRadius: 'var(--radius-pill)',
                              fontSize: 11,
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              letterSpacing: 0.5,
                              background: isPresent ? 'var(--ok-bg)' : 'var(--crit-bg)',
                              color: isPresent ? 'var(--ok-fg)' : 'var(--crit-fg)',
                              border: `1px solid ${isPresent ? 'var(--ok-fg)' : 'var(--crit-fg)'}`,
                            }}
                          >
                            {isPresent ? 'Present' : 'Absent'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Sticky Bottom Save Bar (Instant One-Click Save) */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border)',
              background: 'var(--surface)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Session: <strong>{sessionDate}</strong> &bull; Total Enrolled: <strong>{totalCount}</strong> students &bull; Ready to record.
            </div>

            <button
              onClick={handleSaveDirectAttendance}
              disabled={isSavingDirect || totalCount === 0}
              style={{
                background: isSavingDirect ? 'var(--border)' : 'var(--accent)',
                color: isSavingDirect ? 'var(--text-muted)' : 'var(--on-dark)',
                border: 'none',
                padding: '12px 32px',
                borderRadius: 'var(--radius-pill)',
                fontSize: 14,
                fontWeight: 700,
                cursor: isSavingDirect || totalCount === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              }}
            >
              {isSavingDirect ? 'Saving Attendance & Syncing Risk...' : `Save Attendance (${presentCount} Present, ${absentCount} Absent)`}
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* OPTION 2: Excel / CSV File Upload with Checkbox Template */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'excel' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
          {/* Card 1: Download Improved Template */}
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-card)',
              padding: 28,
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--accent)',
                  marginBottom: 12,
                }}
              >
                <span>📥</span> Step 1: Pre-formatted Roster Template
              </div>
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--ink-900)',
                  margin: '0 0 10px 0',
                }}
              >
                Download Spreadsheet Template
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
                Includes all enrolled students for <strong>{courseDetail?.name || 'this course'}</strong> pre-filled with the selected date (<code>{sessionDate}</code>). The Excel template features a built-in <strong>Present/Absent dropdown</strong> and supports checkbox-style values (<code>TRUE/FALSE</code>, <code>1/0</code>, <code>P/A</code>, <code>✓/✕</code>).
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={handleDownloadExcelTemplate}
                style={{
                  background: 'var(--accent)',
                  color: 'var(--on-dark)',
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <span>📊</span> Download Excel Template (.XLSX)
              </button>
              <button
                onClick={handleDownloadCsvTemplate}
                style={{
                  background: 'var(--bg)',
                  color: 'var(--ink-900)',
                  border: '1px solid var(--border)',
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <span>📄</span> Download CSV Template (.CSV)
              </button>
            </div>
          </div>

          {/* Card 2: Direct File Upload (Zero Verification Steps) */}
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-card)',
              padding: 28,
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--ok-bg)',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--ok-fg)',
                marginBottom: 12,
              }}
            >
              <span>⚡</span> Step 2: Instant Upload & Save
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--ink-900)',
                margin: '0 0 10px 0',
              }}
            >
              Upload Completed Sheet
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
              Drop your completed Excel or CSV file. It records attendance and synchronizes student risk meters immediately without any intermediate verification steps.
            </p>

            <form onSubmit={handleDirectFileUpload}>
              {/* Dropzone */}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
                }}
                onClick={() => document.getElementById('faculty-file-input').click()}
                style={{
                  border: `2px dashed ${file ? 'var(--ok-fg)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-input)',
                  padding: '28px 16px',
                  textAlign: 'center',
                  background: file ? 'var(--ok-bg)' : 'var(--bg)',
                  marginBottom: 16,
                  cursor: 'pointer',
                  transition: 'border 0.2s ease',
                }}
              >
                <input
                  id="faculty-file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={e => setFile(e.target.files?.[0])}
                />
                <div style={{ fontSize: 32, marginBottom: 6 }}>{file ? '📄' : '☁️'}</div>
                {file ? (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ok-fg)', marginTop: 2 }}>
                      {(file.size / 1024).toFixed(1)} KB &bull; Ready to save
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)' }}>
                      Click to choose or drag &amp; drop Excel / CSV here
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Accepts .xlsx, .xls, .csv
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Reason / Notes */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  Audit Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Regular lecture attendance upload"
                  value={changeReason}
                  onChange={e => setChangeReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-input)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Upload Error Banner */}
              {uploadErrorMessage && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'var(--crit-bg)',
                    border: '1px solid var(--crit-fg)',
                    borderRadius: 'var(--radius-input)',
                    color: 'var(--crit-fg)',
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 16,
                  }}
                >
                  ⚠️ {uploadErrorMessage}
                </div>
              )}

              {/* Upload Success Banner */}
              {uploadResult && (
                <div
                  style={{
                    padding: '12px 16px',
                    background: 'var(--ok-bg)',
                    border: '1px solid var(--ok-fg)',
                    borderRadius: 'var(--radius-input)',
                    color: 'var(--ok-fg)',
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 16,
                  }}
                >
                  🎉 Attendance uploaded successfully!
                  <div style={{ fontSize: 12, fontWeight: 400, marginTop: 4 }}>
                    <strong>{uploadResult.processed}</strong> records processed,{' '}
                    <strong>{uploadResult.sessions_created}</strong> session(s) created,{' '}
                    <strong>{uploadResult.error_count}</strong> errors.
                  </div>
                </div>
              )}

              {/* One-Click Upload & Save Button */}
              <button
                type="submit"
                disabled={!file || isUploadingFile}
                style={{
                  width: '100%',
                  background: !file || isUploadingFile ? 'var(--border)' : 'var(--accent)',
                  color: !file || isUploadingFile ? 'var(--text-muted)' : 'var(--on-dark)',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: !file || isUploadingFile ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {isUploadingFile ? 'Uploading & Saving Attendance...' : 'Upload & Save Attendance'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
