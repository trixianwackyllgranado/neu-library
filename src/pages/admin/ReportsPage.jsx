// src/pages/admin/ReportsPage.jsx
import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';

const COLORS = ['#1d4ed8','#b7952a','#4ade80','#f87171','#60a5fa','#a78bfa'];

const NAV_MAP = {
  totalUsers:     { path: '/admin/users' },
  students:       { path: '/staff/students' },
  staffAdmins:    { path: '/admin/users' },
  totalBooks:     { path: '/catalog' },
  totalBorrows:   { path: '/borrows' },
  activeBorrows:  { path: '/borrows', state: { tab: 'active' } },
  pendingBorrows: { path: '/borrows', state: { tab: 'pending' } },
  overdueBorrows: { path: '/borrows', state: { tab: 'overdue' } },
  totalSessions:  { path: '/logger' },
  activeSessions: { path: '/logger' },
};

const TABS = [
  { key: 'overview',  label: 'Overview' },
  { key: 'catalog',   label: 'Book Catalog Activity' },
  { key: 'activity',  label: 'User Activity' },
];

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

export default function ReportsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading,   setLoading]   = useState(true);

  // Raw data — updated by onSnapshot
  const [users,    setUsers]    = useState([]);
  const [books,    setBooks]    = useState([]);
  const [borrows,  setBorrows]  = useState([]);
  const [sessions, setSessions] = useState([]);
  const [bookLogs, setBookLogs] = useState([]);

  // Catalog activity filters
  const [catalogAction, setCatalogAction] = useState('all');
  const [catalogSearch, setCatalogSearch] = useState('');

  // User activity filters
  const [activityUser, setActivityUser] = useState('');
  const [activityType, setActivityType] = useState('borrows');

  // ── Real-time listeners ───────────────────────────────────────────────────
  useEffect(() => {
    let ready = 0;
    const check = () => { ready++; if (ready >= 5) setLoading(false); };

    const unsubs = [
      onSnapshot(collection(db, 'users'), snap => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        check();
      }),
      onSnapshot(collection(db, 'books'), snap => {
        setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        check();
      }),
      onSnapshot(
        query(collection(db, 'borrows'), orderBy('borrowDate', 'desc')),
        snap => { setBorrows(snap.docs.map(d => ({ id: d.id, ...d.data() }))); check(); }
      ),
      onSnapshot(
        query(collection(db, 'logger'), orderBy('entryTime', 'desc')),
        snap => { setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() }))); check(); }
      ),
      onSnapshot(
        query(collection(db, 'bookLogs'), orderBy('timestamp', 'desc')),
        snap => { setBookLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))); check(); },
        () => { setBookLogs([]); check(); } // bookLogs collection may not exist yet
      ),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  // ── Derived stats (recomputed on every data change) ───────────────────────
  const now     = new Date();
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  const active  = borrows.filter(b => b.status === 'active');
  const overdue = active.filter(b => b.dueDate?.toDate ? b.dueDate.toDate() < now : false);
  const pending = borrows.filter(b => b.status === 'pending');

  const stats = {
    totalUsers:     users.length,
    students:       users.filter(u => u.role === 'student').length,
    staffAdmins:    users.filter(u => u.role === 'staff' || u.role === 'admin').length,
    totalBooks:     books.length,
    totalBorrows:   borrows.length,
    activeBorrows:  active.length,
    overdueBorrows: overdue.length,
    pendingBorrows: pending.length,
    totalSessions:  sessions.length,
    activeSessions: sessions.filter(s => s.active).length,
  };

  const borrowStatus = [
    { name: 'Active',   value: active.length - overdue.length },
    { name: 'Overdue',  value: overdue.length },
    { name: 'Pending',  value: pending.length },
    { name: 'Returned', value: borrows.filter(b => b.status === 'returned').length },
    { name: 'Rejected', value: borrows.filter(b => b.status === 'rejected').length },
  ].filter(d => d.value > 0);

  // Borrows per day (last 14 days)
  const borrowsByDay = (() => {
    const dayMap = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      dayMap[d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })] = 0;
    }
    borrows.forEach(b => {
      const d = b.borrowDate?.toDate?.(); if (!d) return;
      const key = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
      if (key in dayMap) dayMap[key]++;
    });
    return Object.entries(dayMap).map(([date, count]) => ({ date, count }));
  })();

  // Sessions per day (last 14 days)
  const sessionsByDay = (() => {
    const sesMap = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      sesMap[d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })] = 0;
    }
    sessions.forEach(s => {
      const d = s.entryTime?.toDate?.(); if (!d) return;
      const key = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
      if (key in sesMap) sesMap[key]++;
    });
    return Object.entries(sesMap).map(([date, count]) => ({ date, count }));
  })();

  const purposeDist = (() => {
    const m = {};
    sessions.forEach(s => { const p = s.purpose || 'Unknown'; m[p] = (m[p]||0)+1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  })();

  const collegeDist = (() => {
    const m = {};
    users.filter(u => u.role === 'student').forEach(u => {
      const c = u.college || 'Unknown'; m[c] = (m[c]||0)+1;
    });
    return Object.entries(m).sort((a,b)=>b[1]-a[1])
      .map(([name, value]) => ({ name: name.replace('College of ',''), value }));
  })();

  // ── Catalog tab ───────────────────────────────────────────────────────────
  const catalogCounts = {
    all:           bookLogs.length,
    added:         bookLogs.filter(l => l.action === 'added').length,
    edited:        bookLogs.filter(l => l.action === 'edited').length,
    deleted:       bookLogs.filter(l => l.action === 'deleted').length,
    bulk_imported: bookLogs.filter(l => l.action === 'bulk_imported').length,
  };

  const filteredCatalogLogs = bookLogs.filter(l => {
    const matchAction = catalogAction === 'all' || l.action === catalogAction;
    const matchSearch = !catalogSearch ||
      l.bookTitle?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      l.isbn?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      l.byName?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      l.category?.toLowerCase().includes(catalogSearch.toLowerCase());
    return matchAction && matchSearch;
  });

  // ── User activity tab ─────────────────────────────────────────────────────
  const studentUsers = users
    .filter(u => u.role === 'student')
    .sort((a,b) => (a.lastName||'').localeCompare(b.lastName||''));

  // User activity search combo-box state
  const [userSearch,       setUserSearch]       = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const selectedUserObj = studentUsers.find(u => u.id === activityUser);

  const filteredUserOptions = studentUsers.filter(u => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      `${u.lastName} ${u.firstName}`.toLowerCase().includes(q) ||
      (u.idNumber || '').replace(/-/g, '').includes(q.replace(/-/g, '')) ||
      (u.course || '').toLowerCase().includes(q)
    );
  });

  const selectedUserBorrows  = activityUser ? borrows.filter(b => b.userId === activityUser)  : [];
  const selectedUserSessions = activityUser ? sessions.filter(s => s.uid === activityUser) : [];

  // ── Formatters ────────────────────────────────────────────────────────────
  const fmt   = ts => { if (!ts) return '—'; const d = ts.toDate?ts.toDate():new Date(ts); return d.toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}); };
  const fmtDt = ts => { if (!ts) return '—'; const d = ts.toDate?ts.toDate():new Date(ts); return d.toLocaleString('en-PH',{dateStyle:'short',timeStyle:'short'}); };

  // ── CSV Exports ───────────────────────────────────────────────────────────
  const exportOverviewCSV = () => {
    downloadCSV('overview-report.csv',
      ['Metric', 'Value'],
      [
        ['Total Users',       stats.totalUsers],
        ['Students',          stats.students],
        ['Staff & Admins',    stats.staffAdmins],
        ['Books in Catalog',  stats.totalBooks],
        ['All-Time Borrows',  stats.totalBorrows],
        ['Active Borrows',    stats.activeBorrows],
        ['Overdue Borrows',   stats.overdueBorrows],
        ['Pending Requests',  stats.pendingBorrows],
        ['Total Log-Ins',     stats.totalSessions],
        ['Currently Inside',  stats.activeSessions],
      ]
    );
  };

  const exportBorrowsCSV = () => {
    downloadCSV('all-borrows.csv',
      ['Book Title', 'Student Name', 'ID Number', 'Borrow Date', 'Due Date', 'Return Date', 'Status'],
      borrows.map(b => {
        const u = userMap[b.userId];
        return [
          b.bookTitle || '',
          u ? `${u.lastName}, ${u.firstName}` : '—',
          u?.idNumber || '—',
          fmt(b.borrowDate),
          fmt(b.dueDate),
          fmt(b.returnDate),
          b.status || '',
        ];
      })
    );
  };

  const exportSessionsCSV = () => {
    downloadCSV('library-sessions.csv',
      ['Student Name', 'ID Number', 'Purpose', 'Entry Time', 'Exit Time', 'Status'],
      sessions.map(s => {
        const u = userMap[s.uid];
        return [
          u ? `${u.lastName}, ${u.firstName}` : '—',
          u?.idNumber || '—',
          s.purpose || '',
          fmtDt(s.entryTime),
          s.active ? 'Still Inside' : fmtDt(s.exitTime),
          s.active ? 'Active' : s.forcedLogout ? 'Force-Exited' : 'Exited',
        ];
      })
    );
  };

  const exportCatalogLogsCSV = () => {
    downloadCSV('catalog-activity-log.csv',
      ['Action', 'Book Title', 'ISBN', 'Category', 'Staff Member', 'Date & Time'],
      filteredCatalogLogs.map(l => [
        l.action === 'bulk_imported' ? 'Imported' : (l.action || ''),
        l.bookTitle || '',
        l.isbn || '',
        l.category || '',
        l.byName || '',
        fmtDt(l.timestamp),
      ])
    );
  };

  const exportUserBorrowsCSV = () => {
    const u = userMap[activityUser];
    const name = u ? `${u.lastName}_${u.firstName}` : 'student';
    downloadCSV(`borrows-${name}.csv`,
      ['Book Title', 'Borrow Date', 'Due Date', 'Return Date', 'Status'],
      selectedUserBorrows.map(b => [
        b.bookTitle || '',
        fmt(b.borrowDate),
        fmt(b.dueDate),
        fmt(b.returnDate),
        b.status || '',
      ])
    );
  };

  const exportUserSessionsCSV = () => {
    const u = userMap[activityUser];
    const name = u ? `${u.lastName}_${u.firstName}` : 'student';
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

  const go = (key) => {
    const nav = NAV_MAP[key]; if (!nav) return;
    navigate(nav.path, nav.state ? { state: nav.state } : undefined);
  };

  if (loading) return <div className="py-20 text-center font-mono text-sm text-gray-400">Loading reports…</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-5 border-b border-gray-200 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400 mb-1">Administration</p>
          <h1 className="page-title">System Reports</h1>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Live</span>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 text-xs font-mono font-semibold tracking-widest uppercase transition-colors ${
              activeTab === t.key
                ? 'border-b-2 border-primary-600 text-primary-700'
                : 'text-gray-400 hover:text-gray-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════ OVERVIEW TAB ══════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="flex justify-end">
            <button className="btn-secondary text-xs" onClick={exportOverviewCSV}>Export Overview CSV</button>
          </div>

          {/* Users */}
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400 mb-3">Users</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard label="Total Users"    value={stats.totalUsers}  onClick={() => go('totalUsers')} />
              <StatCard label="Students"       value={stats.students}    onClick={() => go('students')} />
              <StatCard label="Staff & Admins" value={stats.staffAdmins} onClick={() => go('staffAdmins')} />
            </div>
          </div>

          {/* Catalog */}
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400 mb-3">Catalog</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard label="Books in Catalog"   value={stats.totalBooks} onClick={() => go('totalBooks')} />
              <StatCard label="Added (All Time)"   value={catalogCounts.added + catalogCounts.bulk_imported} onClick={() => { setActiveTab('catalog'); setCatalogAction('added'); }} />
              <StatCard label="Deleted (All Time)" value={catalogCounts.deleted} onClick={() => { setActiveTab('catalog'); setCatalogAction('deleted'); }} accent="red" />
            </div>
          </div>

          {/* Borrowing */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Borrowing</p>
              <button className="btn-secondary text-[10px]" onClick={exportBorrowsCSV}>Export All Borrows CSV</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="All-Time Borrows"  value={stats.totalBorrows}   onClick={() => go('totalBorrows')} />
              <StatCard label="Active Borrows"    value={stats.activeBorrows}  onClick={() => go('activeBorrows')} />
              <StatCard label="Pending Requests"  value={stats.pendingBorrows} onClick={() => go('pendingBorrows')} accent="gold" />
              <StatCard label="Overdue Now"       value={stats.overdueBorrows} onClick={() => go('overdueBorrows')} accent="red" />
            </div>
          </div>

          {/* Logger */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400">Library Logger</p>
              <button className="btn-secondary text-[10px]" onClick={exportSessionsCSV}>Export All Sessions CSV</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard label="Total Log-Ins"    value={stats.totalSessions}  onClick={() => go('totalSessions')} />
              <StatCard label="Currently Inside" value={stats.activeSessions} onClick={() => go('activeSessions')} accent="green" />
            </div>
          </div>

          {/* Charts row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Borrows per Day" subtitle="Last 14 days">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={borrowsByDay} margin={{ top:4, right:8, left:-16, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize:10 }} interval={1} />
                  <YAxis tick={{ fontSize:10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Borrows" fill="#1d4ed8" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Library Log-Ins per Day" subtitle="Last 14 days">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={sessionsByDay} margin={{ top:4, right:8, left:-16, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize:10 }} interval={1} />
                  <YAxis tick={{ fontSize:10 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="Sessions" stroke="#b7952a" strokeWidth={2} dot={{ r:3 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Charts row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ChartCard title="Borrow Status Breakdown">
              {borrowStatus.length === 0
                ? <p className="text-sm text-gray-400 py-8 text-center">No borrow data yet.</p>
                : <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={borrowStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                        label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                        {borrowStatus.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>}
            </ChartCard>
            <ChartCard title="Visit Purpose Distribution">
              {purposeDist.length === 0
                ? <p className="text-sm text-gray-400 py-8 text-center">No session data yet.</p>
                : <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={purposeDist} layout="vertical" margin={{ top:4, right:8, left:60, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize:10 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize:9 }} width={60} />
                      <Tooltip />
                      <Bar dataKey="value" name="Visits" fill="#b7952a" radius={[0,3,3,0]} />
                    </BarChart>
                  </ResponsiveContainer>}
            </ChartCard>
            <ChartCard title="Students by College">
              {collegeDist.length === 0
                ? <p className="text-sm text-gray-400 py-8 text-center">No student data yet.</p>
                : <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={collegeDist} layout="vertical" margin={{ top:4, right:8, left:60, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize:10 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize:9 }} width={60} />
                      <Tooltip />
                      <Bar dataKey="value" name="Students" fill="#1d4ed8" radius={[0,3,3,0]} />
                    </BarChart>
                  </ResponsiveContainer>}
            </ChartCard>
          </div>

          {/* Recent sessions table */}
          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="section-head">Recent Library Sessions</h2>
                <p className="text-xs text-gray-400 mt-0.5">Last 30 entries</p>
              </div>
              <button className="btn-ghost text-xs" onClick={() => navigate('/logger')}>View Logger →</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th className="th">Student</th>
                    <th className="th">ID Number</th>
                    <th className="th">Purpose</th>
                    <th className="th">Entry</th>
                    <th className="th">Exit</th>
                    <th className="th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.slice(0, 30).map(s => {
                    const u = userMap[s.uid];
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="td font-semibold text-sm">{u ? `${u.lastName}, ${u.firstName}` : '—'}</td>
                        <td className="td font-mono text-xs">{u?.idNumber ?? '—'}</td>
                        <td className="td text-xs">{s.purpose}</td>
                        <td className="td font-mono text-xs">{fmtDt(s.entryTime)}</td>
                        <td className="td font-mono text-xs">{s.active ? '—' : fmtDt(s.exitTime)}</td>
                        <td className="td">
                          {s.active ? <span className="badge-green badge">Active</span>
                            : s.forcedLogout ? <span className="badge-red badge">Force-Exited</span>
                            : <span className="badge-gray badge">Exited</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {sessions.length === 0 && (
                    <tr><td colSpan={6} className="td text-center text-gray-400 py-6">No sessions recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ CATALOG ACTIVITY TAB ══════════════════ */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Changes"  value={catalogCounts.all}     onClick={() => setCatalogAction('all')} />
            <StatCard label="Books Added"    value={catalogCounts.added + catalogCounts.bulk_imported} onClick={() => setCatalogAction('added')} accent="green" />
            <StatCard label="Books Edited"   value={catalogCounts.edited}  onClick={() => setCatalogAction('edited')} accent="gold" />
            <StatCard label="Books Deleted"  value={catalogCounts.deleted} onClick={() => setCatalogAction('deleted')} accent="red" />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input className="input flex-1" placeholder="Search by title, ISBN, category, or staff name…"
              value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} />
            <div className="flex border border-gray-200 shrink-0">
              {[
                { key:'all', label:'All' },
                { key:'added', label:'Added' },
                { key:'edited', label:'Edited' },
                { key:'deleted', label:'Deleted' },
                { key:'bulk_imported', label:'Imported' },
              ].map(t => (
                <button key={t.key} onClick={() => setCatalogAction(t.key)}
                  className={`px-4 py-2 text-[10px] font-mono font-semibold uppercase tracking-widest transition-colors ${
                    catalogAction === t.key ? 'bg-primary-700 text-white' : 'text-gray-500 hover:bg-gray-50'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
            <button className="btn-secondary shrink-0 text-[10px]" onClick={exportCatalogLogsCSV}>
              Export CSV
            </button>
          </div>

          {(catalogSearch || catalogAction !== 'all') && (
            <p className="text-xs font-mono text-gray-400">
              Showing <strong className="text-gray-700">{filteredCatalogLogs.length}</strong> of {bookLogs.length} events
              <button className="ml-3 text-primary-600 hover:underline"
                onClick={() => { setCatalogSearch(''); setCatalogAction('all'); }}>
                Clear filters
              </button>
            </p>
          )}

          <div className="card p-0 overflow-hidden">
            {filteredCatalogLogs.length === 0 ? (
              <p className="text-sm text-gray-400 p-8 text-center">
                {bookLogs.length === 0
                  ? 'No catalog activity recorded yet. Book additions, edits, and deletions will appear here.'
                  : 'No events match your filters.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr>
                      <th className="th">Action</th>
                      <th className="th">Book Title</th>
                      <th className="th">ISBN</th>
                      <th className="th">Category</th>
                      <th className="th">Staff Member</th>
                      <th className="th">Date & Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCatalogLogs.map(l => (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="td">
                          {l.action === 'added'         && <span className="badge-green badge">Added</span>}
                          {l.action === 'edited'        && <span className="badge-gold badge">Edited</span>}
                          {l.action === 'deleted'       && <span className="badge-red badge">Deleted</span>}
                          {l.action === 'bulk_imported' && <span className="badge badge-blue">Imported</span>}
                        </td>
                        <td className="td font-semibold text-sm">{l.bookTitle || '—'}</td>
                        <td className="td font-mono text-xs">{l.isbn || '—'}</td>
                        <td className="td text-xs">{l.category || '—'}</td>
                        <td className="td text-xs text-gray-600">{l.byName || '—'}</td>
                        <td className="td font-mono text-xs text-gray-400">{fmtDt(l.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════ USER ACTIVITY TAB ══════════════════ */}
      {activeTab === 'activity' && (
        <div className="space-y-6">
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400 mb-1">User Activity Report</p>
            <p className="text-sm text-gray-500">Select a student to view their complete borrow history and library visit log.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Searchable combo-box */}
            <div style={{ position:'relative', flex:1 }}>
              <div
                style={{ display:'flex', alignItems:'center', background:'var(--input-bg)', border:'1px solid var(--input-border)', borderRadius:8, padding:'0 12px', cursor:'text', minHeight:40 }}
                onClick={() => { setUserDropdownOpen(true); }}>
                {selectedUserObj && !userDropdownOpen ? (
                  <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:13, color:'var(--text-primary)', fontFamily:"'Poppins',sans-serif" }}>
                      {selectedUserObj.lastName}, {selectedUserObj.firstName}
                      <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'var(--text-muted)', marginLeft:8 }}>{selectedUserObj.idNumber}</span>
                    </span>
                    <button onClick={e => { e.stopPropagation(); setActivityUser(''); setUserSearch(''); setUserDropdownOpen(false); }}
                      style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:16, lineHeight:1, padding:'0 2px' }}>×</button>
                  </div>
                ) : (
                  <input
                    autoFocus={userDropdownOpen}
                    style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:'var(--text-primary)', padding:'9px 0', fontFamily:"'Poppins',sans-serif" }}
                    placeholder="Search by name, ID number, or course…"
                    value={userSearch}
                    onChange={e => { setUserSearch(e.target.value); setUserDropdownOpen(true); }}
                    onFocus={() => setUserDropdownOpen(true)}
                  />
                )}
              </div>
              {userDropdownOpen && (
                <>
                  <div style={{ position:'fixed', inset:0, zIndex:10 }} onClick={() => setUserDropdownOpen(false)} />
                  <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:20, background:'var(--card)', border:'1px solid var(--card-border)', borderRadius:8, boxShadow:'var(--shadow-modal)', maxHeight:240, overflowY:'auto' }}>
                    {filteredUserOptions.length === 0 ? (
                      <p style={{ padding:'12px 16px', fontSize:13, color:'var(--text-muted)', fontFamily:"'Poppins',sans-serif" }}>No students match "{userSearch}"</p>
                    ) : (
                      filteredUserOptions.map(u => (
                        <button key={u.id} type="button"
                          style={{ width:'100%', textAlign:'left', padding:'10px 16px', borderBottom:'1px solid var(--row-border)', background: activityUser === u.id ? 'var(--gold-soft)' : 'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}
                          onMouseEnter={e => { if (activityUser !== u.id) e.currentTarget.style.background='var(--row-hover-bg)'; }}
                          onMouseLeave={e => { if (activityUser !== u.id) e.currentTarget.style.background='transparent'; }}
                          onClick={() => { setActivityUser(u.id); setUserSearch(''); setUserDropdownOpen(false); }}>
                          <span>
                            <span style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)', fontFamily:"'Poppins',sans-serif" }}>{u.lastName}, {u.firstName}</span>
                            {u.course && <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:8 }}>{u.course}</span>}
                          </span>
                          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'var(--gold)', whiteSpace:'nowrap' }}>{u.idNumber}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex border border-gray-200 shrink-0">
              <button onClick={() => setActivityType('borrows')}
                className={`px-5 py-2 text-[10px] font-mono font-semibold uppercase tracking-widest transition-colors ${
                  activityType==='borrows' ? 'bg-primary-700 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}>
                Borrow History
              </button>
              <button onClick={() => setActivityType('logs')}
                className={`px-5 py-2 text-[10px] font-mono font-semibold uppercase tracking-widest transition-colors ${
                  activityType==='logs' ? 'bg-primary-700 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}>
                Visit Log
              </button>
            </div>
            {activityUser && (
              <button className="btn-secondary shrink-0 text-[10px]"
                onClick={activityType === 'borrows' ? exportUserBorrowsCSV : exportUserSessionsCSV}>
                Export CSV
              </button>
            )}
          </div>

          {!activityUser && (
            <div className="card p-8 text-center">
              <p className="text-sm text-gray-400">Select a student above to view their activity.</p>
            </div>
          )}

          {activityUser && activityType === 'borrows' && (
            <div className="card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="section-head">Borrow History</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedUserBorrows.length} record{selectedUserBorrows.length!==1?'s':''} total
                  {' — '}
                  {selectedUserBorrows.filter(b=>b.status==='active').length} active,{' '}
                  {selectedUserBorrows.filter(b=>b.status==='returned').length} returned,{' '}
                  {selectedUserBorrows.filter(b=>b.status==='pending').length} pending
                </p>
              </div>
              {selectedUserBorrows.length === 0 ? (
                <p className="text-sm text-gray-400 p-6">No borrow records found for this student.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px]">
                    <thead>
                      <tr>
                        <th className="th">Book Title</th>
                        <th className="th">Borrowed</th>
                        <th className="th">Due Date</th>
                        <th className="th">Returned</th>
                        <th className="th">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedUserBorrows.map(b => {
                        const od = b.status==='active' && b.dueDate?.toDate ? b.dueDate.toDate()<new Date() : false;
                        return (
                          <tr key={b.id} className="hover:bg-gray-50">
                            <td className="td font-semibold text-sm">{b.bookTitle||'—'}</td>
                            <td className="td font-mono text-xs">{fmt(b.borrowDate)}</td>
                            <td className={`td font-mono text-xs ${od?'text-red-700 font-bold':''}`}>{fmt(b.dueDate)}</td>
                            <td className="td font-mono text-xs">{fmt(b.returnDate)}</td>
                            <td className="td">
                              {od                           && <span className="badge-red badge">Overdue</span>}
                              {!od && b.status==='active'   && <span className="badge-green badge">Active</span>}
                              {b.status==='returned'        && <span className="badge-gray badge">Returned</span>}
                              {b.status==='pending'         && <span className="badge-gold badge">Pending</span>}
                              {b.status==='rejected'        && <span className="badge-red badge">Rejected</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activityUser && activityType === 'logs' && (
            <div className="card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="section-head">Library Visit Log</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedUserSessions.length} visit{selectedUserSessions.length!==1?'s':''} recorded
                  {selectedUserSessions.length > 0 && (() => {
                    const total = selectedUserSessions.reduce((acc, s) => {
                      const entry = s.entryTime?.toDate?.();
                      const exit  = s.exitTime?.toDate?.();
                      if (entry && exit) acc += (exit-entry)/60000;
                      return acc;
                    }, 0);
                    const hrs = Math.floor(total/60); const mins = Math.round(total%60);
                    return ` · Total time: ${hrs>0?`${hrs}h `:''}${mins}m`;
                  })()}
                </p>
              </div>
              {selectedUserSessions.length === 0 ? (
                <p className="text-sm text-gray-400 p-6">No visit records found for this student.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px]">
                    <thead>
                      <tr>
                        <th className="th">Purpose</th>
                        <th className="th">Entry</th>
                        <th className="th">Exit</th>
                        <th className="th">Duration</th>
                        <th className="th">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedUserSessions.map(s => {
                        const entry = s.entryTime?.toDate?.();
                        const exit  = s.exitTime?.toDate?.();
                        let duration = '—';
                        if (entry && exit) {
                          const mins = Math.round((exit-entry)/60000);
                          duration = mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h ${mins%60}m`;
                        } else if (s.active) { duration = 'Active'; }
                        return (
                          <tr key={s.id} className="hover:bg-gray-50">
                            <td className="td text-sm">{s.purpose||'—'}</td>
                            <td className="td font-mono text-xs">{fmtDt(s.entryTime)}</td>
                            <td className="td font-mono text-xs">{s.active ? '—' : fmtDt(s.exitTime)}</td>
                            <td className="td font-mono text-xs text-gray-500">{duration}</td>
                            <td className="td">
                              {s.active ? <span className="badge-green badge">Active</span>
                                : s.forcedLogout ? <span className="badge-red badge">Force-Exited</span>
                                : <span className="badge-gray badge">Exited</span>}
                            </td>
                          </tr>
                        );
                      })}
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

// ── Shared helpers ────────────────────────────────────────────────────────────
function StatCard({ label, value, accent, onClick }) {
  const valueClass =
    accent==='red'   ? 'stat-value text-red-600'     :
    accent==='gold'  ? 'stat-value text-gold-600'    :
    accent==='green' ? 'stat-value text-primary-600' : 'stat-value';
  const borderClass =
    accent==='red'   ? 'border-l-4 border-red-400'     :
    accent==='gold'  ? 'border-l-4 border-gold-400'    :
    accent==='green' ? 'border-l-4 border-primary-400' : '';
  return (
    <button onClick={onClick}
      className={`stat-card ${borderClass} text-left w-full group transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-primary-300 cursor-pointer`}>
      <p className="stat-label group-hover:text-primary-600 transition-colors">{label}</p>
      <p className={valueClass}>{value}</p>
      <p className="text-[9px] font-mono text-gray-300 group-hover:text-primary-400 mt-1 transition-colors">Click to view →</p>
    </button>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="card">
      <p className="section-head mb-0.5">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  );
}
