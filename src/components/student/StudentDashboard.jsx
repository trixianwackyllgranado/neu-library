// src/components/student/StudentDashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useLibrarySession } from '../../context/LibrarySessionContext';

const S = { fontFamily: "'IBM Plex Mono', monospace" };
const D = { fontFamily: "'Playfair Display', serif" };

function fmt(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function StudentDashboard() {
  const { userProfile, currentUser } = useAuth();
  const { session, elapsed } = useLibrarySession();
  const navigate = useNavigate();

  const [borrows,  setBorrows]  = useState([]);
  const [notifs,   setNotifs]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showQR,   setShowQR]   = useState(false);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(collection(db, 'borrows'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.borrowDate?.toDate?.()?.getTime() ?? 0) - (a.borrowDate?.toDate?.()?.getTime() ?? 0));
      setBorrows(docs);
      setLoading(false);
    });
    return unsub;
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(collection(db, 'notifications'), where('toUid', '==', currentUser.uid), where('acknowledged', '==', false));
    return onSnapshot(q, snap => setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser?.uid]);

  const active  = borrows.filter(b => b.status === 'active');
  const now     = new Date();
  const overdue = active.filter(b => b.dueDate?.toDate ? b.dueDate.toDate() < now : false);
  const pending = borrows.filter(b => b.status === 'pending');

  const formatElapsed = (s) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  return (
    <div style={{ animation: 'fadeSlideUp 0.35s ease both' }}>
      <style>{`@keyframes fadeSlideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }`}</style>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <p style={{ ...S, fontSize: '9px', letterSpacing: '0.22em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '6px' }}>Student Portal</p>
        <h1 style={{ ...D, fontSize: 'clamp(22px,4vw,30px)', fontWeight: 700, color: '#f1f5f9' }}>
          {userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Dashboard'}
        </h1>
        {userProfile && (
          <p style={{ ...S, fontSize: '11px', color: '#475569', marginTop: '4px' }}>
            {userProfile.idNumber} — {userProfile.course || userProfile.college}
          </p>
        )}
        <div style={{ marginTop: '14px', height: '1px', background: 'linear-gradient(90deg, #f59e0b22, #f59e0b44, transparent)' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>

        {/* QR Code card */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ background: '#fff', borderRadius: '10px', padding: '10px', flexShrink: 0, cursor: 'pointer' }} onClick={() => setShowQR(true)}>
            {userProfile?.qrToken ? (
              <QRCodeSVG value={userProfile.qrToken} size={80} level="M" includeMargin={false} />
            ) : (
              <div style={{ width: 80, height: 80, background: '#e2e8f0', borderRadius: '4px' }} />
            )}
          </div>
          <div>
            <p style={{ ...S, fontSize: '9px', letterSpacing: '0.16em', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Your Library QR Code</p>
            <p style={{ ...D, fontSize: '16px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' }}>
              {userProfile?.idNumber || '—'}
            </p>
            <p style={{ fontSize: '12px', color: '#475569', marginBottom: '10px' }}>Show this to library staff to check in/out.</p>
            <button onClick={() => setShowQR(true)}
              style={{ ...S, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px 14px', borderRadius: '7px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', cursor: 'pointer' }}>
              View Full Size
            </button>
          </div>
        </div>

        {/* Library session card */}
        {session !== undefined && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${session ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`, borderLeft: `3px solid ${session ? '#10b981' : 'rgba(255,255,255,0.12)'}`, borderRadius: '14px', padding: '20px' }}>
            <p style={{ ...S, fontSize: '9px', letterSpacing: '0.16em', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Library Session</p>
            {session ? (
              <>
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '36px', fontWeight: 600, color: '#f59e0b', lineHeight: 1, marginBottom: '6px', letterSpacing: '0.08em' }}>
                  {formatElapsed(elapsed)}
                </p>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>Time in library — {session.purpose}</p>
                <button onClick={() => navigate('/logger')}
                  style={{ ...S, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px 14px', borderRadius: '7px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', cursor: 'pointer' }}>
                  Log Out
                </button>
              </>
            ) : (
              <>
                <p style={{ ...S, fontSize: '11px', color: '#334155', marginBottom: '10px' }}>Not currently in library</p>
                <button onClick={() => navigate('/logger')}
                  style={{ ...S, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px 14px', borderRadius: '7px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399', cursor: 'pointer' }}>
                  Check In
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Active Borrows', value: active.length,    accent: '#4677c0' },
          { label: 'Overdue',        value: overdue.length,   accent: overdue.length > 0 ? '#ef4444' : '#4677c0' },
          { label: 'Pending',        value: pending.length,   accent: '#f59e0b' },
          { label: 'Total Borrows',  value: borrows.length,   accent: '#4677c0' },
        ].map(({ label, value, accent }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: `3px solid ${accent}`, borderRadius: '12px', padding: '16px' }}>
            <p style={{ ...S, fontSize: '9px', letterSpacing: '0.14em', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</p>
            <p style={{ ...D, fontSize: '28px', fontWeight: 700, color: '#f1f5f9' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Recent borrows */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ ...D, fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>Recent Borrows</p>
          <button onClick={() => navigate('/borrows')}
            style={{ ...S, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer' }}>
            View All
          </button>
        </div>
        {loading ? (
          <p style={{ ...S, fontSize: '11px', color: '#334155', padding: '24px' }}>Loading…</p>
        ) : borrows.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#475569', marginBottom: '12px' }}>No borrow records yet.</p>
            <button onClick={() => navigate('/catalog')}
              style={{ ...S, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 16px', borderRadius: '8px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', cursor: 'pointer' }}>
              Browse Catalog
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Book', 'Borrow Date', 'Due Date', 'Status'].map(h => (
                    <th key={h} style={{ ...S, fontSize: '9px', letterSpacing: '0.14em', color: '#475569', textTransform: 'uppercase', padding: '10px 16px', textAlign: 'left', background: '#060e1e', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {borrows.slice(0, 6).map(b => {
                  const od = b.status === 'active' && b.dueDate?.toDate ? b.dueDate.toDate() < now : false;
                  return (
                    <tr key={b.id}>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '13px', color: '#cbd5e1', fontWeight: 600 }}>{b.bookTitle}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', ...S, fontSize: '11px', color: '#64748b' }}>{fmt(b.borrowDate)}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', ...S, fontSize: '11px', color: od ? '#f87171' : '#64748b', fontWeight: od ? 700 : 400 }}>{fmt(b.dueDate)}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        {od                          && <span className="badge badge-red">Overdue</span>}
                        {!od && b.status==='active'  && <span className="badge badge-green">Active</span>}
                        {b.status==='pending'        && <span className="badge badge-gold">Pending</span>}
                        {b.status==='returned'       && <span className="badge badge-gray">Returned</span>}
                        {b.status==='rejected'       && <span className="badge badge-red">Rejected</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QR code full-screen modal */}
      {showQR && userProfile?.qrToken && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: '16px' }} onClick={() => setShowQR(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', textAlign: 'center', maxWidth: '320px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <QRCodeSVG value={userProfile.qrToken} size={240} level="M" includeMargin={false} />
            <p style={{ ...D, fontSize: '17px', fontWeight: 700, color: '#0a1730', marginTop: '16px' }}>{userProfile.lastName}, {userProfile.firstName}</p>
            <p style={{ ...S, fontSize: '12px', color: '#475569', marginTop: '4px' }}>{userProfile.idNumber}</p>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>Show this QR code to library staff</p>
            <button onClick={() => setShowQR(false)}
              style={{ marginTop: '16px', ...S, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 20px', borderRadius: '8px', background: '#1a3a6b', border: 'none', color: '#f1f5f9', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
