
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { coordinatorApi } from '../../api/endpoints.js';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

export default function CoordinatorDeadlines() {
  const { data: loadData, isLoading } = useQuery({
    queryKey: ['coordinator-deadline-load'],
    queryFn: () => coordinatorApi.getDeadlineLoad().then(r => r.data),
  });

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <Skeleton height={100} style={{ marginBottom: 20 }} />
        <Skeleton height={60} style={{ marginBottom: 20 }} />
        <Skeleton height={350} />
      </div>
    );
  }

  const weeks = loadData?.weeks || ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  const grid = loadData?.grid || [
    { course_code: 'CS101', course_name: 'Intro to Programming', weeks: { 'Week 1': 0, 'Week 2': 1, 'Week 3': 2, 'Week 4': 0 } },
    { course_code: 'CS201', course_name: 'Data Structures & Algorithms', weeks: { 'Week 1': 1, 'Week 2': 0, 'Week 3': 3, 'Week 4': 1 } },
    { course_code: 'CS301', course_name: 'Database Management Systems', weeks: { 'Week 1': 0, 'Week 2': 2, 'Week 3': 1, 'Week 4': 2 } },
  ];

  // Helper for heatmap background color based on deadline count
  function getHeatColor(count) {
    if (count === 0) return { bg: 'var(--heat-0)', text: 'var(--text-muted)' };
    if (count === 1) return { bg: 'var(--heat-1)', text: 'var(--ink-900)' };
    if (count === 2) return { bg: 'var(--heat-2)', text: 'var(--on-dark)' };
    return { bg: 'var(--heat-3)', text: 'var(--on-dark)' };
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40, color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          <Link to="/coordinator/summary" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Summary</Link>
          {' '}/ Deadline Load Heatmap
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
          Department Deadline Load Heatmap
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Week-by-week assignment deadline concentration across courses · Prevent systemic submission bottlenecks and student burnout.
        </p>
      </div>

      {/* Heatmap Legend */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '14px 20px', border: '1px solid var(--border)',
        marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', boxShadow: 'var(--shadow-card)',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)' }}>Cluster Density Legend:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: 'var(--heat-0)', border: '1px solid var(--border)' }} />
          <span>0 Deadlines (Clear)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: 'var(--heat-1)', border: '1px solid var(--border)' }} />
          <span>1 Deadline (Light)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: 'var(--heat-2)', border: '1px solid var(--border)' }} />
          <span>2 Deadlines (Moderate)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: 'var(--heat-3)', border: '1px solid var(--border)' }} />
          <span>3+ Deadlines (Heavy Pressure)</span>
        </div>
      </div>

      {/* Heatmap Table */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead style={{ background: 'var(--ink-900)', color: 'var(--on-dark)' }}>
            <tr>
              <th style={{ padding: '12px 16px', fontWeight: 600, width: 280 }}>Course</th>
              {weeks.map(w => (
                <th key={w} style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map(row => (
              <tr key={row.course_code} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '14px 16px', background: 'var(--bg)', borderRight: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{row.course_code}</div>
                  <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 2 }}>{row.course_name}</div>
                </td>
                {weeks.map(w => {
                  const count = row.weeks[w] || 0;
                  const colors = getHeatColor(count);
                  return (
                    <td
                      key={w}
                      style={{
                        padding: '14px 16px', textAlign: 'center',
                        background: colors.bg, color: colors.text, fontWeight: 700, fontSize: 14,
                        borderRight: '1px solid var(--border)',
                      }}
                    >
                      {count > 0 ? `${count} due` : '—'}
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
