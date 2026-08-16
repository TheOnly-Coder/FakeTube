import { getCurrentUser, ensureUserRecord } from './auth.js';
import { openAuthModal } from './components.js';
import { createVideo, getUser } from './db.js';
import { generateThumbnailFromUrl, getVideoDurationFromUrl, showToast, validateVideoUrl, rateLimit, isYouTubeUrl, getYouTubeId, getYouTubeThumbnailUrl } from './utils.js';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase-config.js';

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
        <div class="upload-url-section" style="margin-top:16px;">
          <label style="font-size:14px;font-weight:500;margin-bottom:6px;display:block;">Custom Thumbnail URL <span style="color:var(--text-dimmed);font-weight:400;">(optional)</span></label>
          <input type="url" id="custom-thumb-url" placeholder="https://example.com/thumbnail.jpg" style="width:100%;font-size:14px;">
          <button class="btn btn-outline" id="load-thumb-btn" style="margin-top:8px;">Load Custom Thumbnail</button>
          <p id="thumb-error" style="color:var(--accent-red);font-size:13px;margin-top:4px;display:none;"></p>
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
  const customThumbInput = document.getElementById('custom-thumb-url');
  const loadThumbBtn = document.getElementById('load-thumb-btn');
  const thumbError = document.getElementById('thumb-error');

  // Custom thumbnail URL loader
  function showThumbError(msg) {
    thumbError.textContent = msg;
    thumbError.style.display = 'block';
  }

  loadThumbBtn.addEventListener('click', async () => {
    const imgUrl = customThumbInput.value.trim();
    if (!imgUrl) {
      showThumbError('Please enter an image URL.');
      return;
    }
    try { new URL(imgUrl); } catch { showThumbError('Invalid URL.'); return; }

    loadThumbBtn.disabled = true;
    loadThumbBtn.textContent = 'Loading...';
    thumbError.style.display = 'none';

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = 640; c.height = 360;
          const ctx = c.getContext('2d');
          try {
            ctx.drawImage(img, 0, 0, 640, 360);
            const du = c.toDataURL('image/jpeg', 0.7);
            resolve(du.length > 100 ? du : null);
          } catch {
            // CORS blocked — store the raw URL as-is
            resolve(null);
          }
        };
        img.onerror = () => reject(new Error('Could not load image.'));
        img.src = imgUrl;
      });

      if (dataUrl) {
        thumbnailDataUrl = dataUrl;
        thumbPreview.innerHTML = `<img src="${dataUrl}" alt="Thumbnail">`;
      } else {
        // CORS blocked canvas — store raw URL directly
        thumbnailDataUrl = imgUrl;
        thumbPreview.innerHTML = `<img src="${imgUrl}" alt="Thumbnail" onerror="this.parentElement.innerHTML='<div style=\'display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dimmed);font-size:13px;\'>Failed to load image.</div>'">`;
      }
      previewArea.classList.remove('hidden');
      checkSubmit();
    } catch (err) {
      showThumbError(err.message || 'Failed to load thumbnail image.');
    }

    loadThumbBtn.disabled = false;
    loadThumbBtn.textContent = 'Load Custom Thumbnail';
  });

  previewBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
      showUrlError('Please enter a video URL.');
      return;
    }
    if (!validateVideoUrl(url)) {
      showUrlError('Invalid URL scheme. Video URL must start with https:// or http://.');
      return;
    }

    // Warn about share page URLs that return HTML, not video files
    if (/jottacloud\.com\/s\//i.test(url)) {
      showUrlError('That\'s a Jottacloud share page, not a direct file link. Right-click the download button on the share page and copy that link instead.');
      return;
    }
    if (/drive\.google\.com\/file/i.test(url) && !/download/i.test(url)) {
      showUrlError('Google Drive share links don\'t work directly. Use "File > Share > Copy link" and append ?download=1 or use a direct download link.');
      return;
    }

    // YouTube URLs get special handling
    if (isYouTubeUrl(url)) {
      const ytId = getYouTubeId(url);
      previewBtn.disabled = true;
      previewBtn.textContent = 'Loading...';
      urlError.style.display = 'none';

      try {
        // Fetch YouTube thumbnail (no CORS issues with img.youtube.com)
        const thumbUrl = getYouTubeThumbnailUrl(ytId);
        const thumbOk = await new Promise(resolve => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = thumbUrl;
        });

        if (thumbOk) {
          // Draw to canvas to get a data URL we can store in Firestore
          const canvas = document.createElement('canvas');
          canvas.width = 640; canvas.height = 360;
          const ctx = canvas.getContext('2d');
          await new Promise(resolve => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => { ctx.drawImage(img, 0, 0, 640, 360); resolve(); };
            img.onerror = resolve;
            img.src = thumbUrl;
          });
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          if (dataUrl.length > 100) {
            thumbnailDataUrl = dataUrl;
            thumbPreview.innerHTML = `<img src="${dataUrl}" alt="Thumbnail">`;
          } else {
            thumbnailDataUrl = '';
            thumbPreview.innerHTML = `<img src="${thumbUrl}" alt="Thumbnail" onerror="this.parentElement.innerHTML='<div style=\'display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dimmed);font-size:13px;\'>Could not load YouTube thumbnail.</div>'">`;
          }
        } else {
          thumbnailDataUrl = '';
          thumbPreview.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dimmed);font-size:13px;">Could not load YouTube thumbnail.</div>';
        }

        videoDuration = '';
        previewArea.classList.remove('hidden');
        checkSubmit();
      } catch (err) {
        showUrlError('Error loading YouTube video: ' + (err.message || 'Unknown error'));
      }

      previewBtn.disabled = false;
      previewBtn.textContent = 'Preview & Generate Thumbnail';
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
    customThumbInput.value = '';
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

      // Fetch the channel's current profile from Firestore to get the
      // latest photoURL (may differ from auth profile if edited in-app).
      let channelPhoto = user.photoURL || '';
      try {
        const channelUser = await getUser(user.channelId || user.uid);
        if (channelUser && channelUser.photoURL) {
          channelPhoto = channelUser.photoURL;
        }
      } catch {}

      const tagsRaw = document.getElementById('video-tags').value.trim();
      const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];

      const videoId = await createVideo({
        title,
        description: document.getElementById('video-desc').value.trim(),
        tags,
        // uploaderId = channel ID (for grouping on channel pages)
        // uploaderUid = auth UID (for Firestore security rule)
        uploaderId: user.channelId || user.uid,
        uploaderUid: user.uid,
        uploaderName: user.displayName,
        uploaderPhoto: channelPhoto,
        videoUrl: url,
        thumbnailUrl: thumbnailDataUrl,
        duration: videoDuration
      });

      // Stamp lastUploadAt on user doc for server-side rate limiting.
      // The Firestore rule checks this against request.time (server clock)
      // so scripts cannot bypass the 30s cooldown.
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          lastUploadAt: serverTimestamp()
        });
      } catch (e) {
        console.warn('Failed to stamp lastUploadAt:', e);
      }

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