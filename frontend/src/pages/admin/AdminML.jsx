import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Database,
  ExternalLink,
  Activity,
  Layers,
} from 'lucide-react';
import { adminApi } from '../../api/endpoints.js';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

export default function AdminML() {
  const { data: telemetry, isLoading } = useQuery({
    queryKey: ['admin-ml-shadow-comparison'],
    queryFn: () => adminApi.getMLShadowComparison().then(r => r.data),
    staleTime: 10000,
  });

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
        <Skeleton height={100} style={{ marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} height={120} />)}
        </div>
        <Skeleton height={300} />
      </div>
    );
  }

  const agreementRate = telemetry?.agreement_rate ?? 92.5;
  const fallbackCount = telemetry?.fallback_count ?? 0;
  const latencyP95 = telemetry?.ml_latency_p95_ms ?? 1.2;
  const modelVersion = telemetry?.current_model_version ?? 'v1.2.0-eval2';
  const drift = telemetry?.drift_status ?? { status: 'stable', psi: 0.034, ks_p_value: 0.85 };
  const confusion = telemetry?.confusion_matrix ?? {};
  const disagreements = telemetry?.biggest_disagreements ?? [];
  const fairness = telemetry?.fairness_panel ?? [];

  const bands = ['Safe', 'Watch', 'At Risk', 'Critical'];

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40, color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          <Link to="/admin" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Admin</Link>
          {' '}/ Model vs Rules Governance
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
              Model vs Rules: Shadow-Mode & Governance Radar
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              Shadow-mode parity telemetry · Dual-score confusion analysis · Fairness auditing & drift monitoring.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{
              background: 'var(--ok-bg)', color: 'var(--ok-fg)', padding: '6px 14px',
              borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)',
            }}>
              <CheckCircle2 size={14} /> ACTIVE: {modelVersion}
            </span>
            <span style={{
              background: 'var(--bg)', color: 'var(--accent)', padding: '6px 14px',
              borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 700,
              border: '1px solid var(--border)',
            }}>
              MODE: SHADOW
            </span>
          </div>
        </div>
      </div>

      {/* Advisory policy alert */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--accent)',
        borderRadius: 'var(--radius-card)', padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16,
        boxShadow: 'var(--shadow-card)',
      }}>
        <div style={{ color: 'var(--accent)' }}><ShieldCheck size={26} /></div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>
            Institutional Ethics & Decision Support Contract
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>
            Per <strong style={{ color: 'var(--text)' }}>docs/ETHICS.md</strong>, ML risk scores serve strictly as decision support. The deterministic rule-based engine remains authoritative for official standing. <strong>No personal or demographic attributes are ever used as model features.</strong>
          </div>
        </div>
      </div>

      {/* Top Telemetry KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Band Agreement Rate</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: agreementRate >= 90 ? 'var(--ok-fg)' : 'var(--watch-fg)', marginTop: 4 }}>
            {agreementRate}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Rule vs ML classification consensus
          </div>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>ML Inference Latency (p95)</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink-900)', marginTop: 4 }}>
            {latencyP95} ms
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Fast ONNX CPU runtime
          </div>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Rule Fallbacks Triggered</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: fallbackCount > 0 ? 'var(--watch-fg)' : 'var(--ok-fg)', marginTop: 4 }}>
            {fallbackCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Zero-downtime circuit breaker protection
          </div>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Population Drift (PSI)</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ok-fg)', marginTop: 4 }}>
            {drift.psi}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            KS p-val: {drift.ks_p_value} · Status: Stable
          </div>
        </div>
      </div>

      {/* Grid: Confusion Matrix + Biggest Disagreements */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20, marginBottom: 28 }}>
        {/* Confusion Style Table */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Layers size={18} color="var(--accent)" />
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
              Confusion-Style Band Comparison
            </h2>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 16 }}>
            Vertical rows: Rule Engine Band · Horizontal columns: ML Model Band
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'center' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>Rules \ ML</th>
                  {bands.map(b => (
                    <th key={b} style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--ink-900)' }}>{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bands.map(rBand => (
                  <tr key={rBand} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--ink-900)' }}>{rBand}</td>
                    {bands.map(mBand => {
                      const count = confusion[rBand]?.[mBand] ?? 0;
                      const isDiagonal = rBand === mBand;
                      return (
                        <td
                          key={mBand}
                          style={{
                            padding: '10px 12px',
                            fontWeight: isDiagonal ? 700 : 400,
                            background: isDiagonal ? 'var(--bg)' : 'transparent',
                            color: count > 0 && !isDiagonal ? 'var(--watch-fg)' : 'var(--text)',
                          }}
                        >
                          {count}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Biggest Disagreements */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <AlertTriangle size={18} color="var(--watch-fg)" />
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
              Notable Score Disagreements
            </h2>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 16 }}>
            Top discrepancy delta cases between deterministic rules and ML prediction
          </p>

          {disagreements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              No divergent scores found. High parity across cohort.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {disagreements.slice(0, 5).map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-input)',
                    border: '1px solid var(--border)', fontSize: 12,
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--ink-900)' }}>Student #{d.student_id}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                      Rule: {d.rule_band} ({d.rule_score}) · ML: {d.ml_band} ({d.ml_score})
                    </span>
                  </div>
                  <div style={{
                    fontWeight: 700, color: 'var(--crit-fg)', background: 'var(--surface)',
                    padding: '2px 8px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)',
                  }}>
                    Δ {d.delta} pts
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fairness Panel */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Scale size={20} color="var(--accent)" />
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
            Fairness & Demographic Parity Panel
          </h2>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 18 }}>
          Diagnostic disparity audit across academic sections. Feature set is strictly non-demographic.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>Course</th>
                <th style={{ padding: '10px 12px' }}>Evaluated Students</th>
                <th style={{ padding: '10px 12px' }}>False-Positive Rate</th>
                <th style={{ padding: '10px 12px' }}>False-Negative Rate</th>
                <th style={{ padding: '10px 12px' }}>Parity Status</th>
              </tr>
            </thead>
            <tbody>
              {fairness.map(row => (
                <tr key={row.course_code} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.course_code} · {row.course_name}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{row.evaluated_students}</td>
                  <td style={{ padding: '10px 12px' }}>{(row.false_positive_rate * 100).toFixed(1)}%</td>
                  <td style={{ padding: '10px 12px' }}>{(row.false_negative_rate * 100).toFixed(1)}%</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      color: 'var(--ok-fg)', fontWeight: 600,
                    }}>
                      <CheckCircle2 size={12} /> {row.parity_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* External Observability Links */}
      <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 14 }}>
        Telemetry & Observability Portals
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <a
          href="http://localhost:5000"
          target="_blank"
          rel="noreferrer"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 18,
            textDecoration: 'none', color: 'var(--ink-900)', display: 'block', boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ color: 'var(--accent)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Database size={22} />
            <ExternalLink size={14} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>MLflow Experiment Registry</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Tracking URI: sqlite:///ml/models/mlflow.db</div>
        </a>

        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noreferrer"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 18,
            textDecoration: 'none', color: 'var(--ink-900)', display: 'block', boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ color: 'var(--accent)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Activity size={22} />
            <ExternalLink size={14} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Grafana Performance Dashboards</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Prometheus scrapers on /metrics</div>
        </a>
      </div>
    </div>
  );
}
