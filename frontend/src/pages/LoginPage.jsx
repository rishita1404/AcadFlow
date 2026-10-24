import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.jsx';
import Input from '../components/ui/Input.jsx';
import Button from '../components/ui/Button.jsx';
import { Mail, Lock, AlertCircle } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { email: 'student@acadflow.edu', label: 'Student' },
  { email: 'riya@acadflow.edu', label: 'Riya (At Risk)' },
  { email: 'faculty@acadflow.edu', label: 'Instructor' },
  { email: 'mentor@acadflow.edu', label: 'Mentor + Coord' },
  { email: 'coordinator@acadflow.edu', label: 'Coordinator' },
  { email: 'admin@acadflow.edu', label: 'Admin' },
];

const CAPSULES = [
  { x: '8%', y: '12%', w: 120, h: 52, bg: 'var(--ink-900)', rotate: -18 },
  { x: '18%', y: '62%', w: 90, h: 38, bg: 'var(--accent)', rotate: 10 },
  { x: '62%', y: '8%', w: 100, h: 44, bg: 'var(--sage)', rotate: -5 },
  { x: '75%', y: '55%', w: 140, h: 56, bg: 'var(--sand)', rotate: 22 },
  { x: '40%', y: '78%', w: 80, h: 34, bg: 'var(--ink-800)', rotate: -12 },
  { x: '52%', y: '35%', w: 110, h: 46, bg: 'var(--accent)', rotate: 8, opacity: 0.5 },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const nextUrl = new URLSearchParams(location.search).get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const getRoleRedirect = (role) => {
    switch (role) {
      case 'student': return '/student/home';
      case 'faculty':
      case 'trainer': return '/faculty/home';
      case 'coordinator': return '/coordinator/summary';
      case 'admin': return '/admin';
      default: return '/';
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
        navigate(getRoleRedirect(res?.role), { replace: true });
      }
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.error?.message ||
        'Login failed. Check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  const fillAccount = (e) => { setEmail(e); setPassword('AcadFlow@123'); };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Left panel (55%) – editorial / brand ── */}
      <div style={{
        width: '55%',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(175deg, var(--sand) 0%, var(--ink-800) 45%, var(--ink-900) 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: 'var(--space-12)',
      }}>
        {/* Floating capsules */}
        {CAPSULES.map((c, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: c.x, top: c.y,
              width: c.w, height: c.h,
              background: c.bg,
              borderRadius: 999,
              opacity: c.opacity ?? 0.7,
              transform: `rotate(${c.rotate}deg)`,
            }}
          />
        ))}

        {/* Wordmark */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 52,
            fontWeight: 700,
            color: 'var(--on-dark)',
            lineHeight: 1.1,
            margin: 0,
            letterSpacing: '-0.02em',
          }}>
            AcadFlow
          </h1>
          <p style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 20,
            color: 'var(--sand)',
            marginTop: 12,
            fontStyle: 'italic',
            fontWeight: 400,
          }}>
            Know where you stand, early.
          </p>
        </div>
      </div>

      {/* ── Right panel (45%) – form ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 'var(--space-12) var(--space-8)',
        background: 'var(--bg)',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 28,
            fontWeight: 600,
            color: 'var(--ink-900)',
            marginBottom: 'var(--space-2)',
          }}>
            Sign in
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 'var(--space-8)' }}>
            {nextUrl ? `You'll be taken to ${nextUrl} after signing in.` : 'Welcome back to AcadFlow.'}
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@university.edu"
              icon={<Mail size={16} />}
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              icon={<Lock size={16} />}
            />

            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                background: 'var(--crit-bg)',
                border: '1px solid var(--crit-fg)',
                borderRadius: 12, padding: '10px 14px',
                fontSize: 13, color: 'var(--crit-fg)',
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              style={{ width: '100%', marginTop: 'var(--space-2)' }}
            >
              Sign in
            </Button>
          </form>

          {/* Demo quick-fill */}
          <div style={{ marginTop: 'var(--space-8)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--border)' }}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 'var(--space-3)',
            }}>
              Demo accounts — password: AcadFlow@123
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DEMO_ACCOUNTS.map(({ email: e, label }) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => fillAccount(e)}
                  style={{
                    padding: '5px 12px',
                    fontSize: 12, fontWeight: 600,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-pill)',
                    cursor: 'pointer',
                    color: 'var(--text)',
                    fontFamily: 'var(--font-sans)',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e2 => e2.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e2 => e2.currentTarget.style.background = 'var(--surface)'}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
