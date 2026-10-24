import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, AlertTriangle, AlertCircle, CheckCircle2, FileText, Check } from 'lucide-react';
import { deadlineApi } from '../api/endpoints.js';
import { LoadingScreen, ErrorMsg } from './DashboardPage.jsx';

const URGENCY_STYLE = {
  urgent:    { bg: 'var(--crit-bg)', border: 'var(--border)', text: 'var(--crit-fg)', badge: 'URGENT'   },
  overdue:   { bg: 'var(--crit-bg)', border: 'var(--border)', text: 'var(--crit-fg)', badge: 'OVERDUE'  },
  soon:      { bg: 'var(--watch-bg)', border: 'var(--border)', text: 'var(--watch-fg)', badge: 'Due Soon'  },
  normal:    { bg: 'var(--surface)', border: 'var(--border)', text: 'var(--ink-900)', badge: 'Pending'  },
  submitted: { bg: 'var(--ok-bg)', border: 'var(--border)', text: 'var(--ok-fg)', badge: 'Submitted' },
};

function DeadlineCard({ item }) {
  const s = URGENCY_STYLE[item.urgency] || URGENCY_STYLE.normal;
  const daysMsg =
    item.days_remaining < 0 ? `${Math.abs(item.days_remaining)} day(s) overdue`
    : item.days_remaining === 0 ? 'Due TODAY'
    : `${item.days_remaining} day(s) remaining`;

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: item.urgency === 'urgent' || item.urgency === 'overdue' ? '4px solid var(--crit-fg)' : '1px solid var(--border)',
      borderRadius: 'var(--radius-card)', padding: '18px 22px', marginBottom: 12, boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <span style={{
              background: 'var(--bg)', color: 'var(--accent)', fontSize: 11,
              fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)',
            }}>{item.course_code}</span>
            <span style={{
              background: s.bg, color: s.text, border: '1px solid var(--border)',
              fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 'var(--radius-pill)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>{s.badge}</span>
          </div>

          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 600, color: 'var(--ink-900)', margin: '0 0 6px' }}>
            {item.title}
          </h3>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>Due: {new Date(item.due_at).toLocaleString()}</span>
            <span>Grace: {item.grace_hours}h after deadline</span>
            <span style={{ fontWeight: 600, color: s.text }}>{daysMsg}</span>
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            color: item.days_remaining < 0 ? 'var(--crit-fg)'
              : item.days_remaining === 0 ? 'var(--watch-fg)'
              : item.days_remaining <= 2 ? 'var(--watch-fg)' : 'var(--ok-fg)',
          }}>
            {item.days_remaining < 0 ? '−' : ''}{Math.abs(item.days_remaining)}d
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
    <div style={{ maxWidth: 1080, margin: '0 auto', paddingBottom: 40 }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
        Deadlines & Submissions
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14, marginTop: 4 }}>
        Track all your assignment deadlines with urgency signals and submission status.
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13, color: 'var(--ink-900)', fontWeight: 600 }}>
          Lookahead:{' '}
          <select value={days} onChange={e => setDays(Number(e.target.value))} style={selectStyle}>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
          </select>
        </label>
        <label style={{ fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={includePast} onChange={e => setIncludePast(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
          Include past week
        </label>

        {/* Quick stats */}
        {data && (
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {['overdue','urgent','soon','normal'].map(u => {
              const count = grouped[u]?.length || 0;
              if (!count) return null;
              const s = URGENCY_STYLE[u];
              return (
                <span key={u} style={{
                  background: s.bg, border: '1px solid var(--border)',
                  color: s.text, borderRadius: 'var(--radius-pill)', padding: '4px 12px', fontSize: 12, fontWeight: 600,
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
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--ok-fg)', marginBottom: 12, display: 'flex', justifyContent: 'center' }}><CheckCircle2 size={36} /></div>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-900)', margin: 0 }}>No deadlines in this window. You're all caught up!</p>
        </div>
      )}

      {order.map(urgency => {
        const items = grouped[urgency];
        if (!items || items.length === 0) return null;
        return (
          <div key={urgency} style={{ marginBottom: 24 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: URGENCY_STYLE[urgency].text, marginBottom: 12 }}>
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
  border: '1px solid var(--border)', borderRadius: 'var(--radius-input)', padding: '6px 12px', fontSize: 13,
  background: 'var(--surface)', color: 'var(--ink-900)', marginLeft: 6,
};
