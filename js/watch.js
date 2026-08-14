import { getVideo, incrementViews, getComments, addComment, toggleNotify, isNotifying, getVideos, getSubscriberCount, onCommentsChange, getUserProfile, resolveChannelId } from './db.js';
import { getCurrentUser, onAuthChange } from './auth.js';
import { videoCardHTML, sidebarVideoCardHTML, setupVideoCardClicks, openAuthModal, BELL_SVG, BELL_OFF_SVG, THUMB_UP_SVG, THUMB_DOWN_SVG, CHEVRON_UP_SVG, CHEVRON_DOWN_SVG, SEND_SVG } from './components.js';
import { formatViews, formatSubscribers, timeAgo, escapeHtml, getInitials, recordVideoWatch, rateLimit, validateVideoUrl, isYouTubeUrl, getYouTubeId, getVimeoId, showToast } from './utils.js';

let unsubscribeComments = null;

export async function renderWatch(container, videoId) {
  if (unsubscribeComments) { unsubscribeComments(); unsubscribeComments = null; }
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  const video = await getVideo(videoId);
  if (!video) {
    container.innerHTML = `<div class="empty-state"><h3>Video not found</h3><p>This video may have been removed.</p><a href="#/" class="btn btn-primary">Go Home</a></div>`;
    return;
  }
  if (!validateVideoUrl(video.videoUrl)) {
    container.innerHTML = `<div class="empty-state"><h3>Invalid video</h3><p>This video has an invalid source URL.</p><a href="#/" class="btn btn-primary">Go Home</a></div>`;
    return;
  }

  // Deduplicate view counts
  const VIEW_KEY = `faketube_viewed_${videoId}`;
  const alreadyViewed = sessionStorage.getItem(VIEW_KEY);
  if (!alreadyViewed) {
    await incrementViews(videoId);
    sessionStorage.setItem(VIEW_KEY, '1');
  }
  const updatedVideo = { ...video, views: (video.views || 0) + (alreadyViewed ? 0 : 1) };
  recordVideoWatch(updatedVideo);

  let subCount = 0;
  try { subCount = await getSubscriberCount(video.uploaderId); } catch {}

  let isNotified = false;
  const user = getCurrentUser();
  if (user && user.channelId !== video.uploaderId) {
    try { isNotified = await isNotifying(video.uploaderId); } catch {}
  }

  const allVideos = await getVideos(30);
  const sidebarVideos = allVideos.filter(v => v.id !== videoId).slice(0, 10);

  const isOwner = user && user.channelId === video.uploaderId;
  const avatarContent = video.uploaderPhoto 
    ? `<img src="${escapeHtml(video.uploaderPhoto)}" alt="">` 
    : getInitials(video.uploaderName);

  // Detect YouTube URLs — use iframe embed instead of <video>
  const ytId = getYouTubeId(video.videoUrl);
  const isYouTube = !!ytId;

  // Detect Vimeo URLs — use iframe embed
  const vimeoId = isYouTube ? null : getVimeoId(video.videoUrl);
  const isVimeo = !!vimeoId;

  container.innerHTML = `
    <div class="watch-page">
      <div class="watch-primary">
        <div class="video-player-container" id="player-container">
          ${isYouTube
            ? `<iframe id="youtube-embed" src="https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&disablekb=1&playsinline=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="width:100%;height:100%;position:absolute;top:0;left:0;"></iframe>`
            : isVimeo
            ? `<iframe id="vimeo-embed" src="https://player.vimeo.com/video/${vimeoId}?badge=0&byline=0&portrait=0&title=0" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="width:100%;height:100%;position:absolute;top:0;left:0;"></iframe>`
            : `<video id="video-player" controls preload="metadata"></video>`
          }
          <div id="video-error-fallback" class="hidden">
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;padding:32px;">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="#aaa"><path d="M12,2L1,21h22L12,2z M12,6l7.53,13H4.47L12,6z"/><rect x="11" y="10" width="2" height="4"/><rect x="11" y="16" width="2" height="2"/></svg>
              <p id="fallback-title" style="color:#f1f1f1;font-size:16px;font-weight:600;">Video can't play in browser</p>
              <p id="fallback-desc" style="color:#aaa;font-size:14px;text-align:center;max-width:500px;">This video host doesn't allow direct embedding. You can watch it at the source link below.</p>
              <a href="${escapeHtml(video.videoUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="margin-top:8px;">Open video externally</a>
            </div>
          </div>
          <div id="blob-loading" class="hidden">
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;padding:32px;">
              <div style="width:48px;height:48px;border:4px solid #303030;border-top-color:#f1f1f1;border-radius:50%;animation:spin .8s linear infinite;"></div>
              <p id="blob-loading-text" style="color:#aaa;font-size:14px;">Loading video into memory...</p>
            </div>
          </div>
        </div>
        <div class="video-details">
          <h1 class="video-title">${escapeHtml(video.title)}</h1>
          <div class="video-actions-row">
            <div class="video-stats">${formatViews(updatedVideo.views)} &middot; ${timeAgo(video.createdAt)}</div>
            <div class="video-action-buttons">
              <button class="action-btn" id="notify-btn" data-channel-id="${video.uploaderId}">
                ${isNotified ? BELL_SVG : BELL_OFF_SVG}
                <span>${isNotified ? 'Notified' : 'Notify'}</span>
              </button>
            </div>
          </div>
          <div class="channel-bar">
            <div class="channel-bar-left">
              <div class="channel-avatar" data-channel-id="${video.uploaderId}">${avatarContent}</div>
              <div>
                <div class="channel-name-link" data-channel-id="${video.uploaderId}">${escapeHtml(video.uploaderName)}</div>
                <div class="channel-sub-count">${formatSubscribers(subCount)}</div>
              </div>
            </div>
            <div class="channel-bar-right">
              ${!isOwner ? `
                <button class="btn-notify ${isNotified ? 'active' : ''}" id="notify-btn-2" data-channel-id="${video.uploaderId}">
                  ${isNotified ? BELL_SVG : BELL_OFF_SVG}
                  <span>${isNotified ? 'Notified' : 'Notify me'}</span>
                </button>
              ` : ''}
            </div>
          </div>
          <div class="video-description" id="description-box">
            <div class="description-stats">${formatViews(updatedVideo.views)} &middot; ${timeAgo(video.createdAt)}</div>
            <div class="description-text" id="description-text">${escapeHtml(video.description || 'No description.')}</div>
            <span id="desc-toggle" style="font-size:13px;color:var(--text-secondary);font-weight:600;">Show more</span>
          </div>
        </div>
        <div class="comments-section">
          <div class="comments-header">
            <span class="comments-count" id="comments-count">0 Comments</span>
          </div>
          <div id="comment-input-area"></div>
          <div id="comments-list"></div>
        </div>
      </div>
      <div class="watch-sidebar">
        <div class="sidebar-title">Up next</div>
        <div id="sidebar-videos"></div>
      </div>
    </div>
  `;

  // Render sidebar
  document.getElementById('sidebar-videos').innerHTML = sidebarVideos.map(v => sidebarVideoCardHTML(v)).join('');
  setupVideoCardClicks(document.getElementById('sidebar-videos'));

  // YouTube and Vimeo embeds need no further player logic
  if (!isYouTube && !isVimeo) {
    setupVideoPlayer(video.videoUrl);
  }

  // Channel link clicks
  container.querySelectorAll('[data-channel-id]').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', (e) => {
      if (e.target.closest('#notify-btn') || e.target.closest('#notify-btn-2')) return;
      window.location.hash = `#/channel/${el.dataset.channelId}`;
    });
  });

  // Notify buttons
  const handleNotify = async (e) => {
    if (!user) { openAuthModal('login'); return; }
    if (!rateLimit('toggle_notify', 20, 60000)) {
      showToast('Slow down with the subscriptions!');
      return;
    }
    const btn = e.currentTarget;
    const cid = btn.dataset.channelId;
    const nowNotified = await toggleNotify(cid);
    btn.innerHTML = `${nowNotified ? BELL_SVG : BELL_OFF_SVG}<span>${nowNotified ? 'Notified' : 'Notify'}</span>`;
    if (nowNotified) btn.classList.add('active'); else btn.classList.remove('active');
    container.querySelectorAll('#notify-btn, #notify-btn-2').forEach(b => {
      if (b !== btn && b.dataset.channelId === cid) {
        b.innerHTML = `${nowNotified ? BELL_SVG : BELL_OFF_SVG}<span>${nowNotified ? 'Notify' : 'Notify me'}</span>`;
        if (nowNotified) b.classList.add('active'); else b.classList.remove('active');
      }
    });
    const newCount = await getSubscriberCount(cid);
    container.querySelectorAll('.channel-sub-count').forEach(el => el.textContent = formatSubscribers(newCount));
  };
  container.querySelectorAll('#notify-btn, #notify-btn-2').forEach(btn => {
    btn.addEventListener('click', handleNotify);
  });

  // Description toggle
  document.getElementById('description-box').addEventListener('click', () => {
    const text = document.getElementById('description-text');
    const toggle = document.getElementById('desc-toggle');
    const expanded = text.classList.toggle('expanded');
    toggle.textContent = expanded ? 'Show less' : 'Show more';
  });

  // Comments
  renderCommentInput();
  unsubscribeComments = loadComments(videoId);
}

