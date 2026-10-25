import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Send, Users, Clock, AlertTriangle, Link as LinkIcon, ArrowRight, ArrowLeft, Trash2, Plus } from 'lucide-react';
import { noticeApi, facultyApi } from '../../api/endpoints.js';
import { useAuth } from '../../app/AuthContext.jsx';

const STEPS = [
  { num: 1, title: 'Audience' },
  { num: 2, title: 'Content' },
  { num: 3, title: 'Detected Deadlines' },
  { num: 4, title: 'Preview & Send' },
];

export default function ComposeNotice() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Audience
  const [audienceType, setAudienceType] = useState('course'); // course, mentees, department, all, roll_numbers
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [batch, setBatch] = useState('2023');
  const [rollNumbersText, setRollNumbersText] = useState('');
  const [audienceCount, setAudienceCount] = useState(0);
  const [sampleRecipients, setSampleRecipients] = useState([]);
  const [showRecipientsList, setShowRecipientsList] = useState(false);

  // Step 2: Content
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General'); // Form, Event, Exam, Placement, General, Urgent
  const [urgent, setUrgent] = useState(false);
  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [sendEmail, setSendEmail] = useState(false);

  // Step 3: Deadlines
  const [deadlines, setDeadlines] = useState([]);
  const [manualLabel, setManualLabel] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [manualKind, setManualKind] = useState('deadline');

  const [errorMessage, setErrorMessage] = useState(null);

  // Fetch courses for audience picker
  const { data: rawCourses = [] } = useQuery({
    queryKey: ['faculty-courses-notices'],
    queryFn: () => facultyApi.getCourses().then(r => r.data?.items || (Array.isArray(r.data) ? r.data : [])).catch(() => []),
  });
  const courses = Array.isArray(rawCourses) ? rawCourses : (rawCourses?.items || []);

  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  // Preview audience
  const previewAudienceMutation = useMutation({
    mutationFn: (payload) => noticeApi.previewAudience(payload),
    onSuccess: (res) => {
      setAudienceCount(res.data?.count || 0);
      setSampleRecipients(res.data?.recipients_sample || []);
    },
    onError: () => {
      setAudienceCount(0);
      setSampleRecipients([]);
    },
  });

  // Re-run audience preview when type changes
  useEffect(() => {
    let rolls = null;
    if (audienceType === 'roll_numbers') {
      rolls = rollNumbersText.split(/[\n, ]+/).map(r => r.trim()).filter(Boolean);
    }
    const cid = audienceType === 'course' ? Number(selectedCourseId || courses[0]?.id || 0) : null;
    if (audienceType === 'course' && !cid) return;
    previewAudienceMutation.mutate({
      audience_type: audienceType,
      course_id: cid,
      department_id: user?.department_id || 1,
      batch: audienceType === 'batch' ? batch : null,
      roll_numbers: rolls,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceType, selectedCourseId, batch, rollNumbersText, user?.department_id, courses]);

  // Date extraction
  const extractMutation = useMutation({
    mutationFn: (text) => noticeApi.extractDeadlines({ text }),
    onSuccess: (res) => {
      const candidates = res.data.candidates || [];
      if (candidates.length > 0) {
        setDeadlines(candidates.map(c => ({
          kind: c.kind || 'deadline',
          at: c.at,
          label: c.label,
          source: 'detected',
          confirmed: true,
        })));
      }
    },
  });

  // Trigger date extraction when leaving Step 2
  function handleGoToStep3() {
    if (!title.trim() || !body.trim()) {
      setErrorMessage('Please provide both title and body content');
      return;
    }
    setErrorMessage(null);
    extractMutation.mutate(`${title}. ${body}. ${linkUrl}`);
    setCurrentStep(3);
  }

  // Add manual deadline
  function handleAddManualDeadline() {
    if (!manualLabel.trim() || !manualDate) return;
    setDeadlines(prev => [
      ...prev,
      {
        kind: manualKind,
        at: new Date(manualDate).toISOString(),
        label: manualLabel.trim(),
        source: 'manual',
        confirmed: true,
      },
    ]);
    setManualLabel('');
    setManualDate('');
  }

  function handleRemoveDeadline(index) {
    setDeadlines(prev => prev.filter((_, i) => i !== index));
  }

  // Create notice mutation
  const createNoticeMutation = useMutation({
    mutationFn: (payload) => noticeApi.create(payload),
    onSuccess: () => {
      navigate('/notices');
    },
    onError: (err) => {
      const detail = err.response?.data?.detail;
      setErrorMessage(typeof detail === 'string' ? detail : (detail?.message || 'Failed to dispatch notice.'));
    },
  });

  function handleFinalSubmit() {
    setErrorMessage(null);
    let rolls = null;
    if (audienceType === 'roll_numbers') {
      rolls = rollNumbersText.split(/[\n, ]+/).map(r => r.trim()).filter(Boolean);
    }
    const spec = {
      type: audienceType,
      course_id: audienceType === 'course' ? Number(selectedCourseId) : null,
      department_id: user?.department_id || 1,
      batch: audienceType === 'batch' ? batch : null,
      roll_numbers: rolls,
    };

    createNoticeMutation.mutate({
      title: title.trim(),
      body: body.trim(),
      category,
      urgent,
      audience_spec: JSON.stringify(spec),
      deadlines: deadlines.map(d => ({
        kind: d.kind,
        at: d.at,
        label: d.label,
        source: d.source,
      })),
      send_email: sendEmail,
    });
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          <Link to="/notices" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Notices</Link>
          {' '}/ Compose Notice
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
          Compose Notice & Announcement
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Targeted broadcast with automated Asia/Kolkata date parsing, task deadline syncing, and read receipts.
        </p>
      </div>

      {/* Stepper */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '20px 24px', border: '1px solid var(--border)',
        marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, boxShadow: 'var(--shadow-card)',
      }}>
        {STEPS.map(s => {
          const isActive = currentStep === s.num;
          const isDone = currentStep > s.num;
          return (
            <div key={s.num} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              borderBottom: `2px solid ${isActive ? 'var(--accent)' : isDone ? 'var(--ok-bg)' : 'var(--border)'}`,
              paddingBottom: 10,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 'var(--radius-pill)',
                background: isActive ? 'var(--accent)' : isDone ? 'var(--ok-bg)' : 'var(--bg)',
                color: isActive ? 'var(--on-dark)' : isDone ? 'var(--ok-fg)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 600, fontSize: 12,
              }}>
                {isDone ? '✓' : s.num}
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Step {s.num}</div>
                <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--ink-900)' : 'var(--text-muted)' }}>{s.title}</div>
              </div>
            </div>
          );
        })}
      </div>

      {errorMessage && (
        <div style={{
          background: 'var(--crit-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)',
          padding: '14px 18px', color: 'var(--crit-fg)', fontSize: 13, fontWeight: 600, marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={16} /> {errorMessage}
        </div>
      )}

      {/* STEP 1: Audience */}
      {currentStep === 1 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 28, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 16 }}>
            1. Select Target Recipient Audience
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { type: 'course', label: 'Enrolled Course Students' },
              { type: 'mentees', label: 'My Mentee Cohort' },
              { type: 'department', label: 'Whole Department' },
              { type: 'batch', label: 'Specific Batch' },
              { type: 'roll_numbers', label: 'Upload Roll Numbers' },
            ].map(({ type, label }) => (
              <button
                key={type}
                type="button"
                onClick={() => setAudienceType(type)}
                style={{
                  padding: '14px 16px', borderRadius: 'var(--radius-input)', cursor: 'pointer', textAlign: 'left',
                  border: `1px solid ${audienceType === type ? 'var(--accent)' : 'var(--border)'}`,
                  background: audienceType === type ? 'var(--bg)' : 'var(--surface)',
                  fontWeight: 600, fontSize: 13, color: audienceType === type ? 'var(--ink-900)' : 'var(--text)',
                  boxShadow: audienceType === type ? 'var(--shadow-card)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {audienceType === 'course' && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 6 }}>
                Select Course
              </label>
              <select
                value={selectedCourseId}
                onChange={e => setSelectedCourseId(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-input)',
                  border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink-900)', fontSize: 13,
                }}
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
          )}

          {audienceType === 'batch' && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 6 }}>
                Select Batch
              </label>
              <select
                value={batch}
                onChange={e => setBatch(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-input)',
                  border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink-900)', fontSize: 13,
                }}
              >
                <option value="2023">Batch 2023-2027</option>
                <option value="2024">Batch 2024-2028</option>
                <option value="2025">Batch 2025-2029</option>
              </select>
            </div>
          )}

          {audienceType === 'roll_numbers' && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 6 }}>
                Paste Roll Numbers (Comma or newline separated)
              </label>
              <textarea
                rows={4}
                placeholder="e.g. CS2023001, CS2023002, CS2023005"
                value={rollNumbersText}
                onChange={e => setRollNumbersText(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-input)',
                  border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink-900)',
                  fontSize: 13, boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Live Recipient Count Banner */}
          <div style={{
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '16px 20px',
            marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ color: 'var(--accent)' }}><Users size={22} /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>
                  Target Audience: {audienceCount} Recipients
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                  Scoped strictly to your authorized academic duty privileges.
                </div>
              </div>
            </div>
            {sampleRecipients.length > 0 && (
              <button
                type="button"
                onClick={() => setShowRecipientsList(!showRecipientsList)}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              >
                {showRecipientsList ? 'Hide List' : 'View Sample Recipients'}
              </button>
            )}
          </div>

          {showRecipientsList && sampleRecipients.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 14, background: 'var(--surface)', marginBottom: 24, maxHeight: 180, overflowY: 'auto' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Sample Recipients Preview:</div>
              {sampleRecipients.map(r => (
                <div key={r.id} style={{ fontSize: 13, color: 'var(--text)', padding: '4px 0' }}>
                  • {r.name} ({r.email}) — <span style={{ textTransform: 'capitalize', color: 'var(--text-muted)' }}>{r.role}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              disabled={audienceCount === 0}
              onClick={() => setCurrentStep(2)}
              style={{
                background: audienceCount === 0 ? 'var(--sand)' : 'var(--accent)', color: 'var(--on-dark)',
                border: 'none', padding: '10px 24px', borderRadius: 'var(--radius-pill)', fontSize: 14,
                fontWeight: 600, cursor: audienceCount === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              Next: Notice Content <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Content */}
      {currentStep === 2 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 28, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 16 }}>
            2. Notice Content, Category & Attachments
          </h2>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 6 }}>Notice Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Hackathon Registration & Google Form Deadline"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-input)',
                border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink-900)',
                fontSize: 14, boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 6 }}>Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-input)',
                  border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink-900)', fontSize: 13,
                }}
              >
                <option value="General">General Announcement</option>
                <option value="Form">Google Form / Feedback</option>
                <option value="Event">Event / Hackathon</option>
                <option value="Exam">Exam / Test Schedule</option>
                <option value="Placement">Placement / Internship</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: urgent ? 'var(--crit-fg)' : 'var(--text)' }}>
                <input
                  type="checkbox"
                  checked={urgent}
                  onChange={e => setUrgent(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                />
                Pin as High Priority / Urgent Notice
              </label>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 6 }}>Notice Body</label>
            <textarea
              rows={6}
              required
              placeholder="Provide notice announcement text. You can mention natural dates like 'Submit by 28 Nov 2026, 17:00' or 'due next Friday'..."
              value={body}
              onChange={e => setBody(e.target.value)}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-input)',
                border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink-900)',
                fontSize: 14, boxSizing: 'border-box', lineHeight: 1.5,
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 6 }}>Form / Resource Link (Optional)</label>
            <input
              type="url"
              placeholder="e.g. https://forms.gle/sampleform"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-input)',
                border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink-900)',
                fontSize: 13, boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={e => setSendEmail(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
              />
              Also dispatch email copy via institutional mail adapter
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              style={{
                background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)',
                padding: '10px 20px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              type="button"
              onClick={handleGoToStep3}
              style={{
                background: 'var(--accent)', color: 'var(--on-dark)', border: 'none',
                padding: '10px 24px', borderRadius: 'var(--radius-pill)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              Next: Detect Deadlines <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Detected Deadlines */}
      {currentStep === 3 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 28, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 4 }}>
            3. Automated Deadline & Milestone Extraction
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
            Parser timezone: <strong style={{ color: 'var(--ink-900)' }}>Asia/Kolkata (IST)</strong>. Confirm, edit, or remove detected deadlines before broadcast.
          </p>

          {/* List of extracted deadlines */}
          {deadlines.length === 0 ? (
            <div style={{
              background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-card)',
              padding: 24, textAlign: 'center', color: 'var(--text-muted)', marginBottom: 20, fontSize: 13,
            }}>
              No dates automatically detected in notice text. You can add one manually below or proceed.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {deadlines.map((dl, idx) => (
                <div key={idx} style={{
                  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '14px 18px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        background: dl.kind === 'deadline' ? 'var(--crit-bg)' : 'var(--watch-bg)',
                        color: dl.kind === 'deadline' ? 'var(--crit-fg)' : 'var(--watch-fg)',
                        padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase',
                      }}>
                        {dl.kind}
                      </span>
                      <strong style={{ fontSize: 14, color: 'var(--ink-900)' }}>{dl.label}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                      Date: {new Date(dl.at).toLocaleString()} (Source: {dl.source})
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveDeadline(idx)}
                    style={{
                      background: 'var(--surface)', color: 'var(--crit-fg)', border: '1px solid var(--border)',
                      padding: '6px 12px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Manual Deadline Adder */}
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-card)', padding: 18, border: '1px solid var(--border)', marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Add Date Milestone Manually
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <input
                type="text"
                placeholder="Label, e.g. Registration closes"
                value={manualLabel}
                onChange={e => setManualLabel(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-900)', fontSize: 13 }}
              />
              <input
                type="datetime-local"
                value={manualDate}
                onChange={e => setManualDate(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-900)', fontSize: 13 }}
              />
              <select
                value={manualKind}
                onChange={e => setManualKind(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-900)', fontSize: 13 }}
              >
                <option value="deadline">Deadline</option>
                <option value="event">Event Date</option>
              </select>
              <button
                type="button"
                onClick={handleAddManualDeadline}
                style={{
                  background: 'var(--surface)', color: 'var(--accent)', border: '1px solid var(--border)',
                  padding: '10px 16px', borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}
              >
                Add
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              style={{
                background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)',
                padding: '10px 20px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              style={{
                background: 'var(--accent)', color: 'var(--on-dark)', border: 'none',
                padding: '10px 24px', borderRadius: 'var(--radius-pill)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              Next: Final Preview & Broadcast <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Preview & Send */}
      {currentStep === 4 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 28, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 4 }}>
            4. Preview Exactly What Students Receive
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
            Review layout and confirm broadcast delivery to <strong style={{ color: 'var(--ink-900)' }}>{audienceCount} recipients</strong>.
          </p>

          {/* Student Card Preview */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderLeft: urgent ? '4px solid var(--crit-fg)' : '1px solid var(--border)',
            borderRadius: 'var(--radius-card)', padding: 24, marginBottom: 24, boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{
                  background: 'var(--bg)', color: 'var(--ink-900)', padding: '2px 10px',
                  borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {category}
                </span>
                {urgent && (
                  <span style={{
                    background: 'var(--crit-bg)', color: 'var(--crit-fg)', padding: '2px 10px',
                    borderRadius: 'var(--radius-pill)', fontWeight: 700, fontSize: 11, letterSpacing: '0.04em',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <AlertTriangle size={12} /> URGENT
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>From: {user?.name || 'Faculty Member'}</span>
            </div>

            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', margin: '0 0 12px 0' }}>{title}</h3>
            <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: '0 0 16px 0' }}>{body}</p>

            {linkUrl && (
              <a
                href={linkUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'var(--accent)', color: 'var(--on-dark)', padding: '8px 16px',
                  borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 13, textDecoration: 'none', marginBottom: 16,
                }}
              >
                <LinkIcon size={14} /> Open Form / Resource Link <ArrowRight size={14} />
              </a>
            )}

            {deadlines.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={14} /> Synced to Student Tasks & Calendar:
                </div>
                {deadlines.map((d, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--ink-900)', fontWeight: 600, padding: '2px 0', fontVariantNumeric: 'tabular-nums' }}>
                    • {d.label} ({new Date(d.at).toLocaleString()})
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              style={{
                background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)',
                padding: '10px 20px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              type="button"
              disabled={createNoticeMutation.isPending}
              onClick={handleFinalSubmit}
              style={{
                background: createNoticeMutation.isPending ? 'var(--sand)' : 'var(--accent)',
                color: 'var(--on-dark)', border: 'none', padding: '12px 30px', borderRadius: 'var(--radius-pill)',
                fontSize: 14, fontWeight: 600, cursor: createNoticeMutation.isPending ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {createNoticeMutation.isPending ? 'Broadcasting Notice...' : `Broadcast Notice to ${audienceCount} Recipients`} <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
