

/** BufferGauge: shows how many classes a student can still miss */
export default function BufferGauge({ buffer, small = false }) {
  if (buffer == null) {
    return (
      <span style={{ color: 'var(--text-muted)', fontSize: small ? 11 : 13, fontStyle: 'italic' }}>
        No data
      </span>
    );
  }

  const isNeg = buffer < 0;
  const isZero = buffer === 0;

  const color = isNeg ? 'var(--crit-fg)' : isZero ? 'var(--risk-fg)' : buffer <= 2 ? 'var(--risk-fg)' : 'var(--sage)';
  const label = isNeg
    ? `${Math.abs(buffer)} behind`
    : `${buffer} spare`;

  const barWidth = Math.min(Math.abs(buffer) * 12, 100);

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, minWidth: small ? 60 : 80 }}>
      <span style={{
        fontSize: small ? 12 : 14,
        fontWeight: 700,
        color,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}>
        {label}
      </span>
      <div style={{
        height: small ? 3 : 4,
        width: 64,
        background: 'var(--border)',
        borderRadius: 999,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${barWidth}%`,
          background: color,
          borderRadius: 999,
          transition: 'width 0.4s',
        }} />
      </div>
    </div>
  );
}
