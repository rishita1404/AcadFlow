import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { deadlineApi } from '../api/endpoints.js';
import { LoadingScreen, ErrorMsg } from './DashboardPage.jsx';

const TODAY = new Date();
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

function pressureColor(score) {
  if (score >= 80) return '#dc2626'; // red
  if (score >= 60) return '#ea580c'; // orange
  if (score >= 40) return '#d97706'; // amber
  if (score >= 20) return '#84cc16'; // lime
  return '#22c55e';                   // green
}

function PressureCell({ day }) {
  const color = pressureColor(day.pressure_score);
  const opacity = 0.15 + (day.pressure_score / 100) * 0.85;
  const isWeekend = day.day_type === 'weekend';
  const isHoliday = day.is_institution_holiday;
  const dayNum = parseInt(day.date.split('-')[2]);

  let bgColor = `rgba(${hexToRgb(color)}, ${opacity})`;
  if (isWeekend || isHoliday) bgColor = '#f1f5f9';

  return (
    <div
      title={`${day.date}\nPressure: ${day.pressure_score}/100\n${day.warnings.join('\n')}`}
      style={{
        background: bgColor, borderRadius: 6, padding: '6px 4px', textAlign: 'center',
        border: '1px solid #e2e8f0', minHeight: 64, position: 'relative',
        cursor: day.pressure_score > 0 ? 'help' : 'default',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: isWeekend ? '#94a3b8' : '#1e293b' }}>
        {dayNum}
      </div>

      {!isWeekend && !isHoliday && day.pressure_score > 0 && (
        <div style={{ fontSize: 13, fontWeight: 800, color }}>{day.pressure_score}</div>
      )}

      {isHoliday && <div style={{ fontSize: 14 }}>🏛</div>}

      {day.day_type === 'exam' && <div style={{ fontSize: 10, color: '#7c3aed', fontWeight: 700 }}>EXAM</div>}
      {day.assignments_due?.length > 0 && day.day_type !== 'exam' && (
        <div style={{ fontSize: 9, color, fontWeight: 700 }}>{day.assignments_due.length} DUE</div>
      )}
      {day.must_attend && (
        <div style={{
          position: 'absolute', top: 2, right: 2,
          width: 6, height: 6, borderRadius: '50%', background: '#ef4444',
        }} title="MUST attend!" />
      )}
    </div>
  );
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`
    : '0,0,0';
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
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>
        🌡 Academic Pressure Forecast
      </h1>
      <p style={{ color: '#64748b', marginBottom: 20, fontSize: 13 }}>
        Heatmap showing your daily academic pressure (0–100). <span style={{ color: '#ef4444' }}>Red = high pressure</span> ·{' '}
        <span style={{ color: '#22c55e' }}>Green = light day</span> · 🔴 dot = must attend class.
      </p>

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button onClick={prevMonth} style={navBtn}>← Prev</button>
        <h2 style={{ fontSize: 18, fontWeight: 700, minWidth: 180, textAlign: 'center' }}>
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <button onClick={nextMonth} style={navBtn}>Next →</button>
      </div>

      {isLoading && <LoadingScreen msg="Computing pressure forecast…" />}
      {error && <ErrorMsg msg={error?.response?.data?.detail || error.message} />}

      {/* Summary strip */}
      {data?.summary && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <SumCard icon="📊" label="Avg Pressure" val={`${data.summary.avg_pressure_score}`} color="#6366f1" />
          <SumCard icon="🔴" label="Peak" val={`${data.summary.max_pressure_score} on ${data.summary.max_pressure_date?.slice(5)}`} color="#dc2626" />
          <SumCard icon="🌡" label="High-Pressure Days" val={data.summary.high_pressure_days} color="#ea580c" />
          <SumCard icon="💀" label="Critical Days" val={data.summary.critical_days} color="#dc2626" />
          <SumCard icon="📝" label="Deadlines" val={data.summary.total_deadlines} color="#f59e0b" />
          <SumCard icon="🎯" label="Exams" val={data.summary.total_exams} color="#7c3aed" />
          <SumCard icon="⚠" label="Must-Attend Days" val={data.summary.must_attend_days} color="#ef4444" />
        </div>
      )}

      {/* Pressure scale legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 16, borderRadius: 8, overflow: 'hidden', height: 16, width: 300 }}>
        {[0,20,40,60,80,100].map((v, i, arr) => (
          <div key={v} style={{ flex: 1, background: pressureColor(v + 10), height: '100%' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: 300, fontSize: 10, color: '#94a3b8', marginBottom: 16 }}>
        <span>0 (Low)</span><span>50 (Medium)</span><span>100 (High)</span>
      </div>

      {/* Heatmap grid */}
      {days.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0' }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#64748b' }}>{d}</div>
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
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>⚠ Day-level Warnings This Month</h3>
          {days.filter(d => d.warnings.length > 0).map(d => (
            <div key={d.date} style={{
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
              padding: '10px 16px', marginBottom: 8, fontSize: 13,
            }}>
              <span style={{ fontWeight: 700, color: '#1e293b', marginRight: 12 }}>
                {new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
              <span style={{
                background: pressureColor(d.pressure_score) + '22',
                color: pressureColor(d.pressure_score),
                fontWeight: 700, padding: '2px 8px', borderRadius: 4, marginRight: 10, fontSize: 12,
              }}>
                Pressure: {d.pressure_score}
              </span>
              {d.warnings.map((w, i) => <span key={i} style={{ color: '#64748b', marginRight: 8 }}>{w}</span>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SumCard({ icon, label, val, color }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '10px 14px', minWidth: 110,
    }}>
      <div style={{ fontSize: 16 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{val}</div>
      <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
    </div>
  );
}

const navBtn = {
  background: '#f1f5f9', border: '1px solid #e2e8f0',
  borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14,
};
