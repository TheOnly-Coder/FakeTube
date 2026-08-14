import { db } from './firebase-config.js';
import {
  doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc,
  collection, getDocs, query, where, orderBy, limit,
  onSnapshot, increment, runTransaction
} from 'firebase/firestore';
import { getCurrentUser } from './auth.js';
import { escapeHtml } from './utils.js';

// ---- Auth UID → Channel ID mapping ----
// When a channel's Firestore doc ID is changed (migration), the Firebase Auth
// UID stays the same. This map lets the rest of the code resolve the correct
// channel ID for ownership checks, uploads, links, etc.
// Persisted to localStorage so it survives page reloads.
const AUTH_TO_CHANNEL_MAP = {};
const CHANNEL_MAP_KEY = 'ft_channel_map';

(function loadMappingsFromStorage() {
  try {
    const stored = localStorage.getItem(CHANNEL_MAP_KEY);
    if (stored) Object.assign(AUTH_TO_CHANNEL_MAP, JSON.parse(stored));
  } catch {}
})();

function saveMappingsToStorage() {
  try { localStorage.setItem(CHANNEL_MAP_KEY, JSON.stringify(AUTH_TO_CHANNEL_MAP)); } catch {}
}

/** Resolve a Firebase Auth UID to its canonical channel ID (Firestore doc ID). */
export function resolveChannelId(authUid) {
  return AUTH_TO_CHANNEL_MAP[authUid] || authUid;
}

/** Register a mapping after a channel ID migration. */
function registerChannelMapping(authUid, channelId) {
  AUTH_TO_CHANNEL_MAP[authUid] = channelId;
  saveMappingsToStorage();
}

