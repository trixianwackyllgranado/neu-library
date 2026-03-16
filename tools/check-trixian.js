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
  console.log("== ID 24-12998-121 ==");
  const snap1 = await usersRef.where('idNumber', '==', '24-12998-121').get();
  snap1.forEach(d => console.log(d.id, "email:", d.data().email, "role:", d.data().role));

  console.log("\n== Email trixianwackyll.granado@neu.edu.ph ==");
  const snap2 = await usersRef.where('email', '==', 'trixianwackyll.granado@neu.edu.ph').get();
  snap2.forEach(d => console.log(d.id, "email:", d.data().email, "role:", d.data().role, "idNumber:", d.data().idNumber));
}

run().catch(console.error);
