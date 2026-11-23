import React from 'react';
import { CheckCircle, Eye, AlertTriangle, HeartHandshake, Hourglass } from 'lucide-react';

export const BANDS = {
  Safe: {
    label: 'On track',
    Icon: CheckCircle,
    bg: 'var(--ok-bg, #ecfdf5)',
    fg: 'var(--ok-fg, #065f46)',
    nextStep: 'Maintain your current attendance',
  },
  Watch: {
    label: 'Keep an eye',
    Icon: Eye,
    bg: 'var(--watch-bg, #fefce8)',
    fg: 'var(--watch-fg, #854d0e)',
    nextStep: 'Review upcoming classes and tasks',
  },
  'At risk': {
    label: 'Needs attention',
    Icon: AlertTriangle,
    bg: 'var(--risk-bg, #fffbeb)',
    fg: 'var(--risk-fg, #b45309)',
    nextStep: 'Prioritize upcoming lectures and submissions',
  },
  Critical: {
    label: 'Needs support',
    Icon: HeartHandshake,
    bg: 'var(--crit-bg, #fef2f2)',
    fg: 'var(--crit-fg, #991b1b)',
    nextStep: 'Talk to your mentor',
  },
  'Insufficient data': {
    label: 'Not enough data yet',
    Icon: Hourglass,
    bg: 'var(--nodata-bg, #f1f5f9)',
    fg: 'var(--nodata-fg, #475569)',
    nextStep: 'Awaiting more session data',
  },
};

export const SUGGESTED_STEPS = {
  Safe: 'Maintain your current attendance',
  Watch: 'Review upcoming classes and tasks',
  'At risk': 'Prioritize upcoming lectures and submissions',
  Critical: 'Talk to your mentor',
  'Insufficient data': 'Awaiting more session data',
};

// Normalise backend band values to the canonical set above
export function normaliseBand(band) {
  if (!band) return 'Insufficient data';
  const b = String(band).trim().toLowerCase();
  if (b === 'safe' || b === 'on track' || b === 'on_track' || b === 'green') return 'Safe';
  if (b === 'watch' || b === 'keep an eye' || b === 'yellow') return 'Watch';
  if (
    b === 'at risk' ||
    b === 'at-risk' ||
    b === 'at_risk' ||
    b === 'needs attention' ||
    b === 'danger' ||
    b === 'amber'
  )
    return 'At risk';
  if (
    b === 'critical' ||
    b === 'priority support' ||
    b === 'needs support' ||
    b === 'red'
  )
    return 'Critical';
  if (
    b === 'no data' ||
    b === 'no_data' ||
    b === 'insufficient data' ||
    b === 'insufficient_data'
  )
    return 'Insufficient data';
  return 'Safe';
}

export default function StatusBadge({ band, status, value, level, size = 'md', showNextStep = false }) {
  const raw = band ?? status ?? value ?? level;
  const key = normaliseBand(raw);
  const { label, Icon, bg, fg, nextStep } = BANDS[key] || BANDS['Insufficient data'];
  const iconSize = size === 'sm' ? 12 : 14;
  const fontSize = size === 'sm' ? 11 : 13;
  const padding = size === 'sm' ? '3px 10px' : '5px 14px';

  return (
    <div style={{ display: 'inline-flex', flexDirection: showNextStep ? 'column' : 'row', gap: 4, alignItems: showNextStep ? 'flex-start' : 'center' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding,
          borderRadius: 'var(--radius-pill, 9999px)',
          background: bg,
          color: fg,
          fontSize,
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          border: `1px solid ${fg}20`,
        }}
        title={`Status: ${label} — Next step: ${nextStep}`}
      >
        <Icon size={iconSize} strokeWidth={2.5} />
        {label}
      </span>
      {showNextStep && (
        <span style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', fontStyle: 'italic', paddingLeft: 4 }}>
          Next step: {nextStep}
        </span>
      )}
    </div>
  );
}
