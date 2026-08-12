// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCGNgO66TR_YHLmiOCAYItn0a2gEAT23a0",
  authDomain: "scream-of-justice.firebaseapp.com",
  databaseURL: "https://scream-of-justice-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "scream-of-justice",
  storageBucket: "scream-of-justice.firebasestorage.app",
  messagingSenderId: "178618721941",
  appId: "1:178618721941:web:a8ff42aaff277e1b405d9c",
  measurementId: "G-H8KWQD8FT4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
export default app;
