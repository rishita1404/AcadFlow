import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, AlertTriangle, AlertCircle, Info, CheckCircle2, RotateCw, Trash2, Check } from 'lucide-react';
import { notificationApi } from '../api/endpoints.js';
import { LoadingScreen, ErrorMsg } from './DashboardPage.jsx';

const KIND_STYLE = {
  critical: { bg: 'var(--crit-bg)', border: 'var(--border)', icon: AlertCircle, label: 'Critical', fg: 'var(--crit-fg)' },
  alert:    { bg: 'var(--risk-bg)', border: 'var(--border)', icon: AlertTriangle, label: 'Alert', fg: 'var(--risk-fg)' },
  warning:  { bg: 'var(--watch-bg)', border: 'var(--border)', icon: AlertTriangle, label: 'Warning', fg: 'var(--watch-fg)' },
  reminder: { bg: 'var(--bg)', border: 'var(--border)', icon: Bell, label: 'Reminder', fg: 'var(--accent)' },
  info:     { bg: 'var(--bg)', border: 'var(--border)', icon: Info, label: 'Info', fg: 'var(--text-muted)' },
};

function NotifCard({ notif, onRead, onDelete }) {
  const s = KIND_STYLE[notif.kind] || KIND_STYLE.info;
  const IconComponent = s.icon;
  const dt = new Date(notif.created_at).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div style={{
      background: notif.is_read ? 'var(--bg)' : 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: notif.is_read ? '1px solid var(--border)' : `4px solid ${s.fg}`,
      borderRadius: 'var(--radius-card)', padding: '16px 20px', marginBottom: 12,
      opacity: notif.is_read ? 0.75 : 1,
      display: 'flex', gap: 16, alignItems: 'flex-start',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ color: s.fg, flexShrink: 0, marginTop: 2 }}>
        <IconComponent size={20} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 14, color: 'var(--ink-900)' }}>{notif.title}</strong>
          <span style={{
            fontSize: 11, fontWeight: 600, background: s.bg, color: s.fg,
            borderRadius: 'var(--radius-pill)', padding: '2px 8px', letterSpacing: '0.04em',
          }}>{s.label}</span>
          {!notif.is_read && (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
          )}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text)', margin: '6px 0', lineHeight: 1.5 }}>{notif.message}</p>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{dt}</span>
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {!notif.is_read && (
          <button onClick={() => onRead(notif.id)} style={smallBtn('var(--surface)', 'var(--accent)')}>
            <Check size={12} style={{ marginRight: 4 }} /> Read
          </button>
        )}
        <button onClick={() => onDelete(notif.id)} style={smallBtn('var(--surface)', 'var(--crit-fg)')}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

const smallBtn = (bg, color) => ({
  background: bg, color, border: '1px solid var(--border)',
  borderRadius: 'var(--radius-pill)', padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
  display: 'inline-flex', alignItems: 'center',
});

export default function NotificationsPage() {
  const [filter, setFilter] = useState('all');
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications', filter],
    queryFn: () => notificationApi.list({
      limit: 50,
      unread_only: filter === 'unread',
      kind: filter !== 'all' && filter !== 'unread' ? filter : undefined,
    }).then(r => r.data),
  });

  const { data: unread } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationApi.unreadCount().then(r => r.data.unread_count),
  });

  const readMut = useMutation({
    mutationFn: (id) => notificationApi.markRead(id),
    onSuccess: () => { qc.invalidateQueries(['notifications']); qc.invalidateQueries(['unread-count']); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => notificationApi.delete(id),
    onSuccess: () => { qc.invalidateQueries(['notifications']); qc.invalidateQueries(['unread-count']); },
  });

  const readAllMut = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => { qc.invalidateQueries(['notifications']); qc.invalidateQueries(['unread-count']); },
  });

  const checkMut = useMutation({
    mutationFn: () => notificationApi.checkReminders(),
    onSuccess: (res) => {
      qc.invalidateQueries(['notifications']);
      qc.invalidateQueries(['unread-count']);
      alert(`${res.data.reminders_dispatched} new reminder(s) dispatched!`);
    },
  });

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink-900)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            Alerts & Notifications
            {unread > 0 && (
              <span style={{
                background: 'var(--crit-bg)', color: 'var(--crit-fg)',
                borderRadius: 'var(--radius-pill)', fontSize: 12, padding: '2px 10px', fontWeight: 600,
              }}>{unread} unread</span>
            )}
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 14 }}>
            Attendance warnings, deadline reminders, and risk alerts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => checkMut.mutate()}
            disabled={checkMut.isLoading}
            style={{ ...actionBtn('var(--surface)', 'var(--accent)'), opacity: checkMut.isLoading ? 0.6 : 1 }}
          >
            <RotateCw size={14} style={{ marginRight: 6 }} />
            {checkMut.isLoading ? 'Checking…' : 'Check Reminders'}
          </button>
          {unread > 0 && (
            <button onClick={() => readAllMut.mutate()} style={actionBtn('var(--ok-bg)', 'var(--ok-fg)')}>
              <CheckCircle2 size={14} style={{ marginRight: 6 }} /> Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, marginTop: 16, flexWrap: 'wrap' }}>
        {['all', 'unread', 'critical', 'alert', 'warning', 'reminder', 'info'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? 'var(--accent)' : 'var(--surface)',
              color: filter === f ? 'var(--on-dark)' : 'var(--text-muted)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '6px 16px',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading && <LoadingScreen msg="Loading notifications…" />}
      {error && <ErrorMsg msg={error?.response?.data?.detail || error.message} />}

      {data?.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--ok-fg)', marginBottom: 12, display: 'flex', justifyContent: 'center' }}><CheckCircle2 size={36} /></div>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-900)', margin: 0 }}>No notifications! You're all clear.</p>
        </div>
      )}

      {data?.map(n => (
        <NotifCard
          key={n.id}
          notif={n}
          onRead={(id) => readMut.mutate(id)}
          onDelete={(id) => deleteMut.mutate(id)}
        />
      ))}
    </div>
  );
}

const actionBtn = (bg, color) => ({
  background: bg, color, border: '1px solid var(--border)',
  borderRadius: 'var(--radius-pill)', padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  display: 'inline-flex', alignItems: 'center',
});
