// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeAppCheck, getToken, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: "AIzaSyAj9nZ6XGnK_VdGeqHg47QpN8dt1T2C3zQ",
  authDomain: "faketube-d10ee.firebaseapp.com",
  databaseURL: "https://faketube-d10ee-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "faketube-d10ee",
  storageBucket: "faketube-d10ee.firebasestorage.app",
  messagingSenderId: "926439479138",
  appId: "1:926439479138:web:7842d77cceb0d044343e3b"
};

const app = initializeApp(firebaseConfig);

// Firebase App Check with reCAPTCHA v3 — must be initialized before
// any Firestore/Auth calls so tokens are attached automatically.
// Capture the return value; getToken() needs this instance, not the app.
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LeIyoEtAAAAALYDqRR00QtoC_KawQ3DLK5c7nAE'),
  isTokenAutoRefreshEnabled: true
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;

/**
 * Explicitly obtain an App Check token before making Firestore calls.
 * On mobile (especially iOS Chrome/Safari), reCAPTCHA v3 initialization
 * can be slow due to ITP and network latency. Without waiting, Firestore
 * queries fire without a valid App Check token and get rejected by rules.
 *
 * Retries up to `attempts` times with `delay` ms between each try.
 * Returns true if a token was obtained, false if all retries failed.
 */
export async function waitForAppCheck({ attempts = 3, delay = 2000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      await getToken(appCheck, /* forceRefresh */ false);
      console.log('App Check: token obtained' + (i > 0 ? ` (retry ${i})` : ''));
      return true;
    } catch (err) {
      console.warn(`App Check: token attempt ${i + 1}/${attempts} failed:`, err.message || err);
      if (i < attempts - 1) {
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  console.error('App Check: all token attempts failed');
  return false;
}
