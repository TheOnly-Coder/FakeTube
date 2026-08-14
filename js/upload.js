import { getCurrentUser, ensureUserRecord } from './auth.js';
import { openAuthModal } from './components.js';
import { createVideo } from './db.js';
import { generateThumbnailFromUrl, getVideoDurationFromUrl, showToast, validateVideoUrl, rateLimit } from './utils.js';

export function renderUpload(container) {
  const user = getCurrentUser();
  if (!user) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Sign in to upload</h3>
        <p>You need an account to share videos.</p>
        <button class="btn btn-primary" id="upload-signin-btn">Sign in</button>
      </div>
    `;
    document.getElementById('upload-signin-btn').addEventListener('click', () => openAuthModal('login'));
    return;
  }

  container.innerHTML = `
    <div class="upload-page">
      <h1>Share a Video</h1>
      <p style="color:var(--text-secondary);font-size:14px;margin-bottom:8px;">
        Paste a direct link to an MP4 video file.
      </p>
      <p style="margin-bottom:24px;">
        <a href="#/how-to-upload" style="color:var(--accent-blue);font-size:14px;font-weight:500;">Not sure how? Follow the step-by-step guide →</a>
      </p>
      <div class="upload-form" id="upload-form">
        <div class="upload-url-section">
          <label style="font-size:14px;font-weight:500;margin-bottom:6px;display:block;">Video URL <span style="color:var(--accent-red)">*</span></label>
          <input type="url" id="video-url" placeholder="https://example.com/my-video.mp4" style="width:100%;font-size:14px;">
          <button class="btn btn-outline" id="preview-btn" style="margin-top:8px;">Preview & Generate Thumbnail</button>
          <p id="url-error" style="color:var(--accent-red);font-size:13px;margin-top:4px;display:none;"></p>
        </div>
        <div id="preview-area" class="hidden">
          <div class="upload-preview">
            <div class="upload-thumbnail-preview" id="thumb-preview">
              <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dimmed);font-size:13px;">No thumbnail</div>
            </div>
            <div class="upload-fields">
              <input type="text" id="video-title" placeholder="Title (required)" maxlength="100">
              <textarea id="video-desc" placeholder="Tell viewers about your video (optional)" maxlength="5000" rows="4"></textarea>
              <input type="text" id="video-tags" placeholder="Tags (comma-separated, e.g. gaming, tutorial, funny)" maxlength="300" style="font-size:14px;">
              <p style="font-size:12px;color:var(--text-dimmed);margin:-8px 0 0;">Tags help the recommendation algorithm suggest your video to the right viewers.</p>
            </div>
          </div>
          <div class="upload-actions">
            <button class="btn" id="upload-cancel-btn">Cancel</button>
            <button class="btn btn-primary" id="upload-submit-btn" disabled>Publish</button>
          </div>
        </div>
      </div>
    </div>
  `;

  let thumbnailDataUrl = '';
  let videoDuration = '';

  const urlInput = document.getElementById('video-url');
  const previewBtn = document.getElementById('preview-btn');
  const previewArea = document.getElementById('preview-area');
  const titleInput = document.getElementById('video-title');
  const submitBtn = document.getElementById('upload-submit-btn');
  const thumbPreview = document.getElementById('thumb-preview');
  const urlError = document.getElementById('url-error');

  previewBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
      showUrlError('Please enter a video URL.');
      return;
    }
    // Validate URL scheme — only http/https allowed
    if (!validateVideoUrl(url)) {
      showUrlError('Invalid URL scheme. Video URL must start with https:// or http://.');
      return;
    }

    previewBtn.disabled = true;
    previewBtn.textContent = 'Loading...';
    urlError.style.display = 'none';

    try {
      // Test if the URL works as a video
      const canPlay = await testVideoUrl(url);
      if (!canPlay) {
        showUrlError('Could not load video. Make sure it\'s a direct link to an MP4, WebM, or OGG file. For Google Drive, use the direct download link.');
        previewBtn.disabled = false;
        previewBtn.textContent = 'Preview & Generate Thumbnail';
        return;
      }

      // Try generating thumbnail
      const thumb = await generateThumbnailFromUrl(url);
      if (thumb) {
        thumbnailDataUrl = thumb;
        thumbPreview.innerHTML = `<img src="${thumb}" alt="Thumbnail">`;
      } else {
        thumbnailDataUrl = '';
        thumbPreview.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dimmed);font-size:13px;">Could not generate thumbnail (CORS). Video will still work.</div>';
      }

      // Get duration
      videoDuration = await getVideoDurationFromUrl(url);

      // Auto-fill title from URL filename
      if (!titleInput.value.trim()) {
        try {
          const urlObj = new URL(url);
          const filename = decodeURIComponent(urlObj.pathname.split('/').pop().replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
          if (filename && filename.length > 2) titleInput.value = filename;
        } catch {}
      }

      previewArea.classList.remove('hidden');
      checkSubmit();
    } catch (err) {
      showUrlError('Error loading video: ' + (err.message || 'Unknown error'));
    }

    previewBtn.disabled = false;
    previewBtn.textContent = 'Preview & Generate Thumbnail';
  });

  function showUrlError(msg) {
    urlError.textContent = msg;
    urlError.style.display = 'block';
  }

  titleInput.addEventListener('input', checkSubmit);

  function checkSubmit() {
    submitBtn.disabled = !titleInput.value.trim();
  }

  document.getElementById('upload-cancel-btn').addEventListener('click', () => {
    previewArea.classList.add('hidden');
    urlInput.value = '';
    titleInput.value = '';
    document.getElementById('video-desc').value = '';
    document.getElementById('video-tags').value = '';
    thumbnailDataUrl = '';
    videoDuration = '';
    submitBtn.disabled = true;
  });

  submitBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    const title = titleInput.value.trim();
    if (!url || !title) return;
    // Final validation before publishing
    if (!validateVideoUrl(url)) {
      showToast('Invalid video URL. Must use https:// or http://.');
      return;
    }
    // Rate limit uploads: 3 per minute
    if (!rateLimit('upload_video', 3, 60000)) {
      showToast('Slow down! You can upload up to 3 videos per minute.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Publishing...';

    try {
      await ensureUserRecord(user.uid);

      const tagsRaw = document.getElementById('video-tags').value.trim();
      const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];

      const videoId = await createVideo({
        title,
        description: document.getElementById('video-desc').value.trim(),
        tags,
        // Firestore rule requires uploaderId == auth.uid exactly.
        // Use uid, not channelId (which may differ after migration).
        uploaderId: user.uid,
        uploaderName: user.displayName,
        uploaderPhoto: user.photoURL || '',
        videoUrl: url,
        thumbnailUrl: thumbnailDataUrl,
        duration: videoDuration
      });

      showToast('Video published!');
      window.location.hash = `#/watch/${videoId}`;
    } catch (err) {
      console.error('Publish error:', err);
      showToast('Failed to publish. Check Firestore rules.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Publish';
    }
  });
}

