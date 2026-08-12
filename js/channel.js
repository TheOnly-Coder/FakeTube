import { getUser, getVideosByUser, getPostsByUser, createPost, toggleNotify, isNotifying, getSubscriberCount, updateUser, searchChannels, isPostStarred, deletePost } from './db.js';
import { getCurrentUser, logout } from './auth.js';
import { videoCardHTML, setupVideoCardClicks, openAuthModal, closeAuthModal, CLOSE_SVG, BELL_SVG, BELL_OFF_SVG, STAR_SVG, STAR_OUTLINE_SVG } from './components.js';
import { formatSubscribers, timeAgo, formatViews, escapeHtml, getInitials, showToast } from './utils.js';
import { postCardHTML, setupPostCardActions } from './posts.js';

export async function renderChannel(container, userId) {
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  const [channelUser, videos, posts] = await Promise.all([getUser(userId), getVideosByUser(userId), getPostsByUser(userId)]);
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

  // Resolve banner class
  const bannerVal = channelUser.banner || '';
  let bannerHTML;
  if (bannerVal.includes('.')) {
    // It's an image URL
    bannerHTML = `<div class="channel-banner" style="background-image:url('${escapeHtml(bannerVal)}')"></div>`;
  } else if (bannerVal) {
    // It's a preset name
    bannerHTML = `<div class="channel-banner banner-${escapeHtml(bannerVal)}"></div>`;
  } else {
    // No banner set, use default gradient
    bannerHTML = `<div class="channel-banner banner-default"></div>`;
  }

  container.innerHTML = `
    <div class="channel-page">
      ${bannerHTML}
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
        <button class="channel-tab active" data-tab="videos">Videos</button>
        <button class="channel-tab" data-tab="posts">Posts</button>
        <button class="channel-tab" data-tab="about">About</button>
      </div>
      <div id="tab-videos" class="video-grid"></div>
      <div id="tab-posts" class="hidden"></div>
      <div id="tab-about" class="hidden"></div>
    </div>
  `;

  // Tab switching
  const tabs = container.querySelectorAll('.channel-tab');
  const videosPane = document.getElementById('tab-videos');
  const postsPane = document.getElementById('tab-posts');
  const aboutPane = document.getElementById('tab-about');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      videosPane.classList.toggle('hidden', target !== 'videos');
      postsPane.classList.toggle('hidden', target !== 'posts');
      aboutPane.classList.toggle('hidden', target !== 'about');
    });
  });

  // Posts pane content
  setupPostCardActions(container);
  renderPostsPane(postsPane, posts, isMe, me, userId);

  // About pane content
  const joinDate = channelUser.createdAt
    ? new Date(typeof channelUser.createdAt === 'object' && channelUser.createdAt.toDate ? channelUser.createdAt.toDate() : channelUser.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : 'Unknown';
  aboutPane.innerHTML = `
    <div style="max-width:600px;">
      <h3 style="font-size:16px;font-weight:600;margin-bottom:16px;color:#f1f1f1;">Description</h3>
      <p style="color:#aaa;line-height:1.7;margin-bottom:24px;white-space:pre-wrap;">${escapeHtml(channelUser.bio) || 'No description yet.'}</p>
      <h3 style="font-size:16px;font-weight:600;margin-bottom:8px;color:#f1f1f1;">Stats</h3>
      <div style="display:flex;gap:32px;color:#aaa;font-size:14px;">
        <div><span style="font-weight:600;color:#f1f1f1;">${formatSubscribers(subCount)}</span></div>
        <div><span style="font-weight:600;color:#f1f1f1;">${videos.length}</span> video${videos.length !== 1 ? 's' : ''}</div>
      </div>
      <h3 style="font-size:16px;font-weight:600;margin-bottom:8px;margin-top:24px;color:#f1f1f1;">Joined</h3>
      <p style="color:#aaa;font-size:14px;">${joinDate}</p>
    </div>
  `;

  // Render videos using inline cards for proper escaping
  const grid = videosPane;
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

  // Sign out button (only on own channel — isMe guard is redundant since
  // the button isn't rendered for others, but kept as defense-in-depth)
  const signOutBtn = document.getElementById('sign-out-btn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      if (!isMe) return;
      await logout();
      window.location.hash = '#/';
    });
  }

  // Edit profile button (only on own channel)
  const editBtn = document.getElementById('edit-profile-btn');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      if (!isMe) return;
      openEditProfileModal(channelUser, container, userId);
    });
  }
}

