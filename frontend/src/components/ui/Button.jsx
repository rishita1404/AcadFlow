

const variants = {
  primary: {
    background: 'var(--accent)',
    color: 'var(--on-dark)',
    border: 'none',
    '--hover-bg': 'var(--accent-hover)',
  },
  secondary: {
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    '--hover-bg': 'var(--bg)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-muted)',
    border: 'none',
    '--hover-bg': 'var(--bg)',
  },
  danger: {
    background: 'var(--crit-bg)',
    color: 'var(--crit-fg)',
    border: '1px solid var(--crit-fg)',
    '--hover-bg': 'var(--crit-bg)',
  },
};

const sizes = {
  sm: { fontSize: 13, padding: '6px 14px', height: 32 },
  md: { fontSize: 14, padding: '9px 20px', height: 40 },
  lg: { fontSize: 15, padding: '12px 28px', height: 48 },
};

export default function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconRight,
  children,
  style,
  ...rest
}) {
  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.md;
  return (
    <button
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        borderRadius: 'var(--radius-pill)',
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        lineHeight: 1,
        transition: 'background 0.15s, opacity 0.15s',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        textDecoration: 'none',
        ...v,
        ...s,
        ...style,
      }}
      onMouseEnter={e => { if (!disabled && !loading) e.currentTarget.style.background = v['--hover-bg']; }}
      onMouseLeave={e => { if (!disabled && !loading) e.currentTarget.style.background = v.background; }}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
}

function Spinner({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="40" strokeDashoffset="10" />
    </svg>
  );
}
