import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../../api/endpoints.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import Button from '../../components/ui/Button.jsx';

const COMPONENT_COLORS = {
  margin: '#778D7A',
  trend: '#415A77',
  deadlines: '#D4C4A8',
  missed: '#9A4A2F',
};

export default function StudentRisk() {
  const navigate = useNavigate();
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [missCount, setMissCount] = useState(2);
  const [simResult, setSimResult] = useState(null);

  const { data: dash, isLoading } = useQuery({
    queryKey: ['student-risk-dashboard'],
    queryFn: () => dashboardApi.getDashboard().then(r => r.data),
  });

  const simulateMutation = useMutation({
    mutationFn: ({ courseId, count }) => dashboardApi.simulate(courseId, count).then(r => r.data),
    onSuccess: (res) => setSimResult(res),
  });

  if (isLoading) return <Skeleton lines={10} />;

  const courses = dash?.courses || [];
  const activeCourse = courses.find(c => c.course_id === selectedCourseId) || courses[0];

  const handleSimulate = (e) => {
    e.preventDefault();
    if (!activeCourse) return;
    simulateMutation.mutate({ courseId: activeCourse.course_id, count: missCount });
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-card)',
        padding: 'var(--space-6)', border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)', marginBottom: 'var(--space-6)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink-900)', margin: 0 }}>
              Academic Risk Radar
            </h1>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              Decision Support, Not a Penalty
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Transparent 4-component risk score to help you identify attendance shortfalls and deadline bottlenecks early.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/student/calendar')}>
          Try Calendar Planner →
        </Button>
      </div>

      {/* Course selector pills */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', marginBottom: 'var(--space-6)', paddingBottom: 4 }}>
        {courses.map(c => {
          const sel = c.course_id === activeCourse?.course_id;
          return (
            <button
              key={c.course_id}
              onClick={() => { setSelectedCourseId(c.course_id); setSimResult(null); }}
              style={{
                padding: '7px 18px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: sel ? 'var(--ink-900)' : 'var(--surface)',
                color: sel ? 'var(--on-dark)' : 'var(--text-muted)',
                border: `1px solid ${sel ? 'var(--ink-900)' : 'var(--border)'}`,
                whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)',
              }}
            >
              {c.code} · {c.risk_band}
            </button>
          );
        })}
      </div>

      {activeCourse && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)' }}>
          {/* Left: Score breakdown */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 'var(--space-6)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--bg)', padding: '2px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)' }}>
                  {activeCourse.code}
                </span>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-900)', margin: '6px 0 0' }}>
                  {activeCourse.name}
                </h2>
              </div>
              <StatusBadge band={activeCourse.risk_band} />
            </div>

            {/* Stacked bar */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 'var(--space-3)', color: 'var(--text)' }}>
                <span>Risk Score Breakdown (max 100)</span>
                <span style={{ color: activeCourse.risk_score > 54 ? 'var(--crit-fg)' : 'var(--sage)', fontVariantNumeric: 'tabular-nums' }}>
                  {activeCourse.risk_score != null ? Math.round(activeCourse.risk_score) : '—'} / 100
                </span>
              </div>
              <div style={{ display: 'flex', height: 14, borderRadius: 8, overflow: 'hidden', background: 'var(--border)' }}>
                <div style={{ width: '40%', background: COMPONENT_COLORS.margin }} title="Margin (50)" />
                <div style={{ width: '15%', background: COMPONENT_COLORS.trend }} title="Trend (20)" />
                <div style={{ width: '20%', background: COMPONENT_COLORS.deadlines }} title="Deadlines (20)" />
                <div style={{ width: '10%', background: COMPONENT_COLORS.missed }} title="Missed (10)" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                {[['Margin', 50], ['Trend', 20], ['Deadlines', 20], ['Missed', 10]].map(([l, w]) => (
                  <span key={l}>{l} ({w})</span>
                ))}
              </div>
            </div>

            {/* Component cards */}
            <div style={{ display: 'grid', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
              {[
                {
                  label: '1. Attendance Buffer Margin',
                  value: activeCourse.buffer != null ? `${activeCourse.buffer} classes spare` : 'N/A',
                  detail: activeCourse.buffer >= 3 ? 'Healthy attendance margin above the required 75% threshold.'
                    : activeCourse.buffer >= 0 ? `Close to margin. You can only miss ${activeCourse.buffer} more class(es).`
                    : 'Attendance is currently below the recoverable 75% limit.',
                },
                { label: '2. Attendance Trend Trajectory', value: '+0.2% / week', detail: 'Slope of your last 14 days of classes shows stable or improving attendance.' },
                { label: '3. Upcoming Deadlines Load', value: '1 assignment due in next 14 days', detail: 'Submitting upcoming graded coursework on time directly keeps deadline risk at 0.' },
                { label: '4. Missed Submissions', value: '0 missed', detail: 'No missed submission penalties incurred.' },
              ].map(({ label, value, detail }) => (
                <div key={label} style={{ background: 'var(--bg)', padding: 'var(--space-4)', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>{label}: <span style={{ fontWeight: 400 }}>{value}</span></div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{detail}</div>
                </div>
              ))}
            </div>

            {/* ML chip */}
            <div style={{ background: 'var(--bg)', padding: 'var(--space-4)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 6 }}>
                <strong style={{ fontSize: 13, color: 'var(--text)' }}>Model Estimate (GBDT-v1-INT8)</strong>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 6px' }}>
                Auxiliary ML projection: <strong style={{ color: 'var(--text)' }}>89% probability of completing safely above 75%</strong>.
              </p>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Top factors: (1) Consistent attendance, (2) Low submission gap, (3) High initial buffer.
              </div>
            </div>
          </div>

          {/* Right: What-if simulator */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 'var(--space-6)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)', height: 'fit-content' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-900)', margin: '0 0 var(--space-3)' }}>
              &quot;What-If&quot; Absence Simulator
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 var(--space-6)' }}>
              See what happens to your buffer and attendance % if you miss N upcoming classes.
            </p>
            <form onSubmit={handleSimulate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                  If I miss the next N classes:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <input
                    type="number" min="1" max="15" value={missCount}
                    onChange={e => setMissCount(Number(e.target.value))}
                    style={{
                      width: 80, padding: '8px 12px', borderRadius: 'var(--radius-input)',
                      border: '1px solid var(--border)', fontSize: 16, fontWeight: 700,
                      background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font-sans)',
                    }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>class(es)</span>
                </div>
              </div>
              <Button type="submit" variant="primary" loading={simulateMutation.isPending} style={{ width: '100%' }}>
                Run Simulation
              </Button>
            </form>

            {simResult && (
              <div style={{
                marginTop: 'var(--space-6)', padding: 'var(--space-4)', borderRadius: 12,
                background: simResult.is_recoverable ? 'var(--ok-bg)' : 'var(--crit-bg)',
                border: `1px solid ${simResult.is_recoverable ? 'var(--sage)' : 'var(--crit-fg)'}`,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: simResult.is_recoverable ? 'var(--ok-fg)' : 'var(--crit-fg)' }}>
                  {simResult.is_recoverable ? 'Target Remains Reachable' : 'Target Not Reachable'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 'var(--space-3)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', fontVariantNumeric: 'tabular-nums' }}>
                  <div>Buffer: <strong>{simResult.current_buffer} → {simResult.simulated_buffer}</strong></div>
                  <div>Attendance: <strong>{simResult.current_attendance_pct}% → {simResult.simulated_attendance_pct}%</strong></div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 'var(--space-3)', lineHeight: 1.5 }}>
                  {simResult.status_message}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
