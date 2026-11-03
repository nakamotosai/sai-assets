/**
 * BlackHole Particles — Canvas2D remake of a classic black-hole screensaver look.
 * Mechanism (not ray-traced):
 *  - Disk: Kepler orbit Ω ∝ r^{-1.5}, slow radial decay, wind noise
 *  - Stars: free drift + soft 1/r gravity near hole, swallow + respawn
 *  - Horizon: black disk; photon ring denser particles at ~1.5–2.2 Rh
 *  - Doppler: left/right blackbody shift from orbital velocity projection
 * Styles table = 8 presets: temperature / inclination / radii / opacity / doppler / gain / contrast / wind
 */
import { mountParamPanel } from "./param-panel.js";

const STYLE_TABLE = {
  "炼狱（烈焰）": {
    temp: 5500, incl: 1.5, roll: 0.35, inner: 1.8, outer: 8.0,
    opac: 0.9, dopp: 0.6, beam: 2.5, gain: 2.2, contr: 1.6, wind: 7, speed: 5, expo: 1.4,
  },
  "经典（侧视薄盘）": {
    temp: 4500, incl: 1.52, roll: 0.1, inner: 2.2, outer: 7.0,
    opac: 0.85, dopp: 0.35, beam: 2.0, gain: 1.4, contr: 0.5, wind: 7, speed: 5, expo: 1.2,
  },
  "M87* 甜甜圈": {
    temp: 3800, incl: 0.55, roll: -0.3, inner: 2.2, outer: 6.0,
    opac: 0.45, dopp: 0.9, beam: 3.5, gain: 1.6, contr: 0.4, wind: 3, speed: 2.5, expo: 1.1,
  },
  "正面余烬": {
    temp: 6500, incl: 0.3, roll: 0.0, inner: 3.0, outer: 10.0,
    opac: 0.5, dopp: 0.8, beam: 2.5, gain: 1.0, contr: 1.1, wind: 7, speed: 5, expo: 1.0,
  },
  "类星体": {
    temp: 15000, incl: 1.3, roll: 0.35, inner: 3.0, outer: 14.0,
    opac: 0.35, dopp: 1.0, beam: 4.0, gain: 1.2, contr: 1.3, wind: 8, speed: 5, expo: 0.8,
  },
  "耀变体": {
    temp: 18000, incl: 1.05, roll: 0.55, inner: 3.0, outer: 16.0,
    opac: 0.3, dopp: 1.0, beam: 5.0, gain: 1.0, contr: 1.5, wind: 9, speed: 6, expo: 0.75,
  },
  "纯透镜（只扭曲）": {
    temp: 5500, incl: 1.5, roll: 0.35, inner: 1.8, outer: 8.0,
    opac: 0.0, dopp: 1.0, beam: 2.5, gain: 0.0, contr: 1.6, wind: 7, speed: 5, expo: 1.0,
  },
  "禅意（柔和）": {
    temp: 4200, incl: 1.2, roll: 0.2, inner: 2.0, outer: 7.0,
    opac: 0.55, dopp: 0.4, beam: 2.0, gain: 0.9, contr: 0.8, wind: 4, speed: 2, expo: 1.0,
  },
};

const STYLE_KEYS = Object.keys(STYLE_TABLE);

const canvas = document.getElementById("stage");
const hud = document.getElementById("hud");
const ctx = canvas.getContext("2d", { alpha: false });

let W = 0;
let H = 0;
let dpr = 1;
let cx = 0;
let cy = 0;
let t0 = performance.now();
let lastT = t0;
let cycleT0 = t0;
let raf = 0;
let params = null;
let style = STYLE_TABLE["经典（侧视薄盘）"];
let styleName = "经典（侧视薄盘）";

const mouse = { x: 0.5, y: 0.5, active: false };
const target = { x: 0.5, y: 0.5 };

/** @type {Float32Array} disk: x,y,r,phi,kind,seed */
let disk = null;
let nDisk = 0;
/** @type {Float32Array} stars: x,y,z,a,vx,vy,seed */
let stars = null;
let nStars = 0;

