/* ============================================================
   MathMon — main.js
   ============================================================ */
'use strict';

// ── Theme palette (8 colors) ─────────────────────────────────
const THEMES = [
  { bg: '#4A9FE0', dk: '#2D7DC0' },  // 0: blue
  { bg: '#F0A030', dk: '#C07818' },  // 1: amber
  { bg: '#E85D3A', dk: '#BF3C20' },  // 2: orange
  { bg: '#3DB8A8', dk: '#208A7C' },  // 3: teal
  { bg: '#7B5AE0', dk: '#5A3AC0' },  // 4: purple
  { bg: '#E040A0', dk: '#B01878' },  // 5: pink
  { bg: '#2DC97E', dk: '#1A9A58' },  // 6: green
  { bg: '#E83A5D', dk: '#BF1840' },  // 7: red
];

// HSL変換ヘルパー
function hexToHsl(hex) {
  let r = parseInt(hex.slice(1,3),16)/255;
  let g = parseInt(hex.slice(3,5),16)/255;
  let b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max+min)/2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch(max) {
      case r: h = ((g-b)/d + (g<b ? 6 : 0)) / 6; break;
      case g: h = ((b-r)/d + 2) / 6; break;
      case b: h = ((r-g)/d + 4) / 6; break;
    }
  }
  return [Math.round(h*360), Math.round(s*100), Math.round(l*100)];
}

// ── カラーピッカー（厳選色 + 精密モーション） ────────────────
const PICKER_COLORS = [
  '#3E7CE1', '#4AA3E8', '#34B3A0', '#46C17C',
  '#F2A33A', '#EE7B5E', '#DA5C8C', '#8A6BE8',
  '#5B6D9A', '#4C7A70', '#C66B44', '#7A4DAE',
  '#2F4F7F', '#A5537A',
];

let _lastPickerColor = '';
function applyPickerColor(hex) {
  _lastPickerColor = hex;
  const [h, s, l] = hexToHsl(hex);
  const dk = `hsl(${h},${Math.min(s + 10, 100)}%,${Math.max(l - 14, 8)}%)`;
  document.documentElement.style.setProperty('--theme', hex);
  document.documentElement.style.setProperty('--theme-dk', dk);
  const mc = document.querySelector('meta[name="theme-color"]');
  if (mc) mc.content = hex;
}

const BALL_COUNT_MIN = 18;
const BALL_COUNT_MAX = 26;
const COLLISION_ITERATIONS = 5;

const BALLS = {
  list: [],
  cup: null,
  w: 0,
  h: 0,
  raf: null,
  gravity: 0.28,
  bounce: 0.68,
  friction: 0.985,
};

function updateBallPos(b) {
  if (!b.el) return;
  b.el.style.left = `${b.x - b.r}px`;
  b.el.style.top = `${b.y - b.r}px`;
}

function tick() {
  const cupEl = BALLS.cup;
  const sheet = document.getElementById('color-picker-sheet');
  if (!cupEl || !sheet || sheet.classList.contains('hidden')) return;
  const rect = cupEl.getBoundingClientRect();
  BALLS.w = rect.width;
  BALLS.h = rect.height;

  for (const b of BALLS.list) {
    if (b.dragging) continue;
    if (b.spawnDelay > 0) {
      b.spawnDelay -= 1 / 60;
      if (b.spawnDelay <= 0 && b.el) b.el.classList.add('ball-active');
      updateBallPos(b);
      continue;
    }
    b.vy += BALLS.gravity;
    b.vx *= BALLS.friction;
    b.vy *= BALLS.friction;
    b.x += b.vx;
    b.y += b.vy;

    if (b.x - b.r < 0) { b.x = b.r; b.vx *= -BALLS.bounce; }
    if (b.x + b.r > BALLS.w) { b.x = BALLS.w - b.r; b.vx *= -BALLS.bounce; }
    if (b.y - b.r < 0) { b.y = b.r; b.vy *= -BALLS.bounce; }
    if (b.y + b.r > BALLS.h) { b.y = BALLS.h - b.r; b.vy *= -BALLS.bounce; }
    updateBallPos(b);
  }

  for (let iter = 0; iter < COLLISION_ITERATIONS; iter++) {
    for (let i = 0; i < BALLS.list.length; i++) {
      const b = BALLS.list[i];
      if (b.dragging) continue;
      for (let j = i + 1; j < BALLS.list.length; j++) {
        const o = BALLS.list[j];
        if (o.dragging) continue;
        const dx = o.x - b.x, dy = o.y - b.y;
        const dist = Math.hypot(dx, dy);
        const minD = b.r + o.r;
        if (dist < minD - 0.01) {
          const nx = dist > 0.001 ? dx / dist : 1;
          const ny = dist > 0.001 ? dy / dist : 0;
          const overlap = minD - dist;
          const totalR = b.r + o.r;
          const bRatio = o.r / totalR;
          const oRatio = b.r / totalR;
          b.x -= nx * overlap * bRatio;
          b.y -= ny * overlap * bRatio;
          o.x += nx * overlap * oRatio;
          o.y += ny * overlap * oRatio;
          const dvx = b.vx - o.vx, dvy = b.vy - o.vy;
          const dvn = dvx * nx + dvy * ny;
          if (dvn < 0) continue;
          const cr = BALLS.bounce;
          b.vx -= dvn * nx * cr;
          b.vy -= dvn * ny * cr;
          o.vx += dvn * nx * cr;
          o.vy += dvn * ny * cr;
        }
      }
    }
    for (const b of BALLS.list) {
      if (!b.dragging) updateBallPos(b);
    }
  }
  BALLS.raf = requestAnimationFrame(tick);
}

