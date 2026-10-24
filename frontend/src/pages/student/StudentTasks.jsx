import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { tasksApi, courseApi } from '../../api/endpoints.js';
import { Skeleton, EmptyState } from '../../components/ui/Skeleton.jsx';

export default function StudentTasks() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('upcoming');
  const [selectedCourse, setSelectedCourse] = useState('all');

  const { data: courses = [] } = useQuery({
    queryKey: ['student-courses-filter'],
    queryFn: () => courseApi.list().then(r => r.data.items || r.data).catch(() => []),
  });

  const { data: allTasks = [], isLoading } = useQuery({
    queryKey: ['student-tasks-list'],
    queryFn: () => tasksApi.getMyTasks(90).then(r => r.data),
  });

  if (isLoading) return <Skeleton lines={8} />;

  let filtered = allTasks;
  if (selectedCourse !== 'all') filtered = filtered.filter(t => t.course_code === selectedCourse);

  const thisWeekTasks = filtered.filter(t => !t.submitted && t.days_remaining !== null && t.days_remaining >= 0 && t.days_remaining <= 7);
  const upcomingTasks = filtered.filter(t => !t.submitted && (t.days_remaining === null || t.days_remaining >= 0));
  const submittedTasks = filtered.filter(t => t.submitted);
  const missedTasks = filtered.filter(t => !t.submitted && t.days_remaining !== null && t.days_remaining < 0);

  let currentList = upcomingTasks;
  if (tab === 'this_week') currentList = thisWeekTasks;
  else if (tab === 'submitted') currentList = submittedTasks;
  else if (tab === 'missed') currentList = missedTasks;

  const TABS = [
    { key: 'upcoming', label: 'Upcoming', count: upcomingTasks.length },
    { key: 'this_week', label: 'This Week', count: thisWeekTasks.length },
    { key: 'submitted', label: 'Submitted', count: submittedTasks.length },
    { key: 'missed', label: 'Missed', count: missedTasks.length },
  ];

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-card)',
        padding: 'var(--space-6)', border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)', marginBottom: 'var(--space-6)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)',
      }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink-900)', margin: 0 }}>
            Academic Tasks & Deadlines
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Assignments, lab submissions, and notice deadlines with automated reminder triggers.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Course:</span>
          <select
            value={selectedCourse}
            onChange={e => setSelectedCourse(e.target.value)}
            style={{
              padding: '7px 12px', borderRadius: 'var(--radius-input)',
              border: '1px solid var(--border)', fontSize: 13,
              background: 'var(--surface)', color: 'var(--text)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <option value="all">All Courses</option>
            {courses.map(c => <option key={c.id} value={c.code}>{c.code} – {c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Pill tabs */}
      <div style={{
        display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)',
        background: 'var(--bg)', borderRadius: 'var(--radius-pill)',
        padding: 4, width: 'fit-content', border: '1px solid var(--border)',
      }}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '6px 18px', borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: active ? 700 : 500,
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? 'var(--on-dark)' : 'var(--text-muted)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {t.label}
              {t.count > 0 && (
                <span style={{
                  marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 6px',
                  borderRadius: 'var(--radius-pill)',
                  background: active ? 'rgba(255,255,255,0.25)' : 'var(--border)',
                  color: active ? '#fff' : 'var(--text)',
                }}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Task table */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        {currentList.length === 0 ? (
          <EmptyState title="No tasks here" message="You're all clear in this category." />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                {['Task / Title', 'Course', 'Due & Countdown', 'Status', 'Action'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentList.map(task => {
                const isNotice = task.type === 'notice';
                const isUrgent = task.days_remaining !== null && task.days_remaining <= 2 && !task.submitted;
                const isOverdue = task.days_remaining !== null && task.days_remaining < 0;
                return (
                  <tr key={task.id} style={{ borderBottom: '1px solid var(--border)', background: isUrgent ? 'rgba(240,208,208,0.18)' : 'transparent' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = isUrgent ? 'rgba(240,208,208,0.18)' : 'transparent'}
                  >
                    <td style={{ padding: '13px 16px' }}>
                      {isNotice && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', background: 'var(--watch-bg)', color: 'var(--watch-fg)', borderRadius: 'var(--radius-pill)', marginRight: 6 }}>
                          NOTICE
                        </span>
                      )}
                      <strong style={{ color: 'var(--text)', fontSize: 14 }}>{task.title}</strong>
                      {task.course_name && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{task.course_name}</div>}
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--bg)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
                        {task.course_code}
                      </span>
                    </td>
                    <td style={{ padding: '13px 16px', fontVariantNumeric: 'tabular-nums' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{task.due_at?.slice(0, 10)}</div>
                      <div style={{ fontSize: 11, color: isOverdue ? 'var(--crit-fg)' : isUrgent ? 'var(--must-attend)' : 'var(--text-muted)', fontWeight: isUrgent || isOverdue ? 700 : 400, marginTop: 2 }}>
                        {task.days_remaining != null ? (task.days_remaining < 0 ? `${Math.abs(task.days_remaining)}d overdue` : `${task.days_remaining}d remaining`) : ''}
                      </div>
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      {task.submitted ? (
                        <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--ok-bg)', color: 'var(--ok-fg)', fontSize: 11, fontWeight: 700 }}>Submitted</span>
                      ) : isOverdue ? (
                        <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--crit-bg)', color: 'var(--crit-fg)', fontSize: 11, fontWeight: 700 }}>Overdue</span>
                      ) : isUrgent ? (
                        <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--risk-bg)', color: 'var(--risk-fg)', fontSize: 11, fontWeight: 700 }}>Due Soon</span>
                      ) : (
                        <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 11, border: '1px solid var(--border)' }}>Pending</span>
                      )}
                    </td>
                    <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => isNotice ? navigate('/student/notices') : navigate(`/student/assignments/${task.id}`)}
                        style={{
                          padding: '5px 14px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          background: task.submitted ? 'var(--surface)' : 'var(--accent)',
                          color: task.submitted ? 'var(--text)' : 'var(--on-dark)',
                          border: task.submitted ? '1px solid var(--border)' : 'none',
                          fontFamily: 'var(--font-sans)',
                        }}
                      >
                        {isNotice ? 'View Notice' : task.submitted ? 'View' : 'Submit →'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
