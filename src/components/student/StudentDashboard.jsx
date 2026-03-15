// src/components/student/StudentDashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import ChangePasswordModal from '../shared/ChangePasswordModal';
import EditProfileModal from '../shared/EditProfileModal';
import { useLibrarySession } from '../../context/LibrarySessionContext';

const PP = { fontFamily:"'Poppins',sans-serif" };
const SR = { fontFamily:"'Playfair Display',serif" };
const MN = { fontFamily:"'IBM Plex Mono',monospace" };

function fmt(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' });
}

function StatusBadge({ status, isOverdue }) {
  if (isOverdue) return <span style={{...PP,fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20,background:'var(--red-soft)',border:'1px solid var(--red-border)',color:'var(--red)'}}>Overdue</span>;
  const map = {
    active:   { bg:'var(--green-soft)', border:'var(--green-border)', color:'var(--green)',  label:'Active'   },
    pending:  { bg:'var(--gold-soft)',  border:'var(--gold-border)',  color:'var(--gold)',   label:'Pending'  },
    returned: { bg:'var(--surface)',    border:'var(--card-border)',  color:'var(--text-muted)', label:'Returned' },
    rejected: { bg:'var(--red-soft)',   border:'var(--red-border)',   color:'var(--red)',    label:'Rejected' },
  };
  const t = map[status] || map.returned;
  return <span style={{...PP,fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20,background:t.bg,border:`1px solid ${t.border}`,color:t.color}}>{t.label}</span>;
}

