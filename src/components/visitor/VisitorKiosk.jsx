// src/components/visitor/VisitorKiosk.jsx
// Kiosk view for visitors (student or faculty) — check in / check out only
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrarySession } from '../../context/LibrarySessionContext';

const SERIF = { fontFamily: "'Playfair Display', serif" };
const MONO  = { fontFamily: "'IBM Plex Mono', monospace" };
const PP    = { fontFamily: "'Poppins', sans-serif" };

const PURPOSES = [
  'Study / Review',
  'Research',
  'Use Computer',
  'Group Study',
  'Other',
];

function formatHHMM(secs) {
  if (!secs || secs < 0) return '00:00';
  const h = Math.floor(secs / 3600).toString().padStart(2, '0');
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatReadable(secs) {
  if (!secs || secs < 0) return '0m';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}hr`;
  return `${h}hr ${m}m`;
}

export default function VisitorKiosk() {
  const { userProfile } = useAuth();
  const { session, elapsed, checkIn, checkOut } = useLibrarySession();
  const [purpose, setPurpose] = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const visitorTypeLabel = userProfile?.visitorType === 'faculty' ? 'Faculty' : 'Student';
  const displayName = userProfile
    ? `${userProfile.firstName}${userProfile.middleInitial ? ` ${userProfile.middleInitial}.` : ''} ${userProfile.lastName}`
    : '—';

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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', background: 'var(--bg-base)' }}>
      <div style={{ width: '100%', maxWidth: 480, animation: 'fadeUp 0.4s ease both' }}>

        {/* Welcome header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--gold-soft)', border: '2px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', overflow: 'hidden' }}>
            <img src="/liblogo.png" alt="NEU" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: '50%' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <p style={{ ...MONO, fontSize: 9, letterSpacing: '0.24em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 8 }}>
            {visitorTypeLabel} Portal
          </p>
          <h1 style={{ ...SERIF, fontSize: 'clamp(24px,5vw,34px)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.15, marginBottom: 6 }}>
            Welcome to NEU Library!
          </h1>
          <p style={{ ...PP, fontSize: 15, color: 'var(--text-muted)' }}>
            {displayName}
          </p>
          {userProfile?.idNumber && (
            <p style={{ ...MONO, fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{userProfile.idNumber}</p>
          )}
        </div>

        {/* Session card */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-modal)' }}>
          <div style={{ height: 3, background: 'linear-gradient(90deg, var(--gold), transparent)' }} />

          <div style={{ padding: '28px 28px 32px' }}>
            {session === undefined && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ width: 32, height: 32, border: '3px solid var(--gold-border)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                <p style={{ ...MONO, fontSize: 11, color: 'var(--text-muted)' }}>Loading session…</p>
              </div>
            )}

            {/* Active session */}
            {session && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulseDot 1.5s infinite' }} />
                  <p style={{ ...MONO, fontSize: 10, letterSpacing: '0.16em', color: 'var(--green)', textTransform: 'uppercase' }}>Currently In Library</p>
                </div>

                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 52, fontWeight: 600, color: 'var(--gold)', lineHeight: 1, letterSpacing: '0.06em', textShadow: '0 0 40px rgba(245,158,11,0.2)' }}>
                    {formatHHMM(elapsed)}
                  </p>
                  <p style={{ ...PP, fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>{formatReadable(elapsed)} in library</p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, background: 'var(--surface)', borderRadius: 10, padding: '12px 16px' }}>
                  <div>
                    <p style={{ ...MONO, fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Entry Time</p>
                    <p style={{ ...MONO, fontSize: 14, fontWeight: 600, color: 'var(--text-body)' }}>
                      {session.entryTime?.toDate?.() ? session.entryTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ ...MONO, fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Purpose</p>
                    <p style={{ ...PP, fontSize: 13, color: 'var(--text-muted)' }}>{session.purpose}</p>
                  </div>
                </div>

                <button onClick={handleCheckOut} disabled={loading}
                  style={{ width: '100%', padding: 14, borderRadius: 12, background: 'var(--red-soft)', border: '1px solid var(--red-border)', color: 'var(--red)', cursor: loading ? 'not-allowed' : 'pointer', ...MONO, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, opacity: loading ? 0.6 : 1, transition: 'all 0.15s' }}>
                  {loading ? 'Logging Out…' : 'Log Out of Library'}
                </button>
              </div>
            )}

            {/* Check-in form */}
            {session === null && (
              <div>
                <p style={{ ...MONO, fontSize: 9, letterSpacing: '0.18em', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 16 }}>Library Check-In</p>

                {error && (
                  <div style={{ background: 'var(--red-soft)', border: '1px solid var(--red-border)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                    <p style={{ ...MONO, fontSize: 11, color: 'var(--red)' }}>{error}</p>
                  </div>
                )}

                <div style={{ marginBottom: 16 }}>
                  <label style={{ ...MONO, fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 8, fontWeight: 600 }}>
                    Purpose of Visit
                  </label>
                  <select
                    style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 10, padding: '11px 14px', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', appearance: 'none', cursor: 'pointer' }}
                    value={purpose} onChange={e => { setPurpose(e.target.value); setError(''); }}>
                    <option value="">— Select Purpose —</option>
                    {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <button onClick={handleCheckIn} disabled={loading}
                  style={{ width: '100%', padding: 14, borderRadius: 12, background: 'var(--green-soft)', border: '1px solid var(--green-border)', color: 'var(--green)', cursor: loading ? 'not-allowed' : 'pointer', ...MONO, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, opacity: loading ? 0.6 : 1, transition: 'all 0.15s' }}>
                  {loading ? 'Checking In…' : 'Log In to Library'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  );
}
