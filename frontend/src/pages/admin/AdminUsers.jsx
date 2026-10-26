import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Filter,
  UserPlus,
  BookPlus,
  Trash2,
  Users,
  BookOpen,
  GraduationCap,
  X,
  CheckCircle2,
  AlertCircle,
  UserMinus,
} from 'lucide-react';
import { adminApi } from '../../api/endpoints.js';
import Skeleton from '../../components/Skeleton.jsx';

export default function AdminUsers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'users'; // 'users' | 'courses' | 'enrolments'
  const qc = useQueryClient();

  // Filters & State
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [selectedCourseId, setSelectedCourseId] = useState(null);

  // Modals state
  const [isAddUserOpen, setIsAddUserOpen] = useState(searchParams.get('action') === 'add');
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);
  const [deleteConfirmCourse, setDeleteConfirmCourse] = useState(null);

  // Add User Form State
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'student',
    password: 'AcadFlow@123',
    department_id: 1,
    roll_no: '',
    batch: '2023-2027',
  });
  const [userFormError, setUserFormError] = useState(null);

  // Add Course Form State
  const [newCourse, setNewCourse] = useState({
    code: '',
    name: '',
    department_id: 1,
    semester_id: 1,
    total_classes: 40,
    faculty_id: '',
  });
  const [courseFormError, setCourseFormError] = useState(null);

  // Queries
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['admin-users-list', roleFilter],
    queryFn: () => adminApi.getUsers(roleFilter !== 'ALL' ? { role: roleFilter } : {}).then(r => r.data || []),
  });

  const { data: meta = { departments: [], semesters: [], faculty: [] } } = useQuery({
    queryKey: ['admin-meta'],
    queryFn: () => adminApi.getMeta().then(r => r.data || { departments: [], semesters: [], faculty: [] }),
  });

  const { data: courses = [], isLoading: isLoadingCourses } = useQuery({
    queryKey: ['admin-courses-list'],
    queryFn: () => adminApi.getCourses().then(r => r.data || []),
  });

  // Active course for enrolments tab
  const activeCourseId = selectedCourseId || (courses.length > 0 ? courses[0].id : null);

  const { data: enrolmentData = { enrolled: [], available: [] }, isLoading: isLoadingEnrolments } = useQuery({
    queryKey: ['admin-course-enrolments', activeCourseId],
    queryFn: () => adminApi.getCourseEnrolments(activeCourseId).then(r => r.data || { enrolled: [], available: [] }),
    enabled: !!activeCourseId && activeTab === 'enrolments',
  });

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: (payload) => adminApi.createUser(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users-list'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      qc.invalidateQueries({ queryKey: ['admin-meta'] });
      setIsAddUserOpen(false);
      setUserFormError(null);
      setNewUser({
        name: '',
        email: '',
        role: 'student',
        password: 'AcadFlow@123',
        department_id: 1,
        roll_no: '',
        batch: '2023-2027',
      });
    },
    onError: (err) => {
      const detail = err.response?.data?.detail;
      setUserFormError(typeof detail === 'string' ? detail : detail?.message || 'Failed to create user');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId) => adminApi.deleteUser(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users-list'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      setDeleteConfirmUser(null);
    },
    onError: (err) => {
      alert(err.response?.data?.detail || 'Failed to delete user');
    },
  });

  const createCourseMutation = useMutation({
    mutationFn: (payload) => adminApi.createCourse(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-courses-list'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      setIsAddCourseOpen(false);
      setCourseFormError(null);
      setNewCourse({
        code: '',
        name: '',
        department_id: 1,
        semester_id: 1,
        total_classes: 40,
        faculty_id: '',
      });
    },
    onError: (err) => {
      const detail = err.response?.data?.detail;
      setCourseFormError(typeof detail === 'string' ? detail : detail?.message || 'Failed to create course');
    },
  });

  const deleteCourseMutation = useMutation({
    mutationFn: (courseId) => adminApi.deleteCourse(courseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-courses-list'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      setDeleteConfirmCourse(null);
    },
    onError: (err) => {
      alert(err.response?.data?.detail || 'Failed to delete course');
    },
  });

  const enrolMutation = useMutation({
    mutationFn: ({ courseId, studentId }) => adminApi.enrolStudent(courseId, studentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-course-enrolments', activeCourseId] });
      qc.invalidateQueries({ queryKey: ['admin-courses-list'] });
    },
  });

  const unenrolMutation = useMutation({
    mutationFn: ({ courseId, studentId }) => adminApi.unenrolStudent(courseId, studentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-course-enrolments', activeCourseId] });
      qc.invalidateQueries({ queryKey: ['admin-courses-list'] });
    },
  });

  // Filtered users
  const filteredUsers = useMemo(() => {
    if (!userSearch) return users;
    const q = userSearch.toLowerCase();
    return users.filter(
      u =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.roll_no?.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const setTab = (tabName) => {
    setSearchParams({ tab: tabName });
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return { bg: 'var(--watch-bg)', fg: 'var(--watch-fg)' };
      case 'coordinator':
        return { bg: 'var(--surface)', fg: 'var(--ink-900)' };
      case 'faculty':
        return { bg: 'var(--bg)', fg: 'var(--accent)' };
      case 'student':
      default:
        return { bg: 'var(--ok-bg)', fg: 'var(--ok-fg)' };
    }
  };

  if (isLoadingUsers && isLoadingCourses) {
    return (
      <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
        <Skeleton variant="title" width={320} height={36} />
        <Skeleton variant="text" width={240} height={18} style={{ marginTop: 8, marginBottom: 24 }} />
        <Skeleton variant="card" height={360} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40, color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          <Link to="/admin" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
            Admin
          </Link>{' '}
          / Master Data Management
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
              Master Data Management Console
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
              Directly create and manage students, faculty, courses, and student enrolments in one place.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setIsAddUserOpen(true)}
              style={{
                background: 'var(--accent)',
                color: 'var(--on-dark)',
                border: 'none',
                padding: '10px 18px',
                borderRadius: 'var(--radius-pill)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <UserPlus size={16} /> Add User
            </button>
            <button
              onClick={() => setIsAddCourseOpen(true)}
              style={{
                background: 'var(--surface)',
                color: 'var(--ink-900)',
                border: '1px solid var(--border)',
                padding: '10px 18px',
                borderRadius: 'var(--radius-pill)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <BookPlus size={16} /> Add Course
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          borderBottom: '1px solid var(--border)',
          marginBottom: 20,
        }}
      >
        <button
          onClick={() => setTab('users')}
          style={{
            padding: '12px 20px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'users' ? '3px solid var(--accent)' : '3px solid transparent',
            color: activeTab === 'users' ? 'var(--ink-900)' : 'var(--text-muted)',
            fontWeight: activeTab === 'users' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Users size={16} /> User Directory ({users.length})
        </button>
        <button
          onClick={() => setTab('courses')}
          style={{
            padding: '12px 20px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'courses' ? '3px solid var(--accent)' : '3px solid transparent',
            color: activeTab === 'courses' ? 'var(--ink-900)' : 'var(--text-muted)',
            fontWeight: activeTab === 'courses' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <BookOpen size={16} /> Courses &amp; Curriculum ({courses.length})
        </button>
        <button
          onClick={() => setTab('enrolments')}
          style={{
            padding: '12px 20px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'enrolments' ? '3px solid var(--accent)' : '3px solid transparent',
            color: activeTab === 'enrolments' ? 'var(--ink-900)' : 'var(--text-muted)',
            fontWeight: activeTab === 'enrolments' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <GraduationCap size={16} /> Course Enrolments
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: USER DIRECTORY & MANAGEMENT */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div>
          {/* Filter toolbar */}
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-card)',
              padding: '16px 20px',
              border: '1px solid var(--border)',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                placeholder="Search users by name, email, or roll number..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 14px 10px 36px',
                  borderRadius: 'var(--radius-input)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--ink-900)',
                  fontSize: 13,
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Filter size={14} /> Role:
              </span>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-input)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--ink-900)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
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
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--border)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>ID</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>Name</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>Email Address</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>Role</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>Roll No / Details</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>Department</th>
                  <th style={{ padding: '12px 18px', width: 90, textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No users found. Click <strong>&quot;+ Add User&quot;</strong> above to create one.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => {
                    const badge = getRoleBadge(u.role);
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--ink-900)' }}>
                          #{u.id}
                        </td>
                        <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--ink-900)' }}>
                          {u.name}
                        </td>
                        <td style={{ padding: '14px 18px', color: 'var(--text)' }}>
                          {u.email}
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span
                            style={{
                              background: badge.bg,
                              color: badge.fg,
                              padding: '3px 10px',
                              borderRadius: 'var(--radius-pill)',
                              fontWeight: 700,
                              fontSize: 11,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>
                          {u.roll_no ? (
                            <div>
                              <strong style={{ color: 'var(--ink-900)', fontFamily: 'monospace' }}>{u.roll_no}</strong>
                              {u.batch && <span style={{ fontSize: 11, marginLeft: 6 }}>({u.batch})</span>}
                            </div>
                          ) : (
                            <span style={{ fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>
                          {u.department_name || (u.department_id ? `Dept #${u.department_id}` : 'Global')}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                          <button
                            onClick={() => setDeleteConfirmUser(u)}
                            title="Delete User"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--crit-fg)',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              borderRadius: 4,
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: COURSES & CURRICULUM */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'courses' && (
        <div>
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--border)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>Code</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>Course Title</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>Department</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>Semester</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>Faculty Instructor</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>Classes</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>Enrolled</th>
                  <th style={{ padding: '12px 18px', width: 90, textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {courses.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No courses found. Click <strong>&quot;+ Add Course&quot;</strong> to create one.
                    </td>
                  </tr>
                ) : (
                  courses.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '14px 18px', fontWeight: 800, color: 'var(--ink-900)', fontFamily: 'monospace' }}>
                        {c.code}
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--ink-900)' }}>
                        {c.name}
                      </td>
                      <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>
                        {c.department_name}
                      </td>
                      <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>
                        {c.semester_name}
                      </td>
                      <td style={{ padding: '14px 18px', color: 'var(--text)' }}>
                        {c.faculty_name}
                      </td>
                      <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>
                        {c.total_classes}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            background: 'var(--ok-bg)',
                            color: 'var(--ok-fg)',
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-pill)',
                            fontWeight: 700,
                            fontSize: 11,
                          }}
                        >
                          👥 {c.enrolled_count}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        <button
                          onClick={() => setDeleteConfirmCourse(c)}
                          title="Delete Course"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--crit-fg)',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: 4,
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: COURSE ENROLMENTS */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'enrolments' && (
        <div>
          {/* Course Selector Bar */}
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-card)',
              padding: '16px 20px',
              border: '1px solid var(--border)',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)' }}>
              Select Course:
            </label>
            <select
              value={activeCourseId || ''}
              onChange={e => setSelectedCourseId(Number(e.target.value))}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--ink-900)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name} ({c.enrolled_count} enrolled)
                </option>
              ))}
            </select>
          </div>

          {/* Two Columns: Enrolled vs Available */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Left Column: Currently Enrolled */}
            <div
              style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius-card)',
                padding: 20,
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', margin: '0 0 14px 0' }}>
                Enrolled Students ({enrolmentData.enrolled?.length || 0})
              </h3>
              {isLoadingEnrolments ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading enrolled students...</div>
              ) : enrolmentData.enrolled?.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>No students enrolled in this course yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflowY: 'auto' }}>
                  {enrolmentData.enrolled.map(s => (
                    <div
                      key={s.student_id}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-input)',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink-900)' }}>
                          {s.name} <span style={{ fontFamily: 'monospace', color: 'var(--accent)', marginLeft: 6 }}>({s.roll_no})</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.email}</div>
                      </div>
                      <button
                        onClick={() => unenrolMutation.mutate({ courseId: activeCourseId, studentId: s.student_id })}
                        style={{
                          background: 'var(--crit-bg)',
                          color: 'var(--crit-fg)',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <UserMinus size={13} /> Unenrol
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Available to Enrol */}
            <div
              style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius-card)',
                padding: 20,
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', margin: '0 0 14px 0' }}>
                Available Students to Enrol ({enrolmentData.available?.length || 0})
              </h3>
              {isLoadingEnrolments ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading available students...</div>
              ) : enrolmentData.available?.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>All existing students are already enrolled!</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflowY: 'auto' }}>
                  {enrolmentData.available.map(s => (
                    <div
                      key={s.student_id}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-input)',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink-900)' }}>
                          {s.name} <span style={{ fontFamily: 'monospace', color: 'var(--accent)', marginLeft: 6 }}>({s.roll_no})</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.email}</div>
                      </div>
                      <button
                        onClick={() => enrolMutation.mutate({ courseId: activeCourseId, studentId: s.student_id })}
                        style={{
                          background: 'var(--ok-bg)',
                          color: 'var(--ok-fg)',
                          border: 'none',
                          padding: '6px 14px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <UserPlus size={13} /> + Enrol
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: ADD USER */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {isAddUserOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-card)',
              width: '100%',
              maxWidth: 480,
              padding: 28,
              border: '1px solid var(--border)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
                Add New User Account
              </h2>
              <button
                onClick={() => setIsAddUserOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {userFormError && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--crit-bg)',
                  border: '1px solid var(--crit-fg)',
                  borderRadius: 'var(--radius-input)',
                  color: 'var(--crit-fg)',
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 16,
                }}
              >
                ⚠️ {userFormError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createUserMutation.mutate(newUser);
              }}
            >
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={newUser.name}
                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-input)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--ink-900)',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. ramesh@acadflow.edu"
                    value={newUser.email}
                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-input)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--ink-900)',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>System Role *</label>
                    <select
                      value={newUser.role}
                      onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-input)',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--ink-900)',
                        fontSize: 13,
                        fontWeight: 600,
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value="student">Student</option>
                      <option value="faculty">Faculty</option>
                      <option value="coordinator">Coordinator</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Department</label>
                    <select
                      value={newUser.department_id}
                      onChange={e => setNewUser({ ...newUser, department_id: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-input)',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--ink-900)',
                        fontSize: 13,
                        boxSizing: 'border-box',
                      }}
                    >
                      {meta.departments.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.code} — {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {newUser.role === 'student' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'var(--bg)', padding: 12, borderRadius: 'var(--radius-input)' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Roll Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 24CS002"
                        value={newUser.roll_no}
                        onChange={e => setNewUser({ ...newUser, roll_no: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-input)',
                          border: '1px solid var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--ink-900)',
                          fontSize: 12,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Batch</label>
                      <input
                        type="text"
                        placeholder="2023-2027"
                        value={newUser.batch}
                        onChange={e => setNewUser({ ...newUser, batch: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-input)',
                          border: '1px solid var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--ink-900)',
                          fontSize: 12,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Password</label>
                  <input
                    type="text"
                    value={newUser.password}
                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-input)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--ink-900)',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Default password is <code>AcadFlow@123</code>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--on-dark)',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: createUserMutation.isPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: ADD COURSE */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {isAddCourseOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-card)',
              width: '100%',
              maxWidth: 480,
              padding: 28,
              border: '1px solid var(--border)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
                Create New Academic Course
              </h2>
              <button
                onClick={() => setIsAddCourseOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {courseFormError && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--crit-bg)',
                  border: '1px solid var(--crit-fg)',
                  borderRadius: 'var(--radius-input)',
                  color: 'var(--crit-fg)',
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 16,
                }}
              >
                ⚠️ {courseFormError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createCourseMutation.mutate({
                  ...newCourse,
                  faculty_id: newCourse.faculty_id ? Number(newCourse.faculty_id) : null,
                });
              }}
            >
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Code *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CS504"
                      value={newCourse.code}
                      onChange={e => setNewCourse({ ...newCourse, code: e.target.value.toUpperCase() })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-input)',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--ink-900)',
                        fontSize: 13,
                        fontWeight: 700,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Course Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Compiler Design"
                      value={newCourse.name}
                      onChange={e => setNewCourse({ ...newCourse, name: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-input)',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--ink-900)',
                        fontSize: 13,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Department</label>
                    <select
                      value={newCourse.department_id}
                      onChange={e => setNewCourse({ ...newCourse, department_id: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-input)',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--ink-900)',
                        fontSize: 13,
                        boxSizing: 'border-box',
                      }}
                    >
                      {meta.departments.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.code} — {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Semester</label>
                    <select
                      value={newCourse.semester_id}
                      onChange={e => setNewCourse({ ...newCourse, semester_id: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-input)',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--ink-900)',
                        fontSize: 13,
                        boxSizing: 'border-box',
                      }}
                    >
                      {meta.semesters.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Assign Faculty</label>
                    <select
                      value={newCourse.faculty_id}
                      onChange={e => setNewCourse({ ...newCourse, faculty_id: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-input)',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--ink-900)',
                        fontSize: 13,
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value="">-- Select Instructor --</option>
                      {meta.faculty.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Total Classes</label>
                    <input
                      type="number"
                      min={10}
                      max={120}
                      value={newCourse.total_classes}
                      onChange={e => setNewCourse({ ...newCourse, total_classes: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-input)',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--ink-900)',
                        fontSize: 13,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
                <button
                  type="button"
                  onClick={() => setIsAddCourseOpen(false)}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCourseMutation.isPending}
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--on-dark)',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: createCourseMutation.isPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {createCourseMutation.isPending ? 'Creating...' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* CONFIRM DELETE MODALS */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {deleteConfirmUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-card)',
              width: '100%',
              maxWidth: 400,
              padding: 24,
              border: '1px solid var(--border)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 36, color: 'var(--crit-fg)', marginBottom: 12 }}>⚠️</div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', margin: '0 0 8px 0' }}>
              Confirm User Deletion
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Are you sure you want to permanently delete <strong>{deleteConfirmUser.name}</strong> ({deleteConfirmUser.email})? All their enrollments and attendance records will be removed.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <button
                onClick={() => setDeleteConfirmUser(null)}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUserMutation.mutate(deleteConfirmUser.id)}
                disabled={deleteUserMutation.isPending}
                style={{
                  background: 'var(--crit-fg)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: deleteUserMutation.isPending ? 'not-allowed' : 'pointer',
                }}
              >
                {deleteUserMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmCourse && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-card)',
              width: '100%',
              maxWidth: 400,
              padding: 24,
              border: '1px solid var(--border)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 36, color: 'var(--crit-fg)', marginBottom: 12 }}>⚠️</div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', margin: '0 0 8px 0' }}>
              Confirm Course Deletion
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Are you sure you want to permanently delete <strong>{deleteConfirmCourse.code} — {deleteConfirmCourse.name}</strong>? All sessions and enrolments will be cleared.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <button
                onClick={() => setDeleteConfirmCourse(null)}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteCourseMutation.mutate(deleteConfirmCourse.id)}
                disabled={deleteCourseMutation.isPending}
                style={{
                  background: 'var(--crit-fg)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: deleteCourseMutation.isPending ? 'not-allowed' : 'pointer',
                }}
              >
                {deleteCourseMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
