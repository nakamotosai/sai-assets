// fx.js — 会动粒子引擎(非静态点阵)· sai-assets pack `fx-engines`
// 来源:本机 demo 存档 demos/shared-fx-engine/fx.js(作者自产,往来用于 C-layouts / C-gold 两套首页)。
// 版本:见下方 FX_ENGINE_VERSION;本文件是**唯一一份**引擎实现,消费者拷贝时必须保留版本常量,
//       并通过 scripts/assert_tokens.py 比对 sha256(见 docs/usage.md「验版本」)。
//
// 对标思路:
// - FM beast 电台背景:径向惯性 + 重力弹跳 + 中心重生
// - GitHub morph-particles / FBO 粒子池:持续仿真 + 可 morph 目标
// - three.js attractors / curl 流场:星云感
//
/**
 * 每个 fx:
 *   id, name, en, blurb
 *   create(n) → state
 *   seed(state, fromPosFloat32|null)  可选从当前粒子位置播种
 *   tick(state, outFloat32 xyz*n, t, dt)  写本帧「目标/位置」
 */

/** 引擎版本(库侧版本号):改行为就抬版本,消费者按下表比对拷贝是否漂移。 */
export const FX_ENGINE_VERSION = '1.0.0';

export const FX_META = [
  { id: 0, name: 'Beast 涟漪', en: 'Beast Ripple', blurb: 'FM 电台同款：径向波前 + 弹跳沙' },
  { id: 1, name: '吸引子星云', en: 'Attractors', blurb: '多引力核拖曳 · three.js attractor 感' },
  { id: 2, name: 'Curl 流体', en: 'Curl Flow', blurb: '噪声流场卷云 · 永不静' },
  { id: 3, name: '活字尘', en: 'Living Glyph', blurb: '组字目标 + 呼吸尘 (morph-particles)' },
  { id: 4, name: '银河盘', en: 'Galaxy Disk', blurb: '对数螺线臂 + 核球 + 差速 · 真银河结构' },
  { id: 5, name: '喷泉环', en: 'Fountain Rings', blurb: '中心喷发 + 同心滑行环' },
];

/** 银河 / Curl 等可调参（进 C 面板） */
export const FX_PARAM_DEFAULTS = {
  // 银河：对标真旋涡星系照片（厚臂+核球+盘雾，禁细线电风扇）
  galTilt: 32,     // 俯仰°：略倾面看盘（0=正对，90=纯侧面）
  galYaw: 18,      // 水平转°
  galLift: 8,      // 整体上移
  galRadius: 36,   // 盘半径
  galSpin: 0.18,   // 图案转速
  galArms: 2,      // 主臂默认 2；运行时 clamp 2–8（尊重用户存档）
  galThick: 1.6,   // 盘厚度
  galPitch: 22,    // 螺距角° 偏开（低 pitch+窄脊=电风扇环）
  galScatter: 0.38,// 臂半宽（弧度级厚臂，不是细脊）
  galBulge: 0.22,  // 核球占比
  galCoreBright: 1.0, // 核球亮度（单层；render 只读 glow 不再 ×starW）
  // Curl：真实流速 + 可随机打散（turb↑=布朗/炸开）
  curlSpeed: 8,    // 直接当速度；0.5 慢蠕动，20 很快
  curlScale: 0.06,
  curlStride: 2,   // 默认隔点；5万点全量会卡
  curlBound: 48,
  curlBright: 1,
  curlTurb: 0.35,  // 随机打散强度
  curlDensity: 1,  // 活跃粒子占比
};

export function fxById(id) {
  const n = ((id % FX_META.length) + FX_META.length) % FX_META.length;
  return FX_IMPL[n];
}

export function pickFxParams(src = {}) {
  const o = { ...FX_PARAM_DEFAULTS };
  for (const k of Object.keys(FX_PARAM_DEFAULTS)) {
    if (src[k] != null && Number.isFinite(Number(src[k]))) o[k] = Number(src[k]);
  }
  return o;
}

