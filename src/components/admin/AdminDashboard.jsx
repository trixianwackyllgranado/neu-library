// src/components/admin/AdminDashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import ChangePasswordModal from '../shared/ChangePasswordModal';
import EditProfileModal from '../shared/EditProfileModal';

const PP = { fontFamily:"'Poppins',sans-serif" };
const SR = { fontFamily:"'Playfair Display',serif" };
const MN = { fontFamily:"'IBM Plex Mono',monospace" };

function StatCard({ label, value, color, sub, onClick }) {
  const borderColor = color === 'gold' ? 'var(--gold)' : color === 'red' ? 'var(--red)' : color === 'green' ? 'var(--green)' : 'var(--blue)';
  return (
    <button onClick={onClick} style={{ background:'var(--card)', border:'1px solid var(--card-border)', borderLeft:`3px solid ${borderColor}`, borderRadius:12, padding:'18px 20px', textAlign:'left', cursor:'pointer', width:'100%', transition:'all 0.15s', boxShadow:'var(--shadow-card)' }}
      onMouseEnter={e=>e.currentTarget.style.borderColor=borderColor}
      onMouseLeave={e=>e.currentTarget.style.borderColor='var(--card-border)'}>
      <p style={{...PP,fontSize:12,fontWeight:600,color:'var(--text-muted)',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.04em'}}>{label}</p>
      <p style={{...SR,fontSize:34,fontWeight:700,color:'var(--text-primary)',lineHeight:1}}>{value}</p>
      {sub && <p style={{...PP,fontSize:12,color:'var(--text-dim)',marginTop:6}}>{sub}</p>}
    </button>
  );
}

function QuickLink({ label, sub, path, accentColor, navigate }) {
  return (
    <button onClick={() => navigate(path)}
      style={{ background:'var(--card)', border:'1px solid var(--card-border)', borderTop:`3px solid ${accentColor}`, borderRadius:12, padding:'18px 20px', textAlign:'left', cursor:'pointer', transition:'all 0.15s', boxShadow:'var(--shadow-card)' }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--surface-hover)'}
      onMouseLeave={e=>e.currentTarget.style.background='var(--card)'}>
      <p style={{...PP,fontSize:15,fontWeight:600,color:'var(--text-primary)',marginBottom:4}}>{label}</p>
      <p style={{...PP,fontSize:13,color:'var(--text-muted)'}}>{sub}</p>
    </button>
  );
}

export default function AdminDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [showChangePw,    setShowChangePw]    = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [users,   setUsers]   = useState({ total:0, students:0, staff:0 });
  const [books,   setBooks]   = useState(0);
  const [pending, setPending] = useState(0);
  const [overdue, setOverdue] = useState(0);
  const [inLib,   setInLib]   = useState(0);

  useEffect(() => {
    const u1 = onSnapshot(collection(db,'users'), s => {
      const docs = s.docs.map(d=>d.data());
      setUsers({ total:docs.length, students:docs.filter(u=>u.role==='student').length, staff:docs.filter(u=>u.role==='staff'||u.role==='admin').length });
    });
    const u2 = onSnapshot(collection(db,'books'), s => setBooks(s.size));
    const u3 = onSnapshot(query(collection(db,'borrows'),where('status','==','pending')), s => setPending(s.size));
    const u4 = onSnapshot(query(collection(db,'borrows'),where('status','==','active')), s => {
      const now = new Date(); let od = 0;
      s.docs.forEach(d => { const due = d.data().dueDate?.toDate?.(); if(due && due < now) od++; });
      setOverdue(od);
    });
    const u5 = onSnapshot(query(collection(db,'logger'),where('active','==',true)), s => setInLib(s.size));
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, []);

  const greeting = userProfile ? `Welcome back, ${userProfile.firstName}` : 'System Overview';

  return (
    <div style={{ animation:'fadeUp 0.3s ease both' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{ marginBottom:32 }}>
        <p style={{...PP,fontSize:13,fontWeight:600,color:'var(--gold)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Administrator</p>
        <h1 style={{...SR,fontSize:'clamp(24px,4vw,32px)',fontWeight:700,color:'var(--text-primary)',marginBottom:6}}>{greeting}</h1>
        <p style={{...PP,fontSize:15,color:'var(--text-muted)'}}>Here is a live overview of the library system.</p>
        <div style={{marginTop:16,height:1,background:'linear-gradient(90deg,var(--gold-border),transparent)'}} />
        <button onClick={() => setShowChangePw(true)}
          style={{...PP,marginTop:12,fontSize:12,fontWeight:600,padding:'7px 16px',borderRadius:8,background:'var(--surface)',border:'1px solid var(--card-border)',color:'var(--text-muted)',cursor:'pointer',transition:'all 0.15s',display:'inline-flex',alignItems:'center',gap:6}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Change Password
        </button>
        <button onClick={() => setShowEditProfile(true)}
          style={{...PP,marginTop:12,marginLeft:8,fontSize:12,fontWeight:600,padding:'7px 16px',borderRadius:8,background:'var(--surface)',border:'1px solid var(--card-border)',color:'var(--text-muted)',cursor:'pointer',transition:'all 0.15s',display:'inline-flex',alignItems:'center',gap:6}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit College/Course
        </button>
      </div>

      <p style={{...PP,fontSize:12,fontWeight:600,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Users</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:24}}>
        <StatCard label="Total Users"  value={users.total}    color="blue"  sub="All accounts"        onClick={()=>navigate('/admin/users')} />
        <StatCard label="Students"     value={users.students} color="blue"  sub="Active learners"     onClick={()=>navigate('/staff/students')} />
        <StatCard label="Staff & Admin" value={users.staff}   color="gold"  sub="Library personnel"   onClick={()=>navigate('/admin/users')} />
      </div>

      <p style={{...PP,fontSize:12,fontWeight:600,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Borrowing</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:24}}>
        <StatCard label="Books in Catalog" value={books}   color="blue"  sub="Total entries"      onClick={()=>navigate('/catalog')} />
        <StatCard label="Pending Requests" value={pending} color="gold"  sub="Awaiting approval"  onClick={()=>navigate('/borrows')} />
        <StatCard label="Overdue"          value={overdue} color="red"   sub="Past due date"      onClick={()=>navigate('/borrows')} />
      </div>

      <p style={{...PP,fontSize:12,fontWeight:600,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Library</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:32}}>
        <StatCard label="In Library Now" value={inLib} color="green" sub="Currently checked in" onClick={()=>navigate('/logger')} />
      </div>

      <p style={{...PP,fontSize:12,fontWeight:600,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Quick Access</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12}}>
        <QuickLink label="Reports"         sub="Analytics and data exports"  path="/admin/reports"   accentColor="var(--gold)"  navigate={navigate} />
        <QuickLink label="User Management" sub="Roles and account control"   path="/admin/users"     accentColor="var(--blue)"  navigate={navigate} />
        <QuickLink label="QR Scanner"      sub="Student check-in station"    path="/staff/qr-logger" accentColor="var(--green)" navigate={navigate} />
        <QuickLink label="Book Catalog"    sub="Add and manage books"        path="/catalog"         accentColor="var(--gold)"  navigate={navigate} />
      </div>
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
      {showEditProfile && <EditProfileModal onClose={() => setShowEditProfile(false)} />}
    </div>
  );
}
