// ============================================================
//  SPACE INVADERS – LEVEL 2: Strait of Hormuz
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

const trumpImg = loadImg('trump.jpeg');
const bibiImg  = loadImg('bibi.jpeg');

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
function soundTrumpAppear() { playTone(330, 'sine', 0.25, 0.25); }
function soundTrumpShoot()  { playTone(660, 'square', 0.1, 0.25); }
function soundWin() {
  const notes = [523, 523, 784, 784, 880, 880, 784, 698, 698, 659, 659, 587, 587, 523];
  const dur   = 0.18;
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 'square', dur, 0.3), i * 190);
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
  fighter     : '#00e5ff',   // top row    (50 pts)
  cruiser     : '#ffd93d',   // middle rows(20 pts)
  battleship  : '#ff6b6b',   // bottom rows(10 pts)
  enemyBullet : '#ff4444',
  shield      : '#4ecdc4',
  trump       : '#ff8c00',
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
  if (e.code === 'Enter' && gameState !== 'playing') startGame();
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
  w: 50,
  h: 40,
  speed: 5,
  lives: 4,
  invincible     : false,
  invincibleTimer: 0,
  INV_DURATION   : 120,
};

// ============================================================
//  BULLETS
// ============================================================
const playerBullets = [];
const enemyBullets  = [];
const trumpBullets  = [];   // Trump shoots DOWN at ships
const PLAYER_BULLET_SPEED = 9;
const ENEMY_BULLET_SPEED  = 4;
const TRUMP_BULLET_SPEED  = 3;

// ============================================================
//  ENEMIES  (ships)
// ============================================================
const COLS = 11;
const ROWS = 5;
const EW   = 36;
const EH   = 28;
const HGAP = 16;
const VGAP = 18;