function hash(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function blackbody(T) {
  const t = Math.min(40000, Math.max(1500, T)) / 100;
  let r, g, b;
  if (t <= 66) {
    r = 1;
    g = Math.min(1, Math.max(0, 0.3900816 * Math.log(t) - 0.6318414));
  } else {
    r = Math.min(1, Math.max(0, 1.292936 * (t - 60) ** -0.1332047));
    g = Math.min(1, Math.max(0, 1.1298909 * (t - 60) ** -0.0755148));
  }
  if (t >= 66) b = 1;
  else if (t <= 19) b = 0;
  else b = Math.min(1, Math.max(0, 0.5432068 * Math.log(t - 10) - 1.196254));
  return [r, g, b];
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(2, devicePixelRatio || 1);
  // preview panes sometimes report 0×0 until painted — fall back to viewport
  W = Math.max(320, rect.width || window.innerWidth || 960);
  H = Math.max(240, rect.height || window.innerHeight || 600);
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx = W * target.x;
  cy = H * target.y;
  rebuild();
}

function rhBase() {
  const holeSize = Number(params?.holeSize ?? 0.55);
  return Math.min(W, H) * (0.055 + 0.1 * holeSize);
}

function rebuild() {
  const dens = Math.max(0.35, Math.min(2.5, Number(params?.density ?? 1)));
  nDisk = Math.floor(2200 * dens);
  nStars = Math.floor(900 * dens);
  disk = new Float32Array(nDisk * 6);
  stars = new Float32Array(nStars * 7);

  const S = style;
  const rh = rhBase();
  const rin = rh * S.inner * 0.55;
  const rout = rh * S.outer * 0.42;

  for (let i = 0; i < nDisk; i++) {
    const o = i * 6;
    const u = hash(i + 1);
    // denser near photon ring / inner edge
    const t = Math.pow(u, 0.55);
    const r = rin + t * (rout - rin);
    const kind = u < 0.12 ? 2 : u < 0.55 ? 1 : 0; // ring / bright / haze
    const phi = hash(i + 9) * Math.PI * 2;
    disk[o] = 0;
    disk[o + 1] = 0;
    disk[o + 2] = r;
    disk[o + 3] = phi;
    disk[o + 4] = kind;
    disk[o + 5] = hash(i + 17);
  }

  for (let i = 0; i < nStars; i++) {
    const o = i * 7;
    stars[o] = hash(i) * W;
    stars[o + 1] = hash(i + 3) * H;
    stars[o + 2] = 0.25 + hash(i + 7) * 0.75;
    stars[o + 3] = 0.2 + hash(i + 11) * 0.8;
    stars[o + 4] = (hash(i + 13) - 0.5) * 0.18;
    stars[o + 5] = (hash(i + 17) - 0.5) * 0.12;
    stars[o + 6] = hash(i + 23);
  }
}

function applyStyleFromParams() {
  const name = params?.style || "经典（侧视薄盘）";
  if (STYLE_TABLE[name]) {
    styleName = name;
    style = STYLE_TABLE[name];
  }
}

function spawnStar(i) {
  const o = i * 7;
  // spawn on ring outside field so they stream in
  const ang = hash(i + performance.now() * 0.001) * Math.PI * 2;
  const R = Math.max(W, H) * (0.55 + hash(i + 41) * 0.55);
  stars[o] = cx + Math.cos(ang) * R;
  stars[o + 1] = cy + Math.sin(ang) * R * 0.85;
  stars[o + 2] = 0.3 + hash(i + 7) * 0.7;
  stars[o + 3] = 0.25 + hash(i + 11) * 0.75;
  stars[o + 4] = (hash(i + 13) - 0.5) * 0.15;
  stars[o + 5] = (hash(i + 17) - 0.5) * 0.1;
  stars[o + 6] = hash(i + 29);
}

function respawnDisk(i, rh) {
  const o = i * 6;
  const S = style;
  const rin = rh * S.inner * 0.55;
  const rout = rh * S.outer * 0.42;
  const u = hash(i + 101 + ((performance.now() * 0.01) | 0));
  disk[o + 2] = rin + Math.pow(u, 0.5) * (rout - rin);
  disk[o + 3] = hash(i + 55) * Math.PI * 2;
  disk[o + 4] = u < 0.12 ? 2 : u < 0.55 ? 1 : 0;
  disk[o + 5] = hash(i + 77);
}

function update(dt, now) {
  const S = style;
  const rh = rhBase();
  const rin = rh * S.inner * 0.55;
  const rout = rh * S.outer * 0.42;
  const spinMul = Number(params?.spin ?? 1) * (S.speed / 5);
  const grav = Number(params?.gravity ?? 1);
  const wind = S.wind;
  const incl = S.incl;
  const roll = S.roll;
  const cosI = Math.cos(incl * 0.55);
  const sinI = Math.sin(incl * 0.55);
  const cosR = Math.cos(roll);
  const sinR = Math.sin(roll);
  // pure lens (opac/gain≈0): default disk off; slider still scales a faint ghost if user wants
  const diskOn =
    S.opac > 0.01 && S.gain > 0.01
      ? Math.max(0, Math.min(1, Number(params?.diskOpacity ?? S.opac)))
      : Math.max(0, Math.min(0.35, Number(params?.diskOpacity ?? 0) * 0.2));

  // hole soft follow
  const follow = !!params?.followMouse;
  if (follow && mouse.active) {
    target.x += (mouse.x - target.x) * Math.min(1, dt * 3.5);
    target.y += (mouse.y - target.y) * Math.min(1, dt * 3.5);
  } else {
    // slow Lissajous roam
    const t = (now - t0) * 0.00035;
    target.x = 0.5 + 0.12 * Math.sin(t * 0.9) + 0.04 * Math.sin(t * 2.1);
    target.y = 0.52 + 0.08 * Math.sin(t * 1.1 + 1.2);
  }
  cx = W * target.x;
  cy = H * target.y;

  // auto cycle styles ~5s
  if (params?.autoCycle) {
    if (now - cycleT0 > 5000) {
      cycleT0 = now;
      const idx = (STYLE_KEYS.indexOf(styleName) + 1) % STYLE_KEYS.length;
      styleName = STYLE_KEYS[idx];
      style = STYLE_TABLE[styleName];
      if (params) params.style = styleName;
      // soft rebuild radii only
      for (let i = 0; i < nDisk; i++) {
        const o = i * 6;
        const u = disk[o + 5];
        disk[o + 2] = rin + Math.pow(u, 0.55) * (rout - rin);
      }
    }
  }

  // disk particles
  const baseOmega = 1.35 * spinMul;
  for (let i = 0; i < nDisk; i++) {
    const o = i * 6;
    let r = disk[o + 2];
    let phi = disk[o + 3];
    const seed = disk[o + 5];
    const kep = Math.pow(rin / Math.max(r, rin * 0.5), 1.5);
    const omega = baseOmega * kep * (0.85 + 0.3 * seed);
    phi += omega * dt;
    // wind: slight radial breathing
    const swirl = Math.sin(phi * 3 + now * 0.001 * wind * 0.15 + seed * 6.28) * 0.35;
    r += (swirl * wind * 0.08 - 2.8 * grav * (0.35 + 0.4 * seed)) * dt * (rh * 0.08);
    if (r < rh * 1.05) {
      respawnDisk(i, rh);
      continue;
    }
    if (r > rout * 1.08) r = rout * (0.92 + 0.08 * seed);

    // project with inclination + roll (disk plane -> screen)
    const x0 = Math.cos(phi) * r;
    const y0 = Math.sin(phi) * r;
    const xr = x0 * cosR - y0 * sinR;
    const yr = x0 * sinR + y0 * cosR;
    const xp = xr;
    const yp = yr * cosI; // foreshorten
    disk[o] = cx + xp;
    disk[o + 1] = cy + yp;
    disk[o + 2] = r;
    disk[o + 3] = phi;
  }

  // stars
  for (let i = 0; i < nStars; i++) {
    const o = i * 7;
    let x = stars[o];
    let y = stars[o + 1];
    let vx = stars[o + 4];
    let vy = stars[o + 5];
    const z = stars[o + 2];
    const dx = cx - x;
    const dy = cy - y;
    const dist2 = dx * dx + dy * dy + 1;
    const dist = Math.sqrt(dist2);
    // soft gravity + swirl (particle "lens" feel)
    const pull = (grav * 4200 * (0.5 + 0.5 / z)) / dist2;
    const tang = (grav * 1800) / (dist2 * 0.35 + rh * rh);
    vx += (dx / dist) * pull * dt + (-dy / dist) * tang * dt;
    vy += (dy / dist) * pull * dt + (dx / dist) * tang * dt;
    // mild damping far away
    if (dist > rh * 8) {
      vx *= 0.992;
      vy *= 0.992;
    }
    x += vx * dt * 60;
    y += vy * dt * 60;
    if (dist < rh * 0.95 || x < -80 || y < -80 || x > W + 80 || y > H + 80) {
      spawnStar(i);
      continue;
    }
    stars[o] = x;
    stars[o + 1] = y;
    stars[o + 4] = vx;
    stars[o + 5] = vy;
  }

  return { rh, rin, rout, diskOn, cosI, sinI };
}

function draw(meta, now) {
  const S = style;
  const { rh, rin, rout, diskOn } = meta;
  const starGain = Number(params?.starGain ?? 0.55);
  const expo = Number(params?.exposure ?? S.expo) * S.expo;
  const doppUser = Number(params?.doppler ?? S.dopp);

  // space bg
  ctx.fillStyle = "#050508";
  ctx.fillRect(0, 0, W, H);
  // faint nebula
  const g = ctx.createRadialGradient(cx, cy, rh * 2, cx, cy, Math.max(W, H) * 0.7);
  g.addColorStop(0, "rgba(20, 12, 28, 0.55)");
  g.addColorStop(0.45, "rgba(8, 10, 18, 0.35)");
  g.addColorStop(1, "rgba(5, 5, 8, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // stars
  for (let i = 0; i < nStars; i++) {
    const o = i * 7;
    const x = stars[o];
    const y = stars[o + 1];
    const z = stars[o + 2];
    const a = stars[o + 3] * starGain;
    const seed = stars[o + 6];
    const tw = 0.65 + 0.35 * Math.sin(now * 0.004 * (0.5 + seed * 2) + seed * 20);
    const sz = (0.6 + z * 1.4) * (0.85 + 0.3 * seed);
    const cool = seed > 0.55;
    const r = cool ? 180 : 255;
    const gch = cool ? 200 : 220;
    const b = cool ? 255 : 180;
    ctx.fillStyle = `rgba(${r},${gch},${b},${Math.min(1, a * tw)})`;
    ctx.fillRect(x, y, sz, sz);
  }

  // accretion disk particles
  if (diskOn > 0.01) {
    const baseRGB = blackbody(S.temp);
    for (let i = 0; i < nDisk; i++) {
      const o = i * 6;
      const x = disk[o];
      const y = disk[o + 1];
      const r = disk[o + 2];
      const phi = disk[o + 3];
      const kind = disk[o + 4];
      const seed = disk[o + 5];
      if (r < rh * 1.02) continue;

      // band falloff like shader
      const bandIn = smoothstep(rin, rin * 1.2, r);
      const bandOut = 1 - smoothstep(rout * 0.72, rout, r);
      const band = bandIn * bandOut;
      if (band < 0.02) continue;

      // Doppler: orbital tangent · screen-x (left cool / right hot)
      const vtanX = -Math.sin(phi + S.roll);
      const beta = Math.min(0.92, 0.35 + 0.45 * Math.sqrt(rin / Math.max(r, rin)));
      let g2 = 1 / Math.max(0.15, 1 + beta * vtanX * (S.dopp * 0.7 + doppUser * 0.3));
      g2 = 1 + (g2 - 1) * (S.dopp * 0.5 + doppUser * 0.5);

      const tprof = Math.pow(rin / Math.max(r, rin * 0.5), 0.75);
      const T = S.temp * tprof * g2;
      const bb = blackbody(T);
      // mix base for stability
      const rr = Math.min(1, (bb[0] * 0.75 + baseRGB[0] * 0.25) * (0.85 + 0.35 * g2));
      const gg = Math.min(1, (bb[1] * 0.75 + baseRGB[1] * 0.25) * (0.85 + 0.25 * g2));
      const bbch = Math.min(1, (bb[2] * 0.75 + baseRGB[2] * 0.25));

      const streak = 0.45 + S.contr * (0.25 + 0.55 * Math.sin(phi * 9 + r * 0.08 + seed * 12));
      const boost = Math.pow(g2, Math.min(3.5, S.beam * 0.55));
      let alpha = diskOn * S.opac * band * streak * boost * (kind === 2 ? 1.25 : kind === 1 ? 0.95 : 0.45);
      alpha *= 0.22 * expo * S.gain;
      alpha = Math.min(0.95, Math.max(0, alpha));
      if (alpha < 0.02) continue;

      const sz =
        (kind === 2 ? 1.8 : kind === 1 ? 1.25 : 0.85) *
        (0.7 + 0.6 * (1 - (r - rin) / Math.max(1, rout - rin))) *
        (0.9 + seed * 0.4);

      ctx.fillStyle = `rgba(${(rr * 255) | 0},${(gg * 255) | 0},${(bbch * 255) | 0},${alpha})`;
      // fillRect faster than arc for thousands of particles
      const s = Math.max(0.8, sz);
      ctx.fillRect(x - s * 0.5, y - s * 0.5, s, s);
    }

    // soft photon-ring glow
    const ring = ctx.createRadialGradient(cx, cy, rh * 1.15, cx, cy, rh * 2.4);
    const glowA = Math.min(0.55, 0.18 * diskOn * S.gain * expo);
    const gb = blackbody(S.temp * 1.15);
    ring.addColorStop(0, `rgba(${(gb[0] * 255) | 0},${(gb[1] * 255) | 0},${(gb[2] * 255) | 0},${glowA})`);
    ring.addColorStop(0.45, `rgba(${(gb[0] * 255) | 0},${(gb[1] * 200) | 0},${(gb[2] * 180) | 0},${glowA * 0.35})`);
    ring.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rh * 2.5, rh * 2.5 * Math.max(0.25, Math.cos(S.incl * 0.55)), S.roll, 0, Math.PI * 2);
    ctx.fill();
  }

  // event horizon
  const hole = ctx.createRadialGradient(cx, cy, 0, cx, cy, rh * 1.15);
  hole.addColorStop(0, "#000000");
  hole.addColorStop(0.72, "#000000");
  hole.addColorStop(0.9, "rgba(0,0,0,0.85)");
  hole.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = hole;
  ctx.beginPath();
  ctx.arc(cx, cy, rh * 1.15, 0, Math.PI * 2);
  ctx.fill();

  // thin bright rim
  if (diskOn > 0.05) {
    const rim = blackbody(S.temp * 1.3);
    ctx.strokeStyle = `rgba(${(rim[0] * 255) | 0},${(rim[1] * 255) | 0},${(rim[2] * 255) | 0},${0.35 * diskOn})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rh * 1.08, rh * 1.08 * Math.max(0.22, Math.cos(S.incl * 0.55)), S.roll, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / Math.max(1e-6, b - a)));
  return t * t * (3 - 2 * t);
}

function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (!disk || !stars) return;
  const meta = update(dt, now);
  draw(meta, now);
  if (hud) {
    hud.innerHTML = `粒子黑洞 · <strong>${styleName}</strong> · 盘 ${nDisk} · 星 ${nStars}`;
  }
}

function boot(p) {
  params = { ...p };
  applyStyleFromParams();
  // when style changes, rebuild disk radii
  resize();
  cycleT0 = performance.now();
}

canvas.addEventListener("pointermove", (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) / Math.max(1, r.width);
  mouse.y = (e.clientY - r.top) / Math.max(1, r.height);
  mouse.active = true;
});
canvas.addEventListener("pointerleave", () => {
  mouse.active = false;
});
canvas.addEventListener("pointerdown", (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) / Math.max(1, r.width);
  mouse.y = (e.clientY - r.top) / Math.max(1, r.height);
  mouse.active = true;
  if (params?.followMouse) {
    target.x = mouse.x;
    target.y = mouse.y;
  }
});
window.addEventListener("resize", () => {
  if (params) resize();
});

const raw = await fetch("./params.json").then((r) => r.json());
const api = mountParamPanel({
  params: raw,
  corner: "bl",
  title: "粒子黑洞",
  onChange: boot,
});
boot(api.getParams());
lastT = performance.now();
raf = requestAnimationFrame(frame);
