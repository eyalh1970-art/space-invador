// ============================================================
//  IDV1 – Space Invaders: All 3 Levels United (v2 images)
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// ── IMAGES ──────────────────────────────────────────────────
function loadImg(src) {
  const img = new Image();
  img.src = src;
  img.loaded = false;
  img.onload = () => { img.loaded = true; };
  return img;
}
const iranImg    = loadImg('haminahi.jpg');   // Khamenei
const lebanonImg = loadImg('nassrala2.jpg');  // Nasrallah
const sinuarImg  = loadImg('sinuar2.jpg');    // Sinuar
const bibiImg    = loadImg('bibi2.jpg');      // Bibi v2
const katzImg    = loadImg('katz2.jpg');      // Katz v2
const sShipImg   = loadImg('S-Ship.jpeg');
const mShipImg   = loadImg('M-ship.jpeg');
const bShipImg   = loadImg('B-ship.jpeg');
const trumpImg   = loadImg('trump2.jpg');     // Trump v2
const nuclearImg = loadImg('nuclear2.jpg');
// ── SPLASH SCREEN IMAGES ────────────────────────────────────
const bibi1Img  = loadImg('Bibi1.jpg');
const trump1Img = loadImg('Trump1.jpg');
const f35Img    = loadImg('F35.jpg');
const f15Img    = loadImg('F15.jpg');
const b1Img     = loadImg('B1.jpg');

canvas.width  = 800;
canvas.height = 620;

// ── SOUND ────────────────────────────────────────────────────
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq, type, duration, gainVal, startFreq) {
  try {
    const ac = getAudioCtx(), osc = ac.createOscillator(), gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(startFreq || freq, ac.currentTime);
    if (startFreq) osc.frequency.exponentialRampToValueAtTime(freq, ac.currentTime + duration);
    gain.gain.setValueAtTime(gainVal || 0.3, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.start(ac.currentTime); osc.stop(ac.currentTime + duration);
  } catch (e) {}
}
function playNoise(duration, gainVal) {
  try {
    const ac = getAudioCtx(), bufLen = Math.floor(ac.sampleRate * duration);
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(), gain = ac.createGain();
    src.buffer = buf;
    gain.gain.setValueAtTime(gainVal || 0.3, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    src.connect(gain); gain.connect(ac.destination); src.start();
  } catch (e) {}
}
function soundShoot()       { playTone(880, 'square',   0.08, 0.2); }
function soundKill()        { playNoise(0.3, 0.5); playTone(180, 'sawtooth', 0.35, 0.35, 700); }
function soundPlayerHit()   { playTone(110, 'sawtooth', 0.55, 0.45); }
function soundUFO()         { playTone(440, 'sine', 0.15, 0.15); }
function soundTrumpShoot()  { playTone(660, 'square', 0.1, 0.25); }
function soundFacilityHit() { playTone(200, 'square', 0.12, 0.4); playNoise(0.08, 0.3); }
function soundExplosion() {
  playNoise(1.2, 1.0); playTone(55, 'sawtooth', 1.5, 0.8, 200);
  setTimeout(() => playNoise(0.6, 0.6), 350);
  setTimeout(() => { playNoise(0.4, 0.4); playTone(40, 'sine', 0.8, 0.5, 100); }, 700);
  setTimeout(() => playNoise(0.3, 0.3), 1100);
}
function soundWin() {
  const notes = [523,523,784,784,880,880,784,698,698,659,659,587,587,523];
  notes.forEach((f,i) => setTimeout(() => playTone(f,'square',0.18,0.3), i*190));
  [0,380,760,1140,1520].forEach(ms => setTimeout(() => playNoise(0.08,0.25), ms));
}

// ── COLOURS ──────────────────────────────────────────────────
const C = {
  bg: '#000011', player: '#00ff41', playerBullet: '#00ff41',
  enemy1: '#ff6b6b', enemy2: '#ffd93d', enemy3: '#6bcb77',
  fighter: '#00e5ff', cruiser: '#ffd93d', battleship: '#ff6b6b',
  enemyBullet: '#ff4444', shield: '#4ecdc4', ufo: '#c77dff',
  trump: '#ff8c00', text: '#00ff41',
};

// ── GAME STATE ───────────────────────────────────────────────
let gameState    = 'splash';
let currentLevel = 1;
let score        = 0;
let highScore    = 0;
let animId;
let introActive  = false;
let introTimer   = 0;
const INTRO_DURATION = 300;
let ufoMsgTimer  = 0;
const UFO_MSG_DURATION = 120;
const killEffects = [], confetti = [], balloons = [];
const BALLOON_COLORS  = ['#ff4444','#ffd93d','#00ff41','#4ecdc4','#c77dff','#ff6b9d'];
const CONFETTI_COLORS = ['#ff4444','#ffd93d','#ffffff','#4ecdc4','#c77dff','#ff6b9d','#6bcb77'];
const KILL_EFFECT_FRAMES = 60;

// ── NUCLEAR FACILITY (level 3) ───────────────────────────────
const facilityX = 280, facilityY = 128, facilityW = 240, facilityH = 130;
let facilityDamage = 0, damageDisplayTimer = 0;
const DAMAGE_DISPLAY_DURATION = 120;

// ── EXPLOSION (level 3) ──────────────────────────────────────
let explosionTimer = 0;
const explosionParticles = [], explosionSmoke = [], explosionDebris = [], shockwaves = [];
let screenShake = 0;
const EXPLOSION_DURATION = 210;

// ── INPUT ─────────────────────────────────────────────────────
const keys = { ArrowLeft: false, ArrowRight: false, Space: false };
let spaceJustPressed = false;
document.addEventListener('keydown', e => {
  if (e.code in keys) {
    e.preventDefault();
    if (e.code === 'Space' && !keys.Space) spaceJustPressed = true;
    keys[e.code] = true;
  }
  if (e.code === 'Enter') handleStart();
});
document.addEventListener('keyup', e => {
  if (e.code in keys) { e.preventDefault(); keys[e.code] = false; }
});

// ── PLAYER ────────────────────────────────────────────────────
const player = {
  x: canvas.width / 2, y: canvas.height - 80,
  w: 50, h: 40, speed: 5, lives: 4,
  invincible: false, invincibleTimer: 0, INV_DURATION: 120,
};

// ── BULLETS ───────────────────────────────────────────────────
const playerBullets = [], enemyBullets = [], trumpBullets = [];
const PLAYER_BULLET_SPEED = 9, ENEMY_BULLET_SPEED = 4, TRUMP_BULLET_SPEED = 3;

// ── ENEMIES ───────────────────────────────────────────────────
// Face image size: 52×52 px (uniform for all characters)
const FACE = 52;
const COLS = 11, ROWS = 5, EW = 36, EH = 28, HGAP = 16, VGAP = 18;
let enemies = [], enemyDir = 1, enemyBaseSpeed = 1.5;
let enemyMoveTimer = 0, enemyMoveInterval = 40;
let enemyShootTimer = 0, enemyShootInterval = 60;

// ── UFO ───────────────────────────────────────────────────────
let ufo = null, ufoTimer = 0;
const UFO_INTERVAL = 700;
let trumpShootTimer = 0;
const TRUMP_SHOOT_INTERVAL = 100;

// ── SHIELDS ───────────────────────────────────────────────────
const SHIELD_COUNT = 4, PX = 4;
let shields = [];

// ── SPLASH MUSIC ──────────────────────────────────────────────
let splashMusicOn = false, splashMusicLoop = null;

function startSplashMusic() {
  if (splashMusicOn) return;
  splashMusicOn = true;
  const ac = getAudioCtx();
  if (ac.state === 'suspended') ac.resume();
  scheduleSplashMusic(ac.currentTime + 0.05);
}
function stopSplashMusic() {
  splashMusicOn = false;
  if (splashMusicLoop) { clearTimeout(splashMusicLoop); splashMusicLoop = null; }
}
function scheduleSplashMusic(t0) {
  if (!splashMusicOn) return;
  const ac = getAudioCtx();
  // ── Cinematic Majestic Theme — Eb major, 80 BPM, 16 beats ──
  const bpm = 80, b = 60 / bpm;  // slow & majestic
  const BEATS = 16;

  // ── Helpers ──────────────────────────────────────────────
  function softPad(freq, start, dur, vol) {
    const osc = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
    osc.type = 'sine'; osc.frequency.value = freq;
    lp.type = 'lowpass'; lp.frequency.value = 1200;
    osc.connect(lp); lp.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.001, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.5);
    g.gain.setValueAtTime(vol, start + dur - 0.5);
    g.gain.linearRampToValueAtTime(0.001, start + dur);
    osc.start(start); osc.stop(start + dur + 0.1);
  }

  function melody(freq, start, dur, vol) {
    const osc = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
    osc.type = 'triangle'; osc.frequency.value = freq;
    lp.type = 'lowpass'; lp.frequency.value = 2000;
    osc.connect(lp); lp.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.001, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.12);
    g.gain.setValueAtTime(vol, start + dur - 0.15);
    g.gain.linearRampToValueAtTime(0.001, start + dur);
    osc.start(start); osc.stop(start + dur + 0.05);
  }

  function pulse(t) {  // soft cinematic heartbeat
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = 'sine'; osc.frequency.value = 55;
    osc.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.start(t); osc.stop(t + 0.56);
  }

  // ── CHORD PADS — Eb major progression (cinematic, majestic) ──
  // Eb(311,392,466) → Cm(261,311,392) → Ab(207,261,311) → Bb(233,293,349)
  const prog = [
    [311.13, 392.00, 466.16],   // Eb major
    [261.63, 311.13, 392.00],   // C minor
    [207.65, 261.63, 311.13],   // Ab major
    [233.08, 293.66, 349.23],   // Bb major
  ];
  for (let i = 0; i < 4; i++) {
    const t = t0 + i * 4 * b;
    for (const f of prog[i]) softPad(f, t, 4.4 * b, 0.055);  // gentle chord pads
    softPad(prog[i][1] * 2, t + 0.05, 4.2 * b, 0.030);        // upper shimmer
  }

  // ── BASS PULSE (soft heartbeat every 2 beats) ────────────
  for (let i = 0; i < BEATS; i += 2) pulse(t0 + i * b);

  // ── MELODY — gentle heroic line (triangle, quiet) ─────────
  // Bar 1 (Eb): Eb5 → G5 (rising hope)
  melody(622.25, t0 + 0.5*b, 1.8*b, 0.12);   // Eb5
  melody(783.99, t0 + 2.5*b, 1.3*b, 0.11);   // G5

  // Bar 2 (Cm): G5 → F5 → Eb5 (answer)
  melody(783.99, t0 + 4.5*b, 0.9*b, 0.11);   // G5
  melody(698.46, t0 + 5.5*b, 0.9*b, 0.10);   // F5
  melody(622.25, t0 + 6.5*b, 1.2*b, 0.11);   // Eb5

  // Bar 3 (Ab): C5 → Bb4 → G4 (descent)
  melody(523.25, t0 + 8.5*b, 0.9*b, 0.10);   // C5
  melody(466.16, t0 + 9.5*b, 0.9*b, 0.09);   // Bb4
  melody(392.00, t0 + 10.5*b, 1.2*b, 0.10);  // G4

  // Bar 4 (Bb): Bb4 → C5 → Eb5 (resolve upward, ready to loop)
  melody(466.16, t0 + 12.5*b, 0.9*b, 0.10);  // Bb4
  melody(523.25, t0 + 13.5*b, 0.9*b, 0.11);  // C5
  melody(622.25, t0 + 14.5*b, 1.3*b, 0.12);  // Eb5

  const loopMs = BEATS * b * 1000;
  splashMusicLoop = setTimeout(() => scheduleSplashMusic(ac.currentTime + 0.02), loopMs - 50);
}

