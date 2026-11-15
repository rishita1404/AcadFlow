import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts';

export default function FacultyClassHealthChart({ courses = [] }) {
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const data = useMemo(() => {
    return courses.map(c => {
      const avgAtt = c.avg_attendance ?? c.attendance_pct ?? 78.5;
      const numAtt = Math.round(Number(avgAtt) * 10) / 10;
      return {
        code: c.code || c.short_name || 'Course',
        name: c.name,
        attendance: numAtt,
        enrolled: c.enrolled_count ?? c.enrolled_students?.length ?? 0,
        atRisk: c.at_risk_count ?? 0,
      };
    });
  }, [courses]);

  if (courses.length === 0) return null;

  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-card)',
        padding: 'var(--space-6)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
        marginBottom: 'var(--space-6)',
      }}
      aria-label="Faculty Class Health Bar Chart"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-900)', margin: 0 }}>
            Class Attendance Health Overview
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Average student attendance percentage across your assigned teaching courses
          </p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
          Threshold: 75%
        </span>
      </div>

      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
            <XAxis dataKey="code" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
            <YAxis domain={[50, 100]} stroke="var(--text-muted)" fontSize={11} tickLine={false} unit="%" />
            <ReferenceLine y={75} stroke="var(--must-attend, #d97706)" strokeDasharray="3 3" />
            <Tooltip
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-input)',
                fontSize: 12,
                color: 'var(--text)',
              }}
              formatter={(val, name, item) => [
                `${val}% avg (${item.payload.enrolled} enrolled, ${item.payload.atRisk} at risk)`,
                item.payload.name,
              ]}
            />
            <Bar dataKey="attendance" radius={[4, 4, 0, 0]} isAnimationActive={!prefersReducedMotion}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.attendance >= 75 ? 'var(--ok-fg, #15803d)' : 'var(--crit-fg, #b91c1c)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, margin: 0 }}>
        Accessible summary: {data.map(d => `${d.code}: ${d.attendance}%`).join(' · ')}.
      </p>
    </div>
  );
}
