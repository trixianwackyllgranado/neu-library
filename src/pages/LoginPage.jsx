// src/pages/LoginPage.jsx
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext';

const MONO  = { fontFamily: "'IBM Plex Mono', monospace" };
const SERIF = { fontFamily: "'Playfair Display', serif" };

const C = {
  gold:      '#f59e0b',
  white:     '#f1f5f9',
  body:      '#cbd5e1',
  muted:     '#94a3b8',
  border:    'rgba(255,255,255,0.12)',
  surface:   'rgba(255,255,255,0.05)',
  surfaceHov:'rgba(255,255,255,0.08)',
  red:       '#f87171',
  green:     '#34d399',
};

const BG = {
  minHeight: '100vh',
  background: 'linear-gradient(160deg, #060e1e 0%, #0a1628 50%, #0d1e36 100%)',
  display: 'flex', flexDirection: 'column',
};

function formatId(raw) {
  // If already formatted (QR scan delivers "24-12998-121"), pass through as-is
  if (raw.includes('-')) return raw.trim();
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `${d.slice(0,2)}-${d.slice(2)}`;
  return `${d.slice(0,2)}-${d.slice(2,7)}-${d.slice(7)}`;
}

function Header() {
  return (
    <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '13px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <img src="/favicon.svg" alt="NEU" style={{ width: 34, height: 34 }} />
      <div>
        <p style={{ ...MONO, fontSize: '8px', letterSpacing: '0.24em', color: C.gold, textTransform: 'uppercase', marginBottom: '2px' }}>New Era University</p>
        <p style={{ ...SERIF, fontSize: '14px', fontWeight: 700, color: C.white, lineHeight: 1.2 }}>Library Management System</p>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer style={{ textAlign: 'center', padding: '16px', ...MONO, fontSize: '9px', letterSpacing: '0.18em', color: '#2d4a7a', textTransform: 'uppercase' }}>
      New Era University — Library Management System
    </footer>
  );
}

