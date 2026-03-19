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

export function RequireGuest({ children }) {
  const { currentUser, loadingAuth, userProfile, profileLoading, pendingGoogleUser } = useAuth();

  if (loadingAuth || profileLoading) return <Splash />;
  if (pendingGoogleUser) return children;
  if (currentUser && userProfile) return <Navigate to="/dashboard" replace />;
  return children;
}

export function RequireAuth({ children }) {
  const { currentUser, loadingAuth, userProfile, profileLoading, pendingGoogleUser } = useAuth();
  const location = useLocation();

  if (loadingAuth || profileLoading) return <Splash />;
  if (currentUser && !userProfile && pendingGoogleUser) {
    return <Navigate to="/register" replace />;
  }
  if (!currentUser || !userProfile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

// RequireRole now uses effectiveRole so prime admin can switch views.
// When viewing as 'visitor', admin-only routes will redirect to /dashboard.
export function RequireRole({ roles, children }) {
  const { userProfile, profileLoading, effectiveRole } = useAuth();
  if (profileLoading) return <Splash text="Checking permissions..." />;

  const role = effectiveRole || userProfile?.role;
  if (!userProfile || !roles.includes(role)) return <Navigate to="/dashboard" replace />;
  return children;
}
