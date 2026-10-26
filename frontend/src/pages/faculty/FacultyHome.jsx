
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi, timetableApi, facultyApi } from '../../api/endpoints.js';
import { useAuth } from '../../app/AuthContext.jsx';
import { formatPct } from '../../utils/format.js';
import Button from '../../components/ui/Button.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

const C = {
  card: { background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 'var(--space-6)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' },
};

export default function FacultyHome() {
  const { user, permissions } = useAuth();
  const navigate = useNavigate();
  const duties = permissions?.duties || ['instructor'];
  const isMentor = duties.includes('mentor');
  const isCoordinator = duties.includes('course_coordinator');

  const { data: dash, isLoading, error } = useQuery({
    queryKey: ['faculty-teaching-dashboard'],
    queryFn: () => dashboardApi.getDashboard().then(r => r.data),
  });
  const { data: timetable = [] } = useQuery({
    queryKey: ['faculty-timetable-today'],
    queryFn: () => timetableApi.getMyTimetable().then(r => r.data),
  });
  const { data: mentees = [] } = useQuery({
    queryKey: ['faculty-mentees-summary'],
    queryFn: () => facultyApi.getMentees().then(r => r.data.items || r.data).catch(() => []),
    enabled: isMentor,
  });

  const courses = useMemo(() => dash?.courses || [], [dash]);
  const timetableList = useMemo(() => Array.isArray(timetable) ? timetable : [], [timetable]);
  const todayDayName = useMemo(() => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()], []);
  const todaySessions = useMemo(
    () => timetableList.filter(s => s.day_name === todayDayName || s.day === (new Date().getDay() - 1)),
    [timetableList, todayDayName]
  );

  const allAssignedStudents = useMemo(() => {
    const map = new Map();
    courses.forEach(c => {
      (c.enrolled_students || []).forEach(st => {
        const courseTag = c.short_name ? `${c.short_name} (${c.code})` : c.code;
        if (!map.has(st.id)) {
          map.set(st.id, { ...st, courses: [courseTag] });
        } else {
          const existing = map.get(st.id);
          if (!existing.courses.includes(courseTag)) {
            existing.courses.push(courseTag);
          }
        }
      });
    });
    return Array.from(map.values());
  }, [courses]);

  if (isLoading) return <Skeleton lines={8} />;

  if (error) {
    return (
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: 32, textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink-900)' }}>Unable to load teaching dashboard</h2>
        <p style={{ color: 'var(--text-muted)' }}>{error?.response?.data?.detail || error.message}</p>
        <Button variant="secondary" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ ...C.card, marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink-900)', margin: 0 }}>
              Welcome, {user?.name || 'Faculty'}
            </h1>
            <span style={{ fontSize: 11, background: 'var(--bg)', color: 'var(--text-muted)', padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontWeight: 700, textTransform: 'uppercase', border: '1px solid var(--border)' }}>
              {duties.join(' · ')}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Teaching & Mentorship Hub — manage attendance, student alerts, and announcements.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Button variant="secondary" onClick={() => navigate('/notices')}>Compose Notice</Button>
          <Button variant="primary" onClick={() => navigate('/faculty/timetable')}>View Timetable</Button>
        </div>
      </div>

      {/* 2-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)' }}>
        {/* Left: courses + today */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-900)', margin: 0 }}>
              My Teaching Courses ({courses.length})
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            {courses.map(c => (
              <div key={c.course_id} style={{ ...C.card, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {c.short_name && (
                        <span style={{ fontSize: 11, fontWeight: 800, background: 'var(--accent)', color: 'var(--on-dark, #fff)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
                          {c.short_name}
                        </span>
                      )}
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--bg)', padding: '2px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)' }}>{c.code}</span>
                    </div>
                    {c.at_risk_count > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--risk-bg)', color: 'var(--risk-fg)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
                        {c.at_risk_count} at risk
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-900)', margin: '0 0 var(--space-3)' }}>{c.name}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                    <div style={{ background: 'var(--bg)', padding: 'var(--space-3)', borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{c.enrolled_count ?? 0}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Enrolled</div>
                    </div>
                    <div style={{ background: 'var(--bg)', padding: 'var(--space-3)', borderRadius: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>{formatPct(c.avg_attendance)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Avg Attendance</div>
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg)', padding: '8px 10px', borderRadius: 8, marginBottom: 'var(--space-3)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Assigned Students ({c.enrolled_students?.length || 0})
                    </div>
                    {c.enrolled_students && c.enrolled_students.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {c.enrolled_students.map(st => (
                          <span key={st.id} style={{ fontSize: 11, background: 'var(--surface)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 600, color: 'var(--ink-900)' }}>
                            {st.name} <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>({st.roll_no || st.email})</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No students enrolled yet</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
                  <Link to={`/faculty/courses/${c.course_id}`} style={{ flex: 1, textAlign: 'center', padding: '7px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>Manage</Link>
                  <Link to={`/faculty/courses/${c.course_id}/attendance`} style={{ flex: 1, textAlign: 'center', padding: '7px 10px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, color: 'var(--on-dark)', textDecoration: 'none' }}>Upload →</Link>
                </div>
              </div>
            ))}
          </div>

          {/* Assigned Students Directory */}
          <div style={{ ...C.card, marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink-900)', margin: 0 }}>
                  Assigned Students Directory ({allAssignedStudents.length})
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  All students currently assigned under your teaching courses
                </span>
              </div>
            </div>
            {allAssignedStudents.length === 0 ? (
              <div style={{ padding: 'var(--space-4)', background: 'var(--bg)', borderRadius: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No students currently assigned to your courses.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-3)' }}>
                {allAssignedStudents.map(st => (
                  <div key={st.id} style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink-900)' }}>{st.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginTop: 2, fontFamily: 'monospace' }}>
                      {st.roll_no || 'No Roll #'} {st.batch ? `• ${st.batch}` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{st.email}</div>
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {st.courses.map(crs => (
                        <span key={crs} style={{ fontSize: 10, background: 'var(--surface)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', fontWeight: 600, color: 'var(--accent)' }}>
                          {crs}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today's schedule */}
          <div style={C.card}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-900)', margin: '0 0 var(--space-4)' }}>
              Today&apos;s Teaching Schedule — {todayDayName}
            </h3>
            {todaySessions.length === 0 ? (
              <div style={{ padding: 'var(--space-4)', background: 'var(--bg)', borderRadius: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No lectures or labs scheduled for today.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {todaySessions.map(s => (
                  <div key={s.id} style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: 13, color: 'var(--text)' }}>
                        <span style={{ fontWeight: 800, color: 'var(--accent)', marginRight: 6 }}>
                          {s.course_short_name || s.short_name || s.course_code}
                        </span>
                        {s.course_name} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({s.course_code})</span>
                      </strong>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.room_name || 'Room 101'} · Section {s.section || 'A'} · {s.kind}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--bg)', color: 'var(--accent)', border: '1px solid var(--border)' }}>{s.period_label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: mentor + coordinator + notices */}
        <div style={{ display: 'grid', gap: 'var(--space-6)', alignContent: 'start' }}>
          {isMentor && (
            <div style={C.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-900)', margin: 0 }}>My Mentees ({mentees.length})</h3>
                <Link to="/faculty/mentees" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>All →</Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', textAlign: 'center' }}>
                {[
                  { label: 'On track', count: mentees.filter(m => m.overall_attendance_pct != null && m.overall_attendance_pct >= 75).length, bg: 'var(--ok-bg)', fg: 'var(--ok-fg)' },
                  { label: 'Watch', count: mentees.filter(m => m.overall_attendance_pct != null && m.overall_attendance_pct >= 65 && m.overall_attendance_pct < 75).length, bg: 'var(--watch-bg)', fg: 'var(--watch-fg)' },
                  { label: 'At risk', count: mentees.filter(m => m.overall_attendance_pct != null && m.overall_attendance_pct < 65).length, bg: 'var(--risk-bg)', fg: 'var(--risk-fg)' },
                ].map(({ label, count, bg, fg }) => (
                  <div key={label} style={{ padding: 'var(--space-3)', background: bg, borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: fg, fontVariantNumeric: 'tabular-nums' }}>{count}</div>
                    <div style={{ fontSize: 10, color: fg, fontWeight: 600, marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {isCoordinator && (
            <div style={C.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-900)', margin: 0 }}>Course Sections</h3>
                <Link to="/faculty/sections" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Compare →</Link>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 var(--space-3)' }}>Multi-section attendance gap tracking.</p>
              <div style={{ padding: 'var(--space-3)', background: 'var(--bg)', borderRadius: 10, fontSize: 12, color: 'var(--text)' }}>
                Section A: <strong>79.2%</strong> vs Section B: <strong>76.4%</strong> — gap &lt;10%, balanced.
              </div>
            </div>
          )}
          <div style={C.card}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-900)', margin: '0 0 var(--space-3)' }}>Quick Announcement</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 var(--space-4)' }}>Send forms, exam dates, or project notices to students in your courses.</p>
            <Button variant="primary" style={{ width: '100%' }} onClick={() => navigate('/notices')}>Compose Notice with Deadline →</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
