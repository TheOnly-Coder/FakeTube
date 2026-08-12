import { getCurrentUser, openAuthModal, ensureUserRecord } from './auth.js';
import { createVideo } from './db.js';
import { uploadVideo, uploadThumbnail } from './storage.js';
import { generateThumbnail, getVideoDuration, showToast, generateId } from './utils.js';

export function renderUpload(container) {
  const user = getCurrentUser();
  if (!user) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Sign in to upload</h3>
        <p>You need an account to upload videos.</p>
        <button class="btn btn-primary" id="upload-signin-btn">Sign in</button>
      </div>
    `;
    document.getElementById('upload-signin-btn').addEventListener('click', () => openAuthModal('login'));
    return;
  }

  container.innerHTML = `
    <div class="upload-page">
      <h1>Upload Video</h1>
      <div class="upload-dropzone" id="upload-dropzone">
        <svg viewBox="0 0 24 24"><path d="M9,16h6v-6h4l-7-7l-7,7h4V16z M5,18h14v2H5V18z"/></svg>
        <p>Drag and drop video files to upload</p>
        <span>Your videos will be private until you publish them.</span>
      </div>
      <input type="file" id="file-input" accept="video/*" class="hidden">
      <div class="upload-form hidden" id="upload-form">
        <div class="upload-preview">
          <div class="upload-thumbnail-preview" id="thumb-preview"></div>
          <div class="upload-fields">
            <input type="text" id="video-title" placeholder="Title (required)" maxlength="100">
            <textarea id="video-desc" placeholder="Tell viewers about your video (optional)" maxlength="5000" rows="4"></textarea>
            <div class="upload-progress-container hidden" id="progress-container">
              <div class="upload-progress-bar"><div class="upload-progress-fill" id="progress-fill"></div></div>
              <div class="upload-progress-text" id="progress-text">Uploading... 0%</div>
            </div>
          </div>
        </div>
        <div class="upload-actions">
          <button class="btn" id="upload-cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="upload-submit-btn" disabled>Upload</button>
        </div>
      </div>
    </div>
  `;

  let selectedFile = null;
  let thumbnailBlob = null;

  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('file-input');
  const uploadForm = document.getElementById('upload-form');
  const thumbPreview = document.getElementById('thumb-preview');
  const titleInput = document.getElementById('video-title');
  const submitBtn = document.getElementById('upload-submit-btn');
  const progressContainer = document.getElementById('progress-container');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) handleFile(file);
    else showToast('Please select a video file.');
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  async function handleFile(file) {
    selectedFile = file;
    // Show preview
    const url = URL.createObjectURL(file);
    thumbPreview.innerHTML = `<video src="${url}" muted playsinline></video>`;
    
    // Generate thumbnail
    thumbnailBlob = await generateThumbnail(file);
    if (thumbnailBlob) {
      const thumbUrl = URL.createObjectURL(thumbnailBlob);
      thumbPreview.innerHTML = `<img src="${thumbUrl}" alt="Preview">`;
    }

    // Get duration
    const duration = await getVideoDuration(file);
    if (!titleInput.value) {
      const name = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      titleInput.value = name;
    }
    submitBtn.disabled = false;
    uploadForm.classList.remove('hidden');
    dropzone.classList.add('hidden');
  }

  titleInput.addEventListener('input', () => {
    submitBtn.disabled = !titleInput.value.trim();
  });

  document.getElementById('upload-cancel-btn').addEventListener('click', () => {
    resetForm();
  });

  function resetForm() {
    selectedFile = null;
    thumbnailBlob = null;
    titleInput.value = '';
    document.getElementById('video-desc').value = '';
    uploadForm.classList.add('hidden');
    dropzone.classList.remove('hidden');
    progressContainer.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Upload';
    fileInput.value = '';
  }

  submitBtn.addEventListener('click', async () => {
    if (!selectedFile || !titleInput.value.trim()) return;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';
    progressContainer.classList.remove('hidden');

    try {
      // Ensure user record exists
      await ensureUserRecord(user.uid);

      // Upload video file
      const videoUrl = await uploadVideo(selectedFile, (pct) => {
        progressFill.style.width = `${pct * 0.7}%`;
        progressText.textContent = `Uploading video... ${pct}%`;
      });

      // Upload thumbnail
      let thumbnailUrl = '';
      if (thumbnailBlob) {
        thumbnailUrl = await uploadThumbnail(thumbnailBlob, (pct) => {
          progressFill.style.width = `${70 + pct * 0.3}%`;
          progressText.textContent = `Uploading thumbnail... ${pct}%`;
        });
      }

      progressFill.style.width = '100%';
      progressText.textContent = 'Saving...';

      // Save video metadata
      const videoId = await createVideo({
        title: titleInput.value.trim(),
        description: document.getElementById('video-desc').value.trim(),
        uploaderId: user.uid,
        uploaderName: user.displayName,
        uploaderPhoto: user.photoURL || '',
        videoUrl,
        thumbnailUrl,
        duration: await getVideoDuration(selectedFile)
      });

      showToast('Video uploaded successfully!');
      window.location.hash = `#/watch/${videoId}`;
    } catch (err) {
      console.error('Upload error:', err);
      showToast('Upload failed. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Upload';
      progressContainer.classList.add('hidden');
    }
  });
}
