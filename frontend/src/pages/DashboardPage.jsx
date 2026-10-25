
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BookOpen, TrendingUp, AlertCircle } from 'lucide-react';
import { dashboardApi } from '../api/endpoints.js';
import { formatPct } from '../utils/format.js';

const BAND_COLOR = {
  'Safe':     { bg: 'var(--ok-bg)', text: 'var(--ok-fg)', border: 'var(--border)' },
  'Watch':    { bg: 'var(--watch-bg)', text: 'var(--watch-fg)', border: 'var(--border)' },
  'At risk':  { bg: 'var(--risk-bg)', text: 'var(--risk-fg)', border: 'var(--border)' },
  'Critical': { bg: 'var(--crit-bg)', text: 'var(--crit-fg)', border: 'var(--border)' },
  'Insufficient data': { bg: 'var(--nodata-bg)', text: 'var(--nodata-fg)', border: 'var(--border)' },
};

function BandBadge({ band }) {
  const style = BAND_COLOR[band] || BAND_COLOR['Insufficient data'];
  return (
    <span style={{
      background: style.bg, color: style.text, border: `1px solid ${style.border}`,
      borderRadius: 'var(--radius-pill)', padding: '3px 10px', fontSize: 11, fontWeight: 600,
    }}>
      {band}
    </span>
  );
}

function AttendanceBar({ pct }) {
  const safe = pct >= 75;
  const warn = pct >= 65 && pct < 75;
  const color = safe ? 'var(--ok-bg)' : warn ? 'var(--watch-fg)' : 'var(--crit-fg)';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: 'var(--text-muted)' }}>Attendance</span>
        <span style={{ fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{pct != null ? `${pct}%` : 'N/A'}</span>
      </div>
      <div style={{ background: 'var(--bg)', borderRadius: 4, height: 6, border: '1px solid var(--border)' }}>
        <div style={{
          width: `${Math.min(pct || 0, 100)}%`, height: '100%',
          background: color, borderRadius: 4, transition: 'width 0.5s',
        }} />
      </div>
      {pct != null && pct < 75 && (
        <div style={{ fontSize: 11, color: 'var(--crit-fg)', marginTop: 4, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertTriangle size={12} /> Below 75% threshold
        </div>
      )}
    </div>
  );
}

function CourseCard({ course }) {
  const bufferColor =
    course.buffer == null ? 'var(--text-muted)'
    : course.buffer <= 0 ? 'var(--crit-fg)'
    : course.buffer <= 2 ? 'var(--watch-fg)'
    : 'var(--ok-fg)';

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 20,
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-card)',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'var(--accent)',
            background: 'var(--bg)', padding: '2px 8px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)',
          }}>{course.code}</span>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 600, color: 'var(--ink-900)', marginTop: 6, margin: 0 }}>
            {course.name}
          </h3>
        </div>
        <BandBadge band={course.risk_band} />
      </div>

      <AttendanceBar pct={course.attendance_pct} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14 }}>
        <Stat label="Buffer" value={course.buffer != null ? course.buffer : '—'} color={bufferColor} />
        <Stat label="Attended" value={`${course.attended}/${course.held}`} color="var(--accent)" />
        <Stat label="Still Need" value={course.still_need != null ? course.still_need : '—'} color="var(--watch-fg)" />
      </div>

      {course.insufficient_data && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          Not enough data yet (need ≥8 sessions)
        </p>
      )}

      {course.status_message && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          {course.status_message}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', background: 'var(--bg)', borderRadius: 'var(--radius-input)', padding: '8px 4px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  );
}

function WarnBanner({ warnings }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      {warnings.slice(0, 3).map((w, i) => {
        const isRed = w.severity === 'critical' || w.severity === 'high';
        return (
          <div key={i} style={{
            background: isRed ? 'var(--crit-bg)' : 'var(--watch-bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)', padding: '12px 18px', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 12, fontSize: 13,
          }}>
            <AlertTriangle size={18} style={{ color: isRed ? 'var(--crit-fg)' : 'var(--watch-fg)' }} />
            <div>
              <strong style={{ color: isRed ? 'var(--crit-fg)' : 'var(--watch-fg)' }}>{w.title}</strong>
              <div style={{ color: 'var(--ink-900)', fontSize: 12, marginTop: 2 }}>{w.message}</div>
            </div>
          </div>
        );
      })}
      {warnings.length > 3 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          + {warnings.length - 3} more warnings. Go to Alerts page.
        </p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data: dash, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.getDashboard().then(r => r.data),
  });

  const { data: warnings } = useQuery({
    queryKey: ['warnings'],
    queryFn: () => dashboardApi.getWarnings().then(r => r.data),
    refetchInterval: 120_000,
  });

  if (isLoading) return <LoadingScreen msg="Loading your dashboard…" />;
  if (error) return <ErrorMsg msg={error?.response?.data?.detail || error.message} />;

  const overall = dash?.overall_attendance_pct;

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
          Welcome back, {dash?.name?.split(' ')[0]}
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 14 }}>
          Roll No: {dash?.roll_no || 'N/A'} · {dash?.total_courses} courses enrolled
        </p>
      </div>

      {/* Warning banners */}
      <WarnBanner warnings={warnings} />

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <SummaryCard icon={<TrendingUp size={22} />} label="Overall Attendance"
          value={formatPct(overall)}
          sub={overall != null && overall < 75 ? 'Below 75% threshold' : 'Across all courses'}
          color={overall != null && overall >= 75 ? 'var(--ok-fg)' : 'var(--crit-fg)'} />
        <SummaryCard icon={<BookOpen size={22} />} label="Courses"
          value={dash?.total_courses}
          sub="enrolled this semester" color="var(--accent)" />
        <SummaryCard icon={<AlertTriangle size={22} />} label="At Risk"
          value={dash?.at_risk_courses_count}
          sub="courses need attention" color="var(--watch-fg)" />
        <SummaryCard icon={<AlertCircle size={22} />} label="Critical"
          value={dash?.critical_courses_count}
          sub="courses are critical" color="var(--crit-fg)" />
      </div>

      {/* Course cards */}
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 14 }}>
        Course Overview
      </h2>
      {dash?.courses?.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No courses enrolled yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {dash?.courses?.map(c => <CourseCard key={c.course_id} course={c} />)}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 20,
      border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ color: 'var(--accent)', marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontWeight: 600, color: 'var(--ink-900)', fontSize: 13, marginTop: 4 }}>{label}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

export function LoadingScreen({ msg }) {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
      <p style={{ fontSize: 14 }}>{msg || 'Loading…'}</p>
    </div>
  );
}

export function ErrorMsg({ msg }) {
  return (
    <div style={{
      background: 'var(--crit-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)',
      padding: 20, color: 'var(--crit-fg)', maxWidth: 500,
    }}>
      <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={16} /> Error</strong>
      <p style={{ marginTop: 4, fontSize: 14 }}>{msg}</p>
    </div>
  );
}
