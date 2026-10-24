import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { courseApi, facultyApi } from '../../api/endpoints.js';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

export default function FacultyAssignments() {
  const { id } = useParams();
  const courseId = Number(id);
  const queryClient = useQueryClient();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [excuseModalOpen, setExcuseModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [excuseReason, setExcuseReason] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [graceHours, setGraceHours] = useState(48);
  const [weight, setWeight] = useState(10);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Fetch course info
  const { data: course } = useQuery({
    queryKey: ['course-detail', courseId],
    queryFn: () => courseApi.getCourse(courseId).then(r => r.data),
    enabled: !!courseId,
  });

  // Fetch assignments
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['course-assignments', courseId],
    queryFn: () => facultyApi.getAssignments(courseId).then(r => r.data || []),
    enabled: !!courseId,
  });

  const activeAssignment = selectedAssignment || (assignments.length > 0 ? assignments[0] : null);

  // Fetch submissions for active assignment
  const { data: submissions = [] } = useQuery({
    queryKey: ['assignment-submissions', activeAssignment?.id],
    queryFn: () => facultyApi.getSubmissions(activeAssignment?.id).then(r => r.data || []),
    enabled: !!activeAssignment?.id,
  });

  // Create Assignment Mutation
  const createMutation = useMutation({
    mutationFn: (payload) => facultyApi.createAssignment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['course-assignments', courseId]);
      setCreateModalOpen(false);
      setTitle('');
      setDescription('');
      setDueDate('');
    },
  });

  // Excuse Submission Mutation
  const excuseMutation = useMutation({
    mutationFn: ({ subId, reason }) => facultyApi.excuseSubmission(subId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries(['assignment-submissions', activeAssignment?.id]);
      setExcuseModalOpen(false);
      setExcuseReason('');
      setSelectedSubmission(null);
    },
  });

  function handleCreateAssignment(e) {
    e.preventDefault();
    createMutation.mutate({
      course_id: courseId,
      title,
      description,
      due_date: dueDate,
      grace_hours: Number(graceHours),
      weight: Number(weight),
      is_active: true,
    });
  }

  function handleExcuseSubmit(e) {
    e.preventDefault();
    if (!selectedSubmission || !excuseReason.trim()) return;
    excuseMutation.mutate({
      subId: selectedSubmission.id,
      reason: excuseReason.trim(),
    });
  }

  const filteredSubmissions = submissions.filter(s => {
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    return true;
  });

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40, color: 'var(--text)' }}>
      {/* Breadcrumb & Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          <Link to="/faculty/home" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Home</Link>
          {' '}/ <Link to={`/faculty/courses/${courseId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            {course?.code || 'Course'}
          </Link> / Assignments & Submissions
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
              Course Assignments & Submissions: {course?.name}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              Manage assignment specifications, 48-hour grace windows, and record audited excuses.
            </p>
          </div>
          <button
            onClick={() => setCreateModalOpen(true)}
            style={{
              background: 'var(--accent)', color: 'var(--on-dark)', border: 'none',
              padding: '10px 20px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            + New Assignment
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ maxWidth: 1440, margin: '0 auto' }}>
          <Skeleton height={200} style={{ marginBottom: 20 }} />
          <Skeleton height={400} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
          {/* Left panel: List of assignments */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: 16, boxShadow: 'var(--shadow-card)' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 12 }}>
              Assignments ({assignments.length})
            </h3>
            {assignments.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
                No assignments created yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {assignments.map(a => {
                  const isSelected = activeAssignment?.id === a.id;
                  return (
                    <div
                      key={a.id}
                      onClick={() => setSelectedAssignment(a)}
                      style={{
                        padding: '12px 14px', borderRadius: 'var(--radius-input)', cursor: 'pointer',
                        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                        background: isSelected ? 'var(--bg)' : 'var(--surface)',
                        transition: 'all 0.1s',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 14, color: isSelected ? 'var(--accent)' : 'var(--ink-900)' }}>
                        {a.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        Due: {a.due_date ? new Date(a.due_date).toLocaleDateString() : 'No date'}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <span style={{ fontSize: 10, background: 'var(--bg)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: 'var(--radius-pill)', fontWeight: 700, border: '1px solid var(--border)' }}>
                          Weight: {a.weight || 10}%
                        </span>
                        <span style={{ fontSize: 10, background: 'var(--ok-bg)', color: 'var(--ok-fg)', padding: '2px 6px', borderRadius: 'var(--radius-pill)', fontWeight: 700 }}>
                          +{a.grace_hours || 48}h Grace
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right panel: Submissions Table */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: 20, boxShadow: 'var(--shadow-card)' }}>
            {activeAssignment ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
                      {activeAssignment.title}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                      {activeAssignment.description || 'No additional description provided.'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Status:</span>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      style={{ padding: '6px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12 }}
                    >
                      <option value="ALL">All Submissions</option>
                      <option value="on_time">On Time</option>
                      <option value="late">Late (In Grace)</option>
                      <option value="missed">Missed</option>
                      <option value="excused">Excused</option>
                    </select>
                  </div>
                </div>

                {/* Submissions Table */}
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-input)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      <tr>
                        <th style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 600 }}>Student ID</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 600 }}>Version</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 600 }}>Status</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 600 }}>Submitted At</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 600 }}>Hash</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 600 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubmissions.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                            No student submissions found.
                          </td>
                        </tr>
                      ) : (
                        filteredSubmissions.map(sub => {
                          const isExcused = sub.status === 'excused';
                          const statusColor = sub.status === 'on_time' ? 'var(--ok-fg)' : sub.status === 'late' ? 'var(--watch-fg)' : isExcused ? 'var(--accent)' : 'var(--crit-fg)';
                          const statusBg = sub.status === 'on_time' ? 'var(--ok-bg)' : sub.status === 'late' ? 'var(--watch-bg)' : isExcused ? 'var(--bg)' : 'var(--crit-bg)';

                          return (
                            <tr key={sub.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--ink-900)' }}>
                                Student #{sub.student_id}
                              </td>
                              <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                                v{sub.version || 1}
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <span style={{ background: statusBg, color: statusColor, padding: '3px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
                                  {sub.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', color: 'var(--text)' }}>
                                {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : '—'}
                              </td>
                              <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 11 }}>
                                <code>{sub.file_hash?.slice(0, 8) || 'none'}</code>
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                {!isExcused ? (
                                  <button
                                    onClick={() => { setSelectedSubmission(sub); setExcuseModalOpen(true); }}
                                    style={{
                                      background: 'var(--bg)', color: 'var(--accent)', border: '1px solid var(--border)',
                                      padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                    }}
                                  >
                                    Excuse
                                  </button>
                                ) : (
                                  <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>Audited Excuse</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                Select an assignment on the left to inspect submissions.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Assignment Modal */}
      {createModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(13,27,42,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
        }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-dialog)', padding: 24, width: 480, maxWidth: '90%', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', margin: '0 0 14px 0' }}>
              Create New Course Assignment
            </h3>
            <form onSubmit={handleCreateAssignment}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lab Assignment 4: Binary Trees"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Description</label>
                <textarea
                  rows={3}
                  placeholder="Instructions for students..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'var(--font-sans)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Due Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Grace Window (Hours)</label>
                  <input
                    type="number"
                    value={graceHours}
                    onChange={e => setGraceHours(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-input)', padding: 10,
                fontSize: 12, color: 'var(--text-muted)', marginBottom: 16,
              }}>
                ℹ️ Publishing this assignment will automatically schedule student reminder notifications (-7d, -2d, -24h) and trigger deadline pressure indexing.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  style={{
                    background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
                    padding: '8px 16px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  style={{
                    background: 'var(--accent)', color: 'var(--on-dark)', border: 'none',
                    padding: '8px 20px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {createMutation.isPending ? 'Publishing...' : 'Publish Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excuse Submission Modal */}
      {excuseModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(13,27,42,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
        }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-dialog)', padding: 24, width: 440, maxWidth: '90%', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', margin: '0 0 8px 0' }}>
              Excuse Assignment Submission
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>
              Excusing excludes this assignment from the student's missed-submission risk penalty. A permanent entry will be recorded in the audit log.
            </p>

            <form onSubmit={handleExcuseSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  Audited Reason (Required)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Medical leave certificate verified by dean office"
                  value={excuseReason}
                  onChange={e => setExcuseReason(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setExcuseModalOpen(false)}
                  style={{
                    background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
                    padding: '8px 16px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={excuseMutation.isPending}
                  style={{
                    background: 'var(--accent)', color: 'var(--on-dark)', border: 'none',
                    padding: '8px 20px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {excuseMutation.isPending ? 'Recording...' : 'Record Audited Excuse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
