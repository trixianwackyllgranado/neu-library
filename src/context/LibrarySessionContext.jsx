// src/context/LibrarySessionContext.jsx
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp,
  getDocs, limit, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';

const LibrarySessionContext = createContext(null);

export function LibrarySessionProvider({ children }) {
  const { currentUser, userProfile } = useAuth();
  const [session, setSession] = useState(undefined); // undefined = loading
  const [elapsed, setElapsed] = useState(0);

  // Ref to prevent concurrent checkIn calls (spam protection)
  const checkInFlight = useRef(false);

  // On mount: deduplicate any existing active sessions — keep earliest, close the rest
  // This cleans up duplicates created by multi-device race conditions
  useEffect(() => {
    if (!userProfile?.uid) return;
    (async () => {
      const snap = await getDocs(
        query(collection(db, 'logger'),
          where('uid',    '==', userProfile.uid),
          where('active', '==', true)
        )
      );
      if (snap.size <= 1) return; // no duplicates
      // Sort by entryTime ascending — keep the first (earliest), close the rest
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.entryTime?.toMillis?.() ?? 0;
          const tb = b.entryTime?.toMillis?.() ?? 0;
          return ta - tb;
        });
      const batch = writeBatch(db);
      sorted.slice(1).forEach(s => {
        batch.update(doc(db, 'logger', s.id), {
          active: false, exitTime: serverTimestamp(), forcedLogout: true,
        });
      });
      await batch.commit();
    })();
  }, [userProfile?.uid]);

  // Real-time listener for the current user's active session
  useEffect(() => {
    if (!userProfile?.uid) { setSession(null); return; }

    const q = query(
      collection(db, 'logger'),
      where('uid',    '==', userProfile.uid),
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
  }, [userProfile?.uid]);

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
    if (!userProfile?.uid) return;
    if (session !== null && session !== undefined) return;
    if (checkInFlight.current) return;

    checkInFlight.current = true;
    try {
      // Atomic guard: query for any existing active session for this uid
      // before writing — prevents duplicate sessions from multi-device race conditions
      const existingSnap = await getDocs(
        query(collection(db, 'logger'),
          where('uid',    '==', userProfile.uid),
          where('active', '==', true),
          limit(1)
        )
      );
      if (!existingSnap.empty) return; // already checked in on another device

      await addDoc(collection(db, 'logger'), {
        uid:             userProfile.uid,
        purpose,
        entryTime:       serverTimestamp(),
        active:          true,
        studentName:     `${userProfile.lastName}, ${userProfile.firstName}`,
        studentIdNumber: userProfile.idNumber || '',
        studentCourse:   userProfile.course   || '',
        studentCollege:  userProfile.college  || '',
      });
    } finally {
      setTimeout(() => { checkInFlight.current = false; }, 2000);
    }
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
