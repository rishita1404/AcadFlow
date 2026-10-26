import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { dashboardApi, timetableApi, facultyApi } from '../../api/endpoints.js';
import { useAuth } from '../../app/AuthContext.jsx';
import { formatPct } from '../../utils/format.js';
import Button from '../../components/ui/Button.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import {
  Users, BookOpen, Search, Calendar,
  AlertTriangle, ArrowUpRight, Megaphone,
  Upload, School, CheckCircle2, Eye, Filter
} from 'lucide-react';

const C = {
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-card)',
    padding: 'var(--space-6)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-card)',
  },
};

export default function FacultyHome({ defaultTab }) {
  const { user, permissions } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const duties = permissions?.duties || ['instructor'];
  const isMentor = duties.includes('mentor');
  const isCoordinator = duties.includes('course_coordinator');

  // URL-driven tabs: ?tab=overview or ?tab=assigned-students
  const urlTab = searchParams.get('tab');
  const [activeMainTab, setActiveMainTab] = useState(
    urlTab || defaultTab || 'overview'
  );

  // Sub-tab for course/class inside Assigned Students: 'all' or course_id
  const urlCourse = searchParams.get('course');
  const [selectedCourseId, setSelectedCourseId] = useState(urlCourse || 'all');

  // Search & Status filters for students
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (urlTab) {
      setActiveMainTab(urlTab);
    } else if (defaultTab) {
      setActiveMainTab(defaultTab);
    }
  }, [urlTab, defaultTab]);

  useEffect(() => {
    if (urlCourse) {
      setSelectedCourseId(urlCourse);
    }
  }, [urlCourse]);

  const handleMainTabChange = (tabKey) => {
    setActiveMainTab(tabKey);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('tab', tabKey);
      return p;
    }, { replace: true });
  };

  const handleCourseTabChange = (cId) => {
    const val = String(cId);
    setSelectedCourseId(val);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      if (val === 'all') {
        p.delete('course');
      } else {
        p.set('course', val);
      }
      return p;
    }, { replace: true });
  };

  // Queries
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

  // Safe memos unconditional call
  const courses = useMemo(() => dash?.courses || [], [dash]);
  const timetableList = useMemo(() => (Array.isArray(timetable) ? timetable : []), [timetable]);
  const todayDayName = useMemo(
    () => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()],
    []
  );
  const todaySessions = useMemo(
    () => timetableList.filter(s => s.day_name === todayDayName || s.day === (new Date().getDay() - 1)),
    [timetableList, todayDayName]
  );

  // Flattened assigned students with course tagging
  const allAssignedStudents = useMemo(() => {
    const list = [];
    courses.forEach(c => {
      const courseShort = c.short_name || c.code;
      (c.enrolled_students || []).forEach(st => {
        list.push({
          ...st,
          course_id: c.course_id,
          course_code: c.code,
          course_name: c.name,
          course_short_name: c.short_name,
          course_display: `${courseShort} — ${c.name}`,
        });
      });
    });
    return list;
  }, [courses]);

  // Unique total student count across all courses
  const uniqueStudentsCount = useMemo(() => {
    const ids = new Set();
    courses.forEach(c => {
      (c.enrolled_students || []).forEach(st => ids.add(st.id));
    });
    return ids.size;
  }, [courses]);

  // Active course object when a specific course tab is selected
  const activeCourse = useMemo(() => {
    if (selectedCourseId === 'all') return null;
    return courses.find(c => String(c.course_id) === String(selectedCourseId)) || null;
  }, [courses, selectedCourseId]);

  // Filtered students for the Assigned Students table
  const displayedStudents = useMemo(() => {
    let baseList = [];
    if (selectedCourseId === 'all') {
      baseList = allAssignedStudents;
    } else if (activeCourse) {
      baseList = (activeCourse.enrolled_students || []).map(st => ({
        ...st,
        course_id: activeCourse.course_id,
        course_code: activeCourse.code,
        course_name: activeCourse.name,
        course_short_name: activeCourse.short_name,
        course_display: `${activeCourse.short_name || activeCourse.code} — ${activeCourse.name}`,
      }));
    }

    return baseList.filter(st => {
      // Search query filter (name, roll_no, email)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (st.name || '').toLowerCase().includes(q);
        const matchesRoll = (st.roll_no || '').toLowerCase().includes(q);
        const matchesEmail = (st.email || '').toLowerCase().includes(q);
        const matchesBatch = (st.batch || '').toLowerCase().includes(q);
        if (!matchesName && !matchesRoll && !matchesEmail && !matchesBatch) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const band = (st.band || '').toLowerCase();
        if (statusFilter === 'safe' && band !== 'safe') return false;
        if (statusFilter === 'watch' && band !== 'watch') return false;
        if (statusFilter === 'risk' && band !== 'at risk' && band !== 'at_risk' && band !== 'critical') return false;
      }

      return true;
    });
  }, [allAssignedStudents, activeCourse, selectedCourseId, searchQuery, statusFilter]);

  // Stats for the active course or all courses
  const stats = useMemo(() => {
    const list = selectedCourseId === 'all'
      ? allAssignedStudents
      : (activeCourse?.enrolled_students || []);

    const total = list.length;
    const safe = list.filter(s => (s.band || '').toLowerCase() === 'safe').length;
    const watch = list.filter(s => (s.band || '').toLowerCase() === 'watch').length;
    const risk = list.filter(s => {
      const b = (s.band || '').toLowerCase();
      return b === 'at risk' || b === 'at_risk' || b === 'critical';
    }).length;

    return { total, safe, watch, risk };
  }, [allAssignedStudents, activeCourse, selectedCourseId]);

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
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 'var(--space-8)' }}>
      {/* Page Header */}
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
            Teaching &amp; Mentorship Hub — manage courses, track assigned students of each class, and upload attendance.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => navigate('/notices')}>
            <Megaphone size={14} style={{ marginRight: 6 }} />
            Compose Notice
          </Button>
          <Button variant="primary" onClick={() => navigate('/faculty/timetable')}>
            <Calendar size={14} style={{ marginRight: 6 }} />
            View Timetable
          </Button>
        </div>
      </div>

      {/* Primary Top Navigation Tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => handleMainTabChange('overview')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 'var(--radius-pill)',
            border: activeMainTab === 'overview' ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: activeMainTab === 'overview' ? 'var(--accent)' : 'var(--surface)',
            color: activeMainTab === 'overview' ? 'var(--on-dark, #fff)' : 'var(--ink-900)',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            boxShadow: activeMainTab === 'overview' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <BookOpen size={16} />
          Overview &amp; Schedule
          <span style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 'var(--radius-pill)',
            background: activeMainTab === 'overview' ? 'rgba(255,255,255,0.22)' : 'var(--bg)',
            color: activeMainTab === 'overview' ? '#fff' : 'var(--text-muted)',
            fontWeight: 800,
          }}>
            {courses.length} Courses
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleMainTabChange('assigned-students')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 'var(--radius-pill)',
            border: activeMainTab === 'assigned-students' ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: activeMainTab === 'assigned-students' ? 'var(--accent)' : 'var(--surface)',
            color: activeMainTab === 'assigned-students' ? 'var(--on-dark, #fff)' : 'var(--ink-900)',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            boxShadow: activeMainTab === 'assigned-students' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <Users size={16} />
          Assigned Students
          <span style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 'var(--radius-pill)',
            background: activeMainTab === 'assigned-students' ? 'rgba(255,255,255,0.22)' : 'var(--accent-subtle, #e0e7ff)',
            color: activeMainTab === 'assigned-students' ? '#fff' : 'var(--accent)',
            fontWeight: 800,
          }}>
            {uniqueStudentsCount} Enrolled
          </span>
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: OVERVIEW & SCHEDULE                                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeMainTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)' }}>
          {/* Left Column: Courses + Timetable */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-900)', margin: 0 }}>
                  My Teaching Courses ({courses.length})
                </h2>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Active classes and assigned sections under your purview
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleMainTabChange('assigned-students')}
              >
                <Users size={14} style={{ marginRight: 6 }} />
                View Assigned Students →
              </Button>
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
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--bg)', padding: '2px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)' }}>
                          {c.code}
                        </span>
                      </div>
                      {c.at_risk_count > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--risk-bg)', color: 'var(--risk-fg)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
                          {c.at_risk_count} at risk
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-900)', margin: '0 0 var(--space-3)' }}>
                      {c.name}
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                      <div style={{ background: 'var(--bg)', padding: 'var(--space-3)', borderRadius: 10, textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                          {c.enrolled_count ?? 0}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Assigned Students</div>
                      </div>
                      <div style={{ background: 'var(--bg)', padding: 'var(--space-3)', borderRadius: 10, textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatPct(c.avg_attendance)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Avg Attendance</div>
                      </div>
                    </div>

                    {/* Quick roster snippet */}
                    <div style={{ background: 'var(--bg)', padding: '8px 10px', borderRadius: 8, marginBottom: 'var(--space-3)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Class Roster ({c.enrolled_students?.length || 0})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCourseId(String(c.course_id));
                            handleMainTabChange('assigned-students');
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 10, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                        >
                          View All →
                        </button>
                      </div>
                      {c.enrolled_students && c.enrolled_students.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {c.enrolled_students.slice(0, 4).map(st => (
                            <span key={st.id} style={{ fontSize: 11, background: 'var(--surface)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 600, color: 'var(--ink-900)' }}>
                              {st.name} <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>({st.roll_no || st.email})</span>
                            </span>
                          ))}
                          {c.enrolled_students.length > 4 && (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 4px' }}>
                              +{c.enrolled_students.length - 4} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No students enrolled yet</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-2)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
                    <Link
                      to={`/faculty/courses/${c.course_id}`}
                      style={{ flex: 1, textAlign: 'center', padding: '7px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}
                    >
                      Manage
                    </Link>
                    <Link
                      to={`/faculty/courses/${c.course_id}/attendance`}
                      style={{ flex: 1, textAlign: 'center', padding: '7px 10px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, color: 'var(--on-dark, #fff)', textDecoration: 'none' }}
                    >
                      Upload Attendance →
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Today's Schedule Card */}
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
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {s.room_name || 'Room 101'} · Section {s.section || 'A'} · {s.kind}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--surface)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
                        {s.period_label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Rail: Mentor + Coordinator + Quick Announcement */}
          <div style={{ display: 'grid', gap: 'var(--space-6)', alignContent: 'start' }}>
            {isMentor && (
              <div style={C.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-900)', margin: 0 }}>
                    My Mentees ({mentees.length})
                  </h3>
                  <Link to="/faculty/mentees" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                    All →
                  </Link>
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
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-900)', margin: 0 }}>
                    Course Sections
                  </h3>
                  <Link to="/faculty/sections" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                    Compare →
                  </Link>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 var(--space-3)' }}>
                  Multi-section attendance gap tracking.
                </p>
                <div style={{ padding: 'var(--space-3)', background: 'var(--bg)', borderRadius: 10, fontSize: 12, color: 'var(--text)' }}>
                  Section A: <strong>79.2%</strong> vs Section B: <strong>76.4%</strong> — gap &lt;10%, balanced.
                </div>
              </div>
            )}

            <div style={C.card}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-900)', margin: '0 0 var(--space-3)' }}>
                Quick Announcement
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 var(--space-4)' }}>
                Broadcast notices, syllabus deadlines, or assignment alerts directly to enrolled classes.
              </p>
              <Button variant="primary" style={{ width: '100%' }} onClick={() => navigate('/notices')}>
                Compose Notice with Deadline →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: ASSIGNED STUDENTS FOR EACH CLASS & COURSE              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeMainTab === 'assigned-students' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Sub-Tabs: Each Course/Class has its own tab */}
          <div style={{ ...C.card, padding: 'var(--space-4) var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Select Course / Class Tab
                </span>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink-900)', margin: '2px 0 0' }}>
                  Roster by Assigned Teaching Course
                </h3>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Showing {stats.total} student record{stats.total === 1 ? '' : 's'}
              </span>
            </div>

            {/* Course Sub-Tab Buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleCourseTabChange('all')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-pill)',
                  border: selectedCourseId === 'all' ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: selectedCourseId === 'all' ? 'var(--accent)' : 'var(--bg)',
                  color: selectedCourseId === 'all' ? 'var(--on-dark, #fff)' : 'var(--ink-900)',
                  fontWeight: selectedCourseId === 'all' ? 700 : 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <School size={14} />
                All Classes &amp; Courses
                <span style={{
                  fontSize: 11,
                  padding: '1px 7px',
                  borderRadius: 'var(--radius-pill)',
                  background: selectedCourseId === 'all' ? 'rgba(255,255,255,0.22)' : 'var(--surface)',
                  color: selectedCourseId === 'all' ? '#fff' : 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  fontWeight: 800,
                }}>
                  {allAssignedStudents.length}
                </span>
              </button>

              {courses.map(c => {
                const isSelected = String(selectedCourseId) === String(c.course_id);
                const count = c.enrolled_students?.length || 0;
                return (
                  <button
                    key={c.course_id}
                    type="button"
                    onClick={() => handleCourseTabChange(c.course_id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-pill)',
                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: isSelected ? 'var(--accent)' : 'var(--bg)',
                      color: isSelected ? 'var(--on-dark, #fff)' : 'var(--ink-900)',
                      fontWeight: isSelected ? 700 : 600,
                      fontSize: 13,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{
                      fontWeight: 800,
                      fontSize: 11,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--surface)',
                      color: isSelected ? '#fff' : 'var(--accent)',
                      border: isSelected ? 'none' : '1px solid var(--border)',
                    }}>
                      {c.short_name || c.code}
                    </span>
                    <span>{c.name}</span>
                    <span style={{
                      fontSize: 11,
                      padding: '1px 7px',
                      borderRadius: 'var(--radius-pill)',
                      background: isSelected ? 'rgba(255,255,255,0.22)' : 'var(--surface)',
                      color: isSelected ? '#fff' : 'var(--text-muted)',
                      border: '1px solid var(--border)',
                      fontWeight: 800,
                    }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Course Banner & Action Toolbar (when a course is selected) */}
          {activeCourse && (
            <div style={{ ...C.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)', background: 'linear-gradient(to right, var(--surface), var(--bg))' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {activeCourse.short_name && (
                    <span style={{ fontSize: 12, fontWeight: 800, background: 'var(--accent)', color: 'var(--on-dark, #fff)', padding: '3px 10px', borderRadius: 'var(--radius-pill)' }}>
                      {activeCourse.short_name}
                    </span>
                  )}
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'var(--surface)', padding: '2px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)' }}>
                    {activeCourse.code}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    · {activeCourse.credits || 4} Credits · {activeCourse.total_classes || 40} Planned Lectures
                  </span>
                </div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-900)', margin: '0 0 4px' }}>
                  {activeCourse.name}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                  Class Roster &amp; Student Attendance Performance
                </p>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/faculty/courses/${activeCourse.course_id}`)}
                >
                  <BookOpen size={14} style={{ marginRight: 6 }} />
                  Course Page
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(`/faculty/courses/${activeCourse.course_id}/attendance`)}
                >
                  <Upload size={14} style={{ marginRight: 6 }} />
                  Upload Attendance →
                </Button>
              </div>
            </div>
          )}

          {/* Metrics summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
            <div style={{ ...C.card, padding: 'var(--space-4)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total In Roster
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink-900)', margin: '4px 0 2px', fontVariantNumeric: 'tabular-nums' }}>
                {stats.total}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Assigned to this class</div>
            </div>

            <div style={{ ...C.card, padding: 'var(--space-4)', textAlign: 'center', background: 'var(--ok-bg)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ok-fg)', textTransform: 'uppercase' }}>
                Safe (≥75%)
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ok-fg)', margin: '4px 0 2px', fontVariantNumeric: 'tabular-nums' }}>
                {stats.safe}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ok-fg)', opacity: 0.85 }}>Regular attendance</div>
            </div>

            <div style={{ ...C.card, padding: 'var(--space-4)', textAlign: 'center', background: 'var(--watch-bg)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--watch-fg)', textTransform: 'uppercase' }}>
                Watch (65-74%)
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--watch-fg)', margin: '4px 0 2px', fontVariantNumeric: 'tabular-nums' }}>
                {stats.watch}
              </div>
              <div style={{ fontSize: 11, color: 'var(--watch-fg)', opacity: 0.85 }}>Borderline threshold</div>
            </div>

            <div style={{ ...C.card, padding: 'var(--space-4)', textAlign: 'center', background: 'var(--risk-bg)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--risk-fg)', textTransform: 'uppercase' }}>
                At Risk (&lt;65%)
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--risk-fg)', margin: '4px 0 2px', fontVariantNumeric: 'tabular-nums' }}>
                {stats.risk}
              </div>
              <div style={{ fontSize: 11, color: 'var(--risk-fg)', opacity: 0.85 }}>Needs urgent action</div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div style={{ ...C.card, padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search assigned student by name, roll no, email, or batch..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  fontSize: 13,
                  color: 'var(--ink-900)',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginRight: 4 }}>
                <Filter size={13} /> Status:
              </span>
              {[
                { id: 'all', label: 'All' },
                { id: 'safe', label: 'Safe (≥75%)' },
                { id: 'watch', label: 'Watch (65-74%)' },
                { id: 'risk', label: 'At Risk (<65%)' },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-pill)',
                    border: statusFilter === f.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: statusFilter === f.id ? 'var(--accent)' : 'var(--surface)',
                    color: statusFilter === f.id ? 'var(--on-dark, #fff)' : 'var(--text)',
                    fontSize: 12,
                    fontWeight: statusFilter === f.id ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assigned Students Roster Table */}
          <div style={{ ...C.card, padding: 0, overflow: 'hidden' }}>
            {displayedStudents.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-900)', margin: '0 0 6px' }}>
                  No assigned students found
                </h4>
                <p style={{ fontSize: 13, margin: 0 }}>
                  {searchQuery || statusFilter !== 'all'
                    ? 'No students matched the active search or filter criteria.'
                    : 'No students are currently enrolled in this course.'}
                </p>
                {(searchQuery || statusFilter !== 'all') && (
                  <Button
                    variant="secondary"
                    size="sm"
                    style={{ marginTop: 14 }}
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 18px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Student
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Roll No
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Batch / Class
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Course
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Classes Attended
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 140 }}>
                        Attendance %
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Status
                      </th>
                      <th style={{ padding: '12px 18px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedStudents.map((st, idx) => {
                      const pct = st.attendance_pct != null ? st.attendance_pct : 0;
                      const isHigh = pct >= 75;
                      const isMid = pct >= 65 && pct < 75;
                      const progressColor = isHigh
                        ? 'var(--ok-fg, #15803d)'
                        : isMid
                        ? 'var(--watch-fg, #b45309)'
                        : 'var(--risk-fg, #b91c1c)';

                      // Initials avatar
                      const initials = (st.name || 'ST')
                        .split(' ')
                        .map(n => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                      return (
                        <tr
                          key={`${st.id}-${st.course_id}-${idx}`}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          {/* Student Info */}
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{
                                width: 34,
                                height: 34,
                                borderRadius: '50%',
                                background: 'var(--accent)',
                                color: 'var(--on-dark, #fff)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: 12,
                                flexShrink: 0,
                              }}>
                                {initials}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--ink-900)' }}>
                                  {st.name}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                                  {st.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Roll No */}
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              fontSize: 12,
                              color: 'var(--ink-900)',
                              background: 'var(--bg)',
                              padding: '3px 8px',
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                            }}>
                              {st.roll_no || 'N/A'}
                            </span>
                          </td>

                          {/* Batch */}
                          <td style={{ padding: '14px 16px', color: 'var(--text)' }}>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>
                              {st.batch || 'Batch A'}
                            </span>
                          </td>

                          {/* Course Short Name & Code */}
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {st.course_short_name && (
                                <span style={{
                                  fontWeight: 800,
                                  fontSize: 11,
                                  padding: '2px 7px',
                                  borderRadius: 'var(--radius-pill)',
                                  background: 'var(--accent)',
                                  color: 'var(--on-dark, #fff)',
                                }}>
                                  {st.course_short_name}
                                </span>
                              )}
                              <span style={{
                                fontWeight: 600,
                                fontSize: 11,
                                color: 'var(--text-muted)',
                              }}>
                                {st.course_code}
                              </span>
                            </div>
                          </td>

                          {/* Classes Held / Attended */}
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>
                              {st.attended ?? 0} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>/ {st.held ?? 0}</span>
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              attended sessions
                            </div>
                          </td>

                          {/* Attendance Progress Bar */}
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                flex: 1,
                                height: 6,
                                background: 'var(--bg)',
                                borderRadius: 3,
                                overflow: 'hidden',
                                border: '1px solid var(--border)',
                              }}>
                                <div style={{
                                  width: `${Math.min(100, Math.max(0, pct))}%`,
                                  height: '100%',
                                  background: progressColor,
                                  borderRadius: 3,
                                  transition: 'width 0.3s ease',
                                }} />
                              </div>
                              <span style={{
                                fontWeight: 800,
                                fontSize: 12,
                                color: progressColor,
                                minWidth: 42,
                                textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                              }}>
                                {formatPct(pct)}
                              </span>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td style={{ padding: '14px 16px' }}>
                            <StatusBadge band={st.band} size="sm" />
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <Link
                                to={`/faculty/courses/${st.course_id}/attendance`}
                                title="Upload / Mark Attendance"
                                style={{
                                  padding: '5px 10px',
                                  background: 'var(--bg)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-pill)',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: 'var(--ink-900)',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Upload size={12} />
                                Attendance
                              </Link>
                              <Link
                                to={`/notices?target=${encodeURIComponent(st.email)}`}
                                title="Send Notice to Student"
                                style={{
                                  padding: '5px 10px',
                                  background: 'var(--surface)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-pill)',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: 'var(--accent)',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Megaphone size={12} />
                                Notice
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
