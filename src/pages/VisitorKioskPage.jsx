// src/pages/VisitorKioskPage.jsx
// Full-screen kiosk for visitors (students & faculty).
// No sidebar, no dashboard — purpose of visit + log in/out + edit request + QR code.
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLibrarySession } from '../context/LibrarySessionContext';
import { useTheme } from '../context/ThemeContext';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, setDoc, getDoc,
} from 'firebase/firestore';

// Generate a crypto-random UUID for QR tokens
function generateQRToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
import { db } from '../firebase/config';
import { COLLEGES } from '../data/colleges';

const MONO  = { fontFamily: "'IBM Plex Mono', monospace" };
const SERIF = { fontFamily: "'Playfair Display', serif" };
const PP    = { fontFamily: "'Poppins', sans-serif" };

const PURPOSES = [
  'Study / Review',
  'Research',
  'Borrow / Return Books',
  'Use Computer',
  'Group Study',
  'Other',
];

const EDITABLE_FIELDS = [
  { key: 'firstName',    label: 'First Name' },
  { key: 'lastName',     label: 'Last Name' },
  { key: 'middleInitial',label: 'Middle Initial' },
  { key: 'idNumber',     label: 'ID Number' },
  { key: 'visitorType',  label: 'Visitor Type (Student / Faculty)' },
  { key: 'college',      label: 'College' },
  { key: 'course',       label: 'Course' },
];

