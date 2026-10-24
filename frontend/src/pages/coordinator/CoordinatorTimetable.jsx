import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Edit3, Wand2, FileText, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { timetableApi } from '../../api/endpoints.js';
import Skeleton from '../../components/Skeleton.jsx';

export default function CoordinatorTimetable() {
  const [hasDraft, setHasDraft] = useState(false);

  // Fetch timetable versions
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['timetable-versions-list'],
    queryFn: () => timetableApi.getVersions().then(r => r.data || []),
  });

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
        <Skeleton variant="title" width={320} height={36} />
        <Skeleton variant="text" width={220} height={18} style={{ marginTop: 8, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Skeleton variant="card" height={200} />
          <Skeleton variant="card" height={200} />
        </div>
      </div>
    );
  }

  const publishedVersion = versions.find(v => v.status === 'published') || versions[0];

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          <Link to="/coordinator/summary" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Summary</Link>
          {' '}/ Timetable Manager
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
              Department Timetable Manager
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
              Department: <strong style={{ color: 'var(--ink-900)' }}>CSE (Dept #1)</strong> · Semester: <strong style={{ color: 'var(--ink-900)' }}>Autumn 2026</strong> · Status:{' '}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'var(--ok-bg)', color: 'var(--ok-fg)',
                padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 12,
              }}>
                <CheckCircle2 size={12} /> Published (v{publishedVersion?.id || 1})
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Draft banner if exists */}
      {hasDraft && (
        <div style={{
          background: 'var(--watch-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)',
          padding: '16px 20px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--watch-fg)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} /> Unpublished Draft Timetable
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-900)', marginTop: 4 }}>
              Staged edits exist for Spring 2027. Changes will not affect live student and teacher views until published.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setHasDraft(false)}
              style={{
                background: 'var(--surface)', color: 'var(--crit-fg)', border: '1px solid var(--border)',
                padding: '8px 16px', borderRadius: 'var(--radius-pill)', fontWeight: 600, cursor: 'pointer', fontSize: 13,
              }}
            >
              Discard Draft
            </button>
            <button
              style={{
                background: 'var(--accent)', color: 'var(--on-dark)', border: 'none',
                padding: '8px 18px', borderRadius: 'var(--radius-pill)', fontWeight: 600, cursor: 'pointer', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              Resume Draft <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Action Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 32 }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 24,
          boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              width: 44, height: 44, borderRadius: 'var(--radius-pill)', background: 'var(--bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', marginBottom: 14,
            }}>
              <Edit3 size={22} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
              Update Existing Timetable
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
              Open interactive weekly grid editor (days × periods). Toggle Batch/Section, Teacher, or Room views. Move classes, resolve live clashes, and stage changes safely.
            </p>
          </div>
          <Link
            to="/faculty/timetable"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20,
              background: 'var(--accent)', color: 'var(--on-dark)',
              padding: '12px 20px', borderRadius: 'var(--radius-pill)', fontSize: 14, fontWeight: 600, textDecoration: 'none',
              transition: 'background 0.15s ease',
            }}
          >
            Open Timetable Grid Editor <ArrowRight size={16} />
          </Link>
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 24,
          boxShadow: 'var(--shadow-card)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              width: 44, height: 44, borderRadius: 'var(--radius-pill)', background: 'var(--bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', marginBottom: 14,
            }}>
              <Wand2 size={22} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
              Start From Scratch Wizard
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
              5-step wizard with horizontal stepper: Scope (dept/working days), Timings (periods/breaks/lunch), Courses & Teachers, Placement tray, and Clash validation.
            </p>
          </div>
          <button
            onClick={() => setHasDraft(true)}
            style={{
              marginTop: 20, background: 'var(--surface)', color: 'var(--ink-900)', border: '1px solid var(--border)',
              padding: '12px 20px', borderRadius: 'var(--radius-pill)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            Launch Scratch Wizard <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Version History Table */}
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 14 }}>
        Timetable Version History
      </h2>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Version</th>
              <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Status</th>
              <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Effective Date</th>
              <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Clashes</th>
              <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Published At</th>
            </tr>
          </thead>
          <tbody>
            {versions.length === 0 ? (
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--ink-900)' }}>v1.0 (Production)</td>
                <td style={{ padding: '14px 18px' }}>
                  <span style={{
                    background: 'var(--ok-bg)', color: 'var(--ok-fg)',
                    padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 11,
                  }}>
                    PUBLISHED
                  </span>
                </td>
                <td style={{ padding: '14px 18px', color: 'var(--text)' }}>2026-08-01</td>
                <td style={{ padding: '14px 18px', color: 'var(--crit-fg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} /> 1 Teacher Clash (Demo)
                </td>
                <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>2026-08-01 09:00:00</td>
              </tr>
            ) : (
              versions.map(v => (
                <tr key={v.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--ink-900)' }}>v{v.id}.0</td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      background: v.status === 'published' ? 'var(--ok-bg)' : 'var(--watch-bg)',
                      color: v.status === 'published' ? 'var(--ok-fg)' : 'var(--watch-fg)',
                      padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase',
                    }}>
                      {v.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', color: 'var(--text)' }}>{v.effective_from || 'Current Semester'}</td>
                  <td style={{ padding: '14px 18px', color: 'var(--text)', fontWeight: 600 }}>0 Clashes</td>
                  <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>{v.published_at || 'Active'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
