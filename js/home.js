import { getVideos, searchVideos } from './db.js';
import { videoCardHTML, setupVideoCardClicks } from './components.js';
import { formatViews, timeAgo } from './utils.js';

export async function renderHome(container, searchTerm) {
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  let videos;
  if (searchTerm) {
    videos = await searchVideos(searchTerm);
  } else {
    videos = await getVideos(50);
  }

  if (videos.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M18,4l2,4h-3l-2-4h-2l2,4h-3l-2-4H8l2,4H7L5,4H4C2.9,4,2,4.9,2,6v12c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V4H18z"/></svg>
        <h3>${searchTerm ? 'No results found' : 'No videos yet'}</h3>
        <p>${searchTerm ? 'Try different keywords' : 'Be the first to upload a video!'}</p>
        ${!searchTerm ? '<a href="#/upload" class="btn btn-primary">Upload Video</a>' : ''}
      </div>
    `;
    return;
  }

  // Override video card to use formatViews and timeAgo properly
  const gridHTML = videos.map(v => {
    const avatarContent = v.uploaderPhoto 
      ? `<img src="${escapeAttr(v.uploaderPhoto)}" alt="">` 
      : getInitials(v.uploaderName);
    return `
      <div class="video-card" data-video-id="${v.id}">
        <div class="video-card-thumbnail">
          ${v.thumbnailUrl 
            ? `<img src="${escapeAttr(v.thumbnailUrl)}" alt="${escapeAttr(v.title)}" loading="lazy">` 
            : ''}
        </div>
        <div class="video-card-info">
          <div class="video-card-avatar" data-channel-id="${v.uploaderId}">${avatarContent}</div>
          <div class="video-card-meta">
            <div class="video-card-title">${escapeHTML(v.title)}</div>
            <div class="video-card-channel" data-channel-id="${v.uploaderId}">${escapeHTML(v.uploaderName)}</div>
            <div class="video-card-stats">${formatViews(v.views)} &middot; ${timeAgo(v.createdAt)}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `<div class="home-page"><div class="video-grid">${gridHTML}</div></div>`;
  setupVideoCardClicks(container);
}

function escapeHTML(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
function escapeAttr(str) {
  return escapeHTML(str);
}
function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
}
