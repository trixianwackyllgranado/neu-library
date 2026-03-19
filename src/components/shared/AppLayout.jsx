// src/components/shared/AppLayout.jsx
import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLibrarySession } from '../../context/LibrarySessionContext';
import { useTheme } from '../../context/ThemeContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import FloatingTutorial from './FloatingTutorial';
import { useTutorial } from '../../context/TutorialContext';

const PP = { fontFamily: "'Poppins', sans-serif" };
const SR = { fontFamily: "'Playfair Display', serif" };
const MN = { fontFamily: "'IBM Plex Mono', monospace" };

const Ico = {
  dashboard:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  logger:       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>,
  users:        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>,
  reports:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  editRequests: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  kiosk:        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3"/><path d="M17 17v4"/><path d="M21 14v3h-4"/></svg>,
  menu:         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  close:        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  signout:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  chLeft:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  chRight:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  sun:          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  moon:         <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  swap:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
};

// ── Role Switcher (Prime Admin only) ─────────────────────────────────────────
function RoleSwitcher({ collapsed, mob }) {
  const { canSwitchRole, effectiveRole, switchRole, userProfile } = useAuth();
  if (!canSwitchRole) return null;

  const isViewingAsUser = effectiveRole === 'visitor';

  return (
    <div style={{
      padding: collapsed && !mob ? '4px 4px' : '6px 8px',
      marginBottom: 4,
    }}>
      <button
        onClick={() => switchRole(isViewingAsUser ? 'admin' : 'visitor')}
        title={isViewingAsUser ? 'Switch back to Admin view' : 'Switch to User view'}
        style={{
          width: '100%',
          padding: collapsed && !mob ? '8px 0' : '8px 12px',
          borderRadius: 8,
          background: isViewingAsUser ? 'rgba(59,130,246,0.12)' : 'var(--gold-soft)',
          border: `1px solid ${isViewingAsUser ? 'rgba(59,130,246,0.3)' : 'var(--gold-border)'}`,
          color: isViewingAsUser ? '#60a5fa' : 'var(--gold)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed && !mob ? 'center' : 'flex-start',
          gap: 8,
          transition: 'all 0.2s',
          ...MN,
          fontSize: 10,
          letterSpacing: '0.08em',
          fontWeight: 600,
          textTransform: 'uppercase',
        }}
      >
        {Ico.swap}
        {(!collapsed || mob) && (
          <span>{isViewingAsUser ? 'Back to Admin' : 'View as User'}</span>
        )}
      </button>
      {isViewingAsUser && (!collapsed || mob) && (
        <p style={{
          ...MN, fontSize: 9, color: '#60a5fa', textAlign: 'center',
          marginTop: 4, letterSpacing: '0.06em', opacity: 0.8,
        }}>
          Viewing as regular user
        </p>
      )}
    </div>
  );
}

function NavItem({ to, label, icon, collapsed, onClick, badge }) {
  return (
    <NavLink to={to} onClick={onClick}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 10,
        padding: collapsed ? '10px 0' : '10px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 10, textDecoration: 'none', transition: 'all 0.15s',
        background: isActive ? 'var(--gold-soft)' : 'transparent',
        border: isActive ? '1px solid var(--gold-border)' : '1px solid transparent',
        color: isActive ? 'var(--gold)' : 'var(--text-muted)',
        position: 'relative',
      })}>
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', position: 'relative' }}>
        {icon}
        {badge > 0 && collapsed && (
          <span style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', border: '1.5px solid var(--card)' }} />
        )}
      </span>
      {!collapsed && <span style={{ ...PP, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', flex: 1 }}>{label}</span>}
      {!collapsed && badge > 0 && (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: 'var(--red-soft)', border: '1px solid var(--red-border)', color: 'var(--red)', ...MN }}>
          {badge}
        </span>
      )}
    </NavLink>
  );
}

// ── Map pathname to tutorial page key ────────────────────────────────────────
function getPageKey(pathname) {
  const map = {
    '/dashboard':            'dashboard',
    '/logger':               'logger',
    '/staff/kiosk':          'staff/kiosk',
    '/admin/users':          'admin/users',
    '/admin/edit-requests':  'admin/edit-requests',
    '/admin/reports':        'admin/reports',
    '/catalog':              'catalog',
    '/borrowing':            'borrowing',
    '/staff/qr-logger':     'qr-logger',
    '/staff/records':        'student-records',
  };
  return map[pathname] || null;
}

