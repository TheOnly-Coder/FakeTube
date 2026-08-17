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

      <div style="background:#272727;border-radius:12px;padding:24px;margin-bottom:24px;">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px;color:#f1f1f1;">
          <span style="background:#3ea6ff;color:#0f0f0f;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;">?</span>
          Alternative: Catbox (easy, no account needed)
        </h2>
        <p style="color:#aaa;line-height:1.7;margin-bottom:12px;">
          Go to <a href="https://catbox.moe/" target="_blank" rel="noopener noreferrer" style="color:#3ea6ff;">catbox.moe</a>, upload your MP4, and copy the direct link it gives you (ends in .mp4). Paste it straight into FakeTube. No account required, links are permanent.
        </p>
        <div style="background:#0f0f0f;border-radius:8px;padding:16px;border-left:3px solid #3ea6ff;">
          <p style="font-size:13px;color:#aaa;margin:0;">
            <strong style="color:#f1f1f1;">Tip:</strong> For temporary uploads (1h, 12h, 24h, 72h), use <a href="https://litterbox.catbox.moe/" target="_blank" rel="noopener noreferrer" style="color:#3ea6ff;">litterbox.catbox.moe</a> instead. The links expire after the time you choose.
          </p>
        </div>
      </div>

      <div style="text-align:center;margin-top:32px;">
        <a href="#/upload" class="btn btn-primary" style="padding:12px 32px;font-size:16px;">Share a Video</a>
      </div>
    </div>
  `;
}

// --- Games Hub (no Firebase needed) ---
// Category order controls the section order on the hub page
const GAME_CATEGORIES = [
  { id: 'local',    label: 'Built-in Games',    color: '#f60' },
  { id: 'strategy', label: 'Strategy',           color: '#3ea6ff' },
  { id: 'simulation', label: 'City Builders',     color: '#2ecc71' },
  { id: 'puzzle',   label: 'Puzzle',             color: '#f1c40f' },
  { id: 'platformer', label: 'Platformers',       color: '#e74c3c' },
  { id: 'action',   label: 'Action & Arcade',    color: '#e056fd' },
  { id: 'racing',   label: 'Racing',             color: '#00cec9' },
];

const GAMES_LIST = [
  // ── Built-in (local canvas games) ──
  {
    id: 'flappybird',
    title: 'Flappy Bird',
    description: 'The classic side-scrolling game. Tap to flap through pipes!',
    tileImage: 'games/flappybird/flappybird.jpeg',
    category: 'local',
    type: 'local',
  },
  {
    id: 'particleclicker',
    title: 'Particle Clicker',
    description: 'An addictive incremental game about particle physics research.',
    tileImage: 'games/particleclicker/tile.jpg',
    category: 'local',
    type: 'local',
  },

  // ── Strategy ──
  {
    id: 'ancient-beast',
    title: 'Ancient Beast',
    description: 'Turn-based strategy with creatures that evolve and fight. Play online against others.',
    category: 'strategy',
    type: 'external',
    url: 'https://play.ancientbeast.com/',
    source: 'https://github.com/FreezingMoon/AncientBeast',
    tileColor: '#1a3a2a',
    tileIcon: '🐉',
  },
  {
    id: 'zero-k',
    title: 'Zero-K',
    description: 'Massive RTS battles with hundreds of units. Free, open-source, and runs in your browser.',
    category: 'strategy',
    type: 'external',
    url: 'https://zero-k.info/',
    source: 'https://github.com/ZeroK-RTS/Zero-K',
    tileColor: '#0d1f0d',
    tileIcon: '⚔️',
  },
  {
    id: 'mindustry',
    title: 'Mindustry',
    description: 'Factory automation meets tower defense. Build production chains and defend your base.',
    category: 'strategy',
    type: 'external',
    url: 'https://mindustrygame.github.io/',
    itchEmbedId: '140169',
    source: 'https://github.com/Anuken/Mindustry',
    tileColor: '#1a1a2e',
    tileIcon: '🏭',
  },

  // ── City Builders & Simulation ──
  {
    id: 'isocity',
    title: 'IsoCity',
    description: 'Isometric city builder right in your browser. Place zones and watch your metropolis grow.',
    category: 'simulation',
    type: 'external',
    url: 'https://iso-city.com/',
    source: 'https://github.com/amilich/isometric-city',
    tileColor: '#0a2540',
    tileIcon: '🏙️',
  },
  {
    id: 'micropolisjs',
    title: 'micropolisJS',
    description: 'The classic SimCity experience rebuilt entirely in JavaScript. Manage zones, power, and traffic.',
    category: 'simulation',
    type: 'external',
    url: 'https://www.graememcc.co.uk/micropolisJS/',
    source: 'https://github.com/graememcc/micropolisJS',
    tileColor: '#0f2b0f',
    tileIcon: '🏘️',
  },

  // ── Puzzle ──
  {
    id: 'whatajong',
    title: 'Whatajong',
    description: 'A relaxing Mahjong solitaire game. Match tiles to clear the board.',
    category: 'puzzle',
    type: 'external',
    url: 'https://vitellus.itch.io/whatajong',
    source: 'https://github.com/nicholasgasior/whatajong',
    tileColor: '#2d1f0e',
    tileIcon: '🀄',
  },

  // ── Platformers ──
  {
    id: 'vvvvvv',
    title: 'VVVVVV',
    description: 'Flip gravity to navigate through treacherous rooms. A modern retro platformer classic.',
    category: 'platformer',
    type: 'external',
    url: 'https://terrycavanagh.itch.io/vvvvvv',
    source: 'https://github.com/TerryCavanagh/VVVVVV',
    tileColor: '#2d0a3e',
    tileIcon: '🌀',
  },

  // ── Action & Arcade ──
  {
    id: 'openlara',
    title: 'OpenLara',
    description: 'Classic Tomb Raider engine in your browser with WebGL. Explore ancient tombs in 3D.',
    category: 'action',
    type: 'external',
    url: 'https://xproger.space/projects/OpenLara/',
    source: 'https://github.com/XProger/OpenLara',
    tileColor: '#2a1a0a',
    tileIcon: '🗿',
  },

  // ── Racing ──
  {
    id: 'dust-racing-2d',
    title: 'Dust Racing 2D',
    description: 'Top-down car racing with a track editor. Simple controls, fun gameplay.',
    category: 'racing',
    type: 'external',
    url: 'https://juzzlin.github.io/DustRacing2D/',
    source: 'https://github.com/juzzlin/DustRacing2D',
    tileColor: '#1a0a0a',
    tileIcon: '🏎️',
  },
];

function renderGamesHub(container) {
  // Build cards per category, preserving category order
  const categoriesWithGames = GAME_CATEGORIES
    .map(cat => ({
      ...cat,
      games: GAMES_LIST.filter(g => g.category === cat.id),
    }))
    .filter(c => c.games.length > 0);

  const sectionsHTML = categoriesWithGames.map(cat => {
    const cards = cat.games.map(g => {
      // Use image or colored tile with icon
      const tileContent = g.tileImage
        ? `<img src="${g.tileImage}" alt="${g.title}" loading="lazy">`
        : `<div class="game-tile-placeholder" style="background:${g.tileColor || '#222'};"><span>${g.tileIcon || '?'}</span></div>`;

      return `
        <a href="#/Games/${g.id}" class="game-tile-card" style="text-decoration:none;">
          <div class="game-tile-img">${tileContent}</div>
          <div class="game-tile-info">
            <h3>${g.title}</h3>
            <p>${g.description}</p>
          </div>
        </a>
      `;
    }).join('');

    return `
      <section class="games-category-section">
        <div class="games-category-header">
          <h2 style="color:${cat.color}">${cat.label}</h2>
          <div class="games-category-line" style="background:${cat.color}22"></div>
        </div>
        <div class="games-category-grid">
          ${cards}
        </div>
      </section>
    `;
  }).join('');

  container.innerHTML = `
    <div class="games-hub-page">
      <div class="games-hub-hero">
        <h1>Games</h1>
        <p>Take a break and play something fun. All games are open source.</p>
      </div>
      ${sectionsHTML}
    </div>
  `;
}

// --- Game Pages (no Firebase needed) ---
async function renderGamePage(container, gameId) {
  const game = GAMES_LIST.find(g => g.id === gameId.toLowerCase());
  const gameKey = gameId.toLowerCase();

  // Local canvas-based games
  if (gameKey === 'flappybird') {
    const { renderFlappyBird } = await import('./games/flappybird.js');
    renderFlappyBird(container);
    return;
  }
  if (gameKey === 'particleclicker') {
    const { renderParticleClicker } = await import('./games/particleclicker.js');
    renderParticleClicker(container);
    return;
  }

  // External web games — embed via iframe
  if (game && game.type === 'external') {
    renderExternalGame(container, game);
    return;
  }

  // Fallback
  const escapeHtml = await getEscapeHtml();
  container.innerHTML = `
    <div style="max-width:700px;margin:0 auto;text-align:center;">
      <h1 style="font-size:24px;font-weight:700;margin-bottom:16px;color:#f1f1f1;">${escapeHtml(gameId.replace(/-/g, ' '))}</h1>
      <p style="color:#aaa;margin-bottom:32px;">This game hasn't been implemented yet. Check back later!</p>
      <a href="#/Games" class="btn btn-primary">Back to Games</a>
    </div>
  `;
}

function renderExternalGame(container, game) {
  // Build embed URL
  let embedSrc = game.url;
  if (game.itchEmbedId) {
    embedSrc = `https://itch.io/embed/${game.itchEmbedId}`;
  }

  // Find category info for back link
  const catInfo = GAME_CATEGORIES.find(c => c.id === game.category);

  container.innerHTML = `
    <div class="game-page">
      <div class="game-header">
        <a href="#/Games" class="game-back-btn">← Games</a>
        <span class="game-page-title">${game.tileIcon || ''} ${game.title}</span>
        <a href="${game.url}" target="_blank" rel="noopener noreferrer" class="game-external-link" title="Open in new tab">↗</a>
      </div>
      <div class="game-iframe-wrapper">
        <iframe
          src="${embedSrc}"
          class="game-iframe"
          allow="autoplay; fullscreen; gamepad; keyboard"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          loading="lazy"
        ></iframe>
        <div class="game-iframe-fallback" id="game-iframe-fallback" style="display:none;">
          <p>This game can't be embedded here. </p>
          <a href="${game.url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">Play on ${game.title} Website ↗</a>
        </div>
      </div>
      ${game.source ? `<div class="game-source-link">Source: <a href="${game.source}" target="_blank" rel="noopener noreferrer">GitHub ↗</a></div>` : ''}
    </div>
  `;

  // Detect iframe load failure (X-Frame-Options / CSP block)
  const iframe = container.querySelector('.game-iframe');
  const fallback = container.querySelector('.game-iframe-fallback');
  if (iframe && fallback) {
    iframe.addEventListener('error', () => {
      iframe.style.display = 'none';
      fallback.style.display = 'flex';
    });
    // Also set a timeout — if the iframe hasn't loaded anything visible after 8s, show fallback
    setTimeout(() => {
      try {
        // If we can't access contentDocument, it's cross-origin and likely loaded fine
        // If it's same-origin but empty, it failed
        const doc = iframe.contentDocument;
        if (doc && doc.body && doc.body.innerHTML === '') {
          iframe.style.display = 'none';
          fallback.style.display = 'flex';
        }
      } catch (e) {
        // Cross-origin = loaded (good)
      }
    }, 8000);
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
