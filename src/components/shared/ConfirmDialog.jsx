// src/components/shared/ConfirmDialog.jsx
// Redesigned with animated SVG icons, polished entrance animations,
// and editorial typography matching the NEU Library design system.
import { WarningIcon, ErrorIcon, InfoIcon, SuccessIcon } from './AnimatedIcons';

const PP = { fontFamily: "'Poppins', sans-serif" };
const SR = { fontFamily: "'Playfair Display', serif" };
const MN = { fontFamily: "'IBM Plex Mono', monospace" };

export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', confirmStyle = 'danger', onConfirm, onCancel, variant }) {
  const isDanger = confirmStyle === 'danger';
  const btn = isDanger
    ? { background: 'var(--red-soft)', border: '1px solid var(--red-border)', color: 'var(--red)' }
    : { background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', color: 'var(--gold)' };

  const Icon = isDanger ? ErrorIcon : WarningIcon;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onCancel?.(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
        padding: 16, animation: 'cdFadeIn 0.2s ease both',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'var(--card)', border: '1px solid var(--card-border)',
        borderRadius: 20, overflow: 'hidden',
        boxShadow: 'var(--shadow-modal)',
        animation: 'cdSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
      }}>
        <div style={{ height: 3, background: `linear-gradient(90deg, ${isDanger ? 'var(--red)' : 'var(--gold)'}, transparent)` }} />

        <div style={{ padding: '32px 28px 28px', textAlign: 'center' }}>
          {/* Animated icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <Icon size={60} />
          </div>

          <h2 style={{ ...SR, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.25 }}>
            {title}
          </h2>
          <p style={{ ...PP, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 28 }}>
            {message}
          </p>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onCancel}
              style={{
                flex: 1, padding: '12px 18px', borderRadius: 12,
                background: 'var(--surface)', border: '1px solid var(--card-border)',
                color: 'var(--text-muted)', cursor: 'pointer',
                ...PP, fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; }}
            >
              Cancel
            </button>
            <button onClick={onConfirm}
              style={{
                flex: 1, padding: '12px 20px', borderRadius: 12,
                cursor: 'pointer', ...PP, fontSize: 13, fontWeight: 600,
                transition: 'all 0.15s', ...btn,
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cdFadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cdSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}

export function AlertDialog({ title, message, onClose, variant = 'info' }) {
  const IconMap = { info: InfoIcon, success: SuccessIcon, warning: WarningIcon, error: ErrorIcon };
  const Icon = IconMap[variant] || InfoIcon;
  const accentMap = {
    info: 'var(--blue)', success: 'var(--green)', warning: 'var(--gold)', error: 'var(--red)',
  };
  const softMap = {
    info: 'var(--blue-soft)', success: 'var(--green-soft)', warning: 'var(--gold-soft)', error: 'var(--red-soft)',
  };
  const borderMap = {
    info: 'var(--blue-border)', success: 'var(--green-border)', warning: 'var(--gold-border)', error: 'var(--red-border)',
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
        padding: 16, animation: 'cdFadeIn 0.2s ease both',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'var(--card)', border: '1px solid var(--card-border)',
        borderRadius: 20, overflow: 'hidden',
        boxShadow: 'var(--shadow-modal)',
        animation: 'cdSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
      }}>
        <div style={{ height: 3, background: `linear-gradient(90deg, ${accentMap[variant]}, transparent)` }} />

        <div style={{ padding: '32px 28px 28px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <Icon size={60} />
          </div>

          <h2 style={{ ...SR, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.25 }}>
            {title}
          </h2>
          <p style={{ ...PP, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 28 }}>
            {message}
          </p>

          <button onClick={onClose}
            style={{
              width: '100%', padding: '12px 20px', borderRadius: 12,
              background: softMap[variant], border: `1px solid ${borderMap[variant]}`,
              color: accentMap[variant], cursor: 'pointer',
              ...PP, fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            Dismiss
          </button>
        </div>
      </div>

      <style>{`
        @keyframes cdFadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cdSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}
