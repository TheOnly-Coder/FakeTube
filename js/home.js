import { getVideos, searchVideos, getSubscribedPosts } from './db.js';
import { setupVideoCardClicks } from './components.js';
import { formatViews, timeAgo, escapeHtml, getInitials, getRecommendedVideos } from './utils.js';
import { postCardHTML, setupPostCardActions } from './posts.js';

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

  let html = '<div class="home-page">';

  // Show subscribed posts above videos (only on the main feed, not search)
  if (!searchTerm) {
    const subPosts = await getSubscribedPostsSilent();
    if (subPosts.length > 0) {
      html += `<div class="home-posts-section"><h2 class="home-posts-title">Posts from channels you follow</h2>`;
      html += '<div class="posts-list">' + subPosts.map(p => postCardHTML(p, { showAuthor: true, showDelete: false })).join('') + '</div>';
      html += '</div>';
    }
  }

  // Video grid (always rendered — shows inline empty message if no videos)
  let gridHTML = '';
  if (videos.length > 0) {
    gridHTML = videos.map(v => {
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
  } else if (!searchTerm) {
    gridHTML = '<div class="empty-state" style="grid-column:1/-1;"><svg viewBox="0 0 24 24"><path d="M18,4l2,4h-3l-2-4h-2l2,4h-3l-2-4H8l2,4H7L5,4H4C2.9,4,2,4.9,2,6v12c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V4H18z"/></svg><h3>No videos yet</h3><p>Be the first to share a video!</p></div>';
  } else {
    gridHTML = '<div class="empty-state" style="grid-column:1/-1;"><h3>No results found</h3><p>Try different keywords</p></div>';
  }

  html += `<div class="video-grid">${gridHTML}</div>`;

  // Games section (always shown on main feed, not search)
  if (!searchTerm) {
    html += `
      <div class="games-section">
        <h2 class="games-title">Games</h2>
        <div class="games-grid">
          <a href="#/Games/FlappyBird" class="game-tile">
            <div class="game-tile-image">
              <img src="games/flappybird/flappybird.jpeg" alt="Flappy Bird" loading="lazy">
              <div class="game-tile-title">Flappy Bird</div>
            </div>
          </a>
        </div>
      </div>
    `;
  }

  html += '</div>';
  container.innerHTML = html;

  setupVideoCardClicks(container);
  setupPostCardActions(container);
}

/** Silent wrapper — returns [] if user not signed in or query fails */
async function getSubscribedPostsSilent() {
  try {
    return await getSubscribedPosts(10);
  } catch (e) {
    console.warn('Could not load subscribed posts:', e);
    return [];
  }
}
