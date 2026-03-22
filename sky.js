// ============================================================
//  SKY BATTLE – Bibi on F35 vs Iranian Missile Launchers
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
canvas.width  = 800;
canvas.height = 620;

// ── IMAGES ───────────────────────────────────────────────────
function loadImg(src) {
  const img = new Image(); img.src = src;
  img.loaded = false; img.onload = () => { img.loaded = true; };
  return img;
}
const f35Img      = loadImg('F35.jpg');
const b1Img       = loadImg('B1.jpg');
const bibi1Img    = loadImg('Bibi1.jpg');
const trump1Img   = loadImg('Trump1.jpg');
const launcherImg = loadImg('launcher.jpg');

// ── AUDIO ────────────────────────────────────────────────────
let audioCtx = null;
function getAC() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function tone(freq, dur, type, vol, sf) {
  try {
    const ac = getAC(), o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = type || 'square';
    o.frequency.setValueAtTime(sf || freq, ac.currentTime);
    if (sf) o.frequency.exponentialRampToValueAtTime(freq, ac.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.25, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.start(); o.stop(ac.currentTime + dur);
  } catch(e){}
}
function noise(dur, vol) {
  try {
    const ac = getAC(), len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random()*2-1;
    const s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = buf; s.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(vol||0.3, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    s.start();
  } catch(e){}
}
function sndShoot()     { tone(900, 0.07, 'square', 0.18); }
function sndMissile()   { tone(300, 0.15, 'sawtooth', 0.22, 600); }
function sndExplode()   { noise(0.4, 0.6); tone(90, 0.4, 'sawtooth', 0.4, 200); }
function sndPlayerHit() { tone(120, 0.5, 'sawtooth', 0.4); }
function sndWin()       {
  [523,659,784,1047].forEach((f,i) => setTimeout(() => tone(f, 0.2, 'square', 0.3), i*180));
}

// ── STARS ────────────────────────────────────────────────────
const stars = Array.from({length:160}, () => ({
  x: Math.random()*800, y: Math.random()*360,
  s: Math.random()*1.8+0.3, a: Math.random()*0.7+0.2,
  tw: Math.random()*Math.PI*2, ts: Math.random()*0.03+0.008
}));

// ── CLOUDS ───────────────────────────────────────────────────
const clouds = [
  { x:  80, y:  90, w: 185, h: 80, speed: 0.35 },
  { x: 380, y: 145, w: 215, h: 90, speed: 0.25 },
  { x: 610, y:  75, w: 160, h: 68, speed: 0.42 },
];

// ── BIBI (player) ────────────────────────────────────────────
const bibi = { x: 580, y: 115, w: 130, h: 52, lives: 3, inv: 0 };

// ── TRUMP (auto) ─────────────────────────────────────────────
const trump = { x: -200, y: 210, w: 165, h: 55, speed: 2.4, fired: false, flashTimer: 0 };

// ── LAUNCHERS ────────────────────────────────────────────────
const L_ROWS = 4, L_COLS = 8, LW = 62, LH = 46;
const launchers = [];
for (let r = 0; r < L_ROWS; r++)
  for (let c = 0; c < L_COLS; c++)
    launchers.push({
      x: 22 + c*95, y: 390 + r*52, w: LW, h: LH,
      alive: true, row: r,
      timer: 40 + Math.floor(Math.random()*90) + r*15
    });

// ── MISSILES ─────────────────────────────────────────────────
const bibiMissiles     = [];
const trumpMissiles    = [];
const launcherMissiles = [];
let   spaceJustPressed = false;
const keys = {};

// ── PARTICLES ────────────────────────────────────────────────
const particles = [];
function spawnBoom(cx, cy, big) {
  const n = big ? 32 : 16;
  for (let i = 0; i < n; i++) {
    const a = Math.random()*Math.PI*2, sp = Math.random()*(big?8:5)+2;
    particles.push({
      x:cx, y:cy, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
      size: Math.random()*9+3,
      color: ['#ff4400','#ff8800','#ffcc00','#ffffff','#ff6600'][Math.floor(Math.random()*5)],
      life:1, decay: Math.random()*0.022+0.012
    });
  }
  if (big) particles.push({ isRing:true, x:cx, y:cy, r:4, rmax:60, rspd:3.5, life:1, decay:0.042, color:'#ff8800' });
}

// ── GAME STATE ───────────────────────────────────────────────
let gameState = 'start';
let score     = 0;
let frameCount = 0;

// ── INPUT ─────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); spaceJustPressed = true; }
  if (e.code === 'Enter') handleStart();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// ── HELPERS ──────────────────────────────────────────────────
function rectsOverlap(ax,ay,aw,ah, bx,by,bw,bh) {
  return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
}
function bibiBehindCloud() {
  return clouds.some(c => rectsOverlap(bibi.x+10,bibi.y+8,bibi.w-20,bibi.h-16, c.x,c.y,c.w,c.h));
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}

// ── UPDATE ────────────────────────────────────────────────────
function update() {
  if (gameState !== 'playing') return;
  frameCount++;

  if (keys['ArrowLeft'])  bibi.x -= 5;
  if (keys['ArrowRight']) bibi.x += 5;
  if (keys['ArrowUp'])    bibi.y -= 4;
  if (keys['ArrowDown'])  bibi.y += 4;
  bibi.x = Math.max(0, Math.min(canvas.width - bibi.w, bibi.x));
  bibi.y = Math.max(40, Math.min(320, bibi.y));
  if (bibi.inv > 0) bibi.inv--;

  if (spaceJustPressed) {
    spaceJustPressed = false;
    if (bibiMissiles.length < 4) {
      bibiMissiles.push({ x: bibi.x+bibi.w/2-3, y: bibi.y+bibi.h, w:6, h:22, speed:9 });
      sndShoot();
    }
  }

  trump.x += trump.speed;
  if (trump.flashTimer > 0) trump.flashTimer--;
  if (!trump.fired && trump.x > canvas.width/2 - 60) {
    for (let i = 0; i < 2; i++)
      trumpMissiles.push({ x: trump.x+trump.w/2-4+i*20, y: trump.y+trump.h, w:7, h:24, speed:5 });
    trump.fired = true; sndMissile();
  }
  if (trump.x > canvas.width + 220) { trump.x = -220; trump.fired = false; }

  for (const c of clouds) {
    c.x += c.speed;
    if (c.x > canvas.width + 60) c.x = -c.w - 30;
  }

  for (let i = bibiMissiles.length-1; i >= 0; i--) {
    const m = bibiMissiles[i]; m.y += m.speed;
    if (m.y > canvas.height) { bibiMissiles.splice(i,1); continue; }
    let hit = false;
    for (const l of launchers) {
      if (!l.alive) continue;
      if (rectsOverlap(m.x,m.y,m.w,m.h, l.x,l.y,l.w,l.h)) {
        l.alive = false; score += 10;
        spawnBoom(l.x+l.w/2, l.y+l.h/2, true);
        sndExplode(); bibiMissiles.splice(i,1); hit=true; break;
      }
    }
    if (!hit) continue;
  }

  for (let i = trumpMissiles.length-1; i >= 0; i--) {
    const m = trumpMissiles[i]; m.y += m.speed;
    if (m.y > canvas.height) { trumpMissiles.splice(i,1); continue; }
    let hit = false;
    for (const l of launchers) {
      if (!l.alive) continue;
      if (rectsOverlap(m.x,m.y,m.w,m.h, l.x,l.y,l.w,l.h)) {
        l.alive = false; score += 5;
        spawnBoom(l.x+l.w/2, l.y+l.h/2, true);
        sndExplode(); trumpMissiles.splice(i,1); hit=true; break;
      }
    }
    if (!hit) continue;
  }

  for (const l of launchers) {
    if (!l.alive) continue;
    l.timer--;
    if (l.timer <= 0) {
      l.timer = 50 + Math.floor(Math.random()*80);
      launcherMissiles.push({ x: l.x+l.w/2-3, y: l.y-5, w:6, h:20, speed:4 });
    }
  }

  for (let i = launcherMissiles.length-1; i >= 0; i--) {
    const m = launcherMissiles[i]; m.y -= m.speed;
    if (m.y < -30) { launcherMissiles.splice(i,1); continue; }
    if (clouds.some(c => rectsOverlap(m.x,m.y,m.w,m.h, c.x,c.y,c.w,c.h))) {
      spawnBoom(m.x+m.w/2, m.y, false);
      launcherMissiles.splice(i,1); continue;
    }
    if (bibi.inv === 0 && !bibiBehindCloud() &&
        rectsOverlap(m.x,m.y,m.w,m.h, bibi.x+10,bibi.y+6,bibi.w-20,bibi.h-12)) {
      bibi.lives--; bibi.inv = 120;
      spawnBoom(bibi.x+bibi.w/2, bibi.y+bibi.h/2, false);
      sndPlayerHit(); launcherMissiles.splice(i,1);
      if (bibi.lives <= 0) { gameState = 'gameover'; return; }
      continue;
    }
    if (rectsOverlap(m.x,m.y,m.w,m.h, trump.x+10,trump.y+6,trump.w-20,trump.h-12)) {
      trump.flashTimer = 18;
      spawnBoom(trump.x+trump.w/2, trump.y+trump.h/2, false);
      launcherMissiles.splice(i,1); continue;
    }
  }

  for (let i = particles.length-1; i >= 0; i--) {
    const p = particles[i];
    if (p.isRing) {
      p.r += p.rspd; p.life -= p.decay;
      if (p.life <= 0 || p.r >= p.rmax) particles.splice(i,1);
    } else {
      p.x+=p.vx; p.y+=p.vy; p.vy+=0.15; p.size*=0.97; p.life-=p.decay;
      if (p.life<=0) particles.splice(i,1);
    }
  }

  if (launchers.every(l => !l.alive)) { gameState = 'win'; sndWin(); }
}

// ── DRAW ──────────────────────────────────────────────────────
function draw() {
  drawSky();
  if (gameState === 'start')    { drawStartScreen(); return; }
  if (gameState === 'gameover') { drawGameOverScreen(); return; }
  if (gameState === 'win')      { drawWinScreen(); return; }

  drawStars();
  drawMoon();
  drawMountains();
  drawGround();
  drawClouds(false);
  drawLaunchers();
  drawMissiles();
  drawTrumpPlane();
  drawBibiPlane();
  drawClouds(true);
  drawParticles();
  drawHUD();
}

// ── VISUAL ELEMENTS ───────────────────────────────────────────
function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0,    '#000510');
  g.addColorStop(0.28, '#000d28');
  g.addColorStop(0.52, '#001040');
  g.addColorStop(0.70, '#150800');
  g.addColorStop(0.82, '#260e00');
  g.addColorStop(1,    '#0d0500');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Warm horizon glow band
  const hg = ctx.createLinearGradient(0, 300, 0, 420);
  hg.addColorStop(0,   'rgba(200,60,0,0)');
  hg.addColorStop(0.5, 'rgba(200,60,0,0.18)');
  hg.addColorStop(1,   'rgba(200,60,0,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 300, canvas.width, 120);
}

function drawStars() {
  const t = frameCount * 0.025;
  for (const s of stars) {
    const a = s.a * (0.55 + 0.45 * Math.sin(t * s.ts * 40 + s.tw));
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
    ctx.fillRect(s.x, s.y, s.s, s.s);
    if (s.s > 1.3) {
      ctx.fillStyle = `rgba(200,230,255,${(a*0.4).toFixed(2)})`;
      ctx.fillRect(s.x - s.s, s.y + s.s/2 - 0.5, s.s*3, 1);
      ctx.fillRect(s.x + s.s/2 - 0.5, s.y - s.s, 1, s.s*3);
    }
  }
}

function drawMoon() {
  const mx = 685, my = 58, mr = 26;
  const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr*3.5);
  mg.addColorStop(0, 'rgba(255,240,160,0.12)');
  mg.addColorStop(1, 'rgba(255,240,160,0)');
  ctx.fillStyle = mg;
  ctx.fillRect(mx - mr*4, my - mr*4, mr*8, mr*8);
  ctx.fillStyle = '#fff8d0';
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#000d28';
  ctx.beginPath(); ctx.arc(mx + 11, my - 3, mr*0.84, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,140,0.25)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(mx, my, mr+1, 0, Math.PI*2); ctx.stroke();
  ctx.lineWidth = 1;
}

