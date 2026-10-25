/**
 * AcadFlow Toast Notification System
 * Usage:
 *   import { toast } from '../components/ui/Toast.jsx';
 *   toast.success('Saved!');
 *   toast.error('Something went wrong');
 *   toast.info('Assignment due tomorrow');
 *   toast.warning('Low attendance');
 *
 *   // In App root, render: <ToastContainer />
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

// ── Internal event bus ───────────────────────────────────────────────────────
const listeners = new Set();

function emit(toastData) {
  listeners.forEach((fn) => fn(toastData));
}

// ── Public API ───────────────────────────────────────────────────────────────
let _id = 0;

export const toast = {
  success: (message, options = {}) =>
    emit({ id: ++_id, type: 'success', message, duration: 4000, ...options }),
  error: (message, options = {}) =>
    emit({ id: ++_id, type: 'error', message, duration: 6000, ...options }),
  warning: (message, options = {}) =>
    emit({ id: ++_id, type: 'warning', message, duration: 5000, ...options }),
  info: (message, options = {}) =>
    emit({ id: ++_id, type: 'info', message, duration: 4000, ...options }),
};

// ── Config per type ──────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  success: {
    icon: CheckCircle2,
    bg: 'var(--ok-bg)',
    fg: 'var(--ok-fg)',
    border: 'rgba(119,141,122,0.4)',
  },
  error: {
    icon: XCircle,
    bg: 'var(--crit-bg)',
    fg: 'var(--crit-fg)',
    border: 'rgba(154,74,47,0.4)',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'var(--watch-bg)',
    fg: 'var(--must-attend)',
    border: 'rgba(154,74,47,0.3)',
  },
  info: {
    icon: Info,
    bg: 'var(--surface)',
    fg: 'var(--accent)',
    border: 'var(--border)',
  },
};

// ── Single Toast ─────────────────────────────────────────────────────────────
function Toast({ toast: t, onRemove }) {
  const cfg = TYPE_CONFIG[t.type] || TYPE_CONFIG.info;
  const Icon = cfg.icon;
  const timerRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true));
    // Auto-dismiss
    timerRef.current = setTimeout(() => dismiss(), t.duration);
    return () => clearTimeout(timerRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => onRemove(t.id), 300);
  }, [onRemove, t.id]);

  return (
    <div
      role="alert"
      aria-live="polite"
      onClick={dismiss}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderLeft: `4px solid ${cfg.fg}`,
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        cursor: 'pointer',
        maxWidth: 380,
        minWidth: 260,
        transition: 'opacity 0.3s, transform 0.3s',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(40px)',
      }}
    >
      <Icon size={18} style={{ color: cfg.fg, flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        {t.title && (
          <div style={{ fontWeight: 700, fontSize: 13, color: cfg.fg, marginBottom: 2 }}>
            {t.title}
          </div>
        )}
        <div style={{ fontSize: 13, color: cfg.fg, lineHeight: 1.45 }}>{t.message}</div>
      </div>
      <X size={14} style={{ color: cfg.fg, flexShrink: 0, opacity: 0.6, marginTop: 2 }} />
    </div>
  );
}

// ── Container (render once at root) ─────────────────────────────────────────
export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (t) => setToasts((prev) => [...prev, t]);
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: 'all' }}>
          <Toast toast={t} onRemove={remove} />
        </div>
      ))}
    </div>
  );
}
