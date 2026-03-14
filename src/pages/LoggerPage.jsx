// src/pages/LoggerPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, where, onSnapshot, getDocs, limit,
  addDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useLibrarySession } from '../context/LibrarySessionContext';
import ConfirmDialog from '../components/shared/ConfirmDialog';

const S = { fontFamily: "'IBM Plex Mono', monospace" };
const D = { fontFamily: "'Playfair Display', serif" };

const PURPOSES = ['Study / Review','Borrow / Return Books','Research','Use Computer','Group Study','Other'];

const TEMPLATES = [
  { id: 'inquiry', label: 'General Inquiry',      text: 'You have an inquiry at the library counter. Please proceed when available.' },
  { id: 'lost',    label: 'Lost Item Found',       text: 'A lost item may belong to you. Please come to the counter to claim it.' },
  { id: 'overdue', label: 'Overdue Book Reminder', text: 'You have an overdue book. Please return it at the counter as soon as possible.' },
  { id: 'borrow',  label: 'Borrow Ready',          text: 'Your book borrow request has been processed. Please come to the counter to collect it.' },
  { id: 'penalty', label: 'Penalty Notice',        text: 'There is a pending penalty on your account. Please settle it at the counter.' },
  { id: 'custom',  label: 'Custom Message',        text: '' },
];

