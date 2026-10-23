import React from 'react';

export default function BufferGauge({ bufferClasses, insufficientData = false }) {
  if (insufficientData) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '12px', borderRadius: '10px',
        background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center',
      }}>
        <span style={{ fontSize: '20px', fontWeight: 700, color: '#94a3b8' }}>⏳</span>
        <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
          Not enough data yet
        </span>
      </div>
    );
  }

  if (bufferClasses === null || bufferClasses === undefined) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '12px', borderRadius: '10px',
        background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center',
      }}>
        <span style={{ fontSize: '20px', fontWeight: 700, color: '#94a3b8' }}>—</span>
        <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
          Buffer calculating
        </span>
      </div>
    );
  }

  if (bufferClasses < 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '12px', borderRadius: '10px',
        background: '#fef2f2', border: '1px solid #fecaca', textAlign: 'center',
      }}>
        <span style={{ fontSize: '22px', fontWeight: 800, color: '#dc2626' }}>
          {bufferClasses}
        </span>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#b91c1c', marginTop: '4px' }}>
          Not recoverable by attendance alone
        </span>
      </div>
    );
  }

  const isLow = bufferClasses <= 2;
  const color = isLow ? '#d97706' : '#16a34a';
  const bg = isLow ? '#fffbeb' : '#f0fdf4';
  const border = isLow ? '#fde68a' : '#bbf7d0';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '12px', borderRadius: '10px',
      background: bg, border: `1px solid ${border}`, textAlign: 'center',
    }}>
      <span style={{ fontSize: '24px', fontWeight: 800, color }}>
        {bufferClasses}
      </span>
      <span style={{ fontSize: '11px', fontWeight: 500, color: '#475569', marginTop: '4px' }}>
        {bufferClasses === 0 ? 'Cannot miss any more classes' : `You can miss ${bufferClasses} more class${bufferClasses > 1 ? 'es' : ''}`}
      </span>
    </div>
  );
}
