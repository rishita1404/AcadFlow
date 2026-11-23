import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { interventionApi } from '../api/endpoints.js';

const ACTION_KINDS = [
  { value: 'talk', label: 'In-person Discussion', icon: '🗣️' },
  { value: 'call', label: 'Phone Call', icon: '📞' },
  { value: 'email', label: 'Email Outreach', icon: '✉️' },
  { value: 'referral', label: 'Advisory Referral', icon: '🤝' },
  { value: 'other', label: 'Other Support Action', icon: '📝' },
];

export default function InterventionModal({
  isOpen,
  onClose,
  studentId,
  studentName = 'Student',
  courseId = null,
  courseName = null,
  onSuccess = null,
}) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState('talk');
  const [note, setNote] = useState('');
  const [followUpOn, setFollowUpOn] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const createMutation = useMutation({
    mutationFn: (payload) => interventionApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['interventions', studentId]);
      queryClient.invalidateQueries(['follow-ups-due']);
      queryClient.invalidateQueries(['course-at-risk']);
      queryClient.invalidateQueries(['faculty-mentees-list']);
      if (onSuccess) onSuccess();
      onClose();
      // Reset form
      setKind('talk');
      setNote('');
      setFollowUpOn('');
      setErrorMsg('');
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || 'Failed to record intervention. Please check permissions.';
      setErrorMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  if (!isOpen) return null;

  function handleSubmit(e) {
    e.preventDefault();
    if (!note.trim()) {
      setErrorMsg('Please enter an action note describing the support provided.');
      return;
    }
    setErrorMsg('');
    createMutation.mutate({
      student_id: studentId,
      course_id: courseId ? Number(courseId) : null,
      kind,
      note: note.trim(),
      follow_up_on: followUpOn || null,
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="intervention-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(13, 27, 42, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: 'var(--space-4)',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-card)',
          width: '100%',
          maxWidth: 520,
          padding: 'var(--space-6)',
          color: 'var(--text)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Support Action Log
            </div>
            <h2 id="intervention-modal-title" style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, margin: '4px 0 0', color: 'var(--ink-900)' }}>
              Log Action for {studentName}
            </h2>
            {courseName && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Course: {courseName}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: 'var(--text-muted)',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {errorMsg && (
          <div
            role="alert"
            style={{
              background: 'var(--crit-bg)',
              color: 'var(--crit-fg)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-input)',
              fontSize: 13,
              marginBottom: 'var(--space-4)',
              border: '1px solid var(--crit-fg)',
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Action Kind */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              Action Type
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {ACTION_KINDS.map((k) => {
                const selected = kind === k.value;
                return (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => setKind(k.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-input)',
                      border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: selected ? 'var(--bg)' : 'var(--surface)',
                      color: selected ? 'var(--ink-900)' : 'var(--text)',
                      fontWeight: selected ? 700 : 500,
                      fontSize: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span>{k.icon}</span>
                    <span>{k.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Note */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Action Summary & Discussion Notes <span style={{ color: 'var(--risk-fg)' }}>*</span>
            </label>
            <textarea
              rows={4}
              required
              placeholder="Detail the discussion, agreed next steps, or specific support provided..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-input)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 13,
                boxSizing: 'border-box',
                fontFamily: 'var(--font-sans)',
              }}
            />
          </div>

          {/* Follow-up Date */}
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <label
              htmlFor="follow-up-date-input"
              style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}
            >
              Follow-up Review Date (Optional)
            </label>
            <input
              id="follow-up-date-input"
              type="date"
              value={followUpOn}
              onChange={(e) => setFollowUpOn(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-input)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 13,
                boxSizing: 'border-box',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
              Setting a date adds an actionable reminder to your faculty follow-up queue.
            </span>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={createMutation.isPending}
              style={{
                background: 'var(--bg)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              style={{
                background: 'var(--accent)',
                color: 'var(--on-dark)',
                border: 'none',
                padding: '8px 20px',
                borderRadius: 'var(--radius-pill)',
                fontSize: 13,
                fontWeight: 600,
                cursor: createMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: createMutation.isPending ? 0.7 : 1,
              }}
            >
              {createMutation.isPending ? 'Saving...' : 'Record Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
