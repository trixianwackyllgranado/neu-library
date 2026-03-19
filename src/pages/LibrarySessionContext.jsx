// src/context/LibrarySessionContext.jsx
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';

const LibrarySessionContext = createContext(null);

export function LibrarySessionProvider({ children }) {
  const { currentUser, userProfile } = useAuth();
  const [session, setSession] = useState(undefined); // undefined = loading
  const [elapsed, setElapsed] = useState(0);

  const checkInFlight = useRef(false);

  useEffect(() => {
    if (!userProfile?.uid) { setSession(null); return; }
    const q = query(
      collection(db, 'logger'),
      where('uid',    '==', userProfile.uid),
      where('active', '==', true),
    );
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) setSession(null);
      else { const d = snap.docs[0]; setSession({ id: d.id, ...d.data() }); }
    });
    return unsub;
  }, [userProfile?.uid]);

  useEffect(() => {
    if (!session) { setElapsed(0); return; }
    const tick = () => {
      const entryDate = session.entryTime?.toDate?.();
      if (!entryDate) { setElapsed(0); return; }
      setElapsed(Math.max(0, Math.floor((Date.now() - entryDate.getTime()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session]);

  // ── checkIn — snapshots visitor identity into the logger doc ──────────────
  // This means even if the user is later deleted from Firestore, their name,
  // ID number, and course are permanently preserved in the log entry.
  const checkIn = async (purpose) => {
    if (!userProfile?.uid) return;
    if (session !== null && session !== undefined) return;
    if (checkInFlight.current) return;

    checkInFlight.current = true;
    try {
      await addDoc(collection(db, 'logger'), {
        uid:            userProfile.uid,
        purpose,
        entryTime:      serverTimestamp(),
        active:         true,
        // ── Identity snapshot — frozen at time of check-in ──────────────────
        studentName:    `${userProfile.lastName}, ${userProfile.firstName}`,
        studentIdNumber: userProfile.idNumber || '',
        studentCourse:  userProfile.course || '',
        studentCollege: userProfile.college || '',
      });
    } finally {
      setTimeout(() => { checkInFlight.current = false; }, 2000);
    }
  };

  // ── Staff kiosk check-in — called with a full user profile object ──────────
  const staffCheckIn = async (visitorProfile, purpose) => {
    if (!visitorProfile?.uid) return;
    // Check for existing active session first
    const existingSnap = await import('firebase/firestore').then(({ getDocs, query: q2, collection: col, where: w, limit: lim }) =>
      getDocs(q2(col(db, 'logger'), w('uid', '==', visitorProfile.uid), w('active', '==', true), lim(1)))
    );
    if (!existingSnap.empty) {
      // Already checked in — check them out instead
      await updateDoc(doc(db, 'logger', existingSnap.docs[0].id), {
        active:   false,
        exitTime: serverTimestamp(),
      });
      return 'out';
    }
    await addDoc(collection(db, 'logger'), {
      uid:             visitorProfile.uid,
      purpose,
      entryTime:       serverTimestamp(),
      active:          true,
      staffLogged:     true,
      // Identity snapshot
      studentName:    `${visitorProfile.lastName}, ${visitorProfile.firstName}`,
      studentIdNumber: visitorProfile.idNumber || '',
      studentCourse:  visitorProfile.course || '',
      studentCollege: visitorProfile.college || '',
    });
    return 'in';
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
      session, elapsed, checkIn, checkOut, forceCheckOut, markWebSignedOut, staffCheckIn,
    }}>
      {children}
    </LibrarySessionContext.Provider>
  );
}

export function useLibrarySession() {
  return useContext(LibrarySessionContext);
}
