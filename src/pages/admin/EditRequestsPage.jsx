// src/pages/admin/EditRequestsPage.jsx
import { useEffect, useState, useMemo } from 'react';
import {
  collection, query, where, onSnapshot,
  updateDoc, addDoc, doc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

const PP = { fontFamily: "'Poppins', sans-serif" };
const SR = { fontFamily: "'Playfair Display', serif" };
const MN = { fontFamily: "'IBM Plex Mono', monospace" };

const FIELD_LABELS = {
  firstName:     'First Name',
  lastName:      'Last Name',
  middleInitial: 'Middle Initial',
  idNumber:      'ID Number',
  visitorType:   'Visitor Type',
  college:       'College',
  course:        'Course',
};

const REJECT_TEMPLATES = [
  'Information seems incorrect based on our records.',
  'ID number does not match enrolled student list.',
  'Supporting documents required — please visit the library counter.',
  'Request is unclear. Please resubmit with more detail.',
  'Policy restriction — this field cannot be changed at this time.',
];

const STATUS_STYLE = {
  pending:   { bg: 'var(--gold-soft)',  border: 'var(--gold-border)',  color: 'var(--gold)',  label: 'Pending'   },
  approved:  { bg: 'var(--green-soft)', border: 'var(--green-border)', color: 'var(--green)', label: 'Approved'  },
  rejected:  { bg: 'var(--red-soft)',   border: 'var(--red-border)',   color: 'var(--red)',   label: 'Rejected'  },
  cancelled: { bg: 'var(--surface)',    border: 'var(--card-border)',  color: 'var(--text-dim)', label: 'Cancelled' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.cancelled;
  return (
    <span style={{ ...MN, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20, background: s.bg, border: `1px solid ${s.border}`, color: s.color, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

// ── Expandable row ────────────────────────────────────────────────────────────
function RequestRow({ req, myProfile, onApprove, onReject, onReopen, saving }) {
  const [expanded, setExpanded] = useState(false);

  const fmt = ts => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const changeCount = Object.keys(req.changes || {}).length;
  const fieldNames  = Object.keys(req.changes || {}).map(k => FIELD_LABELS[k] || k).join(', ');

  return (
    <>
      {/* Summary row — clickable to expand */}
      <tr
        onClick={() => setExpanded(e => !e)}
        style={{ borderBottom: expanded ? 'none' : '1px solid var(--row-border)', cursor: 'pointer', transition: 'background 0.1s' }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'var(--row-hover-bg)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>

        {/* Expand chevron */}
        <td style={{ padding: '13px 8px 13px 16px', width: 28 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </td>

        <td style={{ padding: '13px 12px' }}>
          <p style={{ ...PP, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 1 }}>{req.userName}</p>
          <p style={{ ...MN, fontSize: 10, color: 'var(--text-muted)' }}>{req.userIdNumber || '—'}</p>
        </td>

        <td style={{ padding: '13px 12px' }}>
          <p style={{ ...PP, fontSize: 12, color: 'var(--text-body)' }}>{fieldNames || '—'}</p>
          <p style={{ ...MN, fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{changeCount} field{changeCount !== 1 ? 's' : ''}</p>
        </td>

        <td style={{ padding: '13px 12px', whiteSpace: 'nowrap' }}>
          <StatusBadge status={req.status} />
        </td>

        <td style={{ padding: '13px 12px' }}>
          <p style={{ ...MN, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmt(req.requestedAt)}</p>
        </td>

        <td style={{ padding: '13px 12px' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: 6 }}>
            {req.status === 'pending' && (
              <>
                <button onClick={() => onApprove(req)} disabled={saving === req.id}
                  style={{ padding: '5px 14px', borderRadius: 7, background: 'var(--green-soft)', border: '1px solid var(--green-border)', color: 'var(--green)', ...MN, fontSize: 10, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: saving === req.id ? 0.6 : 1 }}>
                  {saving === req.id ? '…' : 'Approve'}
                </button>
                <button onClick={() => onReject(req)} disabled={saving === req.id}
                  style={{ padding: '5px 14px', borderRadius: 7, background: 'var(--red-soft)', border: '1px solid var(--red-border)', color: 'var(--red)', ...MN, fontSize: 10, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Reject
                </button>
              </>
            )}
            {req.status === 'rejected' && (
              <button onClick={() => onReopen(req)} disabled={saving === req.id}
                style={{ padding: '5px 14px', borderRadius: 7, background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', color: 'var(--gold)', ...MN, fontSize: 10, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Reopen
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr style={{ borderBottom: '1px solid var(--row-border)' }}>
          <td colSpan={6} style={{ padding: '0 16px 20px 52px', background: 'var(--surface)' }}>
            <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Field changes */}
              <p style={{ ...MN, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 4 }}>Requested Changes</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                {Object.entries(req.changes || {}).map(([key, { current, requested }]) => (
                  <div key={key} style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ ...MN, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 8 }}>
                      {FIELD_LABELS[key] || key}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ ...PP, fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 6, padding: '3px 10px', textDecoration: 'line-through' }}>
                        {current || '(empty)'}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                      <span style={{ ...PP, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', borderRadius: 6, padding: '3px 10px' }}>
                        {requested || '(empty)'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rejection reason */}
              {req.status === 'rejected' && req.rejectionReason && (
                <div style={{ background: 'var(--red-soft)', border: '1px solid var(--red-border)', borderRadius: 8, padding: '10px 14px', marginTop: 4 }}>
                  <p style={{ ...MN, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 4 }}>Rejection Reason</p>
                  <p style={{ ...PP, fontSize: 13, color: 'var(--red)' }}>{req.rejectionReason}</p>
                  {req.rejectedByName && (
                    <p style={{ ...MN, fontSize: 10, color: 'var(--red)', marginTop: 4, opacity: 0.7 }}>by {req.rejectedByName} · {fmt(req.rejectedAt)}</p>
                  )}
                </div>
              )}

              {/* Approval info */}
              {req.status === 'approved' && (
                <div style={{ background: 'var(--green-soft)', border: '1px solid var(--green-border)', borderRadius: 8, padding: '10px 14px', marginTop: 4 }}>
                  <p style={{ ...MN, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: 4 }}>Approved</p>
                  {req.approvedByName && (
                    <p style={{ ...MN, fontSize: 10, color: 'var(--green)' }}>by {req.approvedByName} · {fmt(req.approvedAt)}</p>
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Reject Modal ──────────────────────────────────────────────────────────────
function RejectModal({ req, onConfirm, onCancel, saving }) {
  const [reason, setReason] = useState('');

  const inputSt = {
    width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)',
    borderRadius: 9, padding: '10px 13px', fontSize: 13, color: 'var(--text-primary)',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', resize: 'none',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', padding: 16 }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-modal)', overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--red), transparent)' }} />
        <div style={{ padding: '22px 24px 0' }}>
          <p style={{ ...MN, fontSize: 9, letterSpacing: '0.2em', color: 'var(--red)', textTransform: 'uppercase', marginBottom: 4 }}>Reject Request</p>
          <h3 style={{ ...SR, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{req.userName}</h3>
          <p style={{ ...PP, fontSize: 13, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.6 }}>
            Provide a reason. The visitor will see this when they check the status of their request.
          </p>

          {/* Templates */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {REJECT_TEMPLATES.map(t => (
              <button key={t} type="button" onClick={() => setReason(t)}
                style={{ textAlign: 'left', padding: '9px 13px', borderRadius: 9, cursor: 'pointer', ...PP, fontSize: 12, lineHeight: 1.5,
                  background: reason === t ? 'var(--gold-soft)' : 'var(--surface)',
                  border:     `1px solid ${reason === t ? 'var(--gold-border)' : 'var(--card-border)'}`,
                  color:      reason === t ? 'var(--gold)' : 'var(--text-body)',
                }}>
                {t}
              </button>
            ))}
          </div>

          <textarea rows={3} style={{ ...inputSt, height: 80 }}
            placeholder="Or type a custom reason…"
            value={reason}
            onChange={e => setReason(e.target.value)} />
          <p style={{ ...MN, fontSize: 10, color: 'var(--text-dim)', marginTop: 4, marginBottom: 18 }}>{reason.trim().length} characters</p>
        </div>

        <div style={{ padding: '0 24px 22px', display: 'flex', gap: 10 }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: '11px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', cursor: 'pointer', ...PP, fontSize: 13 }}>
            Cancel
          </button>
          <button onClick={() => onConfirm(reason)} disabled={!reason.trim() || saving}
            style={{ flex: 1, padding: '11px', borderRadius: 9, background: 'var(--red-soft)', border: '1px solid var(--red-border)', color: 'var(--red)', cursor: !reason.trim() ? 'not-allowed' : 'pointer', opacity: !reason.trim() ? 0.5 : 1, ...MN, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {saving ? 'Rejecting…' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function EditRequestsPage() {
  const { userProfile: myProfile } = useAuth();

  const [requests,     setRequests]     = useState([]);
  const [tab,          setTab]          = useState('pending');
  const [search,       setSearch]       = useState('');
  const [saving,       setSaving]       = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [toast,        setToast]        = useState(null);

  // Date range filter
  const [datePreset,  setDatePreset]  = useState('all'); // all | today | week | custom
  const [customFrom,  setCustomFrom]  = useState('');
  const [customTo,    setCustomTo]    = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'editRequests'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.requestedAt?.toMillis?.() ?? 0) - (a.requestedAt?.toMillis?.() ?? 0));
      setRequests(docs);
    }, () => {});
    return unsub;
  }, []);

  const inRange = (ts) => {
    const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
    if (!d) return false;
    if (datePreset === 'all') return true;
    const now = new Date();
    if (datePreset === 'today') return d.toDateString() === now.toDateString();
    if (datePreset === 'week')  { const c = new Date(); c.setDate(c.getDate()-7); return d >= c; }
    if (datePreset === 'custom' && customFrom && customTo) {
      const from = new Date(customFrom); from.setHours(0,0,0,0);
      const to   = new Date(customTo);   to.setHours(23,59,59,999);
      return d >= from && d <= to;
    }
    return true;
  };

  const filtered = useMemo(() => {
    return requests.filter(r => {
      if (r.status !== tab) return false;
      if (!inRange(r.requestedAt)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (r.userName || '').toLowerCase().includes(q) ||
               (r.userIdNumber || '').toLowerCase().includes(q) ||
               Object.keys(r.changes || {}).some(k => FIELD_LABELS[k]?.toLowerCase().includes(q));
      }
      return true;
    });
  }, [requests, tab, search, datePreset, customFrom, customTo]);

  const counts = {
    pending:   requests.filter(r => r.status === 'pending').length,
    approved:  requests.filter(r => r.status === 'approved').length,
    rejected:  requests.filter(r => r.status === 'rejected').length,
    cancelled: requests.filter(r => r.status === 'cancelled').length,
  };

  const showToast = (msg, ok) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4500); };

  const handleApprove = async (req) => {
    setSaving(req.id);
    try {
      const batch  = writeBatch(db);
      const fields = {};
      Object.entries(req.changes || {}).forEach(([key, { requested }]) => { fields[key] = requested; });
      batch.update(doc(db, 'users', req.uid), fields);
      batch.update(doc(db, 'editRequests', req.id), {
        status:        'approved',
        approvedBy:    myProfile?.uid,
        approvedByName:`${myProfile?.lastName}, ${myProfile?.firstName}`,
        approvedAt:    serverTimestamp(),
      });
      await batch.commit();
      await addDoc(collection(db, 'adminAuditLogs'), {
        activityType:  'edit_approved',
        targetId:      req.uid,
        targetName:    req.userName,
        changes:       req.changes,
        changedBy:     myProfile?.uid,
        changedByName: `${myProfile?.lastName}, ${myProfile?.firstName}`,
        timestamp:     serverTimestamp(),
      });
      showToast(`Approved — ${req.userName}'s info updated.`, true);
    } catch (e) { showToast('Approve failed: ' + e.message, false); }
    setSaving(null);
  };

  const handleRejectConfirm = async (reason) => {
    if (!rejectTarget) return;
    setSaving(rejectTarget.id);
    try {
      await updateDoc(doc(db, 'editRequests', rejectTarget.id), {
        status:          'rejected',
        rejectionReason: reason.trim(),
        rejectedBy:      myProfile?.uid,
        rejectedByName:  `${myProfile?.lastName}, ${myProfile?.firstName}`,
        rejectedAt:      serverTimestamp(),
      });
      showToast(`Request from ${rejectTarget.userName} rejected.`, true);
      setRejectTarget(null);
    } catch (e) { showToast('Reject failed: ' + e.message, false); }
    setSaving(null);
  };

  const handleReopen = async (req) => {
    setSaving(req.id);
    try {
      await updateDoc(doc(db, 'editRequests', req.id), {
        status:          'pending',
        reopenedAt:      serverTimestamp(),
        rejectionReason: null,
      });
      showToast(`Request from ${req.userName} moved back to pending.`, true);
      setTab('pending');
    } catch (e) { showToast('Reopen failed: ' + e.message, false); }
    setSaving(null);
  };

  const inputSt = {
    background: 'var(--input-bg)', border: '1px solid var(--input-border)',
    borderRadius: 9, padding: '9px 13px', fontSize: 13, color: 'var(--text-primary)',
    fontFamily: 'inherit', outline: 'none',
  };

  const TABS = [
    { key: 'pending',   label: 'Pending',   danger: true  },
    { key: 'approved',  label: 'Approved',  danger: false },
    { key: 'rejected',  label: 'Rejected',  danger: false },
    { key: 'cancelled', label: 'Cancelled', danger: false },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeUp 0.3s ease both' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ paddingBottom: 20, borderBottom: '1px solid var(--divider)' }}>
        <p style={{ ...MN, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6 }}>Administration</p>
        <h1 style={{ ...SR, fontSize: 'clamp(22px,3.5vw,30px)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Edit Requests</h1>
        <p style={{ ...PP, fontSize: 14, color: 'var(--text-muted)' }}>Review and action visitor information update requests.</p>
      </div>

      {/* Filters row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        {/* Search */}
        <input style={{ ...inputSt, flex: '1 1 220px', minWidth: 180 }}
          placeholder="Search by name, ID, or field…"
          value={search} onChange={e => setSearch(e.target.value)} />

        {/* Date presets */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'all',    label: 'All Time'  },
            { key: 'today',  label: 'Today'     },
            { key: 'week',   label: 'This Week' },
            { key: 'custom', label: 'Custom'    },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setDatePreset(key)}
              style={{ padding: '7px 14px', borderRadius: 8, cursor: 'pointer', ...MN, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                background: datePreset === key ? 'var(--gold-soft)' : 'var(--surface)',
                border:     `1px solid ${datePreset === key ? 'var(--gold-border)' : 'var(--card-border)'}`,
                color:      datePreset === key ? 'var(--gold)' : 'var(--text-muted)',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      {datePreset === 'custom' && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <label style={{ ...MN, fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 5 }}>From</label>
            <input type="date" style={inputSt} value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
          </div>
          <div>
            <label style={{ ...MN, fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 5 }}>To</label>
            <input type="date" style={inputSt} value={customTo} onChange={e => setCustomTo(e.target.value)} />
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--divider)', background: 'var(--thead-bg)' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: '12px 20px', ...MN, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', background: 'transparent', border: 'none',
                borderBottom: tab === t.key ? '2px solid var(--gold)' : '2px solid transparent',
                color: tab === t.key ? 'var(--gold)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
              }}>
              {t.label}
              {counts[t.key] > 0 && (
                <span style={{ fontSize: 9, padding: '1px 7px', borderRadius: 20,
                  background: t.danger && tab === t.key ? 'var(--gold-soft)' : t.danger ? 'var(--red-soft)' : 'var(--surface)',
                  color:      t.danger ? (tab === t.key ? 'var(--gold)' : 'var(--red)') : 'var(--text-dim)',
                  border:     `1px solid ${t.danger ? (tab === t.key ? 'var(--gold-border)' : 'var(--red-border)') : 'var(--card-border)'}`,
                }}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <p style={{ ...PP, fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>No {tab} requests</p>
            {search && <p style={{ ...MN, fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Try clearing the search filter</p>}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--thead-bg)' }}>
                  <th style={{ width: 28 }} />
                  {['Visitor', 'Fields Changed', 'Status', 'Requested', 'Actions'].map(h => (
                    <th key={h} style={{ ...MN, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '11px 12px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--divider)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(req => (
                  <RequestRow
                    key={req.id}
                    req={req}
                    myProfile={myProfile}
                    onApprove={handleApprove}
                    onReject={setRejectTarget}
                    onReopen={handleReopen}
                    saving={saving}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer count */}
        {filtered.length > 0 && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--divider)', background: 'var(--surface)' }}>
            <p style={{ ...MN, fontSize: 10, color: 'var(--text-dim)' }}>
              Showing {filtered.length} {tab} request{filtered.length !== 1 ? 's' : ''}
              {search ? ` matching "${search}"` : ''}
            </p>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          req={rejectTarget}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
          saving={saving === rejectTarget?.id}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 50, padding: '12px 20px', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', ...MN, fontSize: 12, letterSpacing: '0.06em',
          background: toast.ok ? 'var(--green-soft)' : 'var(--red-soft)',
          border:     `1px solid ${toast.ok ? 'var(--green-border)' : 'var(--red-border)'}`,
          color:      toast.ok ? 'var(--green)' : 'var(--red)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
