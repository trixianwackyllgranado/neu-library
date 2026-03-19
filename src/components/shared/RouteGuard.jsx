// src/components/shared/RouteGuard.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function Splash({ text = 'Loading...' }) {
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-base)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:40, height:40, border:'3px solid var(--gold-border)', borderTopColor:'var(--gold)', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 16px' }} />
        <p style={{ fontFamily:"'Poppins',sans-serif", fontSize:13, color:'var(--text-muted)', letterSpacing:'0.04em' }}>{text}</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// RequireGuest: redirects logged-in registered users away from /login and /register.
// If pendingGoogleUser exists, the user just signed in with Google but hasn't
// registered yet — allow /register through unconditionally. This is the
// second line of defence after the loginInProgressRef lock in AuthContext.
export function RequireGuest({ children }) {
  const { currentUser, loadingAuth, userProfile, profileLoading, pendingGoogleUser } = useAuth();

  // Always wait for auth to finish initialising
  if (loadingAuth || profileLoading) return <Splash />;

  // Unregistered Google user waiting to fill the form — never block /register
  if (pendingGoogleUser) return children;

  // Fully registered and logged in — send them to the kiosk
  if (currentUser && userProfile) return <Navigate to="/dashboard" replace />;

  // Not logged in — show login/register pages normally
  return children;
}

// RequireAuth: protects pages that need a fully registered, logged-in user.
// If pendingGoogleUser exists, the user IS authenticated at the Firebase Auth
// level but hasn't created a Firestore profile yet — send them to /register,
// not /login (which would be confusing since they just signed in).
export function RequireAuth({ children }) {
  const { currentUser, loadingAuth, userProfile, profileLoading, pendingGoogleUser } = useAuth();
  const location = useLocation();

  if (loadingAuth || profileLoading) return <Splash />;

  // Authenticated but no Firestore profile yet → needs to register first
  if (currentUser && !userProfile && pendingGoogleUser) {
    return <Navigate to="/register" replace />;
  }

  // Not authenticated at all → send to login
  if (!currentUser || !userProfile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export function RequireRole({ roles, children }) {
  const { userProfile, profileLoading } = useAuth();
  if (profileLoading) return <Splash text="Checking permissions..." />;
  if (!userProfile || !roles.includes(userProfile.role)) return <Navigate to="/dashboard" replace />;
  return children;
}
