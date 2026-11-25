import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { condonationApi } from '../../api/endpoints';
import {
  HeartHandshake,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Check,
  X,
  FileCheck2,
} from 'lucide-react';

// ── Shared micro-components ──────────────────────────────────────────────────

function PageHeader({ title, subtitle }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      padding: 'var(--space-6)',
      boxShadow: 'var(--shadow-card)',
      marginBottom: 'var(--space-6)',
    }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink-900)', margin: 0 }}>
        {title}
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>{subtitle}</p>
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

function CardHeader({ title, right }) {
  return (
    <div style={{
      padding: 'var(--space-5) var(--space-6)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink-900)', margin: 0 }}>
        {title}
      </h2>
      {right}
    </div>
  );
}

function StatusBadge({ status }) {
  const configs = {
    approved:    { icon: <CheckCircle2 size={13} />, label: 'Approved',    bg: 'var(--ok-bg)',    fg: 'var(--ok-fg)' },
    rejected:    { icon: <XCircle size={13} />,      label: 'Rejected',    bg: 'var(--risk-bg)',  fg: 'var(--risk-fg)' },
    recommended: { icon: <Clock size={13} />,        label: 'Recommended', bg: 'var(--watch-bg)', fg: 'var(--watch-fg)' },
  };
  const cfg = configs[status] || configs.recommended;
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
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-6)',
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
          {isApprove ? 'Approve condonation' : 'Reject condonation'}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          <strong style={{ color: 'var(--ink-900)' }}>{modal.req.student_name}</strong>
          {' '}— Recorded attendance: {modal.req.attendance_pct_at_request}%
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
              Official decision note <span style={{ color: 'var(--crit-fg)' }}>*</span>
            </label>
            <textarea
              id="modal-note"
              rows={3}
              value={decisionNote}
              onChange={onNoteChange}
              required
              placeholder={isApprove
                ? 'e.g. Condonation approved on faculty recommendation due to hospitalisation.'
                : 'e.g. Minimum departmental threshold not met.'}
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
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              This note is permanently recorded on the student's academic profile.
            </p>
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
export default function DeanCondonationQueue() {
  const qc = useQueryClient();
  const [activeModal, setActiveModal] = useState(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [actionError, setActionError]   = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['dean-condonation-queue'],
    queryFn: () => condonationApi.getQueue().then((r) => r.data),
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, status, decision_note }) => condonationApi.decide(id, { status, decision_note }),
    onSuccess: () => {
      setActiveModal(null);
      setDecisionNote('');
      setActionError('');
      qc.invalidateQueries({ queryKey: ['dean-condonation-queue'] });
    },
    onError: (err) => {
      const msg = err.response?.data?.error?.message
        || err.response?.data?.detail?.message
        || 'Failed to submit decision.';
      if (!decisionNote.trim()) {
        setActionError('A decision note is required for the official institutional record.');
      } else {
        setActionError(msg);
      }
    },
  });

  const handleOpen  = (req, action) => { setActiveModal({ req, action }); setDecisionNote(''); setActionError(''); };
  const handleClose = () => setActiveModal(null);
  const handleConfirm = (e) => {
    e.preventDefault();
    if (!activeModal) return;
    if (!decisionNote.trim()) {
      setActionError('A decision note is required for the official institutional record.');
      return;
    }
    decideMutation.mutate({ id: activeModal.req.id, status: activeModal.action, decision_note: decisionNote.trim() });
  };

  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <PageHeader
          title="Condonation queue"
          subtitle="Review faculty and mentor recommendations for attendance condonation."
        />

        {/* Policy callout */}
        <div style={{
          display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)',
          padding: 'var(--space-5) var(--space-6)',
          marginBottom: 'var(--space-6)',
          fontSize: 13, color: 'var(--text)',
        }}>
          <FileCheck2 size={18} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent)' }} />
          <div>
            <span style={{ fontWeight: 700, color: 'var(--ink-900)' }}>Dean condonation policy: </span>
            A condonation decision grants formal exam eligibility clearance. It is recorded as an official note and never changes attendance percentages, ensuring compliance integrity.
          </div>
        </div>

        {/* Queue card */}
        <Card>
          <CardHeader
            title="Department requests"
            right={
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {requests.length} {requests.length === 1 ? 'request' : 'requests'}
              </span>
            }
          />

          {isLoading ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Loading…
            </div>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={<HeartHandshake size={36} />}
              title="No requests in condonation queue"
              message="There are currently no condonation requests pending review."
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
                          Roll: {req.student_roll_no || 'N/A'} · {req.department_name || 'Department'} · Submitted {fmtDate(req.created_at)}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <StatusBadge status={req.status} />
                      {req.status === 'recommended' && (
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

                  {/* Detail grid */}
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
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 4 }}>Attendance</p>
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>
                        {req.attendance_pct_at_request}%
                      </span>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 4 }}>Recommended by</p>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)' }}>
                        {req.recommended_by_name || `Faculty #${req.recommended_by}`}
                      </span>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 4 }}>Justification</p>
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
                      <span style={{ fontWeight: 700, color: 'var(--ink-900)' }}>
                        Dean's note ({req.decided_by_name || 'Dean'}):
                      </span>{' '}
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
