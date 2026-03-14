// src/components/shared/NotificationBanner.jsx
import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';

const PP = { fontFamily: "'Poppins', sans-serif" };
const MN = { fontFamily: "'IBM Plex Mono', monospace" };

export default function NotificationBanner({ userId }) {
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    if (!userId) return;
    return onSnapshot(
      query(collection(db,'notifications'), where('toUid','==',userId), where('acknowledged','==',false)),
      snap => setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [userId]);

  const dismiss = async (id) => {
    await updateDoc(doc(db,'notifications',id), { acknowledged: true, acknowledgedAt: serverTimestamp() });
  };

  if (notifs.length === 0) return null;

  return (
    <div style={{ background: 'var(--gold-soft)', borderBottom: '1px solid var(--gold-border)' }}>
      {notifs.map(n => (
        <div key={n.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', gap:16, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:12, flex:1, minWidth:0 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--gold)', display:'inline-block', flexShrink:0, marginTop:6 }} />
            <div style={{ minWidth:0 }}>
              <p style={{ ...PP, fontSize:11, fontWeight:600, color:'var(--gold)', marginBottom:2 }}>
                Library Notification — {n.sentByName || 'Library Staff'}
              </p>
              <p style={{ ...PP, fontSize:14, color:'var(--text-body)', lineHeight:1.5 }}>{n.message}</p>
            </div>
          </div>
          <button onClick={() => dismiss(n.id)}
            style={{ ...PP, fontSize:12, fontWeight:600, padding:'7px 16px', borderRadius:8, background:'var(--gold-soft)', border:'1px solid var(--gold-border)', color:'var(--gold)', cursor:'pointer', flexShrink:0, transition:'all 0.15s' }}>
            Acknowledge
          </button>
        </div>
      ))}
    </div>
  );
}
