import { auth, db } from './firebase-config.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  updateProfile, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { resolveChannelId } from './db.js';
import { showToast, rateLimit } from './utils.js';

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
  // Client-side rate limit: 3 signups per 5 minutes
  if (!rateLimit('signup', 3, 300000)) {
    return { success: false, error: 'Too many signup attempts. Please wait a few minutes.' };
  }
  // Validate password strength beyond Firebase's 6-char minimum
  if (password && !/[A-Z]/.test(password)) {
    return { success: false, error: 'Password must contain at least one uppercase letter.' };
  }
  if (password && !/[a-z]/.test(password)) {
    return { success: false, error: 'Password must contain at least one lowercase letter.' };
  }
  if (password && !/[0-9]/.test(password)) {
    return { success: false, error: 'Password must contain at least one number.' };
  }
  // Validate display name
  if (!displayName || displayName.trim().length < 2) {
    return { success: false, error: 'Display name must be at least 2 characters.' };
  }
  if (displayName.length > 50) {
    return { success: false, error: 'Display name is too long (max 50 characters).' };
  }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await setDoc(doc(db, 'users', cred.user.uid), {
      displayName,
      email,
      photoURL: '',
      bio: '',
      subscriberCount: 0,
      createdAt: serverTimestamp()
    });
    showToast('Account created!');
    return { success: true };
  } catch (err) {
    const msg = authErrorMessage(err.code);
    return { success: false, error: msg };
  }
}

export async function login(email, password) {
  // Client-side rate limit: 10 login attempts per 5 minutes
  if (!rateLimit('login', 10, 300000)) {
    return { success: false, error: 'Too many login attempts. Please wait a few minutes.' };
  }
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
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) {
    const user = auth.currentUser;
    await setDoc(doc(db, 'users', uid), {
      displayName: user?.displayName || 'Anonymous',
      email: user?.email || '',
      photoURL: user?.photoURL || '',
      bio: '',
      subscriberCount: 0,
      createdAt: serverTimestamp()
    });
  } else {
    // Sync currentUser with Firestore user doc (photoURL, displayName may
    // differ from auth profile if the user edited their profile in-app).
    const data = snap.data();
    if (data && !data.migratedTo && currentUser) {
      if (data.photoURL !== undefined) currentUser.photoURL = data.photoURL;
      if (data.displayName) currentUser.displayName = data.displayName;
    }
  }
}

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    const channelId = resolveChannelId(user.uid);
    currentUser = {
      uid: user.uid,
      channelId,
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
