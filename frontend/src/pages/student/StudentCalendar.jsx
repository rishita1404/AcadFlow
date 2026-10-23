import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi, holidayApi, planApi, deadlineApi, courseApi } from '../../api/endpoints.js';
import StatusBadge from '../../components/StatusBadge.jsx';

const STATUS_COLORS = {
  present: '#16a34a',
  late: '#d97706',
  absent: '#dc2626',
  holiday: '#7c3aed',
  planned_absence: '#ea580c',
  scheduled: '#2563eb',
};

export default function StudentCalendar() {
  const qc = useQueryClient();
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(11); // November 2026
  const [mode, setMode] = useState('attendance'); // 'attendance' | 'pressure'
  const [courseFilter, setCourseFilter] = useState('all');
  const [planMode, setPlanMode] = useState(false);
  const [plannedDates, setPlannedDates] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  // Queries
  const { data: coursesData } = useQuery({
    queryKey: ['courses-list'],
    queryFn: () => courseApi.list().then(r => r.data.items || r.data),
  });

  const { data: calData, isLoading: loadingCal } = useQuery({
    queryKey: ['calendar-view', year, month],
    queryFn: () => attendanceApi.getCalendar(year, month).then(r => r.data),
  });

  const { data: pressureData } = useQuery({
    queryKey: ['pressure-view', year, month],
    queryFn: () => deadlineApi.getPressureForecast(year, month).then(r => r.data).catch(() => null),
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ['student-holidays'],
    queryFn: () => holidayApi.list().then(r => r.data).catch(() => []),
  });

  // Planner Projection Mutation
  const { data: planProjection, mutate: computeProjection } = useMutation({
    mutationFn: (dates) => planApi.projectLeavePlan(dates).then(r => r.data),
  });

  const savePlannedAbsences = useMutation({
    mutationFn: async (dates) => {
      for (const d of dates) {
        await holidayApi.mark(d, 'Planned leave from planner');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-view'] });
      qc.invalidateQueries({ queryKey: ['student-holidays'] });
      alert('Planned leave saved successfully!');
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
    <div style={{ maxWidth: 1440, margin: '0 auto' }}>
      {/* Header & Controls */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid #e2e8f0',
        marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>
            📅 Academic Calendar & Leave Planner
          </h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            View past attendance history, academic pressure heatmap, and plan future absences with live buffer projection.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Mode Switch */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 8 }}>
            <button
              onClick={() => setMode('attendance')}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: mode === 'attendance' ? '#fff' : 'transparent',
                color: mode === 'attendance' ? '#2563eb' : '#64748b',
                boxShadow: mode === 'attendance' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Attendance View
            </button>
            <button
              onClick={() => setMode('pressure')}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: mode === 'pressure' ? '#fff' : 'transparent',
                color: mode === 'pressure' ? '#2563eb' : '#64748b',
                boxShadow: mode === 'pressure' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Pressure Forecast
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
                padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: planMode ? '1px solid #2563eb' : '1px solid #cbd5e1',
                background: planMode ? '#2563eb' : '#fff',
                color: planMode ? '#fff' : '#334151',
              }}
            >
              {planMode ? '✓ Planning Mode Active' : '✏️ Plan Leaves Mode'}
            </button>
          )}

          {/* Month Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', padding: '4px 8px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <button onClick={handlePrevMonth} style={navBtnStyle}>←</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', minWidth: 120, textAlign: 'center' }}>
              {monthName} {year}
            </span>
            <button onClick={handleNextMonth} style={navBtnStyle}>→</button>
          </div>
        </div>
      </div>

      {/* Main Layout: Grid Calendar + Docked Side Panel (Planner or Drawer) */}
      <div style={{ display: 'grid', gridTemplateColumns: planMode || selectedDay ? '2.5fr 1.2fr' : '1fr', gap: 20 }}>
        {/* Calendar Area */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
          {/* Weekday Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#64748b', padding: '6px 0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid Cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {calendarCells.map((d, idx) => {
              if (!d) return <div key={`empty-${idx}`} style={{ minHeight: 90, background: '#f8fafc', borderRadius: 8 }} />;

              const dateStr = getCellDateStr(d);
              const dayData = dayMap[dateStr];
              const isToday = new Date().toISOString().slice(0, 10) === dateStr;
              const isPast = new Date(dateStr) < new Date(new Date().setHours(0, 0, 0, 0));
              const isPlanned = plannedDates.includes(dateStr);
              const isSelected = selectedDay?.date === dateStr;

              // Determine color / status
              let bg = '#fff';
              let borderColor = '#e2e8f0';
              let badgeText = '';
              let badgeColor = '#64748b';

              if (dayData?.is_holiday) {
                bg = '#f5f3ff';
                borderColor = '#ddd6fe';
                badgeText = 'Holiday';
                badgeColor = '#7c3aed';
              } else if (isPlanned) {
                bg = '#ffedd5';
                borderColor = '#fdba74';
                badgeText = 'Planned Leave';
                badgeColor = '#ea580c';
              } else if (mode === 'pressure') {
                const score = dayData?.pressure_score || 0;
                if (score >= 6) { bg = '#fee2e2'; borderColor = '#fca5a5'; badgeText = `High (${score})`; badgeColor = '#dc2626'; }
                else if (score >= 3) { bg = '#fef3c7'; borderColor = '#fde68a'; badgeText = `Med (${score})`; badgeColor = '#d97706'; }
                else if (score > 0) { bg = '#f0fdf4'; borderColor = '#bbf7d0'; badgeText = `Low (${score})`; badgeColor = '#16a34a'; }
              } else if (isPast && dayData?.courses?.length > 0) {
                const statuses = dayData.courses.map(c => c.status);
                if (statuses.includes('absent')) {
                  bg = '#fef2f2'; borderColor = '#fca5a5'; badgeText = 'Absent'; badgeColor = '#dc2626';
                } else if (statuses.includes('late')) {
                  bg = '#fffbeb'; borderColor = '#fde68a'; badgeText = 'Late'; badgeColor = '#d97706';
                } else {
                  bg = '#f0fdf4'; borderColor = '#bbf7d0'; badgeText = 'Present'; badgeColor = '#16a34a';
                }
              }

              return (
                <div
                  key={d}
                  onClick={() => {
                    if (planMode && !isPast && !dayData?.is_holiday) {
                      togglePlannedDate(dateStr);
                    } else {
                      setSelectedDay(dayData ? { ...dayData, date: dateStr } : { date: dateStr, courses: [] });
                    }
                  }}
                  style={{
                    minHeight: 90,
                    borderRadius: 8,
                    padding: 8,
                    background: bg,
                    border: isSelected ? '2px solid #2563eb' : `1px solid ${borderColor}`,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: isSelected ? '0 0 0 2px #93c5fd' : 'none',
                    transition: 'all 0.1s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: 13, fontWeight: 700,
                      color: isToday ? '#2563eb' : '#1e293b',
                      background: isToday ? '#eff6ff' : 'transparent',
                      padding: isToday ? '2px 6px' : 0, borderRadius: 4,
                    }}>
                      {d}
                    </span>
                    {dayData?.must_attend && (
                      <span style={{ fontSize: 9, background: '#ef4444', color: '#fff', padding: '1px 4px', borderRadius: 3, fontWeight: 700 }}>
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
                    <span style={{ fontSize: 10, color: '#64748b' }}>
                      {dayData?.courses?.length ? `${dayData.courses.length} class(es)` : ''}
                    </span>
                    {dayData?.assignments_due > 0 && (
                      <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>
                        ⏰ {dayData.assignments_due} due
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Calendar Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 12, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', fontSize: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_COLORS.present }} /> Present (Late counts as present)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_COLORS.absent }} /> Absent
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_COLORS.holiday }} /> Institutional Holiday
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_COLORS.planned_absence }} /> Planned Leave (Projection)
            </span>
          </div>
        </div>

        {/* Docked Side Panel: Leave Planner OR Day Drawer */}
        {(planMode || selectedDay) && (
          <div style={{
            background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0',
            display: 'flex', flexDirection: 'column', maxHeight: '82vh', overflowY: 'auto',
          }}>
            {planMode ? (
              /* Docked Live Planner Panel */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', margin: 0 }}>
                    📝 Leave Planner Simulation
                  </h3>
                  <button onClick={() => setPlanMode(false)} style={closeBtnStyle}>✕</button>
                </div>

                <div style={{
                  background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0',
                  fontSize: 12, color: '#475569', marginBottom: 14,
                }}>
                  Click future days on the calendar to mark planned leaves.
                  <div style={{ fontWeight: 600, color: '#2563eb', marginTop: 4 }}>
                    Label: Projection, not your official status.
                  </div>
                </div>

                <div style={{ marginBottom: 14, fontSize: 13 }}>
                  Marked Leaves: <strong>{plannedDates.length} day(s)</strong>
                </div>

                {/* Per Course Live Projection */}
                {planProjection?.courses?.map(cp => (
                  <div
                    key={cp.course_id}
                    style={{
                      background: cp.is_recoverable ? '#f8fafc' : '#fef2f2',
                      border: `1px solid ${cp.is_recoverable ? '#e2e8f0' : '#fca5a5'}`,
                      borderRadius: 10, padding: 12, marginBottom: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13, color: '#1e293b' }}>{cp.code}</strong>
                      <StatusBadge status={cp.projected_band} />
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <div>Projected Attendance: <strong>{cp.projected_final_percent}%</strong></div>
                      <div>Spare Misses Left: <strong style={{ color: cp.spare_misses_left < 0 ? '#dc2626' : '#16a34a' }}>{cp.spare_misses_left ?? '—'}</strong></div>
                    </div>
                    <div style={{ fontSize: 11, color: cp.is_recoverable ? '#64748b' : '#dc2626', marginTop: 6 }}>
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
                      padding: '10px', background: plannedDates.length > 0 ? '#16a34a' : '#cbd5e1',
                      color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    💾 Save Plan to Profile
                  </button>
                  <button
                    onClick={() => {
                      setPlannedDates([]);
                      computeProjection([]);
                    }}
                    style={{
                      padding: '8px', background: '#f1f5f9', color: '#475569',
                      border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    ↺ Reset Leaves
                  </button>
                </div>
              </div>
            ) : (
              /* Right-side Day Details Drawer */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', margin: 0 }}>
                    📅 Day Details: {selectedDay?.date}
                  </h3>
                  <button onClick={() => setSelectedDay(null)} style={closeBtnStyle}>✕</button>
                </div>

                {selectedDay?.is_holiday && (
                  <div style={{ padding: 12, background: '#f5f3ff', borderRadius: 8, color: '#7c3aed', fontWeight: 600, marginBottom: 12, fontSize: 13 }}>
                    🎉 Institutional Holiday: {selectedDay.holiday_label || 'University Holiday'}
                  </div>
                )}

                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 10px' }}>
                  Scheduled Sessions
                </h4>
                {selectedDay?.courses?.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: 13, padding: 12 }}>No classes on this day.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {selectedDay.courses.map((c, i) => (
                      <div key={i} style={{ padding: 10, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>{c.course_code}</strong>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                            background: c.status === 'present' ? '#dcfce7' : c.status === 'late' ? '#fef3c7' : '#fee2e2',
                            color: c.status === 'present' ? '#15803d' : c.status === 'late' ? '#b45309' : '#dc2626',
                            textTransform: 'capitalize',
                          }}>
                            {c.status}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          {c.course_name}
                        </div>
                      </div>
                    ))}
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
  background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4,
  padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 700,
};

const closeBtnStyle = {
  background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#94a3b8',
};
