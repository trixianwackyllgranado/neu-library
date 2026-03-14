// src/components/shared/AppLayout.jsx
import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLibrarySession } from '../../context/LibrarySessionContext';
import { useTheme } from '../../context/ThemeContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import NotificationBanner from './NotificationBanner';

const PP = { fontFamily: "'Poppins', sans-serif" };
const SR = { fontFamily: "'Playfair Display', serif" };
const MN = { fontFamily: "'IBM Plex Mono', monospace" };

const Ico = {
  dashboard: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  catalog:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  borrows:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  logger:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>,
  students:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3.33 1.67 8.67 1.67 12 0v-5"/></svg>,
  qr:        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3" rx="0.5"/><rect x="19" y="14" width="2" height="2" rx="0.5"/><rect x="14" y="19" width="2" height="2" rx="0.5"/><rect x="18" y="19" width="3" height="2" rx="0.5"/></svg>,
  users:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>,
  reports:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  menu:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  close:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  signout:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  chLeft:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  chRight:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  sun:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  moon:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
};

const NAV = {
  student: [
    { to: '/dashboard', label: 'Dashboard',    icon: Ico.dashboard },
    { to: '/catalog',   label: 'Book Catalog', icon: Ico.catalog   },
    { to: '/borrows',   label: 'My Borrows',   icon: Ico.borrows   },
    { to: '/logger',    label: 'Library Log',  icon: Ico.logger    },
  ],
  staff: [
    { to: '/dashboard',       label: 'Dashboard',       icon: Ico.dashboard },
    { to: '/catalog',         label: 'Book Catalog',    icon: Ico.catalog   },
    { to: '/borrows',         label: 'Borrowing',       icon: Ico.borrows   },
    { to: '/logger',          label: 'Library Logger',  icon: Ico.logger    },
    { to: '/staff/students',  label: 'Student Records', icon: Ico.students  },
    { to: '/staff/qr-logger', label: 'QR Scanner',      icon: Ico.qr        },
  ],
  admin: [
    { to: '/dashboard',       label: 'Dashboard',       icon: Ico.dashboard },
    { to: '/catalog',         label: 'Book Catalog',    icon: Ico.catalog   },
    { to: '/borrows',         label: 'Borrowing',       icon: Ico.borrows   },
    { to: '/logger',          label: 'Library Logger',  icon: Ico.logger    },
    { to: '/staff/students',  label: 'Student Records', icon: Ico.students  },
    { to: '/staff/qr-logger', label: 'QR Scanner',      icon: Ico.qr        },
    { to: '/admin/users',     label: 'User Management', icon: Ico.users     },
    { to: '/admin/reports',   label: 'Reports',         icon: Ico.reports   },
  ],
};

