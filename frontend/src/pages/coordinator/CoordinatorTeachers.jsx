import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { coordinatorApi } from '../../api/endpoints.js';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

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
    return (
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <Skeleton height={100} style={{ marginBottom: 20 }} />
        <Skeleton height={350} />
      </div>
    );
  }

  const activeTeacher = teachers.find(t => t.teacher_id === selectedTeacherId);

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40, color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          <Link to="/coordinator/summary" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Summary</Link>
          {' '}/ Faculty Directory
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
          Department Faculty & Workload Directory
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Department: <strong style={{ color: 'var(--ink-900)' }}>CSE AI (Dept #4)</strong> · Course staffing, assigned sections, and teaching workloads · Access is audited.
        </p>
      </div>

      {/* Teachers Table */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Faculty Name</th>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Email</th>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Role</th>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Department</th>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Courses Taught</th>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {teachers.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No faculty records found in this department.
                </td>
              </tr>
            ) : (
              teachers.map(t => (
                <tr
                  key={t.teacher_id}
                  onClick={() => setSelectedTeacherId(t.teacher_id)}
                  style={{
                    borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    background: selectedTeacherId === t.teacher_id ? 'var(--bg)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--ink-900)' }}>
                    {t.name}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                    {t.email}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: 'var(--bg)', color: 'var(--accent)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
                      {t.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--ink-900)', fontWeight: 600 }}>
                    {t.department_name || 'CSE AI'} <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(Dept #{t.department_id || 4})</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text)' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(t.courses_taught || []).map(code => (
                        <span key={code} style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 11 }}>
                          {code}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedTeacherId(t.teacher_id); }}
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

      {/* Audited Teacher Profile Drawer */}
      {selectedTeacherId && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 440,
          background: 'var(--surface)', borderLeft: '1px solid var(--border)', boxShadow: 'var(--shadow-card)',
          zIndex: 1000, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--ink-900)' }}>
                {teacherDetail?.name || activeTeacher?.name || 'Faculty Profile'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {teacherDetail?.email || activeTeacher?.email}
              </div>
            </div>
            <button
              onClick={() => setSelectedTeacherId(null)}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              ✕
            </button>
          </div>

          {/* Audit Notice Banner */}
          <div style={{
            background: 'var(--watch-bg)', borderBottom: '1px solid var(--border)', padding: '10px 18px',
            fontSize: 12, color: 'var(--watch-fg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>🔒</span>
            <span>This view is recorded in the audit log (Actor ID, timestamp, and target faculty ID recorded).</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {detailLoading && !activeTeacher ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>Loading faculty details...</div>
            ) : (
              <div>
                <div style={{ background: 'var(--bg)', padding: 16, borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Designation & Department</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', marginTop: 2, textTransform: 'capitalize' }}>
                    {(teacherDetail?.role || activeTeacher?.role || 'Faculty')} · {teacherDetail?.department_name || activeTeacher?.department_name || 'CSE AI'} (Dept #{teacherDetail?.department_id || activeTeacher?.department_id || 4})
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Department Code: <strong style={{ color: 'var(--accent)' }}>{teacherDetail?.department_code || activeTeacher?.department_code || 'CSE-AI'}</strong>
                  </div>
                </div>

                <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 8 }}>Courses & Sections Assigned</h4>
                <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
                  {((teacherDetail?.courses_taught || activeTeacher?.courses_taught || []).length === 0 ? (
                    <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 12 }}>No courses assigned.</div>
                  ) : (
                    (teacherDetail?.courses_taught || activeTeacher?.courses_taught || []).map(code => (
                      <div key={code} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-input)', padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{code}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sections: A, B, C (4 credits)</span>
                      </div>
                    ))
                  ))}
                </div>

                <div style={{ background: 'var(--ok-bg)', border: '1px solid var(--sand)', borderRadius: 'var(--radius-input)', padding: 12, fontSize: 12, color: 'var(--ok-fg)' }}>
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