// =====================
// Video player with multi-stage fallback:
//   1. Direct <video> src (SW fixes Content-Type for known hosts)
//   2. Retry once if SW just activated
//   3. SW blob proxy — fetch into RAM, play as blob: URL
//   4. External link fallback
// =====================
function setupVideoPlayer(videoUrl) {
  const videoEl = document.getElementById('video-player');
  const fallback = document.getElementById('video-error-fallback');
  const blobLoading = document.getElementById('blob-loading');
  const blobLoadingText = document.getElementById('blob-loading-text');
  if (!videoEl) return;

  let fallbackShown = false;
  const showFallback = () => {
    if (fallbackShown) return;
    fallbackShown = true;
    videoEl.style.display = 'none';
    blobLoading.classList.add('hidden');
    fallback.classList.remove('hidden');
  };

  const tryPlayVideo = () => { videoEl.src = videoUrl; };

  // --- Stage 1: direct playback ---
  const onVideoError = () => {
    if (!videoEl.error || fallbackShown) return;
    console.warn('Video error code:', videoEl.error.code, videoEl.error.message);

    // --- Stage 2: retry if SW is now controlling ---
    if (!videoEl._swRetried && navigator.serviceWorker && navigator.serviceWorker.controller) {
      videoEl._swRetried = true;
      console.warn('Video error — retrying with active Service Worker');
      videoEl.removeEventListener('error', onVideoError);
      videoEl.src = '';
      tryPlayVideo();
      videoEl.addEventListener('error', onVideoError);
      return;
    }

    // --- Stage 3: blob-into-RAM via SW proxy ---
    if (!videoEl._blobRetried && navigator.serviceWorker && navigator.serviceWorker.controller) {
      videoEl._blobRetried = true;
      videoEl.removeEventListener('error', onVideoError);
      loadViaBlobProxy(videoUrl, videoEl, blobLoading, blobLoadingText, showFallback);
      return;
    }

    // --- Stage 4: fallback ---
    showFallback();
  };

  videoEl.addEventListener('error', onVideoError);

  // If SW activates while we're waiting, retry
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!fallbackShown && videoEl.readyState === 0 && !videoEl._blobRetried) {
        console.log('SW controller changed — reloading video');
        videoEl.src = '';
        tryPlayVideo();
      }
    });
  }

  tryPlayVideo();

  // Timeout fallback for hosts that return HTML (no error event fires)
  setTimeout(() => {
    if (!fallbackShown && videoEl.readyState === 0) {
      onVideoError();
    }
  }, 12000);
}

