#!/usr/bin/env node
/**
 * tools/migrate/prune-users.js
 *
 * Removes deprecated fields from every document in the `users` Firestore collection.
 * The new simplified schema retains only:
 *   uid, idNumber, lastName, firstName, middleInitial, college, course, role, createdAt
 *
 * Usage:
 *   node tools/migrate/prune-users.js                  # dry run (default)
 *   node tools/migrate/prune-users.js --execute        # live write
 *   node tools/migrate/prune-users.js --execute --uid=abc123  # single document
 *
 * Requirements:
 *   npm install firebase-admin
 *   Set GOOGLE_APPLICATION_CREDENTIALS or SERVICE_ACCOUNT_PATH env var.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createReadStream, existsSync } from 'fs';
import { resolve } from 'path';

// ── Config ────────────────────────────────────────────────────────────────────

/** Fields to KEEP in the new schema. Everything else will be deleted. */
const KEEP_FIELDS = new Set([
  'uid',
  'idNumber',
  'lastName',
  'firstName',
  'middleInitial',
  'college',
  'course',
  'role',
  'createdAt',
]);

const DEPRECATED = [
  'email',        // replaced by synthetic internal email — no longer stored
  'age',
  'birthday',
  'sex',
  'yearLevel',
  'department',
  'profileComplete',
  'displayName',
  'photoURL',
  // add any other legacy fields here
];

// ── Args ──────────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');
const UID_ARG = (args.find(a => a.startsWith('--uid=')) || '').replace('--uid=', '').trim() || null;

// ── Init Firebase Admin ───────────────────────────────────────────────────────
const saPath = process.env.SERVICE_ACCOUNT_PATH
  || process.env.GOOGLE_APPLICATION_CREDENTIALS
  || resolve(process.cwd(), 'service-account.json');

if (!existsSync(saPath)) {
  console.error(`\n[ERROR] Service account file not found at:\n  ${saPath}\n`);
  console.error('Set SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS env var.\n');
  process.exit(1);
}

initializeApp({ credential: cert(saPath) });
const db = getFirestore();

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n=== NEU Library — User Field Pruning Script ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE EXECUTE'}`);
  if (UID_ARG) console.log(`Targeting single UID: ${UID_ARG}`);
  console.log(`Fields to remove: ${DEPRECATED.join(', ')}\n`);

  let total   = 0;
  let updated = 0;
  let skipped = 0;
  let errors  = 0;

  const colRef = db.collection('users');
  const snap   = UID_ARG
    ? await colRef.where('uid', '==', UID_ARG).get()
    : await colRef.get();

  if (snap.empty) {
    console.log('No documents found.');
    return;
  }

  const BATCH_SIZE = 400;
  let batch        = db.batch();
  let batchCount   = 0;

  for (const docSnap of snap.docs) {
    total++;
    const data   = docSnap.data();
    const toPrune = DEPRECATED.filter(f => f in data);

    if (toPrune.length === 0) {
      skipped++;
      console.log(`  [SKIP] ${docSnap.id} — no deprecated fields`);
      continue;
    }

    console.log(`  [${DRY_RUN ? 'DRY' : 'UPD'}] ${docSnap.id} (${data.idNumber || data.email || 'no-id'}) — removing: ${toPrune.join(', ')}`);

    if (!DRY_RUN) {
      const deleteMap = {};
      toPrune.forEach(f => { deleteMap[f] = FieldValue.delete(); });
      batch.update(docSnap.ref, deleteMap);
      batchCount++;
      updated++;

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        console.log(`    → Committed batch of ${batchCount}`);
        batch      = db.batch();
        batchCount = 0;
      }
    } else {
      updated++;
    }
  }

  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
    console.log(`  → Committed final batch of ${batchCount}`);
  }

  console.log('\n=== Summary ===');
  console.log(`  Total documents scanned : ${total}`);
  console.log(`  Documents to update     : ${updated}`);
  console.log(`  Already clean (skipped) : ${skipped}`);
  console.log(`  Errors                  : ${errors}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes written. Re-run with --execute to apply.\n');
  } else {
    console.log('\n[DONE] Fields pruned successfully.\n');
  }
}

run().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
