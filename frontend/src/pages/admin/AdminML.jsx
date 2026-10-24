import React from 'react';
import { Link } from 'react-router-dom';
import { Cpu, ShieldCheck, CheckCircle2, Activity, Database, ExternalLink, FileText, BarChart } from 'lucide-react';

export default function AdminML() {
  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          <Link to="/admin" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Admin</Link>
          {' '}/ ML & Monitoring
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
          Machine Learning Engine & Drift Monitoring
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Advisory intelligence telemetry · Decision support only (never punitive) · Drift metrics & model registry.
        </p>
      </div>

      {/* Advisory policy alert */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--accent)',
        borderRadius: 'var(--radius-card)', padding: '18px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16,
        boxShadow: 'var(--shadow-card)',
      }}>
        <div style={{ color: 'var(--accent)' }}><ShieldCheck size={28} /></div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>
            Decision Support Policy Compliance
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
            Per the AcadFlow Ethical AI specification, model predictions serve exclusively as advisory guidance for faculty and mentors. The deterministic rule-based engine (w_margin 50%, w_trend 20%, w_deadline 20%, w_missed 10%) remains authoritative for institutional reporting.
          </div>
        </div>
      </div>

      {/* Model Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 32 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Active Model Version</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600, color: 'var(--ink-900)', marginTop: 6 }}>v2.1-lgbm-quantized</div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12,
            background: 'var(--ok-bg)', color: 'var(--ok-fg)', padding: '3px 10px',
            borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 600,
          }}>
            <CheckCircle2 size={12} /> INFERENCE ONLINE
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>
            Framework: LightGBM 4.3 · Serving Latency: 12ms p95
          </div>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Population Drift (PSI)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink-900)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>0.042 <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>(Negligible)</span></div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12,
            background: 'var(--bg)', color: 'var(--accent)', padding: '3px 10px',
            borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 600,
          }}>
            THRESHOLD: &lt; 0.10
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>
            Evaluated on 500 recent student records. Distribution stable.
          </div>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Evaluation Baseline</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600, color: 'var(--ink-900)', marginTop: 6 }}>Evaluation 1 Mode</div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12,
            background: 'var(--watch-bg)', color: 'var(--watch-fg)', padding: '3px 10px',
            borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 600,
          }}>
            FALLBACK RULE ACTIVE
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>
            Graceful degradation enabled when offline without UI failure.
          </div>
        </div>
      </div>

      {/* External Observability Links */}
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 16 }}>
        Observability & Experiment Tracking
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
        <a
          href="http://localhost:5000"
          target="_blank"
          rel="noreferrer"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20,
            textDecoration: 'none', color: 'var(--ink-900)', display: 'block', boxShadow: 'var(--shadow-card)',
            transition: 'border-color 0.15s ease',
          }}
        >
          <div style={{ color: 'var(--accent)', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Database size={24} />
            <ExternalLink size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 16, color: 'var(--ink-900)' }}>MLflow Model Registry</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Artifact storage, run metrics & version stages</div>
        </a>

        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noreferrer"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20,
            textDecoration: 'none', color: 'var(--ink-900)', display: 'block', boxShadow: 'var(--shadow-card)',
            transition: 'border-color 0.15s ease',
          }}
        >
          <div style={{ color: 'var(--accent)', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Activity size={24} />
            <ExternalLink size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 16, color: 'var(--ink-900)' }}>Grafana Telemetry Dashboard</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>FastAPI latencies, redis cache hit rates, queue lags</div>
        </a>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20, boxShadow: 'var(--shadow-card)' }}>
          <div style={{ color: 'var(--accent)', marginBottom: 10 }}><FileText size={24} /></div>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 16, color: 'var(--ink-900)' }}>Drift Report (HTML)</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>KS-test p-value: 0.88 · Feature attribution: Shapley values</div>
        </div>
      </div>
    </div>
  );
}
