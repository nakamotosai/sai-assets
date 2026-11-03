// scroll-morph.js — 滚动组字:粒子在「散开」与「字形」两端来回 morph,带坠落/爆破/呼吸/环境漂移。
// 来源:本机 demo 存档 demos/particle-scroll-morph(源件是 2D 近似;生产 three 版在源项目里)。
// 与源件的差别:①导出 mount()/update()/destroy(),不再自己 fetch params 与挂板;
//                 ②字标默认中性;③prefers-reduced-motion 时只渲染一帧静止字形。
import { reducedMotion } from "../util.js";

function hash(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function ease(u) {
  return u * u * (3 - 2 * u);
}

/**
 * @param {HTMLElement} stage 容器(内部自建 canvas)
 * @param {object} params 见 effects/scroll-morph/params.json
 * @returns {{update: (p: object) => void, destroy: () => void}}
 */
export function mount(stage, params = {}) {
  const canvas = document.createElement("canvas");
  stage.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let W = 0;
  let H = 0;
  let dpr = 1;
  let pts = [];
  let scrollP = 0;
  let t0 = performance.now();
  let raf = 0;
  let alive = true;
  let P = { ...params };

  const EMBED =
    (() => {
      try {
        if (new URLSearchParams(location.search).has("embed")) return true;
      } catch (_) {}
      try {
        if (window.self !== window.top) return true;
      } catch (_) {
        return true;
      }
      return (window.innerWidth || 0) < 520 || (window.innerHeight || 0) < 420;
    })();

  const reduced = reducedMotion();

  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    const r = stage.getBoundingClientRect();
    W = Math.max(160, r.width || window.innerWidth || 320);
    H = Math.max(140, r.height || window.innerHeight || 280);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuild();
  }

  function sampleGlyph(text, n) {
    const cv = document.createElement("canvas");
    const c = cv.getContext("2d", { willReadFrequently: true });
    const scale = P.textScale || 2.2;
    // embed:相对字号放大,小画幅里也能采到字
    const fs = Math.floor(Math.min(W, H) * (EMBED ? 0.14 : 0.08) * scale);
    cv.width = Math.max(64, Math.ceil(W));
    cv.height = Math.max(48, Math.ceil(H * 0.65));
    c.fillStyle = "#000";
    c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = "#fff";
    c.font = `700 ${Math.max(18, fs)}px "JetBrains Mono", ui-monospace, monospace`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, cv.width / 2, cv.height / 2);
    const img = c.getImageData(0, 0, cv.width, cv.height).data;
    const raw = [];
    const step = Math.max(2, Math.floor(Math.max(18, fs) / (EMBED ? 10 : 18)));
    for (let y = 0; y < cv.height; y += step) {
      for (let x = 0; x < cv.width; x += step) {
        if (img[(y * cv.width + x) * 4 + 3] > 120) {
          raw.push({ ox: (x / cv.width - 0.5) * 2, oy: (y / cv.height - 0.5) * 1.25 });
        }
      }
    }
    if (!raw.length) {
      for (let i = 0; i < n; i++) raw.push({ ox: (i / n - 0.5) * 1.6, oy: (hash(i) - 0.5) * 0.45 });
    }
    const out = [];
    const target = Math.min(n, Math.max(EMBED ? 350 : 400, Math.floor(n)));
    for (let i = 0; i < target; i++) {
      const s = raw[Math.floor((i / target) * raw.length) % raw.length];
      const ang = hash(i + 3) * Math.PI * 2;
      const rad = 0.25 + hash(i + 7) * 1.35;
      out.push({
        ox: s.ox,
        oy: s.oy,
        sx: Math.cos(ang) * rad,
        sy: Math.sin(ang) * rad * 0.72,
        seed: hash(i + 11),
        phase: hash(i + 19) * Math.PI * 2,
      });
    }
    return out;
  }

  function rebuild() {
    const base = P.count || 13000;
    // embed:点少一点、画得快,但看着仍然密
    const n = EMBED
      ? Math.min(1200, Math.max(400, Math.floor(base * 0.08)))
      : Math.min(8000, Math.max(800, Math.floor(base * 0.35)));
    pts = sampleGlyph(P.text || "ASSETS", n);
  }

  function paint(t) {
    const cycle = EMBED ? 4.0 : 6.5;
    const raw = (t % cycle) / cycle;
    const target = raw < 0.5 ? raw * 2 : 2 - raw * 2;
    const smooth = 1 / Math.max(2, EMBED ? 8 : P.scrollSmooth || 15.5);
    scrollP += (target - scrollP) * smooth;

    ctx.fillStyle = "#050508";
    ctx.fillRect(0, 0, W, H);

    const cx = W * 0.5;
    const cy = H * 0.48;
    const scale =
      Math.min(W, H) * (EMBED ? 0.42 : 0.28) * (P.textScale || 2.2) * (EMBED ? 0.72 : 0.55);
    // 关键:小画幅里点必须够大才看得见(旧版墙内 iframe 只有 ~1.5px)
    const size = Math.max(EMBED ? 1.8 : 1.1, (P.size || 0.055) * (EMBED ? 42 : 28));
    const glow = (P.glow || 1.75) * size;
    const op = P.opacity ?? 0.75;
    const gop = P.glowOpacity ?? 0.22;
    const fall = (P.fall || 8.9) * 0.04;
    const burst = (P.burst || 7.7) * 0.05;
    const stagger = P.stagger ?? 0.5;
    const breathe = P.breathe ?? 0.06;
    const ambient = P.ambient ?? 0.35;
    const ambientSpeed = P.ambientSpeed ?? 0.9;
    const turb = P.turbulence ?? 0.45;
    const gold = "232,197,120";
    const u = ease(scrollP);

    for (const p of pts) {
      const st = Math.min(1, Math.max(0, u * (1 + stagger) - p.seed * stagger));
      const ee = ease(st);
      let x = p.sx * (1 - ee) + p.ox * ee;
      let y = p.sy * (1 - ee) + p.oy * ee;
      const mid = Math.sin(ee * Math.PI);
      x += (p.seed - 0.5) * burst * mid;
      y += fall * mid * (0.3 + p.seed);
      const amb = ambient * (0.35 + 0.65 * ee);
      x += Math.cos(t * ambientSpeed + p.phase) * amb * 0.04;
      y += Math.sin(t * ambientSpeed * 0.85 + p.phase) * amb * 0.03;
      x += Math.sin(t * 1.7 + p.phase) * breathe * 0.03;
      y += Math.cos(t * 1.3 + p.phase * 1.1) * breathe * 0.03;
      x += Math.sin(p.ox * 8 + t * 0.6) * turb * 0.012;
      y += Math.cos(p.oy * 8 - t * 0.5) * turb * 0.012;

      const px = cx + x * scale;
      const py = cy + y * scale;

      if (gop > 0.01) {
        ctx.beginPath();
        ctx.arc(px, py, glow, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${gold},${gop * 0.4})`;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${gold},${op})`;
      ctx.fill();
    }
  }

  function frame(now) {
    if (!alive) return;
    const t = (now - t0) / 1000;
    paint(t);
    if (!reduced) raf = requestAnimationFrame(frame);
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(stage);
  resize();
  if (reduced) {
    // 静止一帧:直接把 morph 停在字形端
    scrollP = 1;
    paint(0);
  } else {
    raf = requestAnimationFrame(frame);
  }

  return {
    update(next) {
      const prev = P;
      P = { ...P, ...next };
      const needRebuild = P.count !== prev.count || P.text !== prev.text || P.textScale !== prev.textScale;
      if (needRebuild) rebuild();
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.remove();
    },
  };
}