/**
 * Fetch a video through the Service Worker's blob proxy endpoint.
 * The SW fetches cross-origin (no-cors) and wraps the response so
 * the page can read it. The video data is loaded entirely into RAM
 * as a Blob, then played via a blob: URL.
 */
async function loadViaBlobProxy(videoUrl, videoEl, blobLoadingEl, blobTextEl, showFallback) {
  // Determine extension for MIME hint
  let ext = 'mp4';
  try {
    const m = videoUrl.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
    if (m) ext = m[1].toLowerCase();
  } catch {}

  const proxyUrl = `./__sw_blob_proxy__?url=${encodeURIComponent(videoUrl)}&ext=${ext}`;
  console.log('Attempting blob-proxy load for:', videoUrl);

  // Show loading indicator
  videoEl.style.display = 'none';
  blobLoadingEl.classList.remove('hidden');

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.warn('Blob proxy returned', response.status, errBody);
      showFallback();
      return;
    }

    // Check if response is JSON error (our SW returns JSON for errors)
    const ct = (response.headers.get('Content-Type') || '').split(';')[0];
    if (ct === 'application/json') {
      const err = await response.json().catch(() => ({}));
      console.warn('Blob proxy error:', err.error);
      showFallback();
      return;
    }

    // Download the full video into RAM
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    console.log(`Blob loaded: ${(blob.size / 1024 / 1024).toFixed(1)} MB, playing from RAM`);

    // Hide loading, show video, set blob source
    blobLoadingEl.classList.add('hidden');
    videoEl.style.display = '';
    videoEl.src = blobUrl;

    // Clean up blob URL when the page navigates away
    window.addEventListener('hashchange', () => URL.revokeObjectURL(blobUrl), { once: true });

    // If even the blob URL fails, show fallback
    videoEl.addEventListener('error', () => {
      console.warn('Blob URL also failed to play');
      URL.revokeObjectURL(blobUrl);
      showFallback();
    }, { once: true });

  } catch (err) {
    console.warn('Blob proxy fetch failed:', err);
    showFallback();
  }
}

