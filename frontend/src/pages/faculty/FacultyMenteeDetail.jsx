import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facultyApi } from '../../api/endpoints.js';
import { formatPct } from '../../utils/format.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

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
      <div style={{ maxWidth: 640, margin: '60px auto', background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 32, textAlign: 'center', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🛡️</div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, color: 'var(--ink-900)', margin: '0 0 8px 0' }}>
          {is403 ? 'Access Restricted (Scope 403)' : 'Mentee Not Found'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
          {is403
            ? 'This student is not assigned to your mentorship cohort. Mentorship records are strictly scoped to designated faculty mentors.'
            : 'Unable to retrieve records for the requested student.'}
        </p>
        <Link
          to="/faculty/mentees"
          style={{
            background: 'var(--accent)', color: 'var(--on-dark)', padding: '10px 24px', borderRadius: 'var(--radius-pill)',
            fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}
        >
          ← Return to My Mentees
        </Link>
      </div>
    );
  }

  if (menteeLoading || coursesLoading) {
    return (
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <Skeleton height={100} style={{ marginBottom: 20 }} />
        <Skeleton height={350} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40, color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          <Link to="/faculty/home" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Home</Link>
          {' '}/ <Link to="/faculty/mentees" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Mentees</Link>
          {' '}/ {mentee?.name}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
              {mentee?.name}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              Roll No: {mentee?.roll_no} · Email: {mentee?.email} · Overall Attendance: <strong>{formatPct(mentee?.overall_attendance_pct)}</strong>
            </p>
          </div>
          <button
            onClick={() => setNoteModalOpen(true)}
            style={{
              background: 'var(--accent)', color: 'var(--on-dark)', border: 'none',
              padding: '10px 20px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600,
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
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 14 }}>
            Multi-Course Academic Standing
          </h2>

          <div style={{ display: 'grid', gap: 14 }}>
            {courses.map(c => {
              const bufferColor = c.buffer == null ? 'var(--text-muted)' : c.buffer <= 0 ? 'var(--crit-fg)' : c.buffer <= 2 ? 'var(--watch-fg)' : 'var(--ok-fg)';
              return (
                <div key={c.course_id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 18, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)' }}>
                        {c.course_code}
                      </span>
                      <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', marginTop: 4 }}>
                        {c.course_name}
                      </h3>
                    </div>
                    <StatusBadge status={c.risk_band} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, background: 'var(--bg)', padding: 12, borderRadius: 'var(--radius-input)', border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Attendance</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: c.attendance_pct != null && c.attendance_pct >= 75 ? 'var(--ok-fg)' : 'var(--crit-fg)' }}>
                        {formatPct(c.attendance_pct)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Buffer</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: bufferColor }}>
                        {c.buffer != null ? (c.buffer <= 0 ? `${c.buffer} (Deficit)` : `+${c.buffer}`) : '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Classes</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>
                        {c.attended} / {c.held}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Risk Score</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>
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
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
              Mentorship Session Notes
            </h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 600, border: '1px solid var(--border)' }}>
              Audited
            </span>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Log confidential counseling notes, agreed action items, and follow-ups. Every note is stamped with your actor ID.
          </p>

          {notes.length === 0 ? (
            <div style={{ background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-input)', padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No mentor notes logged yet. Click &quot;+ Add Mentor Note&quot; to create the first record.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {notes.map(n => (
                <div key={n.id} style={{ borderLeft: '3px solid var(--accent)', background: 'var(--bg)', padding: '10px 14px', borderRadius: '0 var(--radius-input) var(--radius-input) 0', border: '1px solid var(--border)', borderLeftColor: 'var(--accent)' }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                    {n.note}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
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
          position: 'fixed', inset: 0, background: 'rgba(13,27,42,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
        }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-dialog)', padding: 24, width: 440, maxWidth: '90%', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', margin: '0 0 10px 0' }}>
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
                  width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', marginBottom: 16, fontFamily: 'var(--font-sans)',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setNoteModalOpen(false)}
                  style={{
                    background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
                    padding: '8px 16px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addNoteMutation.isPending}
                  style={{
                    background: 'var(--accent)', color: 'var(--on-dark)', border: 'none',
                    padding: '8px 20px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
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
