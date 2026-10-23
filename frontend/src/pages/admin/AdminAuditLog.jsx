import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/endpoints.js';

export default function AdminAuditLog() {
  const [entityFilter, setEntityFilter] = useState('ALL');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin-audit-logs', entityFilter],
    queryFn: () => adminApi.getAuditLogs(entityFilter !== 'ALL' ? { entity: entityFilter } : {}).then(r => r.data || []),
  });

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading immutable audit trail...</div>;
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
          <Link to="/admin" style={{ color: '#3b82f6', textDecoration: 'none' }}>Admin</Link>
          {' '}/ Audit Trail
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
              📜 Immutable System Audit Log
            </h1>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
              Tamper-evident record of all critical academic transactions: attendance edits, student profile views, excuses, and timetable changes.
            </p>
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: '14px 20px', border: '1px solid #e2e8f0',
        marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Filter by Entity:</span>
        <select
          value={entityFilter}
          onChange={e => setEntityFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 600 }}
        >
          <option value="ALL">All Audit Entities ({logs.length})</option>
          <option value="attendance_records">attendance_records</option>
          <option value="submissions">submissions (excuses)</option>
          <option value="students">students (coordinator profile views)</option>
          <option value="teachers">teachers (coordinator profile views)</option>
          <option value="mentor_notes">mentor_notes</option>
          <option value="timetable_versions">timetable_versions (publishing)</option>
          <option value="notices">notices (broadcasts)</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead style={{ background: '#1e293b', color: '#f8fafc' }}>
            <tr>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Log ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Timestamp (UTC)</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Entity</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Action</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Actor ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 700 }}>Details / Diff</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>
                  No audit logs recorded for this entity.
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: '#1e293b' }}>
                    #{log.id}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12 }}>
                    {log.created_at ? new Date(log.created_at).toLocaleString() : 'Just now'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <code style={{ background: '#f1f5f9', color: '#1e293b', padding: '2px 6px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                      {log.entity}
                    </code>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#3b82f6' }}>
                    {log.action}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>
                    User #{log.actor_id || 'sys'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>
                    {log.old_value && (
                      <span style={{ color: '#dc2626', textDecoration: 'line-through', marginRight: 6 }}>
                        {log.old_value}
                      </span>
                    )}
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>
                      {log.new_value || log.entity_id}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
