import React from 'react';

const STATUS_CONFIG = {
  safe: {
    label: 'On track',
    icon: '🟢',
    bg: '#f0fdf4',
    text: '#15803d',
    border: '#86efac',
  },
  'on track': {
    label: 'On track',
    icon: '🟢',
    bg: '#f0fdf4',
    text: '#15803d',
    border: '#86efac',
  },
  watch: {
    label: 'Keep an eye',
    icon: '🟡',
    bg: '#fffbeb',
    text: '#b45309',
    border: '#fcd34d',
  },
  'keep an eye': {
    label: 'Keep an eye',
    icon: '🟡',
    bg: '#fffbeb',
    text: '#b45309',
    border: '#fcd34d',
  },
  at_risk: {
    label: 'Needs attention',
    icon: '🟠',
    bg: '#fff7ed',
    text: '#c2410c',
    border: '#fdba74',
  },
  'at risk': {
    label: 'Needs attention',
    icon: '🟠',
    bg: '#fff7ed',
    text: '#c2410c',
    border: '#fdba74',
  },
  'needs attention': {
    label: 'Needs attention',
    icon: '🟠',
    bg: '#fff7ed',
    text: '#c2410c',
    border: '#fdba74',
  },
  critical: {
    label: 'Priority support',
    icon: '🔴',
    bg: '#fef2f2',
    text: '#dc2626',
    border: '#fca5a5',
  },
  'priority support': {
    label: 'Priority support',
    icon: '🔴',
    bg: '#fef2f2',
    text: '#dc2626',
    border: '#fca5a5',
  },
  insufficient_data: {
    label: 'Not enough data yet',
    icon: '⏳',
    bg: '#f8fafc',
    text: '#64748b',
    border: '#cbd5e1',
  },
  'not enough data yet': {
    label: 'Not enough data yet',
    icon: '⏳',
    bg: '#f8fafc',
    text: '#64748b',
    border: '#cbd5e1',
  },
};

export default function StatusBadge({ status, style = {} }) {
  const key = String(status || '').toLowerCase().trim();
  const conf = STATUS_CONFIG[key] || STATUS_CONFIG.safe;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 10px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 600,
        backgroundColor: conf.bg,
        color: conf.text,
        border: `1px solid ${conf.border}`,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span style={{ fontSize: '11px' }}>{conf.icon}</span>
      <span>{conf.label}</span>
    </span>
  );
}
