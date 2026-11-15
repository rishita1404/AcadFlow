import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import AppShell from '../layouts/AppShell.jsx';
import BrandedSkeleton from '../components/ui/BrandedSkeleton.jsx';

// Core auth pages
const LoginPage = lazy(() => import('../pages/LoginPage.jsx'));
const ForbiddenPage = lazy(() => import('../pages/ForbiddenPage.jsx'));

// Student Pages
const StudentHome = lazy(() => import('../pages/student/StudentHome.jsx'));
const StudentCourseDetail = lazy(() => import('../pages/student/StudentCourseDetail.jsx'));
const StudentCalendar = lazy(() => import('../pages/student/StudentCalendar.jsx'));
const StudentTimetable = lazy(() => import('../pages/student/StudentTimetable.jsx'));
const StudentTasks = lazy(() => import('../pages/student/StudentTasks.jsx'));
const StudentAssignmentDetail = lazy(() => import('../pages/student/StudentAssignmentDetail.jsx'));
const StudentRisk = lazy(() => import('../pages/student/StudentRisk.jsx'));
const StudentNotifications = lazy(() => import('../pages/student/StudentNotifications.jsx'));
const StudentPreferences = lazy(() => import('../pages/student/StudentPreferences.jsx'));
const StudentNotices = lazy(() => import('../pages/student/StudentNotices.jsx'));
const StudentAttendance = lazy(() => import('../pages/student/StudentAttendance.jsx'));

// Legacy / Shared Pages
const AttendancePage = lazy(() => import('../pages/AttendancePage.jsx'));
const PressurePage = lazy(() => import('../pages/PressurePage.jsx'));

// Faculty Pages
const FacultyHome = lazy(() => import('../pages/faculty/FacultyHome.jsx'));
const FacultyCourseDetail = lazy(() => import('../pages/faculty/FacultyCourseDetail.jsx'));
const FacultyAttendanceUpload = lazy(() => import('../pages/faculty/FacultyAttendanceUpload.jsx'));
const FacultyAtRisk = lazy(() => import('../pages/faculty/FacultyAtRisk.jsx'));
const FacultyAssignments = lazy(() => import('../pages/faculty/FacultyAssignments.jsx'));
const FacultyMentees = lazy(() => import('../pages/faculty/FacultyMentees.jsx'));
const FacultyMenteeDetail = lazy(() => import('../pages/faculty/FacultyMenteeDetail.jsx'));
const FacultySections = lazy(() => import('../pages/faculty/FacultySections.jsx'));
const FacultyTimetable = lazy(() => import('../pages/faculty/FacultyTimetable.jsx'));

// Coordinator Pages
const CoordinatorSummary = lazy(() => import('../pages/coordinator/CoordinatorSummary.jsx'));
const CoordinatorDeadlines = lazy(() => import('../pages/coordinator/CoordinatorDeadlines.jsx'));
const CoordinatorStudents = lazy(() => import('../pages/coordinator/CoordinatorStudents.jsx'));
const CoordinatorTeachers = lazy(() => import('../pages/coordinator/CoordinatorTeachers.jsx'));
const CoordinatorTimetable = lazy(() => import('../pages/coordinator/CoordinatorTimetable.jsx'));
const CoordinatorTimetableEditor = lazy(() => import('../pages/coordinator/CoordinatorTimetableEditor.jsx'));

// Admin Pages
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard.jsx'));
const AdminRiskConfig = lazy(() => import('../pages/admin/AdminRiskConfig.jsx'));
const AdminUsers = lazy(() => import('../pages/admin/AdminUsers.jsx'));
const AdminAuditLog = lazy(() => import('../pages/admin/AdminAuditLog.jsx'));
const AdminML = lazy(() => import('../pages/admin/AdminML.jsx'));

// Notices Pages
const ComposeNotice = lazy(() => import('../pages/notices/ComposeNotice.jsx'));
const StaffNotices = lazy(() => import('../pages/notices/StaffNotices.jsx'));

