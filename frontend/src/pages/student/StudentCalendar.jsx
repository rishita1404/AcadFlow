import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { attendanceApi, holidayApi, planApi, deadlineApi, dashboardApi, studentApi } from '../../api/endpoints.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { Filter, Calendar, BookOpen, AlertCircle, CheckCircle2, ChevronRight, X } from 'lucide-react';

export default function StudentCalendar() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const courseIdParam = searchParams.get('course_id');
  const planParam = searchParams.get('plan');

  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(10); // Default to October 2026 (active semester month)
  const [mode, setMode] = useState('attendance'); // 'attendance' | 'pressure'
  const [courseFilter, setCourseFilter] = useState(courseIdParam ? String(courseIdParam) : 'all');
  const [planMode, setPlanMode] = useState(planParam === '1');
  const [plannedDates, setPlannedDates] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  // Sync courseFilter with URL params if param changes
  useEffect(() => {
    if (courseIdParam) {
      setCourseFilter(String(courseIdParam));
    }
    if (planParam === '1') {
      setPlanMode(true);
    }
  }, [courseIdParam, planParam]);

  // Fetch student courses for the filter dropdown
  const { data: dashData } = useQuery({
    queryKey: ['student-dashboard-courses'],
    queryFn: () => dashboardApi.getDashboard().then(r => r.data).catch(() => null),
  });
  const enrolledCourses = dashData?.courses || [];
  const activeCourse = enrolledCourses.find(c => String(c.course_id) === String(courseFilter));

  // Queries
  const { data: calData, isLoading: loadingCal } = useQuery({
    queryKey: ['calendar-view', year, month, courseFilter],
    queryFn: () => attendanceApi.getCalendar(year, month, courseFilter !== 'all' ? Number(courseFilter) : null).then(r => r.data),
  });

  const { data: pressureData } = useQuery({
    queryKey: ['pressure-view', year, month],
    queryFn: () => deadlineApi.getPressureForecast(year, month).then(r => r.data).catch(() => null),
  });

  const { data: _holidays = [] } = useQuery({
    queryKey: ['student-holidays'],
    queryFn: () => holidayApi.list().then(r => r.data).catch(() => []),
  });

  // Planner Projection Mutation
  const { data: planProjection, mutate: computeProjection } = useMutation({
    mutationFn: (dates) => planApi.projectLeavePlan(dates, courseFilter !== 'all' ? Number(courseFilter) : null).then(r => r.data),
  });

  const savePlannedAbsences = useMutation({
    mutationFn: async (dates) => {
      const label = activeCourse ? `[${activeCourse.code}] Planned Leave` : 'Planned leave from planner';
      for (const d of dates) {
        await holidayApi.mark(d, label);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-view'] });
      qc.invalidateQueries({ queryKey: ['student-holidays'] });
      alert(activeCourse ? `Planned leave for ${activeCourse.code} saved successfully!` : 'Planned leave saved successfully!');
    },
  });

  const handlePrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else { setMonth(m => m - 1); }
  };

  const handleNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else { setMonth(m => m + 1); }
  };

  const handleCourseFilterChange = (newCourseId) => {
    setCourseFilter(newCourseId);
    if (newCourseId === 'all') {
      searchParams.delete('course_id');
      searchParams.delete('course_code');
    } else {
      searchParams.set('course_id', newCourseId);
      const c = enrolledCourses.find(ec => String(ec.course_id) === String(newCourseId));
      if (c) searchParams.set('course_code', c.code);
    }
    setSearchParams(searchParams);
    if (plannedDates.length > 0) {
      planApi.projectLeavePlan(plannedDates, newCourseId !== 'all' ? Number(newCourseId) : null)
        .then(r => computeProjection(plannedDates))
        .catch(() => {});
    }
  };

  const togglePlannedDate = (dateStr) => {
    const next = plannedDates.includes(dateStr)
      ? plannedDates.filter(d => d !== dateStr)
      : [...plannedDates, dateStr];
    setPlannedDates(next);
    computeProjection(next);
  };

  const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });

  // Map calendar data days
  const dayMap = {};
  calData?.days?.forEach(d => { dayMap[d.date] = d; });
  pressureData?.days?.forEach(d => {
    if (dayMap[d.date]) {
      dayMap[d.date].pressure_score = d.pressure_score;
      dayMap[d.date].must_attend = d.must_attend;
      dayMap[d.date].assignments_due = d.assignments_due;
    }
  });

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const totalDays = new Date(year, month, 0).getDate();
  const calendarCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarCells.push(null);
  for (let d = 1; d <= totalDays; d++) calendarCells.push(d);

  const getCellDateStr = (d) => `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', color: 'var(--text)' }}>
      {/* Header & Controls */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '20px 24px', border: '1px solid var(--border)',
        marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
        boxShadow: 'var(--shadow-card)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
              Academic Calendar & Leave Planner
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            View past attendance history with lecture ratios (e.g. 3/4), pressure heatmap, and plan future absences with live buffer projection.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Subject Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', padding: '4px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)' }}>
            <Filter size={13} color="var(--text-muted)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Subject:</span>
            <select
              value={courseFilter}
              onChange={e => handleCourseFilterChange(e.target.value)}
              style={{
                border: 'none', background: 'transparent', fontSize: 12, fontWeight: 600,
                color: 'var(--ink-900)', outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="all">All Subjects ({enrolledCourses.length || 6})</option>
              {enrolledCourses.map(c => (
                <option key={c.course_id} value={c.course_id}>
                  {c.code} – {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Mode Switch */}
          <div style={{ display: 'flex', background: 'var(--bg)', padding: 3, borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setMode('attendance')}
              style={{
                padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: mode === 'attendance' ? 'var(--accent)' : 'transparent',
                color: mode === 'attendance' ? 'var(--on-dark)' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              Attendance View
            </button>
            <button
              onClick={() => setMode('pressure')}
              style={{
                padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: mode === 'pressure' ? 'var(--accent)' : 'transparent',
                color: mode === 'pressure' ? 'var(--on-dark)' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              Pressure Heatmap
            </button>
          </div>

          {/* Plan Leaves Toggle */}
          {mode === 'attendance' && (
            <button
              onClick={() => {
                const next = !planMode;
                setPlanMode(next);
                if (next && plannedDates.length > 0) computeProjection(plannedDates);
              }}
              style={{
                padding: '7px 16px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: planMode ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: planMode ? 'var(--accent)' : 'var(--surface)',
                color: planMode ? 'var(--on-dark)' : 'var(--text)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {planMode ? '✓ Plan Mode Active' : (activeCourse ? `Plan Leaves (${activeCourse.code})` : 'Plan Leaves Mode')}
            </button>
          )}

          {/* Month Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', padding: '4px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)' }}>
            <button onClick={handlePrevMonth} style={navBtnStyle}>←</button>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', minWidth: 120, textAlign: 'center' }}>
              {monthName} {year}
            </span>
            <button onClick={handleNextMonth} style={navBtnStyle}>→</button>
          </div>
        </div>
      </div>

      {/* Active Subject Banner */}
      {activeCourse && (
        <div style={{
          background: 'var(--bg)', borderRadius: 'var(--radius-input)', padding: '10px 16px', border: '1px solid var(--border)',
          marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13,
        }}>
          <div>
            Showing Attendance & Leave Planner for: <strong style={{ color: 'var(--accent)' }}>{activeCourse.code} – {activeCourse.name}</strong>
            {' · '}Current Attendance: <strong style={{ color: Number(activeCourse.attendance_pct) >= 75 ? 'var(--ok-fg)' : 'var(--crit-fg)' }}>{Number(activeCourse.attendance_pct).toFixed(1)}%</strong>
            {' · '}Buffer: <strong style={{ color: activeCourse.buffer >= 0 ? 'var(--ok-fg)' : 'var(--crit-fg)' }}>{activeCourse.buffer >= 0 ? `+${activeCourse.buffer}` : activeCourse.buffer}</strong>
          </div>
          <button
            onClick={() => handleCourseFilterChange('all')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            <X size={13} /> View All Subjects
          </button>
        </div>
      )}

      {/* Main Layout: Grid Calendar + Docked Side Panel (Planner or Drawer) */}
      <div style={{ display: 'grid', gridTemplateColumns: planMode || selectedDay ? '2.5fr 1.2fr' : '1fr', gap: 20 }}>
        {/* Calendar Area */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          {/* Weekday Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', padding: '6px 0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid Cells */}
          {loadingCal ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} height={90} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {calendarCells.map((d, idx) => {
                if (!d) return <div key={`empty-${idx}`} style={{ minHeight: 90, background: 'var(--bg)', borderRadius: 'var(--radius-input)', opacity: 0.5 }} />;

                const dateStr = getCellDateStr(d);
                const dayData = dayMap[dateStr];
                const isToday = new Date().toISOString().slice(0, 10) === dateStr;
                const isPast = new Date(dateStr) < new Date(new Date().setHours(0, 0, 0, 0));
                const isPlanned = plannedDates.includes(dateStr);
                const isSelected = selectedDay?.date === dateStr;

                const daySessions = dayData?.sessions || dayData?.courses || [];
                // Filter sessions to active subject if active
                const filteredSessions = courseFilter !== 'all'
                  ? daySessions.filter(s => String(s.course_id) === String(courseFilter) || s.course_code === activeCourse?.code)
                  : daySessions;

                const isHoliday = Boolean(dayData?.is_holiday || dayData?.is_institution_holiday || dayData?.is_student_planned_holiday);
                const holidayLabel = dayData?.holiday_label || (dayData?.is_institution_holiday ? 'Holiday' : dayData?.is_student_planned_holiday ? 'Planned Leave' : null);

                // Classes counts and ratio (strictly only present and absent)
                const heldCount = filteredSessions.length;
                const attendedCount = filteredSessions.filter(s => s.status === 'present').length;
                const ratioString = heldCount > 0 ? `${attendedCount}/${heldCount}` : null;

                // Determine styling & badge
                let bg = 'var(--surface)';
                let borderColor = 'var(--border)';
                let badgeText = '';
                let badgeColor = 'var(--text-muted)';
                let mustAttendBorder = dayData?.must_attend ? '3px solid var(--must-attend)' : 'none';

                if (isHoliday) {
                  bg = 'var(--bg)';
                  borderColor = 'var(--border)';
                  badgeText = holidayLabel || 'Holiday';
                  badgeColor = dayData?.is_student_planned_holiday ? 'var(--risk-fg)' : 'var(--text-muted)';
                } else if (isPlanned) {
                  bg = 'var(--risk-bg)';
                  borderColor = 'var(--risk-fg)';
                  badgeText = activeCourse ? `[${activeCourse.code}] Leave` : 'Planned Leave';
                  badgeColor = 'var(--risk-fg)';
                } else if (mode === 'pressure') {
                  const score = dayData?.pressure_score || 0;
                  if (score >= 6) { bg = 'var(--crit-bg)'; borderColor = 'var(--crit-fg)'; badgeText = `High (${score})`; badgeColor = 'var(--crit-fg)'; }
                  else if (score >= 3) { bg = 'var(--watch-bg)'; borderColor = 'var(--watch-fg)'; badgeText = `Med (${score})`; badgeColor = 'var(--watch-fg)'; }
                  else if (score > 0) { bg = 'var(--ok-bg)'; borderColor = 'var(--ok-fg)'; badgeText = `Low (${score})`; badgeColor = 'var(--ok-fg)'; }
                } else if (isPast && heldCount > 0) {
                  if (attendedCount === heldCount) {
                    bg = 'var(--ok-bg)';
                    borderColor = 'var(--ok-fg)';
                    badgeText = `${ratioString} Present`;
                    badgeColor = 'var(--ok-fg)';
                  } else if (attendedCount === 0) {
                    bg = 'var(--crit-bg)';
                    borderColor = 'var(--crit-fg)';
                    badgeText = `${ratioString} Absent`;
                    badgeColor = 'var(--crit-fg)';
                  } else {
                    bg = 'var(--watch-bg)';
                    borderColor = 'var(--watch-fg)';
                    badgeText = `${ratioString} Present`;
                    badgeColor = 'var(--watch-fg)';
                  }
                } else if (!isPast && heldCount > 0) {
                  badgeText = `${heldCount} class(es) scheduled`;
                  badgeColor = 'var(--text-muted)';
                }

                // If filtering by a single subject and no classes on this day, dim slightly
                const isDimmed = courseFilter !== 'all' && heldCount === 0 && !isHoliday;

                return (
                  <div
                    key={d}
                    onClick={() => {
                      if (planMode && !isPast && !isHoliday) {
                        togglePlannedDate(dateStr);
                      } else {
                        setSelectedDay({
                          ...(dayData || {}),
                          date: dateStr,
                          is_holiday: isHoliday,
                          holiday_label: holidayLabel,
                          courses: filteredSessions,
                          sessions: filteredSessions,
                          heldCount,
                          attendedCount,
                          ratioString,
                        });
                      }
                    }}
                    style={{
                      minHeight: 90,
                      borderRadius: 'var(--radius-input)',
                      padding: 8,
                      background: bg,
                      opacity: isDimmed ? 0.45 : 1,
                      border: isSelected ? '2px solid var(--accent)' : `1px solid ${borderColor}`,
                      borderLeft: mustAttendBorder !== 'none' ? mustAttendBorder : isSelected ? '2px solid var(--accent)' : `1px solid ${borderColor}`,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: isSelected ? '0 0 0 2px var(--sand)' : 'none',
                      transition: 'all 0.1s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        color: isToday ? 'var(--on-dark)' : 'var(--text)',
                        background: isToday ? 'var(--accent)' : 'transparent',
                        padding: isToday ? '2px 6px' : 0, borderRadius: 'var(--radius-pill)',
                      }}>
                        {d}
                      </span>
                      {dayData?.must_attend && (
                        <span style={{ fontSize: 9, background: 'var(--must-attend)', color: 'var(--surface)', padding: '2px 5px', borderRadius: 'var(--radius-pill)', fontWeight: 700, letterSpacing: '0.04em' }}>
                          MUST ATTEND
                        </span>
                      )}
                    </div>

                    {badgeText && (
                      <div style={{ fontSize: 10, fontWeight: 700, color: badgeColor, marginTop: 4 }}>
                        {badgeText}
                      </div>
                    )}

                    {/* Indicators for classes and deadlines */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {heldCount > 0 ? (
                          activeCourse ? `${heldCount} ${activeCourse.code}` : `${heldCount} class(es)`
                        ) : ''}
                      </span>
                      {dayData?.assignments_due > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--crit-fg)', fontWeight: 700 }}>
                          ⏰ {dayData.assignments_due} due
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Calendar Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', flexWrap: 'wrap', fontSize: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--ok-bg)', border: '1px solid var(--border)' }} /> Present (e.g. 3/3, 1/1)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--watch-bg)', border: '1px solid var(--border)' }} /> Partial Attendance (e.g. 3/4, 1/2)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--crit-bg)', border: '1px solid var(--border)' }} /> Absent (e.g. 0/4, 0/1)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--bg)', border: '1px solid var(--border)' }} /> Holiday
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--risk-bg)', border: '1px solid var(--border)' }} /> Planned Leave
            </span>
          </div>
        </div>

        {/* Docked Side Panel: Leave Planner OR Day Drawer */}
        {(planMode || selectedDay) && (
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 20, border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', maxHeight: '82vh', overflowY: 'auto',
            boxShadow: 'var(--shadow-card)',
          }}>
            {planMode ? (
              /* Docked Live Planner Panel */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
                      Leave Planner Simulation
                    </h3>
                    {activeCourse && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                        Subject: {activeCourse.code}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setPlanMode(false)} style={closeBtnStyle}>✕</button>
                </div>

                <div style={{
                  background: 'var(--bg)', padding: 12, borderRadius: 'var(--radius-input)', border: '1px solid var(--border)',
                  fontSize: 12, color: 'var(--text)', marginBottom: 14,
                }}>
                  Click future days on the calendar to mark planned leaves.
                  <div style={{ fontWeight: 600, color: 'var(--accent)', marginTop: 4 }}>
                    {activeCourse ? `Simulating leaves specifically for ${activeCourse.code}.` : 'Simulating leaves across all enrolled courses.'}
                  </div>
                </div>

                <div style={{ marginBottom: 14, fontSize: 13 }}>
                  Marked Leaves: <strong>{plannedDates.length} date(s)</strong>
                </div>

                {/* List planned dates with classes impacted */}
                {plannedDates.length > 0 && (
                  <div style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
                    {plannedDates.map(dateStr => {
                      const dData = dayMap[dateStr];
                      const dSessions = dData?.sessions || dData?.courses || [];
                      const matching = activeCourse
                        ? dSessions.filter(s => String(s.course_id) === String(activeCourse.course_id))
                        : dSessions;

                      return (
                        <div key={dateStr} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '6px 10px', background: 'var(--bg)', borderRadius: 'var(--radius-pill)',
                          fontSize: 12, border: '1px solid var(--border)',
                        }}>
                          <span><strong>{dateStr}</strong> {matching.length > 0 ? `(${matching.length} lecture${matching.length > 1 ? 's' : ''})` : '(No lecture)'}</span>
                          <button
                            onClick={() => togglePlannedDate(dateStr)}
                            style={{ background: 'none', border: 'none', color: 'var(--crit-fg)', cursor: 'pointer', fontWeight: 700 }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Live Projection per Course */}
                {planProjection?.courses?.map(cp => (
                  <div
                    key={cp.course_id}
                    style={{
                      background: cp.is_recoverable ? 'var(--surface)' : 'var(--crit-bg)',
                      border: `1px solid ${cp.is_recoverable ? 'var(--border)' : 'var(--crit-fg)'}`,
                      borderRadius: 'var(--radius-input)', padding: 12, marginBottom: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13, color: 'var(--ink-900)' }}>{cp.code}</strong>
                      <StatusBadge band={cp.projected_band} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <div>Projected Attendance: <strong>{cp.projected_final_percent}%</strong></div>
                      <div>Spare Misses Left: <strong style={{ color: cp.spare_misses_left < 0 ? 'var(--crit-fg)' : 'var(--ok-fg)' }}>{cp.spare_misses_left ?? '—'}</strong></div>
                    </div>
                    <div style={{ fontSize: 11, color: cp.is_recoverable ? 'var(--text-muted)' : 'var(--crit-fg)', marginTop: 6 }}>
                      💡 {cp.status_message}
                    </div>
                  </div>
                ))}

                {/* Planner Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                  <button
                    disabled={plannedDates.length === 0}
                    onClick={() => savePlannedAbsences.mutate(plannedDates)}
                    style={{
                      padding: '10px', background: plannedDates.length > 0 ? 'var(--accent)' : 'var(--border)',
                      color: plannedDates.length > 0 ? 'var(--on-dark)' : 'var(--text-muted)',
                      border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 700,
                      cursor: plannedDates.length > 0 ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {activeCourse ? `Save Plan for ${activeCourse.code}` : 'Save Plan to Profile'}
                  </button>
                  <button
                    onClick={() => {
                      setPlannedDates([]);
                      computeProjection([]);
                    }}
                    style={{
                      padding: '8px', background: 'var(--bg)', color: 'var(--text)',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Reset Leaves
                  </button>
                </div>
              </div>
            ) : (
              /* Right-side Day Details Drawer */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
                    Day Details: {selectedDay?.date}
                  </h3>
                  <button onClick={() => setSelectedDay(null)} style={closeBtnStyle}>✕</button>
                </div>

                {selectedDay?.is_holiday && (
                  <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, marginBottom: 12, fontSize: 13 }}>
                    {selectedDay.is_student_planned_holiday ? 'Planned Leave: ' : 'Institutional Holiday: '}{selectedDay.holiday_label || 'University Holiday'}
                  </div>
                )}

                {/* Day Ratio Banner */}
                {selectedDay?.ratioString && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 'var(--radius-input)', marginBottom: 12, fontSize: 13, fontWeight: 700,
                    background: selectedDay.attendedCount === selectedDay.heldCount ? 'var(--ok-bg)' : selectedDay.attendedCount === 0 ? 'var(--crit-bg)' : 'var(--watch-bg)',
                    color: selectedDay.attendedCount === selectedDay.heldCount ? 'var(--ok-fg)' : selectedDay.attendedCount === 0 ? 'var(--crit-fg)' : 'var(--watch-fg)',
                    border: '1px solid var(--border)',
                  }}>
                    Attendance: {selectedDay.attendedCount} of {selectedDay.heldCount} classes attended ({selectedDay.ratioString})
                  </div>
                )}

                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', margin: '0 0 10px' }}>
                  {activeCourse ? `Scheduled Sessions for ${activeCourse.code}` : 'Scheduled Sessions'}
                </h4>
                {(!selectedDay?.courses || selectedDay.courses.length === 0) ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius-input)' }}>
                    No classes scheduled for this day {activeCourse ? `in ${activeCourse.code}` : ''}.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {selectedDay.courses.map((c, i) => {
                      const isPresent = c.status === 'present';
                      const isAbsent = c.status === 'absent' || c.status === 'planned_absent';
                      const isScheduled = c.status === 'scheduled' || c.status === 'expected_present';

                      return (
                        <div key={i} style={{ padding: 10, background: 'var(--bg)', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ color: 'var(--ink-900)' }}>{c.course_code}</strong>
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                              background: isPresent ? 'var(--ok-bg)' : isScheduled ? 'var(--surface)' : 'var(--crit-bg)',
                              color: isPresent ? 'var(--ok-fg)' : isScheduled ? 'var(--accent)' : 'var(--crit-fg)',
                              border: isScheduled ? '1px solid var(--border)' : 'none',
                              textTransform: 'capitalize',
                            }}>
                              {isPresent ? 'Present' : isScheduled ? 'Scheduled' : 'Absent'}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            {c.course_name || 'Course Session'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const navBtnStyle = {
  background: 'transparent', border: 'none', borderRadius: 'var(--radius-pill)',
  padding: '4px 8px', fontSize: 13, cursor: 'pointer', fontWeight: 700, color: 'var(--text)',
};

const closeBtnStyle = {
  background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--text-muted)',
};
