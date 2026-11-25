import { useState, useRef, useId } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../../api/endpoints';
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  HeartPulse,
  Briefcase,
  Info,
  Send,
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
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-4)',
    }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink-900)', margin: 0 }}>
        {title}
      </h2>
      {right}
    </div>
  );
}

function FieldLabel({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} style={{
      display: 'block',
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: '0.03em',
      textTransform: 'uppercase',
      color: 'var(--ink-800)',
      marginBottom: 6,
    }}>
      {children}
    </label>
  );
}

function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" aria-live="assertive" style={{
      fontSize: 12,
      color: 'var(--crit-fg)',
      marginTop: 4,
      fontWeight: 500,
    }}>
      {children}
    </p>
  );
}

function StatusBadge({ status }) {
  const configs = {
    approved: { icon: <CheckCircle2 size={13} />, label: 'Approved', bg: 'var(--ok-bg)', fg: 'var(--ok-fg)' },
    rejected: { icon: <XCircle size={13} />, label: 'Rejected', bg: 'var(--risk-bg)', fg: 'var(--risk-fg)' },
    pending:  { icon: <Clock size={13} />,        label: 'Pending',  bg: 'var(--watch-bg)', fg: 'var(--watch-fg)' },
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

function EmptyState({ icon, title, message }) {
  return (
    <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
      <div style={{ color: 'var(--border)', marginBottom: 12 }}>{icon}</div>
      <p style={{ fontWeight: 600, color: 'var(--ink-900)', fontSize: 15, margin: 0 }}>{title}</p>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{message}</p>
    </div>
  );
}

// ── Segmented control (radio group with arrow-key nav) ───────────────────────
const CATEGORIES = [
  { value: 'medical', label: 'Medical',      icon: <HeartPulse size={16} /> },
  { value: 'duty',    label: 'Duty / Event', icon: <Briefcase  size={16} /> },
];

function SegmentedControl({ value, onChange, error, errorId }) {
  const groupRef = useRef(null);

  const handleKeyDown = (e, idx) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (idx + 1) % CATEGORIES.length;
      onChange(CATEGORIES[next].value);
      groupRef.current?.querySelectorAll('[role="radio"]')[next]?.focus();
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (idx - 1 + CATEGORIES.length) % CATEGORIES.length;
      onChange(CATEGORIES[prev].value);
      groupRef.current?.querySelectorAll('[role="radio"]')[prev]?.focus();
    }
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="Leave category"
      aria-describedby={error ? errorId : undefined}
      style={{ display: 'flex', gap: 'var(--space-2)' }}
    >
      {CATEGORIES.map((cat, idx) => {
        const active = value === cat.value;
        return (
          <button
            key={cat.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(cat.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8,
              padding: '10px 16px',
              border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-input)',
              background: active ? 'var(--accent)' : 'var(--surface)',
              color: active ? 'var(--on-dark)' : 'var(--text-muted)',
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg)'; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'var(--surface)'; }}
          >
            {cat.icon}
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function daysBetween(from, to) {
  if (!from || !to) return null;
  const ms = new Date(to) - new Date(from);
  return Math.round(ms / 86400000) + 1; // inclusive
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function StudentLeave() {
  const qc = useQueryClient();
  const uid = useId();

  const [leaveType, setLeaveType]   = useState('medical');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [reason, setReason]         = useState('');
  const [submitted, setSubmitted]   = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formSuccess, setFormSuccess] = useState('');
  const [apiError, setApiError]     = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['my-leave-requests'],
    queryFn: () => leaveApi.getMyRequests().then((r) => r.data),
  });

  const submitMutation = useMutation({
    mutationFn: (payload) => leaveApi.submit(payload),
    onSuccess: () => {
      setFormSuccess('Request submitted. Your mentor will review it shortly.');
      setApiError('');
      setReason('');
      setDateFrom('');
      setDateTo('');
      setFieldErrors({});
      setSubmitted(false);
      qc.invalidateQueries({ queryKey: ['my-leave-requests'] });
    },
    onError: (err) => {
      const msg = err.response?.data?.error?.message
        || err.response?.data?.detail?.message
        || 'Could not submit your request. Please try again.';
      setApiError(msg);
      setFormSuccess('');
    },
  });

  const validate = () => {
    const errs = {};
    if (!dateFrom) errs.dateFrom = 'Please choose a start date.';
    if (!dateTo)   errs.dateTo   = 'Please choose an end date.';
    if (dateFrom && dateTo && dateFrom > dateTo)
      errs.dateTo = 'End date cannot be before start date.';
    if (!reason.trim()) errs.reason = 'Please describe the reason for your request.';
    return errs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setApiError('');
    setFormSuccess('');
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    submitMutation.mutate({ type: leaveType, date_from: dateFrom, date_to: dateTo, reason: reason.trim() });
  };

  const days = daysBetween(dateFrom, dateTo);
  const charCount = reason.length;
  const MAX_CHARS = 500;

  const inputStyle = (hasErr) => ({
    width: '100%',
    padding: '10px 14px',
    borderRadius: 'var(--radius-input)',
    border: `1px solid ${hasErr ? 'var(--crit-fg)' : 'var(--border)'}`,
    fontSize: 14,
    color: 'var(--text)',
    background: 'var(--surface)',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  });

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader
        title="My leave"
        subtitle="Request leave for illness or approved duty. Your mentor reviews it."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* ── Left: New request form ── */}
        <Card>
          <CardHeader title="New request" />
          <div style={{ padding: 'var(--space-6)' }}>

            {/* Success banner */}
            {formSuccess && (
              <div role="status" aria-live="polite" style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                background: 'var(--ok-bg)', borderRadius: 'var(--radius-input)',
                padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-5)',
                fontSize: 13, color: 'var(--ok-fg)',
              }}>
                <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                {formSuccess}
              </div>
            )}

            {/* API error banner */}
            {apiError && (
              <div role="alert" aria-live="assertive" style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                background: 'var(--crit-bg)', border: '1px solid var(--crit-fg)',
                borderRadius: 'var(--radius-input)',
                padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-5)',
                fontSize: 13, color: 'var(--crit-fg)',
              }}>
                <XCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                {apiError}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

              {/* Category segmented control */}
              <div>
                <FieldLabel>Category</FieldLabel>
                <SegmentedControl
                  value={leaveType}
                  onChange={setLeaveType}
                  error={submitted && fieldErrors.leaveType}
                  errorId={`${uid}-cat-err`}
                />
              </div>

              {/* Date range */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <FieldLabel htmlFor={`${uid}-from`}>From</FieldLabel>
                  <input
                    id={`${uid}-from`}
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    aria-invalid={!!(submitted && fieldErrors.dateFrom)}
                    aria-describedby={submitted && fieldErrors.dateFrom ? `${uid}-from-err` : undefined}
                    style={inputStyle(submitted && fieldErrors.dateFrom)}
                  />
                  <FieldError id={`${uid}-from-err`}>{submitted && fieldErrors.dateFrom}</FieldError>
                </div>
                <div>
                  <FieldLabel htmlFor={`${uid}-to`}>To</FieldLabel>
                  <input
                    id={`${uid}-to`}
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(e) => setDateTo(e.target.value)}
                    aria-invalid={!!(submitted && fieldErrors.dateTo)}
                    aria-describedby={submitted && fieldErrors.dateTo ? `${uid}-to-err` : undefined}
                    style={inputStyle(submitted && fieldErrors.dateTo)}
                  />
                  <FieldError id={`${uid}-to-err`}>{submitted && fieldErrors.dateTo}</FieldError>
                </div>
              </div>

              {/* Duration hint */}
              {days !== null && days > 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -12 }}>
                  {days} {days === 1 ? 'day' : 'days'}
                </p>
              )}

              {/* Reason */}
              <div>
                <FieldLabel htmlFor={`${uid}-reason`}>Reason</FieldLabel>
                <textarea
                  id={`${uid}-reason`}
                  value={reason}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX_CHARS) setReason(e.target.value);
                  }}
                  rows={5}
                  placeholder="Describe the reason for your request…"
                  aria-invalid={!!(submitted && fieldErrors.reason)}
                  aria-describedby={[
                    `${uid}-reason-counter`,
                    submitted && fieldErrors.reason ? `${uid}-reason-err` : '',
                    `${uid}-reason-hint`,
                  ].filter(Boolean).join(' ')}
                  style={{ ...inputStyle(submitted && fieldErrors.reason), minHeight: 120, resize: 'vertical' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span id={`${uid}-reason-hint`} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    No documents needed. Your mentor will evaluate the reason.
                  </span>
                  <span
                    id={`${uid}-reason-counter`}
                    aria-live="polite"
                    style={{ fontSize: 12, color: charCount > MAX_CHARS - 50 ? 'var(--risk-fg)' : 'var(--text-muted)' }}
                  >
                    {charCount}/{MAX_CHARS}
                  </span>
                </div>
                <FieldError id={`${uid}-reason-err`}>{submitted && fieldErrors.reason}</FieldError>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitMutation.isPending}
                style={{
                  width: '100%',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 24px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--accent)',
                  color: 'var(--on-dark)',
                  border: 'none',
                  fontSize: 15, fontWeight: 600,
                  cursor: submitMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: submitMutation.isPending ? 0.65 : 1,
                  fontFamily: 'var(--font-sans)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!submitMutation.isPending) e.currentTarget.style.background = 'var(--accent-hover)'; }}
                onMouseLeave={e => { if (!submitMutation.isPending) e.currentTarget.style.background = 'var(--accent)'; }}
              >
                <Send size={16} />
                {submitMutation.isPending ? 'Submitting…' : 'Submit request'}
              </button>
            </form>

            {/* Info callout */}
            <div style={{
              marginTop: 'var(--space-6)',
              paddingTop: 'var(--space-5)',
              borderTop: '1px solid var(--border)',
              display: 'flex', gap: 10, alignItems: 'flex-start',
              fontSize: 13, color: 'var(--text-muted)',
            }}>
              <Info size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent)' }} />
              <span>
                Approved leave is not counted as absence. Those sessions are left out of your attendance totals.
              </span>
            </div>
          </div>
        </Card>

        {/* ── Right: History ── */}
        <Card>
          <CardHeader
            title="Request history"
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
              icon={<CalendarDays size={36} />}
              title="No leave requests yet"
              message="Requests you submit appear here with their status."
            />
          ) : (
            <div>
              {requests.map((req, i) => (
                <div key={req.id} style={{
                  padding: 'var(--space-5) var(--space-6)',
                  borderBottom: i < requests.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  {/* Top row: dates + category + status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CategoryPill type={req.type} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtDate(req.date_from)} – {fmtDate(req.date_to)}
                      </span>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>

                  {/* Reason */}
                  <p style={{
                    marginTop: 10,
                    fontSize: 13, color: 'var(--text)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-input)',
                    padding: 'var(--space-3) var(--space-4)',
                  }}>
                    {req.reason}
                  </p>

                  {/* Decision note */}
                  {req.decision_note && (
                    <div style={{
                      marginTop: 10,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-input)',
                      padding: 'var(--space-3) var(--space-4)',
                      fontSize: 13,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                          Mentor note
                        </span>
                        {req.decided_at && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {fmtDate(req.decided_at)}
                          </span>
                        )}
                      </div>
                      <p style={{ color: 'var(--ink-900)', margin: 0 }}>{req.decision_note}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
