import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const nextUrl = searchParams.get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const getRoleRedirect = (role) => {
    switch (role) {
      case 'student':
        return '/student/home';
      case 'faculty':
      case 'trainer':
        return '/faculty/home';
      case 'coordinator':
        return '/coordinator/summary';
      case 'admin':
        return '/admin';
      default:
        return '/';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      if (nextUrl && nextUrl.startsWith('/') && !nextUrl.startsWith('/login')) {
        navigate(nextUrl, { replace: true });
      } else {
        const dest = getRoleRedirect(res?.role);
        navigate(dest, { replace: true });
      }
    } catch (err) {
      setError(
        err?.response?.data?.detail || err?.response?.data?.error?.message || 'Login failed. Check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  const fillAccount = (userEmail) => {
    setEmail(userEmail);
    setPassword('AcadFlow@123');
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'linear-gradient(135deg,#1e293b 0%,#0f172a 100%)',
      padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 36, width: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 36 }}>🎓</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', margin: '6px 0 2px' }}>
            AcadFlow
          </h1>
          <p style={{ color: '#64748b', fontSize: 13 }}>Desktop Academic Workflow Platform</p>
        </div>

        {nextUrl && (
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6,
            padding: '8px 12px', fontSize: 12, color: '#475569', marginBottom: 16,
          }}>
            ℹ️ Please sign in to continue to <code>{nextUrl}</code>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@university.edu"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16,
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '11px', background: loading ? '#93c5fd' : '#2563eb',
              color: '#fff', border: 'none', borderRadius: 8, fontSize: 14,
              fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In →'}
          </button>
        </form>

        {/* Demo Accounts Quick-Fill */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
            Quick-Fill Demo Accounts (Pwd: AcadFlow@123)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button type="button" onClick={() => fillAccount('student@acadflow.edu')} style={chipBtnStyle}>
              🎓 Student
            </button>
            <button type="button" onClick={() => fillAccount('riya@acadflow.edu')} style={chipBtnStyle}>
              🎓 Riya (App A)
            </button>
            <button type="button" onClick={() => fillAccount('faculty@acadflow.edu')} style={chipBtnStyle}>
              👨‍🏫 Instructor
            </button>
            <button type="button" onClick={() => fillAccount('mentor@acadflow.edu')} style={chipBtnStyle}>
              👥 Mentor + Coord
            </button>
            <button type="button" onClick={() => fillAccount('coordinator@acadflow.edu')} style={chipBtnStyle}>
              📋 Dean / Coord
            </button>
            <button type="button" onClick={() => fillAccount('admin@acadflow.edu')} style={chipBtnStyle}>
              ⚙️ Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};

const chipBtnStyle = {
  padding: '4px 8px', fontSize: 11, background: '#f8fafc',
  border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer',
  color: '#334151', fontWeight: 500,
};