export default function StudentDashboard() {
  const { userProfile, currentUser, needsPasswordReset, clearPasswordResetFlag } = useAuth();
  const { session, elapsed } = useLibrarySession();
  const navigate = useNavigate();
  const [showChangePw,    setShowChangePw]    = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  const [borrows, setBorrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showQR,  setShowQR]  = useState(false);

  // Auto-open password change if admin has reset the flag
  useEffect(() => {
    if (needsPasswordReset) setShowChangePw(true);
  }, [needsPasswordReset]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    return onSnapshot(query(collection(db,'borrows'),where('userId','==',currentUser.uid)), snap => {
      const docs = snap.docs.map(d=>({id:d.id,...d.data()}))
        .sort((a,b)=>(b.borrowDate?.toDate?.()?.getTime()??0)-(a.borrowDate?.toDate?.()?.getTime()??0));
      setBorrows(docs); setLoading(false);
    });
  }, [currentUser?.uid]);

  const now      = new Date();
  const active   = borrows.filter(b=>b.status==='active');
  const overdue  = active.filter(b=>b.dueDate?.toDate ? b.dueDate.toDate()<now : false);
  const pending  = borrows.filter(b=>b.status==='pending');

  const fmtElapsed = (s) => {
    const h = Math.floor(s/3600).toString().padStart(2,'0');
    const m = Math.floor((s%3600)/60).toString().padStart(2,'0');
    return `${h}:${m}`;
  };

  return (
    <div style={{ animation:'fadeUp 0.3s ease both' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <p style={{...PP,fontSize:13,fontWeight:600,color:'var(--gold)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Student Portal</p>
        <h1 style={{...SR,fontSize:'clamp(24px,4vw,32px)',fontWeight:700,color:'var(--text-primary)',marginBottom:4}}>
          {userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Dashboard'}
        </h1>
        {userProfile && (
          <p style={{...MN,fontSize:12,color:'var(--text-muted)'}}>
            {userProfile.idNumber} — {userProfile.course || userProfile.college}
          </p>
        )}
        <div style={{marginTop:16,height:1,background:'linear-gradient(90deg,var(--gold-border),transparent)'}} />
      </div>

      {/* Stats row */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12,marginBottom:24}}>
        {[
          { label:'Active Borrows', value:active.length,  color:'var(--blue)'  },
          { label:'Overdue',        value:overdue.length,  color:overdue.length>0?'var(--red)':'var(--blue)' },
          { label:'Pending',        value:pending.length,  color:'var(--gold)'  },
          { label:'Total Borrows',  value:borrows.length,  color:'var(--blue)'  },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:'var(--card)', border:'1px solid var(--card-border)', borderLeft:`3px solid ${color}`, borderRadius:12, padding:'16px 18px', boxShadow:'var(--shadow-card)' }}>
            <p style={{...PP,fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:8}}>{label}</p>
            <p style={{...SR,fontSize:32,fontWeight:700,color:'var(--text-primary)',lineHeight:1}}>{value}</p>
          </div>
        ))}
      </div>

      {/* QR + Session row */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:16,marginBottom:24}}>

        {/* QR Card */}
        <div style={{ background:'var(--card)', border:'1px solid var(--card-border)', borderRadius:14, padding:'20px', display:'flex', alignItems:'center', gap:20, flexWrap:'wrap', boxShadow:'var(--shadow-card)' }}>
          <div style={{ background:'#fff', borderRadius:10, padding:10, flexShrink:0, cursor:'pointer' }} onClick={() => setShowQR(true)}>
            {userProfile?.qrToken
              ? <QRCodeSVG value={userProfile.qrToken} size={80} level="M" includeMargin={false} />
              : <div style={{width:80,height:80,background:'#e2e8f0',borderRadius:4}} />
            }
          </div>
          <div>
            <p style={{...PP,fontSize:12,fontWeight:600,color:'var(--text-muted)',marginBottom:4}}>Your Library QR Code</p>
            <p style={{...SR,fontSize:18,fontWeight:700,color:'var(--text-primary)',marginBottom:4}}>{userProfile?.idNumber||'—'}</p>
            <p style={{...PP,fontSize:13,color:'var(--text-muted)',marginBottom:12}}>Show this to library staff to check in or out.</p>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button onClick={() => setShowQR(true)}
                style={{...PP,fontSize:12,fontWeight:600,padding:'7px 16px',borderRadius:8,background:'var(--gold-soft)',border:'1px solid var(--gold-border)',color:'var(--gold)',cursor:'pointer',transition:'all 0.15s'}}>
                View Full Size
              </button>
              <button onClick={() => setShowChangePw(true)}
                style={{...PP,fontSize:12,fontWeight:600,padding:'7px 16px',borderRadius:8,background:'var(--surface)',border:'1px solid var(--card-border)',color:'var(--text-muted)',cursor:'pointer',transition:'all 0.15s'}}>
                Change Password
              </button>
              <button onClick={() => setShowEditProfile(true)}
                style={{...PP,fontSize:12,fontWeight:600,padding:'7px 16px',borderRadius:8,background:'var(--surface)',border:'1px solid var(--card-border)',color:'var(--text-muted)',cursor:'pointer',transition:'all 0.15s'}}>
                Edit College/Course
              </button>
            </div>
          </div>
        </div>

        {/* Session Card */}
        {session !== undefined && (
          <div style={{ background:'var(--card)', border:`1px solid ${session?'var(--green-border)':'var(--card-border)'}`, borderLeft:`3px solid ${session?'var(--green)':'var(--card-border)'}`, borderRadius:14, padding:'20px', boxShadow:'var(--shadow-card)' }}>
            <p style={{...PP,fontSize:12,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:12}}>Library Session</p>
            {session ? (
              <>
                <p style={{...MN,fontSize:40,fontWeight:600,color:'var(--gold)',lineHeight:1,marginBottom:6,letterSpacing:'0.06em'}}>{fmtElapsed(elapsed)}</p>
                <p style={{...PP,fontSize:13,color:'var(--text-muted)',marginBottom:16}}>Time in library — {session.purpose}</p>
                <button onClick={() => navigate('/logger')}
                  style={{...PP,fontSize:13,fontWeight:600,padding:'9px 18px',borderRadius:9,background:'var(--red-soft)',border:'1px solid var(--red-border)',color:'var(--red)',cursor:'pointer',transition:'all 0.15s'}}>
                  Check Out
                </button>
              </>
            ) : (
              <>
                <p style={{...PP,fontSize:15,fontWeight:500,color:'var(--text-muted)',marginBottom:16}}>Not currently in library</p>
                <button onClick={() => navigate('/logger')}
                  style={{...PP,fontSize:13,fontWeight:600,padding:'9px 18px',borderRadius:9,background:'var(--green-soft)',border:'1px solid var(--green-border)',color:'var(--green)',cursor:'pointer',transition:'all 0.15s'}}>
                  Check In
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Recent Borrows */}
      <div style={{ background:'var(--card)', border:'1px solid var(--card-border)', borderRadius:14, overflow:'hidden', boxShadow:'var(--shadow-card)' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--divider)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <p style={{...PP,fontSize:16,fontWeight:600,color:'var(--text-primary)'}}>Recent Borrows</p>
          <button onClick={() => navigate('/borrows')}
            style={{...PP,fontSize:13,fontWeight:600,background:'none',border:'none',color:'var(--gold)',cursor:'pointer'}}>
            View All
          </button>
        </div>
        {loading ? (
          <p style={{...PP,fontSize:14,color:'var(--text-muted)',padding:24}}>Loading...</p>
        ) : borrows.length === 0 ? (
          <div style={{ padding:'40px 24px', textAlign:'center' }}>
            <p style={{...PP,fontSize:15,color:'var(--text-muted)',marginBottom:16}}>No borrow records yet.</p>
            <button onClick={() => navigate('/catalog')}
              style={{...PP,fontSize:13,fontWeight:600,padding:'10px 20px',borderRadius:9,background:'var(--gold-soft)',border:'1px solid var(--gold-border)',color:'var(--gold)',cursor:'pointer'}}>
              Browse Catalog
            </button>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', minWidth:480, borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Book','Borrow Date','Due Date','Status'].map(h => (
                    <th key={h} style={{fontFamily:"'Poppins',sans-serif",fontSize:11,fontWeight:600,color:'var(--text-muted)',padding:'11px 16px',textAlign:'left',background:'var(--thead-bg)',borderBottom:'1px solid var(--divider)',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {borrows.slice(0,6).map(b => {
                  const od = b.status==='active' && b.dueDate?.toDate ? b.dueDate.toDate()<now : false;
                  return (
                    <tr key={b.id} style={{ transition:'background 0.12s' }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--surface-hover)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={{fontFamily:"'Poppins',sans-serif",fontSize:14,color:'var(--text-primary)',fontWeight:600,padding:'12px 16px',borderBottom:'1px solid var(--row-border)'}}>{b.bookTitle}</td>
                      <td style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:'var(--text-muted)',padding:'12px 16px',borderBottom:'1px solid var(--row-border)'}}>{fmt(b.borrowDate)}</td>
                      <td style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:12,color:od?'var(--red)':'var(--text-muted)',fontWeight:od?700:400,padding:'12px 16px',borderBottom:'1px solid var(--row-border)'}}>{fmt(b.dueDate)}</td>
                      <td style={{padding:'12px 16px',borderBottom:'1px solid var(--row-border)'}}><StatusBadge status={b.status} isOverdue={od} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showChangePw && <ChangePasswordModal onClose={() => { setShowChangePw(false); if (needsPasswordReset) clearPasswordResetFlag(); }} adminReset={needsPasswordReset} />}
      {showEditProfile && <EditProfileModal onClose={() => setShowEditProfile(false)} />}

      {/* QR Modal */}
      {showQR && userProfile?.qrToken && (
        <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.85)',padding:16}} onClick={()=>setShowQR(false)}>
          <div style={{background:'#fff',borderRadius:18,padding:28,textAlign:'center',maxWidth:320,width:'100%'}} onClick={e=>e.stopPropagation()}>
            <QRCodeSVG id="student-qr-canvas" value={userProfile.qrToken} size={240} level="M" includeMargin={false} />
            <p style={{...SR,fontSize:18,fontWeight:700,color:'#0a1730',marginTop:16}}>{userProfile.lastName}, {userProfile.firstName}</p>
            <p style={{...MN,fontSize:13,color:'#475569',marginTop:4}}>{userProfile.idNumber}</p>
            <p style={{fontFamily:"'Poppins',sans-serif",fontSize:12,color:'#94a3b8',marginTop:6}}>Show this QR code to library staff</p>
            <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:18,flexWrap:'wrap'}}>
              <button onClick={() => {
                const svg = document.getElementById('student-qr-canvas');
                if (!svg) return;
                const serialized = new XMLSerializer().serializeToString(svg);
                const canvas = document.createElement('canvas');
                canvas.width = 300; canvas.height = 300;
                const ctx = canvas.getContext('2d');
                const img = new Image();
                img.onload = () => {
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(0,0,300,300);
                  ctx.drawImage(img,0,0,300,300);
                  const a = document.createElement('a');
                  a.download = `QR-${userProfile.idNumber}.png`;
                  a.href = canvas.toDataURL('image/png');
                  a.click();
                };
                img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(serialized)));
              }}
                style={{fontFamily:"'Poppins',sans-serif",fontSize:13,fontWeight:600,padding:'9px 22px',borderRadius:9,background:'rgba(245,158,11,0.15)',border:'1px solid rgba(245,158,11,0.4)',color:'#b7952a',cursor:'pointer'}}>
                Save as Image
              </button>
              <button onClick={()=>setShowQR(false)}
                style={{fontFamily:"'Poppins',sans-serif",fontSize:13,fontWeight:600,padding:'9px 22px',borderRadius:9,background:'#1a3a6b',border:'none',color:'#f1f5f9',cursor:'pointer'}}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
