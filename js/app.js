// FakeTube App - Dynamic imports to handle Firebase CDN failures gracefully

const header = document.getElementById('header');
const mainContent = document.getElementById('main-content');

// --- Route Parser (no imports needed) ---
function parseRoute() {
  const hash = window.location.hash || '#/';
  if (hash === '#/' || hash === '#' || hash === '') return { page: 'home' };
  if (hash === '#/how-to-upload') return { page: 'tutorial' };

  const watchMatch = hash.match(/^#\/watch\/(.+)$/);
  if (watchMatch) return { page: 'watch', id: watchMatch[1] };

  const channelMatch = hash.match(/^#\/channel\/(.+)$/);
  if (channelMatch) return { page: 'channel', id: channelMatch[1] };

  if (hash === '#/upload') return { page: 'upload' };

  const searchMatch = hash.match(/^#\/search\/(.+)$/);
  if (searchMatch) return { page: 'search', term: decodeURIComponent(searchMatch[1]) };

  return { page: 'home' };
}

// --- Tutorial Page (no Firebase needed) ---
function renderTutorial(container) {
  container.innerHTML = `
    <div style="max-width:720px;margin:0 auto;">
      <h1 style="font-size:24px;font-weight:700;margin-bottom:8px;color:#f1f1f1;">How to Upload Videos to FakeTube</h1>
      <p style="color:#aaa;margin-bottom:32px;">FakeTube doesn't host video files. Instead, you paste a direct link to an MP4 video. Here's the easiest way:</p>

      <div style="background:#272727;border-radius:12px;padding:24px;margin-bottom:24px;">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px;color:#f1f1f1;">
          <span style="background:#ff0000;color:white;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;">1</span>
          Upload your video to YouTube (Unlisted)
        </h2>
        <p style="color:#aaa;line-height:1.7;margin-bottom:12px;">
          Go to <a href="https://www.youtube.com/upload" target="blank" style="color:#3ea6ff;">youtube.com/upload</a> and upload your video.
          Set the visibility to <strong style="color:#f1f1f1;">Unlisted</strong> — only people with the link can see it.
        </p>
        <div style="background:#0f0f0f;border-radius:8px;padding:16px;border-left:3px solid #3ea6ff;">
          <p style="font-size:13px;color:#aaa;margin:0;">
            <strong style="color:#f1f1f1;">Why unlisted?</strong> Your video stays private on YouTube but anyone with the direct MP4 link can still access it. FakeTube uses that link to embed your video.
          </p>
        </div>
      </div>

      <div style="background:#272727;border-radius:12px;padding:24px;margin-bottom:24px;">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px;color:#f1f1f1;">
          <span style="background:#ff0000;color:white;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;">2</span>
          Get the direct MP4 link from TurboScribe
        </h2>
        <p style="color:#aaa;line-height:1.7;margin-bottom:12px;">
          Go to <a href="https://turboscribe.ai/downloader/youtube/video/free" target="_blank" style="color:#3ea6ff;">turboscribe.ai/downloader/youtube/video/free</a> and paste your YouTube video link. Click <strong style="color:#f1f1f1;">Download MP4</strong>.
        </p>
        <p style="color:#aaa;line-height:1.7;margin-bottom:12px;">
          It will take you to a page showing the raw MP4 video. <strong style="color:#f1f1f1;">Copy that page's URL from the address bar</strong> — that's your direct video link. It looks like:
        </p>
        <div style="background:#0f0f0f;border-radius:8px;padding:12px 16px;margin-bottom:12px;">
          <code style="font-size:11px;color:#3ea6ff;word-break:break-all;">https://rr---sn-...googlevideo.com/videoplayback?expire=...&itag=18&mime=video%2Fmp4</code>
        </div>
        <div style="background:rgba(255,165,0,0.08);border-radius:8px;padding:16px;border-left:3px solid #ffa500;">
          <p style="font-size:13px;color:#aaa;margin:0;">
            <strong style="color:#ffa500;">Important:</strong> These Google Video links expire after a few hours. If the link stops working, repeat steps 1-2 to get a fresh one.
          </p>
        </div>
      </div>

      <div style="background:#272727;border-radius:12px;padding:24px;margin-bottom:24px;">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px;color:#f1f1f1;">
          <span style="background:#ff0000;color:white;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;">3</span>
          Paste the link into FakeTube
        </h2>
        <p style="color:#aaa;line-height:1.7;margin-bottom:16px;">
          Go to <a href="#/upload" style="color:#3ea6ff;">FakeTube's upload page</a>, paste the MP4 link, click <strong style="color:#f1f1f1;">Preview & Generate Thumbnail</strong>, add a title, and hit <strong style="color:#f1f1f1;">Publish</strong>.
        </p>
      </div>

      <div style="background:#272727;border-radius:12px;padding:24px;margin-bottom:24px;">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px;color:#f1f1f1;">
          <span style="background:#3ea6ff;color:#0f0f0f;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;">?</span>
          What if TurboScribe doesn't work with an unlisted video?
        </h2>
        <p style="color:#aaa;line-height:1.7;">
          Upload to YouTube as <strong style="color:#f1f1f1;">Public</strong> instead. Do the TurboScribe step to get the MP4 link. Paste it into FakeTube. <strong style="color:#f1f1f1;">Then go back to YouTube and change the video to Unlisted.</strong> The MP4 link keeps working for several hours — long enough for people to watch it on FakeTube.
        </p>
      </div>

      <div style="background:#272727;border-radius:12px;padding:24px;margin-bottom:24px;">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px;color:#f1f1f1;">
          <span style="background:#3ea6ff;color:#0f0f0f;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;">?</span>
          Alternative: GitHub Releases (permanent links)
        </h2>
        <p style="color:#aaa;line-height:1.7;">
          Upload your MP4 to any GitHub repo's Releases. The download URL works as a direct video link and <strong style="color:#f1f1f1;">never expires</strong>. Go to your repo &gt; Releases &gt; New release &gt; attach .mp4 &gt; publish &gt; right-click asset &gt; copy link.
        </p>
      </div>

      <div style="text-align:center;margin-top:32px;">
        <a href="#/upload" class="btn btn-primary" style="padding:12px 32px;font-size:16px;">Share a Video</a>
      </div>
    </div>
  `;
}

// --- Error Page ---
function showError(container, title, message) {
  container.innerHTML = `
    <div class="empty-state">
      <h3>${title}</h3>
      <p style="max-width:500px;margin:0 auto 16px;">${message}</p>
      <p style="max-width:500px;margin:0 auto 16px;color:var(--text-dimmed);">Open browser console (F12) for details.</p>
      <a href="javascript:location.reload()" class="btn btn-primary">Reload</a>
      <br><br>
      <a href="#/how-to-upload" style="color:var(--accent-blue);">How to upload videos</a>
    </div>
  `;
}

// --- Bootstrap with dynamic imports ---
async function bootstrap() {
  console.log('FakeTube: loading modules...');

  // Clear initial loading state
  const initialLoading = document.getElementById('initial-loading');
  if (initialLoading) initialLoading.style.display = 'none';
  const initialError = document.getElementById('initial-error');
  if (initialError) initialError.style.display = 'none';

  // If navigating to tutorial, render it immediately (no Firebase needed)
  const route = parseRoute();
  if (route.page === 'tutorial') {
    renderTutorial(mainContent);
    // Still try to load Firebase in background for header auth state
    loadFirebaseModules().catch(e => console.warn('Firebase unavailable, tutorial still works:', e.message));
    return;
  }

  // Load all Firebase-dependent modules dynamically
  let modules;
  try {
    modules = await loadFirebaseModules();
  } catch (err) {
    console.error('FakeTube: failed to load modules:', err);
    showError(mainContent,
      'FakeTube failed to load',
      `The Firebase SDK could not be loaded. This usually means <b>gstatic.com</b> is blocked by an extension or network. Try disabling ad blockers, or open in an incognito window.<br><br>If you just set up the project, you may also need to <a href="https://console.firebase.google.com/" target="_blank" style="color:var(--accent-blue)">create the Firestore database</a> first.<br><br><span style="color:var(--text-dimmed)">Error: ${err.message || 'Unknown'}</span>`
    );
    return;
  }

  const { onAuthChange, ensureUserRecord } = modules.auth;
  const { renderHeader } = modules.components;
  const { renderHome } = modules.home;
  const { renderWatch } = modules.watch;
  const { renderChannel } = modules.channel;
  const { renderUpload } = modules.upload;

  // Navigation
  async function navigate() {
    const r = parseRoute();
    mainContent.scrollTop = 0;
    window.scrollTo(0, 0);

    try {
      switch (r.page) {
        case 'home':
          await renderHome(mainContent);
          break;
        case 'watch':
          await renderWatch(mainContent, r.id);
          break;
        case 'channel':
          await renderChannel(mainContent, r.id);
          break;
        case 'upload':
          renderUpload(mainContent);
          break;
        case 'search':
          await renderHome(mainContent, r.term);
          break;
        case 'tutorial':
          renderTutorial(mainContent);
          break;
        default:
          await renderHome(mainContent);
      }
    } catch (err) {
      console.error('Navigation error:', err);
      showError(mainContent,
        'Something went wrong',
        `${err.message || 'An unexpected error occurred.'}<br><br><a href="#/how-to-upload" style="color:var(--accent-blue);">How to upload videos</a>`
      );
    }
  }

  // Auth listener
  onAuthChange(async (user) => {
    renderHeader();
    if (user) {
      try { await ensureUserRecord(user.uid); } catch (e) { console.warn('Failed to ensure user record:', e); }
    }
  });

  renderHeader();
  window.addEventListener('hashchange', navigate);
  navigate();

  console.log('FakeTube: initialized successfully');
}

// Dynamic import loader - loads all Firebase-dependent modules
// ?v=4 cache-bust to prevent serving stale cached modules
const V = '?v=5';
async function loadFirebaseModules() {
  const [, auth, components, home, watch, channel, upload] = await Promise.all([
    import('./firebase-config.js' + V),
    import('./auth.js' + V),
    import('./components.js' + V),
    import('./home.js' + V),
    import('./watch.js' + V),
    import('./channel.js' + V),
    import('./upload.js' + V),
  ]);
  return { auth, components, home, watch, channel, upload };
}

// Start the app
bootstrap().catch(err => {
  console.error('FakeTube: bootstrap failed:', err);
  const el = document.getElementById('main-content');
  if (el) {
    el.innerHTML = '<div class="empty-state"><h3>Failed to start FakeTube</h3>' +
      '<p style="max-width:500px;margin:0 auto 16px;">' + (err.message || 'Unknown error') + '</p>' +
      '<a href="javascript:location.reload()" class="btn btn-primary">Reload</a></div>';
  }
});