function NavItem({ to, label, icon, collapsed, badgeCount, onClick }) {
  return (
    <NavLink to={to} onClick={onClick}
      style={({ isActive }) => ({
        display:'flex', alignItems:'center', gap:10,
        padding: collapsed ? '10px 0' : '10px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius:10, textDecoration:'none', transition:'all 0.15s',
        background: isActive ? 'var(--gold-soft)' : 'transparent',
        border: isActive ? '1px solid var(--gold-border)' : '1px solid transparent',
        color: isActive ? 'var(--gold)' : 'var(--text-muted)',
        position:'relative',
      })}>
      <span style={{flexShrink:0,display:'flex',alignItems:'center'}}>{icon}</span>
      {!collapsed && <span style={{...PP,fontSize:13,fontWeight:500,whiteSpace:'nowrap'}}>{label}</span>}
      {badgeCount > 0 && (
        <span style={{position:'absolute',top:collapsed?4:6,right:collapsed?4:8,minWidth:18,height:18,borderRadius:9,background:'var(--gold)',color:'#000',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',...PP,padding:'0 4px'}}>
          {badgeCount}
        </span>
      )}
    </NavLink>
  );
}

export default function AppLayout({ children }) {
  const { userProfile, currentUser, effectiveUid, logout } = useAuth();
  const { session, markWebSignedOut } = useLibrarySession();
  const { dark, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed,      setCollapsed]      = useState(() => localStorage.getItem('neu-sidebar-collapsed') === 'true');
  const [mobileOpen,     setMobileOpen]     = useState(false);
  const [showSignOut,    setShowSignOut]     = useState(false);
  const [signingOut,     setSigningOut]      = useState(false);
  const [pendingBorrows, setPendingBorrows] = useState(0);

  const role     = userProfile?.role || 'student';
  const navItems = NAV[role] || NAV.student;
  const roleLabel = role === 'admin' ? 'Administrator' : role === 'staff' ? 'Library Staff' : 'Student';
  const displayName = userProfile ? `${userProfile.lastName}, ${userProfile.firstName}` : '—';

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (role !== 'staff' && role !== 'admin') return;
    return onSnapshot(query(collection(db,'borrows'),where('status','==','pending')), s => setPendingBorrows(s.size));
  }, [role]);

  const handleLogout = async () => { if (session) { setShowSignOut(true); return; } await performLogout(); };
  const performLogout = async () => {
    setSigningOut(true);
    try { await logout(); navigate('/login',{replace:true}); } finally { setSigningOut(false); setShowSignOut(false); }
  };
  const handleCheckOutAndSignOut = async () => { setSigningOut(true); await markWebSignedOut(); await performLogout(); };

  const SIDEBAR_W = collapsed ? 60 : 224;

  const sidebar = (mob = false) => (
    <div style={{width:mob?256:SIDEBAR_W,height:'100%',background:'var(--card)',borderRight:'1px solid var(--divider)',display:'flex',flexDirection:'column',transition:'width 0.2s ease',overflow:'hidden',flexShrink:0}}>
      {/* Header */}
      <div style={{padding:'14px 12px',borderBottom:'1px solid var(--divider)',display:'flex',alignItems:'center',justifyContent:collapsed&&!mob?'center':'space-between',gap:8,minHeight:60}}>
        {(!collapsed||mob) && (
          <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0}}>
            <div style={{width:32,height:32,borderRadius:8,background:'var(--gold-soft)',border:'1px solid var(--gold-border)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <img src="/neu-logo.png" alt="NEU" style={{width:20,height:20,objectFit:'contain'}} onError={e=>{e.currentTarget.style.display='none';}} />
            </div>
            <div style={{minWidth:0}}>
              <p style={{...PP,fontSize:11,fontWeight:700,color:'var(--gold)',whiteSpace:'nowrap',lineHeight:1.2}}>NEU Library</p>
              <p style={{...PP,fontSize:10,color:'var(--text-muted)',whiteSpace:'nowrap',lineHeight:1.3}}>Management System</p>
            </div>
          </div>
        )}
        {collapsed&&!mob && (
          <div style={{width:32,height:32,borderRadius:8,background:'var(--gold-soft)',border:'1px solid var(--gold-border)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <img src="/neu-logo.png" alt="NEU" style={{width:20,height:20,objectFit:'contain'}} onError={e=>{e.currentTarget.style.display='none';}} />
          </div>
        )}
        {!mob && (
          <button onClick={()=>setCollapsed(c=>{ const next=!c; localStorage.setItem('neu-sidebar-collapsed',String(next)); return next; })} style={{background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:7,width:26,height:26,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--text-muted)',flexShrink:0,transition:'all 0.15s'}}>
            {collapsed ? Ico.chRight : Ico.chLeft}
          </button>
        )}
        {mob && (
          <button onClick={()=>setMobileOpen(false)} style={{background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:7,width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--text-muted)'}}>
            {Ico.close}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{flex:1,padding:'8px 8px',display:'flex',flexDirection:'column',gap:2,overflowY:'auto'}}>
        {(!collapsed||mob) && <p style={{...PP,fontSize:10,fontWeight:600,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.08em',padding:'6px 12px 4px'}}>Navigation</p>}
        {navItems.map(item => (
          <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon}
            collapsed={collapsed&&!mob} badgeCount={item.to==='/borrows'?pendingBorrows:0}
            onClick={mob?()=>setMobileOpen(false):undefined} />
        ))}
      </nav>

      {/* User */}
      <div style={{padding:'8px 8px',borderTop:'1px solid var(--divider)'}}>
        {(!collapsed||mob) && (
          <div style={{background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:10,padding:'10px 12px',marginBottom:8}}>
            <p style={{...PP,fontSize:10,fontWeight:600,color:'var(--gold)',marginBottom:2}}>{roleLabel}</p>
            <p style={{...PP,fontSize:13,fontWeight:600,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{displayName}</p>
            <p style={{...MN,fontSize:11,color:'var(--text-muted)',marginTop:1}}>{userProfile?.idNumber||'—'}</p>
          </div>
        )}
        <button onClick={toggleTheme} title={dark ? 'Light Mode' : 'Dark Mode'}
          style={{width:'100%',padding:collapsed&&!mob?10:'9px 12px',borderRadius:10,background:'var(--surface)',border:'1px solid var(--card-border)',color:'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,transition:'all 0.15s',marginBottom:6}}>
          {dark ? Ico.sun : Ico.moon}
          {(!collapsed||mob) && <span style={{...PP,fontSize:13,fontWeight:500}}>{dark ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        <button onClick={handleLogout} disabled={signingOut}
          style={{width:'100%',padding:collapsed&&!mob?10:'9px 12px',borderRadius:10,background:'var(--red-soft)',border:'1px solid var(--red-border)',color:'var(--red)',cursor:signingOut?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,transition:'all 0.15s',opacity:signingOut?0.6:1}}>
          {Ico.signout}
          {(!collapsed||mob) && <span style={{...PP,fontSize:13,fontWeight:600}}>{signingOut?'Signing Out...':'Sign Out'}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'var(--bg-base)'}}>
      <div className="hidden md:flex" style={{position:'sticky',top:0,height:'100vh',flexShrink:0}}>{sidebar(false)}</div>

      {mobileOpen && (
        <>
          <div onClick={()=>setMobileOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:40,backdropFilter:'blur(2px)'}} />
          <div style={{position:'fixed',top:0,left:0,height:'100%',zIndex:50,animation:'slideInLeft 0.2s ease'}}>{sidebar(true)}</div>
        </>
      )}

      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0}}>
        {/* Mobile topbar */}
        <div className="flex md:hidden" style={{background:'var(--card)',borderBottom:'1px solid var(--divider)',padding:'12px 16px',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:30}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:30,height:30,borderRadius:7,background:'var(--gold-soft)',border:'1px solid var(--gold-border)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <img src="/neu-logo.png" alt="NEU" style={{width:18,height:18,objectFit:'contain'}} onError={e=>{e.currentTarget.style.display='none';}} />
            </div>
            <div>
              <p style={{...PP,fontSize:13,fontWeight:700,color:'var(--text-primary)',lineHeight:1.2}}>NEU Library</p>
              <p style={{...PP,fontSize:11,color:'var(--text-muted)',lineHeight:1.2}}>Management System</p>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button onClick={toggleTheme} title={dark ? 'Light Mode' : 'Dark Mode'} style={{background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:8,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--text-muted)'}}>
              {dark ? Ico.sun : Ico.moon}
            </button>
            <button onClick={()=>setMobileOpen(true)} style={{background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:8,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--text-body)'}}>
              {Ico.menu}
            </button>
          </div>
        </div>

        {role==='student' && (currentUser?.uid||effectiveUid) && (
          <NotificationBanner userId={effectiveUid||currentUser?.uid} />
        )}

        <main style={{flex:1,padding:'clamp(16px,4vw,28px) clamp(14px,4vw,24px)',maxWidth:1280,width:'100%',margin:'0 auto'}}>
          {children}
        </main>
      </div>

      {showSignOut && (
        <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',padding:16}}>
          <div style={{width:'100%',maxWidth:420,background:'var(--card)',border:'1px solid var(--card-border)',borderRadius:18,overflow:'hidden',boxShadow:'var(--shadow-modal)'}}>
            <div style={{height:3,background:'linear-gradient(90deg,#c0392b 0%,#c0392b 25%,#f39c12 25%,#f39c12 50%,#27ae60 50%,#27ae60 75%,#2980b9 75%,#2980b9 100%)'}} />
            <div style={{padding:28}}>
              <p style={{...PP,fontSize:12,fontWeight:600,color:'var(--gold)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Active Library Session</p>
              <p style={{...SR,fontSize:20,fontWeight:700,color:'var(--text-primary)',marginBottom:10}}>You are still checked in</p>
              <p style={{...PP,fontSize:14,color:'var(--text-muted)',marginBottom:24,lineHeight:1.6}}>Signing out will mark your session as web-signed-out but keep your library visit logged.</p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <button onClick={handleCheckOutAndSignOut} disabled={signingOut}
                  style={{padding:13,borderRadius:10,background:'var(--red-soft)',border:'1px solid var(--red-border)',color:'var(--red)',cursor:'pointer',...PP,fontSize:14,fontWeight:600,transition:'all 0.15s'}}>
                  {signingOut?'Signing out...':'Sign Out Anyway'}
                </button>
                <button onClick={()=>setShowSignOut(false)}
                  style={{padding:13,borderRadius:10,background:'var(--surface)',border:'1px solid var(--card-border)',color:'var(--text-muted)',cursor:'pointer',...PP,fontSize:14,fontWeight:500,transition:'all 0.15s'}}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInLeft{from{transform:translateX(-100%)}to{transform:translateX(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  );
}
