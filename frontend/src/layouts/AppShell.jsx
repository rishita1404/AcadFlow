import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.jsx';
import { useQuery } from '@tanstack/react-query';
import { notificationApi } from '../api/endpoints.js';
import {
  Home, CalendarDays, ClipboardList, LayoutGrid, AlertTriangle,
  Megaphone, Bell, Settings, Users, BarChart2, BookOpen,
  HeartHandshake, ChevronLeft, ChevronRight, LogOut, Search, X,
} from 'lucide-react';

const STUDENT_NAV = [
  { to: '/student/home', icon: Home, label: 'Home', exact: true },
  { to: '/student/attendance', icon: BookOpen, label: 'Attendance' },
  { to: '/student/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/student/tasks', icon: ClipboardList, label: 'Tasks' },
  { to: '/student/timetable', icon: LayoutGrid, label: 'Timetable' },
  { to: '/student/risk', icon: AlertTriangle, label: 'Risk Details' },
  { to: '/student/notices', icon: Megaphone, label: 'Notices' },
  { to: '/student/notifications', icon: Bell, label: 'Notifications', badge: true },
  { to: '/student/preferences', icon: Settings, label: 'Preferences' },
];

const FACULTY_NAV = [
  { to: '/faculty/home', icon: Home, label: 'Home', exact: true },
  { to: '/faculty/students', icon: Users, label: 'Assigned Students' },
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
    case 'mentor':
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
  mentor: 'Faculty Mentor',
  coordinator: 'Coordinator',
  admin: 'Admin',
};

