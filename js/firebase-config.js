// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: "AIzaSyAj9nZ6XGnK_VdGeqHg47QpN8dt1T2C3zQ",
  authDomain: "faketube-d10ee.firebaseapp.com",
  projectId: "faketube-d10ee",
  storageBucket: "faketube-d10ee.firebasestorage.app",
  messagingSenderId: "926439479138",
  appId: "1:926439479138:web:7842d77cceb0d044343e3b"
};

const app = initializeApp(firebaseConfig);

// Firebase App Check with reCAPTCHA v3 — must be initialized before
// any Firestore/Auth calls so tokens are attached automatically.
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LeIyoEtAAAAALYDqRR00QtoC_KawQ3DLK5c7nAE'),
  isTokenAutoRefreshEnabled: true
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
