import { db } from './firebase-config.js';
import { 
  ref, set, get, push, update, remove, 
  onValue, off, query, orderByChild, limitToLast, limitToFirst 
} from 'firebase/database';
import { getCurrentUser } from './auth.js';

// ---- Users ----
export async function getUser(uid) {
  const snap = await get(ref(db, `users/${uid}`));
  return snap.exists() ? snap.val() : null;
}

export async function updateUser(uid, data) {
  const updates = {};
  for (const [k, v] of Object.entries(data)) updates[`users/${uid}/${k}`] = v;
  await update(ref(db), updates);
}

// ---- Videos ----
export async function createVideo(videoData) {
  const id = push(ref(db, 'videos')).key;
  await set(ref(db, `videos/${id}`), { ...videoData, id, views: 0, createdAt: Date.now() });
  return id;
}

export async function getVideo(videoId) {
  const snap = await get(ref(db, `videos/${videoId}`));
  return snap.exists() ? { id: videoId, ...snap.val() } : null;
}

export async function getVideos(count = 50) {
  const snap = await get(query(ref(db, 'videos'), orderByChild('createdAt'), limitToLast(count)));
  if (!snap.exists()) return [];
  const videos = [];
  snap.forEach(child => videos.push({ id: child.key, ...child.val() }));
  return videos.reverse();
}

export async function getVideosByUser(uid, count = 50) {
  const snap = await get(query(ref(db, 'videos'), orderByChild('uploaderId'), limitToLast(count)));
  if (!snap.exists()) return [];
  const videos = [];
  snap.forEach(child => {
    if (child.val().uploaderId === uid) videos.push({ id: child.key, ...child.val() });
  });
  return videos.reverse();
}

export async function incrementViews(videoId) {
  const snap = await get(ref(db, `videos/${videoId}/views`));
  const current = snap.val() || 0;
  await update(ref(db, `videos/${videoId}`), { views: current + 1 });
}

export async function deleteVideo(videoId) {
  const video = await getVideo(videoId);
  if (!video) return;
  const user = getCurrentUser();
  if (video.uploaderId !== user?.uid) return;
  await remove(ref(db, `videos/${videoId}`));
  await remove(ref(db, `comments/${videoId}`));
}

// ---- Comments ----
export async function addComment(videoId, text, user) {
  const id = push(ref(db, `comments/${videoId}`)).key;
  await set(ref(db, `comments/${videoId}/${id}`), {
    id, text, userId: user.uid, userName: user.displayName, userPhoto: user.photoURL || '', createdAt: Date.now()
  });
  return id;
}

export async function getComments(videoId) {
  const snap = await get(ref(db, `comments/${videoId}`));
  if (!snap.exists()) return [];
  const comments = [];
  snap.forEach(child => comments.push({ id: child.key, ...child.val() }));
  return comments.sort((a, b) => a.createdAt - b.createdAt);
}

// ---- Subscriptions (Notify) ----
export async function toggleNotify(channelId) {
  const user = getCurrentUser();
  if (!user || channelId === user.uid) return false;
  const subRef = ref(db, `subscribers/${channelId}/${user.uid}`);
  const snap = await get(subRef);
  if (snap.exists()) {
    await remove(subRef);
    const countSnap = await get(ref(db, `users/${channelId}/subscriberCount`));
    const count = (countSnap.val() || 1) - 1;
    await update(ref(db, `users/${channelId}`), { subscriberCount: Math.max(0, count) });
    return false;
  } else {
    await set(subRef, true);
    const countSnap = await get(ref(db, `users/${channelId}/subscriberCount`));
    const count = (countSnap.val() || 0) + 1;
    await update(ref(db, `users/${channelId}`), { subscriberCount: count });
    // Create notification
    const notifId = push(ref(db, `notifications/${channelId}`)).key;
    await set(ref(db, `notifications/${channelId}/${notifId}`), {
      id: notifId, type: 'new_subscriber', fromUserId: user.uid, fromUserName: user.displayName, createdAt: Date.now(), read: false
    });
    return true;
  }
}

export async function isNotifying(channelId) {
  const user = getCurrentUser();
  if (!user) return false;
  const snap = await get(ref(db, `subscribers/${channelId}/${user.uid}`));
  return snap.exists();
}

export async function getSubscriberCount(channelId) {
  const snap = await get(ref(db, `users/${channelId}/subscriberCount`));
  return snap.val() || 0;
}

export function onCommentsChange(videoId, callback) {
  const commentsRef = query(ref(db, `comments/${videoId}`), orderByChild('createdAt', limitToLast(100)));
  onValue(commentsRef, (snap) => {
    if (!snap.exists()) { callback([]); return; }
    const comments = [];
    snap.forEach(child => comments.push({ id: child.key, ...child.val() }));
    callback(comments.sort((a, b) => a.createdAt - b.createdAt));
  });
  return () => off(commentsRef);
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
