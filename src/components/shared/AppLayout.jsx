// src/components/shared/AppLayout.jsx
import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLibrarySession } from '../../context/LibrarySessionContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import NotificationBanner from './NotificationBanner';

const S = { fontFamily: "'IBM Plex Mono', monospace" };
const D = { fontFamily: "'Playfair Display', serif" };

const NAV = {
  student: [
    { to: '/dashboard', label: 'Dashboard',    icon: '⊞' },
    { to: '/catalog',   label: 'Book Catalog', icon: '⊟' },
    { to: '/borrows',   label: 'My Borrows',   icon: '⊠' },
    { to: '/logger',    label: 'Library Log',  icon: '⊡' },
  ],
  staff: [
    { to: '/dashboard',       label: 'Dashboard',       icon: '⊞' },
    { to: '/catalog',         label: 'Book Catalog',    icon: '⊟' },
    { to: '/borrows',         label: 'Borrowing',       icon: '⊠' },
    { to: '/logger',          label: 'Library Logger',  icon: '⊡' },
    { to: '/staff/students',  label: 'Student Records', icon: '⊢' },
    { to: '/staff/qr-logger', label: 'QR Scanner',      icon: '⊣' },
  ],
  admin: [
    { to: '/dashboard',       label: 'Dashboard',       icon: '⊞' },
    { to: '/catalog',         label: 'Book Catalog',    icon: '⊟' },
    { to: '/borrows',         label: 'Borrowing',       icon: '⊠' },
    { to: '/logger',          label: 'Library Logger',  icon: '⊡' },
    { to: '/staff/students',  label: 'Student Records', icon: '⊢' },
    { to: '/staff/qr-logger', label: 'QR Scanner',      icon: '⊣' },
    { to: '/admin/users',     label: 'User Management', icon: '⊤' },
    { to: '/admin/reports',   label: 'Reports',         icon: '⊥' },
  ],
};

