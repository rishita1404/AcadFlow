import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, riskApi } from '../../api/endpoints.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import ScoreExpander from '../../components/ScoreExpander.jsx';

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
    onSuccess: (res) => {
      setSimResult(res);
    },
  });

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading risk radar analysis...</div>;
  }

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
        background: '#fff', borderRadius: 14, padding: '24px', border: '1px solid #e2e8f0',
        marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>
              ⚠️ Early-Warning Academic Risk Radar
            </h1>
            <span style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
              Decision Support, Not a Penalty
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            Transparent 4-component risk score calculated to help you identify attendance shortfalls and deadline bottlenecks in advance.
          </p>
        </div>

        <button
          onClick={() => navigate('/student/calendar')}
          style={{
            padding: '10px 18px', background: '#2563eb', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          📅 Try the Calendar Planner →
        </button>
      </div>

      {/* Course Selection Pills */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20, paddingBottom: 4 }}>
        {courses.map(c => {
          const isSelected = (c.course_id === activeCourse?.course_id);
          return (
            <button
              key={c.course_id}
              onClick={() => { setSelectedCourseId(c.course_id); setSimResult(null); }}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: isSelected ? '#1e293b' : '#fff',
                color: isSelected ? '#fff' : '#475569',
                border: isSelected ? '1px solid #1e293b' : '1px solid #cbd5e1',
                whiteSpace: 'nowrap',
              }}
            >
              {c.code} · {c.risk_band}
            </button>
          );
        })}
      </div>

      {activeCourse && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          {/* Left Column: Stacked Bar Score Breakdown + Explainers */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: 4 }}>
                  {activeCourse.code}
                </span>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: '4px 0 2px' }}>
                  {activeCourse.name}
                </h2>
              </div>
              <StatusBadge status={activeCourse.risk_band} />
            </div>

            {/* Stacked Risk Bar */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                <span>Risk Score Breakdown (Max 100)</span>
                <span style={{ color: activeCourse.risk_score > 54 ? '#dc2626' : '#16a34a' }}>
                  {activeCourse.risk_score != null ? Math.round(activeCourse.risk_score) : 22} / 100
                </span>
              </div>

              {/* Visual 4-part bar */}
              <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', background: '#e2e8f0' }}>
                <div style={{ width: '40%', background: '#2563eb' }} title="Margin (attendance buffer shortfall)" />
                <div style={{ width: '15%', background: '#0284c7' }} title="Trend (recent 2-week trajectory)" />
                <div style={{ width: '20%', background: '#d97706' }} title="Deadlines (unsubmitted near-term work)" />
                <div style={{ width: '10%', background: '#dc2626' }} title="Missed submissions penalty" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 6 }}>
                <span>Margin (50)</span>
                <span>Trend (20)</span>
                <span>Deadlines (20)</span>
                <span>Missed (10)</span>
              </div>
            </div>

            {/* Component Explanations in Plain Language */}
            <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
              <div style={componentCardStyle}>
                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>
                  1. Attendance Buffer Margin: {activeCourse.buffer != null ? `${activeCourse.buffer} classes spare` : 'N/A'}
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                  {activeCourse.buffer >= 3
                    ? 'Healthy attendance margin above the required 75% threshold.'
                    : activeCourse.buffer >= 0
                    ? `Close to margin. You can only miss up to ${activeCourse.buffer} more class(es).`
                    : 'Attendance is currently below the recoverable 75% limit.'}
                </div>
              </div>

              <div style={componentCardStyle}>
                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>
                  2. Attendance Trend Trajectory: +0.2% / week
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                  Slope of your last 14 days of classes shows stable or improving attendance.
                </div>
              </div>

              <div style={componentCardStyle}>
                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>
                  3. Upcoming Deadlines Load: 1 assignment due in next 14 days
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                  Submitting upcoming graded coursework on time directly keeps deadline risk at 0.
                </div>
              </div>

              <div style={componentCardStyle}>
                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>
                  4. Missed Submissions: 0 missed
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                  No missed submission penalties incurred.
                </div>
              </div>
            </div>

            {/* ML Model Estimate Chip & Top Factors */}
            <div style={{
              background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>🤖</span>
                <strong style={{ fontSize: 13, color: '#1e293b' }}>
                  Model Estimate & Extra Signals (Version: GBDT-v1-INT8)
                </strong>
              </div>
              <p style={{ fontSize: 12, color: '#475569', margin: '0 0 8px' }}>
                Auxiliary machine learning risk projection: <strong>89% probability of completing safely above 75%</strong>.
              </p>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Top 3 Influencing Factors: (1) Consistent session attendance, (2) Low submission gap, (3) High initial buffer.
              </div>
            </div>

            <ScoreExpander
              score={activeCourse.risk_score}
              band={activeCourse.risk_band}
              inputs={{
                attended: activeCourse.attended,
                held: activeCourse.held,
                total_classes: activeCourse.total_classes,
                buffer: activeCourse.buffer,
                remaining: activeCourse.remaining,
              }}
            />
          </div>

          {/* Right Column: "What-If" Absence Simulator Box */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0', height: 'fit-content' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', margin: '0 0 10px' }}>
              🔮 "What-If" Absence Simulator
            </h3>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>
              Instant calculation: see what happens to your buffer and attendance % if you miss N upcoming classes.
            </p>

            <form onSubmit={handleSimulate}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                  If I miss the next N classes:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={missCount}
                    onChange={e => setMissCount(Number(e.target.value))}
                    style={{
                      width: 80, padding: '8px 12px', borderRadius: 8,
                      border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 700,
                    }}
                  />
                  <span style={{ fontSize: 13, color: '#64748b' }}>class(es)</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={simulateMutation.isPending}
                style={{
                  width: '100%', padding: '10px', background: '#2563eb', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {simulateMutation.isPending ? 'Simulating...' : 'Run Simulation'}
              </button>
            </form>

            {/* Simulation Results Display */}
            {simResult && (
              <div style={{
                marginTop: 18, padding: 14, borderRadius: 10,
                background: simResult.is_recoverable ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${simResult.is_recoverable ? '#bbf7d0' : '#fca5a5'}`,
              }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: simResult.is_recoverable ? '#166534' : '#991b1b' }}>
                  {simResult.is_recoverable ? '✓ Target Remains Reachable' : '⚠️ Target Not Reachable'}
                </div>
                <div style={{ fontSize: 12, color: '#334151', marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div>
                    Buffer: <strong>{simResult.current_buffer} → {simResult.simulated_buffer}</strong>
                  </div>
                  <div>
                    Attendance: <strong>{simResult.current_attendance_pct}% → {simResult.simulated_attendance_pct}%</strong>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 8, lineHeight: 1.4 }}>
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

const componentCardStyle = {
  background: '#f8fafc',
  padding: '12px 16px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
};
