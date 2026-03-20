// src/components/admin/AdminDashboard.jsx
// Redesigned with editorial stat cards, animated entrance, and polished layout
import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

const PP = { fontFamily:"'Poppins',sans-serif" };
const SR = { fontFamily:"'Playfair Display',serif" };
const MN = { fontFamily:"'IBM Plex Mono',monospace" };

// ── Animated counter hook ────────────────────────────────────────────────────
function useAnimatedCount(target, duration = 600) {
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
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    prev.current = target;
  }, [target, duration]);
  return count;
}

// ── Hero stat card (large, accent-colored) ───────────────────────────────────
function HeroStat({ label, value, sub, accent = 'gold', delay = 0 }) {
  const colors = {
    gold:  { bg: 'var(--gold-soft)', border: 'var(--gold-border)', text: 'var(--gold)', num: 'var(--text-primary)' },
    green: { bg: 'var(--green-soft)', border: 'var(--green-border)', text: 'var(--green)', num: 'var(--text-primary)' },
    blue:  { bg: 'var(--blue-soft)', border: 'var(--blue-border)', text: 'var(--blue)', num: 'var(--text-primary)' },
    red:   { bg: 'var(--red-soft)', border: 'var(--red-border)', text: 'var(--red)', num: 'var(--text-primary)' },
  };
  const c = colors[accent] || colors.gold;
  const animVal = useAnimatedCount(typeof value === 'number' ? value : 0);
  const displayVal = typeof value === 'number' ? animVal : value;

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--card-border)',
      borderRadius: 16, padding: '24px 24px 20px', position: 'relative', overflow: 'hidden',
      boxShadow: 'var(--shadow-card)',
      animation: `statIn 0.4s cubic-bezier(0.34,1.3,0.64,1) ${delay}ms both`,
    }}>
      {/* Accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${c.text}, transparent)` }} />

      <p style={{ ...MN, fontSize: 10, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: c.text, marginBottom: 12 }}>
        {label}
      </p>
      <p style={{ ...SR, fontSize: 'clamp(36px, 6vw, 48px)', fontWeight: 700, color: c.num, lineHeight: 1, letterSpacing: '-0.02em' }}>
        {displayVal}
      </p>
      {sub && (
        <p style={{ ...PP, fontSize: 12, color: 'var(--text-dim)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Compact stat for filter results ──────────────────────────────────────────
function CompactStat({ label, value, color = 'gold' }) {
  const c = color === 'gold' ? 'var(--gold)' : color === 'blue' ? 'var(--blue)' : color === 'green' ? 'var(--green)' : 'var(--red)';
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--card-border)',
      borderLeft: `3px solid ${c}`, borderRadius: 10, padding: '14px 16px',
    }}>
      <p style={{ ...MN, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6 }}>{label}</p>
      <p style={{ ...SR, fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</p>
    </div>
  );
}

function getGreeting(firstName) {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return `${g}, ${firstName || 'Admin'}!`;
}

function inRange(ts, preset, customFrom, customTo) {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  if (!d) return false;
  if (preset === 'all') return true;
  const now = new Date();
  if (preset === 'today') return d.toDateString() === now.toDateString();
  if (preset === 'week') {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    return d >= cutoff;
  }
  if (preset === 'custom' && customFrom && customTo) {
    const from = new Date(customFrom); from.setHours(0,0,0,0);
    const to   = new Date(customTo);   to.setHours(23,59,59,999);
    return d >= from && d <= to;
  }
  return true;
}

export default function AdminDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [inLib, setInLib] = useState(0);
  const [totalLog, setTotalLog] = useState(0);
  const [users, setUsers] = useState({ total: 0, visitors: 0, staff: 0 });
  const [logs, setLogs] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [pendingEditRequests, setPendingEditRequests] = useState(0);

  const [datePreset, setDatePreset] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [filterCollege, setFilterCollege] = useState('');
  const [filterEmpType, setFilterEmpType] = useState('');

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'logger'), where('active', '==', true)), s => setInLib(s.size));
    const u2 = onSnapshot(collection(db, 'users'), s => {
      const docs = s.docs.map(d => d.data());
      const map = {};
      docs.forEach(d => { map[d.uid] = d; });
      setUserMap(map);
      setUsers({
        total: docs.length,
        visitors: docs.filter(u => u.role === 'visitor').length,
        staff: docs.filter(u => u.role === 'staff' || u.role === 'admin').length,
      });
    });
    const u3 = onSnapshot(
      query(collection(db, 'editRequests'), where('status', '==', 'pending')),
      s => setPendingEditRequests(s.size), () => {}
    );
    getDocs(collection(db, 'logger')).then(snap => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogs(rows);
      setTotalLog(rows.filter(r => !r.active).length);
      setLoading(false);
    });
    return () => { u1(); u2(); u3(); };
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(r => {
      if (r.active) return false;
      if (!inRange(r.entryTime, datePreset, customFrom, customTo)) return false;
      if (filterReason && r.purpose !== filterReason) return false;
      const u = userMap[r.uid];
      if (filterCollege && (u?.college || '') !== filterCollege) return false;
      if (filterEmpType && (u?.visitorType || '') !== filterEmpType) return false;
      return true;
    });
  }, [logs, userMap, datePreset, customFrom, customTo, filterReason, filterCollege, filterEmpType]);

  const allReasons = useMemo(() => [...new Set(logs.map(r => r.purpose).filter(Boolean))].sort(), [logs]);
  const allColleges = useMemo(() => [...new Set(Object.values(userMap).map(u => u.college).filter(Boolean))].sort(), [userMap]);

  const studentVisits = filteredLogs.filter(r => (userMap[r.uid]?.visitorType || 'student') === 'student').length;
  const facultyVisits = filteredLogs.filter(r => userMap[r.uid]?.visitorType === 'faculty').length;

  const reasonBreakdown = useMemo(() => {
    const map = {};
    filteredLogs.forEach(r => { map[r.purpose || 'Unknown'] = (map[r.purpose || 'Unknown'] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredLogs]);

  const inputSt = { background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: "'Poppins',sans-serif", outline: 'none', cursor: 'pointer', transition: 'border-color 0.15s' };

  return (
    <div style={{ animation: 'dashIn 0.35s ease both' }}>
      <style>{`
        @keyframes dashIn  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes statIn  { from{opacity:0;transform:translateY(16px) scale(0.97)} to{opacity:1;transform:none} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes barGrow { from{width:0} }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ ...MN, fontSize: 10, fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 8 }}>
          Administrator
        </p>
        <h1 style={{ ...SR, fontSize: 'clamp(26px, 5vw, 36px)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: 8 }}>
          {getGreeting(userProfile?.firstName)}
        </h1>
        <p style={{ ...PP, fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          NEU Library visitor statistics and operations overview.
        </p>
        <div style={{ marginTop: 20, height: 1, background: 'linear-gradient(90deg, var(--gold-border), transparent 70%)' }} />
      </div>

      {/* ── Live Overview — Hero Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 36 }}>
        <HeroStat label="In Library Now" value={inLib} accent="green" sub="Currently checked in" delay={0} />
        <HeroStat label="Registered Visitors" value={users.visitors} accent="blue" sub="Total accounts" delay={60} />
        <HeroStat label="Staff & Admin" value={users.staff} accent="gold" sub="Library personnel" delay={120} />
        <HeroStat label="Total Visits" value={totalLog} accent="blue" sub="All completed visits" delay={180} />
      </div>

      {/* ── Visitor Statistics Panel ── */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--card-border)',
        borderRadius: 16, overflow: 'hidden', marginBottom: 28,
        boxShadow: 'var(--shadow-card)',
      }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--gold), var(--gold-border), transparent)' }} />
        <div style={{ padding: '24px 24px 28px' }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ ...SR, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Visitor Statistics</h2>
            <p style={{ ...PP, fontSize: 13, color: 'var(--text-muted)' }}>Filter and analyze library visit data</p>
          </div>

          {/* Filter row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[
                { key: 'today', label: 'Today' },
                { key: 'week', label: 'This Week' },
                { key: 'custom', label: 'Custom' },
                { key: 'all', label: 'All Time' },
              ].map(({ key, label }) => (
                <button key={key} type="button" onClick={() => setDatePreset(key)}
                  style={{
                    padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
                    ...PP, fontSize: 12, fontWeight: 600,
                    background: datePreset === key ? 'var(--gold-soft)' : 'var(--surface)',
                    border: `1px solid ${datePreset === key ? 'var(--gold-border)' : 'var(--card-border)'}`,
                    color: datePreset === key ? 'var(--gold)' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}>
                  {label}
                </button>
              ))}
            </div>

            <select style={inputSt} value={filterReason} onChange={e => setFilterReason(e.target.value)}>
              <option value="">All Reasons</option>
              {allReasons.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            <select style={inputSt} value={filterCollege} onChange={e => setFilterCollege(e.target.value)}>
              <option value="">All Colleges</option>
              {allColleges.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select style={inputSt} value={filterEmpType} onChange={e => setFilterEmpType(e.target.value)}>
              <option value="">All Types</option>
              <option value="student">Students</option>
              <option value="faculty">Faculty / Employees</option>
            </select>
          </div>

          {datePreset === 'custom' && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <div>
                <label style={{ ...MN, fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 5 }}>From</label>
                <input type="date" style={inputSt} value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              </div>
              <div>
                <label style={{ ...MN, fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 5 }}>To</label>
                <input type="date" style={inputSt} value={customTo} onChange={e => setCustomTo(e.target.value)} />
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ width: 32, height: 32, border: '2.5px solid var(--gold-border)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
              <p style={{ ...PP, fontSize: 13, color: 'var(--text-muted)' }}>Loading visitor data...</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 24 }}>
                <CompactStat label="Total Visits" value={filteredLogs.length} color="gold" />
                <CompactStat label="Student Visits" value={studentVisits} color="blue" />
                <CompactStat label="Faculty Visits" value={facultyVisits} color="blue" />
              </div>

              {/* Reason breakdown — animated bars */}
              {reasonBreakdown.length > 0 && (
                <div>
                  <p style={{ ...MN, fontSize: 9, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14 }}>
                    Visits by Purpose
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {reasonBreakdown.map(([reason, count], i) => {
                      const pct = filteredLogs.length > 0 ? Math.round((count / filteredLogs.length) * 100) : 0;
                      return (
                        <div key={reason}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span style={{ ...PP, fontSize: 13, fontWeight: 500, color: 'var(--text-body)' }}>{reason}</span>
                            <span style={{ ...MN, fontSize: 12, color: 'var(--text-muted)' }}>
                              {count} <span style={{ color: 'var(--text-dim)' }}>({pct}%)</span>
                            </span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: 'var(--surface)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${pct}%`, borderRadius: 3,
                              background: 'var(--gold)',
                              animation: `barGrow 0.6s cubic-bezier(0.34,1.3,0.64,1) ${i * 80}ms both`,
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {filteredLogs.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', opacity: 0.5 }}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <p style={{ ...PP, fontSize: 14, color: 'var(--text-dim)' }}>No visits found for the selected filters.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Quick Access ── */}
      <p style={{ ...MN, fontSize: 9, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>
        Quick Access
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {[
          {
            label: 'Library Logger', sub: 'View active sessions',
            path: '/logger', color: 'var(--gold)', dot: false,
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>,
          },
          {
            label: 'User Management',
            sub: pendingEditRequests > 0 ? `${pendingEditRequests} pending request${pendingEditRequests > 1 ? 's' : ''}` : 'Manage accounts & roles',
            path: '/admin/users', color: 'var(--blue)', dot: pendingEditRequests > 0,
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>,
          },
          {
            label: 'Reports', sub: 'Analytics & exports',
            path: '/admin/reports', color: 'var(--gold)', dot: false,
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
          },
        ].map(({ label, sub, path, color, dot, icon }) => (
          <button key={path} onClick={() => navigate(path)}
            style={{
              position: 'relative', background: 'var(--card)', border: '1px solid var(--card-border)',
              borderRadius: 14, padding: '20px 20px', textAlign: 'left', cursor: 'pointer',
              transition: 'all 0.2s', boxShadow: 'var(--shadow-card)',
              display: 'flex', gap: 14, alignItems: 'flex-start',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.transform = 'none'; }}>
            {dot && (
              <span style={{ position: 'absolute', top: 10, right: 10, width: 10, height: 10, borderRadius: '50%', background: 'var(--red)', border: '2px solid var(--card)', animation: 'pulseDot 1.5s infinite' }} />
            )}
            <span style={{ color, opacity: 0.8, flexShrink: 0, marginTop: 2 }}>{icon}</span>
            <div>
              <p style={{ ...PP, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{label}</p>
              <p style={{ ...PP, fontSize: 13, color: dot ? 'var(--red)' : 'var(--text-muted)' }}>{sub}</p>
            </div>
          </button>
        ))}
      </div>

      <style>{`@keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
