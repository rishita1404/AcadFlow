
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi, tasksApi, timetableApi, noticeApi } from '../../api/endpoints.js';
import { useAuth } from '../../app/AuthContext.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import CourseCard from '../../components/CourseCard.jsx';
import { Skeleton, ErrorState } from '../../components/ui/Skeleton.jsx';
import Button from '../../components/ui/Button.jsx';
import { Calendar, AlertTriangle } from 'lucide-react';

export default function StudentHome() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: dash, isLoading, error } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => dashboardApi.getDashboard().then(r => r.data),
  });

  const { data: warnings = [] } = useQuery({
    queryKey: ['student-warnings'],
    queryFn: () => dashboardApi.getWarnings().then(r => r.data),
    refetchInterval: 60_000,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['student-tasks-home'],
    queryFn: () => tasksApi.getMyTasks(7).then(r => r.data),
  });

  const { data: timetable = [] } = useQuery({
    queryKey: ['student-timetable-home'],
    queryFn: () => timetableApi.getMyTimetable().then(r => r.data),
  });

  const { data: notices = [] } = useQuery({
    queryKey: ['student-notices-home'],
    queryFn: () => noticeApi.getMyNotices().then(r => r.data).catch(() => []),
  });

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
        <Skeleton lines={2} />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)' }}>
          <Skeleton lines={6} />
          <Skeleton lines={4} />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error?.response?.data?.detail || error.message} retry={() => window.location.reload()} />;
  }

  const courses = dash?.courses || [];
  let worstBand = 'Safe';
  for (const c of courses) {
    if (c.risk_band === 'Critical') { worstBand = 'Critical'; break; }
    if (c.risk_band === 'At risk') { worstBand = 'At risk'; }
    else if (c.risk_band === 'Watch' && worstBand !== 'At risk') { worstBand = 'Watch'; }
  }

  const unreadNoticesCount = notices.filter(n => !n.seen).length;
  const todayDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
  const todayClasses = timetable.filter(s => s.day_name === todayDayName || s.day === (new Date().getDay() - 1));

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto' }}>
      {/* Header card */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-card)',
        padding: 'var(--space-6)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
        marginBottom: 'var(--space-6)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <h1 style={{
              fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600,
              color: 'var(--ink-900)', margin: 0,
            }}>
              Welcome back, {dash?.name?.split(' ')[0] || user?.name?.split(' ')[0]}
            </h1>
            <StatusBadge band={worstBand} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Roll No: <strong style={{ color: 'var(--text)' }}>{dash?.roll_no || '—'}</strong>
            {' · '}{dash?.total_courses ?? courses.length} courses enrolled
            {' · '}Overall: <strong style={{ color: 'var(--text)' }}>{dash?.overall_attendance_pct != null ? `${dash.overall_attendance_pct}%` : 'N/A'}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Button variant="secondary" size="sm" icon={<Calendar size={14} />} onClick={() => navigate('/student/calendar')}>
            Leave Planner
          </Button>
          <Button variant="primary" size="sm" icon={<AlertTriangle size={14} />} onClick={() => navigate('/student/risk')}>
            Risk Details
          </Button>
        </div>
      </div>

      {/* Warning banners */}
      {warnings.length > 0 && (
        <div style={{ marginBottom: 'var(--space-6)', display: 'grid', gap: 'var(--space-3)' }}>
          {warnings.slice(0, 2).map((w, idx) => {
            const isDanger = w.severity === 'critical' || w.severity === 'high';
            return (
              <div
                key={idx}
                style={{
                  background: isDanger ? 'var(--crit-bg)' : 'var(--watch-bg)',
                  border: `1px solid ${isDanger ? 'var(--crit-fg)' : 'var(--border)'}`,
                  borderLeft: `4px solid ${isDanger ? 'var(--crit-fg)' : 'var(--must-attend)'}`,
                  borderRadius: 'var(--radius-card)',
                  padding: 'var(--space-4) var(--space-6)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)',
                }}
              >
                <div>
                  <strong style={{ color: isDanger ? 'var(--crit-fg)' : 'var(--must-attend)', fontSize: 14 }}>
                    {w.title}
                  </strong>
                  <div style={{ color: isDanger ? 'var(--crit-fg)' : 'var(--text)', fontSize: 13, marginTop: 4, opacity: 0.85 }}>
                    {w.message}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Link to="/student/risk" style={linkStyle}>View Risk</Link>
                  <Link to="/student/calendar" style={linkStyle}>Open Planner</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)' }}>
        {/* Left: courses + today */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-900)', margin: 0 }}>
              Course Attendance & Buffer
            </h2>
            <Link to="/student/calendar" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
              Simulate Absence →
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            {courses.map(c => <CourseCard key={c.course_id} course={c} />)}
          </div>

          {/* Today's classes */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 'var(--space-6)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-900)', margin: 0 }}>
                Today&apos;s Classes — {todayDayName}
              </h3>
              <Link to="/student/timetable" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                Full Timetable →
              </Link>
            </div>
            {todayClasses.length === 0 ? (
              <div style={{ padding: 'var(--space-4)', background: 'var(--bg)', borderRadius: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No classes scheduled for today
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {todayClasses.map(s => (
                  <div key={s.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: 'var(--space-3) var(--space-4)', background: 'var(--bg)',
                    borderRadius: 12, border: '1px solid var(--border)',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                        {s.course_code}: {s.course_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {s.room_name || 'Room 101'} · {s.teacher_name} · Section {s.section || 'A'}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--bg)', color: 'var(--accent)',
                      border: '1px solid var(--border)',
                    }}>
                      {s.period_label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: tasks + pressure + notices */}
        <div style={{ display: 'grid', gap: 'var(--space-6)', alignContent: 'start' }}>
          {/* Due this week */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 'var(--space-6)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-900)', margin: 0 }}>Due This Week</h3>
              <Link to="/student/tasks" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>View All →</Link>
            </div>
            {tasks.length === 0 ? (
              <div style={{ padding: 'var(--space-4)', background: 'var(--ok-bg)', borderRadius: 12, textAlign: 'center', color: 'var(--ok-fg)', fontSize: 13, fontWeight: 600 }}>
                All caught up! No assignments due this week.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {tasks.slice(0, 4).map(t => (
                  <div key={t.id} style={{
                    padding: 'var(--space-3)', background: 'var(--bg)',
                    borderRadius: 12, border: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {t.course_code} · Due {t.due_at?.slice(0, 10)}
                      </div>
                    </div>
                    {t.submitted ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ok-fg)', background: 'var(--ok-bg)', padding: '3px 10px', borderRadius: 'var(--radius-pill)' }}>
                        Submitted
                      </span>
                    ) : (
                      <button onClick={() => navigate(`/student/assignments/${t.id}`)} style={{
                        padding: '4px 12px', background: 'var(--accent)', color: 'var(--on-dark)',
                        border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}>
                        Submit
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pressure forecast placeholder */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 'var(--space-6)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-900)', margin: 0 }}>Pressure Forecast</h3>
              <Link to="/student/calendar" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Heatmap →</Link>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 var(--space-4)' }}>
              Academic load based on deadlines & class density:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)', textAlign: 'center' }}>
              {[
                { week: 'W1', level: 'Low', bg: 'var(--heat-0)', color: 'var(--text)' },
                { week: 'W2', level: 'Med', bg: 'var(--heat-1)', color: 'var(--text)' },
                { week: 'W3', level: 'High', bg: 'var(--heat-2)', color: 'var(--on-dark)' },
                { week: 'W4', level: 'Low', bg: 'var(--heat-0)', color: 'var(--text)' },
              ].map(w => (
                <div key={w.week} style={{ padding: 'var(--space-3) var(--space-2)', background: w.bg, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: w.color, opacity: 0.7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{w.week}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: w.color, marginTop: 2 }}>{w.level}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Notices strip */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 'var(--space-6)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-900)', margin: 0 }}>Notices</h3>
              {unreadNoticesCount > 0 && (
                <span style={{ fontSize: 11, background: 'var(--crit-fg)', color: 'var(--on-dark)', padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 700 }}>
                  {unreadNoticesCount} new
                </span>
              )}
            </div>
            {notices.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-4)' }}>
                No active announcements
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                {notices.slice(0, 3).map(n => (
                  <div
                    key={n.id}
                    onClick={() => navigate('/student/notices')}
                    style={{
                      padding: 'var(--space-3)', background: n.urgent ? 'var(--crit-bg)' : 'var(--bg)',
                      borderRadius: 12, border: `1px solid ${n.urgent ? 'var(--crit-fg)' : 'var(--border)'}`,
                      cursor: 'pointer',
                      borderLeft: n.urgent ? '3px solid var(--crit-fg)' : '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>{n.title}</span>
                      {n.urgent && <span style={{ fontSize: 10, color: 'var(--crit-fg)', fontWeight: 700 }}>URGENT</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {n.sender_name} · {n.created_at?.slice(0, 10)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const linkStyle = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-pill)', padding: '4px 12px',
  fontSize: 12, fontWeight: 600, color: 'var(--text)', textDecoration: 'none',
};
