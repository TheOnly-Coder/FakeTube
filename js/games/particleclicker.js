// Particle Clicker — loaded in an iframe so its AngularJS/Bootstrap
// doesn't clash with FakeTube's own stack.

export function renderParticleClicker(container) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;">
      <div style="padding:12px 16px;background:#0f0f0f;border-bottom:1px solid #272727;display:flex;align-items:center;gap:12px;flex-shrink:0;">
        <a href="#/Games" style="color:#aaa;font-size:13px;text-decoration:none;display:flex;align-items:center;gap:4px;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#aaa"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          Back to Games
        </a>
        <span style="color:#f1f1f1;font-size:16px;font-weight:600;">Particle Clicker</span>
      </div>
      <iframe
        src="games/particleclicker/index.html"
        style="flex:1;border:none;width:100%;height:calc(100vh - 56px);"
        allow="fullscreen"
      ></iframe>
    </div>
  `;
}
