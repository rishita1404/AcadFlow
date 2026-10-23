import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/endpoints.js';

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users-list', roleFilter],
    queryFn: () => adminApi.getUsers(roleFilter !== 'ALL' ? { role: roleFilter } : {}).then(r => r.data || []),
  });

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading user directory...</div>;
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
          <Link to="/admin" style={{ color: '#3b82f6', textDecoration: 'none' }}>Admin</Link>
          {' '}/ Users & Access Control
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
          👤 User Accounts & Role Governance
        </h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
          Centrally inspect user identities, assigned primary roles, department scoping, and authentication metrics.
        </p>
      </div>

      {/* Filter toolbar */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: '14px 20px', border: '1px solid #e2e8f0',
        marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, minWidth: 260, flex: 1 }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Role:</span>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 600 }}
          >
            <option value="ALL">All Roles ({users.length})</option>
            <option value="student">Student</option>
            <option value="faculty">Faculty</option>
            <option value="coordinator">Coordinator</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            <tr>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>User ID</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Full Name</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Email Address</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Role</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Department</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>
                  No users found.
                </td>
              </tr>
            ) : (
              filtered.map(u => {
                const roleColor = u.role === 'admin' ? '#b45309' : u.role === 'faculty' ? '#6d28d9' : u.role === 'coordinator' ? '#1d4ed8' : '#15803d';
                const roleBg = u.role === 'admin' ? '#fef3c7' : u.role === 'faculty' ? '#f5f3ff' : u.role === 'coordinator' ? '#eff6ff' : '#dcfce7';

                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#1e293b' }}>
                      #{u.id}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1e293b' }}>
                      {u.name}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>
                      {u.email}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        background: roleBg, color: roleColor, padding: '3px 8px', borderRadius: 4,
                        fontWeight: 700, fontSize: 11, textTransform: 'uppercase',
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>
                      {u.department_id ? `Dept #${u.department_id}` : 'Global'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 12 }}>
                        ● Active
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
