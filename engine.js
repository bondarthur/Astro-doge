let state = 'title', t = 0, score = 0, nextBonus = 90, bonusT = 0;
let phaseMsg = '', phaseT = 0, prevPhase = 0;
let invul = 0, overT = 0, newBest = false, best = 0;
try { best = +localStorage.getItem('astroBest') || 0; } catch (e) {}
let px = W / 2, py = H - 60, frameT = 0, moving = false;
let objs = [], parts = [], spawnTimer = 0, timeAbs = 0;
let eggs = [], eggT = 0, eggMsg = '';
let floats = [], gemTimer = 3;

function phaseOf(t) { return t < 150 ? 1 : t < 240 ? 2 : 3; }
function phaseName(p) { return p === 1 ? 'DRIFT' : p === 2 ? 'STORM' : 'CHAOS'; }
function diff(tt) {
  let speed, interval;
  if (tt < 150) { const p = tt / 150; speed = 70 + p * 45; interval = 1.15 - p * 0.55; }
  else if (tt < 240) { const p = (tt - 150) / 90; speed = 115 + p * 50; interval = 0.6 - p * 0.3; }
  else { const p = Math.min(1, (tt - 240) / 240); speed = 165 + p * 70; interval = 0.3 - p * 0.12; }
  return { speed, interval };
}

/* ---------------- input ---------------- */
const keys = {};
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  keys[e.key] = true;
  if (e.key === 'Enter' || e.key === ' ') {
    if (state === 'title' || (state === 'over' && overT > 0.6)) start();
  }
  if (e.key === 'm' || e.key === 'M') muted = !muted;
});
addEventListener('keyup', e => { keys[e.key] = false; });

/* ---------------- touch controls ---------------- */
let touchX = 0, touchY = 0, touchActive = false, tOff = 0;
const BASE_OFF = Math.round(H * 0.09);
function touchOffset(tch) {
  const r = cv.getBoundingClientRect();
  const s = r.height / H || 1;
  const pad = ((tch.radiusY || 0) * 2.5 + 20) / s;
  return Math.max(BASE_OFF, pad);
}
function canvasPos(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
}
cv.addEventListener('touchstart', e => {
  e.preventDefault();
  const tch = e.touches[0];
  const p = canvasPos(tch);
  if (p.x >= W - 16 && p.y <= 14) { muted = !muted; return; }
  if (state === 'title' || (state === 'over' && overT > 0.6)) { start(); return; }
  tOff = touchOffset(tch);
  touchX = p.x; touchY = p.y - tOff; touchActive = true;
}, { passive: false });
cv.addEventListener('touchmove', e => {
  e.preventDefault();
  const tch = e.touches[0];
  const p = canvasPos(tch);
  tOff = touchOffset(tch);
  touchX = p.x; touchY = p.y - tOff;
}, { passive: false });
cv.addEventListener('touchend', e => {
  e.preventDefault();
  touchActive = false;
}, { passive: false });
cv.addEventListener('click', e => {
  const p = canvasPos(e);
  if (p.x >= W - 16 && p.y <= 14) muted = !muted;
});

/* ---------------- spawning ---------------- */
function pickType(tt) {
  const w = [['rock', 5]];
  if (tt > 30) w.push(['planet', 1.6]);
  if (tt > 45) w.push(['comet', tt > 240 ? 3 : 1.8]);
  if (tt > 150) w.push(['ufo', 1.2]);
  if (tt > 300) w.push(['sat', 1.0]);
  let tot = 0;
  for (const e of w) tot += e[1];
  let r = Math.random() * tot;
  for (const e of w) { r -= e[1]; if (r <= 0) return e[0]; }
  return 'rock';
}
function spawnObj() {
  const tt = state === 'play' ? t : 200;
  const type = pickType(tt);
  const o = { type, x: rand(12, W - 12), y: -40, vx: 0, vy: 0, r: 5, wob: 0 };
  if (type === 'rock') {
    const s = irand(10, Math.min(34, 16 + Math.floor(tt / 45) * 2));
    o.spr = makeRock(s); o.r = s * 0.42;
    o.vy = rand(0.75, 1.25); o.vx = rand(-12, 12);
  } else if (type === 'planet') {
    const s = irand(22, 40);
    o.spr = makePlanet(s); o.r = s * 0.46;
    o.vy = rand(0.55, 0.8); o.vx = rand(-8, 8);
  } else if (type === 'comet') {
    o.r = 2.5; o.vy = rand(1.7, 2.3); o.vx = rand(-45, 45);
  } else if (type === 'ufo') {
    o.spr = ufoSpr; o.r = 6;
    o.vy = rand(0.8, 1.1); o.wob = 1;
    o.bx = o.x; o.amp = rand(20, 40); o.freq = rand(1.5, 3);
  } else {
    o.spr = satSpr; o.r = 5.5;
    o.vy = rand(0.9, 1.2); o.vx = rand(-20, 20);
  }
  objs.push(o);
}