// ── SPLASH PLANES ─────────────────────────────────────────────
const splashPlanes = [
  { get img(){ return f35Img; }, x:  940, y: 162, speed: 3.2, w: 118, h: 46, dir: -1 },
  { get img(){ return f15Img; }, x: -130, y: 216, speed: 2.4, w: 102, h: 40, dir:  1 },
  { get img(){ return b1Img;  }, x: -220, y: 185, speed: 2.1, w: 155, h: 52, dir:  1 },
];

// ── STARFIELD ─────────────────────────────────────────────────
const stars = Array.from({ length: 70 }, () => ({
  x: Math.random() * canvas.width, y: Math.random() * canvas.height,
  s: Math.random() * 1.5 + 0.3,   a: Math.random() * 0.6 + 0.3,
}));

// ── SETUP ─────────────────────────────────────────────────────
function createEnemies() {
  enemies = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (currentLevel === 3 && row >= 1 && row <= 3 && col >= 3 && col <= 7) continue;
      enemies.push({
        x: 80 + col * (EW + HGAP), y: 80 + row * (EH + VGAP),
        w: EW, h: EH, row, col, alive: true, animFrame: 0,
      });
    }
  }
}
function buildShieldPixels() {
  const W = 15, H = 10, grid = [];
  for (let r = 0; r < H; r++) {
    grid[r] = [];
    for (let c = 0; c < W; c++) {
      let s = true;
      if (r < 2 && c < 2) s = false;
      if (r < 2 && c >= W-2) s = false;
      if (r >= H-3 && c >= 4 && c <= W-5) s = false;
      grid[r][c] = s ? 1 : 0;
    }
  }
  return grid;
}
function createShields() {
  shields = [];
  const spacing = canvas.width / (SHIELD_COUNT + 1);
  for (let i = 0; i < SHIELD_COUNT; i++) {
    shields.push({ x: spacing*(i+1) - (15*PX)/2, y: canvas.height-130, pixels: buildShieldPixels() });
  }
}

// ── SPEECH ────────────────────────────────────────────────────
let hebrewVoice = null;
function loadHebrewVoice() {
  const voices = window.speechSynthesis.getVoices();
  hebrewVoice = voices.find(v => v.lang.startsWith('he') && /male|moshe|avi|david/i.test(v.name))
             || voices.find(v => v.lang.startsWith('he')) || null;
}
window.speechSynthesis.onvoiceschanged = loadHebrewVoice;
loadHebrewVoice();
function speakHebrew(text, pitch) {
  try {
    window.speechSynthesis.cancel();
    setTimeout(() => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'he-IL'; u.rate = 0.82; u.pitch = pitch || 0.3; u.volume = 1;
      window.speechSynthesis.speak(u);
    }, 100);
  } catch (e) {}
}
function speakIntro() {
  if (currentLevel === 1) speakHebrew('אני מת על קפה ועדיף רותח!', 0.35);
  else if (currentLevel === 2) speakHebrew('קדימה, משחררים את מיצרי הורמוז!', 0.35);
  else speakHebrew('יאללה, לסיים עם הגרעין!', 0.35);
}
function speakLevelWin() {
  if (currentLevel === 1) speakHebrew('כל הכבוד! קדימה למיצר הורמוז!', 0.4);
  else if (currentLevel === 2) speakHebrew('מצוין! קדימה לאתר הגרעין!', 0.4);
}
function speakFinalWin() {
  speakHebrew('נגמרה המלחמה! איראן חופשית!', 0.4);
  setTimeout(() => speakHebrew('בואי שרה, יש בחירות!', 0.7), 3500);
}
function speakUFOHit() {
  if (currentLevel === 1) speakHebrew('מה אתה עושה ביבי? אני רוצה מיץ!', 1.4);
  else if (currentLevel === 2) speakHebrew('ביבי תתרכז באויב!', 0.6);
}

// ── GAME FLOW ─────────────────────────────────────────────────
function handleStart() {
  if (gameState === 'splash') { startSplashMusic(); gameState = 'start'; return; }
  if (gameState === 'start' || gameState === 'gameover') {
    currentLevel = 1; score = 0; startLevel();
  } else if (gameState === 'levelcomplete') {
    currentLevel++;
    startLevel();
  } else if (gameState === 'win') {
    currentLevel = 1; score = 0; startLevel();
  }
}

