// FakeTube - Flappy Bird
// Canvas-based clone using the classic sprites.

const SPRITE_BASE = 'games/flappybird/sprites/';
const SCALE = 1.5; // scale factor to make it bigger on screen
const BG_W = 288;
const BG_H = 512;
const CANVAS_W = Math.floor(BG_W * SCALE);
const CANVAS_H = Math.floor(BG_H * SCALE);

// Game constants (in sprite-pixel space, scaled at draw time)
const GRAVITY = 0.35;
const FLAP_FORCE = -6.2;
const PIPE_WIDTH = 52;
const PIPE_GAP = 120;
const PIPE_SPEED = 2;
const GROUND_H = 112;
const BIRD_W = 34;
const BIRD_H = 24;
const BIRD_X = 60;

// --- Image preloader ---
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadSprites() {
  const [bg, base, pipe, startScreen, gameOver,
    birdUp, birdMid, birdDown,
    ...digits] = await Promise.all([
    loadImage(SPRITE_BASE + 'background-day.png'),
    loadImage(SPRITE_BASE + 'base.png'),
    loadImage(SPRITE_BASE + 'pipe-green.png'),
    loadImage(SPRITE_BASE + 'start-screen.png'),
    loadImage(SPRITE_BASE + 'gameover.png'),
    loadImage(SPRITE_BASE + 'yellowbird-upflap.png'),
    loadImage(SPRITE_BASE + 'yellowbird-midflap.png'),
    loadImage(SPRITE_BASE + 'yellowbird-downflap.png'),
    ...Array.from({ length: 10 }, (_, i) => loadImage(SPRITE_BASE + i + '.png')),
  ]);
  return {
    bg, base, pipe, startScreen, gameOver,
    bird: [birdUp, birdMid, birdDown],
    digits,
  };
}

