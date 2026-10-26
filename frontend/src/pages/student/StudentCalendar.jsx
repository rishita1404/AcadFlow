import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  attendanceApi,
  holidayApi,
  planApi,
  deadlineApi,
  dashboardApi,
} from '../../api/endpoints.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import {
  Filter,
  Calendar as CalendarIcon,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  X,
  Trash2,
  Clock,
  Flame,
  ShieldAlert,
  FileText,
} from 'lucide-react';

export default function StudentCalendar() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const courseIdParam = searchParams.get('course_id');
  const planParam = searchParams.get('plan');

  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(10); // Default to October 2026 (active semester)
  const [mode, setMode] = useState('attendance'); // 'attendance' | 'pressure'
  const [courseFilter, setCourseFilter] = useState(courseIdParam ? String(courseIdParam) : 'all');
  const [planMode, setPlanMode] = useState(planParam === '1');
  const [plannedDates, setPlannedDates] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [actionMessage, setActionMessage] = useState('');

  // Sync courseFilter with URL params if param changes
  useEffect(() => {
    if (courseIdParam) {
      setCourseFilter(String(courseIdParam));
    }
    if (planParam === '1') {
      setPlanMode(true);
    }
  }, [courseIdParam, planParam]);

  // Flash temporary banner message
  const flashMessage = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(''), 4000);
  };

  // Fetch student courses for the filter dropdown
  const { data: dashData } = useQuery({
    queryKey: ['student-dashboard-courses'],
    queryFn: () => dashboardApi.getDashboard().then(r => r.data).catch(() => null),
  });
  const enrolledCourses = dashData?.courses || [];
  const activeCourse = enrolledCourses.find(c => String(c.course_id) === String(courseFilter));

  // Calendar query (past attendance + future sessions + holidays)
  const { data: calData, isLoading: loadingCal } = useQuery({
    queryKey: ['calendar-view', year, month, courseFilter],
    queryFn: () =>
      attendanceApi
        .getCalendar(year, month, courseFilter !== 'all' ? Number(courseFilter) : null)
        .then(r => r.data),
  });

  // Pressure forecast query (pressure scores, breakdown, warnings, deadlines)
  const { data: pressureData } = useQuery({
    queryKey: ['pressure-view', year, month],
    queryFn: () =>
      deadlineApi
        .getPressureForecast(year, month)
        .then(r => r.data)
        .catch(() => null),
  });

  // Saved student holidays list query
  const { data: studentHolidays = [] } = useQuery({
    queryKey: ['student-holidays'],
    queryFn: () =>
      holidayApi
        .list()
        .then(r => r.data)
        .catch(() => []),
  });

  // Detailed assignments & deadlines query
  const { data: deadlinesList = [] } = useQuery({
    queryKey: ['student-deadlines-calendar'],
    queryFn: () =>
      deadlineApi
        .getDeadlines(90, true)
        .then(r => r.data)
        .catch(() => []),
  });

  // Map deadlines by date YYYY-MM-DD
  const deadlinesByDate = useMemo(() => {
    const map = {};
    (deadlinesList || []).forEach(dl => {
      if (dl.due_at) {
        const dStr = dl.due_at.slice(0, 10);
        if (!map[dStr]) map[dStr] = [];
        map[dStr].push(dl);
      }
    });
    return map;
  }, [deadlinesList]);

  // Filter student holidays that fall within the currently viewed year & month
  const currentMonthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const savedLeavesThisMonth = useMemo(() => {
    return (studentHolidays || []).filter(h => {
      const dStr = String(h.holiday_date || h.date || '');
      return dStr.startsWith(currentMonthPrefix);
    });
  }, [studentHolidays, currentMonthPrefix]);

  // Planner Projection Mutation
  const { data: planProjection, mutate: computeProjection } = useMutation({
    mutationFn: (dates) =>
      planApi
        .projectLeavePlan(dates, courseFilter !== 'all' ? Number(courseFilter) : null)
        .then(r => r.data),
  });

  // Save in-memory planned leaves to backend profile
  const savePlannedAbsences = useMutation({
    mutationFn: async (dates) => {
      const label = activeCourse
        ? `[${activeCourse.code}] Planned Leave`
        : 'Planned leave from planner';
      for (const d of dates) {
        await holidayApi.mark(d, label);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-view'] });
      qc.invalidateQueries({ queryKey: ['student-holidays'] });
      qc.invalidateQueries({ queryKey: ['pressure-view'] });
      qc.invalidateQueries({ queryKey: ['student-dashboard-courses'] });
      setPlannedDates([]);
      computeProjection([]);
      flashMessage(
        activeCourse
          ? `Planned leaves for ${activeCourse.code} saved to profile!`
          : 'Planned leaves saved to profile successfully!'
      );
    },
    onError: (err) => {
      alert('Failed to save planned leaves: ' + (err?.response?.data?.detail || err.message));
    },
  });

  // Delete a single saved planned leave
  const deleteSingleHoliday = async (dateStr) => {
    try {
      await holidayApi.delete(dateStr);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['calendar-view'] }),
        qc.invalidateQueries({ queryKey: ['student-holidays'] }),
        qc.invalidateQueries({ queryKey: ['pressure-view'] }),
        qc.invalidateQueries({ queryKey: ['student-dashboard-courses'] }),
      ]);
      if (selectedDay?.date === dateStr) {
        setSelectedDay(prev =>
          prev
            ? {
                ...prev,
                is_holiday: false,
                is_student_planned_holiday: false,
                holiday_label: null,
              }
            : null
        );
      }
      flashMessage(`Deleted planned leave for ${dateStr}.`);
    } catch (err) {
      console.error('Failed to delete planned leave', err);
      alert('Failed to delete planned leave. Please try again.');
    }
  };

  // Reset all student holidays
  const handleResetLeaves = async () => {
    if (!window.confirm('Are you sure you want to reset all planned leaves?')) return;
    try {
      await holidayApi.resetAll();
      setPlannedDates([]);
      computeProjection([]);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['calendar-view'] }),
        qc.invalidateQueries({ queryKey: ['student-holidays'] }),
        qc.invalidateQueries({ queryKey: ['pressure-view'] }),
        qc.invalidateQueries({ queryKey: ['student-dashboard-courses'] }),
      ]);
      if (selectedDay) {
        setSelectedDay(null);
      }
      flashMessage('All planned leaves have been cleared successfully.');
    } catch (err) {
      console.error('Failed to reset leaves', err);
      alert('Failed to reset planned leaves.');
    }
  };

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(y => y - 1);
    } else {
      setMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(y => y + 1);
    } else {
      setMonth(m => m + 1);
    }
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
      planApi
        .projectLeavePlan(plannedDates, newCourseId !== 'all' ? Number(newCourseId) : null)
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

  // Map calendar data days and merge pressure + deadline breakdown
  const dayMap = {};
  calData?.days?.forEach(d => {
    dayMap[d.date] = { ...d };
  });

  pressureData?.days?.forEach(d => {
    if (dayMap[d.date]) {
      dayMap[d.date].pressure_score = d.pressure_score;
      dayMap[d.date].deadline_pressure = d.deadline_pressure;
      dayMap[d.date].attendance_pressure = d.attendance_pressure;
      dayMap[d.date].exam_pressure = d.exam_pressure;
      dayMap[d.date].must_attend = d.must_attend;
      dayMap[d.date].assignments_due = d.assignments_due || [];
      dayMap[d.date].warnings = d.warnings || [];
      dayMap[d.date].day_type = d.day_type;
    }
  });

  // Enrich each day with deadlines from deadlinesByDate
  Object.keys(dayMap).forEach(dStr => {
    const explicitDeadlines = deadlinesByDate[dStr] || [];
    const currentAssignments = dayMap[dStr].assignments_due || [];
    const combined = [...currentAssignments];

    explicitDeadlines.forEach(ed => {
      const alreadyHas = combined.some(
        c => c.id === ed.assignment_id || c.assignment_id === ed.assignment_id || c.title === ed.title
      );
      if (!alreadyHas) {
        combined.push({
          id: ed.assignment_id,
          title: ed.title,
          course_code: ed.course_code,
          kind: ed.kind,
          due_at: ed.due_at,
          grace_hours: ed.grace_hours,
          status: ed.status,
        });
      }
    });
    dayMap[dStr].assignments_due = combined;
  });

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const totalDays = new Date(year, month, 0).getDate();
  const calendarCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarCells.push(null);
  for (let d = 1; d <= totalDays; d++) calendarCells.push(d);

  const getCellDateStr = (d) =>
    `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', color: 'var(--text)' }}>
      {/* Alert / Flash Message Banner */}
      {actionMessage && (
        <div
          style={{
            background: 'var(--ok-bg)',
            color: 'var(--ok-fg)',
            border: '1px solid var(--ok-fg)',
            borderRadius: 'var(--radius-input)',
            padding: '10px 16px',
            marginBottom: 16,
            fontWeight: 600,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <span>✓ {actionMessage}</span>
          <button
            onClick={() => setActionMessage('')}
            style={{ background: 'none', border: 'none', color: 'var(--ok-fg)', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header & Controls */}
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-card)',
          padding: '20px 24px',
          border: '1px solid var(--border)',
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--ink-900)',
                margin: 0,
              }}
            >
              Academic Calendar & Leave Planner
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Attendance history with lecture ratios, academic pressure heatmap with deadline breakdown, and live leave simulation.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Subject Filter Dropdown */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--bg)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--border)',
            }}
          >
            <Filter size={13} color="var(--text-muted)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Subject:</span>
            <select
              value={courseFilter}
              onChange={e => handleCourseFilterChange(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--ink-900)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Subjects ({enrolledCourses.length || 4})</option>
              {enrolledCourses.map(c => (
                <option key={c.course_id} value={c.course_id}>
                  {c.code} – {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Mode Switch: Attendance vs Pressure Heatmap */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg)',
              padding: 3,
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--border)',
            }}
          >
            <button
              onClick={() => setMode('attendance')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
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
                padding: '6px 14px',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                background: mode === 'pressure' ? 'var(--accent)' : 'transparent',
                color: mode === 'pressure' ? 'var(--on-dark)' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              🔥 Pressure Heatmap
            </button>
          </div>

          {/* Plan Leaves Mode Toggle */}
          {mode === 'attendance' && (
            <button
              onClick={() => {
                const next = !planMode;
                setPlanMode(next);
                if (next && plannedDates.length > 0) computeProjection(plannedDates);
              }}
              style={{
                padding: '7px 16px',
                borderRadius: 'var(--radius-pill)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                border: planMode ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: planMode ? 'var(--accent)' : 'var(--surface)',
                color: planMode ? 'var(--on-dark)' : 'var(--text)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {planMode
                ? '✓ Plan Mode Active'
                : activeCourse
                ? `Plan Leaves (${activeCourse.code})`
                : 'Plan Leaves Mode'}
            </button>
          )}

          {/* Month Navigation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--surface)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--border)',
            }}
          >
            <button onClick={handlePrevMonth} style={navBtnStyle}>
              ←
            </button>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--ink-900)',
                minWidth: 120,
                textAlign: 'center',
              }}
            >
              {monthName} {year}
            </span>
            <button onClick={handleNextMonth} style={navBtnStyle}>
              →
            </button>
          </div>
        </div>
      </div>

      {/* Active Subject Filter Banner */}
      {activeCourse && (
        <div
          style={{
            background: 'var(--bg)',
            borderRadius: 'var(--radius-input)',
            padding: '10px 16px',
            border: '1px solid var(--border)',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 13,
          }}
        >
          <div>
            Showing Attendance & Planner for:{' '}
            <strong style={{ color: 'var(--accent)' }}>
              {activeCourse.code} – {activeCourse.name}
            </strong>
            {' · '}Current Attendance:{' '}
            <strong
              style={{
                color:
                  Number(activeCourse.attendance_pct) >= 75 ? 'var(--ok-fg)' : 'var(--crit-fg)',
              }}
            >
              {Number(activeCourse.attendance_pct).toFixed(1)}%
            </strong>
            {' · '}Buffer:{' '}
            <strong
              style={{
                color: activeCourse.buffer >= 0 ? 'var(--ok-fg)' : 'var(--crit-fg)',
              }}
            >
              {activeCourse.buffer >= 0 ? `+${activeCourse.buffer}` : activeCourse.buffer}
            </strong>
          </div>
          <button
            onClick={() => handleCourseFilterChange('all')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <X size={13} /> View All Subjects
          </button>
        </div>
      )}

      {/* Main Grid: Calendar Cells + Docked Right-Side Panel */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: planMode || selectedDay ? '2.4fr 1.3fr' : '1fr',
          gap: 20,
        }}
      >
        {/* Calendar Area */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-card)',
            padding: 20,
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {/* Weekday Headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 4,
              marginBottom: 8,
            }}
          >
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div
                key={d}
                style={{
                  textAlign: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  padding: '6px 0',
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          {loadingCal ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} height={96} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {calendarCells.map((d, idx) => {
                if (!d) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      style={{
                        minHeight: 96,
                        background: 'var(--bg)',
                        borderRadius: 'var(--radius-input)',
                        opacity: 0.5,
                      }}
                    />
                  );
                }

                const dateStr = getCellDateStr(d);
                const dayData = dayMap[dateStr];
                const isToday = new Date().toISOString().slice(0, 10) === dateStr;
                const isPast = new Date(dateStr) < new Date(new Date().setHours(0, 0, 0, 0));
                const isNewlyPlanned = plannedDates.includes(dateStr);
                const isSelected = selectedDay?.date === dateStr;

                const daySessions = dayData?.sessions || dayData?.courses || [];
                const filteredSessions =
                  courseFilter !== 'all'
                    ? daySessions.filter(
                        s =>
                          String(s.course_id) === String(courseFilter) ||
                          s.course_code === activeCourse?.code
                      )
                    : daySessions;

                const isInstHoliday = Boolean(
                  dayData?.is_institution_holiday || (dayData?.is_holiday && !dayData?.is_student_planned_holiday)
                );
                const isStudentHoliday = Boolean(dayData?.is_student_planned_holiday);
                const holidayLabel = dayData?.holiday_label || (isInstHoliday ? 'Holiday' : isStudentHoliday ? 'Planned Leave' : null);

                // Classes count & attendance ratio
                const heldCount = filteredSessions.length;
                const attendedCount = filteredSessions.filter(s => s.status === 'present').length;
                const ratioString = heldCount > 0 ? `${attendedCount}/${heldCount}` : null;

                // Deadlines on this day
                const assignmentsOnDay = dayData?.assignments_due || [];
                const deadlineCount = assignmentsOnDay.length;

                // Pressure Score
                const pressureScore = dayData?.pressure_score || 0;

                // Cell styling determination
                let bg = 'var(--surface)';
                let borderColor = 'var(--border)';
                let badgeText = '';
                let badgeColor = 'var(--text-muted)';
                let mustAttendBorder = dayData?.must_attend
                  ? '3px solid var(--must-attend)'
                  : 'none';

                if (isInstHoliday) {
                  bg = 'var(--bg)';
                  borderColor = 'var(--border)';
                  badgeText = holidayLabel || 'Holiday';
                  badgeColor = 'var(--text-muted)';
                } else if (isStudentHoliday) {
                  bg = 'var(--risk-bg)';
                  borderColor = 'var(--risk-fg)';
                  badgeText = holidayLabel || 'Planned Leave';
                  badgeColor = 'var(--risk-fg)';
                } else if (isNewlyPlanned) {
                  bg = 'var(--risk-bg)';
                  borderColor = 'var(--risk-fg)';
                  badgeText = activeCourse ? `[${activeCourse.code}] Leave` : 'Unsaved Leave';
                  badgeColor = 'var(--risk-fg)';
                } else if (mode === 'pressure') {
                  // Heatmap Mode
                  if (pressureScore >= 60) {
                    bg = 'var(--crit-bg)';
                    borderColor = 'var(--crit-fg)';
                    badgeText = `🔥 Heavy (${pressureScore.toFixed(0)})`;
                    badgeColor = 'var(--crit-fg)';
                  } else if (pressureScore >= 35) {
                    bg = 'var(--watch-bg)';
                    borderColor = 'var(--watch-fg)';
                    badgeText = `⚠️ Med (${pressureScore.toFixed(0)})`;
                    badgeColor = 'var(--watch-fg)';
                  } else if (pressureScore > 0) {
                    bg = 'var(--ok-bg)';
                    borderColor = 'var(--ok-fg)';
                    badgeText = `Low (${pressureScore.toFixed(0)})`;
                    badgeColor = 'var(--ok-fg)';
                  } else {
                    bg = 'var(--bg)';
                    borderColor = 'var(--border)';
                    badgeText = 'Free';
                    badgeColor = 'var(--text-muted)';
                  }
                } else if (isPast && heldCount > 0) {
                  // Attendance View
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

                const isDimmed = courseFilter !== 'all' && heldCount === 0 && !isInstHoliday && !isStudentHoliday;

                return (
                  <div
                    key={d}
                    title={
                      mode === 'pressure'
                        ? `Pressure Score: ${pressureScore}/100. ${assignmentsOnDay.map(a => a.title).join(', ')}`
                        : undefined
                    }
                    onClick={() => {
                      if (planMode && !isPast) {
                        if (isStudentHoliday) {
                          // Allow deleting already-saved planned leave with confirmation
                          if (
                            window.confirm(
                              `Delete already saved planned leave for ${dateStr} (${holidayLabel})?`
                            )
                          ) {
                            deleteSingleHoliday(dateStr);
                          }
                        } else if (!isInstHoliday) {
                          togglePlannedDate(dateStr);
                        }
                      } else {
                        // Select day and open detailed day drawer
                        setSelectedDay({
                          ...(dayData || {}),
                          date: dateStr,
                          is_holiday: isInstHoliday || isStudentHoliday,
                          is_institution_holiday: isInstHoliday,
                          is_student_planned_holiday: isStudentHoliday,
                          holiday_label: holidayLabel,
                          courses: filteredSessions,
                          sessions: filteredSessions,
                          heldCount,
                          attendedCount,
                          ratioString,
                          pressure_score: pressureScore,
                          deadline_pressure: dayData?.deadline_pressure || 0,
                          attendance_pressure: dayData?.attendance_pressure || 0,
                          exam_pressure: dayData?.exam_pressure || 0,
                          must_attend: Boolean(dayData?.must_attend),
                          warnings: dayData?.warnings || [],
                          assignments_due: assignmentsOnDay,
                        });
                      }
                    }}
                    style={{
                      minHeight: 96,
                      borderRadius: 'var(--radius-input)',
                      padding: 8,
                      background: bg,
                      opacity: isDimmed ? 0.45 : 1,
                      border: isSelected
                        ? '2px solid var(--accent)'
                        : `1px solid ${borderColor}`,
                      borderLeft:
                        mustAttendBorder !== 'none'
                          ? mustAttendBorder
                          : isSelected
                          ? '2px solid var(--accent)'
                          : `1px solid ${borderColor}`,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: isSelected ? '0 0 0 2px var(--sand)' : 'none',
                      transition: 'all 0.12s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: isToday ? 'var(--on-dark)' : 'var(--text)',
                          background: isToday ? 'var(--accent)' : 'transparent',
                          padding: isToday ? '2px 6px' : 0,
                          borderRadius: 'var(--radius-pill)',
                        }}
                      >
                        {d}
                      </span>
                      {dayData?.must_attend && (
                        <span
                          style={{
                            fontSize: 9,
                            background: 'var(--must-attend)',
                            color: 'var(--surface)',
                            padding: '2px 5px',
                            borderRadius: 'var(--radius-pill)',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                          }}
                        >
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
                        {heldCount > 0
                          ? activeCourse
                            ? `${heldCount} ${activeCourse.code}`
                            : `${heldCount} class(es)`
                          : ''}
                      </span>
                      {deadlineCount > 0 && (
                        <span
                          style={{
                            fontSize: 10,
                            color: 'var(--crit-fg)',
                            fontWeight: 700,
                            background: 'var(--crit-bg)',
                            padding: '1px 5px',
                            borderRadius: 4,
                          }}
                        >
                          ⏰ {deadlineCount} due
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Calendar Legend */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              marginTop: 16,
              paddingTop: 12,
              borderTop: '1px solid var(--border)',
              flexWrap: 'wrap',
              fontSize: 12,
            }}
          >
            {mode === 'attendance' ? (
              <>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--ok-bg)', border: '1px solid var(--border)' }} />
                  Full Attendance (e.g. 4/4)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--watch-bg)', border: '1px solid var(--border)' }} />
                  Partial (e.g. 3/4)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--crit-bg)', border: '1px solid var(--border)' }} />
                  Absent (e.g. 0/4)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--risk-bg)', border: '1px solid var(--risk-fg)' }} />
                  Planned Leave
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--bg)', border: '1px solid var(--border)' }} />
                  Holiday
                </span>
              </>
            ) : (
              <>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--crit-bg)', border: '1px solid var(--crit-fg)' }} />
                  Heavy Pressure (Score ≥ 60)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--watch-bg)', border: '1px solid var(--watch-fg)' }} />
                  Moderate Load (Score 35–59)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--ok-bg)', border: '1px solid var(--ok-fg)' }} />
                  Light Load (Score 1–34)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--bg)', border: '1px solid var(--border)' }} />
                  Free / Clear Day
                </span>
              </>
            )}
          </div>
        </div>

        {/* Docked Right-Side Panel: Leave Planner OR Day Details Drawer */}
        {(planMode || selectedDay) && (
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-card)',
              padding: 20,
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            {planMode ? (
              /* Docked Live Planner Panel */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h3
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: 16,
                        fontWeight: 700,
                        color: 'var(--ink-900)',
                        margin: 0,
                      }}
                    >
                      Leave Planner Simulation
                    </h3>
                    {activeCourse && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                        Target: {activeCourse.code}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setPlanMode(false)} style={closeBtnStyle}>
                    ✕
                  </button>
                </div>

                <div
                  style={{
                    background: 'var(--bg)',
                    padding: 12,
                    borderRadius: 'var(--radius-input)',
                    border: '1px solid var(--border)',
                    fontSize: 12,
                    color: 'var(--text)',
                    marginBottom: 14,
                  }}
                >
                  Click future days on the calendar to select planned leaves, or click already saved leaves to delete them.
                  <div style={{ fontWeight: 600, color: 'var(--accent)', marginTop: 4 }}>
                    {activeCourse
                      ? `Simulating leaves specifically for ${activeCourse.code}.`
                      : 'Simulating leaves across all enrolled courses.'}
                  </div>
                </div>

                {/* Section: Currently Saved Leaves (Allows deleting individual saved leaves!) */}
                {savedLeavesThisMonth.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--ink-900)',
                        marginBottom: 6,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>Saved Leaves This Month ({savedLeavesThisMonth.length}):</span>
                    </div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {savedLeavesThisMonth.map(h => {
                        const hDate = String(h.holiday_date || h.date);
                        return (
                          <div
                            key={h.id || hDate}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '6px 10px',
                              background: 'var(--risk-bg)',
                              borderRadius: 'var(--radius-pill)',
                              fontSize: 12,
                              border: '1px solid var(--risk-fg)',
                            }}
                          >
                            <span style={{ color: 'var(--ink-900)' }}>
                              <strong>{hDate}</strong>: {h.reason || 'Planned Leave'}
                            </span>
                            <button
                              onClick={() => deleteSingleHoliday(hDate)}
                              title="Delete this saved planned leave"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--crit-fg)',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: 12,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                              }}
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section: Unsaved New Selections */}
                <div style={{ marginBottom: 14, fontSize: 13 }}>
                  Newly Selected Leaves: <strong>{plannedDates.length} date(s)</strong>
                </div>

                {plannedDates.length > 0 && (
                  <div style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
                    {plannedDates.map(dateStr => {
                      const dData = dayMap[dateStr];
                      const dSessions = dData?.sessions || dData?.courses || [];
                      const matching = activeCourse
                        ? dSessions.filter(s => String(s.course_id) === String(activeCourse.course_id))
                        : dSessions;

                      return (
                        <div
                          key={dateStr}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '6px 10px',
                            background: 'var(--bg)',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: 12,
                            border: '1px solid var(--border)',
                          }}
                        >
                          <span>
                            <strong>{dateStr}</strong>{' '}
                            {matching.length > 0
                              ? `(${matching.length} lecture${matching.length > 1 ? 's' : ''})`
                              : '(No lecture)'}
                          </span>
                          <button
                            onClick={() => togglePlannedDate(dateStr)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--crit-fg)',
                              cursor: 'pointer',
                              fontWeight: 700,
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Live Buffer Projection per Course */}
                {planProjection?.courses?.map(cp => (
                  <div
                    key={cp.course_id}
                    style={{
                      background: cp.is_recoverable ? 'var(--surface)' : 'var(--crit-bg)',
                      border: `1px solid ${cp.is_recoverable ? 'var(--border)' : 'var(--crit-fg)'}`,
                      borderRadius: 'var(--radius-input)',
                      padding: 12,
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13, color: 'var(--ink-900)' }}>{cp.code}</strong>
                      <StatusBadge band={cp.projected_band} />
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text)',
                        marginTop: 6,
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 6,
                      }}
                    >
                      <div>
                        Projected Attendance: <strong>{cp.projected_final_percent}%</strong>
                      </div>
                      <div>
                        Spare Misses Left:{' '}
                        <strong
                          style={{
                            color: cp.spare_misses_left < 0 ? 'var(--crit-fg)' : 'var(--ok-fg)',
                          }}
                        >
                          {cp.spare_misses_left ?? '—'}
                        </strong>
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: cp.is_recoverable ? 'var(--text-muted)' : 'var(--crit-fg)',
                        marginTop: 6,
                      }}
                    >
                      💡 {cp.status_message}
                    </div>
                  </div>
                ))}

                {/* Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                  <button
                    disabled={plannedDates.length === 0}
                    onClick={() => savePlannedAbsences.mutate(plannedDates)}
                    style={{
                      padding: '10px',
                      background: plannedDates.length > 0 ? 'var(--accent)' : 'var(--border)',
                      color: plannedDates.length > 0 ? 'var(--on-dark)' : 'var(--text-muted)',
                      border: 'none',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: plannedDates.length > 0 ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {activeCourse ? `Save Plan for ${activeCourse.code}` : 'Save Plan to Profile'}
                  </button>
                  <button
                    onClick={handleResetLeaves}
                    style={{
                      padding: '8px',
                      background: 'var(--bg)',
                      color: 'var(--crit-fg)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    <Trash2 size={13} /> Reset All Leaves
                  </button>
                </div>
              </div>
            ) : (
              /* Right-side Day Details Drawer */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h3
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: 16,
                        fontWeight: 700,
                        color: 'var(--ink-900)',
                        margin: 0,
                      }}
                    >
                      Day Details: {selectedDay?.date}
                    </h3>
                  </div>
                  <button onClick={() => setSelectedDay(null)} style={closeBtnStyle}>
                    ✕
                  </button>
                </div>

                {/* If Student Planned Leave: Banner + Single-Click Delete Button */}
                {selectedDay?.is_student_planned_holiday && (
                  <div
                    style={{
                      padding: '12px 14px',
                      background: 'var(--risk-bg)',
                      borderRadius: 'var(--radius-input)',
                      border: '1px solid var(--risk-fg)',
                      marginBottom: 14,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--risk-fg)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Planned Leave Saved
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)', marginTop: 2 }}>
                        {selectedDay.holiday_label || 'Planned Leave'}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteSingleHoliday(selectedDay.date)}
                      style={{
                        padding: '6px 12px',
                        background: 'var(--crit-bg)',
                        color: 'var(--crit-fg)',
                        border: '1px solid var(--crit-fg)',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Trash2 size={12} /> Delete Leave
                    </button>
                  </div>
                )}

                {/* Institutional Holiday Banner */}
                {selectedDay?.is_institution_holiday && (
                  <div
                    style={{
                      padding: 12,
                      background: 'var(--bg)',
                      borderRadius: 'var(--radius-input)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      fontWeight: 600,
                      marginBottom: 12,
                      fontSize: 13,
                    }}
                  >
                    University Holiday: {selectedDay.holiday_label || 'University Closed'}
                  </div>
                )}

                {/* Academic Pressure & Deadlines Card (Answers: Why is heatmap score high for that day?) */}
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-input)',
                    padding: 14,
                    marginBottom: 14,
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
                        Academic Pressure Breakdown
                      </h4>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Why is the pressure score {(selectedDay?.pressure_score || 0).toFixed(0)}/100?
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-pill)',
                        background:
                          (selectedDay?.pressure_score || 0) >= 60
                            ? 'var(--crit-bg)'
                            : (selectedDay?.pressure_score || 0) >= 30
                            ? 'var(--watch-bg)'
                            : 'var(--ok-bg)',
                        color:
                          (selectedDay?.pressure_score || 0) >= 60
                            ? 'var(--crit-fg)'
                            : (selectedDay?.pressure_score || 0) >= 30
                            ? 'var(--watch-fg)'
                            : 'var(--ok-fg)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {(selectedDay?.pressure_score || 0) >= 60
                        ? '🔥 High Pressure'
                        : (selectedDay?.pressure_score || 0) >= 30
                        ? '⚠️ Moderate Load'
                        : '✅ Low Load'}{' '}
                      ({(selectedDay?.pressure_score || 0).toFixed(0)}/100)
                    </span>
                  </div>

                  {/* Component Breakdown Gauges */}
                  <div
                    style={{
                      display: 'grid',
                      gap: 8,
                      background: 'var(--bg)',
                      padding: 10,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                    }}
                  >
                    {/* 1. Deadline Pressure */}
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--text)',
                        }}
                      >
                        <span>⏰ Deadline Pressure</span>
                        <span>{(selectedDay?.deadline_pressure || 0).toFixed(1)} / 45 pts</span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          width: '100%',
                          background: 'var(--border)',
                          borderRadius: 3,
                          marginTop: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(
                              100,
                              ((selectedDay?.deadline_pressure || 0) / 45) * 100
                            )}%`,
                            background: 'var(--crit-fg)',
                          }}
                        />
                      </div>
                    </div>

                    {/* 2. Attendance Buffer Risk */}
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--text)',
                        }}
                      >
                        <span>⚠️ Attendance Buffer Risk</span>
                        <span>{(selectedDay?.attendance_pressure || 0).toFixed(1)} / 30 pts</span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          width: '100%',
                          background: 'var(--border)',
                          borderRadius: 3,
                          marginTop: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(
                              100,
                              ((selectedDay?.attendance_pressure || 0) / 30) * 100
                            )}%`,
                            background: 'var(--watch-fg)',
                          }}
                        />
                      </div>
                    </div>

                    {/* 3. Exam Proximity */}
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--text)',
                        }}
                      >
                        <span>📝 Exam Proximity</span>
                        <span>{(selectedDay?.exam_pressure || 0).toFixed(1)} / 25 pts</span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          width: '100%',
                          background: 'var(--border)',
                          borderRadius: 3,
                          marginTop: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(
                              100,
                              ((selectedDay?.exam_pressure || 0) / 25) * 100
                            )}%`,
                            background: 'var(--accent)',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* System Trigger Warnings */}
                  {selectedDay?.warnings && selectedDay.warnings.length > 0 && (
                    <div style={{ marginTop: 10, display: 'grid', gap: 4 }}>
                      {selectedDay.warnings.map((w, idx) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '6px 8px',
                            borderRadius: 6,
                            background: 'var(--sand)',
                            color: 'var(--ink-900)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {w}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Deadlines Due on this Day */}
                  {selectedDay?.assignments_due && selectedDay.assignments_due.length > 0 ? (
                    <div style={{ marginTop: 12 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--ink-900)',
                          marginBottom: 6,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>Deadlines Due on this Day ({selectedDay.assignments_due.length}):</span>
                        <Link
                          to="/student/tasks"
                          style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
                        >
                          View Tasks →
                        </Link>
                      </div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {selectedDay.assignments_due.map((a, i) => (
                          <div
                            key={i}
                            style={{
                              padding: 8,
                              background: 'var(--bg)',
                              border: '1px solid var(--border)',
                              borderRadius: 6,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    background: 'var(--accent)',
                                    color: 'var(--on-dark)',
                                    borderRadius: 'var(--radius-pill)',
                                  }}
                                >
                                  {a.course_code || 'COURSE'}
                                </span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-900)' }}>
                                  {a.title}
                                </span>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                Type: {a.kind || 'assignment'}{' '}
                                {a.grace_hours ? `· ${a.grace_hours}h grace period` : ''}
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background:
                                  a.status === 'submitted' || a.status === 'on_time'
                                    ? 'var(--ok-bg)'
                                    : 'var(--crit-bg)',
                                color:
                                  a.status === 'submitted' || a.status === 'on_time'
                                    ? 'var(--ok-fg)'
                                    : 'var(--crit-fg)',
                              }}
                            >
                              {a.status === 'submitted' || a.status === 'on_time' ? 'Submitted' : 'Pending'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                      No assignment deadlines due directly on this day.
                    </div>
                  )}
                </div>

                {/* Day Ratio Banner */}
                {selectedDay?.ratioString && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-input)',
                      marginBottom: 12,
                      fontSize: 13,
                      fontWeight: 700,
                      background:
                        selectedDay.attendedCount === selectedDay.heldCount
                          ? 'var(--ok-bg)'
                          : selectedDay.attendedCount === 0
                          ? 'var(--crit-bg)'
                          : 'var(--watch-bg)',
                      color:
                        selectedDay.attendedCount === selectedDay.heldCount
                          ? 'var(--ok-fg)'
                          : selectedDay.attendedCount === 0
                          ? 'var(--crit-fg)'
                          : 'var(--watch-fg)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    Attendance: {selectedDay.attendedCount} of {selectedDay.heldCount} classes attended ({selectedDay.ratioString})
                  </div>
                )}

                {/* Scheduled Sessions Breakdown */}
                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', margin: '0 0 10px' }}>
                  {activeCourse
                    ? `Scheduled Sessions for ${activeCourse.code}`
                    : 'Scheduled Sessions'}
                </h4>
                {!selectedDay?.courses || selectedDay.courses.length === 0 ? (
                  <div
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: 13,
                      padding: 12,
                      background: 'var(--bg)',
                      borderRadius: 'var(--radius-input)',
                    }}
                  >
                    No classes scheduled for this day {activeCourse ? `in ${activeCourse.code}` : ''}.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {selectedDay.courses.map((c, i) => {
                      const isPresent = c.status === 'present';
                      const isScheduled =
                        c.status === 'scheduled' || c.status === 'expected_present';

                      return (
                        <div
                          key={i}
                          style={{
                            padding: 10,
                            background: 'var(--bg)',
                            borderRadius: 'var(--radius-input)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ color: 'var(--ink-900)' }}>{c.course_code}</strong>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-pill)',
                                background: isPresent
                                  ? 'var(--ok-bg)'
                                  : isScheduled
                                  ? 'var(--surface)'
                                  : 'var(--crit-bg)',
                                color: isPresent
                                  ? 'var(--ok-fg)'
                                  : isScheduled
                                  ? 'var(--accent)'
                                  : 'var(--crit-fg)',
                                border: isScheduled ? '1px solid var(--border)' : 'none',
                                textTransform: 'capitalize',
                              }}
                            >
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
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius-pill)',
  padding: '4px 8px',
  fontSize: 13,
  cursor: 'pointer',
  fontWeight: 700,
  color: 'var(--text)',
};

const closeBtnStyle = {
  background: 'none',
  border: 'none',
  fontSize: 16,
  cursor: 'pointer',
  color: 'var(--text-muted)',
};