// ——— utils ———
function hash(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function ampBass(t) {
  // 伪低频：无音频时仍有节拍呼吸（对标 FM ambientBass）
  return (
    0.35 +
    0.35 * Math.max(0, Math.sin(t * 2.2)) +
    0.25 * Math.max(0, Math.sin(t * 5.1 + 1.3)) +
    0.15 * Math.max(0, Math.sin(t * 0.7))
  );
}

function sampleGlyph(text, n, worldW = 88) {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  cv.width = 1600;
  cv.height = 420;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let fs = 160;
  ctx.font = `700 ${fs}px "JetBrains Mono", ui-monospace, Consolas, monospace`;
  while (ctx.measureText(text).width > cv.width - 40 && fs > 36) {
    fs -= 4;
    ctx.font = `700 ${fs}px "JetBrains Mono", ui-monospace, Consolas, monospace`;
  }
  ctx.fillText(text, cv.width / 2, cv.height / 2);
  const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
  const pts = [];
  const step = 3;
  for (let y = 0; y < cv.height; y += step) {
    for (let x = 0; x < cv.width; x += step) {
      if (data[(y * cv.width + x) * 4] > 140) {
        pts.push({
          x: (x / cv.width - 0.5) * worldW,
          y: -(y / cv.height - 0.5) * (worldW * cv.height / cv.width),
          z: 0,
        });
      }
    }
  }
  if (!pts.length) pts.push({ x: 0, y: 0, z: 0 });
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const p = pts[i % pts.length];
    const j = (i * 17) % pts.length;
    const q = pts[j];
    // 轻微打散，避免完全重叠
    const u = hash(i);
    out[i * 3] = p.x * (0.85 + u * 0.15) + (q.x - p.x) * 0.08;
    out[i * 3 + 1] = p.y * (0.85 + hash(i + 3) * 0.15);
    out[i * 3 + 2] = (hash(i + 9) - 0.5) * 2;
  }
  return out;
}

