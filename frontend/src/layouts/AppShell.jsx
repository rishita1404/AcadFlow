import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.jsx';
import { useQuery } from '@tanstack/react-query';
import { notificationApi } from '../api/endpoints.js';
import {
  Home, CalendarDays, ClipboardList, LayoutGrid, AlertTriangle,
  Megaphone, Bell, Settings, Users, BarChart2, BookOpen, Upload,
  HeartHandshake, ChevronLeft, ChevronRight, LogOut,
} from 'lucide-react';

const STUDENT_NAV = [
  { to: '/student/home', icon: Home, label: 'Home', exact: true },
  { to: '/student/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/student/tasks', icon: ClipboardList, label: 'Tasks' },
  { to: '/student/timetable', icon: LayoutGrid, label: 'Timetable' },
  { to: '/student/risk', icon: AlertTriangle, label: 'Risk Analysis' },
  { to: '/student/notices', icon: Megaphone, label: 'Notices' },
  { to: '/student/notifications', icon: Bell, label: 'Notifications', badge: true },
  { to: '/student/preferences', icon: Settings, label: 'Preferences' },
];

const FACULTY_NAV = [
  { to: '/faculty/home', icon: Home, label: 'Home', exact: true },
  { to: '/faculty/courses', icon: BookOpen, label: 'My Courses' },
  { to: '/faculty/mentees', icon: HeartHandshake, label: 'Mentees', dutyGate: 'mentor' },
  { to: '/faculty/sections', icon: Users, label: 'Sections', dutyGate: 'course_coordinator' },
  { to: '/faculty/timetable', icon: LayoutGrid, label: 'My Timetable' },
  { to: '/notices', icon: Megaphone, label: 'Notices' },
  { to: '/notifications', icon: Bell, label: 'Notifications', badge: true },
];

const COORDINATOR_NAV = [
  { to: '/coordinator/summary', icon: BarChart2, label: 'Summary', exact: true },
  { to: '/coordinator/deadlines', icon: CalendarDays, label: 'Deadline Load' },
  { to: '/coordinator/students', icon: Users, label: 'Students' },
  { to: '/coordinator/teachers', icon: HeartHandshake, label: 'Teachers' },
  { to: '/coordinator/timetable', icon: LayoutGrid, label: 'Timetable' },
  { to: '/notices', icon: Megaphone, label: 'Notices' },
  { to: '/notifications', icon: Bell, label: 'Notifications', badge: true },
];

const ADMIN_NAV = [
  { to: '/admin', icon: Home, label: 'Home', exact: true },
  { to: '/admin/risk-config', icon: Settings, label: 'Risk Config' },
  { to: '/admin/assignments', icon: ClipboardList, label: 'Assignments' },
  { to: '/admin/data', icon: Users, label: 'Data & Users' },
  { to: '/admin/timetable', icon: LayoutGrid, label: 'Timetable' },
  { to: '/notices', icon: Megaphone, label: 'Notices' },
  { to: '/admin/ml', icon: BarChart2, label: 'ML & Monitoring' },
  { to: '/admin/audit', icon: ClipboardList, label: 'Audit Log' },
  { to: '/notifications', icon: Bell, label: 'Notifications', badge: true },
];

function getNavItems(role, duties = []) {
  switch (role) {
    case 'student': return STUDENT_NAV;
    case 'faculty':
    case 'trainer':
      return FACULTY_NAV.filter(item =>
        !item.dutyGate || duties.includes(item.dutyGate) || duties.includes('mentor') || duties.includes('course_coordinator')
      );
    case 'coordinator': return COORDINATOR_NAV;
    case 'admin': return ADMIN_NAV;
    default: return STUDENT_NAV;
  }
}

const ROLE_LABEL = {
  student: 'Student',
  faculty: 'Faculty',
  trainer: 'Faculty',
  coordinator: 'Coordinator',
  admin: 'Admin',
};

