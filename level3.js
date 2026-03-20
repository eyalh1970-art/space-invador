// ============================================================
//  SPACE INVADERS – LEVEL 3: Nuclear Facility
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// ============================================================
//  IMAGES
// ============================================================
function loadImg(src) {
  const img = new Image();
  img.src = src;
  img.loaded = false;
  img.onload = () => { img.loaded = true; };
  return img;
}

const iranImg    = loadImg('iran.jpeg');
const lebanonImg = loadImg('lebanon.jpeg');
const sinuarImg  = loadImg('sinuar.jpeg');
const bibiImg    = loadImg('bibi.jpeg');
const nuclearImg = loadImg('nuclear.png');

canvas.width  = 800;
canvas.height = 620;

// ============================================================
//  SOUND
// ============================================================
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, type, duration, gainVal, startFreq) {
  try {
    const ac   = getAudioCtx();
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(startFreq || freq, ac.currentTime);
    if (startFreq) osc.frequency.exponentialRampToValueAtTime(freq, ac.currentTime + duration);
    gain.gain.setValueAtTime(gainVal || 0.3, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + duration);
  } catch (e) {}
}

function playNoise(duration, gainVal) {
  try {
    const ac     = getAudioCtx();
    const bufLen = Math.floor(ac.sampleRate * duration);
    const buf    = ac.createBuffer(1, bufLen, ac.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src  = ac.createBufferSource();
    src.buffer = buf;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(gainVal || 0.3, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    src.connect(gain);
    gain.connect(ac.destination);
    src.start();
  } catch (e) {}
}

function soundShoot()       { playTone(880, 'square',   0.08, 0.2); }
function soundKill()        { playNoise(0.3, 0.5); playTone(180, 'sawtooth', 0.35, 0.35, 700); }
function soundPlayerHit()   { playTone(110, 'sawtooth', 0.55, 0.45); }
function soundFacilityHit() { playTone(200, 'square', 0.12, 0.4); playNoise(0.08, 0.3); }

function soundExplosion() {
  playNoise(1.2, 1.0);
  playTone(55, 'sawtooth', 1.5, 0.8, 200);
  setTimeout(() => playNoise(0.6, 0.6), 350);
  setTimeout(() => { playNoise(0.4, 0.4); playTone(40, 'sine', 0.8, 0.5, 100); }, 700);
  setTimeout(() => playNoise(0.3, 0.3), 1100);
}

function soundWin() {
  const notes = [523, 523, 784, 784, 880, 880, 784, 698, 698, 659, 659, 587, 587, 523];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 'square', 0.18, 0.3), i * 190);
  });
  [0, 380, 760, 1140, 1520].forEach(ms => {
    setTimeout(() => playNoise(0.08, 0.25), ms);
  });
}

// ============================================================
//  COLOURS
// ============================================================
const C = {
  bg          : '#000011',
  player      : '#00ff41',
  playerBullet: '#00ff41',
  enemy1      : '#ff6b6b',
  enemy2      : '#ffd93d',
  enemy3      : '#6bcb77',
  enemyBullet : '#ff4444',
  shield      : '#4ecdc4',
  text        : '#00ff41',
};

// ============================================================
//  GAME STATE
// ============================================================
let gameState = 'start';
let score     = 0;
let highScore = 0;
let animId;

let introActive = false;
let introTimer  = 0;
const INTRO_DURATION = 300;

const killEffects        = [];
const KILL_EFFECT_FRAMES = 60;

const confetti        = [];
const balloons        = [];
const BALLOON_COLORS  = ['#ff4444','#ffd93d','#00ff41','#4ecdc4','#c77dff','#ff6b9d'];
const CONFETTI_COLORS = ['#ff4444','#ffd93d','#ffffff','#4ecdc4','#c77dff','#ff6b9d','#6bcb77'];

// ============================================================
//  NUCLEAR FACILITY
// ============================================================
const facilityX = 280;
const facilityY = 128;
const facilityW = 240;
const facilityH = 130;
let facilityDamage = 0;
let damageDisplayTimer = 0;
const DAMAGE_DISPLAY_DURATION = 120;

// ============================================================
//  EXPLOSION
// ============================================================
let explosionTimer = 0;
const explosionParticles = [];
const explosionSmoke     = [];
let shockwave = null;
const EXPLOSION_DURATION = 210;

// ============================================================
//  INPUT
// ============================================================
const keys = { ArrowLeft: false, ArrowRight: false, Space: false };
let   spaceJustPressed = false;

document.addEventListener('keydown', e => {
  if (e.code in keys) {
    e.preventDefault();
    if (e.code === 'Space' && !keys.Space) spaceJustPressed = true;
    keys[e.code] = true;
  }
  if (e.code === 'Enter' && gameState !== 'playing' && gameState !== 'exploding') startGame();
});

document.addEventListener('keyup', e => {
  if (e.code in keys) { e.preventDefault(); keys[e.code] = false; }
});

