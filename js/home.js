import { getVideos, searchVideos } from './db.js';
import { setupVideoCardClicks } from './components.js';
import { formatViews, timeAgo, escapeHtml, getInitials, getRecommendedVideos } from './utils.js';

export async function renderHome(container, searchTerm) {
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  let videos;
  try {
    if (searchTerm) {
      videos = await searchVideos(searchTerm);
    } else {
      videos = await getVideos(50);
      // Apply recommendation algorithm (localStorage-based, no Firebase cost)
      videos = getRecommendedVideos(videos);
    }
  } catch (err) {
    console.error('Failed to load videos:', err);
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M12,2L1,21h22L12,2z M12,6l7.53,13H4.47L12,6z"/><rect x="11" y="10" width="2" height="4"/><rect x="11" y="16" width="2" height="2"/></svg>
        <h3>Could not load videos</h3>
        <p style="max-width:450px;margin:0 auto 16px;">This usually means Firestore hasn't been set up yet. Check the setup guide for instructions.</p>
        <a href="#/how-to-upload" class="btn btn-primary">How to get started</a>
      </div>
    `;
    return;
  }

  if (videos.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M18,4l2,4h-3l-2-4h-2l2,4h-3l-2-4H8l2,4H7L5,4H4C2.9,4,2,4.9,2,6v12c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V4H18z"/></svg>
        <h3>${searchTerm ? 'No results found' : 'No videos yet'}</h3>
        <p>${searchTerm ? 'Try different keywords' : 'Be the first to share a video!'}</p>
        ${!searchTerm ? '<a href="#/how-to-upload" class="btn btn-primary">Learn how to upload</a>' : ''}
      </div>
    `;
    return;
  }

  const gridHTML = videos.map(v => {
    const av = v.uploaderPhoto 
      ? `<img src="${escapeHtml(v.uploaderPhoto)}" alt="">` 
      : getInitials(v.uploaderName);
    return `
      <div class="video-card" data-video-id="${v.id}">
        <div class="video-card-thumbnail">
          ${v.thumbnailUrl 
            ? `<img src="${escapeHtml(v.thumbnailUrl)}" alt="${escapeHtml(v.title)}" loading="lazy">` 
            : ''}
        </div>
        <div class="video-card-info">
          <div class="video-card-avatar" data-channel-id="${v.uploaderId}">${av}</div>
          <div class="video-card-meta">
            <div class="video-card-title">${escapeHtml(v.title)}</div>
            <div class="video-card-channel" data-channel-id="${v.uploaderId}">${escapeHtml(v.uploaderName)}</div>
            <div class="video-card-stats">${formatViews(v.views)} &middot; ${timeAgo(v.createdAt)}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `<div class="home-page"><div class="video-grid">${gridHTML}</div></div>`;
  setupVideoCardClicks(container);
}