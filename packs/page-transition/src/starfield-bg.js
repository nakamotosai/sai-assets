/* bg.js — 零依赖星空背景（canvas 2D，演示用）
 * 两个关键点，抄的时候别丢：
 *  ① 定种（mulberry32）—— 每页星星"家"必须完全一样，否则翻页像换了片星空。
 *     验收要抠出 makeHomes 单独 eval 两次比对，maxd === 0 才算过。
 *  ② 墙上时钟相位 —— 用 performance.now() 每页从 0 起算、每页重演；
 *     换成 Date.now()%3600000/1000，任何页面同一时刻都是同一相位，翻页"接着动"。
 * 跨页不空窗另有两招（见 README）：旧快照保持可见 + 本脚本尽早挂载。
 */
var N = 420, W = 0, H = 0, DPR = 1, pts = null, ctx = null, raf = 0, faded = false;
var WALL_SPAN = 3600000;

function wallT() { return (Date.now() % WALL_SPAN) / 1000; }

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeHomes(n) {
  var rnd = mulberry32(0x51F7A1), out = new Float32Array(n * 3);
  for (var i = 0; i < n; i++) {
    out[i * 3] = rnd();                 // 归一化 x
    out[i * 3 + 1] = rnd();             // 归一化 y
    out[i * 3 + 2] = 0.35 + rnd() * 1.5; // 半径/亮度
  }
  return out;
}

function resize() {
  var c = ctx.canvas;
  DPR = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  c.width = W * DPR; c.height = H * DPR;
  c.style.width = W + 'px'; c.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

function draw() {
  var t = wallT();
  ctx.clearRect(0, 0, W, H);
  for (var i = 0; i < N; i++) {
    // 相位：按墙上时钟缓慢漂移，同一时刻任何页面结果一致
    var ph = (t * 0.02 + pts[i * 3 + 2]) % 1;
    var x = ((pts[i * 3] + ph) % 1) * W;
    var y = pts[i * 3 + 1] * H;
    var r = pts[i * 3 + 2] * 0.9;
    ctx.globalAlpha = 0.25 + pts[i * 3 + 2] * 0.45;
    ctx.fillStyle = '#cfd8e3';
    ctx.fillRect(x, y, r, r);
  }
  ctx.globalAlpha = 1;
  window.__bgFrames = (window.__bgFrames || 0) + 1;
  raf = requestAnimationFrame(draw);
}

export function mountBg(canvas, opts) {
  opts = opts || {};
  var target = typeof opts.opacity === 'number' ? opts.opacity : 0.85;
  ctx = canvas.getContext('2d');
  pts = makeHomes(N);
  resize();
  addEventListener('resize', resize, { passive: true });

  // 跨页不重演淡入：站内翻页（同源 referrer / 本会话挂过）只做 120ms 微淡
  var skip = false;
  try { var r = document.referrer; skip = !!(r && new URL(r).origin === location.origin); } catch (e) {}
  try { if (sessionStorage.getItem('bg-mounted') === '1') skip = true; } catch (e) {}
  try { sessionStorage.setItem('bg-mounted', '1'); } catch (e) {}

  var fadeMs = skip ? 120 : 2000;
  canvas.style.transition = 'none';
  canvas.style.opacity = '0';
  void canvas.offsetWidth;                                   // 强制 reflow：让 0 的计算值落地
  canvas.style.transition = 'opacity ' + fadeMs + 'ms cubic-bezier(.22,.61,.36,1)';

  draw();
  setTimeout(function () { canvas.style.opacity = String(target); }, 50);  // 让出一次真实绘制再给目标值
}
