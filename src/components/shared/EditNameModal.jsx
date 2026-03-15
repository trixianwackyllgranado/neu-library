// src/components/shared/EditNameModal.jsx
// Admin-only — edit a user's first name, last name, and middle initial
import { useState } from 'react';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

const PP = { fontFamily: "'Poppins', sans-serif" };
const SR = { fontFamily: "'Playfair Display', serif" };
const MN = { fontFamily: "'IBM Plex Mono', monospace" };

export default function EditNameModal({ onClose, targetUid, targetProfile }) {
  const { userProfile } = useAuth();

  const [lastName,      setLastName]      = useState(targetProfile?.lastName      || '');
  const [firstName,     setFirstName]     = useState(targetProfile?.firstName     || '');
  const [middleInitial, setMiddleInitial] = useState(targetProfile?.middleInitial || '');
  const [reason,        setReason]        = useState('');
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [success,       setSuccess]       = useState(false);

  const inputSt = {
    width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)',
    borderRadius: 10, padding: '11px 14px', fontSize: 14,
    color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.15s',
    textTransform: 'uppercase',
  };

  const onFocus = e => { e.currentTarget.style.borderColor = 'var(--gold)'; };
  const onBlur  = e => { e.currentTarget.style.borderColor = 'var(--input-border)'; };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!lastName.trim())  { setError('Last name is required.'); return; }
    if (!firstName.trim()) { setError('First name is required.'); return; }
    if (reason.trim().length < 5) { setError('Please provide a reason (min 5 characters).'); return; }

    const newLast  = lastName.trim().toUpperCase();
    const newFirst = firstName.trim().toUpperCase();
    const newMI    = middleInitial.trim().toUpperCase().replace(/\.+$/, '');

    const oldName = `${targetProfile.lastName}, ${targetProfile.firstName}${targetProfile.middleInitial ? ' ' + targetProfile.middleInitial : ''}`;
    const newName = `${newLast}, ${newFirst}${newMI ? ' ' + newMI : ''}`;

    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', targetUid), {
        lastName:      newLast,
        firstName:     newFirst,
        middleInitial: newMI,
      });
      await addDoc(collection(db, 'adminAuditLogs'), {
        activityType:  'name_change',
        targetId:      targetUid,
        targetName:    newName,
        oldName,
        newName,
        changedBy:     userProfile?.uid,
        changedByName: `${userProfile?.lastName}, ${userProfile?.firstName}`,
        reason:        reason.trim(),
        timestamp:     serverTimestamp(),
      });
      setSuccess(true);
      setTimeout(onClose, 1600);
    } catch (err) {
      setError(err.message || 'Failed to update name.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', padding: 16, animation: 'fadeIn 0.18s ease both' }}
    >
      <div style={{ width: '100%', maxWidth: 460, background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-modal)', animation: 'slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--gold), transparent)' }} />

        <div style={{ padding: '28px 28px 24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
            <div>
              <p style={{ ...MN, fontSize: 9, letterSpacing: '0.22em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 6 }}>Admin Action</p>
              <h2 style={{ ...SR, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Edit Name</h2>
              <p style={{ ...MN, fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {targetProfile?.idNumber} — Current: {targetProfile?.lastName}, {targetProfile?.firstName}
              </p>
            </div>
            <button onClick={onClose} disabled={loading}
              style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Warning banner */}
          <div style={{ background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, marginTop:1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p style={{ ...PP, fontSize: 12, color: 'var(--gold)', lineHeight: 1.5 }}>This action is logged in the audit trail. A reason is required and cannot be edited after saving.</p>
          </div>

          {success ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--green-soft)', border: '1px solid var(--green-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--green)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p style={{ ...PP, fontSize: 15, fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>Name Updated</p>
              <p style={{ ...PP, fontSize: 13, color: 'var(--text-muted)' }}>Change has been saved and logged.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && (
                <div style={{ background: 'var(--red-soft)', border: '1px solid var(--red-border)', borderRadius: 10, padding: '11px 14px' }}>
                  <p style={{ ...MN, fontSize: 12, color: 'var(--red)' }}>{error}</p>
                </div>
              )}

              {/* Last + First */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ ...MN, fontSize: 9, letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 7, fontWeight: 600 }}>
                    Last Name <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <input
                    style={inputSt} value={lastName} required autoFocus
                    placeholder="SANTOS"
                    onChange={e => { setLastName(e.target.value.toUpperCase()); setError(''); }}
                    onFocus={onFocus} onBlur={onBlur}
                  />
                </div>
                <div>
                  <label style={{ ...MN, fontSize: 9, letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 7, fontWeight: 600 }}>
                    First Name <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <input
                    style={inputSt} value={firstName} required
                    placeholder="JUAN"
                    onChange={e => { setFirstName(e.target.value.toUpperCase()); setError(''); }}
                    onFocus={onFocus} onBlur={onBlur}
                  />
                </div>
              </div>

              {/* Middle Initial */}
              <div style={{ maxWidth: 100 }}>
                <label style={{ ...MN, fontSize: 9, letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 7, fontWeight: 600 }}>
                  Middle Initial
                </label>
                <input
                  style={{ ...inputSt, textAlign: 'center' }}
                  value={middleInitial} maxLength={2}
                  placeholder="D"
                  onChange={e => setMiddleInitial(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                  onFocus={onFocus} onBlur={onBlur}
                />
              </div>

              {/* Reason — required for audit */}
              <div>
                <label style={{ ...MN, fontSize: 9, letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 7, fontWeight: 600 }}>
                  Reason <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <textarea
                  style={{ ...inputSt, height: 72, resize: 'none', textTransform: 'none' }}
                  placeholder="e.g. Corrected misspelling in registration…"
                  value={reason}
                  onChange={e => { setReason(e.target.value); setError(''); }}
                  onFocus={onFocus} onBlur={onBlur}
                  required
                />
                <p style={{ ...MN, fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>{reason.trim().length} / 5 characters minimum</p>
              </div>

              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button type="button" onClick={onClose} disabled={loading}
                  style={{ flex: 1, padding: 12, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', cursor: 'pointer', ...PP, fontSize: 13, fontWeight: 500, transition: 'all 0.15s' }}>
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  style={{ flex: 2, padding: 12, borderRadius: 10, background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', color: 'var(--gold)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1, ...MN, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, transition: 'all 0.15s' }}>
                  {loading ? 'Saving…' : 'Save & Log Change'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(24px) scale(0.97)} to{opacity:1;transform:none} }
      `}</style>
    </div>
  );
}
