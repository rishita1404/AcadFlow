import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, studentApi } from '../../api/endpoints.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { Calendar, CalendarDays, BookOpen, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';

export default function StudentAttendance() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: dash, isLoading, error } = useQuery({
    queryKey: ['student-dashboard-attendance'],
    queryFn: () => dashboardApi.getDashboard().then(r => r.data),
  });

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <Skeleton height={120} style={{ marginBottom: 20 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} height={220} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32, textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)' }}>
        <AlertCircle size={32} color="var(--crit-fg)" style={{ marginBottom: 12 }} />
        <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink-900)' }}>Failed to load attendance data</h2>
        <p style={{ color: 'var(--text-muted)' }}>{error?.response?.data?.detail || error.message}</p>
      </div>
    );
  }

  const courses = dash?.courses || [];
  const overallPct = dash?.overall_attendance_pct != null ? Number(dash.overall_attendance_pct).toFixed(1) : '—';
  const safeCount = courses.filter(c => c.risk_band === 'Safe').length;
  const watchCount = courses.filter(c => c.risk_band === 'Watch').length;
  const atRiskCount = courses.filter(c => c.risk_band === 'At risk' || c.risk_band === 'Critical').length;

  const filteredCourses = courses.filter(c =>
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', color: 'var(--text)' }}>
      {/* Header Banner */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-card)',
        padding: '24px 28px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{
                background: 'var(--bg)', padding: '6px 10px', borderRadius: 'var(--radius-pill)',
                fontSize: 12, fontWeight: 700, color: 'var(--accent)', border: '1px solid var(--border)',
              }}>
                Semester 5 (2026) · July 1 – Dec 15
              </span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
              Subject Attendance & Leave Planner
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, maxWidth: 680 }}>
              View attendance records for each subject. Click any subject to open its filtered calendar, check past held lectures, and simulate planned leaves specifically for that subject.
            </p>
          </div>

          <button
            onClick={() => navigate('/student/calendar')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
              borderRadius: 'var(--radius-pill)', background: 'var(--accent)', color: 'var(--on-dark)',
              border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--shadow-card)',
            }}
          >
            <CalendarDays size={16} /> Open Full Calendar
          </button>
        </div>

        {/* Quick Stats Bar */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 20,
          paddingTop: 16, borderTop: '1px solid var(--border)',
        }}>
          <div style={{ background: 'var(--bg)', padding: '12px 16px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Overall Attendance</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: Number(overallPct) >= 75 ? 'var(--ok-fg)' : 'var(--crit-fg)', marginTop: 2 }}>
              {overallPct}%
            </div>
          </div>
          <div style={{ background: 'var(--bg)', padding: '12px 16px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Enrolled Subjects</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-900)', marginTop: 2 }}>
              {courses.length}
            </div>
          </div>
          <div style={{ background: 'var(--bg)', padding: '12px 16px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Safe Subjects</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ok-fg)', marginTop: 2 }}>
              {safeCount}
            </div>
          </div>
          <div style={{ background: 'var(--bg)', padding: '12px 16px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Watch / At-Risk</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: atRiskCount > 0 ? 'var(--crit-fg)' : 'var(--watch-fg)', marginTop: 2 }}>
              {watchCount + atRiskCount}
            </div>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <input
          type="text"
          placeholder="Filter by subject code or title (e.g. AIML501, DSA)..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            minWidth: 320, padding: '10px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)',
            background: 'var(--surface)', color: 'var(--text)', fontSize: 13, outline: 'none',
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Showing {filteredCourses.length} of {courses.length} subjects
        </span>
      </div>

      {/* Subject Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
        {filteredCourses.map(course => {
          const pct = course.attendance_pct != null ? Number(course.attendance_pct).toFixed(1) : '—';
          const isSafe = Number(pct) >= 75;
          const pctNum = Number(pct) || 0;
          const buffer = course.buffer != null ? course.buffer : 0;

          return (
            <div
              key={course.course_id}
              style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--border)',
                padding: '20px 22px',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
            >
              <div>
                {/* Top Row: Code + Status Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.04em' }}>
                      {course.code}
                    </span>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 700, color: 'var(--ink-900)', margin: '4px 0 0' }}>
                      {course.name}
                    </h3>
                  </div>
                  <StatusBadge band={course.risk_band} />
                </div>

                {/* Percentage & Ratio */}
                <div style={{
                  display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 16,
                  padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-input)',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: isSafe ? 'var(--ok-fg)' : 'var(--crit-fg)', lineHeight: 1 }}>
                    {pct}%
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    <div><strong style={{ color: 'var(--text)' }}>{course.attended}</strong> attended of <strong style={{ color: 'var(--text)' }}>{course.held}</strong> held</div>
                    <div style={{ fontSize: 11 }}>Planned semester classes: {course.total_classes}</div>
                  </div>
                </div>

                {/* Progress bar with 75% threshold marker */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>0%</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>75% Target</span>
                    <span>100%</span>
                  </div>
                  <div style={{ position: 'relative', width: '100%', height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, Math.max(0, pctNum))}%`,
                        background: isSafe ? 'var(--ok-fg)' : 'var(--crit-fg)',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>

                {/* Buffer Message */}
                <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {buffer >= 0 ? (
                    <>
                      <CheckCircle size={14} color="var(--ok-fg)" />
                      <span>
                        Buffer: <strong style={{ color: 'var(--ok-fg)' }}>+{buffer}</strong> {buffer === 1 ? 'class' : 'classes'} can still be missed.
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={14} color="var(--crit-fg)" />
                      <span>
                        Buffer: <strong style={{ color: 'var(--crit-fg)' }}>{buffer}</strong> classes. Needs {Math.abs(buffer)} more classes to reach 75%.
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => navigate(`/student/calendar?course_id=${course.course_id}&course_code=${course.code}`)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '8px 12px', background: 'var(--accent)', color: 'var(--on-dark)',
                    border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Calendar size={13} /> View Calendar
                </button>

                <button
                  onClick={() => navigate(`/student/calendar?course_id=${course.course_id}&course_code=${course.code}&plan=1`)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '8px 12px', background: 'var(--bg)', color: 'var(--text)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Plan Leaves →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