function renderCommentInput() {
  const area = document.getElementById('comment-input-area');
  const user = getCurrentUser();
  if (!user) {
    area.innerHTML = `<p style="color:var(--text-secondary);font-size:14px;">Sign in to add a comment.</p>`;
    return;
  }
  const avatarContent = user.photoURL 
    ? `<img src="${escapeHtml(user.photoURL)}" alt="">` 
    : getInitials(user.displayName);
  area.innerHTML = `
    <div class="comment-input-container">
      <div class="comment-input-avatar">${avatarContent}</div>
      <div class="comment-input-wrapper">
        <input type="text" class="comment-input" id="comment-input" placeholder="Add a comment..." maxlength="1000">
        <div class="comment-input-actions hidden" id="comment-actions">
          <button class="comment-cancel-btn" id="comment-cancel">Cancel</button>
          <button class="comment-submit-btn" id="comment-submit" disabled>Comment</button>
        </div>
      </div>
    </div>
  `;
  getUserProfile(user.uid).then(profile => {
    if (!profile) return;
    const latestPhoto = profile.photoURL || '';
    if (latestPhoto && latestPhoto !== user.photoURL) {
      const avatarEl = area.querySelector('.comment-input-avatar');
      if (avatarEl) {
        avatarEl.innerHTML = `<img src="${escapeHtml(latestPhoto)}" alt="">`;
      }
    }
  });
  const input = document.getElementById('comment-input');
  const actions = document.getElementById('comment-actions');
  const submitBtn = document.getElementById('comment-submit');
  input.addEventListener('focus', () => actions.classList.remove('hidden'));
  document.getElementById('comment-cancel').addEventListener('click', () => {
    input.value = ''; actions.classList.add('hidden'); submitBtn.disabled = true;
  });
  input.addEventListener('input', () => { submitBtn.disabled = !input.value.trim(); });
  submitBtn.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) return;
    if (text.length > 1000) {
      showToast('Comment is too long. Maximum 1000 characters.');
      return;
    }
    if (!rateLimit('add_comment', 10, 60000)) {
      showToast('Slow down! You can comment up to 10 times per minute.');
      return;
    }
    submitBtn.disabled = true;
    const hash = window.location.hash;
    const videoId = hash.replace('#/watch/', '');
    await addComment(videoId, text, user);
    input.value = ''; actions.classList.add('hidden');
  });
}

function loadComments(videoId) {
  return onCommentsChange(videoId, async (comments) => {
    document.getElementById('comments-count').textContent = `${comments.length} Comment${comments.length !== 1 ? 's' : ''}`;
    const list = document.getElementById('comments-list');
    if (comments.length === 0) {
      list.innerHTML = '<p style="color:var(--text-secondary);font-size:14px;">No comments yet.</p>';
      return;
    }

    const uniqueUids = [...new Set(comments.map(c => c.userId).filter(Boolean))];
    const profileMap = {};
    await Promise.all(uniqueUids.map(async uid => {
      try {
        const profile = await getUserProfile(uid);
        if (profile) profileMap[uid] = profile;
      } catch {}
    }));

    list.innerHTML = comments.map(c => {
      const profile = profileMap[c.userId];
      const livePhoto = profile?.photoURL || '';
      const liveName = profile?.displayName || c.userName || 'Anonymous';
      const avatar = livePhoto
        ? `<img src="${escapeHtml(livePhoto)}" alt="">`
        : getInitials(liveName);
      const authorChannelId = resolveChannelId(c.userId);
      return `
        <div class="comment-item">
          <div class="comment-avatar">${avatar}</div>
          <div class="comment-body">
            <span class="comment-author" data-channel-id="${escapeHtml(authorChannelId)}" style="cursor:pointer;">${escapeHtml(liveName)}</span>
            <span class="comment-time">${timeAgo(c.createdAt)}</span>
            <div class="comment-text">${escapeHtml(c.text)}</div>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.comment-author[data-channel-id]').forEach(el => {
      el.addEventListener('click', () => {
        window.location.hash = `#/channel/${el.dataset.channelId}`;
      });
    });
  });
}
