import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { coordinatorApi } from '../../api/endpoints.js';

export default function CoordinatorDeadlines() {
  const { data: loadData, isLoading } = useQuery({
    queryKey: ['coordinator-deadline-load'],
    queryFn: () => coordinatorApi.getDeadlineLoad().then(r => r.data),
  });

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading deadline load heatmap...</div>;
  }

  const weeks = loadData?.weeks || ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  const grid = loadData?.grid || [
    { course_code: 'CS101', course_name: 'Intro to Programming', weeks: { 'Week 1': 0, 'Week 2': 1, 'Week 3': 2, 'Week 4': 0 } },
    { course_code: 'CS201', course_name: 'Data Structures & Algorithms', weeks: { 'Week 1': 1, 'Week 2': 0, 'Week 3': 3, 'Week 4': 1 } },
    { course_code: 'CS301', course_name: 'Database Management Systems', weeks: { 'Week 1': 0, 'Week 2': 2, 'Week 3': 1, 'Week 4': 2 } },
  ];

  // Helper for heatmap background color based on deadline count
  function getHeatColor(count) {
    if (count === 0) return { bg: '#f8fafc', text: '#94a3b8' };
    if (count === 1) return { bg: '#dbeafe', text: '#1d4ed8' };
    if (count === 2) return { bg: '#fef3c7', text: '#b45309' };
    return { bg: '#fee2e2', text: '#b91c1c' }; // 3+ is high pressure
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
          <Link to="/coordinator/summary" style={{ color: '#3b82f6', textDecoration: 'none' }}>Summary</Link>
          {' '}/ Deadline Load Heatmap
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
          🔥 Department Deadline Load Heatmap
        </h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
          Week-by-week assignment deadline concentration across courses · Prevent systemic submission bottlenecks and student burnout.
        </p>
      </div>

      {/* Heatmap Legend */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: '14px 20px', border: '1px solid #e2e8f0',
        marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Cluster Density Legend:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: '#f8fafc', border: '1px solid #cbd5e1' }} />
          <span>0 Deadlines (Clear)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: '#dbeafe', border: '1px solid #bfdbfe' }} />
          <span>1 Deadline (Light)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: '#fef3c7', border: '1px solid #fde68a' }} />
          <span>2 Deadlines (Moderate)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: '#fee2e2', border: '1px solid #fca5a5' }} />
          <span>3+ Deadlines (Heavy Pressure)</span>
        </div>
      </div>

      {/* Heatmap Table */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead style={{ background: '#1e293b', color: '#f8fafc' }}>
            <tr>
              <th style={{ padding: '12px 16px', fontWeight: 700, width: 280 }}>Course</th>
              {weeks.map(w => (
                <th key={w} style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center' }}>{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map(row => (
              <tr key={row.course_code} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '14px 16px', background: '#f8fafc', borderRight: '2px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 800, color: '#3b82f6' }}>{row.course_code}</div>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{row.course_name}</div>
                </td>
                {weeks.map(w => {
                  const count = row.weeks[w] || 0;
                  const colors = getHeatColor(count);
                  return (
                    <td
                      key={w}
                      style={{
                        padding: '14px 16px', textAlign: 'center',
                        background: colors.bg, color: colors.text, fontWeight: 800, fontSize: 15,
                        borderRight: '1px solid #f1f5f9',
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
