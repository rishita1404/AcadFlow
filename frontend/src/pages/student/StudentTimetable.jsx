import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { timetableApi } from '../../api/endpoints.js';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

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
  lecture: { bg: 'var(--bg)', border: 'var(--border)', text: 'var(--accent)' },
  lab: { bg: 'var(--watch-bg)', border: 'var(--sand)', text: 'var(--watch-fg)' },
  tutorial: { bg: 'var(--risk-bg)', border: 'var(--sand)', text: 'var(--risk-fg)' },
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
    return (
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <Skeleton height={80} style={{ marginBottom: 20 }} />
        <Skeleton height={400} />
      </div>
    );
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
    <div style={{ maxWidth: 1440, margin: '0 auto', color: 'var(--text)' }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '20px 24px', border: '1px solid var(--border)',
        marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
        boxShadow: 'var(--shadow-card)',
      }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
            Weekly Academic Timetable
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Mon–Sat class schedule with assigned lecture halls, laboratories, and faculty.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, background: KIND_COLORS.lecture.bg, border: `1px solid ${KIND_COLORS.lecture.border}`, borderRadius: 'var(--radius-pill)' }} /> Lecture
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, background: KIND_COLORS.lab.bg, border: `1px solid ${KIND_COLORS.lab.border}`, borderRadius: 'var(--radius-pill)' }} /> Laboratory
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, background: KIND_COLORS.tutorial.bg, border: `1px solid ${KIND_COLORS.tutorial.border}`, borderRadius: 'var(--radius-pill)' }} /> Tutorial
          </span>
        </div>
      </div>

      {/* Full Week Grid */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: 'var(--ink-900)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ width: 120, padding: '12px 14px', fontSize: 12, fontWeight: 600, color: 'var(--on-dark)', textAlign: 'left' }}>
                Time Slot
              </th>
              {DAYS.map(day => {
                const isToday = day === currentWeekday;
                return (
                  <th
                    key={day}
                    style={{
                      padding: '12px 14px', fontSize: 13, fontWeight: 600,
                      color: 'var(--on-dark)',
                      background: isToday ? 'var(--ink-800)' : 'transparent',
                      borderLeft: isToday ? '3px solid var(--accent)' : '1px solid var(--ink-800)',
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
            {PERIODS.map((period) => (
              <tr key={period} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{
                  padding: '12px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                  background: 'var(--bg)', whiteSpace: 'nowrap',
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
                        borderLeft: isToday ? '3px solid var(--accent)' : '1px solid var(--border)',
                        background: isToday ? 'var(--bg)' : 'var(--surface)',
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
                            borderRadius: 'var(--radius-input)',
                            padding: 8,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-card)'}
                          onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: kindStyle.text }}>
                              {slot.course_code}
                            </span>
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: kindStyle.text }}>
                              {slot.kind}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-900)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {slot.course_name}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                            📍 {slot.room_name || 'Room 101'}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            👨‍🏫 {slot.teacher_name}
                          </div>
                        </div>
                      ) : (
                        <div style={{ minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
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
