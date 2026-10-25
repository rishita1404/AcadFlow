import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.jsx';
import AuthHeader from '../features/auth/AuthHeader.jsx';
import WelcomePanel from '../features/auth/WelcomePanel.jsx';
import SignInCard from '../features/auth/SignInCard.jsx';
import AuthFooter from '../features/auth/AuthFooter.jsx';
import AuthDialogs from '../features/auth/AuthDialogs.jsx';
import '../features/auth/auth.css';

export default function LoginPage() {
  const { login, isLoggedIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const query = new URLSearchParams(location.search);
  const nextUrl = query.get('next');
  const isExpired = query.get('reason') === 'expired';

  const [activeDialog, setActiveDialog] = useState(null);

  const getRoleRedirect = useCallback((role) => {
    switch (role) {
      case 'student':
        return '/student/home';
      case 'faculty':
      case 'trainer':
      case 'mentor':
        return '/faculty/home';
      case 'coordinator':
        return '/coordinator/summary';
      case 'admin':
        return '/admin';
      default:
        return '/';
    }
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (isLoggedIn) {
      if (nextUrl && nextUrl.startsWith('/') && !nextUrl.startsWith('/login')) {
        navigate(nextUrl, { replace: true });
      } else {
        navigate(getRoleRedirect(user?.role), { replace: true });
      }
    }
  }, [isLoggedIn, nextUrl, navigate, user?.role, getRoleRedirect]);

  const handleLogin = async (email, password) => {
    const res = await login(email, password);
    const targetRole = res?.role || res?.user?.role;
    if (nextUrl && nextUrl.startsWith('/') && !nextUrl.startsWith('/login')) {
      navigate(nextUrl, { replace: true });
    } else {
      navigate(getRoleRedirect(targetRole), { replace: true });
    }
  };

  return (
    <div className="auth-page">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <AuthHeader />

      <main id="main-content" className="auth-main">
        <div className="auth-container">
          <WelcomePanel />
          <SignInCard
            onLogin={handleLogin}
            isExpired={isExpired}
            onOpenDialog={setActiveDialog}
          />
        </div>
      </main>

      <AuthFooter />

      <AuthDialogs
        activeDialog={activeDialog}
        onClose={() => setActiveDialog(null)}
      />
    </div>
  );
}
