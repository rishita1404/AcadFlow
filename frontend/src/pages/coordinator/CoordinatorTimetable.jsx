import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { timetableApi } from '../../api/endpoints.js';

export default function CoordinatorTimetable() {
  const [hasDraft, setHasDraft] = useState(false);

  // Fetch timetable versions
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['timetable-versions-list'],
    queryFn: () => timetableApi.getVersions().then(r => r.data || []),
  });

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading timetable manager...</div>;
  }

  const publishedVersion = versions.find(v => v.status === 'published') || versions[0];

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
          <Link to="/coordinator/summary" style={{ color: '#3b82f6', textDecoration: 'none' }}>Summary</Link>
          {' '}/ Timetable Manager
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
              🗓 Department Timetable Manager (T1)
            </h1>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
              Department: <strong>CSE (Dept #1)</strong> · Semester: <strong>Autumn 2026</strong> · Status:{' '}
              <span style={{ color: '#16a34a', fontWeight: 700 }}>Published (v{publishedVersion?.id || 1})</span>
            </p>
          </div>
        </div>
      </div>

      {/* Draft banner if exists */}
      {hasDraft && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 12,
          padding: '16px 20px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#b45309' }}>
              📝 You have an unpublished draft timetable
            </div>
            <div style={{ fontSize: 13, color: '#78350f', marginTop: 2 }}>
              Staged edits exist for Spring 2027. Changes will not affect live student and teacher views until published.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setHasDraft(false)}
              style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '6px 14px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
            >
              Discard Draft
            </button>
            <button
              style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
            >
              Resume Draft →
            </button>
          </div>
        </div>
      )}

      {/* Two Large Action Buttons (Update Existing vs Start From Scratch) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        <div style={{
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✏️</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>
              Update Existing Timetable (T2)
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
              Open interactive weekly grid editor (days x periods). Toggle Batch/Section, Teacher, or Room views. Move classes, resolve live clashes, and stage changes safely.
            </p>
          </div>
          <Link
            to="/faculty/timetable"
            style={{
              display: 'inline-block', marginTop: 18, textAlign: 'center', background: '#3b82f6', color: '#fff',
              padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none',
            }}
          >
            Open Timetable Grid Editor →
          </Link>
        </div>

        <div style={{
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🪄</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>
              Start From Scratch Wizard (T3)
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
              5-step wizard with horizontal stepper: Scope (dept/working days), Timings (periods/breaks/lunch), Courses & Teachers, Placement tray, and Clash validation.
            </p>
          </div>
          <button
            onClick={() => setHasDraft(true)}
            style={{
              marginTop: 18, background: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1',
              padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Launch Scratch Wizard →
          </button>
        </div>
      </div>

      {/* Version History Table */}
      <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1e293b', marginBottom: 14 }}>
        📜 Timetable Version History
      </h2>
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            <tr>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Version</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Status</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Effective Date</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Clashes</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Published At</th>
            </tr>
          </thead>
          <tbody>
            {versions.length === 0 ? (
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 16px', fontWeight: 800 }}>v1.0 (Production)</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                    PUBLISHED
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: '#475569' }}>2026-08-01</td>
                <td style={{ padding: '12px 16px', color: '#dc2626', fontWeight: 700 }}>1 Teacher Clash (Demo)</td>
                <td style={{ padding: '12px 16px', color: '#64748b' }}>2026-08-01 09:00:00</td>
              </tr>
            ) : (
              versions.map(v => (
                <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 800 }}>v{v.id}.0</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      background: v.status === 'published' ? '#dcfce7' : '#fef3c7',
                      color: v.status === 'published' ? '#15803d' : '#b45309',
                      padding: '3px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11, textTransform: 'uppercase',
                    }}>
                      {v.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>{v.effective_from || 'Current Semester'}</td>
                  <td style={{ padding: '12px 16px', color: '#16a34a', fontWeight: 600 }}>0 Clashes</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{v.published_at || 'Active'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
