import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.jsx';

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const { activeRole } = useAuth();

  const handleBackHome = () => {
    if (activeRole === 'student') navigate('/student/home');
    else if (activeRole === 'faculty') navigate('/faculty/home');
    else if (activeRole === 'coordinator') navigate('/coordinator/summary');
    else if (activeRole === 'admin') navigate('/admin');
    else navigate('/');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      textAlign: 'center',
      padding: 24,
    }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🚫</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>
        403 - Access Denied
      </h1>
      <p style={{ color: '#64748b', maxWidth: 460, marginBottom: 24, fontSize: 14 }}>
        Your current role or scope lacks permission to access this resource or perform this action.
      </p>
      <button
        onClick={handleBackHome}
        style={{
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '10px 20px',
          fontWeight: 600,
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        ← Back to my home
      </button>
    </div>
  );
}
