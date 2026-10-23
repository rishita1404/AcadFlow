import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import AppShell from '../layouts/AppShell.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import ForbiddenPage from '../pages/ForbiddenPage.jsx';

// Student Pages
import StudentHome from '../pages/student/StudentHome.jsx';
import StudentCourseDetail from '../pages/student/StudentCourseDetail.jsx';
import StudentCalendar from '../pages/student/StudentCalendar.jsx';
import StudentTimetable from '../pages/student/StudentTimetable.jsx';
import StudentTasks from '../pages/student/StudentTasks.jsx';
import StudentAssignmentDetail from '../pages/student/StudentAssignmentDetail.jsx';
import StudentRisk from '../pages/student/StudentRisk.jsx';
import StudentNotifications from '../pages/student/StudentNotifications.jsx';
import StudentPreferences from '../pages/student/StudentPreferences.jsx';
import StudentNotices from '../pages/student/StudentNotices.jsx';

// Legacy / Shared Pages
import AttendancePage from '../pages/AttendancePage.jsx';
import PressurePage from '../pages/PressurePage.jsx';

// Faculty Pages
import FacultyHome from '../pages/faculty/FacultyHome.jsx';
import FacultyCourseDetail from '../pages/faculty/FacultyCourseDetail.jsx';
import FacultyAttendanceUpload from '../pages/faculty/FacultyAttendanceUpload.jsx';
import FacultyAtRisk from '../pages/faculty/FacultyAtRisk.jsx';
import FacultyAssignments from '../pages/faculty/FacultyAssignments.jsx';
import FacultyMentees from '../pages/faculty/FacultyMentees.jsx';
import FacultyMenteeDetail from '../pages/faculty/FacultyMenteeDetail.jsx';
import FacultySections from '../pages/faculty/FacultySections.jsx';
import FacultyTimetable from '../pages/faculty/FacultyTimetable.jsx';

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
  const { activeRole } = useAuth();
  if (activeRole === 'student') return <Navigate to="/student/home" replace />;
  if (activeRole === 'faculty' || activeRole === 'trainer') return <Navigate to="/faculty/home" replace />;
  if (activeRole === 'coordinator') return <Navigate to="/coordinator/summary" replace />;
  if (activeRole === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/student/home" replace />;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
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
              <RoleGuard allowedRoles={['faculty', 'trainer', 'admin']}>
                <FacultyHome />
              </RoleGuard>
            }
          />
          <Route
            path="faculty/courses/:id"
            element={
              <RoleGuard allowedRoles={['faculty', 'trainer', 'admin']}>
                <FacultyCourseDetail />
              </RoleGuard>
            }
          />
          <Route
            path="faculty/courses/:id/attendance"
            element={
              <RoleGuard allowedRoles={['faculty', 'trainer', 'admin']}>
                <FacultyAttendanceUpload />
              </RoleGuard>
            }
          />
          <Route
            path="faculty/courses/:id/at-risk"
            element={
              <RoleGuard allowedRoles={['faculty', 'trainer', 'admin']}>
                <FacultyAtRisk />
              </RoleGuard>
            }
          />
          <Route
            path="faculty/courses/:id/assignments"
            element={
              <RoleGuard allowedRoles={['faculty', 'trainer', 'admin']}>
                <FacultyAssignments />
              </RoleGuard>
            }
          />
          <Route
            path="faculty/courses/:id/sections"
            element={
              <RoleGuard allowedRoles={['faculty', 'coordinator', 'admin']}>
                <FacultySections />
              </RoleGuard>
            }
          />
          <Route
            path="faculty/mentees"
            element={
              <RoleGuard allowedRoles={['faculty', 'admin']}>
                <FacultyMentees />
              </RoleGuard>
            }
          />
          <Route
            path="faculty/mentees/:id"
            element={
              <RoleGuard allowedRoles={['faculty', 'admin']}>
                <FacultyMenteeDetail />
              </RoleGuard>
            }
          />
          <Route
            path="faculty/timetable"
            element={
              <RoleGuard allowedRoles={['faculty', 'trainer', 'admin']}>
                <FacultyTimetable />
              </RoleGuard>
            }
          />

          {/* Shared / Shortcut Routes */}
          <Route path="notifications" element={<StudentNotifications />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="pressure" element={<PressurePage />} />
          <Route path="notices" element={<StudentNotices />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
