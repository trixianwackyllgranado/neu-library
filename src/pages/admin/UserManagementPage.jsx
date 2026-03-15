// src/pages/admin/UserManagementPage.jsx
import { useEffect, useState } from 'react';
import {
  collection, updateDoc, addDoc, doc, onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import EditProfileModal from '../../components/shared/EditProfileModal';

const BADGE = { admin: 'badge-red', staff: 'badge-gold', student: 'badge-green' };

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportUsersCSV(users) {
  const headers = [
    'Role', 'Last Name', 'First Name', 'Middle Initial',
    'ID Number', 'Email', 'College / Department', 'Course', 'Year Level',
    'Age', 'Birthday', 'Account Created',
  ];
  const rows = users.map(u => [
    u.role ?? '',
    u.lastName ?? '',
    u.firstName ?? '',
    u.middleInitial ?? '',
    u.idNumber ?? '',
    u.email ?? '',
    u.college ?? u.department ?? '',
    u.course ?? '',
    u.yearLevel ?? '',
    u.age ?? '',
    u.birthday ?? '',
    u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString('en-PH') : '',
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: 'users.csv' }).click();
  URL.revokeObjectURL(url);
}

// ── Audit log modal ───────────────────────────────────────────────────────────
function AuditModal({ logs, onClose }) {
  const fmt = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white w-full max-w-3xl shadow-2xl max-h-[80vh] flex flex-col">
        <div className="bg-primary-800 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-0.5">Immutable Log</p>
            <h2 className="font-display text-lg font-bold">Role Change Audit Log</h2>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="overflow-y-auto flex-1">
          {logs.length === 0 ? (
            <p className="p-6 text-sm text-gray-400 text-center">No role changes recorded yet.</p>
          ) : (
            <table className="w-full min-w-[600px]">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Target User</th>
                  <th className="th">Change</th>
                  <th className="th">Changed By</th>
                  <th className="th">Reason</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="td font-mono text-xs text-gray-400">{fmt(l.timestamp)}</td>
                    <td className="td text-sm font-semibold">{l.targetName || '—'}</td>
                    <td className="td">
                      <span className="flex items-center gap-1 text-xs">
                        <span className={`badge ${BADGE[l.fromRole] || 'badge-gray'}`}>{l.fromRole}</span>
                        <span className="text-gray-400">→</span>
                        <span className={`badge ${BADGE[l.toRole] || 'badge-gray'}`}>{l.toRole}</span>
                      </span>
                    </td>
                    <td className="td text-xs text-gray-500">{l.changedByName || '—'}</td>
                    <td className="td text-xs text-gray-600 max-w-[180px]">{l.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function UserManagementPage() {
  const { userProfile: myProfile } = useAuth();
  const location = useLocation();
  const initRole = location.state?.filterRole || 'all';

  const [users,      setUsers]      = useState([]);
  const [auditLogs,  setAuditLogs]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(null);
  const [toast,      setToast]      = useState(null);

  // Filters
  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState(initRole);
  const [sortBy,     setSortBy]     = useState('name');

  // Role change modal state
  const [pending,     setPending]     = useState(null);
  const [reason,      setReason]      = useState('');
  const [confirmWord, setConfirmWord] = useState('');

  // Audit modal
  const [auditOpen,  setAuditOpen]  = useState(false);

  // Password reset
  const [resetPwId,  setResetPwId]  = useState(null);

  // Edit profile (college/course)
  const [editProfileTarget, setEditProfileTarget] = useState(null); // { uid, profile }

  // Live users
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (a.lastName ?? '').localeCompare(b.lastName ?? ''));
      setUsers(docs);
      setLoading(false);
    }, err => { console.error(err); setLoading(false); });
    return unsub;
  }, []);

  // Live audit logs
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'roleChangeLogs'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));
      setAuditLogs(docs);
    }, () => {});
    return unsub;
  }, []);

  // ── Filtering + sorting ───────────────────────────────────────────────────
  const filtered = users
    .filter(u => {
      const matchSearch = !search ||
        `${u.firstName} ${u.lastName} ${u.idNumber} ${u.email} ${u.course || ''} ${u.college || ''} ${u.department || ''}`
          .toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      return matchSearch && matchRole;
    })
    .sort((a, b) => {
      if (sortBy === 'role') {
        const order = { admin: 0, staff: 1, student: 2 };
        return (order[a.role] ?? 3) - (order[b.role] ?? 3);
      }
      if (sortBy === 'college') {
        return (a.college || a.department || '').localeCompare(b.college || b.department || '');
      }
      return (a.lastName || '').localeCompare(b.lastName || '');
    });

  // ── Role rules ────────────────────────────────────────────────────────────
  const canPromoteToStaff  = (u) => u.role === 'student' && u.id !== myProfile?.uid;
  const canPromoteToAdmin  = (u) => u.role === 'staff'   && u.id !== myProfile?.uid;
  const canDemoteToStudent = (u) => u.role === 'staff'   && u.id !== myProfile?.uid;

  // Admin resets a user's password to their ID number via Firestore flag
  // (requires user to log out/in — a Cloud Function would be needed for server-side reset)
  const handleResetPassword = async (user) => {
    if (!window.confirm(`Reset ${user.firstName}'s password to their ID number (${user.idNumber})? They will need to sign out and back in with their ID number as the password.`)) return;
    setResetPwId(user.id);
    try {
      await updateDoc(doc(db, 'users', user.id), {
        adminPasswordReset: true,
        adminPasswordResetAt: serverTimestamp(),
        adminPasswordResetBy: myProfile?.uid || null,
      });
      showToast(`Password reset flag set for ${user.firstName}. They will be prompted to change their password on next login.`, true);
    } catch (err) {
      showToast('Failed to set reset flag: ' + err.message, false);
    } finally { setResetPwId(null); }
  };

  const initChange = (user, toRole) => {
    setPending({ user, toRole });
    setReason('');
    setConfirmWord('');
  };

  // ── Confirm role change ───────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!pending) return;
    if (reason.trim().length < 10) { showToast('Reason must be at least 10 characters.', false); return; }
    if (pending.toRole === 'admin' && confirmWord !== 'CONFIRM') { showToast('Type CONFIRM to proceed.', false); return; }

    setSaving(pending.user.id);
    try {
      await updateDoc(doc(db, 'users', pending.user.id), { role: pending.toRole });
      await addDoc(collection(db, 'roleChangeLogs'), {
        targetId:      pending.user.id,
        targetName:    `${pending.user.lastName}, ${pending.user.firstName}`,
        fromRole:      pending.user.role,
        toRole:        pending.toRole,
        changedBy:     myProfile?.uid,
        changedByName: `${myProfile?.lastName}, ${myProfile?.firstName}`,
        reason:        reason.trim(),
        timestamp:     serverTimestamp(),
      });
      setUsers(prev => prev.map(u =>
        u.id === pending.user.id ? { ...u, role: pending.toRole } : u
      ));
      showToast(`${pending.user.firstName}'s role updated to ${pending.toRole}.`, true);
    } catch (e) {
      showToast('Error: ' + e.message, false);
    }
    setSaving(null);
    setPending(null);
  };

  const showToast = (msg, ok) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4500);
  };

  // ── Tab counts ────────────────────────────────────────────────────────────
  const counts = {
    all:     users.length,
    student: users.filter(u => u.role === 'student').length,
    staff:   users.filter(u => u.role === 'staff').length,
    admin:   users.filter(u => u.role === 'admin').length,
  };

  const ROLE_TABS = [
    { key: 'all',     label: 'All' },
    { key: 'student', label: 'Students' },
    { key: 'staff',   label: 'Staff' },
    { key: 'admin',   label: 'Admins' },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="pb-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400 mb-1">Administration</p>
          <h1 className="page-title">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage roles for registered users. Admin accounts are fully protected.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          <button
            className="btn-secondary text-xs py-2 px-4"
            onClick={() => exportUsersCSV(filtered)}
            title="Export currently visible users as CSV"
          >
            Export CSV ({filtered.length})
          </button>
          <button className="btn-secondary text-xs py-2 px-4"
            onClick={() => setAuditOpen(true)}>
            Audit Log ({auditLogs.length})
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <input className="input flex-1"
            placeholder="Search by name, ID, email, course, college…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="select w-44 text-sm shrink-0" value={sortBy}
            onChange={e => setSortBy(e.target.value)}>
            <option value="name">Sort: Name (A–Z)</option>
            <option value="role">Sort: Role</option>
            <option value="college">Sort: College</option>
          </select>
        </div>

        {/* Role filter tabs */}
        <div className="flex border-b border-gray-200">
          {ROLE_TABS.map(t => (
            <button key={t.key} onClick={() => setRoleFilter(t.key)}
              className={`px-5 py-2.5 text-xs font-mono font-semibold tracking-widest uppercase flex items-center gap-2 transition-colors ${
                roleFilter === t.key
                  ? 'border-b-2 border-primary-600 text-primary-700'
                  : 'text-gray-400 hover:text-gray-600'
              }`}>
              {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 font-bold rounded ${
                t.key === 'admin'   ? 'bg-red-100 text-red-700'     :
                t.key === 'staff'   ? 'bg-amber-100 text-amber-700' :
                t.key === 'student' ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Result summary */}
      {(search || roleFilter !== 'all') && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 font-mono">
            Showing <strong className="text-gray-700">{filtered.length}</strong> of {users.length} users
          </p>
          <button className="text-xs text-primary-600 hover:underline font-mono"
            onClick={() => { setSearch(''); setRoleFilter('all'); }}>
            Clear filters
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-400 font-mono p-6">Loading users…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 p-8 text-center">No users match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr>
                  <th className="th">Name</th>
                  <th className="th">ID Number</th>
                  <th className="th">Email</th>
                  <th className="th">College / Course</th>
                  <th className="th">Current Role</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="td">
                      <p className="font-semibold text-sm">
                        {u.lastName
                          ? `${u.lastName}, ${u.firstName}${u.middleInitial ? ' ' + u.middleInitial + '.' : ''}`.trim()
                          : u.email}
                      </p>
                      {u.id === myProfile?.uid && (
                        <span className="text-[10px] font-mono text-primary-500">(you)</span>
                      )}
                    </td>
                    <td className="td font-mono text-xs">{u.idNumber || '—'}</td>
                    <td className="td text-xs font-mono text-gray-500">{u.email}</td>
                    <td className="td text-xs">
                      <p className="font-medium">{u.college || u.department || '—'}</p>
                      {u.course    && <p className="text-gray-400">{u.course}</p>}
                      {u.yearLevel && <p className="text-gray-400">{u.yearLevel}</p>}
                    </td>
                    <td className="td">
                      <span className={`badge ${BADGE[u.role] || 'badge-gray'}`}>
                        {u.role || 'student'}
                      </span>
                    </td>
                    <td className="td">
                      {u.role === 'admin' ? (
                        <span className="text-xs text-gray-400 font-mono italic">Protected — Admin</span>
                      ) : u.id === myProfile?.uid ? (
                        <span className="text-xs text-gray-400 font-mono italic">Your account</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {canPromoteToStaff(u) && (
                            <button
                              className="border border-amber-300 text-amber-700 hover:bg-amber-50 text-[10px] font-mono font-semibold px-2.5 py-1 transition-colors"
                              onClick={() => initChange(u, 'staff')}
                              disabled={saving === u.id}
                            >↑ Staff</button>
                          )}
                          {canPromoteToAdmin(u) && (
                            <button
                              className="border border-red-300 text-red-600 hover:bg-red-50 text-[10px] font-mono font-semibold px-2.5 py-1 transition-colors"
                              onClick={() => initChange(u, 'admin')}
                              disabled={saving === u.id}
                            >↑ Admin</button>
                          )}
                          {canDemoteToStudent(u) && (
                            <button
                              className="border border-gray-300 text-gray-500 hover:bg-gray-50 text-[10px] font-mono font-semibold px-2.5 py-1 transition-colors"
                              onClick={() => initChange(u, 'student')}
                              disabled={saving === u.id}
                            >↓ Student</button>
                          )}
                          <button
                            className="border text-[10px] font-mono font-semibold px-2.5 py-1 transition-colors"
                            style={{borderColor:'var(--blue-border)',color:'var(--blue)',background:'transparent'}}
                            onClick={() => handleResetPassword(u)}
                            disabled={resetPwId === u.id}
                            title="Set flag to reset password to ID number on next login"
                          >{resetPwId === u.id ? 'Resetting…' : 'Reset PW'}</button>
                          <button
                            className="border text-[10px] font-mono font-semibold px-2.5 py-1 transition-colors"
                            style={{borderColor:'var(--gold-border)',color:'var(--gold)',background:'transparent'}}
                            onClick={() => setEditProfileTarget({ uid: u.id, profile: u })}
                            title="Edit college and course"
                          >Edit Profile</button>
                          {saving === u.id && (
                            <span className="text-[10px] font-mono text-gray-400 animate-pulse">Saving…</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role change modal */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white w-full max-w-md shadow-2xl">
            <div className="bg-primary-800 text-white px-6 py-4">
              <p className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-0.5">Role Change</p>
              <h2 className="font-display text-lg font-bold leading-tight">
                {pending.user.lastName}, {pending.user.firstName}
              </h2>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`badge ${BADGE[pending.user.role]}`}>{pending.user.role}</span>
                <span className="text-white/50 text-xs">→</span>
                <span className={`badge ${BADGE[pending.toRole]}`}>{pending.toRole}</span>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className={`border px-4 py-3 text-xs ${
                pending.toRole === 'admin'
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : pending.toRole === 'staff'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-gray-200 bg-gray-50 text-gray-700'
              }`}>
                {pending.toRole === 'admin'
                  ? 'Important: Admin accounts are fully protected after promotion. This cannot be reversed by any admin.'
                  : pending.toRole === 'staff'
                  ? 'This grants access to approve borrows, manage the logger, and view student records.'
                  : 'This removes staff access and reverts the account to a standard student account.'}
              </div>
              <div>
                <label className="label">
                  Reason for change <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="input resize-none h-20 text-sm"
                  placeholder="Min 10 characters — recorded in audit log…"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  autoFocus
                />
                <p className="text-[10px] font-mono text-gray-400 mt-1">
                  {reason.trim().length} / 10 characters minimum
                </p>
              </div>
              {pending.toRole === 'admin' && (
                <div>
                  <label className="label">
                    Type <span className="font-mono font-bold text-red-600">CONFIRM</span> to proceed
                  </label>
                  <input
                    className="input font-mono tracking-widest"
                    placeholder="CONFIRM"
                    value={confirmWord}
                    onChange={e => setConfirmWord(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setPending(null)} disabled={!!saving}>
                Cancel
              </button>
              <button
                className={pending.toRole === 'admin' ? 'btn-danger' : 'btn-primary'}
                disabled={
                  reason.trim().length < 10 ||
                  !!saving ||
                  (pending.toRole === 'admin' && confirmWord !== 'CONFIRM')
                }
                onClick={handleConfirm}
              >
                {saving ? 'Saving…' : `Confirm — Make ${pending.toRole.charAt(0).toUpperCase() + pending.toRole.slice(1)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit modal */}
      {auditOpen && <AuditModal logs={auditLogs} onClose={() => setAuditOpen(false)} />}

      {/* Edit Profile modal */}
      {editProfileTarget && (
        <EditProfileModal
          onClose={() => setEditProfileTarget(null)}
          targetUid={editProfileTarget.uid}
          targetProfile={editProfileTarget.profile}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 shadow-lg text-white text-sm font-mono tracking-wide ${toast.ok ? 'bg-primary-700' : 'bg-red-700'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
