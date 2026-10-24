import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi, dashboardApi, courseApi } from '../api/endpoints.js';
import { useAuth } from '../app/AuthContext.jsx';
import { LoadingScreen, ErrorMsg } from './DashboardPage.jsx';

export default function AttendancePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isFaculty = user?.role === 'faculty' || user?.role === 'admin' || user?.role === 'coordinator';

  const [activeTab, setActiveTab] = useState('buffer'); // 'buffer' | 'simulator' | 'upload' | 'history'

  // Selected course for simulator / upload / history
  const [selectedCourseId, setSelectedCourseId] = useState('');

  // Simulator state
  const [missCount, setMissCount] = useState(1);
  const [simulationResult, setSimulationResult] = useState(null);

  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  // Fetch student dashboard for enrolled courses
  const { data: dash, isLoading: loadingDash } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.getDashboard().then(r => r.data),
    enabled: !isFaculty || activeTab === 'simulator',
  });

  // Fetch all courses for faculty dropdown
  const { data: allCourses } = useQuery({
    queryKey: ['all-courses'],
    queryFn: () => courseApi.list().then(r => r.data?.items || r.data || []),
    enabled: isFaculty,
  });

  const coursesList = isFaculty ? (allCourses || []) : (dash?.courses || []);

  // Simulator mutation
  const simMut = useMutation({
    mutationFn: ({ courseId, count }) => dashboardApi.simulate(courseId, count),
    onSuccess: (res) => setSimulationResult(res.data),
    onError: (err) => alert(err?.response?.data?.detail || 'Simulation failed.'),
  });

  const handleSimulate = (e) => {
    e.preventDefault();
    const cid = selectedCourseId || coursesList[0]?.course_id || coursesList[0]?.id;
    if (!cid) return alert('Please select a course first.');
    simMut.mutate({ courseId: Number(cid), count: Number(missCount) });
  };

  // Upload mutation
  const uploadMut = useMutation({
    mutationFn: ({ courseId, file }) => attendanceApi.uploadFile(courseId, file),
    onSuccess: (res) => {
      setUploadResult(res.data);
      setUploadError(null);
      setUploadFile(null);
      qc.invalidateQueries(['dashboard']);
      qc.invalidateQueries(['calendar']);
    },
    onError: (err) => {
      setUploadError(err?.response?.data?.detail || 'Upload failed. Check file format.');
      setUploadResult(null);
    },
  });

  const handleUpload = (e) => {
    e.preventDefault();
    if (!selectedCourseId) return alert('Please select a course.');
    if (!uploadFile) return alert('Please choose a .csv or .xlsx file to upload.');
    uploadMut.mutate({ courseId: Number(selectedCourseId), file: uploadFile });
  };

  const handleDownloadTemplate = async () => {
    if (!selectedCourseId) return alert('Please select a course first.');
    try {
      const res = await attendanceApi.downloadTemplate(selectedCourseId);
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_template_course_${selectedCourseId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Could not download template.');
    }
  };

  // Attendance history query
  const effectiveCourseId = selectedCourseId || coursesList[0]?.course_id || coursesList[0]?.id;
  const studentId = user?.id;

  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ['attendance-history', studentId, effectiveCourseId],
    queryFn: () => attendanceApi.getHistory(studentId, effectiveCourseId).then(r => r.data),
    enabled: activeTab === 'history' && !!studentId && !!effectiveCourseId,
  });

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>
          📋 Attendance Management & Buffer Engine
        </h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
          Track buffers, simulate future absences, review history, and {isFaculty ? 'upload class attendance via Excel/CSV' : 'view requirement metrics'}.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
        <TabButton label="🛡️ Buffers & Courses" active={activeTab === 'buffer'} onClick={() => setActiveTab('buffer')} />
        <TabButton label="🔮 What-If Simulator" active={activeTab === 'simulator'} onClick={() => setActiveTab('simulator')} />
        <TabButton label="📜 Attendance History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
        {isFaculty && (
          <TabButton label="📤 Excel / CSV Upload" active={activeTab === 'upload'} onClick={() => setActiveTab('upload')} />
        )}
      </div>

      {/* TAB 1: Buffers & Courses */}
      {activeTab === 'buffer' && (
        <div>
          {loadingDash && <LoadingScreen msg="Loading attendance metrics..." />}
          {dash && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {dash.courses.map((course) => {
                const isShortfall = course.buffer != null && course.buffer < 0;
                const isZero = course.buffer === 0;
                const bufferBg = isShortfall ? '#fef2f2' : isZero ? '#fffbeb' : '#f0fdf4';
                const bufferColor = isShortfall ? '#dc2626' : isZero ? '#d97706' : '#16a34a';

                return (
                  <div
                    key={course.course_id}
                    style={{
                      background: '#fff',
                      borderRadius: 12,
                      padding: 20,
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 700, fontSize: 12, padding: '2px 8px', borderRadius: 4 }}>
                        {course.code}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: course.attendance_pct >= 75 ? '#16a34a' : '#dc2626' }}>
                        {course.attendance_pct != null ? `${course.attendance_pct}%` : 'N/A'}
                      </span>
                    </div>

                    <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', marginBottom: 14 }}>
                      {course.name}
                    </h3>

                    {/* Buffer Pill */}
                    <div style={{
                      background: bufferBg,
                      border: `1px solid ${bufferColor}40`,
                      borderRadius: 8,
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 16,
                    }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>LEAVE BUFFER</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: bufferColor }}>
                          {course.buffer != null ? `${course.buffer} Classes` : 'Insufficient Data'}
                        </div>
                      </div>
                      <span style={{ fontSize: 24 }}>{isShortfall ? '⛔' : isZero ? '⚠️' : '✅'}</span>
                    </div>

                    {/* Details breakdown */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center', background: '#f8fafc', padding: 10, borderRadius: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{course.attended}/{course.held}</div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>Attended</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#2563eb' }}>{course.required || '—'}</div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>Target (75%)</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#d97706' }}>{course.still_need != null ? course.still_need : '—'}</div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>Still Needed</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 12, fontSize: 12, color: '#475569' }}>
                      ℹ️ {course.status_message}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: What-If Attendance Simulator */}
      {activeTab === 'simulator' && (
        <div style={{ maxWidth: 680, background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
            🔮 What-If Leave & Absence Simulator
          </h2>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
            Simulate the impact of missing future classes before taking leave. See your new buffer and projected percentage.
          </p>

          <form onSubmit={handleSimulate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Select Course
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                style={inputStyle}
              >
                <option value="">-- Choose Course --</option>
                {coursesList.map(c => (
                  <option key={c.course_id || c.id} value={c.course_id || c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Number of future classes you might miss: <strong style={{ color: '#2563eb' }}>{missCount}</strong>
              </label>
              <input
                type="range"
                min="1"
                max="15"
                value={missCount}
                onChange={(e) => setMissCount(e.target.value)}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                <span>1 class</span>
                <span>5 classes</span>
                <span>10 classes</span>
                <span>15 classes</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={simMut.isPending}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 20px',
                fontWeight: 600,
                cursor: simMut.isPending ? 'not-allowed' : 'pointer',
                opacity: simMut.isPending ? 0.7 : 1,
              }}
            >
              {simMut.isPending ? 'Simulating…' : 'Run Simulation →'}
            </button>
          </form>

          {/* Simulation Output Card */}
          {simulationResult && (
            <div style={{
              marginTop: 24,
              padding: 20,
              borderRadius: 12,
              background: simulationResult.is_recoverable ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${simulationResult.is_recoverable ? '#86efac' : '#fca5a5'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 24 }}>{simulationResult.is_recoverable ? '🟢' : '🔴'}</span>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: simulationResult.is_recoverable ? '#166534' : '#991b1b' }}>
                    {simulationResult.is_recoverable ? 'Absence is Recoverable' : 'Target Unrecoverable!'}
                  </h3>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Missing {simulationResult.miss_count} more class(es) in this course
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 14 }}>
                <div style={{ background: '#fff', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Current → Simulated Buffer</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginTop: 4 }}>
                    {simulationResult.current_buffer != null ? simulationResult.current_buffer : '—'} →{' '}
                    <span style={{ color: simulationResult.simulated_buffer < 0 ? '#dc2626' : '#16a34a' }}>
                      {simulationResult.simulated_buffer != null ? simulationResult.simulated_buffer : '—'}
                    </span>
                  </div>
                </div>

                <div style={{ background: '#fff', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Current → Simulated %</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginTop: 4 }}>
                    {simulationResult.current_attendance_pct != null ? `${simulationResult.current_attendance_pct}%` : '—'} →{' '}
                    <span style={{ color: simulationResult.simulated_attendance_pct < 75 ? '#dc2626' : '#16a34a' }}>
                      {simulationResult.simulated_attendance_pct != null ? `${simulationResult.simulated_attendance_pct}%` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 13, color: '#334151', lineHeight: 1.5 }}>
                {simulationResult.impact_description || simulationResult.status_message}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Attendance History */}
      {activeTab === 'history' && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>Detailed Session History</h2>
              <p style={{ color: '#64748b', fontSize: 13 }}>Review your past attendance records session by session.</p>
            </div>

            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              style={{ ...inputStyle, width: 'auto', minWidth: 200 }}
            >
              {coursesList.map(c => (
                <option key={c.course_id || c.id} value={c.course_id || c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          {loadingHistory && <LoadingScreen msg="Loading history..." />}

          {historyData && (
            <div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
                Total Sessions Conducted: <strong>{historyData.total_sessions}</strong>
              </div>

              {historyData.history?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No recorded sessions found.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px' }}>Session #</th>
                      <th style={{ padding: '10px 14px' }}>Date</th>
                      <th style={{ padding: '10px 14px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.history.map((rec, idx) => (
                      <tr key={rec.session_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', color: '#64748b' }}>#{idx + 1}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{rec.date}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: 9999,
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: rec.status === 'present' ? '#f0fdf4' : rec.status === 'late' ? '#fffbeb' : '#fef2f2',
                            color: rec.status === 'present' ? '#16a34a' : rec.status === 'late' ? '#d97706' : '#dc2626',
                          }}>
                            {rec.status === 'present' ? '✓ Present' : rec.status === 'late' ? '⏱ Late' : '✗ Absent'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Faculty Excel / CSV Upload */}
      {activeTab === 'upload' && isFaculty && (
        <div style={{ maxWidth: 740, background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
            📤 Direct Excel & Spreadsheet Attendance Upload
          </h2>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
            Upload class attendance sheets directly via CSV or XLSX. Uploads are editable: re-uploading an existing date will safely update previously marked records.
          </p>

          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Target Course
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                  required
                >
                  <option value="">-- Select Course --</option>
                  {coursesList.map(c => (
                    <option key={c.course_id || c.id} value={c.course_id || c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  📥 Download Template
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Spreadsheet File (.csv, .xlsx)
              </label>
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => setUploadFile(e.target.files[0])}
                style={{ ...inputStyle, padding: '8px' }}
                required
              />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                Required headers: <code>roll_no, date, status</code> (Accepted statuses: present / absent / late or P / A / L)
              </div>
            </div>

            {uploadError && <ErrorMsg msg={uploadError} />}

            <button
              type="submit"
              disabled={uploadMut.isPending}
              style={{
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '12px 20px',
                fontWeight: 600,
                cursor: uploadMut.isPending ? 'not-allowed' : 'pointer',
                opacity: uploadMut.isPending ? 0.7 : 1,
              }}
            >
              {uploadMut.isPending ? 'Processing File & Calculating Risk…' : '🚀 Upload & Process Attendance'}
            </button>
          </form>

          {/* Results Summary */}
          {uploadResult && (
            <div style={{ marginTop: 24, padding: 20, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#166534', marginBottom: 10 }}>
                ✅ Ingest Complete: {uploadResult.filename}
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, textAlign: 'center', marginBottom: 16 }}>
                <StatPill label="Total Rows" val={uploadResult.total_rows} color="#1e293b" />
                <StatPill label="Processed" val={uploadResult.processed} color="#16a34a" />
                <StatPill label="Updated Dupes" val={uploadResult.skipped_duplicates} color="#d97706" />
                <StatPill label="Errors" val={uploadResult.error_count} color={uploadResult.error_count > 0 ? '#dc2626' : '#16a34a'} />
              </div>

              {uploadResult.error_count > 0 && (
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>
                    ⚠️ Row-level Errors ({uploadResult.error_count})
                  </h4>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', background: '#fff', borderRadius: 6 }}>
                    <thead>
                      <tr style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', textAlign: 'left' }}>
                        <th style={{ padding: '6px 10px' }}>Row</th>
                        <th style={{ padding: '6px 10px' }}>Roll No</th>
                        <th style={{ padding: '6px 10px' }}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadResult.errors.map((err, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 10px' }}>{err.row}</td>
                          <td style={{ padding: '6px 10px', fontWeight: 600 }}>{err.roll_no}</td>
                          <td style={{ padding: '6px 10px', color: '#dc2626' }}>{err.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? '#1e293b' : 'transparent',
        color: active ? '#fff' : '#64748b',
        border: 'none',
        borderRadius: 8,
        padding: '8px 16px',
        fontWeight: active ? 700 : 500,
        fontSize: 13,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}

function StatPill({ label, val, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{val}</div>
      <div style={{ fontSize: 10, color: '#94a3b8' }}>{label}</div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};
