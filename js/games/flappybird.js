// Flappy Bird — standalone canvas game for FakeTube
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
  // Digit sprites 0-9 for score display
  digits: Array.from({length: 10}, (_, i) => BASE + i + '.png'),
};

const W = 288, H = 512;
const GRAVITY = 0.45;
const FLAP = -7.5;
const PIPE_W = 52;
const PIPE_GAP = 130;
const PIPE_SPEED = 2.2;
const BASE_H = 112;
const PLAY_H = H - BASE_H;
const BIRD_W = 34, BIRD_H = 24;
const BIRD_X = 60;

export function renderFlappyBird(container) {
  container.innerHTML = `
    <div class="game-page">
      <div class="game-header">
        <a href="#/" class="btn btn-outline">Back to Home</a>
        <h2 class="game-page-title">Flappy Bird</h2>
        <div style="width:120px"></div>
      </div>
      <div class="game-canvas-wrapper">
        <canvas id="flappy-canvas" width="${W}" height="${H}" style="display:block;image-rendering:pixelated;"></canvas>
      </div>
      <p class="game-instructions">Click / Tap / Press Space to flap</p>
    </div>
  `;

  const canvas = document.getElementById('flappy-canvas');
  const ctx = canvas.getContext('2d');

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

  // Load all images
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
    const img = new Image();
    img.onload = () => { loaded++; if (loaded >= total) startGame(); };
    img.onerror = () => { loaded++; if (loaded >= total) startGame(); };
    img.src = src;
    digitImgs[i] = img;
  });

  function startGame() {
    // Game state
    let bird = { y: PLAY_H / 2, vy: 0, frame: 0, frameTimer: 0 };
    let pipes = [];
    let score = 0;
    let bestScore = parseInt(localStorage.getItem('flappy_best') || '0', 10);
    let state = 'start'; // start | playing | dead
    let baseX = 0;
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

    // Cleanup on navigation
    const observer = new MutationObserver(() => {
      if (!document.contains(canvas)) {
        cancelAnimationFrame(animId);
        document.removeEventListener('keydown', keyHandler);
        observer.disconnect();
      }
    });
    observer.observe(container, {childList: true});

    function spawnPipe() {
      const minTop = 60;
      const maxTop = PLAY_H - PIPE_GAP - 60;
      const topH = minTop + Math.random() * (maxTop - minTop);
      pipes.push({ x: W, topH, scored: false });
    }

    let pipeTimer = 0;
    const PIPE_INTERVAL = 90; // frames between pipes

    function update() {
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

      // Scroll base
      baseX = (baseX + PIPE_SPEED) % 24;

      // Pipes
      pipeTimer++;
      if (pipeTimer >= PIPE_INTERVAL) {
        pipeTimer = 0;
        spawnPipe();
      }

      for (const p of pipes) {
        p.x -= PIPE_SPEED;

        // Score
        if (!p.scored && p.x + PIPE_W < BIRD_X) {
          p.scored = true;
          score++;
        }
      }

      // Remove off-screen pipes
      pipes = pipes.filter(p => p.x > -PIPE_W - 10);

      // Collision
      const bx = BIRD_X, by = bird.y;
      const bHalfW = BIRD_W / 2 - 3, bHalfH = BIRD_H / 2 - 2;

      // Ground
      if (by + bHalfH >= PLAY_H) {
        die();
        return;
      }

      // Ceiling
      if (by - bHalfH <= 0) {
        bird.y = bHalfH;
        bird.vy = 0;
      }

      // Pipes
      for (const p of pipes) {
        if (bx + bHalfW > p.x && bx - bHalfW < p.x + PIPE_W) {
          if (by - bHalfH < p.topH || by + bHalfH > p.topH + PIPE_GAP) {
            die();
            return;
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

    function draw() {
      // Background
      if (imgs.bg && imgs.bg.complete) {
        ctx.drawImage(imgs.bg, 0, 0, W, PLAY_H);
      } else {
        ctx.fillStyle = '#4ec0ca';
        ctx.fillRect(0, 0, W, PLAY_H);
      }

      // Pipes
      for (const p of pipes) {
        if (imgs.pipe && imgs.pipe.complete) {
          // Top pipe
          ctx.save();
          ctx.translate(p.x + PIPE_W / 2, 0);
          ctx.scale(1, -1);
          ctx.drawImage(imgs.pipe, -PIPE_W / 2, -(p.topH), PIPE_W, p.topH);
          ctx.restore();
          // Bottom pipe
          ctx.drawImage(imgs.pipe, p.x, p.topH + PIPE_GAP, PIPE_W, PLAY_H - p.topH - PIPE_GAP);
        } else {
          ctx.fillStyle = '#73bf2e';
          ctx.fillRect(p.x, 0, PIPE_W, p.topH);
          ctx.fillRect(p.x, p.topH + PIPE_GAP, PIPE_W, PLAY_H - p.topH - PIPE_GAP);
        }
      }

      // Base (ground)
      if (imgs.base && imgs.base.complete) {
        ctx.drawImage(imgs.base, -Math.round(baseX), PLAY_H, W + 24, BASE_H);
        ctx.drawImage(imgs.base, W - Math.round(baseX), PLAY_H, W + 24, BASE_H);
      } else {
        ctx.fillStyle = '#ded895';
        ctx.fillRect(0, PLAY_H, W, BASE_H);
      }

      // Bird
      const bFrame = birdFrames[bird.frame];
      ctx.save();
      ctx.translate(BIRD_X, bird.y);
      // Rotate based on velocity
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

      // Score (during play)
      if (state === 'playing') {
        drawScore(W / 2, 30, score);
      }

      // Start screen
      if (state === 'start') {
        if (imgs.startScr && imgs.startScr.complete) {
          ctx.drawImage(imgs.startScr, W / 2 - 96, PLAY_H / 2 - 100, 192, 80);
        }
        drawScore(W / 2, 200, 0);
      }

      // Death flash
      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
        ctx.fillRect(0, 0, W, H);
        flashAlpha -= 0.08;
        if (flashAlpha < 0) flashAlpha = 0;
      }

      // Game over screen
      if (state === 'dead' && flashAlpha <= 0) {
        // Score panel background
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, 0, W, H);

        if (imgs.gameOver && imgs.gameOver.complete) {
          ctx.drawImage(imgs.gameOver, W / 2 - 96, 80, 192, 44);
        } else {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 28px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Game Over', W / 2, 110);
          ctx.textAlign = 'start';
        }

        // Score panel
        ctx.fillStyle = '#ded895';
        const panelX = W / 2 - 112, panelY = 150;
        roundRect(ctx, panelX, panelY, 224, 112, 8);
        ctx.fill();
        ctx.strokeStyle = '#543e24';
        ctx.lineWidth = 3;
        roundRect(ctx, panelX, panelY, 224, 112, 8);
        ctx.stroke();

        ctx.fillStyle = '#543e24';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SCORE', W / 2 - 50, panelY + 32);
        ctx.fillText('BEST', W / 2 + 50, panelY + 32);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(String(score), W / 2 - 50, panelY + 62);
        ctx.fillText(String(bestScore), W / 2 + 50, panelY + 62);
        ctx.strokeStyle = '#543e24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(W / 2, panelY + 10);
        ctx.lineTo(W / 2, panelY + 80);
        ctx.stroke();
        ctx.textAlign = 'start';

        // Tap to restart hint
        ctx.fillStyle = '#fff';
        ctx.font = '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Tap or press Space to restart', W / 2, 300);
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

    function loop() {
      update();
      draw();
      animId = requestAnimationFrame(loop);
    }

    loop();
  }
}
