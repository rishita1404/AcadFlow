import { useState } from 'react';

/**
 * BufferGauge: Visual progress bar and headroom indicator.
 * Displays:
 * 1. "Can miss N more classes" or "Not recoverable by attendance alone"
 * 2. Labelled bar with a 75% marker and "X of Y classes remaining"
 * 3. Accessible tooltip on hover/focus
 */
export default function BufferGauge({
  buffer,
  remaining = null,
  small = false,
  showDetail = true,
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (buffer == null) {
    return (
      <span style={{ color: 'var(--text-muted)', fontSize: small ? 11 : 13, fontStyle: 'italic' }}>
        No data
      </span>
    );
  }

  const isNeg = buffer < 0;
  const isTight = buffer >= 0 && buffer <= 2;

  // Primary buffer text per product contract
  const primaryText = isNeg
    ? 'Not recoverable by attendance alone'
    : `Can miss ${buffer} more ${buffer === 1 ? 'class' : 'classes'}`;

  // High-contrast WCAG AA colors
  const textColor = isNeg
    ? 'var(--crit-fg)'
    : isTight
    ? 'var(--must-attend)'
    : '#1E3F20'; // high-contrast dark forest green (> 7:1 against light surfaces)

  const barFillColor = isNeg
    ? 'var(--crit-fg)'
    : isTight
    ? 'var(--must-attend)'
    : 'var(--sage)';

  const tooltipText =
    'You need 75% to sit the exam. This is how many remaining classes you can skip and still reach it.';

  // Calculate filled ratio for gauge bar (capped between 5% and 100%)
  const remCount = remaining != null && remaining > 0 ? remaining : 20;
  const safeClasses = Math.max(0, buffer);
  const fillPct = Math.min(100, Math.max(8, Math.round((safeClasses / remCount) * 100)));

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 4,
        position: 'relative',
        minWidth: small ? 100 : 140,
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={0}
      role="region"
      aria-label={`Attendance buffer: ${primaryText}. ${tooltipText}`}
    >
      {/* Primary buffer label */}
      <div
        style={{
          fontSize: small ? 12 : 13,
          fontWeight: 700,
          color: textColor,
          lineHeight: 1.25,
          fontFamily: 'var(--font-sans)',
        }}
      >
        {primaryText}
      </div>

      {/* Labelled bar with 75% marker */}
      <div
        style={{
          position: 'relative',
          height: small ? 6 : 8,
          width: '100%',
          background: 'rgba(212, 196, 168, 0.45)', // var(--sand) with opacity
          borderRadius: 'var(--radius-pill)',
          overflow: 'visible',
          marginTop: 2,
        }}
      >
        {/* Filled progress */}
        <div
          style={{
            height: '100%',
            width: isNeg ? '100%' : `${fillPct}%`,
            background: barFillColor,
            borderRadius: 'var(--radius-pill)',
            transition: 'width 0.3s ease',
          }}
        />

        {/* 75% threshold marker */}
        <div
          title="75% Requirement Marker"
          style={{
            position: 'absolute',
            top: -2,
            bottom: -2,
            left: '75%',
            width: 2,
            background: 'var(--ink-900)',
            borderRadius: 1,
            zIndex: 2,
          }}
        />
      </div>

      {/* Subtext: "X of Y classes remaining" */}
      {showDetail && remaining != null && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text)',
            opacity: 0.85,
            fontWeight: 500,
            marginTop: 2,
          }}
        >
          {isNeg ? (
            <span>0 of {remaining} classes remaining</span>
          ) : (
            <span>
              {safeClasses} of {remaining} classes remaining
            </span>
          )}
        </div>
      )}

      {/* Accessible Tooltip */}
      {showTooltip && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            background: 'var(--ink-900)',
            color: 'var(--on-dark)',
            padding: '6px 10px',
            borderRadius: 8,
            fontSize: 11,
            lineHeight: 1.3,
            width: 200,
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(13,27,42,0.2)',
            zIndex: 100,
            pointerEvents: 'none',
          }}
        >
          {tooltipText}
        </div>
      )}
    </div>
  );
}
