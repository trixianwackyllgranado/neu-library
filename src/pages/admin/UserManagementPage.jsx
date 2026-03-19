// src/pages/admin/UserManagementPage.jsx
import { useEffect, useState, useMemo } from 'react';
import {
  collection, updateDoc, addDoc, doc, onSnapshot,
  serverTimestamp, deleteDoc, writeBatch, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { IT_SUPPORT_EMAILS } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { COLLEGES } from '../../data/colleges';
import EditProfileModal from '../../components/shared/EditProfileModal';
import EditNameModal from '../../components/shared/EditNameModal';

const BADGE = { admin: 'badge-red', staff: 'badge-gold', visitor: 'badge-green' };
const MN    = { fontFamily:"'IBM Plex Mono',monospace" };
const PP    = { fontFamily:"'Poppins',sans-serif" };
const SR    = { fontFamily:"'Playfair Display',serif" };

const REJECT_TEMPLATES = [
  'Information seems incorrect based on our records.',
  'ID number does not match enrolled student list.',
  'Supporting documents required — please visit the library counter.',
  'Request is unclear. Please resubmit with more detail.',
  'Policy restriction — this field cannot be changed at this time.',
];

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportUsersCSV(users) {
  const headers = ['Role','Last Name','First Name','Middle Initial','ID Number','Email','College / Department','Course','Account Created'];
  const rows = users.map(u => [
    u.role ?? '', u.lastName ?? '', u.firstName ?? '', u.middleInitial ?? '',
    u.idNumber ?? '', u.email ?? '', u.college ?? u.department ?? '', u.course ?? '',
    u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString('en-PH') : '',
  ]);
  const csv  = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href:url, download:'users.csv' }).click();
  URL.revokeObjectURL(url);
}

// ── Audit Log Modal ───────────────────────────────────────────────────────────
const ACTIVITY_TABS = [
  { key:'all',            label:'All'            },
  { key:'role_change',    label:'Role Changes'   },
  { key:'edit_approved',  label:'Info Edits'     },
  { key:'name_change',    label:'Name Changes'   },
  { key:'program_change', label:'Program Changes'},
  { key:'user_deletion',  label:'Deletions'      },
];

const ACTIVITY_BADGE = {
  role_change:    { bg:'var(--badge-red-bg)',   border:'var(--badge-red-border)',   color:'var(--badge-red-text)',   label:'Role'    },
  edit_approved:  { bg:'var(--badge-gold-bg)',  border:'var(--badge-gold-border)',  color:'var(--badge-gold-text)',  label:'Edit'    },
  name_change:    { bg:'var(--badge-gold-bg)',  border:'var(--badge-gold-border)',  color:'var(--badge-gold-text)',  label:'Name'    },
  program_change: { bg:'var(--badge-green-bg)', border:'var(--badge-green-border)', color:'var(--badge-green-text)', label:'Program' },
  user_deletion:  { bg:'var(--badge-red-bg)',   border:'var(--badge-red-border)',   color:'var(--badge-red-text)',   label:'Deleted' },
};

