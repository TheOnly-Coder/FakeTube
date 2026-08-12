// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAj9nZ6XGnK_VdGeqHg47QpN8dt1T2C3zQ",
  authDomain: "faketube-d10ee.firebaseapp.com",
  projectId: "faketube-d10ee",
  storageBucket: "faketube-d10ee.firebasestorage.app",
  messagingSenderId: "926439479138",
  appId: "1:926439479138:web:7842d77cceb0d044343e3b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
