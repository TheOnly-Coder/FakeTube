import { getUser, getVideosByUser, toggleNotify, isNotifying, getSubscriberCount, updateUser } from './db.js';
import { getCurrentUser, logout } from './auth.js';
import { videoCardHTML, setupVideoCardClicks, openAuthModal, closeAuthModal, CLOSE_SVG, BELL_SVG, BELL_OFF_SVG } from './components.js';
import { formatSubscribers, timeAgo, formatViews, escapeHtml, getInitials, showToast } from './utils.js';

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
            ? `<button class="btn btn-outline" id="edit-profile-btn">Edit profile</button>
               <button class="btn" id="sign-out-btn" style="margin-left:8px;">Sign out</button>`
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

  // Sign out button (only on own channel)
  const signOutBtn = document.getElementById('sign-out-btn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      await logout();
      window.location.hash = '#/';
    });
  }

  // Edit profile button (only on own channel)
  const editBtn = document.getElementById('edit-profile-btn');
  if (editBtn) {
    editBtn.addEventListener('click', () => openEditProfileModal(channelUser, container, userId));
  }
}

function openEditProfileModal(channelUser, pageContainer, userId) {
  const modal = document.getElementById('auth-modal');
  modal.classList.remove('hidden');
  modal.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" id="modal-close-btn">${CLOSE_SVG}</button>
      <h2 style="margin-bottom:20px;color:#f1f1f1;">Edit Profile</h2>
      <form class="auth-form" id="edit-profile-form">
        <input type="text" id="edit-name" placeholder="Display name" required value="${escapeHtml(channelUser.displayName || '')}">
        <textarea id="edit-bio" placeholder="Bio (optional)" rows="3" style="width:100%;background:#272727;border:1px solid #303030;border-radius:4px;padding:12px 16px;color:#f1f1f1;font-size:14px;resize:vertical;font-family:inherit;margin-bottom:12px;">${escapeHtml(channelUser.bio || '')}</textarea>
        <input type="url" id="edit-photo" placeholder="Photo URL (optional)" value="${escapeHtml(channelUser.photoURL || '')}">
        <button type="submit" class="auth-submit-btn" id="edit-submit-btn">Save changes</button>
        <div class="auth-error hidden" id="edit-error"></div>
      </form>
    </div>
  `;

  document.getElementById('modal-close-btn').addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

  document.getElementById('edit-profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('edit-name').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();
    const photo = document.getElementById('edit-photo').value.trim();
    const errEl = document.getElementById('edit-error');
    const btn = document.getElementById('edit-submit-btn');

    if (!name) {
      errEl.textContent = 'Display name is required.';
      errEl.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      await updateUser(userId, { displayName: name, bio, photoURL: photo });
      modal.classList.add('hidden');
      showToast('Profile updated!');
      renderChannel(pageContainer, userId);
    } catch (err) {
      errEl.textContent = err.message || 'Failed to save.';
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Save changes';
    }
  });
}
