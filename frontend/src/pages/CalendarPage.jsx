import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Clock, Calendar as CalendarIcon, ArrowLeft, ArrowRight, X } from 'lucide-react';
import { attendanceApi, holidayApi } from '../api/endpoints.js';
import { LoadingScreen, ErrorMsg } from './DashboardPage.jsx';

const TODAY = new Date();
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const STATUS_STYLE = {
  present: { bg: 'var(--ok-bg)', color: 'var(--ok-fg)', icon: CheckCircle2 },
  absent:  { bg: 'var(--crit-bg)', color: 'var(--crit-fg)', icon: XCircle },
  late:    { bg: 'var(--watch-bg)', color: 'var(--watch-fg)', icon: Clock },
  partial: { bg: 'var(--risk-bg)', color: 'var(--risk-fg)', icon: Clock },
  expected_present: { bg: 'var(--bg)', color: 'var(--accent)', icon: CheckCircle2 },
  planned_absent:   { bg: 'var(--surface)', color: 'var(--ink-900)', icon: CalendarIcon },
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
        {Object.entries(STATUS_STYLE).map(([key, s]) => {
          const IconC = s.icon;
          return (
            <span key={key} style={{
              background: s.bg, color: s.color, border: '1px solid var(--border)',
              borderRadius: 'var(--radius-pill)', padding: '4px 10px', fontSize: 11, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 4, letterSpacing: '0.04em', textTransform: 'capitalize',
            }}>
              <IconC size={12} /> {key.replace('_', ' ')}
            </span>
          );
        })}
      </div>

      {/* Week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 11, fontWeight: 600,
            color: 'var(--text-muted)', padding: '6px 0', textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;

          const st = STATUS_STYLE[day.attendance_status] ||
            (day.is_weekend || day.is_institution_holiday
              ? { bg: 'var(--bg)', color: 'var(--text-muted)' }
              : { bg: 'var(--surface)', color: 'var(--ink-900)' });

          const isPlanned = holidayDates.has(day.date);
          const isToday = day.is_today;
          const dayNum = parseInt(day.date.split('-')[2]);

          return (
            <div
              key={day.date}
              title={`${day.date} | ${day.attendance_status || 'no session'}`}
              style={{
                background: day.is_institution_holiday ? 'var(--bg)'
                  : day.is_weekend ? 'var(--bg)'
                  : st.bg,
                borderRadius: 'var(--radius-input)', padding: '8px 6px', textAlign: 'center',
                border: isToday ? '2px solid var(--accent)' : '1px solid var(--border)',
                cursor: (!day.is_past && !day.is_weekend && !day.is_institution_holiday && day.has_class)
                  ? 'pointer' : 'default',
                minHeight: 58, position: 'relative',
              }}
              onClick={() => {
                if (!day.is_past && !day.is_weekend && !day.is_institution_holiday) {
                  if (isPlanned) onUnmarkHoliday(day.date);
                  else onMarkHoliday(day.date);
                }
              }}
            >
              <div style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--accent)' : 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>
                {dayNum}
              </div>
              <div style={{ fontSize: 11, marginTop: 4, fontWeight: 600, color: st.color }}>
                {day.is_institution_holiday ? 'Holiday'
                  : day.is_weekend ? ''
                  : isPlanned ? 'Planned'
                  : day.attendance_status || ''}
              </div>
              {day.has_class && !day.is_past && !day.is_weekend && !day.is_institution_holiday && (
                <div style={{ fontSize: 8, color: 'var(--accent)', marginTop: 2, fontWeight: 600 }}>TAP TO PLAN</div>
              )}
              {day.attendance_pct_so_far != null && day.is_past && (
                <div style={{
                  position: 'absolute', bottom: 3, right: 4,
                  fontSize: 9, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums',
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
    <div style={{ maxWidth: 1080, margin: '0 auto', paddingBottom: 40 }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
        Attendance Calendar
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14, marginTop: 4 }}>
        View past attendance · Plan future holidays · Tap a future class day to mark as planned absence.
      </p>

      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button onClick={prevMonth} style={navBtn}>
          <ArrowLeft size={14} style={{ marginRight: 4 }} /> Prev
        </button>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, minWidth: 180, textAlign: 'center', color: 'var(--ink-900)', margin: 0 }}>
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <button onClick={nextMonth} style={navBtn}>
          Next <ArrowRight size={14} style={{ marginLeft: 4 }} />
        </button>
      </div>

      {/* Monthly stats */}
      {calData && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
          <StatPill label="Attended" val={calData.total_attended_so_far} color="var(--ok-fg)" />
          <StatPill label="Held so far" val={calData.total_held_so_far} color="var(--accent)" />
          <StatPill label="Monthly %" val={calData.monthly_attendance_pct != null ? `${calData.monthly_attendance_pct}%` : 'N/A'}
            color={calData.monthly_attendance_pct >= 75 ? 'var(--ok-fg)' : 'var(--crit-fg)'} />
        </div>
      )}

      {isLoading && <LoadingScreen msg="Loading calendar…" />}
      {error && <ErrorMsg msg={error?.response?.data?.detail || error.message} />}

      {calData && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
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
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 12 }}>
            Your Planned Absences
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {holidays.map(h => (
              <div key={h.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)',
                padding: '6px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontWeight: 600, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>{h.holiday_date}</span>
                {h.reason && <span style={{ color: 'var(--text-muted)' }}>— {h.reason}</span>}
                <button
                  onClick={() => unmarkMut.mutate(h.holiday_date)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--crit-fg)', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn = {
  background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-900)',
  borderRadius: 'var(--radius-pill)', padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  display: 'inline-flex', alignItems: 'center',
};

function StatPill({ label, val, color }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)',
      padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--shadow-card)',
    }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{val}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      </div>
    </div>
  );
}