function startLevel() {
  stopSplashMusic();
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  facilityDamage = 0; damageDisplayTimer = 0;
  player.x = canvas.width / 2; player.lives = 4;
  player.invincible = false; player.invincibleTimer = 0;

  playerBullets.length = 0; enemyBullets.length = 0; trumpBullets.length = 0;
  killEffects.length = 0; explosionParticles.length = 0;
  explosionSmoke.length = 0; explosionDebris.length = 0;
  shockwaves.length = 0; screenShake = 0;

  enemyDir = 1; enemyBaseSpeed = 1.5; enemyMoveTimer = 0;
  enemyMoveInterval = 40; enemyShootTimer = 0; enemyShootInterval = 60;
  ufo = null; ufoTimer = 0; trumpShootTimer = 0; ufoMsgTimer = 0;

  introActive = true; introTimer = INTRO_DURATION;
  speakIntro();
  createEnemies(); createShields();
  gameState = 'playing';
  if (animId) cancelAnimationFrame(animId);
  gameLoop();
}

function levelComplete() {
  gameState = 'levelcomplete';
  if (score > highScore) highScore = score;
  soundWin();
  speakLevelWin();
  spawnFiesta();
}

function endGame(result) {
  gameState = result;
  if (score > highScore) highScore = score;
  if (result === 'win') { soundWin(); speakFinalWin(); spawnFiesta(); }
}

// ── EXPLOSION HELPERS ─────────────────────────────────────────
function spawnFireBurst(cx, cy, count, sm) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, sp = (Math.random() * 9 + 3) * sm;
    explosionParticles.push({
      x: cx+(Math.random()-.5)*50, y: cy+(Math.random()-.5)*30,
      vx: Math.cos(a)*sp, vy: Math.sin(a)*sp-5,
      size: Math.random()*16+4,
      color: ['#ff0000','#ff2200','#ff5500','#ff8800','#ffbb00','#ffee00','#ffffff'][Math.floor(Math.random()*7)],
      life:1.0, decay:Math.random()*0.01+0.005, gravity:0.18,
    });
  }
}
function spawnDebris(cx, cy, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random()*Math.PI*2, sp = Math.random()*12+4;
    explosionDebris.push({
      x: cx+(Math.random()-.5)*40, y: cy+(Math.random()-.5)*20,
      vx: Math.cos(a)*sp, vy: Math.sin(a)*sp-6,
      w: Math.random()*10+4, h: Math.random()*6+3,
      angle: Math.random()*Math.PI*2, spin:(Math.random()-.5)*0.3,
      color:['#333','#555','#888','#664400','#442200'][Math.floor(Math.random()*5)],
      life:1.0, decay:Math.random()*0.008+0.004, gravity:0.25,
    });
  }
}
function spawnSmokePuff(cx, cy, count) {
  for (let i = 0; i < count; i++) {
    explosionSmoke.push({
      x: cx+(Math.random()-.5)*90, y: cy+(Math.random()-.5)*30,
      vx:(Math.random()-.5)*2.5, vy:-(Math.random()*2.5+0.6),
      size:Math.random()*32+18, gray:Math.floor(Math.random()*60+30),
      life:1.0, decay:Math.random()*0.003+0.0015,
    });
  }
}
function startExplosion() {
  gameState = 'exploding'; explosionTimer = 0; screenShake = 30;
  const cx = facilityX+facilityW/2, cy = facilityY+facilityH/2;
  spawnFireBurst(cx,cy,160,1.0); spawnDebris(cx,cy,60); spawnSmokePuff(cx,cy,80);
  shockwaves.push({x:cx,y:cy,radius:8,speed:12,alpha:1.0,width:6});
  shockwaves.push({x:cx,y:cy,radius:4,speed:7,alpha:0.7,width:3});
  soundExplosion();
  setTimeout(() => { spawnFireBurst(cx-60,cy+20,80,0.8); spawnDebris(cx-60,cy+20,30); shockwaves.push({x:cx-60,y:cy+20,radius:5,speed:9,alpha:0.85,width:4}); screenShake=20; playNoise(0.7,0.85); playTone(50,'sawtooth',0.9,0.6,160); }, 400);
  setTimeout(() => { spawnFireBurst(cx+50,cy-10,80,0.8); spawnDebris(cx+50,cy-10,30); shockwaves.push({x:cx+50,y:cy-10,radius:5,speed:9,alpha:0.85,width:4}); screenShake=20; playNoise(0.6,0.75); playTone(45,'sawtooth',0.8,0.5,140); }, 850);
  setTimeout(() => { spawnFireBurst(cx,cy-30,100,1.2); shockwaves.push({x:cx,y:cy,radius:6,speed:14,alpha:1.0,width:7}); screenShake=25; playNoise(1.0,1.0); playTone(40,'sine',1.2,0.7,200); }, 1300);
}

// ── FIESTA ────────────────────────────────────────────────────
function spawnFiesta() {
  confetti.length = 0; balloons.length = 0;
  for (let i = 0; i < 120; i++) confetti.push({ x:Math.random()*canvas.width, y:Math.random()*-canvas.height, w:Math.random()*10+4, h:Math.random()*6+3, color:CONFETTI_COLORS[Math.floor(Math.random()*CONFETTI_COLORS.length)], speed:Math.random()*2.5+1, drift:(Math.random()-.5)*1.5, angle:Math.random()*Math.PI*2, spin:(Math.random()-.5)*0.15 });
  for (let i = 0; i < 10; i++) balloons.push({ x:Math.random()*canvas.width, y:canvas.height+60+Math.random()*200, r:Math.random()*18+14, color:BALLOON_COLORS[Math.floor(Math.random()*BALLOON_COLORS.length)], speed:Math.random()*1.2+0.6, drift:(Math.random()-.5)*0.8 });
}
function updateFiesta() {
  for (const c of confetti) { c.y+=c.speed; c.x+=c.drift; c.angle+=c.spin; if(c.y>canvas.height+20){c.y=-10;c.x=Math.random()*canvas.width;} }
  for (const b of balloons) { b.y-=b.speed; b.x+=b.drift; if(b.y<-80){b.y=canvas.height+60;b.x=Math.random()*canvas.width;} }
}

// ── COLLISION ─────────────────────────────────────────────────
function aabb(a, b) {
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}

// ── UPDATE ────────────────────────────────────────────────────
function update() {
  if (gameState === 'exploding') { updateExplosion(); return; }
  if (gameState !== 'playing') return;

  if (introActive) { introTimer--; if (introTimer <= 0) introActive = false; }
  if (damageDisplayTimer > 0) damageDisplayTimer--;
  if (ufoMsgTimer > 0) ufoMsgTimer--;
  for (let i = killEffects.length-1; i >= 0; i--) { killEffects[i].timer--; if(killEffects[i].timer<=0) killEffects.splice(i,1); }

  updatePlayer();
  updatePlayerBullets();
  updateEnemies();
  updateEnemyShooting();
  updateEnemyBullets();
  if (currentLevel !== 3) updateUFO();
  if (currentLevel === 2) updateTrumpBullets();
  checkEndConditions();
}

function updateExplosion() {
  explosionTimer++;
  if (screenShake > 0) screenShake -= 2;
  for (let i = shockwaves.length-1; i >= 0; i--) { const sw=shockwaves[i]; sw.radius+=sw.speed; sw.alpha-=0.018; sw.speed*=0.95; if(sw.alpha<=0) shockwaves.splice(i,1); }
  for (let i = explosionParticles.length-1; i >= 0; i--) { const p=explosionParticles[i]; p.x+=p.vx; p.y+=p.vy; p.vy+=p.gravity; p.vx*=0.97; p.size*=0.995; p.life-=p.decay; if(p.life<=0) explosionParticles.splice(i,1); }
  for (let i = explosionDebris.length-1; i >= 0; i--) { const d=explosionDebris[i]; d.x+=d.vx; d.y+=d.vy; d.vy+=d.gravity; d.vx*=0.98; d.angle+=d.spin; d.life-=d.decay; if(d.life<=0) explosionDebris.splice(i,1); }
  if (explosionTimer < 150 && explosionTimer % 2 === 0) {
    const cx=facilityX+facilityW/2, cy=facilityY+facilityH/2;
    for (let i=0;i<8;i++) { const a=Math.random()*Math.PI*2,sp=Math.random()*7+1; explosionParticles.push({x:cx+(Math.random()-.5)*100,y:cy+(Math.random()-.5)*60,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,size:Math.random()*12+3,color:['#ff0000','#ff4400','#ff8800','#ffcc00'][Math.floor(Math.random()*4)],life:1.0,decay:Math.random()*0.016+0.007,gravity:0.13}); }
  }
  if (explosionTimer < 180 && explosionTimer % 4 === 0) { const cx=facilityX+facilityW/2; explosionSmoke.push({x:cx+(Math.random()-.5)*100,y:facilityY+Math.random()*30,vx:(Math.random()-.5)*1.5,vy:-(Math.random()*1.8+0.4),size:Math.random()*22+12,gray:Math.floor(Math.random()*60+30),life:1.0,decay:0.003}); }
  for (let i = explosionSmoke.length-1; i >= 0; i--) { const s=explosionSmoke[i]; s.x+=s.vx; s.y+=s.vy; s.size+=0.4; s.life-=s.decay; if(s.life<=0) explosionSmoke.splice(i,1); }
  if (explosionTimer >= EXPLOSION_DURATION) endGame('win');
}

