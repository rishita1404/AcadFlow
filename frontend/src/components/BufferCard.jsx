import React from 'react';
import { ShieldCheck, AlertCircle, Hourglass } from 'lucide-react';

/**
 * BufferCard: Displays the required attendance target and the student's reserve cushion.
 *
 * Headline: "Classes you must attend to stay eligible" (still_need)
 * Secondary line: "Your cushion: N classes, kept in reserve for illness and emergencies"
 * If cushion is negative, displays "Not recoverable by attendance alone", never an error.
 */
export default function BufferCard({
  stillNeed,
  buffer,
  insufficientData = false,
  compact = false,
  className = '',
  style = {},
}) {
  const isNegative = buffer != null && buffer < 0;
  const isZero = buffer === 0;

  // Determine secondary message
  let secondaryMessage = '';
  let secondaryColor = 'var(--text-muted)';
  let Icon = ShieldCheck;

  if (insufficientData) {
    secondaryMessage = 'Not enough data yet';
    secondaryColor = 'var(--text-muted)';
    Icon = Hourglass;
  } else if (isNegative) {
    secondaryMessage = 'Not recoverable by attendance alone';
    secondaryColor = 'var(--crit-fg, #b91c1c)';
    Icon = AlertCircle;
  } else {
    secondaryMessage = `Your cushion: ${buffer ?? 0} class${buffer === 1 ? '' : 'es'}, kept in reserve for illness and emergencies`;
    secondaryColor = isZero ? 'var(--risk-fg, #d97706)' : 'var(--sage, #2b6e4f)';
    Icon = ShieldCheck;
  }

  const headlineValue = insufficientData
    ? '—'
    : stillNeed != null
    ? stillNeed
    : '—';

  return (
    <div
      className={className}
      style={{
        background: 'var(--bg, #f8fafc)',
        borderRadius: 'var(--radius-input, 8px)',
        border: '1px solid var(--border, #e2e8f0)',
        padding: compact ? '8px 12px' : '12px 16px',
        ...style,
      }}
    >
      <div
        style={{
          fontSize: compact ? 10 : 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--text-muted, #64748b)',
        }}
      >
        Classes you must attend to stay eligible
      </div>
      <div
        style={{
          fontSize: compact ? 18 : 22,
          fontWeight: 800,
          color: 'var(--ink-900, #0f172a)',
          fontVariantNumeric: 'tabular-nums',
          marginTop: 2,
          lineHeight: 1.2,
        }}
      >
        {headlineValue}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 4,
          fontSize: compact ? 11 : 12,
          fontWeight: 500,
          color: secondaryColor,
        }}
      >
        <Icon size={compact ? 13 : 15} color={secondaryColor} />
        <span>{secondaryMessage}</span>
      </div>
    </div>
  );
}