function openColorPicker() {
  const sheet = document.getElementById('color-picker-sheet');
  const fab = document.getElementById('palette-fab');
  if (sheet) sheet.classList.remove('hidden');
  if (fab) fab.classList.add('active');
  buildColorBalls();
  if (BALLS.raf) cancelAnimationFrame(BALLS.raf);
  BALLS.raf = requestAnimationFrame(tick);
}

function closeColorPicker() {
  const sheet = document.getElementById('color-picker-sheet');
  const fab = document.getElementById('palette-fab');
  if (sheet) sheet.classList.add('hidden');
  if (fab) fab.classList.remove('active');
  if (BALLS.raf) { cancelAnimationFrame(BALLS.raf); BALLS.raf = null; }
}

function initColorBalls() {
  const fab = document.getElementById('palette-fab');
  const backdrop = document.getElementById('color-picker-backdrop');
  if (fab) fab.addEventListener('click', () => { sfx.click(); openColorPicker(); });
  if (backdrop) backdrop.addEventListener('click', closeColorPicker);
}

function buildColorBalls() {
  const cup = document.getElementById('color-balls-cup');
  if (!cup) return;
  cup.innerHTML = '';
  BALLS.cup = cup;
  cup.style.pointerEvents = 'none';

  const rect = cup.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  BALLS.w = w;
  BALLS.h = h;

  const count = BALL_COUNT_MIN + Math.floor(Math.random() * (BALL_COUNT_MAX - BALL_COUNT_MIN + 1));
  const colors = [...PICKER_COLORS].sort(() => Math.random() - 0.5).slice(0, count);
  BALLS.list = [];

  for (let i = 0; i < count; i++) {
    const color = colors[i % colors.length];
    const r = 14 + Math.random() * 36;
    const x = r + Math.random() * (w - r * 2);
    const y = -r - Math.random() * 180;
    const ball = {
      x, y, r, color,
      vx: (Math.random() - 0.5) * 3,
      vy: 0,
      spawnDelay: i * 0.055 + Math.random() * 0.05,
      dragging: false,
    };

    const div = document.createElement('div');
    div.className = 'color-ball';
    div.dataset.color = color;
    div.style.width = `${r * 2}px`;
    div.style.height = `${r * 2}px`;
    div.style.left = `${x - r}px`;
    div.style.top = `${y - r}px`;
    div.style.background = color;
    div.style.pointerEvents = 'auto';

    div.addEventListener('click', () => {
      sfx.click();
      g.lockedTheme = 'custom';
      applyPickerColor(color);
      closeColorPicker();
    });

    ball.el = div;
    BALLS.list.push(ball);
    cup.appendChild(div);
  }
}

// Default color per difficulty
const DIFF_COLORS = {
  easy:0, medium:3, normal:1, hard:2,
  mult1:4, mult2:5, div1:6, div2:7,
};

let themeIdx = 0;

function applyTheme(idx) {
  themeIdx = ((idx % THEMES.length) + THEMES.length) % THEMES.length;
  const t = THEMES[themeIdx];
  const root = document.documentElement;
  root.style.setProperty('--theme',    t.bg);
  root.style.setProperty('--theme-dk', t.dk);
  const mc = document.querySelector('meta[name="theme-color"]');
  if (mc) mc.content = t.bg;
  _lastPickerColor = t.bg;
}

// ── Web Audio SFX ────────────────────────────────────────────
let _ac = null;
const getAC = () => {
  if (!_ac) { try { _ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} }
  if (_ac?.state === 'suspended') _ac.resume();
  return _ac;
};
const tone = (freq, dur, type = 'sine', vol = .24, t0 = 0) => {
  const ac = getAC(); if (!ac) return;
  const osc = ac.createOscillator(), g = ac.createGain();
  osc.connect(g); g.connect(ac.destination);
  osc.type = type;
  const st = ac.currentTime + t0;
  osc.frequency.setValueAtTime(freq, st);
  g.gain.setValueAtTime(0, st);
  g.gain.linearRampToValueAtTime(vol, st + .012);
  g.gain.exponentialRampToValueAtTime(.0001, st + dur);
  osc.start(st); osc.stop(st + dur + .02);
};
const sfx = {
  click:   () => tone(880, .06, 'sine', .14),
  correct: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, .28, 'sine', .22, i * .11));
    setTimeout(() => tone(1568, .32, 'sine', .15), 420);
  },
  wrong:   () => { tone(340, .12, 'sawtooth', .2); tone(230, .2, 'sawtooth', .14, .14); },
  streak:  () => {
    [[523,.08],[659,.08],[784,.08],[1047,.2],[1175,.08],[1319,.3]]
      .reduce((t, [f, d]) => { tone(f, d, 'sine', .24, t); return t + d + .03; }, 0);
  },
  end: () => {
    [[523,.1],[659,.1],[784,.1],[1047,.14],[1047,.07],[1175,.38]]
      .reduce((t, [f, d]) => { tone(f, d, 'sine', .26, t); return t + d + .04; }, 0);
  },
};

