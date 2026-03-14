// src/components/shared/ConfirmDialog.jsx
const S = { fontFamily: "'IBM Plex Mono', monospace" };
const D = { fontFamily: "'Playfair Display', serif" };

export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', confirmStyle = 'danger', onConfirm, onCancel }) {
  const btnStyle = confirmStyle === 'danger'
    ? { background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }
    : { background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '400px', background: '#0d1e36', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        <div style={{ height: '2px', background: 'linear-gradient(90deg, #c0392b 0%, #c0392b 25%, #f39c12 25%, #f39c12 50%, #27ae60 50%, #27ae60 75%, #2980b9 75%, #2980b9 100%)' }} />
        <div style={{ padding: '24px' }}>
          <p style={{ ...D, fontSize: '18px', fontWeight: 700, color: '#f1f5f9', marginBottom: '10px' }}>{title}</p>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '24px', lineHeight: 1.6 }}>{message}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button onClick={onCancel}
              style={{ ...S, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '9px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={onConfirm}
              style={{ ...S, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, padding: '9px 18px', borderRadius: '8px', cursor: 'pointer', ...btnStyle }}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AlertDialog({ title, message, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '400px', background: '#0d1e36', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ height: '2px', background: 'linear-gradient(90deg, #c0392b 0%, #f39c12 50%, #2980b9 100%)' }} />
        <div style={{ padding: '24px' }}>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 700, color: '#f1f5f9', marginBottom: '10px' }}>{title}</p>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '24px', lineHeight: 1.6 }}>{message}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onClose}
              style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '9px 18px', borderRadius: '8px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)', color: '#f59e0b', cursor: 'pointer' }}>
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
