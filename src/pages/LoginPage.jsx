// src/pages/LoginPage.jsx
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext';

const S = { fontFamily: "'IBM Plex Mono', monospace" };
const D = { fontFamily: "'Playfair Display', serif" };

const BG = {
  minHeight: '100vh',
  background: 'linear-gradient(160deg, #060e1e 0%, #0a1628 50%, #0d1e36 100%)',
  display: 'flex', flexDirection: 'column',
};

function formatId(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// ── Inline QR scanner for login ───────────────────────────────────────────────
function QRLoginScanner({ onResult, onClose }) {
  const scannerRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-login-reader');
    scannerRef.current = scanner;
    mountedRef.current = true;

    scanner.start(
      { facingMode: 'environment' },
      { fps: 12, qrbox: { width: 220, height: 220 } },
      (text) => {
        if (!mountedRef.current) return;
        // QR payload is just the ID number
        const clean = text.trim();
        onResult(clean);
      },
      () => {},
    ).catch(() => {});

    return () => {
      mountedRef.current = false;
      scanner.isRunning() && scanner.stop().catch(() => {});
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '360px', background: '#0d1e36', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ height: '2px', background: 'linear-gradient(90deg, #c0392b 0%, #f39c12 50%, #2980b9 100%)' }} />
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <p style={{ ...S, fontSize: '9px', letterSpacing: '0.2em', color: '#f59e0b', textTransform: 'uppercase' }}>Scan QR Code</p>
            <button onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>
              ✕
            </button>
          </div>
          <div id="qr-login-reader" style={{ borderRadius: '8px', overflow: 'hidden' }} />
          <p style={{ ...S, fontSize: '10px', color: '#475569', textAlign: 'center', marginTop: '12px' }}>
            Point camera at your library QR code
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [idNumber,  setIdNumber]  = useState('');
  const [idFormat,  setIdFormat]  = useState('');
  const [password,  setPassword]  = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [scanning,  setScanning]  = useState(false);
  const [scanNote,  setScanNote]  = useState('');

  const handleIdChange = (e) => {
    const f = formatId(e.target.value);
    setIdFormat(f); setIdNumber(f); setError(''); setScanNote('');
  };

  const handleScan = (rawValue) => {
    setScanning(false);
    const formatted = formatId(rawValue);
    setIdFormat(formatted);
    setIdNumber(formatted);
    setScanNote('ID pre-filled from QR code. Enter your password to continue.');
  };

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

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px', padding: '11px 14px', fontSize: '14px', color: '#e2e8f0',
    fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box',
  };
  const focus = (e) => e.currentTarget.style.borderColor = '#f59e0b';
  const blur  = (e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';

  return (
    <>
      {scanning && <QRLoginScanner onResult={handleScan} onClose={() => setScanning(false)} />}

      <div style={BG}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #c0392b 0%,#c0392b 25%,#e67e22 25%,#e67e22 50%,#27ae60 50%,#27ae60 75%,#2980b9 75%,#2980b9 100%)', flexShrink: 0 }} />

        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <img src="/favicon.svg" alt="NEU" style={{ width: 36, height: 36 }} />
          <div>
            <p style={{ ...S, fontSize: '8px', letterSpacing: '0.22em', color: '#f59e0b', textTransform: 'uppercase' }}>New Era University</p>
            <p style={{ ...D, fontSize: '14px', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>Library Management System</p>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
          <div style={{ width: '100%', maxWidth: '400px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '20px', padding: '36px 32px', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>

              <div style={{ marginBottom: '28px' }}>
                <p style={{ ...S, fontSize: '9px', letterSpacing: '0.22em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '8px' }}>Secure Access Portal</p>
                <h1 style={{ ...D, fontSize: '28px', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.1, marginBottom: '8px' }}>Sign In</h1>
                <p style={{ fontSize: '13px', color: '#475569' }}>Sign in with your student ID number.</p>
              </div>

              {error && (
                <div style={{ marginBottom: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 14px' }}>
                  <p style={{ ...S, fontSize: '11px', color: '#f87171' }}>{error}</p>
                </div>
              )}

              {scanNote && !error && (
                <div style={{ marginBottom: '16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '10px 14px' }}>
                  <p style={{ ...S, fontSize: '11px', color: '#f59e0b' }}>{scanNote}</p>
                </div>
              )}

              {/* QR scan button */}
              <button onClick={() => { setScanNote(''); setScanning(true); }}
                style={{
                  width: '100%', padding: '11px', borderRadius: '10px', marginBottom: '18px',
                  background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)',
                  color: '#64748b', cursor: 'pointer', ...S, fontSize: '10px', letterSpacing: '0.12em',
                  textTransform: 'uppercase', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)'; e.currentTarget.style.color = '#f59e0b'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#64748b'; }}>
                Scan Library QR Code
              </button>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ ...S, fontSize: '9px', letterSpacing: '0.18em', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '7px' }}>Student ID Number</label>
                  <input
                    type="text" inputMode="numeric"
                    style={{ ...inputStyle, ...S, letterSpacing: '0.12em' }}
                    placeholder="22-12345-123"
                    value={idFormat}
                    onChange={handleIdChange}
                    onFocus={focus} onBlur={blur}
                    required
                  />
                </div>
                <div>
                  <label style={{ ...S, fontSize: '9px', letterSpacing: '0.18em', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '7px' }}>Password</label>
                  <input
                    type="password" style={inputStyle}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    onFocus={focus} onBlur={blur}
                    required autoComplete="current-password"
                  />
                </div>
                <button type="submit" disabled={loading}
                  style={{ width: '100%', padding: '13px', borderRadius: '10px', marginTop: '4px', background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', cursor: loading ? 'not-allowed' : 'pointer', ...S, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, transition: 'all 0.15s' }}>
                  {loading ? 'Signing In…' : 'Sign In'}
                </button>
              </form>

              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#475569' }}>
                  No account?{' '}
                  <Link to="/register" style={{ color: '#f59e0b', fontWeight: 600, textDecoration: 'none', ...S, fontSize: '12px' }}>Create Account</Link>
                </p>
              </div>
            </div>
          </div>
        </div>

        <footer style={{ textAlign: 'center', padding: '16px', ...S, fontSize: '9px', letterSpacing: '0.18em', color: '#1e3a5f', textTransform: 'uppercase' }}>
          New Era University — Library Management System
        </footer>
      </div>
    </>
  );
}
