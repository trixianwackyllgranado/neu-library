// src/components/staff/StaffDashboard.jsx
// Redesigned with editorial stat cards, animated entrance, live activity feed
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

const PP = { fontFamily:"'Poppins',sans-serif" };
const SR = { fontFamily:"'Playfair Display',serif" };
const MN = { fontFamily:"'IBM Plex Mono',monospace" };

// ── Animated counter ─────────────────────────────────────────────────────────
function useAnimatedCount(target, duration = 500) {
  const [count, setCount] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (target === prev.current) return;
    const start = prev.current;
    const diff = target - start;
    const startTime = performance.now();
    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    prev.current = target;
  }, [target, duration]);
  return count;
}

function getGreeting(firstName) {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return `${g}, ${firstName || 'there'}!`;
}

export default function StaffDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [inLib, setInLib] = useState(0);
  const [recent, setRecent] = useState([]);

  const animInLib = useAnimatedCount(inLib);

  useEffect(() => {
    const u = onSnapshot(query(collection(db, 'logger'), where('active', '==', true)), s => {
      setInLib(s.size);
      setRecent(s.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, 8));
    });
    return u;
  }, []);

  const quickActions = [
    {
      label: 'Library Logger', sub: 'View active sessions & history',
      path: '/logger', color: 'var(--gold)',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>,
    },
    {
      label: 'Visitor Kiosk', sub: 'Log visitors in/out by ID or QR',
      path: '/staff/kiosk', color: 'var(--green)',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3"/><path d="M17 17v4"/><path d="M21 14v3h-4"/></svg>,
    },
  ];

  return (
    <div style={{ animation: 'dashIn 0.35s ease both' }}>
      <style>{`
        @keyframes dashIn   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes statIn   { from{opacity:0;transform:translateY(16px) scale(0.97)} to{opacity:1;transform:none} }
        @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ ...MN, fontSize: 10, fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 8 }}>
          Staff Portal
        </p>
        <h1 style={{ ...SR, fontSize: 'clamp(26px, 5vw, 36px)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: 8 }}>
          {getGreeting(userProfile?.firstName)}
        </h1>
        <p style={{ ...PP, fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Library operations at a glance.
        </p>
        <div style={{ marginTop: 20, height: 1, background: 'linear-gradient(90deg, var(--gold-border), transparent 70%)' }} />
      </div>

      {/* ── Live Occupancy Card ── */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--card-border)',
        borderRadius: 16, padding: '28px 28px 24px', position: 'relative', overflow: 'hidden',
        boxShadow: 'var(--shadow-card)', marginBottom: 28,
        animation: 'statIn 0.4s cubic-bezier(0.34,1.3,0.64,1) both',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--green), transparent)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--green)', animation: 'pulseDot 1.5s infinite' }} />
          <p style={{ ...MN, fontSize: 10, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--green)' }}>
            Current Occupancy
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <p style={{ ...SR, fontSize: 'clamp(42px, 8vw, 56px)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.02em' }}>
            {animInLib}
          </p>
          <p style={{ ...PP, fontSize: 15, color: 'var(--text-muted)' }}>
            {inLib === 1 ? 'visitor' : 'visitors'} in library
          </p>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <p style={{ ...MN, fontSize: 9, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>
        Quick Actions
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 28 }}>
        {quickActions.map(({ label, sub, path, color, icon }, i) => (
          <button key={path} onClick={() => navigate(path)}
            style={{
              background: 'var(--card)', border: '1px solid var(--card-border)',
              borderRadius: 14, padding: '20px 20px', textAlign: 'left', cursor: 'pointer',
              transition: 'all 0.2s', boxShadow: 'var(--shadow-card)',
              display: 'flex', gap: 14, alignItems: 'flex-start',
              animation: `statIn 0.4s cubic-bezier(0.34,1.3,0.64,1) ${(i + 1) * 80}ms both`,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.transform = 'none'; }}>
            <span style={{ color, opacity: 0.8, flexShrink: 0, marginTop: 2 }}>{icon}</span>
            <div>
              <p style={{ ...PP, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{label}</p>
              <p style={{ ...PP, fontSize: 13, color: 'var(--text-muted)' }}>{sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Currently in Library — Live Feed ── */}
      {recent.length > 0 && (
        <div style={{
          background: 'var(--card)', border: '1px solid var(--card-border)',
          borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-card)',
          animation: 'statIn 0.4s cubic-bezier(0.34,1.3,0.64,1) 200ms both',
        }}>
          <div style={{
            padding: '16px 22px', borderBottom: '1px solid var(--divider)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulseDot 1.5s infinite' }} />
              <p style={{ ...PP, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Currently in Library</p>
            </div>
            <span style={{
              ...MN, fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20,
              background: 'var(--green-soft)', border: '1px solid var(--green-border)', color: 'var(--green)',
            }}>
              {recent.length}
            </span>
          </div>
          <div style={{ padding: '16px 22px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {recent.map((s, i) => (
              <span key={s.id} style={{
                ...PP, fontSize: 12, fontWeight: 500,
                padding: '5px 14px', borderRadius: 20,
                background: 'var(--green-soft)', border: '1px solid var(--green-border)', color: 'var(--green)',
                animation: `statIn 0.3s ease ${i * 40}ms both`,
              }}>
                {s.studentName || s.purpose}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