export default function AppLayout({ children }) {
  const { userProfile, logout, effectiveRole, canSwitchRole } = useAuth();
  const { session, markWebSignedOut } = useLibrarySession();
  const { dark, toggle: toggleTheme } = useTheme();
  const { hasTutorialAccess, tutorialEnabled, toggleTutorial } = useTutorial();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [collapsed,          setCollapsed]          = useState(() => localStorage.getItem('neu-sidebar-collapsed') === 'true');
  const [mobileOpen,         setMobileOpen]         = useState(false);
  const [showSignOut,        setShowSignOut]        = useState(false);
  const [signingOut,         setSigningOut]         = useState(false);
  const [pendingEditCount,   setPendingEditCount]   = useState(0);

  // Use effectiveRole for nav rendering (supports prime admin role switching)
  const role      = effectiveRole || userProfile?.role || 'visitor';
  const realRole  = userProfile?.role || 'visitor';
  const roleLabel = role === 'admin' ? 'Administrator' : role === 'staff' ? 'Library Staff'
    : userProfile?.visitorType === 'faculty' ? 'Faculty' : 'Student';
  const displayName = userProfile ? `${userProfile.lastName}, ${userProfile.firstName}` : '—';

  // Live pending edit requests count — admin only
  useEffect(() => {
    if (realRole !== 'admin') return;
    const unsub = onSnapshot(
      query(collection(db, 'editRequests'), where('status', '==', 'pending')),
      s => setPendingEditCount(s.size),
      () => {}
    );
    return unsub;
  }, [realRole]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    if (session) { setShowSignOut(true); return; }
    await performLogout();
  };
  const performLogout = async () => {
    setSigningOut(true);
    try { await logout(); navigate('/login', { replace: true }); }
    finally { setSigningOut(false); setShowSignOut(false); }
  };
  const handleCheckOutAndSignOut = async () => {
    setSigningOut(true);
    await markWebSignedOut();
    await performLogout();
  };

  const NAV = {
    visitor: [],
    staff: [
      { to: '/dashboard',   label: 'Dashboard',      icon: Ico.dashboard },
      { to: '/logger',      label: 'Library Logger', icon: Ico.logger    },
      { to: '/staff/kiosk', label: 'Visitor Kiosk',  icon: Ico.kiosk     },
    ],
    admin: [
      { to: '/dashboard',             label: 'Dashboard',      icon: Ico.dashboard,    badge: 0 },
      { to: '/logger',                label: 'Library Logger', icon: Ico.logger,       badge: 0 },
      { to: '/staff/kiosk',           label: 'Visitor Kiosk',  icon: Ico.kiosk,        badge: 0 },
      { to: '/admin/users',           label: 'User Management',icon: Ico.users,        badge: 0 },
      { to: '/admin/edit-requests',   label: 'Edit Requests',  icon: Ico.editRequests, badge: pendingEditCount },
      { to: '/admin/reports',         label: 'Reports',        icon: Ico.reports,      badge: 0 },
    ],
  };

  const navItems = NAV[role] || [];
  const SIDEBAR_W = collapsed ? 60 : 224;

  // Determine tutorial page key
  const tutorialPageKey = getPageKey(location.pathname);

  const sidebar = (mob = false) => (
    <div style={{ width: mob ? 256 : SIDEBAR_W, height: '100%', background: 'var(--card)', borderRight: '1px solid var(--divider)', display: 'flex', flexDirection: 'column', transition: 'width 0.2s ease', overflow: 'hidden', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ padding: '14px 12px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', justifyContent: collapsed && !mob ? 'center' : 'space-between', gap: 8, minHeight: 60 }}>
        {(!collapsed || mob) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
              <img src="/liblogo.png" alt="NEU" style={{ width: 30, height: 30, objectFit: 'cover', borderRadius: '50%' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ ...PP, fontSize: 11, fontWeight: 700, color: 'var(--gold)', whiteSpace: 'nowrap', lineHeight: 1.2 }}>NEU Library</p>
              <p style={{ ...PP, fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', lineHeight: 1.3 }}>Visitor Log</p>
            </div>
          </div>
        )}
        {collapsed && !mob && (
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/liblogo.png" alt="NEU" style={{ width: 30, height: 30, objectFit: 'cover', borderRadius: '50%' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
          </div>
        )}
        {!mob && (
          <button onClick={() => setCollapsed(c => { const next = !c; localStorage.setItem('neu-sidebar-collapsed', String(next)); return next; })}
            style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 7, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
            {collapsed ? Ico.chRight : Ico.chLeft}
          </button>
        )}
        {mob && (
          <button onClick={() => setMobileOpen(false)}
            style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 7, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}>
            {Ico.close}
          </button>
        )}
      </div>

      {/* Role Switcher — Prime Admin only */}
      <RoleSwitcher collapsed={collapsed} mob={mob} />

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {navItems.length > 0 && (!collapsed || mob) && (
          <p style={{ ...PP, fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 12px 4px' }}>Navigation</p>
        )}
        {navItems.map(item => (
          <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon}
            collapsed={collapsed && !mob}
            badge={item.badge || 0}
            onClick={mob ? () => setMobileOpen(false) : undefined} />
        ))}
      </nav>

      {/* User section */}
      <div style={{ padding: '8px 8px', borderTop: '1px solid var(--divider)' }}>
        {(!collapsed || mob) && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <p style={{ ...PP, fontSize: 10, fontWeight: 600, color: 'var(--gold)', flex: 1 }}>{roleLabel}</p>
              {canSwitchRole && effectiveRole !== realRole && (
                <span style={{
                  ...MN, fontSize: 8, padding: '1px 6px', borderRadius: 6,
                  background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)',
                  color: '#60a5fa', letterSpacing: '0.06em',
                }}>VIEWING AS</span>
              )}
            </div>
            <p style={{ ...PP, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
            {userProfile?.idNumber && <p style={{ ...MN, fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{userProfile.idNumber}</p>}
          </div>
        )}
        {/* Tutorial toggle — prime admins only */}
        {hasTutorialAccess && (!collapsed || mob) && (
          <button onClick={toggleTutorial}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 10, background: tutorialEnabled ? 'var(--gold-soft)' : 'var(--surface)', border: `1px solid ${tutorialEnabled ? 'var(--gold-border)' : 'var(--card-border)'}`, color: tutorialEnabled ? 'var(--gold)' : 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s', marginBottom: 6 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span style={{ ...PP, fontSize: 12, fontWeight: 500 }}>{tutorialEnabled ? 'Guides: ON' : 'Guides: OFF'}</span>
          </button>
        )}
        {hasTutorialAccess && collapsed && !mob && (
          <button onClick={toggleTutorial} title={tutorialEnabled ? 'Page guides: ON' : 'Page guides: OFF'}
            style={{ width: '100%', padding: 10, borderRadius: 10, background: tutorialEnabled ? 'var(--gold-soft)' : 'var(--surface)', border: `1px solid ${tutorialEnabled ? 'var(--gold-border)' : 'var(--card-border)'}`, color: tutorialEnabled ? 'var(--gold)' : 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', marginBottom: 6 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </button>
        )}
        <button onClick={toggleTheme}
          style={{ width: '100%', padding: collapsed && !mob ? 10 : '9px 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s', marginBottom: 6 }}>
          {dark ? Ico.sun : Ico.moon}
          {(!collapsed || mob) && <span style={{ ...PP, fontSize: 13, fontWeight: 500 }}>{dark ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        <button onClick={handleLogout} disabled={signingOut}
          style={{ width: '100%', padding: collapsed && !mob ? 10 : '9px 12px', borderRadius: 10, background: 'var(--red-soft)', border: '1px solid var(--red-border)', color: 'var(--red)', cursor: signingOut ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s', opacity: signingOut ? 0.6 : 1 }}>
          {Ico.signout}
          {(!collapsed || mob) && <span style={{ ...PP, fontSize: 13, fontWeight: 600 }}>{signingOut ? 'Signing Out...' : 'Sign Out'}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <div className="hidden md:flex" style={{ position: 'sticky', top: 0, height: '100vh', flexShrink: 0 }}>{sidebar(false)}</div>

      {mobileOpen && (
        <>
          <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40, backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'fixed', top: 0, left: 0, height: '100%', zIndex: 50, animation: 'slideInLeft 0.2s ease' }}>{sidebar(true)}</div>
        </>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Mobile topbar */}
        <div className="flex md:hidden" style={{ background: 'var(--card)', borderBottom: '1px solid var(--divider)', padding: '12px 16px', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <img src="/liblogo.png" alt="NEU" style={{ width: 26, height: 26, objectFit: 'cover', borderRadius: '50%' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
            </div>
            <p style={{ ...PP, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>NEU Library Visitor Log</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={toggleTheme} style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 8, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}>
              {dark ? Ico.sun : Ico.moon}
            </button>
            {navItems.length > 0 && (
              <button onClick={() => setMobileOpen(true)} style={{ position: 'relative', background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 8, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-body)' }}>
                {Ico.menu}
                {pendingEditCount > 0 && (
                  <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', border: '1.5px solid var(--card)' }} />
                )}
              </button>
            )}
          </div>
        </div>

        <main style={{ flex: 1, padding: 'clamp(16px,4vw,28px) clamp(14px,4vw,24px)', maxWidth: 1280, width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>

      {/* Floating Tutorial */}
      {tutorialPageKey && <FloatingTutorial pageKey={tutorialPageKey} />}

      {/* Sign-out confirmation */}
      {showSignOut && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 420, background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-modal)' }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg,#c0392b 0%,#c0392b 25%,#f39c12 25%,#f39c12 50%,#27ae60 50%,#27ae60 75%,#2980b9 75%,#2980b9 100%)' }} />
            <div style={{ padding: 28 }}>
              <p style={{ ...PP, fontSize: 12, fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Active Library Session</p>
              <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>You are still checked in</p>
              <p style={{ ...PP, fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>Signing out will keep your library visit logged.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={handleCheckOutAndSignOut} disabled={signingOut}
                  style={{ padding: 13, borderRadius: 10, background: 'var(--red-soft)', border: '1px solid var(--red-border)', color: 'var(--red)', cursor: 'pointer', ...PP, fontSize: 14, fontWeight: 600 }}>
                  {signingOut ? 'Signing out...' : 'Sign Out Anyway'}
                </button>
                <button onClick={() => setShowSignOut(false)}
                  style={{ padding: 13, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', cursor: 'pointer', ...PP, fontSize: 14 }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInLeft { from { transform: translateX(-100%) } to { transform: translateX(0) } }
        @keyframes fadeUp      { from { opacity:0; transform: translateY(8px) } to { opacity:1; transform: translateY(0) } }
      `}</style>
    </div>
  );
}
