// src/components/shared/NotificationBanner.jsx
// Shows unresolved + unacknowledged notifications.
// Once acknowledged, the notification is hidden from the student's view.
// Staff can still see and Follow Up / Resolve from their side (LoggerPage/BorrowingPage).

import { useEffect, useState } from 'react';
import {
  collection, query, where, onSnapshot,
  updateDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase/config';

const PP = { fontFamily: "'Poppins', sans-serif" };
const MN = { fontFamily: "'IBM Plex Mono', monospace" };

export default function NotificationBanner({ userId }) {
  const [notifs,    setNotifs]    = useState([]);
  const [dismissed, setDismissed] = useState(new Set()); // instant local hide before Firestore round-trip

  useEffect(() => {
    if (!userId) return;
    // Only show unresolved AND unacknowledged — once student acknowledges, it disappears
    return onSnapshot(
      query(
        collection(db, 'notifications'),
        where('toUid',        '==', userId),
        where('resolved',     '==', false),
        where('acknowledged', '==', false),
      ),
      snap => setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [userId]);

  const acknowledge = async (id) => {
    // Instantly hide from UI — don't wait for Firestore round-trip
    setDismissed(prev => new Set([...prev, id]));
    await updateDoc(doc(db, 'notifications', id), {
      acknowledged:   true,
      acknowledgedAt: serverTimestamp(),
    });
  };

  const visible = notifs.filter(n => !dismissed.has(n.id));
  if (visible.length === 0) return null;

  return (
    <div style={{ background: 'var(--gold-soft)', borderBottom: '1px solid var(--gold-border)' }}>
      {visible.map(n => (
        <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 20px', gap: 16, flexWrap: 'wrap', borderBottom: '1px solid var(--gold-border)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
            <div style={{ flexShrink: 0, marginTop: 2, color: 'var(--gold)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ ...MN, fontSize: 10, fontWeight: 600, color: 'var(--gold)', marginBottom: 3, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Library Staff — {n.sentByName || 'Library Staff'}
                {n.followUp && ' · Follow-up'}
              </p>
              <p style={{ ...PP, fontSize: 14, color: 'var(--text-body)', lineHeight: 1.55 }}>{n.message}</p>
            </div>
          </div>
          <button
            onClick={() => acknowledge(n.id)}
            style={{ ...PP, fontSize: 12, fontWeight: 600, padding: '8px 18px', borderRadius: 8, background: 'var(--card)', border: '1px solid var(--gold-border)', color: 'var(--gold)', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}
          >
            Acknowledge
          </button>
        </div>
      ))}
    </div>
  );
}
