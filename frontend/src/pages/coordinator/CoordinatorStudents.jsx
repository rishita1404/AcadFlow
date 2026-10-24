import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { coordinatorApi } from '../../api/endpoints.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

export default function CoordinatorStudents() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  // Fetch student directory
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['coordinator-students-list'],
    queryFn: () => coordinatorApi.getStudents().then(r => r.data || []),
  });

  // Fetch individual student profile (this automatically writes to AuditLogModel on the backend)
  const { data: studentDetail, isLoading: detailLoading, error: detailError } = useQuery({
    queryKey: ['coordinator-student-profile', selectedStudentId],
    queryFn: () => coordinatorApi.getStudentDetail(selectedStudentId).then(r => r.data),
    enabled: !!selectedStudentId,
    retry: false,
  });

  const filtered = students.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.roll_no?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
  });

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <Skeleton height={100} style={{ marginBottom: 20 }} />
        <Skeleton height={60} style={{ marginBottom: 20 }} />
        <Skeleton height={400} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40, color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          <Link to="/coordinator/summary" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Summary</Link>
          {' '}/ Students Directory
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
          Department Students Directory
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Sanitized individual student records · Sensitive submissions and passwords strictly redacted · Access is audited.
        </p>
      </div>

      {/* Search Bar */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '14px 20px', border: '1px solid var(--border)',
        marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--shadow-card)',
      }}>
        <input
          type="text"
          placeholder="Search by student name, roll number, or email..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, flex: 1 }}
        />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Showing {filtered.length} of {students.length} students
        </span>
      </div>

      {/* Students Table */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Roll No</th>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Name</th>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Batch</th>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Email</th>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Attendance %</th>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Risk Status</th>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No students found.
                </td>
              </tr>
            ) : (
              filtered.map(s => (
                <tr
                  key={s.student_id}
                  onClick={() => setSelectedStudentId(s.student_id)}
                  style={{
                    borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    background: selectedStudentId === s.student_id ? 'var(--bg)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--ink-900)' }}>
                    {s.roll_no || `S-${s.student_id}`}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>
                    {s.name}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                    {s.batch || '2023-2027'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                    {s.email}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: (s.attendance_percentage || 80) >= 75 ? 'var(--ok-fg)' : 'var(--crit-fg)' }}>
                    {s.attendance_percentage ?? 80}%
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <StatusBadge status={s.risk_level || 'Safe'} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedStudentId(s.student_id); }}
                      style={{
                        background: 'var(--bg)', color: 'var(--accent)', border: '1px solid var(--border)',
                        padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      View Profile →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Audited Profile Drawer */}
      {selectedStudentId && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 440,
          background: 'var(--surface)', borderLeft: '1px solid var(--border)', boxShadow: 'var(--shadow-card)',
          zIndex: 1000, display: 'flex', flexDirection: 'column',
        }}>
          {/* Drawer Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--ink-900)' }}>
                {studentDetail?.name || 'Student Profile'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Roll No: {studentDetail?.roll_no || selectedStudentId}
              </div>
            </div>
            <button
              onClick={() => setSelectedStudentId(null)}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              ✕
            </button>
          </div>

          {/* Mandatory Audit Notice Banner */}
          <div style={{
            background: 'var(--watch-bg)', borderBottom: '1px solid var(--border)', padding: '10px 18px',
            fontSize: 12, color: 'var(--watch-fg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>🔒</span>
            <span>This view is recorded in the audit log (Actor ID, timestamp, and target student ID recorded).</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {detailLoading ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>Loading student record...</div>
            ) : detailError ? (
              <div style={{ color: 'var(--crit-fg)', background: 'var(--crit-bg)', padding: 16, borderRadius: 'var(--radius-input)', textAlign: 'center' }}>
                {detailError.response?.status === 403 ? 'Access Denied: Student belongs to another department.' : 'Failed to load details.'}
              </div>
            ) : (
              <div>
                <div style={{
                  background: 'var(--bg)', borderRadius: 'var(--radius-input)', padding: 16, border: '1px solid var(--border)',
                  marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Attendance</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink-900)' }}>
                      {studentDetail?.attendance_percentage}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Buffer</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ok-fg)' }}>
                      +{studentDetail?.buffer_classes || 5} classes
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Risk Band</div>
                    <div style={{ marginTop: 2 }}>
                      <StatusBadge status={studentDetail?.risk_level || 'Safe'} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Enrolled Courses</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink-900)' }}>
                      {studentDetail?.enrolled_courses || 4} Courses
                    </div>
                  </div>
                </div>

                <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 8 }}>Approved Directory Fields</h4>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-input)', padding: 12, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{studentDetail?.email}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Batch:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{studentDetail?.batch || '2023-2027'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Department:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>Dept #{studentDetail?.department_id}</span>
                  </div>
                </div>

                <div style={{ marginTop: 20, background: 'var(--bg)', borderRadius: 'var(--radius-input)', padding: 12, border: '1px dashed var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                  🔒 Ethical Privacy Guard: Submissions, personal files, and credentials are intentionally excluded from coordinator directories.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