function openEditProfileModal(channelUser, pageContainer, userId) {
  const modal = document.getElementById('auth-modal');
  modal.classList.remove('hidden');

  const currentBanner = channelUser.banner || '';
  const presets = [
    { id: '', label: 'Default' },
    { id: 'gradientSunset', label: 'Sunset' },
    { id: 'gradientOcean', label: 'Ocean' },
    { id: 'gradientAurora', label: 'Aurora' },
    { id: 'gradientMidnight', label: 'Midnight' },
    { id: 'gradientCherry', label: 'Cherry' },
    { id: 'gradientForest', label: 'Forest' },
    { id: 'gradientLavender', label: 'Lavender' },
    { id: 'gradientFire', label: 'Fire' },
    { id: 'checkersRed', label: 'Checkers Red' },
    { id: 'checkersBlue', label: 'Checkers Blue' },
    { id: 'checkersGreen', label: 'Checkers Green' },
    { id: 'checkersPurple', label: 'Checkers Purple' },
    { id: 'stripesCyan', label: 'Stripes Cyan' },
    { id: 'stripesRed', label: 'Stripes Red' },
    { id: 'dotsMonochrome', label: 'Dots Mono' },
    { id: 'dotsColor', label: 'Dots Color' },
    { id: 'solidBlack', label: 'Solid Black' },
    { id: 'solidDark', label: 'Solid Dark' },
  ];

  const isPreset = currentBanner && !currentBanner.includes('.');
  const isImage = currentBanner && currentBanner.includes('.');

  modal.innerHTML = `
    <div class="modal-content" style="max-height:90vh;overflow-y:auto;">
      <button class="modal-close" id="modal-close-btn">${CLOSE_SVG}</button>
      <h2 style="margin-bottom:20px;color:#f1f1f1;">Edit Profile</h2>
      <form class="auth-form" id="edit-profile-form">
        <input type="text" id="edit-name" placeholder="Display name" required value="${escapeHtml(channelUser.displayName || '')}">
        <textarea id="edit-bio" placeholder="Bio (optional)" rows="3" style="width:100%;background:#272727;border:1px solid #303030;border-radius:4px;padding:12px 16px;color:#f1f1f1;font-size:14px;resize:vertical;font-family:inherit;margin-bottom:12px;">${escapeHtml(channelUser.bio || '')}</textarea>
        <input type="url" id="edit-photo" placeholder="Photo URL (optional)" value="${escapeHtml(channelUser.photoURL || '')}">
        
        <div style="margin-top:20px;margin-bottom:8px;color:#f1f1f1;font-size:14px;font-weight:500;">Banner</div>
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <button type="button" class="btn btn-outline banner-mode-btn ${!isImage ? 'active' : ''}" id="banner-mode-presets" style="flex:1;padding:8px;font-size:13px;">Preset</button>
          <button type="button" class="btn btn-outline banner-mode-btn ${isImage ? 'active' : ''}" id="banner-mode-image" style="flex:1;padding:8px;font-size:13px;">Image URL</button>
        </div>
        <div id="banner-presets-panel" style="margin-bottom:12px;">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;max-height:180px;overflow-y:auto;padding:4px;">
            ${presets.map(p => `
              <button type="button" class="banner-preset-swatch ${currentBanner === p.id ? 'selected' : ''}" data-preset="${p.id}" title="${p.label}" style="height:48px;border-radius:6px;border:2px solid ${currentBanner === p.id ? '#3ea6ff' : '#303030'};cursor:pointer;overflow:hidden;background-size:cover;background-position:center;">
                <div class="channel-banner banner-${p.id || 'default'}" style="height:100%;width:100%;border-radius:0;margin:0;padding:0;"></div>
              </button>
            `).join('')}
          </div>
          <input type="hidden" id="edit-banner-preset" value="${escapeHtml(isPreset ? currentBanner : '')}">
        </div>
        <div id="banner-image-panel" class="hidden" style="margin-bottom:12px;">
          <input type="url" id="edit-banner-image" placeholder="Paste an image URL (e.g. https://example.com/banner.png)" value="${escapeHtml(isImage ? currentBanner : '')}">
          <div id="banner-image-preview" style="margin-top:8px;height:80px;border-radius:6px;overflow:hidden;background-size:cover;background-position:center;${isImage ? `background-image:url('${escapeHtml(currentBanner)}')` : ''}"></div>
        </div>

        <button type="submit" class="auth-submit-btn" id="edit-submit-btn">Save changes</button>
        <div class="auth-error hidden" id="edit-error"></div>
      </form>
    </div>
  `;

  document.getElementById('modal-close-btn').addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

  // Banner mode toggle
  const presetsPanel = document.getElementById('banner-presets-panel');
  const imagePanel = document.getElementById('banner-image-panel');
  const modePresetsBtn = document.getElementById('banner-mode-presets');
  const modeImageBtn = document.getElementById('banner-mode-image');

  modePresetsBtn.addEventListener('click', () => {
    presetsPanel.classList.remove('hidden');
    imagePanel.classList.add('hidden');
    modePresetsBtn.classList.add('active');
    modeImageBtn.classList.remove('active');
  });
  modeImageBtn.addEventListener('click', () => {
    presetsPanel.classList.add('hidden');
    imagePanel.classList.remove('hidden');
    modeImageBtn.classList.add('active');
    modePresetsBtn.classList.remove('active');
  });

  // Preset swatch selection
  presetsPanel.querySelectorAll('.banner-preset-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      presetsPanel.querySelectorAll('.banner-preset-swatch').forEach(s => {
        s.classList.remove('selected');
        s.style.borderColor = '#303030';
      });
      swatch.classList.add('selected');
      swatch.style.borderColor = '#3ea6ff';
      document.getElementById('edit-banner-preset').value = swatch.dataset.preset;
    });
  });

  // Image URL live preview
  const imageInput = document.getElementById('edit-banner-image');
  const imagePreview = document.getElementById('banner-image-preview');
  imageInput.addEventListener('input', () => {
    const url = imageInput.value.trim();
    if (url) {
      imagePreview.style.backgroundImage = `url('${url}')`;
    } else {
      imagePreview.style.backgroundImage = '';
    }
  });

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

    // Resolve banner value
    let banner = '';
    if (!imagePanel.classList.contains('hidden')) {
      banner = imageInput.value.trim(); // URL or empty
    } else {
      banner = document.getElementById('edit-banner-preset').value; // preset id or empty
    }

    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      await updateUser(userId, { displayName: name, bio, photoURL: photo, banner });
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

