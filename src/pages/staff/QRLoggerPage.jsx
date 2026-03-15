// src/pages/staff/QRLoggerPage.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  collection, query, where, getDocs, addDoc, updateDoc,
  doc, onSnapshot, serverTimestamp, limit,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { VISIT_PURPOSES } from '../../data/colleges';

const MONO  = { fontFamily: "'IBM Plex Mono', monospace" };
const SERIF = { fontFamily: "'Playfair Display', serif" };

function fmtTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}
function formatDur(entryTs) {
  if (!entryTs) return '—';
  const d    = entryTs.toDate ? entryTs.toDate() : new Date(entryTs);
  const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  const h    = Math.floor(secs / 3600);
  const m    = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function formatId(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `${d.slice(0,2)}-${d.slice(2)}`;
  return `${d.slice(0,2)}-${d.slice(2,7)}-${d.slice(7)}`;
}
function LiveDur({ entryTime }) {
  const [dur, setDur] = useState('—');
  useEffect(() => {
    const tick = () => setDur(formatDur(entryTime));
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [entryTime]);
  return <span>{dur}</span>;
}

// ── Purpose Modal ─────────────────────────────────────────────────────────────
function PurposeModal({ student, idNumber, onConfirm, onCancel, loading }) {
  const [chosen, setChosen] = useState('');
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && !loading) onCancel(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, padding: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(6px)',
        animation: 'fadeIn 0.18s ease both',
      }}
    >
      <div style={{
        width: '100%', maxWidth: '440px', borderRadius: '20px', overflow: 'hidden',
        background: 'var(--card)', border: '1px solid var(--gold-border)',
        boxShadow: 'var(--shadow-modal)',
        animation: 'slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1) both',
      }}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg, var(--gold), transparent)' }} />
        <div style={{ padding: '28px' }}>
          {/* Student card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '12px', background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', marginBottom: '22px' }}>
            <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3.33 1.67 8.67 1.67 12 0v-5"/></svg></div>
            <div>
              <p style={{ ...MONO, fontSize: '8px', letterSpacing: '0.2em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '3px' }}>QR Check-In</p>
              <p style={{ ...SERIF, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{student.lastName}, {student.firstName}</p>
              <p style={{ ...MONO, fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{idNumber}</p>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>Select purpose of visit:</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '22px' }}>
            {VISIT_PURPOSES.map(p => {
              const active = chosen === p;
              return (
                <button key={p} type="button" onClick={() => setChosen(p)}
                  style={{
                    padding: '11px 10px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    background: active ? 'var(--green-soft)' : 'var(--surface)',
                    border: `1px solid ${active ? 'var(--green-border)' : 'var(--card-border)'}`,
                    transform: active ? 'scale(1.02)' : 'scale(1)',
                  }}>
                  <p style={{ ...MONO, fontSize: '10px', letterSpacing: '0.07em', color: active ? 'var(--green)' : 'var(--text-body)', fontWeight: active ? 700 : 500, margin: 0 }}>{p}</p>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onCancel} disabled={loading}
              style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--surface)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, ...MONO, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', transition: 'all 0.15s' }}>
              Cancel
            </button>
            <button onClick={() => chosen && !loading && onConfirm(chosen)} disabled={!chosen || loading}
              style={{ flex: 2, padding: '12px', borderRadius: '10px', transition: 'all 0.15s', background: chosen ? 'var(--green-soft)' : 'var(--surface)', border: `1px solid ${chosen ? 'var(--green-border)' : 'var(--card-border)'}`, color: chosen ? 'var(--green)' : 'var(--text-dim)', cursor: !chosen || loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, ...MONO, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
              {loading ? 'Checking In…' : 'Confirm Check-In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Scan Toast ────────────────────────────────────────────────────────────────
function ScanToast({ scan, status }) {
  if (!scan || status === 'idle') return null;
  if (status === 'processing') return (
    <div style={{ borderRadius: '12px', padding: '14px 18px', background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
      <span style={{ ...MONO, fontSize: '14px', color: 'var(--gold)', animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>↻</span>
      <p style={{ ...MONO, fontSize: '11px', color: 'var(--gold)' }}>Processing scan…</p>
    </div>
  );
  if (status === 'unknown') return (
    <div style={{ borderRadius: '12px', padding: '14px 18px', background: 'var(--red-soft)', border: '1px solid var(--red-border)', marginBottom: '12px' }}>
      <p style={{ ...MONO, fontSize: '11px', color: 'var(--red)' }}>No account found for: {scan.idNumber}</p>
    </div>
  );
  if (status === 'success') {
    const isIn = scan.action === 'in';
    return (
      <div style={{ borderRadius: '12px', padding: '14px 18px', marginBottom: '12px', background: isIn ? 'var(--green-soft)' : 'var(--blue-soft)', border: `1px solid ${isIn ? 'var(--green-border)' : 'var(--blue-border)'}`, display: 'flex', alignItems: 'center', gap: '14px', animation: 'fadeIn 0.2s ease both' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: isIn ? 'var(--green-soft)' : 'var(--blue-soft)', border: `1px solid ${isIn ? 'var(--green-border)' : 'var(--blue-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', color: isIn ? 'var(--green)' : 'var(--blue)' }}>
          {isIn ? '↓' : '↑'}
        </div>
        <div>
          <p style={{ ...SERIF, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{scan.student ? `${scan.student.lastName}, ${scan.student.firstName}` : scan.idNumber}</p>
          <p style={{ ...MONO, fontSize: '10px', color: isIn ? 'var(--green)' : 'var(--blue)', letterSpacing: '0.08em' }}>{isIn ? `Checked IN — ${scan.purpose}` : 'Checked OUT'}</p>
        </div>
      </div>
    );
  }
  return null;
}


const TEMPLATES = [
  { id: 'inquiry', label: 'General Inquiry',      text: 'You have an inquiry at the library counter. Please proceed when available.' },
  { id: 'lost',    label: 'Lost Item Found',       text: 'A lost item may belong to you. Please come to the counter to claim it.' },
  { id: 'overdue', label: 'Overdue Book Reminder', text: 'You have an overdue book. Please return it at the counter as soon as possible.' },
  { id: 'borrow',  label: 'Borrow Ready',          text: 'Your book borrow request has been processed. Please come to the counter to collect it.' },
  { id: 'penalty', label: 'Penalty Notice',        text: 'There is a pending penalty on your account. Please settle it at the counter.' },
  { id: 'custom',  label: 'Custom Message',        text: '' },
];

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
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', padding: '16px', animation: 'fadeIn 0.18s ease both' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: 'var(--card)', border: '1px solid var(--gold-border)', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-modal)', animation: 'slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--gold), transparent)' }} />
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ ...MONO, fontSize: '9px', letterSpacing: '0.2em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '4px' }}>Call to Counter</p>
            <h2 style={{ ...SERIF, fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>{student.displayName}</h2>
            {student.idNumber && <p style={{ ...MONO, fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{student.idNumber}</p>}
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: '8px', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sent ? (
            <p style={{ ...MONO, fontSize: '12px', color: 'var(--green)', textAlign: 'center', padding: '16px 0' }}>Notification sent.</p>
          ) : (
            <>
              <div>
                <label style={{ ...MONO, fontSize: '9px', letterSpacing: '0.18em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Message Template</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {TEMPLATES.map(t => (
                    <button key={t.id} type="button" onClick={() => { setTemplateId(t.id); setCustomMsg(''); }}
                      style={{ padding: '9px 10px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s', background: templateId === t.id ? 'var(--gold-soft)' : 'var(--surface)', border: `1px solid ${templateId === t.id ? 'var(--gold-border)' : 'var(--card-border)'}` }}>
                      <p style={{ ...MONO, fontSize: '10px', fontWeight: 600, color: templateId === t.id ? 'var(--gold)' : 'var(--text-muted)', margin: 0 }}>{t.label}</p>
                    </button>
                  ))}
                </div>
              </div>
              {templateId && (
                <div>
                  <label style={{ ...MONO, fontSize: '9px', letterSpacing: '0.18em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                    {templateId === 'custom' ? 'Your Message' : 'Preview'}
                  </label>
                  {templateId === 'custom' ? (
                    <textarea style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', resize: 'none', height: '80px' }}
                      placeholder="Type your message…" value={customMsg} onChange={e => setCustomMsg(e.target.value)} maxLength={300} />
                  ) : (
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '12px 14px' }}>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{finalMessage}</p>
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button onClick={onClose} disabled={sending}
                  style={{ ...MONO, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '9px 16px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleSend} disabled={sending || !templateId || (templateId === 'custom' && !customMsg.trim())}
                  style={{ ...MONO, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, padding: '9px 18px', borderRadius: '8px', background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', color: 'var(--gold)', cursor: 'pointer', opacity: (sending || !templateId || (templateId === 'custom' && !customMsg.trim())) ? 0.4 : 1 }}>
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function QRLoggerPage() {
  const { userProfile } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();

  const scannerRef    = useRef(null);
  const unmountedRef  = useRef(false);
  const processingRef = useRef(false);
  const cooldownRef   = useRef({});

  const [scannerState, setScannerState] = useState('idle');
  const [scanError,    setScanError]    = useState('');
  const [lastScan,     setLastScan]     = useState(null);
  const [scanStatus,   setScanStatus]   = useState('idle');

  const [purposeForId, setPurposeForId] = useState(null);
  const [confirmLoad,  setConfirmLoad]  = useState(false);

  const [manualId,      setManualId]      = useState('');
  const [manualFormat,  setManualFormat]  = useState('');
  const [manualPurpose, setManualPurpose] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualMsg,     setManualMsg]     = useState(null);

  const [liveSessions,   setLiveSessions]   = useState([]);
  const [userMap,        setUserMap]        = useState({});
  const [search,         setSearch]         = useState('');
  const [callTarget,     setCallTarget]     = useState(null);
  const [activeNotifMap, setActiveNotifMap] = useState({});

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'logger'), where('active', '==', true)), snap => setLiveSessions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, 'users'), snap => { const m = {}; snap.forEach(d => { m[d.id] = d.data(); }); setUserMap(m); });
    const u3 = onSnapshot(query(collection(db, 'notifications'), where('resolved', '==', false)), snap => {
      const m = {}; snap.docs.forEach(d => { m[d.data().toUid] = { id: d.id, ...d.data() }; }); setActiveNotifMap(m);
    });
    return () => { u1(); u2(); u3(); };
  }, []);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      const sc = scannerRef.current;
      if (sc) {
        try { if (sc.isRunning()) sc.stop().catch(() => {}).finally(() => { try { sc.clear(); } catch {} }); else { try { sc.clear(); } catch {} } } catch {}
        scannerRef.current = null;
      }
    };
  }, []);

  const handleQrScan = useCallback(async (rawText) => {
    if (unmountedRef.current || processingRef.current) return;
    const raw         = rawText.trim();
    const isToken     = /^[a-f0-9]{32}$/i.test(raw);
    const lookupField = isToken ? 'qrToken' : 'idNumber';
    const lookupValue = isToken ? raw : formatId(raw);
    const now = Date.now();
    if (cooldownRef.current[lookupValue] && now - cooldownRef.current[lookupValue] < 5000) return;
    cooldownRef.current[lookupValue] = now;
    processingRef.current = true;
    setScanStatus('processing'); setLastScan({ idNumber: lookupValue });

    try {
      const userSnap = await getDocs(query(collection(db, 'users'), where(lookupField, '==', lookupValue), limit(1)));
      if (userSnap.empty) {
        setLastScan({ idNumber: lookupValue }); setScanStatus('unknown');
        setTimeout(() => { if (!unmountedRef.current) { setScanStatus('idle'); setLastScan(null); } }, 3500);
        processingRef.current = false; return;
      }
      const student  = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };
      const idNumber = student.idNumber;
      const sessSnap = await getDocs(query(collection(db, 'logger'), where('uid', '==', student.id), where('active', '==', true), limit(1)));

      if (!sessSnap.empty) {
        await updateDoc(doc(db, 'logger', sessSnap.docs[0].id), { active: false, exitTime: serverTimestamp() });
        if (!unmountedRef.current) { setLastScan({ idNumber, student, action: 'out' }); setScanStatus('success'); setTimeout(() => { if (!unmountedRef.current) { setScanStatus('idle'); setLastScan(null); } }, 3000); }
        processingRef.current = false;
      } else {
        // Show modal WITHOUT stopping the scanner — camera stays live
        if (!unmountedRef.current) { setScanStatus('idle'); setLastScan(null); setPurposeForId({ idNumber, student }); }
        processingRef.current = false;
      }
    } catch (err) {
      if (!unmountedRef.current) { setLastScan({ idNumber: lookupValue, error: err.message }); setScanStatus('error'); setTimeout(() => { if (!unmountedRef.current) { setScanStatus('idle'); setLastScan(null); } }, 3000); }
      processingRef.current = false;
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (unmountedRef.current) return;
    setScanError(''); setScannerState('starting');
    await new Promise(r => setTimeout(r, 150));
    if (unmountedRef.current) return;
    if (scannerRef.current) { try { if (scannerRef.current.isRunning()) await scannerRef.current.stop().catch(() => {}); scannerRef.current.clear(); } catch {} scannerRef.current = null; }
    const scanner = new Html5Qrcode('qr-staff-reader', { verbose: false });
    scannerRef.current = scanner;
    try {
      await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 }, disableFlip: false }, (text) => { try { handleQrScan(text); } catch {} }, () => {});
      if (!unmountedRef.current) setScannerState('active');
    } catch {
      if (!unmountedRef.current) { setScanError('Camera access denied. Allow camera permission and try again.'); setScannerState('idle'); }
      try { scanner.clear(); } catch {}
      if (scannerRef.current === scanner) scannerRef.current = null;
    }
  }, [handleQrScan]);

  const stopScanner = useCallback(async () => {
    setScannerState('stopping');
    const sc = scannerRef.current;
    if (sc) { try { if (sc.isRunning()) await sc.stop().catch(() => {}); sc.clear(); } catch {} scannerRef.current = null; }
    if (!unmountedRef.current) setScannerState('idle');
  }, []);

  const confirmCheckIn = async (purpose) => {
    if (!purposeForId) return;
    setConfirmLoad(true);
    const { idNumber, student } = purposeForId;
    try {
      await addDoc(collection(db, 'logger'), { uid: student.id, purpose, entryTime: serverTimestamp(), active: true, scannedBy: userProfile?.uid || null });
      if (!unmountedRef.current) {
        processingRef.current = false; cooldownRef.current = {};
        setPurposeForId(null); setConfirmLoad(false);
        setLastScan({ idNumber, student, action: 'in', purpose }); setScanStatus('success');
        setTimeout(() => { if (!unmountedRef.current) { setScanStatus('idle'); setLastScan(null); } }, 3000);
      }
    } catch { if (!unmountedRef.current) { setConfirmLoad(false); processingRef.current = false; } }
  };

  const handleFollowUp = async (notifId) => {
    try { await updateDoc(doc(db, 'notifications', notifId), { acknowledged: false, followUp: true }); }
    catch (e) { console.error(e); }
  };

  const handleResolve = async (notifId) => {
    try { await updateDoc(doc(db, 'notifications', notifId), { resolved: true }); }
    catch (e) { console.error(e); }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualId || !manualPurpose) return;
    setManualLoading(true); setManualMsg(null);
    try {
      const userSnap = await getDocs(query(collection(db, 'users'), where('idNumber', '==', manualId), limit(1)));
      if (userSnap.empty) { setManualMsg({ ok: false, text: `No account found for ID ${manualId}.` }); setManualLoading(false); return; }
      const student  = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };
      const sessSnap = await getDocs(query(collection(db, 'logger'), where('uid', '==', student.id), where('active', '==', true), limit(1)));
      if (!sessSnap.empty) {
        await updateDoc(doc(db, 'logger', sessSnap.docs[0].id), { active: false, exitTime: serverTimestamp() });
        setManualMsg({ ok: true, text: `${student.lastName}, ${student.firstName} checked OUT.` });
      } else {
        await addDoc(collection(db, 'logger'), { uid: student.id, purpose: manualPurpose, entryTime: serverTimestamp(), active: true, scannedBy: userProfile?.uid || null, manual: true });
        setManualMsg({ ok: true, text: `${student.lastName}, ${student.firstName} checked IN — ${manualPurpose}.` });
      }
      setManualId(''); setManualFormat(''); setManualPurpose('');
    } catch (err) { setManualMsg({ ok: false, text: `Error: ${err.message}` }); }
    setManualLoading(false);
    setTimeout(() => { if (!unmountedRef.current) setManualMsg(null); }, 5000);
  };

  const isScanning = scannerState === 'active' || scannerState === 'starting';
  const filteredSessions = search.trim()
    ? liveSessions.filter(s => { const u = userMap[s.uid]; if (!u) return false; const q = search.toLowerCase(); return `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) || u.idNumber?.toLowerCase().includes(q); })
    : liveSessions;

  const inputSt = { width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '9px', padding: '11px 14px', fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' };
  const onFoc = e => { e.currentTarget.style.borderColor = 'var(--gold)'; };
  const onBlr = e => { e.currentTarget.style.borderColor = 'var(--input-border)'; };

  return (
    <div style={{ animation: 'fadeUp 0.3s ease both', paddingBottom: '48px' }}>
      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(24px) scale(0.97)} to{opacity:1;transform:none} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        #qr-staff-reader video { border-radius:10px!important; width:100%!important; }
        #qr-staff-reader img   { display:none!important; }
        #qr-staff-reader       { width:100%!important; }
        .qr-layout { display:grid; grid-template-columns:minmax(300px,420px) 1fr; gap:24px; align-items:start; }
        @media(max-width:860px){ .qr-layout{ grid-template-columns:1fr!important; } }
        .qr-row:hover { background: var(--surface-hover)!important; }
      `}</style>

      {/* Modal */}
      {purposeForId && (
        <PurposeModal
          student={purposeForId.student} idNumber={purposeForId.idNumber}
          onConfirm={confirmCheckIn}
          onCancel={() => { setPurposeForId(null); processingRef.current = false; cooldownRef.current = {}; }}
          loading={confirmLoad}
        />
      )}

      {/* Notification CallModal */}
      {callTarget && (
        <CallModal
          student={callTarget}
          sentByName={userProfile ? `${userProfile.firstName ?? ''} ${userProfile.lastName ?? ''}`.trim() : ''}
          sentByUid={userProfile?.uid}
          onClose={() => setCallTarget(null)}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <p style={{ ...MONO, fontSize: '9px', letterSpacing: '0.22em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '6px' }}>Library Logger</p>
          <h1 style={{ ...SERIF, fontSize: 'clamp(22px,4vw,30px)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>QR Check-In Scanner</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Scan a student's QR code to check them in or out.</p>
        </div>
        <button onClick={toggleTheme} title={dark ? 'Light Mode' : 'Dark Mode'}
          style={{ width: 40, height: 40, borderRadius: '10px', border: '1px solid var(--card-border)', background: 'var(--surface)', color: 'var(--gold)', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 }}>
          {dark ? (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>) : (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>)}
        </button>
      </div>
      <div style={{ height: '1px', background: 'linear-gradient(90deg, var(--gold-border), var(--gold-soft), transparent)', marginBottom: '24px' }} />

      <div className="qr-layout">
        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <ScanToast scan={lastScan} status={scanStatus} />

          {/* Scanner */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '18px', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', background: scannerState === 'active' ? 'var(--green)' : scannerState === 'starting' ? 'var(--gold)' : 'var(--text-dim)', animation: isScanning ? 'pulse 1.5s infinite' : 'none' }} />
                <p style={{ ...MONO, fontSize: '10px', letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {scannerState === 'active' ? 'Scanner Active' : scannerState === 'starting' ? 'Starting Camera…' : scannerState === 'stopping' ? 'Stopping…' : 'Camera Inactive'}
                </p>
              </div>
              {isScanning && (
                <button onClick={stopScanner} style={{ ...MONO, fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: '7px', background: 'var(--red-soft)', border: '1px solid var(--red-border)', color: 'var(--red)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}>Stop</button>
              )}
            </div>
            <div style={{ padding: '20px' }}>
              <div id="qr-staff-reader" style={{ borderRadius: '12px', overflow: 'hidden', background: '#000', width: '100%', display: isScanning ? 'block' : 'none', minHeight: isScanning ? '260px' : 0 }} />
              {!isScanning && (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <div style={{ width: 68, height: 68, margin: '0 auto 18px', borderRadius: '16px', background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3" rx="0.5"/>
                      <rect x="19" y="14" width="2" height="2" rx="0.5"/><rect x="14" y="19" width="2" height="2" rx="0.5"/>
                      <rect x="18" y="19" width="3" height="2" rx="0.5"/>
                    </svg>
                  </div>
                  <p style={{ ...SERIF, fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Camera Not Active</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '22px', lineHeight: 1.65 }}>Start the scanner to check students in or out<br/>using their library QR code.</p>
                  <button onClick={startScanner} disabled={scannerState === 'stopping'}
                    style={{ padding: '12px 36px', borderRadius: '10px', cursor: scannerState === 'stopping' ? 'wait' : 'pointer', background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', color: 'var(--gold)', ...MONO, fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, transition: 'all 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.filter='brightness(1.2)'}
                    onMouseLeave={e => e.currentTarget.style.filter='brightness(1)'}>
                    {scannerState === 'stopping' ? 'Please Wait…' : '▶ Start Scanner'}
                  </button>
                  {scanError && <p style={{ ...MONO, fontSize: '11px', color: 'var(--red)', marginTop: '14px', lineHeight: 1.5 }}>{scanError}</p>}
                </div>
              )}
              {isScanning && <p style={{ ...MONO, fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '12px' }}>Point camera at the student's library QR code</p>}
            </div>
          </div>

          {/* Manual entry */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '18px', padding: '20px', boxShadow: 'var(--shadow-card)' }}>
            <p style={{ ...MONO, fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '14px', fontWeight: 600 }}>Manual Entry</p>
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input type="text" inputMode="numeric" style={{ ...inputSt, ...MONO, letterSpacing: '0.14em' }} placeholder="22-12345-123" value={manualFormat}
                onChange={e => { const f = formatId(e.target.value); setManualFormat(f); setManualId(f); }} onFocus={onFoc} onBlur={onBlr} />
              <select style={{ ...inputSt, appearance: 'none', cursor: 'pointer' }} value={manualPurpose} onChange={e => setManualPurpose(e.target.value)} onFocus={onFoc} onBlur={onBlr}>
                <option value="">— Purpose of Visit —</option>
                {VISIT_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <button type="submit" disabled={!manualId || !manualPurpose || manualLoading}
                style={{ padding: '11px', borderRadius: '9px', transition: 'all 0.15s', background: (!manualId || !manualPurpose) ? 'var(--surface)' : 'var(--gold-soft)', border: `1px solid ${(!manualId || !manualPurpose) ? 'var(--card-border)' : 'var(--gold-border)'}`, color: (!manualId || !manualPurpose) ? 'var(--text-dim)' : 'var(--gold)', cursor: (!manualId || !manualPurpose || manualLoading) ? 'not-allowed' : 'pointer', opacity: manualLoading ? 0.6 : 1, ...MONO, fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
                {manualLoading ? 'Processing…' : 'Log Entry / Exit'}
              </button>
            </form>
            {manualMsg && (
              <div style={{ marginTop: '12px', background: manualMsg.ok ? 'var(--green-soft)' : 'var(--red-soft)', border: `1px solid ${manualMsg.ok ? 'var(--green-border)' : 'var(--red-border)'}`, borderRadius: '9px', padding: '11px 14px', animation: 'fadeIn 0.2s ease' }}>
                <p style={{ ...MONO, fontSize: '12px', color: manualMsg.ok ? 'var(--green)' : 'var(--red)' }}>{manualMsg.text}</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — live sessions */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
            <p style={{ ...MONO, fontSize: '10px', letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Currently in Library</p>
            <span style={{ ...MONO, fontSize: '11px', fontWeight: 700, padding: '2px 10px', borderRadius: '20px', background: 'var(--green-soft)', border: '1px solid var(--green-border)', color: 'var(--green)' }}>{liveSessions.length}</span>
            <input type="text" placeholder="Search name or ID…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...inputSt, ...MONO, flex: 1, minWidth: '160px', fontSize: '12px', padding: '7px 12px', marginLeft: 'auto' }} onFocus={onFoc} onBlur={onBlr} />
          </div>

          <div style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '18px', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
            {filteredSessions.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: '22px', color: 'var(--text-dim)' }}>○</div>
                <p style={{ ...MONO, fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{search ? 'No matching students found.' : 'No students currently in the library.'}</p>
                {!search && <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Scan a QR code to log the first entry.</p>}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '420px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--thead-bg)' }}>
                      {[
                        { label: 'Student',  w: '22%' },
                        { label: 'Purpose',  w: '18%' },
                        { label: 'Since',    w: '10%' },
                        { label: 'Duration', w: '10%' },
                        { label: 'Notify',   w: '20%' },
                      ].map(h => (
                        <th key={h.label} style={{ ...MONO, fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--divider)', fontWeight: 600, width: h.w }}>{h.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.map((s, i) => {
                      const u = userMap[s.uid];
                      return (
                        <tr key={s.id} className="qr-row" style={{ background: i % 2 === 0 ? 'transparent' : 'var(--row-alt)', transition: 'background 0.15s' }}>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--row-border)' }}>
                            <p style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.3 }}>{u ? `${u.lastName}, ${u.firstName}` : '—'}</p>
                            <p style={{ ...MONO, fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{u?.idNumber ?? '—'}</p>
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--row-border)' }}>
                            <span style={{ ...MONO, fontSize: '9px', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '20px', background: 'var(--blue-soft)', border: '1px solid var(--blue-border)', color: 'var(--blue)', whiteSpace: 'nowrap', display: 'inline-block' }}>{s.purpose}</span>
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--row-border)', ...MONO, fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtTime(s.entryTime)}</td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--row-border)', ...MONO, fontSize: '11px', color: 'var(--text-body)', whiteSpace: 'nowrap' }}><LiveDur entryTime={s.entryTime} /></td>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--row-border)' }}>
                            {(() => {
                              const notif = activeNotifMap[s.uid];
                              const nm = u ? `${u.lastName}, ${u.firstName}` : '—';
                              const btnBase = { ...MONO, fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, padding: '5px 10px', borderRadius: '7px', cursor: 'pointer', whiteSpace: 'nowrap' };
                              if (!notif) return (
                                <button onClick={() => setCallTarget({ uid: s.uid, displayName: nm, idNumber: u?.idNumber ?? '' })}
                                  style={{ ...btnBase, background: 'var(--blue-soft)', border: '1px solid var(--blue-border)', color: 'var(--blue)' }}>
                                  Call
                                </button>
                              );
                              if (!notif.acknowledged) return (
                                <span style={{ ...MONO, fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '5px 10px', borderRadius: '7px', background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', color: 'var(--gold)', whiteSpace: 'nowrap', display: 'inline-block' }}>
                                  Pending
                                </span>
                              );
                              return (
                                <div style={{ display: 'flex', gap: '5px', flexDirection: 'column' }}>
                                  <button onClick={() => handleFollowUp(notif.id)}
                                    style={{ ...btnBase, background: 'var(--blue-soft)', border: '1px solid var(--blue-border)', color: 'var(--blue)' }}>
                                    Follow Up
                                  </button>
                                  <button onClick={() => handleResolve(notif.id)}
                                    style={{ ...btnBase, background: 'var(--green-soft)', border: '1px solid var(--green-border)', color: 'var(--green)' }}>
                                    Resolve
                                  </button>
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p style={{ ...MONO, fontSize: '10px', color: 'var(--text-dim)', marginTop: '10px', lineHeight: 1.6 }}>Scanning a student's QR code automatically toggles check-in or check-out.</p>
        </div>
      </div>
    </div>
  );
}
