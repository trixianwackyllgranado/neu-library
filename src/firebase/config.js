// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA_gpwMPCJOeRqn43myjZdf5eK-QdDqtqE",
  authDomain: "neu-library-v2.firebaseapp.com",
  projectId: "neu-library-v2",
  storageBucket: "neu-library-v2.firebasestorage.app",
  messagingSenderId: "324265754404",
  appId: "1:324265754404:web:c1c773f4c62a91abe1fdb1",
  measurementId: "G-9PS5411BC2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const analytics = getAnalytics(app);
export default app;