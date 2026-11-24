import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { departmentApi } from '../../api/endpoints.js';
import { useAuth } from '../../app/AuthContext.jsx';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  Download,
  AlertTriangle,
  Users,
  ShieldCheck,
  Flame,
  Filter,
  CheckCircle2,
  PhoneCall,
  UserCheck,
} from 'lucide-react';

export default function DeanTrends() {
  const { user } = useAuth();
  const departmentId = user?.department_id || 1;

  const [weeks, setWeeks] = useState(8);
  const [activeTab, setActiveTab] = useState('trends'); // 'trends' | 'mentors'
  const [exporting, setExporting] = useState(false);

  // 1. Fetch trends
  const { data: trends, isLoading: trendsLoading, error: trendsError } = useQuery({
    queryKey: ['department-trends', departmentId, weeks],
    queryFn: () => departmentApi.getTrends(departmentId, weeks).then((r) => r.data),
  });

  // 2. Fetch mentor load
  const { data: mentorLoad, isLoading: mentorsLoading, error: mentorsError } = useQuery({
    queryKey: ['department-mentor-load', departmentId],
    queryFn: () => departmentApi.getMentorLoad(departmentId).then((r) => r.data),
  });

  // Handle Excel Export
  async function handleExportExcel() {
    setExporting(true);
    try {
      const res = await departmentApi.exportTrends(departmentId, weeks);
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `department_${departmentId}_academic_trends_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to generate Excel export. Please check department access permissions.');
    } finally {
      setExporting(false);
    }
  }

  if (trendsLoading && !trends) {
    return (
      <div style={{ maxWidth: 1440, margin: '40px auto', padding: '0 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading department trends and risk analytics...
      </div>
    );
  }

  if (trendsError) {
    const is403 = trendsError.response?.status === 403;
    return (
      <div style={{ maxWidth: 640, margin: '60px auto', background: 'var(--surface)', padding: 32, borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🛡️</div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-900)', margin: '0 0 8px 0' }}>
          {is403 ? 'Access Restricted (Department Scope 403)' : 'Failed to Load Department Trends'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
          {is403
            ? 'Trends and mentor allocations are strictly scoped to the designated Dean of this department. Cross-department access is prohibited.'
            : 'Unable to communicate with the academic analytics service.'}
        </p>
      </div>
    );
  }

  // Format chart data
  const chartData = (trends?.weekly_risk_trends || []).map((w) => ({
    name: w.week_label,
    'Safe': w.safe,
    'Watch': w.watch,
    'At risk': w.at_risk,
    'Needs support': w.needs_support,
  }));

  const funnel = trends?.intervention_funnel || {
    flagged: 0,
    contacted: 0,
    recovered: 0,
    contact_rate_pct: 0,
    recovery_rate_pct: 0,
  };

  const hotspots = trends?.top_hotspots || [];

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 60, color: 'var(--text)' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Dean Oversight & Academic Analytics
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 700, color: 'var(--ink-900)', margin: '4px 0 0' }}>
            {trends?.department_name || 'Department'} ({trends?.department_code || 'DEPT'}) Standing
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Weekly risk distribution, course hotspots, intervention progress, and faculty mentor workload.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Window:</span>
            <select
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
              style={{
                background: 'var(--surface)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-pill)',
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <option value={4}>Last 4 Weeks</option>
              <option value={8}>Last 8 Weeks</option>
              <option value={12}>Last 12 Weeks</option>
            </select>
          </div>

          <button
            onClick={handleExportExcel}
            disabled={exporting}
            style={{
              background: 'var(--accent)',
              color: 'var(--on-dark)',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 'var(--radius-pill)',
              fontSize: 12,
              fontWeight: 600,
              cursor: exporting ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              opacity: exporting ? 0.7 : 1,
            }}
          >
            <Download size={14} />
            <span>{exporting ? 'Exporting...' : 'Export Excel Report'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab('trends')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'trends' ? '3px solid var(--accent)' : '3px solid transparent',
            color: activeTab === 'trends' ? 'var(--ink-900)' : 'var(--text-muted)',
            fontWeight: activeTab === 'trends' ? 700 : 500,
            padding: '10px 18px',
            fontSize: 14,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <TrendingUp size={16} />
          <span>Academic Trends & Hotspots</span>
        </button>

        <button
          onClick={() => setActiveTab('mentors')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'mentors' ? '3px solid var(--accent)' : '3px solid transparent',
            color: activeTab === 'mentors' ? 'var(--ink-900)' : 'var(--text-muted)',
            fontWeight: activeTab === 'mentors' ? 700 : 500,
            padding: '10px 18px',
            fontSize: 14,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Users size={16} />
          <span>Mentor Load Distribution ({mentorLoad?.total_mentors || 0})</span>
        </button>
      </div>

      {/* Tab 1: Academic Trends & Hotspots */}
      {activeTab === 'trends' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Section A: Multi-Week Trend Chart */}
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--border)',
              padding: 24,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--ink-900)' }}>
                  Weekly Risk Band Trends ({weeks} Weeks)
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Progression of student cohorts across risk classifications over the selected term window.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 11, fontWeight: 600 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#778D7A' }}></span>
                  <span>Safe</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#D4C4A8' }}></span>
                  <span>Watch</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F4D9CC', border: '1px solid #9A4A2F' }}></span>
                  <span>At risk</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#7A2E2E' }}></span>
                  <span>Needs support</span>
                </span>
              </div>
            </div>

            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      borderColor: 'var(--border)',
                      borderRadius: 10,
                      fontSize: 12,
                      boxShadow: 'var(--shadow-card)',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <Bar dataKey="Safe" stackId="a" fill="#778D7A" />
                  <Bar dataKey="Watch" stackId="a" fill="#D4C4A8" />
                  <Bar dataKey="At risk" stackId="a" fill="#C97A63" />
                  <Bar dataKey="Needs support" stackId="a" fill="#7A2E2E" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Section B: Side-by-Side Funnel & Hotspots */}
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24, alignItems: 'start' }}>
            {/* 1. Intervention Funnel */}
            <div
              style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--border)',
                padding: 20,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Filter size={18} color="var(--accent)" />
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--ink-900)' }}>
                  Intervention Funnel
                </h3>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                Department support conversion from risk detection to recorded student recovery.
              </p>

              {/* Funnel Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Stage 1: Flagged */}
                <div
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-input)',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>1. Flagged Needing Support</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--crit-fg)' }}>{funnel.flagged}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Students identified in Watch / Needs Support bands
                  </div>
                </div>

                {/* Stage 2: Contacted */}
                <div
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-input)',
                    padding: '12px 14px',
                    marginLeft: 12,
                    borderLeft: '4px solid var(--accent)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>2. Support Contacted</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{funnel.contacted}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-900)', marginTop: 4, fontWeight: 600 }}>
                    <span>Outreach Coverage:</span>
                    <span>{funnel.contact_rate_pct}%</span>
                  </div>
                </div>

                {/* Stage 3: Recovered */}
                <div
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-input)',
                    padding: '12px 14px',
                    marginLeft: 24,
                    borderLeft: '4px solid #778D7A',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>3. Recovered to Eligibility</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#0D1B2A' }}>{funnel.recovered}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-900)', marginTop: 4, fontWeight: 600 }}>
                    <span>Recovery Conversion:</span>
                    <span>{funnel.recovery_rate_pct}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Hotspots Table */}
            <div
              style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--border)',
                padding: 20,
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Flame size={18} color="var(--risk-fg)" />
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--ink-900)' }}>
                    Course & Section Hotspots
                  </h3>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Ranked by share of students needing support
                </span>
              </div>

              {hotspots.length === 0 ? (
                <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-input)', padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No active academic risk hotspots identified in this department.
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-input)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                    <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      <tr>
                        <th style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 600 }}>Course & Code</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 600 }}>Section</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 600 }}>Enrolled</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 600 }}>Needing Support</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 600 }}>Share (%)</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 600 }}>Suggested Next Step</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hotspots.map((h, i) => {
                        const isSevere = h.support_share_pct >= 30;
                        return (
                          <tr key={`${h.course_id}-${h.section}-${i}`} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--ink-900)' }}>
                              <span>{h.course_code}</span>
                              <div style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>{h.course_name}</div>
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: 600 }}>Section {h.section}</td>
                            <td style={{ padding: '10px 14px' }}>{h.total_students}</td>
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: isSevere ? 'var(--crit-fg)' : 'var(--text)' }}>
                              {h.students_needing_support} students
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span
                                style={{
                                  background: isSevere ? 'var(--crit-bg)' : 'var(--watch-bg)',
                                  color: isSevere ? 'var(--crit-fg)' : 'var(--watch-fg)',
                                  padding: '3px 8px',
                                  borderRadius: 'var(--radius-pill)',
                                  fontWeight: 700,
                                  fontSize: 11,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                {isSevere ? '⚠️' : 'ℹ️'} {h.support_share_pct}%
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                              {isSevere ? 'Recommend faculty review' : 'Monitor session buffer'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Mentor Load Distribution */}
      {activeTab === 'mentors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Summary metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 18, boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Faculty Mentors</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink-900)', marginTop: 4 }}>{mentorLoad?.total_mentors || 0}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Assigned to department cohorts</div>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 18, boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Mentored Students</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>{mentorLoad?.total_mentees || 0}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Under designated mentorship</div>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 18, boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg Mentees Per Mentor</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0D1B2A', marginTop: 4 }}>
                {mentorLoad?.total_mentors ? (mentorLoad.total_mentees / mentorLoad.total_mentors).toFixed(1) : '0'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Cohort balancing index</div>
            </div>
          </div>

          {/* Mentor Table */}
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--border)',
              padding: 20,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--ink-900)' }}>
                  Faculty Mentor Workload & High-Risk Mentee Share
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Evaluate mentoring load equity and direct attention to mentors carrying disproportionate high-risk cohorts.
                </p>
              </div>
            </div>

            {mentorsLoading ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Loading faculty mentor distribution...
              </div>
            ) : !mentorLoad?.mentors?.length ? (
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-input)', padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No active mentor assignments recorded in this department.
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-input)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    <tr>
                      <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Faculty Mentor</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Email</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Total Mentees</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>High-Risk Mentees</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>High-Risk Share</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Open Actions</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mentorLoad.mentors.map((m) => {
                      const isHighShare = m.high_risk_share_pct >= 35;
                      return (
                        <tr key={m.mentor_id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--ink-900)' }}>
                            {m.mentor_name}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
                            {m.mentor_email}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{m.mentee_count}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: m.high_risk_mentee_count > 0 ? 'var(--crit-fg)' : 'var(--text)' }}>
                            {m.high_risk_mentee_count}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                background: isHighShare ? 'var(--crit-bg)' : 'var(--ok-bg)',
                                color: isHighShare ? 'var(--crit-fg)' : 'var(--ok-fg)',
                                padding: '3px 10px',
                                borderRadius: 'var(--radius-pill)',
                                fontWeight: 700,
                                fontSize: 11,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              {isHighShare ? '⚠️' : '✓'} {m.high_risk_share_pct}%
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {m.open_interventions_count > 0 ? (
                              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                                ⏳ {m.open_interventions_count} pending
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>✓ Up to date</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: isHighShare ? 'var(--crit-fg)' : 'var(--text-muted)', fontWeight: isHighShare ? 700 : 400 }}>
                            {isHighShare ? 'High support load' : 'Balanced cohort'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
