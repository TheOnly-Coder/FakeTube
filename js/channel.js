import { getUser, getVideosByUser, toggleNotify, isNotifying, getSubscriberCount } from './db.js';
import { getCurrentUser, openAuthModal } from './auth.js';
import { videoCardHTML, setupVideoCardClicks, BELL_SVG, BELL_OFF_SVG } from './components.js';
import { formatSubscribers, timeAgo, formatViews, escapeHtml, getInitials } from './utils.js';

export async function renderChannel(container, userId) {
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  const [channelUser, videos] = await Promise.all([getUser(userId), getVideosByUser(userId)]);
  if (!channelUser) {
    container.innerHTML = '<div class="empty-state"><h3>Channel not found</h3><a href="#/" class="btn btn-primary">Go Home</a></div>';
    return;
  }

  const me = getCurrentUser();
  const isMe = me && me.uid === userId;
  let isNotified = false;
  if (!isMe && me) {
    try { isNotified = await isNotifying(userId); } catch {}
  }
  const subCount = channelUser.subscriberCount || 0;

  const avatarContent = channelUser.photoURL 
    ? `<img src="${escapeHtml(channelUser.photoURL)}" alt="">` 
    : getInitials(channelUser.displayName);

  container.innerHTML = `
    <div class="channel-page">
      <div class="channel-banner"></div>
      <div class="channel-header">
        <div class="channel-header-left">
          <div class="channel-page-avatar">${avatarContent}</div>
          <div>
            <div class="channel-page-name">${escapeHtml(channelUser.displayName)}</div>
            <div class="channel-handle">${formatSubscribers(subCount)}</div>
            ${channelUser.bio ? `<div class="channel-page-bio">${escapeHtml(channelUser.bio)}</div>` : ''}
          </div>
        </div>
        <div>
          ${isMe 
            ? '<button class="btn btn-outline" id="edit-profile-btn">Edit profile</button>'
            : `<button class="btn-notify ${isNotified ? 'active' : ''}" id="channel-notify-btn" data-channel-id="${userId}">
                ${isNotified ? BELL_SVG : BELL_OFF_SVG}
                <span>${isNotified ? 'Notified' : 'Notify me'}</span>
              </button>`
          }
        </div>
      </div>
      <div class="channel-tabs">
        <button class="channel-tab active">Videos</button>
        <button class="channel-tab">About</button>
      </div>
      <div class="video-grid" id="channel-videos"></div>
    </div>
  `;

  // Render videos using inline cards for proper escaping
  const grid = document.getElementById('channel-videos');
  if (videos.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>This channel hasn\'t uploaded any videos yet.</p></div>';
  } else {
    grid.innerHTML = videos.map(v => {
      const av = v.uploaderPhoto 
        ? `<img src="${escapeHtml(v.uploaderPhoto)}" alt="">` 
        : getInitials(v.uploaderName);
      return `
        <div class="video-card" data-video-id="${v.id}">
          <div class="video-card-thumbnail">
            ${v.thumbnailUrl ? `<img src="${escapeHtml(v.thumbnailUrl)}" alt="${escapeHtml(v.title)}" loading="lazy">` : ''}
          </div>
          <div class="video-card-info">
            <div class="video-card-avatar" data-channel-id="${v.uploaderId}">${av}</div>
            <div class="video-card-meta">
              <div class="video-card-title">${escapeHtml(v.title)}</div>
              <div class="video-card-stats">${formatViews(v.views)} &middot; ${timeAgo(v.createdAt)}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
  setupVideoCardClicks(grid);

  // Notify button
  const notifyBtn = document.getElementById('channel-notify-btn');
  if (notifyBtn) {
    notifyBtn.addEventListener('click', async () => {
      if (!me) { openAuthModal('login'); return; }
      const now = await toggleNotify(userId);
      notifyBtn.innerHTML = `${now ? BELL_SVG : BELL_OFF_SVG}<span>${now ? 'Notified' : 'Notify me'}</span>`;
      if (now) notifyBtn.classList.add('active'); else notifyBtn.classList.remove('active');
      const nc = await getSubscriberCount(userId);
      container.querySelector('.channel-handle').textContent = formatSubscribers(nc);
    });
  }
}