// ═══════════════════════════════════════════
// 0 · Beast 涟漪（FM 物理缩放到主页坐标系）
// ═══════════════════════════════════════════
const beast = {
  create(n) {
    const pos = new Float32Array(n * 3);
    const vy = new Float32Array(n);
    const radial = new Float32Array(n);
    const scale = 2.8; // FM radius~10 → 主页可视 ~28
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = scale * (0.2 + Math.random() * 2.2);
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.4;
      pos[i * 3 + 2] = Math.sin(a) * r;
      vy[i] = 0;
      radial[i] = 2.3 * (0.15 + Math.random() * 0.55);
    }
    return {
      n, pos, vy, radial, scale,
      maxKick: 6, gravity: -22.9, expansion: 2.3,
      radialDamp: 0.991, beatBoost: 0.135, coastBoost: 2.6,
      radius: 10.5, resetMul: 2, centerSpawn: 0.22,
      kickThreshold: 0.02, prevBass: 0,
    };
  },
  seed(s, from) {
    if (!from) return;
    for (let i = 0; i < s.n; i++) {
      s.pos[i * 3] = from[i * 3] * 0.35;
      s.pos[i * 3 + 1] = from[i * 3 + 1] * 0.15;
      s.pos[i * 3 + 2] = from[i * 3 + 2] * 0.35;
      s.vy[i] = 0;
      s.radial[i] = s.expansion * (0.2 + Math.random() * 0.6);
    }
  },
  tick(s, out, t, dt) {
    const bass = ampBass(t) * 90; // 映射到 FM freq 量级
    const freqInfluence = Math.min(Math.max(bass / 95, 0), 1);
    const flux = Math.max(0, bass - s.prevBass);
    s.prevBass = bass;
    const beat = flux > 8;
    const currentKick = s.maxKick * freqInfluence;
    const resetR2 = (s.radius * s.resetMul * s.scale * 0.35) ** 2;
    const cSpawn = s.centerSpawn * s.scale;
    const cSpawn2 = cSpawn * cSpawn;
    const thr = s.kickThreshold;
    const damp = s.radialDamp;
    const respawnP =
      0.0012 + freqInfluence * 0.004 + (beat ? s.beatBoost * (0.5 + freqInfluence) : 0);
    const sc = s.scale * 2.4; // 写回主页尺度

    for (let i = 0; i < s.n; i++) {
      const xIdx = i * 3;
      let x = s.pos[xIdx];
      let y = s.pos[xIdx + 1];
      let z = s.pos[xIdx + 2];
      let distSq = x * x + z * z;

      s.vy[i] += s.gravity * dt;
      y += s.vy[i] * dt;
      if (y <= 0) {
        y = 0;
        if (freqInfluence > thr && distSq > cSpawn2) {
          s.vy[i] = currentKick * (0.45 + Math.random() * 0.55);
        } else s.vy[i] = 0;
      }

      if (distSq > resetR2 || Math.random() < respawnP) {
        const angle = Math.random() * Math.PI * 2;
        const r = cSpawn * Math.sqrt(Math.random());
        x = Math.cos(angle) * r;
        z = Math.sin(angle) * r;
        y = 0;
        s.vy[i] = 0;
        const burst = beat ? 1.35 : 1.0;
        s.radial[i] =
          s.expansion * burst * (0.55 + Math.random() * 0.7) * Math.max(freqInfluence, 0.2);
        s.pos[xIdx] = x;
        s.pos[xIdx + 1] = y;
        s.pos[xIdx + 2] = z;
        out[xIdx] = x * sc;
        out[xIdx + 1] = y * sc * 0.55;
        out[xIdx + 2] = z * sc * 0.35;
        continue;
      }

      if (distSq < 1e-8) {
        const angle = Math.random() * Math.PI * 2;
        x = Math.cos(angle) * 0.002;
        z = Math.sin(angle) * 0.002;
        distSq = x * x + z * z;
      }
      const dist = Math.sqrt(distSq);
      const nx = x / dist;
      const nz = z / dist;
      if (freqInfluence > thr) {
        s.radial[i] += s.expansion * s.coastBoost * freqInfluence * dt;
      }
      s.radial[i] *= damp;
      if (s.radial[i] < 0.02 && freqInfluence > thr) {
        s.radial[i] = s.expansion * freqInfluence * 0.35;
      }
      const step = s.radial[i] * dt;
      x += nx * step;
      z += nz * step;
      s.pos[xIdx] = x;
      s.pos[xIdx + 1] = y;
      s.pos[xIdx + 2] = z;
      out[xIdx] = x * sc;
      out[xIdx + 1] = y * sc * 0.55 + Math.sin(t * 1.2 + i * 0.01) * 0.3;
      out[xIdx + 2] = z * sc * 0.35;
    }
  },
};

// ═══════════════════════════════════════════
// 1 · 吸引子星云
// ═══════════════════════════════════════════
const attractors = {
  create(n) {
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 40;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 28;
      pos[i * 3 + 2] = Math.sin(a) * r * 0.4;
      vel[i * 3] = (Math.random() - 0.5) * 2;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 2;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 1;
    }
    return { n, pos, vel, hubs: 5 };
  },
  seed(s, from) {
    if (!from) return;
    s.pos.set(from.subarray(0, s.n * 3));
  },
  tick(s, out, t, dt) {
    const hubs = [];
    for (let h = 0; h < s.hubs; h++) {
      const ang = t * (0.35 + h * 0.07) + h * 1.7;
      const rad = 14 + h * 4 + Math.sin(t * 0.5 + h) * 3;
      hubs.push({
        x: Math.cos(ang) * rad,
        y: Math.sin(ang * 0.7 + h) * 12,
        z: Math.sin(ang) * rad * 0.35,
        m: 18 + h * 3,
      });
    }
    const damp = 0.985;
    for (let i = 0; i < s.n; i++) {
      const ix = i * 3;
      let x = s.pos[ix], y = s.pos[ix + 1], z = s.pos[ix + 2];
      let vx = s.vel[ix], vy = s.vel[ix + 1], vz = s.vel[ix + 2];
      for (const h of hubs) {
        const dx = h.x - x, dy = h.y - y, dz = h.z - z;
        const d2 = dx * dx + dy * dy + dz * dz + 4;
        const f = h.m / d2;
        vx += dx * f * dt;
        vy += dy * f * dt;
        vz += dz * f * dt;
      }
      // 轻微互斥：离太近反弹
      vx *= damp; vy *= damp; vz *= damp;
      x += vx * dt * 12;
      y += vy * dt * 12;
      z += vz * dt * 12;
      // 软边界
      const lim = 55;
      if (x > lim || x < -lim) vx *= -0.6;
      if (y > 30 || y < -30) vy *= -0.6;
      if (z > 25 || z < -25) vz *= -0.6;
      s.pos[ix] = x; s.pos[ix + 1] = y; s.pos[ix + 2] = z;
      s.vel[ix] = vx; s.vel[ix + 1] = vy; s.vel[ix + 2] = vz;
      out[ix] = x; out[ix + 1] = y; out[ix + 2] = z;
    }
  },
};

