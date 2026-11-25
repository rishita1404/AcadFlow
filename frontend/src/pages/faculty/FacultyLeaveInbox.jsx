import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../../api/endpoints';
import {
  Inbox,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HeartPulse,
  Briefcase,
  User,
  Check,
  X,
} from 'lucide-react';

// ── Shared micro-components ──────────────────────────────────────────────────

function PageHeader({ title, subtitle, right }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      padding: 'var(--space-6)',
      boxShadow: 'var(--shadow-card)',
      marginBottom: 'var(--space-6)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 'var(--space-6)',
      flexWrap: 'wrap',
    }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink-900)', margin: 0 }}>
          {title}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>{subtitle}</p>
      </div>
      {right}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

function StatusBadge({ status }) {
  const configs = {
    approved: { icon: <CheckCircle2 size={13} />, label: 'Approved', bg: 'var(--ok-bg)',    fg: 'var(--ok-fg)' },
    rejected: { icon: <XCircle size={13} />,      label: 'Rejected', bg: 'var(--risk-bg)',  fg: 'var(--risk-fg)' },
    pending:  { icon: <Clock size={13} />,         label: 'Pending',  bg: 'var(--watch-bg)', fg: 'var(--watch-fg)' },
  };
  const cfg = configs[status] || configs.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 'var(--radius-pill)',
      fontSize: 11, fontWeight: 700,
      background: cfg.bg, color: cfg.fg,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function EmptyState({ icon, title, message }) {
  return (
    <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
      <div style={{ color: 'var(--border)', marginBottom: 12 }}>{icon}</div>
      <p style={{ fontWeight: 600, color: 'var(--ink-900)', fontSize: 15, margin: 0 }}>{title}</p>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{message}</p>
    </div>
  );
}

function CategoryPill({ type }) {
  if (type === 'medical') return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700, padding: '2px 8px',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--risk-bg)', color: 'var(--risk-fg)',
    }}>
      <HeartPulse size={11} /> Medical
    </span>
  );
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700, padding: '2px 8px',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--bg)', color: 'var(--accent)',
      border: '1px solid var(--border)',
    }}>
      <Briefcase size={11} /> Duty / Event
    </span>
  );
}

// ── Tab pill ─────────────────────────────────────────────────────────────────
const TAB_OPTIONS = [
  { key: 'pending',  label: 'Pending',  icon: <Clock size={13} /> },
  { key: 'approved', label: 'Decided',  icon: <CheckCircle2 size={13} /> },
  { key: '',         label: 'All',      icon: null },
];

