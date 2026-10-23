import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
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
  const { data: courses = [] } = useQuery({
    queryKey: ['faculty-courses-notices'],
    queryFn: () => facultyApi.getCourses().then(r => r.data || []),
  });

  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  // Preview audience
  const previewAudienceMutation = useMutation({
    mutationFn: (payload) => noticeApi.previewAudience(payload),
    onSuccess: (res) => {
      setAudienceCount(res.data.count || 0);
      setSampleRecipients(res.data.recipients_sample || []);
    },
  });

  // Re-run audience preview when type changes
  useEffect(() => {
    let rolls = null;
    if (audienceType === 'roll_numbers') {
      rolls = rollNumbersText.split(/[\n, ]+/).map(r => r.trim()).filter(Boolean);
    }
    previewAudienceMutation.mutate({
      audience_type: audienceType,
      course_id: audienceType === 'course' ? Number(selectedCourseId) : null,
      department_id: user?.department_id || 1,
      batch: audienceType === 'batch' ? batch : null,
      roll_numbers: rolls,
    });
  }, [audienceType, selectedCourseId, batch, rollNumbersText]);

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
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
          <Link to="/notices" style={{ color: '#3b82f6', textDecoration: 'none' }}>Notices</Link>
          {' '}/ Compose Notice (N1)
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
          📢 Compose Notice & Form Announcement
        </h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
          Targeted broadcast with automated Asia/Kolkata date parsing, task deadline syncing, and read receipts.
        </p>
      </div>

      {/* Stepper */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: '16px 24px', border: '1px solid #e2e8f0',
        marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
      }}>
        {STEPS.map(s => {
          const isActive = currentStep === s.num;
          const isDone = currentStep > s.num;
          return (
            <div key={s.num} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              borderBottom: `3px solid ${isActive ? '#3b82f6' : isDone ? '#22c55e' : '#e2e8f0'}`,
              paddingBottom: 10,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: isActive ? '#3b82f6' : isDone ? '#22c55e' : '#f1f5f9',
                color: isActive || isDone ? '#fff' : '#64748b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 12,
              }}>
                {isDone ? '✓' : s.num}
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Step {s.num}</div>
                <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? '#1e293b' : '#64748b' }}>{s.title}</div>
              </div>
            </div>
          );
        })}
      </div>

      {errorMessage && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', color: '#dc2626', fontSize: 13, marginBottom: 20 }}>
          🚨 {errorMessage}
        </div>
      )}

      {/* STEP 1: Audience */}
      {currentStep === 1 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>
            1. Select Target Recipient Audience
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
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
                  padding: '12px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                  border: `2px solid ${audienceType === type ? '#3b82f6' : '#e2e8f0'}`,
                  background: audienceType === type ? '#eff6ff' : '#f8fafc',
                  fontWeight: 600, fontSize: 13, color: audienceType === type ? '#1d4ed8' : '#334155',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {audienceType === 'course' && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Select Course
              </label>
              <select
                value={selectedCourseId}
                onChange={e => setSelectedCourseId(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
          )}

          {audienceType === 'batch' && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Select Batch
              </label>
              <select
                value={batch}
                onChange={e => setBatch(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
              >
                <option value="2023">Batch 2023-2027</option>
                <option value="2024">Batch 2024-2028</option>
                <option value="2025">Batch 2025-2029</option>
              </select>
            </div>
          )}

          {audienceType === 'roll_numbers' && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Paste Roll Numbers (Comma or newline separated)
              </label>
              <textarea
                rows={4}
                placeholder="e.g. CS2023001, CS2023002, CS2023005"
                value={rollNumbersText}
                onChange={e => setRollNumbersText(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
          )}

          {/* Live Recipient Count Banner */}
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16,
            marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>👥</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>
                  Target Audience: {audienceCount} Recipients
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Scoped strictly to your authorized academic duty privileges.
                </div>
              </div>
            </div>
            {sampleRecipients.length > 0 && (
              <button
                type="button"
                onClick={() => setShowRecipientsList(!showRecipientsList)}
                style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
              >
                {showRecipientsList ? 'Hide List' : 'View Sample Recipients'}
              </button>
            )}
          </div>

          {showRecipientsList && sampleRecipients.length > 0 && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#fff', marginBottom: 20, maxHeight: 180, overflowY: 'auto' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Sample Recipients Preview:</div>
              {sampleRecipients.map(r => (
                <div key={r.id} style={{ fontSize: 12, color: '#334155', padding: '3px 0' }}>
                  • {r.name} ({r.email}) — <span style={{ textTransform: 'capitalize', color: '#64748b' }}>{r.role}</span>
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
                background: audienceCount === 0 ? '#94a3b8' : '#3b82f6', color: '#fff',
                border: 'none', padding: '10px 24px', borderRadius: 8, fontSize: 13,
                fontWeight: 700, cursor: audienceCount === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Next: Notice Content →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Content */}
      {currentStep === 2 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>
            2. Notice Content, Category & Attachments
          </h2>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Notice Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Hackathon Registration & Google Form Deadline"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
              >
                <option value="General">General Announcement</option>
                <option value="Form">Google Form / Feedback</option>
                <option value="Event">Event / Hackathon</option>
                <option value="Exam">Exam / Test Schedule</option>
                <option value="Placement">Placement / Internship</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: 24 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: urgent ? '#dc2626' : '#475569' }}>
                <input
                  type="checkbox"
                  checked={urgent}
                  onChange={e => setUrgent(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                🚨 Pin as High Priority / Urgent Notice
              </label>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Notice Body</label>
            <textarea
              rows={6}
              required
              placeholder="Provide notice announcement text. You can mention natural dates like 'Submit by 28 Nov 2026, 17:00' or 'due next Friday'..."
              value={body}
              onChange={e => setBody(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box', lineHeight: 1.5 }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Form / Resource Link (Optional)</label>
            <input
              type="url"
              placeholder="e.g. https://forms.gle/sampleform"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#475569' }}>
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={e => setSendEmail(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              Also dispatch email copy via institutional mail adapter
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleGoToStep3}
              style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Next: Detect Deadlines →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Detected Deadlines */}
      {currentStep === 3 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
            3. Automated Deadline & Milestone Extraction
          </h2>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 18 }}>
            Parser timezone: <strong>Asia/Kolkata (IST)</strong>. Confirm, edit, or remove detected deadlines before broadcast.
          </p>

          {/* List of extracted deadlines */}
          {deadlines.length === 0 ? (
            <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, padding: 20, textAlign: 'center', color: '#64748b', marginBottom: 20, fontSize: 13 }}>
              ℹ️ No dates automatically detected in notice text. You can add one manually below or proceed.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {deadlines.map((dl, idx) => (
                <div key={idx} style={{
                  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        background: dl.kind === 'deadline' ? '#fee2e2' : '#f3e8ff',
                        color: dl.kind === 'deadline' ? '#b91c1c' : '#7e22ce',
                        padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11, textTransform: 'uppercase',
                      }}>
                        {dl.kind}
                      </span>
                      <strong style={{ fontSize: 14, color: '#1e293b' }}>{dl.label}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      Date: {new Date(dl.at).toLocaleString()} (Source: {dl.source})
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveDeadline(idx)}
                    style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    ✕ Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Manual Deadline Adder */}
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, border: '1px solid #e2e8f0', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>+ Add Date Milestone Manually</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px auto', gap: 10 }}>
              <input
                type="text"
                placeholder="Label, e.g. Registration closes"
                value={manualLabel}
                onChange={e => setManualLabel(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
              <input
                type="datetime-local"
                value={manualDate}
                onChange={e => setManualDate(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
              <select
                value={manualKind}
                onChange={e => setManualKind(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              >
                <option value="deadline">Deadline</option>
                <option value="event">Event Date</option>
              </select>
              <button
                type="button"
                onClick={handleAddManualDeadline}
                style={{ background: '#f1f5f9', color: '#3b82f6', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Add
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Next: Final Preview & Broadcast →
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Preview & Send */}
      {currentStep === 4 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
            4. Preview Exactly What Students Receive
          </h2>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 18 }}>
            Review layout and confirm broadcast delivery to <strong>{audienceCount} recipients</strong>.
          </p>

          {/* Student Card Preview */}
          <div style={{
            background: urgent ? '#fff1f2' : '#f8fafc',
            border: `2px solid ${urgent ? '#fca5a5' : '#cbd5e1'}`,
            borderRadius: 14, padding: 20, marginBottom: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
                  {category}
                </span>
                {urgent && (
                  <span style={{ background: '#dc2626', color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 800, fontSize: 11 }}>
                    🚨 URGENT
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, color: '#64748b' }}>From: {user?.name || 'Faculty Member'}</span>
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: '0 0 10px 0' }}>{title}</h3>
            <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: '0 0 14px 0' }}>{body}</p>

            {linkUrl && (
              <a
                href={linkUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-block', background: '#3b82f6', color: '#fff', padding: '8px 16px',
                  borderRadius: 6, fontWeight: 700, fontSize: 13, textDecoration: 'none', marginBottom: 14,
                }}
              >
                🔗 Open Google Form / Link →
              </a>
            )}

            {deadlines.length > 0 && (
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                  ⏰ Synced to Student Tasks & Calendar:
                </div>
                {deadlines.map((d, i) => (
                  <div key={i} style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>
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
              style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={createNoticeMutation.isPending}
              onClick={handleFinalSubmit}
              style={{
                background: createNoticeMutation.isPending ? '#94a3b8' : '#22c55e',
                color: '#fff', border: 'none', padding: '12px 30px', borderRadius: 8,
                fontSize: 14, fontWeight: 700, cursor: createNoticeMutation.isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {createNoticeMutation.isPending ? 'Broadcasting Notice...' : `Broadcast Notice to ${audienceCount} Recipients →`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
