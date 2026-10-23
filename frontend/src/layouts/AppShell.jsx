import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.jsx';
import { useQuery } from '@tanstack/react-query';
import { notificationApi } from '../api/endpoints.js';

export default function AppShell() {
  const { user, permissions, activeRole, switchRole, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const duties = permissions?.duties || [activeRole];
  const allowedRoles = permissions?.allowed_roles || [activeRole];
  const hasMultipleRoles = allowedRoles.length > 1 || duties.length > 1;

  const { data: unread = 0 } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationApi.unreadCount().then(r => r.data.unread_count).catch(() => 0),
    refetchInterval: 60_000,
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNavItems = () => {
    if (activeRole === 'student') {
      return [
        { to: '/student/home', label: '🏠 Home', exact: true },
        { to: '/student/calendar', label: '📅 Calendar' },
        { to: '/student/tasks', label: '📋 Tasks' },
        { to: '/student/timetable', label: '🗓 Timetable' },
        { to: '/student/risk', label: '⚠️ Risk Analysis' },
        { to: '/student/notices', label: '📢 Notices' },
        { to: '/student/notifications', label: '🔔 Notifications', badge: unread },
        { to: '/student/preferences', label: '⚙️ Preferences' },
      ];
    }

    if (activeRole === 'faculty' || activeRole === 'trainer') {
      const items = [
        { to: '/faculty/home', label: '🏠 Home', exact: true },
        { to: '/faculty/courses', label: '📚 My Courses' },
      ];
      if (duties.includes('mentor') || activeRole === 'mentor') {
        items.push({ to: '/faculty/mentees', label: '👥 Mentees' });
      }
      if (duties.includes('course_coordinator')) {
        items.push({ to: '/faculty/sections', label: '📊 Sections' });
      }
      items.push({ to: '/faculty/timetable', label: '🗓 My Timetable' });
      items.push({ to: '/notices', label: '📢 Notices' });
      items.push({ to: '/notifications', label: '🔔 Notifications', badge: unread });
      return items;
    }

    if (activeRole === 'coordinator') {
      return [
        { to: '/coordinator/summary', label: '📊 Summary', exact: true },
        { to: '/coordinator/deadlines', label: '📅 Deadline Load' },
        { to: '/coordinator/students', label: '🎓 Students' },
        { to: '/coordinator/teachers', label: '👨‍🏫 Teachers' },
        { to: '/coordinator/timetable', label: '🗓 Timetable' },
        { to: '/notices', label: '📢 Notices' },
        { to: '/notifications', label: '🔔 Notifications', badge: unread },
      ];
    }

    if (activeRole === 'admin') {
      return [
        { to: '/admin', label: '🏠 Home', exact: true },
        { to: '/admin/risk-config', label: '⚙️ Risk Config' },
        { to: '/admin/assignments', label: '📋 Assignments' },
        { to: '/admin/data', label: '💾 Data & Users' },
        { to: '/admin/timetable', label: '🗓 Timetable' },
        { to: '/notices', label: '📢 Notices' },
        { to: '/admin/ml', label: '🤖 ML & Monitoring' },
        { to: '/admin/audit', label: '🛡️ Audit Log' },
        { to: '/notifications', label: '🔔 Notifications', badge: unread },
      ];
    }

    return [
      { to: '/student/home', label: '🏠 Home' },
      { to: '/notifications', label: '🔔 Notifications', badge: unread },
    ];
  };

  const navItems = getNavItems();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? 230 : 64,
        background: '#1e293b',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid #334155',
        }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#60a5fa', whiteSpace: 'nowrap' }}>
            {sidebarOpen ? '🎓 AcadFlow' : '🎓'}
          </span>
        </div>

        {/* Navigation list */}
        <nav style={{ flex: 1, paddingTop: 12, overflowY: 'auto' }}>
          {navItems.map(({ to, label, exact, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 18px',
                color: isActive ? '#60a5fa' : '#cbd5e1',
                background: isActive ? '#0f172a' : 'transparent',
                textDecoration: 'none',
                fontWeight: isActive ? 600 : 400,
                fontSize: 13,
                borderLeft: isActive ? '3px solid #60a5fa' : '3px solid transparent',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              })}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                {label}
                {badge > 0 && (
                  <span style={{
                    background: '#ef4444', color: '#fff', borderRadius: 9999,
                    fontSize: 10, padding: '1px 6px', fontWeight: 700, marginLeft: 'auto',
                  }}>{badge}</span>
                )}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* User Card */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid #334155', fontSize: 13 }}>
          {sidebarOpen && user && (
            <div style={{ marginBottom: 10, color: '#94a3b8' }}>
              <div style={{ color: '#f1f5f9', fontWeight: 600 }}>{user.name}</div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#60a5fa' }}>
                {activeRole} {duties.length > 1 ? `(${duties.join(', ')})` : ''}
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              background: '#ef4444', color: '#fff', border: 'none',
              borderRadius: 6, padding: '7px 12px', cursor: 'pointer',
              fontSize: 12, width: sidebarOpen ? '100%' : 'auto',
              fontWeight: 600,
            }}
          >
            {sidebarOpen ? '🚪 Sign Out' : '🚪'}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <header style={{
          height: 56, background: '#fff', borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        }}>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20 }}
            title="Toggle sidebar"
          >
            ☰
          </button>

          <span style={{ fontWeight: 600, color: '#1e293b', fontSize: 15 }}>
            AcadFlow Desktop
          </span>

          {/* Role Switcher (Shown ONLY if user has multiple allowed roles or duties) */}
          {hasMultipleRoles && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 20 }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Active Role:</span>
              <select
                value={activeRole}
                onChange={(e) => {
                  switchRole(e.target.value);
                  if (e.target.value === 'student') navigate('/student/home');
                  else if (e.target.value === 'faculty') navigate('/faculty/home');
                  else if (e.target.value === 'coordinator') navigate('/coordinator/summary');
                  else if (e.target.value === 'admin') navigate('/admin');
                }}
                style={{
                  padding: '4px 8px', fontSize: 12, borderRadius: 6,
                  border: '1px solid #cbd5e1', background: '#f8fafc',
                  fontWeight: 600, color: '#1e293b',
                }}
              >
                {allowedRoles.map(r => (
                  <option key={r} value={r}>
                    {r.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Alerts in Top Bar */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <NavLink
              to={activeRole === 'student' ? '/student/notifications' : '/notifications'}
              style={{
                textDecoration: 'none', position: 'relative',
                padding: '6px 10px', borderRadius: 8, background: unread > 0 ? '#fef2f2' : '#f8fafc',
                border: `1px solid ${unread > 0 ? '#fecaca' : '#e2e8f0'}`,
                color: unread > 0 ? '#dc2626' : '#64748b', fontSize: 12, fontWeight: 600,
              }}
            >
              🔔 Alerts {unread > 0 ? `(${unread})` : ''}
            </NavLink>
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
