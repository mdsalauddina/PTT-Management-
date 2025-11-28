import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD6vKQhSJY_UYuQIwZfivjA86h_A5v5D6g",
  authDomain: "ptt-management.firebaseapp.com",
  projectId: "ptt-management",
  storageBucket: "ptt-management.firebasestorage.app",
  messagingSenderId: "711781351126",
  appId: "1:711781351126:web:338a884027e190f0195377",
  measurementId: "G-QW4QSV37V6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
       console.warn('Multiple tabs open, persistence can only be enabled in one tab at a a time.');
    } else if (err.code === 'unimplemented') {
       console.warn('The current browser does not support all of the features required to enable persistence');
    }
  });
} catch (e) {
  console.warn("Persistence setup skipped");
}
