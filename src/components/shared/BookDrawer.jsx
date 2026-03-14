// src/components/shared/BookDrawer.jsx
import { useState, useEffect } from 'react';
import { COLLEGES, CATALOG_FILTER_GROUPS } from '../../data/colleges';

const S = { fontFamily: "'IBM Plex Mono', monospace" };
const D = { fontFamily: "'Playfair Display', serif" };

const CATEGORIES = [
  'Arts & Humanities','Business & Economics','Computer Science','Education',
  'Engineering','Health & Medicine','History','Law','Literature','Mathematics',
  'Natural Sciences','Philosophy','Political Science','Psychology','Religion',
  'Social Sciences','Other',
];

const EMPTY = {
  title: '', authors: '', isbn: '', publisher: '', edition: '',
  category: '', shelfLocation: '', totalCopies: '', availableCopies: '',
  description: '', courses: [],
};

export default function BookDrawer({ book, saving, onSave, onClose }) {
  const [form,    setForm]    = useState(EMPTY);
  const [courseInput, setCourseInput] = useState('');

  useEffect(() => {
    if (book) {
      setForm({
        title:           book.title           || '',
        authors:         book.authors         || '',
        isbn:            book.isbn            || '',
        publisher:       book.publisher       || '',
        edition:         book.edition         || '',
        category:        book.category        || '',
        shelfLocation:   book.shelfLocation   || '',
        totalCopies:     book.totalCopies     ?? '',
        availableCopies: book.availableCopies ?? '',
        description:     book.description     || '',
        courses:         Array.isArray(book.courses) ? book.courses : [],
      });
    } else {
      setForm(EMPTY);
    }
  }, [book]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleCourse = (c) => {
    setForm(f => ({
      ...f,
      courses: f.courses.includes(c)
        ? f.courses.filter(x => x !== c)
        : [...f.courses, c],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      totalCopies:     parseInt(form.totalCopies,     10) || 0,
      availableCopies: parseInt(form.availableCopies, 10) || 0,
    });
  };

  const inputSt = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#e2e8f0',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };

  const labelSt = { ...S, fontSize: '9px', letterSpacing: '0.16em', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '5px' };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100%', width: '100%', maxWidth: '460px',
        background: '#0a1730', borderLeft: '1px solid rgba(255,255,255,0.08)', zIndex: 50,
        display: 'flex', flexDirection: 'column', boxShadow: '-24px 0 64px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ ...S, fontSize: '8px', letterSpacing: '0.2em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '4px' }}>{book ? 'Edit Book' : 'Add New Book'}</p>
            <h2 style={{ ...D, fontSize: '17px', fontWeight: 700, color: '#f1f5f9' }}>{book ? book.title : 'New Entry'}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelSt}>Title <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={inputSt} value={form.title} onChange={e => set('title', e.target.value)} required />
          </div>
          <div>
            <label style={labelSt}>Authors</label>
            <input style={inputSt} placeholder="Last, First; Last, First" value={form.authors} onChange={e => set('authors', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelSt}>ISBN</label>
              <input style={inputSt} value={form.isbn} onChange={e => set('isbn', e.target.value)} />
            </div>
            <div>
              <label style={labelSt}>Edition</label>
              <input style={inputSt} placeholder="e.g. 3rd" value={form.edition} onChange={e => set('edition', e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelSt}>Publisher</label>
            <input style={inputSt} value={form.publisher} onChange={e => set('publisher', e.target.value)} />
          </div>
          <div>
            <label style={labelSt}>Category</label>
            <select style={{ ...inputSt, appearance: 'none', cursor: 'pointer' }} value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="">— Select Category —</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelSt}>Shelf Location</label>
            <input style={inputSt} placeholder="e.g. Sec. B, Row 4" value={form.shelfLocation} onChange={e => set('shelfLocation', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelSt}>Total Copies</label>
              <input type="number" min="0" style={inputSt} value={form.totalCopies} onChange={e => set('totalCopies', e.target.value)} />
            </div>
            <div>
              <label style={labelSt}>Available Copies</label>
              <input type="number" min="0" style={inputSt} value={form.availableCopies} onChange={e => set('availableCopies', e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelSt}>Description</label>
            <textarea style={{ ...inputSt, height: '72px', resize: 'none' }} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          {/* Course tags */}
          <div>
            <label style={labelSt}>Recommended Courses</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', maxHeight: '160px', overflowY: 'auto' }}>
              {CATALOG_FILTER_GROUPS.map(group => (
                <div key={group.group} style={{ width: '100%' }}>
                  <p style={{ ...S, fontSize: '7px', letterSpacing: '0.14em', color: '#334155', textTransform: 'uppercase', padding: '4px 2px', marginTop: '4px' }}>{group.group.replace('College of ', '')}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                    {group.subjects.map(c => (
                      <button key={c} type="button" onClick={() => toggleCourse(c)}
                        style={{
                          ...S, fontSize: '9px', padding: '3px 8px', borderRadius: '5px', cursor: 'pointer',
                          background: form.courses.includes(c) ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${form.courses.includes(c) ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.07)'}`,
                          color: form.courses.includes(c) ? '#f59e0b' : '#475569',
                        }}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {form.courses.length > 0 && (
              <p style={{ ...S, fontSize: '9px', color: '#475569', marginTop: '4px' }}>{form.courses.length} course{form.courses.length !== 1 ? 's' : ''} selected</p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', paddingTop: '8px', paddingBottom: '8px' }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '11px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b', cursor: 'pointer', ...S, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ flex: 2, padding: '11px', borderRadius: '10px', background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', cursor: saving ? 'not-allowed' : 'pointer', ...S, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : book ? 'Save Changes' : 'Add Book'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
