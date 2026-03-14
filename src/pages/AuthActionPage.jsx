// src/pages/AuthActionPage.jsx
// Handles Firebase out-of-band actions (e.g., password reset links for admin/staff)
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../firebase/config';

const S = { fontFamily: "'IBM Plex Mono', monospace" };
const D = { fontFamily: "'Playfair Display', serif" };

const BG = {
  minHeight: '100vh',
  background: 'linear-gradient(160deg, #060e1e 0%, #0a1628 50%, #0d1e36 100%)',
  display: 'flex', flexDirection: 'column',
};

export default function AuthActionPage() {
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const mode      = params.get('mode');
  const oobCode   = params.get('oobCode');

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [status,   setStatus]   = useState('verifying');
  const [message,  setMessage]  = useState('');
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (mode !== 'resetPassword' || !oobCode) {
      setStatus('error');
      setMessage('Invalid or missing reset link. Please request a new one.');
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then(em => { setEmail(em); setStatus('ready'); })
      .catch(() => {
        setStatus('error');
        setMessage('This reset link has expired or already been used.');
      });
  }, [mode, oobCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setMessage('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setMessage('Passwords do not match.'); return; }
    setMessage(''); setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus('success');
    } catch {
      setMessage('Failed to reset password. The link may have expired.');
    } finally { setLoading(false); }
  };

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px', padding: '11px 14px', fontSize: '14px', color: '#e2e8f0',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={BG}>
      <div style={{ height: '3px', background: 'linear-gradient(90deg, #c0392b 0%,#c0392b 25%,#e67e22 25%,#e67e22 50%,#27ae60 50%,#27ae60 75%,#2980b9 75%,#2980b9 100%)' }} />
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <img src="/favicon.svg" alt="NEU" style={{ width: 36, height: 36 }} />
        <div>
          <p style={{ ...S, fontSize: '8px', letterSpacing: '0.22em', color: '#f59e0b', textTransform: 'uppercase' }}>New Era University</p>
          <p style={{ ...D, fontSize: '14px', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>Library Management System</p>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '20px', padding: '36px 32px', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>

            {status === 'verifying' && (
              <p style={{ ...S, fontSize: '11px', color: '#475569', textAlign: 'center' }}>Verifying reset link…</p>
            )}

            {status === 'error' && (
              <div>
                <p style={{ ...S, fontSize: '9px', letterSpacing: '0.22em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '8px' }}>Password Reset</p>
                <h1 style={{ ...D, fontSize: '24px', fontWeight: 700, color: '#f1f5f9', marginBottom: '16px' }}>Link Expired</h1>
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 14px', marginBottom: '20px' }}>
                  <p style={{ ...S, fontSize: '11px', color: '#f87171' }}>{message}</p>
                </div>
                <button onClick={() => navigate('/login')} style={{ width: '100%', padding: '13px', borderRadius: '10px', background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', cursor: 'pointer', ...S, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700 }}>
                  Back to Sign In
                </button>
              </div>
            )}

            {status === 'ready' && (
              <div>
                <p style={{ ...S, fontSize: '9px', letterSpacing: '0.22em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '8px' }}>Password Reset</p>
                <h1 style={{ ...D, fontSize: '24px', fontWeight: 700, color: '#f1f5f9', marginBottom: '6px' }}>Set New Password</h1>
                <p style={{ ...S, fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>{email}</p>
                {message && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px' }}>
                    <p style={{ ...S, fontSize: '11px', color: '#f87171' }}>{message}</p>
                  </div>
                )}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ ...S, fontSize: '9px', letterSpacing: '0.18em', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '7px' }}>New Password</label>
                    <input type="password" style={inputStyle} placeholder="Min. 8 characters" value={password} onChange={e => { setPassword(e.target.value); setMessage(''); }} required autoFocus />
                  </div>
                  <div>
                    <label style={{ ...S, fontSize: '9px', letterSpacing: '0.18em', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '7px' }}>Confirm Password</label>
                    <input type="password" style={inputStyle} placeholder="Re-enter new password" value={confirm} onChange={e => { setConfirm(e.target.value); setMessage(''); }} required />
                  </div>
                  <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', borderRadius: '10px', background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', cursor: loading ? 'not-allowed' : 'pointer', ...S, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700 }}>
                    {loading ? 'Saving…' : 'Reset Password'}
                  </button>
                </form>
              </div>
            )}

            {status === 'success' && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '22px', color: '#34d399' }}>✓</div>
                <h1 style={{ ...D, fontSize: '24px', fontWeight: 700, color: '#f1f5f9', marginBottom: '8px' }}>Password Updated</h1>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>Sign in with your ID number and new password.</p>
                <button onClick={() => navigate('/login')} style={{ width: '100%', padding: '13px', borderRadius: '10px', background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', cursor: 'pointer', ...S, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700 }}>
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer style={{ textAlign: 'center', padding: '16px', ...S, fontSize: '9px', letterSpacing: '0.18em', color: '#1e3a5f', textTransform: 'uppercase' }}>
        New Era University — Library Management System
      </footer>
    </div>
  );
}
