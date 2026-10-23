import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { coordinatorApi } from '../../api/endpoints.js';
import StatusBadge from '../../components/StatusBadge.jsx';

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
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading student records...</div>;
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
          <Link to="/coordinator/summary" style={{ color: '#3b82f6', textDecoration: 'none' }}>Summary</Link>
          {' '}/ Students Directory
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
          🎓 Department Students Directory
        </h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
          Sanitized individual student records · Sensitive submissions and passwords strictly redacted · Access is audited.
        </p>
      </div>

      {/* Search Bar */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: '14px 20px', border: '1px solid #e2e8f0',
        marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <input
          type="text"
          placeholder="Search by student name, roll number, or email..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, flex: 1 }}
        />
        <span style={{ fontSize: 13, color: '#64748b' }}>
          Showing {filtered.length} of {students.length} students
        </span>
      </div>

      {/* Students Table */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            <tr>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Roll No</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Name</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Batch</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Email</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Attendance %</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Risk Status</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>
                  No students found.
                </td>
              </tr>
            ) : (
              filtered.map(s => (
                <tr
                  key={s.student_id}
                  onClick={() => setSelectedStudentId(s.student_id)}
                  style={{
                    borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                    background: selectedStudentId === s.student_id ? '#eff6ff' : 'transparent',
                  }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: '#1e293b' }}>
                    {s.roll_no || `S-${s.student_id}`}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#334155' }}>
                    {s.name}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>
                    {s.batch || '2023-2027'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>
                    {s.email}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: (s.attendance_percentage || 80) >= 75 ? '#22c55e' : '#ef4444' }}>
                    {s.attendance_percentage ?? 80}%
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <StatusBadge status={s.risk_level || 'Safe'} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedStudentId(s.student_id); }}
                      style={{
                        background: '#f1f5f9', color: '#3b82f6', border: '1px solid #cbd5e1',
                        padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
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
          background: '#fff', borderLeft: '1px solid #cbd5e1', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
          zIndex: 1000, display: 'flex', flexDirection: 'column',
        }}>
          {/* Drawer Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>
                {studentDetail?.name || 'Student Profile'}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Roll No: {studentDetail?.roll_no || selectedStudentId}
              </div>
            </div>
            <button
              onClick={() => setSelectedStudentId(null)}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}
            >
              ✕
            </button>
          </div>

          {/* Mandatory Audit Notice Banner */}
          <div style={{
            background: '#fffbeb', borderBottom: '1px solid #fcd34d', padding: '10px 18px',
            fontSize: 12, color: '#92400e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>🔒</span>
            <span>This view is recorded in the audit log (Actor ID, timestamp, and target student ID recorded).</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {detailLoading ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>Loading student record...</div>
            ) : detailError ? (
              <div style={{ color: '#dc2626', padding: 20, textAlign: 'center' }}>
                {detailError.response?.status === 403 ? 'Access Denied: Student belongs to another department.' : 'Failed to load details.'}
              </div>
            ) : (
              <div>
                <div style={{
                  background: '#f8fafc', borderRadius: 10, padding: 16, border: '1px solid #e2e8f0',
                  marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Attendance</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>
                      {studentDetail?.attendance_percentage}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Buffer</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#22c55e' }}>
                      +{studentDetail?.buffer_classes || 5} classes
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Risk Band</div>
                    <div style={{ marginTop: 2 }}>
                      <StatusBadge status={studentDetail?.risk_level || 'Safe'} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Enrolled Courses</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>
                      {studentDetail?.enrolled_courses || 4} Courses
                    </div>
                  </div>
                </div>

                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Approved Directory Fields</h4>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Email:</span>
                    <span style={{ fontWeight: 600 }}>{studentDetail?.email}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Batch:</span>
                    <span style={{ fontWeight: 600 }}>{studentDetail?.batch || '2023-2027'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                    <span style={{ color: '#64748b' }}>Department:</span>
                    <span style={{ fontWeight: 600 }}>Dept #{studentDetail?.department_id}</span>
                  </div>
                </div>

                <div style={{ marginTop: 20, background: '#f8fafc', borderRadius: 8, padding: 12, border: '1px dashed #cbd5e1', fontSize: 12, color: '#64748b' }}>
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
