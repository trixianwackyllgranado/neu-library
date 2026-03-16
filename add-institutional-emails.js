#!/usr/bin/env node

/**
 * Migration Script: Add Institutional Emails to Existing Users
 * 
 * Generates firstname.lastname@neu.edu.ph emails for all existing users
 * based on their firstName and lastName fields in Firestore.
 * 
 * Format Rules:
 * - All lowercase
 * - Multi-word first names combined without spaces (e.g., "TRIXIAN WACKYLL" → "trixianwackyll")
 * - Special characters removed
 * - Pattern: {firstname}.{lastname}@neu.edu.ph
 * 
 * Usage:
 *   node add-institutional-emails.js
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Generate institutional email from first and last name
 */
function generateInstitutionalEmail(firstName, lastName) {
  if (!firstName || !lastName) {
    return null;
  }

  // Normalize: remove spaces, convert to lowercase, remove special chars
  const cleanFirst = firstName
    .trim()
    .replace(/\s+/g, '') // Remove all spaces (for multi-word names)
    .toLowerCase()
    .replace(/[^a-z]/g, ''); // Remove non-alphabetic characters
  
  const cleanLast = lastName
    .trim()
    .replace(/\s+/g, '') // Remove all spaces
    .toLowerCase()
    .replace(/[^a-z]/g, ''); // Remove non-alphabetic characters

  if (!cleanFirst || !cleanLast) {
    return null;
  }

  return `${cleanFirst}.${cleanLast}@neu.edu.ph`;
}

/**
 * Main migration function
 */
async function migrateEmails() {
  console.log('🚀 Starting institutional email migration...\n');

  try {
    // Get all users from Firestore
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('❌ No users found in Firestore');
      return;
    }

    console.log(`📊 Found ${usersSnapshot.size} users\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    const batch = db.batch();
    const updates = [];

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userId = doc.id;

      // Skip if email already exists
      if (userData.email) {
        console.log(`⏭️  Skipping ${userData.firstName} ${userData.lastName} - email already set`);
        skipped++;
        continue;
      }

      // Skip test accounts
      if (userData.idNumber === '33-33333-333' || userData.lastName === 'EXAMPLE') {
        console.log(`⏭️  Skipping test account: ${userData.firstName} ${userData.lastName}`);
        skipped++;
        continue;
      }

      // Skip if using Google auth provider (they already have an email)
      if (userData.authProvider === 'google') {
        console.log(`⏭️  Skipping Google user: ${userData.firstName} ${userData.lastName}`);
        skipped++;
        continue;
      }

      // Generate email
      const email = generateInstitutionalEmail(userData.firstName, userData.lastName);

      if (!email) {
        console.log(`❌ ERROR: Could not generate email for ${userData.firstName} ${userData.lastName} (ID: ${userData.idNumber})`);
        errors++;
        continue;
      }

      // Queue update
      updates.push({
        userId,
        email,
        name: `${userData.firstName} ${userData.lastName}`,
        idNumber: userData.idNumber
      });

      // Batch update (Firestore limit is 500 per batch)
      batch.update(doc.ref, { email });
    }

    // Commit batch update
    if (updates.length > 0) {
      console.log(`\n💾 Committing ${updates.length} updates to Firestore...`);
      await batch.commit();
      updated = updates.length;

      // Display results
      console.log('\n✅ Migration Complete!\n');
      console.log('═══════════════════════════════════════════════════════════════');
      
      updates.forEach(({ name, idNumber, email }) => {
        console.log(`✓ ${name.padEnd(40)} ${idNumber.padEnd(15)} → ${email}`);
      });
      
      console.log('═══════════════════════════════════════════════════════════════');
    }

    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors:  ${errors}`);
    console.log(`   📁 Total:   ${usersSnapshot.size}\n`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run migration
migrateEmails();
