import { db } from './firebase-config.js';
import {
  doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc,
  collection, getDocs, query, where, orderBy, limit,
  onSnapshot, increment, runTransaction
} from 'firebase/firestore';
import { getCurrentUser } from './auth.js';

// ---- Users ----
export async function getUser(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return { id: uid, ...data };
}

export async function updateUser(uid, data) {
  await updateDoc(doc(db, 'users', uid), data);
}

// ---- Videos ----
export async function createVideo(videoData) {
  const ref = await addDoc(collection(db, 'videos'), {
    ...videoData,
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
  const ref = await addDoc(collection(db, 'comments'), {
    videoId,
    text,
    userId: user.uid,
    userName: user.displayName,
    userPhoto: user.photoURL || '',
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
    (v.uploaderName && v.uploaderName.toLowerCase().includes(term))
  );
}
