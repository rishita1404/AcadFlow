import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { deadlineApi } from '../api/endpoints.js';
import { LoadingScreen, ErrorMsg } from './DashboardPage.jsx';

const URGENCY_STYLE = {
  urgent:    { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626', badge: '🔴 URGENT'   },
  overdue:   { bg: '#450a0a', border: '#dc2626', text: '#fca5a5', badge: '⛔ OVERDUE'  },
  soon:      { bg: '#fffbeb', border: '#fcd34d', text: '#b45309', badge: '⚠ Due Soon'  },
  normal:    { bg: '#fff',    border: '#e2e8f0', text: '#1e293b', badge: '📋 Pending'  },
  submitted: { bg: '#f0fdf4', border: '#86efac', text: '#15803d', badge: '✅ Submitted' },
};

const KIND_ICON = {
  assignment: '📝',
  'lab file': '🔬',
  review:     '📖',
  exam:       '🎯',
};

function DeadlineCard({ item }) {
  const s = URGENCY_STYLE[item.urgency] || URGENCY_STYLE.normal;
  const daysMsg =
    item.days_remaining < 0 ? `${Math.abs(item.days_remaining)} day(s) overdue`
    : item.days_remaining === 0 ? 'Due TODAY'
    : `${item.days_remaining} day(s) remaining`;

  return (
    <div style={{
      background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12,
      padding: 18, marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>{KIND_ICON[item.kind] || '📋'}</span>
            <span style={{
              background: '#eff6ff', color: '#3b82f6', fontSize: 11,
              fontWeight: 700, padding: '2px 8px', borderRadius: 4,
            }}>{item.course_code}</span>
            <span style={{
              background: s.bg, color: s.text, border: `1px solid ${s.border}`,
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
            }}>{s.badge}</span>
          </div>

          <h3 style={{ fontSize: 15, fontWeight: 700, color: s.text, margin: '0 0 4px' }}>
            {item.title}
          </h3>

          <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>📅 Due: {new Date(item.due_at).toLocaleString()}</span>
            <span>⏳ Grace: {item.grace_hours}h after deadline</span>
            <span style={{ fontWeight: 600, color: s.text }}>{daysMsg}</span>
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: 22, fontWeight: 900,
            color: item.days_remaining < 0 ? '#dc2626'
              : item.days_remaining === 0 ? '#c2410c'
              : item.days_remaining <= 2 ? '#d97706' : '#22c55e',
          }}>
            {item.days_remaining < 0 ? '−' : ''}{Math.abs(item.days_remaining)}d
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>
            {item.days_remaining < 0 ? 'overdue' : 'left'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DeadlinesPage() {
  const [days, setDays] = useState(30);
  const [includePast, setIncludePast] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['deadlines', days, includePast],
    queryFn: () => deadlineApi.getDeadlines(days, includePast).then(r => r.data),
  });

  const grouped = {};
  data?.forEach(d => {
    const key = d.urgency;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(d);
  });

  const order = ['overdue', 'urgent', 'soon', 'normal', 'submitted'];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>
        ⏰ Deadlines & Submissions
      </h1>
      <p style={{ color: '#64748b', marginBottom: 20, fontSize: 13 }}>
        Track all your assignment deadlines with urgency signals and submission status.
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13, color: '#374151' }}>
          Lookahead:{' '}
          <select value={days} onChange={e => setDays(Number(e.target.value))} style={selectStyle}>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
          </select>
        </label>
        <label style={{ fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={includePast} onChange={e => setIncludePast(e.target.checked)} />
          Include past week
        </label>

        {/* Quick stats */}
        {data && (
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
            {['overdue','urgent','soon','normal'].map(u => {
              const count = grouped[u]?.length || 0;
              if (!count) return null;
              const s = URGENCY_STYLE[u];
              return (
                <span key={u} style={{
                  background: s.bg, border: `1px solid ${s.border}`,
                  color: s.text, borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600,
                }}>
                  {s.badge}: {count}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {isLoading && <LoadingScreen msg="Loading deadlines…" />}
      {error && <ErrorMsg msg={error?.response?.data?.detail || error.message} />}

      {data?.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 48 }}>🎉</div>
          <p style={{ marginTop: 12 }}>No deadlines in this window. You're all caught up!</p>
        </div>
      )}

      {order.map(urgency => {
        const items = grouped[urgency];
        if (!items || items.length === 0) return null;
        return (
          <div key={urgency} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: URGENCY_STYLE[urgency].text, marginBottom: 10 }}>
              {URGENCY_STYLE[urgency].badge} ({items.length})
            </h2>
            {items.map(item => <DeadlineCard key={item.assignment_id} item={item} />)}
          </div>
        );
      })}
    </div>
  );
}

const selectStyle = {
  border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 8px', fontSize: 13,
};
