
import Card from './ui/Card.jsx';
import StatusBadge from './StatusBadge.jsx';
import BufferGauge from './BufferGauge.jsx';

export default function CourseCard({ course, onClick }) {
  const pct = course.attendance_pct ?? course.attendance_percentage ?? null;
  const pctColor = pct == null
    ? 'var(--text-muted)'
    : pct >= 75 ? 'var(--sage)' : pct >= 65 ? 'var(--must-attend)' : 'var(--crit-fg)';

  return (
    <Card
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      padding="var(--space-6)"
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
        <div>
          <span style={{
            display: 'inline-block',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
            color: 'var(--accent)', background: 'var(--bg)',
            padding: '2px 10px', borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border)',
            marginBottom: 6,
          }}>
            {course.code}
          </span>
          <h3 style={{
            fontFamily: 'var(--font-serif)', fontSize: 16,
            color: 'var(--ink-900)', lineHeight: 1.3, margin: 0,
          }}>
            {course.name}
          </h3>
        </div>
        <StatusBadge band={course.risk_band || course.band} size="sm" />
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex', gap: 'var(--space-6)',
        borderTop: '1px solid var(--border)',
        paddingTop: 'var(--space-4)',
        marginTop: 'var(--space-3)',
      }}>
        {/* Attendance */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 2 }}>
            Attendance
          </div>
          <div style={{
            fontSize: 22, fontWeight: 800, color: pctColor,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {pct != null ? `${pct}%` : '—'}
          </div>
        </div>

        {/* Buffer */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 2 }}>
            Buffer
          </div>
          <BufferGauge buffer={course.buffer} />
        </div>

        {/* Sessions */}
        {(course.classes_held != null || course.total_sessions != null) && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 2 }}>
              Sessions
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
              {course.classes_attended ?? course.attended ?? '?'} / {course.classes_held ?? course.total_sessions ?? '?'}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
