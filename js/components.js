import { getCurrentUser, onAuthChange, logout, login, signup } from './auth.js';
import { showToast, getInitials, escapeHtml } from './utils.js';

const LOGO_SVG = `<svg viewBox="0 0 24 24"><polygon points="6,3 6,21 21,12"/></svg>`;
const SEARCH_SVG = `<svg viewBox="0 0 24 24"><path d="M20.87,20.17l-5.59-5.59C16.35,13.35,17,11.75,17,10c0-3.87-3.13-7-7-7s-7,3.13-7,7s3.13,7,7,7c1.75,0,3.35-.65,4.58-1.72l5.59,5.59L20.87,20.17z M10,16c-3.31,0-6-2.69-6-6s2.69-6,6-6s6,2.69,6,6S13.31,16,10,16z"/></svg>`;
const UPLOAD_SVG = `<svg viewBox="0 0 24 24"><path d="M17,10.5V7c0-.55-.45-1-1-1H4c-.55,0-1,.45-1,1v10c0,.55.45,1,1,1h12c.55,0,1-.45,1-1v-3.5l4,4v-11L17,10.5z"/></svg>`;
const CLOSE_SVG = `<svg viewBox="0 0 24 24"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41z"/></svg>`;
const MENU_SVG = `<svg viewBox="0 0 24 24"><path d="M12,16.5c0.83,0,1.5,0.67,1.5,1.5s-0.67,1.5-1.5,1.5s-1.5-0.67-1.5-1.5S11.17,16.5,12,16.5z M10.5,12c0,0.83,0.67,1.5,1.5,1.5 s1.5-0.67,1.5-1.5s-0.67-1.5-1.5-1.5S10.5,11.17,10.5,12z M10.5,6c0,0.83,0.67,1.5,1.5,1.5s1.5-0.67,1.5-1.5S12.83,4.5,12,4.5 S10.5,5.17,10.5,6z"/></svg>`;
const CHEVRON_UP_SVG = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7.41,15.41L12,10.83l4.59,4.58L18,14l-6-6l-6,6L7.41,15.41z"/></svg>`;
const CHEVRON_DOWN_SVG = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7.41,8.59L12,13.17l4.59-4.58L18,10l-6,6l-6-6L7.41,8.59z"/></svg>`;
const BELL_SVG = `<svg viewBox="0 0 24 24"><path d="M12,22c1.1,0,2-0.9,2-2h-4C10,21.1,10.9,22,12,22z M18,16v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-0.83-0.67-1.5-1.5-1.5 S10.5,3.17,10.5,4v0.68C7.64,5.36,6,7.92,6,11v5l-2,2v1h16v-1L18,16z"/></svg>`;
const BELL_OFF_SVG = `<svg viewBox="0 0 24 24"><path d="M12,22c1.1,0,2-0.9,2-2h-4C10,21.1,10.9,22,12,22z M18,16v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-0.83-0.67-1.5-1.5-1.5 S10.5,3.17,10.5,4v0.68C7.63,5.36,6,7.92,6,11v5l-2,2v1h16v-1L18,16z M20.39,6.21l-1.42,1.42C19.63,8.74,20,10.31,20,12v1h2v-1 C22,10.34,21.41,8.12,20.39,6.21z"/><path d="M4,13v-1c0-1.69,0.37-3.31,1.03-4.76L3.61,5.82C2.59,7.73,2,9.96,2,12v1H4z" opacity="0.3"/></svg>`;
const THUMB_UP_SVG = `<svg viewBox="0 0 24 24"><path d="M18.77,11h-4.23l1.52-4.94C16.38,5.03,15.54,4,14.38,4c-0.58,0-1.14,0.24-1.52,0.65L7,11H1v10h6h0.01h6L18.77,11z M7,19H3v-6h4V19z M16.46,13L11,19H9v-7.5L13.75,6.4c0.12-0.13,0.3-0.2,0.48-0.2c0.3,0,0.5,0.2,0.5,0.5l-1.8,5.3H16.46z"/></svg>`;
const THUMB_DOWN_SVG = `<svg viewBox="0 0 24 24"><path d="M18,4h-6h-0.01H6l1.23,8H18V4z M9.5,17.5L14,11h2v7.5L10.52,18L9.5,17.5z M21,4h-1v8h1c1.1,0,2-0.9,2-2V6 C23,4.9,22.1,4,21,4z"/></svg>`;
const SEND_SVG = `<svg viewBox="0 0 24 24"><path d="M2.01,21L23,12L2.01,3L2,10l15,2l-15,2L2.01,21z"/></svg>`;
const USER_SVG = `<svg viewBox="0 0 24 24"><path d="M12,12c2.21,0,4-1.79,4-4s-1.79-4-4-4S8,5.79,8,8S9.79,12,12,12z M12,14c-2.67,0-8,1.34-8,4v2h16v-2C20,15.34,14.67,14,12,14z"/></svg>`;
const CHANNEL_SVG = `<svg viewBox="0 0 24 24"><path d="M4,6H2v14c0,1.1,0.9,2,2,2h14v-2H4V6z M20,2H8c-1.1,0-2,0.9-2,2v12c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V4C22,2.9,21.1,2,20,2z M20,16H8V4h12V16z"/></svg>`;
const SIGNOUT_SVG = `<svg viewBox="0 0 24 24"><path d="M17,7l-1.41,1.41L18.17,11H8v2h10.17l-2.58,2.58L17,17l5-5L17,7z M4,5h8V3H4C2.9,3,2,3.9,2,5v14c0,1.1,0.9,2,2,2h8v-2H4V5z"/></svg>`;
const VIDEO_SVG = `<svg viewBox="0 0 24 24"><path d="M17,10.5V7c0-.55-.45-1-1-1H4c-.55,0-1,.45-1,1v10c0,.55.45,1,1,1h12c.55,0,1-.45,1-1v-3.5l4,4v-11L17,10.5z"/></svg>`;
const STAR_SVG = `<svg viewBox="0 0 24 24"><path d="M12,17.27L18.18,21l-1.64-7.03L22,9.24l-7.19-0.61L12,2L9.19,8.63L2,9.24l5.46,4.73L5.82,21L12,17.27z"/></svg>`;
const STAR_OUTLINE_SVG = `<svg viewBox="0 0 24 24"><path d="M12,17.27L18.18,21l-1.64-7.03L22,9.24l-7.19-0.61L12,2L9.19,8.63L2,9.24l5.46,4.73L5.82,21L12,17.27z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
const COMMENT_SVG = `<svg viewBox="0 0 24 24"><path d="M21.99,4c0-1.1-0.89-2-1.99-2H4c-1.1,0-2,0.9-2,2v12c0,1.1,0.9,2,2,2h14l4,4V4z"/></svg>`;

export { SEARCH_SVG, UPLOAD_SVG, CLOSE_SVG, MENU_SVG, CHEVRON_UP_SVG, CHEVRON_DOWN_SVG, BELL_SVG, BELL_OFF_SVG, THUMB_UP_SVG, THUMB_DOWN_SVG, SEND_SVG, USER_SVG, CHANNEL_SVG, SIGNOUT_SVG, VIDEO_SVG, STAR_SVG, STAR_OUTLINE_SVG, COMMENT_SVG };

let menuOpen = false;
let searchType = 'videos'; // 'videos' or 'channels'

export function getSearchType() { return searchType; }

export function renderHeader() {
  const header = document.getElementById('header');
  const user = getCurrentUser();
  
  header.innerHTML = `
    <div class="header-left">
      <a href="#/" class="header-logo">
        <div class="logo-icon">${LOGO_SVG}</div>
        <span class="logo-text">FakeTube</span>
      </a>
    </div>
    <div class="header-center">
      <div class="search-wrapper" id="search-wrapper">
        <form class="search-form" id="search-form">
          <input type="text" class="search-input" id="search-input" placeholder="Search" autocomplete="off">
          <button type="submit" class="search-btn">${SEARCH_SVG}</button>
        </form>
        <div class="search-dropdown hidden" id="search-dropdown">
          <button class="search-dropdown-item ${searchType === 'videos' ? 'active' : ''}" data-search-type="videos">
            ${VIDEO_SVG}
            <span>Search in videos</span>
          </button>
          <button class="search-dropdown-item ${searchType === 'channels' ? 'active' : ''}" data-search-type="channels">
            ${CHANNEL_SVG}
            <span>Search in channels</span>
          </button>
        </div>
      </div>
    </div>
    <div class="header-right">
      ${user ? `
        <a href="#/upload" class="btn-upload" title="Upload video">
          ${UPLOAD_SVG}
          <span>Upload</span>
        </a>
        <a href="#/channel/${user.channelId || user.uid}" class="user-avatar-btn" title="${escapeHtml(user.displayName)}">
          ${user.photoURL 
            ? `<img src="${escapeHtml(user.photoURL)}" alt="${escapeHtml(user.displayName)}">` 
            : getInitials(user.displayName)}
          <span style="color:#f1f1f1;font-size:13px;margin-left:6px;white-space:nowrap;">My Profile</span>
        </a>
      ` : `
        <button class="btn btn-outline" id="sign-in-btn">Sign in</button>
      `}
    </div>
  `;

  // Search form
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const searchDropdown = document.getElementById('search-dropdown');
  const searchWrapper = document.getElementById('search-wrapper');

  // Show/hide dropdown on input focus
  searchInput.addEventListener('focus', () => searchDropdown.classList.remove('hidden'));
  document.addEventListener('click', (e) => {
    if (!searchWrapper.contains(e.target)) searchDropdown.classList.add('hidden');
  });

  // Dropdown item selection
  searchDropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      searchType = item.dataset.searchType;
      searchDropdown.querySelectorAll('.search-dropdown-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      searchDropdown.classList.add('hidden');
      searchInput.focus();
    });
  });

  // Search submit
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (!q) return;
    searchDropdown.classList.add('hidden');
    if (searchType === 'channels') {
      window.location.hash = `#/search/channels/${encodeURIComponent(q)}`;
    } else {
      window.location.hash = `#/search/${encodeURIComponent(q)}`;
    }
  });

  // Sign in button
  const signInBtn = document.getElementById('sign-in-btn');
  if (signInBtn) signInBtn.addEventListener('click', () => openAuthModal('login'));

  // Upload button is now an <a> tag, no JS needed
  // Profile button is now an <a> tag, no JS needed
}