// ── Celebrations ─────────────────────────────────────────────

// Unicode shapes (no emoji)
const BURST_SHAPES = ['★','✦','◆','●','▲','◉','✚','◈'];
const BURST_COLORS = ['#FFD93D','#FF6B8A','#4ECDC4','#A29BFE','#6BCB77','#FFB347','#FF8C42','#C0F0FF'];

function burstParticles(cx, cy) {
  const layer = document.getElementById('burst-layer');
  const count = 14;
  for (let i = 0; i < count; i++) {
    const el  = document.createElement('span');
    el.className = 'burst-p';
    const angle = (i / count) * Math.PI * 2;
    const r     = 60 + Math.random() * 65;
    const rot   = (Math.random() * 600 - 300) + 'deg';
    el.textContent = BURST_SHAPES[Math.floor(Math.random() * BURST_SHAPES.length)];
    el.style.cssText = [
      `left:${cx}px`, `top:${cy}px`,
      `color:${BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)]}`,
      `--tx:${Math.cos(angle) * r}px`,
      `--ty:${Math.sin(angle) * r}px`,
      `--rot:${rot}`,
      `animation-delay:${(Math.random() * .08).toFixed(3)}s`,
      `font-size:${13 + Math.random() * 11}px`,
    ].join(';');
    layer.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
}

function ringExpand(cx, cy, color = 'white') {
  const el = document.createElement('div');
  el.className = 'ring-expand';
  Object.assign(el.style, {
    left: cx + 'px', top: cy + 'px',
    width: '50px', height: '50px',
    background: 'transparent',
    border: `4px solid ${color}`,
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 650);
}

function flipToAnswer(answer) {
  const el = document.getElementById('ans-mark');
  el.classList.remove('pulsing', 'revealed');
  el.classList.add('flip-out');
  setTimeout(() => {
    el.classList.remove('flip-out');
    el.textContent = answer;
    el.classList.add('flip-in');
    setTimeout(() => { el.classList.remove('flip-in'); el.classList.add('revealed'); }, 200);
  }, 200);
}

function monsterReact(type) {
  const app  = document.getElementById('app');
  const char = document.getElementById('character');
  const eyes = document.getElementById('eyes');
  const antL = document.getElementById('ant-l');
  const antR = document.getElementById('ant-r');
  app.classList.remove('react-correct', 'react-wrong');
  char.classList.remove('state-correct', 'state-wrong', 'state-idle');
  eyes.classList.remove('excited', 'sad', 'happy');
  antL.classList.remove('bounce');
  antR.classList.remove('bounce');
  void app.offsetWidth;
  if (type === 'correct') {
    app.classList.add('react-correct');
    char.classList.add('state-correct');
    eyes.classList.add('excited');
    antL.classList.add('bounce'); antR.classList.add('bounce');
    setTimeout(() => {
      eyes.classList.remove('excited'); eyes.classList.add('happy');
      char.classList.remove('state-correct'); char.classList.add('state-idle');
    }, 650);
  } else if (type === 'wrong') {
    app.classList.add('react-wrong');
    char.classList.add('state-wrong');
    eyes.classList.add('sad');
    setTimeout(() => {
      eyes.classList.remove('sad'); eyes.classList.add('happy');
      char.classList.remove('state-wrong'); char.classList.add('state-idle');
    }, 850);
  } else {
    // idle: 最初に excited → happy と遷移させて生き生きとした印象に
    char.classList.add('state-idle');
    eyes.classList.add('excited');
    setTimeout(() => {
      eyes.classList.remove('excited');
      eyes.classList.add('happy');
    }, 900);
  }
}

function celebrateCorrect(btnEl) {
  const r  = btnEl.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top  + r.height / 2;
  burstParticles(cx, cy);
  ringExpand(cx, cy, 'white');
  monsterReact('correct');
  setTimeout(() => flipToAnswer(g.problem.answer), 50);
  setTimeout(() => ringExpand(cx, cy, '#1DB954'), 180);
  setTimeout(() => launchConfetti(48), 350);
}

// ── Confetti ─────────────────────────────────────────────────
const CONF = ['#FFD93D','#FF6B6B','#4ECDC4','#A29BFE','#6BCB77','#FFB347','#FF8FC1','white'];
function launchConfetti(n = 45) {
  const wrap = document.getElementById('burst-layer');
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      const el  = document.createElement('div');
      const sz  = 5 + Math.random() * 9;
      const dur = 1.2 + Math.random() * 1.6;
      Object.assign(el.style, {
        position: 'fixed', top: '-20px',
        left: Math.random() * 100 + 'vw',
        width: sz + 'px', height: sz + 'px',
        background: CONF[Math.floor(Math.random() * CONF.length)],
        borderRadius: Math.random() > .4 ? '50%' : '3px',
        pointerEvents: 'none', zIndex: '800',
        animation: `burstOut ${dur}s linear forwards`,
        '--tx': (Math.random() * 80 - 40) + 'px',
        '--ty': (80 + Math.random() * 120) + 'px',
        '--rot': (Math.random() * 720) + 'deg',
        animationDelay: (Math.random() * .4) + 's',
      });
      wrap.appendChild(el);
      setTimeout(() => el.remove(), (dur + .8) * 1000);
    }, i * 20);
  }
}

