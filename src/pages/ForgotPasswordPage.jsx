// src/pages/ForgotPasswordPage.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const MONO  = { fontFamily: "'IBM Plex Mono', monospace" };
const SERIF = { fontFamily: "'Playfair Display', serif" };
const PP    = { fontFamily: "'Poppins', sans-serif" };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const { sendResetEmail } = useAuth();
  const { dark, toggle }   = useTheme();

  const [email,    setEmail]    = useState('');
  const [status,   setStatus]   = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const inputBase = {
    width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)',
    borderRadius: '10px', padding: '12px 14px', fontSize: '14px', color: 'var(--text-primary)',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
  };
  const onFocus = e => { e.currentTarget.style.borderColor = 'var(--gold)'; };
  const onBlur  = e => { e.currentTarget.style.borderColor = 'var(--input-border)'; };

  const isValid = EMAIL_REGEX.test(email.trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      await sendResetEmail(email);
      setStatus('sent');
    } catch (err) {
      setErrorMsg(err.message || 'An unexpected error occurred. Please try again.');
      setStatus('error');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, var(--bg-base) 0%, var(--bg-mid) 55%, var(--bg-top) 100%)',
      display: 'flex', flexDirection: 'column', transition: 'background 0.25s',
    }}>
      <div style={{ height: '3px', background: 'linear-gradient(90deg,#c0392b 0%,#c0392b 25%,#e67e22 25%,#e67e22 50%,#27ae60 50%,#27ae60 75%,#2980b9 75%,#2980b9 100%)', flexShrink: 0 }} />

      <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: '1px solid var(--divider)', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src="/liblogo.png" alt="NEU" style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: '50%' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
          <div>
            <p style={{ ...MONO, fontSize: '8px', letterSpacing: '0.24em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '2px' }}>New Era University</p>
            <p style={{ ...SERIF, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>Library Management System</p>
          </div>
        </div>
        <button onClick={toggle} title={dark ? 'Light Mode' : 'Dark Mode'}
          style={{ width: 36, height: 36, borderRadius: '8px', border: '1px solid var(--card-border)', background: 'var(--surface)', color: 'var(--gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
          {dark
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          }
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{ width: '100%', maxWidth: '420px', animation: 'fadeUp 0.35s ease both' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '20px', overflow: 'hidden', boxShadow: 'var(--shadow-modal)' }}>
            <div style={{ height: '3px', background: 'linear-gradient(90deg, var(--gold), transparent)' }} />

            <div style={{ padding: '32px 32px 38px' }}>

              {status === 'sent' ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </div>
                  <p style={{ ...MONO, fontSize: '9px', letterSpacing: '0.24em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '8px' }}>Check Your Email</p>
                  <h2 style={{ ...SERIF, fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>Reset Link Sent</h2>
                  <p style={{ ...PP, fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '8px' }}>
                    If <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> is registered, a reset link has been sent to that address.
                  </p>
                  <p style={{ ...PP, fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.65, marginBottom: '24px' }}>
                    Check your spam folder if you don't see it within a few minutes.
                  </p>
                  <button
                    onClick={() => { setStatus('idle'); setEmail(''); setErrorMsg(''); }}
                    style={{ ...MONO, fontSize: '11px', letterSpacing: '0.14em', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase' }}
                  >
                    Try a different email
                  </button>
                </div>

              ) : (
                <>
                  <div style={{ marginBottom: '28px' }}>
                    <p style={{ ...MONO, fontSize: '9px', letterSpacing: '0.24em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '8px' }}>Account Recovery</p>
                    <h1 style={{ ...SERIF, fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '10px' }}>Forgot Password?</h1>
                    <p style={{ ...PP, fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                      Enter your NEU institutional email and we'll send a password reset link to that address.
                    </p>
                    <p style={{ ...MONO, fontSize: '11px', color: 'var(--text-dim)', marginTop: '8px' }}>
                      e.g. firstname.lastname@neu.edu.ph
                    </p>
                  </div>

                  {status === 'error' && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 14px', marginBottom: '18px' }}>
                      <p style={{ ...MONO, fontSize: '11px', color: '#f87171' }}>{errorMsg}</p>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <label style={{ ...MONO, fontSize: '10px', letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                        Institutional Email
                      </label>
                      <input
                        type="email"
                        inputMode="email"
                        style={inputBase}
                        placeholder="firstname.lastname@neu.edu.ph"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setErrorMsg(''); if (status === 'error') setStatus('idle'); }}
                        onFocus={onFocus}
                        onBlur={onBlur}
                        autoFocus
                        autoComplete="email"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!isValid || status === 'loading'}
                      style={{
                        width: '100%', padding: '13px', borderRadius: '10px',
                        background: (isValid && status !== 'loading') ? 'var(--gold-soft)' : 'var(--surface)',
                        border: '1px solid var(--gold-border)', color: 'var(--gold)',
                        cursor: (isValid && status !== 'loading') ? 'pointer' : 'not-allowed',
                        opacity: (isValid && status !== 'loading') ? 1 : 0.5,
                        ...MONO, fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, transition: 'all 0.15s',
                      }}
                    >
                      {status === 'loading' ? 'Sending…' : 'Send Reset Link'}
                    </button>
                  </form>
                </>
              )}

              <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--divider)', textAlign: 'center' }}>
                <Link to="/login" style={{ ...MONO, fontSize: '12px', color: 'var(--gold)', textDecoration: 'none', letterSpacing: '0.1em' }}>
                  ← Back to Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  );
}
