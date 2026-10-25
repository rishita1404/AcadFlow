/**
 * Format an attendance percentage for display across AcadFlow.
 *
 * Rules:
 * - 1 decimal place (e.g. 78.5%)
 * - "No data" when value is null, undefined, or NaN
 * - Never defaults to 100% or any hardcoded number
 */
export function formatPct(value, includeSymbol = true) {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) {
    return 'No data';
  }
  const num = Number(value);
  const formatted = num.toFixed(1);
  return includeSymbol ? `${formatted}%` : formatted;
}

/**
 * Invalidate all attendance-related queries across student, faculty, mentor, coordinator, and notifications.
 */
export function invalidateAttendanceQueries(queryClient) {
  if (!queryClient) return;
  const keys = [
    ['student-dashboard'],
    ['course-detail'],
    ['course-attendance-history'],
    ['course-attendance-buffer'],
    ['attendance-buffer'],
    ['course-student-risk'],
    ['faculty-course'],
    ['faculty-course-roster'],
    ['faculty-courses'],
    ['faculty-at-risk'],
    ['mentor-mentees'],
    ['mentee-detail'],
    ['mentee-courses'],
    ['coordinator-summary-overview'],
    ['coordinator-students-list'],
    ['coordinator-student-profile'],
    ['coordinator-courses'],
    ['notifications-unread-count'],
    ['notifications'],
    ['my-notifications'],
  ];
  keys.forEach(key => {
    queryClient.invalidateQueries({ queryKey: key });
  });
}