/* ---------------- effects ---------------- */
function explode(x, y) {
  for (let i = 0; i < 50; i++) {
    const a = rand(0, 7), s = rand(20, 130);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 1.1), col: ['#ffffff', '#ffd24a', '#ff7a3c', '#9aa0b5'][irand(0, 3)] });
  }
}

/* ---------------- easter eggs ---------------- */
function spawnEgg(e) {
  objs.push({ type: 'egg', value: e.value, name: e.name, x: rand(30, W - 30), y: -40, vx: rand(-6, 6), vy: rand(0.5, 0.65), r: e.r, spr: e.spr, wob: 0 });
}
function rollEggs() {
  eggs = [];
  if (Math.random() < 0.5) eggs.push(Object.assign({ at: rand(25, 200) }, EGGS_A[irand(0, EGGS_A.length - 1)]));
  if (Math.random() < 0.05) eggs.push(Object.assign({ at: rand(40, 240) }, EGGS_B[irand(0, EGGS_B.length - 1)]));
}

/* ---------------- collectibles ---------------- */
function spawnGem() {
  objs.push({ type: 'gem', value: 200000, x: rand(14, W - 14), y: -12, vx: rand(-8, 8), vy: rand(0.6, 0.9), r: 4.5, spr: GEMS[irand(0, GEMS.length - 1)], wob: 0 });
}
function collect(o) {
  score += o.value;
  floats.push({ x: o.x, y: o.y, txt: '+' + o.value.toLocaleString('en-US'), life: 1.3, col: o.value >= 2000000 ? '#ffd24a' : '#7aff9a' });
  if (o.value >= 2000000) sfx.bonus(); else sfx.pickup();
}

/* ---------------- flow ---------------- */
function start() {
  state = 'play'; t = 0; score = 0; nextBonus = 90; bonusT = 0;
  phaseMsg = ''; phaseT = 0; prevPhase = 1;
  invul = 1.5; overT = 0; newBest = false;
  px = W / 2; py = H - 60;
  objs = []; parts = []; spawnTimer = 0.5;
  gemTimer = 2.5; floats = [];
  eggT = 0; eggMsg = '';
  rollEggs();
  startMusic();
  actx(); sfx.start();
}
function die() {
  explode(px, py);
  state = 'over'; overT = 0;
  stopMusic();
  sfx.die();
  if (Math.floor(score) > best) {
    best = Math.floor(score); newBest = true;
    try { localStorage.setItem('astroBest', best); } catch (e) {}
  }
}

