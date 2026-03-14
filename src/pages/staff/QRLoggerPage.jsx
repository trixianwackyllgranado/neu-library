// src/pages/staff/QRLoggerPage.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  collection, query, where, getDocs, addDoc, updateDoc,
  doc, onSnapshot, serverTimestamp, limit,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { VISIT_PURPOSES } from '../../data/colleges';

// ── Design tokens ─────────────────────────────────────────────────────────────
const MONO  = { fontFamily: "'IBM Plex Mono', monospace" };
const SERIF = { fontFamily: "'Playfair Display', serif" };
const C = {
  gold:    '#f59e0b',
  white:   '#f1f5f9',
  body:    '#cbd5e1',
  muted:   '#94a3b8',
  dim:     '#64748b',
  green:   '#34d399',
  blue:    '#60a5fa',
  red:     '#f87171',
  border:  'rgba(255,255,255,0.1)',
  surface: 'rgba(255,255,255,0.04)',
  card:    'rgba(10,23,48,0.9)',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  // If already formatted (contains dashes), return as-is
  if (raw.includes('-')) return raw.trim();
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

// ── Purpose picker modal ──────────────────────────────────────────────────────
function PurposeModal({ student, idNumber, onConfirm, onCancel, loading }) {
  const [chosen, setChosen] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: '#0a1730', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #f59e0b, #d97706)' }} />
        <div style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <p style={{ ...MONO, fontSize: '9px', letterSpacing: '0.2em', color: C.gold, textTransform: 'uppercase', marginBottom: '6px' }}>QR Check-In</p>
            <p style={{ ...SERIF, fontSize: '20px', fontWeight: 700, color: C.white, marginBottom: '3px' }}>
              {student.lastName}, {student.firstName}
            </p>
            <p style={{ ...MONO, fontSize: '12px', color: C.muted }}>{idNumber}</p>
          </div>
          <p style={{ fontSize: '13px', color: C.body, marginBottom: '14px' }}>Select the purpose of this visit:</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
            {VISIT_PURPOSES.map(p => {
              const active = chosen === p;
              return (
                <button key={p} type="button" onClick={() => setChosen(p)}
                  style={{ padding: '12px 10px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', background: active ? 'rgba(245,158,11,0.15)' : C.surface, border: `1px solid ${active ? 'rgba(245,158,11,0.5)' : C.border}`, transition: 'all 0.15s' }}>
                  <p style={{ ...MONO, fontSize: '10px', fontWeight: active ? 700 : 500, letterSpacing: '0.08em', color: active ? C.gold : C.body, margin: 0 }}>{p}</p>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onCancel}
              style={{ flex: 1, padding: '11px', borderRadius: '10px', background: C.surface, border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer', ...MONO, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Cancel
            </button>
            <button onClick={() => chosen && onConfirm(chosen)} disabled={!chosen || loading}
              style={{ flex: 2, padding: '11px', borderRadius: '10px', background: chosen ? 'rgba(16,185,129,0.15)' : C.surface, border: `1px solid ${chosen ? 'rgba(16,185,129,0.4)' : C.border}`, color: chosen ? C.green : C.dim, cursor: !chosen ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, ...MONO, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, transition: 'all 0.15s' }}>
              {loading ? 'Checking In…' : 'Confirm Check-In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Scan result toast ─────────────────────────────────────────────────────────
function ScanToast({ scan, status }) {
  if (!scan || status === 'idle') return null;
  if (status === 'processing') {
    return (
      <div style={{ borderRadius: '12px', padding: '14px 18px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <span style={{ ...MONO, fontSize: '12px', color: C.gold, animation: 'spin 1s linear infinite', display: 'inline-block' }}>↻</span>
        <p style={{ ...MONO, fontSize: '11px', color: C.gold }}>Processing scan…</p>
      </div>
    );
  }
  if (status === 'unknown') {
    return (
      <div style={{ borderRadius: '12px', padding: '14px 18px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: '12px' }}>
        <p style={{ ...MONO, fontSize: '11px', color: C.red }}>No account found for ID: {scan.idNumber}</p>
      </div>
    );
  }
  if (status === 'success') {
    const isIn  = scan.action === 'in';
    const color = isIn ? C.green : C.blue;
    const bg    = isIn ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)';
    const bdr   = isIn ? 'rgba(16,185,129,0.35)' : 'rgba(59,130,246,0.35)';
    return (
      <div style={{ borderRadius: '12px', padding: '14px 18px', background: bg, border: `1px solid ${bdr}`, display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: isIn ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)', border: `1px solid ${bdr}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '16px', color }}>
          {isIn ? '↓' : '↑'}
        </div>
        <div>
          <p style={{ ...SERIF, fontSize: '15px', fontWeight: 700, color: C.white, marginBottom: '2px' }}>
            {scan.student ? `${scan.student.lastName}, ${scan.student.firstName}` : scan.idNumber}
          </p>
          <p style={{ ...MONO, fontSize: '10px', color, letterSpacing: '0.08em' }}>
            {isIn ? `Checked IN — ${scan.purpose}` : 'Checked OUT successfully'}
          </p>
        </div>
      </div>
    );
  }
  return null;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function QRLoggerPage() {
  const { userProfile } = useAuth();

  // The scanner instance lives in a ref — never in state — so React re-renders
  // never touch it. This is the core fix for the "enlarge crosshair but no callback" bug.
  const scannerRef   = useRef(null);
  const unmountedRef = useRef(false);   // true once component unmounts
  const processingRef = useRef(false);  // prevents double-processing same scan
  const cooldownRef  = useRef({});

  const [scannerState,  setScannerState]  = useState('idle'); // 'idle' | 'starting' | 'active' | 'stopping'
  const [scanError,     setScanError]     = useState('');
  const [lastScan,      setLastScan]      = useState(null);
  const [scanStatus,    setScanStatus]    = useState('idle');
  const [purposeForId,  setPurposeForId]  = useState(null);
  const [confirmLoad,   setConfirmLoad]   = useState(false);

  const [manualId,      setManualId]      = useState('');
  const [manualFormat,  setManualFormat]  = useState('');
  const [manualPurpose, setManualPurpose] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualMsg,     setManualMsg]     = useState(null);

  const [liveSessions,  setLiveSessions]  = useState([]);
  const [userMap,       setUserMap]       = useState({});

  // Live Firestore listeners
  useEffect(() => {
    const u1 = onSnapshot(
      query(collection(db, 'logger'), where('active', '==', true)),
      snap => setLiveSessions(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    );
    const u2 = onSnapshot(collection(db, 'users'), snap => {
      const m = {}; snap.forEach(d => { m[d.id] = d.data(); }); setUserMap(m);
    });
    return () => { u1(); u2(); };
  }, []);

  // ── Guaranteed cleanup on page leave ────────────────────────────────────────
  // This is the fix for the "blank page when navigating away with camera open" bug.
  // We set unmountedRef immediately so callbacks know to bail, then stop the scanner.
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      const sc = scannerRef.current;
      if (sc) {
        try {
          if (sc.isRunning()) {
            sc.stop().catch(() => {}).finally(() => {
              try { sc.clear(); } catch {}
            });
          } else {
            try { sc.clear(); } catch {}
          }
        } catch {}
        scannerRef.current = null;
      }
    };
  }, []);

  // ── Core scan handler (stable ref via useCallback) ───────────────────────────
  // Wrapped in useCallback so the function reference passed to html5-qrcode
  // never changes after mount — fixes the "callback registered but never fires" bug.
  const handleQrScan = useCallback(async (rawText) => {
    if (unmountedRef.current) return;
    if (processingRef.current) return;

    const raw = rawText.trim();

    // Detect token vs legacy ID: token is 32 hex chars with no dashes
    const isToken      = /^[a-f0-9]{32}$/i.test(raw);
    const lookupField  = isToken ? 'qrToken'  : 'idNumber';
    const lookupValue  = isToken ? raw        : formatId(raw);

    // Per-value cooldown: 5 seconds
    const now = Date.now();
    if (cooldownRef.current[lookupValue] && now - cooldownRef.current[lookupValue] < 5000) return;
    cooldownRef.current[lookupValue] = now;

    processingRef.current = true;
    setScanStatus('processing');
    setLastScan({ idNumber: lookupValue });

    try {
      const userSnap = await getDocs(
        query(collection(db, 'users'), where(lookupField, '==', lookupValue), limit(1))
      );

      if (userSnap.empty) {
        setLastScan({ idNumber: lookupValue });
        setScanStatus('unknown');
        setTimeout(() => {
          if (!unmountedRef.current) { setScanStatus('idle'); setLastScan(null); }
        }, 3500);
        processingRef.current = false;
        return;
      }

      const student  = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };
      const idNumber = student.idNumber;

      const sessSnap = await getDocs(
        query(collection(db, 'logger'), where('uid', '==', student.id), where('active', '==', true), limit(1))
      );

      if (!sessSnap.empty) {
        // ── CHECK OUT ──
        await updateDoc(doc(db, 'logger', sessSnap.docs[0].id), {
          active: false,
          exitTime: serverTimestamp(),
        });
        if (!unmountedRef.current) {
          setLastScan({ idNumber, student, action: 'out' });
          setScanStatus('success');
          setTimeout(() => {
            if (!unmountedRef.current) { setScanStatus('idle'); setLastScan(null); }
          }, 3000);
        }
        processingRef.current = false;
      } else {
        // ── ASK PURPOSE → CHECK IN ──
        // CRITICAL: stop the scanner NOW before showing the modal.
        // If the scanner keeps running, it will re-scan the same QR within milliseconds,
        // find the session we're about to create, and immediately check the student OUT.
        const sc = scannerRef.current;
        if (sc) {
          try {
            if (sc.isRunning()) await sc.stop().catch(() => {});
            sc.clear();
          } catch {}
          scannerRef.current = null;
        }
        if (!unmountedRef.current) setScannerState('idle');

        if (!unmountedRef.current) {
          setScanStatus('idle');
          setLastScan(null);
          setPurposeForId({ idNumber, student });
        }
        processingRef.current = false;
      }
    } catch (err) {
      if (!unmountedRef.current) {
        setLastScan({ idNumber: lookupValue, error: err.message });
        setScanStatus('error');
        setTimeout(() => {
          if (!unmountedRef.current) { setScanStatus('idle'); setLastScan(null); }
        }, 3000);
      }
      processingRef.current = false;
    }
  }, []);

  // ── Scanner start/stop ───────────────────────────────────────────────────────
  const startScanner = useCallback(async () => {
    if (unmountedRef.current) return;
    setScanError('');
    setScannerState('starting');

    // Small delay so React can flush the DOM render that shows #qr-staff-reader
    await new Promise(r => setTimeout(r, 150));
    if (unmountedRef.current) return;

    // If there's a stale instance, clear it first
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isRunning()) await scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }

    const scanner = new Html5Qrcode('qr-staff-reader', { verbose: false });
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          // Fixed qrbox — no dynamic resizing that could confuse the overlay
          qrbox: { width: 220, height: 220 },
          // Disable the built-in "show scan region" overlay — we draw our own
          disableFlip: false,
        },
        (text) => {
          // This callback is called by html5-qrcode's internal scan loop.
          // It must never throw — wrap everything.
          try { handleQrScan(text); } catch {}
        },
        () => {
          // onError: fires on every failed frame — ignore silently
        },
      );

      if (!unmountedRef.current) setScannerState('active');
    } catch (err) {
      if (!unmountedRef.current) {
        setScanError('Camera access denied or unavailable. Please allow camera permission and try again.');
        setScannerState('idle');
      }
      try { scanner.clear(); } catch {}
      if (scannerRef.current === scanner) scannerRef.current = null;
    }
  }, [handleQrScan]);

  const stopScanner = useCallback(async () => {
    setScannerState('stopping');
    const sc = scannerRef.current;
    if (sc) {
      try {
        if (sc.isRunning()) await sc.stop().catch(() => {});
        sc.clear();
      } catch {}
      scannerRef.current = null;
    }
    if (!unmountedRef.current) setScannerState('idle');
  }, []);

  // ── Check-in confirm ─────────────────────────────────────────────────────────
  const confirmCheckIn = async (purpose) => {
    if (!purposeForId) return;
    setConfirmLoad(true);

    // Snapshot these before we clear purposeForId
    const { idNumber, student } = purposeForId;

    try {
      await addDoc(collection(db, 'logger'), {
        uid:       student.id,
        purpose,
        entryTime: serverTimestamp(),
        active:    true,
        scannedBy: userProfile?.uid || null,
      });

      if (!unmountedRef.current) {
        processingRef.current = false;
        cooldownRef.current = {};

        // Close modal and show success toast.
        // Do NOT auto-restart the scanner — html5-qrcode's internal frame buffer
        // still holds the last QR and would immediately re-fire, checking the
        // student back out. Staff presses Start Scanner for the next student.
        setPurposeForId(null);
        setLastScan({ idNumber, student, action: 'in', purpose });
        setScanStatus('success');
        setConfirmLoad(false);

        setTimeout(() => {
          if (!unmountedRef.current) { setScanStatus('idle'); setLastScan(null); }
        }, 3000);
      }
    } catch (err) {
      if (!unmountedRef.current) {
        setScanStatus('error');
        setConfirmLoad(false);
        processingRef.current = false;
      }
    }
  };

  // ── Manual entry ─────────────────────────────────────────────────────────────
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualId || !manualPurpose) return;
    setManualLoading(true); setManualMsg(null);
    try {
      const userSnap = await getDocs(query(collection(db, 'users'), where('idNumber', '==', manualId), limit(1)));
      if (userSnap.empty) {
        setManualMsg({ ok: false, text: `No account found for ID ${manualId}.` });
        setManualLoading(false); return;
      }
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
    } catch (err) {
      setManualMsg({ ok: false, text: `Error: ${err.message}` });
    }
    setManualLoading(false);
    setTimeout(() => { if (!unmountedRef.current) setManualMsg(null); }, 5000);
  };

  const inputSt = {
    width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '9px', padding: '11px 14px', fontSize: '14px', color: C.white,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
  };
  const onFoc = e => { e.currentTarget.style.borderColor = C.gold; };
  const onBlr = e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; };

  const isScanning = scannerState === 'active' || scannerState === 'starting';

  return (
    <div style={{ animation: 'fadeUp 0.3s ease both', paddingBottom: '40px' }}>
      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        #qr-staff-reader video { border-radius: 10px !important; width: 100% !important; }
        #qr-staff-reader img   { display: none !important; }
        #qr-staff-reader       { width: 100% !important; }
        .qr-layout { display: grid; grid-template-columns: minmax(300px, 440px) 1fr; gap: 24px; align-items: start; }
        @media (max-width: 840px) { .qr-layout { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* Purpose modal */}
      {purposeForId && (
        <PurposeModal
          student={purposeForId.student}
          idNumber={purposeForId.idNumber}
          onConfirm={confirmCheckIn}
          onCancel={() => { setPurposeForId(null); startScanner(); }}
          loading={confirmLoad}
        />
      )}

      {/* Page header */}
      <div style={{ marginBottom: '28px' }}>
        <p style={{ ...MONO, fontSize: '9px', letterSpacing: '0.22em', color: C.gold, textTransform: 'uppercase', marginBottom: '6px' }}>Library Logger</p>
        <h1 style={{ ...SERIF, fontSize: 'clamp(22px,4vw,30px)', fontWeight: 700, color: C.white, marginBottom: '6px' }}>QR Check-In Scanner</h1>
        <p style={{ fontSize: '14px', color: C.body }}>Scan a student's QR code to check them in or out instantly.</p>
        <div style={{ marginTop: '16px', height: '1px', background: 'linear-gradient(90deg, rgba(245,158,11,0.4), rgba(245,158,11,0.1), transparent)' }} />
      </div>

      <div className="qr-layout">

        {/* ── LEFT: scanner + manual ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <ScanToast scan={lastScan} status={scanStatus} />

          {/* Scanner card */}
          <div style={{ background: C.card, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            {/* Card header bar */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                  background: scannerState === 'active' ? '#10b981' : scannerState === 'starting' ? C.gold : '#475569',
                  animation: isScanning ? 'pulse 1.5s infinite' : 'none',
                }} />
                <p style={{ ...MONO, fontSize: '10px', letterSpacing: '0.14em', color: C.muted, textTransform: 'uppercase' }}>
                  {scannerState === 'active'   ? 'Scanner Active'    :
                   scannerState === 'starting' ? 'Starting Camera…'  :
                   scannerState === 'stopping' ? 'Stopping…'         : 'Camera Inactive'}
                </p>
              </div>
              {isScanning && (
                <button onClick={stopScanner}
                  style={{ ...MONO, fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: '7px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: C.red, cursor: 'pointer', fontWeight: 600 }}>
                  Stop
                </button>
              )}
            </div>

            <div style={{ padding: '20px' }}>
              {/* 
                CRITICAL: The #qr-staff-reader div MUST always be rendered in the DOM.
                If we conditionally remove it, html5-qrcode loses its mount target and
                throws, causing the blank-page bug. We hide it visually when inactive
                instead of unmounting it.
              */}
              <div
                id="qr-staff-reader"
                style={{
                  borderRadius: '10px', overflow: 'hidden', background: '#000', width: '100%',
                  display: isScanning ? 'block' : 'none',
                  minHeight: isScanning ? '260px' : 0,
                }}
              />

              {!isScanning && (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ width: 64, height: 64, margin: '0 auto 18px', borderRadius: '14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3" rx="0.5"/>
                      <rect x="19" y="14" width="2" height="2" rx="0.5"/><rect x="14" y="19" width="2" height="2" rx="0.5"/>
                      <rect x="18" y="19" width="3" height="2" rx="0.5"/>
                    </svg>
                  </div>
                  <p style={{ ...SERIF, fontSize: '17px', fontWeight: 700, color: C.white, marginBottom: '8px' }}>Camera Not Active</p>
                  <p style={{ fontSize: '14px', color: C.body, marginBottom: '22px', lineHeight: 1.6 }}>
                    Start the scanner to check students in or out using their library QR code.
                  </p>
                  <button onClick={startScanner} disabled={scannerState === 'stopping'}
                    style={{ padding: '12px 32px', borderRadius: '10px', background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.45)', color: C.gold, cursor: scannerState === 'stopping' ? 'wait' : 'pointer', ...MONO, fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, transition: 'all 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.28)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,158,11,0.18)'}>
                    {scannerState === 'stopping' ? 'Please Wait…' : 'Start Scanner'}
                  </button>
                  {scanError && (
                    <p style={{ ...MONO, fontSize: '11px', color: C.red, marginTop: '14px', lineHeight: 1.5 }}>{scanError}</p>
                  )}
                </div>
              )}

              {isScanning && (
                <p style={{ ...MONO, fontSize: '10px', color: C.muted, textAlign: 'center', marginTop: '12px' }}>
                  Point camera at the student's QR code
                </p>
              )}
            </div>
          </div>

          {/* Manual entry card */}
          <div style={{ background: C.card, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
            <p style={{ ...MONO, fontSize: '9px', letterSpacing: '0.2em', color: C.muted, textTransform: 'uppercase', marginBottom: '14px', fontWeight: 600 }}>Manual Entry</p>
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input type="text" inputMode="numeric"
                style={{ ...inputSt, ...MONO, letterSpacing: '0.14em' }}
                placeholder="22-12345-123"
                value={manualFormat}
                onChange={e => { const f = formatId(e.target.value); setManualFormat(f); setManualId(f); }}
                onFocus={onFoc} onBlur={onBlr}
              />
              <select style={{ ...inputSt, appearance: 'none', cursor: 'pointer' }}
                value={manualPurpose} onChange={e => setManualPurpose(e.target.value)}
                onFocus={onFoc} onBlur={onBlr}>
                <option value="">— Purpose of Visit —</option>
                {VISIT_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <button type="submit" disabled={!manualId || !manualPurpose || manualLoading}
                style={{ padding: '11px', borderRadius: '9px', background: (!manualId || !manualPurpose) ? C.surface : 'rgba(245,158,11,0.15)', border: `1px solid ${(!manualId || !manualPurpose) ? C.border : 'rgba(245,158,11,0.4)'}`, color: (!manualId || !manualPurpose) ? C.dim : C.gold, cursor: (!manualId || !manualPurpose || manualLoading) ? 'not-allowed' : 'pointer', opacity: manualLoading ? 0.6 : 1, ...MONO, fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, transition: 'all 0.15s' }}>
                {manualLoading ? 'Processing…' : 'Log Entry / Exit'}
              </button>
            </form>
            {manualMsg && (
              <div style={{ marginTop: '12px', background: manualMsg.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${manualMsg.ok ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`, borderRadius: '9px', padding: '11px 14px' }}>
                <p style={{ ...MONO, fontSize: '12px', color: manualMsg.ok ? C.green : C.red }}>{manualMsg.text}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: live sessions ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
            <p style={{ ...MONO, fontSize: '10px', letterSpacing: '0.14em', color: C.muted, textTransform: 'uppercase' }}>Currently in Library</p>
            <span style={{ ...MONO, fontSize: '11px', fontWeight: 700, padding: '2px 10px', borderRadius: '20px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: C.green }}>
              {liveSessions.length}
            </span>
          </div>

          <div style={{ background: C.card, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
            {liveSessions.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: '22px', color: C.dim }}>○</div>
                <p style={{ ...MONO, fontSize: '11px', color: C.muted, marginBottom: '4px' }}>No students currently in the library.</p>
                <p style={{ fontSize: '12px', color: C.dim }}>Scan a QR code to log the first entry.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '480px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#060e1e' }}>
                      {['Student', 'ID', 'Purpose', 'Since', 'Duration'].map(h => (
                        <th key={h} style={{ ...MONO, fontSize: '9px', letterSpacing: '0.14em', color: C.muted, textTransform: 'uppercase', padding: '11px 14px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {liveSessions.map((s, i) => {
                      const u    = userMap[s.uid];
                      const name = u ? `${u.lastName}, ${u.firstName}` : '—';
                      return (
                        <tr key={s.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <p style={{ fontWeight: 600, fontSize: '13px', color: C.white, marginBottom: '1px' }}>{name}</p>
                          </td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', ...MONO, fontSize: '11px', color: C.muted }}>{u?.idNumber ?? '—'}</td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <span style={{ ...MONO, fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '20px', background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.2)', color: C.muted }}>
                              {s.purpose}
                            </span>
                          </td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', ...MONO, fontSize: '11px', color: C.muted }}>{fmtTime(s.entryTime)}</td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', ...MONO, fontSize: '11px', color: C.body }}>
                            <LiveDur entryTime={s.entryTime} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p style={{ ...MONO, fontSize: '10px', color: C.dim, marginTop: '10px', lineHeight: 1.6 }}>
            Scanning a student's QR code automatically toggles their check-in or check-out.
          </p>
        </div>
      </div>
    </div>
  );
}