function formatHHMM(seconds) {
  if (!seconds || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatReadable(seconds) {
  if (!seconds || seconds < 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}hr`;
  return `${h}hr ${m}m`;
}

function calcDurationSecs(entry, exit) {
  const e = entry?.toDate ? entry.toDate() : entry ? new Date(entry) : null;
  const x = exit?.toDate  ? exit.toDate()  : exit  ? new Date(exit)  : null;
  if (!e || !x) return null;
  return Math.max(0, Math.floor((x - e) / 1000));
}

function inRange(ts, preset) {
  if (preset === 'all') return true;
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  if (!d) return false;
  const now = new Date();
  if (preset === 'today') return d.toDateString() === now.toDateString();
  const cutoff = new Date();
  if (preset === 'week')  { cutoff.setDate(cutoff.getDate() - 7);  return d >= cutoff; }
  if (preset === 'month') { cutoff.setDate(cutoff.getDate() - 30); return d >= cutoff; }
  return true;
}

function exportHistoryCSV(rows, userMap) {
  const fmtDt = ts => { if (!ts) return '—'; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' }); };
  const headers = ['Student','ID Number','Course','Purpose','Entry','Exit','Duration','Status'];
  const data = rows.map(r => {
    const u = userMap[r.uid];
    const secs = calcDurationSecs(r.entryTime, r.exitTime);
    return [
      u ? `${u.lastName}, ${u.firstName}` : '—', u?.idNumber ?? '—', u?.course ?? '—',
      r.purpose ?? '—', fmtDt(r.entryTime), fmtDt(r.exitTime),
      secs != null ? formatReadable(secs) : '—',
      r.forcedLogout ? 'Force-Exited' : 'Exited',
    ];
  });
  const csv = [headers, ...data].map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: 'library-visit-history.csv' }).click();
  URL.revokeObjectURL(url);
}

function LiveDuration({ entryTime }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const tick = () => {
      const date = entryTime?.toDate?.();
      if (!date) { setSecs(0); return; }
      setSecs(Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [entryTime]);
  return (
    <div>
      <span style={{ ...S, fontSize: '13px', color: '#e2e8f0', fontWeight: 600 }}>{formatHHMM(secs)}</span>
      <span style={{ ...S, display: 'block', fontSize: '10px', color: '#475569', marginTop: '1px' }}>{formatReadable(secs)}</span>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px 16px' }}>
      <p style={{ ...S, fontSize: '9px', letterSpacing: '0.18em', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</p>
      <p style={{ ...D, fontSize: '26px', fontWeight: 700, color: '#f1f5f9' }}>{value}</p>
    </div>
  );
}

// ── Call to Counter modal ────────────────────────────────────────────────────
function CallModal({ student, sentByName, sentByUid, onClose }) {
  const [templateId, setTemplateId] = useState('');
  const [customMsg,  setCustomMsg]  = useState('');
  const [sending,    setSending]    = useState(false);
  const [sent,       setSent]       = useState(false);

  const selectedTemplate = TEMPLATES.find(t => t.id === templateId);
  const finalMessage = templateId === 'custom' ? customMsg : (selectedTemplate?.text ?? '');

  const handleSend = async () => {
    if (!finalMessage.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        toUid: student.uid, toName: student.displayName,
        message: finalMessage.trim(), templateId,
        templateLabel: selectedTemplate?.label ?? 'Custom',
        sentBy: sentByUid, sentByName, sentAt: serverTimestamp(),
        resolved: false, acknowledged: false, followUp: false,
      });
      setSent(true);
      setTimeout(onClose, 1200);
    } catch (e) { console.error(e); }
    setSending(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: '#0d1e36', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        {/* Gold stripe */}
        <div style={{ height: '2px', background: 'linear-gradient(90deg, #f59e0b, #d97706)' }} />
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ ...S, fontSize: '9px', letterSpacing: '0.2em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '4px' }}>Call to Counter</p>
            <h2 style={{ ...D, fontSize: '17px', fontWeight: 700, color: '#f1f5f9' }}>{student.displayName}</h2>
            {student.idNumber && <p style={{ ...S, fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{student.idNumber}</p>}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>✕</button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sent ? (
            <p style={{ ...S, fontSize: '12px', color: '#34d399', textAlign: 'center', padding: '16px 0' }}>✓ Notification sent.</p>
          ) : (
            <>
              <div>
                <label style={{ ...S, fontSize: '9px', letterSpacing: '0.18em', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Message Template</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {TEMPLATES.map(t => (
                    <button key={t.id} type="button" onClick={() => { setTemplateId(t.id); setCustomMsg(''); }}
                      style={{
                        padding: '9px 10px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                        background: templateId === t.id ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${templateId === t.id ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                      <p style={{ ...S, fontSize: '10px', fontWeight: 600, color: templateId === t.id ? '#f59e0b' : '#94a3b8' }}>{t.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {templateId && (
                <div>
                  <label style={{ ...S, fontSize: '9px', letterSpacing: '0.18em', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                    {templateId === 'custom' ? 'Your Message' : 'Message Preview'}
                  </label>
                  {templateId === 'custom' ? (
                    <textarea className="input" style={{ resize: 'none', height: '80px' }}
                      placeholder="Type your message here…"
                      value={customMsg} onChange={e => setCustomMsg(e.target.value)} maxLength={300} />
                  ) : (
                    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '12px 14px' }}>
                      <p style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>{finalMessage}</p>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button onClick={onClose} disabled={sending}
                  style={{ ...S, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '9px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleSend} disabled={sending || !templateId || (templateId === 'custom' && !customMsg.trim())}
                  style={{ ...S, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, padding: '9px 18px', borderRadius: '8px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)', color: '#f59e0b', cursor: 'pointer', opacity: (sending || !templateId || (templateId === 'custom' && !customMsg.trim())) ? 0.4 : 1 }}>
                  {sending ? 'Sending…' : 'Send →'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared input/select style ────────────────────────────────────────────────
const inputSt = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px', padding: '9px 13px', fontSize: '13px', color: '#e2e8f0',
  fontFamily: 'inherit', outline: 'none',
};

export default function LoggerPage() {
  const { userProfile, currentUser } = useAuth();
  const { session, elapsed, checkIn, checkOut, forceCheckOut } = useLibrarySession();
  const navigate = useNavigate();

  const [purpose,      setPurpose]      = useState('');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [liveSessions, setLiveSessions] = useState([]);
  const [userMap,      setUserMap]      = useState({});
  const [confirm,      setConfirm]      = useState(null);
  const [activeTab,    setActiveTab]    = useState('live');
  const [callTarget,   setCallTarget]   = useState(null);
  const [activeNotifMap, setActiveNotifMap] = useState({});

  const [logSearch,  setLogSearch]  = useState('');
  const [logPurpose, setLogPurpose] = useState('');
  const [logCourse,  setLogCourse]  = useState('');

  const [history,     setHistory]     = useState([]);
  const [histLoaded,  setHistLoaded]  = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [histSearch,  setHistSearch]  = useState('');
  const [histPurpose, setHistPurpose] = useState('');
  const [histCourse,  setHistCourse]  = useState('');
  const [histDate,    setHistDate]    = useState('all');
  const [histStatus,  setHistStatus]  = useState('all');

  const isStaff = userProfile?.role === 'staff' || userProfile?.role === 'admin';

  useEffect(() => {
    if (!isStaff) return;
    return onSnapshot(query(collection(db, 'logger'), where('active', '==', true)),
      snap => setLiveSessions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [isStaff]);

  useEffect(() => {
    if (!isStaff) return;
    return onSnapshot(query(collection(db, 'notifications'), where('resolved', '==', false)), snap => {
      const map = {};
      snap.docs.forEach(d => { map[d.data().toUid] = true; });
      setActiveNotifMap(map);
    });
  }, [isStaff]);

  useEffect(() => {
    if (!isStaff) return;
    return onSnapshot(collection(db, 'users'), snap => {
      const map = {};
      snap.forEach(d => { map[d.id] = d.data(); });
      setUserMap(map);
    });
  }, [isStaff]);

  useEffect(() => {
    if (!isStaff || activeTab !== 'history' || histLoaded) return;
    setHistLoading(true);
    getDocs(query(collection(db, 'logger'), where('active', '==', false), limit(300)))
      .then(snap => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.entryTime?.toDate?.() ?? new Date(0)) - (a.entryTime?.toDate?.() ?? new Date(0)));
        setHistory(rows);
        setHistLoaded(true);
      })
      .catch(console.error)
      .finally(() => setHistLoading(false));
  }, [isStaff, activeTab, histLoaded]);

  const handleCheckIn = async () => {
    if (!purpose) { setError('Please select a purpose of visit.'); return; }
    setError(''); setLoading(true);
    try { await checkIn(purpose); }
    catch { setError('Failed to check in. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    try { await checkOut(); setPurpose(''); }
    catch { setError('Failed to check out. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleForceOut = (sessionId, name) => {
    setConfirm({
      title: 'Force Log Out', message: `Log out ${name || 'this student'} from the library?`,
      confirmLabel: 'Log Out', confirmStyle: 'danger',
      onConfirm: async () => { setConfirm(null); await forceCheckOut(sessionId); },
      onCancel: () => setConfirm(null),
    });
  };

  const fmtDt = ts => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' });
  };

  const sentByName = userProfile ? `${userProfile.firstName ?? ''} ${userProfile.lastName ?? ''}`.trim() : '';

  // ── STAFF / ADMIN VIEW ───────────────────────────────────────────────────
  if (isStaff) {
    const uniquePurposes = [...new Set(liveSessions.map(s => s.purpose).filter(Boolean))].sort();
    const uniqueCourses  = [...new Set(liveSessions.map(s => userMap[s.uid]?.course).filter(Boolean))].sort();
    const histPurposes   = [...new Set(history.map(r => r.purpose).filter(Boolean))].sort();
    const histCourses    = [...new Set(history.map(r => userMap[r.uid]?.course).filter(Boolean))].sort();

    const filteredLive = liveSessions.filter(s => {
      const u = userMap[s.uid];
      const name = u ? `${u.lastName} ${u.firstName}`.toLowerCase() : '';
      return (
        (!logSearch  || name.includes(logSearch.toLowerCase()) || (u?.idNumber || '').includes(logSearch)) &&
        (!logPurpose || s.purpose === logPurpose) &&
        (!logCourse  || (u?.course ?? '') === logCourse)
      );
    });

    const filteredHistory = history.filter(r => {
      const u = userMap[r.uid];
      const name = u ? `${u.lastName} ${u.firstName}`.toLowerCase() : '';
      return (
        (!histSearch  || name.includes(histSearch.toLowerCase()) || (u?.idNumber || '').includes(histSearch)) &&
        (!histPurpose || r.purpose === histPurpose) &&
        (!histCourse  || (u?.course ?? '') === histCourse) &&
        inRange(r.entryTime, histDate) &&
        (histStatus === 'all' || (histStatus === 'forced' ? r.forcedLogout : !r.forcedLogout))
      );
    });

    const avgDuration = (() => {
      const durations = history.map(r => calcDurationSecs(r.entryTime, r.exitTime)).filter(d => d != null && d > 0);
      if (!durations.length) return '—';
      return formatReadable(Math.round(durations.reduce((a, b) => a + b, 0) / durations.length));
    })();

    // Shared table container style
    const tableWrap = { borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' };
    const thSt = { ...S, fontSize: '9px', letterSpacing: '0.16em', color: '#475569', textTransform: 'uppercase', padding: '12px 14px', textAlign: 'left', background: '#060e1e', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' };
    const tdSt = { padding: '12px 14px', fontSize: '13px', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.05)' };

    return (
      <div style={{ animation: 'fadeSlideUp 0.4s ease both' }}>
        <style>{`
          @keyframes fadeSlideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
          @keyframes pulse-dot   { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
          tr.log-row:hover td { background: rgba(255,255,255,0.03) !important; }
        `}</style>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ ...S, fontSize: '9px', letterSpacing: '0.22em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '6px' }}>Attendance</p>
          <h1 style={{ ...D, fontSize: 'clamp(22px,4vw,30px)', fontWeight: 700, color: '#f1f5f9' }}>Library Logger</h1>
          <div style={{ marginTop: '16px', height: '1px', background: 'linear-gradient(90deg, #f59e0b22, #f59e0b44, transparent)' }} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0' }}>
          {[
            { key: 'live',    label: 'Live Now',      badge: liveSessions.length, pulse: true },
            { key: 'history', label: 'Visit History', badge: histLoaded ? history.length : null },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 18px', borderBottom: `2px solid ${activeTab === tab.key ? '#f59e0b' : 'transparent'}`,
                marginBottom: '-1px', background: 'none', border: 'none', cursor: 'pointer',
                borderBottomWidth: '2px', borderBottomStyle: 'solid',
                borderBottomColor: activeTab === tab.key ? '#f59e0b' : 'transparent',
                display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
              }}>
              {tab.pulse && (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse-dot 1.5s infinite' }} />
              )}
              <span style={{ ...S, fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: activeTab === tab.key ? 700 : 400, color: activeTab === tab.key ? '#f59e0b' : '#475569' }}>
                {tab.label}
              </span>
              {tab.badge != null && (
                <span style={{ ...S, fontSize: '9px', fontWeight: 700, padding: '1px 7px', borderRadius: '20px', background: activeTab === tab.key ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)', color: activeTab === tab.key ? '#f59e0b' : '#64748b' }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── LIVE NOW ── */}
        {activeTab === 'live' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse-dot 1.5s infinite' }} />
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                  <strong style={{ color: '#e2e8f0' }}>{liveSessions.length}</strong> student{liveSessions.length !== 1 ? 's' : ''} currently in library
                </span>
                {filteredLive.length !== liveSessions.length && (
                  <span style={{ ...S, fontSize: '10px', color: '#475569' }}>— showing {filteredLive.length}</span>
                )}
              </div>
              {liveSessions.filter(s => s.webSignedOut).length > 0 && (
                <span style={{ ...S, fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: '20px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}>
                  {liveSessions.filter(s => s.webSignedOut).length} web signed out
                </span>
              )}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <input className="input" style={{ flex: '1 1 200px', minWidth: '180px' }}
                placeholder="Search by name or ID…" value={logSearch} onChange={e => setLogSearch(e.target.value)} />
              <select className="select" style={{ minWidth: '160px' }} value={logPurpose} onChange={e => setLogPurpose(e.target.value)}>
                <option value="">— All Purposes —</option>
                {uniquePurposes.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select className="select" style={{ minWidth: '150px' }} value={logCourse} onChange={e => setLogCourse(e.target.value)}>
                <option value="">— All Courses —</option>
                {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {(logSearch || logPurpose || logCourse) && (
                <button onClick={() => { setLogSearch(''); setLogPurpose(''); setLogCourse(''); }}
                  style={{ ...S, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '9px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b', cursor: 'pointer' }}>
                  Clear
                </button>
              )}
            </div>

            {/* Live table */}
            <div style={tableWrap}>
              {liveSessions.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <p style={{ ...S, fontSize: '12px', color: '#334155' }}>No students currently in the library.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Student','ID Number','Course','Purpose','Entry Time','Duration','Actions'].map(h => (
                          <th key={h} style={thSt}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLive.length === 0 ? (
                        <tr><td colSpan={7} style={{ ...tdSt, textAlign: 'center', color: '#334155', ...S, fontSize: '11px', padding: '24px' }}>No students match your filters.</td></tr>
                      ) : filteredLive.map(s => {
                        const user = userMap[s.uid];
                        const name = user ? `${user.lastName}, ${user.firstName}` : '—';
                        const entryDate = s.entryTime?.toDate?.();
                        return (
                          <tr key={s.id} className="log-row">
                            <td style={tdSt}>
                              <button
                                onClick={() => navigate('/staff/students', { state: { openStudentId: s.uid } })}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontSize: '13px', fontWeight: 600, textAlign: 'left', padding: 0, textDecoration: 'none' }}
                                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
                                {name}
                              </button>
                              {s.webSignedOut && (
                                <span style={{ ...S, fontSize: '8px', letterSpacing: '0.1em', textTransform: 'uppercase', marginLeft: '8px', padding: '2px 7px', borderRadius: '20px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', verticalAlign: 'middle' }}>
                                  Web Signed Out
                                </span>
                              )}
                            </td>
                            <td style={{ ...tdSt, ...S, fontSize: '11px', color: '#94a3b8' }}>{user?.idNumber ?? '—'}</td>
                            <td style={{ ...tdSt, fontSize: '12px', color: '#94a3b8' }}>{user?.course ?? '—'}</td>
                            <td style={tdSt}>
                              <span style={{ ...S, fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: '20px', background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.2)', color: '#94a3b8' }}>
                                {s.purpose}
                              </span>
                            </td>
                            <td style={{ ...tdSt, ...S, fontSize: '12px', color: '#94a3b8' }}>
                              {entryDate ? entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            <td style={tdSt}><LiveDuration entryTime={s.entryTime} /></td>
                            <td style={tdSt}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {activeNotifMap[s.uid] ? (
                                  <span style={{ ...S, fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: '8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}>
                                    Notified
                                  </span>
                                ) : (
                                  <button onClick={() => setCallTarget({ uid: s.uid, displayName: name, idNumber: user?.idNumber ?? '' })}
                                    style={{ ...S, fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, padding: '5px 12px', borderRadius: '8px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', cursor: 'pointer' }}>
                                    Call
                                  </button>
                                )}
                                <button onClick={() => handleForceOut(s.id, name)}
                                  style={{ ...S, fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, padding: '5px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', cursor: 'pointer' }}>
                                  Log Out
                                </button>
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
          </>
        )}

        {/* ── VISIT HISTORY ── */}
        {activeTab === 'history' && (
          <>
            {!histLoading && history.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: '12px', marginBottom: '20px' }}>
                <MiniStat label="Total Visits" value={history.length} />
                <MiniStat label="Today" value={history.filter(r => inRange(r.entryTime, 'today')).length} />
                <MiniStat label="This Week" value={history.filter(r => inRange(r.entryTime, 'week')).length} />
                <MiniStat label="Avg Duration" value={avgDuration} />
              </div>
            )}

            {/* History filters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <input className="input" style={{ flex: '1 1 200px' }}
                  placeholder="Search by name or ID…" value={histSearch} onChange={e => setHistSearch(e.target.value)} />
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[['all','All Time'],['today','Today'],['week','This Week'],['month','This Month']].map(([val,lbl]) => (
                    <button key={val} onClick={() => setHistDate(val)}
                      style={{
                        ...S, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: histDate === val ? 700 : 400,
                        padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s',
                        background: histDate === val ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${histDate === val ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        color: histDate === val ? '#f59e0b' : '#64748b',
                      }}>{lbl}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="select" style={{ flex: '1 1 150px' }} value={histPurpose} onChange={e => setHistPurpose(e.target.value)}>
                  <option value="">— All Purposes —</option>
                  {histPurposes.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select className="select" style={{ flex: '1 1 150px' }} value={histCourse} onChange={e => setHistCourse(e.target.value)}>
                  <option value="">— All Courses —</option>
                  {histCourses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="select" style={{ minWidth: '150px' }} value={histStatus} onChange={e => setHistStatus(e.target.value)}>
                  <option value="all">— All Exits —</option>
                  <option value="exited">Normal Exit</option>
                  <option value="forced">Force-Exited</option>
                </select>
                <button onClick={() => exportHistoryCSV(filteredHistory, userMap)}
                  style={{ ...S, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, padding: '9px 16px', borderRadius: '8px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', cursor: 'pointer', marginLeft: 'auto' }}>
                  Export CSV
                </button>
                {(histSearch || histPurpose || histCourse || histStatus !== 'all' || histDate !== 'all') && (
                  <button onClick={() => { setHistSearch(''); setHistPurpose(''); setHistCourse(''); setHistStatus('all'); setHistDate('all'); }}
                    style={{ ...S, fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '9px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', cursor: 'pointer' }}>
                    Clear
                  </button>
                )}
              </div>
              {histLoaded && (
                <p style={{ ...S, fontSize: '10px', color: '#334155' }}>
                  Showing <strong style={{ color: '#94a3b8' }}>{filteredHistory.length}</strong> of {history.length} visits
                </p>
              )}
            </div>

            {/* History table */}
            <div style={tableWrap}>
              {histLoading ? (
                <p style={{ ...S, fontSize: '11px', color: '#334155', padding: '24px', textAlign: 'center' }}>Loading visit history…</p>
              ) : history.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <p style={{ ...S, fontSize: '12px', color: '#334155' }}>No completed visits yet.</p>
                </div>
              ) : filteredHistory.length === 0 ? (
                <p style={{ ...S, fontSize: '11px', color: '#334155', padding: '24px', textAlign: 'center' }}>No visits match your filters.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Student','ID Number','Course','Purpose','Entry','Exit','Duration','Status'].map(h => (
                          <th key={h} style={thSt}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.map(r => {
                        const u = userMap[r.uid];
                        const secs = calcDurationSecs(r.entryTime, r.exitTime);
                        return (
                          <tr key={r.id} className="log-row">
                            <td style={tdSt}>
                              <button onClick={() => navigate('/staff/students', { state: { openStudentId: r.uid } })}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontSize: '13px', fontWeight: 600, textAlign: 'left', padding: 0 }}
                                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
                                {u ? `${u.lastName}, ${u.firstName}` : '—'}
                              </button>
                            </td>
                            <td style={{ ...tdSt, ...S, fontSize: '11px', color: '#94a3b8' }}>{u?.idNumber ?? '—'}</td>
                            <td style={{ ...tdSt, fontSize: '12px', color: '#94a3b8' }}>{u?.course ?? '—'}</td>
                            <td style={tdSt}>
                              <span style={{ ...S, fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: '20px', background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.2)', color: '#94a3b8' }}>
                                {r.purpose}
                              </span>
                            </td>
                            <td style={{ ...tdSt, ...S, fontSize: '11px', color: '#94a3b8' }}>{fmtDt(r.entryTime)}</td>
                            <td style={{ ...tdSt, ...S, fontSize: '11px', color: '#94a3b8' }}>{fmtDt(r.exitTime)}</td>
                            <td style={{ ...tdSt, ...S, fontSize: '11px', color: '#94a3b8' }}>{secs != null ? formatReadable(secs) : '—'}</td>
                            <td style={tdSt}>
                              {r.forcedLogout
                                ? <span style={{ ...S, fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: '20px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>Force-Exited</span>
                                : <span style={{ ...S, fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: '20px', background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.15)', color: '#64748b' }}>Exited</span>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {callTarget && (
          <CallModal student={callTarget} sentByName={sentByName} sentByUid={currentUser?.uid} onClose={() => setCallTarget(null)} />
        )}
        {confirm && (
          <ConfirmDialog title={confirm.title} message={confirm.message}
            confirmLabel={confirm.confirmLabel} confirmStyle={confirm.confirmStyle}
            onConfirm={confirm.onConfirm} onCancel={confirm.onCancel} />
        )}
      </div>
    );
  }

  // ── STUDENT VIEW ─────────────────────────────────────────────────────────
  return (
    <div style={{ animation: 'fadeSlideUp 0.4s ease both' }}>
      <style>{`@keyframes fadeSlideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`}</style>

      <div style={{ marginBottom: '24px' }}>
        <p style={{ ...S, fontSize: '9px', letterSpacing: '0.22em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '6px' }}>Attendance</p>
        <h1 style={{ ...D, fontSize: 'clamp(22px,4vw,30px)', fontWeight: 700, color: '#f1f5f9' }}>Library Logger</h1>
        <div style={{ marginTop: '16px', height: '1px', background: 'linear-gradient(90deg, #f59e0b22, #f59e0b44, transparent)' }} />
      </div>

      {/* Student identity card */}
      {userProfile && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ borderLeft: '3px solid #f59e0b', paddingLeft: '14px' }}>
            <p style={{ ...S, fontSize: '10px', letterSpacing: '0.15em', color: '#64748b', marginBottom: '4px' }}>{userProfile.idNumber}</p>
            <p style={{ ...D, fontSize: '20px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' }}>
              {userProfile.lastName}, {userProfile.firstName}{userProfile.middleInitial ? ` ${userProfile.middleInitial}.` : ''}
            </p>
            {userProfile.course && (
              <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                {userProfile.course}{userProfile.yearLevel ? ` — ${userProfile.yearLevel}` : ''}
              </p>
            )}
            {userProfile.college && <p style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>{userProfile.college}</p>}
          </div>
          <div style={{ flexShrink: 0 }}>
            {session === undefined ? (
              <span style={{ ...S, fontSize: '9px', color: '#475569' }}>…</span>
            ) : session ? (
              <span style={{ ...S, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: '20px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>In Library</span>
            ) : (
              <span style={{ ...S, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: '20px', background: 'rgba(100,116,139,0.12)', border: '1px solid rgba(100,116,139,0.2)', color: '#64748b' }}>Not Checked In</span>
            )}
          </div>
        </div>
      )}

      {/* Active session */}
      {session && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderLeft: '3px solid #f59e0b', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
          <p style={{ ...S, fontSize: '9px', letterSpacing: '0.18em', color: '#64748b', textTransform: 'uppercase', marginBottom: '16px' }}>Active Session</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ ...S, fontSize: '10px', letterSpacing: '0.15em', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Time in Library</p>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '44px', fontWeight: 600, color: '#f59e0b', lineHeight: 1, letterSpacing: '0.08em', textShadow: '0 0 30px rgba(245,158,11,0.2)' }}>
                {formatHHMM(elapsed)}
              </p>
              <p style={{ ...S, fontSize: '11px', color: '#475569', marginTop: '4px' }}>{formatReadable(elapsed)} in library</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ ...S, fontSize: '9px', letterSpacing: '0.15em', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Entry Time</p>
              <p style={{ ...S, fontSize: '16px', fontWeight: 600, color: '#e2e8f0' }}>
                {session.entryTime?.toDate?.() ? session.entryTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </p>
              <p style={{ ...S, fontSize: '9px', letterSpacing: '0.15em', color: '#64748b', textTransform: 'uppercase', marginTop: '10px', marginBottom: '4px' }}>Purpose</p>
              <p style={{ fontSize: '13px', color: '#94a3b8' }}>{session.purpose}</p>
            </div>
          </div>
          <button onClick={handleCheckOut} disabled={loading}
            style={{ width: '100%', padding: '13px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171', cursor: loading ? 'not-allowed' : 'pointer', ...S, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, opacity: loading ? 0.6 : 1, transition: 'all 0.15s' }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(239,68,68,0.25)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}>
            {loading ? 'Logging out…' : 'Log Out of Library'}
          </button>
        </div>
      )}

      {/* Check-in form */}
      {session === null && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
          <p style={{ ...S, fontSize: '9px', letterSpacing: '0.18em', color: '#64748b', textTransform: 'uppercase', marginBottom: '16px' }}>Library Check-In</p>
          {error && (
            <div style={{ marginBottom: '14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '10px 14px' }}>
              <p style={{ ...S, fontSize: '11px', color: '#f87171' }}>{error}</p>
            </div>
          )}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ ...S, fontSize: '9px', letterSpacing: '0.18em', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Purpose of Visit</label>
            <select className="select" value={purpose} onChange={e => { setPurpose(e.target.value); setError(''); }}>
              <option value="">— Select Purpose —</option>
              {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <button onClick={handleCheckIn} disabled={loading}
            style={{ width: '100%', padding: '13px', borderRadius: '10px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', color: '#34d399', cursor: loading ? 'not-allowed' : 'pointer', ...S, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, opacity: loading ? 0.6 : 1, transition: 'all 0.15s' }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(16,185,129,0.25)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.15)'}>
            {loading ? 'Checking in…' : 'Log In to Library'}
          </button>
        </div>
      )}

      {session === undefined && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '32px', textAlign: 'center', marginBottom: '16px' }}>
          <p style={{ ...S, fontSize: '11px', color: '#334155' }}>Loading session…</p>
        </div>
      )}
    </div>
  );
}