/* ---------------- update ---------------- */
function update(dt) {
  timeAbs += dt;
  nebY = (nebY + 3 * dt) % (H * 2);
  for (const s of stars) { s.y += STAR_SPEED[s.l] * dt; if (s.y > H) { s.y -= H; s.x = rand(0, W); } }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
  if (bonusT > 0) bonusT -= dt;
  if (phaseT > 0) phaseT -= dt;
  if (eggT > 0) eggT -= dt;
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.y -= 18 * dt; f.life -= dt;
    if (f.life <= 0) floats.splice(i, 1);
  }

  if (state === 'play') {
    t += dt;
    score += dt * (100 + Math.floor(t / 30) * 25);
    if (t >= nextBonus) { score += 1000000; nextBonus += 90; bonusT = 2; sfx.bonus(); }
    for (let i = eggs.length - 1; i >= 0; i--) {
      if (t >= eggs[i].at) {
        spawnEgg(eggs[i]);
        eggMsg = eggs[i].name; eggT = 2.2; sfx.phase();
        eggs.splice(i, 1);
      }
    }
    gemTimer -= dt;
    if (gemTimer <= 0) { gemTimer = rand(2.5, 5); spawnGem(); }
    const ph = phaseOf(t);
    if (ph !== prevPhase) { prevPhase = ph; phaseMsg = phaseName(ph); phaseT = 2; sfx.phase(); }
    if (invul > 0) invul -= dt;

    moving = false;
    const PS = 120 * dt;
    if (keys.ArrowLeft) { px -= PS; moving = true; }
    if (keys.ArrowRight) { px += PS; moving = true; }
    if (keys.ArrowUp) { py -= PS; moving = true; }
    if (keys.ArrowDown) { py += PS; moving = true; }
    if (touchActive) {
      px += (touchX - px) * Math.min(1, dt * 14);
      py += (touchY - py) * Math.min(1, dt * 14);
      if (Math.abs(touchX - px) > 1.5 || Math.abs(touchY - py) > 1.5) moving = true;
    }
    px = clamp(px, 8, W - 8); py = clamp(py, H * 0.3, H - 14);
    frameT += moving ? dt * 8 : dt * 2;
    if (moving && Math.random() < 0.5) {
      parts.push({ x: px + rand(-2, 2), y: py + 8, vx: rand(-8, 8), vy: rand(30, 60), life: rand(0.15, 0.35), col: '#8cd8ff' });
    }

    const d = diff(t);
    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawnTimer = d.interval * rand(0.7, 1.3); spawnObj(); }
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i];
      o.y += o.vy * d.speed * dt;
      if (o.wob) o.x = o.bx + Math.sin(timeAbs * o.freq) * o.amp;
      else o.x += o.vx * dt;
      if (o.y > H + 50) { objs.splice(i, 1); continue; }
      const dx = o.x - px, dy = o.y - py, rr = o.r + 4;
      const hit = dx * dx + dy * dy < rr * rr;
      if (hit && (o.type === 'gem' || o.type === 'egg')) { collect(o); objs.splice(i, 1); continue; }
      if (hit && invul <= 0) { die(); break; }
    }
  } else if (state === 'over') {
    overT += dt;
    for (const o of objs) { o.y += o.vy * 40 * dt; if (!o.wob) o.x += o.vx * dt * 0.3; }
  }
}

