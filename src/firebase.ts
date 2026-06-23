import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig';

let app;
let db: any = null;
let storage: any = null;

if (isFirebaseConfigured()) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (e) {
    console.error("Failed to initialize Firebase:", e);
  }
}

export { db, storage };
