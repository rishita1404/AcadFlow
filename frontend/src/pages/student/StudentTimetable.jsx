import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { timetableApi } from '../../api/endpoints.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = [
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:15 - 12:15',
  '12:15 - 13:15',
  '14:00 - 15:00',
  '15:00 - 16:00',
];

const KIND_COLORS = {
  lecture: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  lab: { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9' },
  tutorial: { bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
};

export default function StudentTimetable() {
  const navigate = useNavigate();

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['student-weekly-timetable'],
    queryFn: () => timetableApi.getMyTimetable().then(r => r.data),
  });

  const todayIndex = new Date().getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const currentWeekday = todayIndex > 0 && todayIndex <= 6 ? DAYS[todayIndex - 1] : null;

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading your weekly timetable...</div>;
  }

  // Group slots by Day and Period
  const slotGrid = {};
  DAYS.forEach(d => {
    slotGrid[d] = {};
  });

  slots.forEach(s => {
    const day = s.day_name || DAYS[s.day] || 'Monday';
    if (!slotGrid[day]) slotGrid[day] = {};
    slotGrid[day][s.period_label] = s;
  });

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: '20px 24px', border: '1px solid #e2e8f0',
        marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>
            🗓 Weekly Academic Timetable
          </h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            Mon–Sat class schedule with assigned lecture halls, laboratories, and faculty.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, background: KIND_COLORS.lecture.bg, border: `1px solid ${KIND_COLORS.lecture.border}`, borderRadius: 3 }} /> Lecture
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, background: KIND_COLORS.lab.bg, border: `1px solid ${KIND_COLORS.lab.border}`, borderRadius: 3 }} /> Laboratory
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, background: KIND_COLORS.tutorial.bg, border: `1px solid ${KIND_COLORS.tutorial.border}`, borderRadius: 3 }} /> Tutorial
          </span>
        </div>
      </div>

      {/* Full Week Grid (Desktop 1280px+ viewable without horizontal scroll) */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ width: 120, padding: '12px 14px', fontSize: 12, fontWeight: 700, color: '#475569', textAlign: 'left' }}>
                Time Slot
              </th>
              {DAYS.map(day => {
                const isToday = day === currentWeekday;
                return (
                  <th
                    key={day}
                    style={{
                      padding: '12px 14px', fontSize: 13, fontWeight: 700,
                      color: isToday ? '#2563eb' : '#1e293b',
                      background: isToday ? '#eff6ff' : 'transparent',
                      borderLeft: '1px solid #e2e8f0',
                      textAlign: 'center',
                    }}
                  >
                    {day} {isToday ? '(Today)' : ''}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period, pIdx) => (
              <tr key={period} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{
                  padding: '12px 14px', fontSize: 12, fontWeight: 600, color: '#64748b',
                  background: '#f8fafc', whiteSpace: 'nowrap',
                }}>
                  {period}
                </td>
                {DAYS.map(day => {
                  const slot = slotGrid[day]?.[period];
                  const isToday = day === currentWeekday;
                  const kindStyle = slot ? (KIND_COLORS[slot.kind] || KIND_COLORS.lecture) : null;

                  return (
                    <td
                      key={day}
                      style={{
                        padding: 6,
                        borderLeft: '1px solid #f1f5f9',
                        background: isToday ? '#f0fdf408' : '#fff',
                        verticalAlign: 'top',
                        minHeight: 80,
                      }}
                    >
                      {slot ? (
                        <div
                          onClick={() => navigate(`/student/courses/${slot.course_id}`)}
                          style={{
                            background: kindStyle.bg,
                            border: `1px solid ${kindStyle.border}`,
                            borderRadius: 8,
                            padding: 8,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)'}
                          onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: kindStyle.text }}>
                              {slot.course_code}
                            </span>
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: kindStyle.text }}>
                              {slot.kind}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {slot.course_name}
                          </div>
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                            📍 {slot.room_name || 'Room 101'}
                          </div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>
                            👨‍🏫 {slot.teacher_name}
                          </div>
                        </div>
                      ) : (
                        <div style={{ minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: 11 }}>
                          —
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