function TabBar({ value, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 4,
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-pill)',
      padding: 4,
    }}>
      {TAB_OPTIONS.map((tab) => {
        const active = value === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 16px', borderRadius: 'var(--radius-pill)',
              border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: active ? 700 : 500,
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--on-dark)' : 'var(--text-muted)',
              fontFamily: 'var(--font-sans)',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Decision modal ────────────────────────────────────────────────────────────
function DecisionModal({ modal, decisionNote, onNoteChange, onCancel, onConfirm, loading, error }) {
  if (!modal) return null;
  const isApprove = modal.action === 'approved';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(13,27,42,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)',
      }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-dialog)',
        maxWidth: 440, width: '100%',
        padding: 'var(--space-6)',
        boxShadow: 'var(--shadow-card)',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
      }}>
        <h3 id="modal-title" style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-900)', margin: 0 }}>
          {isApprove ? 'Approve request' : 'Reject request'}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          <strong style={{ color: 'var(--ink-900)' }}>{modal.req.student_name}</strong>
          {' '}— {modal.req.date_from} to {modal.req.date_to}
        </p>

        {error && (
          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-start',
            background: 'var(--crit-bg)', border: '1px solid var(--crit-fg)',
            borderRadius: 'var(--radius-input)',
            padding: 'var(--space-3) var(--space-4)',
            fontSize: 13, color: 'var(--crit-fg)',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            {error}
          </div>
        )}

        <form onSubmit={onConfirm} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label htmlFor="modal-note" style={{
              display: 'block', fontSize: 12, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.03em',
              color: 'var(--ink-800)', marginBottom: 6,
            }}>
              Note {isApprove ? '(optional)' : '(required)'}
            </label>
            <textarea
              id="modal-note"
              rows={3}
              value={decisionNote}
              onChange={onNoteChange}
              required={!isApprove}
              placeholder={isApprove
                ? 'e.g. Medical certificate noted.'
                : 'e.g. Insufficient supporting information provided.'}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-input)',
                border: '1px solid var(--border)',
                fontSize: 13, color: 'var(--text)',
                background: 'var(--surface)',
                fontFamily: 'var(--font-sans)',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '9px 20px', borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--border)', background: 'var(--surface)',
                fontSize: 13, fontWeight: 600, color: 'var(--text)',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '9px 20px', borderRadius: 'var(--radius-pill)', border: 'none',
                background: isApprove ? 'var(--accent)' : 'var(--crit-fg)',
                color: 'var(--on-dark)',
                fontSize: 13, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.65 : 1,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {loading ? 'Processing…' : isApprove ? 'Confirm approval' : 'Confirm rejection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function FacultyLeaveInbox() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('pending');
  const [activeModal, setActiveModal]   = useState(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [actionError, setActionError]   = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['faculty-leave-inbox', filterStatus],
    queryFn: () => leaveApi.getInbox(filterStatus ? { status_filter: filterStatus } : {}).then((r) => r.data),
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, status, decision_note }) => leaveApi.decide(id, { status, decision_note }),
    onSuccess: () => {
      setActiveModal(null);
      setDecisionNote('');
      setActionError('');
      qc.invalidateQueries({ queryKey: ['faculty-leave-inbox'] });
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message
        || err.response?.data?.detail?.message
        || 'Failed to submit decision.',
      );
    },
  });

  const handleOpen  = (req, action) => { setActiveModal({ req, action }); setDecisionNote(''); setActionError(''); };
  const handleClose = () => setActiveModal(null);
  const handleConfirm = (e) => {
    e.preventDefault();
    if (!activeModal) return;
    decideMutation.mutate({
      id: activeModal.req.id,
      status: activeModal.action,
      decision_note: decisionNote.trim() || undefined,
    });
  };

  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <PageHeader
          title="Mentee leave inbox"
          subtitle="Review medical and duty leave submissions from your assigned mentees."
          right={<TabBar value={filterStatus} onChange={setFilterStatus} />}
        />

        <Card>
          {isLoading ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Loading…
            </div>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={<Inbox size={36} />}
              title="No requests in this view"
              message={
                filterStatus === 'pending'
                  ? 'All pending leave requests have been processed.'
                  : 'No requests matched the current filter.'
              }
            />
          ) : (
            <div>
              {requests.map((req, i) => (
                <div key={req.id} style={{
                  padding: 'var(--space-5) var(--space-6)',
                  borderBottom: i < requests.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    {/* Student info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'var(--bg)', border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--accent)', flexShrink: 0,
                      }}>
                        <User size={16} />
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-900)', margin: 0 }}>
                          {req.student_name || `Student #${req.student_id}`}
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                          Roll No: {req.student_roll_no || 'N/A'} · Submitted {fmtDate(req.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* Status + actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <StatusBadge status={req.status} />
                      {req.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleOpen(req, 'approved')}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '7px 14px', borderRadius: 'var(--radius-pill)',
                              background: 'var(--accent)', color: 'var(--on-dark)',
                              border: 'none', fontSize: 13, fontWeight: 600,
                              cursor: 'pointer', fontFamily: 'var(--font-sans)',
                            }}
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button
                            onClick={() => handleOpen(req, 'rejected')}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '7px 14px', borderRadius: 'var(--radius-pill)',
                              background: 'var(--crit-bg)', color: 'var(--crit-fg)',
                              border: '1px solid var(--crit-fg)',
                              fontSize: 13, fontWeight: 600,
                              cursor: 'pointer', fontFamily: 'var(--font-sans)',
                            }}
                          >
                            <X size={14} /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Detail row */}
                  <div style={{
                    marginTop: 'var(--space-4)',
                    display: 'grid', gridTemplateColumns: 'auto auto 1fr',
                    gap: 'var(--space-4) var(--space-6)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-input)',
                    padding: 'var(--space-3) var(--space-4)',
                  }}>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 4 }}>Category</p>
                      <CategoryPill type={req.type} />
                    </div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 4 }}>Dates</p>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>
                        {req.date_from} – {req.date_to}
                      </span>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 4 }}>Reason</p>
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{req.reason}</span>
                    </div>
                  </div>

                  {/* Decision note */}
                  {req.decision_note && (
                    <div style={{
                      marginTop: 'var(--space-3)',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-input)',
                      padding: 'var(--space-3) var(--space-4)',
                      fontSize: 13,
                    }}>
                      <span style={{ fontWeight: 700, color: 'var(--ink-900)' }}>Note: </span>
                      <span style={{ color: 'var(--text)' }}>{req.decision_note}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <DecisionModal
        modal={activeModal}
        decisionNote={decisionNote}
        onNoteChange={(e) => setDecisionNote(e.target.value)}
        onCancel={handleClose}
        onConfirm={handleConfirm}
        loading={decideMutation.isPending}
        error={actionError}
      />
    </>
  );
}
