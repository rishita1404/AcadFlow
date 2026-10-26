import { CheckCircle, Eye, AlertTriangle, HeartHandshake, Hourglass } from 'lucide-react';

const BANDS = {
  Safe: {
    label: 'On track',
    Icon: CheckCircle,
    bg: 'var(--ok-bg)',
    fg: 'var(--ok-fg)',
  },
  Watch: {
    label: 'Keep an eye',
    Icon: Eye,
    bg: 'var(--watch-bg)',
    fg: 'var(--watch-fg)',
  },
  'At risk': {
    label: 'Needs attention',
    Icon: AlertTriangle,
    bg: 'var(--risk-bg)',
    fg: 'var(--risk-fg)',
  },
  Critical: {
    label: 'Priority support',
    Icon: HeartHandshake,
    bg: 'var(--crit-bg)',
    fg: 'var(--crit-fg)',
  },
  'Insufficient data': {
    label: 'Not enough data yet',
    Icon: Hourglass,
    bg: 'var(--nodata-bg)',
    fg: 'var(--nodata-fg)',
  },
};

// Normalise backend band values to the canonical set above
function normaliseBand(band) {
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
  if (b === 'critical' || b === 'priority support' || b === 'red') return 'Critical';
  if (
    b === 'no data' ||
    b === 'no_data' ||
    b === 'insufficient data' ||
    b === 'insufficient_data'
  )
    return 'Insufficient data';
  return 'Safe';
}

export default function StatusBadge({ band, status, value, level, size = 'md' }) {
  const raw = band ?? status ?? value ?? level;
  const key = normaliseBand(raw);
  const { label, Icon, bg, fg } = BANDS[key] || BANDS['Insufficient data'];
  const iconSize = size === 'sm' ? 12 : 14;
  const fontSize = size === 'sm' ? 11 : 13;
  const padding = size === 'sm' ? '3px 10px' : '5px 14px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding,
        borderRadius: 'var(--radius-pill)',
        background: bg,
        color: fg,
        fontSize,
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
      title={`Status: ${label}`}
    >
      <Icon size={iconSize} strokeWidth={2.5} />
      {label}
    </span>
  );
}
