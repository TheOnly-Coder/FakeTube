// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAj9nZ6XGnK_VdGeqHg47QpN8dt1T2C3zQ",
  authDomain: "faketube-d10ee.firebaseapp.com",
  // IMPORTANT: Create the Realtime Database in Firebase Console first,
  // then paste its URL below (e.g. https://faketube-d10ee-default-rtdbREGION.firebaseio.com)
  databaseURL: "https://faketube-d10ee-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "faketube-d10ee",
  storageBucket: "faketube-d10ee.firebasestorage.app",
  messagingSenderId: "926439479138",
  appId: "1:926439479138:web:7842d77cceb0d044343e3b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
export default app;