function scorePopup(pts, x, y) {
  const el = document.createElement('div');
  el.className = 'num-pop';
  Object.assign(el.style, {
    position: 'fixed', left: (x - 20) + 'px', top: (y - 10) + 'px',
    fontFamily: 'Nunito, sans-serif', fontSize: '1.5rem', fontWeight: '900',
    color: 'white', textShadow: '0 2px 6px rgba(0,0,0,.3)',
    pointerEvents: 'none', zIndex: '950',
    animation: 'burstOut 1s ease forwards',
    '--tx': '0px', '--ty': '-70px', '--rot': '0deg',
  });
  el.textContent = `+${pts}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

function showStreak(n) {
  const msgs = { 3:'3れんぞく!', 5:'5れんぞく!', 7:'7れんぞく!', 10:'パーフェクト!' };
  if (!msgs[n]) return;
  const el = Object.assign(document.createElement('div'), {
    className: 'streak-banner num-pop',
    textContent: msgs[n],
  });
  document.body.appendChild(el);
  sfx.streak();
  setTimeout(() => el.remove(), 2700);
}

// ── DigitRecognizer ───────────────────────────────────────────
const MNIST_MODEL_URL = 'https://cdn.jsdelivr.net/gh/bensonruan/Hand-Written-Digit-Recognition@master/models/model.json';

class DigitRecognizer {
  constructor() { this._model = null; this._tf = typeof tf !== 'undefined' ? tf : null; }

  async _ensureModel() {
    if (this._model) return true;
    if (!this._tf) return false;
    try { this._model = await this._tf.loadLayersModel(MNIST_MODEL_URL); return true; }
    catch (_) { return false; }
  }

  async recognize(canvas) {
    if (!(await this._ensureModel())) return null;
    if (this._isEmpty(canvas)) return null;
    try {
      const regions = this._segmentDigits(canvas);
      if (regions.length === 0) return null;
      const digits = [];
      for (const img of regions) {
        const d = await this._predictOne(img);
        if (d === null) return null;
        digits.push(d);
      }
      const num = digits.length === 1 ? digits[0] : digits[0] * 10 + digits[1];
      if (num < 0 || num > 99) return null;
      return num;
    } catch (_) { return null; }
  }

  _isEmpty(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const px  = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let ink = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] > 12 && px[i] < 210) ink++;
    }
    return ink < 70;  // 薄い線も検出して認識率向上
  }

  _segmentDigits(canvas) {
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const px  = ctx.getImageData(0, 0, W, H).data;

    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (px[i + 3] > 10 && px[i] < 230) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x0 >= x1 || y0 >= y1) return [];

    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    const ratio = bw / bh;

    if (ratio < 0.8) return [this._cropAndNorm(canvas, x0, y0, x1, y1)];

    const raw = new Array(bw).fill(0);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        const i = (y * W + x) * 4;
        if (px[i + 3] > 10 && px[i] < 230) raw[x - x0]++;
      }

    const smooth = raw.map((_, i) => {
      let s = 0, n = 0;
      for (let j = Math.max(0, i - 2); j <= Math.min(bw - 1, i + 2); j++) { s += raw[j]; n++; }
      return s / n;
    });

    const lo = Math.floor(bw * 0.2), hi = Math.floor(bw * 0.8);
    let minVal = Infinity, minIdx = -1;
    for (let i = lo; i <= hi; i++) {
      if (smooth[i] < minVal) { minVal = smooth[i]; minIdx = i; }
    }

    const inked = smooth.filter(v => v > 1);
    const avg   = inked.length > 0 ? inked.reduce((a, b) => a + b, 0) / inked.length : 1;

    const shouldSplit = minIdx >= 0 && (
      minVal < avg * 0.25 ||
      (ratio > 1.1 && minVal < avg * 0.4) ||
      (ratio > 1.5 && minVal < avg * 0.55) ||
      (ratio > 2.0 && minVal < avg * 0.7)
    );

    if (shouldSplit) {
      const sx = x0 + minIdx;
      const left  = this._cropAndNorm(canvas, x0, y0, sx, y1);
      const right = this._cropAndNorm(canvas, sx + 1, y0, x1, y1);
      if (left && right) return [left, right];
    }
    return [this._cropAndNorm(canvas, x0, y0, x1, y1)];
  }

  _cropAndNorm(canvas, x0, y0, x1, y1) {
    const pad = 24;  // 答えエリア余白を十分に確保（認識精度120%）
    const minSide = 28;
    const bw  = Math.max(x1 - x0 + pad * 2, minSide);
    const bh  = Math.max(y1 - y0 + pad * 2, minSide);
    const fitSize = 24;  // MNIST 28x28 に大きくフィット
    const scale = Math.min(fitSize / bw, fitSize / bh);
    const dw = bw * scale, dh = bh * scale;
    const dx = (28 - dw) / 2, dy = (28 - dh) / 2;

    const tmp = Object.assign(document.createElement('canvas'), { width: 28, height: 28 });
    const tc  = tmp.getContext('2d', { willReadFrequently: true });
    tc.imageSmoothingEnabled = true;
    tc.imageSmoothingQuality = 'high';
    tc.fillStyle = '#000';
    tc.fillRect(0, 0, 28, 28);
    tc.save(); tc.filter = 'invert(1)';
    tc.drawImage(canvas, x0 - pad, y0 - pad, bw, bh, dx, dy, dw, dh);
    tc.restore();

    const id  = tc.getImageData(0, 0, 28, 28);
    const raw = new Float32Array(28 * 28);
    for (let i = 0; i < 28 * 28; i++) {
      const v = (id.data[i * 4] + id.data[i * 4 + 1] + id.data[i * 4 + 2]) / 3;
      raw[i] = v / 255;
    }
    this._dilate(raw, 28, 28);
    for (let i = 0; i < raw.length; i++)
      raw[i] = raw[i] > 0.10 ? Math.min(raw[i] * 1.6, 1.0) : 0;  // 薄い線も拾いコントラスト強化
    return raw;
  }

  _dilate(arr, w, h) {
    const out = new Float32Array(arr);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let m = arr[i];
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) m = Math.max(m, arr[ny * w + nx]);
          }
        out[i] = m;
      }
    for (let i = 0; i < arr.length; i++) arr[i] = out[i];
  }

  async _predictOne(arr) {
    const tensor = this._tf.tensor2d(arr, [1, 784]).reshape([1, 28, 28, 1]);
    const pred   = this._model.predict(tensor);
    const probs  = await pred.data();
    tensor.dispose(); pred.dispose();
    let best = 0, bestVal = probs[0];
    for (let i = 1; i < 10; i++) {
      if (probs[i] > bestVal) { bestVal = probs[i]; best = i; }
    }
    return bestVal > 0.025 ? best : null;  // 信頼度閾値緩和（認識精度120%）
  }
}

// ── DrawingCanvas ─────────────────────────────────────────────
class DrawingCanvas {
  constructor(el, { lineWidth=10, color='#1C1B3A', onStrokeEnd=null } = {}) {
    this.el = el; this.ctx = el.getContext('2d', { willReadFrequently: true });
    this.isDrawing = false; this.strokes = []; this._cur = [];
    this.lineWidth = lineWidth; this.color = color; this.onStrokeEnd = onStrokeEnd;
    this._init(); this._bind();
  }
  _init() {
    const ctx = this.ctx;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = this.lineWidth; ctx.strokeStyle = this.color; ctx.fillStyle = this.color;
    this._bg();
  }
  _bg() {
    const { ctx, el } = this;
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.save();
    ctx.fillStyle = '#FAFAFA'; ctx.fillRect(0, 0, el.width, el.height);
    ctx.strokeStyle = 'rgba(0,0,0,.06)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 11]);
    ctx.beginPath(); ctx.moveTo(0, el.height / 2); ctx.lineTo(el.width, el.height / 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = this.color; ctx.lineWidth = this.lineWidth;
    ctx.restore();
  }
  _pos(e) {
    const r = this.el.getBoundingClientRect();
    const sx = this.el.width / r.width, sy = this.el.height / r.height;
    const s = e.touches ? e.touches[0] : e;
    return { x: (s.clientX - r.left) * sx, y: (s.clientY - r.top) * sy };
  }
  _bind() {
    const el = this.el;
    const s  = e => { e.preventDefault(); this._start(this._pos(e)); };
    const m  = e => { e.preventDefault(); if (this.isDrawing) this._move(this._pos(e)); };
    const nd = e => { e.preventDefault(); this._end(); };
    el.addEventListener('touchstart',  s,  { passive: false });
    el.addEventListener('touchmove',   m,  { passive: false });
    el.addEventListener('touchend',    nd, { passive: false });
    el.addEventListener('touchcancel', nd, { passive: false });
    el.addEventListener('mousedown',  s);
    el.addEventListener('mousemove',  m);
    el.addEventListener('mouseup',    nd);
    el.addEventListener('mouseleave', nd);
  }
  _start(p) {
    this.isDrawing = true; this._cur = [p];
    const ctx = this.ctx;
    ctx.strokeStyle = this.color; ctx.lineWidth = this.lineWidth;
    ctx.beginPath();
    ctx.arc(p.x, p.y, this.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = this.color; ctx.fill();
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
  }
  _move(p) {
    if (!this.isDrawing) return;
    this._cur.push(p);
    const pts = this._cur, len = pts.length, ctx = this.ctx;
    ctx.strokeStyle = this.color; ctx.lineWidth = this.lineWidth;
    ctx.beginPath();
    if (len >= 3) {
      const b = pts[len - 2], c = p;
      const mx0 = (pts[len - 3].x + b.x) / 2, my0 = (pts[len - 3].y + b.y) / 2;
      const mx1 = (b.x + c.x) / 2,             my1 = (b.y + c.y) / 2;
      ctx.moveTo(mx0, my0); ctx.quadraticCurveTo(b.x, b.y, mx1, my1);
    } else { ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(p.x, p.y); }
    ctx.stroke();
  }
  _end() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    if (this._cur.length) this.strokes.push([...this._cur]);
    this._cur = []; this.ctx.beginPath();
    if (this.onStrokeEnd) this.onStrokeEnd(this);
  }
  clear()   { this.strokes = []; this._cur = []; this._bg(); }
  isEmpty() { return !this.strokes.length && !this._cur.length; }
}

// ── Problem generation ────────────────────────────────────────
const _r = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const PTYPES = [
  { key:'addition',       gen() { let a,b; do { const at=_r(1,7),ao=_r(0,8),bt=_r(1,9-at),bo=_r(0,9-ao); a=at*10+ao; b=bt*10+bo; } while(b<10); return{a,op:'+',b,answer:a+b}; } },
  { key:'subtraction',    gen() { let a,b; do { const at=_r(3,9),ao=_r(0,9),bt=_r(1,at-1),bo=_r(0,ao); a=at*10+ao; b=bt*10+bo; } while(a-b<10); return{a,op:'−',b,answer:a-b}; } },
  { key:'multiplication', gen() { const a=_r(1,9),b=_r(1,9); return{a,op:'×',b,answer:a*b}; } },
  { key:'division',       gen() { const b=_r(2,9),ans=_r(1,9); return{a:b*ans,op:'÷',b,answer:ans}; } },
];

const CONFIG = { difficulty: 'easy' };
let loadedProblems = null;

async function initProblems() {
  try {
    const res = await fetch('problems.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    loadedProblems = {};
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v)) {
        const opMap = { '-':'−', '*':'×', 'x':'×', '/':'÷' };
        loadedProblems[k] = v.map(p => ({ ...p, op: opMap[p.op] || p.op }));
      }
    }
  } catch(e) {
    console.warn('[MathMon] problems.json 失敗 → ランダム生成:', e.message);
    loadedProblems = null;
  }
}

function pickProblem() {
  if (loadedProblems) {
    const pool = loadedProblems[CONFIG.difficulty];
    if (pool?.length) return pool[_r(0, pool.length - 1)];
  }
  const diff = CONFIG.difficulty;
  if (diff.startsWith('mult')) return PTYPES.find(p => p.key === 'multiplication').gen();
  if (diff.startsWith('div'))  return PTYPES.find(p => p.key === 'division').gen();
  const addSub = PTYPES.filter(p => p.key === 'addition' || p.key === 'subtraction');
  return addSub[_r(0, addSub.length - 1)].gen();
}

function setDifficulty(key) {
  CONFIG.difficulty = key;
  document.querySelectorAll('.diff-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.diff === key);
  });
  const label = el.diffToggleLabel;
  if (label) label.textContent = DIFF_LABELS[key] ?? key;
  if (g.lockedTheme === null) applyTheme(DIFF_COLORS[key] ?? 0);
}

// ── Game state ────────────────────────────────────────────────
const TOTAL = 10, MAX_LIVES = 3;
const g = {
  problem: null, answered: false,
  score: 0, streak: 0, lives: MAX_LIVES, qNum: 0,
  lastRecognized: null, lockedTheme: null,
};

// ── DOM refs ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const el = {
  qVal:     $('q-val'),
  scoreVal: $('score-val'),
  prog:     $('prog-bar'),
  eyes:     $('eyes'),
  pCard:    $('problem-card'),
  pLabel:   $('prob-label'), numA: $('num-a'), opSym: $('op-sym'), numB: $('num-b'), ansMark: $('ans-mark'),
  canvas:   $('draw-canvas'), clearBtn: $('canvas-clear-btn'),
  recognizedDisplay: $('recognized-display'),
  doneBtn:       $('done-btn'),
  inputActions:  $('input-actions'),
  numpadToggle:  $('numpad-toggle'),
  numpad:        $('numpad'),
  numpadDisplay: $('numpad-display'),
  feedback: $('feedback'),
  nextBtn:  $('next-btn'),
  modal:    $('modal'),
  mIcon:    $('modal-icon'), mTitle: $('modal-title'), mSub: $('modal-sub'), mBtn: $('modal-btn'),
  diffToggle:   $('diff-toggle'),
  diffToggleLabel: $('diff-toggle-label'),
  diffDrawer:   $('diff-drawer'),
};

const DIFF_LABELS = { easy:'1ねんせい①', medium:'1ねんせい②', normal:'2ねんせい①', hard:'2ねんせい②', mult1:'かけざん①', mult2:'かけざん②', div1:'わりざん①', div2:'わりざん②' };

// ── Feedback helper ───────────────────────────────────────────
let _feedbackTimer = null;
function showFeedback(text, autoFade = false) {
  if (_feedbackTimer) { clearTimeout(_feedbackTimer); _feedbackTimer = null; }
  el.feedback.style.opacity = '1';
  el.feedback.textContent = text;
  if (autoFade && text) {
    _feedbackTimer = setTimeout(() => {
      el.feedback.style.opacity = '0';
      setTimeout(() => {
        if (el.feedback.textContent === text) el.feedback.textContent = '';
        el.feedback.style.opacity = '1';
      }, 350);
      _feedbackTimer = null;
    }, 1400);
  }
}

function shakeCanvas() {
  const wrap = el.canvas.parentElement;
  wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake');
  setTimeout(() => wrap.classList.remove('shake'), 500);
}

// ── Stats ─────────────────────────────────────────────────────
function renderStats() {
  el.qVal.textContent     = `${g.qNum}/${TOTAL}`;
  el.scoreVal.textContent = g.score;
  el.prog.style.width     = (g.qNum / TOTAL * 100) + '%';
}

// ── Load problem ──────────────────────────────────────────────
function loadProblem() {
  g.qNum++; g.answered = false; g.lives = MAX_LIVES; g.drawn = '';

  if (g.lockedTheme === null) applyTheme(themeIdx + 1);

  g.problem = pickProblem();
  el.pCard.style.animation = 'none'; void el.pCard.offsetWidth; el.pCard.style.animation = '';

  const opLabel = { '+':'たしざん', '−':'ひきざん', '×':'かけざん', '÷':'わりざん' };
  el.pLabel.textContent  = opLabel[g.problem.op] ?? '';
  el.numA.textContent    = g.problem.a;
  el.opSym.textContent   = g.problem.op;
  el.numB.textContent    = g.problem.b;
  el.ansMark.className   = 'num-pop pulsing';
  el.ansMark.textContent = '?';
  el.ansMark.style.color = '';

  showFeedback('');
  el.nextBtn.classList.add('hidden');
  el.nextBtn.classList.remove('disabled');
  if (_nextBtnTimer) { clearTimeout(_nextBtnTimer); _nextBtnTimer = null; }

  el.doneBtn.classList.remove('hidden');
  el.inputActions.classList.remove('hidden');
  hideNumpad();

  g.lastRecognized = null;
  el.recognizedDisplay.classList.add('hidden');
  el.recognizedDisplay.textContent = '';
  drawingCanvas.clear();

  renderStats();
  monsterReact('idle');
}

// ── こたえるボタン ────────────────────────────────────────────
el.doneBtn.addEventListener('click', async () => {
  if (g.answered) return;
  sfx.click();

  if (drawingCanvas.isEmpty()) {
    showFeedback('もういちど かいてみよう', true);
    shakeCanvas(); return;
  }

  let recognized = g.lastRecognized;
  if (recognized === null) {
    el.doneBtn.disabled = true;
    showFeedback('ちょっとまってね…');
    recognized = await recognizer.recognize(el.canvas);
    el.doneBtn.disabled = false;
    showFeedback('');
  }

  if (recognized === null) {
    showFeedback('もういちど かいてみよう', true);
    shakeCanvas(); return;
  }

  g.lastRecognized = recognized;
  el.recognizedDisplay.textContent = recognized;
  el.recognizedDisplay.classList.remove('hidden');
  handleAnswer(recognized);
});

// ── Answer handler ────────────────────────────────────────────
function handleAnswer(recognized) {
  if (g.answered) return;
  const ok = recognized === g.problem.answer;

  if (ok) {
    g.answered = true;
    g.streak++;
    const pts = 10 + Math.max(0, (g.streak - 1) * 5);
    g.score += pts;

    const r = el.doneBtn.getBoundingClientRect();
    scorePopup(pts, r.left + r.width / 2, r.top);

    celebrateCorrect(el.doneBtn);
    sfx.correct();
    showStreak(g.streak);
    renderStats();

    el.doneBtn.classList.add('hidden');
    el.inputActions.classList.add('hidden');
    hideNumpad();
    showNextBtnSafe();
  } else {
    g.streak = 0;
    g.lives  = Math.max(0, g.lives - 1);

    showFeedback('もういちど かいてみよう', true);
    shakeCanvas();
    drawingCanvas.clear();
    g.lastRecognized = null;
    el.recognizedDisplay.classList.add('hidden');
    el.recognizedDisplay.textContent = '';

    monsterReact('wrong'); sfx.wrong(); renderStats();
    setTimeout(() => monsterReact('idle'), 800);

    if (g.lives <= 0) {
      g.answered = true;
      flipToAnswer(g.problem.answer);
      showFeedback('ざんねん… つぎのもんだいへ！');
      el.doneBtn.classList.add('hidden');
      el.inputActions.classList.add('hidden');
      hideNumpad();
      showNextBtnSafe();
    } else {
      el.doneBtn.classList.remove('hidden');
    }
  }
}

// ── Next (遅延+誤タップ防止) ─────────────────────────────────
let _nextBtnTimer = null;
function showNextBtnSafe() {
  el.nextBtn.classList.remove('hidden');
  el.nextBtn.classList.add('disabled');
  if (_nextBtnTimer) clearTimeout(_nextBtnTimer);
  _nextBtnTimer = setTimeout(() => {
    el.nextBtn.classList.remove('disabled');
    _nextBtnTimer = null;
  }, 800);
}
el.nextBtn.addEventListener('click', () => {
  if (el.nextBtn.classList.contains('disabled')) return;
  sfx.click();
  if (g.qNum >= TOTAL) showModal();
  else loadProblem();
});

// ── Game over modal ───────────────────────────────────────────
function showModal() {
  const tbl = [['★★★','かんぺき！', TOTAL*10+20],['★★','すごい！', TOTAL*9],['★','よくできた！', TOTAL*6]];
  const row  = tbl.find(([,,t]) => g.score >= t) ?? ['','がんばった！', 0];
  el.mIcon.textContent  = row[0];
  el.mTitle.textContent = row[1];
  el.mSub.textContent   = `${TOTAL}もん　${g.score}てん`;
  el.modal.classList.remove('hidden');
  sfx.end(); launchConfetti(80);
}
el.mBtn.addEventListener('click', () => {
  sfx.click();
  el.modal.classList.add('hidden');
  Object.assign(g, { score:0, streak:0, lives:MAX_LIVES, qNum:0 });
  loadProblem();
});

// ── Canvas clear ──────────────────────────────────────────────
el.clearBtn.addEventListener('click', () => {
  sfx.click();
  if (_recognizeDebounce) { clearTimeout(_recognizeDebounce); _recognizeDebounce = null; }
  g.lastRecognized = null;
  el.recognizedDisplay.classList.add('hidden');
  el.recognizedDisplay.textContent = '';
  drawingCanvas.clear();
});

// ── Numpad ────────────────────────────────────────────────────
let _numpadVal = '';
function showNumpad() {
  _numpadVal = ''; el.numpadDisplay.textContent = '';
  el.numpad.classList.remove('hidden');
  el.numpadToggle.classList.add('active');
}
function hideNumpad() {
  el.numpad.classList.add('hidden');
  el.numpadToggle.classList.remove('active');
  _numpadVal = ''; el.numpadDisplay.textContent = '';
}
el.numpadToggle.addEventListener('click', () => {
  sfx.click();
  if (el.numpad.classList.contains('hidden')) showNumpad(); else hideNumpad();
});
el.numpad.addEventListener('click', e => {
  const btn = e.target.closest('.nk');
  if (!btn || g.answered) return;
  sfx.click();
  const val = btn.dataset.val;
  if (val === 'del') {
    _numpadVal = _numpadVal.slice(0, -1);
  } else if (val === 'go') {
    if (!_numpadVal) return;
    const num = parseInt(_numpadVal, 10);
    g.lastRecognized = num;
    el.recognizedDisplay.textContent = num;
    el.recognizedDisplay.classList.remove('hidden');
    handleAnswer(num);
    return;
  } else {
    if (_numpadVal.length < 2) _numpadVal += val;
  }
  el.numpadDisplay.textContent = _numpadVal;
});

// ── Recognizer + canvas ───────────────────────────────────────
const recognizer = new DigitRecognizer();
let _recognizeDebounce = null;

async function runRecognitionAndUpdate() {
  if (drawingCanvas.isEmpty()) return;
  const recognized = await recognizer.recognize(el.canvas);
  if (recognized !== null) {
    g.lastRecognized = recognized;
    el.recognizedDisplay.textContent = recognized;
    el.recognizedDisplay.classList.remove('hidden');
  } else {
    g.lastRecognized = null;
    el.recognizedDisplay.classList.add('hidden');
    el.recognizedDisplay.textContent = '';
  }
}

function scheduleRecognition() {
  if (_recognizeDebounce) clearTimeout(_recognizeDebounce);
  _recognizeDebounce = setTimeout(() => { _recognizeDebounce = null; runRecognitionAndUpdate(); }, 500);
}

const drawingCanvas = new DrawingCanvas(el.canvas, {
  lineWidth: 10, color: '#1C1B3A', onStrokeEnd: scheduleRecognition,
});

// ── Difficulty bar ────────────────────────────────────────────
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sfx.click();
    setDifficulty(btn.dataset.diff);
    if (el.diffDrawer) el.diffDrawer.classList.add('hidden');
    if (el.diffToggle) el.diffToggle.setAttribute('aria-expanded', 'false');
    Object.assign(g, { score:0, streak:0, lives:MAX_LIVES, qNum:0 });
    loadProblem();
  });
});
if (el.diffToggle) el.diffToggle.addEventListener('click', () => {
  sfx.click();
  const open = el.diffDrawer.classList.contains('hidden');
  el.diffDrawer.classList.toggle('hidden', !open);
  el.diffToggle.setAttribute('aria-expanded', open);
});

// ── Eye tracking ──────────────────────────────────────────────
(function initEyeTracking() {
  const pupilL = document.getElementById('pup-l');
  const pupilR = document.getElementById('pup-r');
  if (!pupilL || !pupilR) return;
  [pupilL, pupilR].forEach(p => {
    p.style.transition = 'transform .07s ease-out, width .25s, height .25s';
  });
  function movePupils(clientX, clientY) {
    [{ pupil: pupilL, eye: document.getElementById('eye-l') },
     { pupil: pupilR, eye: document.getElementById('eye-r') }].forEach(({ pupil, eye }) => {
      if (!eye) return;
      const r  = eye.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = clientX - cx, dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      const maxR = r.width * 0.27;
      const k = dist > 0 ? Math.min(maxR / dist, 1) : 0;
      pupil.style.transform = `translate(calc(-50% + ${(dx*k).toFixed(2)}px), calc(-50% + ${(dy*k).toFixed(2)}px))`;
    });
  }
  document.addEventListener('mousemove', e => movePupils(e.clientX, e.clientY));
  document.addEventListener('touchmove',  e => { if (e.touches[0]) movePupils(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  document.addEventListener('touchstart', e => { if (e.touches[0]) movePupils(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
})();

// ── Boot ──────────────────────────────────────────────────────
initColorBalls();
applyTheme(DIFF_COLORS['easy']);
initProblems().then(() => loadProblem());
recognizer._ensureModel().then(ok => { if (ok) console.log('[MathMon] MNIST ready'); });