function testVideoUrl(url) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    // Do NOT set crossOrigin='anonymous' here. Many video hosts (GitHub
    // Releases, Google Drive, etc.) don't send CORS headers. The video
    // will still play fine in a <video> tag — we only need CORS for
    // canvas thumbnail extraction, which is handled separately.
    video.preload = 'metadata';
    const timer = setTimeout(() => {
      video.removeAttribute('src');
      video.load();
      // Timeout doesn't mean failure — large files or slow hosts may
      // just need more time. The video can still play once loaded on
      // the watch page.
      resolve(true);
    }, 8000);
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      resolve(true);
    };
    video.onerror = () => {
      clearTimeout(timer);
      // Distinguish network errors (real failure) from CORS blocks
      // (which still mean the video URL is valid and playable).
      // If the error code is not MEDIA_ERR_SRC_NOT_SUPPORTED, the URL
      // is probably fine but CORS blocked metadata access.
      const isNetworkError = video.error && video.error.code === MediaError.MEDIA_ERR_NETWORK;
      const isDecodeError = video.error && video.error.code === MediaError.MEDIA_ERR_DECODE;
      if (isNetworkError) {
        resolve(false);
      } else {
        // SRC_NOT_SUPPORTED or no error code — likely CORS or format
        // issue. Be optimistic: the video may still play on the watch page
        // where crossOrigin is not set.
        resolve(true);
      }
    };
    video.src = url;
  });
}