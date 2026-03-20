// src/pages/admin/ReportsPage.jsx
// Cleaned: book catalog and borrowing sections removed — visitor/logger stats only
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';

// ── CSV helper ────────────────────────────────────────────────────────────────
function downloadCSV(filename, headers, rows) {
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

function StatCard({ label, value, accent, onClick, hint }) {
  const color = accent === 'red' ? 'var(--red)' : accent === 'gold' ? 'var(--gold)' : accent === 'green' ? 'var(--green)' : accent === 'dim' ? 'var(--text-dim)' : 'var(--blue)';
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      title={hint}
      style={{
        background:'var(--card)', border:'1px solid var(--card-border)',
        borderLeft:`3px solid ${color}`, borderRadius:12, padding:'18px 20px',
        boxShadow:'var(--shadow-card)', cursor: clickable ? 'pointer' : 'default',
        transition: 'all 0.15s', position:'relative',
      }}
      onMouseEnter={e => { if (clickable) { e.currentTarget.style.background='var(--surface-hover)'; e.currentTarget.style.borderColor='var(--gold-border)'; }}}
      onMouseLeave={e => { if (clickable) { e.currentTarget.style.background='var(--card)'; e.currentTarget.style.borderColor='var(--card-border)'; }}}
    >
      <p style={{ fontFamily:"'Poppins',sans-serif", fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>{label}</p>
      <p style={{ fontFamily:"'Playfair Display',serif", fontSize:36, fontWeight:700, color:'var(--text-primary)', lineHeight:1 }}>{value}</p>
      {clickable && (
        <span style={{ position:'absolute', bottom:10, right:14, fontFamily:"'IBM Plex Mono',monospace", fontSize:9, letterSpacing:'0.1em', color:'var(--text-dim)', textTransform:'uppercase' }}>
          View →
        </span>
      )}
    </div>
  );
}

function ChartCard({ title, subtitle, children, onClick, hint }) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      title={hint}
      style={{
        background:'var(--card)', border:'1px solid var(--card-border)', borderRadius:14,
        padding:'20px 24px', boxShadow:'var(--shadow-card)',
        cursor: clickable ? 'pointer' : 'default', transition:'all 0.15s', position:'relative',
      }}
      onMouseEnter={e => { if (clickable) { e.currentTarget.style.background='var(--surface-hover)'; e.currentTarget.style.borderColor='var(--gold-border)'; }}}
      onMouseLeave={e => { if (clickable) { e.currentTarget.style.background='var(--card)'; e.currentTarget.style.borderColor='var(--card-border)'; }}}
    >
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom: subtitle ? 2 : 16 }}>
        <p style={{ fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:700, color:'var(--text-primary)' }}>{title}</p>
        {clickable && <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, letterSpacing:'0.1em', color:'var(--text-dim)', textTransform:'uppercase', flexShrink:0, marginLeft:8, marginTop:3 }}>View →</span>}
      </div>
      {subtitle && <p style={{ fontFamily:"'Poppins',sans-serif", fontSize:12, color:'var(--text-dim)', marginBottom:16 }}>{subtitle}</p>}
      {children}
    </div>
  );
}

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'activity', label: 'Visitor Activity' },
];

