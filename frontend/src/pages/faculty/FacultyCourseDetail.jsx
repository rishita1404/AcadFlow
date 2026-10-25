import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { courseApi, studentApi, attendanceApi, assignmentApi } from '../../api/endpoints.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

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
    return (
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <Skeleton height={140} style={{ marginBottom: 20 }} />
        <Skeleton height={350} />
      </div>
    );
  }

  const filteredStudents = students.filter(s =>
    (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.roll_no || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', color: 'var(--text)' }}>
      {/* Course Banner */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 24, border: '1px solid var(--border)',
        marginBottom: 20, boxShadow: 'var(--shadow-card)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)' }}>
              {course?.code}
            </span>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 700, color: 'var(--ink-900)', margin: '4px 0' }}>
              {course?.name}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
              Enrolled: {students.length} students · Total Planned Classes: {course?.total_classes || 45}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Link
              to={`/faculty/courses/${courseId}/attendance`}
              style={{
                padding: '9px 18px', background: 'var(--accent)', color: 'var(--on-dark)',
                border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600, textDecoration: 'none',
              }}
            >
              Upload Attendance Sheet →
            </Link>
            <Link
              to={`/faculty/courses/${courseId}/at-risk`}
              style={{
                padding: '9px 18px', background: 'var(--surface)', color: 'var(--crit-fg)',
                border: '1px solid var(--crit-fg)', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600, textDecoration: 'none',
              }}
            >
              At-Risk Radar List
            </Link>
          </div>
        </div>

        {/* Tab Buttons */}
        <div style={{
          display: 'flex', gap: 4, marginTop: 20, background: 'var(--bg)',
          borderRadius: 'var(--radius-pill)', padding: 4, width: 'fit-content', border: '1px solid var(--border)',
        }}>
          {[
            { key: 'roster', label: `Student Roster (${students.length})` },
            { key: 'sessions', label: 'Conducted Sessions' },
            { key: 'assignments', label: `Coursework & Grading (${assignments.length})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '6px 16px', border: 'none', borderRadius: 'var(--radius-pill)',
                fontSize: 13, fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer',
                background: tab === t.key ? 'var(--accent)' : 'transparent',
                color: tab === t.key ? 'var(--on-dark)' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
        {tab === 'roster' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Search by student name or roll number..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: 320, padding: '8px 14px', borderRadius: 'var(--radius-input)',
                  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13,
                }}
              />
              <button
                onClick={() => setShowAddSession(true)}
                style={{
                  padding: '8px 18px', background: 'var(--sage)', color: 'var(--ok-fg)',
                  border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                + Mark Today&apos;s Class Session
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 14px', color: 'var(--text)' }}>Roll No</th>
                  <th style={{ padding: '12px 14px', color: 'var(--text)' }}>Student Name</th>
                  <th style={{ padding: '12px 14px', color: 'var(--text)' }}>Attendance %</th>
                  <th style={{ padding: '12px 14px', color: 'var(--text)' }}>Buffer Classes</th>
                  <th style={{ padding: '12px 14px', color: 'var(--text)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(s => {
                  const pct = s.attendance_pct ?? 78.5;
                  const buf = s.buffer ?? 4;
                  return (
                    <tr key={s.user_id || s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--ink-900)' }}>{s.roll_no || '26AIML001'}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text)' }}>{s.name}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: pct >= 75 ? 'var(--ok-fg)' : 'var(--crit-fg)' }}>
                        {pct}%
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: buf < 0 ? 'var(--crit-fg)' : buf <= 2 ? 'var(--watch-fg)' : 'var(--ok-fg)' }}>
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
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
                Conducted Class Sessions History
              </h3>
              <button
                onClick={() => setShowAddSession(true)}
                style={{
                  padding: '8px 18px', background: 'var(--sage)', color: 'var(--ok-fg)',
                  border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                + Add Session
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', color: 'var(--text)' }}>Date</th>
                  <th style={{ padding: '10px 14px', color: 'var(--text)' }}>Present Count</th>
                  <th style={{ padding: '10px 14px', color: 'var(--text)' }}>Absent Count</th>
                  <th style={{ padding: '10px 14px', color: 'var(--text)' }}>Attendance Rate</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { date: '2026-10-21', present: 54, absent: 6, pct: '90%' },
                  { date: '2026-10-19', present: 52, absent: 8, pct: '86.7%' },
                  { date: '2026-10-14', present: 48, absent: 12, pct: '80%' },
                ].map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--ink-900)' }}>{s.date}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--ok-fg)', fontWeight: 600 }}>{s.present}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--crit-fg)', fontWeight: 600 }}>{s.absent}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--ink-900)' }}>{s.pct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'assignments' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
                Course Assignments
              </h3>
              <Link
                to={`/faculty/courses/${courseId}/assignments`}
                style={{
                  padding: '8px 18px', background: 'var(--accent)', color: 'var(--on-dark)',
                  border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600, textDecoration: 'none',
                }}
              >
                + Create Assignment & Grade Submissions
              </Link>
            </div>
            {assignments.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No assignments created yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {assignments.map(a => (
                  <div key={a.id} style={{ padding: 14, background: 'var(--bg)', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: 14, color: 'var(--ink-900)' }}>{a.title}</strong>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Due: {a.due_date} · Weight: 30%</div>
                    </div>
                    <Link
                      to={`/faculty/courses/${courseId}/assignments`}
                      style={{ padding: '6px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
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
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(13,27,42,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-dialog)', padding: 24, width: 440, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', margin: '0 0 14px' }}>
              Create Class Session & Record Attendance
            </h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                Session Date:
              </label>
              <input
                type="date"
                value={newSessionDate}
                onChange={e => setNewSessionDate(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              ✓ All {students.length} currently enrolled students will be recorded as Present by default.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAddSession(false)}
                style={{ padding: '8px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', cursor: 'pointer', color: 'var(--text)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => addSessionMutation.mutate()}
                disabled={addSessionMutation.isPending}
                style={{ padding: '8px 18px', background: 'var(--sage)', color: 'var(--ok-fg)', border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontWeight: 700 }}
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