function updatePlayer() {
  if (keys.ArrowLeft)  player.x -= player.speed;
  if (keys.ArrowRight) player.x += player.speed;
  const hw = player.w/2;
  player.x = Math.max(hw, Math.min(canvas.width-hw, player.x));
  if (spaceJustPressed) {
    spaceJustPressed = false;
    if (playerBullets.length < 1) { playerBullets.push({x:player.x-2, y:player.y-player.h/2, w:4, h:14}); soundShoot(); }
  }
  if (player.invincible) { player.invincibleTimer--; if(player.invincibleTimer<=0) player.invincible=false; }
}

function updatePlayerBullets() {
  for (let i = playerBullets.length-1; i >= 0; i--) {
    const b = playerBullets[i];
    b.y -= PLAYER_BULLET_SPEED;
    if (b.y+b.h < 0) { playerBullets.splice(i,1); continue; }
    let hit = false;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (aabb(b,e)) { e.alive=false; score+=getRowPoints(e.row); killEffects.push({x:e.x+e.w/2,y:e.y+e.h/2,timer:KILL_EFFECT_FRAMES}); soundKill(); playerBullets.splice(i,1); speedUpEnemies(); hit=true; break; }
    }
    if (hit) continue;
    if (checkBulletVsShield(b, playerBullets, i)) continue;
    // UFO hit
    if (ufo && aabb(b, ufo)) {
      score += ufo.points; soundKill(); speakUFOHit();
      ufoMsgTimer = UFO_MSG_DURATION;
      ufo = null; playerBullets.splice(i,1); continue;
    }
    // Level 3: nuclear facility hit
    if (currentLevel === 3) {
      const fBox = {x:facilityX, y:facilityY, w:facilityW, h:facilityH};
      if (aabb(b, fBox)) {
        facilityDamage = Math.min(100, facilityDamage+1);
        damageDisplayTimer = DAMAGE_DISPLAY_DURATION;
        soundFacilityHit();
        enemyShootInterval = Math.max(5, Math.floor(enemyShootInterval/2));
        playerBullets.splice(i,1);
        if (facilityDamage >= 100) startExplosion();
      }
    }
  }
}

function getRowPoints(row) {
  return [50, 20, 20, 10, 10][row] || 10;
}

function updateEnemyBullets() {
  for (let i = enemyBullets.length-1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.y += ENEMY_BULLET_SPEED;
    if (b.y > canvas.height) { enemyBullets.splice(i,1); continue; }
    if (checkBulletVsShield(b, enemyBullets, i)) continue;
    if (!player.invincible) {
      const pBox = {x:player.x-player.w/2, y:player.y-player.h/2, w:player.w, h:player.h};
      if (aabb(b, pBox)) { enemyBullets.splice(i,1); damagePlayer(); }
    }
  }
}

function updateTrumpBullets() {
  for (let i = trumpBullets.length-1; i >= 0; i--) {
    const b = trumpBullets[i];
    b.y += TRUMP_BULLET_SPEED;
    if (b.y > canvas.height) { trumpBullets.splice(i,1); continue; }
    let hit = false;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (aabb(b,e)) { e.alive=false; killEffects.push({x:e.x+e.w/2,y:e.y+e.h/2,timer:KILL_EFFECT_FRAMES}); soundKill(); trumpBullets.splice(i,1); speedUpEnemies(); hit=true; break; }
    }
  }
}

function damagePlayer() {
  player.lives--; player.invincible=true; player.invincibleTimer=player.INV_DURATION; soundPlayerHit();
  if (player.lives <= 0) endGame('gameover');
}

function checkBulletVsShield(bullet, arr, idx) {
  for (const sh of shields) {
    const shW=sh.pixels[0].length*PX, shH=sh.pixels.length*PX;
    if (!aabb(bullet,{x:sh.x,y:sh.y,w:shW,h:shH})) continue;
    for (let r=0;r<sh.pixels.length;r++) for (let c=0;c<sh.pixels[r].length;c++) {
      if (!sh.pixels[r][c]) continue;
      const px={x:sh.x+c*PX,y:sh.y+r*PX,w:PX,h:PX};
      if (aabb(bullet,px)) {
        sh.pixels[r][c]=0;
        if(r>0) sh.pixels[r-1][c]=0;
        if(r<sh.pixels.length-1) sh.pixels[r+1][c]=0;
        if(c>0) sh.pixels[r][c-1]=0;
        if(c<sh.pixels[r].length-1) sh.pixels[r][c+1]=0;
        arr.splice(idx,1); return true;
      }
    }
  }
  return false;
}

function updateEnemies() {
  enemyMoveTimer++;
  const alive = enemies.filter(e=>e.alive).length;
  enemyMoveInterval = Math.max(6, Math.floor(6 + (40-6)*(alive/(COLS*ROWS))));
  if (enemyMoveTimer < enemyMoveInterval) return;
  enemyMoveTimer = 0;
  let hitWall = false;
  for (const e of enemies) { if(!e.alive) continue; const nx=e.x+enemyBaseSpeed*enemyDir; if(nx<20||nx+e.w>canvas.width-20){hitWall=true;break;} }
  if (hitWall) { enemyDir*=-1; for(const e of enemies){if(e.alive)e.y+=20;} }
  else { for(const e of enemies){if(!e.alive)continue;e.x+=enemyBaseSpeed*enemyDir;e.animFrame=e.animFrame===0?1:0;} }
}

function speedUpEnemies() { enemyBaseSpeed = Math.min(enemyBaseSpeed+0.05, 6); }

function updateEnemyShooting() {
  enemyShootTimer++;
  if (enemyShootTimer < enemyShootInterval) return;
  enemyShootTimer = 0;
  const shooters = [];
  for (let col=0;col<COLS;col++) { const ca=enemies.filter(e=>e.alive&&e.col===col).sort((a,b)=>b.row-a.row); if(ca.length) shooters.push(ca[0]); }
  if (!shooters.length) return;
  const count = Math.random()<0.25?2:1;
  for (let i=0;i<count;i++) { const s=shooters[Math.floor(Math.random()*shooters.length)]; enemyBullets.push({x:s.x+s.w/2-2,y:s.y+s.h,w:4,h:12}); }
  enemyShootInterval = Math.max(25, enemyShootInterval-0.4);
}

function updateUFO() {
  ufoTimer++;
  if (!ufo && ufoTimer >= UFO_INTERVAL) {
    ufoTimer = 0; trumpShootTimer = 0;
    const left = Math.random() < 0.5;
    const points = currentLevel === 1 ? 100 : 150;
    ufo = { x:left?-70:canvas.width+10, y:44, w:60, h:24, speed:left?2.5:-2.5, points };
    soundUFO();
  }
  if (!ufo) return;
  ufo.x += ufo.speed;
  // Level 2: trump shoots at ships
  if (currentLevel === 2) {
    trumpShootTimer++;
    if (trumpShootTimer >= TRUMP_SHOOT_INTERVAL && trumpBullets.length === 0) {
      const alive = enemies.filter(e=>e.alive);
      if (alive.length > 0) { trumpShootTimer=0; soundTrumpShoot(); trumpBullets.push({x:ufo.x+ufo.w/2-2,y:ufo.y+ufo.h,w:5,h:14}); }
    }
  }
  if (ufo.x > canvas.width+80 || ufo.x+ufo.w < -80) ufo = null;
}

