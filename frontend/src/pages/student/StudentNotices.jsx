import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { noticeApi } from '../../api/endpoints.js';
import { Skeleton, EmptyState } from '../../components/ui/Skeleton.jsx';
import Dialog from '../../components/ui/Dialog.jsx';
import Button from '../../components/ui/Button.jsx';

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
      setSelectedNotice(null);
    },
  });

  if (isLoading) return <Skeleton lines={6} />;

  let filtered = notices;
  if (filterCat !== 'all') filtered = filtered.filter(n => (n.category || '').toLowerCase() === filterCat);
  if (filterUnread) filtered = filtered.filter(n => !n.seen);
  const sorted = [...filtered].sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));

  const selectStyle = {
    padding: '7px 12px', borderRadius: 'var(--radius-input)',
    border: '1px solid var(--border)', fontSize: 13,
    background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font-sans)',
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-card)',
        padding: 'var(--space-6)', border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)', marginBottom: 'var(--space-6)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)',
      }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink-900)', margin: 0 }}>
            Notices & Announcements
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Direct announcements and institutional updates with automatic deadline sync.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={selectStyle}>
            <option value="all">All Categories</option>
            <option value="form">Form</option>
            <option value="event">Event / Hackathon</option>
            <option value="exam">Exam</option>
            <option value="placement">Placement</option>
            <option value="general">General</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={filterUnread} onChange={e => setFilterUnread(e.target.checked)} />
            Unread only
          </label>
        </div>
      </div>

      {/* Notice list */}
      {sorted.length === 0 ? (
        <EmptyState title="No notices" message="No notices match the selected filter." />
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {sorted.map(notice => (
            <div
              key={notice.id}
              onClick={() => { setSelectedNotice(notice); if (!notice.seen) markSeenMutation.mutate(notice.id); }}
              style={{
                background: notice.seen ? 'var(--surface)' : 'var(--bg)',
                border: `1px solid ${notice.urgent ? 'var(--crit-fg)' : 'var(--border)'}`,
                borderLeft: notice.urgent ? '4px solid var(--crit-fg)' : '1px solid var(--border)',
                borderRadius: 'var(--radius-card)',
                padding: 'var(--space-6)',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {notice.urgent && (
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', background: 'var(--crit-bg)', color: 'var(--crit-fg)', borderRadius: 'var(--radius-pill)' }}>
                      URGENT
                    </span>
                  )}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                    textTransform: 'uppercase', background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)',
                  }}>
                    {notice.category || 'General'}
                  </span>
                  {!notice.seen && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{notice.created_at?.slice(0, 10)}</span>
              </div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-900)', margin: '0 0 var(--space-2)' }}>
                {notice.title}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 var(--space-3)', lineHeight: 1.5 }}>
                {notice.body?.length > 180 ? `${notice.body.slice(0, 180)}…` : notice.body}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>From: <strong style={{ color: 'var(--text)' }}>{notice.sender_name}</strong></span>
                {notice.done && <span style={{ color: 'var(--ok-fg)', background: 'var(--ok-bg)', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontSize: 11 }}>Done</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog
        open={!!selectedNotice}
        onClose={() => setSelectedNotice(null)}
        title={selectedNotice?.title || 'Notice'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedNotice(null)}>Close</Button>
            {!selectedNotice?.done && (
              <Button variant="primary" loading={markDoneMutation.isPending} onClick={() => markDoneMutation.mutate(selectedNotice.id)}>
                Mark Done
              </Button>
            )}
          </>
        }
      >
        {selectedNotice && (
          <div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)', textTransform: 'uppercase' }}>
                {selectedNotice.category || 'General'}
              </span>
              {selectedNotice.urgent && <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--crit-bg)', color: 'var(--crit-fg)' }}>Urgent</span>}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
              Issued by <strong style={{ color: 'var(--text)' }}>{selectedNotice.sender_name}</strong> on {selectedNotice.created_at?.slice(0, 10)}
            </p>
            <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {selectedNotice.body}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
