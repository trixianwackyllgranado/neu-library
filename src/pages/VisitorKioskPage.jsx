// src/pages/VisitorKioskPage.jsx
// Full-screen kiosk for visitors (students & faculty).
// No sidebar, no dashboard — purpose of visit + log in/out + edit request + QR code.
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLibrarySession } from '../context/LibrarySessionContext';
import { useTheme } from '../context/ThemeContext';
import FloatingTutorial from '../components/shared/FloatingTutorial';
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
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 400); }, 4500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
      style={{
        position: 'fixed', bottom: 20, left: '50%', zIndex: 80,
        transform: 'translateX(-50%)',
        width: 'min(360px, calc(100vw - 32px))',
        padding: '18px 22px',
        borderRadius: 16,
        background: 'var(--card)',
        border: '1px solid var(--green-border)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(16,185,129,0.08)',
        cursor: 'pointer',
        animation: visible ? 'welcomeIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both' : 'welcomeOut 0.3s ease forwards',
        display: 'flex', alignItems: 'center', gap: 14,
      }}
    >
      {/* Animated check icon */}
      <div style={{
        width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
        background: 'var(--green-soft)', border: '1.5px solid var(--green-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M7 12.5l3.5 3.5L17 9" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="20" strokeDashoffset="20">
            <animate attributeName="stroke-dashoffset" from="20" to="0" dur="0.4s" begin="0.2s" fill="freeze" />
          </path>
        </svg>
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 2 }}>
          Welcome, {name}!
        </p>
        <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 12, color: 'var(--green)', lineHeight: 1.4 }}>
          Select your purpose below to check in.
        </p>
      </div>
    </div>
  );
}

// ── Check-In Success Toast ───────────────────────────────────────────────────
function CheckInSuccessToast({ purpose, onDismiss }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 400); }, 4000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
      style={{
        position: 'fixed', top: '50%', left: '50%', zIndex: 90,
        transform: 'translate(-50%, -50%)',
        width: 'min(340px, calc(100vw - 40px))',
        padding: '32px 28px',
        borderRadius: 20,
        background: 'var(--card)',
        border: '1px solid var(--green-border)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(45,212,168,0.1)',
        cursor: 'pointer',
        textAlign: 'center',
        animation: visible ? 'checkInPopIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both' : 'checkInPopOut 0.3s ease forwards',
      }}
    >
      {/* Animated checkmark circle */}
      <div style={{
        width: 64, height: 64, borderRadius: '50%', margin: '0 auto 18px',
        background: 'var(--green-soft)', border: '2px solid var(--green-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="var(--green)" strokeWidth="1.5" strokeDasharray="63" strokeDashoffset="63" opacity="0.4">
            <animate attributeName="stroke-dashoffset" from="63" to="0" dur="0.5s" fill="freeze" />
          </circle>
          <path d="M7 12.5l3.5 3.5L17 9" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="20" strokeDashoffset="20">
            <animate attributeName="stroke-dashoffset" from="20" to="0" dur="0.35s" begin="0.3s" fill="freeze" />
          </path>
        </svg>
      </div>
      <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: '0.2em', color: 'var(--green)', textTransform: 'uppercase', marginBottom: 8 }}>
        Checked In Successfully
      </p>
      <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.25, marginBottom: 8 }}>
        You're in the library!
      </p>
      <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Purpose: <strong style={{ color: 'var(--green)' }}>{purpose}</strong>
      </p>
      <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 11, color: 'var(--text-dim)', marginTop: 12 }}>
        Your session timer has started. Tap to dismiss.
      </p>
    </div>
  );
}


