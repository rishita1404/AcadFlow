import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { courseApi, facultyApi } from '../../api/endpoints.js';

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
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Breadcrumb & Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
          <Link to="/faculty/home" style={{ color: '#3b82f6', textDecoration: 'none' }}>Home</Link>
          {' '}/ <Link to={`/faculty/courses/${courseId}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
            {course?.code || 'Course'}
          </Link> / Assignments & Submissions
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
              📝 Course Assignments & Submissions: {course?.name}
            </h1>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
              Manage assignment specifications, 48-hour grace windows, and record audited excuses.
            </p>
          </div>
          <button
            onClick={() => setCreateModalOpen(true)}
            style={{
              background: '#3b82f6', color: '#fff', border: 'none',
              padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            + New Assignment
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading assignments...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
          {/* Left panel: List of assignments */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
              Assignments ({assignments.length})
            </h3>
            {assignments.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 20 }}>
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
                        padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                        border: `1px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                        background: isSelected ? '#eff6ff' : '#f8fafc',
                        transition: 'all 0.1s',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 14, color: isSelected ? '#1d4ed8' : '#1e293b' }}>
                        {a.title}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        Due: {a.due_date ? new Date(a.due_date).toLocaleDateString() : 'No date'}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <span style={{ fontSize: 10, background: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                          Weight: {a.weight || 10}%
                        </span>
                        <span style={{ fontSize: 10, background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
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
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 20 }}>
            {activeAssignment ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>
                      {activeAssignment.title}
                    </h2>
                    <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                      {activeAssignment.description || 'No additional description provided.'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Status:</span>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
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
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 700 }}>Student ID</th>
                        <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 700 }}>Version</th>
                        <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 700 }}>Status</th>
                        <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 700 }}>Submitted At</th>
                        <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 700 }}>Hash</th>
                        <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 700 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubmissions.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>
                            No student submissions found.
                          </td>
                        </tr>
                      ) : (
                        filteredSubmissions.map(sub => {
                          const isExcused = sub.status === 'excused';
                          const statusColor = sub.status === 'on_time' ? '#15803d' : sub.status === 'late' ? '#b45309' : isExcused ? '#6366f1' : '#dc2626';
                          const statusBg = sub.status === 'on_time' ? '#dcfce7' : sub.status === 'late' ? '#fef3c7' : isExcused ? '#ede9fe' : '#fee2e2';

                          return (
                            <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e293b' }}>
                                Student #{sub.student_id}
                              </td>
                              <td style={{ padding: '10px 14px', color: '#64748b' }}>
                                v{sub.version || 1}
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <span style={{ background: statusBg, color: statusColor, padding: '3px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
                                  {sub.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', color: '#475569' }}>
                                {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : '—'}
                              </td>
                              <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11 }}>
                                <code>{sub.file_hash?.slice(0, 8) || 'none'}</code>
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                {!isExcused ? (
                                  <button
                                    onClick={() => { setSelectedSubmission(sub); setExcuseModalOpen(true); }}
                                    style={{
                                      background: '#f1f5f9', color: '#6366f1', border: '1px solid #cbd5e1',
                                      padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                    }}
                                  >
                                    Excuse
                                  </button>
                                ) : (
                                  <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>Audited Excuse</span>
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
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                Select an assignment on the left to inspect submissions.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Assignment Modal */}
      {createModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
        }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: 480, maxWidth: '90%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: '0 0 14px 0' }}>
              Create New Course Assignment
            </h3>
            <form onSubmit={handleCreateAssignment}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lab Assignment 4: Binary Trees"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Description</label>
                <textarea
                  rows={3}
                  placeholder="Instructions for students..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Due Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Grace Window (Hours)</label>
                  <input
                    type="number"
                    value={graceHours}
                    onChange={e => setGraceHours(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 10,
                fontSize: 12, color: '#1e40af', marginBottom: 16,
              }}>
                ℹ️ Publishing this assignment will automatically schedule student reminder notifications (-7d, -2d, -24h) and trigger deadline pressure indexing.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  style={{
                    background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1',
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  style={{
                    background: '#3b82f6', color: '#fff', border: 'none',
                    padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
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
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
        }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: 440, maxWidth: '90%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: '0 0 8px 0' }}>
              Excuse Assignment Submission
            </h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 14 }}>
              Excusing excludes this assignment from the student's missed-submission risk penalty. A permanent entry will be recorded in the audit log.
            </p>

            <form onSubmit={handleExcuseSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Audited Reason (Required)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Medical leave certificate verified by dean office"
                  value={excuseReason}
                  onChange={e => setExcuseReason(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setExcuseModalOpen(false)}
                  style={{
                    background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1',
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={excuseMutation.isPending}
                  style={{
                    background: '#6366f1', color: '#fff', border: 'none',
                    padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
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
