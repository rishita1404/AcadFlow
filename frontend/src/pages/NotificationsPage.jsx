import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '../api/endpoints.js';
import { LoadingScreen, ErrorMsg } from './DashboardPage.jsx';

const KIND_STYLE = {
  critical: { bg: '#fef2f2', border: '#fca5a5', icon: '🆘', label: 'Critical' },
  alert:    { bg: '#fff7ed', border: '#fdba74', icon: '⚠️', label: 'Alert'    },
  warning:  { bg: '#fffbeb', border: '#fcd34d', icon: '🟡', label: 'Warning'  },
  reminder: { bg: '#eff6ff', border: '#93c5fd', icon: '🔔', label: 'Reminder' },
  info:     { bg: '#f8fafc', border: '#e2e8f0', icon: 'ℹ️',  label: 'Info'    },
};

function NotifCard({ notif, onRead, onDelete }) {
  const s = KIND_STYLE[notif.kind] || KIND_STYLE.info;
  const dt = new Date(notif.created_at).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div style={{
      background: notif.is_read ? '#fafafa' : s.bg,
      border: `1px solid ${notif.is_read ? '#e2e8f0' : s.border}`,
      borderRadius: 10, padding: '14px 18px', marginBottom: 10,
      opacity: notif.is_read ? 0.7 : 1,
      display: 'flex', gap: 14, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{s.icon}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 14, color: '#1e293b' }}>{notif.title}</strong>
          <span style={{
            fontSize: 10, fontWeight: 700, background: s.bg,
            border: `1px solid ${s.border}`, borderRadius: 4, padding: '1px 6px',
          }}>{s.label}</span>
          {!notif.is_read && (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
          )}
        </div>
        <p style={{ fontSize: 13, color: '#374151', margin: '4px 0' }}>{notif.message}</p>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{dt}</span>
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {!notif.is_read && (
          <button onClick={() => onRead(notif.id)} style={smallBtn('#eff6ff', '#3b82f6')}>✓ Read</button>
        )}
        <button onClick={() => onDelete(notif.id)} style={smallBtn('#fef2f2', '#dc2626')}>✕</button>
      </div>
    </div>
  );
}

const smallBtn = (bg, color) => ({
  background: bg, color, border: `1px solid ${color}40`,
  borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
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
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>
          🔔 Alerts & Notifications
          {unread > 0 && (
            <span style={{
              marginLeft: 12, background: '#ef4444', color: '#fff',
              borderRadius: 9999, fontSize: 13, padding: '2px 10px', fontWeight: 700,
            }}>{unread} unread</span>
          )}
        </h1>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => checkMut.mutate()}
            disabled={checkMut.isLoading}
            style={{ ...actionBtn('#eff6ff', '#3b82f6'), opacity: checkMut.isLoading ? 0.6 : 1 }}
          >
            {checkMut.isLoading ? 'Checking…' : '🔄 Check Reminders'}
          </button>
          {unread > 0 && (
            <button onClick={() => readAllMut.mutate()} style={actionBtn('#f0fdf4', '#16a34a')}>
              ✓ Mark All Read
            </button>
          )}
        </div>
      </div>

      <p style={{ color: '#64748b', marginBottom: 20, fontSize: 13 }}>
        Attendance warnings, deadline reminders, and risk alerts.
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'unread', 'critical', 'alert', 'warning', 'reminder', 'info'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? '#1e293b' : '#f1f5f9',
              color: filter === f ? '#fff' : '#374151',
              border: 'none', borderRadius: 8, padding: '6px 14px',
              cursor: 'pointer', fontSize: 13, fontWeight: filter === f ? 700 : 400,
              textTransform: 'capitalize',
            }}
          >
            {KIND_STYLE[f]?.icon || ''} {f}
          </button>
        ))}
      </div>

      {isLoading && <LoadingScreen msg="Loading notifications…" />}
      {error && <ErrorMsg msg={error?.response?.data?.detail || error.message} />}

      {data?.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 48 }}>🎉</div>
          <p style={{ marginTop: 12 }}>No notifications! You're all clear.</p>
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
  background: bg, color, border: `1px solid ${color}40`,
  borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
});