function formatHHMM(seconds) {
  if (!seconds || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function formatReadable(seconds) {
  if (!seconds || seconds < 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}hr`;
  return `${h}hr ${m}m`;
}

// ── QR Code Generator (canvas-based, no extra package needed) ────────────────
function QRCodeDisplay({ value, size = 160 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!value || !canvasRef.current) return;
    // Dynamically import qrcode to generate
    import('qrcode').then(QRCode => {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      }).catch(console.error);
    }).catch(() => {
      // Fallback: draw a placeholder if qrcode isn't installed
      const ctx = canvasRef.current.getContext('2d');
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('QR unavailable', size/2, size/2);
    });
  }, [value, size]);

  const handleSave = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'neu-library-qr.png';
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
      <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius:8, border:'1px solid var(--card-border)', display:'block' }}/>
      <button onClick={handleSave}
        style={{ padding:'6px 16px', borderRadius:8, background:'var(--gold-soft)', border:'1px solid var(--gold-border)', color:'var(--gold)', cursor:'pointer', fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase' }}>
        Save QR Image
      </button>
      <p style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'var(--text-dim)', textAlign:'center', maxWidth:160 }}>
        Save this QR and show it to staff for quick check-in
      </p>
    </div>
  );
}

// ── Welcome Toast ─────────────────────────────────────────────────────────────
function WelcomeToast({ name, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div onClick={onDismiss}
      style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:80, padding:'14px 28px', borderRadius:14, background:'var(--green-soft)', border:'1px solid var(--green-border)', boxShadow:'0 8px 32px rgba(0,0,0,0.25)', cursor:'pointer', animation:'slideUpToast 0.35s ease both', textAlign:'center', whiteSpace:'nowrap' }}>
      <p style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:'var(--text-primary)', marginBottom:2 }}>
        Welcome, {name}! 👋
      </p>
      <p style={{ fontFamily:"'Poppins',sans-serif", fontSize:13, color:'var(--green)' }}>
        You can now enter the library. Select your purpose below.
      </p>
    </div>
  );
}


function EditRequestModal({ profile, existingRequest, onClose }) {
  const MONO  = { fontFamily: "'IBM Plex Mono', monospace" };
  const SERIF = { fontFamily: "'Playfair Display', serif" };
  const PP    = { fontFamily: "'Poppins', sans-serif" };

  const inputSt = {
    width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)',
    borderRadius: 9, padding: '10px 13px', fontSize: 13, color: 'var(--text-primary)',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
  };
  const onFocus = e => { e.currentTarget.style.borderColor = 'var(--gold)'; };
  const onBlur  = e => { e.currentTarget.style.borderColor = 'var(--input-border)'; };

  // Build initial state from current profile
  const [fields, setFields] = useState({
    firstName:     profile?.firstName     || '',
    lastName:      profile?.lastName      || '',
    middleInitial: profile?.middleInitial || '',
    idNumber:      profile?.idNumber      || '',
    visitorType:   profile?.visitorType   || 'student',
    college:       profile?.college       || '',
    course:        profile?.course        || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState('');

  const selectedCollege = COLLEGES.find(c => c.name === fields.college);
  const courses         = selectedCollege?.courses || [];

  const handleSubmit = async () => {
    setError('');
    // Build changes object — only include fields that differ from current
    const changes = {};
    EDITABLE_FIELDS.forEach(({ key }) => {
      const current   = (profile?.[key] || '').toString().trim().toUpperCase();
      const requested = (fields[key] || '').toString().trim().toUpperCase();
      if (current !== requested) {
        changes[key] = { current: profile?.[key] || '', requested: fields[key] || '' };
      }
    });

    if (Object.keys(changes).length === 0) {
      setError('No changes detected. Please modify at least one field.');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'editRequests'), {
        uid:          profile.uid,
        userName:     `${profile.lastName}, ${profile.firstName}`,
        userIdNumber: profile.idNumber || '',
        changes,
        status:       'pending',
        requestedAt:  serverTimestamp(),
      });
      setDone(true);
    } catch (err) {
      setError('Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 400, background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-modal)', textAlign: 'center', padding: 36 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--green-soft)', border: '1px solid var(--green-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--green)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style={{ ...SERIF, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Request Submitted</h2>
          <p style={{ ...PP, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24 }}>
            Your information update request has been sent to the library admin. You will need to go to the library counter in person for verification.
          </p>
          <button onClick={onClose}
            style={{ padding: '12px 28px', borderRadius: 10, background: 'var(--green-soft)', border: '1px solid var(--green-border)', color: 'var(--green)', cursor: 'pointer', ...MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-modal)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--gold), transparent)' }} />
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--divider)', flexShrink: 0 }}>
          <p style={{ ...MONO, fontSize: 9, letterSpacing: '0.2em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 4 }}>Info Update</p>
          <h2 style={{ ...SERIF, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Request Information Edit</h2>
          <p style={{ ...PP, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Update the fields below and submit. An admin will review your request — you'll need to verify in person at the library counter.
          </p>
        </div>

        {/* Form */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {error && (
              <div style={{ background: 'var(--red-soft)', border: '1px solid var(--red-border)', borderRadius: 9, padding: '10px 13px' }}>
                <p style={{ ...MONO, fontSize: 11, color: 'var(--red)' }}>{error}</p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 600 }}>First Name</label>
                <input style={{ ...inputSt, textTransform: 'uppercase' }} value={fields.firstName}
                  onChange={e => setFields(f => ({ ...f, firstName: e.target.value }))}
                  onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 600 }}>Last Name</label>
                <input style={{ ...inputSt, textTransform: 'uppercase' }} value={fields.lastName}
                  onChange={e => setFields(f => ({ ...f, lastName: e.target.value }))}
                  onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 10 }}>
              <div>
                <label style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 600 }}>M.I.</label>
                <input style={{ ...inputSt, textTransform: 'uppercase', textAlign: 'center' }} value={fields.middleInitial}
                  maxLength={2}
                  onChange={e => setFields(f => ({ ...f, middleInitial: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') }))}
                  onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 600 }}>ID Number</label>
                <input style={{ ...inputSt, ...MONO, letterSpacing: '0.12em' }} value={fields.idNumber}
                  onChange={e => setFields(f => ({ ...f, idNumber: e.target.value }))}
                  onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>

            <div>
              <label style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6, fontWeight: 600 }}>Visitor Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ key: 'student', label: 'Student' }, { key: 'faculty', label: 'Faculty' }].map(({ key, label }) => (
                  <button key={key} type="button"
                    onClick={() => setFields(f => ({ ...f, visitorType: key }))}
                    style={{ flex: 1, padding: '9px 8px', borderRadius: 9, cursor: 'pointer', transition: 'all 0.15s', fontSize: 13, fontWeight: 600, fontFamily: "'Poppins', sans-serif",
                      background: fields.visitorType === key ? 'var(--blue-soft)' : 'var(--surface)',
                      border:     `1px solid ${fields.visitorType === key ? 'var(--blue-border)' : 'var(--card-border)'}`,
                      color:      fields.visitorType === key ? 'var(--blue)' : 'var(--text-muted)',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 600 }}>College</label>
              <select
                style={{ ...inputSt, appearance: 'none', cursor: 'pointer' }}
                value={fields.college}
                onChange={e => setFields(f => ({ ...f, college: e.target.value, course: '' }))}>
                <option value="">— Select College —</option>
                {COLLEGES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>

            {fields.college && courses.length > 0 && (
              <div>
                <label style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 5, fontWeight: 600 }}>Course</label>
                <select
                  style={{ ...inputSt, appearance: 'none', cursor: 'pointer' }}
                  value={fields.course}
                  onChange={e => setFields(f => ({ ...f, course: e.target.value }))}>
                  <option value="">— Select Course —</option>
                  {courses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            <div style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 9, padding: '10px 13px' }}>
              <p style={{ ...PP, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                ⚠ Changes require personal verification at the library counter before taking effect.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--divider)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', cursor: 'pointer', ...PP, fontSize: 13 }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            style={{ flex: 2, padding: '12px', borderRadius: 10, background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', color: 'var(--gold)', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, ...MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function VisitorKioskPage() {
  const { userProfile, logout } = useAuth();
  const { session, elapsed, checkIn, checkOut } = useLibrarySession();
  const { dark, toggle } = useTheme();

  const [purpose,       setPurpose]       = useState('');
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [showExit,      setShowExit]      = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showWelcome,   setShowWelcome]   = useState(false);
  const [showQR,        setShowQR]        = useState(false);

  // Auto-generate qrToken for visitors who registered before this feature existed
  useEffect(() => {
    if (!userProfile?.uid || userProfile?.qrToken) return;
    // Only assign QR tokens to visitors (not staff/admin — they use the kiosk differently)
    if (userProfile?.role !== 'visitor') return;
    const token = generateQRToken();
    setDoc(doc(db, 'users', userProfile.uid), { qrToken: token }, { merge: true })
      .catch(console.error);
  }, [userProfile?.uid, userProfile?.qrToken, userProfile?.role]);

  // Show welcome toast when the page first loads for a logged-in visitor (not after check-in)
  const hasShownWelcome = useRef(false);
  useEffect(() => {
    if (!hasShownWelcome.current && userProfile?.uid) {
      hasShownWelcome.current = true;
      setShowWelcome(true);
    }
  }, [userProfile?.uid]);

  // Live edit request status for this user
  const [editRequest, setEditRequest] = useState(null); // null = loading, false = none, obj = exists

  useEffect(() => {
    if (!userProfile?.uid) return;
    const q = query(
      collection(db, 'editRequests'),
      where('uid', '==', userProfile.uid)
    );
    const unsub = onSnapshot(q, snap => {
      if (snap.empty) { setEditRequest(false); return; }
      // Get most recent request
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.requestedAt?.toMillis?.() ?? 0) - (a.requestedAt?.toMillis?.() ?? 0));
      setEditRequest(docs[0]);
    }, () => setEditRequest(false));
    return unsub;
  }, [userProfile?.uid]);

  const hasPending  = editRequest && editRequest.status === 'pending';
  const hasApproved = editRequest && editRequest.status === 'approved';
  const hasRejected = editRequest && editRequest.status === 'rejected';

  const handleCancelRequest = async () => {
    if (!editRequest?.id) return;
    try {
      await updateDoc(doc(db, 'editRequests', editRequest.id), {
        status:      'cancelled',
        cancelledAt: serverTimestamp(),
      });
    } catch (_) {}
  };

  const displayName     = userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : '—';
  const visitorTypeLabel = userProfile?.visitorType === 'faculty' ? 'Faculty' : 'Student';
  const roleLabel       = userProfile?.role === 'admin' ? 'Administrator'
    : userProfile?.role === 'staff' ? 'Library Staff'
    : visitorTypeLabel;

  const handleCheckIn = async () => {
    if (!purpose) { setError('Please select your purpose of visit.'); return; }
    setError(''); setLoading(true);
    try { await checkIn(purpose); }
    catch { setError('Failed to check in. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    try { await checkOut(); setPurpose(''); }
    catch { setError('Failed to check out. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try { await logout(); }
    finally { setLoading(false); setShowExit(false); }
  };

  // Edit request button label/style
  const editBtnLabel = hasPending  ? 'Edit Requested — Pending'
    : hasApproved ? 'Edit Approved'
    : hasRejected ? 'Request Edit Again'
    : 'Request Info Update';

  const editBtnStyle = {
    ...MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600,
    padding: '6px 14px', borderRadius: 7, cursor: hasPending ? 'default' : 'pointer',
    background: hasPending ? 'var(--gold-soft)' : hasApproved ? 'var(--green-soft)' : 'var(--surface)',
    border: `1px solid ${hasPending ? 'var(--gold-border)' : hasApproved ? 'var(--green-border)' : 'var(--card-border)'}`,
    color: hasPending ? 'var(--gold)' : hasApproved ? 'var(--green)' : 'var(--text-muted)',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, var(--bg-base) 0%, var(--bg-mid) 60%, var(--bg-top) 100%)', display: 'flex', flexDirection: 'column' }}>
      {/* NEU stripe */}
      <div style={{ height: '3px', background: 'linear-gradient(90deg,#c0392b 0%,#c0392b 25%,#e67e22 25%,#e67e22 50%,#27ae60 50%,#27ae60 75%,#2980b9 75%,#2980b9 100%)', flexShrink: 0 }} />

      {/* Top bar */}
      <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--divider)', background: 'var(--card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img src="/liblogo.png" alt="NEU" style={{ width: 30, height: 30, objectFit: 'cover', borderRadius: '50%' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <div>
            <p style={{ ...MONO, fontSize: '7px', letterSpacing: '0.22em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 1 }}>New Era University</p>
            <p style={{ ...SERIF, fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>Library Visitor Log</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Visitor info chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 20, padding: '6px 14px' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: session ? 'var(--green)' : 'var(--text-dim)', flexShrink: 0 }} />
            <span style={{ ...PP, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{displayName}</span>
            <span style={{ ...MONO, fontSize: 10, color: 'var(--text-muted)' }}>·</span>
            <span style={{ ...MONO, fontSize: 10, color: 'var(--text-muted)' }}>{roleLabel}</span>
          </div>

          {/* Theme toggle */}
          <button onClick={toggle}
            style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--surface)', color: 'var(--gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {dark
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>

          {/* Sign out */}
          <button onClick={() => setShowExit(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'var(--red-soft)', border: '1px solid var(--red-border)', color: 'var(--red)', cursor: 'pointer', ...PP, fontSize: 13, fontWeight: 600 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(16px,4vw,40px) 16px' }}>
        <div style={{ width: '100%', maxWidth: 520, animation: 'fadeUp 0.35s ease both' }}>

          {/* Loading state */}
          {session === undefined && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 20, padding: '48px 32px', textAlign: 'center', boxShadow: 'var(--shadow-modal)' }}>
              <div style={{ width: 32, height: 32, border: '2px solid var(--gold-border)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ ...PP, fontSize: 14, color: 'var(--text-muted)' }}>Loading your session…</p>
            </div>
          )}

          {/* CHECKED IN — timer + check out */}
          {session && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 20, overflow: 'hidden', boxShadow: 'var(--shadow-modal)' }}>
              <div style={{ height: 3, background: 'linear-gradient(90deg, var(--green), transparent)' }} />
              <div style={{ padding: '36px 32px' }}>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--green)', margin: '0 auto 16px', boxShadow: '0 0 0 4px rgba(16,185,129,0.2)', animation: 'pulseDot 2s ease infinite' }} />
                  <p style={{ ...MONO, fontSize: '9px', letterSpacing: '0.22em', color: 'var(--green)', textTransform: 'uppercase', marginBottom: 6 }}>Currently Checked In</p>
                  <p style={{ ...PP, fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
                    Purpose: <strong style={{ color: 'var(--text-primary)' }}>{session.purpose}</strong>
                  </p>
                  <p style={{ ...MONO, fontSize: 'clamp(36px,10vw,54px)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {formatHHMM(elapsed)}
                  </p>
                  <p style={{ ...PP, fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                    {formatReadable(elapsed)} in library
                  </p>
                  {session.entryTime?.toDate && (
                    <p style={{ ...MONO, fontSize: '11px', color: 'var(--text-dim)', marginTop: 6 }}>
                      Entry: {session.entryTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>

                <button onClick={handleCheckOut} disabled={loading}
                  style={{ width: '100%', padding: '15px', borderRadius: 12, background: 'var(--red-soft)', border: '1px solid var(--red-border)', color: 'var(--red)', cursor: loading ? 'not-allowed' : 'pointer', ...MONO, fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, opacity: loading ? 0.6 : 1, transition: 'all 0.15s' }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--red-border)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--red-soft)'; }}>
                  {loading ? 'Logging out…' : 'Log Out of Library'}
                </button>
              </div>
            </div>
          )}

          {/* NOT CHECKED IN — purpose select + check in */}
          {session === null && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 20, overflow: 'hidden', boxShadow: 'var(--shadow-modal)' }}>
              <div style={{ height: 3, background: 'linear-gradient(90deg, var(--gold), transparent)' }} />
              <div style={{ padding: '36px 32px' }}>

                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--gold-soft)', border: '2px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', overflow: 'hidden' }}>
                    <img src="/liblogo.png" alt="NEU" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: '50%' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                  </div>
                  <p style={{ ...MONO, fontSize: '9px', letterSpacing: '0.22em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 6 }}>Welcome to</p>
                  <h1 style={{ ...SERIF, fontSize: 'clamp(22px,5vw,28px)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>NEU Library</h1>
                  <p style={{ ...PP, fontSize: 14, color: 'var(--text-muted)' }}>
                    Hello, <strong style={{ color: 'var(--text-primary)' }}>{userProfile?.firstName}</strong>! Select your purpose to log your visit.
                  </p>
                </div>

                {error && (
                  <div style={{ marginBottom: 16, background: 'var(--red-soft)', border: '1px solid var(--red-border)', borderRadius: 10, padding: '10px 14px' }}>
                    <p style={{ ...MONO, fontSize: '12px', color: 'var(--red)' }}>{error}</p>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                  {PURPOSES.map(p => (
                    <button key={p} type="button" onClick={() => { setPurpose(p); setError(''); }}
                      style={{ padding: '14px 12px', borderRadius: 12, textAlign: 'center', cursor: 'pointer', border: `2px solid ${purpose === p ? 'var(--gold)' : 'var(--card-border)'}`, background: purpose === p ? 'var(--gold-soft)' : 'var(--surface)', color: purpose === p ? 'var(--gold)' : 'var(--text-muted)', ...PP, fontSize: 13, fontWeight: purpose === p ? 600 : 500, transition: 'all 0.15s' }}>
                      {p}
                    </button>
                  ))}
                </div>

                <button onClick={handleCheckIn} disabled={loading || !purpose}
                  style={{ width: '100%', padding: '15px', borderRadius: 12, background: (purpose && !loading) ? 'var(--green-soft)' : 'var(--surface)', border: `1px solid ${(purpose && !loading) ? 'var(--green-border)' : 'var(--card-border)'}`, color: (purpose && !loading) ? 'var(--green)' : 'var(--text-dim)', cursor: (purpose && !loading) ? 'pointer' : 'not-allowed', ...MONO, fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, opacity: (purpose && !loading) ? 1 : 0.5, transition: 'all 0.15s' }}
                  onMouseEnter={e => { if (purpose && !loading) e.currentTarget.style.background = 'rgba(16,185,129,0.25)'; }}
                  onMouseLeave={e => { if (purpose && !loading) e.currentTarget.style.background = 'var(--green-soft)'; }}>
                  {loading ? 'Logging in…' : 'Log In to Library'}
                </button>
              </div>
            </div>
          )}

          {/* ── Bottom row: QR card + Edit Request card side by side ── */}
          {session !== undefined && userProfile?.role === 'visitor' && (
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: userProfile?.qrToken && session === null ? '1fr 1fr' : '1fr', gap: 12 }}>

              {/* QR Card — only when not checked in and token exists */}
              {session === null && userProfile?.qrToken && (
                <div style={{ background: 'var(--card)', border: `1px solid ${showQR ? 'var(--gold-border)' : 'var(--card-border)'}`, borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-card)', transition: 'border-color 0.15s' }}>
                  <div style={{ height: 2, background: 'linear-gradient(90deg, var(--gold), transparent)' }} />
                  <div style={{ padding: '14px 16px' }}>
                    <button onClick={() => setShowQR(v => !v)}
                      style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      {/* QR icon */}
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: showQR ? 'var(--gold-soft)' : 'var(--surface)', border: `1px solid ${showQR ? 'var(--gold-border)' : 'var(--card-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={showQR ? 'var(--gold)' : 'var(--text-muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                          <path d="M14 14h3v3m0 4h4m-4 0v-4m4 0v4"/>
                        </svg>
                      </div>
                      <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: showQR ? 'var(--gold)' : 'var(--text-muted)', fontWeight: 700 }}>
                        {showQR ? 'Hide QR' : 'My QR Code'}
                      </span>
                    </button>

                    {showQR && (
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, animation: 'fadeUp 0.2s ease both' }}>
                        <QRCodeDisplay value={userProfile.qrToken} size={140} />
                        <p style={{ ...MONO, fontSize: 9, color: 'var(--text-dim)', textAlign: 'center' }}>
                          Show to staff at counter
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Edit Request Card */}
              <div style={{ background: 'var(--card)', border: `1px solid ${hasPending ? 'var(--gold-border)' : 'var(--card-border)'}`, borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-card)', transition: 'border-color 0.15s' }}>
                <div style={{ height: 2, background: hasPending ? 'linear-gradient(90deg, var(--gold), transparent)' : 'linear-gradient(90deg, var(--card-border), transparent)' }} />
                <div style={{ padding: '14px 16px' }}>
                  {hasPending ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 16 }}>⏳</span>
                      </div>
                      <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 700, textAlign: 'center' }}>Edit Pending</span>
                      <button onClick={handleCancelRequest}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 8, cursor: 'pointer', background: 'var(--red-soft)', border: '1px solid var(--red-border)', color: 'var(--red)', ...MONO, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
                        Cancel
                      </button>
                      {hasRejected && editRequest?.rejectionReason && (
                        <p style={{ ...MONO, fontSize: 9, color: 'var(--red)', textAlign: 'center' }}>
                          ✕ {editRequest.rejectionReason}
                        </p>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => setShowEditModal(true)}
                      style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      onMouseEnter={e => { e.currentTarget.querySelector('div').style.background = 'var(--gold-soft)'; e.currentTarget.querySelector('div').style.borderColor = 'var(--gold-border)'; }}
                      onMouseLeave={e => { e.currentTarget.querySelector('div').style.background = 'var(--surface)'; e.currentTarget.querySelector('div').style.borderColor = 'var(--card-border)'; }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </div>
                      <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center' }}>Request Info Update</span>
                    </button>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Sign out confirmation modal */}
      {showExit && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 400, background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-modal)' }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg,#c0392b 0%,#c0392b 25%,#f39c12 25%,#f39c12 50%,#27ae60 50%,#27ae60 75%,#2980b9 75%,#2980b9 100%)' }} />
            <div style={{ padding: 28 }}>
              <h2 style={{ ...SERIF, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                {session ? 'Still Checked In' : 'Sign Out?'}
              </h2>
              <p style={{ ...PP, fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
                {session ? 'You are still checked in to the library. Signing out will keep your visit logged.' : 'Are you sure you want to sign out?'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={handleSignOut} disabled={loading}
                  style={{ padding: 13, borderRadius: 10, background: 'var(--red-soft)', border: '1px solid var(--red-border)', color: 'var(--red)', cursor: 'pointer', ...PP, fontSize: 14, fontWeight: 600 }}>
                  {loading ? 'Signing out…' : 'Sign Out'}
                </button>
                <button onClick={() => setShowExit(false)}
                  style={{ padding: 13, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', cursor: 'pointer', ...PP, fontSize: 14 }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Request Modal */}
      {showEditModal && (
        <EditRequestModal
          profile={userProfile}
          existingRequest={editRequest}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {/* Welcome toast — shown once when page first loads */}
      {showWelcome && (
        <WelcomeToast
          name={userProfile?.firstName || 'there'}
          onDismiss={() => setShowWelcome(false)}
        />
      )}

      <style>{`
        @keyframes fadeUp      { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin        { to{transform:rotate(360deg)} }
        @keyframes pulseDot    { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes slideUpToast{ from{opacity:0;transform:translateX(-50%) translateY(20px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
      `}</style>
    </div>
  );
}
