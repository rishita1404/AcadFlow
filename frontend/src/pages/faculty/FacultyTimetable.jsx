import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { timetableApi } from '../../api/endpoints.js';
import { Link } from 'react-router-dom';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = ['P1 (09:00 - 10:00)', 'P2 (10:00 - 11:00)', 'P3 (11:15 - 12:15)', 'P4 (12:15 - 13:15)', 'P5 (14:00 - 15:00)', 'P6 (15:00 - 16:00)'];
const PERIOD_KEYS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

const KIND_COLORS = {
  lecture: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  lab: { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
  tutorial: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
};

export default function FacultyTimetable() {
  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['faculty-teaching-schedule'],
    queryFn: () => timetableApi.getMyTimetable().then(r => r.data || []),
  });

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading your teaching schedule...</div>;
  }

  // Group slots by day (0..5) and period (P1..P6)
  const slotGrid = {};
  DAYS.forEach((_, dayIdx) => {
    slotGrid[dayIdx] = {};
    PERIOD_KEYS.forEach(p => {
      slotGrid[dayIdx][p] = [];
    });
  });

  slots.forEach(s => {
    const day = s.day ?? 0;
    const period = s.period_label || 'P1';
    if (slotGrid[day] && slotGrid[day][period]) {
      slotGrid[day][period].push(s);
    }
  });

  const hasClashes = slots.some((s, idx) =>
    slots.some((other, oIdx) => idx !== oIdx && s.day === other.day && s.period_label === other.period_label)
  );

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
          <Link to="/faculty/home" style={{ color: '#3b82f6', textDecoration: 'none' }}>Home</Link>
          {' '}/ Teaching Schedule
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
              🗓 My Weekly Teaching Schedule
            </h1>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
              Consolidated timetable across all assigned courses and lab sections · Real-time schedule sync.
            </p>
          </div>
          {hasClashes && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626',
              padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              🚨 Schedule Clashes Detected
            </div>
          )}
        </div>
      </div>

      {/* Timetable Weekly Grid */}
      <div style={{
        background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 960 }}>
            <thead>
              <tr style={{ background: '#1e293b', color: '#f8fafc' }}>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, width: 140 }}>Day / Period</th>
                {PERIODS.map(p => (
                  <th key={p} style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700 }}>{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((dayName, dayIdx) => (
                <tr key={dayName} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{
                    padding: '12px 16px', fontWeight: 800, fontSize: 14, color: '#1e293b',
                    background: '#f8fafc', borderRight: '2px solid #e2e8f0',
                  }}>
                    {dayName}
                  </td>
                  {PERIOD_KEYS.map(periodKey => {
                    const cellSlots = slotGrid[dayIdx]?.[periodKey] || [];
                    const isClash = cellSlots.length > 1;

                    return (
                      <td
                        key={periodKey}
                        style={{
                          padding: 8, verticalAlign: 'top', borderRight: '1px solid #f1f5f9',
                          background: isClash ? '#fff1f2' : cellSlots.length > 0 ? '#fff' : '#fafafa',
                          minWidth: 140,
                        }}
                      >
                        {cellSlots.length === 0 ? (
                          <div style={{ color: '#cbd5e1', fontSize: 12, textAlign: 'center', padding: '14px 0' }}>
                            —
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {isClash && (
                              <div style={{
                                background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 800,
                                padding: '2px 6px', borderRadius: 4, textAlign: 'center', textTransform: 'uppercase',
                              }}>
                                ⚠️ Clash ({cellSlots.length} Classes)
                              </div>
                            )}
                            {cellSlots.map((s, sIdx) => {
                              const style = KIND_COLORS[s.kind] || KIND_COLORS.lecture;
                              return (
                                <div
                                  key={s.id || sIdx}
                                  style={{
                                    background: style.bg, border: `1px solid ${style.border}`,
                                    borderRadius: 8, padding: '8px 10px',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: style.text }}>
                                      {s.course_code || 'COURSE'}
                                    </span>
                                    <span style={{ fontSize: 10, color: style.text, textTransform: 'uppercase', fontWeight: 700 }}>
                                      {s.kind || 'lecture'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', marginTop: 2 }}>
                                    {s.course_name}
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginTop: 4 }}>
                                    <span>Sec: {s.section || 'A'}</span>
                                    <span>📍 {s.room_name || 'Room 101'}</span>
                                  </div>
                                </div>
                              );
                            })}
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
    </div>
  );
}