function NoticesDispatcher() {
  const { activeRole } = useAuth();
  if (activeRole === 'student') {
    return <StudentNotices />;
  }
  return <StaffNotices />;
}

function PrivateRoute({ children }) {
  const { isLoggedIn } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}

function RoleGuard({ allowedRoles, children }) {
  const { activeRole } = useAuth();
  if (allowedRoles && !allowedRoles.includes(activeRole)) {
    return <Navigate to="/403" replace />;
  }
  return children;
}

function RoleRedirect() {
  const { activeRole, isLoggedIn } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (activeRole === 'student') return <Navigate to="/student/home" replace />;
  if (activeRole === 'faculty' || activeRole === 'trainer' || activeRole === 'mentor') return <Navigate to="/faculty/home" replace />;
  if (activeRole === 'coordinator') return <Navigate to="/coordinator/summary" replace />;
  if (activeRole === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/login" replace />;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<BrandedSkeleton />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/403" element={<ForbiddenPage />} />

          <Route
            path="/"
            element={
              <PrivateRoute>
                <AppShell />
              </PrivateRoute>
            }
          >
            <Route index element={<RoleRedirect />} />

            {/* Student Routes */}
            <Route
              path="student/attendance"
              element={
                <RoleGuard allowedRoles={['student', 'admin']}>
                  <StudentAttendance />
                </RoleGuard>
              }
            />
            <Route
              path="student/home" 
              element={
                <RoleGuard allowedRoles={['student', 'admin']}>
                  <StudentHome />
                </RoleGuard>
              }
            />
            <Route
              path="student/courses"
              element={
                <RoleGuard allowedRoles={['student', 'admin']}>
                  <StudentHome />
                </RoleGuard>
              }
            />
            <Route
              path="student/courses/:id"
              element={
                <RoleGuard allowedRoles={['student', 'admin']}>
                  <StudentCourseDetail />
                </RoleGuard>
              }
            />
            <Route
              path="student/calendar"
              element={
                <RoleGuard allowedRoles={['student', 'admin']}>
                  <StudentCalendar />
                </RoleGuard>
              }
            />
            <Route
              path="student/timetable"
              element={
                <RoleGuard allowedRoles={['student', 'admin']}>
                  <StudentTimetable />
                </RoleGuard>
              }
            />
            <Route
              path="student/tasks"
              element={
                <RoleGuard allowedRoles={['student', 'admin']}>
                  <StudentTasks />
                </RoleGuard>
              }
            />
            <Route
              path="student/assignments/:id"
              element={
                <RoleGuard allowedRoles={['student', 'admin']}>
                  <StudentAssignmentDetail />
                </RoleGuard>
              }
            />
            <Route
              path="student/risk"
              element={
                <RoleGuard allowedRoles={['student', 'admin']}>
                  <StudentRisk />
                </RoleGuard>
              }
            />
            <Route
              path="student/notifications"
              element={
                <RoleGuard allowedRoles={['student', 'admin']}>
                  <StudentNotifications />
                </RoleGuard>
              }
            />
            <Route
              path="student/preferences"
              element={
                <RoleGuard allowedRoles={['student', 'admin']}>
                  <StudentPreferences />
                </RoleGuard>
              }
            />
            <Route
              path="student/notices"
              element={
                <RoleGuard allowedRoles={['student', 'admin']}>
                  <StudentNotices />
                </RoleGuard>
              }
            />

            {/* Faculty Routes */}
            <Route
              path="faculty/home"
              element={
                <RoleGuard allowedRoles={['faculty', 'trainer', 'mentor', 'coordinator', 'admin']}>
                  <FacultyHome />
                </RoleGuard>
              }
            />
            <Route
              path="faculty/courses/:id"
              element={
                <RoleGuard allowedRoles={['faculty', 'trainer', 'mentor', 'coordinator', 'admin']}>
                  <FacultyCourseDetail />
                </RoleGuard>
              }
            />
            <Route
              path="faculty/attendance"
              element={
                <RoleGuard allowedRoles={['faculty', 'trainer', 'coordinator', 'admin']}>
                  <FacultyAttendanceUpload />
                </RoleGuard>
              }
            />
            <Route
              path="faculty/risk"
              element={
                <RoleGuard allowedRoles={['faculty', 'trainer', 'coordinator', 'admin']}>
                  <FacultyAtRisk />
                </RoleGuard>
              }
            />
            <Route
              path="faculty/assignments"
              element={
                <RoleGuard allowedRoles={['faculty', 'trainer', 'coordinator', 'admin']}>
                  <FacultyAssignments />
                </RoleGuard>
              }
            />
            <Route
              path="faculty/mentees"
              element={
                <RoleGuard allowedRoles={['faculty', 'trainer', 'mentor', 'coordinator', 'admin']}>
                  <FacultyMentees />
                </RoleGuard>
              }
            />
            <Route
              path="faculty/mentees/:id"
              element={
                <RoleGuard allowedRoles={['faculty', 'trainer', 'mentor', 'coordinator', 'admin']}>
                  <FacultyMenteeDetail />
                </RoleGuard>
              }
            />
            <Route
              path="faculty/sections"
              element={
                <RoleGuard allowedRoles={['faculty', 'trainer', 'coordinator', 'admin']}>
                  <FacultySections />
                </RoleGuard>
              }
            />
            <Route
              path="faculty/timetable"
              element={
                <RoleGuard allowedRoles={['faculty', 'trainer', 'coordinator', 'admin']}>
                  <FacultyTimetable />
                </RoleGuard>
              }
            />

            {/* Coordinator Routes */}
            <Route
              path="coordinator/summary"
              element={
                <RoleGuard allowedRoles={['coordinator', 'admin']}>
                  <CoordinatorSummary />
                </RoleGuard>
              }
            />
            <Route
              path="coordinator/deadlines"
              element={
                <RoleGuard allowedRoles={['coordinator', 'admin']}>
                  <CoordinatorDeadlines />
                </RoleGuard>
              }
            />
            <Route
              path="coordinator/students"
              element={
                <RoleGuard allowedRoles={['coordinator', 'admin']}>
                  <CoordinatorStudents />
                </RoleGuard>
              }
            />
            <Route
              path="coordinator/teachers"
              element={
                <RoleGuard allowedRoles={['coordinator', 'admin']}>
                  <CoordinatorTeachers />
                </RoleGuard>
              }
            />
            <Route
              path="coordinator/timetable"
              element={
                <RoleGuard allowedRoles={['coordinator', 'admin']}>
                  <CoordinatorTimetable />
                </RoleGuard>
              }
            />
            <Route
              path="coordinator/timetable/edit"
              element={
                <RoleGuard allowedRoles={['coordinator', 'admin']}>
                  <CoordinatorTimetableEditor />
                </RoleGuard>
              }
            />

            {/* Admin Routes */}
            <Route
              path="admin"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <AdminDashboard />
                </RoleGuard>
              }
            />
            <Route
              path="admin/risk-config"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <AdminRiskConfig />
                </RoleGuard>
              }
            />
            <Route
              path="admin/users"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <AdminUsers />
                </RoleGuard>
              }
            />
            <Route
              path="admin/audit"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <AdminAuditLog />
                </RoleGuard>
              }
            />
            <Route
              path="admin/ml"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <AdminML />
                </RoleGuard>
              }
            />
            <Route
              path="admin/timetable"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <CoordinatorTimetable />
                </RoleGuard>
              }
            />

            {/* Shared / Shortcut Routes */}
            <Route path="notifications" element={<StudentNotifications />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="pressure" element={<PressurePage />} />
            <Route path="notices" element={<NoticesDispatcher />} />
            <Route
              path="notices/new"
              element={
                <RoleGuard allowedRoles={['faculty', 'trainer', 'coordinator', 'admin']}>
                  <ComposeNotice />
                </RoleGuard>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
