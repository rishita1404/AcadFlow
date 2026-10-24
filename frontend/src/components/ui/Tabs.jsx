import React, { useState } from 'react';

export default function Tabs({ tabs, defaultTab, style }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key);

  return (
    <div style={style}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: 2,
        background: 'var(--bg)',
        borderRadius: 'var(--radius-pill)',
        padding: 4,
        width: 'fit-content',
        border: '1px solid var(--border)',
        marginBottom: 'var(--space-6)',
      }}>
        {tabs.map(({ key, label, badge }) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              onClick={() => setActive(key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 18px',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                fontFamily: 'var(--font-sans)',
                background: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? 'var(--on-dark)' : 'var(--text-muted)',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
              {badge != null && badge > 0 && (
                <span style={{
                  background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--accent)',
                  color: isActive ? '#fff' : 'var(--on-dark)',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  lineHeight: 1.4,
                }}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      {tabs.find(t => t.key === active)?.content}
    </div>
  );
}
