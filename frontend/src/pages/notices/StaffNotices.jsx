import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bell, Send, CheckCircle2, Clock, Trash2, AlertTriangle, X, Eye, RotateCw } from 'lucide-react';
import { noticeApi } from '../../api/endpoints.js';
import Skeleton from '../../components/Skeleton.jsx';

const CATEGORY_COLORS = {
  general: { bg: 'var(--bg)', text: 'var(--ink-900)', border: 'var(--border)' },
  form: { bg: 'var(--bg)', text: 'var(--accent)', border: 'var(--border)' },
  event: { bg: 'var(--ok-bg)', text: 'var(--ok-fg)', border: 'var(--border)' },
  exam: { bg: 'var(--crit-bg)', text: 'var(--crit-fg)', border: 'var(--border)' },
  placement: { bg: 'var(--watch-bg)', text: 'var(--watch-fg)', border: 'var(--border)' },
  urgent: { bg: 'var(--crit-bg)', text: 'var(--crit-fg)', border: 'var(--border)' },
};

export default function StaffNotices() {
  const qc = useQueryClient();
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
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 40 }}>
        <Skeleton variant="title" width={340} height={36} />
        <Skeleton variant="text" width={280} height={18} style={{ marginTop: 8, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <Skeleton variant="card" height={90} />
          <Skeleton variant="card" height={90} />
          <Skeleton variant="card" height={90} />
          <Skeleton variant="card" height={90} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 40, textAlign: 'center', color: 'var(--crit-fg)' }}>
        <p>Failed to load notices.</p>
        <button
          onClick={() => refetch()}
          style={{
            padding: '10px 20px', background: 'var(--accent)', color: 'var(--on-dark)',
            border: 'none', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          <RotateCw size={14} /> Retry
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
          background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '24px 28px', border: '1px solid var(--border)',
          marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-card)',
        }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
              Notice Broadcast & Management
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4, margin: '4px 0 0 0' }}>
              Publish institutional announcements, Google Forms, and deadlines with delivery and read receipt tracking.
            </p>
          </div>
          <Link
            to="/notices/new"
            style={{
              background: 'var(--accent)', color: 'var(--on-dark)', padding: '10px 20px', borderRadius: 'var(--radius-pill)',
              fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
              transition: 'background 0.15s ease',
            }}
          >
            <Send size={16} /> Compose Notice
          </Link>
        </div>

        {/* Nudge Alert Message */}
        {nudgeMessage && (
          <div style={{
            background: 'var(--ok-bg)', border: '1px solid var(--border)', color: 'var(--ok-fg)',
            padding: '12px 18px', borderRadius: 'var(--radius-card)', marginBottom: 18, fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <CheckCircle2 size={16} /> {nudgeMessage}
          </div>
        )}

        {/* Top KPI Metrics Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '16px 20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Notices</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink-900)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{totalSent}</div>
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '16px 20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Delivered</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink-900)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{totalRecipients}</div>
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '16px 20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overall Seen Rate</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink-900)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              {overallSeenPct}%
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 6 }}>({totalSeen}/{totalRecipients})</span>
            </div>
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '16px 20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Done / Acknowledged</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink-900)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              {overallDonePct}%
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 6 }}>({totalDone})</span>
            </div>
          </div>
        </div>

        {/* Tabs Bar */}
        <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          <button
            onClick={() => setActiveTab('sent')}
            style={{
              padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 14,
              color: activeTab === 'sent' ? 'var(--ink-900)' : 'var(--text-muted)',
              borderBottom: activeTab === 'sent' ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            Sent Notices ({notices.length})
          </button>
          <button
            onClick={() => setActiveTab('drafts')}
            style={{
              padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 14,
              color: activeTab === 'drafts' ? 'var(--ink-900)' : 'var(--text-muted)',
              borderBottom: activeTab === 'drafts' ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            Drafts (0)
          </button>
        </div>

        {/* Notices Content */}
        {activeTab === 'drafts' ? (
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 48, textAlign: 'center', color: 'var(--text-muted)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <p>No saved drafts. All published notices appear in the &quot;Sent Notices&quot; tab.</p>
          </div>
        ) : notices.length === 0 ? (
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 48, textAlign: 'center', color: 'var(--text-muted)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ color: 'var(--accent)', marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Bell size={36} /></div>
            <p style={{ fontWeight: 600, color: 'var(--ink-900)', fontFamily: 'var(--font-serif)', fontSize: 18 }}>No notices published yet.</p>
            <p style={{ fontSize: 14 }}>Click &quot;Compose Notice&quot; above to broadcast your first announcement or form.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {notices.map((n) => {
              const catKey = (n.category || 'general').toLowerCase();
              const catStyle = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.general;
              const seenPct = n.total_recipients > 0 ? Math.round((n.seen_count / n.total_recipients) * 100) : 0;
              const isSelected = n.id === selectedNoticeId;

              return (
                <div
                  key={n.id}
                  style={{
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-card)',
                    padding: 24,
                    border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                    borderLeft: n.urgent ? '4px solid var(--crit-fg)' : isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  {/* Top line: tags & date */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {n.urgent && (
                        <span style={{
                          background: 'var(--crit-bg)', color: 'var(--crit-fg)',
                          borderRadius: 'var(--radius-pill)', padding: '2px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          <AlertTriangle size={12} /> URGENT
                        </span>
                      )}
                      <span style={{
                        background: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}`,
                        borderRadius: 'var(--radius-pill)', padding: '2px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize', letterSpacing: '0.04em',
                      }}>
                        {n.category}
                      </span>
                      {n.deadlines && n.deadlines.length > 0 && (
                        <span style={{
                          background: 'var(--watch-bg)', color: 'var(--watch-fg)',
                          borderRadius: 'var(--radius-pill)', padding: '2px 10px', fontSize: 11, fontWeight: 600,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          <Clock size={12} /> {n.deadlines.length} Deadline{n.deadlines.length > 1 ? 's' : ''} Synced
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {n.created_at ? new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>

                  {/* Title & Body Preview */}
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink-900)', margin: '0 0 8px 0' }}>
                    {n.title}
                  </h3>
                  <p style={{
                    fontSize: 14, color: 'var(--text)', margin: '0 0 18px 0', lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {n.body}
                  </p>

                  {/* Delivery Stats Bar */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px', background: 'var(--bg)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)',
                    marginBottom: 18,
                  }}>
                    <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Delivered</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>{n.total_recipients}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Read Receipts</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>
                          {n.seen_count} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>({seenPct}%)</span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Completed</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>{n.done_count}</div>
                      </div>
                    </div>

                    {/* Progress bar visual */}
                    <div style={{ width: 160 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                        <span>Seen Progress</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{seenPct}%</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--surface)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <div style={{ height: '100%', width: `${seenPct}%`, background: 'var(--accent)', borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => setSelectedNoticeId(isSelected ? null : n.id)}
                        style={{
                          padding: '8px 16px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600,
                          background: isSelected ? 'var(--ink-900)' : 'var(--surface)',
                          color: isSelected ? 'var(--on-dark)' : 'var(--ink-900)',
                          border: '1px solid var(--border)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        {isSelected ? <X size={14} /> : <Eye size={14} />}
                        {isSelected ? 'Close Receipts' : 'View Receipts & Roster'}
                      </button>
                      <button
                        onClick={() => nudgeMutation.mutate(n.id)}
                        disabled={nudgeMutation.isPending || (n.total_recipients - n.seen_count <= 0)}
                        style={{
                          padding: '8px 16px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600,
                          background: 'var(--surface)', color: 'var(--watch-fg)', border: '1px solid var(--border)',
                          cursor: (n.total_recipients - n.seen_count <= 0) ? 'not-allowed' : 'pointer',
                          opacity: (n.total_recipients - n.seen_count <= 0) ? 0.5 : 1,
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        <Bell size={14} /> Nudge Unseen ({n.total_recipients - n.seen_count})
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleWithdraw(n.id, n.title)}
                        disabled={withdrawMutation.isPending}
                        style={{
                          padding: '8px 16px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600,
                          background: 'var(--surface)', color: 'var(--crit-fg)', border: '1px solid var(--border)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        <Trash2 size={14} /> Withdraw
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
          width: 440, background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-card)', padding: 24, height: 'fit-content',
          position: 'sticky', top: 20, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
        }}>
          {/* Drawer Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Delivery Receipts</span>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink-900)', margin: '4px 0 0 0' }}>
                {selectedNotice.title}
              </h2>
            </div>
            <button
              onClick={() => setSelectedNoticeId(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Quick Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
            <div style={{ background: 'var(--bg)', padding: '12px 10px', borderRadius: 'var(--radius-card)', textAlign: 'center', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>{selectedNotice.total_recipients}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Delivered</div>
            </div>
            <div style={{ background: 'var(--bg)', padding: '12px 10px', borderRadius: 'var(--radius-card)', textAlign: 'center', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>{selectedNotice.seen_count}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Seen</div>
            </div>
            <div style={{ background: 'var(--bg)', padding: '12px 10px', borderRadius: 'var(--radius-card)', textAlign: 'center', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>{selectedNotice.done_count}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Done</div>
            </div>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
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
                  padding: '6px 12px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600,
                  border: receiptFilter === tab.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: receiptFilter === tab.id ? 'var(--accent)' : 'var(--surface)',
                  color: receiptFilter === tab.id ? 'var(--on-dark)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Roster Table */}
          {isLoadingRecipients ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading roster...</div>
          ) : recipients.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No recipients match this filter.
            </div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11 }}>Student</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r) => {
                    const isSeen = !!r.seen_at;
                    const isDone = !!r.done_at;
                    return (
                      <tr key={r.user_id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {r.roll_no ? `${r.roll_no} · ` : ''}{r.email}
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {isDone ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              color: 'var(--ok-fg)', background: 'var(--ok-bg)',
                              padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 11,
                            }}>
                              <CheckCircle2 size={12} /> Done
                            </span>
                          ) : isSeen ? (
                            <div>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                color: 'var(--ink-900)', background: 'var(--bg)',
                                padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 11,
                              }}>
                                <Eye size={12} /> Seen
                              </span>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                                {new Date(r.seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          ) : (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              color: 'var(--watch-fg)', background: 'var(--watch-bg)',
                              padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 11,
                            }}>
                              <Clock size={12} /> Unseen
                            </span>
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
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => nudgeMutation.mutate(selectedNotice.id)}
              disabled={nudgeMutation.isPending || (selectedNotice.total_recipients - selectedNotice.seen_count <= 0)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600,
                background: 'var(--watch-bg)', color: 'var(--watch-fg)', border: '1px solid var(--border)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Bell size={14} /> Nudge Unseen Students
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
