import React from 'react';

export default function StatusBadge({ status }) {
  const styles = {
    safe: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800',
    at_risk: 'bg-rose-100 text-rose-800',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.safe}`}>
      {status ? status.toUpperCase() : 'UNKNOWN'}
    </span>
  );
}
