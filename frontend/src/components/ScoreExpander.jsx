import { useState } from 'react';

export default function ScoreExpander({
  score: _score,
  lastComputedAt,
  band: _band,
  formulaDetails,
  inputs,
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: '8px', fontSize: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
        <span>
          Last computed: {lastComputedAt ? new Date(lastComputedAt).toLocaleString() : 'Recently'}
        </span>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            padding: 0,
            textDecoration: 'underline',
          }}
        >
          {open ? 'Hide details' : 'Why? (Formula & Inputs)'}
        </button>
      </div>

      {open && (
        <div style={{
          marginTop: '8px',
          padding: '12px',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-input)',
          color: 'var(--ink-900)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>
            Formula Breakdown (Max 100):
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Risk Score = Margin (50) + Trend (20) + Deadlines (20) + Missed (10)
          </div>
          {formulaDetails && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '11px' }}>
              <div>Margin Component: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formulaDetails.margin ?? '—'} / 50</strong></div>
              <div>Trend Component: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formulaDetails.trend ?? '—'} / 20</strong></div>
              <div>Deadlines Component: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formulaDetails.deadlines ?? '—'} / 20</strong></div>
              <div>Missed Component: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formulaDetails.missed ?? '—'} / 10</strong></div>
            </div>
          )}
          {inputs && (
            <div style={{ marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <div>Attended: {inputs.attended} | Held: {inputs.held} | Total: {inputs.total_classes}</div>
              <div>Buffer: <strong style={{ color: 'var(--ink-900)' }}>{inputs.buffer ?? 'N/A'}</strong> (Remaining: {inputs.remaining})</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
