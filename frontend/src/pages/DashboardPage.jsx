import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/endpoints.js';

const BAND_COLOR = {
  'Safe':     { bg: '#f0fdf4', text: '#15803d', border: '#86efac' },
  'Watch':    { bg: '#fffbeb', text: '#b45309', border: '#fcd34d' },
  'At risk':  { bg: '#fff7ed', text: '#c2410c', border: '#fdba74' },
  'Critical': { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
  'Insufficient data': { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' },
};

const WARNING_LEVEL_COLOR = {
  safe:     '#22c55e',
  watch:    '#f59e0b',
  danger:   '#f97316',
  critical: '#ef4444',
};

function BandBadge({ band }) {
  const style = BAND_COLOR[band] || BAND_COLOR['Insufficient data'];
  return (
    <span style={{
      background: style.bg, color: style.text, border: `1px solid ${style.border}`,
      borderRadius: 9999, padding: '3px 10px', fontSize: 11, fontWeight: 700,
    }}>
      {band}
    </span>
  );
}

function AttendanceBar({ pct }) {
  const safe = pct >= 75;
  const warn = pct >= 65 && pct < 75;
  const color = safe ? '#22c55e' : warn ? '#f59e0b' : '#ef4444';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: '#64748b' }}>Attendance</span>
        <span style={{ fontWeight: 700, color }}>{pct != null ? `${pct}%` : 'N/A'}</span>
      </div>
      <div style={{ background: '#e2e8f0', borderRadius: 4, height: 6 }}>
        <div style={{
          width: `${Math.min(pct || 0, 100)}%`, height: '100%',
          background: color, borderRadius: 4, transition: 'width 0.5s',
        }} />
      </div>
      {pct != null && pct < 75 && (
        <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>
          ⚠ Below 75% threshold
        </div>
      )}
    </div>
  );
}

function CourseCard({ course }) {
  const warnColor = WARNING_LEVEL_COLOR[course.warning_level] || '#22c55e';
  const bufferColor =
    course.buffer == null ? '#94a3b8'
    : course.buffer <= 0 ? '#ef4444'
    : course.buffer <= 2 ? '#f59e0b'
    : '#22c55e';

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 20,
      border: `1px solid ${course.has_warning ? warnColor + '55' : '#e2e8f0'}`,
      boxShadow: course.has_warning ? `0 0 0 2px ${warnColor}30` : '0 1px 4px rgba(0,0,0,0.06)',
      position: 'relative',
    }}>
      {course.has_warning && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          width: 10, height: 10, borderRadius: '50%',
          background: warnColor, boxShadow: `0 0 6px ${warnColor}`,
        }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#3b82f6',
            background: '#eff6ff', padding: '2px 8px', borderRadius: 4,
          }}>{course.code}</span>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', marginTop: 4 }}>
            {course.name}
          </h3>
        </div>
        <BandBadge band={course.risk_band} />
      </div>

      <AttendanceBar pct={course.attendance_pct} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14 }}>
        <Stat label="Buffer" value={course.buffer != null ? course.buffer : '—'} color={bufferColor} />
        <Stat label="Attended" value={`${course.attended}/${course.held}`} color="#6366f1" />
        <Stat label="Still Need" value={course.still_need != null ? course.still_need : '—'} color="#f59e0b" />
      </div>

      {course.insufficient_data && (
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
          📊 Not enough data yet (need ≥8 sessions)
        </p>
      )}

      <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
        {course.status_message}
      </p>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', background: '#f8fafc', borderRadius: 8, padding: '8px 4px' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{label}</div>
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
            background: isRed ? '#fef2f2' : '#fffbeb',
            border: `1px solid ${isRed ? '#fca5a5' : '#fcd34d'}`,
            borderRadius: 8, padding: '10px 16px', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
          }}>
            <span>{isRed ? '🚨' : '⚠️'}</span>
            <div>
              <strong>{w.title}</strong>
              <div style={{ color: '#64748b', fontSize: 12 }}>{w.message}</div>
            </div>
          </div>
        );
      })}
      {warnings.length > 3 && (
        <p style={{ fontSize: 12, color: '#94a3b8' }}>
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
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>
          👋 Welcome back, {dash?.name?.split(' ')[0]}
        </h1>
        <p style={{ color: '#64748b', marginTop: 4 }}>
          Roll No: {dash?.roll_no || 'N/A'} · {dash?.total_courses} courses enrolled
        </p>
      </div>

      {/* Warning banners */}
      <WarnBanner warnings={warnings} />

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 24 }}>
        <SummaryCard icon="📈" label="Overall Attendance"
          value={overall != null ? `${overall}%` : 'N/A'}
          sub={overall != null && overall < 75 ? '⚠ Below 75%!' : 'Across all courses'}
          color={overall >= 75 ? '#22c55e' : '#ef4444'} />
        <SummaryCard icon="📚" label="Courses"
          value={dash?.total_courses}
          sub="enrolled this semester" color="#6366f1" />
        <SummaryCard icon="⚠️" label="At Risk"
          value={dash?.at_risk_courses_count}
          sub="courses need attention" color="#f59e0b" />
        <SummaryCard icon="🆘" label="Critical"
          value={dash?.critical_courses_count}
          sub="courses are critical" color="#ef4444" />
        <SummaryCard icon="🔴" label="Active Warnings"
          value={dash?.active_warnings}
          sub="require immediate action" color={dash?.active_warnings > 0 ? '#ef4444' : '#22c55e'} />
      </div>

      {/* Course cards */}
      <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>
        📋 Course Overview
      </h2>
      {dash?.courses?.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: 14 }}>No courses enrolled yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {dash?.courses?.map(c => <CourseCard key={c.course_id} course={c} />)}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, sub, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 20,
      border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>{label}</div>
      <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

export function LoadingScreen({ msg }) {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
      <p>{msg || 'Loading…'}</p>
    </div>
  );
}

export function ErrorMsg({ msg }) {
  return (
    <div style={{
      background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10,
      padding: 20, color: '#dc2626', maxWidth: 500,
    }}>
      <strong>⚠ Error</strong>
      <p style={{ marginTop: 4, fontSize: 14 }}>{msg}</p>
    </div>
  );
}