function AuditModal({ logs, onClose }) {
  const [actFilter, setActFilter] = useState('all');
  const [search,    setSearch]    = useState('');
  const fmt = ts => { if (!ts) return '—'; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'}); };
  const filtered = logs
    .filter(l => actFilter === 'all' || l.activityType === actFilter)
    .filter(l => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (l.targetName||'').toLowerCase().includes(q) ||
        (l.changedByName||'').toLowerCase().includes(q) ||
        (l.reason||'').toLowerCase().includes(q)
      );
    });
  return (
    <div style={{ position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.6)',padding:16 }}>
      <div style={{ background:'var(--card)',border:'1px solid var(--card-border)',borderRadius:16,width:'100%',maxWidth:820,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'var(--shadow-modal)',overflow:'hidden' }}>
        <div style={{ background:'var(--thead-bg)',borderBottom:'1px solid var(--divider)',padding:'16px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
          <div>
            <p style={{...MN,fontSize:9,letterSpacing:'0.2em',color:'var(--text-muted)',textTransform:'uppercase',marginBottom:4}}>Immutable Log</p>
            <h2 style={{...SR,fontSize:18,fontWeight:700,color:'var(--text-primary)'}}>Admin Audit Log</h2>
          </div>
          <button onClick={onClose} style={{ background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:8,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)',cursor:'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding:'12px 24px',borderBottom:'1px solid var(--divider)',flexShrink:0 }}>
          <input style={{ width:'100%',background:'var(--input-bg)',border:'1px solid var(--input-border)',borderRadius:8,padding:'9px 14px',fontSize:13,color:'var(--text-primary)',fontFamily:'inherit',outline:'none',boxSizing:'border-box' }}
            placeholder="Search by name, reason, changed by…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display:'flex',borderBottom:'1px solid var(--divider)',flexShrink:0,overflowX:'auto' }}>
          {ACTIVITY_TABS.map(t => (
            <button key={t.key} onClick={() => setActFilter(t.key)}
              style={{ padding:'10px 18px',...MN,fontSize:10,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',cursor:'pointer',background:'transparent',border:'none',borderBottom:actFilter===t.key?'2px solid var(--gold)':'2px solid transparent',color:actFilter===t.key?'var(--gold)':'var(--text-muted)',whiteSpace:'nowrap',transition:'all 0.15s' }}>
              {t.label}
              <span style={{ marginLeft:6,fontSize:9,padding:'1px 6px',borderRadius:10,background:actFilter===t.key?'var(--gold-soft)':'var(--surface)',color:actFilter===t.key?'var(--gold)':'var(--text-dim)',border:`1px solid ${actFilter===t.key?'var(--gold-border)':'var(--card-border)'}` }}>
                {t.key==='all' ? logs.length : logs.filter(l=>l.activityType===t.key).length}
              </span>
            </button>
          ))}
        </div>
        <div style={{ overflowY:'auto',flex:1 }}>
          {filtered.length === 0
            ? <p style={{ padding:24,textAlign:'center',...PP,fontSize:13,color:'var(--text-muted)' }}>No records found.</p>
            : (
              <table style={{ width:'100%',minWidth:600,borderCollapse:'collapse' }}>
                <thead style={{ position:'sticky',top:0 }}>
                  <tr>
                    {['Date','Type','Target User','Detail','Changed By','Note / Reason'].map(h => (
                      <th key={h} className="th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => {
                    const ab = ACTIVITY_BADGE[l.activityType] || ACTIVITY_BADGE.role_change;
                    return (
                      <tr key={l.id} style={{ borderBottom:'1px solid var(--row-border)' }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--row-hover-bg)'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td className="td" style={{...MN,fontSize:11,color:'var(--text-muted)',whiteSpace:'nowrap'}}>{fmt(l.timestamp)}</td>
                        <td className="td"><span style={{...MN,fontSize:9,fontWeight:700,padding:'2px 8px',borderRadius:20,background:ab.bg,border:`1px solid ${ab.border}`,color:ab.color,textTransform:'uppercase',letterSpacing:'0.08em',whiteSpace:'nowrap'}}>{ab.label}</span></td>
                        <td className="td" style={{ fontWeight:600,fontSize:13,color:'var(--text-primary)',whiteSpace:'nowrap' }}>{l.targetName||'—'}</td>
                        <td className="td" style={{ fontSize:12,color:'var(--text-body)',maxWidth:200 }}>
                          {l.activityType==='role_change'   && <span style={{display:'flex',alignItems:'center',gap:4}}><span className={`badge ${BADGE[l.fromRole]||'badge-gray'}`}>{l.fromRole}</span><span style={{color:'var(--text-dim)'}}>→</span><span className={`badge ${BADGE[l.toRole]||'badge-gray'}`}>{l.toRole}</span></span>}
                          {l.activityType==='edit_approved' && <span style={{...MN,fontSize:11,color:'var(--text-body)'}}>{Object.keys(l.changes||{}).join(', ')}</span>}
                          {l.activityType==='name_change'   && <span style={{...MN,fontSize:11}}>{l.oldName||'—'} → {l.newName||'—'}</span>}
                          {l.activityType==='program_change'&& <span style={{...MN,fontSize:11}}>{l.oldProgram||'—'} → {l.newProgram||'—'}</span>}
                          {l.activityType==='user_deletion' && <span style={{...MN,fontSize:11,color:'var(--badge-red-text)'}}>Hard deleted</span>}
                        </td>
                        <td className="td" style={{ fontSize:12,color:'var(--text-muted)',whiteSpace:'nowrap' }}>{l.changedByName||l.approvedByName||'—'}</td>
                        <td className="td" style={{ fontSize:12,color:'var(--text-body)',maxWidth:180 }}>{l.reason||'—'}</td>
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

// ── Edit Requests Modal ───────────────────────────────────────────────────────
function EditRequestsModal({ requests, myProfile, onClose, showToast }) {
  const [tab,           setTab]           = useState('pending'); // pending | resolved | rejected
  const [rejectTarget,  setRejectTarget]  = useState(null);
  const [rejectReason,  setRejectReason]  = useState('');
  const [saving,        setSaving]        = useState(null);

  const FIELD_LABELS = {
    firstName:'First Name', lastName:'Last Name', middleInitial:'Middle Initial',
    idNumber:'ID Number', visitorType:'Visitor Type', college:'College', course:'Course',
  };

  const fmt = ts => { if (!ts) return '—'; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'}); };

  const pending  = requests.filter(r => r.status === 'pending');
  const resolved = requests.filter(r => r.status === 'approved');
  const rejected = requests.filter(r => r.status === 'rejected' || r.status === 'cancelled');

  const currentList = tab === 'pending' ? pending : tab === 'resolved' ? resolved : rejected;

  const handleApprove = async (req) => {
    setSaving(req.id);
    try {
      const batch = writeBatch(db);
      // Apply all requested changes to user doc
      const updates = {};
      Object.entries(req.changes || {}).forEach(([key, { requested }]) => {
        updates[key] = requested;
      });
      batch.update(doc(db, 'users', req.uid), updates);
      batch.update(doc(db, 'editRequests', req.id), {
        status:     'approved',
        approvedBy: myProfile?.uid,
        approvedByName: `${myProfile?.lastName}, ${myProfile?.firstName}`,
        approvedAt: serverTimestamp(),
      });
      await batch.commit();
      // Audit log
      await addDoc(collection(db, 'adminAuditLogs'), {
        activityType:  'edit_approved',
        targetId:      req.uid,
        targetName:    req.userName,
        changes:       req.changes,
        changedBy:     myProfile?.uid,
        changedByName: `${myProfile?.lastName}, ${myProfile?.firstName}`,
        timestamp:     serverTimestamp(),
      });
      showToast(`Info update approved for ${req.userName}.`, true);
    } catch (e) {
      showToast('Approve failed: ' + e.message, false);
    }
    setSaving(null);
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) return;
    setSaving(rejectTarget.id);
    try {
      await updateDoc(doc(db, 'editRequests', rejectTarget.id), {
        status:          'rejected',
        rejectionReason: rejectReason.trim(),
        rejectedBy:      myProfile?.uid,
        rejectedByName:  `${myProfile?.lastName}, ${myProfile?.firstName}`,
        rejectedAt:      serverTimestamp(),
      });
      showToast(`Request from ${rejectTarget.userName} rejected.`, true);
      setRejectTarget(null);
      setRejectReason('');
    } catch (e) {
      showToast('Reject failed: ' + e.message, false);
    }
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
      showToast(`Request from ${req.userName} reopened as pending.`, true);
      setTab('pending');
    } catch (e) {
      showToast('Reopen failed: ' + e.message, false);
    }
    setSaving(null);
  };

  const inputSt = { width:'100%',background:'var(--input-bg)',border:'1px solid var(--input-border)',borderRadius:8,padding:'9px 13px',fontSize:13,color:'var(--text-primary)',fontFamily:'inherit',outline:'none',boxSizing:'border-box' };

  return (
    <div style={{ position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.6)',padding:16 }}>
      <div style={{ background:'var(--card)',border:'1px solid var(--card-border)',borderRadius:16,width:'100%',maxWidth:780,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'var(--shadow-modal)',overflow:'hidden' }}>
        {/* Header */}
        <div style={{ background:'var(--thead-bg)',borderBottom:'1px solid var(--divider)',padding:'16px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
          <div>
            <p style={{...MN,fontSize:9,letterSpacing:'0.2em',color:'var(--gold)',textTransform:'uppercase',marginBottom:4}}>Admin Review</p>
            <h2 style={{...SR,fontSize:18,fontWeight:700,color:'var(--text-primary)'}}>Edit Requests</h2>
          </div>
          <button onClick={onClose} style={{ background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:8,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)',cursor:'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex',borderBottom:'1px solid var(--divider)',flexShrink:0,background:'var(--card)' }}>
          {[
            { key:'pending',  label:'Pending',  count:pending.length,  danger:true },
            { key:'resolved', label:'Approved', count:resolved.length, danger:false },
            { key:'rejected', label:'Rejected / Cancelled', count:rejected.length, danger:false },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding:'10px 20px',...MN,fontSize:10,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',cursor:'pointer',background:'transparent',border:'none',borderBottom:tab===t.key?'2px solid var(--gold)':'2px solid transparent',color:tab===t.key?'var(--gold)':'var(--text-muted)',display:'flex',alignItems:'center',gap:8,whiteSpace:'nowrap',transition:'all 0.15s' }}>
              {t.label}
              {t.count > 0 && (
                <span style={{ fontSize:9,padding:'1px 6px',borderRadius:10,background:t.danger && tab===t.key ? 'var(--gold-soft)' : t.danger ? 'var(--red-soft)' : 'var(--surface)',color:t.danger ? (tab===t.key?'var(--gold)':'var(--red)') : 'var(--text-dim)',border:`1px solid ${t.danger ? (tab===t.key?'var(--gold-border)':'var(--red-border)') : 'var(--card-border)'}` }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ overflowY:'auto',flex:1,padding:0 }}>
          {currentList.length === 0 ? (
            <p style={{ padding:32,textAlign:'center',...PP,fontSize:13,color:'var(--text-muted)' }}>No {tab} requests.</p>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:0 }}>
              {currentList.map(req => (
                <div key={req.id} style={{ borderBottom:'1px solid var(--divider)',padding:'20px 24px' }}>
                  <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap' }}>
                    <div>
                      <p style={{ ...PP,fontSize:14,fontWeight:600,color:'var(--text-primary)',marginBottom:2 }}>{req.userName}</p>
                      <p style={{ ...MN,fontSize:10,color:'var(--text-muted)',marginBottom:10 }}>
                        {req.userIdNumber} · Requested {fmt(req.requestedAt)}
                        {req.status === 'rejected' && req.rejectedAt && ` · Rejected ${fmt(req.rejectedAt)}`}
                        {req.status === 'approved' && req.approvedAt && ` · Approved ${fmt(req.approvedAt)}`}
                      </p>
                      {/* Changes table */}
                      <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                        {Object.entries(req.changes || {}).map(([key, { current, requested }]) => (
                          <div key={key} style={{ display:'flex',alignItems:'center',gap:10,flexWrap:'wrap' }}>
                            <span style={{ ...MN,fontSize:10,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.1em',minWidth:110 }}>{FIELD_LABELS[key] || key}</span>
                            <span style={{ ...PP,fontSize:12,color:'var(--text-muted)',background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:6,padding:'2px 8px' }}>{current || '(empty)'}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                            <span style={{ ...PP,fontSize:12,fontWeight:600,color:'var(--text-primary)',background:'var(--gold-soft)',border:'1px solid var(--gold-border)',borderRadius:6,padding:'2px 8px' }}>{requested || '(empty)'}</span>
                          </div>
                        ))}
                      </div>
                      {req.status === 'rejected' && req.rejectionReason && (
                        <p style={{ ...MN,fontSize:11,color:'var(--red)',marginTop:10 }}>Reason: {req.rejectionReason}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display:'flex',gap:8,flexShrink:0,alignItems:'flex-start',flexWrap:'wrap' }}>
                      {tab === 'pending' && (
                        <>
                          <button onClick={() => handleApprove(req)} disabled={saving === req.id}
                            style={{ padding:'7px 16px',borderRadius:7,background:'var(--green-soft)',border:'1px solid var(--green-border)',color:'var(--green)',...MN,fontSize:10,fontWeight:700,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.1em',opacity:saving===req.id?0.6:1 }}>
                            {saving===req.id ? 'Saving…' : 'Approve'}
                          </button>
                          <button onClick={() => { setRejectTarget(req); setRejectReason(''); }} disabled={saving === req.id}
                            style={{ padding:'7px 16px',borderRadius:7,background:'var(--red-soft)',border:'1px solid var(--red-border)',color:'var(--red)',...MN,fontSize:10,fontWeight:700,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.1em' }}>
                            Reject
                          </button>
                        </>
                      )}
                      {tab === 'rejected' && req.status === 'rejected' && (
                        <button onClick={() => handleReopen(req)} disabled={saving === req.id}
                          style={{ padding:'7px 16px',borderRadius:7,background:'var(--gold-soft)',border:'1px solid var(--gold-border)',color:'var(--gold)',...MN,fontSize:10,fontWeight:700,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.1em' }}>
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reject reason modal */}
      {rejectTarget && (
        <div style={{ position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.5)',padding:16 }}>
          <div style={{ background:'var(--card)',border:'1px solid var(--card-border)',borderRadius:14,width:'100%',maxWidth:440,boxShadow:'var(--shadow-modal)',overflow:'hidden' }}>
            <div style={{ padding:'20px 24px 0' }}>
              <p style={{...MN,fontSize:9,letterSpacing:'0.18em',color:'var(--red)',textTransform:'uppercase',marginBottom:6}}>Reject Request</p>
              <h3 style={{...SR,fontSize:16,fontWeight:700,color:'var(--text-primary)',marginBottom:16}}>{rejectTarget.userName}</h3>
              <p style={{...PP,fontSize:13,color:'var(--text-muted)',marginBottom:12}}>Select a template or type a custom reason:</p>
              {/* Templates */}
              <div style={{ display:'flex',flexDirection:'column',gap:6,marginBottom:14 }}>
                {REJECT_TEMPLATES.map(t => (
                  <button key={t} type="button" onClick={() => setRejectReason(t)}
                    style={{ textAlign:'left',padding:'8px 12px',borderRadius:8,cursor:'pointer',fontSize:12,...PP,background:rejectReason===t?'var(--gold-soft)':'var(--surface)',border:`1px solid ${rejectReason===t?'var(--gold-border)':'var(--card-border)'}`,color:rejectReason===t?'var(--gold)':'var(--text-body)' }}>
                    {t}
                  </button>
                ))}
              </div>
              <textarea
                style={{ ...inputSt, resize:'none', height:72, fontSize:12 }}
                placeholder="Or type a custom reason…"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
              />
              <p style={{...MN,fontSize:10,color:'var(--text-dim)',marginTop:4,marginBottom:16}}>{rejectReason.trim().length} characters</p>
            </div>
            <div style={{ padding:'12px 24px 20px',display:'flex',gap:10 }}>
              <button onClick={() => { setRejectTarget(null); setRejectReason(''); }}
                style={{ flex:1,padding:'10px',borderRadius:9,background:'var(--surface)',border:'1px solid var(--card-border)',color:'var(--text-muted)',cursor:'pointer',...PP,fontSize:13 }}>
                Cancel
              </button>
              <button onClick={handleReject} disabled={!rejectReason.trim() || saving === rejectTarget?.id}
                style={{ flex:1,padding:'10px',borderRadius:9,background:'var(--red-soft)',border:'1px solid var(--red-border)',color:'var(--red)',cursor:!rejectReason.trim()?'not-allowed':'pointer',opacity:!rejectReason.trim()?0.5:1,...MN,fontSize:10,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase' }}>
                {saving===rejectTarget?.id ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Staff Invite Modal ────────────────────────────────────────────────────────
function StaffInviteModal({ invites, myProfile, onClose, showToast }) {
  const [email,   setEmail]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [deleting,setDeleting]= useState(null);

  const handleInvite = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    setSaving(true);
    try {
      // Check for duplicate
      const existing = invites.find(i => i.email === clean && i.status === 'pending');
      if (existing) { showToast('This email already has a pending invite.', false); setSaving(false); return; }
      await addDoc(collection(db, 'staffInvites'), {
        email:          clean,
        invitedBy:      myProfile?.uid,
        invitedByName:  `${myProfile?.lastName}, ${myProfile?.firstName}`,
        invitedAt:      serverTimestamp(),
        status:         'pending',
      });
      showToast(`Staff invite sent to ${clean}.`, true);
      setEmail('');
    } catch (e) {
      showToast('Failed to send invite: ' + e.message, false);
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await deleteDoc(doc(db, 'staffInvites', id));
      showToast('Invite cancelled.', true);
    } catch (e) {
      showToast('Failed to cancel invite.', false);
    }
    setDeleting(null);
  };

  const fmt = ts => { if (!ts) return '—'; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleDateString('en-PH',{dateStyle:'medium'}); };

  const inputSt = { flex:1,background:'var(--input-bg)',border:'1px solid var(--input-border)',borderRadius:9,padding:'10px 13px',fontSize:13,color:'var(--text-primary)',fontFamily:'inherit',outline:'none' };

  return (
    <div style={{ position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.6)',padding:16 }}>
      <div style={{ background:'var(--card)',border:'1px solid var(--card-border)',borderRadius:16,width:'100%',maxWidth:560,maxHeight:'85vh',display:'flex',flexDirection:'column',boxShadow:'var(--shadow-modal)',overflow:'hidden' }}>
        <div style={{ background:'var(--thead-bg)',borderBottom:'1px solid var(--divider)',padding:'16px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
          <div>
            <p style={{...MN,fontSize:9,letterSpacing:'0.2em',color:'var(--gold)',textTransform:'uppercase',marginBottom:4}}>Pre-Registration</p>
            <h2 style={{...SR,fontSize:18,fontWeight:700,color:'var(--text-primary)'}}>Invite Staff</h2>
          </div>
          <button onClick={onClose} style={{ background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:8,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)',cursor:'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ padding:'20px 24px',flexShrink:0 }}>
          <p style={{...PP,fontSize:13,color:'var(--text-muted)',marginBottom:16,lineHeight:1.6}}>
            Enter a staff member's email. When they sign in with that Google account, they'll automatically be registered as Library Staff.
          </p>
          <div style={{ display:'flex',gap:8 }}>
            <input style={inputSt} type="email" placeholder="staff@example.com or @neu.edu.ph"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleInvite(); }} />
            <button onClick={handleInvite} disabled={saving || !email.trim()}
              style={{ padding:'10px 18px',borderRadius:9,background:'var(--gold-soft)',border:'1px solid var(--gold-border)',color:'var(--gold)',...MN,fontSize:10,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',cursor:saving||!email.trim()?'not-allowed':'pointer',opacity:saving||!email.trim()?0.5:1,whiteSpace:'nowrap' }}>
              {saving ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </div>

        <div style={{ overflowY:'auto',flex:1,borderTop:'1px solid var(--divider)' }}>
          {invites.length === 0 ? (
            <p style={{ padding:24,textAlign:'center',...PP,fontSize:13,color:'var(--text-muted)' }}>No invites yet.</p>
          ) : (
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <thead style={{ position:'sticky',top:0 }}>
                <tr>
                  {['Email','Sent By','Date','Status',''].map(h => <th key={h} className="th">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {invites.map(inv => (
                  <tr key={inv.id} style={{ borderBottom:'1px solid var(--row-border)' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--row-hover-bg)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td className="td" style={{...MN,fontSize:12,color:'var(--text-primary)'}}>{inv.email}</td>
                    <td className="td" style={{ fontSize:12,color:'var(--text-muted)' }}>{inv.invitedByName||'—'}</td>
                    <td className="td" style={{...MN,fontSize:11,color:'var(--text-dim)',whiteSpace:'nowrap'}}>{fmt(inv.invitedAt)}</td>
                    <td className="td">
                      {inv.status==='pending'  && <span className="badge badge-gold">Pending</span>}
                      {inv.status==='claimed'  && <span className="badge badge-green">Claimed</span>}
                    </td>
                    <td className="td">
                      {inv.status==='pending' && (
                        <button onClick={() => handleDelete(inv.id)} disabled={deleting===inv.id}
                          style={{ padding:'4px 10px',borderRadius:6,background:'var(--red-soft)',border:'1px solid var(--red-border)',color:'var(--red)',...MN,fontSize:9,fontWeight:700,cursor:'pointer',textTransform:'uppercase' }}>
                          {deleting===inv.id ? '…' : 'Cancel'}
                        </button>
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
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const inputSt = { width:'100%',background:'var(--input-bg)',border:'1px solid var(--input-border)',borderRadius:9,padding:'9px 13px',fontSize:13,color:'var(--text-primary)',fontFamily:'inherit',outline:'none',boxSizing:'border-box' };

export default function UserManagementPage() {
  const { userProfile: myProfile } = useAuth();
  const location  = useLocation();
  const initRole  = location.state?.filterRole || 'all';

  const [users,           setUsers]           = useState([]);
  const [auditLogs,       setAuditLogs]       = useState([]);
  const [editRequests,    setEditRequests]     = useState([]);
  const [staffInvites,    setStaffInvites]     = useState([]);
  const [deleteRequests,  setDeleteRequests]   = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(null);
  const [toast,           setToast]           = useState(null);

  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState(initRole);
  const [sortBy,     setSortBy]     = useState('name');

  const [pending,    setPending]    = useState(null);
  const [reason,     setReason]     = useState('');

  const [auditOpen,         setAuditOpen]         = useState(false);
  const [editRequestsOpen,  setEditRequestsOpen]  = useState(false);
  const [staffInviteOpen,   setStaffInviteOpen]   = useState(false);
  const [showDeleteRequests,setShowDeleteRequests] = useState(false);

  const [editProfileTarget, setEditProfileTarget] = useState(null);
  const [editNameTarget,    setEditNameTarget]    = useState(null);
  const [deleteTarget,      setDeleteTarget]      = useState(null);
  const [deleteReason,      setDeleteReason]      = useState('');
  const [deleteSaving,      setDeleteSaving]      = useState(false);

  // Live listeners
  useEffect(() => {
    setLoading(true);
    const u1 = onSnapshot(collection(db,'users'), snap => {
      const docs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      docs.sort((a,b) => (a.lastName??'').localeCompare(b.lastName??''));
      setUsers(docs);
      setLoading(false);
    }, () => setLoading(false));
    const u2 = onSnapshot(collection(db,'adminAuditLogs'), snap => {
      const docs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      docs.sort((a,b) => (b.timestamp?.toMillis?.()??0) - (a.timestamp?.toMillis?.()??0));
      setAuditLogs(docs);
    }, ()=>{});
    const u3 = onSnapshot(collection(db,'editRequests'), snap => {
      const docs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      docs.sort((a,b) => (b.requestedAt?.toMillis?.()??0) - (a.requestedAt?.toMillis?.()??0));
      setEditRequests(docs);
    }, ()=>{});
    const u4 = onSnapshot(collection(db,'staffInvites'), snap => {
      const docs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      docs.sort((a,b) => (b.invitedAt?.toMillis?.()??0) - (a.invitedAt?.toMillis?.()??0));
      setStaffInvites(docs);
    }, ()=>{});
    const u5 = onSnapshot(collection(db,'deleteRequests'), snap => {
      const docs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      docs.sort((a,b) => (b.requestedAt?.toMillis?.()??0) - (a.requestedAt?.toMillis?.()??0));
      setDeleteRequests(docs);
    }, ()=>{});
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, []);

  // Derived sets for notification dots on rows
  const pendingEditUids = useMemo(() =>
    new Set(editRequests.filter(r => r.status === 'pending').map(r => r.uid)),
  [editRequests]);
  const pendingEditCount = editRequests.filter(r => r.status === 'pending').length;

  // Filter IT support from visible user list
  const visibleUsers = users.filter(u => !IT_SUPPORT_EMAILS.includes((u.email||'').toLowerCase()));

  const filtered = visibleUsers
    .filter(u => {
      const matchSearch = !search ||
        `${u.firstName} ${u.lastName} ${u.idNumber} ${u.email} ${u.course||''} ${u.college||''}`
          .toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      return matchSearch && matchRole;
    })
    .sort((a,b) => {
      if (sortBy==='role') { const ord={admin:0,staff:1,visitor:2}; return (ord[a.role]??3)-(ord[b.role]??3); }
      if (sortBy==='college') return (a.college||'').localeCompare(b.college||'');
      return (a.lastName||'').localeCompare(b.lastName||'');
    });

  const counts = {
    all:     visibleUsers.length,
    visitor: visibleUsers.filter(u => u.role === 'visitor').length,
    staff:   visibleUsers.filter(u => u.role === 'staff').length,
    admin:   visibleUsers.filter(u => u.role === 'admin').length,
  };

  const ROLE_TABS = [
    { key:'all',     label:'All'      },
    { key:'visitor', label:'Visitors' },
    { key:'staff',   label:'Staff'    },
    { key:'admin',   label:'Admins'   },
  ];

  const canPromoteToStaff  = u => u.role === 'visitor' && u.id !== myProfile?.uid;
  const canDemoteToVisitor = u => u.role === 'staff'   && u.id !== myProfile?.uid;

  const initChange = (user, toRole) => { setPending({ user, toRole }); setReason(''); };

  const handleConfirm = async () => {
    if (!pending) return;
    if (reason.trim().length < 10) { showToast('Reason must be at least 10 characters.', false); return; }
    setSaving(pending.user.id);
    try {
      await updateDoc(doc(db,'users',pending.user.id), { role: pending.toRole });
      await addDoc(collection(db,'adminAuditLogs'), {
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
      showToast(`${pending.user.firstName}'s role updated to ${pending.toRole}.`, true);
    } catch (e) {
      showToast('Error: ' + e.message, false);
    }
    setSaving(null);
    setPending(null);
  };

  const handleRequestDelete = async () => {
    if (!deleteTarget) return;
    if (deleteReason.trim().length < 10) { showToast('Reason must be at least 10 characters.', false); return; }
    setDeleteSaving(true);
    try {
      await addDoc(collection(db,'deleteRequests'), {
        targetId:        deleteTarget.id,
        targetName:      `${deleteTarget.lastName}, ${deleteTarget.firstName}`,
        targetIdNumber:  deleteTarget.idNumber || '',
        targetRole:      deleteTarget.role || 'visitor',
        reason:          deleteReason.trim(),
        requestedBy:     myProfile?.uid,
        requestedByName: `${myProfile?.lastName}, ${myProfile?.firstName}`,
        requestedAt:     serverTimestamp(),
        status:          'pending',
      });
      showToast(`Deletion request submitted for ${deleteTarget.firstName}.`, true);
      setDeleteTarget(null);
      setDeleteReason('');
    } catch (e) {
      showToast('Failed: ' + e.message, false);
    }
    setDeleteSaving(false);
  };

  const handleApproveDelete = async (req) => {
    if (!window.confirm(`Permanently delete user "${req.targetName}"? This cannot be undone.`)) return;
    try {
      const batch = writeBatch(db);
      const borrowsSnap = await getDocs(query(collection(db,'borrows'),where('userId','==',req.targetId)));
      borrowsSnap.forEach(d => batch.update(doc(db,'borrows',d.id),{ studentName:req.targetName, studentId:req.targetIdNumber, userDeleted:true }));
      const loggerSnap  = await getDocs(query(collection(db,'logger'),where('uid','==',req.targetId)));
      loggerSnap.forEach(d => batch.update(doc(db,'logger',d.id), { studentName:req.targetName, studentId:req.targetIdNumber, userDeleted:true }));
      batch.delete(doc(db,'users',req.targetId));
      batch.update(doc(db,'deleteRequests',req.id),{ status:'approved', approvedBy:myProfile?.uid, approvedByName:`${myProfile?.lastName}, ${myProfile?.firstName}`, approvedAt:serverTimestamp() });
      await batch.commit();
      await addDoc(collection(db,'adminAuditLogs'),{
        activityType:'user_deletion', targetId:req.targetId, targetName:req.targetName,
        deletedIdNumber:req.targetIdNumber, reason:req.reason,
        requestedBy:req.requestedBy, requestedByName:req.requestedByName,
        approvedBy:myProfile?.uid, approvedByName:`${myProfile?.lastName}, ${myProfile?.firstName}`,
        borrowsSnapshotted:borrowsSnap.size, logsSnapshotted:loggerSnap.size,
        timestamp:serverTimestamp(),
      });
      showToast(`${req.targetName} permanently deleted.`, true);
    } catch (e) { showToast('Delete failed: ' + e.message, false); }
  };

  const handleRejectDelete = async (req) => {
    try {
      await updateDoc(doc(db,'deleteRequests',req.id),{ status:'rejected', rejectedBy:myProfile?.uid, rejectedAt:serverTimestamp() });
      showToast(`Deletion request for ${req.targetName} rejected.`, true);
    } catch (e) { showToast('Failed to reject.', false); }
  };

  const showToast = (msg, ok) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4500); };

  return (
    <div className="space-y-6">
      <style>{`tr.log-row:hover td { background: var(--row-hover-bg) !important; }`}</style>

      {/* Page header */}
      <div style={{ borderBottom:'1px solid var(--divider)',paddingBottom:24,display:'flex',flexDirection:'column',gap:12 }}>
        <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap' }}>
          <div>
            <p style={{...MN,fontSize:10,letterSpacing:'0.2em',textTransform:'uppercase',color:'var(--text-muted)',marginBottom:4}}>Administration</p>
            <h1 className="page-title">User Management</h1>
            <p style={{...PP,fontSize:13,color:'var(--text-muted)',marginTop:4}}>Manage roles, staff invites, and info edit requests.</p>
          </div>
          <div style={{ display:'flex',gap:8,flexWrap:'wrap',alignItems:'center' }}>
            {/* Pending delete requests */}
            {deleteRequests.filter(r=>r.status==='pending').length > 0 && (
              <button className="btn-secondary text-xs py-2 px-4"
                style={{ borderColor:'var(--red-border)',color:'var(--red)' }}
                onClick={() => setShowDeleteRequests(true)}>
                ⚠ Delete Requests ({deleteRequests.filter(r=>r.status==='pending').length})
              </button>
            )}
            {/* Edit requests — with notification dot */}
            <div style={{ position:'relative',display:'inline-flex' }}>
              <button className="btn-secondary text-xs py-2 px-4" onClick={() => setEditRequestsOpen(true)}>
                Edit Requests ({editRequests.length})
              </button>
              {pendingEditCount > 0 && (
                <span style={{ position:'absolute',top:-4,right:-4,width:16,height:16,borderRadius:'50%',background:'var(--red)',border:'2px solid var(--card)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:9,fontWeight:700 }}>
                  {pendingEditCount}
                </span>
              )}
            </div>
            {/* Staff invite */}
            <button className="btn-secondary text-xs py-2 px-4" onClick={() => setStaffInviteOpen(true)}>
              Invite Staff
            </button>
            <button className="btn-secondary text-xs py-2 px-4" onClick={() => exportUsersCSV(filtered)}>
              Export CSV ({filtered.length})
            </button>
            <button className="btn-secondary text-xs py-2 px-4" onClick={() => setAuditOpen(true)}>
              Audit Log ({auditLogs.length})
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <input className="input flex-1" placeholder="Search by name, ID, email, course, college…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="select w-44 text-sm shrink-0" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="name">Sort: Name (A–Z)</option>
            <option value="role">Sort: Role</option>
            <option value="college">Sort: College</option>
          </select>
        </div>
        <div className="flex" style={{ borderBottom:'1px solid var(--divider)' }}>
          {ROLE_TABS.map(t => (
            <button key={t.key} onClick={() => setRoleFilter(t.key)}
              className="px-5 py-2.5 text-xs font-mono font-semibold tracking-widest uppercase flex items-center gap-2 transition-colors"
              style={{ color:roleFilter===t.key?'var(--gold)':'var(--text-muted)',background:'transparent',border:'none',borderBottom:roleFilter===t.key?'2px solid var(--gold)':'2px solid transparent',cursor:'pointer' }}>
              {t.label}
              <span className="text-[10px] px-1.5 py-0.5 font-bold rounded"
                style={{ background:t.key==='admin'?'var(--badge-red-bg)':t.key==='staff'?'var(--badge-gold-bg)':t.key==='visitor'?'var(--badge-green-bg)':'var(--badge-gray-bg)', color:t.key==='admin'?'var(--badge-red-text)':t.key==='staff'?'var(--badge-gold-text)':t.key==='visitor'?'var(--badge-green-text)':'var(--badge-gray-text)' }}>
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {(search || roleFilter !== 'all') && (
        <div className="flex items-center justify-between">
          <p style={{...MN,fontSize:12,color:'var(--text-muted)'}}>Showing <strong style={{color:'var(--text-primary)'}}>{filtered.length}</strong> of {visibleUsers.length} users</p>
          <button style={{...MN,fontSize:12,color:'var(--gold)',background:'none',border:'none',cursor:'pointer'}} onClick={() => { setSearch(''); setRoleFilter('all'); }}>Clear filters</button>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p style={{...PP,fontSize:13,color:'var(--text-muted)',padding:24}}>Loading users…</p>
        ) : filtered.length === 0 ? (
          <p style={{...PP,fontSize:13,color:'var(--text-muted)',padding:32,textAlign:'center'}}>No users match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr>
                  <th className="th">Name</th>
                  <th className="th">ID Number</th>
                  <th className="th">Email</th>
                  <th className="th">College / Course</th>
                  <th className="th">Role</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const hasPendingEdit = pendingEditUids.has(u.id);
                  return (
                    <tr key={u.id} className="log-row">
                      <td className="td">
                        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                          <div>
                            <p style={{ fontWeight:600,fontSize:13,color:'var(--text-primary)' }}>
                              {u.lastName ? `${u.lastName}, ${u.firstName}${u.middleInitial ? ' '+u.middleInitial+'.' : ''}` : u.email}
                            </p>
                            {u.id === myProfile?.uid && <span style={{...MN,fontSize:10,color:'var(--gold)'}}>(you)</span>}
                          </div>
                          {hasPendingEdit && (
                            <span title="Pending edit request" style={{ width:8,height:8,borderRadius:'50%',background:'var(--gold)',flexShrink:0,display:'inline-block' }} />
                          )}
                        </div>
                      </td>
                      <td className="td" style={{...MN,fontSize:12}}>{u.idNumber||'—'}</td>
                      <td className="td" style={{...MN,fontSize:11,color:'var(--text-muted)'}}>{u.email}</td>
                      <td className="td" style={{ fontSize:12 }}>
                        <p style={{ fontWeight:500 }}>{u.college||u.department||'—'}</p>
                        {u.course && <p style={{ color:'var(--text-muted)' }}>{u.course}</p>}
                      </td>
                      <td className="td">
                        <span className={`badge ${BADGE[u.role]||'badge-gray'}`}>{u.role||'visitor'}</span>
                      </td>
                      <td className="td">
                        {u.role === 'admin' ? (
                          <span style={{...MN,fontSize:11,fontStyle:'italic',color:'var(--text-muted)'}}>Protected</span>
                        ) : u.id === myProfile?.uid ? (
                          <span style={{...MN,fontSize:11,fontStyle:'italic',color:'var(--text-muted)'}}>Your account</span>
                        ) : (
                          <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
                            {canPromoteToStaff(u) && (
                              <button onClick={() => initChange(u,'staff')} disabled={saving===u.id}
                                style={{ fontSize:10,...MN,fontWeight:700,padding:'3px 10px',border:'1px solid var(--badge-gold-border)',color:'var(--badge-gold-text)',background:'transparent',borderRadius:4,cursor:'pointer' }}>
                                ↑ Staff
                              </button>
                            )}
                            {canDemoteToVisitor(u) && (
                              <button onClick={() => initChange(u,'visitor')} disabled={saving===u.id}
                                style={{ fontSize:10,...MN,fontWeight:700,padding:'3px 10px',border:'1px solid var(--card-border)',color:'var(--text-muted)',background:'transparent',borderRadius:4,cursor:'pointer' }}>
                                ↓ Visitor
                              </button>
                            )}
                            <button onClick={() => setEditProfileTarget({ uid:u.id, profile:u })}
                              style={{ fontSize:10,...MN,fontWeight:700,padding:'3px 10px',border:'1px solid var(--gold-border)',color:'var(--gold)',background:'transparent',borderRadius:4,cursor:'pointer' }}>
                              Edit Profile
                            </button>
                            <button onClick={() => setEditNameTarget({ uid:u.id, profile:u })}
                              style={{ fontSize:10,...MN,fontWeight:700,padding:'3px 10px',border:'1px solid var(--badge-green-border)',color:'var(--badge-green-text)',background:'transparent',borderRadius:4,cursor:'pointer' }}>
                              Edit Name
                            </button>
                            <button onClick={() => { setDeleteTarget(u); setDeleteReason(''); }}
                              style={{ fontSize:10,...MN,fontWeight:700,padding:'3px 10px',border:'1px solid var(--red-border)',color:'var(--red)',background:'transparent',borderRadius:4,cursor:'pointer' }}>
                              Delete
                            </button>
                            {saving===u.id && <span style={{...MN,fontSize:10,color:'var(--text-muted)'}}>Saving…</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role change modal */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div style={{ background:'var(--card)',border:'1px solid var(--card-border)',borderRadius:12,width:'100%',maxWidth:440,boxShadow:'var(--shadow-modal)' }}>
            <div style={{ background:'var(--thead-bg)',borderBottom:'1px solid var(--divider)',padding:'16px 24px' }}>
              <p style={{...MN,fontSize:9,letterSpacing:'0.2em',color:'var(--gold)',textTransform:'uppercase',marginBottom:4}}>Confirm Role Change</p>
              <h2 style={{...SR,fontSize:18,fontWeight:700,color:'var(--text-primary)'}}>
                {pending.user.lastName}, {pending.user.firstName}
              </h2>
              <p style={{...MN,fontSize:11,color:'var(--text-muted)',marginTop:4}}>
                <span className={`badge ${BADGE[pending.user.role]||'badge-gray'}`}>{pending.user.role}</span>
                {' → '}
                <span className={`badge ${BADGE[pending.toRole]||'badge-gray'}`}>{pending.toRole}</span>
              </p>
            </div>
            <div style={{ padding:'20px 24px' }}>
              <label style={{...MN,fontSize:10,letterSpacing:'0.14em',color:'var(--text-muted)',textTransform:'uppercase',display:'block',marginBottom:8,fontWeight:600}}>Reason <span style={{color:'var(--red)'}}>*</span></label>
              <textarea className="input resize-none h-20 text-sm" style={{ fontSize:13 }}
                placeholder="Minimum 10 characters…"
                value={reason} onChange={e => setReason(e.target.value)} autoFocus />
              <p style={{...MN,fontSize:10,color:'var(--text-dim)',marginTop:4}}>{reason.trim().length} / 10 characters minimum</p>
            </div>
            <div style={{ padding:'16px 24px',borderTop:'1px solid var(--divider)',display:'flex',justifyContent:'flex-end',gap:12 }}>
              <button className="btn-secondary" onClick={() => setPending(null)}>Cancel</button>
              <button onClick={handleConfirm} disabled={reason.trim().length < 10 || saving}
                style={{ padding:'9px 20px',borderRadius:8,background:'var(--gold-soft)',border:'1px solid var(--gold-border)',color:'var(--gold)',...MN,fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',cursor:reason.trim().length < 10 ? 'not-allowed' : 'pointer',opacity:reason.trim().length < 10 ? 0.5 : 1 }}>
                {saving ? 'Saving…' : 'Confirm Change'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editProfileTarget && (
        <EditProfileModal uid={editProfileTarget.uid} profile={editProfileTarget.profile}
          onClose={() => setEditProfileTarget(null)} onSaved={() => setEditProfileTarget(null)} />
      )}

      {/* Edit Name Modal */}
      {editNameTarget && (
        <EditNameModal targetUid={editNameTarget.uid} targetProfile={editNameTarget.profile}
          onClose={() => setEditNameTarget(null)} />
      )}

      {/* Delete Request modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div style={{ background:'var(--card)',border:'1px solid var(--card-border)',borderRadius:12,width:'100%',maxWidth:480,boxShadow:'var(--shadow-modal)' }}>
            <div style={{ background:'var(--thead-bg)',borderBottom:'1px solid var(--divider)',padding:'16px 24px' }}>
              <p style={{...MN,fontSize:9,letterSpacing:'0.2em',color:'var(--red)',textTransform:'uppercase',marginBottom:4}}>⚠ Delete User</p>
              <h2 style={{...SR,fontSize:18,fontWeight:700,color:'var(--text-primary)'}}>{deleteTarget.lastName}, {deleteTarget.firstName}</h2>
              <p style={{...MN,fontSize:11,color:'var(--text-muted)',marginTop:4}}>{deleteTarget.idNumber}</p>
            </div>
            <div style={{ padding:'20px 24px' }}>
              <div style={{ background:'var(--red-soft)',border:'1px solid var(--red-border)',borderRadius:8,padding:'12px 16px',marginBottom:16 }}>
                <p style={{ fontSize:12,color:'var(--red)',lineHeight:1.6 }}>This will queue a deletion request. A hard delete permanently removes the user and snapshots their records.</p>
              </div>
              <label style={{...MN,fontSize:10,letterSpacing:'0.14em',color:'var(--text-muted)',textTransform:'uppercase',display:'block',marginBottom:8,fontWeight:600}}>Reason <span style={{color:'var(--red)'}}>*</span></label>
              <textarea className="input resize-none h-20 text-sm"
                placeholder="e.g. Unenrolled, graduated, duplicate account… (min 10 chars)"
                value={deleteReason} onChange={e => setDeleteReason(e.target.value)} autoFocus />
              <p style={{...MN,fontSize:10,color:'var(--text-dim)',marginTop:4}}>{deleteReason.trim().length} / 10 minimum</p>
            </div>
            <div style={{ padding:'16px 24px',borderTop:'1px solid var(--divider)',display:'flex',justifyContent:'flex-end',gap:12 }}>
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleteSaving}>Cancel</button>
              <button disabled={deleteReason.trim().length < 10 || deleteSaving} onClick={handleRequestDelete}
                style={{ padding:'9px 20px',borderRadius:8,background:'var(--red-soft)',border:'1px solid var(--red-border)',color:'var(--red)',...MN,fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',cursor:deleteReason.trim().length < 10 || deleteSaving?'not-allowed':'pointer',opacity:deleteReason.trim().length < 10 || deleteSaving?0.5:1 }}>
                {deleteSaving ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Requests Review */}
      {showDeleteRequests && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div style={{ background:'var(--card)',border:'1px solid var(--card-border)',borderRadius:16,width:'100%',maxWidth:700,maxHeight:'80vh',display:'flex',flexDirection:'column',boxShadow:'var(--shadow-modal)',overflow:'hidden' }}>
            <div style={{ background:'var(--thead-bg)',borderBottom:'1px solid var(--divider)',padding:'16px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
              <h2 style={{...SR,fontSize:18,fontWeight:700,color:'var(--text-primary)'}}>Deletion Requests</h2>
              <button onClick={() => setShowDeleteRequests(false)} style={{ background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:8,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)',cursor:'pointer' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ overflowY:'auto',flex:1 }}>
              {deleteRequests.length === 0
                ? <p style={{ padding:24,textAlign:'center',...PP,fontSize:13,color:'var(--text-muted)' }}>No deletion requests.</p>
                : (
                  <table style={{ width:'100%',minWidth:560,borderCollapse:'collapse' }}>
                    <thead style={{ position:'sticky',top:0 }}>
                      <tr>{['User','Reason','Requested By','Status','Actions'].map(h=><th key={h} className="th">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {deleteRequests.map(req => (
                        <tr key={req.id} style={{ borderBottom:'1px solid var(--row-border)' }}
                          onMouseEnter={e=>e.currentTarget.style.background='var(--row-hover-bg)'}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <td className="td"><p style={{ fontWeight:600,fontSize:13,color:'var(--text-primary)' }}>{req.targetName}</p><p style={{...MN,fontSize:10,color:'var(--text-muted)'}}>{req.targetIdNumber}</p></td>
                          <td className="td" style={{ fontSize:12,maxWidth:180 }}>{req.reason}</td>
                          <td className="td" style={{ fontSize:12,color:'var(--text-muted)' }}>{req.requestedByName||'—'}</td>
                          <td className="td">
                            {req.status==='pending'  && <span className="badge badge-gold">Pending</span>}
                            {req.status==='approved' && <span className="badge badge-red">Deleted</span>}
                            {req.status==='rejected' && <span className="badge badge-gray">Rejected</span>}
                          </td>
                          <td className="td">
                            {req.status==='pending' && (
                              <div style={{ display:'flex',gap:6 }}>
                                <button style={{ padding:'4px 10px',borderRadius:6,background:'var(--red-soft)',border:'1px solid var(--red-border)',color:'var(--red)',...MN,fontSize:9,fontWeight:700,cursor:'pointer',textTransform:'uppercase' }} onClick={()=>handleApproveDelete(req)}>Approve</button>
                                <button style={{ padding:'4px 10px',borderRadius:6,background:'var(--surface)',border:'1px solid var(--card-border)',color:'var(--text-muted)',...MN,fontSize:9,fontWeight:700,cursor:'pointer',textTransform:'uppercase' }} onClick={()=>handleRejectDelete(req)}>Reject</button>
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

      {/* Modals */}
      {auditOpen && <AuditModal logs={auditLogs} onClose={() => setAuditOpen(false)} />}
      {editRequestsOpen && <EditRequestsModal requests={editRequests} myProfile={myProfile} onClose={() => setEditRequestsOpen(false)} showToast={showToast} />}
      {staffInviteOpen  && <StaffInviteModal  invites={staffInvites} myProfile={myProfile} onClose={() => setStaffInviteOpen(false)}  showToast={showToast} />}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 shadow-lg text-sm font-mono tracking-wide"
          style={{ background:toast.ok?'var(--green-soft)':'var(--red-soft)', border:`1px solid ${toast.ok?'var(--green-border)':'var(--red-border)'}`, borderRadius:10, color:toast.ok?'var(--green)':'var(--red)' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
