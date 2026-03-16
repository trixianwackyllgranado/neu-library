import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin  = require('firebase-admin');
const sa     = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function run() {
  const badIds = [
    'Q4xr6CxkXzMNZFPex7aZhOQkXgH3',
    'bFqmCvpj1sTMVIcxeNxj694GFIV2'
  ];

  for (const id of badIds) {
    console.log(`Deleting rogue legacy document: ${id}`);
    await db.collection('users').doc(id).delete();
  }

  console.log("Cleanup complete!");
}

run().catch(console.error);
