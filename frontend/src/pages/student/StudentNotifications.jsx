import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { notificationApi } from '../../api/endpoints.js';

export default function StudentNotifications() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filterType, setFilterType] = useState('all');

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['student-notifications'],
    queryFn: () => notificationApi.list().then(r => r.data.items || r.data),
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => notificationApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-notifications'] });
      qc.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-notifications'] });
      qc.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading notifications...</div>;
  }

  // Filter
  const filtered = filterType === 'all'
    ? notifications
    : notifications.filter(n => n.type === filterType);

  // Group into Today and Earlier
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayList = filtered.filter(n => (n.created_at || '').slice(0, 10) === todayStr);
  const earlierList = filtered.filter(n => (n.created_at || '').slice(0, 10) !== todayStr);

  const handleDeepLink = (notification) => {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id);
    }
    const t = notification.type || '';
    if (t.includes('assignment') || t.includes('deadline') || t.includes('reminder')) {
      if (notification.entity_id) navigate(`/student/assignments/${notification.entity_id}`);
      else navigate('/student/tasks');
    } else if (t.includes('announcement') || t.includes('course')) {
      if (notification.entity_id) navigate(`/student/courses/${notification.entity_id}`);
      else navigate('/student/courses');
    } else if (t.includes('status') || t.includes('buffer') || t.includes('risk')) {
      navigate('/student/risk');
    } else if (t.includes('timetable')) {
      navigate('/student/timetable');
    } else if (t.includes('notice')) {
      navigate('/student/notices');
    } else {
      navigate('/student/home');
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid #e2e8f0',
        marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>
            🔔 Notifications & Reminders
          </h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            System alerts, deadline nudges, timetable changes, and course updates.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
          >
            <option value="all">All Alerts</option>
            <option value="buffer_warning">Buffer Warnings</option>
            <option value="assignment_reminder">Assignment Reminders</option>
            <option value="notice_new">Notices</option>
            <option value="timetable_updated">Timetable Changes</option>
          </select>

          <button
            onClick={() => markAllReadMutation.mutate()}
            style={{
              padding: '6px 14px', background: '#f8fafc', color: '#475569',
              border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            ✓ Mark All Read
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div style={{ display: 'grid', gap: 16 }}>
        {/* Today Section */}
        {todayList.length > 0 && (
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#475569', marginBottom: 10, textTransform: 'uppercase' }}>
              Today
            </h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {todayList.map(n => (
                <NotificationCard key={n.id} n={n} onClick={() => handleDeepLink(n)} />
              ))}
            </div>
          </div>
        )}

        {/* Earlier Section */}
        <div>
          {todayList.length > 0 && earlierList.length > 0 && (
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#475569', margin: '14px 0 10px', textTransform: 'uppercase' }}>
              Earlier
            </h3>
          )}
          {filtered.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: 48, textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔕</div>
              <p>No notifications to display.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {earlierList.map(n => (
                <NotificationCard key={n.id} n={n} onClick={() => handleDeepLink(n)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationCard({ n, onClick }) {
  const isUnread = !n.is_read;
  const isUrgent = n.priority === 'urgent' || n.priority === 'high';

  return (
    <div
      onClick={onClick}
      style={{
        background: isUnread ? (isUrgent ? '#fef2f2' : '#eff6ff') : '#fff',
        border: `1px solid ${isUnread ? (isUrgent ? '#fca5a5' : '#bfdbfe') : '#e2e8f0'}`,
        borderRadius: 10,
        padding: '14px 18px',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: isUnread ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>
          {n.type?.includes('warning') ? '⚠️' : n.type?.includes('timetable') ? '🗓' : n.type?.includes('notice') ? '📢' : '🔔'}
        </span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong style={{ fontSize: 14, color: '#1e293b' }}>{n.title}</strong>
            {isUnread && (
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }} />
            )}
          </div>
          <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{n.message}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            {n.created_at ? new Date(n.created_at).toLocaleString() : 'Recently'}
          </div>
        </div>
      </div>

      <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>
        Open →
      </span>
    </div>
  );
}