export default function ReportsPage() {
  const [activeTab,   setActiveTab]   = useState('overview');
  const [loading,     setLoading]     = useState(true);
  const [lastFetched, setLastFetched] = useState(null);
  const [refreshing,  setRefreshing]  = useState(false);

  const [users,    setUsers]    = useState([]);
  const [sessions, setSessions] = useState([]);

  // Visitor activity filters
  const [activityUser,    setActivityUser]    = useState('');
  const [studentSearch,   setStudentSearch]   = useState('');
  const [studentDropOpen, setStudentDropOpen] = useState(false);

  const navigate = useNavigate();

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [usersSnap, sessionsSnap] = await Promise.allSettled([
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'logger'), orderBy('entryTime', 'desc'))),
      ]);
      if (usersSnap.status    === 'fulfilled') setUsers(usersSnap.value.docs.map(d => ({ id: d.id, ...d.data() })));
      if (sessionsSnap.status === 'fulfilled') setSessions(sessionsSnap.value.docs.map(d => ({ id: d.id, ...d.data() })));
      setLastFetched(new Date());
    } catch (e) {
      console.error('Reports fetch error:', e);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  const stats = {
    totalUsers:     users.length,
    visitors:       users.filter(u => u.role === 'visitor').length,
    students:       users.filter(u => u.role === 'visitor' && u.visitorType !== 'faculty').length,
    faculty:        users.filter(u => u.role === 'visitor' && u.visitorType === 'faculty').length,
    staffAdmins:    users.filter(u => u.role === 'staff' || u.role === 'admin').length,
    totalSessions:  sessions.length,
    activeSessions: sessions.filter(s => s.active).length,
  };

  // Sessions per day (last 14 days)
  const sessionsByDay = (() => {
    const map = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      map[d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })] = 0;
    }
    sessions.forEach(s => {
      const d = s.entryTime?.toDate?.(); if (!d) return;
      const key = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
      if (key in map) map[key]++;
    });
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  })();

  // Purpose distribution
  const purposeDist = (() => {
    const m = {};
    sessions.forEach(s => { const p = s.purpose || 'Unknown'; m[p] = (m[p]||0)+1; });
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([name, value]) => ({ name, value }));
  })();

  // College distribution (visitors only)
  const collegeDist = (() => {
    const m = {};
    users.filter(u => u.role === 'visitor').forEach(u => {
      const c = u.college || 'Unknown'; m[c] = (m[c]||0)+1;
    });
    return Object.entries(m).sort((a,b)=>b[1]-a[1])
      .map(([name, value]) => ({ name: name.replace('College of ',''), value }));
  })();

  // Visitor activity tab
  const visitorUsers = users
    .filter(u => u.role === 'visitor')
    .sort((a,b) => (a.lastName||'').localeCompare(b.lastName||''));

  const selectedUserSessions = activityUser
    ? sessions.filter(s => s.uid === activityUser)
    : [];

  const fmt   = ts => { if (!ts) return '—'; const d = ts.toDate?ts.toDate():new Date(ts); return d.toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}); };
  const fmtDt = ts => { if (!ts) return '—'; const d = ts.toDate?ts.toDate():new Date(ts); return d.toLocaleString('en-PH',{dateStyle:'short',timeStyle:'short'}); };

  const exportOverviewCSV = () => {
    downloadCSV('overview-report.csv',
      ['Metric', 'Value'],
      [
        ['Total Users',        stats.totalUsers],
        ['Total Visitors',     stats.visitors],
        ['Student Visitors',   stats.students],
        ['Faculty Visitors',   stats.faculty],
        ['Staff & Admins',     stats.staffAdmins],
        ['Total Log-Ins',      stats.totalSessions],
        ['Currently Inside',   stats.activeSessions],
      ]
    );
  };

  const exportSessionsCSV = () => {
    downloadCSV('library-sessions.csv',
      ['Name', 'ID Number', 'Visitor Type', 'College', 'Purpose', 'Entry Time', 'Exit Time', 'Status'],
      sessions.map(s => {
        const u = userMap[s.uid];
        return [
          u ? `${u.lastName}, ${u.firstName}` : '—',
          u?.idNumber || '—',
          u?.visitorType === 'faculty' ? 'Faculty' : 'Student',
          u?.college || '—',
          s.purpose || '',
          fmtDt(s.entryTime),
          s.active ? 'Still Inside' : fmtDt(s.exitTime),
          s.active ? 'Active' : s.forcedLogout ? 'Force-Exited' : 'Exited',
        ];
      })
    );
  };

  const exportUserSessionsCSV = () => {
    const u = userMap[activityUser];
    const name = u ? `${u.lastName}_${u.firstName}` : 'visitor';
    downloadCSV(`sessions-${name}.csv`,
      ['Purpose', 'Entry Time', 'Exit Time', 'Status'],
      selectedUserSessions.map(s => [
        s.purpose || '',
        fmtDt(s.entryTime),
        s.active ? 'Still Inside' : fmtDt(s.exitTime),
        s.active ? 'Active' : s.forcedLogout ? 'Force-Exited' : 'Exited',
      ])
    );
  };

  const MN = { fontFamily:"'IBM Plex Mono',monospace" };
  const PP = { fontFamily:"'Poppins',sans-serif" };
  const SR = { fontFamily:"'Playfair Display',serif" };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'40vh', flexDirection:'column', gap:16 }}>
      <div style={{ width:32, height:32, border:'3px solid var(--gold-border)', borderTopColor:'var(--gold)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <p style={{ ...MN, fontSize:12, color:'var(--text-muted)' }}>Loading reports…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        tr.log-row:hover td { background: var(--row-hover-bg) !important; color: var(--row-hover-text) !important; }
      `}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, paddingBottom:20, borderBottom:'1px solid var(--divider)' }}>
        <div>
          <p style={{ ...MN, fontSize:10, letterSpacing:'0.16em', textTransform:'uppercase', color:'var(--text-dim)', marginBottom:6 }}>Administration</p>
          <h1 style={{ ...SR, fontSize:'clamp(22px,3.5vw,30px)', fontWeight:700, color:'var(--text-primary)', marginBottom:8 }}>System Reports</h1>
          {lastFetched && (
            <p style={{ ...MN, fontSize:10, color:'var(--text-dim)' }}>
              Last fetched {lastFetched.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' })}
            </p>
          )}
        </div>
        <button onClick={() => fetchAll(true)} disabled={refreshing}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px', borderRadius:9, background:'var(--gold-soft)', border:'1px solid var(--gold-border)', color:'var(--gold)', ...MN, fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.6 : 1, flexShrink:0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}>
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          {refreshing ? 'Refreshing…' : 'Refresh Data'}
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--divider)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{ padding:'10px 20px', ...MN, fontSize:11, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', cursor:'pointer', background:'none', border:'none', transition:'all 0.15s',
              borderBottom: activeTab === t.key ? '2px solid var(--gold)' : '2px solid transparent',
              color: activeTab === t.key ? 'var(--gold)' : 'var(--text-dim)',
              marginBottom: -1,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button onClick={exportOverviewCSV}
              style={{ padding:'8px 16px', borderRadius:8, background:'var(--surface)', border:'1px solid var(--card-border)', color:'var(--text-muted)', cursor:'pointer', ...MN, fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase' }}>
              Export CSV
            </button>
          </div>

          {/* Users */}
          <div>
            <p style={{ ...MN, fontSize:10, letterSpacing:'0.14em', textTransform:'uppercase', color:'var(--text-dim)', marginBottom:12 }}>Users</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12 }}>
              <StatCard label="Total Users"      value={stats.totalUsers}  hint="View all users"
                onClick={() => navigate('/admin/users', { state: { filterRole: 'all' } })} />
              <StatCard label="Total Visitors"   value={stats.visitors}    accent="blue"   hint="View all visitors"
                onClick={() => navigate('/admin/users', { state: { filterRole: 'visitor' } })} />
              <StatCard label="Student Visitors" value={stats.students}    accent="blue"   hint="View student visitors"
                onClick={() => navigate('/admin/users', { state: { filterRole: 'visitor', filterVisitorType: 'student' } })} />
              <StatCard label="Faculty Visitors" value={stats.faculty}     accent="blue"   hint="View faculty visitors"
                onClick={() => navigate('/admin/users', { state: { filterRole: 'visitor', filterVisitorType: 'faculty' } })} />
              <StatCard label="Staff & Admin"    value={stats.staffAdmins} accent="gold"   hint="View staff and admins"
                onClick={() => navigate('/admin/users', { state: { filterRole: 'staff' } })} />
            </div>
          </div>

          {/* Library Logger */}
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <p style={{ ...MN, fontSize:10, letterSpacing:'0.14em', textTransform:'uppercase', color:'var(--text-dim)' }}>Library Logger</p>
              <button onClick={exportSessionsCSV}
                style={{ padding:'7px 14px', borderRadius:8, background:'var(--surface)', border:'1px solid var(--card-border)', color:'var(--text-muted)', cursor:'pointer', ...MN, fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase' }}>
                Export Sessions CSV
              </button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12 }}>
              <StatCard label="Total Log-Ins"    value={stats.totalSessions}  accent="blue"  hint="View visit history"
                onClick={() => navigate('/admin/logger', { state: { initialTab: 'history' } })} />
              <StatCard label="Currently Inside" value={stats.activeSessions} accent="green" hint="View live sessions"
                onClick={() => navigate('/admin/logger', { state: { initialTab: 'live' } })} />
            </div>
          </div>

          {/* Charts */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Line chart — full width */}
            <ChartCard title="Visitor Log-Ins per Day" subtitle="Last 14 days" hint="View visit history" onClick={() => navigate('/admin/logger', { state: { initialTab: 'history' } })}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={sessionsByDay} margin={{ top:4, right:8, left:-16, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize:10 }} />
                  <YAxis tick={{ fontSize:10 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="Log-Ins" stroke="var(--gold)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Bar charts — side by side */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:16 }}>
              <ChartCard title="Visit Purpose Distribution" hint="View visit history by purpose" onClick={() => navigate('/admin/logger', { state: { initialTab: 'history' } })}>
                {purposeDist.length === 0
                  ? <p style={{ ...PP, fontSize:13, color:'var(--text-dim)', textAlign:'center', padding:'32px 0' }}>No data yet.</p>
                  : (
                    <ResponsiveContainer width="100%" height={Math.max(180, purposeDist.length * 32)}>
                      <BarChart data={purposeDist} layout="vertical" margin={{ top:0, right:16, left:8, bottom:0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize:10 }} allowDecimals={false} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize:10 }} width={120} />
                        <Tooltip />
                        <Bar dataKey="value" name="Visits" fill="var(--gold)" radius={[0,3,3,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                }
              </ChartCard>

              {collegeDist.length > 0 && (
                <ChartCard title="Visitors by College" hint="View visitors in User Management" onClick={() => navigate('/admin/users', { state: { filterRole: 'visitor' } })}>
                  <ResponsiveContainer width="100%" height={Math.max(220, collegeDist.length * 32)}>
                    <BarChart data={collegeDist} layout="vertical" margin={{ top:0, right:16, left:0, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize:10 }} allowDecimals={false} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize:9 }} width={150} interval={0} />
                      <Tooltip />
                      <Bar dataKey="value" name="Visitors" fill="var(--blue)" radius={[0,3,3,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── VISITOR ACTIVITY TAB ── */}
      {activeTab === 'activity' && (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <p style={{ ...PP, fontSize:14, color:'var(--text-muted)' }}>
            Select a visitor to view their complete library visit log.
          </p>

          {/* Visitor selector */}
          <div style={{ position:'relative', maxWidth:480 }}>
            <input
              placeholder="Search by name or ID number…"
              value={studentSearch}
              onFocus={() => setStudentDropOpen(true)}
              onBlur={() => setTimeout(() => setStudentDropOpen(false), 150)}
              onChange={e => { setStudentSearch(e.target.value); setStudentDropOpen(true); }}
              style={{ width:'100%', background:'var(--input-bg)', border:'1px solid var(--input-border)', borderRadius:10, padding:'11px 14px', fontSize:14, color:'var(--text-primary)', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
            />
            {studentDropOpen && (
              <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:20, background:'var(--card)', border:'1px solid var(--card-border)', borderRadius:10, boxShadow:'var(--shadow-modal)', maxHeight:240, overflowY:'auto', marginTop:4 }}>
                {visitorUsers
                  .filter(u => {
                    const q = studentSearch.toLowerCase();
                    return !q || `${u.lastName} ${u.firstName}`.toLowerCase().includes(q) || (u.idNumber||'').includes(q);
                  })
                  .slice(0, 30)
                  .map(u => (
                    <button key={u.id} onMouseDown={() => { setActivityUser(u.id); setStudentSearch(`${u.lastName}, ${u.firstName}`); setStudentDropOpen(false); }}
                      style={{ width:'100%', padding:'10px 14px', textAlign:'left', background:'none', border:'none', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid var(--divider)' }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--surface-hover)'}
                      onMouseLeave={e=>e.currentTarget.style.background='none'}>
                      <span style={{ ...PP, fontSize:13, color:'var(--text-primary)', fontWeight:500 }}>{u.lastName}, {u.firstName}</span>
                      <span style={{ ...MN, fontSize:11, color:'var(--text-dim)' }}>{u.idNumber || u.visitorType}</span>
                    </button>
                  ))
                }
              </div>
            )}
          </div>

          {activityUser && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <p style={{ ...SR, fontSize:18, fontWeight:700, color:'var(--text-primary)' }}>Visit History</p>
                  <p style={{ ...PP, fontSize:13, color:'var(--text-muted)' }}>{selectedUserSessions.length} record{selectedUserSessions.length!==1?'s':''} total</p>
                </div>
                <button onClick={exportUserSessionsCSV}
                  style={{ padding:'8px 14px', borderRadius:8, background:'var(--surface)', border:'1px solid var(--card-border)', color:'var(--text-muted)', cursor:'pointer', ...MN, fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase' }}>
                  Export CSV
                </button>
              </div>

              {selectedUserSessions.length === 0 ? (
                <p style={{ ...PP, fontSize:14, color:'var(--text-dim)', padding:24 }}>No visit records found for this visitor.</p>
              ) : (
                <div style={{ borderRadius:12, overflow:'hidden', border:'1px solid var(--card-border)' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr>
                        {['Purpose','Entry','Exit','Status'].map(h => (
                          <th key={h} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, letterSpacing:'0.14em', color:'var(--text-muted)', textTransform:'uppercase', padding:'12px 14px', textAlign:'left', background:'var(--thead-bg)', borderBottom:'1px solid var(--divider)', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedUserSessions.map(s => (
                        <tr key={s.id} className="log-row">
                          <td style={{ padding:'11px 14px', fontSize:13, color:'var(--text-body)', borderBottom:'1px solid var(--row-border)' }}>{s.purpose || '—'}</td>
                          <td style={{ padding:'11px 14px', fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'var(--text-muted)', borderBottom:'1px solid var(--row-border)' }}>{fmtDt(s.entryTime)}</td>
                          <td style={{ padding:'11px 14px', fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'var(--text-muted)', borderBottom:'1px solid var(--row-border)' }}>{s.active ? '—' : fmtDt(s.exitTime)}</td>
                          <td style={{ padding:'11px 14px', borderBottom:'1px solid var(--row-border)' }}>
                            {s.active
                              ? <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, letterSpacing:'0.1em', textTransform:'uppercase', padding:'3px 10px', borderRadius:20, background:'var(--green-soft)', border:'1px solid var(--green-border)', color:'var(--green)' }}>Active</span>
                              : s.forcedLogout
                              ? <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, letterSpacing:'0.1em', textTransform:'uppercase', padding:'3px 10px', borderRadius:20, background:'var(--red-soft)', border:'1px solid var(--red-border)', color:'var(--red)' }}>Force-Exited</span>
                              : <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, letterSpacing:'0.1em', textTransform:'uppercase', padding:'3px 10px', borderRadius:20, background:'var(--surface)', border:'1px solid var(--card-border)', color:'var(--text-dim)' }}>Exited</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
