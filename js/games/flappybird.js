// Flappy Bird — full-screen responsive canvas game for FakeTube
// No Firebase dependencies.

const BASE = 'games/flappybird/sprites/';

const IMAGES = {
  bg:        BASE + 'background-day.png',
  base:      BASE + 'base.png',
  pipe:      BASE + 'pipe-green.png',
  gameOver:  BASE + 'gameover.png',
  startScr:  BASE + 'start-screen.png',
  birdDown:  BASE + 'yellowbird-downflap.png',
  birdMid:   BASE + 'yellowbird-midflap.png',
  birdUp:    BASE + 'yellowbird-upflap.png',
  digits: Array.from({length: 10}, (_, i) => BASE + i + '.png'),
};

// Internal resolution — all game logic runs at this and we scale the canvas.
// Matches the original Flappy Bird portrait aspect ratio.
const GAME_W = 288;
const GAME_H = 512;
const BASE_H = 112;
const PLAY_H = GAME_H - BASE_H; // 400px play area

// Physics (tuned for 60fps at internal resolution)
const GRAVITY = 0.45;
const FLAP = -7.5;
const PIPE_W = 52;
const PIPE_GAP = 130;
const PIPE_SPEED = 2.2;
const BIRD_W = 34;
const BIRD_H = 24;
const BIRD_X = 60;
const PIPE_INTERVAL = 90; // frames between pipes

