// src/components/admin/AdminDashboard.jsx
// Admin dashboard with visitor statistics — day/week/date range, filter by reason/college/employee type
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

const PP = { fontFamily:"'Poppins',sans-serif" };
const SR = { fontFamily:"'Playfair Display',serif" };
const MN = { fontFamily:"'IBM Plex Mono',monospace" };

function StatCard({ label, value, color = 'gold', sub }) {
  const c = color === 'gold' ? 'var(--gold)' : color === 'green' ? 'var(--green)' : color === 'red' ? 'var(--red)' : 'var(--blue)';
  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--card-border)', borderLeft:`3px solid ${c}`, borderRadius:12, padding:'18px 20px', boxShadow:'var(--shadow-card)' }}>
      <p style={{...PP,fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>{label}</p>
      <p style={{...SR,fontSize:36,fontWeight:700,color:'var(--text-primary)',lineHeight:1}}>{value}</p>
      {sub && <p style={{...PP,fontSize:12,color:'var(--text-dim)',marginTop:6}}>{sub}</p>}
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
  if (preset === 'today') {
    return d.toDateString() === now.toDateString();
  }
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

  // Live stats
  const [inLib,    setInLib]    = useState(0);
  const [totalLog, setTotalLog] = useState(0);
  const [users,    setUsers]    = useState({ total:0, visitors:0, staff:0 });

  // Logger history for stats cards
  const [logs,     setLogs]     = useState([]);
  const [userMap,  setUserMap]  = useState({});
  const [loading,  setLoading]  = useState(true);

  // Filters
  const [datePreset,  setDatePreset]  = useState('today'); // today | week | custom
  const [customFrom,  setCustomFrom]  = useState('');
  const [customTo,    setCustomTo]    = useState('');
  const [filterReason,  setFilterReason]  = useState('');
  const [filterCollege, setFilterCollege] = useState('');
  const [filterEmpType, setFilterEmpType] = useState(''); // '' | 'student' | 'faculty'

  useEffect(() => {
    // Live listeners
    const u1 = onSnapshot(query(collection(db,'logger'),where('active','==',true)), s => setInLib(s.size));
    const u2 = onSnapshot(collection(db,'users'), s => {
      const docs = s.docs.map(d=>d.data());
      const map = {};
      docs.forEach(d => { map[d.uid] = d; });
      setUserMap(map);
      setUsers({
        total: docs.length,
        visitors: docs.filter(u => u.role === 'visitor').length,
        staff: docs.filter(u => u.role === 'staff' || u.role === 'admin').length,
      });
    });
    // One-time fetch of completed logs
    getDocs(collection(db,'logger')).then(snap => {
      const rows = snap.docs.map(d=>({id:d.id,...d.data()}));
      setLogs(rows);
      setTotalLog(rows.filter(r=>!r.active).length);
      setLoading(false);
    });
    return () => { u1(); u2(); };
  }, []);

  // Filtered logs for stats
  const filteredLogs = useMemo(() => {
    return logs.filter(r => {
      if (r.active) return false; // only completed visits
      if (!inRange(r.entryTime, datePreset, customFrom, customTo)) return false;
      if (filterReason && r.purpose !== filterReason) return false;
      const u = userMap[r.uid];
      if (filterCollege && (u?.college || '') !== filterCollege) return false;
      if (filterEmpType && (u?.visitorType || '') !== filterEmpType) return false;
      return true;
    });
  }, [logs, userMap, datePreset, customFrom, customTo, filterReason, filterCollege, filterEmpType]);

  // Derive dropdown options from all logs
  const allReasons  = useMemo(() => [...new Set(logs.map(r=>r.purpose).filter(Boolean))].sort(), [logs]);
  const allColleges = useMemo(() => [...new Set(Object.values(userMap).map(u=>u.college).filter(Boolean))].sort(), [userMap]);

  // Stats from filtered logs
  const studentVisits = filteredLogs.filter(r => (userMap[r.uid]?.visitorType || 'student') === 'student').length;
  const facultyVisits = filteredLogs.filter(r => userMap[r.uid]?.visitorType === 'faculty').length;

  const reasonBreakdown = useMemo(() => {
    const map = {};
    filteredLogs.forEach(r => { map[r.purpose||'Unknown'] = (map[r.purpose||'Unknown']||0)+1; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  }, [filteredLogs]);

  const inputSt = { background:'var(--input-bg)', border:'1px solid var(--input-border)', borderRadius:8, padding:'8px 12px', fontSize:13, color:'var(--text-primary)', fontFamily:'inherit', outline:'none', cursor:'pointer' };

  return (
    <div style={{ animation:'fadeUp 0.3s ease both' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom:32 }}>
        <p style={{...PP,fontSize:13,fontWeight:600,color:'var(--gold)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Administrator</p>
        <h1 style={{...SR,fontSize:'clamp(24px,4vw,32px)',fontWeight:700,color:'var(--text-primary)',marginBottom:6}}>{getGreeting(userProfile?.firstName)}</h1>
        <p style={{...PP,fontSize:14,color:'var(--text-muted)'}}>NEU Library Visitor Statistics</p>
        <div style={{marginTop:16,height:1,background:'linear-gradient(90deg,var(--gold-border),transparent)'}} />
      </div>

      {/* Live overview */}
      <p style={{...PP,fontSize:11,fontWeight:600,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Live Overview</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:32}}>
        <StatCard label="In Library Now"  value={inLib}          color="green" sub="Currently checked in" />
        <StatCard label="Total Visitors"  value={users.visitors} color="blue"  sub="Registered visitors" />
        <StatCard label="Staff & Admin"   value={users.staff}    color="gold"  sub="Library personnel" />
        <StatCard label="Total Visits"    value={totalLog}       color="blue"  sub="All completed visits" />
      </div>

      {/* Visitor Statistics Section */}
      <div style={{ background:'var(--card)', border:'1px solid var(--card-border)', borderRadius:14, padding:'24px', marginBottom:24, boxShadow:'var(--shadow-card)' }}>
        <p style={{...SR,fontSize:20,fontWeight:700,color:'var(--text-primary)',marginBottom:4}}>Visitor Statistics</p>
        <p style={{...PP,fontSize:13,color:'var(--text-muted)',marginBottom:20}}>Filter and analyze library visit data</p>

        {/* Filter row */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:20 }}>
          {/* Date preset */}
          <div style={{ display:'flex', gap:6 }}>
            {[
              { key:'today', label:'Today' },
              { key:'week',  label:'This Week' },
              { key:'custom',label:'Custom' },
              { key:'all',   label:'All Time' },
            ].map(({ key, label }) => (
              <button key={key} type="button" onClick={() => setDatePreset(key)}
                style={{ padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:"'Poppins',sans-serif",
                  background: datePreset===key ? 'var(--gold-soft)' : 'var(--surface)',
                  border:`1px solid ${datePreset===key ? 'var(--gold-border)' : 'var(--card-border)'}`,
                  color: datePreset===key ? 'var(--gold)' : 'var(--text-muted)',
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* Reason filter */}
          <select style={inputSt} value={filterReason} onChange={e => setFilterReason(e.target.value)}>
            <option value="">All Reasons</option>
            {allReasons.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          {/* College filter */}
          <select style={inputSt} value={filterCollege} onChange={e => setFilterCollege(e.target.value)}>
            <option value="">All Colleges</option>
            {allColleges.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Employee/visitor type filter */}
          <select style={inputSt} value={filterEmpType} onChange={e => setFilterEmpType(e.target.value)}>
            <option value="">All Types</option>
            <option value="student">Students</option>
            <option value="faculty">Faculty / Employees</option>
          </select>
        </div>

        {/* Custom date range */}
        {datePreset === 'custom' && (
          <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
            <div>
              <label style={{...MN,fontSize:10,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.1em',display:'block',marginBottom:4}}>From</label>
              <input type="date" style={inputSt} value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div>
              <label style={{...MN,fontSize:10,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.1em',display:'block',marginBottom:4}}>To</label>
              <input type="date" style={inputSt} value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign:'center', padding:'24px 0' }}>
            <div style={{ width:28,height:28,border:'2px solid var(--gold-border)',borderTopColor:'var(--gold)',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto 8px' }} />
            <p style={{...PP,fontSize:12,color:'var(--text-muted)'}}>Loading visitor data…</p>
          </div>
        ) : (
          <>
            {/* Stats cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:20 }}>
              <StatCard label="Total Visits"     value={filteredLogs.length} color="gold" />
              <StatCard label="Student Visits"   value={studentVisits}       color="blue" />
              <StatCard label="Faculty Visits"   value={facultyVisits}       color="blue" />
            </div>

            {/* Reason breakdown */}
            {reasonBreakdown.length > 0 && (
              <div>
                <p style={{...PP,fontSize:12,fontWeight:600,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:12}}>Visits by Reason</p>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {reasonBreakdown.map(([reason, count]) => {
                    const pct = filteredLogs.length > 0 ? Math.round((count / filteredLogs.length) * 100) : 0;
                    return (
                      <div key={reason}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                          <span style={{...PP,fontSize:13,color:'var(--text-body)'}}>{reason}</span>
                          <span style={{...MN,fontSize:12,color:'var(--text-muted)'}}>{count} <span style={{color:'var(--text-dim)'}}>({pct}%)</span></span>
                        </div>
                        <div style={{ height:6, borderRadius:3, background:'var(--surface)', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background:'var(--gold)', borderRadius:3, transition:'width 0.5s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredLogs.length === 0 && (
              <p style={{...PP,fontSize:14,color:'var(--text-dim)',textAlign:'center',padding:'16px 0'}}>No visits found for the selected filters.</p>
            )}
          </>
        )}
      </div>

      {/* Quick Access */}
      <p style={{...PP,fontSize:11,fontWeight:600,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Quick Access</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
        {[
          { label:'QR Scanner',      sub:'Check visitors in and out', path:'/staff/qr-logger', color:'var(--green)' },
          { label:'Library Logger',  sub:'View active sessions',      path:'/logger',           color:'var(--gold)'  },
          { label:'User Management', sub:'Manage accounts and roles', path:'/admin/users',      color:'var(--blue)'  },
          { label:'Reports',         sub:'Analytics and exports',     path:'/admin/reports',    color:'var(--gold)'  },
        ].map(({ label, sub, path, color }) => (
          <button key={path} onClick={() => navigate(path)}
            style={{ background:'var(--card)', border:'1px solid var(--card-border)', borderTop:`3px solid ${color}`, borderRadius:12, padding:'18px 20px', textAlign:'left', cursor:'pointer', transition:'all 0.15s', boxShadow:'var(--shadow-card)' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--surface-hover)'}
            onMouseLeave={e=>e.currentTarget.style.background='var(--card)'}>
            <p style={{...PP,fontSize:15,fontWeight:600,color:'var(--text-primary)',marginBottom:4}}>{label}</p>
            <p style={{...PP,fontSize:13,color:'var(--text-muted)'}}>{sub}</p>
          </button>
        ))}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
