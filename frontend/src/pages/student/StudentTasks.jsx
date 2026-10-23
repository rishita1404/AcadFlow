import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { tasksApi, courseApi } from '../../api/endpoints.js';

export default function StudentTasks() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('upcoming'); // 'this_week' | 'upcoming' | 'submitted' | 'missed'
  const [selectedCourse, setSelectedCourse] = useState('all');

  const { data: courses = [] } = useQuery({
    queryKey: ['student-courses-filter'],
    queryFn: () => courseApi.list().then(r => r.data.items || r.data).catch(() => []),
  });

  const { data: allTasks = [], isLoading } = useQuery({
    queryKey: ['student-tasks-list'],
    queryFn: () => tasksApi.getMyTasks(90).then(r => r.data),
  });

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading tasks...</div>;
  }

  // Filter tasks
  let filtered = allTasks;
  if (selectedCourse !== 'all') {
    filtered = filtered.filter(t => t.course_code === selectedCourse);
  }

  const thisWeekTasks = filtered.filter(t => !t.submitted && t.days_remaining !== null && t.days_remaining >= 0 && t.days_remaining <= 7);
  const upcomingTasks = filtered.filter(t => !t.submitted && (t.days_remaining === null || t.days_remaining >= 0));
  const submittedTasks = filtered.filter(t => t.submitted);
  const missedTasks = filtered.filter(t => !t.submitted && t.days_remaining !== null && t.days_remaining < 0);

  let currentList = upcomingTasks;
  if (tab === 'this_week') currentList = thisWeekTasks;
  else if (tab === 'submitted') currentList = submittedTasks;
  else if (tab === 'missed') currentList = missedTasks;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid #e2e8f0',
        marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>
            📋 Academic Tasks & Deadlines
          </h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            Assignments, lab submissions, and notice deadlines with automated reminder triggers.
          </p>
        </div>

        {/* Course Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Filter Course:</span>
          <select
            value={selectedCourse}
            onChange={e => setSelectedCourse(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
          >
            <option value="all">All Courses</option>
            {courses.map(c => (
              <option key={c.id} value={c.code}>{c.code} - {c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'upcoming', label: `Upcoming (${upcomingTasks.length})` },
          { key: 'this_week', label: `This Week (${thisWeekTasks.length})` },
          { key: 'submitted', label: `Submitted (${submittedTasks.length})` },
          { key: 'missed', label: `Missed (${missedTasks.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: tab === t.key ? '#2563eb' : '#fff',
              color: tab === t.key ? '#fff' : '#475569',
              boxShadow: tab === t.key ? '0 1px 3px rgba(37,99,235,0.2)' : '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tasks Table / List */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {currentList.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <p>No tasks found in this section.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '12px 18px', color: '#475569' }}>Task / Title</th>
                <th style={{ padding: '12px 18px', color: '#475569' }}>Course</th>
                <th style={{ padding: '12px 18px', color: '#475569' }}>Due Date & Countdown</th>
                <th style={{ padding: '12px 18px', color: '#475569' }}>Status</th>
                <th style={{ padding: '12px 18px', color: '#475569' }}>Reminders</th>
                <th style={{ padding: '12px 18px', textAlign: 'right', color: '#475569' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {currentList.map(task => {
                const isNotice = task.type === 'notice';
                const isUrgent = task.days_remaining !== null && task.days_remaining <= 2 && !task.submitted;

                return (
                  <tr
                    key={task.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: isUrgent ? '#fef2f208' : '#fff',
                    }}
                  >
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isNotice && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', background: '#fef3c7', color: '#b45309', borderRadius: 4 }}>
                            NOTICE
                          </span>
                        )}
                        <strong style={{ color: '#1e293b', fontSize: 14 }}>{task.title}</strong>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {task.course_name}
                      </div>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: '#eff6ff', color: '#2563eb' }}>
                        {task.course_code}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{task.due_at?.slice(0, 10)}</div>
                      <div style={{ fontSize: 11, color: isUrgent ? '#dc2626' : '#64748b', fontWeight: isUrgent ? 700 : 400 }}>
                        {task.days_remaining != null ? (task.days_remaining < 0 ? `${Math.abs(task.days_remaining)}d overdue` : `${task.days_remaining}d remaining`) : ''}
                      </div>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      {task.submitted ? (
                        <span style={{ padding: '3px 8px', borderRadius: 4, background: '#dcfce7', color: '#15803d', fontSize: 11, fontWeight: 700 }}>
                          ✓ Submitted
                        </span>
                      ) : isUrgent ? (
                        <span style={{ padding: '3px 8px', borderRadius: 4, background: '#fee2e2', color: '#dc2626', fontSize: 11, fontWeight: 700 }}>
                          ⚠️ Due Soon
                        </span>
                      ) : (
                        <span style={{ padding: '3px 8px', borderRadius: 4, background: '#f1f5f9', color: '#475569', fontSize: 11, fontWeight: 600 }}>
                          Pending
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '14px 18px', color: '#64748b', fontSize: 12 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        🔔 {task.reminder_state}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      {isNotice ? (
                        <button
                          onClick={() => navigate('/student/notices')}
                          style={actionBtnStyle}
                        >
                          View Notice →
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate(`/student/assignments/${task.id}`)}
                          style={{
                            ...actionBtnStyle,
                            background: task.submitted ? '#f1f5f9' : '#2563eb',
                            color: task.submitted ? '#334151' : '#fff',
                            border: task.submitted ? '1px solid #cbd5e1' : 'none',
                          }}
                        >
                          {task.submitted ? 'View Submission' : 'Submit Now →'}
                        </button>
                      )}
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

const actionBtnStyle = {
  padding: '6px 12px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  background: '#eff6ff',
  color: '#2563eb',
  border: '1px solid #bfdbfe',
};