function renderPostsPane(postsPane, posts, isMe, me, channelId) {
  if (posts.length === 0 && !isMe) {
    postsPane.innerHTML = '<div class="empty-state"><p>This channel hasn\'t made any posts yet.</p></div>';
    return;
  }

  // Build the posts list with optional Make Post form at top
  let html = '';
  if (isMe) {
    html += `
      <div class="make-post-section">
        <div class="make-post-header">
          <div class="make-post-avatar">
            ${me.photoURL ? `<img src="${escapeHtml(me.photoURL)}" alt="">` : getInitials(me.displayName)}
          </div>
          <textarea id="make-post-input" placeholder="Share something with your subscribers..." rows="3" maxlength="1000"></textarea>
        </div>
        <div class="make-post-actions">
          <span class="make-post-char-count" id="make-post-char-count">0 / 1000</span>
          <button class="btn btn-primary" id="make-post-btn" disabled style="padding:8px 20px;font-size:13px;">Post</button>
        </div>
      </div>
    `;
  }

  if (posts.length === 0 && isMe) {
    html += '<div class="empty-state" style="padding:24px;"><p>No posts yet. Make your first post above!</p></div>';
  } else {
    html += '<div class="posts-list">' + posts.map(p => postCardHTML(p, { showAuthor: false, showDelete: isMe })).join('') + '</div>';
  }

  postsPane.innerHTML = html;

  // Make Post logic
  const postInput = document.getElementById('make-post-input');
  const postBtn = document.getElementById('make-post-btn');
  const charCount = document.getElementById('make-post-char-count');
  if (postInput && postBtn) {
    postInput.addEventListener('input', () => {
      const len = postInput.value.length;
      charCount.textContent = `${len} / 1000`;
      postBtn.disabled = !postInput.value.trim();
    });
    postBtn.addEventListener('click', async () => {
      const text = postInput.value.trim();
      if (!text) return;
      postBtn.disabled = true;
      postBtn.textContent = 'Posting...';
      try {
        const postId = await createPost({
          content: text,
          channelId: me.uid,
          channelName: me.displayName,
          channelPhoto: me.photoURL || ''
        });
        showToast('Post published!');
        // Re-render posts pane to show new post
        const newPosts = await getPostsByUser(channelId);
        renderPostsPane(postsPane, newPosts, isMe, me, channelId);
      } catch (err) {
        console.error('Post creation error:', err);
        showToast('Could not create post. Check Firestore rules.');
        postBtn.disabled = false;
        postBtn.textContent = 'Post';
      }
    });
  }

  // Delete post handlers
  postsPane.querySelectorAll('.post-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isMe) return;
      if (!confirm('Delete this post?')) return;
      try {
        await deletePost(btn.dataset.postId);
        showToast('Post deleted');
        const newPosts = await getPostsByUser(channelId);
        renderPostsPane(postsPane, newPosts, isMe, me, channelId);
      } catch (err) {
        console.error('Delete post error:', err);
        showToast('Could not delete post.');
      }
    });
  });
}

export async function renderChannelSearch(container, searchTerm) {
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  const channels = await searchChannels(searchTerm);

  container.innerHTML = `
    <div style="margin-bottom:24px;">
      <h2 style="font-size:20px;font-weight:600;color:#f1f1f1;">Channel results for "${escapeHtml(searchTerm)}"</h2>
    </div>
    <div class="channel-search-results" id="channel-search-results"></div>
  `;

  const results = document.getElementById('channel-search-results');

  if (channels.length === 0) {
    results.innerHTML = '<div class="empty-state"><p>No channels found matching your search.</p></div>';
    return;
  }

  results.innerHTML = channels.map(ch => {
    const avatar = ch.photoURL
      ? `<img src="${escapeHtml(ch.photoURL)}" alt="">`
      : getInitials(ch.displayName);
    const subs = formatSubscribers(ch.subscriberCount || 0);
    return `
      <a href="#/channel/${ch.id}" class="channel-search-item">
        <div class="channel-search-avatar">${avatar}</div>
        <div class="channel-search-info">
          <div class="channel-search-name">${escapeHtml(ch.displayName)}</div>
          <div class="channel-search-subs">${subs}</div>
        </div>
      </a>
    `;
  }).join('');
}
