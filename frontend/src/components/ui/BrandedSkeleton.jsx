import { Skeleton } from './Skeleton.jsx';

export default function BrandedSkeleton({ message = 'Loading AcadFlow...' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        width: '100%',
        padding: 'var(--space-8)',
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg, 16px)',
          padding: 'var(--space-8)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontFamily: 'var(--font-serif)',
              fontSize: 20,
            }}
          >
            A
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 18, color: 'var(--ink-900)' }}>
              AcadFlow
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-500, #78716c)' }}>
              {message}
            </div>
          </div>
        </div>

        <Skeleton lines={4} gap={12} />
      </div>
    </div>
  );
}
