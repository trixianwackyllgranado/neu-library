import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin  = require('firebase-admin');
const sa     = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function run() {
  const usersRef = db.collection('users');
  const snap = await usersRef.get();
  
  let deleted = 0;
  
  for (const doc of snap.docs) {
    const data = doc.data();
    
    // A ghost profile is one that was created via Google Sign-in but lacks an ID number,
    // meaning it failed to attach to the original pre-imported account data.
    if ((data.idNumber === '' || data.idNumber === undefined) && data.authProvider === 'google') {
      console.log(`Deleting ghost account: ${doc.id} (${data.email || 'no email'})`);
      await doc.ref.delete();
      deleted++;
    }
  }

  console.log(`\nCleanup complete! Deleted ${deleted} ghost accounts.`);
  console.log('Any student who logs in via Google will now correctly merge with their real ID profile.');
}

run().catch(console.error);
