// src/pages/RegisterPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import { COLLEGES } from '../data/colleges';

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

const ID_REGEX = /^\d{2}-\d{5}-\d{3}$/;

const INVITE_CODES = { staff: 'NEU-STAFF-2123', admin: 'NEU-ADMIN-2067' };

const ROLES = {
  student: { label: 'Student',       desc: 'Browse books, request borrows, and log library visits.' },
  staff:   { label: 'Library Staff', desc: 'Manage borrowing, view student records, and oversee the logger.' },
  admin:   { label: 'Administrator', desc: 'Full system access including user management and reports.' },
};

function formatId(raw) {
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

function Card({ children }) {
  return (
    <div style={{ background: 'rgba(15,34,68,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', padding: '36px 32px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
      {children}
    </div>
  );
}

function Eyebrow({ children }) {
  return <p style={{ ...MONO, fontSize: '9px', letterSpacing: '0.24em', color: C.gold, textTransform: 'uppercase', marginBottom: '8px' }}>{children}</p>;
}

function FieldLabel({ children, required }) {
  return (
    <label style={{ ...MONO, fontSize: '10px', letterSpacing: '0.16em', color: C.muted, textTransform: 'uppercase', display: 'block', marginBottom: '7px', fontWeight: 600 }}>
      {children}{required && <span style={{ color: C.red, marginLeft: '3px' }}>*</span>}
    </label>
  );
}

function Hint({ children }) {
  return <p style={{ ...MONO, fontSize: '10px', color: C.muted, marginTop: '5px' }}>{children}</p>;
}

function primaryBtn(loading = false) {
  return {
    width: '100%', padding: '13px', borderRadius: '10px',
    background: loading ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.18)',
    border: '1px solid rgba(245,158,11,0.45)',
    color: C.gold, cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.65 : 1,
    ...MONO, fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700,
    transition: 'all 0.15s',
  };
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [role,          setRole]          = useState('student');
  const [inviteCode,    setInviteCode]    = useState('');
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
  const [registered,    setRegistered]    = useState(null);

  const needsCode = role === 'staff' || role === 'admin';
  const selectedCollege = COLLEGES.find(c => c.name === college);
  const courses = selectedCollege?.courses || [];

  const inputBase = (extra = {}) => ({
    width: '100%', background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: '9px', padding: '11px 14px', fontSize: '14px', color: C.white,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s, background 0.15s',
    ...extra,
  });
  const onFocus = e => { e.currentTarget.style.borderColor = C.gold;   e.currentTarget.style.background = C.surfaceHov; };
  const onBlur  = e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!ID_REGEX.test(idNumber))             { setError('ID Number must be in format 22-12345-123.'); return; }
    if (!lastName.trim() || !firstName.trim()){ setError('Last name and first name are required.'); return; }
    if (!college)                             { setError('Please select a college.'); return; }
    if (courses.length > 0 && !course)        { setError('Please select a course.'); return; }
    if (needsCode && !inviteCode.trim())      { setError(`An invite code is required to register as ${ROLES[role].label}.`); return; }
    if (needsCode && inviteCode.trim() !== INVITE_CODES[role]) { setError(`Invalid invite code for ${ROLES[role].label}.`); return; }
    if (password.length < 8)                  { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm)                 { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      await register({ idNumber: idNumber.trim(), lastName: lastName.trim(), firstName: firstName.trim(),
        middleInitial: middleInitial.trim().replace(/\.+$/, ''), college: college.trim(),
        course: course.trim() || college.trim(), role, password });
      setRegistered({ idNumber: idNumber.trim(), name: `${lastName.trim()}, ${firstName.trim()}` });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ── Success / QR screen ───────────────────────────────────────────────────
  if (registered) {
    return (
      <div style={BG}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg,#c0392b 0%,#c0392b 25%,#e67e22 25%,#e67e22 50%,#27ae60 50%,#27ae60 75%,#2980b9 75%,#2980b9 100%)' }} />
        <Header />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
          <div style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>
            <Card>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px', color: C.green }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
              <Eyebrow>Account Created</Eyebrow>
              <h1 style={{ ...SERIF, fontSize: '26px', fontWeight: 700, color: C.white, marginBottom: '8px' }}>Welcome to NEU Library</h1>
              <p style={{ fontSize: '14px', color: C.body, marginBottom: '28px' }}>
                {registered.name} &mdash; <span style={{ ...MONO, color: C.gold, fontSize: '13px' }}>{registered.idNumber}</span>
              </p>
              <div style={{ background: '#ffffff', borderRadius: '14px', padding: '20px', display: 'inline-block', marginBottom: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
                <QRCodeSVG value={registered.idNumber} size={190} level="M" includeMargin={false} />
              </div>
              <p style={{ ...MONO, fontSize: '10px', letterSpacing: '0.14em', color: C.muted, marginBottom: '6px', textTransform: 'uppercase' }}>Your Library QR Code</p>
              <p style={{ fontSize: '13px', color: C.body, marginBottom: '22px', lineHeight: 1.7 }}>
                Screenshot or save this QR code. Show it to library staff to check in and out instantly.
              </p>
              <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '24px', textAlign: 'left' }}>
                <p style={{ ...MONO, fontSize: '10px', letterSpacing: '0.14em', color: C.gold, textTransform: 'uppercase', marginBottom: '8px' }}>How to use</p>
                <ul style={{ fontSize: '13px', color: C.body, paddingLeft: '18px', lineHeight: 1.9, margin: 0 }}>
                  <li>Show this QR code to the staff scanner when entering</li>
                  <li>Log in with your ID Number from any device</li>
                  <li>Your QR code is always available on your dashboard</li>
                </ul>
              </div>
              <button onClick={() => navigate('/login')} style={primaryBtn()}>Proceed to Sign In</button>
            </Card>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Registration form ─────────────────────────────────────────────────────
  return (
    <div style={BG}>
      <div style={{ height: '3px', background: 'linear-gradient(90deg,#c0392b 0%,#c0392b 25%,#e67e22 25%,#e67e22 50%,#27ae60 50%,#27ae60 75%,#2980b9 75%,#2980b9 100%)', flexShrink: 0 }} />
      <Header />

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{ width: '100%', maxWidth: '460px' }}>
          <Card>
            <div style={{ marginBottom: '28px' }}>
              <Eyebrow>New Account</Eyebrow>
              <h1 style={{ ...SERIF, fontSize: '28px', fontWeight: 700, color: C.white, lineHeight: 1.15, marginBottom: '8px' }}>Create Account</h1>
              <p style={{ fontSize: '14px', color: C.body }}>Enter your student information to register.</p>
            </div>

            {error && (
              <div style={{ marginBottom: '20px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '10px', padding: '12px 16px' }}>
                <p style={{ ...MONO, fontSize: '12px', color: C.red }}>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* Account type */}
              <div>
                <FieldLabel>Account Type</FieldLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                  {Object.entries(ROLES).map(([key, info]) => {
                    const active = role === key;
                    return (
                      <button key={key} type="button"
                        onClick={() => { setRole(key); setInviteCode(''); setError(''); }}
                        style={{
                          padding: '11px 8px', borderRadius: '9px', cursor: 'pointer', transition: 'all 0.15s',
                          background: active ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${active ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)'}`,
                        }}>
                        <p style={{ ...MONO, fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color: active ? C.gold : C.muted, textTransform: 'uppercase', margin: 0 }}>
                          {info.label}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', padding: '10px 13px' }}>
                  <p style={{ fontSize: '13px', color: C.body, margin: 0 }}>{ROLES[role].desc}</p>
                </div>
              </div>

              {/* Invite code */}
              {needsCode && (
                <div>
                  <FieldLabel required>Invite Code</FieldLabel>
                  <input style={inputBase({ ...MONO, letterSpacing: '0.14em' })}
                    placeholder={`NEU-${role.toUpperCase()}-XXXX`}
                    value={inviteCode} onChange={e => { setInviteCode(e.target.value); setError(''); }}
                    onFocus={onFocus} onBlur={onBlur} autoComplete="off" />
                  <Hint>Ask your library administrator for this code.</Hint>
                </div>
              )}

              {/* ID Number */}
              <div>
                <FieldLabel required>ID Number</FieldLabel>
                <input type="text" inputMode="numeric"
                  style={inputBase({ ...MONO, letterSpacing: '0.16em' })}
                  placeholder="22-12345-123" value={idFormat}
                  onChange={e => { const f = formatId(e.target.value); setIdFormat(f); setIdNumber(f); setError(''); }}
                  onFocus={onFocus} onBlur={onBlur} required />
                <Hint>Format: YY-NNNNN-NNN</Hint>
              </div>

              {/* Last + First name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <FieldLabel required>Last Name</FieldLabel>
                  <input style={inputBase()} placeholder="Santos" value={lastName}
                    onChange={e => { setLastName(e.target.value); setError(''); }}
                    onFocus={onFocus} onBlur={onBlur} required />
                </div>
                <div>
                  <FieldLabel required>First Name</FieldLabel>
                  <input style={inputBase()} placeholder="Juan" value={firstName}
                    onChange={e => { setFirstName(e.target.value); setError(''); }}
                    onFocus={onFocus} onBlur={onBlur} required />
                </div>
              </div>

              {/* Middle Initial */}
              <div>
                <FieldLabel>Middle Initial</FieldLabel>
                <input style={{ ...inputBase(), width: '72px', textTransform: 'uppercase', textAlign: 'center' }}
                  placeholder="D" maxLength={2} value={middleInitial}
                  onChange={e => setMiddleInitial(e.target.value.replace(/[^a-zA-Z]/g, ''))}
                  onFocus={onFocus} onBlur={onBlur} />
              </div>

              {/* College */}
              <div>
                <FieldLabel required>College</FieldLabel>
                <select style={{ ...inputBase(), appearance: 'none', cursor: 'pointer' }}
                  value={college} onChange={e => { setCollege(e.target.value); setCourse(''); setError(''); }}
                  onFocus={onFocus} onBlur={onBlur} required>
                  <option value="">— Select College —</option>
                  {COLLEGES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              {/* Course */}
              {college && courses.length > 0 && (
                <div>
                  <FieldLabel required>Course</FieldLabel>
                  <select style={{ ...inputBase(), appearance: 'none', cursor: 'pointer' }}
                    value={course} onChange={e => { setCourse(e.target.value); setError(''); }}
                    onFocus={onFocus} onBlur={onBlur} required>
                    <option value="">— Select Course —</option>
                    {courses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              {/* Password */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <FieldLabel required>Password</FieldLabel>
                  <input type="password" style={inputBase()} placeholder="Min. 8 chars"
                    value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                    onFocus={onFocus} onBlur={onBlur} required />
                </div>
                <div>
                  <FieldLabel required>Confirm</FieldLabel>
                  <input type="password" style={inputBase()} placeholder="Re-enter"
                    value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }}
                    onFocus={onFocus} onBlur={onBlur} required />
                </div>
              </div>

              <button type="submit" disabled={loading} style={primaryBtn(loading)}>
                {loading ? 'Creating Account…' : 'Create Account & Get QR Code'}
              </button>
            </form>

            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: C.body }}>
                Already have an account?{' '}
                <Link to="/login" style={{ color: C.gold, fontWeight: 600, textDecoration: 'none', ...MONO, fontSize: '13px' }}>Sign In</Link>
              </p>
            </div>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
}