function checkEndConditions() {
  const alive = enemies.filter(e=>e.alive);
  if (alive.some(e=>e.y+e.h >= player.y-20)) { endGame('gameover'); return; }
  if (currentLevel !== 3 && alive.length === 0) {
    if (currentLevel < 3) levelComplete();
    else endGame('win');
  }
}

// ── DRAW ──────────────────────────────────────────────────────
function draw() {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (gameState === 'splash')        { updateSplashPlanes(); drawSplashScreen(); return; }
  if (gameState === 'start')         { drawStartScreen();         return; }
  if (gameState === 'gameover')      { drawGameOverScreen();       return; }
  if (gameState === 'win')           { updateFiesta(); drawWinScreen(); return; }
  if (gameState === 'levelcomplete') { updateFiesta(); drawLevelCompleteScreen(); return; }
  if (gameState === 'exploding')     { drawExplosionScreen();      return; }

  drawStars();
  if (currentLevel === 3) drawFacility();
  drawShields();
  drawEnemies();
  drawKillEffects();
  drawPlayerBullets();
  drawEnemyBullets();
  if (currentLevel === 2) drawTrumpBullets();
  drawPlayer();
  drawUFO();
  drawHUD();
  if (damageDisplayTimer > 0) drawDamageDisplay();
  if (ufoMsgTimer > 0) drawUFOMessage();
  if (introActive) drawIntroOverlay();
}

function drawStars() {
  for (const s of stars) { ctx.fillStyle=`rgba(255,255,255,${s.a})`; ctx.fillRect(s.x,s.y,s.s,s.s); }
}

// Helper: draw a face image centered on (cx, cy) at uniform FACE×FACE size
function drawFace(img, cx, cy) {
  const half = FACE / 2;
  ctx.drawImage(img, cx - half, cy - half, FACE, FACE);
}

function drawPlayer() {
  if (player.invincible && Math.floor(player.invincibleTimer/6)%2===0) return;
  const x=player.x, y=player.y, w=player.w, h=player.h;
  if (bibiImg.loaded) {
    drawFace(bibiImg, x, y);
    ctx.font='bold 9px "Courier New"'; ctx.fillStyle='#ffd93d'; ctx.textAlign='center';
    ctx.fillText('007 Pichincha', x, y + FACE/2 + 10);
  } else {
    ctx.fillStyle=C.player;
    ctx.fillRect(x-w/2,y-h/2+10,w,h-10); ctx.fillRect(x-10,y-h/2,20,12); ctx.fillRect(x-2,y-h/2-6,4,8);
  }
}

// Level 2 ship draw functions
function drawFighter(x,y,w,h,f) {
  ctx.fillRect(x+w/2-3,y+2,6,h-6); ctx.fillRect(x+w/2-8,y+8,16,h-12);
  if(f===0){ctx.fillRect(x,y+h-10,w/3,7);ctx.fillRect(x+2*w/3,y+h-10,w/3,7);}
  else{ctx.fillRect(x+2,y+h-12,w/3,7);ctx.fillRect(x+2*w/3-2,y+h-12,w/3,7);}
  ctx.fillStyle=C.bg; ctx.fillRect(x+w/2-2,y+4,4,4);
}
function drawCruiser(x,y,w,h,f) {
  ctx.fillRect(x+4,y+4,w-8,h-6); ctx.fillRect(x+10,y,w-20,8);
  if(f===0){ctx.fillRect(x,y+6,8,12);ctx.fillRect(x+w-8,y+6,8,12);ctx.fillRect(x+2,y+18,4,6);ctx.fillRect(x+w-6,y+18,4,6);}
  else{ctx.fillRect(x-2,y+8,8,12);ctx.fillRect(x+w-6,y+8,8,12);ctx.fillRect(x,y+20,4,6);ctx.fillRect(x+w-4,y+20,4,6);}
  ctx.fillStyle=C.bg; ctx.fillRect(x+10,y+6,4,4); ctx.fillRect(x+w-14,y+6,4,4);
}
function drawBattleship(x,y,w,h,f) {
  ctx.fillRect(x+2,y+h/2,w-4,h/2); ctx.fillRect(x+6,y+4,w-12,h/2); ctx.fillRect(x+12,y,w-24,8);
  ctx.fillRect(x,y+h/2+2,6,8); ctx.fillRect(x+w-6,y+h/2+2,6,8);
  ctx.fillRect(x+10,y+2,4,6); ctx.fillRect(x+w-14,y+2,4,6);
  ctx.fillStyle=C.bg; ctx.fillRect(x+14,y+6,4,5); ctx.fillRect(x+w-18,y+6,4,5);
  ctx.fillStyle=f===0?'#ff4400':'#ff8800';
  ctx.fillRect(x+8,y+h-(f===0?4:6),8,f===0?4:6); ctx.fillRect(x+w-16,y+h-(f===0?4:6),8,f===0?4:6);
}

function drawEnemies() {
  for (const e of enemies) {
    if (!e.alive) continue;
    const cx = e.x + e.w/2, cy = e.y + e.h/2;
    if (currentLevel === 2) {
      const color = e.row<=1?C.fighter:e.row<=3?C.cruiser:C.battleship;
      const img   = e.row<=1?sShipImg:e.row<=3?mShipImg:bShipImg;
      const fn    = e.row<=1?drawFighter:e.row<=3?drawCruiser:drawBattleship;
      const label = e.row<=1?'FIGHTER':e.row<=3?'CRUISER':'BATTLESHIP';
      ctx.fillStyle = color;
      if (img.loaded) ctx.drawImage(img, e.x-8, e.y-6, e.w+16, e.h+12);
      else fn(e.x, e.y, e.w, e.h, e.animFrame);
      ctx.font='bold 7px "Courier New"'; ctx.fillStyle=color; ctx.textAlign='center';
      ctx.fillText(label, cx, e.y-11);
    } else {
      const color = e.row===0?C.enemy1:e.row<=2?C.enemy2:C.enemy3;
      const img   = e.row===0?iranImg:e.row<=2?lebanonImg:sinuarImg;
      const label = e.row===0?'IRAN':e.row<=2?'LEBANON':'SINUAR';
      ctx.fillStyle = color;
      if (img.loaded) drawFace(img, cx, cy);
      else ctx.fillRect(e.x+4, e.y+4, e.w-8, e.h-8);
      ctx.font='bold 7px "Courier New"'; ctx.fillStyle=color; ctx.textAlign='center';
      ctx.fillText(label, cx, e.y-11);
    }
  }
}

function drawUFO() {
  if (!ufo) return;
  const img = currentLevel === 1 ? katzImg : trumpImg;
  const label = currentLevel === 1 ? `כץ  ${ufo.points}pts` : `TRUMP  ${ufo.points}pts`;
  const labelColor = currentLevel === 1 ? C.ufo : '#ffd700';
  const cx = ufo.x + ufo.w/2, cy = ufo.y + ufo.h/2;
  if (img.loaded) drawFace(img, cx, cy);
  else {
    ctx.fillStyle = currentLevel===1?C.ufo:C.trump;
    ctx.fillRect(ufo.x+10,ufo.y+8,ufo.w-20,ufo.h-8); ctx.fillRect(ufo.x+4,ufo.y+4,ufo.w-8,ufo.h-4);
    ctx.fillRect(ufo.x+16,ufo.y,ufo.w-32,8);
  }
  ctx.font='bold 8px "Courier New"'; ctx.fillStyle=labelColor; ctx.textAlign='center';
  ctx.fillText(label, cx, ufo.y - FACE/2 - 4);
}

function drawTrumpBullets() {
  ctx.fillStyle = '#ffd700';
  for (const b of trumpBullets) { ctx.fillRect(b.x,b.y,b.w,5); ctx.fillRect(b.x-2,b.y+5,b.w,5); ctx.fillRect(b.x+2,b.y+10,b.w,4); }
}

