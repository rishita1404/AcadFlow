import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { courseApi, attendanceApi, assignmentApi, riskApi } from '../../api/endpoints.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import BufferGauge from '../../components/BufferGauge.jsx';
import ScoreExpander from '../../components/ScoreExpander.jsx';

export default function StudentCourseDetail() {
  const { id } = useParams();
  const courseId = Number(id);
  const [tab, setTab] = useState('overview');

  const { data: course, isLoading: loadingCourse } = useQuery({
    queryKey: ['course-detail', courseId],
    queryFn: () => courseApi.get(courseId).then(r => r.data),
  });

  const { data: attendanceHistory = [] } = useQuery({
    queryKey: ['course-attendance-history', courseId],
    queryFn: () => attendanceApi.getHistory(1, courseId).then(r => r.data).catch(() => []),
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['course-assignments', courseId],
    queryFn: () => assignmentApi.list({ course_id: courseId }).then(r => r.data.items || r.data).catch(() => []),
  });

  const { data: riskData } = useQuery({
    queryKey: ['course-student-risk', courseId],
    queryFn: () => riskApi.getStudentRisk(1).then(r => r.data).catch(() => null),
  });

  if (loadingCourse) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading course details...</div>;
  }

  const tabs = [
    { key: 'overview', label: '📖 Overview' },
    { key: 'attendance', label: '📊 Attendance & Buffer' },
    { key: 'deadlines', label: '⏰ Deadlines' },
    { key: 'announcements', label: '📢 Announcements' },
    { key: 'materials', label: '📁 Materials' },
    { key: 'risk', label: '⚠️ Risk Breakdown' },
  ];

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* Course Banner */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0',
        marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: 4 }}>
                {course?.code}
              </span>
              <StatusBadge status="safe" />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: '4px 0' }}>
              {course?.name}
            </h1>
            <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
              Department: CSE · Total Classes: {course?.total_classes || 60} · Semester: Sem 5
            </p>
          </div>
          <Link
            to="/student/calendar"
            style={{
              padding: '8px 16px', background: '#eff6ff', color: '#2563eb',
              border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none',
            }}
          >
            📅 Plan Leaves for this Course →
          </Link>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 6, marginTop: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 0 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '10px 16px', border: 'none', background: 'transparent',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                color: tab === t.key ? '#2563eb' : '#64748b',
                borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Contents */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0' }}>
        {tab === 'overview' && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>Course Syllabus & Policy</h3>
            <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
              This course covers core theory, algorithmic paradigms, design techniques, and practical laboratory exercises.
              Mandatory minimum attendance threshold is <strong>75%</strong> under university regulations.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div style={infoBoxStyle}>
                <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>Schedule</div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>Mon 09:00 - 10:00, Wed 11:15 - 12:15</div>
              </div>
              <div style={infoBoxStyle}>
                <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>Office Hours</div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>Tuesday & Thursday 15:00 - 16:30 (Room 304)</div>
              </div>
              <div style={infoBoxStyle}>
                <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>Grading Scheme</div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>Assignments (30%), Mid-term (30%), End-sem (40%)</div>
              </div>
            </div>
          </div>
        )}

        {tab === 'attendance' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
              <BufferGauge bufferClasses={4} />
              <div style={infoBoxStyle}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Attendance Rate</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>78.5%</div>
                <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>✓ Above 75% required threshold</div>
              </div>
              <div style={infoBoxStyle}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Classes Held / Total</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', marginTop: 4 }}>32 / 45</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>13 future classes remaining</div>
              </div>
            </div>

            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>Attendance History Log</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', color: '#475569' }}>Session Date</th>
                  <th style={{ padding: '10px 14px', color: '#475569' }}>Status</th>
                  <th style={{ padding: '10px 14px', color: '#475569' }}>Topic / Notes</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { date: '2026-10-21', status: 'present', topic: 'Dynamic Programming - Part 2' },
                  { date: '2026-10-19', status: 'present', topic: 'Greedy Algorithms Review' },
                  { date: '2026-10-14', status: 'late', topic: 'Shortest Path Graphs' },
                  { date: '2026-10-12', status: 'absent', topic: 'Minimum Spanning Trees' },
                  { date: '2026-10-07', status: 'present', topic: 'Graph Traversals BFS/DFS' },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{row.date}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                        background: row.status === 'present' ? '#dcfce7' : row.status === 'late' ? '#fef3c7' : '#fee2e2',
                        color: row.status === 'present' ? '#15803d' : row.status === 'late' ? '#b45309' : '#dc2626',
                        textTransform: 'capitalize',
                      }}>
                        {row.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{row.topic}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'deadlines' && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>Course Assignments & Submissions</h3>
            {assignments.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No assignments posted for this course.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {assignments.map(a => (
                  <div key={a.id} style={{
                    padding: '14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Due: {a.due_date} · Max Score: 100</div>
                    </div>
                    <Link
                      to={`/student/assignments/${a.id}`}
                      style={{
                        padding: '6px 14px', background: '#2563eb', color: '#fff',
                        borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: 'none',
                      }}
                    >
                      View & Submit →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'announcements' && (
          <div style={{ padding: 12, color: '#64748b', fontSize: 13 }}>
            <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 10 }}>
              <div style={{ fontWeight: 700, color: '#1e293b' }}>Midterm Revision Session</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                A revision Q&A session will take place this Thursday during normal lab hours. Please bring practice problems.
              </div>
            </div>
          </div>
        )}

        {tab === 'materials' && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>Authorized Course Materials</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {['Lecture 1: Asymptotic Notation.pdf', 'Lecture 2: Recurrences & Master Theorem.pdf', 'Lab Manual: Graph Algorithms.pdf'].map((f, i) => (
                <div key={i} style={{
                  padding: '10px 14px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>📄 {f}</span>
                  <button style={{ padding: '4px 10px', fontSize: 12, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }}>
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'risk' && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>Early Warning Risk Breakdown</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div style={infoBoxStyle}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Margin (Max 50)</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>12.5 / 50</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Buffer = 4 classes</div>
              </div>
              <div style={infoBoxStyle}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Trend (Max 20)</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>2.0 / 20</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Stable attendance trend</div>
              </div>
              <div style={infoBoxStyle}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Deadlines (Max 20)</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#d97706', marginTop: 4 }}>8.0 / 20</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>1 unsubmitted assignment</div>
              </div>
              <div style={infoBoxStyle}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Missed (Max 10)</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>0.0 / 10</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>No missed submissions</div>
              </div>
            </div>
            <ScoreExpander
              score={22.5}
              band="Safe"
              formulaDetails={{ margin: 12.5, trend: 2.0, deadlines: 8.0, missed: 0.0 }}
              inputs={{ attended: 26, held: 32, total_classes: 45, buffer: 4, remaining: 13 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const infoBoxStyle = {
  background: '#f8fafc',
  padding: '14px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
};
