export default function DeadlineCollisionWarning({ preview, onApplySuggestedDate }) {
  if (!preview || !preview.has_collision_warning) return null;

  return (
    <div
      role="region"
      aria-label="Deadline Collision Warning"
      style={{
        background: 'var(--risk-bg)',
        border: '1px solid var(--risk-fg)',
        borderRadius: 'var(--radius-input)',
        padding: '12px 14px',
        color: 'var(--risk-fg)',
        fontSize: 13,
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden="true">⚠️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
            High Deadline Density Detected (Advisory)
          </div>
          <div style={{ color: 'var(--ink-900)', fontSize: 12, lineHeight: 1.4, marginBottom: 6 }}>
            {preview.message || `Students in this section already have ${preview.window_count} deadlines scheduled within 7 days of this date.`}
          </div>

          {preview.daily_counts && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
              {Object.entries(preview.daily_counts).map(([dt, count]) => (
                <span
                  key={dt}
                  style={{
                    background: count >= 2 ? 'var(--risk-fg)' : 'rgba(13, 27, 42, 0.08)',
                    color: count >= 2 ? 'var(--on-dark)' : 'var(--ink-900)',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {dt.slice(5)}: {count} due
                </span>
              ))}
            </div>
          )}

          {preview.lightest_nearby_date && onApplySuggestedDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-900)' }}>
                Lightest nearby date: <strong>{preview.lightest_nearby_date}</strong>
              </span>
              <button
                type="button"
                onClick={() => onApplySuggestedDate(preview.lightest_nearby_date)}
                style={{
                  background: 'var(--surface)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent)',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Use suggested date
              </button>
            </div>
          )}

          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            ℹ️ This warning is non-blocking. You may proceed with your selected deadline if necessary.
          </div>
        </div>
      </div>
    </div>
  );
}
