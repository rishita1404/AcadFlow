import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { interventionApi } from '../api/endpoints.js';

const KIND_META = {
  talk: { label: 'In-person Discussion', icon: '🗣️' },
  call: { label: 'Phone Call', icon: '📞' },
  email: { label: 'Email Outreach', icon: '✉️' },
  referral: { label: 'Advisory Referral', icon: '🤝' },
  other: { label: 'Support Action', icon: '📝' },
};

const OUTCOME_OPTIONS = [
  { value: 'open', label: 'Open / In Progress', icon: '⏳', bg: 'var(--watch-bg)', fg: 'var(--watch-fg)' },
  { value: 'recovered', label: 'Recovered (Eligible)', icon: '✅', bg: 'var(--ok-bg)', fg: 'var(--ok-fg)' },
  { value: 'not_recovered', label: 'Not Recovered', icon: '⚠️', bg: 'var(--risk-bg)', fg: 'var(--risk-fg)' },
  { value: 'escalated', label: 'Escalated to Dean', icon: '📢', bg: 'var(--crit-bg)', fg: 'var(--crit-fg)' },
];

export default function InterventionTimeline({ studentId, readOnly = false, onLogNew = null }) {
  const queryClient = useQueryClient();
  const [updatingId, setUpdatingId] = useState(null);

  const { data: interventions = [], isLoading, error } = useQuery({
    queryKey: ['interventions', studentId],
    queryFn: () => interventionApi.getStudentInterventions(studentId).then((r) => r.data || []),
    enabled: !!studentId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, outcome }) => interventionApi.update(id, { outcome }),
    onSuccess: () => {
      queryClient.invalidateQueries(['interventions', studentId]);
      queryClient.invalidateQueries(['follow-ups-due']);
      setUpdatingId(null);
    },
    onError: () => {
      alert('Unable to update outcome. Please verify permissions.');
      setUpdatingId(null);
    },
  });

  function handleOutcomeChange(id, outcome) {
    setUpdatingId(id);
    updateMutation.mutate({ id, outcome });
  }

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--space-4)', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
        Loading intervention history...
      </div>
    );
  }

  if (error) {
    const is403 = error.response?.status === 403;
    return (
      <div
        style={{
          background: 'var(--crit-bg)',
          color: 'var(--crit-fg)',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-input)',
          fontSize: 13,
          border: '1px solid var(--crit-fg)',
        }}
      >
        {is403
          ? '🛡️ Access restricted: You are not authorized to view intervention logs for this student.'
          : '⚠️ Failed to load intervention history.'}
      </div>
    );
  }

  return (
    <div style={{ color: 'var(--text)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--ink-900)' }}>
            Support Intervention History ({interventions.length})
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Documented faculty outreach, agreed steps, and recorded student progression.
          </p>
        </div>
        {!readOnly && onLogNew && (
          <button
            onClick={onLogNew}
            style={{
              background: 'var(--accent)',
              color: 'var(--on-dark)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>+</span>
            <span>Log Action</span>
          </button>
        )}
      </div>

      {interventions.length === 0 ? (
        <div
          style={{
            background: 'var(--bg)',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--space-6)',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 13,
          }}
        >
          No interventions recorded yet for this student.
          {!readOnly && onLogNew && (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={onLogNew}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Log first support action
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {interventions.map((item) => {
            const kindMeta = KIND_META[item.kind] || KIND_META.other;
            const currentOutcome = OUTCOME_OPTIONS.find((o) => o.value === item.outcome) || OUTCOME_OPTIONS[0];
            const dateStr = new Date(item.created_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
            const scoreChange = item.score_change != null ? item.score_change : 0;
            const isFollowUpDue =
              item.follow_up_on &&
              new Date(item.follow_up_on) <= new Date() &&
              item.outcome === 'open';

            return (
              <div
                key={item.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-card)',
                  padding: 'var(--space-4)',
                  boxShadow: 'var(--shadow-card)',
                  position: 'relative',
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }} aria-hidden="true">{kindMeta.icon}</span>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink-900)' }}>
                        {kindMeta.label}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                        {dateStr} by {item.created_by_name || 'Faculty'}
                      </span>
                    </div>
                  </div>

                  {/* Outcome Badge / Human Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {!readOnly ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <label
                          htmlFor={`outcome-select-${item.id}`}
                          style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}
                        >
                          Outcome:
                        </label>
                        <select
                          id={`outcome-select-${item.id}`}
                          value={item.outcome}
                          disabled={updatingId === item.id}
                          onChange={(e) => handleOutcomeChange(item.id, e.target.value)}
                          style={{
                            background: currentOutcome.bg,
                            color: currentOutcome.fg,
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-pill)',
                            padding: '4px 10px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {OUTCOME_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.icon} {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span
                        style={{
                          background: currentOutcome.bg,
                          color: currentOutcome.fg,
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: 12,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span>{currentOutcome.icon}</span>
                        <span>{currentOutcome.label}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Course reference if applicable */}
                {item.course_name && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                    📌 Course: <strong>{item.course_code ? `${item.course_code} - ` : ''}{item.course_name}</strong>
                  </div>
                )}

                {/* Note Content */}
                <div
                  style={{
                    background: 'var(--bg)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-input)',
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: 'var(--text)',
                    marginBottom: 10,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {item.note}
                </div>

                {/* Metrics & Score Delta Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                    fontSize: 12,
                    paddingTop: 6,
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Baseline Score: </span>
                      <strong>{Number(item.score_at_creation).toFixed(1)}</strong>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>({item.band_at_creation})</span>
                    </div>

                    {item.current_score != null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Score Delta:</span>
                        {scoreChange < 0 ? (
                          <span
                            style={{
                              color: 'var(--ok-fg)',
                              background: 'var(--ok-bg)',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-pill)',
                              fontWeight: 700,
                            }}
                          >
                            📉 {scoreChange.toFixed(1)} pts (Improved)
                          </span>
                        ) : scoreChange > 0 ? (
                          <span
                            style={{
                              color: 'var(--risk-fg)',
                              background: 'var(--risk-bg)',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-pill)',
                              fontWeight: 700,
                            }}
                          >
                            📈 +{scoreChange.toFixed(1)} pts
                          </span>
                        ) : (
                          <span
                            style={{
                              color: 'var(--text-muted)',
                              background: 'var(--bg)',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-pill)',
                              fontWeight: 600,
                            }}
                          >
                            ➡️ 0.0 pts (Unchanged)
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Follow-up Indicator */}
                  {item.follow_up_on && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        color: isFollowUpDue ? 'var(--risk-fg)' : 'var(--text-muted)',
                        fontWeight: isFollowUpDue ? 700 : 500,
                      }}
                    >
                      <span>{isFollowUpDue ? '⚠️ Follow-up Due:' : '📅 Follow-up:'}</span>
                      <span>{item.follow_up_on}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