// ============================================================
//  PLAYER
// ============================================================
const player = {
  x: canvas.width / 2,
  y: canvas.height - 80,
  w: 50, h: 40,
  speed: 5,
  lives: 4,
  invincible: false,
  invincibleTimer: 0,
  INV_DURATION: 120,
};

// ============================================================
//  BULLETS
// ============================================================
const playerBullets = [];
const enemyBullets  = [];
const PLAYER_BULLET_SPEED = 9;
const ENEMY_BULLET_SPEED  = 4;

// ============================================================
//  ENEMIES  –  frame layout around the facility
// ============================================================
const COLS = 11;
const ROWS = 5;
const EW   = 36;
const EH   = 28;
const HGAP = 16;
const VGAP = 18;

const ROW_POINTS = [50, 20, 20, 10, 10];
const ROW_LABELS = ['IRAN', 'LEBANON', 'LEBANON', 'SINUAR', 'SINUAR'];

let enemies           = [];
let enemyDir          = 1;
let enemyBaseSpeed    = 1.5;
let enemyMoveTimer    = 0;
let enemyMoveInterval = 40;
let enemyShootTimer   = 0;
let enemyShootInterval = 60;

// ============================================================
//  SHIELDS
// ============================================================
const SHIELD_COUNT = 4;
const PX = 4;
let shields = [];

// ============================================================
//  STARFIELD
// ============================================================
const stars = Array.from({ length: 70 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  s: Math.random() * 1.5 + 0.3,
  a: Math.random() * 0.6 + 0.3,
}));

// ============================================================
//  SETUP
// ============================================================
function createEnemies() {
  enemies = [];
  const startX = 80;
  const startY = 80;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      // Skip middle columns in rows 1-3 → window for nuclear facility
      if (row >= 1 && row <= 3 && col >= 3 && col <= 7) continue;
      enemies.push({
        x: startX + col * (EW + HGAP),
        y: startY + row * (EH + VGAP),
        w: EW, h: EH,
        row, col,
        alive: true,
        animFrame: 0,
      });
    }
  }
}

function buildShieldPixels() {
  const W = 15, H = 10;
  const grid = [];
  for (let r = 0; r < H; r++) {
    grid[r] = [];
    for (let c = 0; c < W; c++) {
      let solid = true;
      if (r < 2 && c < 2)                     solid = false;
      if (r < 2 && c >= W - 2)                solid = false;
      if (r >= H - 3 && c >= 4 && c <= W - 5) solid = false;
      grid[r][c] = solid ? 1 : 0;
    }
  }
  return grid;
}

function createShields() {
  shields = [];
  const y       = canvas.height - 130;
  const spacing = canvas.width / (SHIELD_COUNT + 1);
  for (let i = 0; i < SHIELD_COUNT; i++) {
    shields.push({
      x: spacing * (i + 1) - (15 * PX) / 2,
      y,
      pixels: buildShieldPixels(),
    });
  }
}

// ============================================================
//  HEBREW SPEECH
// ============================================================
let hebrewVoice = null;
function loadHebrewVoice() {
  const voices = window.speechSynthesis.getVoices();
  hebrewVoice = voices.find(v =>
    v.lang.startsWith('he') && /male|moshe|avi|david/i.test(v.name)
  ) || voices.find(v => v.lang.startsWith('he')) || null;
}
window.speechSynthesis.onvoiceschanged = loadHebrewVoice;
loadHebrewVoice();

function speakHebrew(text, pitch) {
  try {
    window.speechSynthesis.cancel();
    setTimeout(() => {
      const utter  = new SpeechSynthesisUtterance(text);
      utter.lang   = 'he-IL';
      utter.rate   = 0.82;
      utter.pitch  = pitch || 0.3;
      utter.volume = 1;
      window.speechSynthesis.speak(utter);
    }, 100);
  } catch (e) {}
}

function speakIntro() { speakHebrew('יאללה, לסיים עם הגרעין!', 0.35); }
function speakWin() {
  speakHebrew('נגמרה המלחמה! איראן חופשית!', 0.4);
  setTimeout(() => speakHebrew('בואי שרה, יש בחירות!', 0.7), 3500);
}

// ============================================================
//  START / END
// ============================================================
function startGame() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  score          = 0;
  facilityDamage = 0;
  damageDisplayTimer = 0;

  player.x = canvas.width / 2;
  player.lives = 4;
  player.invincible      = false;
  player.invincibleTimer = 0;

  playerBullets.length     = 0;
  enemyBullets.length      = 0;
  killEffects.length       = 0;
  explosionParticles.length = 0;
  explosionSmoke.length    = 0;
  shockwave = null;

  enemyDir           = 1;
  enemyBaseSpeed     = 1.5;
  enemyMoveTimer     = 0;
  enemyMoveInterval  = 40;
  enemyShootTimer    = 0;
  enemyShootInterval = 60;

  introActive = true;
  introTimer  = INTRO_DURATION;
  speakIntro();

  createEnemies();
  createShields();

  gameState = 'playing';
  if (animId) cancelAnimationFrame(animId);
  gameLoop();
}

