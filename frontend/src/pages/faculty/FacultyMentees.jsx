import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { facultyApi } from '../../api/endpoints.js';
import StatusBadge from '../../components/StatusBadge.jsx';

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
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading your assigned mentees...</div>;
  }

  if (error) {
    return (
      <div style={{ maxWidth: 800, margin: '40px auto', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: 24, textAlign: 'center' }}>
        <h2 style={{ color: '#dc2626', fontSize: 18, fontWeight: 800 }}>Mentorship Duty Required</h2>
        <p style={{ color: '#475569', fontSize: 14, marginTop: 8 }}>
          You do not have active mentor assignments in the system. If you believe this is in error, contact your Department Coordinator or Dean.
        </p>
        <Link to="/faculty/home" style={{ display: 'inline-block', marginTop: 16, background: '#3b82f6', color: '#fff', padding: '8px 18px', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
          Back to Faculty Home
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
          <Link to="/faculty/home" style={{ color: '#3b82f6', textDecoration: 'none' }}>Home</Link>
          {' '}/ Mentee Cohort
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
              👥 My Mentees ({menteeList.length})
            </h1>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
              Active mentorship roster · Proactive academic advisory, multi-course buffer tracking & meeting logs.
            </p>
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: '14px 20px', border: '1px solid #e2e8f0',
        marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <input
          type="text"
          placeholder="Search by mentee name or roll no..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, minWidth: 260, flex: 1 }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Filter by Risk Band:</span>
          <select
            value={bandFilter}
            onChange={e => setBandFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 600 }}
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
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
          No mentees match your filter criteria.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
          {filteredMentees.map(m => {
            const worstBand = m.worst_risk_band || 'Safe';
            const attPct = m.overall_attendance_pct != null ? m.overall_attendance_pct : 100;
            const attColor = attPct >= 75 ? '#22c55e' : '#ef4444';

            return (
              <div
                key={m.student_id}
                onClick={() => navigate(`/faculty/mentees/${m.student_id}`)}
                style={{
                  background: '#fff', borderRadius: 14, padding: 20, border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'pointer',
                  transition: 'transform 0.1s, box-shadow 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', margin: 0 }}>
                      {m.name}
                    </h3>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {m.roll_no || `ID: ${m.student_id}`} · {m.email}
                    </div>
                  </div>
                  <StatusBadge status={worstBand} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, background: '#f8fafc', padding: 12, borderRadius: 10, marginBottom: 14 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: attColor }}>
                      {attPct}%
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Avg Att</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: m.worst_buffer != null && m.worst_buffer <= 0 ? '#ef4444' : '#1e293b' }}>
                      {m.worst_buffer != null ? m.worst_buffer : '—'}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Min Buffer</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#3b82f6' }}>
                      {m.enrolled_courses_count || 0}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Courses</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: '#64748b' }}>
                    Dept: #{m.department_id || 1}
                  </span>
                  <span style={{ color: '#3b82f6', fontWeight: 700 }}>
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