// ═══════════════════════════════════════════
// 2 · Curl 流体（真位移 + 惯性 + 可打散，CPU 友好）
// 5 万点：stride 默认 2；噪声用 sin 种子，禁每粒子 4 次 hash
// ═══════════════════════════════════════════
const curl = {
  create(n) {
    // 初始：几团云絮，不是满屏均匀星点
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const blobs = 7;
    for (let i = 0; i < n; i++) {
      const b = (i * 7) % blobs;
      const bx = Math.cos((b / blobs) * Math.PI * 2) * 22;
      const by = Math.sin((b / blobs) * Math.PI * 2.3) * 16;
      const bz = Math.sin(b * 1.7) * 6;
      const jr = 4 + hash(i) * 10;
      const ja = hash(i + 2) * Math.PI * 2;
      const je = (hash(i + 4) - 0.5) * 1.2;
      pos[i * 3] = bx + Math.cos(ja) * jr * Math.cos(je);
      pos[i * 3 + 1] = by + Math.sin(ja) * jr * Math.cos(je);
      pos[i * 3 + 2] = bz + Math.sin(je) * jr * 0.45;
      vel[i * 3] = (hash(i + 3) - 0.5) * 1.5;
      vel[i * 3 + 1] = (hash(i + 4) - 0.5) * 1.5;
      vel[i * 3 + 2] = (hash(i + 5) - 0.5) * 0.6;
      seed[i] = hash(i + 91);
    }
    return { n, pos, vel, seed, frame: 0 };
  },
  seed(s, from) {
    if (!from) return;
    // ★ 只去中心、保留 100% 形状：流体从银河「整团」接着扭，绝不打散成星空
    // 只把质心挪到屏幕中心，解决 galLift 卡上半屏
    let cx = 0, cy = 0, cz = 0;
    const n = s.n;
    for (let i = 0; i < n; i++) {
      const ix = i * 3;
      cx += from[ix];
      cy += from[ix + 1];
      cz += from[ix + 2];
    }
    cx /= n; cy /= n; cz /= n;
    for (let i = 0; i < n; i++) {
      const ix = i * 3;
      s.pos[ix] = from[ix] - cx;
      s.pos[ix + 1] = from[ix + 1] - cy;
      s.pos[ix + 2] = (from[ix + 2] - cz) * 0.85;
      // 相邻粒子共享初速 → 成缕一起走
      const bin =
        ((Math.floor((s.pos[ix] + 40) / 8) & 31) << 6) |
        (Math.floor((s.pos[ix + 1] + 40) / 8) & 31);
      s.vel[ix] = (hash(bin + 11) - 0.5) * 2.4 + (hash(i + 21) - 0.5) * 0.4;
      s.vel[ix + 1] = (hash(bin + 13) - 0.5) * 2.4 + (hash(i + 22) - 0.5) * 0.4;
      s.vel[ix + 2] = (hash(bin + 15) - 0.5) * 0.9;
    }
  },
  tick(s, out, t, dt, params = FX_PARAM_DEFAULTS) {
    const speed = Math.max(0.05, params.curlSpeed ?? 8);
    const sc = Math.max(0.008, params.curlScale ?? 0.06);
    let stride = Math.max(1, Math.min(4, (params.curlStride | 0) || 2));
    if (s.n > 20000) stride = Math.max(2, stride);
    const dens = Math.max(0.05, Math.min(1, params.curlDensity ?? 1));
    const turb = Math.max(0, Math.min(1, params.curlTurb ?? 0.35));
    s.frame = (s.frame || 0) + 1;
    const phase = s.frame % stride;
    const t1 = t * 0.48;
    const t2 = t * 0.37;
    const t3 = t * 0.29;
    // 惯性：高 turb 略散，低 turb 更黏成流体丝
    const damp = 0.92 - turb * 0.1;
    const flowW = 1.15 - turb * 0.35;
    const noiseW = 0.12 + turb * 1.4; // 局部随机，别盖过主场
    const bound = Math.max(20, params.curlBound ?? 48);
    const bx = bound * 0.95;
    const by = bound * 0.88; // 上下够用，但不硬铺满均匀
    const bz = bound * 0.36;
    // 移动吸引/排斥核：局部聚拢 + 局部撕开（流体感核心）
    const hubs = 5;
    const hub = [];
    for (let h = 0; h < hubs; h++) {
      const ang = t * (0.22 + h * 0.05) + h * 1.35;
      const rad = 10 + h * 5.5 + Math.sin(t * 0.31 + h) * 4;
      const sign = (h & 1) === 0 ? 1 : -1; // 偶吸奇斥
      hub.push({
        x: Math.cos(ang) * rad,
        y: Math.sin(ang * 0.85 + h * 0.4) * rad * 0.72,
        z: Math.sin(ang * 0.5) * 6,
        m: sign * (14 + h * 2.5),
      });
    }
    // 可见位移：跟滑条，略抬底以免 1.5 像死水；但绝不整屏匀化
    const speedEff = speed * (0.9 + turb * 0.35);
    const gKick = (s.frame & 15) === 0;
    const kickAmp = turb * turb * 7;

    for (let i = phase; i < s.n; i += stride) {
      const ix = i * 3;
      let x = s.pos[ix], y = s.pos[ix + 1], z = s.pos[ix + 2];
      let vx = s.vel[ix], vy = s.vel[ix + 1], vz = s.vel[ix + 2];
      const sd = s.seed[i];
      const active = sd <= dens;
      const localSpeed = active ? speedEff : speedEff * 0.12;

      // 多尺度 curl：大尺度丝 + 小尺度涡
      const sc2 = sc * 2.3;
      const fx =
        (Math.sin(y * sc + t1) - Math.cos(z * sc * 1.1 - t2)) * 0.7 +
        (Math.sin(y * sc2 + t2) - Math.cos(x * sc2 - t3)) * 0.35;
      const fy =
        (Math.sin(z * sc * 0.9 + t2) - Math.cos(x * sc - t3)) * 0.7 +
        (Math.sin(x * sc2 + t1) - Math.cos(z * sc2 + t2)) * 0.35;
      const fz =
        ((Math.sin(x * sc + t3) - Math.cos(y * sc * 1.05 + t1)) * 0.55) * 0.75;

      // 吸引/排斥核 → 局部密度浪
      let ax = 0, ay = 0, az = 0;
      for (let h = 0; h < hubs; h++) {
        const hb = hub[h];
        const dx = hb.x - x, dy = hb.y - y, dz = hb.z - z;
        const d2 = dx * dx + dy * dy + dz * dz + 6;
        const f = hb.m / d2;
        ax += dx * f;
        ay += dy * f;
        az += dz * f;
      }

      const ph = sd * 40.0 + t * (1.3 + turb * 1.8);
      const n0 = Math.sin(ph);
      const n2 = Math.cos(ph * 1.3 + sd * 7);

      vx = vx * damp + (fx * flowW + ax * 0.08 + n0 * noiseW * 0.35) * localSpeed * 0.5;
      vy = vy * damp + (fy * flowW + ay * 0.08 + n2 * noiseW * 0.35) * localSpeed * 0.5;
      vz = vz * damp + (fz * flowW + az * 0.05 + n0 * n2 * noiseW * 0.2) * localSpeed * 0.35;

      if (active && gKick && kickAmp > 0.4 && ((i + s.frame) % 29) === 0) {
        // 偶发局部分散：只撕一小撮，不是整屏
        vx += n0 * kickAmp;
        vy += n2 * kickAmp;
      }

      x += vx * dt;
      y += vy * dt;
      z += vz * dt;

      // 软边界反弹（保留团状，禁环绕洗成均匀雾）
      if (x > bx) { x = bx; vx *= -0.45; }
      else if (x < -bx) { x = -bx; vx *= -0.45; }
      if (y > by) { y = by; vy *= -0.45; }
      else if (y < -by) { y = -by; vy *= -0.45; }
      if (z > bz) { z = bz; vz *= -0.4; }
      else if (z < -bz) { z = -bz; vz *= -0.4; }

      s.pos[ix] = x; s.pos[ix + 1] = y; s.pos[ix + 2] = z;
      s.vel[ix] = vx; s.vel[ix + 1] = vy; s.vel[ix + 2] = vz;
      out[ix] = x; out[ix + 1] = y; out[ix + 2] = z;
    }
    if (stride > 1) {
      for (let i = 0; i < s.n; i++) {
        if ((i % stride) === phase) continue;
        const ix = i * 3;
        out[ix] = s.pos[ix];
        out[ix + 1] = s.pos[ix + 1];
        out[ix + 2] = s.pos[ix + 2];
      }
    }
  },
};
// ═══════════════════════════════════════════
// 3 · 活字尘（组字 + 持续漂移）
// ═══════════════════════════════════════════
const livingGlyph = {
  create(n, label = 'PROJECTS') {
    const base = sampleGlyph(label, n, 90);
    const phase = new Float32Array(n);
    const amp = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      phase[i] = hash(i) * Math.PI * 2;
      amp[i] = 0.4 + hash(i + 5) * 1.8;
    }
    return { n, base, phase, amp, label };
  },
  seed() { /* base 固定，位置从 tick 出 */ },
  tick(s, out, t) {
    const breath = 1 + Math.sin(t * 1.1) * 0.03;
    for (let i = 0; i < s.n; i++) {
      const ix = i * 3;
      const ph = s.phase[i] + t * (0.8 + (i % 5) * 0.05);
      const a = s.amp[i];
      out[ix] = s.base[ix] * breath + Math.sin(ph) * a * 0.55;
      out[ix + 1] = s.base[ix + 1] * breath + Math.cos(ph * 0.9) * a * 0.4;
      out[ix + 2] = s.base[ix + 2] + Math.sin(ph * 1.3) * a * 0.7;
    }
  },
};

