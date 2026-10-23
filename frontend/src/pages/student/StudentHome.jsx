import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi, tasksApi, timetableApi, noticeApi } from '../../api/endpoints.js';
import { useAuth } from '../../app/AuthContext.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import CourseCard from '../../components/CourseCard.jsx';
import ScoreExpander from '../../components/ScoreExpander.jsx';

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
      <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <p>Loading your academic radar...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 20, borderRadius: 10, color: '#dc2626' }}>
        <strong>Error loading dashboard:</strong> {error?.response?.data?.detail || error.message}
      </div>
    );
  }

  // Determine worst course status
  const courses = dash?.courses || [];
  let worstBand = 'Safe';
  let worstScore = 0;
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
      {/* Top Header Card */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: '24px', border: '1px solid #e2e8f0',
        marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
              Welcome back, {dash?.name?.split(' ')[0] || user?.name?.split(' ')[0]} 👋
            </h1>
            <StatusBadge status={worstBand} />
          </div>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            Roll No: <strong>{dash?.roll_no || '26CSE000'}</strong> · {dash?.total_courses ?? courses.length} Courses Enrolled · Overall Attendance: <strong>{dash?.overall_attendance_pct != null ? `${dash.overall_attendance_pct}%` : 'N/A'}</strong>
          </p>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
            Overall status reflects worst course condition. Last computed: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => navigate('/student/calendar')}
            style={{
              padding: '9px 16px', background: '#eff6ff', color: '#2563eb',
              border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            📅 Leave Planner
          </button>
          <button
            onClick={() => navigate('/student/risk')}
            style={{
              padding: '9px 16px', background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            ⚠️ Risk Details
          </button>
        </div>
      </div>

      {/* Warning Banner (Shown for Watch, At risk, or Critical) */}
      {warnings.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {warnings.slice(0, 2).map((w, idx) => {
            const isDanger = w.severity === 'critical' || w.severity === 'high';
            return (
              <div
                key={idx}
                style={{
                  background: isDanger ? '#fef2f2' : '#fffbeb',
                  border: `1px solid ${isDanger ? '#fca5a5' : '#fde68a'}`,
                  borderRadius: 10,
                  padding: '14px 18px',
                  marginBottom: 10,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 22 }}>{isDanger ? '🚨' : '⚠️'}</span>
                  <div>
                    <strong style={{ color: isDanger ? '#b91c1c' : '#92400e', fontSize: 14 }}>
                      {w.title}
                    </strong>
                    <div style={{ color: isDanger ? '#991b1b' : '#78350f', fontSize: 13, marginTop: 2 }}>
                      {w.message}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Link
                    to="/student/risk"
                    style={{
                      background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6,
                      padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#334151', textDecoration: 'none',
                    }}
                  >
                    View Risk
                  </Link>
                  <Link
                    to="/student/calendar"
                    style={{
                      background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6,
                      padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#334151', textDecoration: 'none',
                    }}
                  >
                    Open Planner
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Multi-Column Desktop Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Left Column: Courses + Timetable */}
        <div>
          {/* Course Cards Grid */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', margin: 0 }}>
              📚 Course Attendance & Buffer Gauges
            </h2>
            <Link to="/student/calendar" style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
              Simulate Absence →
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
            {courses.map(c => (
              <CourseCard key={c.course_id} course={c} />
            ))}
          </div>

          {/* Today's Classes */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                🗓 Today's Classes ({todayDayName})
              </h3>
              <Link to="/student/timetable" style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                Full Timetable →
              </Link>
            </div>

            {todayClasses.length === 0 ? (
              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 8, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                ☕ No classes scheduled for today!
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {todayClasses.map(s => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                        {s.course_code}: {s.course_name}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        📍 {s.room_name || 'Room 101'} · 👨‍🏫 {s.teacher_name} · Section {s.section || 'A'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        background: '#eff6ff', color: '#2563eb',
                      }}>
                        {s.period_label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Deadlines Due + Mini Pressure + Notices */}
        <div>
          {/* Due This Week Strip */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                📋 Due This Week
              </h3>
              <Link to="/student/tasks" style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                View All Tasks →
              </Link>
            </div>

            {tasks.length === 0 ? (
              <div style={{ padding: '20px', background: '#f0fdf4', borderRadius: 8, textAlign: 'center', color: '#16a34a', fontSize: 13 }}>
                ✅ All caught up! No assignments due this week.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {tasks.slice(0, 4).map(t => (
                  <div
                    key={t.id}
                    style={{
                      padding: '12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                        {t.title}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {t.course_code} · Due: {t.due_at?.slice(0, 10)}
                      </div>
                    </div>
                    <div>
                      {t.submitted ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '3px 8px', borderRadius: 4 }}>
                          Submitted
                        </span>
                      ) : (
                        <button
                          onClick={() => navigate(`/student/assignments/${t.id}`)}
                          style={{
                            padding: '4px 10px', background: '#2563eb', color: '#fff',
                            border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          Submit →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4-Week Mini Pressure Forecast Strip */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                📈 Pressure Forecast
              </h3>
              <Link to="/student/calendar" style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                Calendar Heatmap →
              </Link>
            </div>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>
              Academic pressure load based on deadlines & class density:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
              {[
                { week: 'Week 1', level: 'Low', color: '#16a34a', bg: '#f0fdf4' },
                { week: 'Week 2', level: 'Med', color: '#d97706', bg: '#fffbeb' },
                { week: 'Week 3', level: 'High', color: '#dc2626', bg: '#fef2f2' },
                { week: 'Week 4', level: 'Low', color: '#16a34a', bg: '#f0fdf4' },
              ].map(w => (
                <div key={w.week} style={{ padding: '8px 4px', background: w.bg, borderRadius: 6, border: `1px solid ${w.color}33` }}>
                  <div style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>{w.week}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: w.color, marginTop: 2 }}>{w.level}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Important Notices Strip */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                📢 Important Notices
              </h3>
              {unreadNoticesCount > 0 && (
                <span style={{ fontSize: 11, background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: 9999, fontWeight: 700 }}>
                  {unreadNoticesCount} new
                </span>
              )}
            </div>

            {notices.length === 0 ? (
              <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 12 }}>
                No active announcements
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {notices.slice(0, 3).map(n => (
                  <div
                    key={n.id}
                    onClick={() => navigate('/student/notices')}
                    style={{
                      padding: '10px 12px', background: n.urgent ? '#fef2f2' : '#f8fafc',
                      borderRadius: 8, border: `1px solid ${n.urgent ? '#fca5a5' : '#e2e8f0'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>
                        {n.title}
                      </span>
                      {n.urgent && (
                        <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>
                          URGENT
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
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
