import Card from './ui/Card.jsx';
import StatusBadge from './StatusBadge.jsx';
import BufferGauge from './BufferGauge.jsx';
import { formatPct } from '../utils/format.js';

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            {course.short_name && (
              <span style={{
                fontSize: 11, fontWeight: 800,
                background: 'var(--accent)', color: 'var(--on-dark, #fff)',
                padding: '2px 8px', borderRadius: 'var(--radius-pill)',
              }}>
                {course.short_name}
              </span>
            )}
            <span style={{
              display: 'inline-block',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
              color: 'var(--accent)', background: 'var(--bg)',
              padding: '2px 10px', borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--border)',
            }}>
              {course.code}
            </span>
          </div>
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
            {formatPct(pct)}
          </div>
        </div>

        {/* Classes held */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 2 }}>
            Attended / Held
          </div>
          <div style={{
            fontSize: 22, fontWeight: 800, color: 'var(--ink-900)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {course.attended ?? 0}
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>
              /{course.held ?? 0}
            </span>
          </div>
        </div>

        {/* Buffer Gauge */}
        <div style={{ marginLeft: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4, textAlign: 'right' }}>
            Buffer
          </div>
          <BufferGauge buffer={course.buffer} size={48} />
        </div>
      </div>
    </Card>
  );
}
