import React from 'react';

export default function Card({ children, style, padding = 'var(--space-6)', ...rest }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
        padding,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
