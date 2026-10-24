/**
 * Shared style helpers for AcadFlow pages.
 * Import these where needed instead of duplicating inline styles.
 */

export const pageHeader = {
  background: 'var(--surface)',
  borderRadius: 'var(--radius-card)',
  padding: 'var(--space-6)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-card)',
  marginBottom: 'var(--space-6)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 'var(--space-4)',
};

export const card = {
  background: 'var(--surface)',
  borderRadius: 'var(--radius-card)',
  padding: 'var(--space-6)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-card)',
};

export const pillBadge = (bg, fg) => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 12px',
  borderRadius: 'var(--radius-pill)',
  fontSize: 11,
  fontWeight: 700,
  background: bg,
  color: fg,
  whiteSpace: 'nowrap',
});

export const selectStyle = {
  padding: '7px 12px',
  borderRadius: 'var(--radius-input)',
  border: '1px solid var(--border)',
  fontSize: 13,
  background: 'var(--surface)',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
};

export const kpiCard = (value, label, color = 'var(--text)') => ({ value, label, color });
