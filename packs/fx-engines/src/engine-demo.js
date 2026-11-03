// engine-demo.js — fx-engines 的**参考消费者**:把 src/fx.js 的 6 个 fx 画进 2D canvas。
//
// 生产接线是 three.js Points(见 docs/usage.md「生产接线」);这里零依赖,
// 只用来验证引擎本身:makeFx(id, n, label, params) → 每帧 pack.tick(t, dt)
// 把「位置」写进 Float32Array(x/y/z 世界单位,银河盘半径 galRadius≈36),
// 本文件把它正交投影成点 —— 换 fx 不用改任何常量(rms 自动取景)。
//
// 材质/后处理(bloom、色差、颗粒、ACES)不在引擎里,也不在这里:本包只负责「动」。

import { FX_META, makeFx, pickFxParams } from './fx.js';

const GOLD = [232, 197, 120];
const WHITE = [240, 242, 248];

function rms(buf, count) {
  let sx = 0;
  let sy = 0;
  let sq = 0;
  for (let i = 0; i < count; i++) {
    const x = buf[i * 3];
    const y = buf[i * 3 + 1];
    sx += x;
    sy += y;
    sq += x * x + y * y;
  }
  const cx = sx / count;
  const cy = sy / count;
  return { cx, cy, r: Math.sqrt(Math.max(1e-6, sq / count - (cx * cx + cy * cy))) };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{fx?: number, n?: number, params?: object, label?: string}} opts
 */
export function mountEngineDemo(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const label = opts.label || 'ASSETS';

  let id = Number.isFinite(opts.fx) ? opts.fx : 4;
  let count = Math.max(200, Math.min(20000, Math.round(opts.n || 6000)));
  let params = pickFxParams(opts.params || {});

  let pack = null;
  let fit = 40;
  let offX = 0;
  let offY = 0;
  let W = 0;
  let H = 0;
  let raf = 0;
  let last = 0;
  let t = 0;
  let alive = true;

  const color = () => (id === 3 ? WHITE : GOLD);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = Math.max(160, Math.round(rect.width || innerWidth));
    H = Math.max(120, Math.round(rect.height || innerHeight));
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (pack) frame(reduced ? 0 : last, true);
  }

  function autofit() {
    const m = rms(pack.buf, count);
    offX = m.cx;
    offY = m.cy;
    fit = Math.max(2, m.r * 2.35);
  }

  function build() {
    pack = makeFx(id, count, label, params);
    pack.tick(0, 1 / 60);
    autofit();
  }

  function paint() {
    const scale = (Math.min(W, H) * 0.46) / fit;
    const cx = W * 0.5;
    const cy = H * 0.52;
    const glow = typeof pack.getGlow === 'function' ? pack.getGlow() : null;
    const rgb = color();
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < count; i++) {
      const g = glow ? Math.max(0, Math.min(2, glow[i] || 0)) : 1;
      const x = cx + (pack.buf[i * 3] - offX) * scale;
      const y = cy - (pack.buf[i * 3 + 1] - offY) * scale;
      const r = 0.75 + g * 0.75;
      ctx.globalAlpha = Math.min(1, 0.22 + g * 0.6);
      ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function frame(now, single) {
    if (!alive || !pack) return;
    const dt = last ? Math.min(0.033, (now - last) / 1000) : 1 / 60;
    last = now;
    t += dt;
    pack.tick(t, dt);
    paint();
    if (!single && !reduced) raf = requestAnimationFrame(frame);
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  build();
  resize();
  if (reduced) frame(0, true);
  else raf = requestAnimationFrame(frame);

  return {
    meta: FX_META,
    setFx(next) {
      id = ((next % FX_META.length) + FX_META.length) % FX_META.length;
      build();
      resize();
      return FX_META[id];
    },
    setCount(next) {
      count = Math.max(200, Math.min(20000, Math.round(next)));
      build();
      resize();
    },
    setParams(next) {
      params = pickFxParams({ ...params, ...next });
      pack.setParams(params);
    },
    getParams: () => ({ ...params }),
    rebuild() {
      build();
      resize();
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    },
  };
}
