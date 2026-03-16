#!/usr/bin/env node
/**
 * tools/reset-passwords.js
 *
 * Resets every student's Firebase Auth password to their ID number (dashes included).
 * e.g.  ID: 24-12345-678  →  new password: "24-12345-678"
 *
 * Usage:
 *   node tools/reset-passwords.js              # dry run — shows what would happen
 *   node tools/reset-passwords.js --execute    # LIVE — actually resets passwords
 *
 * Requires serviceAccountKey.json in the project root.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const admin  = require('firebase-admin');
const sa     = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const auth = admin.auth();
const db   = admin.firestore();

const args    = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');

console.log('\n=== NEU Library — Password Reset Script ===');
console.log(`Mode: ${DRY_RUN ? 'DRY RUN (safe preview)' : '⚠️  LIVE EXECUTE — passwords will be reset!'}\n`);

async function run() {
  // Fetch all users from Firestore (the source of truth for ID numbers)
  const snapshot = await db.collection('users').get();

  let reset   = 0;
  let skipped = 0;
  let errors  = 0;

  for (const docSnap of snapshot.docs) {
    const data     = docSnap.data();
    const idNumber = data.idNumber?.trim();
    const uid      = data.uid || docSnap.id;
    const name     = `${data.lastName || ''}, ${data.firstName || ''}`.trim();

    // Skip if no ID number (Google-only users, admins without ID, etc.)
    if (!idNumber) {
      console.log(`  ⏭  Skipping ${name || uid} — no ID number`);
      skipped++;
      continue;
    }

    // The new password is the ID number itself, e.g. "24-12345-678"
    const newPassword = idNumber;

    if (DRY_RUN) {
      console.log(`  ✓ [DRY] Would reset: ${name.padEnd(30)} ${idNumber}  →  password="${newPassword}"`);
      reset++;
      continue;
    }

    try {
      await auth.updateUser(uid, { password: newPassword });
      console.log(`  ✓ Reset: ${name.padEnd(30)} ${idNumber}`);
      reset++;
    } catch (err) {
      console.error(`  ✗ Failed: ${name} (${uid}): ${err.message}`);
      errors++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`  ${DRY_RUN ? 'Would reset' : 'Reset'}  : ${reset}`);
  console.log(`  Skipped  : ${skipped}`);
  console.log(`  Errors   : ${errors}`);

  if (DRY_RUN) {
    console.log('\nTo actually reset passwords, run:');
    console.log('  node tools/reset-passwords.js --execute\n');
  } else {
    console.log('\n✅ Done! Students can now log in with their ID number as their password.');
    console.log('   They should be prompted to change it on first login.\n');
  }
}

run().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
