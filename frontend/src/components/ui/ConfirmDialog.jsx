/**
 * ConfirmDialog — replaces window.confirm()
 * Usage (imperative):
 *   import { confirm } from '../components/ui/ConfirmDialog.jsx';
 *   const ok = await confirm({ title: 'Delete?', message: 'This cannot be undone.', danger: true });
 *
 *   // In App root, render: <ConfirmDialogHost />
 */
import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

// ── Internal bus ─────────────────────────────────────────────────────────────
let _resolve = null;
let _setDialog = null;

export function confirm(options = {}) {
  return new Promise((resolve) => {
    _resolve = resolve;
    if (_setDialog) _setDialog({ ...options, open: true });
  });
}

// ── Host component (render once near root) ───────────────────────────────────
export function ConfirmDialogHost() {
  const [dialog, setDialog] = useState({ open: false });

  useEffect(() => {
    _setDialog = setDialog;
    return () => { _setDialog = null; };
  }, []);

  const close = (result) => {
    setDialog({ open: false });
    if (_resolve) { _resolve(result); _resolve = null; }
  };

  if (!dialog.open) return null;

  const {
    title = 'Are you sure?',
    message = '',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
  } = dialog;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(13,27,42,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={() => close(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-dialog)',
          boxShadow: '0 24px 80px rgba(13,27,42,0.28)',
          padding: 'var(--space-8)',
          maxWidth: 420,
          width: 'calc(100vw - 48px)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          {danger && (
            <div style={{
              flexShrink: 0, width: 40, height: 40,
              borderRadius: '50%', background: 'var(--crit-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={20} style={{ color: 'var(--crit-fg)' }} />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <h3 style={{
              fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600,
              color: 'var(--ink-900)', margin: '0 0 var(--space-2)',
            }}>
              {title}
            </h3>
            {message && (
              <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                {message}
              </p>
            )}
          </div>
          <button
            onClick={() => close(false)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 4, display: 'flex',
              borderRadius: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <button
            onClick={() => close(false)}
            style={{
              padding: '9px 20px', borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text)', fontFamily: 'var(--font-sans)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => close(true)}
            style={{
              padding: '9px 20px', borderRadius: 'var(--radius-pill)',
              border: 'none',
              background: danger ? 'var(--crit-fg)' : 'var(--accent)',
              color: 'var(--on-dark)',
              fontFamily: 'var(--font-sans)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
