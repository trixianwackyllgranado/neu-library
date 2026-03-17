// src/pages/LoginPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const MONO  = { fontFamily: "'IBM Plex Mono', monospace" };
const SERIF = { fontFamily: "'Playfair Display', serif" };
const PP    = { fontFamily: "'Poppins', sans-serif" };

const NOTIF_KEY = 'neu_lib_pw_reset_acknowledged_v2'; // bumped version — won't show again

function formatId(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `${d.slice(0,2)}-${d.slice(2)}`;
  return `${d.slice(0,2)}-${d.slice(2,7)}-${d.slice(7)}`;
}

// Google G icon SVG
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate   = useNavigate();
  const { dark, toggle } = useTheme();

  const [idFormat,     setIdFormat]     = useState('');
  const [idNumber,     setIdNumber]     = useState('');
  const [password,     setPassword]     = useState('');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [googleLoading,setGoogleLoading]= useState(false);
  const [showPw,       setShowPw]       = useState(false);

  const inputBase = {
    width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)',
    borderRadius: '10px', padding: '12px 14px', fontSize: '14px', color: 'var(--text-primary)',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
  };
  const onFocus = e => { e.currentTarget.style.borderColor = 'var(--gold)'; };
  const onBlur  = e => { e.currentTarget.style.borderColor = 'var(--input-border)'; };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!idNumber.trim()) { setError('Please enter your ID number.'); return; }
    setLoading(true);
    try {
      await login(idNumber.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, var(--bg-base) 0%, var(--bg-mid) 55%, var(--bg-top) 100%)',
      display: 'flex', flexDirection: 'column', transition: 'background 0.25s',
    }}>
      {/* NEU colour bar */}
      <div style={{ height: '3px', background: 'linear-gradient(90deg,#c0392b 0%,#c0392b 25%,#e67e22 25%,#e67e22 50%,#27ae60 50%,#27ae60 75%,#2980b9 75%,#2980b9 100%)', flexShrink: 0 }} />

      {/* Header */}
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

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{ width: '100%', maxWidth: '400px', animation: 'fadeUp 0.35s ease both' }}>

          <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '20px', overflow: 'hidden', boxShadow: 'var(--shadow-modal)' }}>
            <div style={{ height: '3px', background: 'linear-gradient(90deg, var(--gold), transparent)' }} />

            <div style={{ padding: '32px 32px 38px' }}>
              <div style={{ marginBottom: '28px' }}>
                <p style={{ ...MONO, fontSize: '9px', letterSpacing: '0.24em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '8px' }}>Secure Access Portal</p>
                <h1 style={{ ...SERIF, fontSize: '30px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '8px' }}>Sign In</h1>
                <p style={{ ...PP, fontSize: '14px', color: 'var(--text-muted)' }}>Use your student ID number and password.</p>
              </div>

              {error && (
                <div style={{ marginBottom: '18px', background: 'var(--red-soft)', border: '1px solid var(--red-border)', borderRadius: '10px', padding: '12px 16px' }}>
                  <p style={{ ...MONO, fontSize: '12px', color: 'var(--red)' }}>{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <label style={{ ...MONO, fontSize: '10px', letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px', fontWeight: 600 }}>Student ID Number</label>
                  <input type="text" inputMode="numeric"
                    style={{ ...inputBase, ...MONO, letterSpacing: '0.16em' }}
                    placeholder="22-12345-123"
                    value={idFormat}
                    onChange={e => { const f = formatId(e.target.value); setIdFormat(f); setIdNumber(f); setError(''); }}
                    onFocus={onFocus} onBlur={onBlur}
                    required
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ ...MONO, fontSize: '10px', letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Password</label>
                    <Link to="/forgot-password" style={{ ...MONO, fontSize: '10px', color: 'var(--gold)', textDecoration: 'none', letterSpacing: '0.08em', opacity: 0.85 }}>
                      Forgot password?
                    </Link>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input type={showPw ? 'text' : 'password'}
                      style={{ ...inputBase, paddingRight: '44px' }}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(''); }}
                      onFocus={onFocus} onBlur={onBlur}
                      required autoComplete="current-password"
                    />
                    <button type="button" onClick={() => setShowPw(s => !s)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center' }}>
                      {showPw
                        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading || googleLoading}
                  style={{ width: '100%', padding: '13px', borderRadius: '10px', marginTop: '4px', background: loading ? 'var(--surface)' : 'var(--gold-soft)', border: '1px solid var(--gold-border)', color: 'var(--gold)', cursor: (loading || googleLoading) ? 'not-allowed' : 'pointer', opacity: (loading || googleLoading) ? 0.65 : 1, ...MONO, fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, transition: 'all 0.15s' }}>
                  {loading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--divider)' }} />
                <span style={{ ...MONO, fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>or</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--divider)' }} />
              </div>

              {/* Google Sign-In */}
              <button
                onClick={handleGoogle}
                disabled={loading || googleLoading}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px',
                  background: 'var(--surface)', border: '1px solid var(--card-border)',
                  color: 'var(--text-primary)', cursor: (loading || googleLoading) ? 'not-allowed' : 'pointer',
                  opacity: (loading || googleLoading) ? 0.65 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  ...PP, fontSize: '14px', fontWeight: 500, transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!loading && !googleLoading) e.currentTarget.style.background = 'var(--surface-hover, rgba(255,255,255,0.07))'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; }}
              >
                {googleLoading
                  ? <span style={{ ...MONO, fontSize: '11px', letterSpacing: '0.1em' }}>Connecting…</span>
                  : <><GoogleIcon /><span>Continue with Google</span></>
                }
              </button>

              <div style={{ marginTop: '20px', paddingTop: '18px', borderTop: '1px solid var(--divider)', textAlign: 'center' }}>
                <p style={{ ...PP, fontSize: '14px', color: 'var(--text-body)' }}>
                  No account?{' '}
                  <Link to="/register" style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none', ...MONO, fontSize: '13px' }}>
                    Create Account
                  </Link>
                </p>
              </div>
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: '20px', ...MONO, fontSize: '10px', letterSpacing: '0.14em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            New Era University — Library Management System
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}
