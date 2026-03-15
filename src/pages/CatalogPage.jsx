// src/pages/CatalogPage.jsx
import { useEffect, useState, useRef } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import BookDrawer from '../components/shared/BookDrawer';
import { CATALOG_FILTER_GROUPS } from '../data/colleges';
import ConfirmDialog, { AlertDialog } from '../components/shared/ConfirmDialog';

// ── CSV helpers ───────────────────────────────────────────────────────────────
function downloadTemplate() {
  const headers = ['title','authors','isbn','publisher','edition','category','shelfLocation','totalCopies','availableCopies','description','courses'];
  const example = ['Introduction to Psychology','Myers, David G.; DeWall, C. Nathan','978-1-319-07048-6','Worth Publishers','12th','Health & Medicine','Sec. B, Row 4','3','3','A comprehensive introduction to psychology concepts.','BS Nursing|Psychology|BS Medical Technology'];
  const csv = [headers, example].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`)  .join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: 'book-import-template.csv' }).click();
  URL.revokeObjectURL(url);
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  return lines.slice(1).map(line => {
    const values = [];
    let cur = '', inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i+1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === ',' && !inQuote) { values.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    values.push(cur.trim());
    const obj = {};
    headers.forEach((h,i) => { obj[h] = values[i] ?? ''; });
    return obj;
  }).filter(r => r.title?.trim());
}

function exportCSV(books) {
  const headers = ['title','authors','isbn','publisher','edition','category','shelfLocation','totalCopies','availableCopies','description','courses'];
  const rows = books.map(b => [
    b.title??'', b.authors??'', b.isbn??'', b.publisher??'', b.edition??'',
    b.category??'', b.shelfLocation??'', b.totalCopies??0, b.availableCopies??0,
    b.description??'', Array.isArray(b.courses) ? b.courses.join('|') : '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`) .join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: 'book-catalog.csv' }).click();
  URL.revokeObjectURL(url);
}

// ── Book activity logger ──────────────────────────────────────────────────────
async function logBookActivity(action, book, user) {
  try {
    await addDoc(collection(db, 'bookLogs'), {
      action,                                    // 'added' | 'edited' | 'deleted'
      bookId:    book.id   || null,
      bookTitle: book.title || '(untitled)',
      isbn:      book.isbn  || '',
      category:  book.category || '',
      by:        user?.uid  || null,
      byName:    user ? `${user.lastName ?? ''}, ${user.firstName ?? ''}`.trim() : 'Unknown',
      timestamp: serverTimestamp(),
    });
  } catch (_) {}
}

