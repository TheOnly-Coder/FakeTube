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
  
  // #/watch/VIDEO_ID
  const watchMatch = hash.match(/^#\/watch\/(.+)$/);
  if (watchMatch) return { page: 'watch', id: watchMatch[1] };

  // #/channel/USER_ID
  const channelMatch = hash.match(/^#\/channel\/(.+)$/);
  if (channelMatch) return { page: 'channel', id: channelMatch[1] };

  // #/upload
  if (hash === '#/upload') return { page: 'upload' };

  // #/search/TERM
  const searchMatch = hash.match(/^#\/search\/(.+)$/);
  if (searchMatch) return { page: 'search', term: decodeURIComponent(searchMatch[1]) };

  return { page: 'home' };
}

async function navigate() {
  const route = parseRoute();
  mainContent.scrollTop = 0;
  window.scrollTo(0, 0);

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
    default:
      await renderHome(mainContent);
  }
}

// Initialize
onAuthChange(async (user) => {
  renderHeader();
  if (user) {
    try { await ensureUserRecord(user.uid); } catch (e) { console.warn('Failed to ensure user record:', e); }
  }
});

renderHeader();
window.addEventListener('hashchange', navigate);
navigate();
