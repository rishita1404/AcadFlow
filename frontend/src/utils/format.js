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

/**
 * Format an ISO date/time into a relative student-friendly string with time of day.
 * Examples: "Today, 5:00 PM", "Tomorrow, 11:59 PM", "Fri 30 Oct, 5:00 PM"
 * Never returns raw ISO dates.
 */
export function formatRelativeDueDate(dateInput) {
  if (!dateInput) return 'No due date';
  const target = new Date(dateInput);
  if (Number.isNaN(target.getTime())) return String(dateInput);

  const now = new Date();
  const timeStr = target.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((startOfTarget - startOfToday) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return `Today, ${timeStr}`;
  if (diffDays === 1) return `Tomorrow, ${timeStr}`;
  if (diffDays === -1) return `Yesterday, ${timeStr}`;
  if (diffDays < -1) {
    const dateStr = target.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return `${dateStr}, ${timeStr} (Overdue)`;
  }

  // Future date within current year
  const dateStr = target.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `${dateStr}, ${timeStr}`;
}

/**
 * Get urgency marker for items due within 24 hours.
 * Returns null if not within 24 hours.
 */
export function getUrgencyMarker(dateInput) {
  if (!dateInput) return null;
  const target = new Date(dateInput);
  if (Number.isNaN(target.getTime())) return null;

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (diffHours < 0) {
    return { urgent: true, text: 'Overdue' };
  }
  if (diffHours <= 24) {
    if (diffHours <= 1) return { urgent: true, text: 'Due in < 1 hour' };
    return { urgent: true, text: `Due in ${diffHours} hours` };
  }
  return null;
}

