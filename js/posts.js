import { getPost, togglePostStar, isPostStarred, addPostComment, onPostCommentsChange } from './db.js';
import { getCurrentUser } from './auth.js';
import { openAuthModal, STAR_SVG, STAR_OUTLINE_SVG, COMMENT_SVG, CLOSE_SVG } from './components.js';
import { timeAgo, escapeHtml, getInitials, showToast } from './utils.js';

let unsubscribeComments = null;

/**
 * Renders a single post card (reusable in channel page and home feed).
 * Returns the HTML string — caller must attach event listeners separately.
 */
export function postCardHTML(post, options = {}) {
  const { showAuthor = true, showDelete = false } = options;
  const avatarContent = post.channelPhoto
    ? `<img src="${escapeHtml(post.channelPhoto)}" alt="">`
    : getInitials(post.channelName);

  return `
    <div class="post-card" data-post-id="${post.id}">
      ${showAuthor ? `
        <div class="post-card-header">
          <a href="#/channel/${post.channelId}" class="post-card-avatar">${avatarContent}</a>
          <div class="post-card-meta">
            <a href="#/channel/${post.channelId}" class="post-card-author">${escapeHtml(post.channelName)}</a>
            <span class="post-card-time">${timeAgo(post.createdAt)}</span>
          </div>
          ${showDelete ? `<button class="post-delete-btn" data-post-id="${post.id}" title="Delete post">${CLOSE_SVG}</button>` : ''}
        </div>
      ` : ''}
      <a href="#/post/${post.id}" class="post-card-body">
        <p class="post-card-text">${escapeHtml(post.content)}</p>
      </a>
      <div class="post-card-actions">
        <button class="post-star-btn" data-post-id="${post.id}">
          <span class="post-star-icon">${STAR_OUTLINE_SVG}</span>
          <span class="post-star-count">${post.stars || 0}</span>
          <span class="post-star-label">Star</span>
        </button>
        <a href="#/post/${post.id}" class="post-comment-btn">
          <span class="post-comment-icon">${COMMENT_SVG}</span>
          <span class="post-comment-label">Comments</span>
        </a>
      </div>
    </div>
  `;
}



/**
 * Set up star button click handlers on post cards within a container.
 */
export function setupPostCardActions(container) {
  container.addEventListener('click', async (e) => {
    const starBtn = e.target.closest('.post-star-btn');
    if (starBtn) {
      e.preventDefault();
      e.stopPropagation();
      const user = getCurrentUser();
      if (!user) { openAuthModal('login'); return; }
      // Debounce: ignore rapid re-clicks within 1 second
      if (starBtn.disabled) return;
      starBtn.disabled = true;
      setTimeout(() => { starBtn.disabled = false; }, 1000);

      const postId = starBtn.dataset.postId;
      const icon = starBtn.querySelector('.post-star-icon');
      const count = starBtn.querySelector('.post-star-count');
      const label = starBtn.querySelector('.post-star-label');

      try {
        const nowStarred = await togglePostStar(postId);
        const currentCount = parseInt(count.textContent) || 0;
        if (nowStarred) {
          icon.innerHTML = STAR_SVG;
          icon.classList.add('starred');
          label.textContent = 'Starred';
          count.textContent = currentCount + 1;
        } else {
          icon.innerHTML = STAR_OUTLINE_SVG;
          icon.classList.remove('starred');
          label.textContent = 'Star';
          count.textContent = Math.max(0, currentCount - 1);
        }
      } catch (err) {
        console.error('Star toggle error:', err);
        showToast('Could not toggle star.');
      }
    }
  });
}

/**
 * Render the full individual post page at #/post/ID
 */
