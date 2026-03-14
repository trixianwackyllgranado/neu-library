// src/pages/RegisterPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import { COLLEGES } from '../data/colleges';

const S = { fontFamily: "'IBM Plex Mono', monospace" };
const D = { fontFamily: "'Playfair Display', serif" };

const BG = {
  minHeight: '100vh',
  background: 'linear-gradient(160deg, #060e1e 0%, #0a1628 50%, #0d1e36 100%)',
  display: 'flex', flexDirection: 'column',
};

const ID_REGEX = /^\d{2}-\d{5}-\d{3}$/;

function formatId(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [idNumber,      setIdNumber]      = useState('');
  const [idFormat,      setIdFormat]      = useState('');
  const [lastName,      setLastName]      = useState('');
  const [firstName,     setFirstName]     = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [college,       setCollege]       = useState('');
  const [course,        setCourse]        = useState('');
  const [password,      setPassword]      = useState('');
  const [confirm,       setConfirm]       = useState('');
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(false);

  // After successful registration
  const [registered, setRegistered] = useState(null); // { idNumber, name }

  const selectedCollege = COLLEGES.find(c => c.name === college);
  const courses = selectedCollege?.courses || [];

  const handleIdChange = (e) => {
    const f = formatId(e.target.value);
    setIdFormat(f); setIdNumber(f); setError('');
  };

  const handleCollegeChange = (e) => {
    setCollege(e.target.value);
    setCourse('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!ID_REGEX.test(idNumber)) {
      setError('ID Number must be in format 22-12345-123.'); return;
    }
    if (!lastName.trim() || !firstName.trim()) {
      setError('Last name and first name are required.'); return;
    }
    if (!college) {
      setError('Please select a college.'); return;
    }
    if (courses.length > 0 && !course) {
      setError('Please select a course.'); return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.'); return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.'); return;
    }

    setLoading(true);
    try {
      await register({
        idNumber:      idNumber.trim(),
        lastName:      lastName.trim(),
        firstName:     firstName.trim(),
        middleInitial: middleInitial.trim().replace(/\.+$/, ''),
        college:       college.trim(),
        course:        course.trim() || college.trim(),
        password,
      });
      setRegistered({
        idNumber: idNumber.trim(),
        name:     `${lastName.trim()}, ${firstName.trim()}`,
      });
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
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { ...S, fontSize: '9px', letterSpacing: '0.18em', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '7px' };
  const selectStyle = { ...inputStyle, appearance: 'none', cursor: 'pointer' };

  // ── QR code success screen ────────────────────────────────────────────────
  if (registered) {
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
          <div style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '20px', padding: '36px 32px', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>

              {/* Check mark */}
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '24px', color: '#34d399' }}>
                ✓
              </div>

              <p style={{ ...S, fontSize: '9px', letterSpacing: '0.22em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '8px' }}>Account Created</p>
              <h1 style={{ ...D, fontSize: '26px', fontWeight: 700, color: '#f1f5f9', marginBottom: '6px' }}>Welcome to NEU Library</h1>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '28px' }}>
                {registered.name} — <span style={{ ...S, color: '#f59e0b', fontSize: '12px' }}>{registered.idNumber}</span>
              </p>

              {/* QR Code */}
              <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', display: 'inline-block', marginBottom: '20px' }}>
                <QRCodeSVG
                  value={registered.idNumber}
                  size={180}
                  level="M"
                  includeMargin={false}
                />
              </div>

              <p style={{ ...S, fontSize: '10px', letterSpacing: '0.14em', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>
                Your Library QR Code
              </p>
              <p style={{ fontSize: '12px', color: '#475569', marginBottom: '24px', lineHeight: 1.6 }}>
                Save or screenshot this QR code. Show it to library staff to check in and out of the library instantly.
              </p>

              <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px', textAlign: 'left' }}>
                <p style={{ ...S, fontSize: '9px', letterSpacing: '0.14em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '6px' }}>How to use</p>
                <ul style={{ fontSize: '12px', color: '#64748b', paddingLeft: '16px', lineHeight: 1.8, margin: 0 }}>
                  <li>When entering the library, show this QR code to the staff scanner</li>
                  <li>You can also log in to the system using your ID Number</li>
                  <li>Your QR code will also be available in your dashboard</li>
                </ul>
              </div>

              <button onClick={() => navigate('/login')}
                style={{ width: '100%', padding: '13px', borderRadius: '10px', background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', cursor: 'pointer', ...S, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700 }}>
                Proceed to Sign In
              </button>
            </div>
          </div>
        </div>

        <footer style={{ textAlign: 'center', padding: '16px', ...S, fontSize: '9px', letterSpacing: '0.18em', color: '#1e3a5f', textTransform: 'uppercase' }}>
          New Era University — Library Management System
        </footer>
      </div>
    );
  }

  // ── Registration form ─────────────────────────────────────────────────────
  return (
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
        <div style={{ width: '100%', maxWidth: '440px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '20px', padding: '36px 32px', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>

            <div style={{ marginBottom: '28px' }}>
              <p style={{ ...S, fontSize: '9px', letterSpacing: '0.22em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '8px' }}>Student Registration</p>
              <h1 style={{ ...D, fontSize: '26px', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.1, marginBottom: '8px' }}>Create Account</h1>
              <p style={{ fontSize: '13px', color: '#475569' }}>
                Enter your student information to register.
              </p>
            </div>

            {error && (
              <div style={{ marginBottom: '20px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 14px' }}>
                <p style={{ ...S, fontSize: '11px', color: '#f87171' }}>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* ID Number */}
              <div>
                <label style={labelStyle}>ID Number <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text" inputMode="numeric"
                  style={{ ...inputStyle, ...S, letterSpacing: '0.14em' }}
                  placeholder="22-12345-123"
                  value={idFormat}
                  onChange={handleIdChange}
                  required
                />
                <p style={{ ...S, fontSize: '9px', color: '#334155', marginTop: '4px' }}>Format: YY-NNNNN-NNN</p>
              </div>

              {/* Name row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Last Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input style={inputStyle} placeholder="Santos" value={lastName} onChange={e => { setLastName(e.target.value); setError(''); }} required />
                </div>
                <div>
                  <label style={labelStyle}>First Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input style={inputStyle} placeholder="Juan" value={firstName} onChange={e => { setFirstName(e.target.value); setError(''); }} required />
                </div>
              </div>

              {/* Middle Initial */}
              <div>
                <label style={labelStyle}>Middle Initial</label>
                <input
                  style={{ ...inputStyle, width: '80px', textTransform: 'uppercase' }}
                  placeholder="D"
                  maxLength={2}
                  value={middleInitial}
                  onChange={e => { setMiddleInitial(e.target.value.replace(/[^a-zA-Z]/g, '')); setError(''); }}
                />
              </div>

              {/* College */}
              <div>
                <label style={labelStyle}>College <span style={{ color: '#ef4444' }}>*</span></label>
                <select style={selectStyle} value={college} onChange={handleCollegeChange} required>
                  <option value="">— Select College —</option>
                  {COLLEGES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              {/* Course — only if college has courses */}
              {college && courses.length > 0 && (
                <div>
                  <label style={labelStyle}>Course <span style={{ color: '#ef4444' }}>*</span></label>
                  <select style={selectStyle} value={course} onChange={e => { setCourse(e.target.value); setError(''); }} required>
                    <option value="">— Select Course —</option>
                    {courses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              {/* Password */}
              <div>
                <label style={labelStyle}>Password <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="password" style={inputStyle} placeholder="Min. 8 characters" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} required />
              </div>

              {/* Confirm Password */}
              <div>
                <label style={labelStyle}>Confirm Password <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="password" style={inputStyle} placeholder="Re-enter password" value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }} required />
              </div>

              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: '13px', borderRadius: '10px', marginTop: '4px', background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, ...S, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700 }}>
                {loading ? 'Creating Account…' : 'Create Account & Get QR Code'}
              </button>
            </form>

            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: '#475569' }}>
                Already have an account?{' '}
                <Link to="/login" style={{ color: '#f59e0b', fontWeight: 600, textDecoration: 'none', ...S, fontSize: '12px' }}>Sign In</Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer style={{ textAlign: 'center', padding: '16px', ...S, fontSize: '9px', letterSpacing: '0.18em', color: '#1e3a5f', textTransform: 'uppercase' }}>
        New Era University — Library Management System
      </footer>
    </div>
  );
}
