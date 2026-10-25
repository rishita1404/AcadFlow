import { Fragment } from 'react';
import { Check } from 'lucide-react';

export default function Stepper({ steps, current }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      width: '100%',
      marginBottom: 'var(--space-8)',
    }}>
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <Fragment key={step}>
            {/* Step node */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
              <div style={{
                width: 32, height: 32,
                borderRadius: '50%',
                background: done ? 'var(--sage)' : active ? 'var(--accent)' : 'var(--surface)',
                border: `2px solid ${done ? 'var(--sage)' : active ? 'var(--accent)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: done || active ? 'var(--on-dark)' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 700,
                transition: 'all 0.2s',
              }}>
                {done ? <Check size={16} strokeWidth={3} /> : i + 1}
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--text)' : 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}>
                {step}
              </span>
            </div>
            {/* Connector */}
            {i < steps.length - 1 && (
              <div style={{
                flex: 1,
                height: 2,
                background: i < current ? 'var(--sage)' : 'var(--border)',
                marginBottom: 22,
                transition: 'background 0.2s',
              }} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
