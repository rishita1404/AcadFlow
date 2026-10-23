import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { noticeApi } from '../../api/endpoints.js';
import { useAuth } from '../../app/AuthContext.jsx';

const CATEGORY_COLORS = {
  general: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  form: { bg: '#fdf4ff', text: '#a21caf', border: '#f5d0fe' },
  event: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  exam: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  placement: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  urgent: { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
};

export default function StaffNotices() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('sent'); // 'sent' | 'drafts'
  const [selectedNoticeId, setSelectedNoticeId] = useState(null);
  const [receiptFilter, setReceiptFilter] = useState('all'); // 'all' | 'unseen' | 'seen' | 'done'
  const [nudgeMessage, setNudgeMessage] = useState(null);

  // Fetch sent notices
  const { data: notices = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['staff-notices'],
    queryFn: () => noticeApi.list().then(r => r.data || []),
  });

  // Fetch recipients for selected notice (when drawer open)
  const { data: recipients = [], isLoading: isLoadingRecipients } = useQuery({
    queryKey: ['notice-recipients', selectedNoticeId, receiptFilter],
    queryFn: () =>
      selectedNoticeId
        ? noticeApi.getRecipients(selectedNoticeId, receiptFilter === 'all' ? null : receiptFilter).then(r => r.data || [])
        : Promise.resolve([]),
    enabled: !!selectedNoticeId,
  });

  // Nudge unseen mutation
  const nudgeMutation = useMutation({
    mutationFn: (id) => noticeApi.nudge(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['staff-notices'] });
      setNudgeMessage(`Successfully nudged ${res.data.nudged_count} unseen recipient(s)!`);
      setTimeout(() => setNudgeMessage(null), 4000);
    },
  });

  // Withdraw notice mutation
  const withdrawMutation = useMutation({
    mutationFn: (id) => noticeApi.withdraw(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-notices'] });
      setSelectedNoticeId(null);
      alert('Notice has been withdrawn. Associated deadlines removed from student tasks.');
    },
  });

  const handleWithdraw = (id, title) => {
    if (window.confirm(`Are you sure you want to withdraw "${title}"? This will cancel all reminders and remove deadlines.`)) {
      withdrawMutation.mutate(id);
    }
  };

  const selectedNotice = notices.find(n => n.id === selectedNoticeId);

  // Summary Metrics calculations
  const totalSent = notices.length;
  const totalRecipients = notices.reduce((acc, n) => acc + (n.total_recipients || 0), 0);
  const totalSeen = notices.reduce((acc, n) => acc + (n.seen_count || 0), 0);
  const totalDone = notices.reduce((acc, n) => acc + (n.done_count || 0), 0);
  const overallSeenPct = totalRecipients > 0 ? Math.round((totalSeen / totalRecipients) * 100) : 0;
  const overallDonePct = totalRecipients > 0 ? Math.round((totalDone / totalRecipients) * 100) : 0;

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading published notices...</div>;
  }

  if (isError) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
        <p>Failed to load notices.</p>
        <button
          onClick={() => refetch()}
          style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 24, position: 'relative' }}>
      {/* Main Content Area */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{
          background: '#fff', borderRadius: 12, padding: '20px 24px', border: '1px solid #e2e8f0',
          marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
              📢 Notice Broadcast & Management
            </h1>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 4, margin: '4px 0 0 0' }}>
              Publish institutional announcements, Google Forms, and deadlines with delivery and read receipt tracking.
            </p>
          </div>
          <Link
            to="/notices/new"
            style={{
              background: '#3b82f6', color: '#fff', padding: '10px 20px', borderRadius: 8,
              fontSize: 14, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 1px 3px rgba(59, 130, 246, 0.3)',
            }}
          >
            ✏️ Compose Notice
          </Link>
        </div>

        {/* Nudge Alert Message */}
        {nudgeMessage && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac', color: '#166534',
            padding: '12px 18px', borderRadius: 8, marginBottom: 18, fontSize: 13, fontWeight: 600,
          }}>
            ✅ {nudgeMessage}
          </div>
        )}

        {/* Top KPI Metrics Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Notices</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', marginTop: 4 }}>{totalSent}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Delivered</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#3b82f6', marginTop: 4 }}>{totalRecipients}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Overall Seen Rate</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: overallSeenPct >= 70 ? '#16a34a' : '#d97706', marginTop: 4 }}>
              {overallSeenPct}%
              <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', marginLeft: 6 }}>({totalSeen}/{totalRecipients})</span>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Done / Acknowledged</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#8b5cf6', marginTop: 4 }}>
              {overallDonePct}%
              <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', marginLeft: 6 }}>({totalDone})</span>
            </div>
          </div>
        </div>

        {/* Tabs Bar */}
        <div style={{ display: 'flex', gap: 12, borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
          <button
            onClick={() => setActiveTab('sent')}
            style={{
              padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 14,
              color: activeTab === 'sent' ? '#3b82f6' : '#64748b',
              borderBottom: activeTab === 'sent' ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            Sent Notices ({notices.length})
          </button>
          <button
            onClick={() => setActiveTab('drafts')}
            style={{
              padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 14,
              color: activeTab === 'drafts' ? '#3b82f6' : '#64748b',
              borderBottom: activeTab === 'drafts' ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            Drafts (0)
          </button>
        </div>

        {/* Notices Content */}
        {activeTab === 'drafts' ? (
          <div style={{ background: '#fff', borderRadius: 10, padding: 48, textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
            <p>No saved drafts. All published notices appear in the "Sent Notices" tab.</p>
          </div>
        ) : notices.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 10, padding: 48, textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
            <p style={{ fontWeight: 600, color: '#1e293b' }}>No notices published yet.</p>
            <p style={{ fontSize: 13 }}>Click "Compose Notice" above to broadcast your first announcement or form.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {notices.map((n) => {
              const catKey = (n.category || 'general').toLowerCase();
              const catStyle = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.general;
              const seenPct = n.total_recipients > 0 ? Math.round((n.seen_count / n.total_recipients) * 100) : 0;
              const isSelected = n.id === selectedNoticeId;

              return (
                <div
                  key={n.id}
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    padding: 20,
                    border: isSelected ? '2px solid #3b82f6' : n.urgent ? '1px solid #fca5a5' : '1px solid #e2e8f0',
                    boxShadow: isSelected ? '0 4px 12px rgba(59,130,246,0.1)' : '0 1px 3px rgba(0,0,0,0.03)',
                  }}
                >
                  {/* Top line: tags & date */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {n.urgent && (
                        <span style={{
                          background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                          borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                        }}>
                          🚨 URGENT
                        </span>
                      )}
                      <span style={{
                        background: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}`,
                        borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                      }}>
                        {n.category}
                      </span>
                      {n.deadlines && n.deadlines.length > 0 && (
                        <span style={{
                          background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa',
                          borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                        }}>
                          ⏳ {n.deadlines.length} Deadline{n.deadlines.length > 1 ? 's' : ''} Synced
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                      {n.created_at ? new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>

                  {/* Title & Body Preview */}
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 6px 0' }}>
                    {n.title}
                  </h3>
                  <p style={{
                    fontSize: 13, color: '#475569', margin: '0 0 16px 0', lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {n.body}
                  </p>

                  {/* Delivery Stats Bar */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9',
                    marginBottom: 16,
                  }}>
                    <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Delivered</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{n.total_recipients}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Read Receipts</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: seenPct >= 70 ? '#16a34a' : '#d97706' }}>
                          {n.seen_count} <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>({seenPct}%)</span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Completed</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#8b5cf6' }}>{n.done_count}</div>
                      </div>
                    </div>

                    {/* Progress bar visual */}
                    <div style={{ width: 160 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                        <span>Seen Progress</span>
                        <span>{seenPct}%</span>
                      </div>
                      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${seenPct}%`, background: '#3b82f6', borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => setSelectedNoticeId(isSelected ? null : n.id)}
                        style={{
                          padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                          background: isSelected ? '#1e293b' : '#f1f5f9',
                          color: isSelected ? '#fff' : '#334151',
                          border: '1px solid #cbd5e1', cursor: 'pointer',
                        }}
                      >
                        {isSelected ? '✕ Close Receipts' : '📋 View Receipts & Roster'}
                      </button>
                      <button
                        onClick={() => nudgeMutation.mutate(n.id)}
                        disabled={nudgeMutation.isPending || (n.total_recipients - n.seen_count <= 0)}
                        style={{
                          padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                          background: '#fff', color: '#d97706', border: '1px solid #fde68a',
                          cursor: (n.total_recipients - n.seen_count <= 0) ? 'not-allowed' : 'pointer',
                          opacity: (n.total_recipients - n.seen_count <= 0) ? 0.5 : 1,
                        }}
                      >
                        🔔 Nudge Unseen ({n.total_recipients - n.seen_count})
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleWithdraw(n.id, n.title)}
                        disabled={withdrawMutation.isPending}
                        style={{
                          padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                          background: '#fff', color: '#ef4444', border: '1px solid #fecaca', cursor: 'pointer',
                        }}
                      >
                        🗑 Withdraw
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Side Drawer: Read Receipts & Roster */}
      {selectedNotice && (
        <div style={{
          width: 440, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)', padding: 20, height: 'fit-content',
          position: 'sticky', top: 20, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
        }}>
          {/* Drawer Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase' }}>Delivery Receipts</span>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '4px 0 0 0' }}>
                {selectedNotice.title}
              </h2>
            </div>
            <button
              onClick={() => setSelectedNoticeId(null)}
              style={{ background: 'none', border: 'none', fontSize: 18, color: '#94a3b8', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          {/* Quick Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
            <div style={{ background: '#f8fafc', padding: '10px 8px', borderRadius: 6, textAlign: 'center', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{selectedNotice.total_recipients}</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>Delivered</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '10px 8px', borderRadius: 6, textAlign: 'center', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>{selectedNotice.seen_count}</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>Seen</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '10px 8px', borderRadius: 6, textAlign: 'center', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#8b5cf6' }}>{selectedNotice.done_count}</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>Done</div>
            </div>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'unseen', label: `Unseen (${selectedNotice.total_recipients - selectedNotice.seen_count})` },
              { id: 'seen', label: `Seen (${selectedNotice.seen_count})` },
              { id: 'done', label: `Done (${selectedNotice.done_count})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setReceiptFilter(tab.id)}
                style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  border: receiptFilter === tab.id ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                  background: receiptFilter === tab.id ? '#eff6ff' : '#fff',
                  color: receiptFilter === tab.id ? '#2563eb' : '#64748b',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Roster Table */}
          {isLoadingRecipients ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading roster...</div>
          ) : recipients.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              No recipients match this filter.
            </div>
          ) : (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Student</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r) => {
                    const isSeen = !!r.seen_at;
                    const isDone = !!r.done_at;
                    return (
                      <tr key={r.user_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>
                            {r.roll_no ? `${r.roll_no} · ` : ''}{r.email}
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {isDone ? (
                            <span style={{ color: '#8b5cf6', fontWeight: 700, fontSize: 11 }}>✅ Done</span>
                          ) : isSeen ? (
                            <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 11 }}>
                              👁 Seen
                              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>
                                {new Date(r.seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </span>
                          ) : (
                            <span style={{ color: '#d97706', fontWeight: 600, fontSize: 11 }}>⏳ Unseen</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Quick drawer action */}
          <div style={{ marginTop: 14 }}>
            <button
              onClick={() => nudgeMutation.mutate(selectedNotice.id)}
              disabled={nudgeMutation.isPending || (selectedNotice.total_recipients - selectedNotice.seen_count <= 0)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', cursor: 'pointer',
              }}
            >
              🔔 Nudge Unseen Students
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