// ── QR scanner modal ──────────────────────────────────────────────────────────
function QRScanner({ onResult, onClose }) {
  const scannerRef = useRef(null);
  const doneRef    = useRef(false);

  useEffect(() => {
    // Small delay so the modal DOM is fully painted before we attach
    const timer = setTimeout(async () => {
      const scanner = new Html5Qrcode('qr-login-reader', { verbose: false });
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (text) => {
            if (doneRef.current) return;
            doneRef.current = true;
            // Stop cleanly before calling onResult so the DOM element survives
            scanner.stop().catch(() => {}).finally(() => {
              try { scanner.clear(); } catch {}
              onResult(text.trim());
            });
          },
          () => {},
        );
      } catch {
        onClose(); // camera denied — close modal gracefully
      }
    }, 120);

    return () => {
      clearTimeout(timer);
      doneRef.current = true;
      const sc = scannerRef.current;
      if (sc) {
        try {
          if (sc.isRunning()) sc.stop().catch(() => {}).finally(() => { try { sc.clear(); } catch {} });
          else sc.clear();
        } catch {}
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.88)', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '360px', background: '#0d1e36', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ height: '2px', background: 'linear-gradient(90deg, #c0392b, #f39c12, #2980b9)' }} />
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <p style={{ ...MONO, fontSize: '9px', letterSpacing: '0.2em', color: C.gold, textTransform: 'uppercase', marginBottom: '2px' }}>QR Sign-In</p>
              <p style={{ fontSize: '13px', color: C.body }}>Point camera at your library QR code</p>
            </div>
            <button onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '7px', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, cursor: 'pointer', fontSize: '14px' }}>
              ✕
            </button>
          </div>
          <div id="qr-login-reader" style={{ borderRadius: '10px', overflow: 'hidden', background: '#000', minHeight: '260px' }} />
          <p style={{ ...MONO, fontSize: '10px', color: C.muted, textAlign: 'center', marginTop: '10px' }}>
            Point camera at your library QR code
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { login, loginWithQRToken } = useAuth();
  const navigate  = useNavigate();

  const [idNumber, setIdNumber] = useState('');
  const [idFormat, setIdFormat] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState('');

  const inputBase = (extra = {}) => ({
    width: '100%', background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: '9px', padding: '11px 14px', fontSize: '14px', color: C.white,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s, background 0.15s',
    ...extra,
  });
  const onFocus = e => { e.currentTarget.style.borderColor = C.gold;   e.currentTarget.style.background = C.surfaceHov; };
  const onBlur  = e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; };

  const handleScan = async (raw) => {
    setScanning(false);
    setError('');
    // New QR codes: 32-char hex token (no dashes). Legacy QR: ID number (has dashes).
    const isToken = /^[a-f0-9]{32}$/i.test(raw.trim());
    if (isToken) {
      setLoading(true);
      setScanNote('QR recognised — signing you in…');
      try {
        await loginWithQRToken(raw.trim());
        navigate('/dashboard', { replace: true });
      } catch (err) {
        setError(err.message);
        setScanNote('');
      } finally {
        setLoading(false);
      }
    } else {
      // Legacy / manual fallback — pre-fill ID field, still requires password
      const f = formatId(raw);
      setIdFormat(f);
      setIdNumber(f);
      setScanNote('ID pre-filled. Enter your password to continue.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!idNumber.trim()) { setError('Please enter your ID number.'); return; }
    setLoading(true);
    try {
      await login(idNumber.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <>
      {scanning && <QRScanner onResult={handleScan} onClose={() => setScanning(false)} />}

      {/* QR login in-progress overlay */}
      {loading && !scanning && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,14,30,0.92)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, border: '3px solid rgba(245,158,11,0.2)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ ...MONO, fontSize: '11px', letterSpacing: '0.16em', color: C.gold, textTransform: 'uppercase' }}>Signing In…</p>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      <div style={BG}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg,#c0392b 0%,#c0392b 25%,#e67e22 25%,#e67e22 50%,#27ae60 50%,#27ae60 75%,#2980b9 75%,#2980b9 100%)', flexShrink: 0 }} />
        <Header />

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
          <div style={{ width: '100%', maxWidth: '400px' }}>
            <div style={{ background: 'rgba(15,34,68,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', padding: '36px 32px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>

              {/* Heading */}
              <div style={{ marginBottom: '28px' }}>
                <p style={{ ...MONO, fontSize: '9px', letterSpacing: '0.24em', color: C.gold, textTransform: 'uppercase', marginBottom: '8px' }}>Secure Access Portal</p>
                <h1 style={{ ...SERIF, fontSize: '30px', fontWeight: 700, color: C.white, lineHeight: 1.1, marginBottom: '8px' }}>Sign In</h1>
                <p style={{ fontSize: '14px', color: C.body }}>Use your student ID number and password.</p>
              </div>

              {/* Error */}
              {error && (
                <div style={{ marginBottom: '18px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '10px', padding: '12px 16px' }}>
                  <p style={{ ...MONO, fontSize: '12px', color: C.red }}>{error}</p>
                </div>
              )}

              {/* Scan note */}
              {scanNote && !error && (
                <div style={{ marginBottom: '18px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', padding: '10px 16px' }}>
                  <p style={{ ...MONO, fontSize: '11px', color: C.gold }}>{scanNote}</p>
                </div>
              )}

              {/* QR scan button */}
              <button onClick={() => { setScanNote(''); setScanning(true); }}
                style={{
                  width: '100%', padding: '11px', borderRadius: '10px', marginBottom: '20px',
                  background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.18)',
                  color: C.muted, cursor: 'pointer', ...MONO, fontSize: '10px', letterSpacing: '0.14em',
                  textTransform: 'uppercase', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)'; e.currentTarget.style.color = C.gold; e.currentTarget.style.background = 'rgba(245,158,11,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; e.currentTarget.style.color = C.muted; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}>
                <span style={{ fontSize: '14px' }}>▣</span> Scan Library QR Code
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                <p style={{ ...MONO, fontSize: '9px', letterSpacing: '0.14em', color: C.muted, textTransform: 'uppercase' }}>or enter manually</p>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ ...MONO, fontSize: '10px', letterSpacing: '0.16em', color: C.muted, textTransform: 'uppercase', display: 'block', marginBottom: '7px', fontWeight: 600 }}>
                    Student ID Number
                  </label>
                  <input type="text" inputMode="numeric"
                    style={inputBase({ ...MONO, letterSpacing: '0.16em' })}
                    placeholder="22-12345-123"
                    value={idFormat}
                    onChange={e => { const f = formatId(e.target.value); setIdFormat(f); setIdNumber(f); setError(''); setScanNote(''); }}
                    onFocus={onFocus} onBlur={onBlur} required />
                </div>

                <div>
                  <label style={{ ...MONO, fontSize: '10px', letterSpacing: '0.16em', color: C.muted, textTransform: 'uppercase', display: 'block', marginBottom: '7px', fontWeight: 600 }}>
                    Password
                  </label>
                  <input type="password" style={inputBase()}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    onFocus={onFocus} onBlur={onBlur}
                    required autoComplete="current-password" />
                </div>

                <button type="submit" disabled={loading}
                  style={{
                    width: '100%', padding: '13px', borderRadius: '10px', marginTop: '4px',
                    background: loading ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.18)',
                    border: '1px solid rgba(245,158,11,0.45)',
                    color: C.gold, cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.65 : 1,
                    ...MONO, fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(245,158,11,0.26)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = loading ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.18)'; }}>
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
        <Footer />
      </div>
    </>
  );
}
