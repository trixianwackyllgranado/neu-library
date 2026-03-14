// src/components/shared/NotificationBanner.jsx
import { useEffect, useState } from 'react';
import {
  collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase/config';

const S = { fontFamily: "'IBM Plex Mono', monospace" };

export default function NotificationBanner({ userId }) {
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'notifications'),
      where('toUid', '==', userId),
      where('acknowledged', '==', false),
    );
    const unsub = onSnapshot(q, snap => {
      setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [userId]);

  const dismiss = async (id) => {
    await updateDoc(doc(db, 'notifications', id), {
      acknowledged:    true,
      acknowledgedAt:  serverTimestamp(),
    });
  };

  if (notifs.length === 0) return null;

  return (
    <div style={{ background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)', padding: '0' }}>
      {notifs.map(n => (
        <div key={n.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0 }} />
            <div>
              <p style={{ ...S, fontSize: '8px', letterSpacing: '0.16em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '2px' }}>
                Library Notification — {n.sentByName || 'Library Staff'}
              </p>
              <p style={{ fontSize: '13px', color: '#e2e8f0' }}>{n.message}</p>
            </div>
          </div>
          <button onClick={() => dismiss(n.id)}
            style={{ ...S, fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: '7px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', cursor: 'pointer', flexShrink: 0 }}>
            Acknowledge
          </button>
        </div>
      ))}
    </div>
  );
}
