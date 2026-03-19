// src/pages/staff/StaffKioskPage.jsx
// Counter kiosk operated by staff — visitors type their ID number or scan their QR.
// Staff does NOT sign in here; this is a shared screen at the library counter.
// All three lookup methods (ID number, QR token, Google email) resolve to ONE account.
import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  collection, query, where, getDocs, addDoc, updateDoc,
  doc, onSnapshot, serverTimestamp, limit,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const PP   = { fontFamily: "'Poppins', sans-serif" };
const SR   = { fontFamily: "'Playfair Display', serif" };
const MN   = { fontFamily: "'IBM Plex Mono', monospace" };

const PURPOSES = [
  'Study / Review', 'Research', 'Borrow / Return Books',
  'Use Computer', 'Group Study', 'Other',
];

function formatId(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `${d.slice(0,2)}-${d.slice(2)}`;
  return `${d.slice(0,2)}-${d.slice(2,7)}-${d.slice(7)}`;
}
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

function LiveDur({ entryTime }) {
  const [dur, setDur] = useState('—');
  useEffect(() => {
    const tick = () => setDur(formatDur(entryTime));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [entryTime]);
  return <span>{dur}</span>;
}

// ── Lookup visitor by ID number, QR token, or email ──────────────────────────
// All three point to the same user account.
async function lookupVisitor(rawInput) {
  const input = rawInput.trim();
  if (!input) return null;

  // Try QR token — UUID format (36 chars with dashes) or legacy 32-char hex
  const isUUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input);
  const isHex32 = /^[a-f0-9]{32}$/i.test(input);
  if (isUUID || isHex32) {
    const snap = await getDocs(query(collection(db,'users'), where('qrToken','==',input), limit(1)));
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  // Try ID number (formatted or raw digits)
  const formatted = formatId(input);
  if (/^\d{2}-\d{5}-\d{3}$/.test(formatted)) {
    const snap = await getDocs(query(collection(db,'users'), where('idNumber','==',formatted), limit(1)));
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  // Try email
  if (input.includes('@')) {
    const snap = await getDocs(query(collection(db,'users'), where('email','==',input.toLowerCase()), limit(1)));
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  return null;
}

// ── Purpose picker modal ──────────────────────────────────────────────────────
function PurposeModal({ visitor, onConfirm, onCancel, loading }) {
  const [chosen, setChosen] = useState('');
  return (
    <div onClick={e => { if (e.target === e.currentTarget && !loading) onCancel(); }}
      style={{ position:'fixed', inset:0, zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.72)', backdropFilter:'blur(6px)', padding:16, animation:'fadeIn 0.18s ease both' }}>
      <div style={{ width:'100%', maxWidth:440, borderRadius:20, overflow:'hidden', background:'var(--card)', border:'1px solid var(--gold-border)', boxShadow:'var(--shadow-modal)', animation:'slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        <div style={{ height:3, background:'linear-gradient(90deg,var(--gold),transparent)' }}/>
        <div style={{ padding:28 }}>
          {/* Visitor card */}
          <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderRadius:12, background:'var(--green-soft)', border:'1px solid var(--green-border)', marginBottom:22 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:'var(--green-border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3.33 1.67 8.67 1.67 12 0v-5"/></svg>
            </div>
            <div>
              <p style={{ ...MN, fontSize:8, letterSpacing:'0.2em', color:'var(--green)', textTransform:'uppercase', marginBottom:3 }}>Visitor Found</p>
              <p style={{ ...SR, fontSize:18, fontWeight:700, color:'var(--text-primary)', lineHeight:1.2 }}>{visitor.lastName}, {visitor.firstName}</p>
              <p style={{ ...MN, fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{visitor.idNumber}</p>
            </div>
          </div>

          <p style={{ ...PP, fontSize:13, color:'var(--text-muted)', marginBottom:14 }}>Select purpose of visit:</p>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:22 }}>
            {PURPOSES.map(p => {
              const active = chosen === p;
              return (
                <button key={p} type="button" onClick={() => setChosen(p)}
                  style={{ padding:'11px 10px', borderRadius:10, cursor:'pointer', textAlign:'left', transition:'all 0.15s',
                    background: active ? 'var(--green-soft)' : 'var(--surface)',
                    border: `1px solid ${active ? 'var(--green-border)' : 'var(--card-border)'}`,
                    transform: active ? 'scale(1.02)' : 'scale(1)',
                  }}>
                  <p style={{ ...MN, fontSize:10, letterSpacing:'0.07em', color:active ? 'var(--green)' : 'var(--text-body)', fontWeight:active ? 700 : 500, margin:0 }}>{p}</p>
                </button>
              );
            })}
          </div>

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onCancel} disabled={loading}
              style={{ flex:1, padding:12, borderRadius:10, background:'var(--surface)', border:'1px solid var(--card-border)', color:'var(--text-muted)', cursor:loading?'not-allowed':'pointer', opacity:loading?0.5:1, ...MN, fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase' }}>
              Cancel
            </button>
            <button onClick={() => chosen && !loading && onConfirm(chosen)} disabled={!chosen || loading}
              style={{ flex:2, padding:12, borderRadius:10, transition:'all 0.15s',
                background: chosen ? 'var(--green-soft)' : 'var(--surface)',
                border: `1px solid ${chosen ? 'var(--green-border)' : 'var(--card-border)'}`,
                color: chosen ? 'var(--green)' : 'var(--text-dim)',
                cursor: !chosen || loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                ...MN, fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase', fontWeight:700,
              }}>
              {loading ? 'Checking In…' : 'Confirm Check-In ↓'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Success flash ─────────────────────────────────────────────────────────────
function ResultFlash({ result, onDismiss }) {
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [result]);

  if (!result) return null;
  const isIn   = result.action === 'in';
  const color  = isIn ? 'var(--green)' : 'var(--blue)';
  const soft   = isIn ? 'var(--green-soft)' : 'var(--blue-soft)';
  const border = isIn ? 'var(--green-border)' : 'var(--blue-border)';

  return (
    <div onClick={onDismiss}
      style={{ borderRadius:14, padding:'16px 20px', background:soft, border:`1px solid ${border}`, display:'flex', alignItems:'center', gap:16, cursor:'pointer', animation:'fadeIn 0.2s ease both', marginBottom:16 }}>
      <div style={{ width:44, height:44, borderRadius:'50%', background:soft, border:`2px solid ${color}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, color, flexShrink:0 }}>
        {isIn ? '↓' : '↑'}
      </div>
      <div>
        <p style={{ ...SR, fontSize:16, fontWeight:700, color:'var(--text-primary)', marginBottom:2 }}>
          {result.visitor ? `${result.visitor.lastName}, ${result.visitor.firstName}` : result.input}
        </p>
        <p style={{ ...MN, fontSize:10, color, letterSpacing:'0.08em' }}>
          {isIn ? `Checked IN — ${result.purpose}` : 'Checked OUT successfully'}
        </p>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function StaffKioskPage() {
  const { userProfile: staffProfile } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();

  // Manual input
  const [inputVal,    setInputVal]    = useState('');
  const [inputFmt,    setInputFmt]    = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [result,      setResult]      = useState(null);
  const [purposeFor,  setPurposeFor]  = useState(null); // {visitor}
  const [purposeLoad, setPurposeLoad] = useState(false);

  // QR scanner
  const scannerRef   = useRef(null);
  const processingRef = useRef(false);
  const unmountedRef  = useRef(false);
  const [scanState,  setScanState]  = useState('idle'); // idle | starting | active | stopping
  const [scanError,  setScanError]  = useState('');

  // Live sessions
  const [liveSessions, setLiveSessions] = useState([]);
  const [userMap,      setUserMap]      = useState({});

  useEffect(() => {
    unmountedRef.current = false;
    const u1 = onSnapshot(query(collection(db,'logger'), where('active','==',true)), snap =>
      setLiveSessions(snap.docs.map(d => ({ id:d.id, ...d.data() })))
    );
    const u2 = onSnapshot(collection(db,'users'), snap => {
      const m = {}; snap.forEach(d => { m[d.id] = d.data(); }); setUserMap(m);
    });
    return () => { unmountedRef.current = true; u1(); u2(); };
  }, []);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      const sc = scannerRef.current;
      if (sc) {
        try { if (sc.isRunning()) sc.stop().catch(()=>{}).finally(()=>{ try{sc.clear();}catch{} }); else { try{sc.clear();}catch{} } } catch {}
        scannerRef.current = null;
      }
    };
  }, []);

  // ── Core action: check in or out a visitor ────────────────────────────────
  const processVisitor = useCallback(async (visitor, purpose) => {
    // Check if already checked in
    const sessSnap = await getDocs(query(
      collection(db,'logger'),
      where('uid','==',visitor.id),
      where('active','==',true),
      limit(1)
    ));

    if (!sessSnap.empty) {
      // Check OUT
      await updateDoc(doc(db,'logger',sessSnap.docs[0].id), {
        active: false, exitTime: serverTimestamp(),
      });
      return { action:'out', visitor, input: visitor.idNumber };
    } else {
      // Check IN — need purpose first
      if (!purpose) return null; // caller must show purpose modal
      await addDoc(collection(db,'logger'), {
        uid:             visitor.id,
        purpose,
        entryTime:       serverTimestamp(),
        active:          true,
        staffLogged:     true,
        loggedByStaff:   staffProfile?.uid || null,
        // Identity snapshot — preserved even if user is later deleted
        studentName:    `${visitor.lastName}, ${visitor.firstName}`,
        studentIdNumber: visitor.idNumber || '',
        studentCourse:  visitor.course || '',
        studentCollege: visitor.college || '',
      });
      return { action:'in', visitor, purpose, input: visitor.idNumber };
    }
  }, [staffProfile]);

  // ── Handle manual ID / QR / email submit ─────────────────────────────────
  const handleSubmit = async (e) => {
    e?.preventDefault();
    const raw = inputVal.trim();
    if (!raw) return;
    setError(''); setLoading(true);
    try {
      const visitor = await lookupVisitor(raw);
      if (!visitor) {
        setError(`No account found for "${raw}". Check the ID number and try again.`);
        setLoading(false);
        return;
      }

      // Check if they're already in — if so, check out directly
      const sessSnap = await getDocs(query(
        collection(db,'logger'),
        where('uid','==',visitor.id),
        where('active','==',true),
        limit(1)
      ));

      if (!sessSnap.empty) {
        // Check OUT immediately
        await updateDoc(doc(db,'logger',sessSnap.docs[0].id), {
          active:false, exitTime:serverTimestamp(),
        });
        setResult({ action:'out', visitor, input:raw });
        setInputVal(''); setInputFmt('');
      } else {
        // Need to pick a purpose first
        setPurposeFor({ visitor });
      }
    } catch (err) {
      setError('Error: ' + err.message);
    }
    setLoading(false);
  };

  const handlePurposeConfirm = async (purpose) => {
    if (!purposeFor) return;
    setPurposeLoad(true);
    try {
      const res = await processVisitor(purposeFor.visitor, purpose);
      setResult(res);
      setInputVal(''); setInputFmt('');
      setPurposeFor(null);
    } catch (err) {
      setError('Error: ' + err.message);
      setPurposeFor(null);
    }
    setPurposeLoad(false);
  };

  // ── QR scan handler ───────────────────────────────────────────────────────
  const handleQrScan = useCallback(async (rawText) => {
    if (unmountedRef.current || processingRef.current) return;
    processingRef.current = true;
    const raw = rawText.trim();
    try {
      const visitor = await lookupVisitor(raw);
      if (!visitor) {
        if (!unmountedRef.current) setError(`QR not recognized: ${raw}`);
        processingRef.current = false;
        return;
      }
      const sessSnap = await getDocs(query(
        collection(db,'logger'),
        where('uid','==',visitor.id),
        where('active','==',true),
        limit(1)
      ));
      if (!sessSnap.empty) {
        await updateDoc(doc(db,'logger',sessSnap.docs[0].id), {
          active:false, exitTime:serverTimestamp(),
        });
        if (!unmountedRef.current) { setResult({ action:'out', visitor, input:raw }); setError(''); }
      } else {
        if (!unmountedRef.current) { setPurposeFor({ visitor }); setError(''); }
      }
    } catch (err) {
      if (!unmountedRef.current) setError('Scan error: ' + err.message);
    }
    // Always hold the lock for 3s — prevents double-scan on the same QR frame
    setTimeout(() => { processingRef.current = false; }, 3000);
  }, []);

  const startScanner = useCallback(async () => {
    if (unmountedRef.current) return;
    setScanError(''); setScanState('starting');
    await new Promise(r => setTimeout(r, 150));
    if (unmountedRef.current) return;
    if (scannerRef.current) {
      try { if (scannerRef.current.isRunning()) await scannerRef.current.stop().catch(()=>{}); scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
    }
    const scanner = new Html5Qrcode('qr-kiosk-reader', { verbose:false });
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode:'environment' },
        { fps:10, qrbox:{ width:220, height:220 }, disableFlip:false },
        (text) => { try { handleQrScan(text); } catch {} },
        () => {}
      );
      if (!unmountedRef.current) setScanState('active');
    } catch {
      if (!unmountedRef.current) { setScanError('Camera access denied. Allow camera permission and try again.'); setScanState('idle'); }
      try { scanner.clear(); } catch {}
      if (scannerRef.current === scanner) scannerRef.current = null;
    }
  }, [handleQrScan]);

  const stopScanner = useCallback(async () => {
    setScanState('stopping');
    const sc = scannerRef.current;
    if (sc) { try { if (sc.isRunning()) await sc.stop().catch(()=>{}); sc.clear(); } catch {} scannerRef.current = null; }
    if (!unmountedRef.current) setScanState('idle');
  }, []);

  const isScanning = scanState === 'active' || scanState === 'starting';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24, animation:'fadeUp 0.3s ease both' }}>
      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(24px) scale(0.97)} to{opacity:1;transform:none} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        #qr-kiosk-reader video { border-radius:10px!important; width:100%!important; }
        #qr-kiosk-reader img   { display:none!important; }
      `}</style>

      {/* Header */}
      <div style={{ paddingBottom:20, borderBottom:'1px solid var(--divider)' }}>
        <p style={{...MN,fontSize:10,letterSpacing:'0.2em',textTransform:'uppercase',color:'var(--text-dim)',marginBottom:6}}>Staff Counter</p>
        <h1 style={{...SR,fontSize:'clamp(22px,3.5vw,30px)',fontWeight:700,color:'var(--text-primary)',marginBottom:6}}>Visitor Kiosk</h1>
        <p style={{...PP,fontSize:14,color:'var(--text-muted)'}}>Type a visitor's ID number, scan their QR code, or enter their email to log them in or out.</p>
      </div>

      {/* ── Two-column layout: Manual entry left, QR scanner right ── */}
      <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1.4fr)', gap:20, alignItems:'start' }}>

        {/* ── LEFT: Manual ID / email entry ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Result flash */}
          {result && <ResultFlash result={result} onDismiss={() => setResult(null)} />}

          {/* Error */}
          {error && (
            <div style={{ background:'var(--red-soft)', border:'1px solid var(--red-border)', borderRadius:10, padding:'11px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <p style={{...MN,fontSize:11,color:'var(--red)'}}>{error}</p>
              <button onClick={() => setError('')} style={{ background:'none', border:'none', color:'var(--red)', cursor:'pointer', fontSize:16, lineHeight:1 }}>✕</button>
            </div>
          )}

          {/* Manual input */}
          <div style={{ background:'var(--card)', border:'1px solid var(--card-border)', borderRadius:14, padding:20, boxShadow:'var(--shadow-card)' }}>
            <p style={{...MN,fontSize:10,letterSpacing:'0.16em',textTransform:'uppercase',color:'var(--text-dim)',marginBottom:14}}>Manual Entry</p>
            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{...MN,fontSize:9,letterSpacing:'0.14em',color:'var(--text-muted)',textTransform:'uppercase',display:'block',marginBottom:6,fontWeight:600}}>
                  ID Number or Email
                </label>
                <input
                  style={{ width:'100%', background:'var(--input-bg)', border:'1px solid var(--input-border)', borderRadius:9, padding:'12px 14px', fontSize:15, color:'var(--text-primary)', fontFamily:"'IBM Plex Mono',monospace", outline:'none', boxSizing:'border-box', letterSpacing:'0.06em' }}
                  placeholder="24-12345-678"
                  value={inputFmt}
                  onChange={e => {
                    const raw = e.target.value;
                    const digitsOnly = raw.replace(/\D/g,'');
                    if (digitsOnly.length > 0 && digitsOnly.length <= 10 && /^\d+$/.test(raw.replace(/-/g,''))) {
                      const fmt = formatId(raw);
                      setInputFmt(fmt); setInputVal(fmt);
                    } else {
                      setInputFmt(raw); setInputVal(raw);
                    }
                    setError('');
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--gold)'; }}
                  onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--input-border)'; }}
                  autoFocus autoComplete="off"
                />
                <p style={{...MN,fontSize:10,color:'var(--text-dim)',marginTop:4}}>ID number · QR token · @neu.edu.ph email</p>
              </div>
              <button type="submit" disabled={loading || !inputVal.trim()}
                style={{ width:'100%', padding:13, borderRadius:10,
                  background: inputVal.trim() && !loading ? 'var(--gold-soft)' : 'var(--surface)',
                  border: `1px solid ${inputVal.trim() ? 'var(--gold-border)' : 'var(--card-border)'}`,
                  color: inputVal.trim() && !loading ? 'var(--gold)' : 'var(--text-dim)',
                  cursor: inputVal.trim() && !loading ? 'pointer' : 'not-allowed',
                  opacity: loading ? 0.6 : 1,
                  ...MN, fontSize:11, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', transition:'all 0.15s',
                }}>
                {loading
                  ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      <span style={{ display:'inline-block', animation:'spin 0.8s linear infinite' }}>↻</span> Looking up…
                    </span>
                  : 'Look Up & Log In / Out'}
              </button>
            </form>
          </div>
        </div>

        {/* ── RIGHT: QR Scanner (primary action) ── */}
        <div style={{ background:'var(--card)', border:'1px solid var(--card-border)', borderRadius:14, overflow:'hidden', boxShadow:'var(--shadow-card)' }}>
          <div style={{ height:3, background:'linear-gradient(90deg,var(--gold),transparent)' }} />
          <div style={{ padding:20 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div>
                <p style={{...MN,fontSize:10,letterSpacing:'0.16em',textTransform:'uppercase',color:'var(--text-dim)',marginBottom:3}}>QR Code Scanner</p>
                <p style={{...PP,fontSize:12,color:'var(--text-muted)'}}>Scan a visitor's QR code to log them in or out instantly.</p>
              </div>
              <button
                onClick={isScanning ? stopScanner : startScanner}
                disabled={scanState === 'starting' || scanState === 'stopping'}
                style={{ padding:'9px 18px', borderRadius:9, cursor:'pointer', transition:'all 0.15s', ...MN, fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', flexShrink:0,
                  background: isScanning ? 'var(--red-soft)' : 'var(--green-soft)',
                  border:     `1px solid ${isScanning ? 'var(--red-border)' : 'var(--green-border)'}`,
                  color:      isScanning ? 'var(--red)' : 'var(--green)',
                  opacity:    (scanState==='starting'||scanState==='stopping') ? 0.6 : 1,
                }}>
                {scanState==='starting'?'Starting…':scanState==='stopping'?'Stopping…':isScanning?'Stop Scanner':'Start Scanner'}
              </button>
            </div>

            {scanError && (
              <div style={{ background:'var(--red-soft)', border:'1px solid var(--red-border)', borderRadius:9, padding:'10px 13px', marginBottom:12 }}>
                <p style={{...MN,fontSize:11,color:'var(--red)'}}>{scanError}</p>
              </div>
            )}

            <div id="qr-kiosk-reader" style={{ width:'100%', minHeight: isScanning ? 300 : 0, overflow:'hidden', borderRadius:10, background:'var(--surface)' }} />

            {!isScanning && (
              <div style={{ padding:'40px 24px', textAlign:'center' }}>
                <div style={{ width:64, height:64, borderRadius:16, background:'var(--surface)', border:'2px dashed var(--card-border)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3"/><path d="M17 17v4"/><path d="M21 14v3h-4"/>
                  </svg>
                </div>
                <p style={{...MN,fontSize:11,color:'var(--text-dim)',marginBottom:4}}>Camera is off</p>
                <p style={{...PP,fontSize:12,color:'var(--text-muted)'}}>Press Start Scanner to activate the camera and scan visitor QR codes.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Purpose modal */}
      {purposeFor && (
        <PurposeModal
          visitor={purposeFor.visitor}
          onConfirm={handlePurposeConfirm}
          onCancel={() => { setPurposeFor(null); setInputVal(''); setInputFmt(''); }}
          loading={purposeLoad}
        />
      )}
    </div>
  );
}
