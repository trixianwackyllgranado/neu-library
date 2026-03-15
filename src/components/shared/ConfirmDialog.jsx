// src/components/shared/ConfirmDialog.jsx
const PP = { fontFamily: "'Poppins', sans-serif" };
const SR = { fontFamily: "'Playfair Display', serif" };

export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', confirmStyle = 'danger', onConfirm, onCancel }) {
  const btn = confirmStyle === 'danger'
    ? { background:'var(--red-soft)', border:'1px solid var(--red-border)', color:'var(--red)' }
    : { background:'var(--gold-soft)', border:'1px solid var(--gold-border)', color:'var(--gold)' };
  return (
    <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',padding:16}}>
      <div style={{width:'100%',maxWidth:420,background:'var(--card)',border:'1px solid var(--card-border)',borderRadius:16,overflow:'hidden',boxShadow:'var(--shadow-modal)'}}>
        <div style={{height:3,background:'linear-gradient(90deg,var(--gold),transparent)'}} />
        <div style={{padding:28}}>
          <p style={{...SR,fontSize:20,fontWeight:700,color:'var(--text-primary)',marginBottom:10}}>{title}</p>
          <p style={{...PP,fontSize:14,color:'var(--text-muted)',marginBottom:28,lineHeight:1.65}}>{message}</p>
          <div style={{display:'flex',justifyContent:'flex-end',gap:10}}>
            <button onClick={onCancel} style={{...PP,fontSize:13,fontWeight:500,padding:'10px 18px',borderRadius:9,background:'var(--surface)',border:'1px solid var(--card-border)',color:'var(--text-muted)',cursor:'pointer',transition:'all 0.15s'}}>Cancel</button>
            <button onClick={onConfirm} style={{...PP,fontSize:13,fontWeight:600,padding:'10px 20px',borderRadius:9,cursor:'pointer',transition:'all 0.15s',...btn}}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AlertDialog({ title, message, onClose }) {
  return (
    <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)',padding:16}}>
      <div style={{width:'100%',maxWidth:420,background:'var(--card)',border:'1px solid var(--card-border)',borderRadius:16,overflow:'hidden',boxShadow:'var(--shadow-modal)'}}>
        <div style={{height:3,background:'linear-gradient(90deg,var(--gold),transparent)'}} />
        <div style={{padding:28}}>
          <p style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:'var(--text-primary)',marginBottom:10}}>{title}</p>
          <p style={{fontFamily:"'Poppins',sans-serif",fontSize:14,color:'var(--text-muted)',marginBottom:28,lineHeight:1.65}}>{message}</p>
          <div style={{display:'flex',justifyContent:'flex-end'}}>
            <button onClick={onClose} style={{fontFamily:"'Poppins',sans-serif",fontSize:13,fontWeight:600,padding:'10px 20px',borderRadius:9,background:'var(--gold-soft)',border:'1px solid var(--gold-border)',color:'var(--gold)',cursor:'pointer',transition:'all 0.15s'}}>Dismiss</button>
          </div>
        </div>
      </div>
    </div>
  );
}