// ═══════════════════════════════════════════
// 4 · 真·旋涡星系（厚臂 + 亮核 + 盘雾）
// galBulge 实时生效：create 存 u∈[0,1]，tick 按占比重分类
// glow[]：核球高亮；render 只进颜色一层（禁再 ×starW / 禁 size 叠）
// ═══════════════════════════════════════════
function gauss01() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

const galaxy = {
  create(n) {
    // 存多套种子，tick 按 galBulge 选 kind，滑条立刻改核大小
    const u = new Float32Array(n);       // 分类抽签
    const rBulge = new Float32Array(n);
    const rArm = new Float32Array(n);
    const rHaze = new Float32Array(n);
    const scatter = new Float32Array(n);
    const z0 = new Float32Array(n);
    const armSeed = new Float32Array(n);
    const glow = new Float32Array(n);    // 每帧写
    const kind = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      u[i] = Math.random();
      // 核球：高度聚核（立方更挤中心）
      rBulge[i] = Math.pow(Math.random(), 0.85) * 0.22;
      // 臂：指数盘
      let ra = 0.1 + (-Math.log(1 - Math.random() * 0.92)) * 0.3;
      if (ra > 1) ra = 0.15 + Math.random() * 0.85;
      rArm[i] = ra;
      rHaze[i] = 0.12 + Math.pow(Math.random(), 0.7) * 0.95;
      scatter[i] = gauss01();
      z0[i] = gauss01();
      armSeed[i] = Math.random();
      kind[i] = 1;
      glow[i] = 1;
    }
    return { n, u, rBulge, rArm, rHaze, scatter, z0, armSeed, kind, glow };
  },
  seed() {},
  tick(s, out, t, _dt, params = FX_PARAM_DEFAULTS) {
    const R = params.galRadius ?? 36;
    const spinBase = Math.max(0, params.galSpin ?? 0.18);
    // 臂数：尊重用户存档，允许 2–8（曾被限 4 导致「只剩 2 条」观感）
    const arms = Math.max(2, Math.min(8, (params.galArms | 0) || 2));
    const thick = Math.max(0.2, params.galThick ?? 1.6);
    const lift = params.galLift ?? 8;
    const pitchDeg = Math.max(12, Math.min(40, params.galPitch ?? 22));
    const b = Math.tan((pitchDeg * Math.PI) / 180);
    const armHalf = 0.14 + Math.max(0.04, params.galScatter ?? 0.38) * 0.85;
    const zScale = 0.35 + Math.min(thick, 8) * 0.12;
    const a = Math.max(2.5, R * 0.12);
    // ★ galBulge 真正生效：粒子占比 + 核半径缩放
    const bulge = Math.max(0.05, Math.min(0.45, params.galBulge ?? 0.22));
    const coreBright = Math.max(0.2, Math.min(6, params.galCoreBright ?? 1.0));
    const armShare = (1 - bulge) * 0.62; // 剩余里 ~62% 臂，~38% 雾
    const armEnd = bulge + armShare;
    const bulgeR = R * (0.55 + bulge * 1.4); // 占比越高核越大
    const tilt = ((params.galTilt ?? 32) * Math.PI) / 180;
    const yaw = ((params.galYaw ?? 18) * Math.PI) / 180;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const armStep = (Math.PI * 2) / arms;
    // 转速全乘 galSpin：=0 必须完全停（禁 0.06/0.14/0.18 底速偷偷转）
    const armPattern = t * spinBase * 0.9;
    const bulgePhase = t * spinBase * 0.55;
    const bulgeNod = spinBase > 0 ? Math.sin(t * 0.19 * spinBase) * 0.08 * Math.min(1, spinBase * 4) : 0;
    const diffSpin = spinBase * 0.22; // 差速也跟滑条，spin=0 时臂不爬

    for (let i = 0; i < s.n; i++) {
      const ix = i * 3;
      let lx = 0, ly = 0, lz = 0;
      // 实时分类（滑条立刻变）
      const ui = s.u[i];
      let k;
      if (ui < bulge) k = 0;
      else if (ui < armEnd) k = 1;
      else k = 2;
      s.kind[i] = k;

      if (k === 0) {
        // 亮核：扁椭圆球，更密更亮
        const rr = s.rBulge[i] * bulgeR;
        const th = s.scatter[i] * 1.2 + s.armSeed[i] * Math.PI * 2 + bulgePhase;
        const elev = s.z0[i] * 0.38 + bulgeNod * 0.2;
        const ce = Math.cos(elev), se = Math.sin(elev);
        lx = Math.cos(th) * rr * ce * 1.2;
        ly = Math.sin(th) * rr * ce * 0.8;
        lz = se * rr * 0.42 * (0.95 + zScale * 0.08);
        // 越靠中心越亮（真图核是最亮的）
        const core = 1 - s.rBulge[i] / 0.22;
        s.glow[i] = (0.75 + core * 1.1) * coreBright; // 单层核亮（禁再叠 starW/size）
      } else if (k === 1) {
        let r = Math.max(a * 0.9, Math.min(R * 1.05, s.rArm[i] * R));
        const armOff = ((s.armSeed[i] * arms) | 0) * armStep;
        const diff = armPattern + t * (diffSpin / Math.sqrt(0.7 + r * 0.04));
        const ridge = Math.log(Math.max(r, a) / a) / b + armOff + diff;
        const th = ridge + s.scatter[i] * armHalf;
        r += s.scatter[i] * armHalf * R * 0.08;
        r = Math.max(a * 0.85, Math.min(R * 1.08, r));
        const clump = 1 + 0.08 * Math.sin(th * 3.2 + s.armSeed[i] * 20);
        lx = Math.cos(th) * r * clump;
        ly = Math.sin(th) * r * clump;
        const diskFall = Math.exp(-(r / R) * (r / R) * 1.1);
        lz = s.z0[i] * zScale * (0.45 + 0.55 * diskFall);
        // 内臂略亮，外臂略暗
        s.glow[i] = 0.5 + (1 - r / R) * 0.4;
      } else {
        let r = s.rHaze[i] * R;
        const armBias = Math.sin(
          Math.log(Math.max(r, a) / a) / b * arms + armPattern * 0.5 + s.scatter[i]
        );
        const th = s.scatter[i] * Math.PI * 2 + armBias * 0.35 + armPattern * 0.15;
        r += (s.armSeed[i] - 0.5) * R * 0.05;
        lx = Math.cos(th) * r;
        ly = Math.sin(th) * r;
        lz = s.z0[i] * zScale * 0.7;
        s.glow[i] = 0.28 + (1 - r / R) * 0.18; // 雾更暗，衬托核/臂
      }

      const y1 = ly * ct - lz * st;
      const z1 = ly * st + lz * ct;
      const x2 = lx * cy + z1 * sy;
      const z2 = -lx * sy + z1 * cy;
      out[ix] = x2;
      out[ix + 1] = y1 + lift;
      out[ix + 2] = z2;
    }
  },
};
// ═══════════════════════════════════════════
// 5 · 喷泉环
// ═══════════════════════════════════════════
const fountain = {
  create(n) {
    const pos = new Float32Array(n * 3);
    const vy = new Float32Array(n);
    const radial = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 6;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.random() * 8;
      pos[i * 3 + 2] = Math.sin(a) * r;
      vy[i] = 4 + Math.random() * 14;
      radial[i] = 2 + Math.random() * 6;
    }
    return { n, pos, vy, radial };
  },
  seed(s, from) {
    if (!from) return;
    for (let i = 0; i < s.n; i++) {
      s.pos[i * 3] = from[i * 3] * 0.2;
      s.pos[i * 3 + 1] = Math.abs(from[i * 3 + 1]) * 0.3;
      s.pos[i * 3 + 2] = from[i * 3 + 2] * 0.2;
    }
  },
  tick(s, out, t, dt) {
    const g = -18;
    const energy = ampBass(t);
    for (let i = 0; i < s.n; i++) {
      const ix = i * 3;
      let x = s.pos[ix], y = s.pos[ix + 1], z = s.pos[ix + 2];
      s.vy[i] += g * dt;
      y += s.vy[i] * dt;
      const dist = Math.sqrt(x * x + z * z) + 1e-4;
      const step = s.radial[i] * dt * (0.6 + energy);
      x += (x / dist) * step;
      z += (z / dist) * step;
      if (y < -18 || dist > 48 || Math.random() < 0.002 + energy * 0.004) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 2.5;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
        y = -2;
        s.vy[i] = 10 + Math.random() * 16 * (0.5 + energy);
        s.radial[i] = 1.5 + Math.random() * 7;
      }
      s.pos[ix] = x; s.pos[ix + 1] = y; s.pos[ix + 2] = z;
      out[ix] = x;
      out[ix + 1] = y;
      out[ix + 2] = z * 0.7;
    }
  },
};

const FX_IMPL = [beast, attractors, curl, livingGlyph, galaxy, fountain];

/** 便捷：建 state + 立刻 tick 一帧到 Float32Array；params 会进 pack 供每帧 tick */
export function makeFx(id, n, label, params) {
  const impl = fxById(id);
  const p = pickFxParams(params || {});
  let state;
  if (id === 3) state = livingGlyph.create(n, label || 'PROJECTS');
  else state = impl.create(n);
  const buf = new Float32Array(n * 3);
  impl.tick(state, buf, 0, 1 / 60, p);
  return {
    impl,
    state,
    buf,
    id,
    params: p,
    /** 每帧：pack.tick(t, dt[, paramsOverride]) */
    tick(t, dt, paramsOverride) {
      if (paramsOverride) Object.assign(this.params, pickFxParams({ ...this.params, ...paramsOverride }));
      this.impl.tick(this.state, this.buf, t, dt, this.params);
    },
    setParams(src) {
      Object.assign(this.params, pickFxParams({ ...this.params, ...src }));
    },
    /** 银河核球高亮等；无则 null */
    getGlow() {
      return this.state?.glow || null;
    },
  };
}
