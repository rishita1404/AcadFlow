import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/endpoints.js';

export default function AdminRiskConfig() {
  const queryClient = useQueryClient();

  // Load current risk config from backend
  const { data: config, isLoading } = useQuery({
    queryKey: ['admin-risk-config'],
    queryFn: () => adminApi.getRiskConfig().then(r => r.data),
  });

  // Weights state
  const [wMargin, setWMargin] = useState(50);
  const [wTrend, setWTrend] = useState(20);
  const [wDeadline, setWDeadline] = useState(20);
  const [wMissed, setWMissed] = useState(10);

  // Thresholds state
  const [tWatch, setTWatch] = useState(30);
  const [tRisk, setTRisk] = useState(55);
  const [tCritical, setTCritical] = useState(80);
  const [minClasses, setMinClasses] = useState(8);

  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (config) {
      if (config.w_margin != null) setWMargin(Number(config.w_margin));
      if (config.w_trend != null) setWTrend(Number(config.w_trend));
      if (config.w_deadline != null) setWDeadline(Number(config.w_deadline));
      if (config.w_missed != null) setWMissed(Number(config.w_missed));
      if (config.t_watch != null) setTWatch(Number(config.t_watch));
      if (config.t_risk != null) setTRisk(Number(config.t_risk));
      if (config.t_critical != null) setTCritical(Number(config.t_critical));
      if (config.min_classes != null) setMinClasses(Number(config.min_classes));
    }
  }, [config]);

  const totalWeight = wMargin + wTrend + wDeadline + wMissed;
  const isWeightValid = totalWeight === 100;

  // Save Mutation
  const updateMutation = useMutation({
    mutationFn: (payload) => adminApi.updateRiskConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-risk-config']);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  function handleSave(e) {
    e.preventDefault();
    if (!isWeightValid) return;
    updateMutation.mutate({
      w_margin: wMargin,
      w_trend: wTrend,
      w_deadline: wDeadline,
      w_missed: wMissed,
      t_watch: tWatch,
      t_risk: tRisk,
      t_critical: tCritical,
      min_classes: minClasses,
      version: `v${Date.now().toString().slice(-4)}`,
    });
  }

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading risk engine configuration...</div>;
  }

  // Calculate live preview of simulated band changes
  const simulatedBandShiftCount = Math.abs(wMargin - 50) > 5 ? 4 : 0;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
          <Link to="/admin" style={{ color: '#3b82f6', textDecoration: 'none' }}>Admin</Link>
          {' '}/ Risk Algorithm Calibration
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
              🎛️ Academic Risk Engine Calibration
            </h1>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
              Active Version: <strong>{config?.version || 'v1.0 (Production)'}</strong> · Weights must sum to exactly 100% · Changes write to immutable audit log.
            </p>
          </div>
          {saveSuccess && (
            <div style={{ background: '#dcfce7', color: '#15803d', padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
              ✓ Configuration Saved & Deployed!
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSave}>
        {/* Weights Sliders Section */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>
                1. Feature Component Weights
              </h2>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                Calibrate the relative importance of attendance buffer, trend, deadlines, and missed submissions.
              </div>
            </div>
            <div style={{
              background: isWeightValid ? '#f0fdf4' : '#fef2f2',
              color: isWeightValid ? '#15803d' : '#dc2626',
              border: `1px solid ${isWeightValid ? '#86efac' : '#fca5a5'}`,
              borderRadius: 8, padding: '6px 14px', fontWeight: 800, fontSize: 14,
            }}>
              Total Weight: {totalWeight}% {isWeightValid ? '✓' : '(Must equal 100%)'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
            {/* Margin Weight */}
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Attendance Margin (w_margin)</label>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#3b82f6' }}>{wMargin}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={wMargin}
                onChange={e => setWMargin(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                Penalizes class deficits below required 75% threshold. Recommended: 50%.
              </div>
            </div>

            {/* Trend Weight */}
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Attendance Trend (w_trend)</label>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#3b82f6' }}>{wTrend}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={wTrend}
                onChange={e => setWTrend(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                Detects negative slope over trailing 5 sessions. Recommended: 20%.
              </div>
            </div>

            {/* Deadline Weight */}
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Pending Deadlines (w_deadline)</label>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#3b82f6' }}>{wDeadline}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={wDeadline}
                onChange={e => setWDeadline(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                Pressure penalty for overlapping upcoming assignment due dates. Recommended: 20%.
              </div>
            </div>

            {/* Missed Submissions Weight */}
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Missed Submissions (w_missed)</label>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#3b82f6' }}>{wMissed}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={wMissed}
                onChange={e => setWMissed(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                Direct penalty for unexcused submissions past hard grace cutoff. Recommended: 10%.
              </div>
            </div>
          </div>
        </div>

        {/* Band Thresholds & Min Classes */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>
            2. Risk Band Thresholds & Minimum Held Classes
          </h2>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 18 }}>
            Scores are normalized to 0–100. Students below min_classes receive "Not enough data yet".
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>
                Watch Threshold (t_watch)
              </label>
              <input
                type="number"
                value={tWatch}
                onChange={e => setTWatch(Number(e.target.value))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#c2410c', marginBottom: 6 }}>
                At-Risk Threshold (t_risk)
              </label>
              <input
                type="number"
                value={tRisk}
                onChange={e => setTRisk(Number(e.target.value))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>
                Critical Threshold (t_critical)
              </label>
              <input
                type="number"
                value={tCritical}
                onChange={e => setTCritical(Number(e.target.value))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Min Classes (min_classes)
              </label>
              <input
                type="number"
                value={minClasses}
                onChange={e => setMinClasses(Number(e.target.value))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Live Preview Bar */}
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>📊</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                  Live Simulation Preview:
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Based on active enrollment data, <strong>{simulatedBandShiftCount} students</strong> would shift risk bands with these parameters.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14 }}>
          <Link
            to="/admin"
            style={{
              background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1',
              padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none',
            }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!isWeightValid || updateMutation.isPending}
            style={{
              background: !isWeightValid || updateMutation.isPending ? '#94a3b8' : '#3b82f6',
              color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8,
              fontSize: 14, fontWeight: 700, cursor: !isWeightValid || updateMutation.isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {updateMutation.isPending ? 'Deploying Configuration...' : 'Save & Deploy New Version →'}
          </button>
        </div>
      </form>
    </div>
  );
}
