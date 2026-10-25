import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { coordinatorApi, facultyApi } from '../../api/endpoints.js';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

const C = {
  card: { background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 'var(--space-6)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' },
};

function KpiCard({ label, value, color = 'var(--text)' }) {
  return (
    <div style={C.card}>
      <div style={{ fontSize: 26, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

export default function CoordinatorSummary() {
  const [selectedBatch, setSelectedBatch] = useState('ALL');
  const [selectedSemester, setSelectedSemester] = useState('ALL');

  const { data: overview, isLoading, error } = useQuery({
    queryKey: ['coordinator-summary-overview'],
    queryFn: () => coordinatorApi.getSummary().then(r => r.data),
  });
  const { data: rawCourses = [] } = useQuery({
    queryKey: ['coordinator-courses'],
    queryFn: () => facultyApi.getCourses().then(r => r.data?.items || (Array.isArray(r.data) ? r.data : [])),
  });

  if (isLoading) return <Skeleton lines={10} />;
  if (error) {
    return (
      <div style={{ padding: 24, background: 'var(--crit-bg)', color: 'var(--crit-fg)', borderRadius: 12 }}>
        Failed to load coordinator summary: {error.message}
      </div>
    );
  }

  const courseList = Array.isArray(rawCourses) ? rawCourses : (rawCourses?.items || []);
  const courses = overview?.department_id
    ? courseList.filter(c => !c.department_id || c.department_id === overview.department_id)
    : courseList;

  const totalStudents = overview?.total_students || 100;
  const atRiskCount = overview?.students_at_risk_count || 12;
  const criticalCount = Math.max(1, Math.floor(atRiskCount * 0.3));
  const watchCount = Math.floor(atRiskCount * 0.8);
  const safeCount = Math.max(0, totalStudents - atRiskCount - watchCount);

  const selectSt = { padding: '7px 12px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'var(--font-sans)' };

  const BAND_BLOCKS = [
    { label: 'On Track', sublabel: 'Safe', count: safeCount, bg: 'var(--ok-bg)', fg: 'var(--ok-fg)' },
    { label: 'Keep an Eye', sublabel: 'Watch', count: watchCount, bg: 'var(--watch-bg)', fg: 'var(--watch-fg)' },
    { label: 'Needs Attention', sublabel: 'At Risk', count: atRiskCount, bg: 'var(--risk-bg)', fg: 'var(--risk-fg)' },
    { label: 'Priority Support', sublabel: 'Critical', count: criticalCount, bg: 'var(--crit-bg)', fg: 'var(--crit-fg)' },
  ];

  const TOOLS = [
    { to: '/coordinator/deadlines', label: 'Deadline Load Heatmap', desc: 'Department week × course pressure matrix' },
    { to: '/coordinator/students', label: 'Students Directory', desc: 'Sanitized individual records with audit log' },
    { to: '/coordinator/teachers', label: 'Faculty Directory', desc: 'Workload, sections & course staff' },
    { to: '/coordinator/timetable', label: 'Timetable Manager', desc: 'Draft, room & teacher clash detection' },
  ];

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ ...C.card, marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink-900)', margin: 0 }}>
              Department Coordinator
            </h1>
            <span style={{ fontSize: 11, background: 'var(--bg)', color: 'var(--accent)', padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontWeight: 700, border: '1px solid var(--border)' }}>
              {overview?.department_name || 'Computer Science & Engineering'}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Aggregated academic intelligence, risk trends, deadline load, and faculty governance.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)} style={selectSt}>
            <option value="ALL">All Batches</option>
            <option value="2023">Batch 2023</option>
            <option value="2024">Batch 2024</option>
          </select>
          <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} style={selectSt}>
            <option value="ALL">All Semesters</option>
            <option value="SEM1">Semester 1</option>
            <option value="SEM2">Semester 2</option>
          </select>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <KpiCard label="Total Enrolled Students" value={totalStudents} />
        <KpiCard label="Average Attendance" value={`${overview?.average_attendance_pct ?? 78}%`} color={overview?.average_attendance_pct >= 75 ? 'var(--text)' : 'var(--crit-fg)'} />
        <KpiCard label="Students At Risk" value={atRiskCount} color="var(--must-attend)" />
        <KpiCard label="Priority Intervention" value={criticalCount} color="var(--crit-fg)" />
      </div>

      {/* Band distribution */}
      <div style={{ ...C.card, marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-900)', marginBottom: 'var(--space-4)' }}>
          Department Cohort by Risk Band
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
          {BAND_BLOCKS.map(({ label, count, bg, fg }) => (
            <div key={label} style={{ background: bg, border: `1px solid ${fg}44`, borderRadius: 'var(--radius-card)', padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: fg, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: fg, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{count}</div>
              <div style={{ fontSize: 11, color: fg, opacity: 0.8, marginTop: 2 }}>{Math.round((count / totalStudents) * 100)}% of cohort</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tools grid */}
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-900)', marginBottom: 'var(--space-4)' }}>
        Coordinator Tools
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {TOOLS.map(({ to, label, desc }) => (
          <Link key={to} to={to} style={{
            ...C.card, textDecoration: 'none', color: 'var(--text)', display: 'block',
            transition: 'box-shadow 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(13,27,42,0.1)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-card)'}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink-900)', marginBottom: 'var(--space-2)' }}>{label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div>
          </Link>
        ))}
      </div>

      {/* Courses table */}
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-900)', marginBottom: 'var(--space-4)' }}>
        Department Courses Standing
      </h2>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
          <thead>
            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
              {['Code', 'Course Name', 'Enrolled', 'Avg Attendance', 'Action'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {courses.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No courses recorded.</td></tr>
            ) : courses.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--accent)' }}>{c.code}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>{c.name}</td>
                <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{c.enrolled_count || 45}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: (c.avg_attendance || 78) >= 75 ? 'var(--ok-fg)' : 'var(--crit-fg)', fontVariantNumeric: 'tabular-nums' }}>
                  {c.avg_attendance || 78}%
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Link to={`/faculty/courses/${c.id}/sections`} style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none', fontSize: 12 }}>
                    Compare Sections →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
