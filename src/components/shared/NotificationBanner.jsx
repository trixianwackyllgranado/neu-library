// src/components/shared/NotificationBanner.jsx
// Persistent: shows unresolved notifications even after re-login (acknowledged=false OR acknowledged=true but not resolved)
// Students see unacknowledged ones; dismissing counts as acknowledged
// Staff/admin see follow-up button after acknowledgment

import { useEffect, useState } from 'react';
import {
  collection, query, where, onSnapshot,
  updateDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase/config';

const PP = { fontFamily: "'Poppins', sans-serif" };
const MN = { fontFamily: "'IBM Plex Mono', monospace" };

export default function NotificationBanner({ userId }) {
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    if (!userId) return;
    // Show all unresolved notifications — including previously acknowledged ones
    // so they persist across logins until staff resolves the case
    return onSnapshot(
      query(
        collection(db, 'notifications'),
        where('toUid',    '==', userId),
        where('resolved', '==', false),
      ),
      snap => setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [userId]);

  const acknowledge = async (id) => {
    await updateDoc(doc(db, 'notifications', id), {
      acknowledged:   true,
      acknowledgedAt: serverTimestamp(),
    });
  };

  if (notifs.length === 0) return null;

  return (
    <div style={{ background: 'var(--gold-soft)', borderBottom: '1px solid var(--gold-border)' }}>
      {notifs.map(n => (
        <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 20px', gap: 16, flexWrap: 'wrap', borderBottom: '1px solid var(--gold-border)', opacity: n.acknowledged ? 0.75 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
            <div style={{ flexShrink: 0, marginTop: 2, color: n.acknowledged ? 'var(--text-muted)' : 'var(--gold)' }}>
              {n.acknowledged ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ ...MN, fontSize: 10, fontWeight: 600, color: n.acknowledged ? 'var(--text-muted)' : 'var(--gold)', marginBottom: 3, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Library Staff — {n.sentByName || 'Library Staff'}
                {n.followUp && ' (Follow-up)'}
                {n.acknowledged && ' · Acknowledged'}
              </p>
              <p style={{ ...PP, fontSize: 14, color: 'var(--text-body)', lineHeight: 1.55 }}>{n.message}</p>
            </div>
          </div>

          {/* Only show Acknowledge if not yet acknowledged */}
          {!n.acknowledged && (
            <button
              onClick={() => acknowledge(n.id)}
              style={{ ...PP, fontSize: 12, fontWeight: 600, padding: '8px 18px', borderRadius: 8, background: 'var(--card)', border: '1px solid var(--gold-border)', color: 'var(--gold)', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}
            >
              Acknowledge
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
