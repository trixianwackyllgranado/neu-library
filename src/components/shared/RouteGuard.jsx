// src/components/shared/RouteGuard.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const S = { fontFamily: "'IBM Plex Mono', monospace" };

function Splash({ text = 'Loading…' }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #060e1e 0%, #0a1628 50%, #0d1e36 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <p style={{ ...S, fontSize: '12px', color: '#334155', letterSpacing: '0.18em' }}>{text}</p>
    </div>
  );
}

/** Redirect to /dashboard if already logged in */
export function RequireGuest({ children }) {
  const { currentUser, loadingAuth } = useAuth();
  if (loadingAuth) return <Splash />;
  if (currentUser) return <Navigate to="/dashboard" replace />;
  return children;
}

/** Redirect to /login if not logged in */
export function RequireAuth({ children }) {
  const { currentUser, loadingAuth } = useAuth();
  const location = useLocation();
  if (loadingAuth) return <Splash />;
  if (!currentUser) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

/** Redirect to /dashboard if role not in allowed list */
export function RequireRole({ roles, children }) {
  const { userProfile, profileLoading } = useAuth();
  if (profileLoading) return <Splash text="Checking permissions…" />;
  if (!userProfile || !roles.includes(userProfile.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
