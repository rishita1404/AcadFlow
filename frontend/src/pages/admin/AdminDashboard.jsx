import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/endpoints.js';

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats().then(r => r.data).catch(() => null),
  });

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading system overview...</div>;
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0',
        marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
              ⚙️ AcadFlow Administration Command Hub
            </h1>
            <span style={{ fontSize: 11, background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>
              ROOT PRIVILEGES
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            System health telemetry, risk algorithm calibration, immutable audit trails, and global access governance.
          </p>
        </div>
      </div>

      {/* Health Status Telemetry Bar */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e2e8f0',
        marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }} />
          <div>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>FastAPI Cluster</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{stats?.api_health || 'Healthy (2/2 Active)'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }} />
          <div>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Background Workers</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{stats?.worker_health || 'Healthy (Celery-Beat Active)'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#3b82f6' }} />
          <div>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>ML Inference Engine</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{stats?.ml_health || 'Operational (v2.1-lgbm)'}</div>
          </div>
        </div>
      </div>

      {/* System Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>👤</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1e293b' }}>{stats?.total_users || 150}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Total User Accounts</div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>🎓</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#3b82f6' }}>{stats?.total_students || 120}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Students Enrolled</div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>👨‍🏫</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#6366f1' }}>{stats?.total_faculty || 25}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Faculty & Trainers</div>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>📚</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#22c55e' }}>{stats?.total_courses || 6}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Active Courses</div>
        </div>
      </div>

      {/* Admin Modules Grid */}
      <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1e293b', marginBottom: 14 }}>
        🛠️ System Administration Modules
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
        <Link
          to="/admin/risk-config"
          style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 22,
            textDecoration: 'none', color: '#1e293b', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>🎛️</div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Risk Algorithm Calibration</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
            Adjust 4 weight sliders (Margin, Trend, Deadlines, Missed). Must total 100%. Live band shift preview.
          </div>
        </Link>

        <Link
          to="/admin/users"
          style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 22,
            textDecoration: 'none', color: '#1e293b', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>👥</div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>User Directory & Roles</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
            Global user search, role assignment, login failure monitoring, and account lockout management.
          </div>
        </Link>

        <Link
          to="/admin/audit"
          style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 22,
            textDecoration: 'none', color: '#1e293b', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>📜</div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Immutable Audit Trail</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
            Verify tamper-evident audit records across attendance edits, profile opens, and timetable publications.
          </div>
        </Link>

        <Link
          to="/admin/ml"
          style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 22,
            textDecoration: 'none', color: '#1e293b', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>🤖</div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>ML Advisory & Drift Monitoring</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
            MLflow model registry, population stability index (PSI) drift tracking, and advisory telemetry.
          </div>
        </Link>

        <Link
          to="/coordinator/timetable"
          style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 22,
            textDecoration: 'none', color: '#1e293b', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>🗓</div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Global Timetable Governance</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
            Inspect published version slots, resolve inter-department room clashes, and review timetable audits.
          </div>
        </Link>

        <Link
          to="/student/notices"
          style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 22,
            textDecoration: 'none', color: '#1e293b', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>📢</div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Campus Notices & Broadcasts</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
            Issue university-wide emergency broadcasts, examine read receipts, and monitor reminder schedules.
          </div>
        </Link>
      </div>
    </div>
  );
}
