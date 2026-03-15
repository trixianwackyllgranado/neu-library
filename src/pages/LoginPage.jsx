// src/pages/LoginPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const MONO  = { fontFamily: "'IBM Plex Mono', monospace" };
const SERIF = { fontFamily: "'Playfair Display', serif" };

function formatId(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `${d.slice(0,2)}-${d.slice(2)}`;
  return `${d.slice(0,2)}-${d.slice(2,7)}-${d.slice(7)}`;
}

export default function LoginPage() {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const { dark, toggle } = useTheme();

  const [idFormat, setIdFormat] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPw,   setShowPw]   = useState(false);

  const inputBase = {
    width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)',
    borderRadius: '10px', padding: '12px 14px', fontSize: '14px', color: 'var(--text-primary)',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s, background 0.15s',
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

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, var(--bg-base) 0%, var(--bg-mid) 55%, var(--bg-top) 100%)',
      display: 'flex', flexDirection: 'column', transition: 'background 0.25s',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: '1px solid var(--divider)', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Logo — place neu-logo.png in /public/ folder */}
          <img
            src="/liblogo.png"
            alt="NEU"
            style={{ width: 38, height: 38, objectFit: 'contain' }}
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
          <div>
            <p style={{ ...MONO, fontSize: '8px', letterSpacing: '0.24em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '2px' }}>New Era University</p>
            <p style={{ ...SERIF, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>Library Management System</p>
          </div>
        </div>
        {/* Theme toggle */}
        <button onClick={toggle} title={dark ? 'Light Mode' : 'Dark Mode'}
          style={{ width: 36, height: 36, borderRadius: '8px', border: '1px solid var(--card-border)', background: 'var(--surface)', color: 'var(--gold)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
          {dark ? (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>) : (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>)}
        </button>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{ width: '100%', maxWidth: '400px', animation: 'fadeUp 0.35s ease both' }}>

          {/* Card */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '20px', padding: '38px 32px', boxShadow: 'var(--shadow-modal)' }}>

            {/* Gold top accent */}
            <div style={{ height: '3px', background: 'linear-gradient(90deg, var(--gold), transparent)', borderRadius: '3px', marginBottom: '28px', marginLeft: '-32px', marginRight: '-32px', marginTop: '-38px', borderTopLeftRadius: '20px', borderTopRightRadius: '20px' }} />

            <div style={{ marginBottom: '28px' }}>
              <p style={{ ...MONO, fontSize: '9px', letterSpacing: '0.24em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '8px' }}>Secure Access Portal</p>
              <h1 style={{ ...SERIF, fontSize: '30px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '8px' }}>Sign In</h1>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Use your student ID number and password.</p>
            </div>

            {error && (
              <div style={{ marginBottom: '18px', background: 'var(--red-soft)', border: '1px solid var(--red-border)', borderRadius: '10px', padding: '12px 16px', animation: 'fadeIn 0.2s ease' }}>
                <p style={{ ...MONO, fontSize: '12px', color: 'var(--red)' }}>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ ...MONO, fontSize: '10px', letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Student ID Number
                </label>
                <input
                  type="text" inputMode="numeric"
                  style={{ ...inputBase, ...MONO, letterSpacing: '0.16em' }}
                  placeholder="22-12345-123"
                  value={idFormat}
                  onChange={e => { const f = formatId(e.target.value); setIdFormat(f); setIdNumber(f); setError(''); }}
                  onFocus={onFocus} onBlur={onBlur}
                  required
                />
              </div>

              <div>
                <label style={{ ...MONO, fontSize: '10px', letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    style={{ ...inputBase, paddingRight: '44px' }}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    onFocus={onFocus} onBlur={onBlur}
                    required autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', padding: '4px' }}>
                    {showPw ? (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>) : (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>)}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '13px', borderRadius: '10px', marginTop: '4px',
                  background: loading ? 'var(--surface)' : 'var(--gold-soft)',
                  border: '1px solid var(--gold-border)',
                  color: 'var(--gold)', cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.65 : 1,
                  ...MONO, fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.filter = 'brightness(1.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)'; }}
              >
                {loading ? 'Signing In…' : 'Sign In'}
              </button>
            </form>

            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--divider)', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-body)' }}>
                No account?{' '}
                <Link to="/register" style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none', ...MONO, fontSize: '13px' }}>
                  Create Account
                </Link>
              </p>
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: '20px', ...MONO, fontSize: '10px', letterSpacing: '0.14em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            New Era University — Library Management System
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
      `}</style>
    </div>
  );
}