function endGame(result) {
  gameState = result;
  if (score > highScore) highScore = score;
  if (result === 'win') {
    soundWin();
    speakWin();
    spawnFiesta();
  }
}

// ============================================================
//  EXPLOSION
// ============================================================
function startExplosion() {
  gameState      = 'exploding';
  explosionTimer = 0;
  explosionParticles.length = 0;
  explosionSmoke.length     = 0;

  const cx = facilityX + facilityW / 2;
  const cy = facilityY + facilityH / 2;

  // Fire burst
  for (let i = 0; i < 120; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 9 + 2;
    explosionParticles.push({
      x: cx + (Math.random() - 0.5) * 60,
      y: cy + (Math.random() - 0.5) * 40,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: Math.random() * 14 + 4,
      color: ['#ff0000','#ff3300','#ff6600','#ff9900','#ffcc00','#ffffff'][Math.floor(Math.random() * 6)],
      life: 1.0,
      decay: Math.random() * 0.012 + 0.006,
      gravity: 0.14,
    });
  }

  // Initial smoke
  for (let i = 0; i < 60; i++) {
    explosionSmoke.push({
      x: cx + (Math.random() - 0.5) * 80,
      y: cy + (Math.random() - 0.5) * 30,
      vx: (Math.random() - 0.5) * 2,
      vy: -(Math.random() * 2 + 0.5),
      size: Math.random() * 28 + 14,
      life: 1.0,
      decay: Math.random() * 0.004 + 0.002,
    });
  }

  // Shockwave
  shockwave = { x: cx, y: cy, radius: 10, speed: 8, alpha: 1.0 };

  soundExplosion();
}

function updateExplosion() {
  explosionTimer++;

  // Shockwave
  if (shockwave) {
    shockwave.radius += shockwave.speed;
    shockwave.alpha  -= 0.02;
    shockwave.speed  *= 0.96;
    if (shockwave.alpha <= 0) shockwave = null;
  }

  // Fire particles
  for (let i = explosionParticles.length - 1; i >= 0; i--) {
    const p = explosionParticles[i];
    p.x    += p.vx;
    p.y    += p.vy;
    p.vy   += p.gravity;
    p.vx   *= 0.97;
    p.life -= p.decay;
    if (p.life <= 0) explosionParticles.splice(i, 1);
  }

  // Keep spawning fire for first 2 seconds
  if (explosionTimer < 120 && explosionTimer % 2 === 0) {
    const cx = facilityX + facilityW / 2;
    const cy = facilityY + facilityH / 2;
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 1;
      explosionParticles.push({
        x: cx + (Math.random() - 0.5) * 80,
        y: cy + (Math.random() - 0.5) * 50,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: Math.random() * 10 + 3,
        color: ['#ff0000','#ff4400','#ff8800','#ffcc00'][Math.floor(Math.random() * 4)],
        life: 1.0,
        decay: Math.random() * 0.018 + 0.008,
        gravity: 0.12,
      });
    }
  }

  // Smoke
  for (let i = explosionSmoke.length - 1; i >= 0; i--) {
    const s = explosionSmoke[i];
    s.x    += s.vx;
    s.y    += s.vy;
    s.size += 0.4;
    s.life -= s.decay;
    if (s.life <= 0) explosionSmoke.splice(i, 1);
  }

  // Keep spawning smoke for 3 seconds
  if (explosionTimer < 180 && explosionTimer % 4 === 0) {
    const cx = facilityX + facilityW / 2;
    explosionSmoke.push({
      x: cx + (Math.random() - 0.5) * 100,
      y: facilityY + Math.random() * 30,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -(Math.random() * 1.8 + 0.4),
      size: Math.random() * 22 + 12,
      life: 1.0,
      decay: 0.003,
    });
  }

  if (explosionTimer >= EXPLOSION_DURATION) endGame('win');
}

// ============================================================
//  COLLISION
// ============================================================
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// ============================================================
//  UPDATE
// ============================================================
function update() {
  if (gameState === 'exploding') { updateExplosion(); return; }
  if (gameState !== 'playing') return;

  if (introActive) {
    introTimer--;
    if (introTimer <= 0) introActive = false;
  }
  if (damageDisplayTimer > 0) damageDisplayTimer--;

  for (let i = killEffects.length - 1; i >= 0; i--) {
    killEffects[i].timer--;
    if (killEffects[i].timer <= 0) killEffects.splice(i, 1);
  }

  updatePlayer();
  updatePlayerBullets();
  updateEnemies();
  updateEnemyShooting();
  updateEnemyBullets();
  checkEndConditions();
}

