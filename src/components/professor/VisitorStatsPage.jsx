// src/components/professor/VisitorStatsPage.jsx
// Admin view for jcesperanza@neu.edu.ph — visitor statistics dashboard.
// Reads from the existing `logger` collection, joins with `users` for
// college and employee type. No schema changes required.
import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

const PP = { fontFamily: "'Poppins', sans-serif" };
const SR = { fontFamily: "'Playfair Display', serif" };
const MN = { fontFamily: "'IBM Plex Mono', monospace" };

// Visit purposes from LoggerPage
const PURPOSES = ['All', 'Study / Review', 'Borrow / Return Books', 'Research', 'Use Computer', 'Group Study', 'Other'];

// Employee roles in the system
const EMPLOYEE_ROLES = ['staff', 'admin'];

function toDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return new Date(ts);
}

function startOfDay(d) {
  const r = new Date(d); r.setHours(0,0,0,0); return r;
}
function endOfDay(d) {
  const r = new Date(d); r.setHours(23,59,59,999); return r;
}

function StatCard({ label, value, color = 'blue', sub }) {
  const borderColor = color === 'gold' ? 'var(--gold)' : color === 'red' ? 'var(--red)' : color === 'green' ? 'var(--green)' : 'var(--blue)';
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderLeft: `3px solid ${borderColor}`, borderRadius: 12, padding: '18px 20px', boxShadow: 'var(--shadow-card)' }}>
      <p style={{ ...PP, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
      <p style={{ ...SR, fontSize: 34, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ ...PP, fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>{sub}</p>}
    </div>
  );
}

function BarChart({ data, maxVal }) {
  if (!data.length) return <p style={{ ...PP, fontSize: 13, color: 'var(--text-muted)', padding: '20px 0' }}>No data for this range.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map(({ label, count }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ ...PP, fontSize: 12, color: 'var(--text-muted)', minWidth: 100, textAlign: 'right', flexShrink: 0 }}>{label}</span>
          <div style={{ flex: 1, background: 'var(--surface)', borderRadius: 4, height: 22, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: maxVal > 0 ? `${(count / maxVal) * 100}%` : '0%',
              background: 'var(--gold-soft)',
              borderRight: '2px solid var(--gold)',
              borderRadius: 4,
              transition: 'width 0.4s ease',
              minWidth: count > 0 ? 4 : 0,
            }} />
          </div>
          <span style={{ ...MN, fontSize: 12, color: 'var(--text-primary)', minWidth: 28, textAlign: 'right' }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

export default function VisitorStatsPage() {
  const { switchRole } = useAuth();

  const [logs,    setLogs]    = useState([]);
  const [userMap, setUserMap] = useState({});  // uid → { college, role, firstName, lastName }
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState(null);

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [rangeMode,   setRangeMode]   = useState('today'); // 'today' | 'week' | 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd,   setCustomEnd]   = useState('');
  const [filterPurpose,    setFilterPurpose]    = useState('All');
  const [filterCollege,    setFilterCollege]    = useState('All');
  const [filterEmployeeType, setFilterEmployeeType] = useState('All'); // 'All' | 'Employee' | 'Student'

  // ── Fetch data ───────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    try {
      const [logSnap, userSnap] = await Promise.all([
        getDocs(collection(db, 'logger')),
        getDocs(collection(db, 'users')),
      ]);
      const rawLogs = logSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const rawUsers = {};
      userSnap.docs.forEach(d => {
        const u = d.data();
        rawUsers[d.id] = {
          college:   u.college   || '',
          role:      u.role      || 'student',
          firstName: u.firstName || '',
          lastName:  u.lastName  || '',
          email:     u.email     || '',
        };
      });
      setLogs(rawLogs);
      setUserMap(rawUsers);
      setLastFetched(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Date range computation ────────────────────────────────────────────────────
  const dateRange = useMemo(() => {
    const now = new Date();
    if (rangeMode === 'today') return { start: startOfDay(now), end: endOfDay(now) };
    if (rangeMode === 'week') {
      const s = new Date(now); s.setDate(s.getDate() - 6); return { start: startOfDay(s), end: endOfDay(now) };
    }
    if (rangeMode === 'custom' && customStart && customEnd) {
      return { start: startOfDay(new Date(customStart)), end: endOfDay(new Date(customEnd)) };
    }
    return { start: startOfDay(now), end: endOfDay(now) };
  }, [rangeMode, customStart, customEnd]);

  // ── Unique colleges from users ────────────────────────────────────────────────
  const colleges = useMemo(() => {
    const set = new Set(Object.values(userMap).map(u => u.college).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [userMap]);

  // ── Filtered logs ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return logs.filter(log => {
      // Date range — use entryTime
      const ts = toDate(log.entryTime);
      if (!ts || ts < dateRange.start || ts > dateRange.end) return false;

      // Purpose filter
      if (filterPurpose !== 'All' && log.purpose !== filterPurpose) return false;

      // College + employee type filters need userMap
      const user = userMap[log.uid];

      // College filter
      if (filterCollege !== 'All') {
        if (!user || user.college !== filterCollege) return false;
      }

      // Employee type filter
      if (filterEmployeeType !== 'All') {
        const isEmployee = user && EMPLOYEE_ROLES.includes(user.role);
        if (filterEmployeeType === 'Employee' && !isEmployee) return false;
        if (filterEmployeeType === 'Student'  &&  isEmployee) return false;
      }

      return true;
    });
  }, [logs, userMap, dateRange, filterPurpose, filterCollege, filterEmployeeType]);

  // ── Derived stats ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total      = filtered.length;
    const completed  = filtered.filter(l => !l.active).length;
    const active     = filtered.filter(l =>  l.active).length;
    const employees  = filtered.filter(l => userMap[l.uid] && EMPLOYEE_ROLES.includes(userMap[l.uid]?.role)).length;
    const students   = total - employees;

    // Purpose breakdown
    const byPurpose = {};
    filtered.forEach(l => {
      const p = l.purpose || 'Unknown';
      byPurpose[p] = (byPurpose[p] || 0) + 1;
    });

    // College breakdown
    const byCollege = {};
    filtered.forEach(l => {
      const c = userMap[l.uid]?.college || 'Unknown';
      byCollege[c] = (byCollege[c] || 0) + 1;
    });

    // Visits per day (for this range)
    const byDay = {};
    filtered.forEach(l => {
      const ts = toDate(l.entryTime);
      if (!ts) return;
      const key = ts.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
      byDay[key] = (byDay[key] || 0) + 1;
    });

    return {
      total, completed, active, employees, students,
      byPurpose: Object.entries(byPurpose).map(([label, count]) => ({ label, count })).sort((a,b) => b.count - a.count),
      byCollege: Object.entries(byCollege).map(([label, count]) => ({ label, count })).sort((a,b) => b.count - a.count),
      byDay:     Object.entries(byDay).map(([label, count]) => ({ label, count })),
    };
  }, [filtered, userMap]);

  const maxPurpose = Math.max(1, ...stats.byPurpose.map(x => x.count));
  const maxCollege = Math.max(1, ...stats.byCollege.map(x => x.count));
  const maxDay     = Math.max(1, ...stats.byDay.map(x => x.count));

  const inputSt = {
    background: 'var(--input-bg)', border: '1px solid var(--input-border)',
    borderRadius: 9, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)',
    fontFamily: "'Poppins', sans-serif", outline: 'none', boxSizing: 'border-box', cursor: 'pointer',
  };

  const tabBtn = (mode) => ({
    padding: '8px 18px', borderRadius: 9, cursor: 'pointer',
    ...PP, fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
    background: rangeMode === mode ? 'var(--gold-soft)' : 'var(--surface)',
    border: `1px solid ${rangeMode === mode ? 'var(--gold-border)' : 'var(--card-border)'}`,
    color: rangeMode === mode ? 'var(--gold)' : 'var(--text-muted)',
  });

  return (
    <div style={{ animation: 'fadeUp 0.3s ease both' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ ...PP, fontSize: 13, fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Administrator</p>
          <h1 style={{ ...SR, fontSize: 'clamp(24px,4vw,32px)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Visitor Statistics</h1>
          <p style={{ ...PP, fontSize: 14, color: 'var(--text-muted)' }}>
            Library visit analytics — {lastFetched ? `last fetched ${lastFetched.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={fetchData} disabled={loading}
            style={{ ...PP, fontSize: 13, fontWeight: 600, padding: '9px 18px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button onClick={switchRole}
            style={{ ...PP, fontSize: 13, fontWeight: 600, padding: '9px 18px', borderRadius: 9, background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', color: 'var(--gold)', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.filter='brightness(1.15)'}
            onMouseLeave={e => e.currentTarget.style.filter='brightness(1)'}>
            Switch to Regular User
          </button>
        </div>
      </div>
      <div style={{ height: 1, background: 'linear-gradient(90deg,var(--gold-border),transparent)', marginBottom: 28 }} />

      {/* ── Filters row ── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '20px 22px', marginBottom: 24, boxShadow: 'var(--shadow-card)' }}>
        <p style={{ ...PP, fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Filters</p>

        {/* Date range */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
          <span style={{ ...PP, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginRight: 4 }}>Date Range</span>
          <button onClick={() => setRangeMode('today')} style={tabBtn('today')}>Today</button>
          <button onClick={() => setRangeMode('week')}  style={tabBtn('week')}>Last 7 Days</button>
          <button onClick={() => setRangeMode('custom')} style={tabBtn('custom')}>Custom</button>
          {rangeMode === 'custom' && (
            <>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ ...inputSt, width: 140 }} />
              <span style={{ ...PP, fontSize: 12, color: 'var(--text-muted)' }}>to</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ ...inputSt, width: 140 }} />
            </>
          )}
        </div>

        {/* Other filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ ...PP, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Reason for Visit</label>
            <select value={filterPurpose} onChange={e => setFilterPurpose(e.target.value)} style={{ ...inputSt, width: '100%', appearance: 'none' }}>
              {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={{ ...PP, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>College</label>
            <select value={filterCollege} onChange={e => setFilterCollege(e.target.value)} style={{ ...inputSt, width: '100%', appearance: 'none' }}>
              {colleges.map(c => <option key={c} value={c}>{c || 'Unknown'}</option>)}
            </select>
          </div>
          <div>
            <label style={{ ...PP, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Visitor Type</label>
            <select value={filterEmployeeType} onChange={e => setFilterEmployeeType(e.target.value)} style={{ ...inputSt, width: '100%', appearance: 'none' }}>
              <option value="All">All Visitors</option>
              <option value="Employee">Employee (Teacher / Staff)</option>
              <option value="Student">Student</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Summary stat cards ── */}
      <p style={{ ...PP, fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Summary</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 28 }}>
        <StatCard label="Total Visits"     value={stats.total}     color="blue"  sub="Within range" />
        <StatCard label="Completed"        value={stats.completed} color="green" sub="Checked out"  />
        <StatCard label="Still In Library" value={stats.active}    color="gold"  sub="Active sessions" />
        <StatCard label="Employees"        value={stats.employees} color="blue"  sub="Staff / Teachers" />
        <StatCard label="Students"         value={stats.students}  color="green" sub="Non-staff visitors" />
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 28 }}>

        {/* Visits per day */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '20px 22px', boxShadow: 'var(--shadow-card)' }}>
          <p style={{ ...PP, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Visits per Day</p>
          <p style={{ ...PP, fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Daily breakdown for selected range</p>
          <BarChart data={stats.byDay} maxVal={maxDay} />
        </div>

        {/* By purpose */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '20px 22px', boxShadow: 'var(--shadow-card)' }}>
          <p style={{ ...PP, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>By Visit Reason</p>
          <p style={{ ...PP, fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Purpose of each library visit</p>
          <BarChart data={stats.byPurpose} maxVal={maxPurpose} />
        </div>

        {/* By college */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '20px 22px', boxShadow: 'var(--shadow-card)', gridColumn: 'span 1' }}>
          <p style={{ ...PP, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>By College</p>
          <p style={{ ...PP, fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Visits broken down by visitor college</p>
          <BarChart data={stats.byCollege} maxVal={maxCollege} />
        </div>
      </div>

      {/* ── Visits table ── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ ...PP, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Visit Log</p>
          <span style={{ ...PP, fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: 'var(--blue-soft)', border: '1px solid var(--blue-border)', color: 'var(--blue)' }}>
            {filtered.length} {filtered.length === 1 ? 'record' : 'records'}
          </span>
        </div>
        {filtered.length === 0 ? (
          <p style={{ ...PP, fontSize: 14, color: 'var(--text-muted)', padding: '32px 20px', textAlign: 'center' }}>No visits match the selected filters.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Name', 'College', 'Type', 'Purpose', 'Entry', 'Status'].map(h => (
                    <th key={h} style={{ fontFamily: "'Poppins',sans-serif", fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '11px 16px', textAlign: 'left', background: 'var(--thead-bg)', borderBottom: '1px solid var(--divider)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((log, i) => {
                  const u       = userMap[log.uid];
                  const name    = u ? `${u.lastName}, ${u.firstName}`.trim() || u.email || '—' : '—';
                  const college = u?.college || '—';
                  const type    = u && EMPLOYEE_ROLES.includes(u.role) ? 'Employee' : 'Student';
                  const ts      = toDate(log.entryTime);
                  const entryStr = ts ? ts.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                  return (
                    <tr key={log.id}
                      style={{ background: i % 2 === 0 ? 'transparent' : 'var(--row-alt)', transition: 'background 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--row-alt)'}>
                      <td style={{ fontFamily:"'Poppins',sans-serif", fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, padding: '11px 16px', borderBottom: '1px solid var(--row-border)', whiteSpace: 'nowrap' }}>{name}</td>
                      <td style={{ fontFamily:"'Poppins',sans-serif", fontSize: 12, color: 'var(--text-muted)', padding: '11px 16px', borderBottom: '1px solid var(--row-border)' }}>{college}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--row-border)' }}>
                        <span style={{ fontFamily:"'Poppins',sans-serif", fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: type === 'Employee' ? 'var(--gold-soft)' : 'var(--blue-soft)', border: `1px solid ${type === 'Employee' ? 'var(--gold-border)' : 'var(--blue-border)'}`, color: type === 'Employee' ? 'var(--gold)' : 'var(--blue)', whiteSpace: 'nowrap' }}>{type}</span>
                      </td>
                      <td style={{ fontFamily:"'Poppins',sans-serif", fontSize: 12, color: 'var(--text-muted)', padding: '11px 16px', borderBottom: '1px solid var(--row-border)' }}>{log.purpose || '—'}</td>
                      <td style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize: 11, color: 'var(--text-muted)', padding: '11px 16px', borderBottom: '1px solid var(--row-border)', whiteSpace: 'nowrap' }}>{entryStr}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--row-border)' }}>
                        <span style={{ fontFamily:"'Poppins',sans-serif", fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: log.active ? 'var(--green-soft)' : 'var(--surface)', border: `1px solid ${log.active ? 'var(--green-border)' : 'var(--card-border)'}`, color: log.active ? 'var(--green)' : 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                          {log.active ? 'In Library' : 'Completed'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length > 100 && (
              <p style={{ ...PP, fontSize: 12, color: 'var(--text-muted)', padding: '12px 20px', borderTop: '1px solid var(--divider)' }}>
                Showing first 100 of {filtered.length} records. Use filters to narrow results.
              </p>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
