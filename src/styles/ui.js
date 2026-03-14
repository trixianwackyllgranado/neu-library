// src/styles/ui.js
// Shared design tokens — import in every page/component
// No emojis, no hardcoded hex — everything uses CSS variables from theme.css

export const POPPINS = { fontFamily: "'Poppins', sans-serif" };
export const MONO    = { fontFamily: "'IBM Plex Mono', monospace" };
export const SERIF   = { fontFamily: "'Playfair Display', serif" };

// Page header helper
export const pageHeader = (label, title, subtitle) => ({ label, title, subtitle });

// Reusable inline style builders
export const card = (extra = {}) => ({
  background: 'var(--card)',
  border: '1px solid var(--card-border)',
  borderRadius: '14px',
  boxShadow: 'var(--shadow-card)',
  ...extra,
});

export const inputStyle = {
  width: '100%',
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  borderRadius: '10px',
  padding: '11px 14px',
  fontSize: '15px',
  color: 'var(--text-primary)',
  fontFamily: "'Poppins', sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

export const labelStyle = {
  fontFamily: "'Poppins', sans-serif",
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  display: 'block',
  marginBottom: '6px',
  letterSpacing: '0.02em',
};

export const btnPrimary = {
  padding: '11px 20px',
  borderRadius: '10px',
  background: 'var(--gold-soft)',
  border: '1px solid var(--gold-border)',
  color: 'var(--gold)',
  cursor: 'pointer',
  fontFamily: "'Poppins', sans-serif",
  fontSize: '13px',
  fontWeight: 600,
  transition: 'all 0.15s',
};

export const btnDanger = {
  padding: '11px 20px',
  borderRadius: '10px',
  background: 'var(--red-soft)',
  border: '1px solid var(--red-border)',
  color: 'var(--red)',
  cursor: 'pointer',
  fontFamily: "'Poppins', sans-serif",
  fontSize: '13px',
  fontWeight: 600,
  transition: 'all 0.15s',
};

export const btnGhost = {
  padding: '11px 20px',
  borderRadius: '10px',
  background: 'var(--surface)',
  border: '1px solid var(--card-border)',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontFamily: "'Poppins', sans-serif",
  fontSize: '13px',
  fontWeight: 500,
  transition: 'all 0.15s',
};

export const badge = (variant = 'gray') => {
  const map = {
    gold:  { bg: 'var(--gold-soft)',  border: 'var(--gold-border)',  color: 'var(--gold)'  },
    green: { bg: 'var(--green-soft)', border: 'var(--green-border)', color: 'var(--green)' },
    blue:  { bg: 'var(--blue-soft)',  border: 'var(--blue-border)',  color: 'var(--blue)'  },
    red:   { bg: 'var(--red-soft)',   border: 'var(--red-border)',   color: 'var(--red)'   },
    gray:  { bg: 'var(--surface)',    border: 'var(--card-border)',  color: 'var(--text-muted)' },
  };
  const t = map[variant] || map.gray;
  return {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '20px',
    background: t.bg,
    border: `1px solid ${t.border}`,
    color: t.color,
    fontFamily: "'Poppins', sans-serif",
    fontSize: '11px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };
};

export const thStyle = {
  fontFamily: "'Poppins', sans-serif",
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  padding: '11px 16px',
  textAlign: 'left',
  background: 'var(--thead-bg)',
  borderBottom: '1px solid var(--divider)',
  whiteSpace: 'nowrap',
};

export const tdStyle = {
  fontFamily: "'Poppins', sans-serif",
  fontSize: '14px',
  color: 'var(--text-body)',
  padding: '12px 16px',
  borderBottom: '1px solid var(--row-border)',
  verticalAlign: 'middle',
};

export const onFocus = e => { e.currentTarget.style.borderColor = 'var(--gold)'; };
export const onBlur  = e => { e.currentTarget.style.borderColor = 'var(--input-border)'; };
