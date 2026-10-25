import apiClient from '../api/client';

// ── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) =>
    apiClient.post('/auth/login', { email, password }),
  me: () => apiClient.get('/me'),
};

// ── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardApi = {
  getDashboard: () => apiClient.get('/me/dashboard'),
  getWarnings: () => apiClient.get('/me/warnings'),
  simulate: (course_id, miss_count) =>
    apiClient.post('/me/simulate', { course_id, miss_count }),
};

// ── Attendance ───────────────────────────────────────────────────────────────
export const attendanceApi = {
  getBuffer: (studentId, courseId) =>
    apiClient.get(`/attendance/students/${studentId}/courses/${courseId}/buffer`),
  getHistory: (studentId, courseId) =>
    apiClient.get(`/attendance/students/${studentId}/courses/${courseId}/history`),
  getCalendar: (year, month) =>
    apiClient.get(`/me/calendar/${year}/${month}`),
  uploadFile: (courseId, file) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post(`/attendance/upload?course_id=${courseId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  downloadTemplate: (courseId) =>
    apiClient.get(`/attendance/upload/template?course_id=${courseId}`, {
      responseType: 'blob',
    }),
  createSession: (payload) => apiClient.post('/attendance/sessions', payload),
  markSession: (sessionId, payload) =>
    apiClient.post(`/attendance/sessions/${sessionId}/mark`, payload),
};

// ── Holidays (Student-planned absences) ──────────────────────────────────────
export const holidayApi = {
  list: () => apiClient.get('/me/holidays'),
  mark: (holiday_date, reason) =>
    apiClient.post('/me/holidays', { holiday_date, reason }),
  delete: (holiday_date) => apiClient.delete(`/me/holidays/${holiday_date}`),
};

// ── Deadlines ────────────────────────────────────────────────────────────────
export const deadlineApi = {
  getDeadlines: (days = 30, include_past = false) =>
    apiClient.get(`/me/deadlines?days=${days}&include_past=${include_past}`),
  getPressureForecast: (year, month) =>
    apiClient.get(`/me/pressure-forecast/${year}/${month}`),
};

// ── Assignments ──────────────────────────────────────────────────────────────
export const assignmentApi = {
  list: (params = {}) => apiClient.get('/assignments', { params }),
  get: (id) => apiClient.get(`/assignments/${id}`),
  create: (payload) => apiClient.post('/assignments', payload),
  update: (id, payload) => apiClient.patch(`/assignments/${id}`, payload),
  delete: (id) => apiClient.delete(`/assignments/${id}`),
};

// ── Submissions ──────────────────────────────────────────────────────────────
export const submissionApi = {
  list: (params = {}) => apiClient.get('/submissions', { params }),
  submit: (payload) => apiClient.post('/submissions', payload),
};

// ── Notifications ────────────────────────────────────────────────────────────
export const notificationApi = {
  list: (params = {}) => apiClient.get('/notifications', { params }),
  unreadCount: () => apiClient.get('/notifications/unread-count'),
  markRead: (id) => apiClient.post(`/notifications/${id}/read`),
  markAllRead: () => apiClient.post('/notifications/read-all'),
  delete: (id) => apiClient.delete(`/notifications/${id}`),
  checkReminders: () => apiClient.post('/me/check-reminders'),
};

// ── Courses ───────────────────────────────────────────────────────────────────
export const courseApi = {
  list: (params = {}) => apiClient.get('/courses', { params }),
  get: (id) => apiClient.get(`/courses/${id}`),
  enrol: (courseId, payload) =>
    apiClient.post(`/courses/${courseId}/enrolments`, payload),
};

// ── Risk ──────────────────────────────────────────────────────────────────────
export const riskApi = {
  getStudentRisk: (studentId) => apiClient.get(`/risk/students/${studentId}`),
  getCourseRisk: (courseId, band) =>
    apiClient.get(`/risk/courses/${courseId}`, { params: band ? { band } : {} }),
  getConfig: () => apiClient.get('/risk/config'),
};

// ── Students ──────────────────────────────────────────────────────────────────
export const studentApi = {
  list: (params = {}) => apiClient.get('/students', { params }),
  get: (id) => apiClient.get(`/students/${id}`),
};

// ── Health ────────────────────────────────────────────────────────────────────
export const healthApi = {
  ping: () => apiClient.get('/health/'),
};

// Leave Planner & Tasks
export const planApi = {
  projectLeavePlan: (planned_dates) =>
    apiClient.post('/me/plan/project', { planned_dates }),
};

export const tasksApi = {
  getMyTasks: (days = 60, course_id = null) =>
    apiClient.get('/me/tasks', { params: { days, ...(course_id ? { course_id } : {}) } }),
};

// Timetable
export const timetableApi = {
  getMyTimetable: () => apiClient.get('/me/timetable'),
  getVersions: (department_id = null) => apiClient.get('/timetable/versions', { params: department_id ? { department_id } : {} }),
  getSlots: (version_id) => apiClient.get('/timetable/slots', { params: { version_id } }),
  getRooms: () => apiClient.get('/timetable/rooms'),
  getDraft: (department_id) => apiClient.get('/timetable/draft', { params: { department_id } }),
  saveDraft: ({ version_id, slots }) => apiClient.put('/timetable/draft', slots, { params: { version_id } }),
  validateDraft: ({ version_id }) => apiClient.post('/timetable/draft/validate', null, { params: { version_id } }),
  publish: (payload) => apiClient.post('/timetable/publish', payload),
};

// Notices
export const noticeApi = {
  list: () => apiClient.get('/notices'),
  getMyNotices: () => apiClient.get('/notices/me'),
  get: (id) => apiClient.get(`/notices/${id}`),
  create: (payload) => apiClient.post('/notices', payload),
  previewAudience: (payload) => apiClient.post('/notices/audience/preview', payload),
  extractDeadlines: (payload) => apiClient.post('/notices/extract', payload),
  getRecipients: (id, statusFilter) => apiClient.get(`/notices/${id}/recipients`, { params: statusFilter ? { status_filter: statusFilter } : {} }),
  nudge: (id) => apiClient.post(`/notices/${id}/nudge`),
  update: (id, payload) => apiClient.patch(`/notices/${id}`, payload),
  withdraw: (id) => apiClient.delete(`/notices/${id}`),
  markSeen: (id) => apiClient.post(`/notices/${id}/seen`),
  markDone: (id) => apiClient.post(`/notices/${id}/done`),
  delete: (id) => apiClient.delete(`/notices/${id}`),
};

// Faculty
export const facultyApi = {
  getCourses: () => apiClient.get('/courses'),
  getAtRisk: (courseId) => apiClient.get(`/risk/courses/${courseId}`),
  getMentees: () => apiClient.get('/mentor/students'),
  getMenteeDetail: (studentId) => apiClient.get(`/mentor/students/${studentId}`),
  getMenteeCourses: (studentId) => apiClient.get(`/mentor/students/${studentId}/courses`),
  getMenteeNotes: (studentId) => apiClient.get(`/mentor/students/${studentId}/notes`),
  addMenteeNote: (studentId, note) => apiClient.post(`/mentor/students/${studentId}/notes`, { note }),
  previewUpload: (courseId, file) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post(`/courses/${courseId}/attendance/preview`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadAttendance: (courseId, file, changeReason = null) => {
    const form = new FormData();
    form.append('file', file);
    form.append('course_id', courseId);
    if (changeReason) form.append('change_reason', changeReason);
    return apiClient.post('/attendance/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  correctAttendance: (recordId, status, reason = '') =>
    apiClient.patch(`/attendance/records/${recordId}`, { status, reason }),
  getAssignments: (courseId) =>
    apiClient.get(`/assignments?course_id=${courseId}`),
  createAssignment: (payload) => apiClient.post('/assignments', payload),
  updateAssignment: (id, payload) => apiClient.patch(`/assignments/${id}`, payload),
  getSubmissions: (assignmentId) =>
    apiClient.get(`/submissions?assignment_id=${assignmentId}`),
  excuseSubmission: (submissionId, reason) =>
    apiClient.post(`/submissions/${submissionId}/excuse`, { reason }),
  excuseAssignmentForStudent: (assignmentId, studentId, reason) =>
    apiClient.post(`/submissions/assignments/${assignmentId}/students/${studentId}/excuse`, { reason }),
  nudgeStudent: (studentId, title, message) =>
    apiClient.post('/notifications', { user_id: studentId, title, message, type: 'warning' }),
};

// Coordinator
export const coordinatorApi = {
  getOverview: (department_id = null) =>
    apiClient.get('/coordinator/overview', { params: department_id ? { department_id } : {} }),
  getSummary: (department_id = null) =>
    apiClient.get('/coordinator/summary', { params: department_id ? { department_id } : {} }),
  getDeadlineLoad: (department_id = null) =>
    apiClient.get('/coordinator/deadline-load', { params: department_id ? { department_id } : {} }),
  getStudents: (params = {}) => apiClient.get('/coordinator/students', { params }),
  getStudentDetail: (id) => apiClient.get(`/coordinator/students/${id}`),
  getTeachers: (params = {}) => apiClient.get('/coordinator/teachers', { params }),
  getTeacherDetail: (id) => apiClient.get(`/coordinator/teachers/${id}`),
  getAtRisk: () => apiClient.get('/coordinator/at-risk'),
};

// Admin
export const adminApi = {
  getStats: () => apiClient.get('/admin/stats'),
  getUsers: (params = {}) => apiClient.get('/admin/users', { params }),
  getAuditLogs: (params = {}) => apiClient.get('/admin/audit-logs', { params }),
  getRiskConfig: () => apiClient.get('/admin/risk-config'),
  updateRiskConfig: (payload) => apiClient.put('/admin/risk-config', payload),
};
