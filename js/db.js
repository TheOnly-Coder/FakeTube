import { db } from './firebase-config.js';
import {
  doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc,
  collection, getDocs, query, where, orderBy, limit,
  onSnapshot, increment, runTransaction
} from 'firebase/firestore';
import { getCurrentUser } from './auth.js';
import { escapeHtml } from './utils.js';

// ---- Users ----
export async function getUser(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return { id: uid, ...data };
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

// ---- Videos ----
export async function createVideo(videoData) {
  // Sanitize and validate video data before writing to Firestore
  const sanitizedData = {
    title: String(videoData.title || '').substring(0, 100),
    description: String(videoData.description || '').substring(0, 5000),
    tags: Array.isArray(videoData.tags) ? videoData.tags.map(t => String(t || '').trim().substring(0, 50)).filter(Boolean).slice(0, 20) : [],
    uploaderId: String(videoData.uploaderId || '').substring(0, 100),
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
  const snap = await getDoc(doc(db, 'videos', videoId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getVideos(count = 50) {
  const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getVideosByUser(uid, count = 50) {
  const q = query(
    collection(db, 'videos'),
    where('uploaderId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
  if (video.uploaderId !== user?.uid) return;
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
    userPhoto: String(user.photoURL || '').substring(0, 500),
    createdAt: Date.now()
  });
  return ref.id;
}

export async function getComments(videoId) {
  const q = query(
    collection(db, 'comments'),
    where('videoId', '==', videoId),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
  if (!user || channelId === user.uid) return false;
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
  const snap = await getDoc(doc(db, 'subscribers', `${channelId}_${user.uid}`));
  return snap.exists();
}

export async function getSubscriberCount(channelId) {
  const snap = await getDoc(doc(db, 'users', channelId));
  if (!snap.exists()) return 0;
  return snap.data().subscriberCount || 0;
}

// ---- Search ----
export async function searchVideos(searchTerm) {
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
  const snap = await getDocs(collection(db, 'users'));
  const term = searchTerm.toLowerCase();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(u => u.displayName && u.displayName.toLowerCase().includes(term));
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
  const snap = await getDoc(doc(db, 'posts', postId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getPostsByUser(userId, count = 50) {
  const q = query(
    collection(db, 'posts'),
    where('channelId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Get posts from channels the current user is subscribed to.
 * Returns posts ordered by newest first, up to `count`.
 */
export async function getSubscribedPosts(count = 20) {
  const user = getCurrentUser();
  if (!user) return [];

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
}

export async function deletePost(postId) {
  const post = await getPost(postId);
  if (!post) return;
  const user = getCurrentUser();
  if (post.channelId !== user?.uid) return;
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

export async function isPostStarred(postId) {
  const user = getCurrentUser();
  if (!user) return false;
  const snap = await getDoc(doc(db, 'postStars', `${postId}_${user.uid}`));
  return snap.exists();
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
