import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin  = require('firebase-admin');
const sa     = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const auth = admin.auth();

async function run() {
  const email = 'trixianwackyll.granado@neu.edu.ph';
  console.log(`Checking Auth users for: ${email}`);
  
  try {
    const userRecord = await auth.getUserByEmail(email);
    console.log(`- UID: ${userRecord.uid}`);
    console.log(`- Provider: ${userRecord.providerData.map(p => p.providerId).join(', ')}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log('No Auth user found with this email.');
    } else {
      console.error(err);
    }
  }

  // Also check if there's a user with a UID that looks like the student number (if any)
  // or just check the one found in Firestore.
}

run().catch(console.error);