function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  const user = getCurrentUser();
  menuOpen = !menuOpen;

  if (menuOpen) {
    menu.classList.remove('hidden');
    menu.innerHTML = `
      <div class="user-menu-header">
        <div class="user-menu-avatar">
          ${user.photoURL 
            ? `<img src="${escapeHtml(user.photoURL)}" alt="">` 
            : getInitials(user.displayName)}
        </div>
        <div class="user-menu-info">
          <h4>${escapeHtml(user.displayName)}</h4>
          <p>${escapeHtml(user.email)}</p>
        </div>
      </div>
      <button class="user-menu-item" id="menu-my-channel">
        ${CHANNEL_SVG} My Channel
      </button>
      <button class="user-menu-item" id="menu-upload">
        ${UPLOAD_SVG} Upload Video
      </button>
      <div class="user-menu-divider"></div>
      <button class="user-menu-item" id="menu-signout">
        ${SIGNOUT_SVG} Sign out
      </button>
    `;
    document.getElementById('menu-my-channel').addEventListener('click', () => {
      menu.classList.add('hidden'); menuOpen = false;
      window.location.hash = `#/channel/${user.channelId || user.uid}`;
    });
    document.getElementById('menu-upload').addEventListener('click', () => {
      menu.classList.add('hidden'); menuOpen = false;
      window.location.hash = '#/upload';
    });
    document.getElementById('menu-signout').addEventListener('click', async () => {
      menu.classList.add('hidden'); menuOpen = false;
      await logout();
      window.location.hash = '#/';
    });
  } else {
    menu.classList.add('hidden');
  }
}

