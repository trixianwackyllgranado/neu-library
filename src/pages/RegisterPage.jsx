// src/pages/RegisterPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, parseNameFromEmail } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { COLLEGES } from '../data/colleges';

const MONO  = { fontFamily: "'IBM Plex Mono', monospace" };
const SERIF = { fontFamily: "'Playfair Display', serif" };
const PP    = { fontFamily: "'Poppins', sans-serif" };

const ID_REGEX = /^\d{2}-\d{5}-\d{3}$/;
const INVITE_CODES = { staff: 'NEU-STAFF-2123', admin: 'NEU-ADMIN-2067' };

function formatId(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `${d.slice(0,2)}-${d.slice(2)}`;
  return `${d.slice(0,2)}-${d.slice(2,7)}-${d.slice(7)}`;
}

export default function RegisterPage() {
  const { pendingGoogleUser, register, logout } = useAuth();
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();

  // If no pending Google user, they shouldn't be here — send to login
  useEffect(() => {
    if (!pendingGoogleUser) navigate('/login', { replace: true });
  }, [pendingGoogleUser]);

  // Auto-parse name from Google email
  const email = pendingGoogleUser?.email || '';
  const parsed = parseNameFromEmail(email);

  const [firstName,     setFirstName]     = useState(parsed.firstName);
  const [lastName,      setLastName]      = useState(parsed.lastName);
  const [middleInitial, setMiddleInitial] = useState('');
  const [idNumber,      setIdNumber]      = useState('');
  const [idFormat,      setIdFormat]      = useState('');
  const [role,          setRole]          = useState('visitor');
  const [visitorType,   setVisitorType]   = useState('student');
  const [college,       setCollege]       = useState('');
  const [course,        setCourse]        = useState('');
  const [inviteCode,    setInviteCode]    = useState('');
  const [codeVerified,  setCodeVerified]  = useState(false);
  const [codeError,     setCodError]      = useState('');
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [done,          setDone]          = useState(false);

  if (!pendingGoogleUser) return null;

  const needsCode = role === 'staff' || role === 'admin';
  const selectedCollege = COLLEGES.find(c => c.name === college);
  const courses = selectedCollege?.courses || [];

  const inputSt = {
    width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)',
    borderRadius: 10, padding: '11px 14px', fontSize: 14, color: 'var(--text-primary)',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
  };
  const onFocus = e => { e.currentTarget.style.borderColor = 'var(--gold)'; };
  const onBlur  = e => { e.currentTarget.style.borderColor = 'var(--input-border)'; };

  const handleVerifyCode = () => {
    setCodError('');
    if (!inviteCode.trim()) { setCodError('Enter the invitation code.'); return; }
    if (inviteCode.trim() !== INVITE_CODES[role]) { setCodError('Invalid invitation code.'); return; }
    setCodeVerified(true);
  };

  const handleRoleChange = (r) => {
    setRole(r);
    setCodeVerified(false);
    setInviteCode('');
    setCodError('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim()) { setError('First and last name are required.'); return; }
    if (!ID_REGEX.test(idNumber)) { setError('ID Number must be in format YY-NNNNN-NNN.'); return; }
    if (needsCode && !codeVerified) { setError('Please verify your invitation code.'); return; }
    setLoading(true);
    try {
      await register({
        uid:           pendingGoogleUser.uid,
        email,
        firstName,
        lastName,
        middleInitial,
        idNumber,
        role,
        visitorType:   role === 'visitor' ? visitorType : null,
        college:       college.trim() || null,
        course:        course.trim() || null,
      });
      setDone(true);
      setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-soft)', border: '1px solid var(--green-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--green)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style={{ ...SERIF, fontSize: 24, color: 'var(--text-primary)', marginBottom: 8 }}>Welcome to NEU Library!</h2>
          <p style={{ ...PP, fontSize: 14, color: 'var(--text-muted)' }}>Account created. Redirecting…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, var(--bg-base) 0%, var(--bg-mid) 55%, var(--bg-top) 100%)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg,#c0392b 0%,#c0392b 25%,#e67e22 25%,#e67e22 50%,#27ae60 50%,#27ae60 75%,#2980b9 75%,#2980b9 100%)' }} />

      {/* Header */}
      <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src="/liblogo.png" alt="NEU" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: '50%' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
          <div>
            <p style={{ ...MONO, fontSize: 8, letterSpacing: '0.24em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 2 }}>New Era University</p>
            <p style={{ ...SERIF, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>Library Management System</p>
          </div>
        </div>
        <button onClick={toggle} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--surface)', color: 'var(--gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {dark ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{ width: '100%', maxWidth: 480, animation: 'fadeUp 0.35s ease both' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 20, overflow: 'hidden', boxShadow: 'var(--shadow-modal)' }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg, var(--gold), transparent)' }} />
            <div style={{ padding: '32px 32px 36px' }}>

              <div style={{ marginBottom: 24 }}>
                <p style={{ ...MONO, fontSize: 9, letterSpacing: '0.24em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 6 }}>New Account</p>
                <h1 style={{ ...SERIF, fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Create Account</h1>
                <p style={{ ...PP, fontSize: 13, color: 'var(--text-muted)' }}>Signing up as <strong style={{ color: 'var(--gold)' }}>{email}</strong></p>
              </div>

              {error && (
                <div style={{ background: 'var(--red-soft)', border: '1px solid var(--red-border)', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                  <p style={{ ...MONO, fontSize: 11, color: 'var(--red)' }}>{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Role selector */}
                <div>
                  <label style={{ ...MONO, fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 8, fontWeight: 600 }}>Account Type</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { key: 'visitor', label: 'Visitor' },
                      { key: 'staff',   label: 'Library Staff' },
                      { key: 'admin',   label: 'Administrator' },
                    ].map(({ key, label }) => (
                      <button key={key} type="button" onClick={() => handleRoleChange(key)}
                        style={{ flex: 1, padding: '9px 8px', borderRadius: 9, cursor: 'pointer', transition: 'all 0.15s', fontSize: 12, fontWeight: 600, fontFamily: "'Poppins', sans-serif",
                          background: role === key ? 'var(--gold-soft)' : 'var(--surface)',
                          border: `1px solid ${role === key ? 'var(--gold-border)' : 'var(--card-border)'}`,
                          color: role === key ? 'var(--gold)' : 'var(--text-muted)',
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visitor type — only when role === visitor */}
                {role === 'visitor' && (
                  <div>
                    <label style={{ ...MONO, fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 8, fontWeight: 600 }}>Visitor Type</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[
                        { key: 'student', label: 'Student' },
                        { key: 'faculty', label: 'Faculty' },
                      ].map(({ key, label }) => (
                        <button key={key} type="button" onClick={() => setVisitorType(key)}
                          style={{ flex: 1, padding: '9px 8px', borderRadius: 9, cursor: 'pointer', transition: 'all 0.15s', fontSize: 13, fontWeight: 600, fontFamily: "'Poppins', sans-serif",
                            background: visitorType === key ? 'var(--blue-soft)' : 'var(--surface)',
                            border: `1px solid ${visitorType === key ? 'var(--blue-border)' : 'var(--card-border)'}`,
                            color: visitorType === key ? 'var(--blue)' : 'var(--text-muted)',
                          }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Invite code gate for staff/admin */}
                {needsCode && !codeVerified && (
                  <div style={{ background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ ...MONO, fontSize: 10, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Invitation Code Required</p>
                    {codeError && <p style={{ ...MONO, fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>{codeError}</p>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input style={{ ...inputSt, flex: 1, ...MONO, letterSpacing: '0.12em' }}
                        placeholder={`NEU-${role.toUpperCase()}-XXXX`}
                        value={inviteCode} onChange={e => { setInviteCode(e.target.value); setCodError(''); }}
                        onFocus={onFocus} onBlur={onBlur} />
                      <button type="button" onClick={handleVerifyCode}
                        style={{ padding: '11px 16px', borderRadius: 9, background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', color: 'var(--gold)', cursor: 'pointer', ...MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        Verify
                      </button>
                    </div>
                  </div>
                )}
                {needsCode && codeVerified && (
                  <div style={{ background: 'var(--green-soft)', border: '1px solid var(--green-border)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <p style={{ ...MONO, fontSize: 11, color: 'var(--green)' }}>Invitation code verified</p>
                  </div>
                )}

                {/* Show rest of form when: visitor, OR staff/admin with verified code */}
                {(!needsCode || codeVerified) && (
                  <>
                    {/* Names */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6, fontWeight: 600 }}>First Name <span style={{ color: 'var(--red)' }}>*</span></label>
                        <input style={{ ...inputSt, textTransform: 'uppercase' }} value={firstName}
                          onChange={e => setFirstName(e.target.value)} onFocus={onFocus} onBlur={onBlur} required />
                      </div>
                      <div>
                        <label style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6, fontWeight: 600 }}>Last Name <span style={{ color: 'var(--red)' }}>*</span></label>
                        <input style={{ ...inputSt, textTransform: 'uppercase' }} value={lastName}
                          onChange={e => setLastName(e.target.value)} onFocus={onFocus} onBlur={onBlur} required />
                      </div>
                    </div>
                    <p style={{ ...PP, fontSize: 11, color: 'var(--text-dim)', marginTop: -8 }}>
                      Auto-filled from your email. Edit if needed.
                    </p>

                    {/* Middle Initial */}
                    <div>
                      <label style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6, fontWeight: 600 }}>Middle Initial</label>
                      <input style={{ ...inputSt, width: 72, textTransform: 'uppercase', textAlign: 'center' }}
                        placeholder="D" maxLength={2} value={middleInitial}
                        onChange={e => setMiddleInitial(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                        onFocus={onFocus} onBlur={onBlur} />
                    </div>

                    {/* ID Number */}
                    <div>
                      <label style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6, fontWeight: 600 }}>ID Number <span style={{ color: 'var(--red)' }}>*</span></label>
                      <input type="text" inputMode="numeric"
                        style={{ ...inputSt, ...MONO, letterSpacing: '0.16em' }}
                        placeholder="22-12345-123" value={idFormat}
                        onChange={e => { const f = formatId(e.target.value); setIdFormat(f); setIdNumber(f); setError(''); }}
                        onFocus={onFocus} onBlur={onBlur} required />
                      <p style={{ ...MONO, fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>Format: YY-NNNNN-NNN</p>
                    </div>

                    {/* College — visitors only */}
                    {role === 'visitor' && (
                      <div>
                        <label style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6, fontWeight: 600 }}>College</label>
                        <select
                          style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 10, padding: '11px 14px', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', appearance: 'none', cursor: 'pointer' }}
                          value={college}
                          onChange={e => { setCollege(e.target.value); setCourse(''); setError(''); }}>
                          <option value="">— Select College —</option>
                          {COLLEGES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                    )}

                    {/* Course — only when college is selected and has courses */}
                    {role === 'visitor' && college && courses.length > 0 && (
                      <div>
                        <label style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6, fontWeight: 600 }}>Course</label>
                        <select
                          style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 10, padding: '11px 14px', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', appearance: 'none', cursor: 'pointer' }}
                          value={course}
                          onChange={e => { setCourse(e.target.value); setError(''); }}>
                          <option value="">— Select Course —</option>
                          {courses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    )}
                  </>
                )}

                <button type="submit" disabled={loading || (needsCode && !codeVerified)}
                  style={{ width: '100%', padding: 13, borderRadius: 10, background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', color: 'var(--gold)', cursor: (loading || (needsCode && !codeVerified)) ? 'not-allowed' : 'pointer', opacity: (loading || (needsCode && !codeVerified)) ? 0.5 : 1, ...MONO, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, transition: 'all 0.15s' }}>
                  {loading ? 'Creating Account…' : 'Create Account'}
                </button>

                <button type="button" onClick={handleCancel}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-dim)', cursor: 'pointer', ...PP, fontSize: 13 }}>
                  Cancel — Sign in with a different account
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  );
}
