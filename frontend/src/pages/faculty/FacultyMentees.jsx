import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { facultyApi } from '../../api/endpoints.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

const BAND_BORDER = {
  'Safe': '4px solid var(--ok-bg)',
  'Watch': '4px solid var(--watch-bg)',
  'At risk': '4px solid var(--risk-bg)',
  'Critical': '4px solid var(--crit-bg)',
  'Insufficient data': '4px solid var(--border)',
};

export default function FacultyMentees() {
  const navigate = useNavigate();
  const [bandFilter, setBandFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch mentees list
  const { data: mentees = [], isLoading, error } = useQuery({
    queryKey: ['faculty-mentees-list'],
    queryFn: () => facultyApi.getMentees().then(r => r.data || []),
  });

  const menteeList = Array.isArray(mentees) ? mentees : (mentees.items || []);

  const filteredMentees = menteeList.filter(m => {
    if (bandFilter !== 'ALL' && (m.worst_risk_band || 'Safe') !== bandFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!m.name?.toLowerCase().includes(q) && !m.roll_no?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <Skeleton height={100} style={{ marginBottom: 20 }} />
        <Skeleton height={60} style={{ marginBottom: 20 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={160} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 800, margin: '40px auto', background: 'var(--crit-bg)', border: '1px solid var(--crit-fg)', borderRadius: 'var(--radius-card)', padding: 24, textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--crit-fg)', fontSize: 18, fontWeight: 700 }}>Mentorship Duty Required</h2>
        <p style={{ color: 'var(--text)', fontSize: 14, marginTop: 8 }}>
          You do not have active mentor assignments in the system. If you believe this is in error, contact your Department Coordinator or Dean.
        </p>
        <Link to="/faculty/home" style={{ display: 'inline-block', marginTop: 16, background: 'var(--accent)', color: 'var(--on-dark)', padding: '8px 20px', borderRadius: 'var(--radius-pill)', textDecoration: 'none', fontWeight: 600 }}>
          Back to Faculty Home
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40, color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          <Link to="/faculty/home" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Home</Link>
          {' '}/ Mentee Cohort
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
              My Mentees ({menteeList.length})
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              Active mentorship roster · Proactive academic advisory, multi-course buffer tracking & meeting logs.
            </p>
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '14px 20px', border: '1px solid var(--border)',
        marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', boxShadow: 'var(--shadow-card)',
      }}>
        <input
          type="text"
          placeholder="Search by mentee name or roll no..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 'var(--radius-input)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, minWidth: 260, flex: 1 }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Filter by Risk Band:</span>
          <select
            value={bandFilter}
            onChange={e => setBandFilter(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 600 }}
          >
            <option value="ALL">All Bands ({menteeList.length})</option>
            <option value="Critical">Critical</option>
            <option value="At risk">At Risk</option>
            <option value="Watch">Watch</option>
            <option value="Safe">Safe</option>
          </select>
        </div>
      </div>

      {/* Mentee Grid Cards */}
      {filteredMentees.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No mentees match your filter criteria.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
          {filteredMentees.map(m => {
            const worstBand = m.worst_risk_band || 'Safe';
            const attPct = m.overall_attendance_pct != null ? m.overall_attendance_pct : 100;
            const attColor = attPct >= 75 ? 'var(--ok-fg)' : 'var(--crit-fg)';
            const borderStyle = BAND_BORDER[worstBand] || '4px solid var(--ok-bg)';

            return (
              <div
                key={m.student_id}
                onClick={() => navigate(`/faculty/mentees/${m.student_id}`)}
                style={{
                  background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 20, border: '1px solid var(--border)',
                  borderLeft: borderStyle,
                  boxShadow: 'var(--shadow-card)', cursor: 'pointer',
                  transition: 'transform 0.1s, box-shadow 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: 'var(--ink-900)', margin: 0 }}>
                      {m.name}
                    </h3>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {m.roll_no || `ID: ${m.student_id}`} · {m.email}
                    </div>
                  </div>
                  <StatusBadge status={worstBand} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, background: 'var(--bg)', padding: 12, borderRadius: 'var(--radius-input)', marginBottom: 14 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: attColor }}>
                      {attPct}%
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Avg Att</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: m.worst_buffer != null && m.worst_buffer <= 0 ? 'var(--crit-fg)' : 'var(--ink-900)' }}>
                      {m.worst_buffer != null ? m.worst_buffer : '—'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Min Buffer</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>
                      {m.enrolled_courses_count || 0}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Courses</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Dept: #{m.department_id || 1}
                  </span>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    Open 360° Profile →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
