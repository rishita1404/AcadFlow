import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.jsx';
import Button from '../components/ui/Button.jsx';
import { ShieldOff } from 'lucide-react';

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const homeRoute = {
    student: '/student/home',
    faculty: '/faculty/home',
    trainer: '/faculty/home',
    coordinator: '/coordinator/summary',
    admin: '/admin',
  }[user?.role] ?? '/';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      flexDirection: 'column',
      gap: 'var(--space-6)',
      padding: 'var(--space-12)',
      textAlign: 'center',
    }}>
      <ShieldOff size={64} strokeWidth={1} color="var(--text-muted)" />
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--ink-900)' }}>
        Outside your access
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 15, maxWidth: 380 }}>
        You don't have permission to view this page. If you think this is a mistake, contact your administrator.
      </p>
      <Button variant="secondary" onClick={() => navigate(homeRoute)}>
        Back to my home
      </Button>
    </div>
  );
}
