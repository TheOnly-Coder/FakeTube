export function timeAgo(timestamp) {
  if (!timestamp) return '';
  const ts = timestamp?.toMillis ? timestamp.toMillis() : timestamp;
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 0 || isNaN(seconds)) return 'just now';
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function formatViews(views) {
  if (!views) return '0 views';
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M views`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K views`;
  return `${views} views`;
}

export function formatSubscribers(count) {
  if (!count) return '0 subscribers';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M subscribers`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K subscribers`;
  return `${count} subscribers`;
}

export function truncate(str, maxLen = 100) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function showToast(message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export function getVideoDurationFromUrl(url) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';
    const timer = setTimeout(() => { video.src = ''; resolve('0:00'); }, 6000);
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      const s = Math.floor(video.duration);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      const mm = m % 60;
      const ss = s % 60;
      if (h > 0) resolve(`${h}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`);
      else resolve(`${mm}:${String(ss).padStart(2,'0')}`);
    };
    video.onerror = () => { clearTimeout(timer); resolve('0:00'); };
    video.src = url;
  });
}

export function generateThumbnailFromUrl(url) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    const timer = setTimeout(() => {
      video.src = '';
      resolve(null);
    }, 10000);

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration * 0.1);
    };
    video.onseeked = () => {
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        clearTimeout(timer);
        resolve(dataUrl.length > 100 ? dataUrl : null);
      } catch (e) {
        // CORS error - can't extract frame
        clearTimeout(timer);
        resolve(null);
      }
    };
    video.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    video.src = url;
  });
}
