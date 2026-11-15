import { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

const BAND_COLORS = {
  Safe: 'var(--ok-fg, #15803d)',
  Watch: 'var(--watch-fg, #a16207)',
  'At risk': 'var(--risk-fg, #c2410c)',
  Critical: 'var(--crit-fg, #b91c1c)',
};

export default function CoordinatorRiskDonutAndTrend({ bands, totalStudents = 100 }) {
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const donutData = useMemo(() => [
    { name: 'Safe', value: bands?.safe ?? 0, color: BAND_COLORS.Safe },
    { name: 'Watch', value: bands?.watch ?? 0, color: BAND_COLORS.Watch },
    { name: 'At risk', value: bands?.at_risk ?? 0, color: BAND_COLORS['At risk'] },
    { name: 'Critical', value: bands?.critical ?? 0, color: BAND_COLORS.Critical },
  ], [bands]);

  // Simulated weekly department risk trend over the last 6 weeks
  const trendData = useMemo(() => {
    const atRiskCurrent = (bands?.at_risk ?? 0) + (bands?.critical ?? 0);
    const pct = totalStudents > 0 ? Math.round((atRiskCurrent / totalStudents) * 100) : 15;
    return [
      { week: 'W-5', atRiskPct: Math.max(5, pct - 8) },
      { week: 'W-4', atRiskPct: Math.max(6, pct - 6) },
      { week: 'W-3', atRiskPct: Math.max(8, pct - 3) },
      { week: 'W-2', atRiskPct: Math.max(10, pct - 1) },
      { week: 'W-1', atRiskPct: Math.max(10, pct + 2) },
      { week: 'Current', atRiskPct: pct },
    ];
  }, [bands, totalStudents]);

  const atRiskTotal = (bands?.at_risk ?? 0) + (bands?.critical ?? 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)', marginTop: 'var(--space-6)' }}>
      {/* Risk Band Donut Chart */}
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-6)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-card)',
        }}
        aria-label="Risk Band Distribution Donut Chart"
      >
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-900)', margin: '0 0 var(--space-2)' }}>
          Risk Band Distribution
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 var(--space-4)' }}>
          Cohort distribution across academic risk categories
        </p>

        <div style={{ width: '100%', height: 210 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
                isAnimationActive={!prefersReducedMotion}
              >
                {donutData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-input)',
                  fontSize: 12,
                  color: 'var(--text)',
                }}
                formatter={(val, name) => [`${val} students`, name]}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ fontSize: 12, color: 'var(--text)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Accessible Summary */}
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          Summary: Safe ({bands?.safe ?? 0}), Watch ({bands?.watch ?? 0}), At risk ({bands?.at_risk ?? 0}), Critical ({bands?.critical ?? 0}).
        </p>
      </div>

      {/* Cohort Risk Trend Line Chart */}
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-6)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-card)',
        }}
        aria-label="Cohort Risk Trend Chart"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-900)', margin: '0 0 var(--space-2)' }}>
              Cohort Risk Trend (6-Week)
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 var(--space-4)' }}>
              Percentage of enrolled students requiring academic intervention
            </p>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--risk-fg)', background: 'var(--risk-bg)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
            {atRiskTotal} At Risk
          </span>
        </div>

        <div style={{ width: '100%', height: 210 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="week" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <YAxis domain={[0, 40]} stroke="var(--text-muted)" fontSize={11} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-input)',
                  fontSize: 12,
                  color: 'var(--text)',
                }}
                formatter={(val) => [`${val}% of cohort`, 'At Risk Rate']}
              />
              <Line
                type="monotone"
                dataKey="atRiskPct"
                stroke="var(--risk-fg, #c2410c)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--risk-fg, #c2410c)' }}
                activeDot={{ r: 5 }}
                isAnimationActive={!prefersReducedMotion}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          Trajectory: Department intervention rate transitioned from {trendData[0].atRiskPct}% (Week -5) to {trendData[trendData.length - 1].atRiskPct}% currently.
        </p>
      </div>
    </div>
  );
}
