// Particle Clicker — loaded in an iframe so its AngularJS/Bootstrap
// doesn't clash with FakeTube's own stack.

export function renderParticleClicker(container) {
  container.innerHTML = `
    <div style="position:relative;">
      <div style="position:absolute;top:0;left:0;right:0;z-index:10;padding:8px 16px;background:rgba(15,15,15,0.85);backdrop-filter:blur(8px);display:flex;align-items:center;gap:12px;">
        <a href="#/Games" style="color:#aaa;font-size:13px;text-decoration:none;display:flex;align-items:center;gap:4px;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#aaa"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          Back to Games
        </a>
        <span style="color:#f1f1f1;font-size:16px;font-weight:600;">Particle Clicker</span>
      </div>
      <iframe
        src="games/particleclicker/index.html"
        style="display:block;border:none;width:100%;height:100vh;"
        allow="fullscreen"
      ></iframe>
    </div>
  `;
}
