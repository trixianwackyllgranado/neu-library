// src/pages/admin/UserManagementPage.jsx
import { useEffect, useState } from 'react';
import {
  collection, updateDoc, addDoc, doc, onSnapshot,
  serverTimestamp, deleteDoc, writeBatch, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import EditProfileModal from '../../components/shared/EditProfileModal';
import EditNameModal from '../../components/shared/EditNameModal';

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
const ACTIVITY_TABS = [
  { key: 'all',            label: 'All'            },
  { key: 'role_change',    label: 'Role Changes'   },
  { key: 'password_reset', label: 'Password Resets'},
  { key: 'name_change',    label: 'Name Changes'   },
  { key: 'program_change', label: 'Program Changes'},
  { key: 'user_deletion',  label: 'Deletions'      },
];

const ACTIVITY_BADGE = {
  role_change:    { bg: 'var(--badge-red-bg)',   border: 'var(--badge-red-border)',   color: 'var(--badge-red-text)',   label: 'Role'     },
  password_reset: { bg: 'var(--badge-blue-bg)',  border: 'var(--badge-blue-border)',  color: 'var(--badge-blue-text)',  label: 'Password' },
  name_change:    { bg: 'var(--badge-gold-bg)',  border: 'var(--badge-gold-border)',  color: 'var(--badge-gold-text)',  label: 'Name'     },
  program_change: { bg: 'var(--badge-green-bg)', border: 'var(--badge-green-border)', color: 'var(--badge-green-text)', label: 'Program'  },
  user_deletion:  { bg: 'var(--badge-red-bg)',   border: 'var(--badge-red-border)',   color: 'var(--badge-red-text)',   label: 'Deleted'  },
};

function AuditModal({ logs, onClose }) {
  const [actFilter, setActFilter] = useState('all');
  const [search, setSearch] = useState('');
  const fmt = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const filtered = logs
    .filter(l => actFilter === 'all' || l.activityType === actFilter)
    .filter(l => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (l.targetName || '').toLowerCase().includes(q) ||
        (l.targetId   || '').toLowerCase().includes(q) ||
        (l.changedByName || '').toLowerCase().includes(q) ||
        (l.reason     || '').toLowerCase().includes(q) ||
        (l.oldName    || '').toLowerCase().includes(q) ||
        (l.newName    || '').toLowerCase().includes(q) ||
        (l.deletedIdNumber || '').toLowerCase().includes(q)
      );
    });

  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)', padding:16 }}>
      <div style={{ background:'var(--card)', border:'1px solid var(--card-border)', borderRadius:16, width:'100%', maxWidth:820, maxHeight:'88vh', display:'flex', flexDirection:'column', boxShadow:'var(--shadow-modal)', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ background:'var(--thead-bg)', borderBottom:'1px solid var(--divider)', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <p style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, letterSpacing:'0.2em', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:4 }}>Immutable Log</p>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:'var(--text-primary)' }}>Admin Audit Log</h2>
          </div>
          <button onClick={onClose} style={{ background:'var(--surface)', border:'1px solid var(--card-border)', borderRadius:8, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', cursor:'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Search bar */}
        <div style={{ padding:'12px 24px', borderBottom:'1px solid var(--divider)', flexShrink:0, background:'var(--card)' }}>
          <input
            style={{ width:'100%', background:'var(--input-bg)', border:'1px solid var(--input-border)', borderRadius:8, padding:'9px 14px', fontSize:13, color:'var(--text-primary)', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
            placeholder="Search by name, ID, reason, or changed by…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Activity type filter tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid var(--divider)', flexShrink:0, overflowX:'auto', background:'var(--card)' }}>
          {ACTIVITY_TABS.map(t => (
            <button key={t.key} onClick={() => setActFilter(t.key)}
              style={{ padding:'10px 18px', fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer', background:'transparent', border:'none', borderBottom: actFilter === t.key ? '2px solid var(--gold)' : '2px solid transparent', color: actFilter === t.key ? 'var(--gold)' : 'var(--text-muted)', whiteSpace:'nowrap', transition:'all 0.15s' }}>
              {t.label}
              <span style={{ marginLeft:6, fontSize:9, padding:'1px 6px', borderRadius:10, background: actFilter === t.key ? 'var(--gold-soft)' : 'var(--surface)', color: actFilter === t.key ? 'var(--gold)' : 'var(--text-dim)', border:`1px solid ${actFilter === t.key ? 'var(--gold-border)' : 'var(--card-border)'}` }}>
                {t.key === 'all' ? logs.length : logs.filter(l => l.activityType === t.key).length}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={{ overflowY:'auto', flex:1 }}>
          {filtered.length === 0 ? (
            <p style={{ padding:24, textAlign:'center', fontFamily:"'Poppins',sans-serif", fontSize:13, color:'var(--text-muted)' }}>No records found.</p>
          ) : (
            <table style={{ width:'100%', minWidth:600, borderCollapse:'collapse' }}>
              <thead style={{ position:'sticky', top:0 }}>
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Type</th>
                  <th className="th">Target User</th>
                  <th className="th">Detail</th>
                  <th className="th">Changed By</th>
                  <th className="th">Note / Reason</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const ab = ACTIVITY_BADGE[l.activityType] || ACTIVITY_BADGE.role_change;
                  return (
                    <tr key={l.id} style={{ borderBottom:'1px solid var(--row-border)' }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--row-hover-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td className="td" style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{fmt(l.timestamp)}</td>
                      <td className="td">
                        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:20, background:ab.bg, border:`1px solid ${ab.border}`, color:ab.color, textTransform:'uppercase', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>{ab.label}</span>
                      </td>
                      <td className="td" style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)', whiteSpace:'nowrap' }}>
                        {l.targetName || '—'}
                        {l.deletedIdNumber && <p style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{l.deletedIdNumber}</p>}
                      </td>
                      <td className="td" style={{ fontSize:12, color:'var(--text-body)', maxWidth:200 }}>
                        {l.activityType === 'role_change' && (
                          <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <span className={`badge ${BADGE[l.fromRole] || 'badge-gray'}`}>{l.fromRole}</span>
                            <span style={{ color:'var(--text-dim)' }}>→</span>
                            <span className={`badge ${BADGE[l.toRole] || 'badge-gray'}`}>{l.toRole}</span>
                          </span>
                        )}
                        {l.activityType === 'password_reset' && (
                          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'var(--text-muted)' }}>Reset flag set</span>
                        )}
                        {l.activityType === 'name_change' && (
                          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'var(--text-body)' }}>
                            {l.oldName || '—'} → {l.newName || '—'}
                          </span>
                        )}
                        {l.activityType === 'program_change' && (
                          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'var(--text-body)' }}>
                            {l.oldProgram || '—'} → {l.newProgram || '—'}
                          </span>
                        )}
                        {l.activityType === 'user_deletion' && (
                          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'var(--badge-red-text)' }}>
                            Hard deleted · {l.borrowsSnapshotted ?? 0} borrows, {l.logsSnapshotted ?? 0} visits snapshotted
                          </span>
                        )}
                      </td>
                      <td className="td" style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{l.changedByName || l.approvedByName || '—'}</td>
                      <td className="td" style={{ fontSize:12, color:'var(--text-body)', maxWidth:180 }}>{l.reason || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)', padding:16 }}>
      <div style={{ background:'var(--card)', border:'1px solid var(--card-border)', borderRadius:16, width:'100%', maxWidth:780, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'var(--shadow-modal)', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ background:'var(--thead-bg)', borderBottom:'1px solid var(--divider)', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <p style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, letterSpacing:'0.2em', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:4 }}>Immutable Log</p>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:'var(--text-primary)' }}>Admin Audit Log</h2>
          </div>
          <button onClick={onClose} style={{ background:'var(--surface)', border:'1px solid var(--card-border)', borderRadius:8, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', cursor:'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Activity type filter tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid var(--divider)', flexShrink:0, overflowX:'auto', background:'var(--card)' }}>
          {ACTIVITY_TABS.map(t => (
            <button key={t.key} onClick={() => setActFilter(t.key)}
              style={{ padding:'10px 18px', fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', cursor:'pointer', background:'transparent', border:'none', borderBottom: actFilter === t.key ? '2px solid var(--gold)' : '2px solid transparent', color: actFilter === t.key ? 'var(--gold)' : 'var(--text-muted)', whiteSpace:'nowrap', transition:'all 0.15s' }}>
              {t.label}
              <span style={{ marginLeft:6, fontSize:9, padding:'1px 6px', borderRadius:10, background: actFilter === t.key ? 'var(--gold-soft)' : 'var(--surface)', color: actFilter === t.key ? 'var(--gold)' : 'var(--text-dim)', border:`1px solid ${actFilter === t.key ? 'var(--gold-border)' : 'var(--card-border)'}` }}>
                {t.key === 'all' ? logs.length : logs.filter(l => l.activityType === t.key).length}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={{ overflowY:'auto', flex:1 }}>
          {filtered.length === 0 ? (
            <p style={{ padding:24, textAlign:'center', fontFamily:"'Poppins',sans-serif", fontSize:13, color:'var(--text-muted)' }}>No records found.</p>
          ) : (
            <table style={{ width:'100%', minWidth:600, borderCollapse:'collapse' }}>
              <thead style={{ position:'sticky', top:0 }}>
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Type</th>
                  <th className="th">Target User</th>
                  <th className="th">Detail</th>
                  <th className="th">Changed By</th>
                  <th className="th">Note</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const ab = ACTIVITY_BADGE[l.activityType] || ACTIVITY_BADGE.role_change;
                  return (
                    <tr key={l.id} style={{ borderBottom:'1px solid var(--row-border)' }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--row-hover-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <td className="td" style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{fmt(l.timestamp)}</td>
                      <td className="td">
                        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:20, background:ab.bg, border:`1px solid ${ab.border}`, color:ab.color, textTransform:'uppercase', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>{ab.label}</span>
                      </td>
                      <td className="td" style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)', whiteSpace:'nowrap' }}>{l.targetName || '—'}</td>
                      <td className="td" style={{ fontSize:12, color:'var(--text-body)', maxWidth:200 }}>
                        {l.activityType === 'role_change' && (
                          <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <span className={`badge ${BADGE[l.fromRole] || 'badge-gray'}`}>{l.fromRole}</span>
                            <span style={{ color:'var(--text-dim)' }}>→</span>
                            <span className={`badge ${BADGE[l.toRole] || 'badge-gray'}`}>{l.toRole}</span>
                          </span>
                        )}
                        {l.activityType === 'password_reset' && (
                          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'var(--text-muted)' }}>Reset flag set</span>
                        )}
                        {l.activityType === 'name_change' && (
                          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'var(--text-body)' }}>
                            {l.oldName || '—'} → {l.newName || '—'}
                          </span>
                        )}
                        {l.activityType === 'program_change' && (
                          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:'var(--text-body)' }}>
                            {l.oldProgram || '—'} → {l.newProgram || '—'}
                          </span>
                        )}
                      </td>

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

  // Audit modal
  const [auditOpen,  setAuditOpen]  = useState(false);

  // Password reset
  const [resetPwId,  setResetPwId]  = useState(null);

  // Edit profile (college/course)
  const [editProfileTarget, setEditProfileTarget] = useState(null);

  // Edit name (admin only)
  const [editNameTarget, setEditNameTarget] = useState(null);

  // Delete request state
  const [deleteTarget,       setDeleteTarget]       = useState(null); // user to request deletion of
  const [deleteReason,       setDeleteReason]       = useState('');
  const [deleteSaving,       setDeleteSaving]       = useState(false);
  const [deleteRequests,     setDeleteRequests]     = useState([]);
  const [showDeleteRequests, setShowDeleteRequests] = useState(false);

  // Deleted user modal (clicked row with no existing profile)
  const [deletedUserModal, setDeletedUserModal] = useState(false);

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

  // Live audit logs — unified collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'adminAuditLogs'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));
      setAuditLogs(docs);
    }, () => {});
    return unsub;
  }, []);

  // Live delete requests
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'deleteRequests'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.requestedAt?.toMillis?.() ?? 0) - (a.requestedAt?.toMillis?.() ?? 0));
      setDeleteRequests(docs);
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
  // Admin promotion disabled — use role management policy
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
      await addDoc(collection(db, 'adminAuditLogs'), {
        activityType:  'password_reset',
        targetId:      user.id,
        targetName:    `${user.lastName}, ${user.firstName}`,
        changedBy:     myProfile?.uid,
        changedByName: `${myProfile?.lastName}, ${myProfile?.firstName}`,
        reason:        'Admin-initiated password reset to ID number',
        timestamp:     serverTimestamp(),
      });
      showToast(`Password reset flag set for ${user.firstName}. They will be prompted to change their password on next login.`, true);
    } catch (err) {
      showToast('Failed to set reset flag: ' + err.message, false);
    } finally { setResetPwId(null); }
  };

  const initChange = (user, toRole) => {
    setPending({ user, toRole });
    setReason('');
  };

  // ── Confirm role change ───────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!pending) return;
    if (reason.trim().length < 10) { showToast('Reason must be at least 10 characters.', false); return; }

    setSaving(pending.user.id);
    try {
      // If demoting to student and user has no qrToken, generate one now
      const updatePayload = { role: pending.toRole };
      if (pending.toRole === 'student' && !pending.user.qrToken) {
        updatePayload.qrToken = crypto.randomUUID().replace(/-/g, '');
      }
      await updateDoc(doc(db, 'users', pending.user.id), updatePayload);
      await addDoc(collection(db, 'adminAuditLogs'), {
        activityType:  'role_change',
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
        u.id === pending.user.id ? { ...u, role: pending.toRole, ...(updatePayload.qrToken ? { qrToken: updatePayload.qrToken } : {}) } : u
      ));
      showToast(`${pending.user.firstName}'s role updated to ${pending.toRole}${updatePayload.qrToken ? ' — QR code generated.' : '.'}`, true);
    } catch (e) {
      showToast('Error: ' + e.message, false);
    }
    setSaving(null);
    setPending(null);
  };

  // ── Delete request (staff submits) ───────────────────────────────────────
  const handleRequestDelete = async () => {
    if (!deleteTarget) return;
    if (deleteReason.trim().length < 10) { showToast('Reason must be at least 10 characters.', false); return; }
    setDeleteSaving(true);
    try {
      await addDoc(collection(db, 'deleteRequests'), {
        targetId:      deleteTarget.id,
        targetName:    `${deleteTarget.lastName}, ${deleteTarget.firstName}`,
        targetIdNumber: deleteTarget.idNumber || '',
        targetRole:    deleteTarget.role || 'student',
        reason:        deleteReason.trim(),
        requestedBy:   myProfile?.uid,
        requestedByName: `${myProfile?.lastName}, ${myProfile?.firstName}`,
        requestedAt:   serverTimestamp(),
        status:        'pending',
      });
      showToast(`Deletion request submitted for ${deleteTarget.firstName}. Awaiting admin approval.`, true);
      setDeleteTarget(null);
      setDeleteReason('');
    } catch (e) {
      showToast('Failed to submit request: ' + e.message, false);
    }
    setDeleteSaving(false);
  };

  // ── Admin approves delete (hard delete + snapshot) ────────────────────────
  const handleApproveDelete = async (req) => {
    if (!window.confirm(`Permanently delete user "${req.targetName}"? This cannot be undone. Their borrow and logger records will be snapshotted first.`)) return;
    try {
      const batch = writeBatch(db);

      // 1. Snapshot borrows — write studentName + studentId into each doc
      const borrowsSnap = await getDocs(query(collection(db, 'borrows'), where('userId', '==', req.targetId)));
      borrowsSnap.forEach(d => {
        batch.update(doc(db, 'borrows', d.id), {
          studentName:      req.targetName,
          studentId:        req.targetIdNumber,
          userDeleted:      true,
        });
      });

      // 2. Snapshot logger entries
      const loggerSnap = await getDocs(query(collection(db, 'logger'), where('uid', '==', req.targetId)));
      loggerSnap.forEach(d => {
        batch.update(doc(db, 'logger', d.id), {
          studentName:  req.targetName,
          studentId:    req.targetIdNumber,
          userDeleted:  true,
        });
      });

      // 3. Hard delete the user doc
      batch.delete(doc(db, 'users', req.targetId));

      // 4. Mark deleteRequest as approved
      batch.update(doc(db, 'deleteRequests', req.id), {
        status:       'approved',
        approvedBy:   myProfile?.uid,
        approvedByName: `${myProfile?.lastName}, ${myProfile?.firstName}`,
        approvedAt:   serverTimestamp(),
      });

      await batch.commit();

      // 5. Write audit log
      await addDoc(collection(db, 'adminAuditLogs'), {
        activityType:       'user_deletion',
        targetId:           req.targetId,
        targetName:         req.targetName,
        deletedIdNumber:    req.targetIdNumber,
        reason:             req.reason,
        requestedBy:        req.requestedBy,
        requestedByName:    req.requestedByName,
        approvedBy:         myProfile?.uid,
        approvedByName:     `${myProfile?.lastName}, ${myProfile?.firstName}`,
        borrowsSnapshotted: borrowsSnap.size,
        logsSnapshotted:    loggerSnap.size,
        timestamp:          serverTimestamp(),
      });

      showToast(`${req.targetName} permanently deleted. ${borrowsSnap.size} borrow(s) and ${loggerSnap.size} log(s) snapshotted.`, true);
    } catch (e) {
      showToast('Delete failed: ' + e.message, false);
    }
  };

  // ── Admin rejects delete request ──────────────────────────────────────────
  const handleRejectDelete = async (req) => {
    try {
      await updateDoc(doc(db, 'deleteRequests', req.id), {
        status:       'rejected',
        rejectedBy:   myProfile?.uid,
        rejectedAt:   serverTimestamp(),
      });
      showToast(`Deletion request for ${req.targetName} rejected.`, true);
    } catch (e) {
      showToast('Failed to reject: ' + e.message, false);
    }
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
      <style>{`
        tr.log-row:hover td { background: var(--row-hover-bg) !important; color: var(--row-hover-text) !important; }
      `}</style>
      <div className="pb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4" style={{borderBottom:"1px solid var(--divider)",paddingBottom:24}}>
        <div>
          <p className="font-mono text-[10px] tracking-widest uppercase mb-1" style={{color:"var(--text-muted)"}}>Administration</p>
          <h1 className="page-title">User Management</h1>
          <p className="text-sm mt-1" style={{color:"var(--text-muted)"}}> 
            Manage roles for registered users. Admin accounts are fully protected.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          {myProfile?.role === 'admin' && deleteRequests.filter(r => r.status === 'pending').length > 0 && (
            <button className="btn-secondary text-xs py-2 px-4"
              style={{ borderColor:'var(--red-border)', color:'var(--red)' }}
              onClick={() => setShowDeleteRequests(true)}>
              ⚠ Delete Requests ({deleteRequests.filter(r => r.status === 'pending').length})
            </button>
          )}
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
        <div className="flex" style={{borderBottom:"1px solid var(--divider)"}}> 
          {ROLE_TABS.map(t => (
            <button key={t.key} onClick={() => setRoleFilter(t.key)}
              className="px-5 py-2.5 text-xs font-mono font-semibold tracking-widest uppercase flex items-center gap-2 transition-colors"
              style={{
                borderBottom: roleFilter === t.key ? '2px solid var(--gold)' : '2px solid transparent',
                color: roleFilter === t.key ? 'var(--gold)' : 'var(--text-muted)',
                background: 'transparent', border: 'none',
                borderBottom: roleFilter === t.key ? '2px solid var(--gold)' : '2px solid transparent',
                cursor: 'pointer',
              }}>
              {t.label}
              <span className="text-[10px] px-1.5 py-0.5 font-bold rounded" style={{
                background: t.key === 'admin' ? 'var(--badge-red-bg)' : t.key === 'staff' ? 'var(--badge-gold-bg)' : t.key === 'student' ? 'var(--badge-green-bg)' : 'var(--badge-gray-bg)',
                color: t.key === 'admin' ? 'var(--badge-red-text)' : t.key === 'staff' ? 'var(--badge-gold-text)' : t.key === 'student' ? 'var(--badge-green-text)' : 'var(--badge-gray-text)',
              }}>
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Result summary */}
      {(search || roleFilter !== 'all') && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono" style={{color:"var(--text-muted)"}}> 
            Showing <strong style={{color:"var(--text-primary)"}}>{filtered.length}</strong> of {users.length} users
          </p>
          <button className="text-xs font-mono" style={{color:"var(--gold)",background:"none",border:"none",cursor:"pointer"}}
            onClick={() => { setSearch(''); setRoleFilter('all'); }}>
            Clear filters
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="text-sm font-mono p-6" style={{color:"var(--text-muted)"}}>Loading users…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm p-8 text-center" style={{color:"var(--text-muted)"}}>No users match your filters.</p>
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
                  <tr key={u.id} className="log-row">
                    <td className="td">
                      <p className="font-semibold text-sm">
                        {u.lastName
                          ? `${u.lastName}, ${u.firstName}${u.middleInitial ? ' ' + u.middleInitial + '.' : ''}`.trim()
                          : u.email}
                      </p>
                      {u.id === myProfile?.uid && (
                        <span className="text-[10px] font-mono" style={{color:"var(--gold)"}}>(you)</span>
                      )}
                    </td>
                    <td className="td font-mono text-xs">{u.idNumber || '—'}</td>
                    <td className="td text-xs font-mono" style={{color:"var(--text-muted)"}}>{u.email}</td>
                    <td className="td text-xs">
                      <p className="font-medium">{u.college || u.department || '—'}</p>
                      {u.course    && <p style={{color:"var(--text-muted)"}}> {u.course}</p>}
                      {u.yearLevel && <p style={{color:"var(--text-muted)"}}> {u.yearLevel}</p>}
                    </td>
                    <td className="td">
                      <span className={`badge ${BADGE[u.role] || 'badge-gray'}`}>
                        {u.role || 'student'}
                      </span>
                    </td>
                    <td className="td">
                      {u.role === 'admin' ? (
                        <span className="text-xs font-mono italic" style={{color:"var(--text-muted)"}}>Protected — Admin</span>
                      ) : u.id === myProfile?.uid ? (
                        <span className="text-xs font-mono italic" style={{color:"var(--text-muted)"}}>Your account</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {canPromoteToStaff(u) && (
                            <button
                              className="text-[10px] font-mono font-semibold px-2.5 py-1 transition-colors" style={{border:"1px solid var(--badge-gold-border)",color:"var(--badge-gold-text)",background:"transparent",borderRadius:4,cursor:"pointer"}}
                              onClick={() => initChange(u, 'staff')}
                              disabled={saving === u.id}
                            >↑ Staff</button>
                          )}
                          {canDemoteToStudent(u) && (
                            <button
                              className="text-[10px] font-mono font-semibold px-2.5 py-1 transition-colors" style={{border:"1px solid var(--card-border)",color:"var(--text-muted)",background:"transparent",borderRadius:4,cursor:"pointer"}}
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
                          <button
                            className="border text-[10px] font-mono font-semibold px-2.5 py-1 transition-colors"
                            style={{borderColor:'var(--badge-green-border)',color:'var(--badge-green-text)',background:'transparent'}}
                            onClick={() => setEditNameTarget({ uid: u.id, profile: u })}
                            title="Edit student name"
                          >Edit Name</button>
                          <button
                            className="border text-[10px] font-mono font-semibold px-2.5 py-1 transition-colors"
                            style={{borderColor:'var(--red-border)',color:'var(--red)',background:'transparent'}}
                            onClick={() => { setDeleteTarget(u); setDeleteReason(''); }}
                            title="Request user deletion"
                          >Delete</button>
                          {saving === u.id && (
                            <span className="text-[10px] font-mono animate-pulse" style={{color:"var(--text-muted)"}}>Saving…</span>
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
          <div className="modal-role-change" style={{background:"var(--card)",border:"1px solid var(--card-border)",borderRadius:12,width:"100%",maxWidth:480,boxShadow:"var(--shadow-modal)"}}>
            <div className="modal-role-header" style={{background:"var(--thead-bg)",borderBottom:"1px solid var(--divider)",padding:"16px 24px"}}>
              <p className="font-mono text-[10px] tracking-widest uppercase mb-0.5" style={{color:"var(--text-muted)"}}>Role Change</p>
              <h2 className="font-display text-lg font-bold leading-tight" style={{color:"var(--text-primary)"}}>
                {pending.user.lastName}, {pending.user.firstName}
              </h2>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`badge ${BADGE[pending.user.role]}`}>{pending.user.role}</span>
                <span style={{color:"var(--text-muted)",fontSize:12}}>→</span>
                <span className={`badge ${BADGE[pending.toRole]}`}>{pending.toRole}</span>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4" style={{background:'var(--card)'}}>
              <div className="px-4 py-3 text-xs rounded-lg" style={{
                background: pending.toRole === 'admin' ? 'var(--red-soft)' : pending.toRole === 'staff' ? 'var(--gold-soft)' : 'var(--surface)',
                border: `1px solid ${pending.toRole === 'admin' ? 'var(--red-border)' : pending.toRole === 'staff' ? 'var(--gold-border)' : 'var(--card-border)'}`,
                color: pending.toRole === 'admin' ? 'var(--red)' : pending.toRole === 'staff' ? 'var(--gold)' : 'var(--text-muted)',
              }}>
                {pending.toRole === 'admin'
                  ? 'Important: Admin accounts are fully protected after promotion. This cannot be reversed by any admin.'
                  : pending.toRole === 'staff'
                  ? 'This grants access to approve borrows, manage the logger, and view student records.'
                  : 'This removes staff access and reverts the account to a standard student account.'}
              </div>
              <div>
                <label className="label">
                  Reason for change <span style={{color:'var(--red)'}}>*</span>
                </label>
                <textarea
                  className="input resize-none h-20 text-sm"
                  placeholder="Min 10 characters — recorded in audit log…"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  autoFocus
                />
                <p className="text-[10px] font-mono mt-1" style={{color:"var(--text-dim)"}}>
                  {reason.trim().length} / 10 characters minimum
                </p>
              </div>
            </div>
            <div className="modal-role-footer flex justify-end gap-3" style={{padding:"16px 24px",borderTop:"1px solid var(--divider)",background:"var(--surface)"}}>
              <button className="btn-secondary" onClick={() => setPending(null)} disabled={!!saving}>
                Cancel
              </button>
              <button
                className='btn-primary'
                disabled={
                  reason.trim().length < 10 ||
                  !!saving
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

      {/* Edit Name modal */}
      {editNameTarget && (
        <EditNameModal
          onClose={() => setEditNameTarget(null)}
          targetUid={editNameTarget.uid}
          targetProfile={editNameTarget.profile}
        />
      )}

      {/* Delete Request Modal (staff submits / admin too) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div style={{background:'var(--card)',border:'1px solid var(--card-border)',borderRadius:12,width:'100%',maxWidth:480,boxShadow:'var(--shadow-modal)'}}>
            <div style={{background:'var(--thead-bg)',borderBottom:'1px solid var(--divider)',padding:'16px 24px'}}>
              <p className="font-mono text-[10px] tracking-widest uppercase mb-0.5" style={{color:'var(--red)'}}>⚠ Delete User</p>
              <h2 className="font-display text-lg font-bold" style={{color:'var(--text-primary)'}}>
                {deleteTarget.lastName}, {deleteTarget.firstName}
              </h2>
              <p className="text-xs font-mono mt-1" style={{color:'var(--text-muted)'}}>{deleteTarget.idNumber}</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div style={{background:'var(--red-soft)',border:'1px solid var(--red-border)',borderRadius:8,padding:'12px 16px'}}>
                <p style={{fontSize:12,color:'var(--red)',lineHeight:1.6}}>
                  {myProfile?.role === 'admin'
                    ? 'As admin, your deletion request will be queued for review. A hard delete will permanently remove this user and snapshot their records.'
                    : 'This will submit a deletion request to an Admin for approval. The user will not be deleted until an Admin approves the request.'}
                </p>
              </div>
              <div>
                <label className="label">Reason for deletion <span style={{color:'var(--red)'}}>*</span></label>
                <textarea
                  className="input resize-none h-20 text-sm"
                  placeholder="e.g. Unenrolled, graduated, duplicate account… (min 10 chars)"
                  value={deleteReason}
                  onChange={e => setDeleteReason(e.target.value)}
                  autoFocus
                />
                <p className="text-[10px] font-mono mt-1" style={{color:'var(--text-dim)'}}>{deleteReason.trim().length} / 10 characters minimum</p>
              </div>
            </div>
            <div style={{padding:'16px 24px',borderTop:'1px solid var(--divider)',background:'var(--surface)',display:'flex',justifyContent:'flex-end',gap:12}}>
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleteSaving}>Cancel</button>
              <button
                disabled={deleteReason.trim().length < 10 || deleteSaving}
                onClick={handleRequestDelete}
                style={{padding:'9px 20px',borderRadius:8,background:'var(--red-soft)',border:'1px solid var(--red-border)',color:'var(--red)',fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',cursor:deleteReason.trim().length < 10 || deleteSaving ? 'not-allowed' : 'pointer',opacity:deleteReason.trim().length < 10 || deleteSaving ? 0.5 : 1}}>
                {deleteSaving ? 'Submitting…' : 'Submit Delete Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Requests Review Panel (admin only) */}
      {showDeleteRequests && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div style={{background:'var(--card)',border:'1px solid var(--card-border)',borderRadius:16,width:'100%',maxWidth:700,maxHeight:'80vh',display:'flex',flexDirection:'column',boxShadow:'var(--shadow-modal)',overflow:'hidden'}}>
            <div style={{background:'var(--thead-bg)',borderBottom:'1px solid var(--divider)',padding:'16px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div>
                <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:9,letterSpacing:'0.2em',color:'var(--red)',textTransform:'uppercase',marginBottom:4}}>Admin Review</p>
                <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:'var(--text-primary)'}}>Deletion Requests</h2>
              </div>
              <button onClick={() => setShowDeleteRequests(false)} style={{background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:8,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)',cursor:'pointer'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{overflowY:'auto',flex:1}}>
              {deleteRequests.length === 0 ? (
                <p style={{padding:24,textAlign:'center',fontFamily:"'Poppins',sans-serif",fontSize:13,color:'var(--text-muted)'}}>No deletion requests.</p>
              ) : (
                <table style={{width:'100%',minWidth:560,borderCollapse:'collapse'}}>
                  <thead style={{position:'sticky',top:0}}>
                    <tr>
                      <th className="th">User</th>
                      <th className="th">Reason</th>
                      <th className="th">Requested By</th>
                      <th className="th">Status</th>
                      <th className="th">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deleteRequests.map(req => (
                      <tr key={req.id} style={{borderBottom:'1px solid var(--row-border)'}}
                        onMouseEnter={e => e.currentTarget.style.background='var(--row-hover-bg)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <td className="td">
                          <p style={{fontWeight:600,fontSize:13,color:'var(--text-primary)'}}>{req.targetName}</p>
                          <p style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:'var(--text-muted)'}}>{req.targetIdNumber}</p>
                        </td>
                        <td className="td" style={{fontSize:12,color:'var(--text-body)',maxWidth:180}}>{req.reason}</td>
                        <td className="td" style={{fontSize:12,color:'var(--text-muted)'}}>{req.requestedByName || '—'}</td>
                        <td className="td">
                          {req.status === 'pending'  && <span className="badge badge-gold">Pending</span>}
                          {req.status === 'approved' && <span className="badge badge-red">Deleted</span>}
                          {req.status === 'rejected' && <span className="badge badge-gray">Rejected</span>}
                        </td>
                        <td className="td">
                          {req.status === 'pending' && (
                            <div style={{display:'flex',gap:6}}>
                              <button
                                style={{padding:'4px 10px',borderRadius:6,background:'var(--red-soft)',border:'1px solid var(--red-border)',color:'var(--red)',fontFamily:"'IBM Plex Mono',monospace",fontSize:9,fontWeight:700,cursor:'pointer',textTransform:'uppercase'}}
                                onClick={() => handleApproveDelete(req)}>
                                Approve
                              </button>
                              <button
                                style={{padding:'4px 10px',borderRadius:6,background:'var(--surface)',border:'1px solid var(--card-border)',color:'var(--text-muted)',fontFamily:"'IBM Plex Mono',monospace",fontSize:9,fontWeight:700,cursor:'pointer',textTransform:'uppercase'}}
                                onClick={() => handleRejectDelete(req)}>
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 shadow-lg text-sm font-mono tracking-wide"
          style={{background: toast.ok ? 'var(--green-soft)' : 'var(--red-soft)', border: `1px solid ${toast.ok ? 'var(--green-border)' : 'var(--red-border)'}`, borderRadius:10, color: toast.ok ? 'var(--green)' : 'var(--red)'}}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