function updatePlayer() {
  if (keys.ArrowLeft)  player.x -= player.speed;
  if (keys.ArrowRight) player.x += player.speed;
  const hw = player.w / 2;
  player.x = Math.max(hw, Math.min(canvas.width - hw, player.x));

  if (spaceJustPressed) {
    spaceJustPressed = false;
    if (playerBullets.length < 1) {
      playerBullets.push({ x: player.x - 2, y: player.y - player.h / 2, w: 4, h: 14 });
      soundShoot();
    }
  }
  if (player.invincible) {
    player.invincibleTimer--;
    if (player.invincibleTimer <= 0) player.invincible = false;
  }
}

function updatePlayerBullets() {
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    const b = playerBullets[i];
    b.y -= PLAYER_BULLET_SPEED;
    if (b.y + b.h < 0) { playerBullets.splice(i, 1); continue; }

    // Hit enemy
    let hit = false;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (aabb(b, e)) {
        e.alive = false;
        score  += ROW_POINTS[e.row];
        killEffects.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, timer: KILL_EFFECT_FRAMES });
        soundKill();
        playerBullets.splice(i, 1);
        speedUpEnemies();
        hit = true;
        break;
      }
    }
    if (hit) continue;
    if (checkBulletVsShield(b, playerBullets, i)) continue;

    // Hit nuclear facility
    const fBox = { x: facilityX, y: facilityY, w: facilityW, h: facilityH };
    if (aabb(b, fBox)) {
      facilityDamage = Math.min(100, facilityDamage + 4);
      damageDisplayTimer = DAMAGE_DISPLAY_DURATION;
      soundFacilityHit();
      playerBullets.splice(i, 1);
      if (facilityDamage >= 100) startExplosion();
    }
  }
}

function updateEnemyBullets() {
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.y += ENEMY_BULLET_SPEED;
    if (b.y > canvas.height) { enemyBullets.splice(i, 1); continue; }
    if (checkBulletVsShield(b, enemyBullets, i)) continue;
    if (!player.invincible) {
      const pBox = { x: player.x - player.w / 2, y: player.y - player.h / 2, w: player.w, h: player.h };
      if (aabb(b, pBox)) { enemyBullets.splice(i, 1); damagePlayer(); }
    }
  }
}

function damagePlayer() {
  player.lives--;
  player.invincible      = true;
  player.invincibleTimer = player.INV_DURATION;
  soundPlayerHit();
  if (player.lives <= 0) endGame('gameover');
}

function checkBulletVsShield(bullet, arr, idx) {
  for (const sh of shields) {
    const shW = sh.pixels[0].length * PX;
    const shH = sh.pixels.length    * PX;
    if (!aabb(bullet, { x: sh.x, y: sh.y, w: shW, h: shH })) continue;
    for (let r = 0; r < sh.pixels.length; r++) {
      for (let c = 0; c < sh.pixels[r].length; c++) {
        if (!sh.pixels[r][c]) continue;
        const px = { x: sh.x + c * PX, y: sh.y + r * PX, w: PX, h: PX };
        if (aabb(bullet, px)) {
          sh.pixels[r][c] = 0;
          if (r > 0)                       sh.pixels[r-1][c] = 0;
          if (r < sh.pixels.length - 1)   sh.pixels[r+1][c] = 0;
          if (c > 0)                       sh.pixels[r][c-1] = 0;
          if (c < sh.pixels[r].length - 1) sh.pixels[r][c+1] = 0;
          arr.splice(idx, 1);
          return true;
        }
      }
    }
  }
  return false;
}

function updateEnemies() {
  enemyMoveTimer++;
  const alive = enemies.filter(e => e.alive).length;
  const total = COLS * ROWS;
  enemyMoveInterval = Math.max(6, Math.floor(6 + (40 - 6) * (alive / total)));
  if (enemyMoveTimer < enemyMoveInterval) return;
  enemyMoveTimer = 0;

  let hitWall = false;
  for (const e of enemies) {
    if (!e.alive) continue;
    const nx = e.x + enemyBaseSpeed * enemyDir;
    if (nx < 20 || nx + e.w > canvas.width - 20) { hitWall = true; break; }
  }
  if (hitWall) {
    enemyDir *= -1;
    for (const e of enemies) { if (e.alive) e.y += 20; }
  } else {
    for (const e of enemies) {
      if (!e.alive) continue;
      e.x += enemyBaseSpeed * enemyDir;
      e.animFrame = e.animFrame === 0 ? 1 : 0;
    }
  }
}

function speedUpEnemies() { enemyBaseSpeed = Math.min(enemyBaseSpeed + 0.05, 6); }

