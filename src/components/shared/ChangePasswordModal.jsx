// src/components/shared/ChangePasswordModal.jsx
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const PP = { fontFamily: "'Poppins', sans-serif" };
const SR = { fontFamily: "'Playfair Display', serif" };
const MN = { fontFamily: "'IBM Plex Mono', monospace" };

const EyeOpen = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOff = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

export default function ChangePasswordModal({ onClose, adminReset = false }) {
  const { updateUserPassword } = useAuth();
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showNew,   setShowNew]   = useState(false);
  const [showConf,  setShowConf]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState(false);

  const inputSt = {
    width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)',
    borderRadius: 10, padding: '11px 44px 11px 14px', fontSize: 14,
    color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.15s',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPw.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await updateUserPassword(newPw);
      setSuccess(true);
      setTimeout(onClose, 1800);
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        setError('Session expired. Please sign out and sign back in, then try again.');
      } else {
        setError(err.message || 'Failed to update password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', padding: 16, animation: 'fadeIn 0.18s ease both' }}
    >
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-modal)', animation: 'slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--gold), transparent)' }} />

        <div style={{ padding: '28px 28px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
            <div>
              <p style={{ ...MN, fontSize: 9, letterSpacing: '0.22em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 6 }}>Account Security</p>
              <h2 style={{ ...SR, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Change Password</h2>
            </div>
            <button onClick={onClose} disabled={loading}
              style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {adminReset && !success && (
            <div style={{ background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', borderRadius: 10, padding: '11px 14px', marginBottom: 4, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:1}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p style={{ ...PP, fontSize: 12, color: 'var(--gold)', lineHeight: 1.5 }}>An administrator has reset your password. Please set a new password to continue.</p>
            </div>
          )}
          {success ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--green-soft)', border: '1px solid var(--green-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--green)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p style={{ ...PP, fontSize: 15, fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>Password Updated</p>
              <p style={{ ...PP, fontSize: 13, color: 'var(--text-muted)' }}>Your new password is active.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && (
                <div style={{ background: 'var(--red-soft)', border: '1px solid var(--red-border)', borderRadius: 10, padding: '11px 14px' }}>
                  <p style={{ ...MN, fontSize: 12, color: 'var(--red)' }}>{error}</p>
                </div>
              )}

              {/* New password */}
              <div>
                <label style={{ ...MN, fontSize: 9, letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 7, fontWeight: 600 }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNew ? 'text' : 'password'}
                    style={inputSt}
                    placeholder="Min. 8 characters"
                    value={newPw}
                    onChange={e => { setNewPw(e.target.value); setError(''); }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--gold)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--input-border)'; }}
                    required autoFocus
                  />
                  <button type="button" onClick={() => setShowNew(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
                    {showNew ? <EyeOff /> : <EyeOpen />}
                  </button>
                </div>
              </div>

              {/* Confirm */}
              <div>
                <label style={{ ...MN, fontSize: 9, letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 7, fontWeight: 600 }}>
                  Confirm New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConf ? 'text' : 'password'}
                    style={inputSt}
                    placeholder="Re-enter new password"
                    value={confirmPw}
                    onChange={e => { setConfirmPw(e.target.value); setError(''); }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--gold)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--input-border)'; }}
                    required
                  />
                  <button type="button" onClick={() => setShowConf(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
                    {showConf ? <EyeOff /> : <EyeOpen />}
                  </button>
                </div>
              </div>

              {/* Strength hint */}
              {newPw.length > 0 && (
                <div style={{ display: 'flex', gap: 4 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= Math.min(4, Math.floor(newPw.length / 3)) ? (newPw.length >= 12 ? 'var(--green)' : newPw.length >= 8 ? 'var(--gold)' : 'var(--red)') : 'var(--surface-hover)', transition: 'background 0.2s' }} />
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button type="button" onClick={onClose} disabled={loading}
                  style={{ flex: 1, padding: 12, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', cursor: 'pointer', ...PP, fontSize: 13, fontWeight: 500, transition: 'all 0.15s' }}>
                  Cancel
                </button>
                <button type="submit" disabled={loading || !newPw || !confirmPw}
                  style={{ flex: 2, padding: 12, borderRadius: 10, background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', color: 'var(--gold)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1, ...MN, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, transition: 'all 0.15s' }}>
                  {loading ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(24px) scale(0.97)} to{opacity:1;transform:none} }
      `}</style>
    </div>
  );
}
