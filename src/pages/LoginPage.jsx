// src/pages/LoginPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

import { WarningIcon, ErrorIcon } from '../components/shared/AnimatedIcons';

const MONO  = { fontFamily: "'IBM Plex Mono', monospace" };
const SERIF = { fontFamily: "'Playfair Display', serif" };
const PP    = { fontFamily: "'Poppins', sans-serif" };

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function Modal({ title, message, onClose, variant = 'error', actionLabel = 'OK', secondaryLabel, onSecondary }) {
  const accent       = variant === 'warn' ? 'var(--gold)' : 'var(--red)';
  const accentSoft   = variant === 'warn' ? 'var(--gold-soft)' : 'var(--red-soft)';
  const accentBorder = variant === 'warn' ? 'var(--gold-border)' : 'var(--red-border)';
  const Icon = variant === 'warn' ? WarningIcon : ErrorIcon;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.72)', backdropFilter:'blur(6px)', padding:16, animation:'modalFadeIn 0.2s ease both' }}>
      <div style={{ width:'100%', maxWidth:400, background:'var(--card)', border:'1px solid var(--card-border)', borderRadius:20, overflow:'hidden', boxShadow:'var(--shadow-modal)', animation:'modalSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        <div style={{ height:3, background:`linear-gradient(90deg, ${accent}, transparent)` }} />
        <div style={{ padding:'32px 28px 28px', textAlign:'center' }}>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
            <Icon size={60} />
          </div>
          <h2 style={{ ...SERIF, fontSize:22, fontWeight:700, color:'var(--text-primary)', marginBottom:10, lineHeight:1.25 }}>{title}</h2>
          <p style={{ ...PP, fontSize:14, color:'var(--text-muted)', lineHeight:1.7, marginBottom:24 }}>{message}</p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <button onClick={onClose}
              style={{ width:'100%', padding:'13px', borderRadius:12, background:accentSoft, border:`1px solid ${accentBorder}`, color:accent, cursor:'pointer', ...MONO, fontSize:'11px', letterSpacing:'0.14em', textTransform:'uppercase', fontWeight:700, transition:'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.opacity='0.85'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity='1'; }}>
              {actionLabel}
            </button>
            {secondaryLabel && (
              <button onClick={onSecondary}
                style={{ width:'100%', padding:'12px', borderRadius:12, background:'var(--surface)', border:'1px solid var(--card-border)', color:'var(--text-muted)', cursor:'pointer', ...MONO, fontSize:'11px', letterSpacing:'0.14em', textTransform:'uppercase', transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background='var(--surface-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background='var(--surface)'; }}>
                {secondaryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes modalFadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes modalSlideUp { from{opacity:0;transform:translateY(20px) scale(0.96)} to{opacity:1;transform:none} }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();

  const [loading, setLoading] = useState(false);
  const [modal,   setModal]   = useState(null);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err.code === 'not-registered') {
        // Valid NEU email but no account yet — show modal then go to register
        setModal({
          title:       'Not Registered Yet',
          message:     'Your Google account was found but you haven\'t registered in the visitor log yet. Please fill up the registration form first.',
          variant:     'warn',
          actionLabel: 'Register Now',
          onClose:     () => { setModal(null); navigate('/register'); },
        });
      } else if (err.code === 'non-neu-email') {
        setModal({
          title:   'Institutional Email Required',
          message: 'Only @neu.edu.ph Google accounts are accepted. Please sign in with your NEU email address.',
          variant: 'error',
          onClose: () => setModal(null),
        });
      } else if (
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request'
      ) {
        // Silently ignore — user chose to close the popup
      } else {
        setModal({
          title:   'Sign-In Failed',
          message: err.message || 'An unexpected error occurred. Please try again.',
          variant: 'error',
          onClose: () => setModal(null),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, var(--bg-base) 0%, var(--bg-mid) 55%, var(--bg-top) 100%)',
      display: 'flex', flexDirection: 'column', transition: 'background 0.25s',
    }}>
      {/* NEU colour stripe */}
      <div style={{ height:'3px', background:'linear-gradient(90deg,#c0392b 0%,#c0392b 25%,#e67e22 25%,#e67e22 50%,#27ae60 50%,#27ae60 75%,#2980b9 75%,#2980b9 100%)', flexShrink:0 }} />

      {/* Header */}
      <div style={{ padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid var(--divider)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <img src="/liblogo.png" alt="NEU" style={{ width:38, height:38, objectFit:'cover', borderRadius:'50%' }} onError={e=>{e.currentTarget.style.display='none';}} />
          <div>
            <p style={{ ...MONO, fontSize:'8px', letterSpacing:'0.24em', color:'var(--gold)', textTransform:'uppercase', marginBottom:2 }}>New Era University</p>
            <p style={{ ...SERIF, fontSize:'14px', fontWeight:700, color:'var(--text-primary)', lineHeight:1.2 }}>Library Visitor Log</p>
          </div>
        </div>
        <button onClick={toggle} title={dark ? 'Light Mode' : 'Dark Mode'}
          style={{ width:36, height:36, borderRadius:8, border:'1px solid var(--card-border)', background:'var(--surface)', color:'var(--gold)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {dark
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          }
        </button>
      </div>

      {/* Main */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 16px' }}>
        <div style={{ width:'100%', maxWidth:400, animation:'fadeUp 0.35s ease both' }}>

          {/* Card */}
          <div style={{ background:'var(--card)', border:'1px solid var(--card-border)', borderRadius:20, overflow:'hidden', boxShadow:'var(--shadow-modal)', marginBottom:16 }}>
            <div style={{ height:3, background:'linear-gradient(90deg, var(--gold), transparent)' }} />
            <div style={{ padding:'40px 32px' }}>

              {/* Logo + title */}
              <div style={{ textAlign:'center', marginBottom:28 }}>
                <div style={{ width:72, height:72, borderRadius:'50%', background:'var(--gold-soft)', border:'2px solid var(--gold-border)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', overflow:'hidden' }}>
                  <img src="/liblogo.png" alt="NEU" style={{ width:64, height:64, objectFit:'cover', borderRadius:'50%' }} onError={e=>{e.currentTarget.style.display='none';}} />
                </div>
                <p style={{ ...MONO, fontSize:'9px', letterSpacing:'0.24em', color:'var(--gold)', textTransform:'uppercase', marginBottom:6 }}>Welcome to</p>
                <h1 style={{ ...SERIF, fontSize:26, fontWeight:700, color:'var(--text-primary)', lineHeight:1.2, marginBottom:8 }}>NEU Library</h1>
                <p style={{ ...PP, fontSize:14, color:'var(--text-muted)', lineHeight:1.6 }}>Sign in with your NEU Google account to log your visit</p>
              </div>

              {/* Google button */}
              <button
                onClick={handleGoogle}
                disabled={loading}
                style={{
                  width:'100%', padding:'14px 20px', borderRadius:12,
                  background: loading ? 'var(--surface)' : 'var(--card)',
                  border:'1px solid var(--card-border)',
                  color:'var(--text-primary)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.65 : 1,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:12,
                  ...PP, fontSize:'15px', fontWeight:600, transition:'all 0.15s',
                  boxShadow: loading ? 'none' : '0 2px 8px rgba(0,0,0,0.15)',
                }}
                onMouseEnter={e=>{ if(!loading){ e.currentTarget.style.background='var(--surface-hover)'; e.currentTarget.style.borderColor='var(--gold-border)'; }}}
                onMouseLeave={e=>{ e.currentTarget.style.background='var(--card)'; e.currentTarget.style.borderColor='var(--card-border)'; }}
              >
                {loading ? (
                  <>
                    <div style={{ width:18, height:18, border:'2px solid var(--gold-border)', borderTopColor:'var(--gold)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                    <span style={{ ...MONO, fontSize:'11px', letterSpacing:'0.1em', color:'var(--text-muted)' }}>Signing in…</span>
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <p style={{ ...PP, fontSize:12, color:'var(--text-dim)', textAlign:'center', marginTop:16, lineHeight:1.6 }}>
                Use your <span style={{ color:'var(--gold)', fontWeight:600 }}>@neu.edu.ph</span> institutional email
              </p>
            </div>
          </div>

          <p style={{ textAlign:'center', ...MONO, fontSize:'10px', letterSpacing:'0.14em', color:'var(--text-dim)', textTransform:'uppercase' }}>
            New Era University — Library Visitor Log
          </p>
        </div>
      </div>

      {modal && (
        <Modal
          title={modal.title}
          message={modal.message}
          variant={modal.variant}
          actionLabel={modal.actionLabel}
          onClose={modal.onClose}
        />
      )}

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
