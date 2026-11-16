import Card from './ui/Card.jsx';
import StatusBadge from './StatusBadge.jsx';
import BufferGauge from './BufferGauge.jsx';
import { formatPct } from '../utils/format.js';
import Button from './ui/Button.jsx';
import { HelpCircle } from 'lucide-react';

export default function CourseCard({
  course,
  overallBand = null,
  onClick = null,
  onSimulate = null,
}) {
  const pct = course.attendance_pct ?? course.attendance_percentage ?? null;

  // High contrast WCAG AA compliant colors (> 4.5:1 on #FFFDF5 / #F4F1DE)
  const pctColor =
    pct == null
      ? 'var(--text-muted)'
      : pct >= 75
      ? '#1E3F20' // Dark forest green (passes AA/AAA)
      : pct >= 65
      ? '#8A3C1E' // Dark terracotta amber (passes AA)
      : '#7A2E2E'; // Dark maroon/crimson (passes AA)

  const buffer = course.buffer;
  const isNeg = buffer != null && buffer < 0;
  const isTight = buffer != null && buffer >= 0 && buffer <= 2;

  // Helper buffer label when course band matches overall band
  const bufferLabel = isNeg
    ? 'Not recoverable by attendance alone'
    : isTight
    ? 'Tight'
    : 'Comfortable';

  const bufferLabelColor = isNeg
    ? 'var(--crit-fg)'
    : isTight
    ? 'var(--must-attend)'
    : 'var(--sage)';

  const courseBand = course.risk_band || course.band;
  const showPerCourseBadge =
    courseBand && overallBand
      ? courseBand.toLowerCase() !== overallBand.toLowerCase()
      : true;

  const totalClasses = course.total_classes ?? 60;
  const held = course.held ?? 0;
  const attended = course.attended ?? 0;
  const remaining = course.remaining ?? Math.max(0, totalClasses - held);

  return (
    <Card
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        background: 'var(--surface)',
      }}
      padding="var(--space-6)"
    >
      <div>
        {/* Header: Course Code + Name + Status or Buffer Label */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-3)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              {/* Clean Course Code Pill */}
              <span
                style={{
                  display: 'inline-block',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: 'var(--ink-900)',
                  background: 'var(--bg)',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--border)',
                }}
              >
                {course.code}
              </span>
            </div>
            <h3
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 17,
                color: 'var(--ink-900)',
                lineHeight: 1.3,
                margin: 0,
                fontWeight: 600,
              }}
            >
              {course.name}
            </h3>
          </div>

          {/* Show badge only when differing from overall, else show small buffer status label */}
          <div>
            {showPerCourseBadge ? (
              <StatusBadge band={courseBand} size="sm" />
            ) : (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg)',
                  color: bufferLabelColor,
                  border: '1px solid var(--border)',
                  whiteSpace: 'nowrap',
                }}
              >
                {bufferLabel}
              </span>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: 'var(--space-4)',
            borderTop: '1px solid var(--border)',
            paddingTop: 'var(--space-4)',
            marginTop: 'var(--space-3)',
            alignItems: 'center',
          }}
        >
          {/* Attendance Column */}
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 2,
              }}
            >
              Attendance
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: pctColor,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.1,
              }}
            >
              {formatPct(pct)}
            </div>
          </div>

          {/* Buffer Gauge Column */}
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <BufferGauge
              buffer={buffer}
              remaining={remaining}
              totalClasses={totalClasses}
              small
            />
          </div>
        </div>

        {/* Attendance breakdown line */}
        <div
          style={{
            fontSize: 12,
            color: 'var(--text)',
            opacity: 0.88,
            marginTop: 'var(--space-3)',
            paddingTop: 'var(--space-2)',
            borderTop: '1px dashed var(--border)',
          }}
        >
          Attended {attended} of {held} held · {totalClasses} total · {remaining} remaining
        </div>
      </div>

      {/* Action Footer: What if I miss the next 2? */}
      <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-2)' }}>
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            if (onSimulate) onSimulate(course, 2);
          }}
          aria-label={`Simulate missing next 2 classes for ${course.name} (${course.code})`}
          style={{
            width: '100%',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            padding: '6px 12px',
          }}
          icon={<HelpCircle size={14} />}
        >
          What if I miss the next 2?
        </Button>
      </div>
    </Card>
  );
}
