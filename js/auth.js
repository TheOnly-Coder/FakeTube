import { auth, db } from './firebase-config.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  updateProfile, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { resolveChannelId, getUser } from './db.js';
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
      createdAt: serverTimestamp(),
      authUid: cred.user.uid
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
  let docId = resolveChannelId(uid);
  let snap = await getDoc(doc(db, 'users', docId));

  // Follow migration redirect if the resolved ID is still a stub
  if (snap.exists() && snap.data().migratedTo) {
    docId = snap.data().migratedTo;
    snap = await getDoc(doc(db, 'users', docId));
  }

  if (!snap.exists()) {
    const user = auth.currentUser;
    await setDoc(doc(db, 'users', docId), {
      displayName: user?.displayName || 'Anonymous',
      email: user?.email || '',
      photoURL: user?.photoURL || '',
      bio: '',
      subscriberCount: 0,
      createdAt: serverTimestamp(),
      authUid: uid
    });
  } else {
    // Sync currentUser with Firestore user doc (photoURL, displayName may
    // differ from auth profile if the user edited their profile in-app).
    const data = snap.data();
    if (currentUser) {
      if (data.photoURL !== undefined && data.photoURL !== '') currentUser.photoURL = data.photoURL;
      if (data.displayName) currentUser.displayName = data.displayName;
      // Backfill authUid if this is an old doc that doesn't have it yet
      if (!data.authUid) {
        try { await updateDoc(doc(db, 'users', docId), { authUid: uid }); } catch {}
      }
    }
  }
}

// Listen for auth state changes
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const channelId = resolveChannelId(user.uid);
    currentUser = {
      uid: user.uid,
      channelId,
      email: user.email,
      displayName: user.displayName || 'Anonymous',
      photoURL: user.photoURL || ''
    };
    // Notify immediately for fast initial render
    authListeners.forEach(cb => cb(currentUser));

    // Sync photoURL/displayName from Firestore user doc
    // (may differ from Firebase Auth if user edited profile in-app)
    try {
      const fsUser = await getUser(channelId);
      if (fsUser && !fsUser.migratedTo) {
        let changed = false;
        if (fsUser.photoURL !== undefined && fsUser.photoURL !== '' && fsUser.photoURL !== currentUser.photoURL) {
          currentUser.photoURL = fsUser.photoURL;
          changed = true;
        }
        if (fsUser.displayName && fsUser.displayName !== currentUser.displayName) {
          currentUser.displayName = fsUser.displayName;
          changed = true;
        }
        if (changed) authListeners.forEach(cb => cb(currentUser));
      }
    } catch (e) {
      console.warn('Could not sync user profile from Firestore:', e);
    }
  } else {
    currentUser = null;
    authListeners.forEach(cb => cb(currentUser));
  }
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
