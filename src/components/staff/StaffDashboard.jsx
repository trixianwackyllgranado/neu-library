// src/components/staff/StaffDashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';


const PP = { fontFamily:"'Poppins',sans-serif" };
const SR = { fontFamily:"'Playfair Display',serif" };
const MN = { fontFamily:"'IBM Plex Mono',monospace" };

function StatCard({ label, value, color, sub, onClick }) {
  const borderColor = color==='gold'?'var(--gold)':color==='red'?'var(--red)':color==='green'?'var(--green)':'var(--blue)';
  return (
    <button onClick={onClick} style={{ background:'var(--card)', border:'1px solid var(--card-border)', borderLeft:`3px solid ${borderColor}`, borderRadius:12, padding:'18px 20px', textAlign:'left', cursor:'pointer', width:'100%', transition:'all 0.15s', boxShadow:'var(--shadow-card)' }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--surface-hover)'}
      onMouseLeave={e=>e.currentTarget.style.background='var(--card)'}>
      <p style={{...PP,fontSize:12,fontWeight:600,color:'var(--text-muted)',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.04em'}}>{label}</p>
      <p style={{...SR,fontSize:34,fontWeight:700,color:'var(--text-primary)',lineHeight:1}}>{value}</p>
      {sub && <p style={{...PP,fontSize:12,color:'var(--text-dim)',marginTop:6}}>{sub}</p>}
    </button>
  );
}



function getGreeting(firstName) {
  const hour = new Date().getHours();
  const name = firstName || 'there';
  const morning   = ['Good morning', 'Morning'];
  const afternoon = ['Good afternoon', 'Afternoon'];
  const evening   = ['Good evening', 'Evening'];
  const anytime   = ['Hello', 'Hey', 'Hi', 'Greetings', 'Welcome back', 'Howdy', 'Salutations'];
  const timePool  = hour < 12 ? morning : hour < 18 ? afternoon : evening;
  const pool      = [...timePool, ...anytime];
  const word      = pool[Math.floor(Math.random() * pool.length)];
  return `${word}, ${name}!`;
}

export default function StaffDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [inLib,   setInLib]   = useState(0);
  const [recent,  setRecent]  = useState([]);

  useEffect(() => {
    const u3 = onSnapshot(query(collection(db,'logger'),where('active','==',true)), s => {
      setInLib(s.size);
      setRecent(s.docs.map(d=>({id:d.id,...d.data()})).slice(0,8));
    });
    return () => { u3(); };
  }, []);

  const greeting = userProfile ? getGreeting(userProfile.firstName) : 'Staff Dashboard';

  return (
    <div style={{ animation:'fadeUp 0.3s ease both' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} @keyframes pulseDot{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>

      <div style={{ marginBottom:32 }}>
        <p style={{...PP,fontSize:13,fontWeight:600,color:'var(--gold)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Staff Portal</p>
        <h1 style={{...SR,fontSize:'clamp(24px,4vw,32px)',fontWeight:700,color:'var(--text-primary)',marginBottom:6}}>{greeting}</h1>
        <p style={{...PP,fontSize:15,color:'var(--text-muted)'}}>Library operations at a glance.</p>
        <div style={{marginTop:16,height:1,background:'linear-gradient(90deg,var(--gold-border),transparent)'}} />

      </div>

      <p style={{...PP,fontSize:12,fontWeight:600,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Live Stats</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:28}}>
        <StatCard label="In Library Now" value={inLib} color="green" sub="Currently checked in" onClick={()=>navigate('/logger')} />
      </div>

      <p style={{...PP,fontSize:12,fontWeight:600,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Quick Actions</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12,marginBottom:28}}>
        {[
          { label:'Library Logger', sub:'View active sessions', path:'/logger', color:'var(--gold)' },
        ].map(({ label, sub, path, color }) => (
          <button key={path} onClick={() => navigate(path)}
            style={{ background:'var(--card)', border:'1px solid var(--card-border)', borderTop:`3px solid ${color}`, borderRadius:12, padding:'18px 20px', textAlign:'left', cursor:'pointer', transition:'all 0.15s', boxShadow:'var(--shadow-card)' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--surface-hover)'}
            onMouseLeave={e=>e.currentTarget.style.background='var(--card)'}>
            <p style={{...PP,fontSize:15,fontWeight:600,color:'var(--text-primary)',marginBottom:4}}>{label}</p>
            <p style={{...PP,fontSize:13,color:'var(--text-muted)'}}>{sub}</p>
          </button>
        ))}
      </div>

      {recent.length > 0 && (
        <div style={{ background:'var(--card)', border:'1px solid var(--card-border)', borderRadius:14, overflow:'hidden', boxShadow:'var(--shadow-card)' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--divider)', display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--green)', display:'inline-block', animation:'pulseDot 1.5s infinite' }} />
            <p style={{...PP,fontSize:15,fontWeight:600,color:'var(--text-primary)'}}>Currently in Library</p>
            <span style={{ ...PP, fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20, background:'var(--green-soft)', border:'1px solid var(--green-border)', color:'var(--green)', marginLeft:4 }}>{recent.length}</span>
          </div>
          <div style={{ padding:'14px 20px', display:'flex', flexWrap:'wrap', gap:8 }}>
            {recent.map(s => (
              <span key={s.id} style={{ ...PP, fontSize:12, fontWeight:500, padding:'4px 12px', borderRadius:20, background:'var(--green-soft)', border:'1px solid var(--green-border)', color:'var(--green)' }}>
                {s.purpose}
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