// --- Game ---
export async function renderFlappyBird(container) {
  container.innerHTML = `
    <div class="game-page-flappy" style="display:flex;flex-direction:column;align-items:center;padding:24px 16px;">
      <h1 style="font-size:24px;font-weight:700;color:#f1f1f1;margin-bottom:16px;">Flappy Bird</h1>
      <canvas id="flappy-canvas" width="${CANVAS_W}" height="${CANVAS_H}"
        style="border-radius:8px;cursor:pointer;image-rendering:pixelated;display:block;max-width:100%;height:auto;"></canvas>
      <p style="color:#aaa;font-size:13px;margin-top:12px;">Click / tap / press Space to flap</p>
      <a href="#/" style="color:var(--accent-blue);font-size:14px;margin-top:8px;">Back to Home</a>
    </div>
  `;

  const canvas = document.getElementById('flappy-canvas');
  const ctx = canvas.getContext('2d');

  let sprites;
  try {
    sprites = await loadSprites();
  } catch (e) {
    ctx.fillStyle = '#f1f1f1';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Failed to load sprites', CANVAS_W / 2, CANVAS_H / 2);
    return;
  }

  // --- State ---
  let state = 'start'; // 'start' | 'playing' | 'dead'
  let birdY, birdVel, pipes, score, bestScore, groundX, flapFrame, flapTimer;
  bestScore = parseInt(localStorage.getItem('flappy_best') || '0', 10);

  function resetGame() {
    birdY = 200;
    birdVel = 0;
    pipes = [];
    score = 0;
    groundX = 0;
    flapFrame = 1;
    flapTimer = 0;
  }
  resetGame();

  // --- Input ---
  function flap() {
    if (state === 'start') {
      state = 'playing';
      resetGame();
      birdVel = FLAP_FORCE;
    } else if (state === 'playing') {
      birdVel = FLAP_FORCE;
    } else if (state === 'dead') {
      state = 'start';
      resetGame();
    }
  }

  canvas.addEventListener('click', flap);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); flap(); }, { passive: false });
  const keyHandler = (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flap(); }
  };
  window.addEventListener('keydown', keyHandler);

  // Cleanup on route change (best-effort)
  const cleanupObserver = new MutationObserver(() => {
    if (!document.contains(canvas)) {
      window.removeEventListener('keydown', keyHandler);
      cleanupObserver.disconnect();
    }
  });
  cleanupObserver.observe(container, { childList: true });

  // --- Helpers ---
  function drawSprite(img, x, y, w, h) {
    ctx.drawImage(img, x * SCALE, y * SCALE, (w || img.width) * SCALE, (h || img.height) * SCALE);
  }

  function drawScore(x, y, num) {
    const str = String(num);
    let cx = x;
    for (let i = 0; i < str.length; i++) {
      const d = parseInt(str[i], 10);
      const digitImg = sprites.digits[d];
      const dw = digitImg.width;
      drawSprite(digitImg, cx, y, dw, 36);
      cx += (dw + 2) * SCALE;
    }
  }

  // --- Pipe management ---
  function spawnPipe() {
    const minY = 60;
    const maxY = BG_H - GROUND_H - PIPE_GAP - 60;
    const topH = minY + Math.random() * (maxY - minY);
    pipes.push({
      x: BG_W + 10,
      topH,
      scored: false,
    });
  }

  // --- Collision ---
  function collides() {
    const bx = BIRD_X;
    const by = birdY;
    const bw = BIRD_W - 4; // slightly smaller hitbox
    const bh = BIRD_H - 4;
    const groundY = BG_H - GROUND_H;

    // Ground / ceiling
    if (by + bh >= groundY || by <= 0) return true;

    // Pipes
    for (const p of pipes) {
      const px = p.x;
      const pw = PIPE_WIDTH;
      if (bx + bw > px && bx < px + pw) {
        if (by < p.topH || by + bh > p.topH + PIPE_GAP) {
          return true;
        }
      }
    }
    return false;
  }

  // --- Main loop ---
  let lastTime = 0;
  let accumulator = 0;
  const STEP = 1000 / 60; // 60 FPS logic

  function gameLoop(timestamp) {
    if (!document.contains(canvas)) return;

    const dt = Math.min(timestamp - lastTime, 50); // cap delta
    lastTime = timestamp;
    accumulator += dt;

    while (accumulator >= STEP) {
      update();
      accumulator -= STEP;
    }

    draw();
    requestAnimationFrame(gameLoop);
  }

  function update() {
    // Flap animation
    flapTimer++;
    if (flapTimer % 8 === 0) {
      flapFrame = (flapFrame + 1) % 3;
    }

    if (state === 'playing') {
      // Bird physics
      birdVel += GRAVITY;
      birdY += birdVel;

      // Ground scroll
      groundX = (groundX + PIPE_SPEED) % 24;

      // Pipes
      if (pipes.length === 0 || pipes[pipes.length - 1].x < BG_W - 160) {
        spawnPipe();
      }

      for (const p of pipes) {
        p.x -= PIPE_SPEED;
        if (!p.scored && p.x + PIPE_WIDTH < BIRD_X) {
          p.scored = true;
          score++;
        }
      }
      // Remove off-screen pipes
      pipes = pipes.filter(p => p.x + PIPE_WIDTH > -10);

      // Collision
      if (collides()) {
        state = 'dead';
        if (score > bestScore) {
          bestScore = score;
          localStorage.setItem('flappy_best', String(bestScore));
        }
      }
    } else if (state === 'start') {
      // Gentle bobbing on start screen
      groundX = (groundX + PIPE_SPEED) % 24;
      birdY = 200 + Math.sin(Date.now() / 200) * 8;
    }
  }

  function draw() {
    const s = SCALE;

    // Background
    ctx.drawImage(sprites.bg, 0, 0, CANVAS_W, CANVAS_H);

    // Pipes
    for (const p of pipes) {
      const s = SCALE;
      // Top pipe — flip vertically so cap faces the gap
      const topPipeH = p.topH;
      if (topPipeH > 0) {
        ctx.save();
        ctx.translate(p.x * s, 0);
        ctx.scale(1, -1);
        ctx.drawImage(sprites.pipe,
          0, 0, PIPE_WIDTH, topPipeH,
          0, -topPipeH * s, PIPE_WIDTH * s, topPipeH * s
        );
        ctx.restore();
      }
      // Bottom pipe — drawn normally (cap at top, facing the gap)
      const bottomY = p.topH + PIPE_GAP;
      const bottomH = BG_H - GROUND_H - bottomY;
      if (bottomH > 0) {
        ctx.drawImage(sprites.pipe,
          0, 0, PIPE_WIDTH, bottomH,
          p.x * s, bottomY * s, PIPE_WIDTH * s, bottomH * s
        );
      }
    }

    // Ground
    const groundY = (BG_H - GROUND_H) * s;
    ctx.drawImage(sprites.base,
      groundX * s, 0, sprites.base.width, sprites.base.height,
      0, groundY, sprites.base.width * s, sprites.base.height * s
    );
    // Tile ground if needed
    if (sprites.base.width * s < CANVAS_W) {
      ctx.drawImage(sprites.base,
        0, 0, sprites.base.width, sprites.base.height,
        (sprites.base.width - groundX * 1/s) * s, groundY, sprites.base.width * s, sprites.base.height * s
      );
    }

    // Bird
    const birdImg = sprites.bird[flapFrame];
    // Rotate based on velocity
    ctx.save();
    const bx = BIRD_X * s + (BIRD_W * s) / 2;
    const by = birdY * s + (BIRD_H * s) / 2;
    ctx.translate(bx, by);
    let angle = 0;
    if (state === 'playing') {
      angle = Math.min(Math.max(birdVel * 3, -30), 70) * Math.PI / 180;
    }
    ctx.rotate(angle);
    ctx.drawImage(birdImg, -(BIRD_W * s) / 2, -(BIRD_H * s) / 2, BIRD_W * s, BIRD_H * s);
    ctx.restore();

    // Score (top center)
    if (state === 'playing' || state === 'dead') {
      const scoreStr = String(score);
      const totalW = scoreStr.length * (24 * s + 2 * s);
      drawScore((BG_W * s - totalW) / 2 / s, 30, score);
    }

    // Start screen overlay
    if (state === 'start') {
      const sw = sprites.startScreen.width;
      const sh = sprites.startScreen.height;
      const sx = (CANVAS_W - sw * s) / 2;
      const sy = 120 * s;
      ctx.drawImage(sprites.startScreen, sx, sy, sw * s, sh * s);
    }

    // Game over overlay
    if (state === 'dead') {
      // Dim background
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Game over text
      const gw = sprites.gameOver.width;
      const gh = sprites.gameOver.height;
      ctx.drawImage(sprites.gameOver,
        (CANVAS_W - gw * s) / 2, 100 * s, gw * s, gh * s
      );

      // Score panel
      const panelX = (CANVAS_W - 220 * s) / 2;
      const panelY = 170 * s;
      const panelW = 220 * s;
      const panelH = 120 * s;

      ctx.fillStyle = '#dec76c';
      ctx.strokeStyle = '#543e18';
      ctx.lineWidth = 3;
      roundRect(ctx, panelX, panelY, panelW, panelH, 8 * s);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#543e18';
      ctx.font = `bold ${14 * s}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('Score', panelX + 20 * s, panelY + 30 * s);
      ctx.fillText('Best', panelX + 20 * s, panelY + 75 * s);

      // Score values (right-aligned in panel)
      ctx.textAlign = 'right';
      drawScore(panelX + panelW / s - 20, panelY / s + 10, score);
      drawScore(panelX + panelW / s - 20, panelY / s + 55, bestScore);

      // Tap to restart
      ctx.fillStyle = '#f1f1f1';
      ctx.font = `${13 * s}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Tap or press Space to restart', CANVAS_W / 2, panelY + panelH + 30 * s);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  requestAnimationFrame(gameLoop);
}