// row 0 = top (FIGHTERS), rows 1-2 = CRUISERS, rows 3-4 = BATTLESHIPS
const ROW_POINTS = [50, 20, 20, 10, 10];
const ROW_LABELS = ['FIGHTER', 'CRUISER', 'CRUISER', 'BATTLESHIP', 'BATTLESHIP'];

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
//  TRUMP UFO
// ============================================================
let trump            = null;
let trumpTimer       = 0;
let trumpShootTimer  = 0;
const TRUMP_INTERVAL       = 700;
const TRUMP_SHOOT_INTERVAL = 100;  // one shot every 100 frames while on screen

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
  const startY = 90;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      enemies.push({
        x: startX + col * (EW + HGAP),
        y: startY + row * (EH + VGAP),
        w: EW, h: EH,
        row, col,
        alive    : true,
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

function speakIntro() {
  speakHebrew('קדימה, משחררים את מיצרי הורמוז!', 0.35);
}
function speakTrumpHit() {
  speakHebrew('ביבי תתרכז באויב!', 0.6);
}
function speakWin() {
  speakHebrew('עכשיו כולם יכולים לשוט בביטחה! שלב הבא, מטפלים בגרעין!', 0.35);
}

// ============================================================
//  START / END
// ============================================================
function startGame() {
  score    = 0;
  player.x = canvas.width / 2;
  player.lives = 4;
  player.invincible      = false;
  player.invincibleTimer = 0;

  playerBullets.length = 0;
  enemyBullets.length  = 0;
  trumpBullets.length  = 0;
  killEffects.length   = 0;

  enemyDir           = 1;
  enemyBaseSpeed     = 1.5;
  enemyMoveTimer     = 0;
  enemyMoveInterval  = 40;
  enemyShootTimer    = 0;
  enemyShootInterval = 60;

  trump           = null;
  trumpTimer      = 0;
  trumpShootTimer = 0;

  introActive = true;
  introTimer  = INTRO_DURATION;
  speakIntro();

  createEnemies();
  createShields();

  gameState = 'playing';
  if (animId) cancelAnimationFrame(animId);
  gameLoop();
}

function endGame(state) {
  gameState = state;
  if (score > highScore) highScore = score;
  if (state === 'win') {
    soundWin();
    speakWin();
    spawnFiesta();
  }
}

// ============================================================
//  COLLISION
// ============================================================
function aabb(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

// ============================================================
//  UPDATE
// ============================================================
function update() {
  if (gameState !== 'playing') return;

  if (introActive) {
    introTimer--;
    if (introTimer <= 0) introActive = false;
  }

  for (let i = killEffects.length - 1; i >= 0; i--) {
    killEffects[i].timer--;
    if (killEffects[i].timer <= 0) killEffects.splice(i, 1);
  }

  updatePlayer();
  updatePlayerBullets();
  updateEnemies();
  updateEnemyShooting();
  updateEnemyBullets();
  updateTrump();
  updateTrumpBullets();
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

    // Player shoots Trump = bonus points
    if (trump && aabb(b, trump)) {
      score += 150;
      soundKill();
      speakTrumpHit();
      trump = null;
      playerBullets.splice(i, 1);
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
      if (aabb(b, pBox)) {
        enemyBullets.splice(i, 1);
        damagePlayer();
      }
    }
  }
}

function updateTrump() {
  trumpTimer++;
  if (!trump && trumpTimer >= TRUMP_INTERVAL) {
    trumpTimer      = 0;
    trumpShootTimer = 0;
    const left = Math.random() < 0.5;
    trump = {
      x: left ? -70 : canvas.width + 10,
      y: 44, w: 60, h: 24,
      speed : left ? 2.5 : -2.5,
    };
    soundTrumpAppear();
  }
  if (!trump) return;

  trump.x += trump.speed;

  // Trump fires one slow bullet at a time downward
  trumpShootTimer++;
  if (trumpShootTimer >= TRUMP_SHOOT_INTERVAL && trumpBullets.length === 0) {
    const aliveShips = enemies.filter(e => e.alive);
    if (aliveShips.length > 0) {
      trumpShootTimer = 0;
      soundTrumpShoot();
      trumpBullets.push({
        x: trump.x + trump.w / 2 - 2,
        y: trump.y + trump.h,
        w: 5, h: 14,
      });
    }
  }

  if (trump.x > canvas.width + 80 || trump.x + trump.w < -80) trump = null;
}

function updateTrumpBullets() {
  for (let i = trumpBullets.length - 1; i >= 0; i--) {
    const b = trumpBullets[i];
    b.y += TRUMP_BULLET_SPEED;

    if (b.y > canvas.height) { trumpBullets.splice(i, 1); continue; }

    // Trump bullet hits ships → ship destroyed (no player points)
    let hit = false;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (aabb(b, e)) {
        e.alive = false;
        killEffects.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, timer: KILL_EFFECT_FRAMES });
        soundKill();
        trumpBullets.splice(i, 1);
        speedUpEnemies();
        hit = true;
        break;
      }
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

function checkBulletVsShield(bullet, bulletsArray, idx) {
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
          bulletsArray.splice(idx, 1);
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

function speedUpEnemies() {
  enemyBaseSpeed = Math.min(enemyBaseSpeed + 0.05, 6);
}

function updateEnemyShooting() {
  enemyShootTimer++;
  if (enemyShootTimer < enemyShootInterval) return;
  enemyShootTimer = 0;

  const shooters = [];
  for (let col = 0; col < COLS; col++) {
    const colAlive = enemies
      .filter(e => e.alive && e.col === col)
      .sort((a, b) => b.row - a.row);
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
  if (alive.length === 0)                           { endGame('win');      return; }
  if (alive.some(e => e.y + e.h >= player.y - 20)) { endGame('gameover'); return; }
}

// ============================================================
//  FIESTA
// ============================================================
function spawnFiesta() {
  confetti.length = 0;
  balloons.length = 0;
  for (let i = 0; i < 120; i++) {
    confetti.push({
      x    : Math.random() * canvas.width,
      y    : Math.random() * -canvas.height,
      w    : Math.random() * 10 + 4,
      h    : Math.random() * 6 + 3,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      speed: Math.random() * 2.5 + 1,
      drift: (Math.random() - 0.5) * 1.5,
      angle: Math.random() * Math.PI * 2,
      spin : (Math.random() - 0.5) * 0.15,
    });
  }
  for (let i = 0; i < 10; i++) {
    balloons.push({
      x    : Math.random() * canvas.width,
      y    : canvas.height + 60 + Math.random() * 200,
      r    : Math.random() * 18 + 14,
      color: BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)],
      speed: Math.random() * 1.2 + 0.6,
      drift: (Math.random() - 0.5) * 0.8,
    });
  }
}

function updateFiesta() {
  for (const c of confetti) {
    c.y     += c.speed;
    c.x     += c.drift;
    c.angle += c.spin;
    if (c.y > canvas.height + 20) { c.y = -10; c.x = Math.random() * canvas.width; }
  }
  for (const b of balloons) {
    b.y -= b.speed;
    b.x += b.drift;
    if (b.y < -80) { b.y = canvas.height + 60; b.x = Math.random() * canvas.width; }
  }
}

// ============================================================
//  SHIP DRAW FUNCTIONS
// ============================================================

// Row 0 – Small Fighter (cyan)
function drawFighter(x, y, w, h, f) {
  // Narrow body
  ctx.fillRect(x + w/2 - 3, y + 2,   6,      h - 6);
  ctx.fillRect(x + w/2 - 8, y + 8,   16,     h - 12);
  // Wings
  if (f === 0) {
    ctx.fillRect(x,          y + h - 10, w/3,     7);
    ctx.fillRect(x + 2*w/3,  y + h - 10, w/3,     7);
  } else {
    ctx.fillRect(x + 2,      y + h - 12, w/3,     7);
    ctx.fillRect(x + 2*w/3 - 2, y + h - 12, w/3, 7);
  }
  // Cockpit window (dark)
  ctx.fillStyle = C.bg;
  ctx.fillRect(x + w/2 - 2, y + 4,   4,      4);
}

// Rows 1-2 – Medium Cruiser (yellow)
function drawCruiser(x, y, w, h, f) {
  // Main hull
  ctx.fillRect(x + 4,  y + 4,  w - 8,  h - 6);
  // Nose
  ctx.fillRect(x + 10, y,      w - 20, 8);
  // Side engines
  if (f === 0) {
    ctx.fillRect(x,          y + 6,  8, 12);
    ctx.fillRect(x + w - 8,  y + 6,  8, 12);
    ctx.fillRect(x + 2,      y + 18, 4,  6);
    ctx.fillRect(x + w - 6,  y + 18, 4,  6);
  } else {
    ctx.fillRect(x - 2,       y + 8,  8, 12);
    ctx.fillRect(x + w - 6,   y + 8,  8, 12);
    ctx.fillRect(x,            y + 20, 4,  6);
    ctx.fillRect(x + w - 4,   y + 20, 4,  6);
  }
  // Windows
  ctx.fillStyle = C.bg;
  ctx.fillRect(x + 10,     y + 6, 4, 4);
  ctx.fillRect(x + w - 14, y + 6, 4, 4);
}

// Rows 3-4 – Large Battleship (red)
function drawBattleship(x, y, w, h, f) {
  // Main hull (wide and flat)
  ctx.fillRect(x + 2,      y + h/2,  w - 4,  h/2);
  // Superstructure
  ctx.fillRect(x + 6,      y + 4,    w - 12, h/2);
  // Bridge
  ctx.fillRect(x + 12,     y,        w - 24, 8);
  // Side gun turrets
  ctx.fillRect(x,           y + h/2 + 2, 6,  8);
  ctx.fillRect(x + w - 6,  y + h/2 + 2, 6,  8);
  // Front gun barrels
  ctx.fillRect(x + 10,     y + 2,    4, 6);
  ctx.fillRect(x + w - 14, y + 2,    4, 6);
  // Bridge windows
  ctx.fillStyle = C.bg;
  ctx.fillRect(x + 14,     y + 6, 4, 5);
  ctx.fillRect(x + w - 18, y + 6, 4, 5);
  // Engine glow (animated)
  if (f === 0) {
    ctx.fillStyle = '#ff4400';
    ctx.fillRect(x + 8,      y + h - 4, 8, 4);
    ctx.fillRect(x + w - 16, y + h - 4, 8, 4);
  } else {
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(x + 8,      y + h - 6, 8, 6);
    ctx.fillRect(x + w - 16, y + h - 6, 8, 6);
  }
}

// ============================================================
//  DRAW
// ============================================================
function draw() {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (gameState === 'start')    { drawStartScreen();    return; }
  if (gameState === 'gameover') { drawGameOverScreen(); return; }
  if (gameState === 'win')      { updateFiesta(); drawWinScreen(); return; }

  drawStars();
  drawShields();
  drawEnemies();
  drawKillEffects();
  drawPlayerBullets();
  drawEnemyBullets();
  drawTrumpBullets();
  drawPlayer();
  drawTrump();
  drawHUD();

  if (introActive) drawIntroOverlay();
}

function drawStars() {
  for (const s of stars) {
    ctx.fillStyle = `rgba(255,255,255,${s.a})`;
    ctx.fillRect(s.x, s.y, s.s, s.s);
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
    ctx.fillRect(x - w / 2,     y - h / 2 + 10, w,  h - 10);
    ctx.fillRect(x - 10,        y - h / 2,       20, 12);
    ctx.fillRect(x - w / 2,     y + h / 2 - 8,   8,  8);
    ctx.fillRect(x + w / 2 - 8, y + h / 2 - 8,   8,  8);
    ctx.fillRect(x - 2,         y - h / 2 - 6,   4,  8);
  }
}

function drawEnemies() {
  for (const e of enemies) {
    if (!e.alive) continue;
    let color;
    if (e.row === 0)   color = C.fighter;
    else if (e.row <= 2) color = C.cruiser;
    else               color = C.battleship;

    ctx.fillStyle = color;
    if (e.row === 0)      drawFighter   (e.x, e.y, e.w, e.h, e.animFrame);
    else if (e.row <= 2)  drawCruiser   (e.x, e.y, e.w, e.h, e.animFrame);
    else                  drawBattleship(e.x, e.y, e.w, e.h, e.animFrame);

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
    ctx.moveTo(ef.x - off, ef.y - off);
    ctx.lineTo(ef.x + off, ef.y + off);
    ctx.moveTo(ef.x + off, ef.y - off);
    ctx.lineTo(ef.x - off, ef.y + off);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.lineWidth   = 1;
  }
}

function drawIntroOverlay() {
  const progress = introTimer / INTRO_DURATION;
  const alpha    = progress > 0.15 ? 1 : progress / 0.15;

  ctx.globalAlpha = alpha * 0.88;
  ctx.fillStyle   = '#000011';
  ctx.fillRect(0, canvas.height / 2 - 80, canvas.width, 140);

  ctx.globalAlpha = alpha;
  ctx.textAlign   = 'center';
  ctx.font        = 'bold 32px "Courier New"';
  ctx.fillStyle   = '#ffd93d';
  ctx.shadowColor = '#ffd93d';
  ctx.shadowBlur  = 24;
  ctx.fillText('קדימה משחררים את', canvas.width / 2, canvas.height / 2 - 10);
  ctx.fillText('מיצרי הורמוז!', canvas.width / 2, canvas.height / 2 + 38);
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
  ctx.font      = '16px serif';
  ctx.textAlign = 'center';
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

function drawTrumpBullets() {
  // Gold bullets going downward
  ctx.fillStyle = '#ffd700';
  for (const b of trumpBullets) {
    ctx.fillRect(b.x,     b.y,     b.w, 5);
    ctx.fillRect(b.x - 2, b.y + 5, b.w, 5);
    ctx.fillRect(b.x + 2, b.y + 10, b.w, 4);
  }
}

function drawTrump() {
  if (!trump) return;
  if (trumpImg.loaded) {
    ctx.drawImage(trumpImg, trump.x, trump.y - 6, trump.w, trump.h + 12);
  } else {
    // Fallback shape
    ctx.fillStyle = C.trump;
    ctx.fillRect(trump.x + 10, trump.y + 8,  trump.w - 20, trump.h - 8);
    ctx.fillRect(trump.x + 4,  trump.y + 4,  trump.w - 8,  trump.h - 4);
    ctx.fillRect(trump.x + 16, trump.y,      trump.w - 32, 8);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(trump.x + 12, trump.y + 10, 6, 6);
    ctx.fillRect(trump.x + 24, trump.y + 10, 6, 6);
    ctx.fillRect(trump.x + 36, trump.y + 10, 6, 6);
  }
  ctx.font      = 'bold 8px "Courier New"';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'center';
  ctx.fillText('TRUMP  150pts', trump.x + trump.w / 2, trump.y - 8);
}

function drawHUD() {
  ctx.font      = 'bold 18px "Courier New"';
  ctx.fillStyle = C.text;
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
  ctx.fillText('STRAIT OF HORMUZ', canvas.width / 2, 110);

  ctx.font        = 'bold 26px "Courier New"';
  ctx.fillStyle   = '#ffd93d';
  ctx.shadowColor = '#ffd93d';
  ctx.fillText('מיצר הורמוז', canvas.width / 2, 155);
  ctx.shadowBlur  = 0;

  // Ship legend
  const legendY  = [230, 278, 326];
  const labels   = ['= 50 PTS  FIGHTER', '= 20 PTS  CRUISER', '= 10 PTS  BATTLESHIP'];
  const colours  = [C.fighter, C.cruiser, C.battleship];
  const drawFns  = [drawFighter, drawCruiser, drawBattleship];

  ctx.font = '16px "Courier New"';
  for (let i = 0; i < 3; i++) {
    const ix = canvas.width / 2 - 110;
    const iy = legendY[i] - 22;
    ctx.fillStyle = colours[i];
    drawFns[i](ix, iy, 36, 28, 0);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(labels[i], canvas.width / 2 - 60, legendY[i]);
  }

  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'center';
  ctx.font      = '15px "Courier New"';
  ctx.fillText('TRUMP = 150 PTS  (also shoots ships!)', canvas.width / 2, 385);

  ctx.fillStyle = '#888';
  ctx.font      = '16px "Courier New"';
  ctx.fillText('← →  MOVE      SPACE  SHOOT', canvas.width / 2, 435);

  if (Math.floor(Date.now() / 550) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 22px "Courier New"';
    ctx.fillText('PRESS  ENTER  /  TAP  TO  START', canvas.width / 2, 510);
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

  ctx.font      = 'bold 26px "Courier New"';
  ctx.fillStyle = C.text;
  ctx.fillText(`SCORE  :  ${score}`,        canvas.width / 2, 300);
  ctx.fillText(`HI-SCORE  :  ${highScore}`, canvas.width / 2, 340);

  if (Math.floor(Date.now() / 550) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 20px "Courier New"';
    ctx.fillText('PRESS  ENTER  /  TAP  TO  PLAY  AGAIN', canvas.width / 2, 430);
  }
}

function drawFiesta() {
  for (const c of confetti) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.restore();
  }
  for (const b of balloons) {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.r, b.r * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.r * 1.25);
    ctx.lineTo(b.x - 3, b.y + b.r * 1.25 + 5);
    ctx.lineTo(b.x + 3, b.y + b.r * 1.25 + 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.r * 1.25 + 5);
    ctx.quadraticCurveTo(b.x + 10, b.y + b.r * 2 + 20, b.x, b.y + b.r * 2 + 40);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
}

function drawWinScreen() {
  drawFiesta();

  ctx.textAlign   = 'center';
  ctx.font        = 'bold 40px "Courier New"';
  ctx.fillStyle   = '#ffd93d';
  ctx.shadowColor = '#ffd93d';
  ctx.shadowBlur  = 30;
  ctx.fillText('עכשיו כולם יכולים', canvas.width / 2, 190);
  ctx.fillText('לשוט בביטחה!', canvas.width / 2, 250);
  ctx.shadowBlur  = 0;

  ctx.font        = 'bold 30px "Courier New"';
  ctx.fillStyle   = '#ff6b6b';
  ctx.shadowColor = '#ff6b6b';
  ctx.shadowBlur  = 20;
  ctx.fillText('שלב הבא:', canvas.width / 2, 325);
  ctx.fillText('מטפלים בגרעין!!!', canvas.width / 2, 370);
  ctx.shadowBlur  = 0;

  ctx.font      = 'bold 18px "Courier New"';
  ctx.fillStyle = C.text;
  ctx.fillText(`SCORE: ${score}   HI: ${highScore}`, canvas.width / 2, 430);

  if (Math.floor(Date.now() / 550) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 18px "Courier New"';
    ctx.fillText('PRESS  ENTER  /  TAP  TO  PLAY  AGAIN', canvas.width / 2, 500);
  }
}

// ============================================================
//  MAIN GAME LOOP
// ============================================================
function gameLoop() {
  update();
  draw();
  animId = requestAnimationFrame(gameLoop);
}

// ============================================================
//  MOBILE TOUCH CONTROLS
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

btnStart.addEventListener('touchstart', e => { e.preventDefault(); if (gameState !== 'playing') startGame(); }, { passive: false });
btnStart.addEventListener('click',      () => { if (gameState !== 'playing') startGame(); });

canvas.addEventListener('touchstart', e => { e.preventDefault(); if (gameState !== 'playing') startGame(); }, { passive: false });
canvas.addEventListener('click',      () => { if (gameState !== 'playing') startGame(); });

// Boot
gameLoop();
