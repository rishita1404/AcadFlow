import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi, holidayApi } from '../api/endpoints.js';
import { LoadingScreen, ErrorMsg } from './DashboardPage.jsx';

const TODAY = new Date();
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const STATUS_STYLE = {
  present: { bg: '#f0fdf4', color: '#16a34a', icon: '✅' },
  absent:  { bg: '#fef2f2', color: '#dc2626', icon: '❌' },
  late:    { bg: '#fffbeb', color: '#d97706', icon: '⏱' },
  partial: { bg: '#fff7ed', color: '#ea580c', icon: '◑' },
  expected_present: { bg: '#eff6ff', color: '#3b82f6', icon: '🔵' },
  planned_absent:   { bg: '#faf5ff', color: '#9333ea', icon: '📅' },
};

function CalendarGrid({ calData, onMarkHoliday, onUnmarkHoliday, plannedHolidays }) {
  if (!calData) return null;

  // Build 7-column grid (Mon–Sun)
  const firstDay = new Date(calData.year, calData.month - 1, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0
  const cells = Array(startOffset).fill(null).concat(calData.days);
  while (cells.length % 7 !== 0) cells.push(null);

  const holidayDates = new Set(plannedHolidays?.map(h => h.holiday_date) || []);

  return (
    <div>
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        {Object.entries(STATUS_STYLE).map(([key, s]) => (
          <span key={key} style={{
            background: s.bg, color: s.color, border: `1px solid ${s.color}40`,
            borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600,
          }}>
            {s.icon} {key.replace('_', ' ')}
          </span>
        ))}
      </div>

      {/* Week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 11, fontWeight: 700,
            color: '#64748b', padding: '4px 0',
          }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;

          const st = STATUS_STYLE[day.attendance_status] ||
            (day.is_weekend || day.is_institution_holiday
              ? { bg: '#f8fafc', color: '#94a3b8', icon: '—' }
              : { bg: '#fff', color: '#1e293b', icon: '' });

          const isPlanned = holidayDates.has(day.date);
          const isToday = day.is_today;
          const dayNum = parseInt(day.date.split('-')[2]);

          return (
            <div
              key={day.date}
              title={`${day.date} | ${day.attendance_status || 'no session'}`}
              style={{
                background: day.is_institution_holiday ? '#f1f5f9'
                  : day.is_weekend ? '#f8fafc'
                  : st.bg,
                borderRadius: 8, padding: '6px 4px', textAlign: 'center',
                border: isToday ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                cursor: (!day.is_past && !day.is_weekend && !day.is_institution_holiday && day.has_class)
                  ? 'pointer' : 'default',
                minHeight: 54, position: 'relative',
              }}
              onClick={() => {
                if (!day.is_past && !day.is_weekend && !day.is_institution_holiday) {
                  if (isPlanned) onUnmarkHoliday(day.date);
                  else onMarkHoliday(day.date);
                }
              }}
            >
              <div style={{ fontSize: 13, fontWeight: isToday ? 800 : 500, color: isToday ? '#2563eb' : '#1e293b' }}>
                {dayNum}
              </div>
              <div style={{ fontSize: 16, marginTop: 2 }}>
                {day.is_institution_holiday ? '🏛'
                  : day.is_weekend ? ''
                  : isPlanned ? '📅'
                  : st.icon}
              </div>
              {day.has_class && !day.is_past && !day.is_weekend && !day.is_institution_holiday && (
                <div style={{ fontSize: 8, color: '#6366f1', marginTop: 1 }}>TAP TO PLAN</div>
              )}
              {day.attendance_pct_so_far != null && day.is_past && (
                <div style={{
                  position: 'absolute', bottom: 2, right: 3,
                  fontSize: 8, color: '#94a3b8',
                }}>{day.attendance_pct_so_far}%</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [year, setYear] = useState(TODAY.getFullYear());
  const [month, setMonth] = useState(TODAY.getMonth() + 1);
  const qc = useQueryClient();

  const { data: calData, isLoading, error } = useQuery({
    queryKey: ['calendar', year, month],
    queryFn: () => attendanceApi.getCalendar(year, month).then(r => r.data),
  });

  const { data: holidays } = useQuery({
    queryKey: ['holidays'],
    queryFn: () => holidayApi.list().then(r => r.data),
  });

  const markMut = useMutation({
    mutationFn: (d) => holidayApi.mark(d, 'Planned absence'),
    onSuccess: () => { qc.invalidateQueries(['calendar']); qc.invalidateQueries(['holidays']); },
    onError: (e) => alert(e?.response?.data?.detail || 'Already marked or error.'),
  });

  const unmarkMut = useMutation({
    mutationFn: (d) => holidayApi.delete(d),
    onSuccess: () => { qc.invalidateQueries(['calendar']); qc.invalidateQueries(['holidays']); },
  });

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>
        📅 Attendance Calendar
      </h1>
      <p style={{ color: '#64748b', marginBottom: 20, fontSize: 13 }}>
        View past attendance · Plan future holidays · Tap a future class day to mark as planned absence.
      </p>

      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button onClick={prevMonth} style={navBtn}>← Prev</button>
        <h2 style={{ fontSize: 18, fontWeight: 700, minWidth: 180, textAlign: 'center' }}>
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <button onClick={nextMonth} style={navBtn}>Next →</button>
      </div>

      {/* Monthly stats */}
      {calData && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <StatPill icon="✅" label="Attended" val={calData.total_attended_so_far} color="#16a34a" />
          <StatPill icon="📊" label="Held so far" val={calData.total_held_so_far} color="#6366f1" />
          <StatPill icon="%" label="Monthly %" val={calData.monthly_attendance_pct != null ? `${calData.monthly_attendance_pct}%` : 'N/A'}
            color={calData.monthly_attendance_pct >= 75 ? '#16a34a' : '#dc2626'} />
        </div>
      )}

      {isLoading && <LoadingScreen msg="Loading calendar…" />}
      {error && <ErrorMsg msg={error?.response?.data?.detail || error.message} />}

      {calData && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
          <CalendarGrid
            calData={calData}
            plannedHolidays={holidays}
            onMarkHoliday={(d) => markMut.mutate(d)}
            onUnmarkHoliday={(d) => unmarkMut.mutate(d)}
          />
        </div>
      )}

      {/* Planned holidays list */}
      {holidays && holidays.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📅 Your Planned Absences</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {holidays.map(h => (
              <div key={h.id} style={{
                background: '#faf5ff', border: '1px solid #c4b5fd', borderRadius: 8,
                padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>📅 {h.holiday_date}</span>
                {h.reason && <span style={{ color: '#7c3aed' }}>— {h.reason}</span>}
                <button
                  onClick={() => unmarkMut.mutate(h.holiday_date)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn = {
  background: '#f1f5f9', border: '1px solid #e2e8f0',
  borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14,
};

function StatPill({ icon, label, val, color }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color }}>{val}</div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
      </div>
    </div>
  );
}
