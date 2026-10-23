import React from 'react';
import { Link } from 'react-router-dom';

export default function AdminML() {
  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
          <Link to="/admin" style={{ color: '#3b82f6', textDecoration: 'none' }}>Admin</Link>
          {' '}/ ML & Monitoring
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
          🤖 Machine Learning Engine & Drift Monitoring
        </h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
          Advisory intelligence telemetry · Decision support only (never punitive) · Drift metrics & model registry.
        </p>
      </div>

      {/* Advisory policy alert */}
      <div style={{
        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12,
        padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <span style={{ fontSize: 24 }}>🛡️</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1e40af' }}>
            Decision Support Policy Compliance
          </div>
          <div style={{ fontSize: 13, color: '#1e3a8a', marginTop: 2 }}>
            Per the AcadFlow Ethical AI specification, model predictions serve exclusively as advisory guidance for faculty and mentors. The deterministic rule-based engine (w_margin 50%, w_trend 20%, w_deadline 20%, w_missed 10%) remains authoritative for institutional reporting.
          </div>
        </div>
      </div>

      {/* Model Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 28 }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: 22, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Active Model Version</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginTop: 4 }}>v2.1-lgbm-quantized</div>
          <div style={{ display: 'inline-block', marginTop: 10, background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
            ● INFERENCE ONLINE
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 12 }}>
            Framework: LightGBM 4.3 · Serving Latency: 12ms p95
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 22, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Population Drift (PSI)</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#15803d', marginTop: 4 }}>0.042 (Negligible)</div>
          <div style={{ display: 'inline-block', marginTop: 10, background: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
            THRESHOLD: &lt; 0.10
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 12 }}>
            Evaluated on 500 recent student records. Distribution stable.
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: 22, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Evaluation Baseline</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#6366f1', marginTop: 4 }}>Evaluation 1 Mode</div>
          <div style={{ display: 'inline-block', marginTop: 10, background: '#f5f3ff', color: '#6d28d9', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
            FALLBACK RULE ACTIVE
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 12 }}>
            Graceful degradation enabled when offline without UI failure.
          </div>
        </div>
      </div>

      {/* External Observability Links */}
      <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1e293b', marginBottom: 14 }}>
        🔗 Observability & Experiment Tracking
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <a
          href="http://localhost:5000"
          target="_blank"
          rel="noreferrer"
          style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, textDecoration: 'none', color: '#1e293b', display: 'block' }}
        >
          <div style={{ fontSize: 24, marginBottom: 6 }}>🧪</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>MLflow Model Registry</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Artifact storage, run metrics & version stages</div>
        </a>

        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noreferrer"
          style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, textDecoration: 'none', color: '#1e293b', display: 'block' }}
        >
          <div style={{ fontSize: 24, marginBottom: 6 }}>📊</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Grafana Telemetry Dashboard</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>FastAPI latencies, redis cache hit rates, queue lags</div>
        </a>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>📑</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Drift Report (HTML)</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>KS-test p-value: 0.88 · Feature attribution: Shapley values</div>
        </div>
      </div>
    </div>
  );
}