/* ---------------- draw ---------------- */
function text(s, x, y, size, col, align, bold) {
  ctx.font = (bold ? 'bold ' : '') + size + 'px "Courier New",monospace';
  ctx.fillStyle = col; ctx.textAlign = align || 'left'; ctx.textBaseline = 'top';
  ctx.fillText(s, x, y);
}
function fmtTime(s) {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return m + ':' + String(ss).padStart(2, '0');
}
function draw() {
  ctx.fillStyle = '#05050c';
  ctx.fillRect(0, 0, W, H);

  ctx.drawImage(neb, 0, Math.round(-nebY));
  ctx.drawImage(neb, 0, Math.round(-nebY + H * 2));

  for (const s of stars) {
    const b = 0.5 + 0.5 * Math.sin(timeAbs * 2 + s.tw);
    ctx.fillStyle = s.l === 2 ? 'rgba(220,230,255,' + (0.5 + b * 0.5) + ')' : 'rgba(160,175,220,' + (0.3 + b * 0.4) + ')';
    ctx.fillRect(Math.round(s.x), Math.round(s.y), s.l === 2 ? 2 : 1, s.l === 2 ? 2 : 1);
  }

  for (const o of objs) {
    if (o.type === 'comet') {
      ctx.fillStyle = 'rgba(140,220,255,0.45)';
      for (let i = 1; i <= 8; i++) ctx.fillRect(Math.round(o.x - o.vx * 0.02 * i), Math.round(o.y - i * 3), 2, 2);
      ctx.fillStyle = '#8cd8ff';
      ctx.fillRect(Math.round(o.x) - 1, Math.round(o.y) - 1, 3, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(o.x), Math.round(o.y), 1, 1);
    } else {
      if (o.type === 'gem' || o.type === 'egg') {
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(timeAbs * 6);
        ctx.strokeStyle = '#3fff7a';
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r + 5, 0, 7);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(o.spr, Math.round(o.x - o.spr.width / 2), Math.round(o.y - o.spr.height / 2));
    }
  }

  if (touchActive && state === 'play') {
    ctx.fillStyle = 'rgba(140,220,255,0.55)';
    ctx.fillRect(Math.round(touchX) - 1, Math.round(touchY + tOff) - 1, 3, 3);
  }

  if (state === 'play' && (invul <= 0 || Math.floor(timeAbs * 10) % 2 === 0)) {
    const spr = Math.floor(frameT) % 2 === 0 ? astro1 : astro2;
    ctx.drawImage(spr, Math.round(px - 6), Math.round(py - 8));
  }

  for (const p of parts) {
    ctx.globalAlpha = clamp(p.life * 2, 0, 1);
    ctx.fillStyle = p.col;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
  }
  ctx.globalAlpha = 1;

  for (const f of floats) {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    text(f.txt, f.x, f.y, 9, f.col, 'center', true);
  }
  ctx.globalAlpha = 1;

  if (state === 'play' || state === 'over') {
    text('SCORE ' + String(Math.floor(score)).padStart(8, '0'), 4, 4, 8, '#cfd3ff');
    text(fmtTime(t), W - 18, 4, 8, '#cfd3ff', 'right');
    text('PHASE ' + phaseOf(t) + ': ' + phaseName(phaseOf(t)), W / 2, 16, 7, '#7a80a8', 'center');
    if (bonusT > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (bonusT * 0.12) + ')';
      ctx.fillRect(0, 0, W, H);
      text('+1,000,000 BONUS!', W / 2, H * 0.4, 12, '#ffd24a', 'center', true);
    }
    if (phaseT > 0) {
      text(phaseMsg + '!', W / 2, H * 0.5, 14, phaseMsg === 'CHAOS' ? '#ff5a5a' : '#8cd8ff', 'center', true);
    }
    if (eggT > 0) {
      text(eggMsg + '?!', W / 2, H * 0.58, 10, '#7aff9a', 'center', true);
    }
  }

  ctx.drawImage(speakerSpr, W - 13, 4);
  if (!muted) {
    ctx.fillStyle = '#cfd3ff';
    ctx.fillRect(W - 5, 5, 1, 1);
    ctx.fillRect(W - 5, 7, 1, 1);
    ctx.fillRect(W - 6, 6, 1, 1);
  } else {
    ctx.fillStyle = '#ff5a5a';
    for (let i = 0; i < 9; i++) ctx.fillRect(W - 15 + i, 3 + i, 1, 1);
  }

  if (state === 'title') {
    text('ASTRO', W / 2, 78, 30, '#8cd8ff', 'center', true);
    text('DODGE', W / 2, 110, 30, '#e05252', 'center', true);
    const bob = Math.sin(timeAbs * 2) * 4;
    ctx.drawImage(astro1, 4, 0, 12, 16, W / 2 - 12, 170 + bob, 24, 32);
    text('ARROW KEYS TO MOVE', W / 2, 232, 8, '#cfd3ff', 'center');
    text('DODGE THE GALAXY', W / 2, 246, 8, '#7a80a8', 'center');
    text('+1,000,000 EVERY 1:30', W / 2, 260, 8, '#ffd24a', 'center');
    text('ON TOUCH: DRAG TO MOVE', W / 2, 274, 7, '#7a80a8', 'center');
    if (Math.floor(timeAbs * 2) % 2 === 0) text('PRESS ENTER OR TAP TO START', W / 2, 296, 9, '#ffffff', 'center', true);
    text('M: SOUND ' + (muted ? 'OFF' : 'ON') + '   BEST ' + best, W / 2, 330, 7, '#7a80a8', 'center');
  }

  if (state === 'over' && overT > 0.6) {
    ctx.fillStyle = 'rgba(5,5,12,0.72)';
    ctx.fillRect(0, 0, W, H);
    text('GAME OVER', W / 2, 110, 20, '#ff5a5a', 'center', true);
    text('SCORE ' + Math.floor(score), W / 2, 150, 10, '#ffffff', 'center', true);
    text('TIME ' + fmtTime(t), W / 2, 168, 10, '#cfd3ff', 'center');
    if (newBest) text('NEW BEST!', W / 2, 186, 9, '#ffd24a', 'center', true);
    else text('BEST ' + best, W / 2, 186, 9, '#7a80a8', 'center');
    if (Math.floor(timeAbs * 2) % 2 === 0) text('TAP OR PRESS ENTER TO RETRY', W / 2, 240, 9, '#ffffff', 'center', true);
  }
}

/* ---------------- main loop ---------------- */
let last = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (ts - last) / 1000 || 0);
  last = ts;
  update(dt);
  draw();
}
requestAnimationFrame(loop);