export function renderFlappyBird(container) {
  container.innerHTML = `
    <div class="game-page">
      <div class="game-header">
        <a href="#/" class="btn btn-outline">Back to Home</a>
        <h2 class="game-page-title">Flappy Bird</h2>
        <div style="width:120px"></div>
      </div>
      <div class="game-canvas-wrapper" id="flappy-wrapper">
        <canvas id="flappy-canvas"></canvas>
      </div>
      <p class="game-instructions">Click / Tap / Press Space to flap</p>
    </div>
  `;

  const wrapper = document.getElementById('flappy-wrapper');
  const canvas = document.getElementById('flappy-canvas');
  const ctx = canvas.getContext('2d');

  // ── Responsive sizing ──
  // The canvas fills the wrapper. We keep the internal resolution at
  // GAME_W x GAME_H and use CSS to stretch it. The wrapper itself
  // fills the available space below the header.
  let scale = 1;
  let canvasW, canvasH;

  function resize() {
    // Available space: full width of main-content, from below the header
    // to the bottom of the viewport.
    const headerH = 56;
    const gameHeaderH = wrapper.previousElementSibling ? wrapper.previousElementSibling.offsetHeight : 40;
    const instructionsH = 30;
    const availW = window.innerWidth;
    const availH = window.innerHeight - headerH - gameHeaderH - instructionsH;

    // Target: fill width, but cap by height to maintain aspect ratio
    const aspect = GAME_W / GAME_H;
    let w = availW;
    let h = w / aspect;
    if (h > availH) {
      h = availH;
      w = h * aspect;
    }

    canvasW = Math.floor(w);
    canvasH = Math.floor(h);
    canvas.width = canvasW;
    canvas.height = canvasH;
    canvas.style.width = canvasW + 'px';
    canvas.style.height = canvasH + 'px';
    scale = canvasW / GAME_W;
  }

  resize();
  window.addEventListener('resize', resize);

  // ── Image loading ──
  let loaded = 0;
  let total = 0;
  const imgs = {};

  function loadImg(key, src) {
    total++;
    const img = new Image();
    img.onload = () => { loaded++; if (loaded >= total) startGame(); };
    img.onerror = () => { loaded++; if (loaded >= total) startGame(); };
    img.src = src;
    imgs[key] = img;
  }

  loadImg('bg', IMAGES.bg);
  loadImg('base', IMAGES.base);
  loadImg('pipe', IMAGES.pipe);
  loadImg('gameOver', IMAGES.gameOver);
  loadImg('startScr', IMAGES.startScr);
  loadImg('birdDown', IMAGES.birdDown);
  loadImg('birdMid', IMAGES.birdMid);
  loadImg('birdUp', IMAGES.birdUp);
  const digitImgs = [];
  IMAGES.digits.forEach((src, i) => {
    total++;
    const img = new Image();
    img.onload = () => { loaded++; if (loaded >= total) startGame(); };
    img.onerror = () => { loaded++; if (loaded >= total) startGame(); };
    img.src = src;
    digitImgs[i] = img;
  });

  // ── Game logic ──
  function startGame() {
    let bird = { y: PLAY_H / 2, vy: 0, frame: 0, frameTimer: 0 };
    let pipes = [];
    let score = 0;
    let bestScore = parseInt(localStorage.getItem('flappy_best') || '0', 10);
    let state = 'start'; // start | playing | dead
    let bgScrollX = 0;
    let baseScrollX = 0;
    let flashAlpha = 0;
    let animId;

    const birdFrames = [imgs.birdMid, imgs.birdDown, imgs.birdUp];

    function reset() {
      bird = { y: PLAY_H / 2, vy: 0, frame: 0, frameTimer: 0 };
      pipes = [];
      score = 0;
      state = 'start';
      flashAlpha = 0;
    }

    function flap() {
      if (state === 'start') {
        state = 'playing';
        bird.vy = FLAP;
      } else if (state === 'playing') {
        bird.vy = FLAP;
      } else if (state === 'dead') {
        reset();
      }
    }

    // Input
    canvas.addEventListener('click', flap);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); flap(); }, {passive: false});
    const keyHandler = (e) => { if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); flap(); } };
    document.addEventListener('keydown', keyHandler);
    const resizeHandler = () => resize();
    window.addEventListener('resize', resizeHandler);

    // Cleanup on navigation
    const observer = new MutationObserver(() => {
      if (!document.contains(canvas)) {
        cancelAnimationFrame(animId);
        document.removeEventListener('keydown', keyHandler);
        window.removeEventListener('resize', resizeHandler);
        observer.disconnect();
      }
    });
    observer.observe(container, {childList: true});

    function spawnPipe() {
      const minTop = 60;
      const maxTop = PLAY_H - PIPE_GAP - 60;
      const topH = minTop + Math.random() * (maxTop - minTop);
      pipes.push({ x: GAME_W, topH, scored: false });
    }

    let pipeTimer = 0;

    function update() {
      // Background always scrolls (even on start screen for visual life)
      bgScrollX = (bgScrollX + PIPE_SPEED * 0.3) % GAME_W;
      baseScrollX = (baseScrollX + PIPE_SPEED) % GAME_W;

      if (state !== 'playing') return;

      // Bird physics
      bird.vy += GRAVITY;
      bird.y += bird.vy;

      // Bird animation
      bird.frameTimer++;
      if (bird.frameTimer > 6) {
        bird.frameTimer = 0;
        bird.frame = (bird.frame + 1) % 3;
      }

      // Pipes
      pipeTimer++;
      if (pipeTimer >= PIPE_INTERVAL) {
        pipeTimer = 0;
        spawnPipe();
      }

      for (const p of pipes) {
        p.x -= PIPE_SPEED;
        if (!p.scored && p.x + PIPE_W < BIRD_X) {
          p.scored = true;
          score++;
        }
      }

      pipes = pipes.filter(p => p.x > -PIPE_W - 10);

      // Collision
      const bx = BIRD_X, by = bird.y;
      const bHalfW = BIRD_W / 2 - 3, bHalfH = BIRD_H / 2 - 2;

      if (by + bHalfH >= PLAY_H) { die(); return; }
      if (by - bHalfH <= 0) { bird.y = bHalfH; bird.vy = 0; }

      for (const p of pipes) {
        if (bx + bHalfW > p.x && bx - bHalfW < p.x + PIPE_W) {
          if (by - bHalfH < p.topH || by + bHalfH > p.topH + PIPE_GAP) {
            die(); return;
          }
        }
      }
    }

    function die() {
      state = 'dead';
      flashAlpha = 1;
      if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('flappy_best', String(bestScore));
      }
    }

    // ── Drawing helpers ──
    // All draw calls use the internal GAME_W x GAME_H coordinate system.
    // The canvas is physically larger but we apply a scale transform.

    function drawTiledBg() {
      // Tile the background image across the full game width with parallax scroll
      if (imgs.bg && imgs.bg.complete) {
        const ox = -Math.round(bgScrollX);
        // Draw enough tiles to cover the width + one extra for seamless scroll
        const tilesNeeded = Math.ceil(GAME_W / GAME_W) + 1;
        for (let i = 0; i < tilesNeeded; i++) {
          ctx.drawImage(imgs.bg, ox + i * GAME_W, 0, GAME_W, PLAY_H);
        }
      } else {
        // Fallback gradient sky
        const grad = ctx.createLinearGradient(0, 0, 0, PLAY_H);
        grad.addColorStop(0, '#4ec0ca');
        grad.addColorStop(1, '#71c8cf');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, GAME_W, PLAY_H);
      }
    }

    function drawPipes() {
      for (const p of pipes) {
        if (imgs.pipe && imgs.pipe.complete) {
          // Top pipe (flipped)
          ctx.save();
          ctx.translate(p.x + PIPE_W / 2, 0);
          ctx.scale(1, -1);
          ctx.drawImage(imgs.pipe, -PIPE_W / 2, -(p.topH), PIPE_W, p.topH);
          ctx.restore();
          // Bottom pipe
          const bottomH = PLAY_H - p.topH - PIPE_GAP;
          ctx.drawImage(imgs.pipe, p.x, p.topH + PIPE_GAP, PIPE_W, bottomH);
        } else {
          ctx.fillStyle = '#73bf2e';
          ctx.fillRect(p.x, 0, PIPE_W, p.topH);
          ctx.fillRect(p.x, p.topH + PIPE_GAP, PIPE_W, PLAY_H - p.topH - PIPE_GAP);
        }
      }
    }

    function drawBase() {
      if (imgs.base && imgs.base.complete) {
        const ox = -Math.round(baseScrollX);
        // Tile the ground across the full width
        const tilesNeeded = Math.ceil(GAME_W / GAME_W) + 1;
        for (let i = 0; i < tilesNeeded; i++) {
          ctx.drawImage(imgs.base, ox + i * GAME_W, PLAY_H, GAME_W, BASE_H);
        }
      } else {
        ctx.fillStyle = '#ded895';
        ctx.fillRect(0, PLAY_H, GAME_W, BASE_H);
      }
    }

    function drawBird() {
      const bFrame = birdFrames[bird.frame];
      ctx.save();
      ctx.translate(BIRD_X, bird.y);
      const angle = Math.min(Math.max(bird.vy * 3, -30), 90) * Math.PI / 180;
      ctx.rotate(angle);
      if (bFrame && bFrame.complete) {
        ctx.drawImage(bFrame, -BIRD_W / 2, -BIRD_H / 2, BIRD_W, BIRD_H);
      } else {
        ctx.fillStyle = '#f5c842';
        ctx.beginPath();
        ctx.arc(0, 0, BIRD_W / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function drawScore(cx, cy, val) {
      const s = String(val);
      const digitW = 24;
      const totalW = s.length * digitW;
      let x = cx - totalW / 2;
      for (const ch of s) {
        const d = parseInt(ch, 10);
        if (digitImgs[d] && digitImgs[d].complete) {
          ctx.drawImage(digitImgs[d], x, cy);
        } else {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 28px monospace';
          ctx.fillText(ch, x, cy + 24);
        }
        x += digitW;
      }
    }

    function drawOverlay() {
      if (state === 'playing') {
        drawScore(GAME_W / 2, 30, score);
      }

      if (state === 'start') {
        if (imgs.startScr && imgs.startScr.complete) {
          ctx.drawImage(imgs.startScr, GAME_W / 2 - 96, PLAY_H / 2 - 100, 192, 80);
        } else {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 22px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Get Ready!', GAME_W / 2, PLAY_H / 2 - 60);
          ctx.textAlign = 'start';
        }
        drawScore(GAME_W / 2, 200, 0);
      }

      // Death flash
      if (flashAlpha > 0) {
        ctx.fillStyle = 'rgba(255,255,255,' + flashAlpha + ')';
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        flashAlpha -= 0.08;
        if (flashAlpha < 0) flashAlpha = 0;
      }

      // Game over screen
      if (state === 'dead' && flashAlpha <= 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, 0, GAME_W, GAME_H);

        if (imgs.gameOver && imgs.gameOver.complete) {
          ctx.drawImage(imgs.gameOver, GAME_W / 2 - 96, 80, 192, 44);
        } else {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 28px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Game Over', GAME_W / 2, 110);
          ctx.textAlign = 'start';
        }

        // Score panel
        ctx.fillStyle = '#ded895';
        const panelX = GAME_W / 2 - 112, panelY = 150;
        roundRect(ctx, panelX, panelY, 224, 112, 8);
        ctx.fill();
        ctx.strokeStyle = '#543e24';
        ctx.lineWidth = 3;
        roundRect(ctx, panelX, panelY, 224, 112, 8);
        ctx.stroke();

        ctx.fillStyle = '#543e24';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SCORE', GAME_W / 2 - 50, panelY + 32);
        ctx.fillText('BEST', GAME_W / 2 + 50, panelY + 32);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(String(score), GAME_W / 2 - 50, panelY + 62);
        ctx.fillText(String(bestScore), GAME_W / 2 + 50, panelY + 62);
        ctx.strokeStyle = '#543e24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(GAME_W / 2, panelY + 10);
        ctx.lineTo(GAME_W / 2, panelY + 80);
        ctx.stroke();
        ctx.textAlign = 'start';

        ctx.fillStyle = '#fff';
        ctx.font = '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Tap or press Space to restart', GAME_W / 2, 300);
        ctx.textAlign = 'start';
      }
    }

    function roundRect(c, x, y, w, h, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.lineTo(x + w - r, y);
      c.quadraticCurveTo(x + w, y, x + w, y + r);
      c.lineTo(x + w, y + h - r);
      c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      c.lineTo(x + r, y + h);
      c.quadraticCurveTo(x, y + h, x, y + h - r);
      c.lineTo(x, y + r);
      c.quadraticCurveTo(x, y, x + r, y);
      c.closePath();
    }

    function draw() {
      // Apply scale transform so all drawing uses internal coordinates
      ctx.setTransform(scale, 0, 0, scale, 0, 0);

      // Clear entire canvas at scaled size
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvasW, canvasH);
      ctx.restore();

      // Reset to scaled transform
      ctx.setTransform(scale, 0, 0, scale, 0, 0);

      // Black fill for any area outside the game (letterboxing if tall screen)
      // The game fills the canvas width, so there should be no black bars.
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      drawTiledBg();
      drawPipes();
      drawBase();
      drawBird();
      drawOverlay();
    }

    function loop() {
      // Re-read scale in case of resize
      scale = canvasW / GAME_W;
      update();
      draw();
      animId = requestAnimationFrame(loop);
    }

    loop();
  }
}
