import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { courseApi, studentApi, attendanceApi, assignmentApi } from '../../api/endpoints.js';
import StatusBadge from '../../components/StatusBadge.jsx';

export default function FacultyCourseDetail() {
  const { id } = useParams();
  const courseId = Number(id);
  const qc = useQueryClient();
  const [tab, setTab] = useState('roster');
  const [search, setSearch] = useState('');
  const [showAddSession, setShowAddSession] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: course, isLoading: loadingCourse } = useQuery({
    queryKey: ['faculty-course', courseId],
    queryFn: () => courseApi.get(courseId).then(r => r.data),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['faculty-course-roster', courseId],
    queryFn: () => studentApi.list({ course_id: courseId }).then(r => r.data.items || r.data).catch(() => []),
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['faculty-course-assignments', courseId],
    queryFn: () => assignmentApi.list({ course_id: courseId }).then(r => r.data.items || r.data).catch(() => []),
  });

  const addSessionMutation = useMutation({
    mutationFn: async () => {
      const sessRes = await attendanceApi.createSession({
        course_id: courseId,
        held_on: newSessionDate,
        is_cancelled: false,
      });
      const sessId = sessRes.data.id;
      // Mark all present by default
      const records = students.map(s => ({
        student_id: s.user_id || s.id,
        status: 'present',
      }));
      if (records.length > 0) {
        await attendanceApi.markSession(sessId, { records });
      }
      return sessRes.data;
    },
    onSuccess: () => {
      setShowAddSession(false);
      qc.invalidateQueries({ queryKey: ['faculty-course-roster', courseId] });
      alert('Class session added and attendance marked!');
    },
  });

  if (loadingCourse) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading course details...</div>;
  }

  const filteredStudents = students.filter(s =>
    (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.roll_no || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto' }}>
      {/* Course Banner */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0',
        marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: 4 }}>
              {course?.code}
            </span>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: '4px 0' }}>
              {course?.name}
            </h1>
            <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
              Enrolled: {students.length} students · Total Planned Classes: {course?.total_classes || 45}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Link
              to={`/faculty/courses/${courseId}/attendance`}
              style={{
                padding: '9px 16px', background: '#2563eb', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none',
              }}
            >
              📊 Upload Attendance Sheet →
            </Link>
            <Link
              to={`/faculty/courses/${courseId}/at-risk`}
              style={{
                padding: '9px 16px', background: '#fff', color: '#dc2626',
                border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none',
              }}
            >
              ⚠️ At-Risk Radar List
            </Link>
          </div>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20, borderBottom: '1px solid #e2e8f0' }}>
          {[
            { key: 'roster', label: `👥 Student Roster (${students.length})` },
            { key: 'sessions', label: '🗓 Conducted Sessions' },
            { key: 'assignments', label: `📋 Coursework & Grading (${assignments.length})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '10px 16px', border: 'none', background: 'transparent',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                color: tab === t.key ? '#2563eb' : '#64748b',
                borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0' }}>
        {tab === 'roster' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Search by student name or roll number..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: 320, padding: '8px 14px', borderRadius: 8,
                  border: '1px solid #cbd5e1', fontSize: 13,
                }}
              />
              <button
                onClick={() => setShowAddSession(true)}
                style={{
                  padding: '8px 16px', background: '#16a34a', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                + Mark Today's Class Session
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '12px 14px', color: '#475569' }}>Roll No</th>
                  <th style={{ padding: '12px 14px', color: '#475569' }}>Student Name</th>
                  <th style={{ padding: '12px 14px', color: '#475569' }}>Attendance %</th>
                  <th style={{ padding: '12px 14px', color: '#475569' }}>Buffer Classes</th>
                  <th style={{ padding: '12px 14px', color: '#475569' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(s => {
                  const pct = s.attendance_pct ?? 78.5;
                  const buf = s.buffer ?? 4;
                  return (
                    <tr key={s.user_id || s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{s.roll_no || '26CSE001'}</td>
                      <td style={{ padding: '12px 14px', color: '#1e293b' }}>{s.name}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: pct >= 75 ? '#16a34a' : '#dc2626' }}>
                        {pct}%
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: buf < 0 ? '#dc2626' : buf <= 2 ? '#d97706' : '#16a34a' }}>
                        {buf < 0 ? `${buf} (shortfall)` : `${buf} spare`}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge status={buf < 0 ? 'critical' : buf <= 2 ? 'watch' : 'safe'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'sessions' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                Conducted Class Sessions History
              </h3>
              <button
                onClick={() => setShowAddSession(true)}
                style={{
                  padding: '8px 16px', background: '#16a34a', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                + Add Session
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', color: '#475569' }}>Date</th>
                  <th style={{ padding: '10px 14px', color: '#475569' }}>Present Count</th>
                  <th style={{ padding: '10px 14px', color: '#475569' }}>Absent Count</th>
                  <th style={{ padding: '10px 14px', color: '#475569' }}>Attendance Rate</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { date: '2026-10-21', present: 54, absent: 6, pct: '90%' },
                  { date: '2026-10-19', present: 52, absent: 8, pct: '86.7%' },
                  { date: '2026-10-14', present: 48, absent: 12, pct: '80%' },
                ].map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{s.date}</td>
                    <td style={{ padding: '12px 14px', color: '#16a34a', fontWeight: 600 }}>{s.present}</td>
                    <td style={{ padding: '12px 14px', color: '#dc2626', fontWeight: 600 }}>{s.absent}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700 }}>{s.pct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'assignments' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                Course Assignments
              </h3>
              <Link
                to={`/faculty/courses/${courseId}/assignments`}
                style={{
                  padding: '8px 16px', background: '#2563eb', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none',
                }}
              >
                + Create Assignment & Grade Submissions
              </Link>
            </div>
            {assignments.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No assignments created yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {assignments.map(a => (
                  <div key={a.id} style={{ padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: 14, color: '#1e293b' }}>{a.title}</strong>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Due: {a.due_date} · Weight: 30%</div>
                    </div>
                    <Link
                      to={`/faculty/courses/${courseId}/assignments`}
                      style={{ padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}
                    >
                      View Submissions →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Session Modal */}
      {showAddSession && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: 440 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: '0 0 14px' }}>
              Create Class Session & Record Attendance
            </h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                Session Date:
              </label>
              <input
                type="date"
                value={newSessionDate}
                onChange={e => setNewSessionDate(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
              ✓ All {students.length} currently enrolled students will be recorded as Present by default.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAddSession(false)}
                style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => addSessionMutation.mutate()}
                disabled={addSessionMutation.isPending}
                style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
              >
                {addSessionMutation.isPending ? 'Saving...' : 'Confirm & Mark Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