function drawMountains() {
  const mpts = [
    [0,370],[55,340],[90,358],[130,325],[175,348],[215,318],[260,342],
    [300,330],[345,310],[390,335],[430,315],[475,338],[520,312],[565,330],
    [610,348],[655,322],[700,345],[740,355],[780,335],[800,362],[800,385],[0,385]
  ];
  ctx.fillStyle = 'rgba(10,6,2,0.88)';
  ctx.beginPath(); ctx.moveTo(0,385);
  for (const [x,y] of mpts) ctx.lineTo(x, y);
  ctx.closePath(); ctx.fill();
  // Rim glow
  ctx.strokeStyle = 'rgba(255,80,10,0.14)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0,370);
  for (const [x,y] of mpts.slice(1, -3)) ctx.lineTo(x, y);
  ctx.lineTo(800, 362); ctx.stroke();
  ctx.lineWidth = 1;
}

function drawGround() {
  const g = ctx.createLinearGradient(0, 383, 0, canvas.height);
  g.addColorStop(0,   '#2a1400');
  g.addColorStop(0.2, '#1e0e00');
  g.addColorStop(1,   '#090400');
  ctx.fillStyle = g;
  ctx.fillRect(0, 383, canvas.width, canvas.height - 383);
  // Tactical grid
  ctx.strokeStyle = 'rgba(255,80,0,0.07)'; ctx.lineWidth = 0.5;
  for (let x = 0; x <= canvas.width; x += 50) {
    ctx.beginPath(); ctx.moveTo(x,383); ctx.lineTo(x,canvas.height); ctx.stroke();
  }
  for (let y = 383; y <= canvas.height; y += 50) {
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke();
  }
  ctx.lineWidth = 1;
  // Glowing horizon line
  const hl = ctx.createLinearGradient(0, 0, canvas.width, 0);
  hl.addColorStop(0,   'rgba(255,80,0,0)');
  hl.addColorStop(0.2, 'rgba(255,110,20,0.75)');
  hl.addColorStop(0.8, 'rgba(255,110,20,0.75)');
  hl.addColorStop(1,   'rgba(255,80,0,0)');
  ctx.strokeStyle = hl; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0,383); ctx.lineTo(canvas.width,383); ctx.stroke();
  ctx.lineWidth = 1;
  // Bunker platform
  ctx.fillStyle = 'rgba(50,28,8,0.65)';
  ctx.fillRect(0, 387, canvas.width, canvas.height - 387);
}

