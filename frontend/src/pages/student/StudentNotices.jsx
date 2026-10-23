import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { noticeApi } from '../../api/endpoints.js';

export default function StudentNotices() {
  const qc = useQueryClient();
  const [filterCat, setFilterCat] = useState('all');
  const [filterUnread, setFilterUnread] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['student-notices'],
    queryFn: () => noticeApi.getMyNotices().then(r => r.data).catch(() => []),
  });

  const markSeenMutation = useMutation({
    mutationFn: (id) => noticeApi.markSeen(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-notices'] });
      qc.invalidateQueries({ queryKey: ['student-notices-home'] });
    },
  });

  const markDoneMutation = useMutation({
    mutationFn: (id) => noticeApi.markDone(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-notices'] });
      qc.invalidateQueries({ queryKey: ['student-tasks-list'] });
      alert('Notice marked as done. Associated reminders cancelled.');
      setSelectedNotice(null);
    },
  });

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading notices inbox...</div>;
  }

  // Filter and Pin Urgent
  let filtered = notices;
  if (filterCat !== 'all') {
    filtered = filtered.filter(n => (n.category || '').toLowerCase() === filterCat.toLowerCase());
  }
  if (filterUnread) {
    filtered = filtered.filter(n => !n.seen);
  }

  // Urgent pinned at top
  const sorted = [...filtered].sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid #e2e8f0',
        marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>
            📢 Notices & Official Announcements
          </h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            Direct announcements, Google Forms, hackathon calls, and institutional updates with automatic deadline sync.
          </p>
        </div>

        {/* Filter controls */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
          >
            <option value="all">All Categories</option>
            <option value="form">Form</option>
            <option value="event">Event / Hackathon</option>
            <option value="exam">Exam</option>
            <option value="placement">Placement / Internship</option>
            <option value="general">General</option>
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filterUnread}
              onChange={e => setFilterUnread(e.target.checked)}
            />
            Unread only
          </label>
        </div>
      </div>

      {/* Notices Grid */}
      {sorted.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 48, textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
          <p>No notices matching the selected filter.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {sorted.map(notice => (
            <div
              key={notice.id}
              onClick={() => {
                setSelectedNotice(notice);
                if (!notice.seen) markSeenMutation.mutate(notice.id);
              }}
              style={{
                background: notice.seen ? '#fff' : '#f8fafc',
                border: `1px solid ${notice.urgent ? '#fca5a5' : '#e2e8f0'}`,
                borderRadius: 12,
                padding: '16px 20px',
                cursor: 'pointer',
                boxShadow: notice.urgent ? '0 0 0 1px #f87171' : '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {notice.urgent && (
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', background: '#fee2e2', color: '#dc2626', borderRadius: 4 }}>
                      🚨 URGENT
                    </span>
                  )}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase',
                    background: '#eff6ff', color: '#2563eb',
                  }}>
                    {notice.category || 'General'}
                  </span>
                  {!notice.seen && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }} />
                  )}
                </div>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  {notice.created_at?.slice(0, 10)}
                </span>
              </div>

              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '4px 0 6px' }}>
                {notice.title}
              </h3>
              <p style={{ fontSize: 13, color: '#475569', margin: '0 0 10px', lineHeight: 1.5 }}>
                {notice.body?.length > 180 ? `${notice.body.slice(0, 180)}...` : notice.body}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: '#64748b' }}>From: <strong>{notice.sender_name}</strong></span>
                {notice.done && (
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ Completed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal / Detail View */}
      {selectedNotice && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20,
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640,
            padding: 28, maxHeight: '85vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: '#eff6ff', color: '#2563eb', textTransform: 'uppercase' }}>
                  {selectedNotice.category || 'General'}
                </span>
                {selectedNotice.urgent && (
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 4, background: '#fee2e2', color: '#dc2626' }}>
                    🚨 Urgent
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedNotice(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>
              {selectedNotice.title}
            </h2>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
              Issued by {selectedNotice.sender_name} on {selectedNotice.created_at?.slice(0, 10)}
            </div>

            <div style={{ fontSize: 14, color: '#334151', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 20 }}>
              {selectedNotice.body}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
              <button
                onClick={() => markDoneMutation.mutate(selectedNotice.id)}
                style={{
                  padding: '9px 18px', background: '#16a34a', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                ✓ Mark Done (Cancel Reminders)
              </button>
              <button
                onClick={() => markDoneMutation.mutate(selectedNotice.id)}
                style={{
                  padding: '9px 18px', background: '#f1f5f9', color: '#475569',
                  border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Not Relevant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
