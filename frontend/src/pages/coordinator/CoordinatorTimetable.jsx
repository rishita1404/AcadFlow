import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Edit3, Wand2, FileText, CheckCircle2, AlertTriangle, ArrowRight,
  UploadCloud, RotateCcw, Plus, Trash2, Edit2, DoorOpen, Users,
  Calendar, Check, AlertCircle, X, Eye
} from 'lucide-react';
import { timetableApi, coordinatorApi, courseApi } from '../../api/endpoints.js';
import Skeleton from '../../components/Skeleton.jsx';

export default function CoordinatorTimetable() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Tab: 'overview' or 'rooms'
  const [activeTab, setActiveTab] = useState('overview');

  // Modals state
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [publishWithConflicts, setPublishWithConflicts] = useState(false);
  const [publishSuccessMsg, setPublishSuccessMsg] = useState(null);
  const [publishErrorMsg, setPublishErrorMsg] = useState(null);

  // Scratch Wizard modal state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardScope, setWizardScope] = useState({
    semester_id: 1,
    batch: '2026',
    sections: 'A, B',
    name: 'New Semester Schedule',
  });
  const [wizardStructure, setWizardStructure] = useState({
    workingDays: '5', // 5 or 6
    startTime: '09:00',
    periodDuration: '50', // 50 or 60 min
    breaks: 'Lunch (13:00 - 14:00)',
    labLength: '2', // 2 periods
  });

  // Room modal state
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomForm, setRoomForm] = useState({ name: '', capacity: 60, room_type: 'classroom' });

  // Fetch department overview
  const { data: overview } = useQuery({
    queryKey: ['coordinator-overview'],
    queryFn: () => coordinatorApi.getOverview().then(r => r.data).catch(() => ({ department_id: 1, department_name: 'Computer Science & Engineering' })),
  });
  const deptId = overview?.department_id || 1;

  // Fetch timetable versions
  const { data: versions = [], isLoading: loadingVersions } = useQuery({
    queryKey: ['timetable-versions-list', deptId],
    queryFn: () => timetableApi.getVersions(deptId).then(r => r.data || []),
  });

  // Fetch rooms
  const { data: rooms = [], isLoading: loadingRooms } = useQuery({
    queryKey: ['timetable-rooms-list', deptId],
    queryFn: () => timetableApi.getRooms(deptId).then(r => r.data || []),
  });

  // Fetch pre-publish preview when modal is open
  const { data: publishPreviewData, isLoading: loadingPreview } = useQuery({
    queryKey: ['timetable-publish-preview', selectedVersionId],
    queryFn: () => timetableApi.publishPreview({ version_id: selectedVersionId }).then(r => r.data),
    enabled: isPublishModalOpen && !!selectedVersionId,
  });

  const publishedVersion = versions.find(v => v.status === 'published') || versions[0];
  const draftVersion = versions.find(v => v.status === 'draft');

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: (payload) => timetableApi.publish(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['timetable-versions-list'] });
      setIsPublishModalOpen(false);
      setPublishWithConflicts(false);
      setPublishSuccessMsg(
        `✓ Timetable version published successfully! ${res.data?.affected_students_count || 0} students and ${res.data?.affected_teachers_count || 0} faculty notified.`
      );
      setTimeout(() => setPublishSuccessMsg(null), 8000);
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail?.message || err?.response?.data?.detail || 'Failed to publish timetable version.';
      setPublishErrorMsg(msg);
      setTimeout(() => setPublishErrorMsg(null), 8000);
    },
  });

  // Restore version mutation
  const restoreMutation = useMutation({
    mutationFn: (versionId) => timetableApi.restoreVersion(versionId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['timetable-versions-list'] });
      setPublishSuccessMsg(`✓ Timetable restored as new active draft v${res.data?.new_version_id} (${res.data?.slots_copied} slots copied).`);
      setTimeout(() => setPublishSuccessMsg(null), 8000);
      navigate(`/coordinator/timetable/grid?version_id=${res.data?.new_version_id}`);
    },
  });

  // Room mutations
  const roomSaveMutation = useMutation({
    mutationFn: (payload) => {
      if (editingRoom) {
        return timetableApi.updateRoom(editingRoom.id, payload);
      }
      return timetableApi.createRoom({ ...payload, department_id: deptId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-rooms-list'] });
      setIsRoomModalOpen(false);
      setEditingRoom(null);
      setRoomForm({ name: '', capacity: 60, room_type: 'classroom' });
    },
  });

  const roomDeleteMutation = useMutation({
    mutationFn: (roomId) => timetableApi.deleteRoom(roomId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-rooms-list'] });
    },
  });

  // Scratch wizard creation mutation
  const createWizardMutation = useMutation({
    mutationFn: (payload) => timetableApi.createVersion(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['timetable-versions-list'] });
      setIsWizardOpen(false);
      navigate(`/coordinator/timetable/grid?version_id=${res.data?.id}`);
    },
  });

  const handleOpenPublish = (versionId = null) => {
    setSelectedVersionId(versionId || draftVersion?.id || publishedVersion?.id || null);
    setIsPublishModalOpen(true);
    setPublishWithConflicts(false);
    setPublishErrorMsg(null);
  };

  const handlePublishSubmit = (e) => {
    e.preventDefault();
    if (!selectedVersionId) return;
    publishMutation.mutate({
      version_id: selectedVersionId,
      effective_from: effectiveDate,
      publish_with_conflicts: publishWithConflicts,
    });
  };

  const handleCreateRoom = (e) => {
    e.preventDefault();
    roomSaveMutation.mutate({
      name: roomForm.name,
      capacity: Number(roomForm.capacity),
      room_type: roomForm.room_type,
    });
  };

  if (loadingVersions) {
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
      {/* Breadcrumb & Header */}
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
              Department: <strong style={{ color: 'var(--ink-900)' }}>{overview?.department_name || 'CSE'} (Dept #{deptId})</strong> · Active Published Schedule:{' '}
              {publishedVersion ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'var(--ok-bg)', color: 'var(--ok-fg)',
                  padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 12,
                }}>
                  <CheckCircle2 size={12} /> {publishedVersion.name || `v${publishedVersion.id}`} (Effective {publishedVersion.effective_from || 'Current'})
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No published schedule</span>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setActiveTab(activeTab === 'overview' ? 'rooms' : 'overview')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'var(--surface)', color: 'var(--ink-900)', border: '1px solid var(--border)',
                padding: '9px 16px', borderRadius: 'var(--radius-pill)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <DoorOpen size={15} /> {activeTab === 'overview' ? 'Manage Room Master' : 'Back to Timetables'}
            </button>
            <button
              onClick={() => handleOpenPublish(draftVersion?.id || publishedVersion?.id)}
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

      {/* Main Tab Content */}
      {activeTab === 'overview' ? (
        <>
          {/* Action Cards: Option 1 (Edit Current) & Option 2 (Create Scratch) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 32 }}>
            {/* Option 1: Edit Current Timetable */}
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
                  Option 1: Edit Current Timetable
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
                  Loads the currently published timetable into an editable draft. Move slots, adjust instructors or rooms, inspect live non-blocking clash warnings, and review changes vs published.
                </p>
                {draftVersion && (
                  <div style={{
                    marginTop: 12, padding: '8px 12px', background: 'var(--watch-bg)', borderRadius: 'var(--radius-sm)',
                    fontSize: 12, color: 'var(--watch-fg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6
                  }}>
                    <FileText size={14} /> Active draft exists: {draftVersion.name || `v${draftVersion.id}`}
                  </div>
                )}
              </div>
              <Link
                to={draftVersion ? `/coordinator/timetable/grid?version_id=${draftVersion.id}` : '/coordinator/timetable/grid'}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20,
                  background: 'var(--accent)', color: 'var(--on-dark)',
                  padding: '12px 20px', borderRadius: 'var(--radius-pill)', fontSize: 14, fontWeight: 600, textDecoration: 'none',
                }}
              >
                Open Timetable Grid Editor <ArrowRight size={16} />
              </Link>
            </div>

            {/* Option 2: Create New From Scratch */}
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
                  Option 2: Create New from Scratch (5-Step Wizard)
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
                  Launch step-by-step setup: specify department scope & sections, period timings & duration presets, grid quick-fill, clash inspection, and targeted broadcast publishing.
                </p>
              </div>
              <button
                onClick={() => { setIsWizardOpen(true); setWizardStep(1); }}
                style={{
                  marginTop: 20, background: 'var(--surface)', color: 'var(--ink-900)', border: '1px solid var(--border)',
                  padding: '12px 20px', borderRadius: 'var(--radius-pill)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Wand2 size={16} /> Start 5-Step Scratch Wizard <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* Version History Table */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
              Timetable Versions & Restore
            </h2>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Past attendance and class session records remain untouched during version restores.
            </span>
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Version</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Status</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Effective From</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Clashes</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Published At</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {versions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No timetable versions recorded. Create one using Option 1 or Option 2 above.
                    </td>
                  </tr>
                ) : (
                  versions.map(v => (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--ink-900)' }}>
                        {v.name || `Version ${v.id}`}
                        {v.restored_from_id && (
                          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                            (Restored from v{v.restored_from_id})
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: v.status === 'published' ? 'var(--ok-bg)' : v.status === 'draft' ? 'var(--watch-bg)' : 'var(--bg)',
                          color: v.status === 'published' ? 'var(--ok-fg)' : v.status === 'draft' ? 'var(--watch-fg)' : 'var(--text-muted)',
                          padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase',
                        }}>
                          {v.status === 'published' && <CheckCircle2 size={12} />}
                          {v.status === 'draft' && <FileText size={12} />}
                          {v.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', color: 'var(--text)' }}>
                        {v.effective_from || 'Immediate'}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {v.conflicts_count > 0 ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            background: 'var(--crit-bg)', color: 'var(--crit-fg)',
                            padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 11,
                          }}>
                            <AlertTriangle size={12} /> {v.conflicts_count} {v.conflicts_count === 1 ? 'Clash' : 'Clashes'}
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            background: 'var(--ok-bg)', color: 'var(--ok-fg)',
                            padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 11,
                          }}>
                            <Check size={12} /> 0 Clashes
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>
                        {v.published_at ? new Date(v.published_at).toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Link
                            to={`/coordinator/timetable/grid?version_id=${v.id}`}
                            style={{
                              background: 'var(--bg)', color: 'var(--ink-900)', border: '1px solid var(--border)',
                              padding: '5px 12px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, textDecoration: 'none',
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            <Eye size={12} /> Edit
                          </Link>
                          {v.status === 'draft' ? (
                            <button
                              onClick={() => handleOpenPublish(v.id)}
                              style={{
                                background: 'var(--accent)', color: 'var(--on-dark)', border: 'none',
                                padding: '5px 12px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                              }}
                            >
                              <UploadCloud size={12} /> Publish
                            </button>
                          ) : (
                            <button
                              onClick={() => restoreMutation.mutate(v.id)}
                              disabled={restoreMutation.isPending}
                              title="Clone this version into a new editable draft without altering past records"
                              style={{
                                background: 'var(--surface)', color: 'var(--ink-900)', border: '1px solid var(--border)',
                                padding: '5px 12px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                              }}
                            >
                              <RotateCcw size={12} /> Restore Draft
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Room Master Tab */
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
                Room Master Management
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                Manage physical classrooms, seminar halls, and laboratory venues assigned to {overview?.department_name || 'department'}.
              </p>
            </div>
            <button
              onClick={() => { setEditingRoom(null); setRoomForm({ name: '', capacity: 60, room_type: 'classroom' }); setIsRoomModalOpen(true); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'var(--accent)', color: 'var(--on-dark)',
                padding: '8px 16px', borderRadius: 'var(--radius-pill)',
                fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              }}
            >
              <Plus size={15} /> Add New Room
            </button>
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>Room Name / Number</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>Type</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>Seating Capacity</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>Scope</th>
                  <th style={{ padding: '12px 18px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--ink-900)' }}>{r.name}</td>
                    <td style={{ padding: '14px 18px', textTransform: 'capitalize' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 600,
                        background: r.room_type === 'lab' ? 'var(--watch-bg)' : 'var(--bg)',
                        color: r.room_type === 'lab' ? 'var(--watch-fg)' : 'var(--ink-900)',
                      }}>
                        {r.room_type}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text)' }}>{r.capacity ? `${r.capacity} seats` : 'Flexible'}</td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-muted)' }}>
                      {r.department_id ? `Dept #${r.department_id}` : 'Campus-wide'}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => { setEditingRoom(r); setRoomForm({ name: r.name, capacity: r.capacity || 60, room_type: r.room_type }); setIsRoomModalOpen(true); }}
                          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete room ${r.name}?`)) roomDeleteMutation.mutate(r.id); }}
                          style={{ background: 'none', border: 'none', color: 'var(--crit-fg)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Publish Dialog with Conflict Preview & Non-Blocking Confirmation */}
      {isPublishModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius-card)', width: '100%', maxWidth: 560,
            padding: 24, boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
                Publish Timetable Schedule
              </h3>
              <button onClick={() => setIsPublishModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            {loadingPreview ? (
              <div style={{ padding: '30px 0', textAlign: 'center' }}>
                <Skeleton variant="text" width={260} height={20} />
                <Skeleton variant="text" width={200} height={16} style={{ marginTop: 8 }} />
              </div>
            ) : (
              <form onSubmit={handlePublishSubmit}>
                {/* Pre-Publish Diff Summary */}
                <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 8 }}>
                    Audience Impact Preview
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                    <div style={{ flex: 1, background: 'var(--surface)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>AFFECTED STUDENTS</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', marginTop: 2 }}>
                        {publishPreviewData?.affected_students_count ?? 0}
                      </div>
                    </div>
                    <div style={{ flex: 1, background: 'var(--surface)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>AFFECTED FACULTY</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', marginTop: 2 }}>
                        {publishPreviewData?.affected_teachers_count ?? 0}
                      </div>
                    </div>
                  </div>

                  {publishPreviewData?.diff_summary && publishPreviewData.diff_summary.length > 0 ? (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                        SCHEDULE CHANGES VS PREVIOUS PUBLISHED:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--ink-900)', lineHeight: 1.6 }}>
                        {publishPreviewData.diff_summary.slice(0, 4).map((d, idx) => (
                          <li key={idx}>{d}</li>
                        ))}
                        {publishPreviewData.diff_summary.length > 4 && (
                          <li style={{ color: 'var(--text-muted)' }}>
                            ...and {publishPreviewData.diff_summary.length - 4} more change(s).
                          </li>
                        )}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      No slot changes detected compared to currently published schedule.
                    </div>
                  )}
                </div>

                {/* Conflict Warning & Confirmation */}
                {publishPreviewData?.clashes_count > 0 && (
                  <div style={{
                    background: 'var(--crit-bg)', border: '1px solid var(--crit-fg)', borderRadius: 'var(--radius-sm)',
                    padding: 14, marginBottom: 16,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--crit-fg)', fontWeight: 700, fontSize: 13 }}>
                      <AlertTriangle size={16} /> Non-Blocking Clashes Detected ({publishPreviewData.clashes_count})
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-900)', marginTop: 4, lineHeight: 1.4 }}>
                      This version has overlapping room or instructor bookings. Clashes do not prevent saving or publishing, but require explicit acknowledgement.
                    </div>

                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 8, marginTop: 12,
                      cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--crit-fg)'
                    }}>
                      <input
                        type="checkbox"
                        checked={publishWithConflicts}
                        onChange={(e) => setPublishWithConflicts(e.target.checked)}
                      />
                      I confirm: Publish with {publishPreviewData.clashes_count} conflict(s)
                    </label>
                  </div>
                )}

                {/* Effective Date */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 6 }}>
                    Effective From Date
                  </label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)', fontSize: 14, background: 'var(--surface)', color: 'var(--ink-900)',
                    }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Notifications will state when this new schedule takes effect.
                  </span>
                </div>

                {publishErrorMsg && (
                  <div style={{ color: 'var(--crit-fg)', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                    {publishErrorMsg}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setIsPublishModalOpen(false)}
                    style={{
                      padding: '10px 18px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)',
                      background: 'var(--surface)', color: 'var(--ink-900)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={publishMutation.isPending || (publishPreviewData?.clashes_count > 0 && !publishWithConflicts)}
                    style={{
                      padding: '10px 22px', borderRadius: 'var(--radius-pill)', border: 'none',
                      background: (publishPreviewData?.clashes_count > 0 && !publishWithConflicts) ? 'var(--border)' : 'var(--accent)',
                      color: (publishPreviewData?.clashes_count > 0 && !publishWithConflicts) ? 'var(--text-muted)' : 'var(--on-dark)',
                      fontSize: 13, fontWeight: 600, cursor: (publishPreviewData?.clashes_count > 0 && !publishWithConflicts) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {publishMutation.isPending ? 'Publishing...' : 'Confirm & Publish'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 5-Step Scratch Wizard Modal */}
      {isWizardOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius-card)', width: '100%', maxWidth: 640,
            padding: 28, boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Step {wizardStep} of 5
                </span>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600, color: 'var(--ink-900)', margin: '4px 0 0' }}>
                  {wizardStep === 1 && 'Step 1: Department & Scope'}
                  {wizardStep === 2 && 'Step 2: Period & Time Structure'}
                  {wizardStep === 3 && 'Step 3: Grid Initialization'}
                  {wizardStep === 4 && 'Step 4: Non-Blocking Clash Review'}
                  {wizardStep === 5 && 'Step 5: Staging & Completion'}
                </h3>
              </div>
              <button onClick={() => setIsWizardOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            {/* Step 1: Scope */}
            {wizardStep === 1 && (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Configure academic period and target cohort sections for this schedule.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Schedule Name</label>
                    <input
                      type="text"
                      value={wizardScope.name}
                      onChange={(e) => setWizardScope({ ...wizardScope, name: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Semester ID</label>
                    <input
                      type="number"
                      value={wizardScope.semester_id}
                      onChange={(e) => setWizardScope({ ...wizardScope, semester_id: Number(e.target.value) })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Sections</label>
                  <input
                    type="text"
                    value={wizardScope.sections}
                    onChange={(e) => setWizardScope({ ...wizardScope, sections: e.target.value })}
                    placeholder="e.g. A, B, C"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sections that will have classes scheduled in this draft.</span>
                </div>
              </div>
            )}

            {/* Step 2: Time Structure */}
            {wizardStep === 2 && (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Select daily working schedule and duration presets.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Working Days</label>
                    <select
                      value={wizardStructure.workingDays}
                      onChange={(e) => setWizardStructure({ ...wizardStructure, workingDays: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
                    >
                      <option value="5">Monday – Friday (5 Days)</option>
                      <option value="6">Monday – Saturday (6 Days)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Period Length Preset</label>
                    <select
                      value={wizardStructure.periodDuration}
                      onChange={(e) => setWizardStructure({ ...wizardStructure, periodDuration: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
                    >
                      <option value="50">50-minute periods (Standard)</option>
                      <option value="60">60-minute periods</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Day Start Time</label>
                    <input
                      type="text"
                      value={wizardStructure.startTime}
                      onChange={(e) => setWizardStructure({ ...wizardStructure, startTime: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Lab Length (Periods)</label>
                    <select
                      value={wizardStructure.labLength}
                      onChange={(e) => setWizardStructure({ ...wizardStructure, labLength: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
                    >
                      <option value="2">2 Periods (100–120 mins)</option>
                      <option value="3">3 Periods (150–180 mins)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Grid Initialization */}
            {wizardStep === 3 && (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Choose how to initialize the blank grid before manual editing.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  <label style={{
                    padding: 14, borderRadius: 'var(--radius-card)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: 'var(--surface)'
                  }}>
                    <input type="radio" name="init_mode" defaultChecked />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-900)' }}>Initialize empty timetable grid</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Start with empty slots across Monday–Friday (P1 to P6).</div>
                    </div>
                  </label>
                  <label style={{
                    padding: 14, borderRadius: 'var(--radius-card)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: 'var(--surface)'
                  }}>
                    <input type="radio" name="init_mode" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-900)' }}>Copy from previous published schedule</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Prefill courses and rooms from {publishedVersion?.name || 'v1'}.</div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Step 4: Clash Policy Review */}
            {wizardStep === 4 && (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Review clash policy & non-blocking tolerance settings.
                </p>
                <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={15} color="var(--watch-fg)" /> Non-Blocking Clash Tolerance (Warn Never Block)
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--ink-900)', lineHeight: 1.6 }}>
                    <li><strong>Teacher Clashes:</strong> Warns when instructor is assigned multiple simultaneous slots.</li>
                    <li><strong>Room Clashes:</strong> Warns when venue is double-booked for the same time window.</li>
                    <li><strong>Section Clashes:</strong> Warns when the same cohort has overlapping courses.</li>
                    <li><strong>Back-to-back classes:</strong> Permitted with 0 warnings.</li>
                    <li>Saving drafts always succeeds. Publishing requires explicit conflict confirmation.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Step 5: Finish & Launch Grid */}
            {wizardStep === 5 && (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Everything is ready. Create draft and proceed to the interactive grid editor.
                </p>
                <div style={{ background: 'var(--ok-bg)', border: '1px solid var(--ok-fg)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 20, color: 'var(--ok-fg)' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={16} /> Configuration Complete
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    New draft <strong>"{wizardScope.name}"</strong> will be created for Semester {wizardScope.semester_id}.
                  </div>
                </div>
              </div>
            )}

            {/* Wizard Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep(wizardStep - 1)}
                  style={{
                    padding: '8px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--ink-900)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Back
                </button>
              ) : <div />}

              {wizardStep < 5 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep(wizardStep + 1)}
                  style={{
                    padding: '8px 20px', borderRadius: 'var(--radius-pill)', border: 'none',
                    background: 'var(--accent)', color: 'var(--on-dark)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => createWizardMutation.mutate({
                    department_id: deptId,
                    semester_id: wizardScope.semester_id,
                    name: wizardScope.name,
                  })}
                  disabled={createWizardMutation.isPending}
                  style={{
                    padding: '8px 22px', borderRadius: 'var(--radius-pill)', border: 'none',
                    background: 'var(--accent)', color: 'var(--on-dark)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {createWizardMutation.isPending ? 'Creating Draft...' : 'Open in Grid Editor'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Room Modal */}
      {isRoomModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius-card)', width: '100%', maxWidth: 440,
            padding: 24, boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
                {editingRoom ? 'Edit Room' : 'Add New Room'}
              </h3>
              <button onClick={() => setIsRoomModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateRoom}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Room Name / Label</label>
                <input
                  type="text"
                  required
                  value={roomForm.name}
                  onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                  placeholder="e.g. Hall B-204 or Lab 3"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Room Type</label>
                <select
                  value={roomForm.room_type}
                  onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
                >
                  <option value="classroom">Classroom (Lecture)</option>
                  <option value="lab">Computer / Hardware Lab</option>
                  <option value="seminar">Seminar / Auditorium</option>
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Seating Capacity</label>
                <input
                  type="number"
                  value={roomForm.capacity}
                  onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsRoomModalOpen(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--ink-900)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={roomSaveMutation.isPending}
                  style={{
                    padding: '8px 18px', borderRadius: 'var(--radius-pill)', border: 'none',
                    background: 'var(--accent)', color: 'var(--on-dark)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {roomSaveMutation.isPending ? 'Saving...' : 'Save Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