function drawFacility() {
  if (nuclearImg.loaded) ctx.drawImage(nuclearImg, facilityX, facilityY, facilityW, facilityH);
  else { ctx.fillStyle='#888'; ctx.fillRect(facilityX,facilityY+40,facilityW,facilityH-40); ctx.fillStyle='#aaa'; ctx.fillRect(facilityX+80,facilityY,80,facilityH); }
  if (facilityDamage > 0) { ctx.globalAlpha=facilityDamage/250; ctx.fillStyle='#ff0000'; ctx.fillRect(facilityX,facilityY,facilityW,facilityH); ctx.globalAlpha=1; }
  const barY = facilityY+facilityH+4;
  ctx.fillStyle='#222'; ctx.fillRect(facilityX,barY,facilityW,8);
  ctx.fillStyle=facilityDamage<50?'#ffd93d':facilityDamage<80?'#ff8800':'#ff0000';
  ctx.fillRect(facilityX,barY,facilityW*facilityDamage/100,8);
  ctx.font='bold 10px "Courier New"'; ctx.fillStyle='#ffffff'; ctx.textAlign='center';
  ctx.fillText(`☢ DAMAGE: ${facilityDamage}%`, facilityX+facilityW/2, barY+20);
}

function drawDamageDisplay() {
  const alpha = Math.min(1, damageDisplayTimer/20);
  ctx.globalAlpha = alpha; ctx.textAlign = 'center';
  ctx.font = 'bold 52px "Courier New"';
  const color = facilityDamage>=80?'#ff0000':facilityDamage>=50?'#ff8800':'#ffd93d';
  ctx.fillStyle=color; ctx.shadowColor=color; ctx.shadowBlur=28;
  ctx.fillText(`${facilityDamage}%`, canvas.width/2, facilityY+facilityH/2+18);
  ctx.shadowBlur=0; ctx.globalAlpha=1;
}

function drawUFOMessage() {
  const alpha = Math.min(1, ufoMsgTimer/20);
  ctx.globalAlpha=alpha; ctx.textAlign='center';
  ctx.font='bold 28px "Courier New"'; ctx.fillStyle='#ff0000'; ctx.shadowColor='#ff0000'; ctx.shadowBlur=18;
  const msg = currentLevel===1 ? 'ביבי בשבילי מיץ!' : 'ביבי תתרכז באויב!';
  ctx.fillText(msg, canvas.width/2, 370);
  ctx.shadowBlur=0; ctx.globalAlpha=1;
}

function drawKillEffects() {
  for (const ef of killEffects) {
    const progress=ef.timer/KILL_EFFECT_FRAMES, alpha=progress, radius=26*(1+(1-progress)*0.6);
    ctx.globalAlpha=alpha; ctx.strokeStyle='#ff0000'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(ef.x,ef.y,radius,0,Math.PI*2); ctx.stroke();
    const off=radius*0.58;
    ctx.beginPath(); ctx.moveTo(ef.x-off,ef.y-off); ctx.lineTo(ef.x+off,ef.y+off); ctx.moveTo(ef.x+off,ef.y-off); ctx.lineTo(ef.x-off,ef.y+off); ctx.stroke();
    ctx.globalAlpha=1; ctx.lineWidth=1;
  }
}

function drawIntroOverlay() {
  const progress=introTimer/INTRO_DURATION, alpha=progress>0.15?1:progress/0.15;
  ctx.globalAlpha=alpha*0.88; ctx.fillStyle='#000011';
  ctx.fillRect(0, canvas.height/2-65, canvas.width, 110);
  ctx.globalAlpha=alpha; ctx.textAlign='center';
  ctx.font='bold 34px "Courier New"'; ctx.fillStyle='#ffd93d'; ctx.shadowColor='#ffd93d'; ctx.shadowBlur=24;
  const texts = [
    ['אני מת על קפה ועדיף רותח!'],
    ['קדימה משחררים את', 'מיצרי הורמוז!'],
    ['יאללה לסיים עם הגרעין!'],
  ];
  const lines = texts[currentLevel-1];
  if (lines.length === 1) ctx.fillText(lines[0], canvas.width/2, canvas.height/2+14);
  else { ctx.fillText(lines[0], canvas.width/2, canvas.height/2-2); ctx.fillText(lines[1], canvas.width/2, canvas.height/2+38); }
  ctx.shadowBlur=0; ctx.globalAlpha=1;
}

function drawShields() {
  ctx.fillStyle=C.shield;
  for (const sh of shields) for(let r=0;r<sh.pixels.length;r++) for(let c=0;c<sh.pixels[r].length;c++) if(sh.pixels[r][c]) ctx.fillRect(sh.x+c*PX,sh.y+r*PX,PX,PX);
}

function drawPlayerBullets() {
  ctx.font='16px serif'; ctx.textAlign='center';
  for (const b of playerBullets) ctx.fillText('☕', b.x+2, b.y+14);
}

function drawEnemyBullets() {
  ctx.fillStyle=C.enemyBullet;
  for (const b of enemyBullets) { ctx.fillRect(b.x,b.y,b.w,4); ctx.fillRect(b.x-2,b.y+4,b.w,4); ctx.fillRect(b.x+2,b.y+8,b.w,4); }
}

function drawHUD() {
  ctx.font='bold 18px "Courier New"'; ctx.fillStyle=C.text;
  ctx.textAlign='left'; ctx.fillText(`SCORE: ${score}`, 20, 28);
  ctx.textAlign='center'; ctx.fillText(`HI: ${highScore}`, canvas.width/2, 28);
  ctx.textAlign='right'; ctx.fillText(`LIVES: ${player.lives}`, canvas.width-20, 28);
  ctx.fillStyle=C.player;
  for (let i=0;i<player.lives;i++) { const lx=canvas.width-28-i*28; ctx.fillRect(lx-10,38,20,8); ctx.fillRect(lx-4,34,8,6); ctx.fillRect(lx-2,30,4,5); }
  ctx.textAlign='left'; ctx.font='bold 12px "Courier New"'; ctx.fillStyle='#888';
  ctx.fillText(`LVL ${currentLevel}/3`, 20, 48);
  ctx.fillStyle=C.text; ctx.fillRect(0,canvas.height-40,canvas.width,2);
}

