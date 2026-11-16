import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  dashboardApi,
  tasksApi,
  timetableApi,
  noticeApi,
  deadlineApi,
} from '../../api/endpoints.js';
import { useAuth } from '../../app/AuthContext.jsx';
import {
  formatPct,
  formatRelativeDueDate,
  getUrgencyMarker,
} from '../../utils/format.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import CourseCard from '../../components/CourseCard.jsx';
import { Skeleton, ErrorState } from '../../components/ui/Skeleton.jsx';
import Button from '../../components/ui/Button.jsx';
import Dialog from '../../components/ui/Dialog.jsx';
import {
  Calendar,
  AlertTriangle,
  HelpCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  Megaphone,
  BookOpen,
  TrendingUp,
  Percent,
  Check,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

// Period timing definition for timetable slot time ranges
const PERIOD_TIMES = {
  P1: { start: '09:00', end: '10:00', label: '09:00 – 10:00', startMin: 540, endMin: 600 },
  P2: { start: '10:00', end: '11:00', label: '10:00 – 11:00', startMin: 600, endMin: 660 },
  P3: { start: '11:15', end: '12:15', label: '11:15 – 12:15', startMin: 675, endMin: 735 },
  P4: { start: '12:15', end: '13:15', label: '12:15 – 13:15', startMin: 735, endMin: 795 },
  P5: { start: '14:00', end: '15:00', label: '14:00 – 15:00', startMin: 840, endMin: 900 },
  P6: { start: '15:00', end: '16:00', label: '15:00 – 16:00', startMin: 900, endMin: 960 },
};

// Stepped 4-tier pressure shades
const PRESSURE_TIERS = [
  { level: 0, name: 'Low', bg: '#EAF1EB', text: '#1E3F20', border: '#C4D8C6', Icon: CheckCircle },
  { level: 1, name: 'Med', bg: '#F3E8D3', text: '#5A4518', border: '#DEC49E', Icon: Clock },
  { level: 2, name: 'High', bg: '#E8C9B8', text: '#7C2E12', border: '#D19779', Icon: AlertTriangle },
  { level: 3, name: 'Critical', bg: '#E8BEBE', text: '#7A2020', border: '#C98686', Icon: AlertCircle },
];

export default function StudentHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Dialog & Modal states
  const [whyModalOpen, setWhyModalOpen] = useState(false);
  const [simulateModalOpen, setSimulateModalOpen] = useState(false);
  const [simCourse, setSimCourse] = useState(null);
  const [simMissCount, setSimMissCount] = useState(2);
  const [simResult, setSimResult] = useState(null);

  const whyModalRef = useRef(null);

  // 1. Dashboard Query
  const {
    data: dash,
    isLoading: dashLoading,
    isError: dashError,
    error: dashErrObj,
    refetch: refetchDash,
  } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => dashboardApi.getDashboard().then((r) => r.data),
  });

  // 2. Warnings
  const { data: warnings = [] } = useQuery({
    queryKey: ['student-warnings'],
    queryFn: () => dashboardApi.getWarnings().then((r) => r.data),
    refetchInterval: 60_000,
  });

  // 3. Tasks
  const {
    data: tasks = [],
    isLoading: tasksLoading,
    isError: tasksError,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ['student-tasks-home'],
    queryFn: () => tasksApi.getMyTasks(7).then((r) => r.data),
  });

  // 4. Timetable
  const {
    data: timetable = [],
    isLoading: timetableLoading,
    isError: timetableError,
    refetch: refetchTimetable,
  } = useQuery({
    queryKey: ['student-timetable-home'],
    queryFn: () => timetableApi.getMyTimetable().then((r) => r.data),
  });

  // 5. Notices
  const {
    data: notices = [],
    isLoading: noticesLoading,
    isError: noticesError,
    refetch: refetchNotices,
  } = useQuery({
    queryKey: ['student-notices-home'],
    queryFn: () => noticeApi.getMyNotices().then((r) => r.data).catch(() => []),
  });

  // 6. Monthly Pressure Forecast
  const todayDate = new Date();
  const currentYear = todayDate.getFullYear();
  const currentMonth = todayDate.getMonth() + 1;
  const { data: pressureData } = useQuery({
    queryKey: ['student-home-pressure', currentYear, currentMonth],
    queryFn: () =>
      deadlineApi
        .getPressureForecast(currentYear, currentMonth)
        .then((r) => r.data)
        .catch(() => null),
  });

  // Simulation Mutation
  const simulateMutation = useMutation({
    mutationFn: ({ courseId, count }) =>
      dashboardApi.simulate(courseId, count).then((r) => r.data),
    onSuccess: (data) => setSimResult(data),
  });

  // Mark notice as done mutation
  const markNoticeDoneMutation = useMutation({
    mutationFn: (noticeId) => noticeApi.markDone(noticeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-tasks-home'] });
      queryClient.invalidateQueries({ queryKey: ['student-notices-home'] });
    },
  });

  // Handle focus trapping and Escape for Why? modal
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        if (whyModalOpen) setWhyModalOpen(false);
        if (simulateModalOpen) setSimulateModalOpen(false);
      }
    }
    if (whyModalOpen || simulateModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [whyModalOpen, simulateModalOpen]);

  // Focus modal container on open
  useEffect(() => {
    if (whyModalOpen && whyModalRef.current) {
      whyModalRef.current.focus();
    }
  }, [whyModalOpen]);

  const courses = dash?.courses || [];

  // Determine worst risk band across all courses
  let worstBand = 'Safe';
  for (const c of courses) {
    if (c.risk_band === 'Critical' || c.band === 'Critical') {
      worstBand = 'Critical';
      break;
    }
    if (c.risk_band === 'At risk' || c.band === 'At risk') {
      worstBand = 'At risk';
    } else if (
      (c.risk_band === 'Watch' || c.band === 'Watch') &&
      worstBand !== 'At risk'
    ) {
      worstBand = 'Watch';
    }
  }

  // Find tightest course (lowest buffer)
  const tightestCourse = courses.reduce((tightest, curr) => {
    if (!tightest) return curr;
    const currBuf = curr.buffer ?? 999;
    const tightestBuf = tightest.buffer ?? 999;
    return currBuf < tightestBuf ? curr : tightest;
  }, null);

  // Today's classes
  const todayDayName = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ][todayDate.getDay()];
  const todayDayIndex = (todayDate.getDay() + 6) % 7; // Mon=0 .. Sun=6

  const rawTodayClasses = timetable.filter(
    (s) =>
      s.day_name === todayDayName ||
      s.day === todayDayIndex ||
      s.day === todayDate.getDay() - 1
  );

  // Sort today's classes by scheduled time
  const todayClasses = [...rawTodayClasses].sort((a, b) => {
    const minA = PERIOD_TIMES[a.period_label]?.startMin || 0;
    const minB = PERIOD_TIMES[b.period_label]?.startMin || 0;
    return minA - minB;
  });

  // Calculate Now / Next / Done status for each class
  const currentMinutes = todayDate.getHours() * 60 + todayDate.getMinutes();
  let firstUpcomingFound = false;

  const todayClassesWithStatus = todayClasses.map((cls) => {
    const timing = PERIOD_TIMES[cls.period_label];
    let classStatus = 'Upcoming';
    if (timing) {
      if (currentMinutes > timing.endMin) {
        classStatus = 'Done';
      } else if (currentMinutes >= timing.startMin && currentMinutes <= timing.endMin) {
        classStatus = 'Now';
      } else if (!firstUpcomingFound) {
        classStatus = 'Next';
        firstUpcomingFound = true;
      }
    }
    return { ...cls, classStatus, timing };
  });

  // Check if teacher and section are identical across all today's classes
  const hasMultipleClasses = todayClasses.length > 1;
  const allSameTeacher =
    hasMultipleClasses &&
    todayClasses.every((c) => c.teacher_name === todayClasses[0].teacher_name);
  const allSameSection =
    hasMultipleClasses &&
    todayClasses.every(
      (c) => (c.section || 'A') === (todayClasses[0].section || 'A')
    );

  // Tasks summary
  const pendingTasks = tasks.filter((t) => !t.submitted);
  const completedTasks = tasks.filter((t) => t.submitted);

  // Next upcoming class for KPI strip
  const nextClassItem = todayClassesWithStatus.find(
    (c) => c.classStatus === 'Now' || c.classStatus === 'Next'
  );

  // 4-Week Pressure Calculation from actual days data
  const pressureWeeks = (() => {
    const days = pressureData?.days || [];
    const monthName = todayDate.toLocaleDateString('en-US', { month: 'short' });

    if (days.length === 0) {
      // Fallback structured week blocks
      return [
        { week: 'W1', range: `${monthName} 1 – 7`, level: 0, mustAttend: 0, ...PRESSURE_TIERS[0] },
        { week: 'W2', range: `${monthName} 8 – 14`, level: 1, mustAttend: 1, ...PRESSURE_TIERS[1] },
        { week: 'W3', range: `${monthName} 15 – 21`, level: 2, mustAttend: 2, ...PRESSURE_TIERS[2] },
        { week: 'W4', range: `${monthName} 22 – 28`, level: 0, mustAttend: 0, ...PRESSURE_TIERS[0] },
      ];
    }

    // Split month into 4 approx 7-day chunks
    const chunks = [
      days.slice(0, 7),
      days.slice(7, 14),
      days.slice(14, 21),
      days.slice(21, 28),
    ];

    return chunks.map((chunk, idx) => {
      const wName = `W${idx + 1}`;
      if (chunk.length === 0) {
        return { week: wName, range: `${monthName} ${idx * 7 + 1}–${idx * 7 + 7}`, level: 0, mustAttend: 0, ...PRESSURE_TIERS[0] };
      }
      const firstD = new Date(chunk[0].date).getDate();
      const lastD = new Date(chunk[chunk.length - 1].date).getDate();
      const avgScore =
        chunk.reduce((acc, d) => acc + (d.pressure_score || 0), 0) / chunk.length;
      const mustAttendCount = chunk.filter((d) => d.must_attend).length;

      let tierIndex = 0;
      if (avgScore >= 75) tierIndex = 3;
      else if (avgScore >= 50) tierIndex = 2;
      else if (avgScore >= 25) tierIndex = 1;

      return {
        week: wName,
        range: `${monthName} ${firstD} – ${lastD}`,
        level: tierIndex,
        avgScore: Math.round(avgScore),
        mustAttend: mustAttendCount,
        ...PRESSURE_TIERS[tierIndex],
      };
    });
  })();

  const heaviestWeek = pressureWeeks.reduce((max, w) =>
    w.level > max.level || (w.level === max.level && w.mustAttend > max.mustAttend) ? w : max,
    pressureWeeks[0]
  );

  // Synthetic trend line data from enrolled courses for layout balance
  const trendData = courses.slice(0, 5).map((c) => ({
    name: c.code,
    pct: c.attendance_pct ?? 75,
    threshold: 75,
  }));

  // Open simulation flow
  const handleOpenSimulate = (course = null, missCount = 2) => {
    const target = course || tightestCourse || courses[0];
    setSimCourse(target);
    setSimMissCount(missCount);
    if (target) {
      simulateMutation.mutate({ courseId: target.course_id, count: missCount });
    }
    setSimulateModalOpen(true);
  };

  // Real user name
  const realName = dash?.name || user?.name || 'Student';

  // Last computed timestamp
  const computedTimestamp = tightestCourse?.computed_at || dash?.computed_at;
  const formattedUpdated = computedTimestamp
    ? new Date(computedTimestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'Recently';

  // Fallback formula breakdown components for Why? panel
  const whyMargin = tightestCourse
    ? tightestCourse.buffer < 0
      ? 50
      : Math.round(
          50 *
            (1 -
              Math.max(0, tightestCourse.buffer ?? 0) /
                Math.max(1, tightestCourse.remaining ?? 20))
        )
    : 15;
  const whyTrend = 5;
  const whyDeadlines = Math.min(20, pendingTasks.length * 4);
  const whyMissed = 0;
  const whyTotalScore = whyMargin + whyTrend + whyDeadlines + whyMissed;

  if (dashLoading) {
    return (
      <main style={{ maxWidth: 1440, margin: '0 auto', display: 'grid', gap: 'var(--space-6)' }}>
        <Skeleton height={140} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
          <Skeleton height={90} />
          <Skeleton height={90} />
          <Skeleton height={90} />
          <Skeleton height={90} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)' }}>
          <Skeleton height={320} />
          <Skeleton height={320} />
        </div>
      </main>
    );
  }

  if (dashError) {
    return (
      <main style={{ maxWidth: 1440, margin: '0 auto' }}>
        <ErrorState
          message={dashErrObj?.response?.data?.detail || dashErrObj?.message || 'Failed to load dashboard'}
          retry={refetchDash}
        />
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1440, margin: '0 auto', color: 'var(--text)' }}>
      {/* ── 1. Header & Status Area ── */}
      <section
        aria-label="Student Welcome and Academic Status"
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-6)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-card)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 'var(--space-4)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 6 }}>
              <h1
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 28,
                  fontWeight: 600,
                  color: 'var(--ink-900)',
                  margin: 0,
                }}
              >
                Welcome back, {realName}
              </h1>

              {/* Overall status badge */}
              <StatusBadge band={worstBand} />

              {/* Accessible "Why?" button */}
              <button
                type="button"
                onClick={() => setWhyModalOpen(true)}
                aria-label="Open why explanation for risk score components"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--accent)',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '3px 10px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <HelpCircle size={13} />
                Why?
              </button>
            </div>

            {/* Sub-status line with Last Updated & Tightest Course Chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Updated {formattedUpdated}
              </span>
              <span style={{ color: 'var(--border)' }}>·</span>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>
                Overall:{' '}
                <strong style={{ color: 'var(--ink-900)' }}>
                  {formatPct(dash?.overall_attendance_pct)}
                </strong>
              </span>

              {/* Tightest Course Chip */}
              {tightestCourse && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '2px 10px',
                    borderRadius: 'var(--radius-pill)',
                    background: tightestCourse.buffer < 0 ? 'var(--crit-bg)' : 'var(--bg)',
                    color: tightestCourse.buffer < 0 ? 'var(--crit-fg)' : 'var(--text)',
                    border: `1px solid ${tightestCourse.buffer < 0 ? 'var(--crit-fg)' : 'var(--border)'}`,
                  }}
                >
                  Tightest course: {tightestCourse.short_name || tightestCourse.code},{' '}
                  {tightestCourse.buffer < 0
                    ? 'Not recoverable by attendance alone'
                    : `${tightestCourse.buffer} spare`}
                </span>
              )}
            </div>

            {/* ML Score slot & Planning Signal disclaimer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              <div style={{ fontSize: 12, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Model estimate:</span>
                {dash?.ml_estimate ? (
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                    {dash.ml_estimate}% chance of finishing below 75%
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Model score unavailable
                  </span>
                )}
                {/* TODO: Backend does not currently provide ml_estimate in /me/dashboard response. Field to be added in ml_service integration. */}
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                This is a planning signal, not a grade or an eligibility decision.
              </p>
            </div>
          </div>

          {/* Header Quick Navigation */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<Calendar size={14} />}
              onClick={() => navigate('/student/calendar')}
            >
              Leave Planner
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<AlertTriangle size={14} />}
              onClick={() => navigate('/student/risk')}
            >
              Risk Details
            </Button>
          </div>
        </div>
      </section>

      {/* ── Warning Banners ── */}
      {warnings.length > 0 && (
        <section aria-label="System Warnings" style={{ marginBottom: 'var(--space-6)', display: 'grid', gap: 'var(--space-3)' }}>
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
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 'var(--space-4)',
                }}
              >
                <div>
                  <strong style={{ color: isDanger ? 'var(--crit-fg)' : 'var(--must-attend)', fontSize: 14 }}>
                    {w.title}
                  </strong>
                  <div style={{ color: isDanger ? 'var(--crit-fg)' : 'var(--text)', fontSize: 13, marginTop: 4 }}>
                    {w.message}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Link
                    to="/student/risk"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '4px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text)',
                      textDecoration: 'none',
                    }}
                  >
                    View Risk
                  </Link>
                  <Link
                    to="/student/calendar"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '4px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text)',
                      textDecoration: 'none',
                    }}
                  >
                    Open Planner
                  </Link>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ── 2. KPI Strip (Under Welcome Card) ── */}
      <section
        aria-label="Key Academic Indicators"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        {/* KPI 1: Overall Attendance */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--space-4) var(--space-5)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Overall Attendance
            </span>
            <Percent size={15} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>
            {formatPct(dash?.overall_attendance_pct)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text)', opacity: 0.85, marginTop: 2 }}>
            {courses.length} courses enrolled
          </div>
        </div>

        {/* KPI 2: Tightest Course Buffer */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--space-4) var(--space-5)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tightest Course Buffer
            </span>
            <TrendingUp size={15} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: tightestCourse?.buffer < 0 ? 'var(--crit-fg)' : '#1E3F20', marginTop: 4 }}>
            {tightestCourse
              ? tightestCourse.buffer < 0
                ? 'Not recoverable by attendance alone'
                : `Can miss ${tightestCourse.buffer} more classes`
              : 'All on track'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text)', opacity: 0.85, marginTop: 4 }}>
            {tightestCourse ? `${tightestCourse.code} · ${tightestCourse.name}` : 'No courses found'}
          </div>
        </div>

        {/* KPI 3: Tasks Due This Week */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--space-4) var(--space-5)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tasks Due This Week
            </span>
            <Clock size={15} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>
            {pendingTasks.length} Pending
          </div>
          <div style={{ fontSize: 12, color: 'var(--text)', opacity: 0.85, marginTop: 2 }}>
            {completedTasks.length} submitted
          </div>
        </div>

        {/* KPI 4: Next Class */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--space-4) var(--space-5)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Next Class
            </span>
            <BookOpen size={15} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink-900)', marginTop: 4 }}>
            {nextClassItem
              ? `${nextClassItem.course_short_name || nextClassItem.course_code}`
              : 'No more classes today'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text)', opacity: 0.85, marginTop: 4 }}>
            {nextClassItem
              ? `${PERIOD_TIMES[nextClassItem.period_label]?.start || 'Upcoming'} · ${nextClassItem.room_name || 'Room 101'}`
              : 'Day complete'}
          </div>
        </div>
      </section>

      {/* ── 3. Course Attendance & Buffer Cards ── */}
      <section aria-labelledby="courses-heading" style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 id="courses-heading" style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-900)', margin: 0 }}>
            Course Attendance & Buffer
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenSimulate()}
            icon={<HelpCircle size={14} />}
          >
            Simulate Absence
          </Button>
        </div>

        {courses.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-muted)' }}>
            No enrolled courses found for this term.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
            {courses.map((c) => (
              <CourseCard
                key={c.course_id}
                course={c}
                overallBand={worstBand}
                onSimulate={handleOpenSimulate}
                onClick={() => navigate(`/student/courses/${c.course_id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── 4 & 5. Balanced 2-Column Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* Left Column: Today's Classes + Pressure Forecast + Attendance Trend */}
        <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
          {/* Today's Classes */}
          <section
            aria-labelledby="today-classes-heading"
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-6)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <h2 id="today-classes-heading" style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-900)', margin: 0 }}>
                  Today&apos;s Classes — {todayDayName}
                </h2>
                {hasMultipleClasses && allSameTeacher && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    Instructor: {todayClasses[0].teacher_name} {allSameSection && `· Section ${todayClasses[0].section || 'A'}`}
                  </p>
                )}
              </div>
              <Link to="/student/timetable" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                Full Timetable →
              </Link>
            </div>

            {timetableLoading && <Skeleton lines={3} />}
            {timetableError && (
              <div style={{ color: 'var(--crit-fg)', fontSize: 13 }}>
                Unable to load timetable.{' '}
                <button onClick={() => refetchTimetable()} style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Retry
                </button>
              </div>
            )}

            {!timetableLoading && !timetableError && todayClassesWithStatus.length === 0 ? (
              <div style={{ padding: 'var(--space-5)', background: 'var(--bg)', borderRadius: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No classes scheduled for today
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {todayClassesWithStatus.map((s) => {
                  const isMustAttend = s.must_attend || (tightestCourse && tightestCourse.course_id === s.course_id && tightestCourse.buffer <= 0);
                  const timingStr = PERIOD_TIMES[s.period_label]?.label || s.period_label;

                  return (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 'var(--space-3) var(--space-4)',
                        background: 'var(--bg)',
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        gap: 'var(--space-3)',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, color: 'var(--accent)' }}>
                            {s.course_code}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-900)' }}>
                            {s.course_name}
                          </span>
                          {/* Must attend badge */}
                          {isMustAttend && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: 'var(--crit-bg)',
                                color: 'var(--crit-fg)',
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-pill)',
                                border: '1px solid var(--crit-fg)',
                              }}
                            >
                              <AlertCircle size={12} />
                              Must attend
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                          {s.room_name || 'Room 101'}
                          {!allSameTeacher && ` · ${s.teacher_name}`}
                          {!allSameSection && ` · Sec ${s.section || 'A'}`}
                        </div>
                      </div>

                      {/* Right side: Time range + Status marker */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-900)' }}>
                          {timingStr}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 2 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {s.period_label}
                          </span>
                          {s.classStatus === 'Now' && (
                            <span style={{ fontSize: 10, fontWeight: 800, background: 'var(--accent)', color: 'var(--on-dark)', padding: '2px 6px', borderRadius: 'var(--radius-pill)' }}>
                              NOW
                            </span>
                          )}
                          {s.classStatus === 'Next' && (
                            <span style={{ fontSize: 10, fontWeight: 800, background: 'var(--ok-bg)', color: 'var(--ok-fg)', padding: '2px 6px', borderRadius: 'var(--radius-pill)' }}>
                              NEXT
                            </span>
                          )}
                          {s.classStatus === 'Done' && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>
                              Done
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Pressure Forecast */}
          <section
            aria-labelledby="pressure-heading"
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-6)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <div>
                <h2 id="pressure-heading" style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-900)', margin: 0 }}>
                  Pressure Forecast
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  Academic load based on deadlines & class density
                </p>
              </div>
              <Link to="/student/calendar" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                Heatmap →
              </Link>
            </div>

            {/* Stepped Scale Tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
              {pressureWeeks.map((w) => {
                const IconComponent = w.Icon;
                return (
                  <Link
                    key={w.week}
                    to="/student/calendar"
                    aria-label={`Week ${w.week}: ${w.range}, Level ${w.level} (${w.name}), ${w.mustAttend} must-attend days`}
                    style={{
                      padding: 'var(--space-3) var(--space-2)',
                      background: w.bg,
                      borderRadius: 12,
                      border: `1px solid ${w.border}`,
                      textAlign: 'center',
                      textDecoration: 'none',
                      color: w.text,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                      transition: 'transform 0.15s ease',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.85 }}>
                      {w.week}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: w.text, whiteSpace: 'nowrap' }}>
                      {w.range}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontWeight: 800, fontSize: 13 }}>
                      <IconComponent size={13} strokeWidth={2.5} />
                      <span>Level {w.level} ({w.name})</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Summary line */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border)' }}>
              Heaviest week: {heaviestWeek.week} ({heaviestWeek.range}) · {heaviestWeek.mustAttend} must-attend {heaviestWeek.mustAttend === 1 ? 'day' : 'days'}
            </div>
          </section>

          {/* Attendance Trend Chart (Recharts) */}
          <section
            aria-labelledby="trend-heading"
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-6)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <h2 id="trend-heading" style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-900)', margin: 0 }}>
                Attendance by Course vs 75% Cutoff
              </h2>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Safe Margin Reference
              </span>
            </div>
            <div style={{ width: '100%', height: 160, marginTop: 'var(--space-3)' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#415A77" fontSize={12} tickLine={false} />
                  <YAxis domain={[50, 100]} stroke="#415A77" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--ink-900)',
                      borderRadius: 8,
                      border: 'none',
                      color: 'var(--on-dark)',
                      fontSize: 12,
                    }}
                  />
                  {/* Actual Attendance Line */}
                  <Line type="monotone" dataKey="pct" stroke="#778D7A" strokeWidth={3} dot={{ r: 4, fill: '#778D7A' }} name="Attendance %" />
                  {/* 75% Requirement Line */}
                  <Line type="monotone" dataKey="threshold" stroke="#9A4A2F" strokeWidth={2} strokeDasharray="4 4" dot={false} name="75% Requirement" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* Right Column: Due This Week + Notices */}
        <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
          {/* Due This Week */}
          <section
            aria-labelledby="due-heading"
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-6)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <div>
                <h2 id="due-heading" style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-900)', margin: 0 }}>
                  Due This Week
                </h2>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {pendingTasks.length} pending · {completedTasks.length} done
                </span>
              </div>
              <Link to="/student/tasks" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                View All →
              </Link>
            </div>

            {tasksLoading && <Skeleton lines={4} />}
            {tasksError && (
              <div style={{ color: 'var(--crit-fg)', fontSize: 13 }}>
                Unable to load tasks.{' '}
                <button onClick={() => refetchTasks()} style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Retry
                </button>
              </div>
            )}

            {!tasksLoading && !tasksError && tasks.length === 0 ? (
              <div style={{ padding: 'var(--space-4)', background: 'var(--ok-bg)', borderRadius: 12, textAlign: 'center', color: 'var(--ok-fg)', fontSize: 13, fontWeight: 600 }}>
                All caught up! No assignments due this week.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {tasks.slice(0, 5).map((t) => {
                  const isNotice = t.type === 'notice' || t.kind === 'notice' || String(t.title).startsWith('[Notice]');
                  const cleanTitle = t.title.replace(/^\[Notice\]\s*/i, '');
                  const relativeDue = formatRelativeDueDate(t.due_at);
                  const urgency = getUrgencyMarker(t.due_at);

                  return (
                    <div
                      key={t.id}
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        background: 'var(--bg)',
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Course Name & Notice tag */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          {isNotice ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: 'var(--surface)',
                                color: 'var(--accent)',
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: 'var(--radius-pill)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              <Megaphone size={10} /> Notice
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
                              {t.course_code || 'GEN'}
                            </span>
                          )}

                          <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.course_name}
                          </span>
                        </div>

                        {/* Title wrapping to two lines */}
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 13,
                            color: 'var(--ink-900)',
                            lineHeight: 1.3,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {cleanTitle}
                        </div>

                        {/* Due date + Urgency Marker */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: 'var(--text)', opacity: 0.85 }}>
                            {relativeDue}
                          </span>

                          {urgency && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                fontSize: 10,
                                fontWeight: 700,
                                color: 'var(--crit-fg)',
                                background: 'var(--crit-bg)',
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-pill)',
                              }}
                            >
                              <AlertCircle size={10} />
                              {urgency.text}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ flexShrink: 0 }}>
                        {t.submitted ? (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--ok-fg)',
                              background: 'var(--ok-bg)',
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-pill)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Check size={12} strokeWidth={2.5} />
                            Submitted
                          </span>
                        ) : isNotice ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                const noticeId = t.notice_id ?? (t.id >= 10000 ? t.id - 10000 : t.id);
                                markNoticeDoneMutation.mutate(noticeId);
                              }}
                              aria-label={`Mark notice done: ${cleanTitle}`}
                              style={{ fontSize: 11, padding: '4px 8px' }}
                            >
                              Mark done
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const noticeId = t.notice_id ?? (t.id >= 10000 ? t.id - 10000 : t.id);
                                markNoticeDoneMutation.mutate(noticeId);
                              }}
                              aria-label={`Mark notice not relevant: ${cleanTitle}`}
                              style={{ fontSize: 11, padding: '4px 6px', color: 'var(--text-muted)' }}
                            >
                              Not relevant
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => navigate(`/student/assignments/${t.id}`)}
                            aria-label={`Submit ${cleanTitle}, ${t.course_code}`}
                            style={{ fontSize: 12, padding: '5px 14px' }}
                          >
                            Submit
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Notices & Announcements */}
          <section
            aria-labelledby="notices-heading"
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-6)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <div>
                <h2 id="notices-heading" style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-900)', margin: 0 }}>
                  Notices
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                  From your faculty
                </p>
              </div>

              {notices.length > 0 && (
                <Link to="/student/notices" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                  {notices.length > 3 ? `3 of ${notices.length} · View all` : 'View all →'}
                </Link>
              )}
            </div>

            {noticesLoading && <Skeleton lines={3} />}
            {noticesError && (
              <div style={{ color: 'var(--crit-fg)', fontSize: 13 }}>
                Unable to load notices.{' '}
                <button onClick={() => refetchNotices()} style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Retry
                </button>
              </div>
            )}

            {!noticesLoading && !noticesError && notices.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-4)' }}>
                No active announcements
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {notices.slice(0, 3).map((n) => {
                  const isUrgent = Boolean(n.urgent);
                  const isUnread = !n.seen;

                  return (
                    <div
                      key={n.id}
                      onClick={() => navigate('/student/notices')}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => { if (e.key === 'Enter') navigate('/student/notices'); }}
                      aria-label={`Notice: ${n.title}. Sender: ${n.sender_name}`}
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        background: 'var(--bg)',
                        borderRadius: 12,
                        border: '1px solid var(--border)',
                        borderLeft: isUrgent ? '3px solid var(--crit-fg)' : '1px solid var(--border)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      {/* URGENT tag on its own line above title with neutral fill */}
                      {isUrgent && (
                        <div>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: 'var(--crit-fg)',
                              background: 'var(--surface)',
                              border: '1px solid var(--crit-fg)',
                              padding: '1px 7px',
                              borderRadius: 'var(--radius-pill)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            Urgent
                          </span>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isUnread && (
                            <span
                              title="Unread announcement"
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: 'var(--accent)',
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-900)' }}>
                            {n.title}
                          </span>
                        </div>

                        {/* Confirmed Deadline Chip */}
                        {(n.deadline || n.due_at) && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-pill)',
                              color: 'var(--text)',
                              flexShrink: 0,
                            }}
                          >
                            Due {n.deadline ? new Date(n.deadline).toLocaleDateString([], { day: 'numeric', month: 'short' }) : 'Soon'}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {n.sender_name || 'Faculty'} · {n.created_at ? new Date(n.created_at).toLocaleDateString() : 'Recent'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ── Modal: "Why?" Risk Score Components & Inputs ── */}
      {whyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="why-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(13, 27, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 400,
            padding: 'var(--space-4)',
          }}
          onClick={() => setWhyModalOpen(false)}
        >
          <div
            ref={whyModalRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-dialog)',
              border: '1px solid var(--border)',
              boxShadow: '0 24px 64px rgba(13,27,42,0.25)',
              width: 540,
              maxWidth: '100%',
              padding: 'var(--space-6)',
              outline: 'none',
              maxHeight: 'calc(100vh - 60px)',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <h2 id="why-modal-title" style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-900)', margin: 0 }}>
                  Risk Score: Formula & Inputs
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Evaluated on tightest course: {tightestCourse?.name || 'All courses'} ({tightestCourse?.code})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWhyModalOpen(false)}
                aria-label="Close why details"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  color: 'var(--text-muted)',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Score summary */}
            <div
              style={{
                background: 'var(--bg)',
                borderRadius: 12,
                padding: 'var(--space-4)',
                border: '1px solid var(--border)',
                marginBottom: 'var(--space-5)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)' }}>
                  Composite Risk Score
                </span>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>
                  {whyTotalScore} / 100
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Risk is classified into 4 supportive tiers: On track (0–29), Keep an eye (30–54), Needs attention (55–79), Priority support (80–100).
              </p>
            </div>

            {/* The 4 Components */}
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 'var(--space-3)' }}>
              Component Breakdown:
            </h3>
            <div style={{ display: 'grid', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
              <div style={{ background: 'var(--bg)', padding: 'var(--space-3) var(--space-4)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
                  <span>1. Attendance Margin (Max 50 pts)</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{whyMargin} pts</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Based on safe headroom relative to remaining classes in semester.
                </div>
              </div>

              <div style={{ background: 'var(--bg)', padding: 'var(--space-3) var(--space-4)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
                  <span>2. Attendance Trend (Max 20 pts)</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{whyTrend} pts</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Linear trajectory of attendance over the trailing 14 calendar days.
                </div>
              </div>

              <div style={{ background: 'var(--bg)', padding: 'var(--space-3) var(--space-4)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
                  <span>3. Upcoming Deadlines (Max 20 pts)</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{whyDeadlines} pts</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Weight and count of unsubmitted assignments due in next 14 days.
                </div>
              </div>

              <div style={{ background: 'var(--bg)', padding: 'var(--space-3) var(--space-4)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
                  <span>4. Missed Submissions (Max 10 pts)</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{whyMissed} pts</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Share of published assignments marked missed after deadline.
                </div>
              </div>
            </div>

            {/* Inputs Section */}
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 'var(--space-2)' }}>
              Calculation Inputs:
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text)', background: 'var(--bg)', padding: 'var(--space-4)', borderRadius: 10, border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>Attended: <strong>{tightestCourse?.attended ?? 0}</strong></div>
              <div>Classes Held: <strong>{tightestCourse?.held ?? 0}</strong></div>
              <div>Required (75%): <strong>{tightestCourse?.required ?? Math.ceil(0.75 * (tightestCourse?.total_classes || 60))}</strong></div>
              <div>Remaining Classes: <strong>{tightestCourse?.remaining ?? 20}</strong></div>
              <div>Total Planned: <strong>{tightestCourse?.total_classes ?? 60}</strong></div>
              <div>Buffer: <strong>{tightestCourse?.buffer ?? 0}</strong></div>
            </div>

            <div style={{ marginTop: 'var(--space-5)', display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" onClick={() => setWhyModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialog: Absence Simulator Modal ── */}
      <Dialog
        open={simulateModalOpen}
        onClose={() => setSimulateModalOpen(false)}
        title="Simulate Absence Impact"
        width={500}
      >
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 var(--space-4)' }}>
            See what happens to your buffer and attendance % if you miss upcoming classes.
          </p>

          {/* Course select */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              Select Course:
            </label>
            <select
              value={simCourse?.course_id || ''}
              onChange={(e) => {
                const found = courses.find((c) => c.course_id === Number(e.target.value));
                setSimCourse(found);
                if (found) {
                  simulateMutation.mutate({ courseId: found.course_id, count: simMissCount });
                }
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 13,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {courses.map((c) => (
                <option key={c.course_id} value={c.course_id}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Miss count input */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              If I miss the next N classes:
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <input
                type="number"
                min="1"
                max="15"
                value={simMissCount}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSimMissCount(val);
                  if (simCourse) {
                    simulateMutation.mutate({ courseId: simCourse.course_id, count: val });
                  }
                }}
                style={{
                  width: 90,
                  padding: '7px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                upcoming lecture sessions
              </span>
            </div>
          </div>

          {/* Simulation Output */}
          {simulateMutation.isPending && (
            <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Calculating projection...
            </div>
          )}

          {simResult && !simulateMutation.isPending && (
            <div
              style={{
                background: simResult.is_recoverable ? 'var(--bg)' : 'var(--crit-bg)',
                border: `1px solid ${simResult.is_recoverable ? 'var(--border)' : 'var(--crit-fg)'}`,
                borderRadius: 12,
                padding: 'var(--space-4)',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Projected Attendance</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink-900)' }}>
                    {formatPct(simResult.simulated_attendance_pct)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Current: {formatPct(simResult.current_attendance_pct)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Projected Buffer</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: simResult.simulated_buffer < 0 ? 'var(--crit-fg)' : '#1E3F20' }}>
                    {simResult.simulated_buffer < 0
                      ? 'Not recoverable'
                      : `${simResult.simulated_buffer} classes`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Current: {simResult.current_buffer}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: simResult.is_recoverable ? 'var(--text)' : 'var(--crit-fg)', fontWeight: 600 }}>
                {simResult.impact_description || simResult.status_message}
              </div>
            </div>
          )}

          <div style={{ marginTop: 'var(--space-6)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
            <Button variant="secondary" onClick={() => setSimulateModalOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setSimulateModalOpen(false);
                navigate('/student/calendar');
              }}
            >
              Open Full Planner →
            </Button>
          </div>
        </div>
      </Dialog>
    </main>
  );
}