export default function AppShell() {
  const { user, permissions, activeRole, switchRole, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const duties = permissions?.duties || [activeRole];
  const allowedRoles = permissions?.allowed_roles || [activeRole];
  const hasMultiRoles = allowedRoles.length > 1;
  const navItems = getNavItems(activeRole || user?.role || 'student', duties);

  const { data: unread = 0 } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationApi.unreadCount().then(r => r.data.unread_count).catch(() => 0),
    refetchInterval: 60_000,
  });

  const handleLogout = () => { logout(); navigate('/login'); };

  const sidebarW = collapsed ? 'var(--sidebar-collapsed-w)' : 'var(--sidebar-w)';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: sidebarW,
        flexShrink: 0,
        background: 'var(--ink-900)',
        color: 'var(--on-dark)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s',
        position: 'relative',
        zIndex: 10,
      }}>

        {/* Wordmark */}
        <div style={{
          height: 'var(--topbar-h)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--space-6)',
          borderBottom: '1px solid rgba(212,196,168,0.12)',
          overflow: 'hidden',
          gap: 'var(--space-3)',
        }}>
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: 20,
            color: 'var(--sand)',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.02em',
          }}>
            {collapsed ? 'A' : 'AcadFlow'}
          </span>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4) 0' }}>
          {navItems.map(({ to, icon: Icon, label, exact, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 20px',
                margin: '1px var(--space-3)',
                borderRadius: 'var(--radius-pill)',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: isActive ? 700 : 400,
                fontFamily: 'var(--font-sans)',
                color: isActive ? 'var(--on-dark)' : 'rgba(244,241,222,0.6)',
                background: isActive ? 'var(--accent)' : 'transparent',
                position: 'relative',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                transition: 'background 0.15s, color 0.15s',
              })}
              onMouseEnter={e => {
                if (!e.currentTarget.style.background.includes('var(--accent)'))
                  e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
              }}
              onMouseLeave={e => {
                // recompute on leave — NavLink will reapply active style
              }}
            >
              <Icon size={18} strokeWidth={isActive => isActive ? 2.5 : 1.75} style={{ flexShrink: 0 }} />
              {!collapsed && (
                <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {label}
                  {badge && unread > 0 && (
                    <span style={{
                      background: 'var(--crit-bg)', color: 'var(--crit-fg)',
                      fontSize: 10, fontWeight: 700, lineHeight: 1,
                      padding: '2px 6px', borderRadius: 'var(--radius-pill)',
                    }}>
                      {unread}
                    </span>
                  )}
                </span>
              )}
              {collapsed && badge && unread > 0 && (
                <span style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 8, height: 8, borderRadius: '50%', background: 'var(--crit-fg)',
                }} />
              )}
            </NavLink>
          ))}
        </nav>

        {/* Role switcher */}
        {hasMultiRoles && !collapsed && (
          <div style={{
            margin: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 12,
            borderTop: '1px solid rgba(212,196,168,0.1)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(244,241,222,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Active role
            </div>
            <select
              value={activeRole}
              onChange={(e) => {
                if (typeof switchRole === 'function') switchRole(e.target.value);
                const role = e.target.value;
                if (role === 'student') navigate('/student/home');
                else if (role === 'faculty' || role === 'trainer') navigate('/faculty/home');
                else if (role === 'coordinator') navigate('/coordinator/summary');
                else if (role === 'admin') navigate('/admin');
              }}
              style={{
                width: '100%',
                padding: '5px 8px',
                borderRadius: 8,
                border: '1px solid rgba(212,196,168,0.2)',
                background: 'rgba(255,255,255,0.08)',
                color: 'var(--on-dark)',
                fontSize: 13,
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
              }}
            >
              {allowedRoles.map(r => (
                <option key={r} value={r} style={{ background: 'var(--ink-800)' }}>{ROLE_LABEL[r] || r}</option>
              ))}
            </select>
          </div>
        )}

        {/* User card + logout */}
        <div style={{
          borderTop: '1px solid rgba(212,196,168,0.12)',
          padding: 'var(--space-4)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {!collapsed && user && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{
                fontSize: 13, fontWeight: 700,
                color: 'var(--on-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{user.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(244,241,222,0.5)', textTransform: 'capitalize' }}>
                {ROLE_LABEL[activeRole] || activeRole}
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Sign out"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(212,196,168,0.15)',
              borderRadius: 8,
              padding: 8,
              cursor: 'pointer',
              color: 'rgba(244,241,222,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <LogOut size={16} />
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            position: 'absolute',
            top: 20, right: -12,
            width: 24, height: 24,
            borderRadius: '50%',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            color: 'var(--text-muted)',
            zIndex: 11,
          }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Top bar */}
        <header style={{
          height: 'var(--topbar-h)',
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--space-8)',
          gap: 'var(--space-4)',
          flexShrink: 0,
        }}>
          {/* breadcrumb placeholder — pages set via context or just their own h1 */}
          <div style={{ flex: 1 }} />

          {/* Notification badge */}
          <NavLink
            to={activeRole === 'student' ? '/student/notifications' : '/notifications'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px',
              borderRadius: 'var(--radius-pill)',
              background: unread > 0 ? 'var(--crit-bg)' : 'var(--surface)',
              border: `1px solid ${unread > 0 ? 'var(--crit-fg)' : 'var(--border)'}`,
              color: unread > 0 ? 'var(--crit-fg)' : 'var(--text-muted)',
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
            }}
          >
            <Bell size={15} />
            {unread > 0 ? `${unread} alert${unread > 1 ? 's' : ''}` : 'Alerts'}
          </NavLink>
        </header>

        <main style={{ flex: 1, overflow: 'auto', padding: 'var(--space-8)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
