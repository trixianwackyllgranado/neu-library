// src/pages/admin/UserManagementPage.jsx
import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  collection, updateDoc, addDoc, doc, onSnapshot,
  serverTimestamp, deleteDoc, setDoc, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { IT_SUPPORT_EMAILS } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { COLLEGES } from '../../data/colleges';
import EditProfileModal from '../../components/shared/EditProfileModal';
import EditNameModal    from '../../components/shared/EditNameModal';

const PP = { fontFamily: "'Poppins', sans-serif" };
const SR = { fontFamily: "'Playfair Display', serif" };
const MN = { fontFamily: "'IBM Plex Mono', monospace" };

const NEU_DOMAIN = '@neu.edu.ph';

const ROLE_COLOR = {
  admin:   { bg:'var(--badge-red-bg)',   border:'var(--badge-red-border)',   color:'var(--badge-red-text)'   },
  staff:   { bg:'var(--badge-gold-bg)',  border:'var(--badge-gold-border)',  color:'var(--badge-gold-text)'  },
  visitor: { bg:'var(--badge-green-bg)', border:'var(--badge-green-border)', color:'var(--badge-green-text)' },
};

function RoleBadge({ role }) {
  const c = ROLE_COLOR[role] || { bg:'var(--surface)', border:'var(--card-border)', color:'var(--text-dim)' };
  return (
    <span style={{ ...MN, fontSize:9, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase',
      padding:'3px 10px', borderRadius:20, background:c.bg, border:`1px solid ${c.border}`, color:c.color }}>
      {role || 'visitor'}
    </span>
  );
}

