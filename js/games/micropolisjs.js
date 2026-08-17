// micropolisJS — self-hosted SimCity clone, rendered via local iframe
// No Firebase dependencies.

export function renderMicropolisJS(container) {
  container.innerHTML = `
    <div class="game-page">
      <div class="game-header">
        <a href="#/Games" class="game-back-btn">\u2190 Games</a>
        <span class="game-page-title">⭐ micropolisJS</span>
        <a href="https://github.com/graememcc/micropolisJS" target="_blank" rel="noopener noreferrer" class="game-external-link" title="GitHub">\u2197</a>
      </div>
      <div class="game-iframe-wrapper">
        <iframe
          src="games/micropolisJS/index.html"
          class="game-iframe"
          allow="autoplay; fullscreen"
          sandbox="allow-scripts allow-same-origin allow-forms"
        ></iframe>
      </div>
    </div>
  `;
}
