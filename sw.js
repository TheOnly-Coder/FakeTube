// FakeTube Service Worker
// 1. Rewrites Content-Type for any video URL served with wrong MIME
// 2. Provides a blob-proxy endpoint so the page can fetch cross-origin
//    videos into RAM and play them as blob: URLs

const VIDEO_MIME_MAP = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogg: 'video/ogg',
  ogv: 'video/ogg',
  mov: 'video/mp4',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  m4v: 'video/mp4',
  m3u8: 'application/vnd.apple.mpegurl',
  ts: 'video/mp2t',
};

// Maximum file size for blob proxy (200 MB)
const MAX_BLOB_PROXY_SIZE = 200 * 1024 * 1024;

function getExtensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

function getMimeFromDisposition(header) {
  if (!header) return null;
  const match = header.match(/filename=\"?([^";\n]+)\"?/i);
  if (!match) return null;
  const filename = match[1];
  const ext = filename.split('.').pop().toLowerCase();
  return VIDEO_MIME_MAP[ext] || null;
}

/**
 * Check if a URL looks like it points to a video file.
 * Matches by file extension (.mp4, .webm, etc.) OR known CDN hosts.
 */
function looksLikeVideoUrl(url) {
  const ext = getExtensionFromUrl(url);
  if (ext && VIDEO_MIME_MAP[ext]) return true;

  // Known video CDN / hosting patterns
  const VIDEO_HOST_PATTERNS = [
    // GitHub
    'release-assets.githubusercontent.com',
    'objects.githubusercontent.com',
    // Cloud storage / CDNs
    'blob.core.windows.net',
    's3.amazonaws.com',
    '.cloudfront.net',
    'r2.cloudflarestorage.com',
    'storage.googleapis.com',
    // Social / misc video hosts
    'v.redd.it',
    'video.twimg.com',
    'cdn.discordapp.com',
    'clips.twitch.tv',
    'player.twitch.tv',
    'cvphlvjdvtdvd.cloudimg.io',
    'streamable.com',
    // File hosting
    'files.catbox.moe',
    'litterbox.catbox.moe',
    // Generic CDN patterns
    'cdn-','.akamaized.net',
    '.b-cdn.net',
    '.fastly.net',
  ];

  const lower = url.toLowerCase();
  for (const pattern of VIDEO_HOST_PATTERNS) {
    if (lower.includes(pattern)) return true;
  }
  return false;
}

// ======================
// 1. Content-Type rewriter for <video> element requests
// ======================
function handleVideoContentTypeFix(request) {
  return fetch(request).then((response) => {
    // Determine correct MIME from Content-Disposition filename or URL extension
    const dispMime = getMimeFromDisposition(response.headers.get('Content-Disposition'));
    const urlExt = getExtensionFromUrl(request.url);
    const urlMime = urlExt ? (VIDEO_MIME_MAP[urlExt] || null) : null;
    const correctMime = dispMime || urlMime;

    if (!correctMime) return response;

    const currentType = (response.headers.get('Content-Type') || '').split(';')[0].trim();
    if (currentType.startsWith('video/') || currentType === 'application/vnd.apple.mpegurl') {
      return response; // Already correct
    }

    const newHeaders = new Headers(response.headers);
    newHeaders.set('Content-Type', correctMime);
    newHeaders.delete('Content-Disposition');

    return new Response(response.body, {
      status: response.status || 200,
      statusText: response.statusText || 'OK',
      headers: newHeaders,
    });
  });
}

// ======================
// 2. Blob proxy endpoint
// The page fetches same-origin URL like:
//   ./__sw_blob_proxy__?url=<encoded-video-url>&ext=mp4
// SW fetches the cross-origin video, wraps it in a same-origin Response
// so the page can call .blob() and create a blob: URL.
// ======================
function handleBlobProxy(request) {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  // Validate protocol
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return new Response(JSON.stringify({ error: 'Invalid protocol' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  // Determine MIME type
  const extParam = url.searchParams.get('ext');
  const urlExt = getExtensionFromUrl(targetUrl);
  const ext = (extParam || urlExt || 'mp4').toLowerCase();
  const mimeType = VIDEO_MIME_MAP[ext] || 'video/mp4';

  return fetch(targetUrl, { mode: 'no-cors' }).then((response) => {
    // Check Content-Length if available (opaque response may not expose it)
    const contentLength = response.headers.get('Content-Length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BLOB_PROXY_SIZE) {
      return new Response(JSON.stringify({ error: 'File too large for RAM playback' }), {
        status: 413, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Also try to get MIME from Content-Disposition
    const dispMime = getMimeFromDisposition(response.headers.get('Content-Disposition'));
    const finalMime = dispMime || mimeType;

    const headers = new Headers();
    headers.set('Content-Type', finalMime);
    // Expose Content-Length so the page can show download progress
    if (contentLength) headers.set('X-Content-Length', contentLength);

    return new Response(response.body, {
      status: 200,
      statusText: 'OK',
      headers,
    });
  }).catch((err) => {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502, headers: { 'Content-Type': 'application/json' }
    });
  });
}

// ======================
// Main fetch handler
// ======================
self.addEventListener('fetch', (event) => {
  const reqUrl = event.request.url;

  // Blob proxy endpoint (same-origin request from the page)
  if (reqUrl.includes('__sw_blob_proxy__')) {
    event.respondWith(handleBlobProxy(event.request));
    return;
  }

  // Content-Type fix: only intercept GET requests to URLs that look like
  // video files and are NOT same-origin (we only fix cross-origin hosts)
  if (event.request.method === 'GET' && looksLikeVideoUrl(reqUrl)) {
    try {
      const reqOrigin = new URL(reqUrl).origin;
      const pageOrigin = self.location.origin;
      if (reqOrigin !== pageOrigin) {
        event.respondWith(handleVideoContentTypeFix(event.request));
        return;
      }
    } catch {}
  }
});
