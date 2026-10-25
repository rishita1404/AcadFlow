import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

export default function AuthHeader() {
  return (
    <header className="auth-header" role="banner">
      <Link to="/" className="auth-header-logo" aria-label="AcadFlow Home">
        <span className="auth-header-logo-icon">
          <BookOpen size={24} strokeWidth={2.2} />
        </span>
        <span className="auth-header-wordmark">AcadFlow</span>
      </Link>
      <div className="auth-header-tagline">
        Unified Academic Platform
      </div>
    </header>
  );
}