function updateEnemyShooting() {
  enemyShootTimer++;
  if (enemyShootTimer < enemyShootInterval) return;
  enemyShootTimer = 0;
  const shooters = [];
  for (let col = 0; col < COLS; col++) {
    const colAlive = enemies.filter(e => e.alive && e.col === col).sort((a, b) => b.row - a.row);
    if (colAlive.length) shooters.push(colAlive[0]);
  }
  if (!shooters.length) return;
  const count = Math.random() < 0.25 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const s = shooters[Math.floor(Math.random() * shooters.length)];
    enemyBullets.push({ x: s.x + s.w / 2 - 2, y: s.y + s.h, w: 4, h: 12 });
  }
  enemyShootInterval = Math.max(25, enemyShootInterval - 0.4);
}

function checkEndConditions() {
  const alive = enemies.filter(e => e.alive);
  if (alive.some(e => e.y + e.h >= player.y - 20)) endGame('gameover');
}

// ============================================================
//  FIESTA
// ============================================================
function spawnFiesta() {
  confetti.length = 0; balloons.length = 0;
  for (let i = 0; i < 120; i++) {
    confetti.push({
      x: Math.random() * canvas.width, y: Math.random() * -canvas.height,
      w: Math.random() * 10 + 4, h: Math.random() * 6 + 3,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      speed: Math.random() * 2.5 + 1, drift: (Math.random() - 0.5) * 1.5,
      angle: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 0.15,
    });
  }
  for (let i = 0; i < 10; i++) {
    balloons.push({
      x: Math.random() * canvas.width, y: canvas.height + 60 + Math.random() * 200,
      r: Math.random() * 18 + 14,
      color: BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)],
      speed: Math.random() * 1.2 + 0.6, drift: (Math.random() - 0.5) * 0.8,
    });
  }
}

function updateFiesta() {
  for (const c of confetti) {
    c.y += c.speed; c.x += c.drift; c.angle += c.spin;
    if (c.y > canvas.height + 20) { c.y = -10; c.x = Math.random() * canvas.width; }
  }
  for (const b of balloons) {
    b.y -= b.speed; b.x += b.drift;
    if (b.y < -80) { b.y = canvas.height + 60; b.x = Math.random() * canvas.width; }
  }
}

// ============================================================
//  DRAW
// ============================================================
function draw() {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (gameState === 'start')      { drawStartScreen();    return; }
  if (gameState === 'gameover')   { drawGameOverScreen(); return; }
  if (gameState === 'win')        { updateFiesta(); drawWinScreen(); return; }
  if (gameState === 'exploding')  { drawExplosionScreen(); return; }

  drawStars();
  drawFacility();
  drawShields();
  drawEnemies();
  drawKillEffects();
  drawPlayerBullets();
  drawEnemyBullets();
  drawPlayer();
  drawHUD();
  if (damageDisplayTimer > 0) drawDamageDisplay();
  if (introActive) drawIntroOverlay();
}

