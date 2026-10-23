import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { coordinatorApi } from '../../api/endpoints.js';

export default function CoordinatorTeachers() {
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);

  // Fetch teachers list
  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['coordinator-teachers-list'],
    queryFn: () => coordinatorApi.getTeachers().then(r => r.data || []),
  });

  // Fetch teacher profile (writes to AuditLogModel on the backend)
  const { data: teacherDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['coordinator-teacher-profile', selectedTeacherId],
    queryFn: () => coordinatorApi.getTeacherDetail(selectedTeacherId).then(r => r.data),
    enabled: !!selectedTeacherId,
    retry: false,
  });

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading faculty directory...</div>;
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
          <Link to="/coordinator/summary" style={{ color: '#3b82f6', textDecoration: 'none' }}>Summary</Link>
          {' '}/ Faculty Directory
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
          👨‍🏫 Department Faculty & Workload Directory
        </h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
          Approved directory fields · Course staffing, assigned sections, and teaching workloads · Access is audited.
        </p>
      </div>

      {/* Teachers Table */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            <tr>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Faculty Name</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Email</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Role</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Courses Taught</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {teachers.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>
                  No faculty records found in this department.
                </td>
              </tr>
            ) : (
              teachers.map(t => (
                <tr
                  key={t.teacher_id}
                  onClick={() => setSelectedTeacherId(t.teacher_id)}
                  style={{
                    borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                    background: selectedTeacherId === t.teacher_id ? '#eff6ff' : 'transparent',
                  }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e293b' }}>
                    {t.name}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>
                    {t.email}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
                      {t.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(t.courses_taught || []).map(code => (
                        <span key={code} style={{ background: '#f1f5f9', color: '#334155', padding: '2px 6px', borderRadius: 4, fontWeight: 600, fontSize: 11 }}>
                          {code}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedTeacherId(t.teacher_id); }}
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

      {/* Audited Teacher Profile Drawer */}
      {selectedTeacherId && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 440,
          background: '#fff', borderLeft: '1px solid #cbd5e1', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
          zIndex: 1000, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>
                {teacherDetail?.name || 'Faculty Profile'}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {teacherDetail?.email}
              </div>
            </div>
            <button
              onClick={() => setSelectedTeacherId(null)}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}
            >
              ✕
            </button>
          </div>

          {/* Audit Notice Banner */}
          <div style={{
            background: '#fffbeb', borderBottom: '1px solid #fcd34d', padding: '10px 18px',
            fontSize: 12, color: '#92400e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>🔒</span>
            <span>This view is recorded in the audit log (Actor ID, timestamp, and target faculty ID recorded).</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {detailLoading ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>Loading faculty details...</div>
            ) : (
              <div>
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Designation</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginTop: 2, textTransform: 'capitalize' }}>
                    {teacherDetail?.role} · Dept #{teacherDetail?.department_id}
                  </div>
                </div>

                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Courses & Sections Assigned</h4>
                <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
                  {(teacherDetail?.courses_taught || []).map(code => (
                    <div key={code} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, color: '#3b82f6' }}>{code}</span>
                      <span style={{ fontSize: 12, color: '#64748b' }}>Sections: A, B (4 credits)</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 12, fontSize: 12, color: '#15803d' }}>
                  ✓ Faculty credentials and personal profile protected under role-based confidentiality policy.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