function NavItem({ to, label, icon, collapsed, onClick }) {
  return (
    <NavLink to={to} onClick={onClick}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: collapsed ? 0 : '12px',
        padding: collapsed ? '12px' : '10px 14px',
        borderRadius: '10px', textDecoration: 'none', transition: 'all 0.15s',
        justifyContent: collapsed ? 'center' : 'flex-start',
        background: isActive ? 'rgba(245,158,11,0.12)' : 'transparent',
        border: isActive ? '1px solid rgba(245,158,11,0.25)' : '1px solid transparent',
        color: isActive ? '#f59e0b' : '#64748b',
      })}>
      <span style={{ fontSize: '15px', lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      {!collapsed && (
        <span style={{ ...S, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {label}
        </span>
      )}
    </NavLink>
  );
}

export default function AppLayout({ children }) {
  const { userProfile, currentUser, effectiveUid, logout } = useAuth();
  const { session, markWebSignedOut } = useLibrarySession();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed,     setCollapsed]     = useState(false);
  const [mobileOpen,    setMobileOpen]    = useState(false);
  const [showSignOut,   setShowSignOut]   = useState(false);
  const [signingOut,    setSigningOut]    = useState(false);
  const [pendingBorrows, setPendingBorrows] = useState(0);

  const role    = userProfile?.role || 'student';
  const navItems = NAV[role] || NAV.student;

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Live pending borrows count for staff badge
  useEffect(() => {
    if (role !== 'staff' && role !== 'admin') return;
    const unsub = onSnapshot(
      query(collection(db, 'borrows'), where('status', '==', 'pending')),
      snap => setPendingBorrows(snap.size),
    );
    return unsub;
  }, [role]);

  const handleLogout = async () => {
    if (session) {
      setShowSignOut(true);
      return;
    }
    await performLogout();
  };

  const performLogout = async () => {
    setSigningOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
      setShowSignOut(false);
    }
  };

  const handleCheckOutAndSignOut = async () => {
    setSigningOut(true);
    try {
      const { checkOut } = await import('../../context/LibrarySessionContext');
    } catch {}
    // Mark web signed out (session stays active in logger)
    await markWebSignedOut();
    await performLogout();
  };

  const displayName = userProfile
    ? `${userProfile.lastName}, ${userProfile.firstName}`
    : '—';

  const SIDEBAR_W  = collapsed ? 64 : 220;
  const SIDEBAR_WM = 260; // mobile drawer width

  const sidebarContent = (isMobile = false) => (
    <div style={{
      width: isMobile ? SIDEBAR_WM : SIDEBAR_W,
      height: '100%',
      background: 'var(--navy-800)',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.2s ease',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: '16px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: collapsed && !isMobile ? 'center' : 'space-between' }}>
        {(!collapsed || isMobile) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: '7px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <img src="/favicon.svg" alt="NEU" style={{ width: 18, height: 18 }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ ...S, fontSize: '7px', letterSpacing: '0.2em', color: '#f59e0b', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>New Era University</p>
              <p style={{ ...D, fontSize: '11px', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2, whiteSpace: 'nowrap' }}>Library System</p>
            </div>
          </div>
        )}
        {!isMobile && (
          <button onClick={() => setCollapsed(c => !c)}
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '7px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8', fontSize: '12px', flexShrink: 0 }}>
            {collapsed ? '›' : '‹'}
          </button>
        )}
        {isMobile && (
          <button onClick={() => setMobileOpen(false)}
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '7px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8', fontSize: '14px' }}>
            ✕
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
        {navItems.map(item => (
          <div key={item.to} style={{ position: 'relative' }}>
            <NavItem to={item.to} label={item.label} icon={item.icon} collapsed={collapsed && !isMobile} />
            {/* Pending badge on Borrowing */}
            {item.to === '/borrows' && pendingBorrows > 0 && (
              <span style={{
                position: 'absolute', top: 6, right: collapsed && !isMobile ? 4 : 8,
                ...S, fontSize: '8px', fontWeight: 700, padding: '1px 6px', borderRadius: '20px',
                background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b',
              }}>
                {pendingBorrows}
              </span>
            )}
          </div>
        ))}
      </nav>

      {/* User profile + sign out */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {(!collapsed || isMobile) && (
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 12px', marginBottom: '8px' }}>
            <p style={{ ...S, fontSize: '8px', letterSpacing: '0.14em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '3px' }}>{role}</p>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
            <p style={{ ...S, fontSize: '10px', color: '#94a3b8' }}>{userProfile?.idNumber || '—'}</p>
          </div>
        )}
        <button onClick={handleLogout} disabled={signingOut}
          style={{
            width: '100%', padding: collapsed && !isMobile ? '10px' : '9px 12px',
            borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
            color: '#f87171', cursor: signingOut ? 'not-allowed' : 'pointer', ...S,
            fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s',
          }}>
          {!collapsed || isMobile ? (signingOut ? 'Signing Out…' : 'Sign Out') : '⏻'}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--navy-900)' }}>
      {/* Desktop sidebar */}
      <div className="hidden md:flex" style={{ position: 'sticky', top: 0, height: '100vh', flexShrink: 0 }}>
        {sidebarContent(false)}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 40 }}
          />
          <div style={{ position: 'fixed', top: 0, left: 0, height: '100%', zIndex: 50 }}>
            {sidebarContent(true)}
          </div>
        </>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Mobile top bar */}
        <div className="flex md:hidden" style={{ background: '#0a1730', borderBottom: '1px solid rgba(255,255,255,0.09)', padding: '12px 16px', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/favicon.svg" alt="NEU" style={{ width: 26, height: 26 }} />
            <div>
              <p style={{ ...S, fontSize: '7px', letterSpacing: '0.18em', color: '#f59e0b', textTransform: 'uppercase' }}>New Era University</p>
              <p style={{ ...D, fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>Library System</p>
            </div>
          </div>
          <button onClick={() => setMobileOpen(true)}
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#cbd5e1', fontSize: '18px' }}>
            ☰
          </button>
        </div>

        {/* Notification banner (students) */}
        {role === 'student' && effectiveUid && (
          <NotificationBanner userId={effectiveUid} />
        )}

        {/* Page content */}
        <main style={{ flex: 1, padding: 'clamp(16px, 4vw, 28px) clamp(14px, 4vw, 24px)', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>

      {/* Sign-out while checked-in modal */}
      {showSignOut && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '400px', background: 'var(--navy-800)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ height: '3px', background: 'linear-gradient(90deg, #c0392b 0%, #c0392b 25%, #f39c12 25%, #f39c12 50%, #27ae60 50%, #27ae60 75%, #2980b9 75%, #2980b9 100%)' }} />
            <div style={{ padding: '24px' }}>
              <p style={{ ...S, fontSize: '9px', letterSpacing: '0.18em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '6px' }}>Active Library Session</p>
              <p style={{ ...D, fontSize: '18px', fontWeight: 700, color: '#f1f5f9', marginBottom: '12px' }}>You are still checked in</p>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
                You have an active library session. What would you like to do?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={handleCheckOutAndSignOut} disabled={signingOut}
                  style={{ padding: '11px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171', cursor: 'pointer', ...S, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
                  Sign Out (mark as web signed out — stay logged in library)
                </button>
                <button onClick={() => setShowSignOut(false)}
                  style={{ padding: '11px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b', cursor: 'pointer', ...S, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
