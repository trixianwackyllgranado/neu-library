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
  const { currentUser, loadingAuth } = useAuth();
  if (loadingAuth) return <Splash />;
  if (currentUser) return <Navigate to="/dashboard" replace />;
  return children;
}

export function RequireAuth({ children }) {
  const { currentUser, loadingAuth } = useAuth();
  const location = useLocation();
  if (loadingAuth) return <Splash />;
  if (!currentUser) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

export function RequireRole({ roles, children }) {
  const { userProfile, profileLoading } = useAuth();
  if (profileLoading) return <Splash text="Checking permissions..." />;
  if (!userProfile || !roles.includes(userProfile.role)) return <Navigate to="/dashboard" replace />;
  return children;
}
