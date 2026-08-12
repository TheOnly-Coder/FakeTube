import { auth } from './firebase-config.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  updateProfile, 
  onAuthStateChanged 
} from 'firebase/auth';
import { ref, set, get } from 'firebase/database';
import { db } from './firebase-config.js';
import { showToast } from './utils.js';

let currentUser = null;
let authListeners = [];

export function onAuthChange(callback) {
  authListeners.push(callback);
  if (currentUser !== null) callback(currentUser);
}

export function getCurrentUser() {
  return currentUser;
}

export async function signup(email, password, displayName) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await set(ref(db, `users/${cred.user.uid}`), {
      displayName,
      email,
      photoURL: '',
      bio: '',
      subscriberCount: 0,
      createdAt: Date.now()
    });
    showToast('Account created!');
    return { success: true };
  } catch (err) {
    const msg = authErrorMessage(err.code);
    return { success: false, error: msg };
  }
}

export async function login(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showToast('Signed in!');
    return { success: true };
  } catch (err) {
    const msg = authErrorMessage(err.code);
    return { success: false, error: msg };
  }
}

export async function logout() {
  try {
    await signOut(auth);
    showToast('Signed out');
    return true;
  } catch {
    return false;
  }
}

export async function ensureUserRecord(uid) {
  const snap = await get(ref(db, `users/${uid}`));
  if (!snap.exists()) {
    const user = auth.currentUser;
    await set(ref(db, `users/${uid}`), {
      displayName: user?.displayName || 'Anonymous',
      email: user?.email || '',
      photoURL: user?.photoURL || '',
      bio: '',
      subscriberCount: 0,
      createdAt: Date.now()
    });
  }
}

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || 'Anonymous',
      photoURL: user.photoURL || ''
    };
  } else {
    currentUser = null;
  }
  authListeners.forEach(cb => cb(currentUser));
});

function authErrorMessage(code) {
  const messages = {
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/invalid-email': 'Please enter a valid email.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.'
  };
  return messages[code] || 'Something went wrong. Please try again.';
}
