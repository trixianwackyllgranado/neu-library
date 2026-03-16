/**
 * tools/populate-emails.js
 *
 * Populates the `email` field for legacy users in Firestore so that
 * Google Sign-in can find and link their accounts.
 *
 * Format: firstname.lastname@neu.edu.ph
 * Used by checking if email is missing.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin  = require('firebase-admin');
const sa     = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function run() {
  const snapshot = await db.collection('users').get();
  
  let updated = 0;
  let skipped = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    
    if (data.email) {
      skipped++;
      continue;
    }

    // Only populate if they have a first/lastName and don't already have an email
    if (data.firstName && data.lastName && data.role !== 'admin') {
      // Expected formula: Trixian Wackyll -> trixianwackyll
      const fn = data.firstName.toLowerCase().replace(/[^a-z]/g, '');
      const ln = data.lastName.toLowerCase().replace(/[^a-z]/g, '');
      
      if (fn && ln) {
        const expectedEmail = `${fn}.${ln}@neu.edu.ph`;
        
        console.log(`Populating: ${data.idNumber || data.uid} -> ${expectedEmail}`);
        await db.collection('users').doc(docSnap.id).update({
          email: expectedEmail
        });
        updated++;
      } else {
        skipped++;
      }
    } else {
      skipped++;
    }
  }

  console.log(`\nUpdated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
}

run().catch(console.error);
