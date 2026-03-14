// src/context/LibrarySessionContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';

const LibrarySessionContext = createContext(null);

export function LibrarySessionProvider({ children }) {
  const { currentUser, effectiveUid } = useAuth();
  const [session, setSession] = useState(undefined); // undefined = loading
  const [elapsed, setElapsed] = useState(0);

  // Real-time listener for the current user's active session
  useEffect(() => {
    // Wait until effectiveUid is resolved — for QR ghost accounts this arrives
    // slightly after currentUser, so we must gate on effectiveUid not currentUser
    if (!currentUser) { setSession(null); return; }
    if (!effectiveUid) return; // still resolving ghost → real UID, wait

    const q = query(
      collection(db, 'logger'),
      where('uid',    '==', effectiveUid),
      where('active', '==', true),
    );

    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setSession(null);
      } else {
        const d = snap.docs[0];
        setSession({ id: d.id, ...d.data() });
      }
    });

    return unsub;
  }, [currentUser, effectiveUid]);

  // Tick every second
  useEffect(() => {
    if (!session) { setElapsed(0); return; }
    const tick = () => {
      const entryDate = session.entryTime?.toDate?.();
      if (!entryDate) { setElapsed(0); return; }
      const secs = Math.max(0, Math.floor((Date.now() - entryDate.getTime()) / 1000));
      setElapsed(secs);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session]);

  const checkIn = async (purpose) => {
    if (!effectiveUid || session) return;
    await addDoc(collection(db, 'logger'), {
      uid:       effectiveUid,
      purpose,
      entryTime: serverTimestamp(),
      active:    true,
    });
  };

  const checkOut = async () => {
    if (!session) return;
    await updateDoc(doc(db, 'logger', session.id), {
      active:   false,
      exitTime: serverTimestamp(),
    });
  };

  const forceCheckOut = async (sessionId) => {
    await updateDoc(doc(db, 'logger', sessionId), {
      active:       false,
      exitTime:     serverTimestamp(),
      forcedLogout: true,
    });
  };

  const markWebSignedOut = async () => {
    if (!session) return;
    await updateDoc(doc(db, 'logger', session.id), {
      webSignedOut: true,
    });
  };

  return (
    <LibrarySessionContext.Provider value={{
      session, elapsed, checkIn, checkOut, forceCheckOut, markWebSignedOut,
    }}>
      {children}
    </LibrarySessionContext.Provider>
  );
}

export function useLibrarySession() {
  return useContext(LibrarySessionContext);
}
