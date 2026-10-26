import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar, Clock, Plus, Trash2, Edit2, AlertTriangle,
  CheckCircle2, ArrowLeft, Save, UploadCloud, RefreshCw, X
} from 'lucide-react';
import { timetableApi, coordinatorApi, courseApi, adminApi } from '../../api/endpoints.js';
import Button from '../../components/ui/Button.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

const DAYS = [
  { id: 0, name: 'Monday' },
  { id: 1, name: 'Tuesday' },
  { id: 2, name: 'Wednesday' },
  { id: 3, name: 'Thursday' },
  { id: 4, name: 'Friday' },
];

const PERIODS = [
  { id: 'P1', time: '09:00 - 10:00' },
  { id: 'P2', time: '10:00 - 11:00' },
  { id: 'P3', time: '11:15 - 12:15' },
  { id: 'P4', time: '12:15 - 13:15' },
  { id: 'P5', time: '14:00 - 15:00' },
  { id: 'P6', time: '15:00 - 16:00' },
];

export default function CoordinatorTimetableEditor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();

  const [selectedSection, setSelectedSection] = useState('all');
  const [editingSlot, setEditingSlot] = useState(null); // null or slot object
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);

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

  const { data: draftData, isLoading: loadingDraft, refetch: refetchDraft } = useQuery({
    queryKey: ['timetable-draft', deptId],
    queryFn: () => timetableApi.getDraft(deptId).then(r => r.data),
  });

  const { data: publishedSlots = [], isLoading: loadingSlots } = useQuery({
    queryKey: ['timetable-published-slots', deptId],
    queryFn: () => timetableApi.getSlots(draftData?.version_id).then(r => r.data || []),
    enabled: !!draftData,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['timetable-rooms'],
    queryFn: () => timetableApi.getRooms().then(r => r.data || []),
  });

  const { data: coursesList = [] } = useQuery({
    queryKey: ['courses-list-for-timetable'],
    queryFn: () => courseApi.list().then(r => r.data?.items || (Array.isArray(r.data) ? r.data : [])).catch(() => []),
  });

  const { data: teachersList = [] } = useQuery({
    queryKey: ['teachers-list-for-timetable'],
    queryFn: () => coordinatorApi.getTeachers().then(r => r.data?.items || (Array.isArray(r.data) ? r.data : [])).catch(() => []),
  });

  // Local working slots state (allows drafting in-memory before committing)
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    if (draftData?.slots && draftData.slots.length > 0) {
      setSlots(draftData.slots);
    } else if (publishedSlots && publishedSlots.length > 0) {
      setSlots(publishedSlots);
    }
  }, [draftData, publishedSlots]);

  // Mutations
  const saveDraftMutation = useMutation({
    mutationFn: (newSlots) => {
      const payload = newSlots.map(s => ({
        course_id: Number(s.course_id),
        teacher_id: Number(s.teacher_id),
        room_id: s.room_id ? Number(s.room_id) : null,
        day: Number(s.day),
        period_label: s.period_label,
        section: s.section || 'A',
        kind: s.kind || 'lecture',
      }));
      return timetableApi.saveDraft({
        version_id: draftData?.version_id || 1,
        slots: payload,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timetable-draft'] });
      qc.invalidateQueries({ queryKey: ['timetable-published-slots'] });
      setNotification({ type: 'success', message: '✓ Timetable draft changes saved successfully!' });
      setTimeout(() => setNotification(null), 5000);
    },
    onError: (err) => {
      setNotification({ type: 'error', message: err?.response?.data?.detail || 'Failed to save timetable draft.' });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => {
      return timetableApi.publish({
        version_id: draftData?.version_id || 1,
        effective_from: new Date().toISOString().slice(0, 10),
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['timetable-draft'] });
      qc.invalidateQueries({ queryKey: ['timetable-published-slots'] });
      qc.invalidateQueries({ queryKey: ['timetable-versions-list'] });
      setNotification({
        type: 'success',
        message: `✓ Timetable version published successfully! Students and teachers notified.`,
      });
      setTimeout(() => setNotification(null), 6000);
    },
    onError: (err) => {
      setNotification({ type: 'error', message: err?.response?.data?.detail?.message || 'Failed to publish timetable version.' });
    },
  });

  // Clash Detection
  const clashes = useMemo(() => {
    const list = [];
    const teacherMap = new Map();
    const roomMap = new Map();

    slots.forEach(s => {
      const keyT = `${s.day}-${s.period_label}-t${s.teacher_id}`;
      const keyR = s.room_id ? `${s.day}-${s.period_label}-r${s.room_id}` : null;

      if (teacherMap.has(keyT)) {
        list.push({
          type: 'teacher',
          message: `Teacher ${s.teacher_name || s.teacher_id} double-booked on Day ${DAYS[s.day]?.name || s.day} at ${s.period_label}.`,
          slotA: teacherMap.get(keyT),
          slotB: s,
        });
      } else {
        teacherMap.set(keyT, s);
      }

      if (keyR) {
        if (roomMap.has(keyR)) {
          list.push({
            type: 'room',
            message: `Room ${s.room_name || s.room_id} has overlapping classes on Day ${DAYS[s.day]?.name || s.day} at ${s.period_label}.`,
            slotA: roomMap.get(keyR),
            slotB: s,
          });
        } else {
          roomMap.set(keyR, s);
        }
      }
    });

    return list;
  }, [slots]);

  // Open modal to add slot in specific cell
  const handleAddSlot = (day = 0, period_label = 'P1') => {
    setEditingSlot(null);
    setSlotForm({
      course_id: coursesList[0]?.id || 1,
      teacher_id: teachersList[0]?.id || 2,
      room_id: rooms[0]?.id || 1,
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

  if (loadingDraft || loadingSlots) return <Skeleton lines={10} />;

  // Filter slots by selected section
  const visibleSlots = selectedSection === 'all'
    ? slots
    : slots.filter(s => (s.section || 'A').toUpperCase() === selectedSection.toUpperCase());

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
              Interactive Timetable Grid Editor
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
              {overview?.department_name || 'Computer Science & Engineering'} · Draft Version #{draftData?.version_id || 1}
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
              onClick={() => handleAddSlot(0, 'P1')}
            >
              <Plus size={14} style={{ marginRight: 4 }} /> Add Session
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
              style={{ background: 'var(--ok-fg)' }}
              onClick={() => publishMutation.mutate()}
              disabled={clashes.length > 0 || publishMutation.isPending}
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

      {/* Clash Alert Banner */}
      {clashes.length > 0 && (
        <div style={{
          background: 'var(--risk-bg)', border: '1px solid var(--risk-fg)', color: 'var(--risk-fg)',
          borderRadius: 'var(--radius-card)', padding: '14px 18px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14 }}>
            <AlertTriangle size={18} /> Schedule Clashes Detected ({clashes.length})
          </div>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 13 }}>
            {clashes.map((c, i) => (
              <li key={i}>{c.message}</li>
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
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 900 }}>
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
              {PERIODS.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  {/* Period label & time */}
                  <td style={{ padding: '16px', background: 'var(--bg)', borderRight: '1px solid var(--border)', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 14 }}>{p.id}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{p.time}</div>
                  </td>

                  {/* Day Columns */}
                  {DAYS.map(day => {
                    const cellSlots = visibleSlots.filter(s => s.day === day.id && s.period_label === p.id);
                    return (
                      <td
                        key={day.id}
                        style={{
                          padding: 8, verticalAlign: 'top', borderRight: '1px solid var(--border)',
                          minWidth: 160, background: cellSlots.length > 1 ? 'rgba(239,68,68,0.06)' : 'transparent',
                        }}
                      >
                        {cellSlots.map(slot => {
                          const isClashed = clashes.some(c => c.slotA?.id === slot.id || c.slotB?.id === slot.id);
                          return (
                            <div
                              key={slot.id}
                              style={{
                                padding: '10px 12px', borderRadius: 8, marginBottom: 6,
                                background: isClashed ? 'var(--risk-bg)' : 'var(--bg)',
                                border: isClashed ? '1px solid var(--risk-fg)' : '1px solid var(--border)',
                                boxShadow: 'var(--shadow-sm)', position: 'relative',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {slot.course_short_name && (
                                    <span style={{ fontSize: 10, fontWeight: 800, background: 'var(--accent)', color: '#fff', padding: '1px 6px', borderRadius: 4 }}>
                                      {slot.course_short_name}
                                    </span>
                                  )}
                                  <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--ink-900)' }}>
                                    {slot.course_code}
                                  </span>
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
                                  Sec {slot.section || 'A'}
                                </span>
                              </div>

                              <div style={{ fontSize: 11, color: 'var(--ink-900)', fontWeight: 600, margin: '2px 0' }}>
                                {slot.teacher_name || 'Faculty'}
                              </div>

                              <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                <span>{slot.room_name || 'Room 101'}</span>
                                <span style={{ textTransform: 'capitalize' }}>{slot.kind}</span>
                              </div>

                              {/* Slot action buttons */}
                              <div style={{ display: 'flex', gap: 6, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => handleEditSlot(slot)}
                                  title="Edit slot"
                                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 2, padding: 0 }}
                                >
                                  <Edit2 size={11} /> Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSlot(slot.id)}
                                  title="Delete slot"
                                  style={{ background: 'none', border: 'none', color: 'var(--risk-fg)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 2, padding: 0, marginLeft: 'auto' }}
                                >
                                  <Trash2 size={11} /> Delete
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {/* Quick Add button on cell */}
                        <button
                          type="button"
                          onClick={() => handleAddSlot(day.id, p.id)}
                          style={{
                            width: '100%', padding: '6px 8px', borderRadius: 6,
                            background: 'transparent', border: '1px dashed var(--border)',
                            color: 'var(--text-muted)', fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', transition: 'all 0.15s ease',
                          }}
                        >
                          + Add
                        </button>
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
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 24,
            maxWidth: 480, width: '100%', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--ink-900)' }}>
                {editingSlot ? 'Edit Class Session Slot' : 'Add New Class Session'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Course selection */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
                  Course *
                </label>
                <select
                  value={slotForm.course_id}
                  onChange={e => setSlotForm({ ...slotForm, course_id: e.target.value })}
                  required
                  style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                >
                  {coursesList.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.short_name ? `[${c.short_name}] ` : ''}{c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Teacher selection */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
                  Assigned Instructor *
                </label>
                <select
                  value={slotForm.teacher_id}
                  onChange={e => setSlotForm({ ...slotForm, teacher_id: e.target.value })}
                  required
                  style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                >
                  {teachersList.length > 0 ? (
                    teachersList.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.email})
                      </option>
                    ))
                  ) : (
                    <option value="2">Faculty User (faculty@acadflow.edu)</option>
                  )}
                </select>
              </div>

              {/* Room selection */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
                  Assigned Room / Lab *
                </label>
                <select
                  value={slotForm.room_id}
                  onChange={e => setSlotForm({ ...slotForm, room_id: e.target.value })}
                  required
                  style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                >
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.room_type}, cap {r.capacity})
                    </option>
                  ))}
                </select>
              </div>

              {/* Day & Period Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
                    Day *
                  </label>
                  <select
                    value={slotForm.day}
                    onChange={e => setSlotForm({ ...slotForm, day: Number(e.target.value) })}
                    style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                  >
                    {DAYS.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
                    Period *
                  </label>
                  <select
                    value={slotForm.period_label}
                    onChange={e => setSlotForm({ ...slotForm, period_label: e.target.value })}
                    style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                  >
                    {PERIODS.map(p => (
                      <option key={p.id} value={p.id}>{p.id} ({p.time})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Section & Kind */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
                    Section *
                  </label>
                  <select
                    value={slotForm.section}
                    onChange={e => setSlotForm({ ...slotForm, section: e.target.value })}
                    style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                  >
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
                    Session Type *
                  </label>
                  <select
                    value={slotForm.kind}
                    onChange={e => setSlotForm({ ...slotForm, kind: e.target.value })}
                    style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                  >
                    <option value="lecture">Lecture</option>
                    <option value="lab">Lab</option>
                    <option value="tutorial">Tutorial</option>
                  </select>
                </div>
              </div>

              {/* Form Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                >
                  {editingSlot ? 'Update Slot' : 'Add Slot to Draft'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
