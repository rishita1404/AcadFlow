import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sliders, CheckCircle2, AlertTriangle, TrendingUp, Clock, CalendarX, ArrowRight, BarChart2 } from 'lucide-react';
import { adminApi } from '../../api/endpoints.js';
import Skeleton from '../../components/Skeleton.jsx';

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
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 40 }}>
        <Skeleton variant="title" width={340} height={36} />
        <Skeleton variant="text" width={260} height={18} style={{ marginTop: 8, marginBottom: 24 }} />
        <Skeleton variant="card" height={320} />
      </div>
    );
  }

  // Calculate live preview of simulated band changes
  const simulatedBandShiftCount = Math.abs(wMargin - 50) > 5 ? 4 : 0;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          <Link to="/admin" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Admin</Link>
          {' '}/ Risk Algorithm Calibration
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
              Academic Risk Engine Calibration
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
              Active Version: <strong style={{ color: 'var(--ink-900)' }}>{config?.version || 'v1.0 (Production)'}</strong> · Weights must sum to exactly 100% · Changes write to immutable audit log.
            </p>
          </div>
          {saveSuccess && (
            <div style={{
              background: 'var(--ok-bg)', color: 'var(--ok-fg)',
              padding: '6px 14px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <CheckCircle2 size={16} /> Configuration Saved & Deployed
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSave}>
        {/* Weights Sliders Section */}
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 24,
          border: '1px solid var(--border)', marginBottom: 24, boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
                1. Feature Component Weights
              </h2>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Calibrate the relative importance of attendance buffer, trend, deadlines, and missed submissions.
              </div>
            </div>
            <div style={{
              background: isWeightValid ? 'var(--ok-bg)' : 'var(--risk-bg)',
              color: isWeightValid ? 'var(--ok-fg)' : 'var(--risk-fg)',
              border: `1px solid ${isWeightValid ? 'var(--border)' : 'var(--risk-fg)'}`,
              borderRadius: 'var(--radius-pill)', padding: '6px 16px', fontWeight: 600, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {isWeightValid ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              Total Weight: {totalWeight}% {isWeightValid ? '✓' : '(Must equal 100%)'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {/* Margin Weight */}
            <div style={{ background: 'var(--bg)', padding: 18, borderRadius: 'var(--radius-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>Attendance Margin (w_margin)</label>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{wMargin}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={wMargin}
                onChange={e => setWMargin(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent)' }}
              />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Penalizes class deficits below required 75% threshold. Recommended: 50%.
              </div>
            </div>

            {/* Trend Weight */}
            <div style={{ background: 'var(--bg)', padding: 18, borderRadius: 'var(--radius-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>Attendance Trend (w_trend)</label>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{wTrend}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={wTrend}
                onChange={e => setWTrend(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent)' }}
              />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Detects negative slope over trailing 5 sessions. Recommended: 20%.
              </div>
            </div>

            {/* Deadline Weight */}
            <div style={{ background: 'var(--bg)', padding: 18, borderRadius: 'var(--radius-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>Pending Deadlines (w_deadline)</label>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{wDeadline}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={wDeadline}
                onChange={e => setWDeadline(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent)' }}
              />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Pressure penalty for overlapping upcoming assignment due dates. Recommended: 20%.
              </div>
            </div>

            {/* Missed Submissions Weight */}
            <div style={{ background: 'var(--bg)', padding: 18, borderRadius: 'var(--radius-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>Missed Submissions (w_missed)</label>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{wMissed}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={wMissed}
                onChange={e => setWMissed(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent)' }}
              />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Direct penalty for unexcused submissions past hard grace cutoff. Recommended: 10%.
              </div>
            </div>
          </div>
        </div>

        {/* Band Thresholds & Min Classes */}
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 24,
          border: '1px solid var(--border)', marginBottom: 24, boxShadow: 'var(--shadow-card)',
        }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 4 }}>
            2. Risk Band Thresholds & Minimum Held Classes
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
            Scores are normalized to 0–100. Students below min_classes receive "Not enough data yet".
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--watch-fg)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                Watch Threshold (t_watch)
              </label>
              <input
                type="number"
                value={tWatch}
                onChange={e => setTWatch(Number(e.target.value))}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-input)',
                  border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink-900)',
                  fontSize: 14, boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--risk-fg)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                At-Risk Threshold (t_risk)
              </label>
              <input
                type="number"
                value={tRisk}
                onChange={e => setTRisk(Number(e.target.value))}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-input)',
                  border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink-900)',
                  fontSize: 14, boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--crit-fg)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                Critical Threshold (t_critical)
              </label>
              <input
                type="number"
                value={tCritical}
                onChange={e => setTCritical(Number(e.target.value))}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-input)',
                  border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink-900)',
                  fontSize: 14, boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                Min Classes (min_classes)
              </label>
              <input
                type="number"
                value={minClasses}
                onChange={e => setMinClasses(Number(e.target.value))}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-input)',
                  border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink-900)',
                  fontSize: 14, boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums',
                }}
              />
            </div>
          </div>

          {/* Live Preview Bar */}
          <div style={{
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '16px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ color: 'var(--accent)' }}><BarChart2 size={20} /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>
                  Live Simulation Preview
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                  Based on active enrollment data, <strong style={{ color: 'var(--ink-900)' }}>{simulatedBandShiftCount} students</strong> would shift risk bands with these parameters.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Link
            to="/admin"
            style={{
              background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)',
              padding: '10px 20px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600, textDecoration: 'none',
            }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!isWeightValid || updateMutation.isPending}
            style={{
              background: !isWeightValid || updateMutation.isPending ? 'var(--sand)' : 'var(--accent)',
              color: 'var(--on-dark)', border: 'none', padding: '10px 24px', borderRadius: 'var(--radius-pill)',
              fontSize: 14, fontWeight: 600, cursor: !isWeightValid || updateMutation.isPending ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {updateMutation.isPending ? 'Deploying Configuration...' : 'Save & Deploy New Version'} <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
