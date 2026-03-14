// src/pages/LoginPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MONO  = { fontFamily: "'IBM Plex Mono', monospace" };
const SERIF = { fontFamily: "'Playfair Display', serif" };

const C = {
  gold:       '#f59e0b',
  white:      '#f1f5f9',
  body:       '#cbd5e1',
  muted:      '#94a3b8',
  border:     'rgba(255,255,255,0.12)',
  surface:    'rgba(255,255,255,0.05)',
  surfaceHov: 'rgba(255,255,255,0.08)',
  red:        '#f87171',
};

const BG = {
  minHeight: '100vh',
  background: 'linear-gradient(160deg, #060e1e 0%, #0a1628 50%, #0d1e36 100%)',
  display: 'flex', flexDirection: 'column',
};

function formatId(raw) {
  if (raw.includes('-')) return raw.trim();
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `${d.slice(0,2)}-${d.slice(2)}`;
  return `${d.slice(0,2)}-${d.slice(2,7)}-${d.slice(7)}`;
}

export default function LoginPage() {
  const { login }  = useAuth();
  const navigate   = useNavigate();

  const [idFormat, setIdFormat] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const inputBase = (extra = {}) => ({
    width: '100%', background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: '9px', padding: '11px 14px', fontSize: '14px', color: C.white,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s, background 0.15s', ...extra,
  });
  const onFocus = e => { e.currentTarget.style.borderColor = C.gold;   e.currentTarget.style.background = C.surfaceHov; };
  const onBlur  = e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; };

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
    <div style={BG}>
      <div style={{ height: '3px', background: 'linear-gradient(90deg,#c0392b 0%,#c0392b 25%,#e67e22 25%,#e67e22 50%,#27ae60 50%,#27ae60 75%,#2980b9 75%,#2980b9 100%)', flexShrink: 0 }} />

      {/* Header */}
      <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '13px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <img src="/favicon.svg" alt="NEU" style={{ width: 34, height: 34 }} />
        <div>
          <p style={{ ...MONO, fontSize: '8px', letterSpacing: '0.24em', color: C.gold, textTransform: 'uppercase', marginBottom: '2px' }}>New Era University</p>
          <p style={{ ...SERIF, fontSize: '14px', fontWeight: 700, color: C.white, lineHeight: 1.2 }}>Library Management System</p>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{ background: 'rgba(15,34,68,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', padding: '36px 32px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>

            <div style={{ marginBottom: '28px' }}>
              <p style={{ ...MONO, fontSize: '9px', letterSpacing: '0.24em', color: C.gold, textTransform: 'uppercase', marginBottom: '8px' }}>Secure Access Portal</p>
              <h1 style={{ ...SERIF, fontSize: '30px', fontWeight: 700, color: C.white, lineHeight: 1.1, marginBottom: '8px' }}>Sign In</h1>
              <p style={{ fontSize: '14px', color: C.body }}>Use your student ID number and password.</p>
            </div>

            {error && (
              <div style={{ marginBottom: '18px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '10px', padding: '12px 16px' }}>
                <p style={{ ...MONO, fontSize: '12px', color: C.red }}>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ ...MONO, fontSize: '10px', letterSpacing: '0.16em', color: C.muted, textTransform: 'uppercase', display: 'block', marginBottom: '7px', fontWeight: 600 }}>
                  Student ID Number
                </label>
                <input
                  type="text" inputMode="numeric"
                  style={inputBase({ ...MONO, letterSpacing: '0.16em' })}
                  placeholder="22-12345-123"
                  value={idFormat}
                  onChange={e => { const f = formatId(e.target.value); setIdFormat(f); setIdNumber(f); setError(''); }}
                  onFocus={onFocus} onBlur={onBlur}
                  required
                />
              </div>

              <div>
                <label style={{ ...MONO, fontSize: '10px', letterSpacing: '0.16em', color: C.muted, textTransform: 'uppercase', display: 'block', marginBottom: '7px', fontWeight: 600 }}>
                  Password
                </label>
                <input
                  type="password"
                  style={inputBase()}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  onFocus={onFocus} onBlur={onBlur}
                  required autoComplete="current-password"
                />
              </div>

              <button
                type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '13px', borderRadius: '10px', marginTop: '4px',
                  background: loading ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.18)',
                  border: '1px solid rgba(245,158,11,0.45)',
                  color: C.gold, cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.65 : 1,
                  ...MONO, fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(245,158,11,0.26)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = loading ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.18)'; }}
              >
                {loading ? 'Signing In…' : 'Sign In'}
              </button>
            </form>

            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: C.body }}>
                No account?{' '}
                <Link to="/register" style={{ color: C.gold, fontWeight: 600, textDecoration: 'none', ...MONO, fontSize: '13px' }}>
                  Create Account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer style={{ textAlign: 'center', padding: '16px', ...MONO, fontSize: '9px', letterSpacing: '0.18em', color: '#2d4a7a', textTransform: 'uppercase' }}>
        New Era University — Library Management System
      </footer>
    </div>
  );
}
