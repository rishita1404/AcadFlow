import React from 'react';

function SkeletonBox({ width = '100%', height = 20, radius = 8, style }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite linear',
      ...style,
    }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );
}

export function Skeleton({ lines = 3, gap = 8 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox key={i} width={i === lines - 1 ? '70%' : '100%'} height={16} />
      ))}
    </div>
  );
}

export function SkeletonCard({ height = 120 }) {
  return <SkeletonBox height={height} radius={16} />;
}

export function EmptyState({ icon, title, message, action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-12) var(--space-8)',
      textAlign: 'center',
    }}>
      {icon && <div style={{ fontSize: 40, marginBottom: 'var(--space-4)', opacity: 0.5 }}>{icon}</div>}
      <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-900)', marginBottom: 'var(--space-2)' }}>
        {title}
      </h3>
      {message && <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 380 }}>{message}</p>}
      {action && <div style={{ marginTop: 'var(--space-6)' }}>{action}</div>}
    </div>
  );
}

export function ErrorState({ message, retry }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-12) var(--space-8)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 36, marginBottom: 'var(--space-4)' }}>⚠️</div>
      <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--crit-fg)', marginBottom: 'var(--space-2)' }}>
        Something went wrong
      </h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 380 }}>{message || 'An unexpected error occurred.'}</p>
      {retry && (
        <button
          onClick={retry}
          style={{
            marginTop: 'var(--space-6)',
            padding: '8px 20px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}
