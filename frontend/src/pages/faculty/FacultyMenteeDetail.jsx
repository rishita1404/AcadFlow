import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facultyApi, attendanceApi } from '../../api/endpoints.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import BufferGauge from '../../components/BufferGauge.jsx';

export default function FacultyMenteeDetail() {
  const { id } = useParams();
  const studentId = Number(id);
  const queryClient = useQueryClient();

  const [noteText, setNoteText] = useState('');
  const [noteModalOpen, setNoteModalOpen] = useState(false);

  // Fetch mentee summary
  const { data: mentee, isLoading: menteeLoading, error: menteeError } = useQuery({
    queryKey: ['mentee-detail', studentId],
    queryFn: () => facultyApi.getMenteeDetail(studentId).then(r => r.data),
    retry: false,
  });

  // Fetch mentee courses with risk & buffer
  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ['mentee-courses', studentId],
    queryFn: () => facultyApi.getMenteeCourses(studentId).then(r => r.data || []),
    enabled: !!mentee,
  });

  // Fetch mentee notes
  const { data: notes = [] } = useQuery({
    queryKey: ['mentee-notes', studentId],
    queryFn: () => facultyApi.getMenteeNotes(studentId).then(r => r.data || []),
    enabled: !!mentee,
  });

  // Add Note Mutation
  const addNoteMutation = useMutation({
    mutationFn: (text) => facultyApi.addMenteeNote(studentId, text),
    onSuccess: () => {
      queryClient.invalidateQueries(['mentee-notes', studentId]);
      setNoteModalOpen(false);
      setNoteText('');
    },
  });

  function handleAddNote(e) {
    e.preventDefault();
    if (!noteText.trim()) return;
    addNoteMutation.mutate(noteText.trim());
  }

  // Handle Scope 403: student is not assigned to this mentor
  if (menteeError) {
    const is403 = menteeError.response?.status === 403;
    return (
      <div style={{ maxWidth: 640, margin: '60px auto', background: '#fff', borderRadius: 14, padding: 32, textAlign: 'center', border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🛡️</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', margin: '0 0 8px 0' }}>
          {is403 ? 'Access Restricted (Scope 403)' : 'Mentee Not Found'}
        </h2>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
          {is403
            ? 'This student is not assigned to your mentorship cohort. Mentorship records are strictly scoped to designated faculty mentors.'
            : 'Unable to retrieve records for the requested student.'}
        </p>
        <Link
          to="/faculty/mentees"
          style={{
            background: '#3b82f6', color: '#fff', padding: '10px 20px', borderRadius: 8,
            fontSize: 13, fontWeight: 700, textDecoration: 'none',
          }}
        >
          ← Return to My Mentees
        </Link>
      </div>
    );
  }

  if (menteeLoading || coursesLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading mentee 360° record...</div>;
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
          <Link to="/faculty/home" style={{ color: '#3b82f6', textDecoration: 'none' }}>Home</Link>
          {' '}/ <Link to="/faculty/mentees" style={{ color: '#3b82f6', textDecoration: 'none' }}>Mentees</Link>
          {' '}/ {mentee?.name}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
              🎓 {mentee?.name}
            </h1>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
              Roll No: {mentee?.roll_no} · Email: {mentee?.email} · Overall Attendance: <strong>{mentee?.overall_attendance_pct}%</strong>
            </p>
          </div>
          <button
            onClick={() => setNoteModalOpen(true)}
            style={{
              background: '#3b82f6', color: '#fff', border: 'none',
              padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            + Add Mentor Note
          </button>
        </div>
      </div>

      {/* Main Grid: Multi-Course View + Timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>
        {/* Left column: Courses Performance & Buffer Gauges */}
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>
            📚 Multi-Course Academic Standing
          </h2>

          <div style={{ display: 'grid', gap: 14 }}>
            {courses.map(c => {
              const bufferColor = c.buffer == null ? '#94a3b8' : c.buffer <= 0 ? '#ef4444' : c.buffer <= 2 ? '#f59e0b' : '#22c55e';
              return (
                <div key={c.course_id} style={{ background: '#fff', borderRadius: 12, padding: 18, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', background: '#eff6ff', padding: '2px 8px', borderRadius: 4 }}>
                        {c.course_code}
                      </span>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>
                        {c.course_name}
                      </h3>
                    </div>
                    <StatusBadge status={c.risk_band} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Attendance</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: c.attendance_pct >= 75 ? '#22c55e' : '#ef4444' }}>
                        {c.attendance_pct}%
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Buffer</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: bufferColor }}>
                        {c.buffer != null ? (c.buffer <= 0 ? `${c.buffer} (Deficit)` : `+${c.buffer}`) : '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Classes</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                        {c.attended} / {c.held}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Risk Score</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                        {c.risk_score?.toFixed?.(1) ?? '—'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: Mentor Notes Timeline */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>
              📝 Mentorship Session Notes
            </h3>
            <span style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
              Audited
            </span>
          </div>

          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
            Log confidential counseling notes, agreed action items, and follow-ups. Every note is stamped with your actor ID.
          </p>

          {notes.length === 0 ? (
            <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              No mentor notes logged yet. Click "+ Add Mentor Note" to create the first record.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {notes.map(n => (
                <div key={n.id} style={{ borderLeft: '3px solid #3b82f6', background: '#f8fafc', padding: '10px 14px', borderRadius: '0 8px 8px 0' }}>
                  <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.5 }}>
                    {n.note}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                    {n.created_at ? new Date(n.created_at).toLocaleString() : 'Recently logged'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Note Modal */}
      {noteModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
        }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: 440, maxWidth: '90%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: '0 0 10px 0' }}>
              Add Mentorship Note
            </h3>
            <form onSubmit={handleAddNote}>
              <textarea
                rows={4}
                required
                placeholder="e.g. Discussed attendance deficit in Data Structures. Student agreed to attend all morning sessions next week."
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1',
                  fontSize: 13, boxSizing: 'border-box', marginBottom: 16,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setNoteModalOpen(false)}
                  style={{
                    background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1',
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addNoteMutation.isPending}
                  style={{
                    background: '#3b82f6', color: '#fff', border: 'none',
                    padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {addNoteMutation.isPending ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
