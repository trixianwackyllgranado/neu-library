// src/pages/staff/QRLoggerPage.jsx
import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  collection, query, where, getDocs, addDoc, updateDoc,
  doc, onSnapshot, serverTimestamp, limit,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { VISIT_PURPOSES } from '../../data/colleges';

const S = { fontFamily: "'IBM Plex Mono', monospace" };
const D = { fontFamily: "'Playfair Display', serif" };

function fmtTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

function formatDur(entryTs) {
  if (!entryTs) return '—';
  const d = entryTs.toDate ? entryTs.toDate() : new Date(entryTs);
  const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Live ticker for duration cells
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

export default function QRLoggerPage() {
  const { userProfile } = useAuth();

  const scannerRef  = useRef(null);
  const mountedRef  = useRef(false);
  const cooldownRef = useRef({}); // id → timestamp to prevent double-scan

  const [scanning,     setScanning]     = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [scanError,    setScanError]    = useState('');

  // Result after a scan
  const [lastScan,   setLastScan]   = useState(null); // { student, action: 'in'|'out', session }
  const [scanStatus, setScanStatus] = useState('idle'); // idle | processing | success | error | unknown

  // Manual entry fallback
  const [manualId,      setManualId]      = useState('');
  const [manualFormat,  setManualFormat]  = useState('');
  const [manualPurpose, setManualPurpose] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualMsg,     setManualMsg]     = useState(null);

  // Live currently-in list
  const [liveSessions, setLiveSessions] = useState([]);
  const [userMap,      setUserMap]      = useState({});

  // Selected purpose when checking IN via QR
  const [purposeForId, setPurposeForId] = useState(null); // { idNumber } awaiting purpose
  const [chosenPurpose, setChosenPurpose] = useState('');

  // Live sessions listener
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'logger'), where('active', '==', true)),
      snap => setLiveSessions(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    );
    return unsub;
  }, []);

  // Users map
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      const m = {};
      snap.forEach(d => { m[d.id] = d.data(); });
      setUserMap(m);
    });
    return unsub;
  }, []);

  // ── Scanner lifecycle ─────────────────────────────────────────────────────
  const startScanner = async () => {
    setScanError('');
    setScanning(true);
    setScannerReady(false);
    mountedRef.current = true;

    await new Promise(r => setTimeout(r, 80)); // wait for DOM

    const scanner = new Html5Qrcode('qr-staff-reader');
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => handleQrScan(text.trim()),
        () => {},
      );
      setScannerReady(true);
    } catch (err) {
      setScanError('Camera access denied or unavailable. Use manual entry below.');
      setScanning(false);
    }
  };

  const stopScanner = () => {
    mountedRef.current = false;
    setScannerReady(false);
    setScanning(false);
    if (scannerRef.current?.isRunning()) {
      scannerRef.current.stop().catch(() => {});
    }
  };

  useEffect(() => () => { mountedRef.current = false; scannerRef.current?.isRunning() && scannerRef.current.stop().catch(() => {}); }, []);

  // ── Core scan handler ─────────────────────────────────────────────────────
  const handleQrScan = async (idNumber) => {
    if (!mountedRef.current) return;

    // Cooldown: ignore same ID within 4 seconds
    const now = Date.now();
    if (cooldownRef.current[idNumber] && now - cooldownRef.current[idNumber] < 4000) return;
    cooldownRef.current[idNumber] = now;

    setScanStatus('processing');

    try {
      // Lookup user by idNumber
      const userSnap = await getDocs(query(collection(db, 'users'), where('idNumber', '==', idNumber), limit(1)));
      if (userSnap.empty) {
        setLastScan({ idNumber, student: null });
        setScanStatus('unknown');
        return;
      }

      const userDoc  = userSnap.docs[0];
      const student  = { id: userDoc.id, ...userDoc.data() };

      // Check for active session
      const sessSnap = await getDocs(query(collection(db, 'logger'), where('uid', '==', student.id), where('active', '==', true), limit(1)));

      if (!sessSnap.empty) {
        // Student IS in library → check them OUT
        const sessDoc = sessSnap.docs[0];
        await updateDoc(doc(db, 'logger', sessDoc.id), {
          active:   false,
          exitTime: serverTimestamp(),
        });
        setLastScan({ idNumber, student, action: 'out' });
        setScanStatus('success');
      } else {
        // Student NOT in library → need purpose then check IN
        stopScanner();
        setPurposeForId({ idNumber, student });
        setChosenPurpose('');
        setScanStatus('idle');
        return;
      }
    } catch (err) {
      setScanStatus('error');
      setLastScan({ idNumber, error: err.message });
    }

    // Reset after 3 seconds
    setTimeout(() => { if (mountedRef.current) setScanStatus('idle'); setLastScan(null); }, 3000);
  };

  const confirmCheckIn = async () => {
    if (!purposeForId || !chosenPurpose) return;
    setManualLoading(true);
    try {
      await addDoc(collection(db, 'logger'), {
        uid:       purposeForId.student.id,
        purpose:   chosenPurpose,
        entryTime: serverTimestamp(),
        active:    true,
        scannedBy: userProfile?.uid || null,
      });
      setLastScan({ idNumber: purposeForId.idNumber, student: purposeForId.student, action: 'in', purpose: chosenPurpose });
      setScanStatus('success');
      setPurposeForId(null);
      setChosenPurpose('');
      // Restart scanner after short delay
      setTimeout(() => {
        setScanStatus('idle');
        setLastScan(null);
        startScanner();
      }, 2500);
    } catch (err) {
      setScanStatus('error');
    }
    setManualLoading(false);
  };

  // ── Manual entry ──────────────────────────────────────────────────────────
  const formatManual = (raw) => {
    const d = raw.replace(/\D/g, '').slice(0, 10);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `${d.slice(0, 2)}-${d.slice(2)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualId || !manualPurpose) return;
    setManualLoading(true);
    setManualMsg(null);

    try {
      const userSnap = await getDocs(query(collection(db, 'users'), where('idNumber', '==', manualId), limit(1)));
      if (userSnap.empty) {
        setManualMsg({ ok: false, text: `No account found for ID ${manualId}.` });
        setManualLoading(false); return;
      }
      const student = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };

      const sessSnap = await getDocs(query(collection(db, 'logger'), where('uid', '==', student.id), where('active', '==', true), limit(1)));

      if (!sessSnap.empty) {
        await updateDoc(doc(db, 'logger', sessSnap.docs[0].id), { active: false, exitTime: serverTimestamp() });
        setManualMsg({ ok: true, text: `${student.lastName}, ${student.firstName} checked OUT.` });
      } else {
        await addDoc(collection(db, 'logger'), {
          uid: student.id, purpose: manualPurpose, entryTime: serverTimestamp(), active: true,
          scannedBy: userProfile?.uid || null, manual: true,
        });
        setManualMsg({ ok: true, text: `${student.lastName}, ${student.firstName} checked IN — ${manualPurpose}.` });
      }
      setManualId(''); setManualFormat(''); setManualPurpose('');
    } catch (err) {
      setManualMsg({ ok: false, text: `Error: ${err.message}` });
    }
    setManualLoading(false);
    setTimeout(() => setManualMsg(null), 5000);
  };

  const thSt = { ...S, fontSize: '9px', letterSpacing: '0.14em', color: '#475569', textTransform: 'uppercase', padding: '10px 14px', textAlign: 'left', background: '#060e1e', borderBottom: '1px solid rgba(255,255,255,0.07)' };
  const tdSt = { padding: '10px 14px', fontSize: '13px', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.05)' };

  return (
    <div style={{ animation: 'fadeSlideUp 0.35s ease both' }}>
      <style>{`@keyframes fadeSlideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <p style={{ ...S, fontSize: '9px', letterSpacing: '0.22em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '6px' }}>Library Logger</p>
        <h1 style={{ ...D, fontSize: 'clamp(22px,4vw,30px)', fontWeight: 700, color: '#f1f5f9' }}>QR Check-In Scanner</h1>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>Scan a student's library QR code to check them in or out instantly.</p>
        <div style={{ marginTop: '16px', height: '1px', background: 'linear-gradient(90deg, #f59e0b22, #f59e0b44, transparent)' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,420px) 1fr', gap: '24px', alignItems: 'start', flexWrap: 'wrap' }} className="qr-grid">
        <style>{`.qr-grid { @media(max-width:800px) { grid-template-columns: 1fr !important; } }`}</style>

        {/* Left: scanner panel */}
        <div>
          {/* Purpose prompt (check-in) */}
          {purposeForId && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
              <p style={{ ...S, fontSize: '9px', letterSpacing: '0.18em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '8px' }}>Select Purpose</p>
              <p style={{ ...D, fontSize: '16px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' }}>
                {purposeForId.student.lastName}, {purposeForId.student.firstName}
              </p>
              <p style={{ ...S, fontSize: '11px', color: '#64748b', marginBottom: '16px' }}>{purposeForId.idNumber}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '14px' }}>
                {VISIT_PURPOSES.map(p => (
                  <button key={p} type="button" onClick={() => setChosenPurpose(p)}
                    style={{ padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', background: chosenPurpose === p ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${chosenPurpose === p ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.07)'}`, ...S, fontSize: '10px', color: chosenPurpose === p ? '#f59e0b' : '#64748b' }}>
                    {p}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => { setPurposeForId(null); startScanner(); }}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b', cursor: 'pointer', ...S, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Cancel
                </button>
                <button onClick={confirmCheckIn} disabled={!chosenPurpose || manualLoading}
                  style={{ flex: 2, padding: '10px', borderRadius: '8px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', color: '#34d399', cursor: !chosenPurpose ? 'not-allowed' : 'pointer', opacity: !chosenPurpose ? 0.5 : 1, ...S, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                  {manualLoading ? 'Checking In…' : 'Confirm Check-In'}
                </button>
              </div>
            </div>
          )}

          {/* Scan result overlay */}
          {scanStatus === 'success' && lastScan && (
            <div style={{ background: lastScan.action === 'in' ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)', border: `1px solid ${lastScan.action === 'in' ? 'rgba(16,185,129,0.35)' : 'rgba(59,130,246,0.35)'}`, borderRadius: '12px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: lastScan.action === 'in' ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                {lastScan.action === 'in' ? '→' : '←'}
              </div>
              <div>
                <p style={{ ...D, fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>
                  {lastScan.student ? `${lastScan.student.lastName}, ${lastScan.student.firstName}` : lastScan.idNumber}
                </p>
                <p style={{ ...S, fontSize: '10px', color: lastScan.action === 'in' ? '#34d399' : '#60a5fa', marginTop: '2px' }}>
                  {lastScan.action === 'in' ? `Checked IN — ${lastScan.purpose}` : 'Checked OUT'}
                </p>
              </div>
            </div>
          )}

          {scanStatus === 'unknown' && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
              <p style={{ ...S, fontSize: '11px', color: '#f87171' }}>No account found for ID: {lastScan?.idNumber}</p>
            </div>
          )}

          {/* Camera view */}
          {!purposeForId && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
              {!scanning ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ width: 60, height: 60, margin: '0 auto 16px', borderRadius: '12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
                    ▣
                  </div>
                  <p style={{ ...D, fontSize: '17px', fontWeight: 700, color: '#f1f5f9', marginBottom: '8px' }}>Camera Not Active</p>
                  <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>Start the scanner to check students in or out using their QR code.</p>
                  <button onClick={startScanner}
                    style={{ padding: '11px 28px', borderRadius: '10px', background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', cursor: 'pointer', ...S, fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700 }}>
                    Start Scanner
                  </button>
                  {scanError && <p style={{ ...S, fontSize: '11px', color: '#f87171', marginTop: '12px' }}>{scanError}</p>}
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: scannerReady ? '#10b981' : '#f59e0b', display: 'inline-block', animation: 'pulse-dot 1.5s infinite' }} />
                      <p style={{ ...S, fontSize: '9px', letterSpacing: '0.14em', color: '#64748b', textTransform: 'uppercase' }}>
                        {scannerReady ? 'Scanner Active' : 'Starting…'}
                      </p>
                    </div>
                    <button onClick={stopScanner}
                      style={{ ...S, fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: '7px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', cursor: 'pointer' }}>
                      Stop
                    </button>
                  </div>
                  <div id="qr-staff-reader" style={{ borderRadius: '10px', overflow: 'hidden', background: '#000' }} />
                  <p style={{ ...S, fontSize: '10px', color: '#334155', textAlign: 'center', marginTop: '10px' }}>
                    Point camera at student's QR code
                  </p>
                </>
              )}
            </div>
          )}

          {/* Manual entry */}
          <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
            <p style={{ ...S, fontSize: '9px', letterSpacing: '0.18em', color: '#64748b', textTransform: 'uppercase', marginBottom: '12px' }}>Manual Entry</p>
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text" inputMode="numeric"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#e2e8f0', fontFamily: 'inherit', outline: 'none', ...S, letterSpacing: '0.12em', boxSizing: 'border-box', width: '100%' }}
                placeholder="22-12345-123"
                value={manualFormat}
                onChange={e => { const f = formatManual(e.target.value); setManualFormat(f); setManualId(f); }}
              />
              <select
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#e2e8f0', fontFamily: 'inherit', outline: 'none', appearance: 'none', cursor: 'pointer', width: '100%' }}
                value={manualPurpose} onChange={e => setManualPurpose(e.target.value)}>
                <option value="">— Purpose of Visit —</option>
                {VISIT_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <button type="submit" disabled={!manualId || !manualPurpose || manualLoading}
                style={{ padding: '10px', borderRadius: '8px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', cursor: 'pointer', ...S, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, opacity: (!manualId || !manualPurpose || manualLoading) ? 0.4 : 1 }}>
                {manualLoading ? 'Processing…' : 'Log Entry / Exit'}
              </button>
            </form>
            {manualMsg && (
              <div style={{ marginTop: '10px', background: manualMsg.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${manualMsg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '8px', padding: '10px 12px' }}>
                <p style={{ ...S, fontSize: '11px', color: manualMsg.ok ? '#34d399' : '#f87171' }}>{manualMsg.text}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: live sessions */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse-dot 1.5s infinite' }} />
            <p style={{ ...S, fontSize: '10px', letterSpacing: '0.14em', color: '#94a3b8', textTransform: 'uppercase' }}>
              Currently in Library — <strong style={{ color: '#e2e8f0' }}>{liveSessions.length}</strong>
            </p>
          </div>

          <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
            {liveSessions.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <p style={{ ...S, fontSize: '11px', color: '#334155' }}>No students currently in the library.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Student', 'ID Number', 'Purpose', 'Entry', 'Duration'].map(h => (
                        <th key={h} style={thSt}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {liveSessions.map(s => {
                      const u = userMap[s.uid];
                      const name = u ? `${u.lastName}, ${u.firstName}` : '—';
                      return (
                        <tr key={s.id} style={{ cursor: 'default' }}>
                          <td style={tdSt}>
                            <p style={{ fontWeight: 600, fontSize: '13px', color: '#e2e8f0' }}>{name}</p>
                          </td>
                          <td style={{ ...tdSt, ...S, fontSize: '11px', color: '#64748b' }}>{u?.idNumber ?? '—'}</td>
                          <td style={{ ...tdSt, fontSize: '12px', color: '#94a3b8' }}>{s.purpose}</td>
                          <td style={{ ...tdSt, ...S, fontSize: '11px', color: '#64748b' }}>{fmtTime(s.entryTime)}</td>
                          <td style={{ ...tdSt, ...S, fontSize: '11px', color: '#94a3b8' }}><LiveDur entryTime={s.entryTime} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p style={{ ...S, fontSize: '9px', color: '#334155', marginTop: '10px' }}>
            Scan a student's QR code to toggle their check-in/out status.
          </p>
        </div>
      </div>

      <style>{`@keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
