import { useState, useRef, useId, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi, timetableApi } from '../../api/endpoints';
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  HeartPulse,
  Briefcase,
  Info,
  Send,
  Paperclip,
  X as XIcon,
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

function formatLecturesText(lectureNos) {
  if (!Array.isArray(lectureNos) || lectureNos.length === 0) return '';
  const sorted = [...lectureNos].sort((a, b) => a - b);
  if (sorted.length === 1) return `Lecture ${sorted[0]}`;
  const isContiguous = sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1);
  if (isContiguous) return `Lectures ${sorted[0]} to ${sorted[sorted.length - 1]}`;
  return `Lectures ${sorted.join(', ')}`;
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function StudentLeave() {
  const qc = useQueryClient();
  const uid = useId();
  const fileInputRef = useRef(null);

  const [leaveType, setLeaveType]   = useState('medical');
  const [leaveMode, setLeaveMode]   = useState('full_day');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [selectedLectures, setSelectedLectures] = useState([]);
  const [reason, setReason]         = useState('');
  // Medical-only
  const [medicalFile, setMedicalFile] = useState(null);
  // Duty-only
  const [eventName, setEventName]   = useState('');
  const [clubOrg, setClubOrg]       = useState('');
  const [dutyDetail, setDutyDetail] = useState('');

  const [submitted, setSubmitted]   = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formSuccess, setFormSuccess] = useState('');
  const [apiError, setApiError]     = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['my-leave-requests'],
    queryFn: () => leaveApi.getMyRequests().then((r) => r.data),
  });

  const { data: timetableSlots = [] } = useQuery({
    queryKey: ['my-timetable-for-leave'],
    queryFn: () => (timetableApi?.getMyTimetable ? timetableApi.getMyTimetable().then((r) => r.data || []) : Promise.resolve([])),
  });

  const periodSlotsForDate = useMemo(() => {
    const slots = Array.isArray(timetableSlots) ? timetableSlots : [];
    let maxP = 6;
    slots.forEach((s) => {
      const m = String(s.period_label || '').match(/\d+/);
      if (m) maxP = Math.max(maxP, parseInt(m[0], 10));
    });
    let weekday = null;
    if (dateFrom) {
      const jsDay = new Date(`${dateFrom}T00:00:00`).getDay();
      weekday = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon..5=Sat
    }
    const items = [];
    for (let p = 1; p <= maxP; p++) {
      const match = weekday !== null
        ? slots.find((s) => s.day === weekday && String(s.period_label || '').replace(/\D/g, '') === String(p))
        : null;
      items.push({
        num: p,
        subject: match ? (match.course_short_name || match.course_code || match.course_name) : null,
        time: match && match.start_time && match.end_time ? `${match.start_time} to ${match.end_time}` : null,
      });
    }
    return items;
  }, [timetableSlots, dateFrom]);

  const submitMutation = useMutation({
    mutationFn: (payload) => leaveApi.submit(payload),
    onSuccess: () => {
      setFormSuccess('Request submitted. Your mentor will review it shortly.');
      setApiError('');
      setDateFrom('');
      setDateTo('');
      setSelectedLectures([]);
      setReason('');
      setMedicalFile(null);
      setEventName('');
      setClubOrg('');
      setDutyDetail('');
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
    if (!dateFrom) errs.dateFrom = leaveMode === 'lectures' ? 'Please choose a date.' : 'Please choose a start date.';
    if (leaveMode === 'full_day') {
      if (!dateTo) errs.dateTo = 'Please choose an end date.';
      if (dateFrom && dateTo && dateFrom > dateTo)
        errs.dateTo = 'End date cannot be before start date.';
    } else if (selectedLectures.length === 0) {
      errs.lectures = 'Please select at least one lecture.';
    }
    if (leaveType === 'medical' && !medicalFile)
      errs.medicalFile = 'A medical document is required for medical leave.';
    if (leaveType === 'duty' && !eventName.trim())
      errs.eventName = 'Please enter the event or duty name.';
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
    submitMutation.mutate({
      type: leaveType,
      mode: leaveMode,
      date_from: dateFrom,
      date_to: leaveMode === 'lectures' ? dateFrom : dateTo,
      lecture_nos: leaveMode === 'lectures' ? selectedLectures : undefined,
      reason: reason.trim() || undefined,
      // medical-only
      medical_file: leaveType === 'medical' ? medicalFile : undefined,
      // duty-only
      event_name:   leaveType === 'duty' ? eventName.trim()   : undefined,
      club_org:     leaveType === 'duty' ? clubOrg.trim()     : undefined,
      duty_detail:  leaveType === 'duty' ? dutyDetail.trim()  : undefined,
    });
  };

  const toggleLecture = (num) => {
    setSelectedLectures((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num].sort((a, b) => a - b)
    );
  };

  const days = daysBetween(dateFrom, dateTo);
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
                  onChange={(v) => { setLeaveType(v); setFieldErrors({}); setMedicalFile(null); setEventName(''); setClubOrg(''); setDutyDetail(''); }}
                  error={submitted && fieldErrors.leaveType}
                  errorId={`${uid}-cat-err`}
                />
              </div>

              {/* ── Medical: file upload ─────────────────────────── */}
              {leaveType === 'medical' && (
                <div>
                  <FieldLabel htmlFor={`${uid}-file`}>
                    Medical document <span style={{ color: 'var(--crit-fg)' }}>*</span>
                  </FieldLabel>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                    Upload a prescription, hospital note, or medical certificate (PDF, JPG, PNG — max 5 MB).
                  </p>

                  {/* Hidden input */}
                  <input
                    id={`${uid}-file`}
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    style={{ display: 'none' }}
                    aria-required="true"
                    aria-invalid={!!(submitted && fieldErrors.medicalFile)}
                    aria-describedby={submitted && fieldErrors.medicalFile ? `${uid}-file-err` : undefined}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 5 * 1024 * 1024) {
                        setFieldErrors(prev => ({ ...prev, medicalFile: 'File must be under 5 MB.' }));
                        e.target.value = '';
                        return;
                      }
                      setMedicalFile(f);
                      setFieldErrors(prev => ({ ...prev, medicalFile: '' }));
                    }}
                  />

                  {/* Drop zone / trigger */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                    style={{
                      border: `2px dashed ${submitted && fieldErrors.medicalFile ? 'var(--crit-fg)' : medicalFile ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-input)',
                      background: medicalFile ? 'var(--bg)' : 'var(--surface)',
                      padding: 'var(--space-5)',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    {medicalFile ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                        <Paperclip size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', wordBreak: 'break-all' }}>
                          {medicalFile.name}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                          ({(medicalFile.size / 1024).toFixed(0)} KB)
                        </span>
                        <button
                          type="button"
                          aria-label="Remove file"
                          onClick={(e) => { e.stopPropagation(); setMedicalFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                          style={{
                            marginLeft: 4, background: 'none', border: 'none',
                            cursor: 'pointer', color: 'var(--crit-fg)', display: 'flex',
                          }}
                        >
                          <XIcon size={14} />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <Paperclip size={20} style={{ color: 'var(--text-muted)', margin: '0 auto 6px' }} />
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                          Click to attach a file
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--border)', marginTop: 4 }}>
                          PDF · JPG · PNG up to 5 MB
                        </p>
                      </div>
                    )}
                  </div>
                  <FieldError id={`${uid}-file-err`}>{submitted && fieldErrors.medicalFile}</FieldError>
                </div>
              )}

              {/* ── Duty: event details ──────────────────────────── */}
              {leaveType === 'duty' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div>
                    <FieldLabel htmlFor={`${uid}-event`}>
                      Event / duty name <span style={{ color: 'var(--crit-fg)' }}>*</span>
                    </FieldLabel>
                    <input
                      id={`${uid}-event`}
                      type="text"
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      placeholder="e.g. Inter-college Hackathon 2026"
                      maxLength={120}
                      aria-required="true"
                      aria-invalid={!!(submitted && fieldErrors.eventName)}
                      aria-describedby={submitted && fieldErrors.eventName ? `${uid}-event-err` : undefined}
                      style={inputStyle(submitted && fieldErrors.eventName)}
                    />
                    <FieldError id={`${uid}-event-err`}>{submitted && fieldErrors.eventName}</FieldError>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                      <FieldLabel htmlFor={`${uid}-club`}>Club / organisation</FieldLabel>
                      <input
                        id={`${uid}-club`}
                        type="text"
                        value={clubOrg}
                        onChange={(e) => setClubOrg(e.target.value)}
                        placeholder="e.g. IEEE Student Branch"
                        maxLength={80}
                        style={inputStyle(false)}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor={`${uid}-duty`}>Role / duty</FieldLabel>
                      <input
                        id={`${uid}-duty`}
                        type="text"
                        value={dutyDetail}
                        onChange={(e) => setDutyDetail(e.target.value)}
                        placeholder="e.g. Team lead, participant"
                        maxLength={80}
                        style={inputStyle(false)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Leave mode: Full day(s) vs Specific lectures */}
              <div>
                <FieldLabel>Duration type</FieldLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                  {[
                    { value: 'full_day', label: 'Full day(s)' },
                    { value: 'lectures', label: 'Specific lectures' },
                  ].map((opt) => {
                    const active = leaveMode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setLeaveMode(opt.value);
                          setFieldErrors({});
                        }}
                        style={{
                          padding: '9px 12px',
                          borderRadius: 'var(--radius-input)',
                          border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          background: active ? 'var(--accent)' : 'var(--surface)',
                          color: active ? 'var(--on-dark)' : 'var(--ink-900)',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-sans)',
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date range (full_day) OR single date + lecture checkboxes (lectures) */}
              {leaveMode === 'full_day' ? (
                <>
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
                  {days !== null && days > 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -12 }}>
                      {days} {days === 1 ? 'day' : 'days'}
                    </p>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div>
                    <FieldLabel htmlFor={`${uid}-from`}>Date</FieldLabel>
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
                    <FieldLabel>Select lectures</FieldLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {periodSlotsForDate.map((slot) => {
                        const checked = selectedLectures.includes(slot.num);
                        const labelText = slot.subject && slot.time
                          ? `Lecture ${slot.num}, ${slot.subject}, ${slot.time}`
                          : `Lecture ${slot.num}`;
                        return (
                          <label
                            key={slot.num}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '8px 12px',
                              borderRadius: 'var(--radius-input)',
                              border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                              background: checked ? 'var(--bg)' : 'var(--surface)',
                              fontSize: 13,
                              color: 'var(--ink-900)',
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleLecture(slot.num)}
                              style={{ accentColor: 'var(--accent)' }}
                            />
                            <span style={{ fontWeight: checked ? 600 : 500 }}>{labelText}</span>
                          </label>
                        );
                      })}
                    </div>
                    <FieldError id={`${uid}-lectures-err`}>{submitted && fieldErrors.lectures}</FieldError>
                  </div>
                </div>
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
                  rows={3}
                  placeholder="Optional details for your mentor…"
                  style={{ ...inputStyle(false), minHeight: 84, resize: 'vertical' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {reason.length}/{MAX_CHARS}
                  </span>
                </div>
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
                DL and ML count as present only for sessions where you were marked absent.
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <CategoryPill type={req.type} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>
                        {req.mode === 'lectures'
                          ? `${req.type === 'duty' ? 'DL' : 'ML'}, ${fmtDate(req.date_from)}, ${formatLecturesText(req.lecture_nos)}`
                          : `${req.type === 'duty' ? 'DL' : 'ML'}, ${fmtDate(req.date_from)} – ${fmtDate(req.date_to)}`}
                      </span>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>

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
