import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Filter, Clock, User } from 'lucide-react';
import { adminApi } from '../../api/endpoints.js';
import Skeleton from '../../components/Skeleton.jsx';

export default function AdminAuditLog() {
  const [entityFilter, setEntityFilter] = useState('ALL');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin-audit-logs', entityFilter],
    queryFn: () => adminApi.getAuditLogs(entityFilter !== 'ALL' ? { entity: entityFilter } : {}).then(r => r.data || []),
  });

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
        <Skeleton variant="title" width={320} height={36} />
        <Skeleton variant="text" width={260} height={18} style={{ marginTop: 8, marginBottom: 24 }} />
        <Skeleton variant="card" height={380} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          <Link to="/admin" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Admin</Link>
          {' '}/ Audit Trail
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
              Immutable System Audit Log
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
              Tamper-evident record of all critical academic transactions: attendance edits, student profile views, excuses, and timetable changes.
            </p>
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '16px 20px', border: '1px solid var(--border)',
        marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--shadow-card)',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={14} /> Filter by Entity:
        </span>
        <select
          value={entityFilter}
          onChange={e => setEntityFilter(e.target.value)}
          style={{
            padding: '10px 14px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)',
            background: 'var(--bg)', color: 'var(--ink-900)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
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
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Log ID</th>
              <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Timestamp (UTC)</th>
              <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Entity</th>
              <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Action</th>
              <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Actor ID</th>
              <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Details / Diff</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No audit logs recorded for this entity.
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>
                    #{log.id}
                  </td>
                  <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: 12 }}>
                    {log.created_at ? new Date(log.created_at).toLocaleString() : 'Just now'}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <code style={{ background: 'var(--bg)', color: 'var(--ink-900)', padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 12, border: '1px solid var(--border)' }}>
                      {log.entity}
                    </code>
                  </td>
                  <td style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--accent)' }}>
                    {log.action}
                  </td>
                  <td style={{ padding: '14px 18px', color: 'var(--text)' }}>
                    User #{log.actor_id || 'sys'}
                  </td>
                  <td style={{ padding: '14px 18px', color: 'var(--text)' }}>
                    {log.old_value && (
                      <span style={{ color: 'var(--crit-fg)', textDecoration: 'line-through', marginRight: 8, fontVariantNumeric: 'tabular-nums' }}>
                        {log.old_value}
                      </span>
                    )}
                    <span style={{ color: 'var(--ink-900)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
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
