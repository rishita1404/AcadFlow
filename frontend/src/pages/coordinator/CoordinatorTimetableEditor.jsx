import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar, Clock, Plus, Trash2, Edit2, AlertTriangle,
  CheckCircle2, ArrowLeft, Save, UploadCloud, RefreshCw, X,
  Copy, Eye, ChevronRight, CornerDownRight, Check
} from 'lucide-react';
import { timetableApi, coordinatorApi, courseApi } from '../../api/endpoints.js';
import Button from '../../components/ui/Button.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

const DAYS = [
  { id: 0, name: 'Monday' },
  { id: 1, name: 'Tuesday' },
  { id: 2, name: 'Wednesday' },
  { id: 3, name: 'Thursday' },
  { id: 4, name: 'Friday' },
  { id: 5, name: 'Saturday' },
];

const DEFAULT_PERIODS = [
  { id: 'P1', time: '09:00 - 10:00', start: '09:00', end: '10:00' },
  { id: 'P2', time: '10:00 - 11:00', start: '10:00', end: '11:00' },
  { id: 'P3', time: '11:15 - 12:15', start: '11:15', end: '12:15' },
  { id: 'P4', time: '12:15 - 13:15', start: '12:15', end: '13:15' },
  { id: 'P5', time: '14:00 - 15:00', start: '14:00', end: '15:00' },
  { id: 'P6', time: '15:00 - 16:00', start: '15:00', end: '16:00' },
];

