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
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Sanitize a URL for safe use in CSS url() context.
 * Blocks javascript:, data:, vbscript: schemes and quotes that break out.
 */
export function sanitizeCssUrl(url) {
  if (typeof url !== 'string' || !url) return '';
  const trimmed = url.trim();
  // Block dangerous schemes
  if (/^(javascript|data|vbscript|blob):/i.test(trimmed)) return '';
  // Only allow http:, https:, or relative paths
  if (!/^(https?:\/\/|\/|\.\.?\/)/i.test(trimmed) && !trimmed.startsWith('/')) {
    // If it looks like a plain URL without scheme, allow it (browser will treat as relative)
    if (/^[^\s'"()<>]+$/i.test(trimmed)) return trimmed;
    return '';
  }
  // Strip any quotes or parentheses that could break out of url()
  return trimmed.replace(/[()'"\\]/g, '');
}

/**
 * Validate that a URL uses an acceptable scheme for video sources.
 * Allows http: and https: only.
 */
export function validateVideoUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Check if a URL is a YouTube video URL (youtube.com, youtu.be, shorts).
 * Returns true for youtube.com/watch, /embed/, /shorts/, and youtu.be/ links.
 */
export function isYouTubeUrl(url) {
  if (typeof url !== 'string') return false;
  return /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/.test(url);
}

/**
 * Extract the 11-char YouTube video ID from a URL.
 * Returns null if not a valid YouTube URL.
 */
export function getYouTubeId(url) {
  if (typeof url !== 'string') return null;
  const m = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

/**
 * Get the highest-quality YouTube thumbnail URL for a video ID.
 */
export function getYouTubeThumbnailUrl(videoId) {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

/**
 * Check if a URL is a Vimeo video URL.
 */
export function isVimeoUrl(url) {
  if (typeof url !== 'string') return false;
  return /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(?:[0-9]+|video\/)/.test(url);
}

/**
 * Extract the Vimeo video ID from a URL.
 * Returns null if not a valid Vimeo URL.
 */
export function getVimeoId(url) {
  if (typeof url !== 'string') return null;
  // vimeo.com/123456 or vimeo.com/video/123456
  const m = url.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

/**
 * Simple client-side rate limiter.
 * Returns true if the action is allowed, false if rate-limited.
 * @param {string} key - localStorage key for this action type
 * @param {number} maxCalls - max actions allowed in window
 * @param {number} windowMs - time window in milliseconds
 */
export function rateLimit(key, maxCalls = 5, windowMs = 60000) {
  try {
    const now = Date.now();
    const storageKey = `faketube_rl_${key}`;
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      localStorage.setItem(storageKey, JSON.stringify([now]));
      return true;
    }
    const timestamps = JSON.parse(raw).filter(t => now - t < windowMs);
    if (timestamps.length >= maxCalls) {
      return false;
    }
    timestamps.push(now);
    localStorage.setItem(storageKey, JSON.stringify(timestamps));
    return true;
  } catch {
    return true; // If localStorage unavailable, allow action
  }
}

export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
}

/**
 * Generate a random ID using crypto API when available, falling back to Math.random.
 * Note: Firestore auto-generates document IDs via addDoc, so this is only
 * used for localStorage-based IDs (subscriber stars, etc.) where security
 * impact is minimal.
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  const arr = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(36)).join('');
  }
  // Fallback (insecure)
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function showToast(message) {
  if (typeof message !== 'string') return;
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message; // Safe: textContent, not innerHTML
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

// ========== RECOMMENDATION ALGORITHM (localStorage) =========
// All watch history is stored in the browser's localStorage.
// Nothing is sent to Firebase — this keeps server costs at zero
// even as the user base grows.

const WATCH_HISTORY_KEY = 'faketube_watch_history';
const MAX_HISTORY_ENTRIES = 100;

/**
 * Record that a user watched a video. Called from watch.js.
 * Stores: video id, title, tags, uploader id, and timestamp.
 * Re-watching a video moves it to the top (updates timestamp).
 */
export function recordVideoWatch(video) {
  if (!video || !video.id || typeof video.id !== 'string') return;
  try {
    const history = getWatchHistory();
    // Remove previous entry for this video if it exists (re-watch = fresh timestamp)
    const idx = history.findIndex(h => h.id === video.id);
    if (idx !== -1) history.splice(idx, 1);
    // Sanitize fields before storing
    history.unshift({
      id: video.id.substring(0, 100),
      title: String(video.title || '').toLowerCase().substring(0, 200),
      tags: Array.isArray(video.tags) ? video.tags.map(t => String(t || '').toLowerCase().trim().substring(0, 50)).filter(Boolean).slice(0, 20) : [],
      uploaderId: String(video.uploaderId || '').substring(0, 100),
      ts: Date.now()
    });
    // Trim to max size
    if (history.length > MAX_HISTORY_ENTRIES) history.length = MAX_HISTORY_ENTRIES;
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    // localStorage full or unavailable — fail silently
    console.warn('Could not save watch history:', e);
  }
}

/**
 * Get the raw watch history array from localStorage.
 */
function getWatchHistory() {
  try {
    return JSON.parse(localStorage.getItem(WATCH_HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

/**
 * Clear all watch history (useful for debugging or user preference).
 */
export function clearWatchHistory() {
  try { localStorage.removeItem(WATCH_HISTORY_KEY); } catch {}
}

// Common English stop words to ignore when extracting keywords from titles
const STOP_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','shall','should',
  'may','might','can','could','of','in','to','for','with','on','at',
  'from','by','about','as','into','through','during','before','after',
  'above','below','between','out','off','over','under','again','further',
  'then','once','here','there','when','where','why','how','all','both',
  'each','few','more','most','other','some','such','no','nor','not',
  'only','own','same','so','than','too','very','just','because','but',
  'and','or','if','it','its','this','that','these','those','i','me',
  'my','we','our','you','your','he','him','his','she','her','they',
  'them','their','what','which','who','whom','up','also','new','like',
  'part','one','two','first','last','long','great','little','just',
  'know','take','come','make','get','go','see','think','say','really'
]);

/**
 * Extract meaningful keywords from a video title.
 * Strips punctuation, splits on whitespace, removes stop words and single chars.
 */
function extractKeywords(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Build an interest profile from watch history.
 * Returns a map: keyword/tag -> cumulative weighted score.
 * Uses exponential time decay so recent watches matter more.
 *
 * Weighting:
 *   - Explicit tags: 3x base weight per watch
 *   - Title keywords: 1x base weight per watch
 *   - Time decay: half-life of 7 days (e^{-0.693 * age / halfLife})
 */
function buildInterestProfile(history) {
  const interests = {}; // keyword/tag -> cumulative score
  const now = Date.now();
  const HALF_LIFE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

  for (const entry of history) {
    const age = now - (entry.ts || 0);
    if (age < 0) continue;
    // Exponential decay: 1.0 at time of watch, ~0.5 after 7 days, ~0.25 after 14 days
    const recency = Math.exp(-0.693 * age / HALF_LIFE);

    // Explicit tags get 3x weight
    for (const tag of (entry.tags || [])) {
      if (tag) interests[tag] = (interests[tag] || 0) + 3 * recency;
    }

    // Title keywords get 1x weight
    const keywords = extractKeywords(entry.title);
    for (const kw of keywords) {
      interests[kw] = (interests[kw] || 0) + 1 * recency;
    }
  }

  return interests;
}

/**
 * Score and sort videos for the home page feed based on watch history.
 *
 * Algorithm:
 *   1. Build interest profile from all past watches (tag + title keywords, time-decayed)
 *   2. For each video, compute a relevance score:
 *      - Tag match: profile[tag] * 2  (exact tag overlap is a strong signal)
 *      - Title keyword match: profile[keyword] * 1  (weaker signal from word overlap)
 *      - Same uploader: +0.5 per previous watch of that uploader's videos
 *      - Already watched: 0.7x penalty (prefer fresh content)
 *      - Small random factor: +random * 0.3 (variety so feed isn't static)
 *   3. Sort all videos by score descending
 *
 * If no watch history exists, returns videos in their original order (newest first).
 * The _recScore property is removed before returning.
 */
export function getRecommendedVideos(videos) {
  const history = getWatchHistory();
  // No history yet — return in default order (newest first from Firestore)
  if (history.length === 0 || videos.length <= 1) return videos;

  const profile = buildInterestProfile(history);
  const watchedIds = new Set(history.map(h => h.id));

  // Count how many times we've watched each uploader
  const uploaderWatchCounts = {};
  for (const entry of history) {
    if (entry.uploaderId) {
      uploaderWatchCounts[entry.uploaderId] = (uploaderWatchCounts[entry.uploaderId] || 0) + 1;
    }
  }

  const scored = videos.map(v => {
    let score = 0;
    const vTags = ((v.tags || [])).map(t => (t || '').toLowerCase().trim()).filter(Boolean);
    const vKeywords = extractKeywords(v.title);

    // Tag matches — strong signal (2x multiplier on profile weight)
    for (const tag of vTags) {
      if (profile[tag]) score += profile[tag] * 2;
    }

    // Title keyword matches — weaker signal (1x multiplier)
    for (const kw of vKeywords) {
      if (profile[kw]) score += profile[kw] * 1;
    }

    // Same uploader bonus — if you've watched 3 videos from this creator,
    // their next video gets a small boost
    if (v.uploaderId && uploaderWatchCounts[v.uploaderId]) {
      score += uploaderWatchCounts[v.uploaderId] * 0.5;
    }

    // Penalize already-watched videos (prefer new content)
    if (watchedIds.has(v.id)) score *= 0.7;

    // Small random factor for variety (prevents feed from being completely static
    // when scores are similar)
    score += Math.random() * 0.3;

    return { ...v, _recScore: score };
  });

  // Sort by recommendation score descending
  scored.sort((a, b) => b._recScore - a._recScore);

  // Strip the internal scoring property before returning
  return scored.map(({ _recScore, ...rest }) => rest);
}