// ---- Retry helper for Firestore reads ----
// App Check tokens may not be ready on first attempt (especially iOS Safari).
// Retries permission-denied errors with a short delay to let the token arrive.
async function withRetry(fn, retries = 2, delay = 1500) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isPermission = err.code === 'permission-denied' ||
        (err.message && err.message.includes('permission-denied'));
      if (isPermission && i < retries) {
        console.warn(`db: permission-denied on attempt ${i + 1}, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

// ---- Users ----
export async function getUser(uid) {
  return withRetry(async () => {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    // Follow migration redirect pointer
    if (data.migratedTo) {
      const redirect = await getDoc(doc(db, 'users', data.migratedTo));
      if (redirect.exists()) {
        registerChannelMapping(uid, data.migratedTo);
        return { id: data.migratedTo, ...redirect.data() };
      }
    }
    return { id: uid, ...data };
  });
}

export async function updateUser(uid, data) {
  // Sanitize user profile fields before writing
  const sanitized = {};
  if (data.displayName !== undefined) sanitized.displayName = String(data.displayName).substring(0, 50);
  if (data.bio !== undefined) sanitized.bio = String(data.bio).substring(0, 300);
  if (data.photoURL !== undefined) sanitized.photoURL = String(data.photoURL).substring(0, 500);
  if (data.banner !== undefined) sanitized.banner = String(data.banner).substring(0, 500);
  await updateDoc(doc(db, 'users', uid), sanitized);
}

// ---- User Profile Photo Cache ----
// Caches user profile lookups so comment sections don't refetch
// the same user's photo on every render.
const userProfileCache = {};

/** Get a user's profile (following migration redirects), with caching. */
export async function getUserProfile(uid) {
  if (userProfileCache[uid]) return userProfileCache[uid];
  const user = await getUser(uid);
  if (user) {
    userProfileCache[uid] = user;
  }
  return user;
}

/** Invalidate a single user's cached profile (e.g. after profile edit). */
export function invalidateProfileCache(uid) {
  delete userProfileCache[uid];
}

// ---- Videos ----
export async function createVideo(videoData) {
  // Sanitize and validate video data before writing to Firestore
  const sanitizedData = {
    title: String(videoData.title || '').substring(0, 100),
    description: String(videoData.description || '').substring(0, 5000),
    tags: Array.isArray(videoData.tags) ? videoData.tags.map(t => String(t || '').trim().substring(0, 50)).filter(Boolean).slice(0, 20) : [],
    uploaderId: String(videoData.uploaderId || '').substring(0, 100),
    uploaderUid: String(videoData.uploaderUid || '').substring(0, 100),
    uploaderName: String(videoData.uploaderName || '').substring(0, 50),
    uploaderPhoto: String(videoData.uploaderPhoto || '').substring(0, 500),
    videoUrl: String(videoData.videoUrl || '').substring(0, 2000),
    thumbnailUrl: String(videoData.thumbnailUrl || '').substring(0, 200000),
    duration: String(videoData.duration || '').substring(0, 20)
  };
  const ref = await addDoc(collection(db, 'videos'), {
    ...sanitizedData,
    views: 0,
    createdAt: Date.now()
  });
  return ref.id;
}

export async function getVideo(videoId) {
  return withRetry(async () => {
    const snap = await getDoc(doc(db, 'videos', videoId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  });
}

export async function getVideos(count = 50) {
  return withRetry(async () => {
    const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'), limit(count));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}

export async function getVideosByUser(uid, count = 50) {
  return withRetry(async () => {
    const q = query(
      collection(db, 'videos'),
      where('uploaderId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}

/**
 * Get videos for a channel page, handling migrated channels.
 * Queries both uploaderId (channel ID) AND uploaderUid (auth UID)
 * to catch videos that may have been uploaded with either value.
 * Deduplicates by video doc ID.
 */
export async function getVideosForChannel(channelId, count = 50) {
  const [byChannelId, byUid] = await Promise.all([
    withRetry(async () => {
      const q = query(
        collection(db, 'videos'),
        where('uploaderId', '==', channelId),
        orderBy('createdAt', 'desc'),
        limit(count)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }).catch(() => []),
    withRetry(async () => {
      const q = query(
        collection(db, 'videos'),
        where('uploaderUid', '==', channelId),
        orderBy('createdAt', 'desc'),
        limit(count)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }).catch(() => [])
  ]);
  // Merge and deduplicate by doc ID, sort by newest first
  const map = new Map();
  for (const v of byChannelId) map.set(v.id, v);
  for (const v of byUid) map.set(v.id, v);
  return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, count);
}

export async function incrementViews(videoId) {
  await updateDoc(doc(db, 'videos', videoId), {
    views: increment(1)
  });
}

export async function deleteVideo(videoId) {
  const video = await getVideo(videoId);
  if (!video) return;
  const user = getCurrentUser();
  if (!user) return;
  // Check ownership via uploaderUid (auth UID) first, then
  // fall back to uploaderId (channel ID) for backward compat
  // with videos uploaded before the uploaderUid field existed.
  const isOwner = video.uploaderUid === user.uid
    || video.uploaderId === resolveChannelId(user.uid);
  if (!isOwner) return;
  await deleteDoc(doc(db, 'videos', videoId));
  // Delete associated comments
  const snap = await getDocs(query(collection(db, 'comments'), where('videoId', '==', videoId)));
  for (const d of snap.docs) await deleteDoc(doc(db, 'comments', d.id));
}

// ---- Comments ----
export async function addComment(videoId, text, user) {
  // Sanitize inputs before sending to Firestore
  const sanitizedText = String(text).substring(0, 1000);
  const ref = await addDoc(collection(db, 'comments'), {
    videoId: String(videoId).substring(0, 100),
    text: sanitizedText,
    userId: user.uid,
    userName: String(user.displayName || 'Anonymous').substring(0, 50),
    // userPhoto is no longer stored — the browser loads it live from
    // the commenter's user profile via their userId. Kept as empty string
    // for backward compat with old comment rendering code.
    userPhoto: '',
    createdAt: Date.now()
  });
  return ref.id;
}

export async function getComments(videoId) {
  return withRetry(async () => {
    const q = query(
      collection(db, 'comments'),
      where('videoId', '==', videoId),
      orderBy('createdAt', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}

export function onCommentsChange(videoId, callback) {
  const q = query(
    collection(db, 'comments'),
    where('videoId', '==', videoId),
    orderBy('createdAt', 'asc')
  );
  const unsubscribe = onSnapshot(q, (snap) => {
    const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(comments);
  });
  return unsubscribe;
}

// ---- Notify (Subscriptions) ----
export async function toggleNotify(channelId) {
  const user = getCurrentUser();
  if (!user) return false;
  // Prevent self-subscription (compare against resolved channel ID)
  if (channelId === resolveChannelId(user.uid)) return false;
  // Subscriber doc ID always uses auth UID for the subscriber part
  const subDocId = `${channelId}_${user.uid}`;
  const subRef = doc(db, 'subscribers', subDocId);
  const snap = await getDoc(subRef);

  if (snap.exists()) {
    // Unsubscribe
    await deleteDoc(subRef);
    await updateDoc(doc(db, 'users', channelId), {
      subscriberCount: increment(-1)
    });
    return false;
  } else {
    // Subscribe
    await setDoc(subRef, {
      channelId,
      subscriberId: user.uid,
      createdAt: Date.now()
    });
    await updateDoc(doc(db, 'users', channelId), {
      subscriberCount: increment(1)
    });
    return true;
  }
}

export async function isNotifying(channelId) {
  const user = getCurrentUser();
  if (!user) return false;
  return withRetry(async () => {
    const snap = await getDoc(doc(db, 'subscribers', `${channelId}_${user.uid}`));
    return snap.exists();
  });
}

export async function getSubscriberCount(channelId) {
  return withRetry(async () => {
    const snap = await getDoc(doc(db, 'users', channelId));
    if (!snap.exists()) return 0;
    return snap.data().subscriberCount || 0;
  });
}

// ---- Search ----
export async function searchVideos(searchTerm) {
  // getVideos already has retry built in
  const allVideos = await getVideos(200);
  const term = searchTerm.toLowerCase();
  return allVideos.filter(v =>
    (v.title && v.title.toLowerCase().includes(term)) ||
    (v.description && v.description.toLowerCase().includes(term)) ||
    (v.uploaderName && v.uploaderName.toLowerCase().includes(term)) ||
    (v.tags && Array.isArray(v.tags) && v.tags.some(t => (t || '').toLowerCase().includes(term)))
  );
}

export async function searchChannels(searchTerm) {
  return withRetry(async () => {
    const snap = await getDocs(collection(db, 'users'));
    const term = searchTerm.toLowerCase();
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => !u.migratedTo && u.displayName && u.displayName.toLowerCase().includes(term));
  });
}

// ---- Posts ----
export async function createPost(postData) {
  const ref = await addDoc(collection(db, 'posts'), {
    ...postData,
    stars: 0,
    createdAt: Date.now()
  });
  return ref.id;
}

export async function getPost(postId) {
  return withRetry(async () => {
    const snap = await getDoc(doc(db, 'posts', postId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  });
}

export async function getPostsByUser(userId, count = 50) {
  return withRetry(async () => {
    const q = query(
      collection(db, 'posts'),
      where('channelId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}

/**
 * Get posts from channels the current user is subscribed to.
 * Returns posts ordered by newest first, up to `count`.
 */
export async function getSubscribedPosts(count = 20) {
  const user = getCurrentUser();
  if (!user) return [];

  return withRetry(async () => {
    // Get all subscriptions for current user
    const subSnap = await getDocs(query(
      collection(db, 'subscribers'),
      where('subscriberId', '==', user.uid)
    ));
    if (subSnap.empty) return [];

    const channelIds = subSnap.docs.map(d => d.data().channelId);
    if (channelIds.length === 0) return [];

    // Firestore 'in' queries support max 30 items
    const chunks = [];
    for (let i = 0; i < channelIds.length; i += 30) {
      chunks.push(channelIds.slice(i, i + 30));
    }

    let allPosts = [];
    for (const chunk of chunks) {
      const q = query(
        collection(db, 'posts'),
        where('channelId', 'in', chunk),
        orderBy('createdAt', 'desc'),
        limit(count)
      );
      const snap = await getDocs(q);
      allPosts.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }

    // Sort all by newest first and trim
    allPosts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return allPosts.slice(0, count);
  });
}

export async function deletePost(postId) {
  const post = await getPost(postId);
  if (!post) return;
  const user = getCurrentUser();
  if (post.channelId !== resolveChannelId(user?.uid)) return;
  await deleteDoc(doc(db, 'posts', postId));
  // Delete post comments
  const snap = await getDocs(query(collection(db, 'postComments'), where('postId', '==', postId)));
  for (const d of snap.docs) await deleteDoc(doc(db, 'postComments', d.id));
  // Delete stars
  const starSnap = await getDocs(query(collection(db, 'postStars'), where('postId', '==', postId)));
  for (const d of starSnap.docs) await deleteDoc(doc(db, 'postStars', d.id));
}

// ---- Post Stars ----
export async function togglePostStar(postId) {
  const user = getCurrentUser();
  if (!user) return false;
  const starDocId = `${postId}_${user.uid}`;
  const starRef = doc(db, 'postStars', starDocId);
  const snap = await getDoc(starRef);

  if (snap.exists()) {
    await deleteDoc(starRef);
    // Best-effort: don't fail the whole toggle if the count update errors
    try {
      await updateDoc(doc(db, 'posts', postId), { stars: increment(-1) });
    } catch (e) {
      console.warn('Star count decrement failed:', e);
    }
    return false;
  } else {
    await setDoc(starRef, { postId, userId: user.uid, createdAt: Date.now() });
    // Best-effort: don't fail the whole toggle if the count update errors
    try {
      await updateDoc(doc(db, 'posts', postId), { stars: increment(1) });
    } catch (e) {
      console.warn('Star count increment failed:', e);
    }
    return true;
  }
}

/**
 * Migrate a channel's Firestore document ID.
 * Copies the user doc, updates all videos/posts/subscribers, replaces the
 * old doc with a redirect pointer, and registers the mapping in memory.
 *
 * Collections updated:
 *   users/{oldId} → users/{newId}
 *   videos: uploaderId field
 *   posts: channelId field
 *   subscribers: doc IDs and channelId field (where this channel is the channel)
 *
 * Returns { success, stats, error? }
 */
export async function migrateChannelId(oldId, newId) {
  const stats = { videos: 0, posts: 0, subscribersIn: 0 };

  try {
    // 1. Copy user doc to new ID
    const oldSnap = await getDoc(doc(db, 'users', oldId));
    if (!oldSnap.exists()) {
      return { success: false, error: 'Old user document not found.' };
    }
    const oldData = oldSnap.data();
    // Remove serverTimestamp fields that can't be re-written as-is
    const { createdAt, ...rest } = oldData;
    await setDoc(doc(db, 'users', newId), { ...rest, createdAt });

    // 2. Update all videos: uploaderId → newId
    const vidSnap = await getDocs(query(collection(db, 'videos'), where('uploaderId', '==', oldId)));
    for (const vDoc of vidSnap.docs) {
      await updateDoc(doc(db, 'videos', vDoc.id), { uploaderId: newId });
      stats.videos++;
    }

    // 3. Update all posts: channelId → newId
    const postSnap = await getDocs(query(collection(db, 'posts'), where('channelId', '==', oldId)));
    for (const pDoc of postSnap.docs) {
      await updateDoc(doc(db, 'posts', pDoc.id), { channelId: newId });
      stats.posts++;
    }

    // 4. Migrate subscriber docs where this channel IS the channel
    const subInSnap = await getDocs(query(collection(db, 'subscribers'), where('channelId', '==', oldId)));
    for (const sDoc of subInSnap.docs) {
      const data = sDoc.data();
      const subscriberId = data.subscriberId;
      // Create new doc with new ID pattern: {newId}_{subscriberId}
      await setDoc(doc(db, 'subscribers', `${newId}_${subscriberId}`), {
        ...data,
        channelId: newId
      });
      // Delete old doc
      await deleteDoc(doc(db, 'subscribers', sDoc.id));
      stats.subscribersIn++;
    }

    // 5. Subscriber docs where this user IS the subscriber (FakeTube subscribes
    //    to other channels) do NOT need migration — they use auth UID as
    //    subscriberId and isNotifying/getSubscribedPosts look up by auth UID.

    // 6. Replace old user doc with a lightweight redirect pointer
    await setDoc(doc(db, 'users', oldId), { migratedTo: newId });

    // 7. Register the mapping in memory for this session
    registerChannelMapping(oldId, newId);

    return { success: true, stats };
  } catch (err) {
    console.error('Migration error:', err);
    return { success: false, error: err.message || 'Migration failed.' };
  }
}

export async function isPostStarred(postId) {
  const user = getCurrentUser();
  if (!user) return false;
  return withRetry(async () => {
    const snap = await getDoc(doc(db, 'postStars', `${postId}_${user.uid}`));
    return snap.exists();
  });
}

// ---- Post Comments ----
export async function addPostComment(postId, text, user) {
  // Sanitize inputs before sending to Firestore
  const sanitizedText = String(text).substring(0, 1000);
  const ref = await addDoc(collection(db, 'postComments'), {
    postId: String(postId).substring(0, 100),
    text: sanitizedText,
    userId: user.uid,
    userName: String(user.displayName || 'Anonymous').substring(0, 50),
    userPhoto: String(user.photoURL || '').substring(0, 500),
    createdAt: Date.now()
  });
  return ref.id;
}

export function onPostCommentsChange(postId, callback) {
  const q = query(
    collection(db, 'postComments'),
    where('postId', '==', postId),
    orderBy('createdAt', 'asc')
  );
  const unsubscribe = onSnapshot(q, (snap) => {
    const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(comments);
  });
  return unsubscribe;
}
