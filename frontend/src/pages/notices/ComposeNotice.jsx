import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Send, Users, Clock, AlertTriangle, Link as LinkIcon, ArrowRight,
  ArrowLeft, Trash2, Plus, Bookmark, CheckCircle2, X, AlertCircle, FileText
} from 'lucide-react';
import { noticeApi, facultyApi } from '../../api/endpoints.js';
import { useAuth } from '../../app/AuthContext.jsx';

const STEPS = [
  { num: 1, title: 'Message' },
  { num: 2, title: 'Audience' },
  { num: 3, title: 'Review and Send' },
];

const CATEGORIES = [
  { id: 'form', label: 'Form' },
  { id: 'hackathon', label: 'Hackathon' },
  { id: 'exam', label: 'Exam' },
  { id: 'circular', label: 'Circular' },
  { id: 'event', label: 'Event' },
  { id: 'other', label: 'Other' },
];

export default function ComposeNotice() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Message
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('circular');
  const [priority, setPriority] = useState('normal'); // 'normal' | 'important'
  const [linkUrl, setLinkUrl] = useState('');
  const [deadlines, setDeadlines] = useState([]);
  const [addToDeadlines, setAddToDeadlines] = useState(false);
  const [manualLabel, setManualLabel] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [manualKind, setManualKind] = useState('deadline');

  // Step 2: Audience
  const [recipientType, setRecipientType] = useState('students'); // 'students' | 'teachers' | 'both'
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [section, setSection] = useState('');
  const [batch, setBatch] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [myMentees, setMyMentees] = useState(false);
  const [myCoursesOnly, setMyCoursesOnly] = useState(false);
  const [attendanceBand, setAttendanceBand] = useState('');
  const [pendingAssignmentId, setPendingAssignmentId] = useState('');
  const [teacherDuty, setTeacherDuty] = useState('');
  const [rollNumbersText, setRollNumbersText] = useState('');
  const [presetNameInput, setPresetNameInput] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  // Live preview state
  const [audienceCount, setAudienceCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [teacherCount, setTeacherCount] = useState(0);
  const [audienceSummary, setAudienceSummary] = useState('');
  const [sampleRecipients, setSampleRecipients] = useState([]);
  const [excludedList, setExcludedList] = useState([]);
  const [reachWarning, setReachWarning] = useState(null);
  const [showRecipientsList, setShowRecipientsList] = useState(false);
  const [confirmedEveryone, setConfirmedEveryone] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Queries for dropdown options
  const { data: rawCourses = [] } = useQuery({
    queryKey: ['faculty-courses-notices'],
    queryFn: () => facultyApi.getCourses().then(r => r.data?.items || (Array.isArray(r.data) ? r.data : [])).catch(() => []),
  });
  const courses = Array.isArray(rawCourses) ? rawCourses : (rawCourses?.items || []);

  const { data: presetsData = { system_presets: [], custom_presets: [] }, refetch: refetchPresets } = useQuery({
    queryKey: ['notice-presets'],
    queryFn: () => noticeApi.getPresets().then(r => r.data).catch(() => ({ system_presets: [], custom_presets: [] })),
  });

  const { data: recentAudiences = [] } = useQuery({
    queryKey: ['notice-recent-audiences'],
    queryFn: () => noticeApi.getRecentAudiences().then(r => r.data).catch(() => []),
  });
  // Debounced Deadline Extraction from Body
  const extractTimerRef = useRef(null);
  useEffect(() => {
    if (!body || body.trim().length < 5) return;
    if (extractTimerRef.current) clearTimeout(extractTimerRef.current);

    extractTimerRef.current = setTimeout(() => {
      noticeApi.extractDeadlines({ text: body })
        .then(res => {
          const extracted = res.data?.candidates || [];
          if (extracted.length > 0) {
            setDeadlines(prev => {
              const existingAts = new Set(prev.map(d => d.at));
              const newUnique = extracted.filter(e => !existingAts.has(e.at));
              return [...prev, ...newUnique];
            });
          }
        })
        .catch(() => {});
    }, 600);

    return () => {
      if (extractTimerRef.current) clearTimeout(extractTimerRef.current);
    };
  }, [body]);

  // Construct current spec object
  const buildCurrentSpec = () => {
    const spec = { recipient_type: recipientType };
    if (selectedCourseId) spec.course_id = Number(selectedCourseId);
    if (section) spec.section = section;
    if (batch) spec.batch = batch;
    if (semesterId) spec.semester_id = Number(semesterId);
    if (myMentees) spec.my_mentees = true;
    if (myCoursesOnly) spec.my_courses_only = true;
    if (attendanceBand) spec.attendance_band = attendanceBand;
    if (pendingAssignmentId) spec.pending_assignment_id = Number(pendingAssignmentId);
    if (teacherDuty) spec.duty = teacherDuty;

    if (rollNumbersText.trim()) {
      const rolls = rollNumbersText
        .split(/[\n,;\s]+/)
        .map(r => r.trim())
        .filter(Boolean);
      if (rolls.length > 0) spec.roll_numbers = rolls;
    }
    return spec;
  };

  // Live Audience Preview Debounced Effect
  const previewTimerRef = useRef(null);
  useEffect(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      const spec = buildCurrentSpec();
      noticeApi.previewAudience(spec)
        .then(res => {
          const d = res.data;
          setAudienceCount(d.count || 0);
          setStudentCount(d.student_count || 0);
          setTeacherCount(d.teacher_count || 0);
          setAudienceSummary(d.audience_summary || '');
          setSampleRecipients(d.recipients_sample || []);
          setExcludedList(d.excluded || []);
          setReachWarning(d.warning || null);
          setErrorMessage(null);
        })
        .catch(err => {
          setErrorMessage(err.response?.data?.detail?.message || 'Failed to resolve audience preview');
        });
    }, 400);

    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [
    recipientType, selectedCourseId, section, batch, semesterId,
    myMentees, myCoursesOnly, attendanceBand, pendingAssignmentId,
    teacherDuty, rollNumbersText
  ]);

  // Handle Preset Selection
  const applyPreset = (presetName) => {
    if (presetName === 'Whole department') {
      setRecipientType('both');
      setSelectedCourseId('');
      setSection('');
      setMyMentees(false);
      setMyCoursesOnly(false);
      setAttendanceBand('');
      setTeacherDuty('');
    } else if (presetName === 'My course sections') {
      setRecipientType('students');
      setMyCoursesOnly(true);
      setMyMentees(false);
      setAttendanceBand('');
    } else if (presetName === 'My mentees') {
      setRecipientType('students');
      setMyMentees(true);
      setMyCoursesOnly(false);
      setAttendanceBand('');
    } else if (presetName === 'My course, needs support') {
      setRecipientType('students');
      setMyCoursesOnly(true);
      setMyMentees(false);
      setAttendanceBand('Needs support');
    }
  };

  const applyCustomPreset = (spec) => {
    if (!spec) return;
    if (spec.recipient_type) setRecipientType(spec.recipient_type);
    setSelectedCourseId(spec.course_id ? String(spec.course_id) : '');
    setSection(spec.section || '');
    setBatch(spec.batch || '');
    setSemesterId(spec.semester_id ? String(spec.semester_id) : '');
    setMyMentees(!!spec.my_mentees);
    setMyCoursesOnly(!!spec.my_courses_only);
    setAttendanceBand(spec.attendance_band || '');
    setPendingAssignmentId(spec.pending_assignment_id ? String(spec.pending_assignment_id) : '');
    setTeacherDuty(spec.duty || '');
    if (spec.roll_numbers) setRollNumbersText(spec.roll_numbers.join('\n'));
  };

  // Save Custom Preset Mutation
  const savePresetMutation = useMutation({
    mutationFn: () => noticeApi.savePreset({ name: presetNameInput.trim(), spec: buildCurrentSpec() }),
    onSuccess: () => {
      setShowSavePreset(false);
      setPresetNameInput('');
      refetchPresets();
    },
  });

  // Notice Submission Mutation
  const sendMutation = useMutation({
    mutationFn: (payload) => noticeApi.create(payload),
    onSuccess: () => {
      navigate('/notices');
    },
    onError: (err) => {
      setErrorMessage(err.response?.data?.detail?.message || 'Failed to publish notice');
    },
  });

  const isDeanOrAdmin = user?.role === 'coordinator' || user?.role === 'admin';
  const needsCohortConfirmation =
    recipientType === 'both' ||
    audienceSummary.toLowerCase().includes('whole department') ||
    audienceSummary.toLowerCase().includes('everyone');

  const handleSendNotice = () => {
    if (!title.trim() || !body.trim()) {
      setErrorMessage('Title and body are required.');
      return;
    }
    if (audienceCount === 0) {
      setErrorMessage('Notice audience cannot be empty. Please adjust your filters.');
      return;
    }
    if (needsCohortConfirmation && !confirmedEveryone) {
      setErrorMessage('Please confirm broadcasting to the whole department cohort by checking the confirmation box.');
      return;
    }
    const spec = buildCurrentSpec();
    const payload = {
      title: title.trim(),
      body: body.trim(),
      category,
      priority,
      urgent: priority === 'important',
      link: linkUrl.trim() || null,
      audience_spec: JSON.stringify(spec),
      deadlines: deadlines.map(d => ({
        kind: d.kind,
        at: d.at,
        label: d.label,
        source: d.source || 'manual',
      })),
      add_to_deadlines: addToDeadlines,
    };
    sendMutation.mutate(payload);
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 60 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
            Compose Notice
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Three-step flow: Message, Audience builder, and Review & Send with deadline sync.
          </p>
        </div>
        <Link
          to="/notices"
          style={{
            padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-pill)', color: 'var(--text-muted)', fontSize: 13,
            textDecoration: 'none', fontWeight: 500,
          }}
        >
          Cancel
        </Link>
      </div>

      {/* 3-Step Wizard Progress */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 28, background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '12px 20px', border: '1px solid var(--border)' }}>
        {STEPS.map((s) => {
          const isActive = currentStep === s.num;
          const isDone = currentStep > s.num;
          return (
            <div
              key={s.num}
              onClick={() => { if (isDone || (s.num === 2 && title && body)) setCurrentStep(s.num); }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 10, cursor: isDone ? 'pointer' : 'default',
                color: isActive ? 'var(--ink-900)' : isDone ? 'var(--ok-fg)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500, fontSize: 14,
              }}
            >
              <div
                style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? 'var(--accent)' : isDone ? 'var(--ok-bg)' : 'var(--bg)',
                  color: isActive ? 'var(--on-dark)' : isDone ? 'var(--ok-fg)' : 'var(--text-muted)',
                  border: isDone ? '1px solid var(--border)' : 'none',
                  fontSize: 12, fontWeight: 700,
                }}
              >
                {isDone ? '✓' : s.num}
              </div>
              <span>{s.title}</span>
            </div>
          );
        })}
      </div>

      {errorMessage && (
        <div style={{ background: 'var(--crit-bg)', color: 'var(--crit-fg)', border: '1px solid var(--border)', padding: '12px 18px', borderRadius: 'var(--radius-card)', marginBottom: 20, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} /> {errorMessage}
        </div>
      )}

      {/* STEP 1: MESSAGE */}
      {currentStep === 1 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: 28, boxShadow: 'var(--shadow-card)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-900)', marginTop: 0, marginBottom: 20 }}>
            Step 1: Notice Message & Details
          </h2>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Notice Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Midterm Examination Schedule — Fall 2026"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-input)',
                border: '1px solid var(--border)', fontSize: 14, background: 'var(--surface)', color: 'var(--ink-900)',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-input)',
                  border: '1px solid var(--border)', fontSize: 14, background: 'var(--surface)', color: 'var(--ink-900)',
                }}
              >
                {CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Priority
              </label>
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--ink-900)' }}>
                  <input
                    type="radio"
                    name="priority"
                    value="normal"
                    checked={priority === 'normal'}
                    onChange={() => setPriority('normal')}
                  />
                  Normal
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--crit-fg)', fontWeight: 600 }}>
                  <input
                    type="radio"
                    name="priority"
                    value="important"
                    checked={priority === 'important'}
                    onChange={() => setPriority('important')}
                  />
                  Important
                </label>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Notice Body *
            </label>
            <textarea
              rows={6}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Enter announcement text. Dates, times, and deadlines (e.g., 'Submit by 15 Dec 2026 at 5pm') will be detected automatically..."
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-input)',
                border: '1px solid var(--border)', fontSize: 14, background: 'var(--surface)', color: 'var(--ink-900)',
                fontFamily: 'var(--font-sans)', lineHeight: 1.6, resize: 'vertical',
              }}
            />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Rule-based date extractor automatically parses dates in Asia/Kolkata timezone.
            </p>
          </div>

          {/* Optional Link (Links only, no file uploads) */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <LinkIcon size={14} /> Optional Link (Google Form, External Resource)
            </label>
            <input
              type="url"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://forms.google.com/... or https://..."
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-input)',
                border: '1px solid var(--border)', fontSize: 14, background: 'var(--surface)', color: 'var(--ink-900)',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Links only; file uploads are not supported.
            </span>
          </div>

          {/* Detected Dates & Deadlines */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 18, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} color="var(--accent)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)' }}>
                  Detected Dates & Deadlines ({deadlines.length})
                </span>
              </div>
            </div>

            {deadlines.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {deadlines.map((dl, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-pill)', padding: '6px 14px',
                      fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{dl.label}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({dl.at?.slice(0, 16).replace('T', ' ')})</span>
                    <button
                      type="button"
                      onClick={() => setDeadlines(deadlines.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', margin: '0 0 14px 0' }}>
                No dates detected yet. Type dates into the body or add manually below.
              </p>
            )}

            {/* Manual Deadline Adder */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <input
                type="text"
                placeholder="Manual deadline label"
                value={manualLabel}
                onChange={e => setManualLabel(e.target.value)}
                style={{ padding: '6px 10px', fontSize: 12, borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', flex: 1, minWidth: 160 }}
              />
              <input
                type="datetime-local"
                value={manualDate}
                onChange={e => setManualDate(e.target.value)}
                style={{ padding: '6px 10px', fontSize: 12, borderRadius: 'var(--radius-input)', border: '1px solid var(--border)' }}
              />
              <button
                type="button"
                onClick={() => {
                  if (manualLabel && manualDate) {
                    setDeadlines([...deadlines, { label: manualLabel, at: manualDate, kind: manualKind, source: 'manual' }]);
                    setManualLabel('');
                    setManualDate('');
                  }
                }}
                style={{
                  padding: '6px 14px', background: 'var(--accent)', color: 'var(--on-dark)',
                  border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                <Plus size={14} /> Add Deadline
              </button>
            </div>

            {/* Add to Deadlines Opt-in Checkbox */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={addToDeadlines}
                  onChange={e => setAddToDeadlines(e.target.checked)}
                />
                Add to deadlines (Sync confirmed deadlines into student tasks tab)
              </label>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0 24px' }}>
                If unchecked, deadlines will only be shown inside the notice text and will not appear in the student deadlines list.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                if (!title.trim() || !body.trim()) {
                  setErrorMessage('Please provide both title and body before proceeding to audience.');
                  return;
                }
                setErrorMessage(null);
                setCurrentStep(2);
              }}
              style={{
                padding: '10px 22px', background: 'var(--accent)', color: 'var(--on-dark)',
                border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
            >
              Continue to Audience <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: AUDIENCE BUILDER */}
      {currentStep === 2 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: 28, boxShadow: 'var(--shadow-card)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-900)', marginTop: 0, marginBottom: 16 }}>
            Step 2: Targeted Audience Builder
          </h2>

          {/* One-Click Presets */}
          <div style={{ marginBottom: 22, background: 'var(--bg)', padding: '14px 18px', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              One-Click Presets
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                type="button"
                onClick={() => applyPreset('My course sections')}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)',
                  background: myCoursesOnly && !attendanceBand ? 'var(--accent)' : 'var(--surface)',
                  color: myCoursesOnly && !attendanceBand ? 'var(--on-dark)' : 'var(--ink-900)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                My course sections
              </button>
              <button
                type="button"
                onClick={() => applyPreset('My mentees')}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)',
                  background: myMentees ? 'var(--accent)' : 'var(--surface)',
                  color: myMentees ? 'var(--on-dark)' : 'var(--ink-900)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                My mentees
              </button>
              <button
                type="button"
                onClick={() => applyPreset('My course, needs support')}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)',
                  background: myCoursesOnly && attendanceBand === 'Needs support' ? 'var(--accent)' : 'var(--surface)',
                  color: myCoursesOnly && attendanceBand === 'Needs support' ? 'var(--on-dark)' : 'var(--ink-900)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                My course, needs support
              </button>
              {isDeanOrAdmin && (
                <button
                  type="button"
                  onClick={() => applyPreset('Whole department')}
                  style={{
                    padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)',
                    background: recipientType === 'both' && !selectedCourseId && !myMentees ? 'var(--accent)' : 'var(--surface)',
                    color: recipientType === 'both' && !selectedCourseId && !myMentees ? 'var(--on-dark)' : 'var(--ink-900)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Whole department (Dean/Admin)
                </button>
              )}
            </div>

            {/* Custom Saved Presets & Recent Audiences */}
            {(presetsData.custom_presets?.length > 0 || recentAudiences.length > 0) && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Saved Presets:</span>
                {presetsData.custom_presets?.map(cp => (
                  <button
                    key={cp.id}
                    type="button"
                    onClick={() => applyCustomPreset(cp.spec)}
                    style={{
                      padding: '4px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)',
                      background: 'var(--surface)', color: 'var(--ink-900)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    🔖 {cp.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recipient Type Segmented Control */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Recipient Type
            </label>
            <div style={{ display: 'inline-flex', background: 'var(--bg)', borderRadius: 'var(--radius-pill)', padding: 3, border: '1px solid var(--border)' }}>
              {[
                { id: 'students', label: 'Students' },
                { id: 'teachers', label: 'Teachers' },
                { id: 'both', label: 'Both Students & Teachers' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setRecipientType(t.id)}
                  style={{
                    padding: '8px 18px', borderRadius: 'var(--radius-pill)', border: 'none',
                    background: recipientType === t.id ? 'var(--accent)' : 'transparent',
                    color: recipientType === t.id ? 'var(--on-dark)' : 'var(--ink-900)',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Student Filters (Combined with AND) */}
          {(recipientType === 'students' || recipientType === 'both') && (
            <div style={{ marginBottom: 22, padding: 18, background: 'var(--bg)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 12 }}>
                Student Filters (combined with AND)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Course
                  </label>
                  <select
                    value={selectedCourseId}
                    onChange={e => { setSelectedCourseId(e.target.value); setMyCoursesOnly(false); }}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', background: 'var(--surface)' }}
                  >
                    <option value="">All My Courses</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Section
                  </label>
                  <select
                    value={section}
                    onChange={e => setSection(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', background: 'var(--surface)' }}
                  >
                    <option value="">All Sections</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                    <option value="D">Section D</option>
                    <option value="E">Section E</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Batch / Programme
                  </label>
                  <input
                    type="text"
                    value={batch}
                    onChange={e => setBatch(e.target.value)}
                    placeholder="e.g. 2026 or B.Tech"
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', background: 'var(--surface)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Attendance Band
                  </label>
                  <select
                    value={attendanceBand}
                    onChange={e => setAttendanceBand(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', background: 'var(--surface)' }}
                  >
                    <option value="">Any Attendance Band</option>
                    <option value="Needs support">Needs support (Critical risk)</option>
                    <option value="Watch">Watch (Moderate risk)</option>
                    <option value="Safe">Safe</option>
                  </select>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    Allowed only for own courses or mentees.
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 20, marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-900)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={myMentees}
                    onChange={e => setMyMentees(e.target.checked)}
                  />
                  Only my assigned mentees
                </label>
              </div>
            </div>
          )}

          {/* Teacher Filters */}
          {(recipientType === 'teachers' || recipientType === 'both') && (
            <div style={{ marginBottom: 22, padding: 18, background: 'var(--bg)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 12 }}>
                Teacher Filters (combined with AND)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Duty / Role
                  </label>
                  <select
                    value={teacherDuty}
                    onChange={e => setTeacherDuty(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', background: 'var(--surface)' }}
                  >
                    <option value="">All Department Teachers</option>
                    <option value="instructor">Course Instructors</option>
                    <option value="mentor">Mentors</option>
                    <option value="course_coordinator">Course Coordinators</option>
                    <option value="trainer">Trainers / Lab Assistants</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Individual Roll Numbers Input */}
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Individual Roll Numbers (Search or Paste)
            </label>
            <textarea
              rows={2}
              value={rollNumbersText}
              onChange={e => setRollNumbersText(e.target.value)}
              placeholder="Paste roll numbers separated by commas or newlines (e.g. 26AIML001, 26AIML002)..."
              style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', background: 'var(--surface)', fontFamily: 'var(--font-mono)' }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Roll numbers outside your authorized scope are listed as excluded.
            </span>
          </div>

          {/* Excluded List Callout */}
          {excludedList.length > 0 && (
            <div style={{ background: 'var(--crit-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '12px 16px', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--crit-fg)', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                <AlertCircle size={14} /> Excluded Roll Numbers ({excludedList.length} out of scope)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {excludedList.map((ex, i) => (
                  <span key={i} style={{ fontSize: 11, background: 'var(--surface)', padding: '2px 8px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)' }}>
                    <strong>{ex.roll_no}</strong>: {ex.reason}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Live Recipient Count & Expandable Preview */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 18, marginBottom: 22, boxShadow: 'var(--shadow-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent)', color: 'var(--on-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>
                    Live Audience: {audienceCount} Recipient{audienceCount === 1 ? '' : 's'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {audienceSummary || 'Configured Audience'} • ({studentCount} students, {teacherCount} teachers)
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowSavePreset(!showSavePreset)}
                  style={{
                    padding: '6px 14px', background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Bookmark size={14} /> Save as preset
                </button>
                <button
                  type="button"
                  onClick={() => setShowRecipientsList(!showRecipientsList)}
                  style={{
                    padding: '6px 14px', background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {showRecipientsList ? 'Hide Preview' : 'Show Preview'}
                </button>
              </div>
            </div>

            {/* Inline Save Preset Form */}
            {showSavePreset && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  placeholder="Preset name (e.g. My AIML-A At-Risk Group)"
                  value={presetNameInput}
                  onChange={e => setPresetNameInput(e.target.value)}
                  style={{ flex: 1, padding: '6px 10px', fontSize: 12, borderRadius: 'var(--radius-input)', border: '1px solid var(--border)' }}
                />
                <button
                  type="button"
                  onClick={() => { if (presetNameInput.trim()) savePresetMutation.mutate(); }}
                  disabled={!presetNameInput.trim()}
                  style={{
                    padding: '6px 14px', background: 'var(--accent)', color: 'var(--on-dark)',
                    border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Save Preset
                </button>
              </div>
            )}

            {/* Expandable Recipient Sample List */}
            {showRecipientsList && sampleRecipients.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', maxHeight: 220, overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '4px 8px' }}>Name</th>
                      <th style={{ padding: '4px 8px' }}>Role / Roll No</th>
                      <th style={{ padding: '4px 8px' }}>Email</th>
                      <th style={{ padding: '4px 8px' }}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sampleRecipients.map((u) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 600 }}>{u.name}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{u.roll_no || u.role}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{u.email}</td>
                        <td style={{ padding: '6px 8px', color: 'var(--accent)', fontStyle: 'italic' }}>{u.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              style={{
                padding: '10px 18px', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-pill)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <ArrowLeft size={16} /> Back to Message
            </button>
            <button
              type="button"
              onClick={() => {
                if (audienceCount === 0) {
                  setErrorMessage('Cannot proceed with an empty audience. Please adjust filters.');
                  return;
                }
                setErrorMessage(null);
                setCurrentStep(3);
              }}
              style={{
                padding: '10px 22px', background: 'var(--accent)', color: 'var(--on-dark)',
                border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
            >
              Review & Send <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: REVIEW AND SEND */}
      {currentStep === 3 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: 28, boxShadow: 'var(--shadow-card)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-900)', marginTop: 0, marginBottom: 20 }}>
            Step 3: Review Notice & Confirm Send
          </h2>

          {/* Large Audience Reach Warning Guardrail (>100) */}
          {reachWarning && (
            <div style={{ background: 'var(--watch-bg)', border: '1px solid var(--border)', color: 'var(--watch-fg)', padding: '14px 18px', borderRadius: 'var(--radius-card)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={18} />
              <div>
                <strong>Audience Notice:</strong> {reachWarning}
                <div style={{ fontSize: 12, marginTop: 2 }}>You may send this notice to all recipients or navigate back to narrow your filters.</div>
              </div>
            </div>
          )}

          {/* Whole Department / Everyone Confirmation Guardrail */}
          {needsCohortConfirmation && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: 'var(--radius-card)', marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={confirmedEveryone}
                  onChange={e => setConfirmedEveryone(e.target.checked)}
                />
                I confirm sending this broadcast to the whole department cohort ({audienceCount} recipients).
              </label>
            </div>
          )}

          {/* Preview Card */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20, background: 'var(--bg)', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {priority === 'important' && (
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', background: 'var(--crit-bg)', color: 'var(--crit-fg)', borderRadius: 'var(--radius-pill)' }}>
                    IMPORTANT
                  </span>
                )}
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-pill)', textTransform: 'uppercase', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  {category}
                </span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Targeting: <strong style={{ color: 'var(--ink-900)' }}>{audienceSummary}</strong> ({audienceCount} recipients)
              </span>
            </div>

            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-900)', margin: '0 0 10px 0' }}>
              {title}
            </h3>

            {linkUrl && (
              <div style={{ marginBottom: 12 }}>
                <a href={linkUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'underline' }}>
                  🔗 {linkUrl}
                </a>
              </div>
            )}

            <div style={{ fontSize: 14, color: 'var(--ink-900)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 14 }}>
              {body}
            </div>

            {deadlines.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={13} /> {addToDeadlines ? 'Deadlines to be synced to student tasks tab:' : 'Deadlines mentioned in notice (not synced to tasks):'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {deadlines.map((dl, idx) => (
                    <span key={idx} style={{ fontSize: 12, background: 'var(--surface)', padding: '2px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)' }}>
                      <strong>{dl.label}</strong> ({dl.at?.slice(0, 16).replace('T', ' ')})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              style={{
                padding: '10px 18px', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-pill)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <ArrowLeft size={16} /> Back to Audience
            </button>
            <button
              type="button"
              onClick={handleSendNotice}
              disabled={
                sendMutation.isPending ||
                audienceCount === 0 ||
                (needsCohortConfirmation && !confirmedEveryone)
              }
              style={{
                padding: '12px 28px', background: 'var(--accent)', color: 'var(--on-dark)',
                border: 'none', borderRadius: 'var(--radius-pill)', fontSize: 14, fontWeight: 700,
                cursor: (sendMutation.isPending || audienceCount === 0 || (needsCohortConfirmation && !confirmedEveryone)) ? 'not-allowed' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                opacity: (sendMutation.isPending || audienceCount === 0 || (needsCohortConfirmation && !confirmedEveryone)) ? 0.6 : 1,
              }}
              title={
                needsCohortConfirmation && !confirmedEveryone
                  ? 'Please confirm sending to the whole department cohort above'
                  : 'Publish Notice'
              }
            >
              <Send size={16} /> {sendMutation.isPending ? 'Publishing Notice...' : 'Publish Notice Now'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
