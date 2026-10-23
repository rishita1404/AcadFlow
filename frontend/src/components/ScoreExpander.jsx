import React, { useState } from 'react';

export default function ScoreExpander({
  score,
  lastComputedAt,
  band,
  formulaDetails,
  inputs,
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: '8px', fontSize: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b' }}>
        <span>
          Last computed: {lastComputedAt ? new Date(lastComputedAt).toLocaleString() : 'Recently'}
        </span>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          style={{
            background: 'none',
            border: 'none',
            color: '#2563eb',
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
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          color: '#334151',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>
            Formula Breakdown (Max 100):
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
            Risk Score = Margin (50) + Trend (20) + Deadlines (20) + Missed (10)
          </div>
          {formulaDetails && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '11px' }}>
              <div>Margin Component: <strong>{formulaDetails.margin ?? '—'} / 50</strong></div>
              <div>Trend Component: <strong>{formulaDetails.trend ?? '—'} / 20</strong></div>
              <div>Deadlines Component: <strong>{formulaDetails.deadlines ?? '—'} / 20</strong></div>
              <div>Missed Component: <strong>{formulaDetails.missed ?? '—'} / 10</strong></div>
            </div>
          )}
          {inputs && (
            <div style={{ marginTop: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '6px', fontSize: '11px' }}>
              <div>Attended: {inputs.attended} | Held: {inputs.held} | Total: {inputs.total_classes}</div>
              <div>Buffer: <strong>{inputs.buffer ?? 'N/A'}</strong> (Remaining: {inputs.remaining})</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
