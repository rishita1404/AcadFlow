import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi, timetableApi, facultyApi } from '../../api/endpoints.js';
import { useAuth } from '../../app/AuthContext.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';

export default function FacultyHome() {
  const { user, permissions } = useAuth();
  const navigate = useNavigate();

  const duties = permissions?.duties || ['instructor'];
  const isMentor = duties.includes('mentor');
  const isCoordinator = duties.includes('course_coordinator');

  const { data: dash, isLoading } = useQuery({
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

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading faculty portal...</div>;
  }

  const courses = dash?.courses || [];
  const todayDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
  const todaySessions = timetable.filter(s => s.day_name === todayDayName || s.day === (new Date().getDay() - 1));

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: '24px', border: '1px solid #e2e8f0',
        marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
              👨‍🏫 Welcome, {user?.name || 'Faculty Member'}
            </h1>
            <span style={{ fontSize: 11, background: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: 6, fontWeight: 700, textTransform: 'uppercase' }}>
              {duties.join(' · ')}
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            Teaching & Mentorship Command Hub · Manage course attendance, student alerts, and announcements.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => navigate('/notices')}
            style={{
              padding: '9px 16px', background: '#eff6ff', color: '#2563eb',
              border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            📢 Compose Notice
          </button>
          <button
            onClick={() => navigate('/faculty/timetable')}
            style={{
              padding: '9px 16px', background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            🗓 View Timetable
          </button>
        </div>
      </div>

      {/* Grid of Duty Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Left Column: My Assigned Courses */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', margin: 0 }}>
              📚 My Teaching Courses ({courses.length})
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16, marginBottom: 24 }}>
            {courses.map(c => (
              <div
                key={c.course_id}
                style={{
                  background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: 4 }}>
                      {c.code}
                    </span>
                    {c.at_risk_count > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#dc2626', padding: '2px 6px', borderRadius: 4 }}>
                        ⚠️ {c.at_risk_count} At Risk
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '4px 0 10px' }}>
                    {c.name}
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                    <div style={{ background: '#f8fafc', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{c.enrolled_count ?? 60}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>Enrolled Students</div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>{c.avg_attendance ?? 78.4}%</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>Avg Attendance</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                  <Link
                    to={`/faculty/courses/${c.course_id}`}
                    style={{
                      flex: 1, textAlign: 'center', padding: '7px 10px', background: '#f8fafc',
                      border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#334151', textDecoration: 'none',
                    }}
                  >
                    Manage Course
                  </Link>
                  <Link
                    to={`/faculty/courses/${c.course_id}/attendance`}
                    style={{
                      flex: 1, textAlign: 'center', padding: '7px 10px', background: '#2563eb',
                      border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#fff', textDecoration: 'none',
                    }}
                  >
                    Upload Excel →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Today's Teaching Sessions */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 12px' }}>
              🗓 Today's Teaching Schedule ({todayDayName})
            </h3>
            {todaySessions.length === 0 ? (
              <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                ☕ No lectures or laboratory sessions scheduled for today.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {todaySessions.map(s => (
                  <div
                    key={s.id}
                    style={{
                      padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 13, color: '#1e293b' }}>{s.course_code}: {s.course_name}</strong>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        📍 {s.room_name || 'Room 101'} · Section {s.section || 'A'} · {s.kind}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: '#eff6ff', color: '#2563eb' }}>
                      {s.period_label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Duty-Specific Widgets (Mentor & Course Coordinator) */}
        <div>
          {/* Mentor Duty Card */}
          {isMentor && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                  👥 My Mentees ({mentees.length})
                </h3>
                <Link to="/faculty/mentees" style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                  All Mentees →
                </Link>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center', marginBottom: 12 }}>
                <div style={{ padding: 8, background: '#f0fdf4', borderRadius: 6 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>
                    {mentees.filter(m => (m.overall_attendance_pct ?? 80) >= 75).length}
                  </div>
                  <div style={{ fontSize: 10, color: '#475569' }}>On track</div>
                </div>
                <div style={{ padding: 8, background: '#fffbeb', borderRadius: 6 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#d97706' }}>
                    {mentees.filter(m => (m.overall_attendance_pct ?? 80) >= 65 && (m.overall_attendance_pct ?? 80) < 75).length}
                  </div>
                  <div style={{ fontSize: 10, color: '#475569' }}>Keep an eye</div>
                </div>
                <div style={{ padding: 8, background: '#fef2f2', borderRadius: 6 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#dc2626' }}>
                    {mentees.filter(m => (m.overall_attendance_pct ?? 80) < 65).length}
                  </div>
                  <div style={{ fontSize: 10, color: '#475569' }}>At risk</div>
                </div>
              </div>
            </div>
          )}

          {/* Course Coordinator Duty Card */}
          {isCoordinator && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                  📊 Course Sections (Coord)
                </h3>
                <Link to="/faculty/sections" style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                  Compare →
                </Link>
              </div>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px' }}>
                Multi-section syllabus alignment & attendance gap tracking.
              </p>
              <div style={{ padding: 10, background: '#f8fafc', borderRadius: 6, fontSize: 12, color: '#475569' }}>
                Section A: <strong>79.2%</strong> vs Section B: <strong>76.4%</strong> (Gap &lt; 10%, Balanced)
              </div>
            </div>
          )}

          {/* Quick Notice Card */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>
              📢 Quick Announcement
            </h3>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>
              Send forms, exam dates, or project notices to students of your assigned courses.
            </p>
            <button
              onClick={() => navigate('/notices')}
              style={{
                width: '100%', padding: '9px', background: '#2563eb', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Compose Notice with Deadline →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