function exportUsersCSV(users) {
  const headers = ['Role','Last Name','First Name','Middle Initial','ID Number','Email','College','Course','Account Created'];
  const rows = users.map(u=>[
    u.role??'', u.lastName??'', u.firstName??'', u.middleInitial??'',
    u.idNumber??'', u.email??'', u.college??u.department??'', u.course??'',
    u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString('en-PH') : '',
  ]);
  const csv  = [headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'),{href:url,download:'users.csv'}).click();
  URL.revokeObjectURL(url);
}

// ── Audit Log ─────────────────────────────────────────────────────────────────
const AUDIT_FILTER_TABS = [
  {key:'all',label:'All'},
  {key:'role_change',label:'Role Changes'},
  {key:'edit_approved',label:'Info Edits'},
  {key:'name_change',label:'Name Changes'},
  {key:'program_change',label:'Program Changes'},
];
const ACTIVITY_META = {
  role_change:    {color:'var(--red)',   label:'Role'   },
  edit_approved:  {color:'var(--gold)',  label:'Edit'   },
  name_change:    {color:'var(--gold)',  label:'Name'   },
  program_change: {color:'var(--green)', label:'Program'},
};

function AuditTypeBadge({ type }) {
  const m = ACTIVITY_META[type] || {color:'var(--text-dim)',label:type||'?'};
  return (
    <span style={{...MN,fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',
      padding:'3px 10px',borderRadius:20,background:m.color+'20',border:`1px solid ${m.color}40`,color:m.color}}>
      {m.label}
    </span>
  );
}

function AuditRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  const fmt = ts => { if(!ts)return'—'; const d=ts.toDate?ts.toDate():new Date(ts); return d.toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'}); };
  const detail = () => {
    if(log.activityType==='role_change')    return `${log.fromRole||'?'} → ${log.toRole||'?'}`;
    if(log.activityType==='edit_approved')  return Object.keys(log.changes||{}).join(', ')||'—';
    if(log.activityType==='name_change')    return `${log.oldName||'?'} → ${log.newName||'?'}`;
    if(log.activityType==='program_change') return `${log.oldProgram||'?'} → ${log.newProgram||'?'}`;
    return '—';
  };
  return (
    <>
      <tr onClick={()=>setExpanded(e=>!e)}
        style={{borderBottom:expanded?'none':'1px solid var(--row-border)',cursor:'pointer'}}
        onMouseEnter={e=>{if(!expanded)e.currentTarget.style.background='var(--row-hover-bg)';}}
        onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}>
        <td style={{padding:'11px 8px 11px 16px',width:28}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{transform:expanded?'rotate(90deg)':'none',transition:'transform 0.15s'}}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </td>
        <td style={{padding:'11px 12px',...MN,fontSize:11,color:'var(--text-muted)',whiteSpace:'nowrap'}}>{fmt(log.timestamp)}</td>
        <td style={{padding:'11px 12px'}}><AuditTypeBadge type={log.activityType}/></td>
        <td style={{padding:'11px 12px'}}><p style={{...PP,fontSize:13,fontWeight:600,color:'var(--text-primary)'}}>{log.targetName||'—'}</p></td>
        <td style={{padding:'11px 12px',...PP,fontSize:12,color:'var(--text-body)',maxWidth:200}}>{detail()}</td>
        <td style={{padding:'11px 12px',...PP,fontSize:12,color:'var(--text-muted)',whiteSpace:'nowrap'}}>{log.changedByName||log.approvedByName||'—'}</td>
      </tr>
      {expanded && (
        <tr style={{borderBottom:'1px solid var(--row-border)'}}>
          <td colSpan={6} style={{padding:'0 16px 16px 52px',background:'var(--surface)'}}>
            <div style={{paddingTop:12,display:'flex',flexDirection:'column',gap:10}}>
              {log.reason && (
                <div>
                  <p style={{...MN,fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--text-dim)',marginBottom:4}}>Reason</p>
                  <p style={{...PP,fontSize:13,color:'var(--text-body)',background:'var(--card)',border:'1px solid var(--card-border)',borderRadius:8,padding:'8px 12px',display:'inline-block'}}>{log.reason}</p>
                </div>
              )}
              {log.activityType==='edit_approved' && log.changes && (
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {Object.entries(log.changes).map(([key,{current,requested}])=>(
                    <div key={key} style={{background:'var(--card)',border:'1px solid var(--card-border)',borderRadius:8,padding:'8px 12px',fontSize:12}}>
                      <p style={{...MN,fontSize:9,color:'var(--text-dim)',textTransform:'uppercase',marginBottom:4}}>{key}</p>
                      <span style={{color:'var(--text-muted)',textDecoration:'line-through',...PP}}>{current||'—'}</span>
                      <span style={{margin:'0 6px',color:'var(--text-dim)'}}>→</span>
                      <span style={{color:'var(--gold)',fontWeight:600,...PP}}>{requested||'—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function AuditModal({ logs, onClose }) {
  const [actFilter, setActFilter] = useState('all');
  const [search,    setSearch]    = useState('');
  const filtered = logs
    .filter(l => actFilter==='all' || l.activityType===actFilter)
    .filter(l => {
      if(!search.trim()) return true;
      const q = search.toLowerCase();
      return (l.targetName||'').toLowerCase().includes(q)
          || (l.changedByName||'').toLowerCase().includes(q)
          || (l.reason||'').toLowerCase().includes(q);
    });

  return createPortal(
    <div style={{position:'fixed',inset:0,zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',padding:16}}>
      <div style={{background:'var(--card)',border:'1px solid var(--card-border)',borderRadius:16,width:'100%',maxWidth:900,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'var(--shadow-modal)',overflow:'hidden'}}>
        <div style={{background:'var(--thead-bg)',borderBottom:'1px solid var(--divider)',padding:'16px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div>
            <p style={{...MN,fontSize:9,letterSpacing:'0.2em',color:'var(--text-muted)',textTransform:'uppercase',marginBottom:4}}>Immutable</p>
            <h2 style={{...SR,fontSize:20,fontWeight:700,color:'var(--text-primary)'}}>Admin Audit Log</h2>
          </div>
          <button onClick={onClose} style={{background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:8,width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)',cursor:'pointer'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{padding:'12px 24px',borderBottom:'1px solid var(--divider)',flexShrink:0,display:'flex',flexDirection:'column',gap:10}}>
          <input style={{width:'100%',background:'var(--input-bg)',border:'1px solid var(--input-border)',borderRadius:9,padding:'9px 14px',fontSize:13,color:'var(--text-primary)',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
            placeholder="Search by name, reason, or changed by…" value={search} onChange={e=>setSearch(e.target.value)} />
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {AUDIT_FILTER_TABS.map(t=>(
              <button key={t.key} onClick={()=>setActFilter(t.key)}
                style={{padding:'6px 14px',...MN,fontSize:10,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',cursor:'pointer',borderRadius:8,transition:'all 0.15s',
                  background:actFilter===t.key?'var(--gold-soft)':'var(--surface)',
                  border:`1px solid ${actFilter===t.key?'var(--gold-border)':'var(--card-border)'}`,
                  color:actFilter===t.key?'var(--gold)':'var(--text-muted)',
                }}>
                {t.label} <span style={{marginLeft:4,opacity:0.7}}>{t.key==='all'?logs.length:logs.filter(l=>l.activityType===t.key).length}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{overflowY:'auto',flex:1}}>
          {filtered.length===0
            ? <p style={{padding:32,textAlign:'center',...PP,fontSize:13,color:'var(--text-muted)'}}>No records found.</p>
            : (
              <table style={{width:'100%',minWidth:640,borderCollapse:'collapse'}}>
                <thead style={{position:'sticky',top:0,background:'var(--thead-bg)'}}>
                  <tr>
                    <th style={{width:28}}/>
                    {['Date & Time','Type','Target User','Detail','Changed By'].map(h=>(
                      <th key={h} style={{...MN,fontSize:9,letterSpacing:'0.16em',textTransform:'uppercase',color:'var(--text-muted)',padding:'11px 12px',textAlign:'left',fontWeight:600,borderBottom:'1px solid var(--divider)',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>{filtered.map(l=><AuditRow key={l.id} log={l}/>)}</tbody>
              </table>
            )}
        </div>
        <div style={{padding:'10px 24px',borderTop:'1px solid var(--divider)',background:'var(--surface)',flexShrink:0}}>
          <p style={{...MN,fontSize:10,color:'var(--text-dim)'}}>Showing {filtered.length} of {logs.length} entries · Click any row to expand</p>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Staff / Admin Invite Modal ────────────────────────────────────────────────
// Admin fills out the full profile here. A users doc is created immediately
// so the person just signs in and lands on their dashboard — no registration form.
function formatId(raw) {
  const d = raw.replace(/\D/g,'').slice(0,10);
  if(d.length<=2) return d;
  if(d.length<=7) return `${d.slice(0,2)}-${d.slice(2)}`;
  return `${d.slice(0,2)}-${d.slice(2,7)}-${d.slice(7)}`;
}
const ID_REGEX = /^\d{2}-\d{5}-\d{3}$/;

function StaffInviteModal({ invites, myProfile, onClose, showToast }) {
  // Step: 'list' | 'form'
  const [step, setStep] = useState('list');

  // Form fields
  const [role,          setRole]          = useState('staff');
  const [email,         setEmail]         = useState('');
  const [firstName,     setFirstName]     = useState('');
  const [lastName,      setLastName]      = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [idFormat,      setIdFormat]      = useState('');
  const [idNumber,      setIdNumber]      = useState('');
  const [college,       setCollege]       = useState('');
  const [course,        setCourse]        = useState('');
  const [formError,     setFormError]     = useState('');
  const [saving,        setSaving]        = useState(false);
  const [deleting,      setDeleting]      = useState(null);

  const selectedCollege = COLLEGES.find(c => c.name === college);
  const courses         = selectedCollege?.courses || [];

  const fmt = ts => { if(!ts)return'—'; const d=ts.toDate?ts.toDate():new Date(ts); return d.toLocaleDateString('en-PH',{dateStyle:'medium'}); };

  const resetForm = () => {
    setEmail(''); setFirstName(''); setLastName(''); setMiddleInitial('');
    setIdFormat(''); setIdNumber(''); setCollege(''); setCourse('');
    setFormError(''); setRole('staff');
  };

  const inputSt = {
    width:'100%', background:'var(--input-bg)', border:'1px solid var(--input-border)',
    borderRadius:9, padding:'10px 13px', fontSize:13, color:'var(--text-primary)',
    fontFamily:'inherit', outline:'none', boxSizing:'border-box', transition:'border-color 0.15s',
  };
  const onFocus = e => { e.currentTarget.style.borderColor = 'var(--gold)'; };
  const onBlur  = e => { e.currentTarget.style.borderColor = 'var(--input-border)'; };

  const handleCreate = async () => {
    setFormError('');
    const cleanEmail = email.trim().toLowerCase();

    // ── Client-side validation ───────────────────────────────────────────────
    if (!cleanEmail) { setFormError('Email is required.'); return; }
    if (!cleanEmail.endsWith(NEU_DOMAIN)) {
      setFormError(`Only @neu.edu.ph emails are allowed. "${cleanEmail}" is not a valid NEU institutional email.`);
      return;
    }
    if (!firstName.trim()) { setFormError('First name is required.'); return; }
    if (!lastName.trim())  { setFormError('Last name is required.');  return; }
    if (!ID_REGEX.test(idNumber)) { setFormError('ID Number must be in format YY-NNNNN-NNN.'); return; }

    // Duplicate pending invite check (fast, local)
    if (invites.find(i => i.email === cleanEmail && i.status === 'pending')) {
      setFormError('This email already has a pending invite.'); return;
    }

    setSaving(true);
    try {
      // ── Check if a real user doc already exists for this email ────────────
      const existingSnap = await getDocs(query(
        collection(db, 'users'),
        where('email', '==', cleanEmail)
      ));
      const realDocs = existingSnap.docs.filter(d => !d.id.startsWith('invite_'));

      if (realDocs.length > 0) {
        // User already registered — update their profile + role directly.
        // No placeholder needed, no registration form. They're already in the system.
        const existingDocRef = realDocs[0].ref;
        await updateDoc(existingDocRef, {
          role,
          firstName:     firstName.trim().toUpperCase(),
          lastName:      lastName.trim().toUpperCase(),
          middleInitial: middleInitial.trim().toUpperCase().replace(/\.+$/, ''),
          idNumber:      idNumber.trim(),
          college:       college.trim().toUpperCase() || null,
          course:        course.trim().toUpperCase() || null,
        });
        // Audit log
        await addDoc(collection(db, 'adminAuditLogs'), {
          activityType:  'role_change',
          targetId:      realDocs[0].id,
          targetName:    `${lastName.trim().toUpperCase()}, ${firstName.trim().toUpperCase()}`,
          fromRole:      realDocs[0].data().role || 'visitor',
          toRole:        role,
          changedBy:     myProfile?.uid,
          changedByName: `${myProfile?.lastName}, ${myProfile?.firstName}`,
          reason:        `Admin pre-registration — profile updated and role set to ${role}`,
          timestamp:     serverTimestamp(),
        });
        showToast(`${cleanEmail} already existed — profile updated and role set to ${role}.`, true);
        resetForm();
        setStep('list');
        setSaving(false);
        return;
      }

      // ── New user — create placeholder profile + invite record ──────────────
      // AuthContext will migrate this to their real UID on first sign-in.
      const placeholderUid = `invite_${cleanEmail.replace(/[@.]/g, '_')}`;

      await setDoc(doc(db, 'users', placeholderUid), {
        uid:           placeholderUid,
        email:         cleanEmail,
        firstName:     firstName.trim().toUpperCase(),
        lastName:      lastName.trim().toUpperCase(),
        middleInitial: middleInitial.trim().toUpperCase().replace(/\.+$/, ''),
        idNumber:      idNumber.trim(),
        role,
        visitorType:   null,
        college:       college.trim().toUpperCase() || null,
        course:        course.trim().toUpperCase() || null,
        isPreCreated:  true,
        createdAt:     serverTimestamp(),
        createdBy:     myProfile?.uid,
      });

      await addDoc(collection(db, 'staffInvites'), {
        email:         cleanEmail,
        role,
        preCreatedUid: placeholderUid,
        invitedBy:     myProfile?.uid,
        invitedByName: `${myProfile?.lastName}, ${myProfile?.firstName}`,
        invitedAt:     serverTimestamp(),
        status:        'pending',
      });

      showToast(`${role === 'admin' ? 'Admin' : 'Staff'} account created for ${cleanEmail}. They can sign in immediately.`, true);
      resetForm();
      setStep('list');
    } catch(e) {
      setFormError('Failed: ' + e.message);
    }
    setSaving(false);
  };

  const handleCancelInvite = async id => {
    setDeleting(id);
    try { await deleteDoc(doc(db,'staffInvites',id)); showToast('Invite removed.',true); }
    catch { showToast('Failed.',false); }
    setDeleting(null);
  };

  const roleAccent = role === 'admin' ? 'var(--red)' : 'var(--gold)';
  const roleAccentSoft = role === 'admin' ? 'var(--red-soft)' : 'var(--gold-soft)';
  const roleAccentBorder = role === 'admin' ? 'var(--red-border)' : 'var(--gold-border)';

  return createPortal(
    <div style={{position:'fixed',inset:0,zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',padding:16}}>
      <div style={{background:'var(--card)',border:'1px solid var(--card-border)',borderRadius:16,width:'100%',maxWidth:580,maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'var(--shadow-modal)',overflow:'hidden',animation:'slideUp 0.2s ease'}}>

        {/* Top accent stripe — changes colour with role */}
        <div style={{height:3,background:`linear-gradient(90deg,${roleAccent},transparent)`,transition:'background 0.3s'}}/>

        {/* Header */}
        <div style={{background:'var(--thead-bg)',borderBottom:'1px solid var(--divider)',padding:'16px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div>
            <p style={{...MN,fontSize:9,letterSpacing:'0.2em',color:roleAccent,textTransform:'uppercase',marginBottom:4,transition:'color 0.3s'}}>Pre-Registration</p>
            <h2 style={{...SR,fontSize:18,fontWeight:700,color:'var(--text-primary)'}}>
              {step === 'list' ? 'Manage Invites' : `Add ${role === 'admin' ? 'Admin' : 'Staff'} Account`}
            </h2>
          </div>
          <div style={{display:'flex',gap:8}}>
            {step === 'form' && (
              <button onClick={()=>{setStep('list');resetForm();}}
                style={{...MN,fontSize:10,fontWeight:700,padding:'7px 14px',borderRadius:8,background:'var(--surface)',border:'1px solid var(--card-border)',color:'var(--text-muted)',cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.1em'}}>
                ← Back
              </button>
            )}
            {step === 'list' && (
              <button onClick={()=>setStep('form')}
                style={{...MN,fontSize:10,fontWeight:700,padding:'7px 14px',borderRadius:8,background:roleAccentSoft,border:`1px solid ${roleAccentBorder}`,color:roleAccent,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.1em',transition:'all 0.2s'}}>
                + New Account
              </button>
            )}
            <button onClick={onClose} style={{background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:8,width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)',cursor:'pointer'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* ── LIST VIEW ── */}
        {step === 'list' && (
          <div style={{overflowY:'auto',flex:1}}>
            {invites.length === 0
              ? (
                <div style={{padding:'48px 24px',textAlign:'center'}}>
                  <div style={{width:48,height:48,borderRadius:'50%',background:'var(--surface)',border:'1px solid var(--card-border)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
                  </div>
                  <p style={{...PP,fontSize:14,fontWeight:500,color:'var(--text-muted)',marginBottom:6}}>No accounts created yet</p>
                  <p style={{...MN,fontSize:11,color:'var(--text-dim)'}}>Click "+ New Account" to add a staff or admin member.</p>
                </div>
              )
              : (
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead style={{position:'sticky',top:0,background:'var(--thead-bg)'}}>
                    <tr>
                      {['Name / Email','Role','Created','Status',''].map(h=>(
                        <th key={h} style={{...MN,fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--text-muted)',padding:'10px 14px',textAlign:'left',fontWeight:600,borderBottom:'1px solid var(--divider)'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map(inv=>(
                      <tr key={inv.id} style={{borderBottom:'1px solid var(--row-border)'}}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--row-hover-bg)'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{padding:'11px 14px'}}>
                          <p style={{...PP,fontSize:13,fontWeight:600,color:'var(--text-primary)'}}>{inv.email}</p>
                          <p style={{...MN,fontSize:10,color:'var(--text-dim)'}}>by {inv.invitedByName||'—'}</p>
                        </td>
                        <td style={{padding:'11px 14px'}}><RoleBadge role={inv.role||'staff'}/></td>
                        <td style={{padding:'11px 14px',...MN,fontSize:11,color:'var(--text-dim)',whiteSpace:'nowrap'}}>{fmt(inv.invitedAt)}</td>
                        <td style={{padding:'11px 14px'}}>
                          {inv.status==='pending' && <span style={{...MN,fontSize:9,fontWeight:700,padding:'2px 8px',borderRadius:20,background:'var(--gold-soft)',border:'1px solid var(--gold-border)',color:'var(--gold)',textTransform:'uppercase'}}>Pending</span>}
                          {inv.status==='claimed'  && <span style={{...MN,fontSize:9,fontWeight:700,padding:'2px 8px',borderRadius:20,background:'var(--green-soft)',border:'1px solid var(--green-border)',color:'var(--green)',textTransform:'uppercase'}}>Active ✓</span>}
                        </td>
                        <td style={{padding:'11px 14px'}}>
                          {inv.status==='pending' && (
                            <button onClick={()=>handleCancelInvite(inv.id)} disabled={deleting===inv.id}
                              style={{padding:'4px 10px',borderRadius:6,background:'var(--surface)',border:'1px solid var(--card-border)',color:'var(--text-muted)',...MN,fontSize:9,fontWeight:700,cursor:'pointer',textTransform:'uppercase'}}>
                              {deleting===inv.id?'…':'Remove'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </div>
        )}

        {/* ── FORM VIEW ── */}
        {step === 'form' && (
          <div style={{overflowY:'auto',flex:1,padding:'20px 24px',display:'flex',flexDirection:'column',gap:16}}>

            {/* Info banner */}
            <div style={{background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:10,padding:'12px 14px'}}>
              <p style={{...PP,fontSize:13,color:'var(--text-muted)',lineHeight:1.6}}>
                Fill out their profile below. Their account will be created immediately — they just need to sign in with their NEU Google account and they'll be taken straight to their dashboard.
              </p>
            </div>

            {formError && (
              <div style={{background:'var(--red-soft)',border:'1px solid var(--red-border)',borderRadius:9,padding:'10px 14px'}}>
                <p style={{...MN,fontSize:11,color:'var(--red)'}}>{formError}</p>
              </div>
            )}

            {/* Role selector */}
            <div>
              <label style={{...MN,fontSize:9,letterSpacing:'0.14em',color:'var(--text-muted)',textTransform:'uppercase',display:'block',marginBottom:8,fontWeight:600}}>Role <span style={{color:'var(--red)'}}>*</span></label>
              <div style={{display:'flex',gap:8}}>
                {[
                  {key:'staff', label:'Library Staff',  accent:'var(--gold)',  soft:'var(--gold-soft)',  border:'var(--gold-border)'  },
                  {key:'admin', label:'Administrator',   accent:'var(--red)',   soft:'var(--red-soft)',   border:'var(--red-border)'   },
                ].map(({key,label,accent,soft,border})=>(
                  <button key={key} type="button" onClick={()=>setRole(key)}
                    style={{flex:1,padding:'10px 12px',borderRadius:9,cursor:'pointer',transition:'all 0.15s',...PP,fontSize:13,fontWeight:600,
                      background: role===key ? soft : 'var(--surface)',
                      border:     `1px solid ${role===key ? border : 'var(--card-border)'}`,
                      color:      role===key ? accent : 'var(--text-muted)',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
              {role === 'admin' && (
                <div style={{marginTop:8,background:'var(--red-soft)',border:'1px solid var(--red-border)',borderRadius:8,padding:'8px 12px',display:'flex',gap:8,alignItems:'flex-start'}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:1}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p style={{...PP,fontSize:12,color:'var(--red)',lineHeight:1.5}}>Admins have full access to User Management, Reports, Edit Requests, and all admin features. Only add trusted personnel.</p>
                </div>
              )}
            </div>

            {/* Email — NEU only */}
            <div>
              <label style={{...MN,fontSize:9,letterSpacing:'0.14em',color:'var(--text-muted)',textTransform:'uppercase',display:'block',marginBottom:6,fontWeight:600}}>
                NEU Email <span style={{color:'var(--red)'}}>*</span>
              </label>
              <input
                style={{...inputSt,...MN,letterSpacing:'0.04em',
                  borderColor: email && !email.toLowerCase().endsWith(NEU_DOMAIN) ? 'var(--red)' : undefined
                }}
                type="email"
                placeholder="firstname.lastname@neu.edu.ph"
                value={email}
                onChange={e=>{setEmail(e.target.value);setFormError('');}}
                onFocus={onFocus} onBlur={onBlur}
                autoFocus
              />
              {email && !email.toLowerCase().endsWith(NEU_DOMAIN) && (
                <p style={{...MN,fontSize:10,color:'var(--red)',marginTop:4}}>Must be an @neu.edu.ph email address.</p>
              )}
            </div>

            {/* Names */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div>
                <label style={{...MN,fontSize:9,letterSpacing:'0.14em',color:'var(--text-muted)',textTransform:'uppercase',display:'block',marginBottom:6,fontWeight:600}}>First Name <span style={{color:'var(--red)'}}>*</span></label>
                <input style={{...inputSt,textTransform:'uppercase'}} placeholder="JUAN"
                  value={firstName} onChange={e=>{setFirstName(e.target.value);setFormError('');}}
                  onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={{...MN,fontSize:9,letterSpacing:'0.14em',color:'var(--text-muted)',textTransform:'uppercase',display:'block',marginBottom:6,fontWeight:600}}>Last Name <span style={{color:'var(--red)'}}>*</span></label>
                <input style={{...inputSt,textTransform:'uppercase'}} placeholder="DELA CRUZ"
                  value={lastName} onChange={e=>{setLastName(e.target.value);setFormError('');}}
                  onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>

            {/* Middle Initial + ID */}
            <div style={{display:'grid',gridTemplateColumns:'80px 1fr',gap:10}}>
              <div>
                <label style={{...MN,fontSize:9,letterSpacing:'0.14em',color:'var(--text-muted)',textTransform:'uppercase',display:'block',marginBottom:6,fontWeight:600}}>M.I.</label>
                <input style={{...inputSt,textAlign:'center',textTransform:'uppercase'}} placeholder="D"
                  maxLength={2} value={middleInitial}
                  onChange={e=>setMiddleInitial(e.target.value.toUpperCase().replace(/[^A-Z]/g,''))}
                  onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={{...MN,fontSize:9,letterSpacing:'0.14em',color:'var(--text-muted)',textTransform:'uppercase',display:'block',marginBottom:6,fontWeight:600}}>ID Number <span style={{color:'var(--red)'}}>*</span></label>
                <input style={{...inputSt,...MN,letterSpacing:'0.12em'}} placeholder="22-12345-123"
                  value={idFormat}
                  onChange={e=>{const f=formatId(e.target.value);setIdFormat(f);setIdNumber(f);setFormError('');}}
                  onFocus={onFocus} onBlur={onBlur} />
                <p style={{...MN,fontSize:9,color:'var(--text-dim)',marginTop:3}}>Format: YY-NNNNN-NNN</p>
              </div>
            </div>

            {/* College */}
            <div>
              <label style={{...MN,fontSize:9,letterSpacing:'0.14em',color:'var(--text-muted)',textTransform:'uppercase',display:'block',marginBottom:6,fontWeight:600}}>College / Department</label>
              <select style={{...inputSt,appearance:'none',cursor:'pointer'}}
                value={college} onChange={e=>{setCollege(e.target.value);setCourse('');}}
                onFocus={onFocus} onBlur={onBlur}>
                <option value="">— Select (optional) —</option>
                {COLLEGES.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>

            {/* Course — only if college has courses */}
            {college && courses.length > 0 && (
              <div>
                <label style={{...MN,fontSize:9,letterSpacing:'0.14em',color:'var(--text-muted)',textTransform:'uppercase',display:'block',marginBottom:6,fontWeight:600}}>Course</label>
                <select style={{...inputSt,appearance:'none',cursor:'pointer'}}
                  value={course} onChange={e=>setCourse(e.target.value)}
                  onFocus={onFocus} onBlur={onBlur}>
                  <option value="">— Select (optional) —</option>
                  {courses.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Footer — only shown in form view */}
        {step === 'form' && (
          <div style={{padding:'14px 24px',borderTop:'1px solid var(--divider)',display:'flex',gap:10,flexShrink:0,background:'var(--surface)'}}>
            <button onClick={()=>{setStep('list');resetForm();}}
              style={{flex:1,padding:'11px',borderRadius:9,background:'var(--surface)',border:'1px solid var(--card-border)',color:'var(--text-muted)',cursor:'pointer',...PP,fontSize:13}}>
              Cancel
            </button>
            <button onClick={handleCreate} disabled={saving || !email.toLowerCase().endsWith(NEU_DOMAIN)}
              style={{flex:2,padding:'11px',borderRadius:9,
                background: roleAccentSoft,
                border:`1px solid ${roleAccentBorder}`,
                color: roleAccent,
                cursor: saving || !email.toLowerCase().endsWith(NEU_DOMAIN) ? 'not-allowed':'pointer',
                opacity: saving || !email.toLowerCase().endsWith(NEU_DOMAIN) ? 0.5:1,
                ...MN,fontSize:11,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',
                transition:'all 0.2s',
              }}>
              {saving ? 'Creating Account…' : `Create ${role === 'admin' ? 'Admin' : 'Staff'} Account`}
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}`}</style>
    </div>,
    document.body
  );
}

// ── Profile Panel ─────────────────────────────────────────────────────────────
function ProfilePanel({ user, myProfile, pendingEditUids, onClose, showToast, onEditProfile, onEditName }) {
  const [roleAction, setRoleAction] = useState(null);
  const [reason,     setReason]     = useState('');
  const [saving,     setSaving]     = useState(false);

  const canChange  = user.id !== myProfile?.uid && user.role !== 'admin';
  const hasPending = pendingEditUids.has(user.id);
  const fmt = ts => { if(!ts)return'—'; const d=ts.toDate?ts.toDate():new Date(ts); return d.toLocaleDateString('en-PH',{dateStyle:'long'}); };

  const handleRoleChange = async () => {
    if(reason.trim().length < 10) { showToast('Reason must be at least 10 characters.',false); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db,'users',user.id),{role:roleAction});
      await addDoc(collection(db,'adminAuditLogs'),{
        activityType:'role_change', targetId:user.id,
        targetName:`${user.lastName}, ${user.firstName}`,
        fromRole:user.role, toRole:roleAction,
        changedBy:myProfile?.uid,
        changedByName:`${myProfile?.lastName}, ${myProfile?.firstName}`,
        reason:reason.trim(), timestamp:serverTimestamp(),
      });
      showToast(`${user.firstName}'s role updated to ${roleAction}.`,true);
      setRoleAction(null); setReason('');
    } catch(e) { showToast('Error: '+e.message,false); }
    setSaving(false);
  };

  const inputSt = {
    width:'100%',background:'var(--input-bg)',border:'1px solid var(--input-border)',
    borderRadius:9,padding:'9px 13px',fontSize:13,color:'var(--text-primary)',
    fontFamily:'inherit',outline:'none',boxSizing:'border-box',
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:8000,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(3px)'}}/>
      <div style={{
        position:'fixed',top:0,right:0,height:'100vh',
        width:'clamp(300px,38vw,460px)',zIndex:8001,
        background:'var(--card)',borderLeft:'1px solid var(--divider)',
        display:'flex',flexDirection:'column',
        boxShadow:'-12px 0 48px rgba(0,0,0,0.35)',
        animation:'slideInRight 0.22s cubic-bezier(0.25,0.46,0.45,0.94)',
      }}>
        <div style={{height:3,background:'linear-gradient(90deg,var(--gold),transparent)',flexShrink:0}}/>

        {/* Header */}
        <div style={{padding:'18px 20px',borderBottom:'1px solid var(--divider)',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexShrink:0}}>
          <div style={{minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
              <RoleBadge role={user.role}/>
              {hasPending && (
                <span style={{...MN,fontSize:9,fontWeight:700,padding:'2px 8px',borderRadius:20,background:'var(--gold-soft)',border:'1px solid var(--gold-border)',color:'var(--gold)',textTransform:'uppercase',letterSpacing:'0.08em'}}>
                  Pending Edit
                </span>
              )}
            </div>
            <h2 style={{...SR,fontSize:20,fontWeight:700,color:'var(--text-primary)',lineHeight:1.2,marginBottom:3}}>
              {user.lastName
                ? `${user.lastName}, ${user.firstName}${user.middleInitial?' '+user.middleInitial+'.':''}`
                : user.email}
            </h2>
            {user.idNumber && <p style={{...MN,fontSize:12,color:'var(--text-muted)'}}>{user.idNumber}</p>}
          </div>
          <button onClick={onClose} style={{background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:8,width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)',cursor:'pointer',flexShrink:0}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{overflowY:'auto',flex:1,padding:'18px 20px',display:'flex',flexDirection:'column',gap:16}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {/* Email — always shown */}
            <div style={{background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:10,padding:'10px 12px',gridColumn:'1 / -1'}}>
              <p style={{...MN,fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--text-dim)',marginBottom:3}}>Email</p>
              <p style={{...PP,fontSize:13,color:'var(--text-primary)',wordBreak:'break-all'}}>{user.email||'—'}</p>
            </div>

            {/* Visitor-only fields */}
            {user.role==='visitor' && <>
              <div style={{background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:10,padding:'10px 12px'}}>
                <p style={{...MN,fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--text-dim)',marginBottom:3}}>Visitor Type</p>
                <p style={{...PP,fontSize:13,color:'var(--text-primary)'}}>{user.visitorType||'Student'}</p>
              </div>
              <div style={{background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:10,padding:'10px 12px'}}>
                <p style={{...MN,fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--text-dim)',marginBottom:3}}>College</p>
                <p style={{...PP,fontSize:13,color:'var(--text-primary)'}}>{user.college||user.department||'—'}</p>
              </div>
              <div style={{background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:10,padding:'10px 12px',gridColumn:'1 / -1'}}>
                <p style={{...MN,fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--text-dim)',marginBottom:3}}>Course</p>
                <p style={{...PP,fontSize:13,color:'var(--text-primary)'}}>{user.course||'—'}</p>
              </div>
            </>}

            {/* Staff-only fields */}
            {user.role==='staff' && <>
              <div style={{background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:10,padding:'10px 12px'}}>
                <p style={{...MN,fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--text-dim)',marginBottom:3}}>Department</p>
                <p style={{...PP,fontSize:13,color:'var(--text-primary)'}}>{user.college||user.department||'Library Staff'}</p>
              </div>
              <div style={{background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:10,padding:'10px 12px'}}>
                <p style={{...MN,fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--text-dim)',marginBottom:3}}>Staff ID</p>
                <p style={{...PP,fontSize:13,color:'var(--text-primary)'}}>{user.idNumber||'—'}</p>
              </div>
            </>}

            {/* Admin-only fields */}
            {user.role==='admin' && <>
              <div style={{background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:10,padding:'10px 12px'}}>
                <p style={{...MN,fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--text-dim)',marginBottom:3}}>Access Level</p>
                <p style={{...PP,fontSize:13,color:'var(--text-primary)'}}>Administrator</p>
              </div>
              <div style={{background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:10,padding:'10px 12px'}}>
                <p style={{...MN,fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--text-dim)',marginBottom:3}}>Admin ID</p>
                <p style={{...PP,fontSize:13,color:'var(--text-primary)'}}>{user.idNumber||'—'}</p>
              </div>
            </>}

            {/* Joined — always shown */}
            <div style={{background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:10,padding:'10px 12px'}}>
              <p style={{...MN,fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--text-dim)',marginBottom:3}}>Joined</p>
              <p style={{...PP,fontSize:13,color:'var(--text-primary)'}}>{fmt(user.createdAt)||'—'}</p>
            </div>
          </div>

          {canChange && (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <p style={{...MN,fontSize:10,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--text-dim)'}}>Actions</p>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {user.role==='visitor' && (
                  <button onClick={()=>{setRoleAction('staff');setReason('');}}
                    style={{padding:'7px 14px',borderRadius:8,background:'var(--gold-soft)',border:'1px solid var(--gold-border)',color:'var(--gold)',...MN,fontSize:10,fontWeight:700,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.08em'}}>
                    ↑ Promote to Staff
                  </button>
                )}
                {user.role==='staff' && (
                  <button onClick={()=>{setRoleAction('visitor');setReason('');}}
                    style={{padding:'7px 14px',borderRadius:8,background:'var(--surface)',border:'1px solid var(--card-border)',color:'var(--text-muted)',...MN,fontSize:10,fontWeight:700,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.08em'}}>
                    ↓ Demote to Visitor
                  </button>
                )}
                <button onClick={()=>onEditProfile({uid:user.id,profile:user})}
                  style={{padding:'7px 14px',borderRadius:8,background:'var(--surface)',border:'1px solid var(--gold-border)',color:'var(--gold)',...MN,fontSize:10,fontWeight:700,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.08em'}}>
                  Edit Profile
                </button>
                <button onClick={()=>onEditName({uid:user.id,profile:user})}
                  style={{padding:'7px 14px',borderRadius:8,background:'var(--surface)',border:'1px solid var(--green-border)',color:'var(--green)',...MN,fontSize:10,fontWeight:700,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.08em'}}>
                  Edit Name
                </button>
              </div>

              {roleAction && (
                <div style={{background:'var(--gold-soft)',border:'1px solid var(--gold-border)',borderRadius:10,padding:'14px'}}>
                  <p style={{...MN,fontSize:10,color:'var(--gold)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>
                    {roleAction==='staff' ? 'Promoting to Staff' : 'Demoting to Visitor'} — Reason Required
                  </p>
                  <textarea rows={3} style={{...inputSt,resize:'none',height:68,marginBottom:6}}
                    placeholder="Minimum 10 characters…" value={reason}
                    onChange={e=>setReason(e.target.value)} autoFocus/>
                  <p style={{...MN,fontSize:10,color:'var(--gold)',opacity:0.7,marginBottom:8}}>{reason.trim().length} / 10 min</p>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>{setRoleAction(null);setReason('');}}
                      style={{flex:1,padding:'8px',borderRadius:8,background:'var(--surface)',border:'1px solid var(--card-border)',color:'var(--text-muted)',...PP,fontSize:12,cursor:'pointer'}}>
                      Cancel
                    </button>
                    <button onClick={handleRoleChange} disabled={reason.trim().length<10||saving}
                      style={{flex:1,padding:'8px',borderRadius:8,background:'var(--gold-soft)',border:'1px solid var(--gold-border)',color:'var(--gold)',...MN,fontSize:10,fontWeight:700,cursor:reason.trim().length<10?'not-allowed':'pointer',opacity:reason.trim().length<10?0.5:1,textTransform:'uppercase',letterSpacing:'0.08em'}}>
                      {saving?'Saving…':'Confirm'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {user.role==='admin' && user.id!==myProfile?.uid && (
            <div style={{background:'var(--surface)',border:'1px solid var(--card-border)',borderRadius:10,padding:'12px 14px'}}>
              <p style={{...MN,fontSize:11,color:'var(--text-muted)',fontStyle:'italic'}}>Admin accounts are protected and cannot be modified here.</p>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
    </>,
    document.body
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function UserManagementPage() {
  const { userProfile: myProfile } = useAuth();
  const location = useLocation();
  const initRole        = location.state?.filterRole        || 'all';
  const initVisitorType = location.state?.filterVisitorType || 'all';

  const [users,         setUsers]         = useState([]);
  const [auditLogs,     setAuditLogs]     = useState([]);
  const [staffInvites,  setStaffInvites]  = useState([]);
  const [editRequests,  setEditRequests]  = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [toast,         setToast]         = useState(null);

  const [search,           setSearch]           = useState('');
  const [roleFilter,       setRoleFilter]       = useState(initRole);
  const [visitorTypeFilter, setVisitorTypeFilter] = useState(initVisitorType);
  const [sortBy,           setSortBy]           = useState('name');

  const [auditOpen,         setAuditOpen]         = useState(false);
  const [staffInviteOpen,   setStaffInviteOpen]   = useState(false);
  const [selectedUser,      setSelectedUser]      = useState(null);
  const [editProfileTarget, setEditProfileTarget] = useState(null);
  const [editNameTarget,    setEditNameTarget]    = useState(null);

  useEffect(() => {
    setLoading(true);
    const u1 = onSnapshot(collection(db,'users'), snap=>{
      // Filter out placeholder pre-created docs (invite_*) from the user table
      const docs = snap.docs
        .map(d=>({id:d.id,...d.data()}))
        .filter(d => !d.id.startsWith('invite_'));
      docs.sort((a,b)=>(a.lastName??'').localeCompare(b.lastName??''));
      setUsers(docs); setLoading(false);
    }, ()=>setLoading(false));
    const u2 = onSnapshot(collection(db,'adminAuditLogs'), snap=>{
      const docs = snap.docs.map(d=>({id:d.id,...d.data()}));
      docs.sort((a,b)=>(b.timestamp?.toMillis?.()??0)-(a.timestamp?.toMillis?.()??0));
      setAuditLogs(docs);
    }, ()=>{});
    const u3 = onSnapshot(collection(db,'staffInvites'), snap=>{
      const docs = snap.docs.map(d=>({id:d.id,...d.data()}));
      docs.sort((a,b)=>(b.invitedAt?.toMillis?.()??0)-(a.invitedAt?.toMillis?.()??0));
      setStaffInvites(docs);
    }, ()=>{});
    const u4 = onSnapshot(collection(db,'editRequests'), snap=>{
      setEditRequests(snap.docs.map(d=>({id:d.id,...d.data()})));
    }, ()=>{});
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const pendingEditUids = useMemo(()=>
    new Set(editRequests.filter(r=>r.status==='pending').map(r=>r.uid)),
  [editRequests]);

  const visibleUsers = users.filter(u=>!IT_SUPPORT_EMAILS.includes((u.email||'').toLowerCase()));

  const filtered = visibleUsers
    .filter(u => {
      const ms = !search ||
        `${u.firstName} ${u.lastName} ${u.idNumber} ${u.email} ${u.course||''} ${u.college||''}`
          .toLowerCase().includes(search.toLowerCase());
      const mr = roleFilter==='all' || u.role===roleFilter;
      const mv = visitorTypeFilter==='all' || (u.role==='visitor' && u.visitorType===visitorTypeFilter) ||
                 (visitorTypeFilter==='student' && u.role==='visitor' && u.visitorType!=='faculty');
      return ms && mr && mv;
    })
    .sort((a,b) => {
      if(sortBy==='role')    { const o={admin:0,staff:1,visitor:2}; return (o[a.role]??3)-(o[b.role]??3); }
      if(sortBy==='college') return (a.college||'').localeCompare(b.college||'');
      return (a.lastName||'').localeCompare(b.lastName||'');
    });

  const counts = {
    all:     visibleUsers.length,
    visitor: visibleUsers.filter(u=>u.role==='visitor').length,
    staff:   visibleUsers.filter(u=>u.role==='staff').length,
    admin:   visibleUsers.filter(u=>u.role==='admin').length,
  };

  const ROLE_TABS = [{key:'all',label:'All'},{key:'visitor',label:'Visitors'},{key:'staff',label:'Staff'},{key:'admin',label:'Admins'}];
  const showToast = (msg, ok) => { setToast({msg,ok}); setTimeout(()=>setToast(null),4500); };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:24,animation:'fadeUp 0.3s ease both'}}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        tr.urow:hover td  { background:var(--row-hover-bg)!important; }
      `}</style>

      {/* Header */}
      <div style={{paddingBottom:20,borderBottom:'1px solid var(--divider)',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
        <div>
          <p style={{...MN,fontSize:10,letterSpacing:'0.2em',textTransform:'uppercase',color:'var(--text-dim)',marginBottom:6}}>Administration</p>
          <h1 style={{...SR,fontSize:'clamp(22px,3.5vw,30px)',fontWeight:700,color:'var(--text-primary)',marginBottom:6}}>User Management</h1>
          <p style={{...PP,fontSize:14,color:'var(--text-muted)'}}>Click any row to view profile and actions.</p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          {[
            {label:'Add Staff / Admin',              fn:()=>setStaffInviteOpen(true)         },
            {label:`Export CSV (${filtered.length})`, fn:()=>exportUsersCSV(filtered)        },
            {label:`Audit Log (${auditLogs.length})`, fn:()=>setAuditOpen(true)              },
          ].map(({label,fn})=>(
            <button key={label} onClick={fn}
              style={{padding:'8px 16px',borderRadius:9,background:'var(--surface)',border:'1px solid var(--card-border)',color:'var(--text-muted)',...MN,fontSize:10,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',cursor:'pointer'}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <input style={{flex:'1 1 200px',background:'var(--input-bg)',border:'1px solid var(--input-border)',borderRadius:9,padding:'9px 14px',fontSize:13,color:'var(--text-primary)',fontFamily:'inherit',outline:'none'}}
            placeholder="Search by name, ID, email, course, college…"
            value={search} onChange={e=>setSearch(e.target.value)} />
          <select style={{background:'var(--input-bg)',border:'1px solid var(--input-border)',borderRadius:9,padding:'9px 14px',fontSize:13,color:'var(--text-primary)',fontFamily:'inherit',outline:'none',cursor:'pointer'}}
            value={sortBy} onChange={e=>setSortBy(e.target.value)}>
            <option value="name">Sort: Name (A–Z)</option>
            <option value="role">Sort: Role</option>
            <option value="college">Sort: College</option>
          </select>
        </div>
        <div style={{display:'flex',borderBottom:'1px solid var(--divider)'}}>
          {ROLE_TABS.map(t=>(
            <button key={t.key} onClick={()=>setRoleFilter(t.key)}
              style={{padding:'10px 18px',...MN,fontSize:10,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',cursor:'pointer',background:'transparent',border:'none',
                borderBottom:roleFilter===t.key?'2px solid var(--gold)':'2px solid transparent',
                color:roleFilter===t.key?'var(--gold)':'var(--text-muted)',
                display:'flex',alignItems:'center',gap:7,transition:'all 0.15s',
              }}>
              {t.label}
              <span style={{fontSize:9,padding:'1px 7px',borderRadius:10,
                background:t.key==='admin'?'var(--badge-red-bg)':t.key==='staff'?'var(--badge-gold-bg)':t.key==='visitor'?'var(--badge-green-bg)':'var(--surface)',
                color:t.key==='admin'?'var(--badge-red-text)':t.key==='staff'?'var(--badge-gold-text)':t.key==='visitor'?'var(--badge-green-text)':'var(--text-dim)',
                border:'1px solid transparent',
              }}>{counts[t.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {visitorTypeFilter !== 'all' && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:'var(--text-dim)', letterSpacing:'0.1em', textTransform:'uppercase' }}>
            Filtered: {visitorTypeFilter === 'student' ? 'Students only' : 'Faculty only'}
          </span>
          <button onClick={() => setVisitorTypeFilter('all')}
            style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, letterSpacing:'0.1em', textTransform:'uppercase', padding:'3px 10px', borderRadius:6, background:'var(--surface)', border:'1px solid var(--card-border)', color:'var(--text-dim)', cursor:'pointer' }}>
            Clear ×
          </button>
        </div>
      )}
      {(search || roleFilter!=='all') && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <p style={{...MN,fontSize:11,color:'var(--text-muted)'}}>
            Showing <strong style={{color:'var(--text-primary)'}}>{filtered.length}</strong> of {visibleUsers.length}
          </p>
          <button style={{...MN,fontSize:11,color:'var(--gold)',background:'none',border:'none',cursor:'pointer'}}
            onClick={()=>{setSearch('');setRoleFilter('all');}}>
            Clear filters
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{background:'var(--card)',border:'1px solid var(--card-border)',borderRadius:14,overflow:'hidden',boxShadow:'var(--shadow-card)'}}>
        {loading ? (
          <div style={{padding:32,display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:20,height:20,border:'2px solid var(--gold-border)',borderTopColor:'var(--gold)',borderRadius:'50%',animation:'spin 0.8s linear infinite',flexShrink:0}}/>
            <p style={{...PP,fontSize:13,color:'var(--text-muted)'}}>Loading users…</p>
          </div>
        ) : filtered.length===0 ? (
          <p style={{...PP,fontSize:13,color:'var(--text-muted)',padding:32,textAlign:'center'}}>No users match your filters.</p>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',minWidth:600,borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'var(--thead-bg)'}}>
                  {['Name','ID Number','Email','College / Course','Role'].map(h=>(
                    <th key={h} style={{...MN,fontSize:9,letterSpacing:'0.16em',textTransform:'uppercase',color:'var(--text-muted)',padding:'12px 16px',textAlign:'left',fontWeight:600,borderBottom:'1px solid var(--divider)',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u=>(
                  <tr key={u.id} className="urow" onClick={()=>setSelectedUser(u)}
                    style={{borderBottom:'1px solid var(--row-border)',cursor:'pointer',transition:'background 0.1s'}}>
                    <td style={{padding:'13px 16px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div>
                          <p style={{...PP,fontSize:13,fontWeight:600,color:'var(--text-primary)'}}>
                            {u.lastName ? `${u.lastName}, ${u.firstName}${u.middleInitial?' '+u.middleInitial+'.':''}` : u.email}
                          </p>
                          {u.id===myProfile?.uid && <span style={{...MN,fontSize:10,color:'var(--gold)'}}>you</span>}
                        </div>
                        {pendingEditUids.has(u.id) && (
                          <span title="Pending edit request" style={{width:7,height:7,borderRadius:'50%',background:'var(--gold)',flexShrink:0,display:'inline-block'}}/>
                        )}
                      </div>
                    </td>
                    <td style={{padding:'13px 16px',...MN,fontSize:12,color:'var(--text-body)'}}>{u.idNumber||'—'}</td>
                    <td style={{padding:'13px 16px',...MN,fontSize:11,color:'var(--text-muted)',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.email}</td>
                    <td style={{padding:'13px 16px'}}>
                      <p style={{...PP,fontSize:12,fontWeight:500,color:'var(--text-body)'}}>{u.college||u.department||'—'}</p>
                      {u.course && <p style={{...PP,fontSize:11,color:'var(--text-muted)',marginTop:1}}>{u.course}</p>}
                    </td>
                    <td style={{padding:'13px 16px'}}><RoleBadge role={u.role}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{padding:'10px 16px',borderTop:'1px solid var(--divider)',background:'var(--surface)'}}>
          <p style={{...MN,fontSize:10,color:'var(--text-dim)'}}>{filtered.length} user{filtered.length!==1?'s':''} shown · Click any row to open profile</p>
        </div>
      </div>

      {selectedUser && (
        <ProfilePanel user={selectedUser} myProfile={myProfile} pendingEditUids={pendingEditUids}
          onClose={()=>setSelectedUser(null)} showToast={showToast}
          onEditProfile={t=>{setEditProfileTarget(t);setSelectedUser(null);}}
          onEditName={t=>{setEditNameTarget(t);setSelectedUser(null);}}
        />
      )}
      {editProfileTarget && (
        <EditProfileModal uid={editProfileTarget.uid} profile={editProfileTarget.profile}
          targetUid={editProfileTarget.uid} targetProfile={editProfileTarget.profile}
          onClose={()=>setEditProfileTarget(null)} onSaved={()=>setEditProfileTarget(null)} />
      )}
      {editNameTarget && (
        <EditNameModal targetUid={editNameTarget.uid} targetProfile={editNameTarget.profile}
          onClose={()=>setEditNameTarget(null)} />
      )}
      {auditOpen       && <AuditModal logs={auditLogs} onClose={()=>setAuditOpen(false)} />}
      {staffInviteOpen && <StaffInviteModal invites={staffInvites} myProfile={myProfile} onClose={()=>setStaffInviteOpen(false)} showToast={showToast} />}

      {toast && (
        <div style={{position:'fixed',bottom:24,right:24,zIndex:9999,padding:'12px 20px',borderRadius:10,boxShadow:'0 8px 24px rgba(0,0,0,0.3)',...MN,fontSize:12,letterSpacing:'0.06em',
          background:toast.ok?'var(--green-soft)':'var(--red-soft)',
          border:`1px solid ${toast.ok?'var(--green-border)':'var(--red-border)'}`,
          color:toast.ok?'var(--green)':'var(--red)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