export default function CatalogPage() {
  const { userProfile, currentUser } = useAuth();
  const role      = userProfile?.role;
  const canEdit   = role === 'admin' || role === 'staff';
  const isAdmin   = role === 'admin';
  const isStudent = role === 'student';

  const [books,           setBooks]           = useState([]);
  const [search,          setSearch]          = useState('');
  const [loading,         setLoading]         = useState(true);

  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [editingBook,     setEditingBook]     = useState(null);
  const [saving,          setSaving]          = useState(false);

  // Bulk delete state
  const [selectMode,      setSelectMode]      = useState(false);
  const [selectedIds,     setSelectedIds]     = useState(new Set());
  const [bulkDeleting,    setBulkDeleting]    = useState(false);
  const [confirmBulk,     setConfirmBulk]     = useState(null); // 'selected' | 'all'

  // CSV import state
  const [importOpen,    setImportOpen]    = useState(false);
  const [importRows,    setImportRows]    = useState([]);
  const [importErrors,  setImportErrors]  = useState([]);
  const [importing,     setImporting]     = useState(false);
  const [importResult,  setImportResult]  = useState(null);
  const [importFile,    setImportFile]    = useState('');

  // Custom dialog state
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, message, confirmLabel, confirmStyle, onConfirm }
  const [alertDialog,   setAlertDialog]   = useState(null); // { title, message }

  const showAlert = (title, message) => setAlertDialog({ title, message });
  const askConfirm = (title, message, onConfirm, confirmLabel = 'Confirm', confirmStyle = 'danger') =>
    new Promise(resolve => setConfirmDialog({
      title, message, confirmLabel, confirmStyle,
      onConfirm: () => { setConfirmDialog(null); resolve(true); onConfirm(); },
      onCancel:  () => { setConfirmDialog(null); resolve(false); },
    }));

  const [courses,         setCourses]         = useState([]);
  const [selectedCourse,  setSelectedCourse]  = useState('');
  const [courseBorrowMap, setCourseBorrowMap] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('');
  const [availableOnly,    setAvailableOnly]    = useState(false);
  const [showFilters,     setShowFilters]     = useState(false);

  // Borrow request modal
  const [requestBook,    setRequestBook]    = useState(null);
  const [requesting,     setRequesting]     = useState(false);
  const [requestSuccess, setRequestSuccess] = useState('');
  const [requestError,   setRequestError]   = useState('');
  const [myBorrowMap,    setMyBorrowMap]    = useState({});
  const [activeBookBorrowMap, setActiveBookBorrowMap] = useState({}); // bookId → count of active/overdue borrows

  // ── Loaders ───────────────────────────────────────────────────────────────
  // Refs for cross-collection derived state
  const usersRefC   = useRef([]);
  const borrowsRefC = useRef([]);

  function recomputeCourseData() {
    const userCourseMap = {};
    const courseSet     = new Set();
    usersRefC.current.forEach(u => { if (u.course) { userCourseMap[u.id] = u.course; courseSet.add(u.course); } });
    setCourses([...courseSet].sort());
    const map = {};
    borrowsRefC.current.forEach(b => {
      const course = userCourseMap[b.userId];
      if (!b.bookId || !course) return;
      if (!map[b.bookId]) map[b.bookId] = new Set();
      map[b.bookId].add(course);
    });
    const finalMap = {};
    Object.entries(map).forEach(([k, v]) => { finalMap[k] = [...v]; });
    setCourseBorrowMap(finalMap);
  }

  // Live books
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(collection(db, 'books'), snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
      setBooks(docs);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  // Live users → recompute course data
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      usersRefC.current = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      recomputeCourseData();
    }, () => {});
    return unsub;
  }, []);

  // Live borrows → recompute course data + student borrow map + active-per-book count
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'borrows'), snap => {
      borrowsRefC.current = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      recomputeCourseData();
      // Track active/overdue borrows per book for staff/admin safeguard
      const abMap = {};
      borrowsRefC.current.forEach(b => {
        if (b.bookId && (b.status === 'active' || b.status === 'pending')) {
          abMap[b.bookId] = (abMap[b.bookId] || 0) + 1;
        }
      });
      setActiveBookBorrowMap(abMap);
      if (currentUser && isStudent) {
        const map = {};
        borrowsRefC.current.forEach(b => {
          if (b.userId === currentUser.uid && b.status !== 'returned' && b.status !== 'rejected') {
            map[b.bookId] = b.status;
          }
        });
        setMyBorrowMap(map);
      }
    }, () => {});
    return unsub;
  }, [currentUser, isStudent]);

  // ── Filtering ─────────────────────────────────────────────────────────────
  const allCategories = [...new Set(books.map(b => b.category).filter(Boolean))].sort();

  const filtered = books.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      b.title?.toLowerCase().includes(q)     ||
      b.authors?.toLowerCase().includes(q)   ||
      b.isbn?.includes(search)               ||
      b.category?.toLowerCase().includes(q)  ||
      b.publisher?.toLowerCase().includes(q) ||
      b.description?.toLowerCase().includes(q);
    const matchCourse = !selectedCourse ||
      (Array.isArray(b.courses) && b.courses.includes(selectedCourse)) ||
      (courseBorrowMap[b.id] ?? []).includes(selectedCourse);
    const matchCategory  = !selectedCategory || (b.category ?? '') === selectedCategory;
    const matchAvailable = !availableOnly || (b.availableCopies ?? 0) > 0;
    if (isStudent) return matchSearch && matchCourse && matchCategory && matchAvailable;
    return matchSearch && matchCourse;
  });

  // ── Selection helpers ─────────────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(b => b.id)));
    }
  };

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };

  // ── Bulk delete ───────────────────────────────────────────────────────────
  const handleBulkDelete = async (mode) => {
    // mode: 'selected' | 'all'
    const toDelete = mode === 'all' ? books : books.filter(b => selectedIds.has(b.id));
    setBulkDeleting(true);
    setConfirmBulk(null);
    try {
      const BATCH_SIZE = 490;
      for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        toDelete.slice(i, i + BATCH_SIZE).forEach(b => batch.delete(doc(db, 'books', b.id)));
        await batch.commit();
      }
      // Log each deletion
      for (const b of toDelete) {
        await logBookActivity('deleted', b, userProfile);
      }
      setBooks(prev => mode === 'all' ? [] : prev.filter(b => !selectedIds.has(b.id)));
      exitSelectMode();
    } catch (err) { showAlert('Delete Failed', err.message); }
    setBulkDeleting(false);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  // Check if student has overdue books — blocks new borrow requests
  const hasOverdueBooks = isStudent && borrowsRefC.current.some(b =>
    b.userId === currentUser?.uid &&
    b.status === 'active' &&
    b.dueDate?.toDate && b.dueDate.toDate() < new Date()
  );

  const handleRequest = async () => {
    setRequestError(''); setRequesting(true);
    if (hasOverdueBooks) {
      setRequestError('Borrowing disabled: You have overdue books. Please return them before borrowing new ones.');
      setRequesting(false);
      return;
    }
    try {
      if ((requestBook.availableCopies ?? 0) <= 0) { setRequestError('No copies available at this time.'); setRequesting(false); return; }
      await addDoc(collection(db, 'borrows'), {
        userId: currentUser.uid, bookId: requestBook.id, bookTitle: requestBook.title,
        authors: requestBook.authors||'', isbn: requestBook.isbn||'',
        shelfLocation: requestBook.shelfLocation||'', borrowDate: serverTimestamp(),
        dueDate: null, status: 'pending', requestedAt: serverTimestamp(), approvedBy: null,
      });
      setRequestSuccess(`Your request for "${requestBook.title}" has been submitted. Please wait for staff approval.`);
      setMyBorrowMap(prev => ({ ...prev, [requestBook.id]: 'pending' }));
    } catch { setRequestError('Failed to submit request. Please try again.'); }
    setRequesting(false);
  };

  const handleSave = async (formData) => {
    if (!editingBook) {
      const t = formData.title?.trim().toLowerCase() || '';
      const i = formData.isbn?.trim().toLowerCase() || '';
      const dup = books.find(b => 
        (i && b.isbn?.trim().toLowerCase() === i) || 
        (t && b.title?.trim().toLowerCase() === t)
      );
      if (dup) {
        askConfirm(
          'Duplicate Book Detected', 
          `A book matching this title or ISBN already exists in the catalog. Would you like to add these ${formData.totalCopies || 0} copies to the existing stock of "${dup.title}"?`, 
          async () => {
            setSaving(true);
            try {
              const newTotal = (dup.totalCopies || 0) + parseInt(formData.totalCopies||0, 10);
              const newAvail = (dup.availableCopies || 0) + parseInt(formData.availableCopies||0, 10);
              await updateDoc(doc(db, 'books', dup.id), {
                totalCopies: newTotal,
                availableCopies: newAvail,
                updatedAt: serverTimestamp(),
              });
              await logBookActivity('edited', { ...dup, totalCopies: newTotal, availableCopies: newAvail }, userProfile);
              setBooks(prev => prev.map(b => b.id === dup.id ? { ...b, totalCopies: newTotal, availableCopies: newAvail } : b));
              setDrawerOpen(false); setEditingBook(null);
            } catch (err) { showAlert('Error Updating Stock', err.message); }
            setSaving(false);
          }, 
          'Add to Existing Stock', 
          'primary'
        );
        return;
      }
    }

    setSaving(true);
    try {
      if (editingBook) {
        await updateDoc(doc(db, 'books', editingBook.id), { ...formData, updatedAt: serverTimestamp() });
        await logBookActivity('edited', { ...editingBook, ...formData }, userProfile);
        setBooks(prev => prev.map(b => b.id === editingBook.id ? { ...b, ...formData } : b));
      } else {
        const ref = await addDoc(collection(db, 'books'), { ...formData, createdAt: serverTimestamp() });
        await logBookActivity('added', { id: ref.id, ...formData }, userProfile);
        setBooks(prev => [...prev, { id: ref.id, ...formData }].sort((a,b) => a.title.localeCompare(b.title)));
      }
      setDrawerOpen(false); setEditingBook(null);
    } catch (err) { showAlert('Error Saving Book', err.message); }
    setSaving(false);
  };

  const handleDelete = (book) => {
    const activeCount = activeBookBorrowMap[book.id] || 0;
    if (activeCount > 0) {
      showAlert(
        'Action Denied',
        `You cannot delete "${book.title}" because ${activeCount} ${activeCount === 1 ? 'copy is' : 'copies are'} currently checked out. Deleting this will cause the system to lose track of active borrowing records. Please ensure all copies are returned first.`
      );
      return;
    }
    askConfirm(
      'Delete Book',
      `Permanently delete "${book.title}"? This cannot be undone.`,
      async () => {
        try {
          await deleteDoc(doc(db, 'books', book.id));
          await logBookActivity('deleted', book, userProfile);
          setBooks(prev => prev.filter(b => b.id !== book.id));
        } catch (err) { showAlert('Error Deleting', err.message); }
      },
      'Delete Permanently', 'danger'
    );
  };

  const openAdd   = () => { setEditingBook(null); setDrawerOpen(true); };
  const openEdit  = (book) => { setEditingBook(book); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditingBook(null); };

  // ── CSV import ────────────────────────────────────────────────────────────
  const handleImportFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setImportFile(file.name); setImportResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      const errors = [];
      rows.forEach((r,i) => {
        const rowErrors = [];
        if (!r.title?.trim()) rowErrors.push('title is required');
        const copies = parseInt(r.totalCopies, 10); const avail = parseInt(r.availableCopies, 10);
        if (isNaN(copies)||copies<0) rowErrors.push('totalCopies must be a number >= 0');
        if (isNaN(avail)||avail<0)   rowErrors.push('availableCopies must be a number >= 0');
        if (avail > copies)           rowErrors.push('availableCopies cannot exceed totalCopies');
        if (rowErrors.length) errors.push({ row: i+2, errors: rowErrors });
      });
      setImportRows(rows); setImportErrors(errors);
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = () => {
    if (importErrors.length > 0) return;

    let dupCount = 0;
    const news = [];
    const dupMap = new Map();

    for (const r of importRows) {
      const t = r.title?.trim().toLowerCase() || '';
      const i = r.isbn?.trim().toLowerCase() || '';
      const dup = books.find(b => 
        (i && b.isbn?.trim().toLowerCase() === i) || 
        (t && b.title?.trim().toLowerCase() === t)
      );

      if (dup) {
        if (!dupMap.has(dup.id)) {
          dupMap.set(dup.id, { book: dup, extraTotal: 0, extraAvailable: 0 });
        }
        dupCount++;
        dupMap.get(dup.id).extraTotal += Math.max(0, parseInt(r.totalCopies,10)||0);
        dupMap.get(dup.id).extraAvailable += Math.max(0, parseInt(r.availableCopies,10)||0);
      } else {
        news.push(r);
      }
    }

    const confirmTitle = dupCount > 0 ? 'Duplicates Detected' : 'Confirm Import';
    const confirmMsg = dupCount > 0 
      ? `Found ${dupCount} duplicate book${dupCount!==1?'s':''} in your import. Would you like to add their copies to the existing stock, and import the remaining ${news.length} new book${news.length!==1?'s':''}?`
      : `Import ${importRows.length} book${importRows.length !== 1 ? 's' : ''} into the catalog? This cannot be undone.`;
    const confirmBtn = dupCount > 0 ? 'Merge Stocks & Import' : 'Import Now';

    askConfirm(
      confirmTitle, confirmMsg,
      async () => {
        setImporting(true);
        try {
          const BATCH_SIZE = 400; 
          let added = 0; let updated = 0;

          for (let idx = 0; idx < news.length; idx += BATCH_SIZE) {
            const batch = writeBatch(db);
            const chunk = news.slice(idx, idx + BATCH_SIZE);
            chunk.forEach(r => {
              const ref = doc(collection(db, 'books'));
              const parsedCourses = r.courses ? r.courses.split('|').map(c=>c.trim()).filter(Boolean) : [];
              batch.set(ref, {
                title: r.title?.trim()||'', authors: r.authors?.trim()||'',
                isbn: r.isbn?.trim()||'', publisher: r.publisher?.trim()||'',
                edition: r.edition?.trim()||'', category: r.category?.trim()||'',
                shelfLocation: r.shelfLocation?.trim()||'',
                totalCopies: Math.max(0, parseInt(r.totalCopies,10)||0),
                availableCopies: Math.max(0, parseInt(r.availableCopies,10)||0),
                description: r.description?.trim()||'', courses: parsedCourses,
                createdAt: serverTimestamp(),
              });
            });
            await batch.commit(); added += chunk.length;
          }

          const updateArr = Array.from(dupMap.values());
          for (let idx = 0; idx < updateArr.length; idx += BATCH_SIZE) {
            const batch = writeBatch(db);
            const chunk = updateArr.slice(idx, idx + BATCH_SIZE);
            chunk.forEach(u => {
              const ref = doc(db, 'books', u.book.id);
              batch.update(ref, {
                totalCopies: (u.book.totalCopies || 0) + u.extraTotal,
                availableCopies: (u.book.availableCopies || 0) + u.extraAvailable,
                updatedAt: serverTimestamp(),
              });
            });
            await batch.commit(); updated += chunk.length;
          }

          let logBatch = writeBatch(db);
          let logsInBatch = 0;
          for (const r of news) {
            if (logsInBatch >= BATCH_SIZE) { await logBatch.commit(); logBatch = writeBatch(db); logsInBatch=0; }
            logBatch.set(doc(collection(db, 'bookLogs')), {
              action: 'bulk_imported', bookId: null, bookTitle: r.title?.trim()||'(untitled)',
              isbn: r.isbn?.trim()||'', category: r.category?.trim()||'', 
              by: userProfile?.uid || null, byName: userProfile ? `${userProfile.lastName??''}, ${userProfile.firstName??''}`.trim() : 'Unknown',
              timestamp: serverTimestamp(),
            });
            logsInBatch++;
          }
          if (logsInBatch > 0) await logBatch.commit();

          logBatch = writeBatch(db);
          logsInBatch = 0;
          for (const u of updateArr) {
            if (logsInBatch >= BATCH_SIZE) { await logBatch.commit(); logBatch = writeBatch(db); logsInBatch=0; }
            logBatch.set(doc(collection(db, 'bookLogs')), {
              action: 'edited', bookId: u.book.id, bookTitle: u.book.title,
              isbn: u.book.isbn||'', category: u.book.category||'',
              by: userProfile?.uid || null, byName: userProfile ? `${userProfile.lastName??''}, ${userProfile.firstName??''}`.trim() : 'Unknown',
              timestamp: serverTimestamp(),
            });
            logsInBatch++;
          }
          if (logsInBatch > 0) await logBatch.commit();

          setImportResult({ added, updated }); setImportRows([]); setImportFile('');
          // books refresh via onSnapshot
        } catch (err) { showAlert('Import Failed', err.message); }
        setImporting(false);
      },
      confirmBtn, 'primary'
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400 mb-1">Collection</p>
          <h1 className="page-title">Book Catalog</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isAdmin && !selectMode && (
            <button className="btn-secondary shrink-0 text-[10px]" onClick={() => exportCSV(books)}>
              Export CSV
            </button>
          )}
          {canEdit && !selectMode && (
            <>
              <button className="btn-secondary shrink-0 text-[10px]" onClick={() => { setImportOpen(o=>!o); setImportResult(null); }}>
                {importOpen ? 'Close Import' : '↑ Bulk Import CSV'}
              </button>
              <button className="btn-secondary shrink-0 text-[10px]" onClick={() => { setSelectMode(true); setImportOpen(false); }}>
                Bulk Delete
              </button>
              <button className="btn-primary shrink-0" onClick={openAdd}>
                + Add New Book
              </button>
            </>
          )}
          {/* Bulk delete toolbar */}
          {selectMode && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-mono" style={{color:"var(--text-muted)"}}>
                {selectedIds.size} of {filtered.length} selected
              </span>
              <button className="btn-secondary text-[10px]" onClick={toggleSelectAll}>
                {selectedIds.size === filtered.length ? 'Deselect All' : 'Select All'}
              </button>
              {selectedIds.size > 0 && (
                <button
                  className="btn-danger text-[10px]"
                  onClick={() => setConfirmBulk('selected')}
                  disabled={bulkDeleting}
                >
                  Delete Selected ({selectedIds.size})
                </button>
              )}
              <button
                className="btn-danger text-[10px]"
                onClick={() => setConfirmBulk('all')}
                disabled={bulkDeleting}
              >
                Delete All Books ({books.length})
              </button>
              <button className="btn-ghost text-[10px]" onClick={exitSelectMode}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* CSV Import Panel */}
      {canEdit && importOpen && !selectMode && (
        <div className="card mb-6 space-y-4">
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-gray-400 mb-1">Bulk Import</p>
            <h2 className="section-head">Import Books from CSV</h2>
            <p className="text-xs mt-1 text-muted">
              The <span className="font-mono">courses</span> column accepts pipe-separated values, e.g.{' '}
              <span className="font-mono bg-gray-100 px-1">BSIT|BS Midwifery|Juris Doctor</span>
            </p>
          </div>
          <div className="flex items-start gap-4 p-4" style={{background:"var(--surface)",border:"1px solid var(--card-border)",borderRadius:8}}>
            <div className="shrink-0 w-7 h-7 rounded-full bg-primary-700 text-white flex items-center justify-center text-xs font-bold font-mono">1</div>
            <div>
              <p className="text-sm font-semibold mb-1" style={{color:"var(--text-body)"}}>Download Template</p>
              <p className="text-xs mb-2 text-muted">Use this CSV template to format your book data correctly.</p>
              <button className="btn-secondary text-xs py-1.5 px-4" onClick={downloadTemplate}>Download CSV Template</button>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4" style={{background:"var(--surface)",border:"1px solid var(--card-border)",borderRadius:8}}>
            <div className="shrink-0 w-7 h-7 rounded-full bg-primary-700 text-white flex items-center justify-center text-xs font-bold font-mono">2</div>
            <div className="flex-1">
              <p className="text-sm font-semibold mb-1" style={{color:"var(--text-body)"}}>Upload Your CSV</p>
              <input type="file" accept=".csv" className="text-sm text-muted file:mr-3 file:btn file:btn-secondary file:text-xs file:py-1" onChange={handleImportFile} />
              {importFile && <p className="text-xs font-mono mt-1 text-muted">{importFile}</p>}
            </div>
          </div>
          {importErrors.length > 0 && (
            <div className="px-4 py-3" style={{background:'var(--red-soft)',border:'1px solid var(--red-border)',borderRadius:10}}>
              <p className="text-sm font-semibold mb-2" style={{color:'var(--red)'}}>Fix these errors before importing:</p>
              {importErrors.map((e,i) => <p key={i} className="text-xs font-mono" style={{color:'var(--red)'}}>Row {e.row}: {e.errors.join(', ')}</p>)}
            </div>
          )}
          {importRows.length > 0 && importErrors.length === 0 && !importResult && (
            <div>
              <p className="text-sm font-semibold mb-2" style={{color:"var(--text-body)"}}>Preview ({importRows.length} rows)</p>
              <div className="overflow-x-auto border border-gray-200">
                <table className="w-full text-xs min-w-[600px]">
                  <thead><tr>{['#','Title','Authors','ISBN','Category','Shelf','Copies','Courses'].map(h=><th key={h} className="th text-[10px]">{h}</th>)}</tr></thead>
                  <tbody>
                    {importRows.map((r,i) => (
                      <tr key={i} className="tr-hover">
                        <td className="td font-mono text-dim">{i+1}</td>
                        <td className="td font-semibold">{r.title}</td>
                        <td className="td text-muted">{r.authors}</td>
                        <td className="td font-mono">{r.isbn}</td>
                        <td className="td">{r.category}</td>
                        <td className="td font-mono">{r.shelfLocation}</td>
                        <td className="td text-center">{r.totalCopies}</td>
                        <td className="td">{r.courses ? r.courses.split('|').map(c=>c.trim()).filter(Boolean).map(c=><span key={c} className="inline-block text-[9px] font-mono bg-primary-50 text-primary-700 border border-primary-200 px-1 mr-0.5 mb-0.5">{c}</span>) : <span className="text-dim">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {importResult && (
            <div className="mb-4 px-4 py-3 flex items-center gap-3" style={{background:'var(--green-soft)',border:'1px solid var(--green-border)',borderRadius:10}}>
              <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{background:'var(--green)',color:'var(--bg-base)'}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p className="text-sm font-semibold" style={{color:'var(--green)'}}>
                Successfully added {importResult.added} new book{importResult.added!==1?'s':''} 
                {importResult.updated > 0 ? ` and merged stocks for ${importResult.updated} existing book${importResult.updated!==1?'s':''}` : ''} 
                into the catalog.
              </p>
            </div>
          )}
          {importRows.length > 0 && importErrors.length === 0 && !importResult && (
            <div className="flex items-start gap-4 p-4" style={{background:"var(--surface)",border:"1px solid var(--card-border)",borderRadius:8}}>
              <div className="shrink-0 w-7 h-7 rounded-full bg-primary-700 text-white flex items-center justify-center text-xs font-bold font-mono">3</div>
              <div>
                <p className="text-sm font-semibold mb-2" style={{color:"var(--text-body)"}}>Confirm &amp; Import</p>
                <button className="btn-primary" onClick={handleImportSubmit} disabled={importing}>
                  {importing ? `Importing… (${importRows.length} books)` : `Import ${importRows.length} Book${importRows.length!==1?'s':''} Now`}
                </button>
                {importing && <p className="text-xs mt-2 font-mono text-muted">Please wait, writing to database…</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk delete instruction banner */}
      {selectMode && (
        <div className="mb-4 border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-800 font-semibold mb-0.5">Bulk Delete Mode</p>
          <p className="text-xs text-amber-700">Click rows to select books for deletion, or use Select All. Deleted books cannot be recovered.</p>
        </div>
      )}

      {/* Search + Filter */}
      <div className="mb-3 flex flex-col gap-3">
        {/* Search + filter toggle row */}
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Search by title, author, ISBN, category, publisher…" value={search} onChange={e=>setSearch(e.target.value)} />
          {(isStudent || canEdit) && (
            <button
              className={`shrink-0 btn-secondary text-xs px-3 flex items-center gap-1.5 ${showFilters ? 'bg-primary-50 border-primary-300 text-primary-700' : ''}`}
              onClick={() => setShowFilters(f => !f)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              <span className="hidden sm:inline">Filters</span>
              {(selectedCategory||selectedCourse||availableOnly) && <span className="w-2 h-2 rounded-full bg-primary-600 shrink-0" />}
            </button>
          )}
        </div>

        {/* Collapsible filter panel */}
        {showFilters && isStudent && (
          <div className="card p-3 flex flex-col sm:flex-row flex-wrap sm:items-center gap-3">
            <select className="select text-sm w-full sm:flex-1 sm:min-w-[200px]" value={selectedCategory} onChange={e=>setSelectedCategory(e.target.value)}>
              <option value="">— All Categories —</option>
              {allCategories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <select className="select text-sm w-full sm:flex-1 sm:min-w-[220px]" value={selectedCourse} onChange={e=>setSelectedCourse(e.target.value)}>
              <option value="">— All Subjects / Courses —</option>
              {courses.length > 0 && <optgroup label="-- By Course --">{courses.map(c=><option key={`course-${c}`} value={c}>{c}</option>)}</optgroup>}
              {CATALOG_FILTER_GROUPS.map(group=><optgroup key={group.group} label={group.group}>{group.subjects.map(s=><option key={s} value={s}>{s}</option>)}</optgroup>)}
            </select>
            <label className="flex items-center gap-2 cursor-pointer shrink-0 select-none">
              <div onClick={()=>setAvailableOnly(o=>!o)} className={`w-10 h-5 rounded-full transition-colors relative ${availableOnly?'bg-primary-600':'bg-gray-300'}`}>
                <div className={`w-4 h-4 rounded-full absolute top-0.5 transition-all ${availableOnly?'left-5':'left-0.5'}`} style={{background:'var(--card)'}} />
              </div>
              <span className="text-xs font-mono" style={{color:"var(--text-muted)"}}>Available only</span>
            </label>
            {(selectedCategory||selectedCourse||availableOnly||search) && (
              <button className="btn-ghost text-xs px-3 py-2 shrink-0" onClick={()=>{setSelectedCategory('');setSelectedCourse('');setAvailableOnly(false);setSearch('');setShowFilters(false);}}>Clear All</button>
            )}
          </div>
        )}
        {showFilters && canEdit && (
          <div className="card p-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <select className="select w-full sm:w-72 text-sm" value={selectedCourse} onChange={e=>setSelectedCourse(e.target.value)}>
              <option value="">— Filter by Subject / Course —</option>
              {courses.length > 0 && <optgroup label="-- From Borrow History --">{courses.map(c=><option key={`borrow-${c}`} value={c}>{c}</option>)}</optgroup>}
              {CATALOG_FILTER_GROUPS.map(group=><optgroup key={group.group} label={group.group}>{group.subjects.map(s=><option key={s} value={s}>{s}</option>)}</optgroup>)}
            </select>
            {selectedCourse && <button className="btn-ghost text-xs px-3 py-2" onClick={()=>setSelectedCourse('')}>Clear</button>}
          </div>
        )}
      </div>

      {/* Filter banner */}
      {(selectedCourse||selectedCategory||availableOnly) && (
        <div className="mb-4 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{background:'var(--gold-soft)',border:'1px solid var(--gold-border)',borderRadius:10}}>
          <p className="text-xs flex flex-wrap gap-2 items-center" style={{color:'var(--text-body)'}}>
            <span style={{color:'var(--text-muted)'}}>Showing <strong style={{color:'var(--text-primary)'}}>{filtered.length}</strong> book{filtered.length!==1?'s':''}</span>
            {selectedCategory && <span className="badge badge-gold">{selectedCategory}</span>}
            {selectedCourse   && <span className="badge badge-gold">{selectedCourse}</span>}
            {availableOnly    && <span className="badge badge-green">Available Only</span>}
          </p>
          <button className="btn-ghost text-xs shrink-0" style={{color:'var(--gold)'}}
            onClick={()=>{setSelectedCourse('');setSelectedCategory('');setAvailableOnly(false);}}>Show All</button>
        </div>
      )}

      {/* ── Mobile card grid (small screens only) ── */}
      {!loading && filtered.length > 0 && (
        <div className="block sm:hidden space-y-3 mb-4">
          {filtered.map(book => {
            const borrowStatus = myBorrowMap[book.id];
            const unavailable  = (book.availableCopies ?? 0) <= 0;
            const isSelected   = selectedIds.has(book.id);
            return (
              <div key={book.id}
                className={`card p-0 overflow-hidden ${selectMode ? 'cursor-pointer' : ''} ${isSelected ? 'ring-2 ring-red-400' : ''}`}
                onClick={selectMode ? () => toggleSelect(book.id) : undefined}
              >
                <div style={{ height: 3, background: 'linear-gradient(90deg, #f59e0b, transparent)' }} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-snug">{book.title}</p>
                      {book.authors && <p className="text-xs mt-0.5" style={{color:"var(--text-muted)"}}>{book.authors}</p>}
                      {(book.publisher || book.edition) && (
                        <p className="text-[10px] font-mono text-gray-400 mt-0.5">
                          {[book.publisher, book.edition ? `${book.edition} Ed.` : ''].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    {selectMode && (
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(book.id)}
                        className="mt-1 cursor-pointer shrink-0" onClick={e => e.stopPropagation()} />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {book.category && <span className="badge badge-gray text-[10px]">{book.category}</span>}
                    {book.isbn && <span className="badge badge-gray font-mono text-[10px]">{book.isbn}</span>}
                  </div>
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mb-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-dim font-mono tracking-wider text-[10px]">SHELF</span>
                      <span className="font-mono font-semibold">{book.shelfLocation || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-dim font-mono tracking-wider text-[10px]">COPIES</span>
                      <span className="font-mono font-semibold">{book.totalCopies ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-dim font-mono tracking-wider text-[10px]">AVAIL</span>
                      <span style={{fontFamily:'IBM Plex Mono,monospace',fontWeight:700,color:(book.availableCopies??0)>0?'var(--green)':'var(--red)'}}>{book.availableCopies ?? 0}</span>
                    </div>
                  </div>
                  {isStudent && book.description && (
                    <p className="text-[11px] text-gray-400 leading-snug mb-3 line-clamp-2">{book.description}</p>
                  )}
                  {!selectMode && (
                    <div className="flex gap-2 flex-wrap">
                      {isStudent && (
                        borrowStatus === 'active'  ? <span className="badge-green badge">Borrowed</span>
                        : borrowStatus === 'pending' ? <span className="badge-gold badge">Pending Approval</span>
                        : unavailable ? <span className="badge-red badge">Unavailable</span>
                        : hasOverdueBooks ? <span className="badge-red badge text-[9px]">Overdue — Return First</span>
                        : <button className="btn-primary py-2 px-4 text-xs w-full" onClick={() => { setRequestBook(book); setRequestError(''); setRequestSuccess(''); }}>Request Borrow</button>
                      )}
                      {canEdit && (
                        <>
                          <button className="btn-secondary py-1.5 px-3 text-xs flex-1" onClick={e => { e.stopPropagation(); openEdit(book); }}>Edit</button>
                          <button className="btn-danger py-1.5 px-3 text-xs flex-1" onClick={e => { e.stopPropagation(); handleDelete(book); }}>Delete</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Desktop table (hidden on mobile) ── */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="text-sm font-mono p-6 text-muted">Loading catalog…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm p-6 text-muted">{selectedCourse ? `No books found for "${selectedCourse}".` : 'No books found.'}</p>
        ) : (
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr>
                  {selectMode && (
                    <th className="th w-10">
                      <input type="checkbox"
                        checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onChange={toggleSelectAll}
                        className="cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="th">Title / Author</th>
                  <th className="th">ISBN</th>
                  <th className="th">Category</th>
                  <th className="th">Shelf</th>
                  <th className="th">Copies</th>
                  <th className="th">Available</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(book => {
                  const borrowStatus    = myBorrowMap[book.id];
                  const unavailable     = (book.availableCopies ?? 0) <= 0;
                  const coursesBorrowed = courseBorrowMap[book.id] ?? [];
                  const coursesAssigned = Array.isArray(book.courses) ? book.courses : [];
                  const isSelected      = selectedIds.has(book.id);

                  return (
                    <tr
                      key={book.id}
                      className={`tr-hover ${selectMode ? 'cursor-pointer' : ''}`} style={{background:isSelected?'var(--red-soft)':'transparent'}}
                      onClick={selectMode ? () => toggleSelect(book.id) : undefined}
                    >
                      {selectMode && (
                        <td className="td" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(book.id)} className="cursor-pointer" />
                        </td>
                      )}
                      <td className="td">
                        <p className="font-semibold text-sm" style={{color:"var(--text-primary)"}}>{book.title}</p>
                        <p className="text-xs" style={{color:"var(--text-muted)"}}>{book.authors}</p>
                        {(book.edition||book.publisher) && (
                          <p className="text-[10px] font-mono text-dim">
                            {[book.publisher, book.edition?`${book.edition} Ed.`:''].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {isStudent && book.description && (
                          <p className="text-[11px] text-gray-400 mt-1 leading-snug line-clamp-2">{book.description}</p>
                        )}
                        {(() => {
                          const hasAssigned = coursesAssigned.length > 0;
                          const hasBorrowed = coursesBorrowed.length > 0;
                          if (!hasAssigned && !hasBorrowed) return null;
                          if (selectedCourse) {
                            const viaAssigned = coursesAssigned.includes(selectedCourse);
                            const viaBorrow   = coursesBorrowed.includes(selectedCourse);
                            return (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {viaAssigned && <span className="text-[9px] font-mono bg-primary-50 text-primary-700 border border-primary-200 px-1.5 py-0.5">★ Recommended for {selectedCourse}</span>}
                                {viaBorrow && !viaAssigned && <span className="text-[9px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5">Borrowed by {selectedCourse}</span>}
                              </div>
                            );
                          }
                          const assignedToShow = coursesAssigned.slice(0,3);
                          const borrowOnlyList = coursesBorrowed.filter(c => !coursesAssigned.includes(c));
                          const borrowedToShow = canEdit ? borrowOnlyList.slice(0,2) : [];
                          return (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {assignedToShow.map(c=><button key={`a-${c}`} className="text-[9px] font-mono bg-primary-50 text-primary-700 border border-primary-200 px-1.5 py-0.5 hover:bg-primary-100 transition-colors" onClick={e=>{e.stopPropagation();setSelectedCourse(c);}} title={`Recommended for ${c}`}>★ {c}</button>)}
                              {coursesAssigned.length>3 && <span className="text-[9px] font-mono text-gray-400 self-center">+{coursesAssigned.length-3} more</span>}
                              {borrowedToShow.map(c=><button key={`b-${c}`} className="text-[9px] font-mono bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 hover:bg-blue-100 transition-colors" onClick={e=>{e.stopPropagation();setSelectedCourse(c);}} title={`Borrowed by ${c}`}>{c}</button>)}
                              {canEdit && borrowOnlyList.length>2 && <span className="text-[9px] font-mono text-gray-400 self-center">+{borrowOnlyList.length-2} more borrowed</span>}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="td font-mono text-xs">{book.isbn||'—'}</td>
                      <td className="td">{book.category && <span className="badge badge-gray">{book.category}</span>}</td>
                      <td className="td font-mono text-xs">{book.shelfLocation||'—'}</td>
                      <td className="td text-center font-mono">{book.totalCopies??0}</td>
                      <td className="td text-center">
                        <span style={{fontFamily:'IBM Plex Mono,monospace',fontWeight:600,color:(book.availableCopies??0)>0?'var(--green)':'var(--red)'}}>{book.availableCopies??0}</span>
                        {canEdit && (activeBookBorrowMap[book.id] || 0) > 0 && (
                          <div style={{marginTop:3}}>
                            <span style={{fontFamily:'IBM Plex Mono,monospace',fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:10,background:'var(--red-soft)',border:'1px solid var(--red-border)',color:'var(--red)',whiteSpace:'nowrap'}}>
                              {activeBookBorrowMap[book.id]} out
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isStudent && (
                            borrowStatus==='active' ? <span className="badge-green badge">Borrowed</span>
                            : borrowStatus==='pending' ? <span className="badge-gold badge">Pending Approval</span>
                            : unavailable ? <span className="badge-red badge">Unavailable</span>
                            : <button className="btn-primary py-1 px-3 text-[10px]" onClick={()=>{setRequestBook(book);setRequestError('');setRequestSuccess('');}}>Request Borrow</button>
                          )}
                          {canEdit && !selectMode && (
                            <>
                              <button className="btn-secondary py-1 px-3 text-[10px]" onClick={e=>{e.stopPropagation();openEdit(book);}}>Edit</button>
                              <button className="btn-danger py-1 px-3 text-[10px]" onClick={e=>{e.stopPropagation();handleDelete(book);}}>Delete</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk delete confirmation modal */}
      {confirmBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md shadow-2xl" style={{background:'var(--card)',border:'1px solid var(--card-border)',borderRadius:16,overflow:'hidden'}}>
            <div className="bg-red-700 text-white px-6 py-4">
              <p className="font-mono text-[10px] tracking-widest uppercase opacity-70 mb-0.5">Irreversible Action</p>
              <h2 className="font-display text-lg font-bold" style={{color:'var(--red)'}}>Confirm Bulk Delete</h2>
            </div>
            <div className="px-6 py-5">
              <div className="px-4 py-3 mb-4" style={{background:'var(--red-soft)',border:'1px solid var(--red-border)',borderRadius:8}}>
                <p className="text-sm font-semibold mb-1" style={{color:'var(--text-primary)'}}>
                  {confirmBulk === 'all'
                    ? `Delete all ${books.length} books from the catalog?`
                    : `Delete ${selectedIds.size} selected book${selectedIds.size!==1?'s':''}?`}
                </p>
                <p className="text-xs" style={{color:'var(--red)'}}>This action cannot be undone. All borrow records referencing these books will remain but will show missing book details.</p>
              </div>
            </div>
            <div className="px-6 py-4 flex justify-end gap-3" style={{borderTop:'1px solid var(--divider)',background:'var(--surface)'}}>
              <button className="btn-secondary" onClick={()=>setConfirmBulk(null)} disabled={bulkDeleting}>Cancel</button>
              <button className="btn-danger" onClick={()=>handleBulkDelete(confirmBulk)} disabled={bulkDeleting}>
                {bulkDeleting ? 'Deleting…' : 'Yes, Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Borrow request modal */}
      {requestBook && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={()=>!requesting&&setRequestBook(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md shadow-2xl" style={{background:'var(--card)',border:'1px solid var(--card-border)',borderRadius:16,overflow:'hidden'}}>
              <div className="px-6 py-4" style={{background:'var(--bg-top)',borderBottom:'1px solid var(--divider)'}}>
                <p className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-0.5">Borrow Request</p>
                <h2 className="font-display text-lg font-bold leading-tight" style={{color:'var(--text-primary)'}}>{requestBook.title}</h2>
                <p className="text-xs mt-0.5" style={{color:'var(--text-muted)'}}>{requestBook.authors}</p>
              </div>
              <div className="px-6 py-5">
                {requestSuccess ? (
                  <div>
                    <div className="px-4 py-3 mb-5" style={{background:'var(--green-soft)',border:'1px solid var(--green-border)',borderRadius:8}}>
                      <p className="text-sm font-semibold mb-1" style={{color:'var(--green)'}}>Request Submitted</p>
                      <p className="text-sm" style={{color:'var(--green)'}}>{requestSuccess}</p>
                    </div>
                    <p className="text-xs mb-5 text-muted">A staff member will review and approve your request. Once approved, proceed to the library desk to collect your book.</p>
                    <button className="btn-primary w-full" onClick={()=>setRequestBook(null)}>Done</button>
                  </div>
                ) : (
                  <div>
                    <div className="mb-5 grid grid-cols-2 gap-3 text-sm">
                      <div><p className="label">Available Copies</p><p className="font-semibold text-primary-700">{requestBook.availableCopies}</p></div>
                      <div><p className="label">Shelf Location</p><p className="text-muted">{requestBook.shelfLocation||'—'}</p></div>
                      <div><p className="label">ISBN</p><p className="font-mono text-xs text-muted">{requestBook.isbn||'—'}</p></div>
                      <div><p className="label">Category</p><p className="text-muted">{requestBook.category||'—'}</p></div>
                    </div>
                    {requestError && (
                      <div className="mb-4 px-4 py-3 flex gap-3" style={{background:'var(--red-soft)',border:'1px solid var(--red-border)',borderRadius:8}}>
                        <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{background:'var(--red)',color:'var(--bg-base)'}}>!</div>
                        <p className="text-sm" style={{color:'var(--red)'}}>{requestError}</p>
                      </div>
                    )}
                    <div className="mb-5 px-4 py-3" style={{background:'var(--gold-soft)',border:'1px solid var(--gold-border)',borderRadius:8}}>
                      <p className="text-xs font-semibold mb-0.5" style={{color:'var(--gold)'}}>How it works</p>
                      <p className="text-xs" style={{color:'var(--text-muted)'}}>Submitting this request notifies library staff. A due date will be assigned upon approval. You'll see the status update in My Borrows.</p>
                    </div>
                    <div className="flex gap-3">
                      <button className="btn-ghost flex-1" onClick={()=>setRequestBook(null)}>Cancel</button>
                      <button className="btn-primary flex-1" onClick={handleRequest} disabled={requesting}>
                        {requesting?'Submitting…':'Submit Request'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Book drawer */}
      {drawerOpen && (
        <BookDrawer book={editingBook} saving={saving} onSave={handleSave} onClose={closeDrawer} />
      )}

      {/* Custom confirm dialog (replaces window.confirm) */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          confirmStyle={confirmDialog.confirmStyle}
          onConfirm={confirmDialog.onConfirm}
          onCancel={confirmDialog.onCancel}
        />
      )}

      {/* Custom alert dialog (replaces alert()) */}
      {alertDialog && (
        <AlertDialog
          title={alertDialog.title}
          message={alertDialog.message}
          onClose={() => setAlertDialog(null)}
        />
      )}
    </div>
  );
}
