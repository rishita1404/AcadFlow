import { useState, useEffect, useCallback } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Info, Loader2 } from 'lucide-react';
import AuthDivider from './AuthDivider.jsx';

const DEMO_ACCOUNTS = [
  { email: 'riya.aiml001@acadflow.edu', label: 'Riya (AIML)' },
  { email: 'tarun.aiml014@acadflow.edu', label: 'Tarun (AIML)' },
  { email: 'rajesh.faculty@acadflow.edu', label: 'Dr. Rajesh (Faculty)' },
  { email: 'sneha.faculty@acadflow.edu', label: 'Dr. Sneha (Faculty)' },
  { email: 'meera.coord@acadflow.edu', label: 'Dr. Meera (Coord)' },
  { email: 'admin@acadflow.edu', label: 'Admin' },
];

export default function SignInCard({
  onLogin,
  isExpired,
  onOpenDialog,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Field validation states
  const [touched, setTouched] = useState({ email: false, password: false });
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });

  // Submission & API error states
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [retryCountdown, setRetryCountdown] = useState(0);

  const formatCountdown = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }, []);

  // Live countdown timer for 429 rate limit
  useEffect(() => {
    if (retryCountdown <= 0) return;
    const timer = setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setApiError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [retryCountdown]);

  // Update error message as countdown ticks
  useEffect(() => {
    if (retryCountdown > 0) {
      setApiError(`Too many attempts. You can try again in ${formatCountdown(retryCountdown)}.`);
    }
  }, [retryCountdown, formatCountdown]);

  const validateEmail = (val) => {
    if (!val || !val.trim()) return 'Email is required.';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val.trim())) return 'Please enter a valid email address.';
    return '';
  };

  const validatePassword = (val) => {
    if (!val) return 'Password is required.';
    return '';
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    if (touched.email) {
      setFieldErrors((prev) => ({ ...prev, email: validateEmail(val) }));
    }
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    if (touched.password) {
      setFieldErrors((prev) => ({ ...prev, password: validatePassword(val) }));
    }
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === 'email') {
      setFieldErrors((prev) => ({ ...prev, email: validateEmail(email) }));
    } else if (field === 'password') {
      setFieldErrors((prev) => ({ ...prev, password: validatePassword(password) }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ email: true, password: true });

    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setFieldErrors({ email: eErr, password: pErr });

    if (eErr || pErr) {
      return;
    }

    if (retryCountdown > 0) {
      return;
    }

    setApiError('');
    setLoading(true);

    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        setApiError("That email or password doesn't look right. Please try again.");
      } else if (status === 403) {
        setApiError('This account is locked. Please contact an administrator.');
      } else if (status === 429) {
        const retryHeader = err?.response?.headers?.['retry-after'];
        const secs = parseInt(retryHeader, 10) || 900; // default to 15 mins (15:00)
        setRetryCountdown(secs);
        setApiError(`Too many attempts. You can try again in ${formatCountdown(secs)}.`);
      } else {
        setApiError("We couldn't reach AcadFlow. Check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('AcadFlow@123');
    setFieldErrors({ email: '', password: '' });
    setTouched({ email: false, password: false });
    setApiError('');
  };

  return (
    <div className="auth-card-col">
      <div className="auth-signin-card">
        <div>
          <div className="auth-card-header">
            <div className="auth-card-label">Secure sign-in</div>
            <h2 className="auth-card-title">Welcome back</h2>
            <p className="auth-card-subtitle">
              Sign in to see your courses, deadlines and academic health.
            </p>
          </div>

          {/* Session Expired Banner */}
          {isExpired && !apiError && (
            <div className="auth-banner auth-banner-info" role="status">
              <Info size={16} className="auth-banner-icon" aria-hidden="true" />
              <span>Your session expired. Please sign in again.</span>
            </div>
          )}

          {/* Error Banner */}
          {apiError && (
            <div className="auth-banner auth-banner-error" role="alert" aria-live="assertive">
              <AlertCircle size={16} className="auth-banner-icon" aria-hidden="true" />
              <span>{apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {/* Email Field */}
            <div className="auth-field">
              <div className="auth-label-row">
                <label htmlFor="email" className="auth-label">
                  Email
                </label>
              </div>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <Mail size={16} aria-hidden="true" />
                </span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@college.edu"
                  value={email}
                  onChange={handleEmailChange}
                  onBlur={() => handleBlur('email')}
                  disabled={loading}
                  aria-required="true"
                  aria-invalid={Boolean(touched.email && fieldErrors.email)}
                  aria-describedby={touched.email && fieldErrors.email ? 'email-error' : undefined}
                  className={`auth-input ${touched.email && fieldErrors.email ? 'has-error' : ''}`}
                />
              </div>
              {touched.email && fieldErrors.email && (
                <span id="email-error" className="auth-field-error" role="alert">
                  {fieldErrors.email}
                </span>
              )}
            </div>

            {/* Password Field */}
            <div className="auth-field">
              <div className="auth-label-row">
                <label htmlFor="password" className="auth-label">
                  Password
                </label>
                <button
                  type="button"
                  className="auth-forgot-btn"
                  onClick={() => onOpenDialog('forgot')}
                >
                  Forgot password?
                </button>
              </div>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <Lock size={16} aria-hidden="true" />
                </span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={handlePasswordChange}
                  onBlur={() => handleBlur('password')}
                  disabled={loading}
                  aria-required="true"
                  aria-invalid={Boolean(touched.password && fieldErrors.password)}
                  aria-describedby={touched.password && fieldErrors.password ? 'password-error' : undefined}
                  className={`auth-input ${touched.password && fieldErrors.password ? 'has-error' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="auth-input-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  tabIndex={0}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {touched.password && fieldErrors.password && (
                <span id="password-error" className="auth-field-error" role="alert">
                  {fieldErrors.password}
                </span>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading || retryCountdown > 0}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="auth-spinner" aria-hidden="true" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {/* Star Divider */}
          <AuthDivider />

          {/* Demo Accounts (Shown ONLY in development) */}
          {import.meta.env.DEV && (
            <div className="auth-demo-wrap" aria-label="Development Demo Accounts">
              <div className="auth-demo-title">
                Demo accounts (development only)
              </div>
              <div className="auth-demo-chips">
                {DEMO_ACCOUNTS.map(({ email: demoEmail, label }) => (
                  <button
                    key={demoEmail}
                    type="button"
                    onClick={() => fillDemoAccount(demoEmail)}
                    className="auth-demo-chip"
                    aria-label={`Fill credentials for ${label}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="auth-quiet-line">
            Need an account? Ask your coordinator.
          </div>
        </div>

        {/* Card Footer Links */}
        <div className="auth-card-footer">
          <button
            type="button"
            className="auth-footer-link"
            onClick={() => onOpenDialog('help')}
          >
            Help
          </button>
          <span style={{ color: 'var(--border)' }} aria-hidden="true">·</span>
          <button
            type="button"
            className="auth-footer-link"
            onClick={() => onOpenDialog('privacy')}
          >
            Privacy
          </button>
        </div>
      </div>
    </div>
  );
}
