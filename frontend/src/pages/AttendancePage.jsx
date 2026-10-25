import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Sparkles, History, UploadCloud, CheckCircle2, AlertTriangle, Download, ArrowRight } from 'lucide-react';
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
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
          Attendance Management & Buffer Engine
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Track buffers, simulate future absences, review history, and {isFaculty ? 'upload class attendance via Excel/CSV' : 'view requirement metrics'}.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        <TabButton icon={<Shield size={14} />} label="Buffers & Courses" active={activeTab === 'buffer'} onClick={() => setActiveTab('buffer')} />
        <TabButton icon={<Sparkles size={14} />} label="What-If Simulator" active={activeTab === 'simulator'} onClick={() => setActiveTab('simulator')} />
        <TabButton icon={<History size={14} />} label="Attendance History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
        {isFaculty && (
          <TabButton icon={<UploadCloud size={14} />} label="Excel / CSV Upload" active={activeTab === 'upload'} onClick={() => setActiveTab('upload')} />
        )}
      </div>

      {/* TAB 1: Buffers & Courses */}
      {activeTab === 'buffer' && (
        <div>
          {loadingDash && <LoadingScreen msg="Loading attendance metrics..." />}
          {dash && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
              {dash.courses.map((course) => {
                const isShortfall = course.buffer != null && course.buffer < 0;
                const isZero = course.buffer === 0;
                const bufferBg = isShortfall ? 'var(--crit-bg)' : isZero ? 'var(--watch-bg)' : 'var(--ok-bg)';
                const bufferColor = isShortfall ? 'var(--crit-fg)' : isZero ? 'var(--watch-fg)' : 'var(--ok-fg)';

                return (
                  <div
                    key={course.course_id}
                    style={{
                      background: 'var(--surface)',
                      borderRadius: 'var(--radius-card)',
                      padding: 24,
                      border: '1px solid var(--border)',
                      boxShadow: 'var(--shadow-card)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ background: 'var(--bg)', color: 'var(--accent)', fontWeight: 600, fontSize: 12, padding: '2px 8px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)' }}>
                        {course.code}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: course.attendance_pct >= 75 ? 'var(--ok-fg)' : 'var(--crit-fg)', fontVariantNumeric: 'tabular-nums' }}>
                        {course.attendance_pct != null ? `${course.attendance_pct}%` : 'N/A'}
                      </span>
                    </div>

                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 16, margin: '0 0 16px 0' }}>
                      {course.name}
                    </h3>

                    {/* Buffer Pill */}
                    <div style={{
                      background: bufferBg,
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-card)',
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 16,
                    }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>LEAVE BUFFER</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: bufferColor, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                          {course.buffer != null ? `${course.buffer} Classes` : 'Insufficient Data'}
                        </div>
                      </div>
                      <div style={{ color: bufferColor }}>
                        {isShortfall ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
                      </div>
                    </div>

                    {/* Details breakdown */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center', background: 'var(--bg)', padding: 12, borderRadius: 'var(--radius-input)', border: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>{course.attended}/{course.held}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Attended</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{course.required || '—'}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Target (75%)</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--watch-fg)', fontVariantNumeric: 'tabular-nums' }}>{course.still_need != null ? course.still_need : '—'}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Still Needed</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
                      {course.status_message}
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
        <div style={{ maxWidth: 680, background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 28, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 6 }}>
            What-If Leave & Absence Simulator
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
            Simulate the impact of missing future classes before taking leave. See your new buffer and projected percentage.
          </p>

          <form onSubmit={handleSimulate} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 6 }}>
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
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 8 }}>
                Number of future classes you might miss: <strong style={{ color: 'var(--accent)' }}>{missCount}</strong>
              </label>
              <input
                type="range"
                min="1"
                max="15"
                value={missCount}
                onChange={(e) => setMissCount(e.target.value)}
                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
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
                background: 'var(--accent)',
                color: 'var(--on-dark)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                padding: '12px 20px',
                fontWeight: 600,
                fontSize: 14,
                cursor: simMut.isPending ? 'not-allowed' : 'pointer',
                opacity: simMut.isPending ? 0.7 : 1,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {simMut.isPending ? 'Simulating…' : 'Run Simulation'} <ArrowRight size={16} />
            </button>
          </form>

          {/* Simulation Output Card */}
          {simulationResult && (
            <div style={{
              marginTop: 24,
              padding: 20,
              borderRadius: 'var(--radius-card)',
              background: simulationResult.is_recoverable ? 'var(--ok-bg)' : 'var(--crit-bg)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ color: simulationResult.is_recoverable ? 'var(--ok-fg)' : 'var(--crit-fg)' }}>
                  {simulationResult.is_recoverable ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                </div>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 600, color: simulationResult.is_recoverable ? 'var(--ok-fg)' : 'var(--crit-fg)', margin: 0 }}>
                    {simulationResult.is_recoverable ? 'Absence is Recoverable' : 'Target Unrecoverable!'}
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--ink-900)', marginTop: 2 }}>
                    Missing {simulationResult.miss_count} more class(es) in this course
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 14 }}>
                <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 'var(--radius-input)', textAlign: 'center', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Current → Simulated Buffer</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                    {simulationResult.current_buffer != null ? simulationResult.current_buffer : '—'} →{' '}
                    <span style={{ color: simulationResult.simulated_buffer < 0 ? 'var(--crit-fg)' : 'var(--ok-fg)' }}>
                      {simulationResult.simulated_buffer != null ? simulationResult.simulated_buffer : '—'}
                    </span>
                  </div>
                </div>

                <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 'var(--radius-input)', textAlign: 'center', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Current → Simulated %</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-900)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                    {simulationResult.current_attendance_pct != null ? `${simulationResult.current_attendance_pct}%` : '—'} →{' '}
                    <span style={{ color: simulationResult.simulated_attendance_pct < 75 ? 'var(--crit-fg)' : 'var(--ok-fg)' }}>
                      {simulationResult.simulated_attendance_pct != null ? `${simulationResult.simulated_attendance_pct}%` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 13, color: 'var(--ink-900)', lineHeight: 1.5, margin: 0 }}>
                {simulationResult.impact_description || simulationResult.status_message}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Attendance History */}
      {activeTab === 'history' && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 28, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>Detailed Session History</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Review your past attendance records session by session.</p>
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
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                Total Sessions Conducted: <strong style={{ color: 'var(--ink-900)' }}>{historyData.total_sessions}</strong>
              </div>

              {historyData.history?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No recorded sessions found.</div>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11 }}>Session #</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11 }}>Date</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.history.map((rec, idx) => (
                        <tr key={rec.session_id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>#{idx + 1}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>{rec.date}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: 'var(--radius-pill)',
                              fontSize: 11,
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              background: rec.status === 'present' ? 'var(--ok-bg)' : rec.status === 'late' ? 'var(--watch-bg)' : 'var(--crit-bg)',
                              color: rec.status === 'present' ? 'var(--ok-fg)' : rec.status === 'late' ? 'var(--watch-fg)' : 'var(--crit-fg)',
                            }}>
                              {rec.status === 'present' ? 'Present' : rec.status === 'late' ? 'Late' : 'Absent'}
                            </span>
                          </td>
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

      {/* TAB 4: Faculty Excel / CSV Upload */}
      {activeTab === 'upload' && isFaculty && (
        <div style={{ maxWidth: 740, background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 28, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 6 }}>
            Direct Excel & Spreadsheet Attendance Upload
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
            Upload class attendance sheets directly via CSV or XLSX. Uploads are editable: re-uploading an existing date will safely update previously marked records.
          </p>

          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 6 }}>
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
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    color: 'var(--accent)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Download size={14} /> Download Template
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 6 }}>
                Spreadsheet File (.csv, .xlsx)
              </label>
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => setUploadFile(e.target.files[0])}
                style={{ ...inputStyle, padding: '10px' }}
                required
              />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                Required headers: <code>roll_no, date, status</code> (Accepted statuses: present / absent / late or P / A / L)
              </div>
            </div>

            {uploadError && <ErrorMsg msg={uploadError} />}

            <button
              type="submit"
              disabled={uploadMut.isPending}
              style={{
                background: 'var(--accent)',
                color: 'var(--on-dark)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                padding: '12px 24px',
                fontWeight: 600,
                fontSize: 14,
                cursor: uploadMut.isPending ? 'not-allowed' : 'pointer',
                opacity: uploadMut.isPending ? 0.7 : 1,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <UploadCloud size={16} />
              {uploadMut.isPending ? 'Processing File & Calculating Risk…' : 'Upload & Process Attendance'}
            </button>
          </form>

          {/* Results Summary */}
          {uploadResult && (
            <div style={{ marginTop: 24, padding: 20, background: 'var(--bg)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={16} /> Ingest Complete: {uploadResult.filename}
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, textAlign: 'center', marginBottom: 16 }}>
                <StatPill label="Total Rows" val={uploadResult.total_rows} color="var(--ink-900)" />
                <StatPill label="Processed" val={uploadResult.processed} color="var(--ok-fg)" />
                <StatPill label="Updated Dupes" val={uploadResult.skipped_duplicates} color="var(--watch-fg)" />
                <StatPill label="Errors" val={uploadResult.error_count} color={uploadResult.error_count > 0 ? 'var(--crit-fg)' : 'var(--ok-fg)'} />
              </div>

              {uploadResult.error_count > 0 && (
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--crit-fg)', marginBottom: 8 }}>
                    Row-level Errors ({uploadResult.error_count})
                  </h4>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-input)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', background: 'var(--surface)' }}>
                      <thead>
                        <tr style={{ background: 'var(--crit-bg)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px' }}>Row</th>
                          <th style={{ padding: '8px 12px' }}>Roll No</th>
                          <th style={{ padding: '8px 12px' }}>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadResult.errors.map((err, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px 12px' }}>{err.row}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{err.roll_no}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--crit-fg)' }}>{err.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'var(--accent)' : 'var(--surface)',
        color: active ? 'var(--on-dark)' : 'var(--text-muted)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-pill)',
        padding: '8px 16px',
        fontWeight: 600,
        fontSize: 13,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        transition: 'all 0.15s',
      }}
    >
      {icon} {label}
    </button>
  );
}

function StatPill({ label, val, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-input)', padding: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{val}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-input)',
  fontSize: 13,
  background: 'var(--bg)',
  color: 'var(--ink-900)',
  outline: 'none',
  boxSizing: 'border-box',
};