export default function CoordinatorTimetableEditor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();

  const queryVersionId = searchParams.get('version_id');

  const [selectedSection, setSelectedSection] = useState('all');
  const [editingSlot, setEditingSlot] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishWithConflicts, setPublishWithConflicts] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [notification, setNotification] = useState(null);
  const [highlightedCell, setHighlightedCell] = useState(null); // { day, period_label }

  // Copy Day State
  const [isCopyDayModalOpen, setIsCopyDayModalOpen] = useState(false);
  const [copySourceDay, setCopySourceDay] = useState(0);
  const [copyTargetDay, setCopyTargetDay] = useState(1);

  // Form state for slot Add / Edit
  const [slotForm, setSlotForm] = useState({
    course_id: '',
    teacher_id: '',
    room_id: '',
    day: 0,
    period_label: 'P1',
    section: 'A',
    kind: 'lecture',
  });

  // Queries
  const { data: overview } = useQuery({
    queryKey: ['coordinator-overview'],
    queryFn: () => coordinatorApi.getOverview().then(r => r.data).catch(() => ({ department_id: 1, department_name: 'CSE' })),
  });
  const deptId = overview?.department_id || 1;

  // Fetch draft (or specific version details if version_id is provided)
  const { data: versionData, isLoading: loadingVersion, refetch: refetchVersion } = useQuery({
    queryKey: ['timetable-version-or-draft', deptId, queryVersionId],
    queryFn: async () => {
      if (queryVersionId) {
        const res = await timetableApi.getVersionDetails(queryVersionId);
        return {
          version_id: res.data?.version?.id,
          slots: res.data?.slots || [],
          periods: res.data?.periods || [],
          clashes: res.data?.clashes || [],
          status: res.data?.version?.status,
          name: res.data?.version?.name,
          changes_vs_published: [],
        };
      }
      const res = await timetableApi.getDraft(deptId);
      return res.data;
    },
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['timetable-rooms', deptId],
    queryFn: () => timetableApi.getRooms(deptId).then(r => r.data || []),
  });

  const { data: coursesList = [] } = useQuery({
    queryKey: ['courses-list-for-timetable'],
    queryFn: () => courseApi.list().then(r => r.data?.items || (Array.isArray(r.data) ? r.data : [])).catch(() => []),
  });

  const { data: teachersList = [] } = useQuery({
    queryKey: ['teachers-list-for-timetable'],
    queryFn: () => coordinatorApi.getTeachers().then(r => r.data?.items || (Array.isArray(r.data) ? r.data : [])).catch(() => []),
  });

  // Local working slots state
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    if (versionData?.slots) {
      setSlots(versionData.slots);
    }
  }, [versionData]);

  // Live client-side clash detection (synchronized with backend logic)
  const clashes = useMemo(() => {
    const list = [];
    const teacherMap = new Map();
    const roomMap = new Map();
    const sectionMap = new Map();

    slots.forEach(s => {
      const keyT = `${s.day}-${s.period_label}-t${s.teacher_id}`;
      const keyR = s.room_id ? `${s.day}-${s.period_label}-r${s.room_id}` : null;
      const keyS = `${s.day}-${s.period_label}-s${s.section || 'A'}`;

      if (teacherMap.has(keyT)) {
        const prev = teacherMap.get(keyT);
        list.push({
          type: 'teacher',
          day: s.day,
          period_label: s.period_label,
          message: `Clash: Faculty ${s.teacher_name || 'Instructor'} double-booked for ${prev.course_code || 'Course'} and ${s.course_code || 'Course'} on ${DAYS[s.day]?.name || 'Day'} ${s.period_label}.`,
          slotA: prev,
          slotB: s,
        });
      } else {
        teacherMap.set(keyT, s);
      }

      if (keyR) {
        if (roomMap.has(keyR)) {
          const prev = roomMap.get(keyR);
          list.push({
            type: 'room',
            day: s.day,
            period_label: s.period_label,
            message: `Clash: Venue ${s.room_name || 'Room'} double-booked on ${DAYS[s.day]?.name || 'Day'} ${s.period_label}.`,
            slotA: prev,
            slotB: s,
          });
        } else {
          roomMap.set(keyR, s);
        }
      }

      if (sectionMap.has(keyS)) {
        const prev = sectionMap.get(keyS);
        if (prev.course_id !== s.course_id) {
          list.push({
            type: 'section',
            day: s.day,
            period_label: s.period_label,
            message: `Clash: Section ${s.section || 'A'} has simultaneous classes (${prev.course_code} & ${s.course_code}) on ${DAYS[s.day]?.name || 'Day'} ${s.period_label}.`,
            slotA: prev,
            slotB: s,
          });
        }
      } else {
        sectionMap.set(keyS, s);
      }
    });

    return list;
  }, [slots]);

  // Set of slot IDs involved in clashes
  const clashSlotIds = useMemo(() => {
    const ids = new Set();
    clashes.forEach(c => {
      if (c.slotA?.id) ids.add(c.slotA.id);
      if (c.slotB?.id) ids.add(c.slotB.id);
    });
    return ids;
  }, [clashes]);

  // Pre-publish preview query
  const targetVersionId = versionData?.version_id || 1;
  const { data: publishPreviewData, isLoading: loadingPreview } = useQuery({
    queryKey: ['timetable-publish-preview', targetVersionId],
    queryFn: () => timetableApi.publishPreview({ version_id: targetVersionId }).then(r => r.data),
    enabled: isPublishModalOpen && !!targetVersionId,
  });

  // Save Draft Mutation (Warn, never block)
  const saveDraftMutation = useMutation({
    mutationFn: (newSlots) => {
      const payload = newSlots.map(s => ({
        course_id: Number(s.course_id),
        teacher_id: Number(s.teacher_id),
        room_id: s.room_id ? Number(s.room_id) : null,
        day: Number(s.day),
        period_label: s.period_label,
        start_time: s.start_time || null,
        end_time: s.end_time || null,
        section: s.section || 'A',
        kind: s.kind || 'lecture',
      }));
      return timetableApi.saveDraft({
        version_id: targetVersionId,
        slots: payload,
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['timetable-version-or-draft'] });
      qc.invalidateQueries({ queryKey: ['timetable-versions-list'] });
      const clashMsg = res.data?.clashes_count > 0 ? ` (${res.data.clashes_count} non-blocking clashes saved)` : '';
      setNotification({
        type: 'success',
        message: `✓ Timetable draft saved successfully!${clashMsg}`,
      });
      setTimeout(() => setNotification(null), 5000);
    },
    onError: (err) => {
      setNotification({ type: 'error', message: err?.response?.data?.detail || 'Failed to save timetable draft.' });
    },
  });

  // Publish Mutation (Allows publishing with conflicts when confirmed)
  const publishMutation = useMutation({
    mutationFn: () => {
      return timetableApi.publish({
        version_id: targetVersionId,
        effective_from: effectiveDate,
        publish_with_conflicts: publishWithConflicts,
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['timetable-version-or-draft'] });
      qc.invalidateQueries({ queryKey: ['timetable-versions-list'] });
      setIsPublishModalOpen(false);
      setPublishWithConflicts(false);
      setNotification({
        type: 'success',
        message: `✓ Timetable published successfully! ${res.data?.affected_students_count || 0} students and ${res.data?.affected_teachers_count || 0} teachers notified.`,
      });
      setTimeout(() => setNotification(null), 7000);
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail?.message || err?.response?.data?.detail || 'Failed to publish timetable version.';
      setNotification({ type: 'error', message: msg });
    },
  });

  // Copy Day Mutation
  const copyDayMutation = useMutation({
    mutationFn: () => timetableApi.copyDay({
      version_id: targetVersionId,
      source_day: copySourceDay,
      target_day: copyTargetDay,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['timetable-version-or-draft'] });
      setIsCopyDayModalOpen(false);
      setNotification({
        type: 'success',
        message: `✓ Copied ${res.data?.created_count || 0} slots from ${DAYS[copySourceDay].name} to ${DAYS[copyTargetDay].name}.`,
      });
      setTimeout(() => setNotification(null), 5000);
    },
  });

  // Jump to conflicting cell
  const handleJumpToCell = (day, period_label) => {
    setHighlightedCell({ day, period_label });
    const cellEl = document.getElementById(`cell-${day}-${period_label}`);
    if (cellEl) {
      cellEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => setHighlightedCell(null), 3000);
  };

  // Open modal to add slot in specific cell
  const handleAddSlot = (day = 0, period_label = 'P1') => {
    setEditingSlot(null);
    setSlotForm({
      course_id: coursesList[0]?.id || 1,
      teacher_id: teachersList[0]?.id || 2,
      room_id: rooms[0]?.id || '',
      day: day,
      period_label: period_label,
      section: selectedSection !== 'all' ? selectedSection : 'A',
      kind: 'lecture',
    });
    setIsModalOpen(true);
  };

  // Open modal to edit existing slot
  const handleEditSlot = (slot) => {
    setEditingSlot(slot);
    setSlotForm({
      course_id: slot.course_id,
      teacher_id: slot.teacher_id,
      room_id: slot.room_id || '',
      day: slot.day,
      period_label: slot.period_label,
      section: slot.section || 'A',
      kind: slot.kind || 'lecture',
    });
    setIsModalOpen(true);
  };

  // Delete a slot
  const handleDeleteSlot = (slotId) => {
    const next = slots.filter(s => s.id !== slotId);
    setSlots(next);
    saveDraftMutation.mutate(next);
  };

  // Submit Add or Edit Form
  const handleFormSubmit = (e) => {
    e.preventDefault();
    const courseObj = coursesList.find(c => c.id === Number(slotForm.course_id));
    const teacherObj = teachersList.find(t => t.id === Number(slotForm.teacher_id));
    const roomObj = rooms.find(r => r.id === Number(slotForm.room_id));

    const updated = {
      id: editingSlot ? editingSlot.id : Date.now(),
      course_id: Number(slotForm.course_id),
      course_code: courseObj?.code || '',
      course_name: courseObj?.name || '',
      course_short_name: courseObj?.short_name || '',
      teacher_id: Number(slotForm.teacher_id),
      teacher_name: teacherObj?.name || 'Faculty',
      room_id: slotForm.room_id ? Number(slotForm.room_id) : null,
      room_name: roomObj?.name || 'Room 101',
      day: Number(slotForm.day),
      day_name: DAYS[slotForm.day]?.name || 'Monday',
      period_label: slotForm.period_label,
      section: slotForm.section,
      kind: slotForm.kind,
    };

    let nextSlots;
    if (editingSlot) {
      nextSlots = slots.map(s => s.id === editingSlot.id ? updated : s);
    } else {
      nextSlots = [...slots, updated];
    }

    setSlots(nextSlots);
    setIsModalOpen(false);
    saveDraftMutation.mutate(nextSlots);
  };

  if (loadingVersion) return <Skeleton lines={10} />;

  // Filter slots by selected section
  const visibleSlots = selectedSection === 'all'
    ? slots
    : slots.filter(s => (s.section || 'A').toUpperCase() === selectedSection.toUpperCase());

  // Count empty slots across Monday–Friday and P1–P6
  let emptySlotsCount = 0;
  DAYS.slice(0, 5).forEach(d => {
    DEFAULT_PERIODS.forEach(p => {
      const hasSlot = visibleSlots.some(s => s.day === d.id && s.period_label === p.id);
      if (!hasSlot) emptySlotsCount++;
    });
  });

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 48, color: 'var(--text)' }}>
      {/* Top Breadcrumb & Controls Header */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '20px 24px',
        border: '1px solid var(--border)', marginBottom: 20, boxShadow: 'var(--shadow-card)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Link to="/coordinator/timetable" style={{ color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}>
                <ArrowLeft size={14} /> Back to Timetable Manager
              </Link>
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
              Visual Timetable Grid Editor
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
              {overview?.department_name || 'Computer Science & Engineering'} · Draft #{targetVersionId} ({versionData?.name || 'Academic Schedule'}) · Empty Slots: <strong>{emptySlotsCount}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Section Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Section:</span>
              {['all', 'A', 'B', 'C'].map(sec => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setSelectedSection(sec)}
                  style={{
                    padding: '5px 12px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 700,
                    border: selectedSection === sec ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: selectedSection === sec ? 'var(--accent)' : 'var(--bg)',
                    color: selectedSection === sec ? '#fff' : 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  {sec === 'all' ? 'All Sections' : `Sec ${sec}`}
                </button>
              ))}
            </div>

            <Button
              variant="secondary"
              onClick={() => setIsCopyDayModalOpen(true)}
              title="Duplicate schedule from one day to another"
            >
              <Copy size={14} style={{ marginRight: 4 }} /> Copy Day
            </Button>

            <Button
              variant="secondary"
              onClick={() => handleAddSlot(0, 'P1')}
            >
              <Plus size={14} style={{ marginRight: 4 }} /> Add Class
            </Button>

            <Button
              variant="primary"
              onClick={() => saveDraftMutation.mutate(slots)}
              disabled={saveDraftMutation.isPending}
            >
              <Save size={14} style={{ marginRight: 4 }} />
              {saveDraftMutation.isPending ? 'Saving...' : 'Save Draft'}
            </Button>

            <Button
              variant="primary"
              style={{ background: 'var(--accent)', color: 'var(--on-dark)' }}
              onClick={() => setIsPublishModalOpen(true)}
            >
              <UploadCloud size={14} style={{ marginRight: 4 }} />
              Publish Live
            </Button>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div style={{
          padding: '12px 20px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600,
          background: notification.type === 'success' ? 'var(--ok-bg)' : 'var(--risk-bg)',
          color: notification.type === 'success' ? 'var(--ok-fg)' : 'var(--risk-fg)',
          border: `1px solid ${notification.type === 'success' ? 'var(--ok-fg)' : 'var(--risk-fg)'}`,
        }}>
          {notification.message}
        </div>
      )}

      {/* Non-Blocking Clashes Advisory Panel */}
      {clashes.length > 0 && (
        <div style={{
          background: 'var(--crit-bg)', border: '1px solid var(--crit-fg)', color: 'var(--crit-fg)',
          borderRadius: 'var(--radius-card)', padding: '16px 20px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
              <AlertTriangle size={18} /> Schedule Clashes ({clashes.length}) — Non-Blocking Advisory
            </div>
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-900)' }}>
              Warn never block: Draft saves and publishing are permitted.
            </span>
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {clashes.map((c, i) => (
              <div key={i} style={{
                background: 'var(--surface)', padding: '8px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span style={{ fontSize: 13, color: 'var(--ink-900)' }}>{c.message}</span>
                <button
                  type="button"
                  onClick={() => handleJumpToCell(c.day, c.period_label)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  Jump to cell <ChevronRight size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Changes vs Published Diff Panel */}
      {versionData?.changes_vs_published && versionData.changes_vs_published.length > 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)',
          padding: '16px 20px', marginBottom: 20, boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={16} color="var(--accent)" /> Changes vs Published Timetable ({versionData.changes_vs_published.length})
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: 'var(--ink-900)', lineHeight: 1.6 }}>
            {versionData.changes_vs_published.map((diff, idx) => (
              <li key={idx}>{diff}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Weekly Grid */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)',
        overflow: 'hidden', boxShadow: 'var(--shadow-card)',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 960 }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '14px 16px', width: 140, fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Period / Time
                </th>
                {DAYS.map(d => (
                  <th key={d.id} style={{ padding: '14px 16px', fontWeight: 700, fontSize: 13, color: 'var(--ink-900)' }}>
                    {d.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEFAULT_PERIODS.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  {/* Period label & time */}
                  <td style={{ padding: '16px', background: 'var(--bg)', borderRight: '1px solid var(--border)', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 14 }}>{p.id}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.time}</div>
                  </td>

                  {/* Day Columns */}
                  {DAYS.map(day => {
                    const cellSlots = visibleSlots.filter(s => s.day === day.id && s.period_label === p.id);
                    const isHighlighted = highlightedCell?.day === day.id && highlightedCell?.period_label === p.id;
                    const hasClash = cellSlots.some(s => clashSlotIds.has(s.id));

                    return (
                      <td
                        key={day.id}
                        id={`cell-${day.id}-${p.id}`}
                        style={{
                          padding: 8, verticalAlign: 'top', borderRight: '1px solid var(--border)',
                          minWidth: 160,
                          background: isHighlighted ? 'rgba(59,130,246,0.15)' : hasClash ? 'rgba(239,68,68,0.06)' : 'transparent',
                          transition: 'background 0.3s ease',
                        }}
                      >
                        {/* Slot cards in this cell */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {cellSlots.map(s => {
                            const isSlotClashed = clashSlotIds.has(s.id);
                            return (
                              <div
                                key={s.id}
                                style={{
                                  background: 'var(--surface)',
                                  border: isSlotClashed ? '1px solid var(--crit-fg)' : '1px solid var(--border)',
                                  borderLeft: isSlotClashed ? '4px solid var(--crit-fg)' : '3px solid var(--accent)',
                                  borderRadius: 'var(--radius-sm)',
                                  padding: '8px 10px',
                                  fontSize: 12,
                                  boxShadow: 'var(--shadow-sm)',
                                  position: 'relative',
                                }}
                              >
                                {isSlotClashed && (
                                  <div style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    color: 'var(--crit-fg)', fontWeight: 700, fontSize: 10, marginBottom: 4,
                                  }}>
                                    <AlertTriangle size={12} /> Clash Detected
                                  </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <span style={{ fontWeight: 700, color: 'var(--ink-900)' }}>
                                    {s.course_code || 'Course'}
                                  </span>
                                  <span style={{
                                    fontSize: 10, fontWeight: 700, padding: '1px 5px',
                                    borderRadius: 'var(--radius-pill)', background: 'var(--bg)', color: 'var(--text-muted)',
                                  }}>
                                    Sec {s.section || 'A'}
                                  </span>
                                </div>

                                <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 2 }}>
                                  {s.teacher_name || 'Faculty'}
                                </div>

                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
                                  <span>{s.room_name || 'Room 101'}</span>
                                  <span style={{ textTransform: 'capitalize' }}>{s.kind || 'lecture'}</span>
                                </div>

                                <div style={{ display: 'flex', gap: 8, marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
                                  <button
                                    type="button"
                                    onClick={() => handleEditSlot(s)}
                                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: 0 }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSlot(s.id)}
                                    style={{ background: 'none', border: 'none', color: 'var(--crit-fg)', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: 0 }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                          {/* Empty cell + button */}
                          <button
                            type="button"
                            onClick={() => handleAddSlot(day.id, p.id)}
                            style={{
                              border: '1px dashed var(--border)', background: 'none', borderRadius: 'var(--radius-sm)',
                              padding: '6px', width: '100%', cursor: 'pointer', color: 'var(--text-muted)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, fontWeight: 600,
                            }}
                          >
                            <Plus size={12} /> Add
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Slot Modal */}
      {isModalOpen && (
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
                {editingSlot ? 'Edit Timetable Slot' : 'Add Class Session'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Course</label>
                <select
                  value={slotForm.course_id}
                  onChange={(e) => setSlotForm({ ...slotForm, course_id: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
                >
                  {coursesList.map(c => (
                    <option key={c.id} value={c.id}>{c.code} – {c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Instructor</label>
                <select
                  value={slotForm.teacher_id}
                  onChange={(e) => setSlotForm({ ...slotForm, teacher_id: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
                >
                  {teachersList.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Room / Lab</label>
                  <select
                    value={slotForm.room_id}
                    onChange={(e) => setSlotForm({ ...slotForm, room_id: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
                  >
                    <option value="">No Room Assigned</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.room_type})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Section</label>
                  <select
                    value={slotForm.section}
                    onChange={(e) => setSlotForm({ ...slotForm, section: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
                  >
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Day</label>
                  <select
                    value={slotForm.day}
                    onChange={(e) => setSlotForm({ ...slotForm, day: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
                  >
                    {DAYS.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Period</label>
                  <select
                    value={slotForm.period_label}
                    onChange={(e) => setSlotForm({ ...slotForm, period_label: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
                  >
                    {DEFAULT_PERIODS.map(p => (
                      <option key={p.id} value={p.id}>{p.id} ({p.time})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--ink-900)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px', borderRadius: 'var(--radius-pill)', border: 'none',
                    background: 'var(--accent)', color: 'var(--on-dark)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {editingSlot ? 'Update Slot' : 'Add Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Copy Day Modal */}
      {isCopyDayModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius-card)', width: '100%', maxWidth: 400,
            padding: 24, boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)',
          }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink-900)', margin: '0 0 12px' }}>
              Copy Schedule Across Days
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Copy all sessions from one day to another to quickly populate repeating timetables.
            </p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Source Day</label>
              <select
                value={copySourceDay}
                onChange={(e) => setCopySourceDay(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
              >
                {DAYS.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Target Day (Overwritten)</label>
              <select
                value={copyTargetDay}
                onChange={(e) => setCopyTargetDay(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13 }}
              >
                {DAYS.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setIsCopyDayModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => copyDayMutation.mutate()}
                disabled={copyDayMutation.isPending || copySourceDay === copyTargetDay}
                style={{
                  padding: '8px 18px', borderRadius: 'var(--radius-pill)', border: 'none',
                  background: 'var(--accent)', color: 'var(--on-dark)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {copyDayMutation.isPending ? 'Copying...' : 'Copy Slots'}
              </button>
            </div>
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
            background: 'var(--surface)', borderRadius: 'var(--radius-card)', width: '100%', maxWidth: 540,
            padding: 24, boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
                Publish Timetable Version
              </h3>
              <button onClick={() => setIsPublishModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            {loadingPreview ? (
              <div style={{ padding: '30px 0', textAlign: 'center' }}>
                <Skeleton variant="text" width={260} height={20} />
              </div>
            ) : (
              <div>
                {/* Audience Impact Preview */}
                <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
                    <div style={{ flex: 1, background: 'var(--surface)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>STUDENTS NOTIFIED</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', marginTop: 2 }}>
                        {publishPreviewData?.affected_students_count ?? 0}
                      </div>
                    </div>
                    <div style={{ flex: 1, background: 'var(--surface)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>FACULTY NOTIFIED</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', marginTop: 2 }}>
                        {publishPreviewData?.affected_teachers_count ?? 0}
                      </div>
                    </div>
                  </div>

                  {publishPreviewData?.diff_summary && publishPreviewData.diff_summary.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--ink-900)', lineHeight: 1.5 }}>
                      {publishPreviewData.diff_summary.slice(0, 3).map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Conflict Confirmation Checkbox if Clashes Exist */}
                {publishPreviewData?.clashes_count > 0 && (
                  <div style={{
                    background: 'var(--crit-bg)', border: '1px solid var(--crit-fg)', borderRadius: 'var(--radius-sm)',
                    padding: 14, marginBottom: 16,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--crit-fg)', fontWeight: 700, fontSize: 13 }}>
                      <AlertTriangle size={16} /> Non-Blocking Clashes Detected ({publishPreviewData.clashes_count})
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-900)', marginTop: 4, lineHeight: 1.4 }}>
                      Clashes do not block publication, but require your explicit confirmation to proceed.
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

                {/* Effective Date Picker */}
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
                </div>

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
                    type="button"
                    onClick={() => publishMutation.mutate()}
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
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
