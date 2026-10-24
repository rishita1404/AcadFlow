import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, CheckCircle2, User } from 'lucide-react';
import { adminApi } from '../../api/endpoints.js';
import Skeleton from '../../components/Skeleton.jsx';

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
    return (
      <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
        <Skeleton variant="title" width={320} height={36} />
        <Skeleton variant="text" width={240} height={18} style={{ marginTop: 8, marginBottom: 24 }} />
        <Skeleton variant="card" height={360} />
      </div>
    );
  }

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return { bg: 'var(--watch-bg)', fg: 'var(--watch-fg)' };
      case 'coordinator':
        return { bg: 'var(--bg)', fg: 'var(--ink-900)' };
      case 'faculty':
        return { bg: 'var(--bg)', fg: 'var(--accent)' };
      case 'student':
      default:
        return { bg: 'var(--ok-bg)', fg: 'var(--ok-fg)' };
    }
  };

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          <Link to="/admin" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Admin</Link>
          {' '}/ Users & Access Control
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
          User Accounts & Role Governance
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Centrally inspect user identities, assigned primary roles, department scoping, and authentication metrics.
        </p>
      </div>

      {/* Filter toolbar */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '16px 20px', border: '1px solid var(--border)',
        marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', boxShadow: 'var(--shadow-card)',
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 14px 10px 36px',
              borderRadius: 'var(--radius-input)', border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--ink-900)', fontSize: 13,
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Filter size={14} /> Role:
          </span>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            style={{
              padding: '10px 14px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--ink-900)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
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
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>User ID</th>
              <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Full Name</th>
              <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Email Address</th>
              <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Role</th>
              <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Department</th>
              <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No users found matching your search.
                </td>
              </tr>
            ) : (
              filtered.map(u => {
                const badge = getRoleBadge(u.role);
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>
                      #{u.id}
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--ink-900)' }}>
                      {u.name}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text)' }}>
                      {u.email}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        background: badge.bg, color: badge.fg, padding: '3px 10px', borderRadius: 'var(--radius-pill)',
                        fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>
                      {u.department_id ? `Dept #${u.department_id}` : 'Global'}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        color: 'var(--ok-fg)', background: 'var(--ok-bg)',
                        padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 11,
                      }}>
                        <CheckCircle2 size={12} /> Active
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
