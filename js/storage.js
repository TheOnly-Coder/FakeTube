import { storage } from './firebase-config.js';
import { ref as sRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export function uploadVideo(file, onProgress) {
  return new Promise((resolve, reject) => {
    const fileId = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const videoRef = sRef(storage, `videos/${fileId}`);
    const task = uploadBytesResumable(videoRef, file);
    
    task.on('state_changed',
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        if (onProgress) onProgress(pct);
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
}

export function uploadThumbnail(blob, onProgress) {
  return new Promise((resolve, reject) => {
    const fileId = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const thumbRef = sRef(storage, `thumbnails/${fileId}`);
    const task = uploadBytesResumable(thumbRef, blob);

    task.on('state_changed',
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        if (onProgress) onProgress(pct);
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
}

export function uploadProfilePhoto(file, onProgress) {
  return new Promise((resolve, reject) => {
    const fileId = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const photoRef = sRef(storage, `profilePhotos/${fileId}`);
    const task = uploadBytesResumable(photoRef, file);

    task.on('state_changed',
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        if (onProgress) onProgress(pct);
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
}
