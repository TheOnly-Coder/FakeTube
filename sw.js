// FakeTube Service Worker
// Fixes video playback for hosts that serve videos with wrong Content-Type
// (e.g. GitHub Releases serves as application/octet-stream)

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

function isVideoRequest(request) {
  // Only intercept GET requests that look like video fetches
  if (request.method !== 'GET') return false;
  const url = request.url;
  // GitHub release assets CDN
  if (url.includes('release-assets.githubusercontent.com')) return true;
  // objects.githubusercontent.com (older release CDN)
  if (url.includes('objects.githubusercontent.com')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  if (!isVideoRequest(event.request)) return;

  // Let the browser handle it normally first; only rewrite if we detect
  // a likely wrong Content-Type. We do this by fetching the response
  // ourselves and checking the Content-Type.
  event.respondWith(
    fetch(event.request).then((response) => {
      // Determine the correct MIME type from the URL or Content-Disposition
      const dispMime = getMimeFromDisposition(response.headers.get('Content-Disposition'));
      const urlMime = (() => {
        const ext = getExtensionFromUrl(event.request.url);
        return ext ? (VIDEO_MIME_MAP[ext] || null) : null;
      })();
      const correctMime = dispMime || urlMime;

      if (!correctMime) return response; // Can't determine type, pass through

      const currentType = response.headers.get('Content-Type') || '';
      // If the server already returns a video MIME, no fix needed
      if (currentType.startsWith('video/') || currentType.startsWith('application/vnd.apple.mpegurl')) {
        return response;
      }

      // Build new headers: copy all from original, fix Content-Type,
      // remove Content-Disposition (so browser doesn't try to download)
      const newHeaders = new Headers(response.headers);
      newHeaders.set('Content-Type', correctMime);
      // Remove Content-Disposition to prevent the browser from downloading
      // instead of playing the video inline
      newHeaders.delete('Content-Disposition');

      // Create a new response with the corrected headers.
      // The body stream is passed through without reading — the browser
      // consumes it directly.
      return new Response(response.body, {
        status: response.status || 200,
        statusText: response.statusText || 'OK',
        headers: newHeaders,
      });
    }).catch((err) => {
      console.warn('SW: fetch failed, falling back to browser default:', err);
      return fetch(event.request);
    })
  );
});
