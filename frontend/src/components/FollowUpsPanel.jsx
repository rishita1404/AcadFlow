import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { interventionApi } from '../api/endpoints.js';

const KIND_ICONS = {
  talk: '🗣️',
  call: '📞',
  email: '✉️',
  referral: '🤝',
  other: '📝',
};

export default function FollowUpsPanel({ daysAhead = 7, onSelectStudent = null }) {
  const queryClient = useQueryClient();
  const [updatingId, setUpdatingId] = useState(null);

  const { data: followUps = [], isLoading, error } = useQuery({
    queryKey: ['follow-ups-due', daysAhead],
    queryFn: () => interventionApi.getFollowUpsDue(daysAhead).then((r) => r.data || []),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, outcome }) => interventionApi.update(id, { outcome }),
    onSuccess: () => {
      queryClient.invalidateQueries(['follow-ups-due']);
      queryClient.invalidateQueries(['interventions']);
      setUpdatingId(null);
    },
    onError: () => {
      alert('Unable to close follow-up. Please try again.');
      setUpdatingId(null);
    },
  });

  if (isLoading) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 'var(--space-4)', color: 'var(--text-muted)', fontSize: 13 }}>
        Checking scheduled follow-ups...
      </div>
    );
  }

  if (error) {
    return null; // Faculty may not have mentees/students
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: 'var(--space-4)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }} aria-hidden="true">📋</span>
          <div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--ink-900)' }}>
              Follow-ups Due ({followUps.length})
            </h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Student check-ins scheduled within the next {daysAhead} days
            </span>
          </div>
        </div>
      </div>

      {followUps.length === 0 ? (
        <div
          style={{
            background: 'var(--bg)',
            borderRadius: 'var(--radius-input)',
            padding: 'var(--space-4)',
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--text-muted)',
          }}
        >
          ✓ No urgent student follow-ups scheduled for this period.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {followUps.map((item) => {
            const isOverdue = item.follow_up_on && item.follow_up_on < today;
            const isToday = item.follow_up_on === today;
            const icon = KIND_ICONS[item.kind] || '📝';

            return (
              <div
                key={item.id}
                style={{
                  background: isOverdue ? 'var(--risk-bg)' : 'var(--bg)',
                  border: isOverdue ? '1px solid var(--risk-fg)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-input)',
                  padding: '10px 12px',
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontWeight: 700, color: isOverdue ? 'var(--risk-fg)' : 'var(--ink-900)' }}>
                    <span>{icon} </span>
                    <span>{item.student_name || `Student #${item.student_id}`}</span>
                    {item.student_roll_no && (
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>
                        ({item.student_roll_no})
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: isOverdue ? 'var(--risk-fg)' : isToday ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    {isOverdue ? `⚠️ Overdue (${item.follow_up_on})` : isToday ? '📅 Today' : `📅 ${item.follow_up_on}`}
                  </span>
                </div>

                <div
                  style={{
                    color: 'var(--text)',
                    marginBottom: 8,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.note}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Risk at log: <strong>{Number(item.score_at_creation).toFixed(1)}</strong> ({item.band_at_creation})
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => {
                        setUpdatingId(item.id);
                        updateMutation.mutate({ id: item.id, outcome: 'recovered' });
                      }}
                      disabled={updatingId === item.id}
                      style={{
                        background: 'var(--ok-bg)',
                        color: 'var(--ok-fg)',
                        border: 'none',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      ✓ Mark Recovered
                    </button>
                    <Link
                      to={`/faculty/mentees/${item.student_id}`}
                      style={{
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: 11,
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      Open Details →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
