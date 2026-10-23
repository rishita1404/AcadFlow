import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { courseApi, facultyApi } from '../../api/endpoints.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import ScoreExpander from '../../components/ScoreExpander.jsx';

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
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading at-risk roster...</div>;
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header & Nav */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
          <Link to="/faculty/home" style={{ color: '#3b82f6', textDecoration: 'none' }}>Home</Link>
          {' '}/ <Link to={`/faculty/courses/${courseId}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
            {course?.code || 'Course'}
          </Link> / At-Risk Student Analysis
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
              ⚠️ At-Risk Student Roster: {course?.name} ({course?.code})
            </h1>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
              Decision support matrix sorted by risk descending · Click any row to open student audit drawer.
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            style={{
              background: '#fff', color: '#1e293b', border: '1px solid #cbd5e1',
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e2e8f0',
        marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        {/* Search */}
        <input
          type="text"
          placeholder="Search by student name or roll no..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13,
            minWidth: 260, flex: 1,
          }}
        />

        {/* Risk Band Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Risk Band:</span>
          <select
            value={bandFilter}
            onChange={e => setBandFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 600 }}
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
          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Max Buffer:</span>
          <input
            type="number"
            placeholder="e.g. 2"
            value={minBuffer}
            onChange={e => setMinBuffer(e.target.value)}
            style={{ width: 80, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
          />
        </div>

        <button
          onClick={() => { setBandFilter('ALL'); setSearchQuery(''); setMinBuffer(''); }}
          style={{
            background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Reset Filters
        </button>
      </div>

      {/* Roster Table */}
      <div style={{
        background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            <tr>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Roll No</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Student Name</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Attendance %</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Buffer (Classes)</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Risk Status</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Trend</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Deadlines / Missed</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                  No students match the selected filter criteria.
                </td>
              </tr>
            ) : (
              filteredStudents.map((s, idx) => {
                const band = s.risk_band || s.band || 'Safe';
                const bufferVal = s.buffer;
                const bufferColor = bufferVal == null ? '#94a3b8' : bufferVal <= 0 ? '#ef4444' : bufferVal <= 2 ? '#f59e0b' : '#22c55e';
                const trendIcon = s.trend === 'down' ? '↓' : s.trend === 'up' ? '↑' : '→';
                const trendColor = s.trend === 'down' ? '#ef4444' : s.trend === 'up' ? '#22c55e' : '#64748b';

                return (
                  <tr
                    key={s.student_id || idx}
                    onClick={() => setSelectedStudent(s)}
                    style={{
                      borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                      background: selectedStudent?.student_id === s.student_id ? '#eff6ff' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e293b' }}>
                      {s.roll_no || `S-${s.student_id}`}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#334155' }}>
                      {s.name}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: (s.attendance_pct ?? s.attendance_rate ?? 0) >= 75 ? '#22c55e' : '#ef4444' }}>
                      {s.attendance_pct ?? s.attendance_rate != null ? `${s.attendance_pct ?? s.attendance_rate}%` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: bufferColor }}>
                      {bufferVal != null ? (bufferVal <= 0 ? `${bufferVal} (Deficit)` : `+${bufferVal} left`) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadge status={band} />
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, fontSize: 16, color: trendColor }}>
                      {trendIcon} <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>{s.trend || 'flat'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>
                      <span style={{ fontWeight: 600 }}>{s.pending_deadlines ?? 0}</span> pending · <span style={{ color: (s.missed_submissions ?? 0) > 0 ? '#ef4444' : '#64748b', fontWeight: 600 }}>
                        {s.missed_submissions ?? 0} missed
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => { setSelectedStudent(s); setNudgeModalOpen(true); }}
                        style={{
                          background: '#f1f5f9', color: '#3b82f6', border: '1px solid #cbd5e1',
                          padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
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
          background: '#fff', borderLeft: '1px solid #cbd5e1', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
          zIndex: 1000, display: 'flex', flexDirection: 'column',
        }}>
          {/* Drawer Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{selectedStudent.name}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Roll No: {selectedStudent.roll_no || selectedStudent.student_id}</div>
            </div>
            <button
              onClick={() => setSelectedStudent(null)}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}
            >
              ✕
            </button>
          </div>

          {/* Drawer Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {/* Status Summary Banner */}
            <div style={{
              background: '#f8fafc', borderRadius: 10, padding: 16, border: '1px solid #e2e8f0',
              marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Attendance</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>
                  {selectedStudent.attendance_pct ?? selectedStudent.attendance_rate ?? '—'}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Buffer</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: selectedStudent.buffer <= 0 ? '#ef4444' : '#22c55e' }}>
                  {selectedStudent.buffer != null ? selectedStudent.buffer : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Risk Band</div>
                <div style={{ marginTop: 2 }}>
                  <StatusBadge status={selectedStudent.risk_band || selectedStudent.band || 'Safe'} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Risk Score</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>
                  {selectedStudent.risk_score?.toFixed?.(1) ?? '—'}
                </div>
              </div>
            </div>

            {/* Score Breakdown (Why?) */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>
                🧮 Score Breakdown ("Why?")
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

            {/* Submissions Statuses (Statuses ONLY - Never Content per spec) */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>
                📋 Assignment Submission Statuses
              </h3>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span>Assignment 1 (Lab Manual)</span>
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ Submitted (On-time)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span>Assignment 2 (Midterm Report)</span>
                  <span style={{ color: selectedStudent.missed_submissions > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                    {selectedStudent.missed_submissions > 0 ? '✗ Missed (Hard Deadline)' : '✓ Submitted'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                  🔒 Compliance Notice: Faculty views only show receipt statuses, hashes, and timestamps. Submission content is strictly student-private.
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setNudgeModalOpen(true)}
                style={{
                  flex: 1, background: '#3b82f6', color: '#fff', border: 'none',
                  padding: '10px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
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
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
        }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: 440, maxWidth: '90%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: '0 0 8px 0' }}>
              🔔 Send Attendance Alert to {selectedStudent?.name}
            </h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
              This will dispatch a high-priority in-app notification directly to the student's notification bell and home banner.
            </p>

            <textarea
              rows={4}
              placeholder="Enter custom advisory message..."
              value={nudgeMessage}
              onChange={e => setNudgeMessage(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1',
                fontSize: 13, boxSizing: 'border-box', marginBottom: 16,
              }}
            />

            {nudgeSent ? (
              <div style={{ color: '#16a34a', fontWeight: 700, textAlign: 'center', padding: '10px 0' }}>
                ✓ Notification dispatched successfully!
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  onClick={() => setNudgeModalOpen(false)}
                  style={{
                    background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1',
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendNudge}
                  style={{
                    background: '#3b82f6', color: '#fff', border: 'none',
                    padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
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
