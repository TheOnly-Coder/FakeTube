// FakeTube App - Dynamic imports to handle Firebase CDN failures gracefully

const header = document.getElementById('header');
const mainContent = document.getElementById('main-content');

// --- Route Parser (no imports needed) ---
function parseRoute() {
  const hash = window.location.hash || '#/';
  if (hash === '#/' || hash === '#' || hash === '') return { page: 'home' };
  if (hash === '#/how-to-upload') return { page: 'tutorial' };

  const postMatch = hash.match(/^#\/post\/(.+)$/);
  if (postMatch) return { page: 'post', id: postMatch[1] };

  const watchMatch = hash.match(/^#\/watch\/(.+)$/);
  if (watchMatch) return { page: 'watch', id: watchMatch[1] };

  const channelMatch = hash.match(/^#\/channel\/(.+)$/);
  if (channelMatch) return { page: 'channel', id: channelMatch[1] };

  if (hash === '#/upload') return { page: 'upload' };

  if (hash === '#/Games') return { page: 'games-hub' };

  const gameMatch = hash.match(/^#\/Games\/(.+)$/);
  if (gameMatch) return { page: 'game', id: gameMatch[1] };

  const searchMatch = hash.match(/^#\/search\/channels\/(.+)$/);
  if (searchMatch) return { page: 'search-channels', term: decodeURIComponent(searchMatch[1]) };

  const searchVideoMatch = hash.match(/^#\/search\/(.+)$/);
  if (searchVideoMatch) return { page: 'search', term: decodeURIComponent(searchVideoMatch[1]) };

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
          Go to <a href="https://www.youtube.com/upload" target="_blank" rel="noopener noreferrer" style="color:#3ea6ff;">youtube.com/upload</a> and upload your video.
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
          Go to <a href="https://turboscribe.ai/downloader/youtube/video/free" target="_blank" rel="noopener noreferrer" style="color:#3ea6ff;">turboscribe.ai/downloader/youtube/video/free</a> and paste your YouTube video link. Click <strong style="color:#f1f1f1;">Download MP4</strong>.
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

// --- Games Hub (no Firebase needed) ---
const GAMES_LIST = [
  {
    id: 'flappybird',
    title: 'Flappy Bird',
    description: 'The classic side-scrolling game. Tap to flap through pipes!',
    tileImage: 'games/flappybird/flappybird.jpeg',
  },
  {
    id: 'particleclicker',
    title: 'Particle Clicker',
    description: 'An addictive incremental game about particle physics research.',
    tileImage: 'games/particleclicker/tile.jpg',
  },
];

function renderGamesHub(container) {
  const cards = GAMES_LIST.map(g => `
    <a href="#/Games/${g.id}" class="game-tile-card" style="text-decoration:none;">
      <div class="game-tile-img">
        <img src="${g.tileImage}" alt="${g.title}" loading="lazy">
      </div>
      <div class="game-tile-info">
        <h3>${g.title}</h3>
        <p>${g.description}</p>
      </div>
    </a>
  `).join('');

  container.innerHTML = `
    <div style="max-width:900px;margin:0 auto;padding:24px 16px;">
      <h1 style="font-size:24px;font-weight:700;margin-bottom:8px;color:#f1f1f1;">Games</h1>
      <p style="color:#aaa;margin-bottom:24px;">Take a break and play something fun.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;">
        ${cards}
      </div>
    </div>
  `;
}

// --- Game Pages (no Firebase needed) ---
async function renderGamePage(container, gameId) {
  const gameKey = gameId.toLowerCase();
  if (gameKey === 'flappybird') {
    const { renderFlappyBird } = await import('./games/flappybird.js');
    renderFlappyBird(container);
  } else if (gameKey === 'particleclicker') {
    const { renderParticleClicker } = await import('./games/particleclicker.js');
    renderParticleClicker(container);
  } else {
    const escapeHtml = await getEscapeHtml();
    container.innerHTML = `
      <div style="max-width:700px;margin:0 auto;text-align:center;">
        <h1 style="font-size:24px;font-weight:700;margin-bottom:16px;color:#f1f1f1;">${escapeHtml(gameId.replace(/-/g, ' '))}</h1>
        <p style="color:#aaa;margin-bottom:32px;">This game hasn't been implemented yet. Check back later!</p>
        <a href="#/Games" class="btn btn-primary">Back to Games</a>
      </div>
    `;
  }
}

// --- Error Page ---
// Import escapeHtml lazily to avoid circular deps at module top-level
async function getEscapeHtml() {
  const mod = await import('./utils.js');
  return mod.escapeHtml;
}

async function showError(container, title, message) {
  const escapeHtml = await getEscapeHtml();
  container.innerHTML = `
    <div class="empty-state">
      <h3>${escapeHtml(title)}</h3>
      <p style="max-width:500px;margin:0 auto 16px;">${escapeHtml(message)}</p>
      <p style="max-width:500px;margin:0 auto 16px;color:var(--text-dimmed);">Open browser console (F12) for details.</p>
      <button onclick="location.reload()" class="btn btn-primary">Reload</button>
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

  // Game hub and game pages don't need Firebase either
  if (route.page === 'games-hub') {
    renderGamesHub(mainContent);
    loadFirebaseModules().catch(e => console.warn('Firebase unavailable, games hub still works:', e.message));
    return;
  }
  if (route.page === 'game') {
    renderGamePage(mainContent, route.id);
    loadFirebaseModules().catch(e => console.warn('Firebase unavailable, game still works:', e.message));
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
      `The Firebase SDK could not be loaded. This usually means gstatic.com is blocked by an extension or network. Try disabling ad blockers, or open in an incognito window. If you just set up the project, you may also need to create the Firestore database first. Error: ${err.message || 'Unknown'}`
    );
    return;
  }

  const { onAuthChange, ensureUserRecord } = modules.auth;
  const { renderHeader } = modules.components;
  const { renderHome } = modules.home;
  const { renderWatch } = modules.watch;
  const { renderChannel, renderChannelSearch } = modules.channel;
  const { renderPost } = modules.posts;
  const { renderUpload } = modules.upload;
  const { waitForAppCheck } = modules.firebaseConfig;

  // Wait for App Check token before any Firestore calls.
  // On iOS Safari, reCAPTCHA v3 initialization can be slow due to
  // ITP and network latency. Without waiting, Firestore queries fire
  // before the App Check token is ready and get rejected.
  // We still proceed even if it fails — the token may arrive later.
  const appCheckOk = await waitForAppCheck({ attempts: 4, delay: 2000 });
  if (!appCheckOk) {
    console.warn('App Check token not obtained yet — proceeding anyway. If data fails to load, try reloading the page.');
  }

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
        case 'post':
          await renderPost(mainContent, r.id);
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
        case 'search-channels':
          await renderChannelSearch(mainContent, r.term);
          break;
        case 'games-hub':
          renderGamesHub(mainContent);
          break;
        case 'game':
          await renderGamePage(mainContent, r.id);
          break;
        default:
          await renderHome(mainContent);
      }
    } catch (err) {
      console.error('Navigation error:', err);
      showError(mainContent,
        'Something went wrong',
        `${err.message || 'An unexpected error occurred.'} See the tutorial page for upload instructions.`
      );
    }
  }

  // Auth listener
  onAuthChange(async (user) => {
    if (user) {
      try { await ensureUserRecord(user.uid); } catch (e) { console.warn('Failed to ensure user record:', e); }
    }
    renderHeader();
  });

  renderHeader();
  window.addEventListener('hashchange', navigate);
  navigate();

  console.log('FakeTube: initialized successfully');
}

// Dynamic import loader - loads all Firebase-dependent modules
// No ?v= on imports to avoid module instance split with static imports
async function loadFirebaseModules() {
  const [firebaseConfig, auth, components, home, watch, channel, posts, upload] = await Promise.all([
    import('./firebase-config.js'),
    import('./auth.js'),
    import('./components.js'),
    import('./home.js'),
    import('./watch.js'),
    import('./channel.js'),
    import('./posts.js'),
    import('./upload.js'),
  ]);
  return { firebaseConfig, auth, components, home, watch, channel, posts, upload };
}

// Start the app
bootstrap().catch(err => {
  console.error('FakeTube: bootstrap failed:', err);
  const el = document.getElementById('main-content');
  if (el) {
    const safeMsg = (err.message || 'Unknown error').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    el.innerHTML = '<div class="empty-state"><h3>Failed to start FakeTube</h3>' +
      '<p style="max-width:500px;margin:0 auto 16px;">' + safeMsg + '</p>' +
      '<button onclick="location.reload()" class="btn btn-primary">Reload</button></div>';
  }
});
