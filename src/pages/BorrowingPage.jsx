// src/pages/BorrowingPage.jsx
import { useEffect, useState, useRef } from 'react';
import {
  collection, query, where, onSnapshot, addDoc, updateDoc,
  doc, serverTimestamp, orderBy, getDoc, getDocs
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import ConfirmDialog from '../components/shared/ConfirmDialog';

const fmt = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

const isOverdue = (b) =>
  b.status === 'active' && b.dueDate?.toDate && b.dueDate.toDate() < new Date();

// ── Approve Modal ─────────────────────────────────────────────────────────────
function ApproveModal({ borrow, onConfirm, onCancel, saving }) {
  const defaultDue = new Date();
  defaultDue.setDate(defaultDue.getDate() + 7);
  const [dueDate, setDueDate] = useState(defaultDue.toISOString().split('T')[0]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white w-full max-w-md shadow-2xl">
        <div className="bg-primary-800 text-white px-6 py-4">
          <p className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-0.5">Approve Request</p>
          <h2 className="font-display text-lg font-bold leading-tight">{borrow.bookTitle}</h2>
          <p className="text-xs text-white/60 mt-0.5">Requested by: {borrow._studentName || '—'}</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Due Date <span className="text-red-500">*</span></label>
            <input type="date" className="input" value={dueDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setDueDate(e.target.value)} />
          </div>
          <div className="border border-gold-200 bg-gold-50 px-4 py-3">
            <p className="text-xs text-gold-800">Approving will mark this borrow as <strong>Active</strong> and decrement available copies.</p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button className="btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="btn-primary" disabled={!dueDate || saving} onClick={() => onConfirm(dueDate)}>
            {saving ? 'Approving…' : 'Approve & Set Due Date'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BorrowingPage() {
  const { userProfile, currentUser, loadingAuth } = useAuth();
  const location = useLocation();

  const role      = userProfile?.role;
  const canManage = role === 'admin' || role === 'staff';
  const isStudent = role === 'student';

  // ── Tab ───────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState(null);
  const tabSet = useRef(false);
  useEffect(() => {
    if (!role || tabSet.current) return;
    tabSet.current = true;
    const fromState = location.state?.tab;
    setTab(fromState || (role === 'student' ? 'active' : 'pending'));
  }, [role, location.state?.tab]);

  // ── Real-time data via onSnapshot ─────────────────────────────────────────
  const [borrows,  setBorrows]  = useState([]);
  const [userMap,  setUserMap]  = useState({});
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!role || !currentUser?.uid) return;

    let q;
    if (role === 'student') {
      q = query(collection(db, 'borrows'), where('userId', '==', currentUser.uid));
    } else {
      q = query(collection(db, 'borrows'), orderBy('borrowDate', 'desc'));
    }

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.borrowDate?.toDate?.()?.getTime() ?? 0) - (a.borrowDate?.toDate?.()?.getTime() ?? 0));
      setBorrows(docs);
      setLoading(false);
    }, (err) => {
      console.error('Borrows listener error:', err);
      setLoading(false);
    });

    return unsub;
  }, [role, currentUser?.uid]);

  // Load user map for staff/admin (static — users don't change often)
  useEffect(() => {
    if (!canManage) return;
    getDocs(collection(db, 'users')).then(snap => {
      const map = {};
      snap.forEach(d => { map[d.id] = d.data(); });
      setUserMap(map);
    });
  }, [canManage]);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterBook,    setFilterBook]    = useState('');
  const [filterStudent, setFilterStudent] = useState('');
  const [filterDate,    setFilterDate]    = useState('');
  const [showFilters,   setShowFilters]   = useState(false);

  const handleTabChange = (key) => {
    setTab(key);
    setFilterBook(''); setFilterStudent(''); setFilterDate(''); setShowFilters(false);
  };

  // ── Tab counts ────────────────────────────────────────────────────────────
  const tabCounts = {
    pending:  borrows.filter(b => b.status === 'pending').length,
    active:   borrows.filter(b => b.status === 'active' && !isOverdue(b)).length,
    overdue:  borrows.filter(b => isOverdue(b)).length,
    returned: borrows.filter(b => b.status === 'returned').length,
  };

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = borrows
    .filter(b => {
      if (tab === 'pending')  return b.status === 'pending';
      if (tab === 'active')   return b.status === 'active' && !isOverdue(b);
      if (tab === 'overdue')  return isOverdue(b);
      if (tab === 'returned') return b.status === 'returned';
      return true;
    })
    .filter(b => !filterBook || b.bookTitle?.toLowerCase().includes(filterBook.toLowerCase()))
    .filter(b => {
      if (!filterStudent) return true;
      const u = userMap[b.userId];
      const name = u ? `${u.lastName} ${u.firstName} ${u.idNumber ?? ''}`.toLowerCase() : '';
      return name.includes(filterStudent.toLowerCase());
    })
    .filter(b => {
      if (!filterDate) return true;
      const bd = b.borrowDate?.toDate?.();
      return bd && bd.toISOString().split('T')[0] === filterDate;
    })
    .map(b => ({
      ...b,
      _studentName: canManage && userMap[b.userId]
        ? `${userMap[b.userId].lastName}, ${userMap[b.userId].firstName}` : null,
      _studentId: canManage ? (userMap[b.userId]?.idNumber ?? '—') : null,
    }));

  // ── Confirm dialog state ──────────────────────────────────────────────────
  const [confirm, setConfirm] = useState(null); // { title, message, onConfirm }
  const askConfirm = (title, message, onConfirm, confirmLabel = 'Confirm', confirmStyle = 'danger') =>
    new Promise(resolve => setConfirm({ title, message, confirmLabel, confirmStyle,
      onConfirm: () => { setConfirm(null); resolve(true); onConfirm(); },
      onCancel:  () => { setConfirm(null); resolve(false); },
    }));

  // ── Actions ───────────────────────────────────────────────────────────────
  const [approving,     setApproving]     = useState(null);
  const [approveSaving, setApproveSaving] = useState(false);
  const [toast,         setToast]         = useState(null);
  const [emailSent,     setEmailSent]     = useState({});
  const [showAdd,       setShowAdd]       = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [newBorrow,     setNewBorrow]     = useState({ studentSearch: '', selectedUserId: '', bookSearch: '', selectedBookId: '', selectedBookTitle: '', dueDate: '' });
  const [studentResults, setStudentResults] = useState([]);
  const [bookResults,    setBookResults]    = useState([]);

  const showToast = (msg, ok) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); };

  const handleApprove = async (dueDate) => {
    if (!approving) return;
    setApproveSaving(true);
    try {
      await updateDoc(doc(db, 'borrows', approving.id), {
        status: 'active', dueDate: new Date(dueDate),
        approvedBy: currentUser.uid, approvedAt: serverTimestamp(),
      });
      if (approving.bookId) {
        const bookSnap = await getDoc(doc(db, 'books', approving.bookId));
        if (bookSnap.exists()) {
          await updateDoc(doc(db, 'books', approving.bookId), {
            availableCopies: Math.max(0, (bookSnap.data().availableCopies || 0) - 1),
          });
        }
      }
      showToast(`"${approving.bookTitle}" approved.`, true);
      setApproving(null);
    } catch (e) { showToast('Failed to approve: ' + e.message, false); }
    setApproveSaving(false);
  };

  const handleReject = async (borrow) => {
    askConfirm(
      'Reject Borrow Request',
      `Reject the request for "${borrow.bookTitle}"? This cannot be undone.`,
      async () => {
        try {
          await updateDoc(doc(db, 'borrows', borrow.id), {
            status: 'rejected', rejectedBy: currentUser.uid, rejectedAt: serverTimestamp(),
          });
          showToast(`Request for "${borrow.bookTitle}" rejected.`, true);
        } catch (e) { showToast('Failed to reject: ' + e.message, false); }
      },
      'Reject', 'danger'
    );
  };

  const handleReturn = async (borrow) => {
    askConfirm(
      'Mark as Returned',
      `Mark "${borrow.bookTitle}" as returned by ${borrow._studentName || 'this student'}?`,
      async () => {
        try {
          await updateDoc(doc(db, 'borrows', borrow.id), { status: 'returned', returnDate: serverTimestamp() });
          if (borrow.bookId) {
            const bookSnap = await getDoc(doc(db, 'books', borrow.bookId));
            if (bookSnap.exists()) {
              await updateDoc(doc(db, 'books', borrow.bookId), {
                availableCopies: (bookSnap.data().availableCopies || 0) + 1,
              });
            }
          }
          showToast(`"${borrow.bookTitle}" marked as returned.`, true);
        } catch (e) { showToast('Error: ' + e.message, false); }
      },
      'Mark Returned', 'primary'
    );
  };

  const handleSendReminder = async (borrow) => {
    if (emailSent[borrow.id]) return;
    try {
      const student = userMap[borrow.userId];
      const sentByName = userProfile ? `${userProfile.firstName ?? ''} ${userProfile.lastName ?? ''}`.trim() : 'Library Staff';
      // Fire real-time notification (same system as LoggerPage)
      await addDoc(collection(db, 'notifications'), {
        toUid:       borrow.userId,
        toName:      student ? `${student.firstName} ${student.lastName}` : 'Student',
        message:     `You have an overdue book: "${borrow.bookTitle}". It was due on ${fmt(borrow.dueDate)}. Please return it as soon as possible to avoid penalties.`,
        sentBy:      currentUser.uid,
        sentByName,
        sentAt:      serverTimestamp(),
        resolved:    false,
        acknowledged: false,
        followUp:    false,
        type:        'overdue_reminder',
        bookTitle:   borrow.bookTitle,
        borrowId:    borrow.id,
      });
      setEmailSent(prev => ({ ...prev, [borrow.id]: true }));
      showToast(`Overdue reminder sent to ${student?.firstName ?? 'student'}.`, true);
    } catch (e) { showToast('Failed to send reminder: ' + e.message, false); }
  };

  // Check if student has any overdue books before allowing new borrow request
  const hasOverdueBooks = isStudent && borrows.some(b => isOverdue(b));

  const handleCancelRequest = async (borrow) => {
    askConfirm(
      'Cancel Borrow Request',
      `Cancel your request for "${borrow.bookTitle}"?`,
      async () => {
        try {
          await updateDoc(doc(db, 'borrows', borrow.id), { status: 'cancelled' });
        } catch (e) { showToast('Error: ' + e.message, false); }
      },
      'Cancel Request', 'danger'
    );
  };

  const searchStudents = async (q) => {
    if (!q.trim()) { setStudentResults([]); return; }
    const snap = await getDocs(collection(db, 'users'));
    const lower = q.toLowerCase();
    setStudentResults(
      snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.role === 'student' && (
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(lower) ||
          (u.idNumber || '').replace(/-/g, '').includes(q.replace(/-/g, ''))
        )).slice(0, 6)
    );
  };

  const searchBooks = async (q) => {
    if (!q.trim()) { setBookResults([]); return; }
    const snap = await getDocs(collection(db, 'books'));
    const lower = q.toLowerCase();
    setBookResults(
      snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(b => b.title?.toLowerCase().includes(lower) || b.isbn?.includes(q))
        .slice(0, 6)
    );
  };

  const handleWalkUp = async (e) => {
    e.preventDefault();
    if (!newBorrow.selectedUserId || !newBorrow.selectedBookId || !newBorrow.dueDate) {
      showToast('Please select a student, book, and due date.', false); return;
    }
    setSaving(true);
    try {
      const bookSnap = await getDoc(doc(db, 'books', newBorrow.selectedBookId));
      if (!bookSnap.exists()) throw new Error('Book not found.');
      if ((bookSnap.data().availableCopies || 0) <= 0) throw new Error('No available copies.');
      await addDoc(collection(db, 'borrows'), {
        userId: newBorrow.selectedUserId, bookId: newBorrow.selectedBookId,
        bookTitle: newBorrow.selectedBookTitle, dueDate: new Date(newBorrow.dueDate),
        borrowDate: serverTimestamp(), status: 'active', walkUp: true, processedBy: currentUser.uid,
      });
      await updateDoc(doc(db, 'books', newBorrow.selectedBookId), {
        availableCopies: Math.max(0, (bookSnap.data().availableCopies || 0) - 1),
      });
      setShowAdd(false);
      setNewBorrow({ studentSearch: '', selectedUserId: '', bookSearch: '', selectedBookId: '', selectedBookTitle: '', dueDate: '' });
      setStudentResults([]); setBookResults([]);
      showToast('Walk-up borrow recorded.', true);
    } catch (e) { showToast('Error: ' + e.message, false); }
    setSaving(false);
  };

  // ── Wait for auth ─────────────────────────────────────────────────────────
  if (loadingAuth || !role) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-sm text-gray-400 font-mono">Loading records…</p>
      </div>
    );
  }

  const TABS = canManage
    ? [
        { key: 'pending',  label: 'Pending',  count: tabCounts.pending },
        { key: 'active',   label: 'Active',   count: tabCounts.active },
        { key: 'overdue',  label: 'Overdue',  count: tabCounts.overdue },
        { key: 'returned', label: 'Returned', count: null },
      ]
    : [
        { key: 'active',   label: 'Active',   count: tabCounts.active },
        { key: 'overdue',  label: 'Overdue',  count: tabCounts.overdue },
        { key: 'pending',  label: 'Pending',  count: tabCounts.pending },
        { key: 'returned', label: 'Returned', count: null },
      ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="pb-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400 mb-1">Circulation</p>
          <h1 className="page-title">{isStudent ? 'My Borrows' : 'Borrowing Records'}</h1>
          {isStudent && (
            <p className="text-sm text-gray-500 mt-1">
              Request books from the <a href="/catalog" className="text-primary-700 underline">Book Catalog</a>. Staff will approve your requests.
            </p>
          )}
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Live</span>
          </div>
        </div>
        {canManage && (
          <button className="btn-primary shrink-0" onClick={() => setShowAdd(s => !s)}>
            {showAdd ? 'Cancel' : '+ Walk-Up Borrow'}
          </button>
        )}
      </div>

      {/* Walk-up form */}
      {showAdd && canManage && (
        <div className="card">
          <p className="section-head mb-1">Walk-Up Borrow</p>
          <p className="text-xs text-gray-500 mb-5">For students who physically present a book at the desk. Immediately active — no approval needed.</p>
          <form onSubmit={handleWalkUp} className="space-y-4">
            <div>
              <label className="label">Search Student</label>
              <input className="input" placeholder="Type name or ID number…"
                value={newBorrow.studentSearch}
                onChange={e => { setNewBorrow(p => ({ ...p, studentSearch: e.target.value, selectedUserId: '' })); searchStudents(e.target.value); }} />
              {studentResults.length > 0 && (
                <div className="border border-gray-200 bg-white shadow-sm mt-1">
                  {studentResults.map(u => (
                    <button key={u.id} type="button"
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      onClick={() => { setNewBorrow(p => ({ ...p, studentSearch: `${u.lastName}, ${u.firstName} (${u.idNumber})`, selectedUserId: u.id })); setStudentResults([]); }}>
                      <span className="font-semibold">{u.lastName}, {u.firstName}</span>
                      <span className="ml-2 font-mono text-xs text-gray-400">{u.idNumber}</span>
                    </button>
                  ))}
                </div>
              )}
              {newBorrow.selectedUserId && <p className="text-[10px] text-primary-600 font-mono mt-1">✓ Student selected</p>}
            </div>
            <div>
              <label className="label">Search Book</label>
              <input className="input" placeholder="Type title or ISBN…"
                value={newBorrow.bookSearch}
                onChange={e => { setNewBorrow(p => ({ ...p, bookSearch: e.target.value, selectedBookId: '', selectedBookTitle: '' })); searchBooks(e.target.value); }} />
              {bookResults.length > 0 && (
                <div className="border border-gray-200 bg-white shadow-sm mt-1">
                  {bookResults.map(b => (
                    <button key={b.id} type="button"
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      onClick={() => { setNewBorrow(p => ({ ...p, bookSearch: b.title, selectedBookId: b.id, selectedBookTitle: b.title })); setBookResults([]); }}>
                      <p className="text-sm font-semibold">{b.title}</p>
                      <p className="text-xs text-gray-400">{b.authors} — {b.availableCopies ?? 0} copies available</p>
                    </button>
                  ))}
                </div>
              )}
              {newBorrow.selectedBookId && <p className="text-[10px] text-primary-600 font-mono mt-1">✓ Book selected</p>}
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" className="input max-w-xs"
                value={newBorrow.dueDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setNewBorrow(p => ({ ...p, dueDate: e.target.value }))} required />
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Recording…' : 'Record Walk-Up Borrow'}
            </button>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex overflow-x-auto whitespace-nowrap border-b border-gray-200">
        {TABS.map(t => (
          <button key={t.key} onClick={() => handleTabChange(t.key)}
            className={`px-5 py-3 text-xs font-mono font-semibold tracking-widest uppercase transition-colors flex items-center gap-2 ${
              tab === t.key ? 'border-b-2 border-primary-600 text-primary-700' : 'text-gray-400 hover:text-gray-600'
            }`}>
            {t.label}
            {t.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                t.key === 'pending' ? 'bg-gold-100 text-gold-700' :
                t.key === 'overdue' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-600'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-gray-400 font-mono">
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          {(filterBook || filterStudent || filterDate) && ' (filtered)'}
        </p>
        <div className="flex items-center gap-2">
          {(filterBook || filterStudent || filterDate) && (
            <button className="text-[10px] font-mono text-red-500 hover:underline"
              onClick={() => { setFilterBook(''); setFilterStudent(''); setFilterDate(''); }}>
              Clear Filters
            </button>
          )}
          <button
            className={`btn-ghost text-xs px-3 py-1.5 border ${showFilters ? 'border-primary-400 text-primary-700 bg-primary-50' : 'border-gray-200'}`}
            onClick={() => setShowFilters(s => !s)}>
            {showFilters ? '▲ Hide Filters' : '▼ Filter Columns'}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="card mb-0 py-3 px-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <p className="label mb-1">Book Title</p>
            <input className="input py-1.5 text-sm" placeholder="Filter by book…"
              value={filterBook} onChange={e => setFilterBook(e.target.value)} />
          </div>
          {canManage && (
            <div>
              <p className="label mb-1">Student</p>
              <input className="input py-1.5 text-sm" placeholder="Filter by name or ID…"
                value={filterStudent} onChange={e => setFilterStudent(e.target.value)} />
            </div>
          )}
          <div>
            <p className="label mb-1">Borrow Date</p>
            <input type="date" className="input py-1.5 text-sm"
              value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading || tab === null ? (
          <p className="text-sm text-gray-400 font-mono p-6">Loading records…</p>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-400">
              {tab === 'pending' && isStudent ? 'No pending requests. Browse the Book Catalog to request a book.'
                : tab === 'pending' && canManage ? 'No pending requests to review.'
                : `No ${tab} records.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr>
                  <th className="th">Book Title</th>
                  {canManage && <th className="th">Student</th>}
                  <th className="th">Borrow Date</th>
                  {tab !== 'pending' && <th className="th">Due Date</th>}
                  {tab === 'returned' && <th className="th">Returned</th>}
                  <th className="th">Status</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => {
                  const over = isOverdue(b);
                  return (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="td">
                        <p className="font-semibold text-sm">{b.bookTitle}</p>
                        {b.walkUp && <span className="badge badge-blue text-[9px] mt-0.5">Walk-Up</span>}
                      </td>
                      {canManage && (
                        <td className="td">
                          <p className="text-sm font-medium">{b._studentName || '—'}</p>
                          <p className="font-mono text-xs text-gray-400">{b._studentId}</p>
                        </td>
                      )}
                      <td className="td font-mono text-xs">{fmt(b.borrowDate)}</td>
                      {tab !== 'pending' && (
                        <td className={`td font-mono text-xs ${over ? 'text-red-700 font-bold' : ''}`}>{fmt(b.dueDate)}</td>
                      )}
                      {tab === 'returned' && (
                        <td className="td font-mono text-xs text-gray-400">{fmt(b.returnDate)}</td>
                      )}
                      <td className="td">
                        {b.status === 'returned' && <span className="badge badge-gray">Returned</span>}
                        {b.status === 'rejected' && <span className="badge badge-red">Rejected</span>}
                        {b.status === 'pending'  && <span className="badge badge-gold">Pending</span>}
                        {b.status === 'active' && !over && <span className="badge badge-green">Active</span>}
                        {b.status === 'active' && over  && <span className="badge badge-red">Overdue</span>}
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-2 flex-wrap">
                          {canManage && b.status === 'pending' && (
                            <>
                              <button className="btn-primary py-1 px-3 text-[10px]" onClick={() => setApproving(b)}>Approve</button>
                              <button className="btn-danger py-1 px-3 text-[10px]" onClick={() => handleReject(b)}>Reject</button>
                            </>
                          )}
                          {canManage && b.status === 'active' && (
                            <button className="btn-secondary py-1 px-3 text-[10px]" onClick={() => handleReturn(b)}>Mark Returned</button>
                          )}
                          {canManage && isOverdue(b) && (
                            <button className="btn-secondary text-[10px] py-1 px-2"
                              disabled={emailSent[b.id]}
                              onClick={() => handleSendReminder(b)}>
                              {emailSent[b.id] ? '✓ Sent' : 'Remind'}
                            </button>
                          )}
                          {isStudent && b.status === 'pending' && (
                            <button
                              className="btn-ghost py-1 px-3 text-[10px] text-red-500 border border-red-200 hover:bg-red-50"
                              onClick={() => handleCancelRequest(b)}>
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 shadow-lg text-white text-sm font-mono tracking-wide flex items-center gap-3 ${toast.ok ? 'bg-primary-700' : 'bg-red-700'}`}>
          <span>{toast.ok ? '✓' : '✕'}</span>
          {toast.msg}
        </div>
      )}

      {/* Approve modal */}
      {approving && (
        <ApproveModal
          borrow={approving}
          onConfirm={handleApprove}
          onCancel={() => setApproving(null)}
          saving={approveSaving}
        />
      )}

      {/* Confirm dialog */}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          confirmStyle={confirm.confirmStyle}
          onConfirm={confirm.onConfirm}
          onCancel={confirm.onCancel}
        />
      )}
    </div>
  );
}
