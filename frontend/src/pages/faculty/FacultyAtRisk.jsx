import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { courseApi, facultyApi } from '../../api/endpoints.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import ScoreExpander from '../../components/ScoreExpander.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

export default function FacultyAtRisk() {
  const { id } = useParams();
  const courseId = Number(id);

  // Filters state
  const [bandFilter, setBandFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [minBuffer, setMinBuffer] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [nudgeModalOpen, setNudgeModalOpen] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState('');
  const [nudgeSent, setNudgeSent] = useState(false);

  // Fetch course details
  const { data: course } = useQuery({
    queryKey: ['course-detail', courseId],
    queryFn: () => courseApi.getCourse(courseId).then(r => r.data),
    enabled: !!courseId,
  });

  // Fetch at-risk roster
  const { data: atRiskData, isLoading } = useQuery({
    queryKey: ['course-at-risk', courseId],
    queryFn: () => facultyApi.getAtRisk(courseId).then(r => r.data),
    enabled: !!courseId,
  });

  const students = useMemo(() => {
    if (!atRiskData) return [];
    const list = Array.isArray(atRiskData) ? atRiskData : (atRiskData.students || atRiskData.items || []);
    return list;
  }, [atRiskData]);

  // Filtered and sorted students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (bandFilter !== 'ALL' && (s.risk_band || s.band) !== bandFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.name?.toLowerCase().includes(q);
        const matchesRoll = s.roll_no?.toLowerCase().includes(q);
        if (!matchesName && !matchesRoll) return false;
      }
      if (minBuffer !== '' && s.buffer != null) {
        if (s.buffer > Number(minBuffer)) return false;
      }
      return true;
    });
  }, [students, bandFilter, searchQuery, minBuffer]);

  // CSV Export handler
  function handleExportCSV() {
    let csv = 'Roll No,Student Name,Attendance %,Buffer,Risk Band,Risk Score,Trend,Pending Deadlines,Missed Submissions\n';
    filteredStudents.forEach(s => {
      csv += `"${s.roll_no || ''}","${s.name || ''}",${s.attendance_pct ?? s.attendance_rate ?? ''},${s.buffer ?? ''},"${s.risk_band || s.band || ''}",${s.risk_score ?? ''},"${s.trend || 'flat'}",${s.pending_deadlines ?? 0},${s.missed_submissions ?? 0}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `at_risk_${course?.code || 'course'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Nudge handler
  async function handleSendNudge() {
    if (!selectedStudent) return;
    try {
      await facultyApi.nudgeStudent(
        selectedStudent.student_id || selectedStudent.user_id,
        `Academic Warning: ${course?.code || 'Course'} Attendance Alert`,
        nudgeMessage || `Your attendance buffer in ${course?.name} is currently low (${selectedStudent.buffer} classes). Please connect with your instructor.`
      );
      setNudgeSent(true);
      setTimeout(() => {
        setNudgeModalOpen(false);
        setNudgeSent(false);
      }, 1500);
    } catch {
      alert('Unable to deliver student notification');
    }
  }

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <Skeleton height={100} style={{ marginBottom: 20 }} />
        <Skeleton height={60} style={{ marginBottom: 20 }} />
        <Skeleton height={400} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40, color: 'var(--text)' }}>
      {/* Header & Nav */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          <Link to="/faculty/home" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Home</Link>
          {' '}/ <Link to={`/faculty/courses/${courseId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            {course?.code || 'Course'}
          </Link> / At-Risk Student Analysis
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
              At-Risk Student Roster: {course?.name} ({course?.code})
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              Decision support matrix sorted by risk descending · Click any row to open student audit drawer.
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            style={{
              background: 'var(--surface)', color: 'var(--ink-900)', border: '1px solid var(--border)',
              padding: '8px 16px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: 'var(--shadow-card)',
            }}
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '16px 20px', border: '1px solid var(--border)',
        marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', boxShadow: 'var(--shadow-card)',
      }}>
        {/* Search */}
        <input
          type="text"
          placeholder="Search by student name or roll no..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            padding: '8px 14px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', fontSize: 13,
            minWidth: 260, flex: 1, background: 'var(--surface)', color: 'var(--text)',
          }}
        />

        {/* Risk Band Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Risk Band:</span>
          <select
            value={bandFilter}
            onChange={e => setBandFilter(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, background: 'var(--surface)', color: 'var(--text)' }}
          >
            <option value="ALL">All Bands ({students.length})</option>
            <option value="Critical">Critical Only</option>
            <option value="At risk">At Risk Only</option>
            <option value="Watch">Watch Only</option>
            <option value="Safe">Safe</option>
          </select>
        </div>

        {/* Max Buffer Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Max Buffer:</span>
          <input
            type="number"
            placeholder="e.g. 2"
            value={minBuffer}
            onChange={e => setMinBuffer(e.target.value)}
            style={{ width: 80, padding: '8px 12px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }}
          />
        </div>

        <button
          onClick={() => { setBandFilter('ALL'); setSearchQuery(''); setMinBuffer(''); }}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Reset Filters
        </button>
      </div>

      {/* Roster Table */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Roll No</th>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Student Name</th>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Attendance %</th>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Buffer (Classes)</th>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Risk Status</th>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Trend</th>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Deadlines / Missed</th>
              <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No students match the selected filter criteria.
                </td>
              </tr>
            ) : (
              filteredStudents.map((s, idx) => {
                const band = s.risk_band || s.band || 'Safe';
                const bufferVal = s.buffer;
                const bufferColor = bufferVal == null ? 'var(--text-muted)' : bufferVal <= 0 ? 'var(--crit-fg)' : bufferVal <= 2 ? 'var(--watch-fg)' : 'var(--ok-fg)';
                const trendIcon = s.trend === 'down' ? '↓' : s.trend === 'up' ? '↑' : '→';
                const trendColor = s.trend === 'down' ? 'var(--crit-fg)' : s.trend === 'up' ? 'var(--ok-fg)' : 'var(--text-muted)';

                return (
                  <tr
                    key={s.student_id || idx}
                    onClick={() => setSelectedStudent(s)}
                    style={{
                      borderBottom: '1px solid var(--border)', cursor: 'pointer',
                      background: selectedStudent?.student_id === s.student_id ? 'var(--bg)' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--ink-900)' }}>
                      {s.roll_no || `S-${s.student_id}`}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>
                      {s.name}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: (s.attendance_pct ?? s.attendance_rate ?? 0) >= 75 ? 'var(--ok-fg)' : 'var(--crit-fg)' }}>
                      {s.attendance_pct ?? s.attendance_rate != null ? `${s.attendance_pct ?? s.attendance_rate}%` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: bufferColor }}>
                      {bufferVal != null ? (bufferVal <= 0 ? `${bufferVal} (Deficit)` : `+${bufferVal} left`) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadge status={band} />
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, fontSize: 16, color: trendColor }}>
                      {trendIcon} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>{s.trend || 'flat'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text)' }}>
                      <span style={{ fontWeight: 600 }}>{s.pending_deadlines ?? 0}</span> pending · <span style={{ color: (s.missed_submissions ?? 0) > 0 ? 'var(--crit-fg)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {s.missed_submissions ?? 0} missed
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => { setSelectedStudent(s); setNudgeModalOpen(true); }}
                        style={{
                          background: 'var(--bg)', color: 'var(--accent)', border: '1px solid var(--border)',
                          padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        🔔 Nudge
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Side Drawer for Selected Student Details */}
      {selectedStudent && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 440,
          background: 'var(--surface)', borderLeft: '1px solid var(--border)', boxShadow: 'var(--shadow-card)',
          zIndex: 1000, display: 'flex', flexDirection: 'column',
        }}>
          {/* Drawer Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--ink-900)' }}>{selectedStudent.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Roll No: {selectedStudent.roll_no || selectedStudent.student_id}</div>
            </div>
            <button
              onClick={() => setSelectedStudent(null)}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              ✕
            </button>
          </div>

          {/* Drawer Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {/* Status Summary Banner */}
            <div style={{
              background: 'var(--bg)', borderRadius: 'var(--radius-input)', padding: 16, border: '1px solid var(--border)',
              marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Attendance</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink-900)' }}>
                  {selectedStudent.attendance_pct ?? selectedStudent.attendance_rate ?? '—'}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Buffer</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: selectedStudent.buffer <= 0 ? 'var(--crit-fg)' : 'var(--ok-fg)' }}>
                  {selectedStudent.buffer != null ? selectedStudent.buffer : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Risk Band</div>
                <div style={{ marginTop: 2 }}>
                  <StatusBadge status={selectedStudent.risk_band || selectedStudent.band || 'Safe'} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Risk Score</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink-900)' }}>
                  {selectedStudent.risk_score?.toFixed?.(1) ?? '—'}
                </div>
              </div>
            </div>

            {/* Score Breakdown (Why?) */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 10 }}>
                Score Breakdown (&quot;Why?&quot;)
              </h3>
              <ScoreExpander
                formula="50% Margin + 20% Trend + 20% Deadlines + 10% Missed Submissions"
                score={selectedStudent.risk_score}
                inputs={{
                  'Margin Component': `${selectedStudent.buffer != null && selectedStudent.buffer < 0 ? 'Deficit Penalty' : 'Sufficient'}`,
                  'Trend Component': `${selectedStudent.trend || 'flat'} (${selectedStudent.trend === 'down' ? '+Penalty' : 'Stable'})`,
                  'Pending Deadlines': `${selectedStudent.pending_deadlines ?? 0} assignment(s)`,
                  'Missed Submissions': `${selectedStudent.missed_submissions ?? 0} past due`,
                }}
              />
            </div>

            {/* Submissions Statuses */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 10 }}>
                Assignment Submission Statuses
              </h3>
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-input)', padding: 12, background: 'var(--bg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span>Assignment 1 (Lab Manual)</span>
                  <span style={{ color: 'var(--ok-fg)', fontWeight: 700 }}>✓ Submitted (On-time)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span>Assignment 2 (Midterm Report)</span>
                  <span style={{ color: selectedStudent.missed_submissions > 0 ? 'var(--crit-fg)' : 'var(--ok-fg)', fontWeight: 700 }}>
                    {selectedStudent.missed_submissions > 0 ? '✗ Missed (Hard Deadline)' : '✓ Submitted'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  🔒 Compliance Notice: Faculty views only show receipt statuses, hashes, and timestamps. Submission content is strictly student-private.
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setNudgeModalOpen(true)}
                style={{
                  flex: 1, background: 'var(--accent)', color: 'var(--on-dark)', border: 'none',
                  padding: '10px 16px', borderRadius: 'var(--radius-pill)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}
              >
                Send Nudge Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nudge Confirmation Modal */}
      {nudgeModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(13,27,42,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
        }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-dialog)', padding: 24, width: 440, maxWidth: '90%', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', margin: '0 0 8px 0' }}>
              Send Attendance Alert to {selectedStudent?.name}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
              This will dispatch a high-priority in-app notification directly to the student&apos;s notification bell and home banner.
            </p>

            <textarea
              rows={4}
              placeholder="Enter custom advisory message..."
              value={nudgeMessage}
              onChange={e => setNudgeMessage(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)',
                background: 'var(--surface)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', marginBottom: 16, fontFamily: 'var(--font-sans)',
              }}
            />

            {nudgeSent ? (
              <div style={{ color: 'var(--ok-fg)', fontWeight: 700, textAlign: 'center', padding: '10px 0' }}>
                ✓ Notification dispatched successfully!
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  onClick={() => setNudgeModalOpen(false)}
                  style={{
                    background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
                    padding: '8px 16px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendNudge}
                  style={{
                    background: 'var(--accent)', color: 'var(--on-dark)', border: 'none',
                    padding: '8px 18px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Dispatch Alert
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