function drawExplosionScreen() {
  const shakeX=screenShake>0?(Math.random()-.5)*screenShake:0, shakeY=screenShake>0?(Math.random()-.5)*screenShake:0;
  ctx.save(); ctx.translate(shakeX,shakeY);
  ctx.fillStyle=C.bg; ctx.fillRect(-20,-20,canvas.width+40,canvas.height+40);
  drawStars(); drawShields(); drawEnemies(); drawPlayer(); drawHUD();
  for(const s of explosionSmoke){ctx.globalAlpha=s.life*0.6;const g=s.gray||50;ctx.fillStyle=`rgb(${g},${g},${g})`;ctx.beginPath();ctx.arc(s.x,s.y,s.size,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;
  for(const d of explosionDebris){ctx.globalAlpha=d.life*0.9;ctx.fillStyle=d.color;ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.angle);ctx.fillRect(-d.w/2,-d.h/2,d.w,d.h);ctx.restore();}
  ctx.globalAlpha=1;
  for(const p of explosionParticles){ctx.globalAlpha=p.life*0.92;ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=p.size>10?18:10;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}
  ctx.shadowBlur=0; ctx.globalAlpha=1;
  for(const sw of shockwaves){if(sw.alpha<=0)continue;ctx.globalAlpha=Math.max(0,sw.alpha);ctx.strokeStyle='#ffffff';ctx.lineWidth=sw.width||4;ctx.beginPath();ctx.arc(sw.x,sw.y,sw.radius,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#ffaa00';ctx.lineWidth=(sw.width||4)*0.5;ctx.beginPath();ctx.arc(sw.x,sw.y,sw.radius*0.75,0,Math.PI*2);ctx.stroke();}
  ctx.lineWidth=1; ctx.globalAlpha=1;
  if(explosionTimer<20){ctx.globalAlpha=(20-explosionTimer)/20*0.95;ctx.fillStyle='#ffffff';ctx.fillRect(-20,-20,canvas.width+40,canvas.height+40);ctx.globalAlpha=1;}
  if(explosionTimer<60){ctx.globalAlpha=(60-explosionTimer)/60*0.25;ctx.fillStyle='#ff4400';ctx.fillRect(-20,-20,canvas.width+40,canvas.height+40);ctx.globalAlpha=1;}
  ctx.restore();
}

function drawFiesta() {
  for(const c of confetti){ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.angle);ctx.fillStyle=c.color;ctx.fillRect(-c.w/2,-c.h/2,c.w,c.h);ctx.restore();}
  for(const b of balloons){ctx.fillStyle=b.color;ctx.beginPath();ctx.ellipse(b.x,b.y,b.r,b.r*1.25,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(b.x,b.y+b.r*1.25);ctx.lineTo(b.x-3,b.y+b.r*1.25+5);ctx.lineTo(b.x+3,b.y+b.r*1.25+5);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(255,255,255,0.5)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(b.x,b.y+b.r*1.25+5);ctx.quadraticCurveTo(b.x+10,b.y+b.r*2+20,b.x,b.y+b.r*2+40);ctx.stroke();ctx.lineWidth=1;}
}

function drawDancingPeople() {
  const t=Date.now(), positions=[80,200,370,540,670], colors=['#ff4444','#ffd93d','#00ff41','#4ecdc4','#c77dff'];
  for(let i=0;i<positions.length;i++){
    const bx=positions[i],bounce=Math.sin(t*0.005+i*1.3)*10,by=520+bounce,arm=Math.sin(t*0.006+i*0.9)*0.7,leg=Math.sin(t*0.007+i*1.1)*0.5;
    ctx.strokeStyle=colors[i]; ctx.lineWidth=3; ctx.lineCap='round';
    ctx.beginPath();ctx.arc(bx,by-52,13,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(bx,by-39);ctx.lineTo(bx,by-8);ctx.stroke();
    ctx.beginPath();ctx.moveTo(bx,by-28);ctx.lineTo(bx-22,by-28+Math.sin(arm)*18);ctx.moveTo(bx,by-28);ctx.lineTo(bx+22,by-28-Math.sin(arm)*18);ctx.stroke();
    ctx.beginPath();ctx.moveTo(bx,by-8);ctx.lineTo(bx-15+leg*12,by+20);ctx.moveTo(bx,by-8);ctx.lineTo(bx+15-leg*12,by+20);ctx.stroke();
    ctx.lineWidth=1;
  }
}

// ── SCREENS ───────────────────────────────────────────────────
function drawStartScreen() {
  ctx.textAlign='center';
  ctx.font='bold 80px "Courier New"'; ctx.fillStyle='#00ff41'; ctx.shadowColor='#00ff41'; ctx.shadowBlur=30;
  ctx.fillText('IDV', canvas.width/2, 120);
  ctx.shadowBlur=0;
  ctx.font='bold 22px "Courier New"'; ctx.fillStyle='#ffd93d';
  ctx.fillText('SPACE INVADERS – 3 LEVELS', canvas.width/2, 160);

  const lvls=[['LVL 1','המקלטים','#ff6b6b'],['LVL 2','מיצר הורמוז','#ffd93d'],['LVL 3','הגרעין ☢','#00e5ff']];
  lvls.forEach(([num,name,color],i)=>{
    ctx.fillStyle=color; ctx.font='bold 16px "Courier New"';
    ctx.fillText(`${num}: ${name}`, 200+i*200, 220);
  });

  ctx.fillStyle='#888'; ctx.font='16px "Courier New"';
  ctx.fillText('← →  MOVE      SPACE  SHOOT', canvas.width/2, 290);

  if(Math.floor(Date.now()/550)%2===0){
    ctx.fillStyle='#ffffff'; ctx.font='bold 24px "Courier New"';
    ctx.fillText('PRESS  ENTER  /  TAP  TO  START', canvas.width/2, 380);
  }
  ctx.fillStyle='#444'; ctx.font='12px "Courier New"';
  ctx.fillText('IDV – Israel Defense Venture', canvas.width/2, 570);
}

function drawLevelCompleteScreen() {
  drawFiesta();
  ctx.textAlign='center';
  ctx.font='bold 52px "Courier New"'; ctx.fillStyle='#00ff41'; ctx.shadowColor='#00ff41'; ctx.shadowBlur=28;
  ctx.fillText(`LEVEL ${currentLevel} COMPLETE!`, canvas.width/2, 160);
  ctx.shadowBlur=0;

  const nextNames = ['מיצר הורמוז','הגרעין ☢'];
  ctx.font='bold 26px "Courier New"'; ctx.fillStyle='#ffd93d';
  ctx.fillText(`NEXT: LVL ${currentLevel+1} – ${nextNames[currentLevel-1]}`, canvas.width/2, 240);

  ctx.font='bold 22px "Courier New"'; ctx.fillStyle=C.text;
  ctx.fillText(`SCORE: ${score}   HI: ${highScore}`, canvas.width/2, 310);

  if(Math.floor(Date.now()/550)%2===0){
    ctx.fillStyle='#ffffff'; ctx.font='bold 22px "Courier New"';
    ctx.fillText('PRESS  ENTER  /  TAP  TO  CONTINUE', canvas.width/2, 420);
  }
}

function drawGameOverScreen() {
  ctx.textAlign='center';
  ctx.font='bold 58px "Courier New"'; ctx.fillStyle='#ff4444'; ctx.shadowColor='#ff4444'; ctx.shadowBlur=24;
  ctx.fillText('GAME  OVER', canvas.width/2, 190);
  ctx.shadowBlur=0;
  ctx.font='bold 20px "Courier New"'; ctx.fillStyle='#aaa';
  ctx.fillText(`LEVEL ${currentLevel}/3`, canvas.width/2, 240);
  ctx.font='bold 26px "Courier New"'; ctx.fillStyle=C.text;
  ctx.fillText(`SCORE  :  ${score}`, canvas.width/2, 300);
  ctx.fillText(`HI-SCORE  :  ${highScore}`, canvas.width/2, 340);
  if(currentLevel===3){ctx.fillStyle='#ffd93d';ctx.font='bold 18px "Courier New"';ctx.fillText(`☢ FACILITY DAMAGE: ${facilityDamage}%`,canvas.width/2,390);}
  if(Math.floor(Date.now()/550)%2===0){ctx.fillStyle='#ffffff';ctx.font='bold 20px "Courier New"';ctx.fillText('PRESS  ENTER  /  TAP  TO  RESTART',canvas.width/2,460);}
}

function drawWinScreen() {
  drawFiesta(); drawDancingPeople();
  ctx.textAlign='center';
  ctx.font='bold 44px "Courier New"'; ctx.fillStyle='#ffd93d'; ctx.shadowColor='#ffd93d'; ctx.shadowBlur=30;
  ctx.fillText('נגמרה המלחמה!', canvas.width/2, 95); ctx.shadowBlur=0;
  ctx.font='bold 48px "Courier New"'; ctx.fillStyle='#00ff41'; ctx.shadowColor='#00ff41'; ctx.shadowBlur=25;
  ctx.fillText('איראן חופשית!', canvas.width/2, 165); ctx.shadowBlur=0;
  ctx.font='bold 32px "Courier New"'; ctx.fillStyle='#ff6b9d'; ctx.shadowColor='#ff6b9d'; ctx.shadowBlur=20;
  ctx.fillText('בואי שרה יש בחירות!', canvas.width/2, 235); ctx.shadowBlur=0;
  ctx.font='bold 18px "Courier New"'; ctx.fillStyle=C.text;
  ctx.fillText(`SCORE: ${score}   HI: ${highScore}`, canvas.width/2, 415);
  if(Math.floor(Date.now()/550)%2===0){ctx.fillStyle='#ffffff';ctx.font='bold 18px "Courier New"';ctx.fillText('PRESS  ENTER  /  TAP  TO  PLAY  AGAIN',canvas.width/2,470);}
}

// ── MAIN LOOP ─────────────────────────────────────────────────
function gameLoop() { update(); draw(); animId = requestAnimationFrame(gameLoop); }

// ── MOBILE TOUCH ──────────────────────────────────────────────
const btnLeft=document.getElementById('btnLeft'), btnRight=document.getElementById('btnRight');
const btnShoot=document.getElementById('btnShoot'), btnStart=document.getElementById('btnStart');
function holdKey(k,v){keys[k]=v;if(k==='Space'&&v)spaceJustPressed=true;}
btnLeft.addEventListener('touchstart',  e=>{e.preventDefault();holdKey('ArrowLeft',true);},{passive:false});
btnLeft.addEventListener('touchend',    e=>{e.preventDefault();holdKey('ArrowLeft',false);},{passive:false});
btnRight.addEventListener('touchstart', e=>{e.preventDefault();holdKey('ArrowRight',true);},{passive:false});
btnRight.addEventListener('touchend',   e=>{e.preventDefault();holdKey('ArrowRight',false);},{passive:false});
btnShoot.addEventListener('touchstart', e=>{e.preventDefault();holdKey('Space',true);},{passive:false});
btnShoot.addEventListener('touchend',   e=>{e.preventDefault();holdKey('Space',false);},{passive:false});
btnStart.addEventListener('touchstart', e=>{e.preventDefault();handleStart();},{passive:false});
btnStart.addEventListener('click', ()=>handleStart());
canvas.addEventListener('touchstart', e=>{e.preventDefault();handleStart();},{passive:false});
canvas.addEventListener('click', ()=>handleStart());

gameLoop();

// ── SPLASH SCREEN ─────────────────────────────────────────────
// Draw image with object-fit: cover (no distortion, fills target rect)
function drawImageCover(img, x, y, w, h) {
  const iW = img.naturalWidth || img.width, iH = img.naturalHeight || img.height;
  if (!iW || !iH) { ctx.drawImage(img, x, y, w, h); return; }
  const scale = Math.max(w / iW, h / iH);
  const sw = iW * scale, sh = iH * scale;
  const ox = x + (w - sw) / 2, oy = y + (h - sh) / 2;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(img, ox, oy, sw, sh);
  ctx.restore();
}

function updateSplashPlanes() {
  for (const p of splashPlanes) {
    p.x += p.speed * p.dir;
    if (p.dir ===  1 && p.x > canvas.width + 220)  p.x = -220;
    if (p.dir === -1 && p.x + p.w < -220)           p.x = canvas.width + 220;
  }
}

function drawSplashScreen() {
  const t = Date.now();
  drawStars();

  // ── Side portraits (cover-fit, full canvas height) ─────────
  const prtW = 205, prtH = canvas.height, prtY = 0;

  // Trump – left
  if (trump1Img.loaded) {
    ctx.save();
    ctx.shadowColor = '#ff8c00'; ctx.shadowBlur = 40;
    drawImageCover(trump1Img, 0, prtY, prtW, prtH);
    ctx.shadowBlur = 0; ctx.restore();
  }
  // Bibi – right
  if (bibi1Img.loaded) {
    ctx.save();
    ctx.shadowColor = '#00ff41'; ctx.shadowBlur = 40;
    drawImageCover(bibi1Img, canvas.width - prtW, prtY, prtW, prtH);
    ctx.shadowBlur = 0; ctx.restore();
  }

  // Gradient fade from sides into dark center
  const lg = ctx.createLinearGradient(0, 0, 230, 0);
  lg.addColorStop(0, 'rgba(0,0,17,0)');
  lg.addColorStop(1, 'rgba(0,0,17,0.92)');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, 230, canvas.height);

  const rg = ctx.createLinearGradient(570, 0, 800, 0);
  rg.addColorStop(0, 'rgba(0,0,17,0.92)');
  rg.addColorStop(1, 'rgba(0,0,17,0)');
  ctx.fillStyle = rg; ctx.fillRect(570, 0, 230, canvas.height);

  // ── Center title ────────────────────────────────────────────
  ctx.textAlign = 'center';
  ctx.font = 'bold 82px "Courier New"';
  ctx.fillStyle = '#00ff41'; ctx.shadowColor = '#00ff41'; ctx.shadowBlur = 50;
  ctx.fillText('IDV', canvas.width / 2, 96);
  ctx.shadowBlur = 0;
  ctx.font = 'bold 15px "Courier New"'; ctx.fillStyle = '#ffd93d';
  ctx.fillText('ISRAEL  DEFENSE  VENTURE', canvas.width / 2, 122);

  // Thin separator line
  ctx.strokeStyle = '#00ff4155'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(230, 134); ctx.lineTo(570, 134); ctx.stroke();
  ctx.lineWidth = 1;

  // ── Aircraft ────────────────────────────────────────────────
  for (const p of splashPlanes) {
    if (!p.img || !p.img.loaded) continue;
    const cy = p.y + p.h / 2;
    // Jet contrail — drawn behind the plane
    const trailStart = p.dir === 1 ? p.x - 1 : p.x + p.w + 1;
    const trailLen = 180;
    const trailEnd = trailStart - p.dir * trailLen;
    const grad = ctx.createLinearGradient(trailStart, cy, trailEnd, cy);
    grad.addColorStop(0, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.3, 'rgba(200,230,255,0.25)');
    grad.addColorStop(1, 'rgba(200,230,255,0)');
    ctx.beginPath();
    ctx.moveTo(trailStart, cy - 3);
    ctx.lineTo(trailEnd,   cy);
    ctx.lineTo(trailStart, cy + 3);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.save();
    ctx.globalCompositeOperation = 'screen'; // removes black background
    if (p.dir === 1) {
      ctx.translate(p.x + p.w, p.y);
      ctx.scale(-1, 1);
      ctx.drawImage(p.img, 0, 0, p.w, p.h);
    } else {
      ctx.drawImage(p.img, p.x, p.y, p.w, p.h);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  // ── Hebrew main text ─────────────────────────────────────────
  const pulse = Math.sin(t * 0.0018) * 0.12 + 0.88;
  ctx.globalAlpha = pulse;
  ctx.font = 'bold 40px "Courier New"';
  ctx.fillStyle = '#ffd93d'; ctx.shadowColor = '#ffd93d'; ctx.shadowBlur = 38;
  ctx.fillText('!משחררים את איראן', canvas.width / 2, 320);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // ── Nuclear facility – TARGET ────────────────────────────────
  const facW = 210, facH = 114;
  const facX = canvas.width / 2 - facW / 2, facY = 358;

  if (nuclearImg.loaded) ctx.drawImage(nuclearImg, facX, facY, facW, facH);
  else { ctx.fillStyle = '#444'; ctx.fillRect(facX, facY, facW, facH); }

  // Red pulsing damage overlay
  const tgt = Math.sin(t * 0.004) * 0.5 + 0.5;
  ctx.globalAlpha = tgt * 0.35;
  ctx.fillStyle = '#ff2200'; ctx.fillRect(facX, facY, facW, facH);
  ctx.globalAlpha = 1;

  // Targeting reticle
  const rcx = canvas.width / 2, rcy = facY + facH / 2, rr = 62;
  ctx.strokeStyle = '#ff2200'; ctx.lineWidth = 2;
  ctx.globalAlpha = 0.65 + tgt * 0.35;
  ctx.shadowColor = '#ff2200'; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.arc(rcx, rcy, rr, 0, Math.PI * 2); ctx.stroke();
  // inner circle
  ctx.beginPath(); ctx.arc(rcx, rcy, rr * 0.45, 0, Math.PI * 2); ctx.stroke();
  // crosshairs
  ctx.beginPath();
  ctx.moveTo(rcx - rr - 12, rcy); ctx.lineTo(rcx - rr + 22, rcy);
  ctx.moveTo(rcx + rr - 22, rcy); ctx.lineTo(rcx + rr + 12, rcy);
  ctx.moveTo(rcx, rcy - rr - 12); ctx.lineTo(rcx, rcy - rr + 22);
  ctx.moveTo(rcx, rcy + rr - 22); ctx.lineTo(rcx, rcy + rr + 12);
  ctx.stroke();
  ctx.shadowBlur = 0; ctx.lineWidth = 1; ctx.globalAlpha = 1;

  // TARGET label + ☢
  ctx.font = 'bold 13px "Courier New"'; ctx.fillStyle = '#ff4444';
  ctx.shadowColor = '#ff4444'; ctx.shadowBlur = 10;
  ctx.fillText('☢  T A R G E T  ☢', canvas.width / 2, facY + facH + 20);
  ctx.shadowBlur = 0;

  // ── Tap to start ─────────────────────────────────────────────
  if (Math.floor(t / 520) % 2 === 0) {
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 21px "Courier New"';
    ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 12;
    ctx.fillText('PRESS  ENTER  /  TAP  TO  ENTER', canvas.width / 2, 600);
    ctx.shadowBlur = 0;
  }
}
