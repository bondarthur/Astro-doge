'use strict';
const W = 256, H = 384;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function fit() {
  const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H)));
  cv.style.width = W * s + 'px';
  cv.style.height = H * s + 'px';
}
addEventListener('resize', fit);
fit();

/* ---------------- audio ---------------- */
let AC = null, muted = false;
function actx() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  return AC;
}
function beep(f, d, type, v, slide) {
  if (muted) return;
  const a = actx(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(f, a.currentTime);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(30, f + slide), a.currentTime + d);
  g.gain.setValueAtTime(v || 0.12, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + d);
  o.connect(g); g.connect(a.destination);
  o.start(); o.stop(a.currentTime + d);
}
const sfx = {
  start() { beep(440, .1, 'square', .1); setTimeout(() => beep(660, .15, 'square', .1), 100); },
  bonus() { beep(523, .12, 'square', .14); setTimeout(() => beep(659, .12, 'square', .14), 110); setTimeout(() => beep(784, .22, 'square', .14), 220); },
  phase() { beep(220, .15, 'square', .12); setTimeout(() => beep(220, .15, 'square', .12), 180); },
  die() { beep(300, .6, 'sawtooth', .2, -260); }
};

/* ---------------- pixel sprite helpers ---------------- */
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function sprite(map, pal) {
  const h = map.length, w = map[0].length, c = mk(w, h), g = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = map[y][x];
    if (ch !== '.') { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); }
  }
  return c;
}

/* ---------------- astronaut ---------------- */
const APAL = { W: '#ececf4', w: '#b9bccf', V: '#5fc8f0', c: '#c8efff', G: '#8f96ad', R: '#e05252', B: '#3a3f55' };
const ASTRO_1 = [
  '....WWWW....',
  '...WWWWWW...',
  '..WWVVVVWW..',
  '..WVcVVVVW..',
  '..WWVVVVWW..',
  '..WWWWWWWW..',
  '.GGWWWWWWGG.',
  'GGGWWWWWWGGG',
  'GGGWWRRWWGGG',
  '.G.WWWWWW.G.',
  '...WWWWWW...',
  '..WWW..WWW..',
  '..WW....WW..',
  '..Ww....wW..',
  '..ww....ww..',
  '..BB....BB..'
];
const ASTRO_2 = [
  '....WWWW....',
  '...WWWWWW...',
  '..WWVVVVWW..',
  '..WVcVVVVW..',
  '..WWVVVVWW..',
  '..WWWWWWWW..',
  '.GGWWWWWWGG.',
  'GGGWWWWWWGGG',
  'GGGWWRRWWGGG',
  '.G.WWWWWW.G.',
  '...WWWWWW...',
  '...WWWWWW...',
  '...WW..WW...',
  '...Ww..wW...',
  '...ww..ww...',
  '...BB..BB...'
];
const astro1 = sprite(ASTRO_1, APAL);
const astro2 = sprite(ASTRO_2, APAL);

/* ---------------- ufo / satellite sprites ---------------- */
const ufoSpr = sprite([
  '.....GGGGG.....',
  '...GGGGGGGGG...',
  '..GGGGGGGGGGG..',
  '.BBBBBBBBBBBBB.',
  'BCYCBCYCBCYCBCB',
  '..B.........B..'
], { G: '#9fb4c8', B: '#565e77', C: '#5fe8d8', Y: '#f0d060' });
const satSpr = sprite([
  'PPB.......BPP',
  'PPB..WWW..BPP',
  'PPBBBWWWBBBPP',
  'PPB..WWW..BPP',
  'PPB.......BPP'
], { P: '#3a5ac4', B: '#8f96ad', W: '#d8dce8' });

/* ---------------- rock / planet generators ---------------- */
function makeRock(size) {
  const c = mk(size, size), g = c.getContext('2d');
  const R = size / 2 - 1, n = 9, rad = [];
  for (let i = 0; i < n; i++) rad.push(R * rand(0.72, 1));
  const cx = (size - 1) / 2, cy = (size - 1) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
    if (d > R + 0.5) continue;
    const a = Math.atan2(dy, dx) + Math.PI;
    const f = a / (Math.PI * 2) * n, i0 = Math.floor(f) % n, i1 = (i0 + 1) % n, t = f - Math.floor(f);
    const rr = rad[i0] * (1 - t) + rad[i1] * t;
    if (d > rr) continue;
    let col = '#7b8093';
    if (d > rr - 1.6) col = '#4c5060';
    else if (dx + dy < -rr * 0.45) col = '#9aa0b5';
    g.fillStyle = col; g.fillRect(x, y, 1, 1);
  }
  const nc = irand(1, 3);
  for (let i = 0; i < nc; i++) {
    const a = rand(0, Math.PI * 2), r0 = rand(0, R * 0.5);
    const px = Math.round(cx + Math.cos(a) * r0), py = Math.round(cy + Math.sin(a) * r0);
    const cr = Math.max(1, irand(1, Math.max(1, size / 7 | 0)));
    g.fillStyle = '#565a6a';
    g.beginPath(); g.arc(px, py, cr, 0, 7); g.fill();
  }
  return c;
}
const PLANET_COLS = [
  ['#c96a45', '#8f4630', '#e8926b'],
  ['#4a7ec4', '#33578c', '#7fa8dd'],
  ['#8a5ac4', '#5f3d8c', '#b088dd'],
  ['#3fae9a', '#2a7a6b', '#6fd0bd'],
  ['#c4a04a', '#8c7130', '#ddc276']
];
function makePlanet(size) {
  const c = mk(size, size), g = c.getContext('2d');
  const [base, dark, light] = PLANET_COLS[irand(0, PLANET_COLS.length - 1)];
  const R = size / 2 - 1, cx = (size - 1) / 2, cy = (size - 1) / 2;
  const banded = Math.random() < 0.5;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
    if (d > R) continue;
    let col = base;
    if (dx + dy > R * 0.35) col = dark;
    else if (dx + dy < -R * 0.45) col = light;
    if (banded && d < R - 1 && y % 7 < 2) col = (col === base) ? dark : base;
    g.fillStyle = col; g.fillRect(x, y, 1, 1);
  }
  if (!banded) {
    const nc = irand(2, 4);
    for (let i = 0; i < nc; i++) {
      const a = rand(0, Math.PI * 2), r0 = rand(0, R * 0.55);
      g.fillStyle = dark;
      g.beginPath();
      g.arc(Math.round(cx + Math.cos(a) * r0), Math.round(cy + Math.sin(a) * r0), Math.max(1, size / 9 | 0), 0, 7);
      g.fill();
    }
  }
  return c;
}

/* ---------------- background (aesthetic layer, not gameplay) ---------------- */
const neb = mk(W, H * 2);
{
  const g = neb.getContext('2d');
  const cols = ['rgba(120,60,200,0.10)', 'rgba(40,80,200,0.10)', 'rgba(200,60,140,0.08)', 'rgba(40,180,180,0.07)'];
  for (let i = 0; i < 26; i++) {
    g.fillStyle = cols[irand(0, cols.length - 1)];
    g.beginPath();
    g.arc(rand(0, W), rand(0, H * 2), rand(18, 55), 0, 7);
    g.fill();
  }
}
let nebY = 0;
const stars = [];
const STAR_SPEED = [5, 12, 24];
for (let i = 0; i < 90; i++) {
  stars.push({ x: rand(0, W), y: rand(0, H), l: i < 45 ? 0 : i < 75 ? 1 : 2, tw: rand(0, 7) });
}
