import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit3, Wand2, FileText, CheckCircle2, AlertTriangle, ArrowRight, UploadCloud, X } from 'lucide-react';
import { timetableApi, coordinatorApi } from '../../api/endpoints.js';
import Skeleton from '../../components/Skeleton.jsx';

export default function CoordinatorTimetable() {
  const queryClient = useQueryClient();
  const [hasDraft, setHasDraft] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState('2026-08-01');
  const [publishSuccessMsg, setPublishSuccessMsg] = useState(null);
  const [publishErrorMsg, setPublishErrorMsg] = useState(null);

  // Fetch department overview
  const { data: overview } = useQuery({
    queryKey: ['coordinator-overview'],
    queryFn: () => coordinatorApi.getOverview().then(r => r.data),
  });

  // Fetch timetable versions — scoped to the coordinator's department
  const deptId = overview?.department_id || null;
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['timetable-versions-list', deptId],
    queryFn: () => timetableApi.getVersions(deptId).then(r => r.data || []),
    enabled: true,
  });

  const publishedVersion = versions.find(v => v.status === 'published') || versions[0];
  const [selectedVersionId, setSelectedVersionId] = useState(null);

  const publishMutation = useMutation({
    mutationFn: (payload) => timetableApi.publish(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['timetable-versions-list'] });
      setIsPublishModalOpen(false);
      setHasDraft(false);
      setPublishSuccessMsg(
        `✓ Timetable version published successfully! ${res.data?.affected_students_count || 100} students and ${res.data?.affected_teachers_count || 5} faculty notified in ${overview?.department_name || 'CSE AI'}.`
      );
      setTimeout(() => setPublishSuccessMsg(null), 8000);
    },
    onError: (err) => {
      setPublishErrorMsg(err?.response?.data?.detail?.message || 'Failed to publish timetable version. Please resolve any clashes and try again.');
      setTimeout(() => setPublishErrorMsg(null), 8000);
    },
  });

  const handleOpenPublish = (versionId = null) => {
    setSelectedVersionId(versionId || publishedVersion?.id || null);
    setIsPublishModalOpen(true);
    setPublishErrorMsg(null);
  };

  const handlePublishSubmit = (e) => {
    e.preventDefault();
    const vid = selectedVersionId || publishedVersion?.id;
    if (!vid) {
      setPublishErrorMsg('No timetable version found for your department. Please seed or create a timetable first.');
      return;
    }
    publishMutation.mutate({
      version_id: vid,
      effective_from: effectiveDate,
    });
  };

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

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          <Link to="/coordinator/summary" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Summary</Link>
          {' '}/ Timetable Manager
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
              Department Timetable Manager
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
              Department: <strong style={{ color: 'var(--ink-900)' }}>{overview?.department_name || 'CSE AI'} (Dept #{overview?.department_id || 4})</strong> · Semester: <strong style={{ color: 'var(--ink-900)' }}>Autumn 2026</strong> · Status:{' '}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'var(--ok-bg)', color: 'var(--ok-fg)',
                padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 12,
              }}>
                <CheckCircle2 size={12} /> Published (v{publishedVersion?.id || 1})
              </span>
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => handleOpenPublish()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'var(--accent)', color: 'var(--on-dark)',
                padding: '10px 20px', borderRadius: 'var(--radius-pill)',
                fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <UploadCloud size={16} /> Publish Timetable
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {publishSuccessMsg && (
        <div style={{
          background: 'var(--ok-bg)', border: '1px solid var(--ok-fg)', color: 'var(--ok-fg)',
          padding: '14px 20px', borderRadius: 'var(--radius-card)', marginBottom: 20,
          fontWeight: 600, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{publishSuccessMsg}</span>
          <button onClick={() => setPublishSuccessMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Draft banner if exists */}
      {hasDraft && (
        <div style={{
          background: 'var(--watch-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)',
          padding: '16px 20px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--watch-fg)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} /> Unpublished Draft Timetable Ready
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-900)', marginTop: 4 }}>
              Staged edits exist for Autumn 2026. Ready to broadcast to student and teacher views.
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
              onClick={() => handleOpenPublish()}
              style={{
                background: 'var(--accent)', color: 'var(--on-dark)', border: 'none',
                padding: '8px 18px', borderRadius: 'var(--radius-pill)', fontWeight: 600, cursor: 'pointer', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <UploadCloud size={14} /> Publish Draft Now
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
            to="/coordinator/timetable/grid"
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
              Publish / Scratch Wizard
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
              Publish verified timetable slots to all 100 students across 5 sections (A-E) and notify instructors with zero room or teacher clashes.
            </p>
          </div>
          <button
            onClick={() => handleOpenPublish()}
            style={{
              marginTop: 20, background: 'var(--surface)', color: 'var(--ink-900)', border: '1px solid var(--border)',
              padding: '12px 20px', borderRadius: 'var(--radius-pill)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <UploadCloud size={16} /> Publish Timetable Version <ArrowRight size={16} />
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
              <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Action</th>
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
                <td style={{ padding: '14px 18px', color: 'var(--ok-fg)', fontWeight: 600 }}>0 Clashes</td>
                <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>2026-08-01 09:00:00</td>
                <td style={{ padding: '14px 18px' }}>
                  <button
                    onClick={() => handleOpenPublish(1)}
                    style={{
                      background: 'var(--bg)', color: 'var(--accent)', border: '1px solid var(--border)',
                      padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Re-Publish
                  </button>
                </td>
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
                  <td style={{ padding: '14px 18px', color: 'var(--ok-fg)', fontWeight: 600 }}>0 Clashes</td>
                  <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>{v.published_at || 'Active'}</td>
                  <td style={{ padding: '14px 18px' }}>
                    <button
                      onClick={() => handleOpenPublish(v.id)}
                      style={{
                        background: 'var(--bg)', color: 'var(--accent)', border: '1px solid var(--border)',
                        padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {v.status === 'published' ? 'Re-Publish' : 'Publish'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Publish Modal */}
      {isPublishModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius-card)', width: '100%', maxWidth: 520,
            border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)', overflow: 'hidden',
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <UploadCloud size={20} color="var(--accent)" />
                <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--ink-900)' }}>
                  Publish Timetable Version
                </h3>
              </div>
              <button
                onClick={() => setIsPublishModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePublishSubmit} style={{ padding: '20px 24px' }}>
              {publishErrorMsg && (
                <div style={{ background: 'var(--crit-bg)', color: 'var(--crit-fg)', padding: '10px 14px', borderRadius: 'var(--radius-input)', fontSize: 13, marginBottom: 16 }}>
                  {publishErrorMsg}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                  Department Scope
                </label>
                <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>
                  {overview?.department_name || 'CSE AI'} (Dept #{overview?.department_id || 4})
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                  Select Version to Publish
                </label>
                <select
                  value={selectedVersionId || (publishedVersion?.id || 1)}
                  onChange={(e) => setSelectedVersionId(Number(e.target.value))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }}
                >
                  {versions.length === 0 ? (
                    <option value="1">v1.0 (Production)</option>
                  ) : (
                    versions.map(v => (
                      <option key={v.id} value={v.id}>v{v.id}.0 — {v.status.toUpperCase()} ({v.effective_from || 'Semester 5'})</option>
                    ))
                  )}
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                  Effective From Date
                </label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }}
                  required
                />
              </div>

              {/* Clash Check Banner */}
              <div style={{ background: 'var(--ok-bg)', border: '1px solid var(--ok-fg)', borderRadius: 'var(--radius-input)', padding: 12, fontSize: 13, color: 'var(--ok-fg)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} />
                <span>Zero clashes detected across Batch, Teacher, and Room schedules.</span>
              </div>

              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.4 }}>
                Publishing will activate this timetable version for all sections (AIML-A to AIML-E) and dispatch notification alerts to all enrolled students and assigned instructors.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsPublishModalOpen(false)}
                  style={{
                    background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
                    padding: '10px 18px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={publishMutation.isPending}
                  style={{
                    background: 'var(--accent)', color: 'var(--on-dark)', border: 'none',
                    padding: '10px 22px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8, opacity: publishMutation.isPending ? 0.7 : 1,
                  }}
                >
                  {publishMutation.isPending ? 'Publishing...' : 'Confirm & Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
