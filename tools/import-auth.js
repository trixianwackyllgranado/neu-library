#!/usr/bin/env node
/**
 * tools/import-auth.js
 *
 * Imports Firebase Auth users from a JSON export (firebase auth:export users.json)
 * using the SCRYPT hash configuration from the original NEU Library project.
 *
 * Usage:
 *   node tools/import-auth.js                          # dry run
 *   node tools/import-auth.js --execute                # live import
 *   node tools/import-auth.js --file=path/to/users.json --execute
 *
 * Requires:
 *   npm install firebase-admin
 *   SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS env var set.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth }              from 'firebase-admin/auth';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ── SCRYPT hash config from original project ──────────────────────────────────
const HASH_CONFIG = {
  hashAlgorithm:  'SCRYPT',
  signerKey:      Buffer.from(
    'k0IZeEi6RbQ7IGOMEJ6kasUj1Vc0MD+ZjRl3zC5GVfdnQtVVt13R/YDZOdJM1pjwmQ4tmm8z17N/viyBbeZBkA==',
    'base64',
  ),
  saltSeparator:  Buffer.from('Bw==', 'base64'),
  rounds:         8,
  memoryCost:     14,
};

// ── Args ──────────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const DRY_RUN  = !args.includes('--execute');
const FILE_ARG = (args.find(a => a.startsWith('--file=')) || '').replace('--file=', '').trim()
  || resolve(process.cwd(), 'users.json');

// ── Init ──────────────────────────────────────────────────────────────────────
const saPath = process.env.SERVICE_ACCOUNT_PATH
  || process.env.GOOGLE_APPLICATION_CREDENTIALS
  || resolve(process.cwd(), 'service-account.json');

if (!existsSync(saPath)) {
  console.error(`\n[ERROR] Service account not found: ${saPath}\n`);
  process.exit(1);
}
if (!existsSync(FILE_ARG)) {
  console.error(`\n[ERROR] Users export file not found: ${FILE_ARG}\n`);
  console.error('Run: firebase auth:export users.json --format=json\n');
  process.exit(1);
}

initializeApp({ credential: cert(saPath) });
const auth = getAuth();

// ── Parse export ──────────────────────────────────────────────────────────────
const raw   = JSON.parse(readFileSync(FILE_ARG, 'utf-8'));
const users = raw.users || raw; // firebase auth:export wraps in { users: [...] }

console.log(`\n=== NEU Library — Auth Import Script ===`);
console.log(`Mode      : ${DRY_RUN ? 'DRY RUN' : 'LIVE EXECUTE'}`);
console.log(`Source    : ${FILE_ARG}`);
console.log(`Users     : ${users.length}`);
console.log(`Algorithm : SCRYPT (rounds=${HASH_CONFIG.rounds}, memCost=${HASH_CONFIG.memoryCost})\n`);

if (DRY_RUN) {
  console.log('[DRY RUN] First 5 users that would be imported:');
  users.slice(0, 5).forEach((u, i) => {
    console.log(`  ${i + 1}. uid=${u.localId}  email=${u.email}  disabled=${!!u.disabled}`);
  });
  console.log('\nRe-run with --execute to perform the actual import.\n');
  process.exit(0);
}

// ── Import in batches of 1000 (Firebase limit) ────────────────────────────────
async function run() {
  const BATCH_SIZE = 1000;
  let imported = 0;
  let failed   = 0;

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const chunk = users.slice(i, i + BATCH_SIZE).map(u => ({
      uid:           u.localId,
      email:         u.email,
      emailVerified: u.emailVerified || false,
      displayName:   u.displayName  || undefined,
      disabled:      u.disabled     || false,
      passwordHash:  u.passwordHash ? Buffer.from(u.passwordHash, 'base64') : undefined,
      passwordSalt:  u.salt         ? Buffer.from(u.salt,         'base64') : undefined,
      metadata: {
        creationTime: u.createdAt ? new Date(parseInt(u.createdAt)).toISOString() : undefined,
        lastSignInTime: u.lastLoginAt ? new Date(parseInt(u.lastLoginAt)).toISOString() : undefined,
      },
    }));

    const result = await auth.importUsers(chunk, { hash: HASH_CONFIG });

    imported += result.successCount;
    failed   += result.failureCount;

    if (result.errors.length > 0) {
      result.errors.forEach(e => {
        console.warn(`  [WARN] UID ${chunk[e.index]?.uid}: ${e.error.message}`);
      });
    }

    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: imported ${result.successCount}, failed ${result.failureCount}`);
  }

  console.log('\n=== Import Complete ===');
  console.log(`  Success : ${imported}`);
  console.log(`  Failed  : ${failed}\n`);
}

run().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
