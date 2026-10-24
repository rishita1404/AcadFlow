import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, AlertTriangle, Activity, Calendar as CalendarIcon, Clock, CheckCircle2 } from 'lucide-react';
import { deadlineApi } from '../api/endpoints.js';
import { LoadingScreen, ErrorMsg } from './DashboardPage.jsx';

const TODAY = new Date();
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

function pressureColor(score) {
  if (score >= 80) return 'var(--heat-3)';
  if (score >= 50) return 'var(--heat-2)';
  if (score >= 20) return 'var(--heat-1)';
  return 'var(--heat-0)';
}

function pressureTextColor(score) {
  if (score >= 50) return 'var(--on-dark)';
  return 'var(--ink-900)';
}

function PressureCell({ day }) {
  const isWeekend = day.day_type === 'weekend';
  const isHoliday = day.is_institution_holiday;
  const dayNum = parseInt(day.date.split('-')[2]);

  let bgColor = pressureColor(day.pressure_score);
  let fgColor = pressureTextColor(day.pressure_score);

  if (isWeekend || isHoliday) {
    bgColor = 'var(--bg)';
    fgColor = 'var(--text-muted)';
  }

  return (
    <div
      title={`${day.date}\nPressure: ${day.pressure_score}/100\n${day.warnings.join('\n')}`}
      style={{
        background: bgColor, borderRadius: 'var(--radius-input)', padding: '8px 4px', textAlign: 'center',
        border: '1px solid var(--border)', minHeight: 64, position: 'relative',
        cursor: day.pressure_score > 0 ? 'help' : 'default',
        color: fgColor,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {dayNum}
      </div>

      {!isWeekend && !isHoliday && day.pressure_score > 0 && (
        <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
          {day.pressure_score}
        </div>
      )}

      {isHoliday && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Holiday</div>}

      {day.day_type === 'exam' && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}>EXAM</div>}
      {day.assignments_due?.length > 0 && day.day_type !== 'exam' && (
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.04em' }}>{day.assignments_due.length} DUE</div>
      )}
      {day.must_attend && (
        <div style={{
          position: 'absolute', top: 4, right: 4,
          width: 6, height: 6, borderRadius: '50%', background: 'var(--must-attend)',
        }} title="MUST attend!" />
      )}
    </div>
  );
}

export default function PressurePage() {
  const [year, setYear] = useState(TODAY.getFullYear());
  const [month, setMonth] = useState(TODAY.getMonth() + 1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['pressure', year, month],
    queryFn: () => deadlineApi.getPressureForecast(year, month).then(r => r.data),
  });

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Build calendar grid with blank offset
  const days = data?.days || [];
  const firstDate = days[0]?.date;
  let startOffset = 0;
  if (firstDate) {
    const d = new Date(firstDate);
    startOffset = (d.getDay() + 6) % 7;
  }
  const cells = Array(startOffset).fill(null).concat(days);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', paddingBottom: 40 }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
        Academic Pressure Forecast
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14, marginTop: 4 }}>
        Heatmap showing your daily academic pressure (0–100). Slate = high pressure · Cream = light day · Dot = must attend.
      </p>

      {/* Month navigation */}
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

      {isLoading && <LoadingScreen msg="Computing pressure forecast…" />}
      {error && <ErrorMsg msg={error?.response?.data?.detail || error.message} />}

      {/* Summary strip */}
      {data?.summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
          <SumCard label="Avg Pressure" val={`${data.summary.avg_pressure_score}`} color="var(--accent)" />
          <SumCard label="Peak" val={`${data.summary.max_pressure_score}`} color="var(--crit-fg)" />
          <SumCard label="High-Pressure" val={data.summary.high_pressure_days} color="var(--risk-fg)" />
          <SumCard label="Critical Days" val={data.summary.critical_days} color="var(--crit-fg)" />
          <SumCard label="Deadlines" val={data.summary.total_deadlines} color="var(--watch-fg)" />
          <SumCard label="Exams" val={data.summary.total_exams} color="var(--accent)" />
          <SumCard label="Must-Attend" val={data.summary.must_attend_days} color="var(--crit-fg)" />
        </div>
      )}

      {/* Pressure scale legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 8, borderRadius: 'var(--radius-pill)', overflow: 'hidden', height: 14, width: 300, border: '1px solid var(--border)' }}>
        {['var(--heat-0)', 'var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)'].map((bg, i) => (
          <div key={i} style={{ flex: 1, background: bg, height: '100%' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: 300, fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>
        <span>0 (Low)</span><span>50 (Moderate)</span><span>100 (High)</span>
      </div>

      {/* Heatmap grid */}
      {days.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {cells.map((day, i) =>
              day ? <PressureCell key={day.date} day={day} /> : <div key={`e-${i}`} />
            )}
          </div>
        </div>
      )}

      {/* Warning list for high-pressure days */}
      {days.filter(d => d.warnings.length > 0).length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 14 }}>
            Day-level Warnings This Month
          </h3>
          {days.filter(d => d.warnings.length > 0).map(d => (
            <div key={d.date} style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)',
              padding: '12px 18px', marginBottom: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: 'var(--shadow-card)',
            }}>
              <span style={{ fontWeight: 600, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>
                {new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
              <span style={{
                background: pressureColor(d.pressure_score),
                color: pressureTextColor(d.pressure_score),
                fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontSize: 11, fontVariantNumeric: 'tabular-nums',
              }}>
                Pressure: {d.pressure_score}
              </span>
              <div style={{ color: 'var(--text)', flex: 1 }}>
                {d.warnings.map((w, i) => <span key={i} style={{ marginRight: 8 }}>{w}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SumCard({ label, val, color }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)',
      padding: '12px 16px', boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{val}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>{label}</div>
    </div>
  );
}

const navBtn = {
  background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-900)',
  borderRadius: 'var(--radius-pill)', padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  display: 'inline-flex', alignItems: 'center',
};
