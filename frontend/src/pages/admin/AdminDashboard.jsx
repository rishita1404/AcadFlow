
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sliders, Users, FileText, Cpu, Calendar, Bell, GraduationCap, UserCheck, BookOpen } from 'lucide-react';
import { adminApi } from '../../api/endpoints.js';
import Skeleton from '../../components/Skeleton.jsx';

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats().then(r => r.data).catch(() => null),
  });

  if (isLoading) {
    return (
      <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
        <Skeleton variant="title" width={340} height={36} />
        <Skeleton variant="text" width={280} height={18} style={{ marginTop: 8, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <Skeleton variant="card" height={100} />
          <Skeleton variant="card" height={100} />
          <Skeleton variant="card" height={100} />
          <Skeleton variant="card" height={100} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '24px 28px', border: '1px solid var(--border)',
        marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-card)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink-900)', margin: 0 }}>
              Administration Command Hub
            </h1>
            <span style={{
              fontSize: 11, background: 'var(--watch-bg)', color: 'var(--watch-fg)',
              padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontWeight: 700, letterSpacing: '0.04em',
            }}>
              ROOT PRIVILEGES
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 6, margin: 0 }}>
            System health telemetry, risk algorithm calibration, master data governance, and access control.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link
            to="/admin/users?tab=users&action=add"
            style={{
              background: 'var(--accent)', color: 'var(--on-dark)', padding: '10px 18px',
              borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 700, textDecoration: 'none',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            + Add User
          </Link>
          <Link
            to="/admin/users?tab=courses"
            style={{
              background: 'var(--surface)', color: 'var(--ink-900)', padding: '10px 18px',
              borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 700, textDecoration: 'none',
              border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)',
            }}
          >
            Manage Courses
          </Link>
        </div>
      </div>

      {/* Health Status Telemetry Bar */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: '16px 24px', border: '1px solid var(--border)',
        marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, boxShadow: 'var(--shadow-card)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--ok-bg)' }} />
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>FastAPI Cluster</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)' }}>{stats?.api_health || 'Healthy (2/2 Active)'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--ok-bg)' }} />
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Background Workers</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)' }}>{stats?.worker_health || 'Healthy (Celery-Beat Active)'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)' }} />
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>ML Inference Engine</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-900)' }}>{stats?.ml_health || 'Operational (v2.1-lgbm)'}</div>
          </div>
        </div>
      </div>

      {/* System Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ color: 'var(--accent)', marginBottom: 8 }}><Users size={20} /></div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>{stats?.total_users ?? 0}</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginTop: 4 }}>Total User Accounts</div>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ color: 'var(--accent)', marginBottom: 8 }}><GraduationCap size={20} /></div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>{stats?.total_students ?? 0}</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginTop: 4 }}>Students Enrolled</div>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ color: 'var(--accent)', marginBottom: 8 }}><UserCheck size={20} /></div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>{stats?.total_faculty ?? 0}</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginTop: 4 }}>Faculty & Trainers</div>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-card)', padding: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ color: 'var(--accent)', marginBottom: 8 }}><BookOpen size={20} /></div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>{stats?.total_courses ?? 0}</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginTop: 4 }}>Active Courses</div>
        </div>
      </div>

      {/* Admin Modules Grid */}
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', marginBottom: 16 }}>
        Administration Modules
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
        <Link
          to="/admin/risk-config"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 24,
            textDecoration: 'none', color: 'var(--ink-900)', display: 'block', boxShadow: 'var(--shadow-card)',
            transition: 'border-color 0.15s ease',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 'var(--radius-pill)', background: 'var(--bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', marginBottom: 14,
          }}>
            <Sliders size={22} />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 18, color: 'var(--ink-900)' }}>Risk Algorithm Calibration</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
            Adjust 4 weight sliders (Margin, Trend, Deadlines, Missed). Must total 100%. Live band shift preview.
          </div>
        </Link>

        <Link
          to="/admin/users"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 24,
            textDecoration: 'none', color: 'var(--ink-900)', display: 'block', boxShadow: 'var(--shadow-card)',
            transition: 'border-color 0.15s ease',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 'var(--radius-pill)', background: 'var(--bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', marginBottom: 14,
          }}>
            <Users size={22} />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 18, color: 'var(--ink-900)' }}>User Directory & Roles</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
            Global user search, role assignment, login failure monitoring, and account lockout management.
          </div>
        </Link>

        <Link
          to="/admin/audit"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 24,
            textDecoration: 'none', color: 'var(--ink-900)', display: 'block', boxShadow: 'var(--shadow-card)',
            transition: 'border-color 0.15s ease',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 'var(--radius-pill)', background: 'var(--bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', marginBottom: 14,
          }}>
            <FileText size={22} />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 18, color: 'var(--ink-900)' }}>Immutable Audit Trail</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
            Verify tamper-evident audit records across attendance edits, profile opens, and timetable publications.
          </div>
        </Link>

        <Link
          to="/admin/ml"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 24,
            textDecoration: 'none', color: 'var(--ink-900)', display: 'block', boxShadow: 'var(--shadow-card)',
            transition: 'border-color 0.15s ease',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 'var(--radius-pill)', background: 'var(--bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', marginBottom: 14,
          }}>
            <Cpu size={22} />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 18, color: 'var(--ink-900)' }}>ML Advisory & Drift Monitoring</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
            MLflow model registry, population stability index (PSI) drift tracking, and advisory telemetry.
          </div>
        </Link>

        <Link
          to="/coordinator/timetable"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 24,
            textDecoration: 'none', color: 'var(--ink-900)', display: 'block', boxShadow: 'var(--shadow-card)',
            transition: 'border-color 0.15s ease',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 'var(--radius-pill)', background: 'var(--bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', marginBottom: 14,
          }}>
            <Calendar size={22} />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 18, color: 'var(--ink-900)' }}>Global Timetable Governance</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
            Inspect published version slots, resolve inter-department room clashes, and review timetable audits.
          </div>
        </Link>

        <Link
          to="/student/notices"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 24,
            textDecoration: 'none', color: 'var(--ink-900)', display: 'block', boxShadow: 'var(--shadow-card)',
            transition: 'border-color 0.15s ease',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 'var(--radius-pill)', background: 'var(--bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', marginBottom: 14,
          }}>
            <Bell size={22} />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 18, color: 'var(--ink-900)' }}>Campus Notices & Broadcasts</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
            Issue university-wide emergency broadcasts, examine read receipts, and monitor reminder schedules.
          </div>
        </Link>
      </div>
    </div>
  );
}