export async function renderPost(container, postId) {
  if (unsubscribeComments) { unsubscribeComments(); unsubscribeComments = null; }
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  const post = await getPost(postId);
  if (!post) {
    container.innerHTML = `<div class="empty-state"><h3>Post not found</h3><p>This post may have been removed.</p><a href="#/" class="btn btn-primary">Go Home</a></div>`;
    return;
  }

  const user = getCurrentUser();
  let starred = false;
  if (user) {
    try { starred = await isPostStarred(postId); } catch {}
  }

  const avatarContent = post.channelPhoto
    ? `<img src="${escapeHtml(post.channelPhoto)}" alt="">`
    : getInitials(post.channelName);

  const isAuthor = user && user.channelId === post.channelId;

  container.innerHTML = `
    <div class="post-page" style="max-width:700px;margin:0 auto;">
      <div class="post-card post-page-card" data-post-id="${post.id}">
        <div class="post-card-header">
          <a href="#/channel/${post.channelId}" class="post-card-avatar">${avatarContent}</a>
          <div class="post-card-meta">
            <a href="#/channel/${post.channelId}" class="post-card-author">${escapeHtml(post.channelName)}</a>
            <span class="post-card-time">${timeAgo(post.createdAt)}</span>
          </div>
          ${isAuthor ? `<button class="post-delete-btn" id="post-delete-btn" data-post-id="${post.id}" title="Delete post">${CLOSE_SVG}</button>` : ''}
        </div>
        <div class="post-card-body" style="cursor:default;">
          <p class="post-card-text" style="font-size:16px;">${escapeHtml(post.content)}</p>
        </div>
        <div class="post-card-actions">
          <button class="post-star-btn ${starred ? 'active' : ''}" id="post-star-btn" data-post-id="${post.id}">
            <span class="post-star-icon ${starred ? 'starred' : ''}">${starred ? STAR_SVG : STAR_OUTLINE_SVG}</span>
            <span class="post-star-count">${post.stars || 0}</span>
            <span class="post-star-label">${starred ? 'Starred' : 'Star'}</span>
          </button>
        </div>
      </div>

      <div class="comments-section" style="margin-top:24px;">
        <div class="comments-header">
          <span class="comments-count" id="post-comments-count">0 Comments</span>
        </div>
        <div id="post-comment-input-area"></div>
        <div id="post-comments-list"></div>
      </div>
    </div>
  `;

  // Star button
  const starBtn = document.getElementById('post-star-btn');
  if (starBtn) {
    starBtn.addEventListener('click', async () => {
      if (!user) { openAuthModal('login'); return; }
      // Debounce: ignore rapid re-clicks within 1 second
      if (starBtn.disabled) return;
      starBtn.disabled = true;
      setTimeout(() => { starBtn.disabled = false; }, 1000);

      const icon = starBtn.querySelector('.post-star-icon');
      const count = starBtn.querySelector('.post-star-count');
      const label = starBtn.querySelector('.post-star-label');
      try {
        const nowStarred = await togglePostStar(postId);
        const currentCount = parseInt(count.textContent) || 0;
        if (nowStarred) {
          icon.innerHTML = STAR_SVG;
          icon.classList.add('starred');
          label.textContent = 'Starred';
          starBtn.classList.add('active');
          count.textContent = currentCount + 1;
        } else {
          icon.innerHTML = STAR_OUTLINE_SVG;
          icon.classList.remove('starred');
          label.textContent = 'Star';
          starBtn.classList.remove('active');
          count.textContent = Math.max(0, currentCount - 1);
        }
      } catch (err) {
        console.error('Star toggle error:', err);
        showToast('Could not toggle star.');
      }
    });
  }

  // Delete button
  const deleteBtn = document.getElementById('post-delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!isAuthor) return;
      if (!confirm('Delete this post? This cannot be undone.')) return;
      try {
        const { deletePost } = await import('./db.js');
        await deletePost(postId);
        showToast('Post deleted');
        window.location.hash = `#/channel/${user.channelId || user.uid}`;
      } catch (err) {
        console.error('Delete post error:', err);
        showToast('Could not delete post.');
      }
    });
  }

  // Comment input
  renderPostCommentInput(user);
  // Load comments
  unsubscribeComments = loadPostComments(postId);
}

function renderPostCommentInput(user) {
  const area = document.getElementById('post-comment-input-area');
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
        <input type="text" class="comment-input" id="post-comment-input" placeholder="Add a comment..." maxlength="1000">
        <div class="comment-input-actions hidden" id="post-comment-actions">
          <button class="comment-cancel-btn" id="post-comment-cancel">Cancel</button>
          <button class="comment-submit-btn" id="post-comment-submit" disabled>Comment</button>
        </div>
      </div>
    </div>
  `;
  const input = document.getElementById('post-comment-input');
  const actions = document.getElementById('post-comment-actions');
  const submitBtn = document.getElementById('post-comment-submit');
  input.addEventListener('focus', () => actions.classList.remove('hidden'));
  document.getElementById('post-comment-cancel').addEventListener('click', () => {
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
    if (!rateLimit('add_post_comment', 10, 60000)) {
      showToast('Slow down! You can comment up to 10 times per minute.');
      return;
    }
    submitBtn.disabled = true;
    const hash = window.location.hash;
    const postId = hash.replace('#/post/', '');
    await addPostComment(postId, text, user);
    input.value = ''; actions.classList.add('hidden');
  });
}

function loadPostComments(postId) {
  return onPostCommentsChange(postId, (comments) => {
    document.getElementById('post-comments-count').textContent = `${comments.length} Comment${comments.length !== 1 ? 's' : ''}`;
    const list = document.getElementById('post-comments-list');
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