export default function AppShell() {
  const { user, permissions, activeRole, switchRole, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const alertRef = useRef(null);

  const duties = permissions?.duties || [activeRole];
  const allowedRoles = permissions?.allowed_roles || [activeRole];
  const hasMultiRoles = allowedRoles.length > 1;
  const navItems = getNavItems(activeRole || user?.role || 'student', duties);

  const { data: unread = 0 } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationApi.unreadCount().then(r => r.data.unread_count).catch(() => 0),
    refetchInterval: 60_000,
  });

  const { data: recentNotifications = [] } = useQuery({
    queryKey: ['recent-notifications-dropdown'],
    queryFn: () => notificationApi.list({ limit: 5 }).then(r => r.data).catch(() => []),
    enabled: alertOpen,
  });

  useEffect(() => {
    function handleClickOutside(event) {
      if (alertRef.current && !alertRef.current.contains(event.target)) {
        setAlertOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setAlertOpen(false);
      }
    }
    if (alertOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [alertOpen]);

  const getHomeRoute = () => {
    if (activeRole === 'admin') return '/admin';
    if (activeRole === 'coordinator') return '/coordinator/summary';
    if (activeRole === 'faculty' || activeRole === 'trainer' || activeRole === 'mentor') return '/faculty/home';
    return '/student/home';
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const sidebarW = collapsed ? 'var(--sidebar-collapsed-w)' : 'var(--sidebar-w)';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: sidebarW,
        flexShrink: 0,
        height: '100vh',
        background: 'var(--ink-900)',
        color: 'var(--on-dark)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        overflow: 'visible',
      }}>

        {/* Wordmark / Brand Logo */}
        <div style={{
          height: 'var(--topbar-h)',
          display: 'flex',
          alignItems: 'center',
          padding: collapsed ? '0 var(--space-2)' : '0 var(--space-3)',
          borderBottom: '1px solid rgba(212,196,168,0.12)',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <Link
            to={getHomeRoute()}
            title={collapsed ? 'AcadFlow Home' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: collapsed ? '8px 0' : '8px 16px',
              borderRadius: 'var(--radius-pill)',
              textDecoration: 'none',
              width: '100%',
              justifyContent: collapsed ? 'center' : 'flex-start',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <div style={{
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <BookOpen size={20} strokeWidth={2.2} style={{ color: 'var(--sand)' }} />
            </div>
            {!collapsed && (
              <span style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 700,
                fontSize: 20,
                color: 'var(--sand)',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}>
                AcadFlow
              </span>
            )}
          </Link>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4) 0' }}>
          {navItems.map(({ to, icon: Icon, label, exact, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              title={collapsed ? label : undefined}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: collapsed ? '10px 0' : '10px 16px',
                margin: collapsed ? '2px var(--space-2)' : '2px var(--space-3)',
                borderRadius: 'var(--radius-pill)',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: isActive ? 700 : 400,
                fontFamily: 'var(--font-sans)',
                color: isActive ? 'var(--on-dark)' : 'rgba(244,241,222,0.65)',
                background: isActive ? 'var(--accent)' : 'transparent',
                position: 'relative',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                justifyContent: collapsed ? 'center' : 'flex-start',
                transition: 'background 0.15s, color 0.15s',
              })}
              onMouseEnter={e => {
                if (!e.currentTarget.style.background.includes('var(--accent)'))
                  e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
              }}
              onMouseLeave={e => {
                if (!e.currentTarget.className.includes('active')) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {({ isActive }) => (
                <>
                  <div style={{
                    width: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={19} strokeWidth={isActive ? 2.4 : 1.8} />
                  </div>
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
                </>
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
          padding: collapsed ? 'var(--space-3)' : 'var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 10,
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>

        {/* Top bar */}
        <header style={{
          height: 'var(--topbar-h)',
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 var(--space-8)',
          gap: 'var(--space-4)',
          flexShrink: 0,
          position: 'relative',
        }}>
          {/* Page Title & Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', flex: 1 }}>
            <span style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 600,
              fontSize: 18,
              color: 'var(--ink-900)',
              whiteSpace: 'nowrap',
            }}>
              AcadFlow {ROLE_LABEL[activeRole] || 'Portal'}
            </span>

            {/* Accessible Search box */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-pill)',
              padding: '6px 14px',
              width: 320,
              maxWidth: '100%',
              boxShadow: 'inset 0 1px 2px rgba(13,27,42,0.04)',
            }}>
              <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                placeholder="Search courses, tasks, notices..."
                aria-label="Search courses, tasks, notices"
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 13,
                  color: 'var(--text)',
                  width: '100%',
                }}
              />
              {searchVal && (
                <button
                  type="button"
                  onClick={() => setSearchVal('')}
                  aria-label="Clear search"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--text-muted)',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Alert pill with Dropdown */}
          <div ref={alertRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setAlertOpen(o => !o)}
              aria-expanded={alertOpen}
              aria-haspopup="true"
              aria-label={`${unread} alerts available. System updates.`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 'var(--radius-pill)',
                background: unread > 0 ? 'var(--crit-bg)' : 'var(--surface)',
                border: `1px solid ${unread > 0 ? 'var(--crit-fg)' : 'var(--border)'}`,
                color: unread > 0 ? 'var(--crit-fg)' : 'var(--text-muted)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Bell size={15} />
              <span aria-live="polite">
                {unread > 0 ? `${unread} alert${unread > 1 ? 's' : ''}` : 'Alerts'}
              </span>
            </button>

            {alertOpen && (
              <div
                role="region"
                aria-label="Alerts and Notifications"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: 320,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-card)',
                  boxShadow: 'var(--shadow-card)',
                  padding: 'var(--space-4)',
                  zIndex: 200,
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 'var(--space-3)',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: 'var(--space-2)',
                }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 14, fontFamily: 'var(--font-serif)', color: 'var(--ink-900)' }}>
                      Notifications
                    </h4>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                      System updates
                    </p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
                    {unread} unread
                  </span>
                </div>

                <div style={{ display: 'grid', gap: 'var(--space-2)', maxHeight: 240, overflowY: 'auto' }}>
                  {recentNotifications.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                      No recent notifications
                    </div>
                  ) : (
                    recentNotifications.slice(0, 4).map(n => (
                      <div
                        key={n.id}
                        style={{
                          fontSize: 12,
                          padding: '6px 8px',
                          borderRadius: 8,
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{n.title || n.message}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                  <Link
                    to={activeRole === 'student' ? '/student/notifications' : '/notifications'}
                    onClick={() => setAlertOpen(false)}
                    style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
                  >
                    View all notifications →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-8)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
