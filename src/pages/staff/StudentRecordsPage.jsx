// src/pages/staff/StudentRecordsPage.jsx
import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, getDocs, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

function exportCSV(students) {
  const headers = ['ID Number','Last Name','First Name','Email','College','Course','Year Level','Age','Birthday','Account Created'];
  const rows = students.map(s => [
    s.idNumber ?? '', s.lastName ?? '', s.firstName ?? '', s.email ?? '',
    s.college ?? '', s.course ?? '', s.yearLevel ?? '', s.age ?? '',
    s.birthday ?? '', s.createdAt?.toDate ? s.createdAt.toDate().toLocaleDateString('en-PH') : '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: 'students.csv' }).click();
  URL.revokeObjectURL(url);
}

// ── Collapsible section wrapper ───────────────────────────────────────────────
function Section({ title, count, badge, badgeColor = 'gray', defaultOpen = false, children, searchable, searchValue, onSearch, searchPlaceholder }) {
  const [open, setOpen] = useState(defaultOpen);
  const badgeStyle = {
    gray:  { background:'var(--badge-gray-bg)',  color:'var(--badge-gray-text)',  border:'1px solid var(--badge-gray-border)'  },
    green: { background:'var(--badge-green-bg)', color:'var(--badge-green-text)', border:'1px solid var(--badge-green-border)' },
    red:   { background:'var(--badge-red-bg)',   color:'var(--badge-red-text)',   border:'1px solid var(--badge-red-border)'   },
    gold:  { background:'var(--badge-gold-bg)',  color:'var(--badge-gold-text)',  border:'1px solid var(--badge-gold-border)'  },
  };

  return (
    <div className="card p-0 overflow-hidden mb-4">
      <button
        className="w-full px-6 py-3 flex items-center justify-between transition-colors" style={{ background:'var(--thead-bg)', borderBottom:'1px solid var(--divider)' }}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <p className="font-mono text-[10px] tracking-widest uppercase" style={{color:'var(--text-muted)'}}>{title}</p>
          {count !== undefined && (
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded" style={badgeStyle[badgeColor] || badgeStyle.gray}>
              {count}
            </span>
          )}
        </div>
        <span style={{color:'var(--text-muted)', fontSize:'13px'}}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <>
          {searchable && (
            <div className="px-4 py-3" style={{background:'var(--card)', borderBottom:'1px solid var(--divider)'}}>
              <input
                className="input text-sm py-1.5"
                placeholder={searchPlaceholder || 'Search…'}
                value={searchValue}
                onChange={e => onSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}
          {children}
        </>
      )}
    </div>
  );
}

export default function StudentRecordsPage() {
  const { userProfile: myProfile } = useAuth();
  const isAdmin = myProfile?.role === 'admin';

  const location = useLocation();

  const [students,      setStudents]      = useState([]);
  const [search,        setSearch]        = useState('');
  const [filterCourse,  setFilterCourse]  = useState('');
  const [filterYear,    setFilterYear]    = useState('');
  const [filterCollege, setFilterCollege] = useState('');
  const [sortBy,        setSortBy]        = useState('name');
  const [loading,       setLoading]       = useState(true);
  const [selected,      setSelected]      = useState(null);
  const [detail,        setDetail]        = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Per-section search inside detail view
  const [borrowSearch, setBorrowSearch] = useState('');
  const [visitSearch,  setVisitSearch]  = useState('');
  // Status filter for borrow history
  const [borrowStatusFilter, setBorrowStatusFilter] = useState('all');

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'student'));
    const unsub = onSnapshot(q, snap => {
      setStudents(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.lastName ?? '').localeCompare(b.lastName ?? ''))
      );
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  // Auto-open student from navigation state (e.g. clicked from Logger page)
  useEffect(() => {
    const targetId = location.state?.openStudentId;
    if (!targetId || students.length === 0 || selected) return;
    const match = students.find(s => s.id === targetId);
    if (match) openStudent(match);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, location.state?.openStudentId]);

  const loadDetail = useCallback(async (student) => {
    setDetailLoading(true);
    setDetail(null);
    setBorrowSearch('');
    setVisitSearch('');
    setBorrowStatusFilter('all');
    try {
      const [borrowSnap, visitSnap] = await Promise.all([
        getDocs(query(collection(db, 'borrows'), where('userId', '==', student.id))),
        getDocs(query(collection(db, 'logger'),  where('uid',    '==', student.id), limit(50))),
      ]);

      const now     = new Date();
      const borrows = borrowSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.borrowDate?.toDate?.() ?? new Date(0)) - (a.borrowDate?.toDate?.() ?? new Date(0)));
      const active  = borrows.filter(b => b.status === 'active');
      const overdue = active.filter(b => b.dueDate?.toDate ? b.dueDate.toDate() < now : false);
      const visits  = visitSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.entryTime?.toDate?.() ?? new Date(0)) - (a.entryTime?.toDate?.() ?? new Date(0)));

      setDetail({ borrows, active, overdue, visits });
    } catch (e) { console.error(e); }
    setDetailLoading(false);
  }, []);

  const openStudent = (student) => { setSelected(student); loadDetail(student); };

  // Derive unique values for dropdowns
  const allCourses  = [...new Set(students.map(s => s.course).filter(Boolean))].sort();
  const allYears    = [...new Set(students.map(s => s.yearLevel).filter(Boolean))].sort();
  const allColleges = [...new Set(students.map(s => s.college).filter(Boolean))].sort();

  const filtered = students
    .filter(s => {
      const q = search.toLowerCase();
      const matchSearch = !search ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        s.idNumber?.replace(/-/g, '').includes(search.replace(/-/g, '')) ||
        s.email?.toLowerCase().includes(q) ||
        s.course?.toLowerCase().includes(q) ||
        s.college?.toLowerCase().includes(q);
      const matchCourse  = !filterCourse  || s.course   === filterCourse;
      const matchYear    = !filterYear    || s.yearLevel === filterYear;
      const matchCollege = !filterCollege || s.college   === filterCollege;
      return matchSearch && matchCourse && matchYear && matchCollege;
    })
    .sort((a, b) => {
      if (sortBy === 'course')  return (a.course   || '').localeCompare(b.course   || '');
      if (sortBy === 'college') return (a.college  || '').localeCompare(b.college  || '');
      if (sortBy === 'year')    return (a.yearLevel || '').localeCompare(b.yearLevel || '');
      return (a.lastName || '').localeCompare(b.lastName || '');
    });

  const fmt   = (ts) => { if (!ts) return '—'; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }); };
  const fmtDt = (ts) => { if (!ts) return '—'; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' }); };

  // ── Filtered borrow history ───────────────────────────────────────────────
  const filteredBorrows = (detail?.borrows ?? []).filter(b => {
    const matchStatus = borrowStatusFilter === 'all' || b.status === borrowStatusFilter;
    const matchSearch = !borrowSearch ||
      b.bookTitle?.toLowerCase().includes(borrowSearch.toLowerCase()) ||
      fmt(b.borrowDate).toLowerCase().includes(borrowSearch.toLowerCase());
    return matchStatus && matchSearch;
  });

  // ── Filtered visits ───────────────────────────────────────────────────────
  const filteredVisits = (detail?.visits ?? []).filter(v => {
    if (!visitSearch) return true;
    const q = visitSearch.toLowerCase();
    return (
      v.purpose?.toLowerCase().includes(q) ||
      fmtDt(v.entryTime).toLowerCase().includes(q)
    );
  });

  // ── DETAIL VIEW ──────────────────────────────────────────────────────────
  if (selected) {
    const s = selected;
    return (
      <div>
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="font-mono text-[10px] tracking-widest uppercase mb-1" style={{color:"var(--text-muted)"}}>Student Records</p>
            <h1 className="page-title">Student Profile</h1>
          </div>
          {isAdmin && (
            <button className="btn-secondary shrink-0 text-[10px]" onClick={() => exportCSV(students)}>
              Export All as CSV
            </button>
          )}
        </div>

        <div className="mb-4 flex gap-3">
          <input className="input flex-1 max-w-md" placeholder="Search students…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn-ghost text-xs" onClick={() => { setSelected(null); setDetail(null); }}>
            ← Back to List
          </button>
        </div>

        {/* Profile card */}
        <div className="card mb-4">
          <div className="flex items-start justify-between mb-4 pb-4" style={{borderBottom:"1px solid var(--divider)"}}>
            <div className="pl-4" style={{borderLeft:"4px solid var(--gold)"}}>
              <p className="font-mono text-[10px] tracking-widest mb-0.5" style={{color:"var(--text-muted)"}}>{s.idNumber}</p>
              <p className="font-display text-2xl font-bold" style={{color:"var(--text-primary)"}}>
                {s.lastName}, {s.firstName} {s.middleInitial ?? ''}.
              </p>
              <p className="text-sm mt-0.5" style={{color:"var(--text-muted)"}}>{s.email}</p>
            </div>
            <span className="badge-green badge">Student</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <Info label="Course"          value={s.course} />
            <Info label="College"         value={s.college} />
            <Info label="Account Created" value={fmt(s.createdAt)} />
          </div>
        </div>

        {detailLoading ? (
          <div className="card mb-4 text-center font-mono text-sm py-8" style={{color:"var(--text-muted)"}}>Loading records…</div>
        ) : detail && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="stat-card text-center">
                <p className="stat-value">{detail.active.length}</p>
                <p className="stat-label">Active Borrows</p>
                <p className="stat-sub">Books not yet returned</p>
              </div>
              <div className={`stat-card text-center ${detail.overdue.length > 0 ? 'border-l-4 border-red-400' : ''}`}>
                <p className={`stat-value ${detail.overdue.length > 0 ? 'text-red-600' : ''}`}>{detail.overdue.length}</p>
                <p className="stat-label">Overdue</p>
                <p className="stat-sub">Past their due date</p>
              </div>
              <div className="stat-card text-center">
                <p className="stat-value">{detail.visits.length}</p>
                <p className="stat-label">Library Visits</p>
                <p className="stat-sub">Recorded log-ins</p>
              </div>
            </div>

            {/* ── Currently Borrowed — collapsible, open by default if any ── */}
            {detail.active.length > 0 && (
              <Section
                title="Currently Borrowed"
                count={detail.active.length}
                badgeColor={detail.overdue.length > 0 ? 'red' : 'green'}
                defaultOpen={true}
              >
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="th">Book</th>
                      <th className="th">Borrow Date</th>
                      <th className="th">Due Date</th>
                      <th className="th">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.active.map(b => {
                      const od = b.dueDate?.toDate ? b.dueDate.toDate() < new Date() : false;
                      return (
                        <tr key={b.id} className="hover:bg-gray-50">
                          <td className="td font-semibold text-sm">{b.bookTitle}</td>
                          <td className="td font-mono text-xs">{fmt(b.borrowDate)}</td>
                          <td className={`td font-mono text-xs ${od ? 'text-red-700 font-bold' : ''}`}>{fmt(b.dueDate)}</td>
                          <td className="td">{od ? <span className="badge-red badge">Overdue</span> : <span className="badge-green badge">Active</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Section>
            )}

            {/* ── Full Borrow History — collapsible with search + status filter ── */}
            <Section
              title="Full Borrow History"
              count={detail.borrows.length}
              badgeColor="gray"
              defaultOpen={false}
              searchable
              searchValue={borrowSearch}
              onSearch={setBorrowSearch}
              searchPlaceholder="Search by book title or date…"
            >
              {/* Status filter pills */}
              <div className="px-4 py-2 flex flex-wrap gap-2" style={{background:'var(--card)', borderBottom:'1px solid var(--divider)'}}>
                {['all','active','returned','pending','rejected'].map(status => (
                  <button
                    key={status}
                    onClick={() => setBorrowStatusFilter(status)}
                    className="text-[10px] font-mono font-semibold px-2.5 py-1 border transition-colors"
                    style={borrowStatusFilter === status
                      ? { background:'var(--gold-soft)', borderColor:'var(--gold-border)', color:'var(--gold)' }
                      : { background:'transparent', borderColor:'var(--card-border)', color:'var(--text-muted)' }
                    }
                  >
                    {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
                <span className="text-[10px] font-mono self-center ml-auto" style={{color:'var(--text-muted)'}}>
                  {filteredBorrows.length} result{filteredBorrows.length !== 1 ? 's' : ''}
                </span>
              </div>

              {filteredBorrows.length === 0 ? (
                <p className="text-sm p-6" style={{color:"var(--text-muted)"}}>
                  {detail.borrows.length === 0 ? 'No borrow history.' : 'No records match your search.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px]">
                    <thead>
                      <tr>
                        <th className="th">Book</th>
                        <th className="th">Borrowed</th>
                        <th className="th">Due</th>
                        <th className="th">Returned</th>
                        <th className="th">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBorrows.map(b => (
                        <tr key={b.id} className="hover:bg-gray-50">
                          <td className="td font-semibold text-sm">{b.bookTitle}</td>
                          <td className="td font-mono text-xs">{fmt(b.borrowDate)}</td>
                          <td className="td font-mono text-xs">{fmt(b.dueDate)}</td>
                          <td className="td font-mono text-xs">{fmt(b.returnDate)}</td>
                          <td className="td">
                            {b.status === 'returned' && <span className="badge-gray badge">Returned</span>}
                            {b.status === 'active'   && <span className="badge-green badge">Active</span>}
                            {b.status === 'pending'  && <span className="badge-gold badge">Pending</span>}
                            {b.status === 'rejected' && <span className="badge-red badge">Rejected</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* ── Library Visit History — admin only, collapsible with search ── */}
            {isAdmin && (
              <Section
                title="Library Visit History"
                count={detail.visits.length}
                badgeColor="gray"
                defaultOpen={false}
                searchable
                searchValue={visitSearch}
                onSearch={setVisitSearch}
                searchPlaceholder="Search by purpose or date…"
              >
                {filteredVisits.length === 0 ? (
                  <p className="text-sm p-6" style={{color:"var(--text-muted)"}}>
                    {detail.visits.length === 0 ? 'No visit history.' : 'No visits match your search.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px]">
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
                        {filteredVisits.map(v => {
                          // Calculate duration
                          const entry = v.entryTime?.toDate?.();
                          const exit  = v.exitTime?.toDate?.();
                          let duration = '—';
                          if (entry && exit) {
                            const mins = Math.round((exit - entry) / 60000);
                            duration = mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h ${mins%60}m`;
                          } else if (entry && v.active) {
                            duration = 'Active';
                          }
                          return (
                            <tr key={v.id} className="hover:bg-gray-50">
                              <td className="td text-sm">{v.purpose}</td>
                              <td className="td font-mono text-xs">{fmtDt(v.entryTime)}</td>
                              <td className="td font-mono text-xs">{v.active ? '—' : fmtDt(v.exitTime)}</td>
                              <td className="td font-mono text-xs" style={{color:"var(--text-muted)"}}>{duration}</td>
                              <td className="td">
                                {v.active
                                  ? <span className="badge-green badge">Active</span>
                                  : v.forcedLogout
                                    ? <span className="badge-red badge">Force-Exited</span>
                                    : <span className="badge-gray badge">Exited</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            )}
          </>
        )}
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] tracking-widest uppercase mb-1" style={{color:"var(--text-muted)"}}>Records</p>
          <h1 className="page-title">Student Records</h1>
        </div>
        {isAdmin && (
          <button className="btn-secondary shrink-0 text-[10px]" onClick={() => exportCSV(students)}>
            Export CSV
          </button>
        )}
      </div>

      <div className="mb-5 space-y-3">
        {/* Search + sort row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input className="input flex-1"
            placeholder="Search by name, ID, course, or email…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="select w-44 text-sm shrink-0" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="name">Sort: Name (A–Z)</option>
            <option value="course">Sort: Course</option>
            <option value="college">Sort: College</option>
          </select>
        </div>

        {/* Dropdown filters row */}
        <div className="flex flex-wrap gap-3">
          <select className="select text-sm flex-1 min-w-[160px]" value={filterCourse} onChange={e => setFilterCourse(e.target.value)}>
            <option value="">— All Courses —</option>
            {allCourses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="select text-sm flex-1 min-w-[160px]" value={filterCollege} onChange={e => setFilterCollege(e.target.value)}>
            <option value="">— All Colleges —</option>
            {allColleges.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {(search || filterCourse || filterCollege || filterYear) && (
            <button className="btn-ghost text-xs px-3 py-2 shrink-0"
              onClick={() => { setSearch(''); setFilterCourse(''); setFilterCollege(''); }}>
              Clear All
            </button>
          )}
        </div>

        {/* Result count */}
        {(search || filterCourse || filterCollege || filterYear) && (
          <p className="text-xs font-mono" style={{color:"var(--text-muted)"}}>
            Showing <strong style={{color:"var(--text-primary)"}}>{filtered.length}</strong> of {students.length} students
          </p>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="text-sm font-mono p-6" style={{color:"var(--text-muted)"}}>Loading students…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm p-6" style={{color:"var(--text-muted)"}}>No students found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className="th">Name</th>
                  <th className="th">ID Number</th>
                  <th className="th">College / Course</th>
                  <th className="th">Email</th>
                  <th className="th">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openStudent(s)}>
                    <td className="td font-semibold text-sm">{s.lastName}, {s.firstName} {s.middleInitial ? s.middleInitial + '.' : ''}</td>
                    <td className="td font-mono text-xs">{s.idNumber}</td>
                    <td className="td text-xs">
                      <p className="font-medium">{s.course || '—'}</p>
                      {s.college && <p style={{color:"var(--text-muted)"}}>{s.college}</p>}
                    </td>
                    <td className="td font-mono text-xs" style={{color:"var(--text-muted)"}}>{s.email}</td>
                    <td className="td">
                      <button className="btn-secondary py-1 px-3 text-[10px]"
                        onClick={e => { e.stopPropagation(); openStudent(s); }}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="text-sm font-semibold" style={{color:"var(--text-primary)"}}>{value || '—'}</p>
    </div>
  );
}
