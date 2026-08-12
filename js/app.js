import './firebase-config.js';
import { onAuthChange, getCurrentUser, ensureUserRecord } from './auth.js';
import { renderHeader } from './components.js';
import { renderHome } from './home.js';
import { renderWatch } from './watch.js';
import { renderChannel } from './channel.js';
import { renderUpload } from './upload.js';

const mainContent = document.getElementById('main-content');

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

async function navigate() {
  const route = parseRoute();
  mainContent.scrollTop = 0;
  window.scrollTo(0, 0);

  try {
    switch (route.page) {
      case 'home':
        await renderHome(mainContent);
        break;
      case 'watch':
        await renderWatch(mainContent, route.id);
        break;
      case 'channel':
        await renderChannel(mainContent, route.id);
        break;
      case 'upload':
        renderUpload(mainContent);
        break;
      case 'search':
        await renderHome(mainContent, route.term);
        break;
      case 'tutorial':
        renderTutorial(mainContent);
        break;
      default:
        await renderHome(mainContent);
    }
  } catch (err) {
    console.error('Navigation error:', err);
    mainContent.innerHTML = `
      <div class="empty-state">
        <h3>Something went wrong</h3>
        <p style="max-width:500px;margin:0 auto 16px;">${err.message || 'An unexpected error occurred. Make sure Firestore is set up in the Firebase Console.'}</p>
        <a href="#/" class="btn btn-primary">Try again</a>
        <br><br>
        <a href="#/how-to-upload" style="color:var(--accent-blue);">How to upload videos</a>
      </div>
    `;
  }
}

function renderTutorial(container) {
  container.innerHTML = `
    <div style="max-width:720px;margin:0 auto;">
      <h1 style="font-size:24px;font-weight:700;margin-bottom:8px;">How to Upload Videos to FakeTube</h1>
      <p style="color:var(--text-secondary);margin-bottom:32px;">FakeTube doesn't host video files. Instead, you paste a direct link to an MP4 video. Here's the easiest way to do it:</p>

      <div style="background:var(--bg-surface);border-radius:12px;padding:24px;margin-bottom:24px;">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <span style="background:var(--accent-red);color:white;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;">1</span>
          Upload your video to YouTube (Unlisted)
        </h2>
        <p style="color:var(--text-secondary);line-height:1.7;margin-bottom:12px;">
          Go to <a href="https://www.youtube.com/upload" target="blank" style="color:var(--accent-blue);">youtube.com/upload</a> and upload your video.
          Set the visibility to <strong style="color:var(--text-primary);">Unlisted</strong> — this means only people with the link can see it. It won't appear on your channel or in search results.
        </p>
        <div style="background:var(--bg-primary);border-radius:8px;padding:16px;border-left:3px solid var(--accent-blue);">
          <p style="font-size:13px;color:var(--text-secondary);margin:0;">
            <strong style="color:var(--text-primary);">Why unlisted?</strong> Your video stays private on YouTube but anyone with the direct MP4 link can still access it. FakeTube uses that link to embed your video.
          </p>
        </div>
      </div>

      <div style="background:var(--bg-surface);border-radius:12px;padding:24px;margin-bottom:24px;">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <span style="background:var(--accent-red);color:white;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;">2</span>
          Get the direct MP4 link from TurboScribe
        </h2>
        <p style="color:var(--text-secondary);line-height:1.7;margin-bottom:12px;">
          Go to <a href="https://turboscribe.ai/downloader/youtube/video/free" target="_blank" style="color:var(--accent-blue);">turboscribe.ai/downloader/youtube/video/free</a> and paste your YouTube video link into it. Click <strong style="color:var(--text-primary);">Download MP4</strong>.
        </p>
        <p style="color:var(--text-secondary);line-height:1.7;margin-bottom:12px;">
          It will take you to a page that shows the raw MP4 video. <strong style="color:var(--text-primary);">Copy that page's URL from the address bar</strong> — that's your direct video link. It will look something like:
        </p>
        <div style="background:var(--bg-primary);border-radius:8px;padding:12px 16px;margin-bottom:12px;">
          <code style="font-size:12px;color:var(--accent-blue);word-break:break-all;">https://rr---sn-...googlevideo.com/videoplayback?expire=...&id=...&itag=18&source=youtube&mime=video%2Fmp4</code>
        </div>
        <div style="background:rgba(255,165,0,0.08);border-radius:8px;padding:16px;border-left:3px solid #ffa500;">
          <p style="font-size:13px;color:var(--text-secondary);margin:0;">
            <strong style="color:#ffa500;">Important:</strong> These Google Video links expire after a few hours. If the link stops working later, just repeat steps 1-2 to get a fresh one. The video is safe on your YouTube channel.
          </p>
        </div>
      </div>

      <div style="background:var(--bg-surface);border-radius:12px;padding:24px;margin-bottom:24px;">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <span style="background:var(--accent-red);color:white;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;">3</span>
          Paste the link into FakeTube
        </h2>
        <p style="color:var(--text-secondary);line-height:1.7;margin-bottom:16px;">
          Go to <a href="#/upload" style="color:var(--accent-blue);">FakeTube's upload page</a>, paste the MP4 link, click <strong style="color:var(--text-primary);">Preview & Generate Thumbnail</strong>, add a title, and hit <strong style="color:var(--text-primary);">Publish</strong>. Done!
        </p>
      </div>

      <div style="background:var(--bg-surface);border-radius:12px;padding:24px;margin-bottom:24px;">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <span style="background:var(--accent-blue);color:#0f0f0f;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;">?</span>
          What if TurboScribe doesn't work with an unlisted video?
        </h2>
        <p style="color:var(--text-secondary);line-height:1.7;">
          No problem. Upload to YouTube as <strong style="color:var(--text-primary);">Public</strong> instead, then do the TurboScribe step to get the MP4 link. Paste it into FakeTube. <strong style="color:var(--text-primary);">Then go back to YouTube and change the video to Unlisted.</strong> The direct MP4 link from TurboScribe will keep working for several hours — long enough for people to watch it on FakeTube.
        </p>
      </div>

      <div style="background:var(--bg-surface);border-radius:12px;padding:24px;margin-bottom:24px;">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px;">
          <span style="background:var(--accent-blue);color:#0f0f0f;width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;">?</span>
          Alternative: Use GitHub Releases
        </h2>
        <p style="color:var(--text-secondary);line-height:1.7;">
          You can also upload your MP4 to any GitHub repo's Releases section. The download URL works as a direct video link and <strong style="color:var(--text-primary);">never expires</strong>. Go to your repo → Releases → Draft a new release → attach your .mp4 file → publish → right-click the asset → copy link. Paste that into FakeTube.
        </p>
      </div>

      <div style="text-align:center;margin-top:32px;">
        <a href="#/upload" class="btn btn-primary" style="padding:12px 32px;font-size:16px;">Share a Video</a>
      </div>
    </div>
  `;
}

// Initialize
try {
  onAuthChange(async (user) => {
    renderHeader();
    if (user) {
      try { await ensureUserRecord(user.uid); } catch (e) { console.warn('Failed to ensure user record:', e); }
    }
  });

  renderHeader();
  window.addEventListener('hashchange', navigate);
  navigate();
} catch (err) {
  console.error('App init error:', err);
  document.getElementById('main-content').innerHTML = `
    <div class="empty-state">
      <h3>Failed to load FakeTube</h3>
      <p style="max-width:500px;margin:0 auto 16px;">Check the browser console (F12) for details. Make sure Firebase is configured.</p>
      <a href="#/" class="btn btn-primary" onclick="location.reload()">Reload</a>
    </div>
  `;
}
