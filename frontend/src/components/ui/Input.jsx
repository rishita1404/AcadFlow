import { forwardRef } from 'react';

const Input = forwardRef(function Input(
  { label, error, hint, icon, style, containerStyle, ...rest },
  ref
) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...containerStyle }}>
      {label && (
        <label style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text)',
          fontFamily: 'var(--font-sans)',
        }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && (
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', display: 'flex', pointerEvents: 'none',
          }}>
            {icon}
          </span>
        )}
        <input
          ref={ref}
          style={{
            width: '100%',
            height: 44,
            padding: icon ? '0 14px 0 38px' : '0 14px',
            border: `1px solid ${error ? 'var(--crit-fg)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-input)',
            fontSize: 14,
            fontFamily: 'var(--font-sans)',
            color: 'var(--text)',
            background: 'var(--surface)',
            outline: 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
            ...style,
          }}
          onFocus={e => { e.target.style.boxShadow = 'var(--focus-ring)'; e.target.style.borderColor = 'var(--accent)'; }}
          onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = error ? 'var(--crit-fg)' : 'var(--border)'; }}
          {...rest}
        />
      </div>
      {error && <span style={{ fontSize: 12, color: 'var(--crit-fg)', fontFamily: 'var(--font-sans)' }}>{error}</span>}
      {!error && hint && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>{hint}</span>}
    </div>
  );
});

export default Input;
