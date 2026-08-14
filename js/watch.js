import { getVideo, incrementViews, getComments, addComment, toggleNotify, isNotifying, getVideos, getSubscriberCount, onCommentsChange, getUserProfile, resolveChannelId } from './db.js';
import { getCurrentUser, onAuthChange } from './auth.js';
import { videoCardHTML, sidebarVideoCardHTML, setupVideoCardClicks, openAuthModal, BELL_SVG, BELL_OFF_SVG, THUMB_UP_SVG, THUMB_DOWN_SVG, CHEVRON_UP_SVG, CHEVRON_DOWN_SVG, SEND_SVG } from './components.js';
import { formatViews, formatSubscribers, timeAgo, escapeHtml, getInitials, recordVideoWatch, rateLimit, validateVideoUrl } from './utils.js';

let unsubscribeComments = null;

export async function renderWatch(container, videoId) {
  if (unsubscribeComments) { unsubscribeComments(); unsubscribeComments = null; }
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  const video = await getVideo(videoId);
  if (!video) {
    container.innerHTML = `<div class="empty-state"><h3>Video not found</h3><p>This video may have been removed.</p><a href="#/" class="btn btn-primary">Go Home</a></div>`;
    return;
  }
  // Validate video URL scheme to prevent javascript: / data: injection
  if (!validateVideoUrl(video.videoUrl)) {
    container.innerHTML = `<div class="empty-state"><h3>Invalid video</h3><p>This video has an invalid source URL.</p><a href="#/" class="btn btn-primary">Go Home</a></div>`;
    return;
  }

  // Deduplicate view counts — only count once per session per video
  const VIEW_KEY = `faketube_viewed_${videoId}`;
  const alreadyViewed = sessionStorage.getItem(VIEW_KEY);
  if (!alreadyViewed) {
    await incrementViews(videoId);
    sessionStorage.setItem(VIEW_KEY, '1');
  }
  const updatedVideo = { ...video, views: (video.views || 0) + (alreadyViewed ? 0 : 1) };

  // Record this watch in localStorage for the recommendation algorithm
  recordVideoWatch(updatedVideo);

  // Get subscriber count
  let subCount = 0;
  try { subCount = await getSubscriberCount(video.uploaderId); } catch {}

  // Check if current user is notifying
  let isNotified = false;
  const user = getCurrentUser();
  if (user && user.channelId !== video.uploaderId) {
    try { isNotified = await isNotifying(video.uploaderId); } catch {}
  }

  // Get all videos for sidebar (exclude current)
  const allVideos = await getVideos(30);
  const sidebarVideos = allVideos.filter(v => v.id !== videoId).slice(0, 10);

  const isOwner = user && user.channelId === video.uploaderId;
  const avatarContent = video.uploaderPhoto 
    ? `<img src="${escapeHtml(video.uploaderPhoto)}" alt="">` 
    : getInitials(video.uploaderName);

  container.innerHTML = `
    <div class="watch-page">
      <div class="watch-primary">
        <div class="video-player-container">
          <video id="video-player" controls preload="metadata"></video>
          <div id="video-error-fallback" class="hidden">
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;padding:32px;">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="#aaa"><path d="M12,2L1,21h22L12,2z M12,6l7.53,13H4.47L12,6z"/><rect x="11" y="10" width="2" height="4"/><rect x="11" y="16" width="2" height="2"/></svg>
              <p style="color:#f1f1f1;font-size:16px;font-weight:600;">Video can't play in browser</p>
              <p style="color:#aaa;font-size:14px;text-align:center;max-width:500px;">This video host (e.g. Google Drive) doesn't allow direct embedding. You can watch it at the source link below.</p>
              <a href="${escapeHtml(video.videoUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="margin-top:8px;">Open video externally</a>
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

  // Video player — set src directly (no <source> element) so the browser
  // probes the actual file bytes instead of rejecting based on the server's
  // Content-Type header. The Service Worker (sw.js) intercepts responses
  // from hosts like GitHub Releases and rewrites Content-Type to video/mp4.
  const videoEl = document.getElementById('video-player');
  const fallback = document.getElementById('video-error-fallback');
  if (videoEl) {
    let fallbackShown = false;
    const showFallback = () => {
      if (fallbackShown) return;
      fallbackShown = true;
      console.warn('Video playback error: showing fallback');
      videoEl.style.display = 'none';
      fallback.classList.remove('hidden');
    };
    const tryPlayVideo = () => {
      videoEl.src = video.videoUrl;
    };
    const onVideoError = () => {
      if (videoEl.error) {
        // If we haven't retried yet and a SW is now controlling the page,
        // retry once — the SW can fix the Content-Type.
        if (!videoEl._swRetried && navigator.serviceWorker && navigator.serviceWorker.controller) {
          videoEl._swRetried = true;
          console.warn('Video error — retrying with active Service Worker');
          videoEl.removeEventListener('error', onVideoError);
          videoEl.src = '';
          tryPlayVideo();
          videoEl.addEventListener('error', onVideoError);
          return;
        }
        showFallback();
      }
    };
    videoEl.addEventListener('error', onVideoError);
    // If a Service Worker just installed/activated while we're on this
    // page, it can now intercept future fetches. Reload the video so
    // the SW can fix the Content-Type.
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!fallbackShown && videoEl.readyState === 0) {
          console.log('SW controller changed — reloading video');
          videoEl.src = '';
          tryPlayVideo();
        }
      });
    }
    tryPlayVideo();
    // Fallback timer: if after 12s the video hasn't loaded any data,
    // assume it's unplayable and show the fallback (catches hosts that
    // return HTML instead of video, e.g. Google Drive).
    setTimeout(() => {
      if (!fallbackShown && videoEl.readyState === 0) {
        showFallback();
      }
    }, 12000);
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
    // Client-side rate limit for subscribe/unsubscribe: 20 per minute
    if (!rateLimit('toggle_notify', 20, 60000)) {
      showToast('Slow down with the subscriptions!');
      return;
    }
    const btn = e.currentTarget;
    const cid = btn.dataset.channelId;
    const nowNotified = await toggleNotify(cid);
    btn.innerHTML = `${nowNotified ? BELL_SVG : BELL_OFF_SVG}<span>${nowNotified ? 'Notified' : 'Notify'}</span>`;
    if (nowNotified) btn.classList.add('active'); else btn.classList.remove('active');
    // Sync both buttons
    container.querySelectorAll('#notify-btn, #notify-btn-2').forEach(b => {
      if (b !== btn && b.dataset.channelId === cid) {
        b.innerHTML = `${nowNotified ? BELL_SVG : BELL_OFF_SVG}<span>${nowNotified ? 'Notified' : 'Notify me'}</span>`;
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

function renderCommentInput() {
  const area = document.getElementById('comment-input-area');
  const user = getCurrentUser();
  if (!user) {
    area.innerHTML = `<p style="color:var(--text-secondary);font-size:14px;">Sign in to add a comment.</p>`;
    return;
  }
  // Load the logged-in user's current PFP from the profile cache
  // (or fetch it). This ensures the avatar next to "Add a comment"
  // always matches the channel's current profile picture.
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
  // Async: fetch the latest profile photo and update the avatar if different
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
    // Enforce max comment length
    if (text.length > 1000) {
      showToast('Comment is too long. Maximum 1000 characters.');
      return;
    }
    // Client-side rate limit: 10 comments per minute
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

    // Collect unique userIds and batch-fetch their profiles for PFPs.
    // This loads the commenter's CURRENT profile picture from their
    // user doc, not from stored comment data.
    const uniqueUids = [...new Set(comments.map(c => c.userId).filter(Boolean))];
    const profileMap = {};
    await Promise.all(uniqueUids.map(async uid => {
      try {
        const profile = await getUserProfile(uid);
        if (profile) profileMap[uid] = profile;
      } catch {}
    }));

    list.innerHTML = comments.map(c => {
      // Use the live profile photo if available, fall back to stored
      // userPhoto (for old comments), then initials.
      const profile = profileMap[c.userId];
      const livePhoto = profile?.photoURL || '';
      const liveName = profile?.displayName || c.userName || 'Anonymous';
      const avatar = livePhoto
        ? `<img src="${escapeHtml(livePhoto)}" alt="">`
        : getInitials(liveName);
      // Resolve the channel ID for the comment author so the name
      // links to the correct channel page (handles migrated channels).
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

    // Make comment author names clickable to navigate to their channel
    list.querySelectorAll('.comment-author[data-channel-id]').forEach(el => {
      el.addEventListener('click', () => {
        window.location.hash = `#/channel/${el.dataset.channelId}`;
      });
    });
  });
}