function drawStars() {
  for (const s of stars) {
    ctx.fillStyle = `rgba(255,255,255,${s.a})`;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
}

function drawFacility() {
  if (nuclearImg.loaded) {
    ctx.drawImage(nuclearImg, facilityX, facilityY, facilityW, facilityH);
  } else {
    ctx.fillStyle = '#888';
    ctx.fillRect(facilityX, facilityY + 40, facilityW, facilityH - 40);
    ctx.fillStyle = '#aaa';
    ctx.fillRect(facilityX + 80, facilityY, 80, facilityH);
    ctx.fillStyle = '#999';
    ctx.fillRect(facilityX + 10, facilityY + 20, 50, 80);
    ctx.fillRect(facilityX + facilityW - 60, facilityY + 20, 50, 80);
  }

  // Red damage overlay
  if (facilityDamage > 0) {
    ctx.globalAlpha = facilityDamage / 250;
    ctx.fillStyle   = '#ff0000';
    ctx.fillRect(facilityX, facilityY, facilityW, facilityH);
    ctx.globalAlpha = 1;
  }

  // Damage progress bar
  const barY = facilityY + facilityH + 4;
  ctx.fillStyle = '#222';
  ctx.fillRect(facilityX, barY, facilityW, 8);
  const dmgColor = facilityDamage < 50 ? '#ffd93d' : facilityDamage < 80 ? '#ff8800' : '#ff0000';
  ctx.fillStyle = dmgColor;
  ctx.fillRect(facilityX, barY, facilityW * facilityDamage / 100, 8);

  ctx.font      = 'bold 10px "Courier New"';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(`☢ DAMAGE: ${facilityDamage}%`, facilityX + facilityW / 2, barY + 20);
}

function drawDamageDisplay() {
  const alpha = Math.min(1, damageDisplayTimer / 20);
  ctx.globalAlpha = alpha;
  ctx.textAlign   = 'center';
  ctx.font        = 'bold 52px "Courier New"';
  const color = facilityDamage >= 80 ? '#ff0000' : facilityDamage >= 50 ? '#ff8800' : '#ffd93d';
  ctx.fillStyle   = color;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 28;
  ctx.fillText(`${facilityDamage}%`, canvas.width / 2, facilityY + facilityH / 2 + 18);
  ctx.shadowBlur  = 0;
  ctx.globalAlpha = 1;
}

function drawExplosionScreen() {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawStars();
  drawShields();
  drawEnemies();
  drawPlayer();
  drawHUD();

  // Smoke (behind fire)
  for (const s of explosionSmoke) {
    ctx.globalAlpha = s.life * 0.55;
    const g = Math.floor(45 + s.life * 75);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Fire particles
  for (const p of explosionParticles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle   = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 12;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur  = 0;
  ctx.globalAlpha = 1;

  // Shockwave ring
  if (shockwave && shockwave.alpha > 0) {
    ctx.globalAlpha = Math.max(0, shockwave.alpha);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 5;
    ctx.beginPath();
    ctx.arc(shockwave.x, shockwave.y, shockwave.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth   = 1;
    ctx.globalAlpha = 1;
  }

  // Initial white flash
  if (explosionTimer < 18) {
    ctx.globalAlpha = (18 - explosionTimer) / 18 * 0.95;
    ctx.fillStyle   = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }
}

function drawPlayer() {
  if (player.invincible && Math.floor(player.invincibleTimer / 6) % 2 === 0) return;
  const x = player.x, y = player.y, w = player.w, h = player.h;
  if (bibiImg.loaded) {
    ctx.drawImage(bibiImg, x - 25.5, y - 21, 51, 42);
    ctx.font      = 'bold 9px "Courier New"';
    ctx.fillStyle = '#ffd93d';
    ctx.textAlign = 'center';
    ctx.fillText('007 Pichincha', x, y + h / 2 + 14);
  } else {
    ctx.fillStyle = C.player;
    ctx.fillRect(x - w/2, y - h/2 + 10, w, h - 10);
    ctx.fillRect(x - 10,  y - h/2,       20, 12);
    ctx.fillRect(x - 2,   y - h/2 - 6,   4,  8);
  }
}

function getEnemyImg(row) {
  if (row === 0) return iranImg;
  if (row <= 2)  return lebanonImg;
  return sinuarImg;
}

function drawEnemies() {
  for (const e of enemies) {
    if (!e.alive) continue;
    const color = e.row === 0 ? C.enemy1 : e.row <= 2 ? C.enemy2 : C.enemy3;
    const img   = getEnemyImg(e.row);
    ctx.fillStyle = color;
    if (img.loaded) {
      ctx.drawImage(img, e.x - 10, e.y - 8, e.w + 20, e.h + 16);
    } else {
      ctx.fillRect(e.x + 4, e.y + 4, e.w - 8, e.h - 8);
    }
    ctx.font      = 'bold 7px "Courier New"';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(ROW_LABELS[e.row], e.x + e.w / 2, e.y - 11);
  }
}

function drawKillEffects() {
  for (const ef of killEffects) {
    const progress = ef.timer / KILL_EFFECT_FRAMES;
    const alpha    = progress;
    const radius   = 26 * (1 + (1 - progress) * 0.6);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth   = 4;
    ctx.beginPath();
    ctx.arc(ef.x, ef.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    const off = radius * 0.58;
    ctx.beginPath();
    ctx.moveTo(ef.x - off, ef.y - off); ctx.lineTo(ef.x + off, ef.y + off);
    ctx.moveTo(ef.x + off, ef.y - off); ctx.lineTo(ef.x - off, ef.y + off);
    ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = 1;
  }
}

function drawIntroOverlay() {
  const progress = introTimer / INTRO_DURATION;
  const alpha    = progress > 0.15 ? 1 : progress / 0.15;
  ctx.globalAlpha = alpha * 0.88;
  ctx.fillStyle   = '#000011';
  ctx.fillRect(0, canvas.height / 2 - 70, canvas.width, 120);
  ctx.globalAlpha = alpha;
  ctx.textAlign   = 'center';
  ctx.font        = 'bold 36px "Courier New"';
  ctx.fillStyle   = '#ffd93d';
  ctx.shadowColor = '#ffd93d';
  ctx.shadowBlur  = 24;
  ctx.fillText('יאללה לסיים עם הגרעין!', canvas.width / 2, canvas.height / 2 + 14);
  ctx.shadowBlur  = 0;
  ctx.globalAlpha = 1;
}

function drawShields() {
  ctx.fillStyle = C.shield;
  for (const sh of shields) {
    for (let r = 0; r < sh.pixels.length; r++) {
      for (let c = 0; c < sh.pixels[r].length; c++) {
        if (sh.pixels[r][c]) ctx.fillRect(sh.x + c * PX, sh.y + r * PX, PX, PX);
      }
    }
  }
}

function drawPlayerBullets() {
  ctx.font = '16px serif'; ctx.textAlign = 'center';
  for (const b of playerBullets) ctx.fillText('☕', b.x + 2, b.y + 14);
}

function drawEnemyBullets() {
  ctx.fillStyle = C.enemyBullet;
  for (const b of enemyBullets) {
    ctx.fillRect(b.x,     b.y,     b.w, 4);
    ctx.fillRect(b.x - 2, b.y + 4, b.w, 4);
    ctx.fillRect(b.x + 2, b.y + 8, b.w, 4);
  }
}

function drawHUD() {
  ctx.font = 'bold 18px "Courier New"'; ctx.fillStyle = C.text;
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE: ${score}`, 20, 28);
  ctx.textAlign = 'center';
  ctx.fillText(`HI: ${highScore}`, canvas.width / 2, 28);
  ctx.textAlign = 'right';
  ctx.fillText(`LIVES: ${player.lives}`, canvas.width - 20, 28);
  ctx.fillStyle = C.player;
  for (let i = 0; i < player.lives; i++) {
    const lx = canvas.width - 28 - i * 28;
    ctx.fillRect(lx - 10, 38, 20, 8);
    ctx.fillRect(lx - 4,  34, 8,  6);
    ctx.fillRect(lx - 2,  30, 4,  5);
  }
  ctx.fillStyle = C.text;
  ctx.fillRect(0, canvas.height - 40, canvas.width, 2);
}

// ============================================================
//  SCREENS
// ============================================================
function drawStartScreen() {
  ctx.textAlign = 'center';
  ctx.font        = 'bold 40px "Courier New"';
  ctx.shadowColor = C.text;
  ctx.shadowBlur  = 22;
  ctx.fillStyle   = C.text;
  ctx.fillText('NUCLEAR FACILITY', canvas.width / 2, 90);
  ctx.font        = 'bold 28px "Courier New"';
  ctx.fillStyle   = '#ffd93d';
  ctx.shadowColor = '#ffd93d';
  ctx.fillText('יאללה לסיים עם הגרעין!', canvas.width / 2, 135);
  ctx.shadowBlur  = 0;

  // Show nuclear facility image preview
  if (nuclearImg.loaded) {
    ctx.drawImage(nuclearImg, canvas.width / 2 - 90, 165, 180, 100);
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth   = 2;
    ctx.strokeRect(canvas.width / 2 - 90, 165, 180, 100);
    ctx.lineWidth   = 1;
  }

  ctx.font      = '15px "Courier New"';
  ctx.fillStyle = '#ff6b6b';
  ctx.fillText('☢ DESTROY THE NUCLEAR FACILITY ☢', canvas.width / 2, 290);
  ctx.fillStyle = '#ffffff';
  ctx.font      = '14px "Courier New"';
  ctx.fillText('Each hit = 4% damage  |  100% = BOOM!', canvas.width / 2, 318);

  ctx.fillStyle = '#888';
  ctx.font      = '16px "Courier New"';
  ctx.fillText('← →  MOVE      SPACE  SHOOT', canvas.width / 2, 360);

  if (Math.floor(Date.now() / 550) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 22px "Courier New"';
    ctx.fillText('PRESS  ENTER  /  TAP  TO  START', canvas.width / 2, 430);
  }
}

function drawGameOverScreen() {
  ctx.textAlign   = 'center';
  ctx.font        = 'bold 58px "Courier New"';
  ctx.fillStyle   = '#ff4444';
  ctx.shadowColor = '#ff4444';
  ctx.shadowBlur  = 24;
  ctx.fillText('GAME  OVER', canvas.width / 2, 210);
  ctx.shadowBlur  = 0;
  ctx.font        = 'bold 26px "Courier New"';
  ctx.fillStyle   = C.text;
  ctx.fillText(`SCORE  :  ${score}`,        canvas.width / 2, 300);
  ctx.fillText(`HI-SCORE  :  ${highScore}`, canvas.width / 2, 340);
  ctx.fillStyle   = '#ffd93d';
  ctx.font        = 'bold 20px "Courier New"';
  ctx.fillText(`☢ FACILITY DAMAGE: ${facilityDamage}%`, canvas.width / 2, 390);
  if (Math.floor(Date.now() / 550) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 20px "Courier New"';
    ctx.fillText('PRESS  ENTER  /  TAP  TO  PLAY  AGAIN', canvas.width / 2, 460);
  }
}

function drawFiesta() {
  for (const c of confetti) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle);
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.restore();
  }
  for (const b of balloons) {
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r, b.r * 1.25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.r * 1.25);
    ctx.lineTo(b.x - 3, b.y + b.r * 1.25 + 5);
    ctx.lineTo(b.x + 3, b.y + b.r * 1.25 + 5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.r * 1.25 + 5);
    ctx.quadraticCurveTo(b.x + 10, b.y + b.r * 2 + 20, b.x, b.y + b.r * 2 + 40);
    ctx.stroke(); ctx.lineWidth = 1;
  }
}

function drawDancingPeople() {
  const t = Date.now();
  const positions = [80, 200, 370, 540, 670];
  const colors    = ['#ff4444','#ffd93d','#00ff41','#4ecdc4','#c77dff'];

  for (let i = 0; i < positions.length; i++) {
    const bx        = positions[i];
    const bounce    = Math.sin(t * 0.005 + i * 1.3) * 10;
    const by        = 520 + bounce;
    const armSwing  = Math.sin(t * 0.006 + i * 0.9) * 0.7;
    const legSwing  = Math.sin(t * 0.007 + i * 1.1) * 0.5;

    ctx.strokeStyle = colors[i];
    ctx.lineWidth   = 3;
    ctx.lineCap     = 'round';

    // Head
    ctx.beginPath(); ctx.arc(bx, by - 52, 13, 0, Math.PI * 2); ctx.stroke();
    // Body
    ctx.beginPath(); ctx.moveTo(bx, by - 39); ctx.lineTo(bx, by - 8); ctx.stroke();
    // Arms raised and waving
    ctx.beginPath();
    ctx.moveTo(bx, by - 28);
    ctx.lineTo(bx - 22, by - 28 + Math.sin(armSwing) * 18);
    ctx.moveTo(bx, by - 28);
    ctx.lineTo(bx + 22, by - 28 - Math.sin(armSwing) * 18);
    ctx.stroke();
    // Legs dancing
    ctx.beginPath();
    ctx.moveTo(bx, by - 8);
    ctx.lineTo(bx - 15 + legSwing * 12, by + 20);
    ctx.moveTo(bx, by - 8);
    ctx.lineTo(bx + 15 - legSwing * 12, by + 20);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
}

function drawWinScreen() {
  drawFiesta();
  drawDancingPeople();

  ctx.textAlign = 'center';

  ctx.font        = 'bold 44px "Courier New"';
  ctx.fillStyle   = '#ffd93d';
  ctx.shadowColor = '#ffd93d';
  ctx.shadowBlur  = 30;
  ctx.fillText('נגמרה המלחמה!', canvas.width / 2, 100);
  ctx.shadowBlur  = 0;

  ctx.font        = 'bold 48px "Courier New"';
  ctx.fillStyle   = '#00ff41';
  ctx.shadowColor = '#00ff41';
  ctx.shadowBlur  = 25;
  ctx.fillText('איראן חופשית!', canvas.width / 2, 170);
  ctx.shadowBlur  = 0;

  ctx.font        = 'bold 32px "Courier New"';
  ctx.fillStyle   = '#ff6b9d';
  ctx.shadowColor = '#ff6b9d';
  ctx.shadowBlur  = 20;
  ctx.fillText('בואי שרה יש בחירות!', canvas.width / 2, 240);
  ctx.shadowBlur  = 0;

  ctx.font      = 'bold 18px "Courier New"';
  ctx.fillStyle = C.text;
  ctx.fillText(`SCORE: ${score}   HI: ${highScore}`, canvas.width / 2, 415);

  if (Math.floor(Date.now() / 550) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 18px "Courier New"';
    ctx.fillText('PRESS  ENTER  /  TAP  TO  PLAY  AGAIN', canvas.width / 2, 470);
  }
}

// ============================================================
//  MAIN LOOP
// ============================================================
function gameLoop() {
  update();
  draw();
  animId = requestAnimationFrame(gameLoop);
}

// ============================================================
//  MOBILE TOUCH
// ============================================================
const btnLeft  = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnShoot = document.getElementById('btnShoot');
const btnStart = document.getElementById('btnStart');

function holdKey(keyCode, active) {
  keys[keyCode] = active;
  if (keyCode === 'Space' && active) spaceJustPressed = true;
}

btnLeft.addEventListener('touchstart',  e => { e.preventDefault(); holdKey('ArrowLeft',  true);  }, { passive: false });
btnLeft.addEventListener('touchend',    e => { e.preventDefault(); holdKey('ArrowLeft',  false); }, { passive: false });
btnRight.addEventListener('touchstart', e => { e.preventDefault(); holdKey('ArrowRight', true);  }, { passive: false });
btnRight.addEventListener('touchend',   e => { e.preventDefault(); holdKey('ArrowRight', false); }, { passive: false });
btnShoot.addEventListener('touchstart', e => { e.preventDefault(); holdKey('Space',      true);  }, { passive: false });
btnShoot.addEventListener('touchend',   e => { e.preventDefault(); holdKey('Space',      false); }, { passive: false });

btnStart.addEventListener('touchstart', e => { e.preventDefault(); if (gameState !== 'playing' && gameState !== 'exploding') startGame(); }, { passive: false });
btnStart.addEventListener('click',      () => { if (gameState !== 'playing' && gameState !== 'exploding') startGame(); });

canvas.addEventListener('touchstart', e => { e.preventDefault(); if (gameState !== 'playing' && gameState !== 'exploding') startGame(); }, { passive: false });
canvas.addEventListener('click',      () => { if (gameState !== 'playing' && gameState !== 'exploding') startGame(); });

// Boot
gameLoop();