// ---- Auth Modal ----
let currentAuthMode = 'login';

export function openAuthModal(mode = 'login') {
  currentAuthMode = mode;
  const modal = document.getElementById('auth-modal');
  modal.classList.remove('hidden');
  renderAuthModalContent();
}

export function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
}

function renderAuthModalContent() {
  const modal = document.getElementById('auth-modal');
  const isLogin = currentAuthMode === 'login';

  modal.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" id="modal-close-btn">${CLOSE_SVG}</button>
      <div class="auth-modal-logo">
        <div class="logo-icon">${LOGO_SVG}</div>
        <span class="logo-text">FakeTube</span>
      </div>
      <h2>${isLogin ? 'Sign in' : 'Create an account'}</h2>
      <form class="auth-form" id="auth-form">
        ${!isLogin ? '<input type="text" id="auth-name" placeholder="Display name" required>' : ''}
        <input type="email" id="auth-email" placeholder="Email" required>
        <input type="password" id="auth-password" placeholder="Password" minlength="6" required>
        <button type="submit" class="auth-submit-btn" id="auth-submit-btn">${isLogin ? 'Sign in' : 'Create account'}</button>
        <div class="auth-switch">
          ${isLogin 
            ? `Don't have an account? <a id="auth-switch-link">Sign up</a>`
            : `Already have an account? <a id="auth-switch-link">Sign in</a>`}
        </div>
        <div class="auth-error hidden" id="auth-error"></div>
      </form>
    </div>
  `;

  document.getElementById('modal-close-btn').addEventListener('click', closeAuthModal);
  document.getElementById('auth-switch-link').addEventListener('click', () => {
    currentAuthMode = currentAuthMode === 'login' ? 'signup' : 'login';
    renderAuthModalContent();
  });

  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errEl = document.getElementById('auth-error');
    const btn = document.getElementById('auth-submit-btn');
    btn.disabled = true;

    let result;
    if (isLogin) {
      result = await login(email, password);
    } else {
      const name = document.getElementById('auth-name').value.trim();
      if (!name) { errEl.textContent = 'Please enter a display name.'; errEl.classList.remove('hidden'); btn.disabled = false; return; }
      result = await signup(email, password, name);
    }

    if (!result.success) {
      errEl.textContent = result.error;
      errEl.classList.remove('hidden');
      btn.disabled = false;
    } else {
      closeAuthModal();
    }
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeAuthModal();
  });
}

// ---- Video Card ----
export function videoCardHTML(video) {
  const avatarContent = video.uploaderPhoto 
    ? `<img src="${escapeHtml(video.uploaderPhoto)}" alt="">` 
    : getInitials(video.uploaderName);
  return `
    <div class="video-card" data-video-id="${video.id}">
      <div class="video-card-thumbnail">
        ${video.thumbnailUrl 
          ? `<img src="${escapeHtml(video.thumbnailUrl)}" alt="${escapeHtml(video.title)}" loading="lazy">` 
          : ''}
      </div>
      <div class="video-card-info">
        <div class="video-card-avatar" data-channel-id="${video.uploaderId}">${avatarContent}</div>
        <div class="video-card-meta">
          <div class="video-card-title">${escapeHtml(video.title)}</div>
          <div class="video-card-channel" data-channel-id="${video.uploaderId}">${escapeHtml(video.uploaderName)}</div>
          <div class="video-card-stats">views &middot; ${timeAgoText(video.createdAt)}</div>
        </div>
      </div>
    </div>
  `;
}

function timeAgoText(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30); if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function sidebarVideoCardHTML(video) {
  return `
    <div class="sidebar-video-card" data-video-id="${video.id}">
      <div class="sidebar-video-thumb">
        ${video.thumbnailUrl 
          ? `<img src="${escapeHtml(video.thumbnailUrl)}" alt="${escapeHtml(video.title)}" loading="lazy">` 
          : ''}
      </div>
      <div class="sidebar-video-info">
        <div class="sidebar-video-title">${escapeHtml(video.title)}</div>
        <div class="sidebar-video-channel">${escapeHtml(video.uploaderName)}</div>
        <div class="sidebar-video-stats">${video.views || 0} views</div>
      </div>
    </div>
  `;
}

// Click delegation for video cards
export function setupVideoCardClicks(container) {
  container.addEventListener('click', (e) => {
    const card = e.target.closest('[data-video-id]');
    if (card && !e.target.closest('[data-channel-id]')) {
      window.location.hash = `#/watch/${card.dataset.videoId}`;
    }
    const channelEl = e.target.closest('[data-channel-id]');
    if (channelEl) {
      e.stopPropagation();
      window.location.hash = `#/channel/${channelEl.dataset.channelId}`;
    }
  });
}
