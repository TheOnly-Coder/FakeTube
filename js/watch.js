import { getVideo, incrementViews, getComments, addComment, toggleNotify, isNotifying, getVideos, getSubscriberCount, onCommentsChange } from './db.js';
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
  if (user && user.uid !== video.uploaderId) {
    try { isNotified = await isNotifying(video.uploaderId); } catch {}
  }

  // Get all videos for sidebar (exclude current)
  const allVideos = await getVideos(30);
  const sidebarVideos = allVideos.filter(v => v.id !== videoId).slice(0, 10);

  const isOwner = user && user.uid === video.uploaderId;
  const avatarContent = video.uploaderPhoto 
    ? `<img src="${escapeHtml(video.uploaderPhoto)}" alt="">` 
    : getInitials(video.uploaderName);

  container.innerHTML = `
    <div class="watch-page">
      <div class="watch-primary">
        <div class="video-player-container">
          <video id="video-player" controls preload="metadata" src="${escapeHtml(video.videoUrl)}"></video>
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
  return onCommentsChange(videoId, (comments) => {
    document.getElementById('comments-count').textContent = `${comments.length} Comment${comments.length !== 1 ? 's' : ''}`;
    const list = document.getElementById('comments-list');
    if (comments.length === 0) {
      list.innerHTML = '<p style="color:var(--text-secondary);font-size:14px;">No comments yet.</p>';
      return;
    }
    list.innerHTML = comments.map(c => {
      const avatar = c.userPhoto 
        ? `<img src="${escapeHtml(c.userPhoto)}" alt="">` 
        : getInitials(c.userName);
      return `
        <div class="comment-item">
          <div class="comment-avatar">${avatar}</div>
          <div class="comment-body">
            <span class="comment-author">${escapeHtml(c.userName)}</span>
            <span class="comment-time">${timeAgo(c.createdAt)}</span>
            <div class="comment-text">${escapeHtml(c.text)}</div>
          </div>
        </div>
      `;
    }).join('');
  });
}
