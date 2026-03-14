// src/components/staff/StaffDashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

const S = { fontFamily: "'IBM Plex Mono', monospace" };
const D = { fontFamily: "'Playfair Display', serif" };

function StatBox({ label, value, accent, onClick }) {
  const color = accent === 'gold' ? '#f59e0b' : accent === 'red' ? '#f87171' : accent === 'green' ? '#34d399' : '#7a9fd8';
  return (
    <button onClick={onClick}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: `3px solid ${color}`, borderRadius: '12px', padding: '16px', textAlign: 'left', cursor: onClick ? 'pointer' : 'default', width: '100%', transition: 'all 0.15s' }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
      <p style={{ ...S, fontSize: '9px', letterSpacing: '0.14em', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</p>
      <p style={{ ...D, fontSize: '28px', fontWeight: 700, color: '#f1f5f9' }}>{value}</p>
    </button>
  );
}

export default function StaffDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [pending,  setPending]  = useState(0);
  const [active,   setActive]   = useState(0);
  const [overdue,  setOverdue]  = useState(0);
  const [inLib,    setInLib]    = useState(0);
  const [recent,   setRecent]   = useState([]);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'borrows'), where('status', '==', 'pending')), s => setPending(s.size));
    const u2 = onSnapshot(query(collection(db, 'borrows'), where('status', '==', 'active')),  s => {
      const now = new Date();
      let od = 0;
      s.docs.forEach(d => { const due = d.data().dueDate?.toDate?.(); if (due && due < now) od++; });
      setActive(s.size); setOverdue(od);
    });
    const u3 = onSnapshot(query(collection(db, 'logger'), where('active', '==', true)), s => setInLib(s.size));
    const u4 = onSnapshot(query(collection(db, 'logger'), where('active', '==', true)), s => setRecent(s.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, 8)));
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  return (
    <div style={{ animation: 'fadeSlideUp 0.35s ease both' }}>
      <style>{`@keyframes fadeSlideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }`}</style>

      <div style={{ marginBottom: '24px' }}>
        <p style={{ ...S, fontSize: '9px', letterSpacing: '0.22em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '6px' }}>Staff Portal</p>
        <h1 style={{ ...D, fontSize: 'clamp(22px,4vw,30px)', fontWeight: 700, color: '#f1f5f9' }}>
          {userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Dashboard'}
        </h1>
        <div style={{ marginTop: '14px', height: '1px', background: 'linear-gradient(90deg, #f59e0b22, #f59e0b44, transparent)' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <StatBox label="Pending Requests" value={pending}  accent="gold"  onClick={() => navigate('/borrows')} />
        <StatBox label="Active Borrows"   value={active}   accent="blue"  onClick={() => navigate('/borrows')} />
        <StatBox label="Overdue"          value={overdue}  accent="red"   onClick={() => navigate('/borrows')} />
        <StatBox label="In Library Now"   value={inLib}    accent="green" onClick={() => navigate('/logger')} />
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'QR Scanner',      sub: 'Check students in/out',    path: '/staff/qr-logger',  accent: '#f59e0b' },
          { label: 'Borrowing',       sub: 'Review pending requests',  path: '/borrows',           accent: '#4677c0' },
          { label: 'Student Records', sub: 'View student profiles',    path: '/staff/students',    accent: '#7a9fd8' },
          { label: 'Book Catalog',    sub: 'Manage catalog entries',   path: '/catalog',           accent: '#34d399' },
        ].map(({ label, sub, path, accent }) => (
          <button key={path} onClick={() => navigate(path)}
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s', borderTop: `2px solid ${accent}` }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
            <p style={{ ...D, fontSize: '15px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' }}>{label}</p>
            <p style={{ fontSize: '12px', color: '#64748b' }}>{sub}</p>
          </button>
        ))}
      </div>

      {/* Currently in library */}
      {recent.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse-dot 1.5s infinite' }} />
            <p style={{ ...D, fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>Currently in Library</p>
          </div>
          <div style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {recent.map(s => (
              <span key={s.id} style={{ ...S, fontSize: '10px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
                {s.purpose}
              </span>
            ))}
          </div>
        </div>
      )}
      <style>{`@keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
