// src/components/shared/EditProfileModal.jsx
import { useState } from 'react';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { COLLEGES } from '../../data/colleges';

const PP = { fontFamily: "'Poppins', sans-serif" };
const SR = { fontFamily: "'Playfair Display', serif" };
const MN = { fontFamily: "'IBM Plex Mono', monospace" };

// When admin edits another user, pass targetUid + targetProfile
// When user edits themselves, leave those undefined and use auth context
export default function EditProfileModal({ onClose, targetUid, targetProfile }) {
  const { userProfile, refreshProfile } = useAuth();

  const profile   = targetProfile || userProfile;
  const uid       = targetUid     || profile?.uid;
  const isAdmin   = !targetUid; // editing own profile vs admin editing someone else

  const [college, setCollege] = useState(profile?.college || '');
  const [course,  setCourse]  = useState(profile?.course  || '');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  const selectedCollege = COLLEGES.find(c => c.name === college);
  const courses = selectedCollege?.courses || [];

  const inputSt = {
    width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)',
    borderRadius: 10, padding: '11px 14px', fontSize: 14,
    color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.15s', appearance: 'none', cursor: 'pointer',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!college) { setError('Please select a college.'); return; }
    if (courses.length > 0 && !course) { setError('Please select a course.'); return; }
    setLoading(true);
    try {
      const newCollege = college.trim().toUpperCase();
      const newCourse  = (course.trim() || college.trim()).toUpperCase();
      await updateDoc(doc(db, 'users', uid), {
        college: newCollege,
        course:  newCourse,
      });
      // Write audit log when admin edits another user
      if (targetUid && userProfile) {
        await addDoc(collection(db, 'adminAuditLogs'), {
          activityType:  'program_change',
          targetId:      uid,
          targetName:    `${profile.lastName}, ${profile.firstName}`,
          oldProgram:    `${profile.college || '—'} / ${profile.course || '—'}`,
          newProgram:    `${newCollege} / ${newCourse}`,
          changedBy:     userProfile.uid,
          changedByName: `${userProfile.lastName}, ${userProfile.firstName}`,
          reason:        'Admin-edited college/course',
          timestamp:     serverTimestamp(),
        });
      }
      if (!targetUid) refreshProfile();
      setSuccess(true);
      setTimeout(onClose, 1600);
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', padding: 16, animation: 'fadeIn 0.18s ease both' }}
    >
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--shadow-modal)', animation: 'slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--gold), transparent)' }} />

        <div style={{ padding: '28px 28px 24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
            <div>
              <p style={{ ...MN, fontSize: 9, letterSpacing: '0.22em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 6 }}>Account Details</p>
              <h2 style={{ ...SR, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Edit College & Course</h2>
              {targetProfile && (
                <p style={{ ...MN, fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {targetProfile.lastName}, {targetProfile.firstName}
                </p>
              )}
            </div>
            <button onClick={onClose} disabled={loading}
              style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {success ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--green-soft)', border: '1px solid var(--green-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--green)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p style={{ ...PP, fontSize: 15, fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>Profile Updated</p>
              <p style={{ ...PP, fontSize: 13, color: 'var(--text-muted)' }}>College and course saved successfully.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && (
                <div style={{ background: 'var(--red-soft)', border: '1px solid var(--red-border)', borderRadius: 10, padding: '11px 14px' }}>
                  <p style={{ ...MN, fontSize: 12, color: 'var(--red)' }}>{error}</p>
                </div>
              )}

              {/* Current values hint */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ ...MN, fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Current values</p>
                <p style={{ ...PP, fontSize: 13, color: 'var(--text-body)' }}>
                  {profile?.college || '—'} / {profile?.course || '—'}
                </p>
              </div>

              {/* College */}
              <div>
                <label style={{ ...MN, fontSize: 9, letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 7, fontWeight: 600 }}>
                  College <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <select
                  style={inputSt}
                  value={college}
                  onChange={e => { setCollege(e.target.value); setCourse(''); setError(''); }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--gold)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--input-border)'; }}
                  required
                >
                  <option value="">— Select College —</option>
                  {COLLEGES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              {/* Course — only shown if college has courses */}
              {college && courses.length > 0 && (
                <div>
                  <label style={{ ...MN, fontSize: 9, letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 7, fontWeight: 600 }}>
                    Course <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <select
                    style={inputSt}
                    value={course}
                    onChange={e => { setCourse(e.target.value); setError(''); }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--gold)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--input-border)'; }}
                    required
                  >
                    <option value="">— Select Course —</option>
                    {courses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button type="button" onClick={onClose} disabled={loading}
                  style={{ flex: 1, padding: 12, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', cursor: 'pointer', ...PP, fontSize: 13, fontWeight: 500, transition: 'all 0.15s' }}>
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  style={{ flex: 2, padding: 12, borderRadius: 10, background: 'var(--gold-soft)', border: '1px solid var(--gold-border)', color: 'var(--gold)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1, ...MN, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, transition: 'all 0.15s' }}>
                  {loading ? 'Saving…' : 'Save Changes'}
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