function drawClouds(front) {
  for (const c of clouds) {
    const inCloud = rectsOverlap(bibi.x+10,bibi.y+8,bibi.w-20,bibi.h-16, c.x,c.y,c.w,c.h);
    ctx.save();
    if (!front) {
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = 'rgba(70,100,150,0.5)';
      ctx.beginPath();
      ctx.ellipse(c.x+c.w*0.50, c.y+c.h*0.84, c.w*0.44, c.h*0.25, 0, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = front ? (inCloud ? 0.90 : 0.52) : 0.62;
    ctx.fillStyle = front ? 'rgba(225,238,255,0.93)' : 'rgba(170,205,240,0.68)';
    ctx.beginPath(); ctx.ellipse(c.x+c.w*0.22, c.y+c.h*0.62, c.w*0.26, c.h*0.44, 0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(c.x+c.w*0.50, c.y+c.h*0.48, c.w*0.34, c.h*0.50, 0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(c.x+c.w*0.78, c.y+c.h*0.60, c.w*0.26, c.h*0.42, 0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(c.x+c.w*0.50, c.y+c.h*0.76, c.w*0.44, c.h*0.33, 0,0,Math.PI*2); ctx.fill();
    // Bright tops
    ctx.fillStyle = front ? 'rgba(255,255,255,0.78)' : 'rgba(235,245,255,0.48)';
    ctx.beginPath(); ctx.ellipse(c.x+c.w*0.46, c.y+c.h*0.37, c.w*0.24, c.h*0.30, 0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(c.x+c.w*0.68, c.y+c.h*0.43, c.w*0.16, c.h*0.22, 0,0,Math.PI*2); ctx.fill();
    // Blue inner glow
    ctx.globalAlpha *= 0.3;
    ctx.fillStyle = '#88bbff';
    ctx.beginPath(); ctx.ellipse(c.x+c.w*0.50, c.y+c.h*0.52, c.w*0.50, c.h*0.54, 0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function drawContrail(x1, y1, x2, y2, cr, cg, cb) {
  const tr = ctx.createLinearGradient(x1, y1, x2, y2);
  tr.addColorStop(0, `rgba(${cr},${cg},${cb},0.55)`);
  tr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  ctx.beginPath();
  ctx.moveTo(x1, y1-5); ctx.lineTo(x2, y2); ctx.lineTo(x1, y1+5);
  ctx.fillStyle = tr; ctx.fill();
  const tr2 = ctx.createLinearGradient(x1, y1, x2, y2);
  tr2.addColorStop(0, `rgba(${cr},${cg},${cb},0.13)`);
  tr2.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  ctx.beginPath();
  ctx.moveTo(x1, y1-15); ctx.lineTo(x2, y2); ctx.lineTo(x1, y1+15);
  ctx.fillStyle = tr2; ctx.fill();
}

function drawBibiPlane() {
  if (bibi.inv > 0 && Math.floor(bibi.inv/6)%2===0) return;
  drawContrail(bibi.x+bibi.w, bibi.y+bibi.h/2, bibi.x+bibi.w+145, bibi.y+bibi.h/2, 210,235,255);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.translate(bibi.x + bibi.w, bibi.y); ctx.scale(-1, 1);
  if (f35Img.loaded) ctx.drawImage(f35Img, 0, 0, bibi.w, bibi.h);
  ctx.restore();
  if (bibi1Img.loaded) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(bibi.x+bibi.w*0.38, bibi.y+bibi.h*0.38, 19, 19, 0, 0, Math.PI*2); ctx.clip();
    ctx.drawImage(bibi1Img, 0, Math.floor(bibi1Img.naturalHeight*0.08),
      bibi1Img.naturalWidth, bibi1Img.naturalHeight*0.92,
      bibi.x+bibi.w*0.38-19, bibi.y+bibi.h*0.38-19, 38, 38);
    ctx.restore();
    ctx.strokeStyle = '#ffd93d'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(bibi.x+bibi.w*0.38, bibi.y+bibi.h*0.38, 20, 20, 0,0,Math.PI*2); ctx.stroke();
    ctx.lineWidth = 1;
  }
  ctx.font = 'bold 9px "Courier New"'; ctx.textAlign = 'center';
  ctx.fillStyle = '#00ff41'; ctx.shadowColor = '#00ff41'; ctx.shadowBlur = 8;
  ctx.fillText('BIBI F-35', bibi.x+bibi.w/2, bibi.y-6);
  ctx.shadowBlur = 0;
}

function drawTrumpPlane() {
  if (trump.x + trump.w < -10 || trump.x > canvas.width+10) return;
  drawContrail(trump.x, trump.y+trump.h/2, trump.x-160, trump.y+trump.h/2, 255,210,100);
  ctx.save();
  if (trump.flashTimer > 0 && Math.floor(trump.flashTimer/3)%2===0) ctx.globalAlpha = 0.4;
  ctx.globalCompositeOperation = 'screen';
  if (b1Img.loaded) ctx.drawImage(b1Img, trump.x, trump.y, trump.w, trump.h);
  ctx.restore();
  if (trump1Img.loaded) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(trump.x+trump.w*0.38, trump.y+trump.h*0.35, 18, 18, 0,0,Math.PI*2); ctx.clip();
    ctx.drawImage(trump1Img, 0, Math.floor(trump1Img.naturalHeight*0.08),
      trump1Img.naturalWidth, trump1Img.naturalHeight*0.92,
      trump.x+trump.w*0.38-18, trump.y+trump.h*0.35-18, 36, 36);
    ctx.restore();
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(trump.x+trump.w*0.38, trump.y+trump.h*0.35, 19,19,0,0,Math.PI*2); ctx.stroke();
    ctx.lineWidth = 1;
  }
  ctx.font = 'bold 9px "Courier New"'; ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700'; ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 8;
  ctx.fillText('TRUMP B-1', trump.x+trump.w/2, trump.y-6);
  ctx.shadowBlur = 0;
}

function drawLaunchers() {
  for (const l of launchers) {
    if (!l.alive) continue;
    // Concrete pad
    ctx.fillStyle = 'rgba(72,42,14,0.8)';
    ctx.fillRect(l.x-3, l.y+l.h-4, l.w+6, 8);
    // Alarm glow when about to fire
    if (l.timer < 22) {
      const gA = 0.25 + 0.25 * Math.sin(frameCount * 0.35);
      ctx.fillStyle = `rgba(255,0,0,${gA})`;
      ctx.beginPath(); ctx.ellipse(l.x+l.w/2, l.y+l.h/2, l.w/2+8, l.h/2+7, 0,0,Math.PI*2); ctx.fill();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    if (launcherImg.loaded) ctx.drawImage(launcherImg, l.x, l.y, l.w, l.h);
    else { ctx.fillStyle = '#446633'; ctx.fillRect(l.x,l.y,l.w,l.h); }
    ctx.restore();
    // Status light
    const lit = l.timer < 15;
    ctx.fillStyle = lit ? '#ff2200' : (l.timer < 30 ? '#ff8800' : '#224400');
    if (lit) { ctx.shadowColor = '#ff2200'; ctx.shadowBlur = 7; }
    ctx.beginPath(); ctx.arc(l.x+l.w/2, l.y-5, 3.5, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawMissiles() {
  for (const m of bibiMissiles) {
    ctx.fillStyle='#00ff41'; ctx.shadowColor='#00ff41'; ctx.shadowBlur=10;
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.fillStyle='#ccffdd'; ctx.fillRect(m.x+1, m.y, m.w-2, 4);
    ctx.shadowBlur=0;
  }
  for (const m of trumpMissiles) {
    ctx.fillStyle='#ffd700'; ctx.shadowColor='#ffd700'; ctx.shadowBlur=10;
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.fillStyle='#ff8800'; ctx.fillRect(m.x+1, m.y+m.h-7, m.w-2, 7);
    ctx.shadowBlur=0;
  }
  for (const m of launcherMissiles) {
    ctx.fillStyle='#ff3300'; ctx.shadowColor='#ff3300'; ctx.shadowBlur=10;
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.fillStyle='#ffaa00'; ctx.fillRect(m.x+1, m.y+m.h-6, m.w-2, 6);
    ctx.fillStyle='#ffffff'; ctx.fillRect(m.x+2, m.y+m.h-3, m.w-4, 3);
    ctx.shadowBlur=0;
  }
}

function drawParticles() {
  for (const p of particles) {
    if (p.isRing) {
      ctx.globalAlpha = p.life * 0.65;
      ctx.strokeStyle = p.color; ctx.lineWidth = 2;
      ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur=0; ctx.lineWidth=1;
    } else {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
    }
  }
  ctx.shadowBlur=0; ctx.globalAlpha=1;
}

function drawHUD() {
  const alive = launchers.filter(l=>l.alive).length;
  const hbg = ctx.createLinearGradient(0,0,0,42);
  hbg.addColorStop(0,'rgba(0,25,12,0.92)');
  hbg.addColorStop(1,'rgba(0,12,6,0.70)');
  ctx.fillStyle=hbg; ctx.fillRect(0,0,canvas.width,42);
  // Corner brackets
  ctx.strokeStyle='rgba(0,255,65,0.50)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(6,40); ctx.lineTo(6,4); ctx.lineTo(72,4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(canvas.width-6,40); ctx.lineTo(canvas.width-6,4); ctx.lineTo(canvas.width-72,4); ctx.stroke();
  ctx.strokeStyle='rgba(0,255,65,0.22)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,42); ctx.lineTo(canvas.width,42); ctx.stroke();
  ctx.lineWidth=1;

  ctx.font='bold 15px "Courier New"'; ctx.textAlign='left';
  ctx.fillStyle='#00ff41'; ctx.shadowColor='#00ff41'; ctx.shadowBlur=10;
  ctx.fillText(`SCORE: ${score}`, 16, 27); ctx.shadowBlur=0;

  ctx.textAlign='center';
  const tCol = alive > 16 ? '#ff4444' : alive > 8 ? '#ffaa00' : '#00ff41';
  ctx.fillStyle=tCol; ctx.shadowColor=tCol; ctx.shadowBlur=8;
  ctx.font='bold 14px "Courier New"';
  ctx.fillText(`◎  TARGETS: ${alive} / 32`, canvas.width/2, 27);
  ctx.shadowBlur=0;

  ctx.textAlign='right'; ctx.font='bold 12px "Courier New"'; ctx.fillStyle='#aaaaaa';
  ctx.fillText('LIVES:', canvas.width-82, 27);
  for (let i=0; i<3; i++) {
    ctx.font='17px serif';
    ctx.fillStyle = i < bibi.lives ? '#ffd700' : '#2a2a2a';
    ctx.shadowColor = i < bibi.lives ? '#ffd700' : 'transparent';
    ctx.shadowBlur  = i < bibi.lives ? 7 : 0;
    ctx.fillText('✈', canvas.width-14-i*24, 29);
  }
  ctx.shadowBlur=0;

  if (bibiBehindCloud()) {
    ctx.font='bold 11px "Courier New"'; ctx.fillStyle='#aaddff';
    ctx.textAlign='center'; ctx.shadowColor='#aaddff'; ctx.shadowBlur=14;
    ctx.fillText('☁  STEALTH ACTIVE — MISSILES BLOCKED  ☁', canvas.width/2, 58);
    ctx.shadowBlur=0;
  }
}

// ── SCREENS ───────────────────────────────────────────────────
function drawStartScreen() {
  drawStars();
  drawMoon();
  drawMountains();

  ctx.textAlign='center';
  ctx.font='bold 70px "Courier New"';
  for (let b=28; b>=5; b-=5) {
    ctx.shadowColor='#00ff41'; ctx.shadowBlur=b;
    ctx.fillStyle=`rgba(0,255,65,${0.03+(28-b)*0.007})`;
    ctx.fillText('SKY BATTLE', canvas.width/2, 108);
  }
  ctx.fillStyle='#00ff41'; ctx.shadowColor='#00ff41'; ctx.shadowBlur=20;
  ctx.fillText('SKY BATTLE', canvas.width/2, 108);
  ctx.shadowBlur=0;

  ctx.font='bold 15px "Courier New"'; ctx.fillStyle='#ff8844';
  ctx.shadowColor='#ff4400'; ctx.shadowBlur=10;
  ctx.fillText('BIBI & TRUMP  vs  IRANIAN MISSILE LAUNCHERS', canvas.width/2, 142);
  ctx.shadowBlur=0;

  ctx.strokeStyle='rgba(0,255,65,0.32)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(110,157); ctx.lineTo(690,157); ctx.stroke();
  ctx.lineWidth=1;

  // Plane previews
  ctx.save();
  ctx.globalCompositeOperation='screen';
  if (f35Img.loaded) {
    ctx.save(); ctx.translate(228,193); ctx.scale(-1,1);
    ctx.drawImage(f35Img, 0, 0, 148, 58); ctx.restore();
  }
  if (b1Img.loaded) ctx.drawImage(b1Img, 440, 193, 162, 58);
  ctx.globalCompositeOperation='source-over';
  ctx.restore();

  ctx.font='bold 10px "Courier New"'; ctx.textAlign='center';
  ctx.fillStyle='#00ff41'; ctx.shadowColor='#00ff41'; ctx.shadowBlur=8;
  ctx.fillText('▲ BIBI F-35  [YOU]', 154, 186);
  ctx.fillStyle='#ffd700'; ctx.shadowColor='#ffd700';
  ctx.fillText('TRUMP B-1  [ALLY] ▲', 521, 186);
  ctx.shadowBlur=0;

  // Controls box
  ctx.fillStyle='rgba(0,35,15,0.75)';
  ctx.strokeStyle='rgba(0,255,65,0.28)'; ctx.lineWidth=1;
  roundRect(140, 278, 238, 122, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#44ff88'; ctx.font='bold 11px "Courier New"'; ctx.textAlign='left';
  ctx.fillText('◆  CONTROLS', 162, 300);
  ctx.fillStyle='#aaddff';
  ctx.fillText('← → ↑ ↓    MOVE', 162, 320);
  ctx.fillText('SPACE        SHOOT', 162, 338);
  ctx.fillText('ENTER / TAP  START', 162, 356);
  ctx.fillStyle='#88ccff'; ctx.font='10px "Courier New"';
  ctx.fillText('☁  FLY into clouds to hide', 162, 374);
  ctx.fillText('    from upward missiles', 162, 390);

  // Mission box
  ctx.fillStyle='rgba(30,5,0,0.75)';
  ctx.strokeStyle='rgba(255,100,0,0.28)'; ctx.lineWidth=1;
  roundRect(422, 278, 238, 122, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#ff8844'; ctx.font='bold 11px "Courier New"'; ctx.textAlign='left';
  ctx.fillText('◆  MISSION', 444, 300);
  ctx.fillStyle='#ffaa88';
  ctx.fillText('DESTROY ALL 32', 444, 320);
  ctx.fillText('MISSILE LAUNCHERS', 444, 338);
  ctx.fillText('TRUMP HELPS YOU!', 444, 356);
  ctx.fillStyle='#ff5522'; ctx.font='bold 10px "Courier New"';
  ctx.fillText('⚠ AVOID UPWARD MISSILES', 444, 374);
  ctx.fillStyle='#88ccff'; ctx.font='10px "Courier New"';
  ctx.fillText('☁ CLOUDS BLOCK MISSILES', 444, 390);

  if (Math.floor(Date.now()/540)%2===0) {
    ctx.fillStyle='#ffffff'; ctx.font='bold 19px "Courier New"';
    ctx.textAlign='center'; ctx.shadowColor='#ffffff'; ctx.shadowBlur=16;
    ctx.fillText('►  PRESS ENTER / TAP TO START  ◄', canvas.width/2, 452);
    ctx.shadowBlur=0;
  }

  ctx.font='11px "Courier New"'; ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.textAlign='center';
  ctx.fillText('© 2025 IDV – Israel Defense Venture  |  All rights reserved', canvas.width/2, 612);
}

function drawGameOverScreen() {
  drawStars();
  const rg = ctx.createRadialGradient(canvas.width/2,250,20, canvas.width/2,250,280);
  rg.addColorStop(0,'rgba(200,0,0,0.18)'); rg.addColorStop(1,'rgba(200,0,0,0)');
  ctx.fillStyle=rg; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.textAlign='center';
  ctx.font='bold 64px "Courier New"'; ctx.fillStyle='#ff4444';
  ctx.shadowColor='#ff0000'; ctx.shadowBlur=32;
  ctx.fillText('SHOT DOWN!', canvas.width/2, 198); ctx.shadowBlur=0;
  ctx.font='bold 15px "Courier New"'; ctx.fillStyle='#ff9988';
  ctx.fillText('YOUR F-35 HAS BEEN HIT', canvas.width/2, 238);
  ctx.font='bold 26px "Courier New"'; ctx.fillStyle='#ffd93d';
  ctx.shadowColor='#ffd93d'; ctx.shadowBlur=10;
  ctx.fillText(`FINAL SCORE:  ${score}`, canvas.width/2, 292); ctx.shadowBlur=0;
  const rem = launchers.filter(l=>l.alive).length;
  ctx.font='bold 15px "Courier New"'; ctx.fillStyle='#ff8888';
  ctx.fillText(`${rem} LAUNCHERS STILL ACTIVE`, canvas.width/2, 335);
  if (Math.floor(Date.now()/540)%2===0) {
    ctx.fillStyle='#ffffff'; ctx.font='bold 19px "Courier New"';
    ctx.shadowColor='#ffffff'; ctx.shadowBlur=14;
    ctx.fillText('►  ENTER / TAP TO RETRY  ◄', canvas.width/2, 402); ctx.shadowBlur=0;
  }
}

function drawWinScreen() {
  drawStars();
  const gg = ctx.createRadialGradient(canvas.width/2,240,10, canvas.width/2,240,300);
  gg.addColorStop(0,'rgba(255,200,0,0.16)'); gg.addColorStop(1,'rgba(255,200,0,0)');
  ctx.fillStyle=gg; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.textAlign='center';
  ctx.font='bold 52px "Courier New"'; ctx.fillStyle='#00ff41';
  ctx.shadowColor='#00ff41'; ctx.shadowBlur=36;
  ctx.fillText('MISSION COMPLETE!', canvas.width/2, 178); ctx.shadowBlur=0;
  ctx.font='bold 22px "Courier New"'; ctx.fillStyle='#ffdd44';
  ctx.shadowColor='#ffaa00'; ctx.shadowBlur=14;
  ctx.fillText('ALL LAUNCHERS DESTROYED!', canvas.width/2, 228); ctx.shadowBlur=0;
  ctx.font='bold 28px "Courier New"'; ctx.fillStyle='#00ff41';
  ctx.shadowColor='#00ff41'; ctx.shadowBlur=12;
  ctx.fillText(`SCORE:  ${score}`, canvas.width/2, 285); ctx.shadowBlur=0;
  ctx.font='bold 13px "Courier New"'; ctx.fillStyle='#88ffaa';
  ctx.fillText("IRAN'S NUCLEAR THREAT HAS BEEN NEUTRALIZED", canvas.width/2, 330);
  if (Math.floor(Date.now()/540)%2===0) {
    ctx.fillStyle='#ffffff'; ctx.font='bold 19px "Courier New"';
    ctx.shadowColor='#ffffff'; ctx.shadowBlur=14;
    ctx.fillText('►  ENTER / TAP TO PLAY AGAIN  ◄', canvas.width/2, 400); ctx.shadowBlur=0;
  }
}

// ── FLOW ──────────────────────────────────────────────────────
function handleStart() {
  if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (gameState === 'start' || gameState === 'gameover' || gameState === 'win') {
    resetGame(); gameState = 'playing';
  }
}

function resetGame() {
  score=0; frameCount=0;
  bibi.x=580; bibi.y=115; bibi.lives=3; bibi.inv=0;
  trump.x=-200; trump.fired=false; trump.flashTimer=0;
  bibiMissiles.length=0; trumpMissiles.length=0; launcherMissiles.length=0; particles.length=0;
  clouds[0].x=80; clouds[1].x=380; clouds[2].x=610;
  launchers.forEach(l => {
    l.alive=true;
    l.timer=40+Math.floor(Math.random()*90)+(l.row||0)*15;
  });
}

// ── MAIN LOOP ─────────────────────────────────────────────────
function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }

// ── MOBILE TOUCH ──────────────────────────────────────────────
const btnLeft  = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnShoot = document.getElementById('btnShoot');
const btnStart = document.getElementById('btnStart');
function hold(k,v){ keys[k]=v; if(k==='Space'&&v) spaceJustPressed=true; }
btnLeft.addEventListener('touchstart',  e=>{e.preventDefault();hold('ArrowLeft',true); },{passive:false});
btnLeft.addEventListener('touchend',    e=>{e.preventDefault();hold('ArrowLeft',false);},{passive:false});
btnRight.addEventListener('touchstart', e=>{e.preventDefault();hold('ArrowRight',true); },{passive:false});
btnRight.addEventListener('touchend',   e=>{e.preventDefault();hold('ArrowRight',false);},{passive:false});
btnShoot.addEventListener('touchstart', e=>{e.preventDefault();hold('Space',true); },{passive:false});
btnShoot.addEventListener('touchend',   e=>{e.preventDefault();hold('Space',false);},{passive:false});
btnStart.addEventListener('touchstart', e=>{e.preventDefault();handleStart();},{passive:false});
btnStart.addEventListener('click', ()=>handleStart());
canvas.addEventListener('touchstart', e=>{e.preventDefault();handleStart();},{passive:false});
canvas.addEventListener('click', ()=>handleStart());

gameLoop();
