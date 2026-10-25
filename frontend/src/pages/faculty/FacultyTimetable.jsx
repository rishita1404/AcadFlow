
import { useQuery } from '@tanstack/react-query';
import { timetableApi } from '../../api/endpoints.js';
import { Link } from 'react-router-dom';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = ['P1 (09:00 - 10:00)', 'P2 (10:00 - 11:00)', 'P3 (11:15 - 12:15)', 'P4 (12:15 - 13:15)', 'P5 (14:00 - 15:00)', 'P6 (15:00 - 16:00)'];
const PERIOD_KEYS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

const KIND_COLORS = {
  lecture: { bg: 'var(--bg)', text: 'var(--accent)', border: 'var(--border)' },
  lab: { bg: 'var(--watch-bg)', text: 'var(--watch-fg)', border: 'var(--sand)' },
  tutorial: { bg: 'var(--risk-bg)', text: 'var(--risk-fg)', border: 'var(--sand)' },
};

export default function FacultyTimetable() {
  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['faculty-teaching-schedule'],
    queryFn: () => timetableApi.getMyTimetable().then(r => r.data || []),
  });

  const todayIndex = new Date().getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const currentWeekdayIdx = todayIndex > 0 && todayIndex <= 6 ? todayIndex - 1 : null;

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <Skeleton height={100} style={{ marginBottom: 20 }} />
        <Skeleton height={400} />
      </div>
    );
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
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40, color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          <Link to="/faculty/home" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Home</Link>
          {' '}/ Teaching Schedule
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
              My Weekly Teaching Schedule
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              Consolidated timetable across all assigned courses and lab sections · Real-time schedule sync.
            </p>
          </div>
          {hasClashes && (
            <div style={{
              background: 'var(--crit-bg)', border: '1px solid var(--crit-fg)', color: 'var(--crit-fg)',
              padding: '6px 14px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              🚨 Schedule Clashes Detected
            </div>
          )}
        </div>
      </div>

      {/* Timetable Weekly Grid */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 960 }}>
            <thead>
              <tr style={{ background: 'var(--ink-900)', color: 'var(--on-dark)' }}>
                <th style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, width: 140 }}>Day / Period</th>
                {PERIODS.map(p => (
                  <th key={p} style={{ padding: '12px 14px', fontSize: 12, fontWeight: 600 }}>{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((dayName, dayIdx) => {
                const isToday = dayIdx === currentWeekdayIdx;
                return (
                  <tr key={dayName} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{
                      padding: '12px 16px', fontWeight: 700, fontSize: 14, color: isToday ? 'var(--accent)' : 'var(--ink-900)',
                      background: isToday ? 'var(--bg)' : 'var(--surface)',
                      borderRight: '1px solid var(--border)',
                      borderLeft: isToday ? '3px solid var(--accent)' : 'none',
                    }}>
                      {dayName} {isToday ? '(Today)' : ''}
                    </td>
                    {PERIOD_KEYS.map(periodKey => {
                      const cellSlots = slotGrid[dayIdx]?.[periodKey] || [];
                      const isClash = cellSlots.length > 1;

                      return (
                        <td
                          key={periodKey}
                          style={{
                            padding: 8, verticalAlign: 'top', borderRight: '1px solid var(--border)',
                            background: isClash ? 'var(--crit-bg)' : cellSlots.length > 0 ? (isToday ? 'var(--bg)' : 'var(--surface)') : 'var(--bg)',
                            minWidth: 140,
                          }}
                        >
                          {cellSlots.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '14px 0' }}>
                              —
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {isClash && (
                                <div style={{
                                  background: 'var(--crit-fg)', color: 'var(--surface)', fontSize: 10, fontWeight: 800,
                                  padding: '2px 6px', borderRadius: 'var(--radius-pill)', textAlign: 'center', textTransform: 'uppercase',
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
                                      borderRadius: 'var(--radius-input)', padding: '8px 10px',
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: style.text }}>
                                        {s.course_code || 'COURSE'}
                                      </span>
                                      <span style={{ fontSize: 10, color: style.text, textTransform: 'uppercase', fontWeight: 700 }}>
                                        {s.kind || 'lecture'}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-900)', marginTop: 2 }}>
                                      {s.course_name}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
