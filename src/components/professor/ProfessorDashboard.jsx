// src/components/professor/ProfessorDashboard.jsx
// Shown when jcesperanza@neu.edu.ph is in 'student' (regular user) role.
import { useAuth } from '../../context/AuthContext';

const PP = { fontFamily: "'Poppins', sans-serif" };
const SR = { fontFamily: "'Playfair Display', serif" };

export default function ProfessorDashboard() {
  const { userProfile, switchRole } = useAuth();

  const displayName = userProfile
    ? [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ') || 'Professor'
    : 'Professor';

  return (
    <div style={{ animation: 'fadeUp 0.3s ease both', maxWidth: 600 }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Welcome card */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--card-border)',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
        marginBottom: 20,
      }}>
        {/* NEU colour bar */}
        <div style={{ height: 4, background: 'linear-gradient(90deg,#c0392b 0%,#c0392b 25%,#e67e22 25%,#e67e22 50%,#27ae60 50%,#27ae60 75%,#2980b9 75%,#2980b9 100%)' }} />
        <div style={{ padding: '40px 36px' }}>
          <p style={{ ...PP, fontSize: 13, fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            NEU Library — Visitor Log System
          </p>
          <h1 style={{ ...SR, fontSize: 'clamp(28px,5vw,38px)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.15, marginBottom: 10 }}>
            Welcome to NEU Library!
          </h1>
          <p style={{ ...PP, fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 0 }}>
            You are signed in as <strong style={{ color: 'var(--text-primary)' }}>{displayName}</strong>.
          </p>
        </div>
      </div>

      {/* Role switch card */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--card-border)',
        borderRadius: 14,
        padding: '22px 24px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <p style={{ ...PP, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Switch to Admin View</p>
          <p style={{ ...PP, fontSize: 13, color: 'var(--text-muted)' }}>View visitor statistics, filter by reason, college, and employee type.</p>
        </div>
        <button
          onClick={switchRole}
          style={{
            padding: '10px 22px',
            borderRadius: 10,
            background: 'var(--gold-soft)',
            border: '1px solid var(--gold-border)',
            color: 'var(--gold)',
            cursor: 'pointer',
            ...PP, fontSize: 13, fontWeight: 600,
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.15)'}
          onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
        >
          Switch to Admin
        </button>
      </div>
    </div>
  );
}