// ── Check-Out Success Toast ───────────────────────────────────────────────────
function CheckOutSuccessToast({ onDismiss }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 400); }, 3500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
      style={{
        position: 'fixed', top: '50%', left: '50%', zIndex: 90,
        transform: 'translate(-50%, -50%)',
        width: 'min(340px, calc(100vw - 40px))',
        padding: '32px 28px',
        borderRadius: 20,
        background: 'var(--card)',
        border: '1px solid var(--blue-border)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(96,165,250,0.1)',
        cursor: 'pointer',
        textAlign: 'center',
        animation: visible ? 'checkInPopIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both' : 'checkInPopOut 0.3s ease forwards',
      }}
    >
      {/* Animated exit icon */}
      <div style={{
        width: 64, height: 64, borderRadius: '50%', margin: '0 auto 18px',
        background: 'var(--blue-soft)', border: '2px solid var(--blue-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="var(--blue)" strokeWidth="1.5" strokeDasharray="63" strokeDashoffset="63" opacity="0.4">
            <animate attributeName="stroke-dashoffset" from="63" to="0" dur="0.5s" fill="freeze" />
          </circle>
          <path d="M15 9l3 3-3 3M9 12h9" stroke="var(--blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="24" strokeDashoffset="24">
            <animate attributeName="stroke-dashoffset" from="24" to="0" dur="0.35s" begin="0.3s" fill="freeze" />
          </path>
        </svg>
      </div>
      <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, letterSpacing: '0.2em', color: 'var(--blue)', textTransform: 'uppercase', marginBottom: 8 }}>
        Checked Out Successfully
      </p>
      <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.25, marginBottom: 8 }}>
        See you next time!
      </p>
      <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Your visit has been logged. Thank you for visiting the library.
      </p>
      <p style={{ fontFamily: "'Poppins',sans-serif", fontSize: 11, color: 'var(--text-dim)', marginTop: 12 }}>
        Tap to dismiss.
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
  const { userProfile, logout, canSwitchRole, effectiveRole, switchRole, refreshProfile } = useAuth();
  const { session, elapsed, checkIn, checkOut } = useLibrarySession();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();

  // Admin previewing as visitor — read-only mode, no actual check-ins
  const isAdminPreview = canSwitchRole && effectiveRole === 'visitor' && userProfile?.role === 'admin';

  const [purpose,       setPurpose]       = useState('');
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [showExit,      setShowExit]      = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showWelcome,   setShowWelcome]   = useState(false);
  const [showQR,        setShowQR]        = useState(false);
  const [showCheckInSuccess, setShowCheckInSuccess] = useState(false);
  const [showCheckOutSuccess, setShowCheckOutSuccess] = useState(false);
  const [checkedInPurpose, setCheckedInPurpose] = useState('');

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Auto-generate qrToken for visitors who registered before this feature existed
  useEffect(() => {
    if (!userProfile?.uid || userProfile?.qrToken) return;
    // Only assign QR tokens to visitors (not staff/admin — they use the kiosk differently)
    if (userProfile?.role !== 'visitor') return;
    const token = generateQRToken();
    setDoc(doc(db, 'users', userProfile.uid), { qrToken: token }, { merge: true })
      .then(() => refreshProfile?.())
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
    if (isAdminPreview) return;
    if (!purpose) { setError('Please select your purpose of visit.'); return; }
    setError(''); setLoading(true);
    try {
      await checkIn(purpose);
      setCheckedInPurpose(purpose);
      setShowCheckInSuccess(true);
    }
    catch { setError('Failed to check in. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    try {
      await checkOut();
      setPurpose('');
      setShowCheckOutSuccess(true);
    }
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

  // QR lightbox state
  const [showQRLightbox, setShowQRLightbox] = useState(false);

  // Block admins and staff from opening the visitor kiosk on mobile
  // They should only access it on a proper desktop/tablet kiosk station
  const isAdminOrStaff = userProfile?.role === 'admin' || userProfile?.role === 'staff';
  if (isAdminOrStaff && isMobile && !isAdminPreview) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg,#c0392b 0%,#c0392b 25%,#e67e22 25%,#e67e22 50%,#27ae60 50%,#27ae60 75%,#2980b9 75%,#2980b9 100%)', position: 'absolute', top: 0, left: 0, right: 0 }} />
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--red-soft)', border: '1px solid var(--red-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, color: 'var(--red)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
        </div>
        <p style={{ ...MONO, fontSize: '9px', letterSpacing: '0.2em', color: 'var(--red)', textTransform: 'uppercase', marginBottom: 8 }}>Mobile Access Restricted</p>
        <h2 style={{ ...SERIF, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Desktop Only</h2>
        <p style={{ ...PP, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 300, marginBottom: 28 }}>
          The Visitor Kiosk is designed for use on a library counter station. Please open it on a desktop or tablet computer.
        </p>
        <button onClick={() => navigate('/dashboard')}
          style={{ padding: '12px 28px', borderRadius: 10, background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', color: 'var(--gold)', cursor: 'pointer', ...MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* NEU stripe */}
      <div style={{ height: '3px', background: 'linear-gradient(90deg,#c0392b 0%,#c0392b 25%,#e67e22 25%,#e67e22 50%,#27ae60 50%,#27ae60 75%,#2980b9 75%,#2980b9 100%)', flexShrink: 0 }} />

      {/* Top bar */}
      <div style={{ padding: isMobile ? '8px 10px' : '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--divider)', background: 'var(--card)', flexShrink: 0, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            <img src="/liblogo.png" alt="NEU" style={{ width: 26, height: 26, objectFit: 'cover', borderRadius: '50%' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
          </div>
          {!isMobile && (
            <div>
              <p style={{ ...MONO, fontSize: '7px', letterSpacing: '0.22em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 1 }}>New Era University</p>
              <p style={{ ...SERIF, fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>Library Visitor Log</p>
            </div>
          )}
          {isMobile && (
            <p style={{ ...SERIF, fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>NEU Library</p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 6, flexShrink: 0 }}>
          {/* Status + name chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 20, padding: isMobile ? '5px 8px' : '5px 12px', minWidth: 0, maxWidth: isMobile ? 130 : 'none', overflow: 'hidden' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: session ? 'var(--green)' : 'var(--text-dim)', flexShrink: 0, animation: session ? 'pulseDot 2s ease infinite' : 'none' }} />
            <span style={{ ...PP, fontSize: isMobile ? 11 : 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userProfile?.firstName || displayName}</span>
            {!isMobile && <span style={{ ...MONO, fontSize: 9, color: 'var(--text-dim)' }}>·</span>}
            {!isMobile && <span style={{ ...MONO, fontSize: 9, color: isAdminPreview ? '#60a5fa' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{isAdminPreview ? 'Admin Preview' : roleLabel}</span>}
          </div>
          {/* Theme */}
          <button onClick={toggle} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--surface)', color: 'var(--gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {dark
              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
          {/* Sign out */}
          <button onClick={() => setShowExit(true)} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0 : 5, padding: isMobile ? '7px 10px' : '7px 12px', borderRadius: 8, background: 'var(--red-soft)', border: '1px solid var(--red-border)', color: 'var(--red)', cursor: 'pointer', ...PP, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            {!isMobile && 'Sign Out'}
          </button>
        </div>
      </div>

      {/* Main content — fills remaining height, no scroll */}
      <div style={{ flex: 1, display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'center', padding: isMobile ? '12px 10px' : '16px', overflow: isMobile ? 'auto' : 'hidden', position: 'relative' }}>

        {/* ── Admin Preview Banner + Back to Admin ── */}
        {isAdminPreview && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
            background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.08) 100%)',
            borderBottom: '1px solid rgba(59,130,246,0.3)',
            padding: isMobile ? '8px 12px' : '10px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 8,
            animation: 'fadeUp 0.25s ease both',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span style={{ ...PP, fontSize: isMobile ? 11 : 12, fontWeight: 600, color: '#60a5fa', whiteSpace: 'nowrap' }}>
                Admin Preview
              </span>
              {!isMobile && (
                <span style={{ ...PP, fontSize: 11, color: 'rgba(96,165,250,0.7)' }}>
                  — Visitor view only. Check-in disabled.
                </span>
              )}
            </div>
            <button
              onClick={() => { switchRole('admin'); navigate('/dashboard'); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: isMobile ? '6px 10px' : '7px 16px', borderRadius: 8, flexShrink: 0,
                background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)',
                color: '#60a5fa', cursor: 'pointer',
                ...MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
              {isMobile ? 'Exit' : 'Back to Admin'}
            </button>
          </div>
        )}
        <div style={{ width: '100%', maxWidth: 860, display: 'grid', gridTemplateColumns: (!isMobile && session !== undefined && userProfile?.role === 'visitor' && session === null && userProfile?.qrToken) ? 'minmax(0,1.4fr) minmax(0,1fr)' : '1fr', gap: 12, alignItems: 'start', animation: 'fadeUp 0.3s ease both' }}>

          {/* ── LEFT COLUMN: main check-in card ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Loading */}
          {session === undefined && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '32px', textAlign: 'center' }}>
              <div style={{ width: 28, height: 28, border: '2px solid var(--gold-border)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ ...PP, fontSize: 13, color: 'var(--text-muted)' }}>Loading your session…</p>
            </div>
          )}

          {/* CHECKED IN */}
          {session && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ height: 3, background: 'linear-gradient(90deg, var(--green), transparent)' }} />
              <div style={{ padding: '24px 24px 20px' }}>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green)', margin: '0 auto 12px', boxShadow: '0 0 0 4px rgba(16,185,129,0.2)', animation: 'pulseDot 2s ease infinite' }} />
                  <p style={{ ...MONO, fontSize: '9px', letterSpacing: '0.22em', color: 'var(--green)', textTransform: 'uppercase', marginBottom: 4 }}>Currently Checked In</p>
                  <p style={{ ...PP, fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                    Purpose: <strong style={{ color: 'var(--text-primary)' }}>{session.purpose}</strong>
                  </p>
                  <p style={{ ...MONO, fontSize: 'clamp(32px,9vw,48px)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {formatHHMM(elapsed)}
                  </p>
                  <p style={{ ...PP, fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{formatReadable(elapsed)} in library</p>
                  {session.entryTime?.toDate && (
                    <p style={{ ...MONO, fontSize: '10px', color: 'var(--text-dim)', marginTop: 4 }}>
                      Entry: {session.entryTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <button onClick={handleCheckOut} disabled={loading}
                  style={{ width: '100%', padding: '13px', borderRadius: 10, background: 'var(--red-soft)', border: '1px solid var(--red-border)', color: 'var(--red)', cursor: loading ? 'not-allowed' : 'pointer', ...MONO, fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, opacity: loading ? 0.6 : 1, transition: 'all 0.15s' }}>
                  {loading ? 'Logging out…' : 'Log Out of Library'}
                </button>
              </div>
            </div>
          )}

          {/* NOT CHECKED IN */}
          {session === null && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ height: 3, background: 'linear-gradient(90deg, var(--gold), transparent)' }} />
              <div style={{ padding: '20px 24px' }}>
                <div style={{ textAlign: 'center', marginBottom: 18 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--gold-soft)', border: '2px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', overflow: 'hidden' }}>
                    <img src="/liblogo.png" alt="NEU" style={{ width: 42, height: 42, objectFit: 'cover', borderRadius: '50%' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                  </div>
                  <p style={{ ...MONO, fontSize: '8px', letterSpacing: '0.22em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 4 }}>Welcome to</p>
                  <h1 style={{ ...SERIF, fontSize: 'clamp(18px,4vw,24px)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>NEU Library</h1>
                  <p style={{ ...PP, fontSize: 13, color: 'var(--text-muted)' }}>
                    Hello, <strong style={{ color: 'var(--text-primary)' }}>{userProfile?.firstName}</strong>! Select your purpose.
                  </p>
                </div>

                {error && (
                  <div style={{ marginBottom: 12, background: 'var(--red-soft)', border: '1px solid var(--red-border)', borderRadius: 8, padding: '8px 12px' }}>
                    <p style={{ ...MONO, fontSize: '11px', color: 'var(--red)' }}>{error}</p>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 6, marginBottom: 14 }}>
                  {PURPOSES.map(p => (
                    <button key={p} type="button" onClick={() => { setPurpose(p); setError(''); }}
                      style={{ padding: '10px 8px', borderRadius: 10, textAlign: 'center', cursor: 'pointer', border: `2px solid ${purpose === p ? 'var(--gold)' : 'var(--card-border)'}`, background: purpose === p ? 'var(--gold-soft)' : 'var(--surface)', color: purpose === p ? 'var(--gold)' : 'var(--text-muted)', ...PP, fontSize: 12, fontWeight: purpose === p ? 600 : 500, transition: 'all 0.15s' }}>
                      {p}
                    </button>
                  ))}
                </div>

                <button onClick={handleCheckIn} disabled={loading || !purpose || isAdminPreview}
                  style={{ width: '100%', padding: '12px', borderRadius: 10, background: isAdminPreview ? 'rgba(59,130,246,0.08)' : (purpose && !loading) ? 'var(--green-soft)' : 'var(--surface)', border: `1px solid ${isAdminPreview ? 'rgba(59,130,246,0.25)' : (purpose && !loading) ? 'var(--green-border)' : 'var(--card-border)'}`, color: isAdminPreview ? 'rgba(96,165,250,0.6)' : (purpose && !loading) ? 'var(--green)' : 'var(--text-dim)', cursor: (purpose && !loading && !isAdminPreview) ? 'pointer' : 'not-allowed', ...MONO, fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, opacity: (purpose && !loading && !isAdminPreview) ? 1 : 0.5, transition: 'all 0.15s' }}>
                  {isAdminPreview ? 'Check-in disabled in preview' : loading ? 'Logging in…' : 'Log In to Library'}
                </button>
              </div>
            </div>
          )}

          </div>{/* end left column */}

          {/* ── RIGHT COLUMN: QR + Edit Request — only when not checked in ── */}
          {session !== undefined && userProfile?.role === 'visitor' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* QR Card — right column, shown when not checked in */}
              {session === null && userProfile?.qrToken && (
                <div style={{ background: 'var(--card)', border: '1px solid var(--gold-border)', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ height: 3, background: 'linear-gradient(90deg, var(--gold), transparent)' }} />
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <p style={{ ...MONO, fontSize: '8px', letterSpacing: '0.18em', color: 'var(--gold)', textTransform: 'uppercase', fontWeight: 700 }}>My QR Code</p>
                    {/* QR preview — click to enlarge */}
                    <div style={{ position: 'relative', cursor: 'pointer', borderRadius: 10, overflow: 'hidden' }}
                      onClick={() => setShowQRLightbox(true)}
                      onMouseEnter={e => e.currentTarget.querySelector('.qr-overlay').style.opacity = '1'}
                      onMouseLeave={e => e.currentTarget.querySelector('.qr-overlay').style.opacity = '0'}>
                      <QRCodeDisplay value={userProfile.qrToken} size={isMobile ? 120 : 150} />
                      <div className="qr-overlay" style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}>
                        <span style={{ color: '#fff', fontSize: 28 }}>⛶</span>
                      </div>
                    </div>
                    <p style={{ ...PP, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4 }}>
                      Show to staff at the counter for quick check-in
                    </p>
                    <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                      <button onClick={() => setShowQRLightbox(true)}
                        style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', color: 'var(--gold)', cursor: 'pointer', ...MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        Enlarge
                      </button>
                      <button onClick={() => {
                          import('qrcode').then(QRCode => {
                            QRCode.toDataURL(userProfile.qrToken, { width: 400, margin: 2 }).then(url => {
                              Object.assign(document.createElement('a'), { href: url, download: 'neu-library-qr.png' }).click();
                            });
                          });
                        }}
                        style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', cursor: 'pointer', ...MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Request Card */}
              <div style={{ background: 'var(--card)', border: `1px solid ${hasPending ? 'var(--gold-border)' : 'var(--card-border)'}`, borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ height: 3, background: hasPending ? 'linear-gradient(90deg, var(--gold), transparent)' : hasApproved ? 'linear-gradient(90deg, var(--green), transparent)' : 'linear-gradient(90deg, var(--card-border), transparent)' }} />
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {hasPending ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>⏳</span>
                        <div>
                          <p style={{ ...MONO, fontSize: '8px', letterSpacing: '0.16em', color: 'var(--gold)', textTransform: 'uppercase', fontWeight: 700 }}>Edit Pending</p>
                          <p style={{ ...PP, fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Under admin review</p>
                        </div>
                      </div>
                      <button onClick={handleCancelRequest}
                        style={{ width: '100%', padding: '9px 0', borderRadius: 8, background: 'var(--red-soft)', border: '1px solid var(--red-border)', color: 'var(--red)', cursor: 'pointer', ...MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        Cancel Request
                      </button>
                    </>
                  ) : hasApproved ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>✅</span>
                      <div>
                        <p style={{ ...MONO, fontSize: '8px', letterSpacing: '0.16em', color: 'var(--green)', textTransform: 'uppercase', fontWeight: 700 }}>Edit Approved</p>
                        <p style={{ ...PP, fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Your info has been updated.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p style={{ ...MONO, fontSize: '8px', letterSpacing: '0.16em', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Info Update</p>
                        <p style={{ ...PP, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                          Wrong name or ID? Request a correction and admin will review it.
                        </p>
                        {hasRejected && editRequest?.rejectionReason && (
                          <p style={{ ...MONO, fontSize: 9, color: 'var(--red)', marginTop: 6 }}>✕ {editRequest.rejectionReason}</p>
                        )}
                      </div>
                      <button onClick={() => setShowEditModal(true)}
                        style={{ width: '100%', padding: '9px 0', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', cursor: 'pointer', ...MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold-soft)'; e.currentTarget.style.borderColor = 'var(--gold-border)'; e.currentTarget.style.color = 'var(--gold)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                        Request Info Update
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* QR Lightbox — fullscreen modal with large QR */}
      {showQRLightbox && userProfile?.qrToken && (
        <div onClick={() => setShowQRLightbox(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', padding: 24, cursor: 'pointer', animation: 'fadeUp 0.2s ease both' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--card)', border: '1px solid var(--gold-border)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', cursor: 'default', animation: 'fadeUp 0.22s ease both' }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg,var(--gold),transparent)' }} />
            <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div>
                <p style={{ ...MONO, fontSize: '8px', letterSpacing: '0.22em', color: 'var(--gold)', textTransform: 'uppercase', textAlign: 'center', marginBottom: 4 }}>My Library QR Code</p>
                <p style={{ ...SERIF, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 2 }}>{displayName}</p>
                <p style={{ ...MONO, fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>{userProfile?.idNumber}</p>
              </div>
              <QRCodeDisplay value={userProfile.qrToken} size={260} />
              <p style={{ ...PP, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 260 }}>
                Show this QR to staff at the counter for instant check-in. Tap anywhere outside to close.
              </p>
              <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                <button onClick={() => {
                    import('qrcode').then(QRCode => {
                      QRCode.toDataURL(userProfile.qrToken, { width: 600, margin: 2 }).then(url => {
                        Object.assign(document.createElement('a'), { href: url, download: `neu-library-qr-${userProfile.idNumber || 'code'}.png` }).click();
                      });
                    });
                  }}
                  style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', color: 'var(--gold)', cursor: 'pointer', ...MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  ↓ Save QR Image
                </button>
                <button onClick={() => setShowQRLightbox(false)}
                  style={{ padding: '11px 18px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', cursor: 'pointer', ...PP, fontSize: 13 }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sign out confirmation modal */}
      {showExit && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowExit(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', padding: 16, animation: 'modalBgIn 0.2s ease both' }}>
          <div style={{ width: '100%', maxWidth: 400, background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 20, overflow: 'hidden', boxShadow: 'var(--shadow-modal)', animation: 'modalCardIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg,#c0392b 0%,#c0392b 25%,#f39c12 25%,#f39c12 50%,#27ae60 50%,#27ae60 75%,#2980b9 75%,#2980b9 100%)' }} />
            <div style={{ padding: '28px 24px', textAlign: 'center' }}>
              {/* Animated icon */}
              <div style={{
                width: 56, height: 56, borderRadius: '50%', margin: '0 auto 18px',
                background: session ? 'var(--gold-soft)' : 'var(--red-soft)',
                border: `1.5px solid ${session ? 'var(--gold-border)' : 'var(--red-border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  {session ? (
                    <>
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        strokeDasharray="30" strokeDashoffset="30">
                        <animate attributeName="stroke-dashoffset" from="30" to="0" dur="0.4s" fill="freeze" />
                      </path>
                      <polyline points="16 17 21 12 16 7" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        strokeDasharray="20" strokeDashoffset="20">
                        <animate attributeName="stroke-dashoffset" from="20" to="0" dur="0.3s" begin="0.2s" fill="freeze" />
                      </polyline>
                      <line x1="21" y1="12" x2="9" y2="12" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round"
                        strokeDasharray="12" strokeDashoffset="12">
                        <animate attributeName="stroke-dashoffset" from="12" to="0" dur="0.25s" begin="0.35s" fill="freeze" />
                      </line>
                    </>
                  ) : (
                    <>
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        strokeDasharray="30" strokeDashoffset="30">
                        <animate attributeName="stroke-dashoffset" from="30" to="0" dur="0.4s" fill="freeze" />
                      </path>
                      <polyline points="16 17 21 12 16 7" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        strokeDasharray="20" strokeDashoffset="20">
                        <animate attributeName="stroke-dashoffset" from="20" to="0" dur="0.3s" begin="0.2s" fill="freeze" />
                      </polyline>
                      <line x1="21" y1="12" x2="9" y2="12" stroke="var(--red)" strokeWidth="2" strokeLinecap="round"
                        strokeDasharray="12" strokeDashoffset="12">
                        <animate attributeName="stroke-dashoffset" from="12" to="0" dur="0.25s" begin="0.35s" fill="freeze" />
                      </line>
                    </>
                  )}
                </svg>
              </div>
              <h2 style={{ ...SERIF, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.25 }}>
                {session ? 'Still Checked In' : 'Sign Out?'}
              </h2>
              <p style={{ ...PP, fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.65 }}>
                {session ? 'You are still checked in. Signing out will keep your visit logged.' : 'Are you sure you want to sign out of your account?'}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowExit(false)}
                  style={{ flex: 1, padding: 13, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', cursor: 'pointer', ...PP, fontSize: 13, fontWeight: 500, transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; }}>
                  Cancel
                </button>
                <button onClick={handleSignOut} disabled={loading}
                  style={{ flex: 1, padding: 13, borderRadius: 12, background: 'var(--red-soft)', border: '1px solid var(--red-border)', color: 'var(--red)', cursor: loading ? 'not-allowed' : 'pointer', ...PP, fontSize: 13, fontWeight: 600, opacity: loading ? 0.6 : 1, transition: 'all 0.15s' }}>
                  {loading ? 'Signing out...' : 'Sign Out'}
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

      {/* Check-in success popup — centered overlay */}
      {showCheckInSuccess && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 85, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', animation: 'modalBgIn 0.2s ease both' }}
            onClick={() => setShowCheckInSuccess(false)} />
          <CheckInSuccessToast
            purpose={checkedInPurpose}
            onDismiss={() => setShowCheckInSuccess(false)}
          />
        </>
      )}

      {showCheckOutSuccess && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 85, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', animation: 'modalBgIn 0.2s ease both' }}
            onClick={() => setShowCheckOutSuccess(false)} />
          <CheckOutSuccessToast
            onDismiss={() => setShowCheckOutSuccess(false)}
          />
        </>
      )}

      <FloatingTutorial pageKey="visitor-dashboard" />

      <style>{`
        @keyframes fadeUp       { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin         { to{transform:rotate(360deg)} }
        @keyframes pulseDot     { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes slideUpToast { from{opacity:0;transform:translateX(-50%) translateY(20px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes welcomeIn    { from{opacity:0;transform:translateX(-50%) translateY(24px) scale(0.95)} to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }
        @keyframes welcomeOut   { to{opacity:0;transform:translateX(-50%) translateY(12px) scale(0.97)} }
        @keyframes modalBgIn    { from{opacity:0} to{opacity:1} }
        @keyframes modalCardIn  { from{opacity:0;transform:translateY(20px) scale(0.96)} to{opacity:1;transform:none} }
        @keyframes checkInPopIn { from{opacity:0;transform:translate(-50%,-50%) scale(0.85)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        @keyframes checkInPopOut{ to{opacity:0;transform:translate(-50%,-50%) scale(0.9)} }
      `}</style>
    </div>
  );
}
