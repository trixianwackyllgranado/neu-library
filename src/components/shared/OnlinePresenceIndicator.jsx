// src/components/shared/OnlinePresenceIndicator.jsx
// Shows a green dot if the user is currently online in the web app,
// or a gray dot if offline. Used alongside the logger to show who
// is "in the web app" even if not visitor-checked-in.
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';

const MN = { fontFamily: "'IBM Plex Mono', monospace" };

/**
 * Renders a small dot with optional label.
 * @param {string} uid - User UID to track presence for
 * @param {boolean} showLabel - Whether to show "Online"/"Offline" text
 * @param {number} size - Dot size in px (default 8)
 */
export default function OnlinePresenceIndicator({ uid, showLabel = false, size = 8 }) {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'onlinePresence', uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        // Consider online if `online` is true AND lastSeen is within 2 minutes
        if (data.online) {
          const lastSeen = data.lastSeen?.toDate?.();
          const fresh = lastSeen ? (Date.now() - lastSeen.getTime() < 120_000) : true;
          setOnline(fresh);
        } else {
          setOnline(false);
        }
      } else {
        setOnline(false);
      }
    }, () => setOnline(false));
    return unsub;
  }, [uid]);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title={online ? 'User is in the web app' : 'User is offline'}>
      <span style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: online ? '#22c55e' : 'var(--text-dim)',
        opacity: online ? 1 : 0.4,
        flexShrink: 0,
        animation: online ? 'presencePulse 2s ease-in-out infinite' : 'none',
        boxShadow: online ? '0 0 4px rgba(34,197,94,0.5)' : 'none',
      }} />
      {showLabel && (
        <span style={{
          ...MN,
          fontSize: 9,
          letterSpacing: '0.08em',
          color: online ? '#22c55e' : 'var(--text-dim)',
          textTransform: 'uppercase',
        }}>
          {online ? 'Online' : 'Offline'}
        </span>
      )}
      <style>{`
        @keyframes presencePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </span>
  );
}

/**
 * Hook to batch-subscribe to multiple UIDs' presence at once.
 * Returns a Map<uid, boolean> of who's online.
 */
export function useOnlinePresenceMap(uids = []) {
  const [presenceMap, setPresenceMap] = useState({});

  useEffect(() => {
    if (!uids.length) { setPresenceMap({}); return; }

    const unsubs = uids.map(uid =>
      onSnapshot(doc(db, 'onlinePresence', uid), (snap) => {
        setPresenceMap(prev => {
          const next = { ...prev };
          if (snap.exists()) {
            const data = snap.data();
            const lastSeen = data.lastSeen?.toDate?.();
            const fresh = lastSeen ? (Date.now() - lastSeen.getTime() < 120_000) : true;
            next[uid] = data.online && fresh;
          } else {
            next[uid] = false;
          }
          return next;
        });
      }, () => {
        setPresenceMap(prev => ({ ...prev, [uid]: false }));
      })
    );

    return () => unsubs.forEach(u => u());
  }, [uids.join(',')]);

  return presenceMap;
}
