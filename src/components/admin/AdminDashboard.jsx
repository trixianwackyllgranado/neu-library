// src/components/admin/AdminDashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

const S = { fontFamily: "'IBM Plex Mono', monospace" };
const D = { fontFamily: "'Playfair Display', serif" };

function Stat({ label, value, accent, onClick }) {
  const c = accent === 'gold' ? '#f59e0b' : accent === 'red' ? '#f87171' : accent === 'green' ? '#34d399' : '#7a9fd8';
  return (
    <button onClick={onClick}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: `3px solid ${c}`, borderRadius: '12px', padding: '16px', textAlign: 'left', cursor: 'pointer', width: '100%', transition: 'all 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
      <p style={{ ...S, fontSize: '9px', letterSpacing: '0.14em', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</p>
      <p style={{ ...D, fontSize: '28px', fontWeight: 700, color: '#f1f5f9' }}>{value}</p>
      <p style={{ ...S, fontSize: '8px', color: '#334155', marginTop: '4px' }}>Click to view</p>
    </button>
  );
}

export default function AdminDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [users,    setUsers]    = useState({ total: 0, students: 0, staff: 0 });
  const [books,    setBooks]    = useState(0);
  const [pending,  setPending]  = useState(0);
  const [overdue,  setOverdue]  = useState(0);
  const [inLib,    setInLib]    = useState(0);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'users'), s => {
      const docs = s.docs.map(d => d.data());
      setUsers({ total: docs.length, students: docs.filter(u => u.role === 'student').length, staff: docs.filter(u => u.role === 'staff' || u.role === 'admin').length });
    });
    const u2 = onSnapshot(collection(db, 'books'), s => setBooks(s.size));
    const u3 = onSnapshot(query(collection(db, 'borrows'), where('status', '==', 'pending')), s => setPending(s.size));
    const u4 = onSnapshot(query(collection(db, 'borrows'), where('status', '==', 'active')), s => {
      const now = new Date(); let od = 0;
      s.docs.forEach(d => { const due = d.data().dueDate?.toDate?.(); if (due && due < now) od++; });
      setOverdue(od);
    });
    const u5 = onSnapshot(query(collection(db, 'logger'), where('active', '==', true)), s => setInLib(s.size));
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, []);

  return (
    <div style={{ animation: 'fadeSlideUp 0.35s ease both' }}>
      <style>{`@keyframes fadeSlideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }`}</style>

      <div style={{ marginBottom: '24px' }}>
        <p style={{ ...S, fontSize: '9px', letterSpacing: '0.22em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '6px' }}>Administrator</p>
        <h1 style={{ ...D, fontSize: 'clamp(22px,4vw,30px)', fontWeight: 700, color: '#f1f5f9' }}>System Overview</h1>
        <div style={{ marginTop: '14px', height: '1px', background: 'linear-gradient(90deg, #f59e0b22, #f59e0b44, transparent)' }} />
      </div>

      <div style={{ marginBottom: '8px' }}>
        <p style={{ ...S, fontSize: '9px', letterSpacing: '0.16em', color: '#475569', textTransform: 'uppercase', marginBottom: '10px' }}>Users</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          <Stat label="Total Users" value={users.total}    accent="blue"  onClick={() => navigate('/admin/users')} />
          <Stat label="Students"    value={users.students} accent="blue"  onClick={() => navigate('/staff/students')} />
          <Stat label="Staff"       value={users.staff}    accent="gold"  onClick={() => navigate('/admin/users')} />
        </div>
        <p style={{ ...S, fontSize: '9px', letterSpacing: '0.16em', color: '#475569', textTransform: 'uppercase', marginBottom: '10px' }}>Borrowing</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          <Stat label="Books in Catalog" value={books}   accent="blue"  onClick={() => navigate('/catalog')} />
          <Stat label="Pending Requests" value={pending} accent="gold"  onClick={() => navigate('/borrows')} />
          <Stat label="Overdue"          value={overdue} accent="red"   onClick={() => navigate('/borrows')} />
        </div>
        <p style={{ ...S, fontSize: '9px', letterSpacing: '0.16em', color: '#475569', textTransform: 'uppercase', marginBottom: '10px' }}>Logger</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '24px' }}>
          <Stat label="In Library Now" value={inLib} accent="green" onClick={() => navigate('/logger')} />
        </div>
      </div>

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Reports',         path: '/admin/reports',   sub: 'Analytics & exports' },
          { label: 'User Management', path: '/admin/users',     sub: 'Role assignment' },
          { label: 'QR Scanner',      path: '/staff/qr-logger', sub: 'Check-in/out station' },
          { label: 'Book Catalog',    path: '/catalog',         sub: 'Add & manage books' },
        ].map(({ label, path, sub }) => (
          <button key={path} onClick={() => navigate(path)}
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
            <p style={{ ...D, fontSize: '15px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' }}>{label}</p>
            <p style={{ fontSize: '12px', color: '#64748b' }}>{sub}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
