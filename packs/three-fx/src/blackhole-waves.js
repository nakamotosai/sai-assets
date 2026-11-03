/**
 * blackhole-waves · 体波测地线盘(three-fx)
 *
 * 机制:
 *  - 体积薄盘:高斯厚度剖面,侧视不再退化成刀片条纹
 *  - 径向外推波 waveSpeed:纹理在盘面上向外推(动感主开关,不是"画同心环")
 *  - 角向转速 spin + 螺旋臂 wind:开普勒差速 Ω ∝ r^-1.5 拧出旋臂
 *  - 四模式:测地线连续盘 / 转速加强 / 纯粒子 / 混合
 *  - 多普勒左右冷热差 + 黑体色温着色 + 背景星漂移
 *
 * 依赖:../upstream/three.module.js(r170,MIT)+ ./param-panel.js
 */
import * as THREE from '../upstream/three.module.js';
import { mountParamPanel } from './param-panel.js';

const container = document.getElementById('magic');
const hud = document.getElementById('hud');

const MODES = {
  '测地线连续盘': 'geo',
  '测地线·转速加强': 'geo_fast',
  '纯粒子盘': 'particles',
  '混合·底盘+飞尘': 'hybrid',
};

function softSprite() {
  const s = 64;
  const cv = document.createElement('canvas');
  cv.width = s;
  cv.height = s;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,245,220,0.9)');
  grd.addColorStop(0.5, 'rgba(255,180,80,0.3)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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

function hash(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ───────── geodesic fullscreen（GLSL3 · 平面穿越主光 + 低频外推波）─────────
const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform vec2  uRes;
uniform float uTime;
uniform vec3  uCamPos;
uniform vec3  uCamRight;
uniform vec3  uCamUp;
uniform vec3  uCamFwd;
uniform float uFov;
uniform float uTemp;
uniform float uInner;
uniform float uOuter;
uniform float uOpac;
uniform float uDopp;
uniform float uBeam;
uniform float uGain;
uniform float uContr;
uniform float uWind;
uniform float uSpeed;
uniform float uWaveSpeed;
uniform float uWaveFreq;
uniform float uThick;
uniform float uExpo;
uniform float uStar;
uniform float uSteps;
uniform float uDiskTilt;
uniform float uMotionBoost;
uniform float uGeoMix;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

// 与屏保 ref_shader 同款：Y 周期噪声 → 有机螺旋臂，不是靶心环
float vnoiseWrapY(vec2 p, float perY) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float y0 = mod(i.y, perY), y1 = mod(i.y + 1.0, perY);
  return mix(
    mix(hash21(vec2(i.x, y0)), hash21(vec2(i.x + 1.0, y0)), f.x),
    mix(hash21(vec2(i.x, y1)), hash21(vec2(i.x + 1.0, y1)), f.x),
    f.y);
}

vec3 blackbodyRGB(float T) {
  float tt = clamp(T, 1500.0, 40000.0) / 100.0;
  float r = tt <= 66.0 ? 1.0 : clamp(1.292936 * pow(tt - 60.0, -0.1332047), 0.0, 1.0);
  float g = tt <= 66.0 ? clamp(0.3900816 * log(tt) - 0.6318414, 0.0, 1.0)
                       : clamp(1.1298909 * pow(tt - 60.0, -0.0755148), 0.0, 1.0);
  float b = tt >= 66.0 ? 1.0 : (tt <= 19.0 ? 0.0
            : clamp(0.5432068 * log(tt - 10.0) - 1.1962540, 0.0, 1.0));
  return vec3(r, g, b);
}

vec3 stars(vec3 d) {
  float a = uTime * 0.03;
  float c = cos(a), s = sin(a);
  vec3 dr = vec3(c * d.x + s * d.z, d.y, -s * d.x + c * d.z);
  vec2 sph = vec2(atan(dr.x, -dr.z), asin(clamp(dr.y, -1.0, 1.0)));
  vec2 g = sph * 50.0;
  vec2 id = floor(g);
  float h = hash21(id);
  if (h < 0.90) return vec3(0.0);
  vec2 f = fract(g) - 0.5;
  vec2 off = (vec2(hash21(id + 17.3), hash21(id + 31.7)) - 0.5) * 0.65;
  float spark = smoothstep(0.09, 0.0, length(f - off));
  float tw = 0.55 + 0.45 * sin(uTime * (1.2 + 3.5 * hash21(id + 5.1)) + 40.0 * h);
  vec3 tint = mix(vec3(1.0, 0.85, 0.65), vec3(0.75, 0.85, 1.0), hash21(id + 2.9));
  return tint * spark * tw * ((h - 0.90) / 0.10);
}

void main() {
  vec2 res = max(uRes, vec2(2.0));
  vec2 uv = (gl_FragCoord.xy / res) * 2.0 - 1.0;
  uv.x *= res.x / res.y;
  float fl = 1.0 / max(tan(max(uFov, 0.2) * 0.5), 0.15);
  vec3 rd = normalize(uCamRight * uv.x + uCamUp * uv.y + uCamFwd * fl);
  vec3 ro = uCamPos;

  float rin  = max(uInner, 1.6);
  float rout = max(uOuter, rin + 0.5);
  float t = uTime;
  float mb = uMotionBoost;

  float ci = cos(uDiskTilt), si = sin(uDiskTilt);
  vec3 nDisk = normalize(vec3(0.0, ci, si));
  // 与 ref_shader 同：e2 与倾角绑定
  vec3 e2 = normalize(vec3(0.0, cos(uDiskTilt), -sin(uDiskTilt)));
  if (dot(e2, e2) < 1e-4) e2 = vec3(0.0, 0.0, 1.0);
  vec3 e1 = normalize(cross(e2, nDisk));

  vec3 x = ro;
  vec3 v = rd;
  float h2 = length(cross(x, v));
  h2 *= h2;

  vec3 emitc = vec3(0.0);
  float trans = 1.0;
  bool captured = false;
  float sPrev = dot(x, nDisk);
  vec3 xPrev = x;

  int maxSteps = int(clamp(uSteps, 24.0, 72.0));
  float sdir = uSpeed < 0.0 ? -1.0 : 1.0;
  // waveSpeed 只加速纹理相位（外推/拧感），不画硬环
  float spd = abs(uSpeed) * (0.65 + 0.55 * mb) * (0.55 + 0.18 * clamp(uWaveSpeed, 0.0, 10.0));
  float thick = max(uThick, 0.04);

  for (int i = 0; i < 72; i++) {
    if (i >= maxSteps) break;
    float r2 = dot(x, x);
    if (r2 < 1.0) { captured = true; break; }
    if (r2 > 900.0 && dot(v, x) > 0.0) break;

    float r = sqrt(r2);
    float dt = clamp(0.14 * r, 0.03, 1.3);
    vec3 acc = -1.5 * h2 * x / (r2 * r2 * r);
    v += acc * (0.5 * dt);
    x += v * dt;
    r2 = dot(x, x);
    r = sqrt(max(r2, 1e-8));
    acc = -1.5 * h2 * x / (r2 * r2 * r);
    v += acc * (0.5 * dt);

    float s = dot(x, nDisk);
    // 平面穿越 = 主光（屏保同款）
    if (s * sPrev < 0.0 && trans > 0.02 && uGain > 0.01 && uGeoMix > 0.01) {
      float tc = sPrev / (sPrev - s + 1e-8);
      vec3 xc = mix(xPrev, x, tc);
      float rc = length(xc);
      if (rc > rin && rc < rout) {
        float band = smoothstep(rin, rin * 1.25, rc)
                   * (1.0 - smoothstep(rout * 0.70, rout, rc));
        float phi = atan(dot(xc, e2), dot(xc, e1));
        float turns = phi / 6.2831853;
        float kep = pow(rin / max(rc, 0.01), 1.5);
        float gloc = sqrt(max(1.0 - 1.5 / max(rc, 1.5), 0.02));

        // 核心：有机 swirl 噪声（域扭曲 + 角向扰动）
        // wind 旋臂 + 开普勒差速拧；waveSpeed 已并入 spd
        float swirl = rc * uWind * 0.12 - t * kep * spd * gloc * sdir;
        // 角向频率略低于原 19，侧视少摩尔；仍是有机臂不是靶心
        float aziScale = mix(14.0, 19.0, clamp(uWaveFreq / 8.0, 0.0, 1.0));
        float streaks =
          vnoiseWrapY(vec2(rc * 2.8, turns * aziScale + swirl * 3.0), aziScale) * 0.65 +
          vnoiseWrapY(vec2(rc * 1.0, turns * (aziScale * 0.47) + swirl * 1.5 + 7.0), aziScale * 0.47) * 0.35;
        streaks = 0.35 + uContr * streaks * streaks;

        // 极弱径向呼吸（几乎看不出环，只让整体脉动一点）
        float breath = 0.92 + 0.08 * sin(rc * 1.1 - t * uWaveSpeed * 0.35 * kep);
        streaks *= breath;

        vec3 gasdir = normalize(cross(nDisk, xc)) * sdir;
        float beta = clamp(inversesqrt(max(2.0 * (rc - 1.0), 0.2)), 0.0, 0.99);
        float g2 = gloc / max(1.0 + beta * dot(gasdir, normalize(v)), 0.05);
        g2 = mix(1.0, g2, uDopp);
        float xpr = max(1.0 - sqrt(rin / max(rc, rin)), 0.0);
        float tprof = pow(rin / max(rc, rin), 0.75) * pow(xpr, 0.25) / 0.488;
        vec3 cbb = blackbodyRGB(uTemp * tprof * g2);
        float boost = pow(g2, uBeam);
        float density = band * streaks;
        emitc += trans * cbb * (uGain * 2.3 * density * tprof * tprof * boost) * uGeoMix;
        trans *= 1.0 - clamp(uOpac * density * uGeoMix, 0.0, 0.95);
      }
    }

    // 很轻的厚度软化：侧视别刀片，但绝不盖主盘
    float nearDisk = abs(s);
    if (trans > 0.08 && uGeoMix > 0.01 && nearDisk < thick * 1.6 && nearDisk > 1e-4) {
      float vert = exp(-(nearDisk * nearDisk) / (2.0 * thick * thick));
      float rc = length(x - nDisk * s);
      if (vert > 0.15 && rc > rin && rc < rout) {
        float band = smoothstep(rin, rin * 1.25, rc) * (1.0 - smoothstep(rout * 0.72, rout, rc));
        float tprof = pow(rin / max(rc, rin), 0.75);
        vec3 cbb = blackbodyRGB(uTemp * tprof);
        emitc += trans * cbb * (uGain * 0.35 * band * vert * thick) * uGeoMix;
      }
    }

    sPrev = s;
    xPrev = x;
  }
  if (!captured && dot(x, x) < 2.25) captured = true;

  vec3 bg = vec3(0.0);
  if (!captured) {
    bg += stars(normalize(v)) * uStar;
  }

  vec3 col = bg * trans + (vec3(1.0) - exp(-emitc * uExpo));
  col = pow(max(col, 0.0), vec3(0.95));
  fragColor = vec4(col, 1.0);
}
`;

// ───────── renderer / scenes ─────────
const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
renderer.setClearColor(0x000000, 1);
renderer.autoClear = false;
container.appendChild(renderer.domElement);

const geoScene = new THREE.Scene();
const geoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const uniforms = {
  uRes: { value: new THREE.Vector2(1, 1) },
  uTime: { value: 0 },
  uCamPos: { value: new THREE.Vector3(0, 1.2, 14) },
  uCamRight: { value: new THREE.Vector3(1, 0, 0) },
  uCamUp: { value: new THREE.Vector3(0, 1, 0) },
  uCamFwd: { value: new THREE.Vector3(0, 0, -1) },
  uFov: { value: (40 * Math.PI) / 180 },
  uTemp: { value: 5200 },
  uInner: { value: 2.0 },
  uOuter: { value: 9.0 },
  uOpac: { value: 0.82 },
  uDopp: { value: 0.55 },
  uBeam: { value: 2.4 },
  uGain: { value: 1.9 },
  uContr: { value: 1.15 },
  uWind: { value: 5.5 },
  uSpeed: { value: 4.5 },
  uWaveSpeed: { value: 3.2 },
  uWaveFreq: { value: 5.5 },
  uThick: { value: 0.14 },
  uExpo: { value: 1.4 },
  uStar: { value: 0.75 },
  uSteps: { value: 52 },
  uDiskTilt: { value: 0.08 },
  uMotionBoost: { value: 0.45 },
  uGeoMix: { value: 1 },
};

const geoMat = new THREE.ShaderMaterial({
  uniforms,
  vertexShader: VERT,
  fragmentShader: FRAG,
  glslVersion: THREE.GLSL3,
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
});
geoScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), geoMat));

// 粒子场景
const ptScene = new THREE.Scene();
const ptCam = new THREE.PerspectiveCamera(40, 1, 0.1, 400);

const RH = 1.0;
const R_IN = 1.75;
const R_OUT = 7.2;
const R_PS = 1.52;

const N_PRI = 22000;
const N_SEC = 16000;
const N_RING = 8000;
const N_STAR = 3500;
const N = N_PRI + N_SEC + N_RING + N_STAR;

const pos = new Float32Array(N * 3);
const col = new Float32Array(N * 3);
const size = new Float32Array(N);
const baseCol = new Float32Array(N * 3);
const rho = new Float32Array(N);
const phi = new Float32Array(N);
const seed = new Float32Array(N);
const lobe = new Float32Array(N);
const shell = new Float32Array(N);
const kind = new Uint8Array(N);

const K_PRI = 0;
const K_SEC = 1;
const K_RING = 2;
const K_STAR = 3;

function setBC(i, T, mul = 1) {
  const bb = blackbody(T);
  const o = i * 3;
  baseCol[o] = bb[0] * mul;
  baseCol[o + 1] = bb[1] * mul;
  baseCol[o + 2] = bb[2] * mul;
  col[o] = baseCol[o];
  col[o + 1] = baseCol[o + 1];
  col[o + 2] = baseCol[o + 2];
}

function buildParticles(p) {
  const dens = Math.max(0.4, Math.min(1.5, Number(p.particleDensity ?? 1)));
  let i = 0;
  const nPri = Math.floor(N_PRI * dens);
  for (let k = 0; k < N_PRI; k++, i++) {
    if (k >= nPri) {
      kind[i] = K_PRI;
      rho[i] = 999;
      size[i] = 0;
      pos[i * 3] = 999;
      continue;
    }
    kind[i] = K_PRI;
    const u = hash(k + 1);
    rho[i] = R_IN + Math.pow(u, 0.55) * (R_OUT - R_IN);
    phi[i] = hash(k + 9) * Math.PI * 2;
    seed[i] = hash(k + 17);
    lobe[i] = 0;
    shell[i] = 0;
    const T = 3000 + ((R_OUT - rho[i]) / (R_OUT - R_IN)) * 3000;
    setBC(i, T, 1.2);
    size[i] = (0.85 + seed[i] * 0.7) * Number(p.dotScale ?? 1.2);
  }
  const nSec = Math.floor(N_SEC * dens);
  for (let k = 0; k < N_SEC; k++, i++) {
    if (k >= nSec) {
      kind[i] = K_SEC;
      rho[i] = 999;
      size[i] = 0;
      pos[i * 3] = 999;
      continue;
    }
    kind[i] = K_SEC;
    const u = hash(k + 200);
    rho[i] = R_IN + Math.pow(u, 0.5) * (R_OUT - R_IN);
    phi[i] = hash(k + 211) * Math.PI * 2;
    seed[i] = hash(k + 223);
    lobe[i] = hash(k + 227) < 0.5 ? 1 : -1;
    const compress = (rho[i] - R_IN) / (R_OUT - R_IN);
    shell[i] = R_PS * (1.02 + 0.08 * hash(k + 231)) + compress * R_PS * 0.9;
    setBC(i, 3200 + (1 - compress) * 3200, 1.05);
    size[i] = (1.0 + seed[i] * 0.7) * Number(p.dotScale ?? 1.2);
  }
  const nRing = Math.floor(N_RING * dens);
  for (let k = 0; k < N_RING; k++, i++) {
    if (k >= nRing) {
      kind[i] = K_RING;
      rho[i] = 999;
      size[i] = 0;
      pos[i * 3] = 999;
      continue;
    }
    kind[i] = K_RING;
    rho[i] = R_PS;
    phi[i] = hash(k + 400) * Math.PI * 2;
    seed[i] = hash(k + 411);
    shell[i] = R_PS * (1.0 + (hash(k + 419) - 0.5) * 0.05);
    setBC(i, 6500, 1.4);
    size[i] = (0.65 + seed[i] * 0.45) * Number(p.dotScale ?? 1.2);
  }
  for (let k = 0; k < N_STAR; k++, i++) {
    kind[i] = K_STAR;
    const u = hash(k + 500);
    const v = hash(k + 503);
    const th = u * Math.PI * 2;
    const ph = Math.acos(2 * v - 1);
    const R = 35 + hash(k + 507) * 90;
    rho[i] = R;
    phi[i] = th;
    seed[i] = ph;
    lobe[i] = hash(k + 511);
    shell[i] = (hash(k + 513) - 0.5) * 0.02;
    pos[i * 3] = R * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = R * Math.cos(ph);
    pos[i * 3 + 2] = R * Math.sin(ph) * Math.sin(th);
    const cool = hash(k + 515) > 0.55;
    const o = i * 3;
    baseCol[o] = cool ? 0.55 : 0.95;
    baseCol[o + 1] = cool ? 0.68 : 0.88;
    baseCol[o + 2] = cool ? 1.0 : 0.72;
    col[o] = baseCol[o];
    col[o + 1] = baseCol[o + 1];
    col[o + 2] = baseCol[o + 2];
    size[i] = 0.22 + hash(k + 517) * 0.4;
  }
}

function tickParticles(dt, p) {
  const spin = Number(p.spin ?? 4.5) * 0.35;
  const omega0 = 1.6 * spin * Number(p.particleSpin ?? 1.4);
  const thick = Number(p.diskThick ?? 0.14);
  const dopp = Number(p.doppler ?? 0.55);
  const starSpin = 0.04 * Number(p.starDrift ?? 1);

  for (let i = 0; i < N; i++) {
    const k = kind[i];
    if (rho[i] > 100 && k !== K_STAR) continue;
    const o = i * 3;

    if (k === K_PRI) {
      const kep = Math.pow(R_IN / Math.max(rho[i], R_IN * 0.9), 1.5);
      phi[i] += omega0 * kep * dt;
      const c = Math.cos(phi[i]);
      const s = Math.sin(phi[i]);
      const r = rho[i];
      pos[o] = c * r;
      pos[o + 1] = (seed[i] - 0.5) * 2 * thick;
      pos[o + 2] = s * r;
      if ((i & 3) === 0) {
        const boost = 1 + Math.max(0, s) * 0.55 * dopp;
        col[o] = Math.min(2, baseCol[o] * boost);
        col[o + 1] = Math.min(1.8, baseCol[o + 1] * (0.9 * boost + 0.1));
        col[o + 2] = Math.min(1.6, baseCol[o + 2] * (1.05 - 0.2 * Math.max(0, s) * dopp));
      }
    } else if (k === K_SEC) {
      const kep = Math.pow(R_IN / Math.max(rho[i], R_IN * 0.9), 1.5);
      phi[i] += omega0 * kep * dt * 0.92;
      const ph = phi[i];
      const rs = shell[i];
      const lb = lobe[i] >= 0 ? 1 : -1;
      const elev = 0.55 + 0.45 * Math.pow(Math.abs(Math.sin(ph)), 0.65);
      pos[o] = rs * Math.cos(ph);
      pos[o + 1] = lb * rs * elev * (0.55 + 0.45 * Math.abs(Math.sin(ph)));
      pos[o + 2] = rs * Math.sin(ph) * 0.22;
      if ((i & 3) === 0) {
        const b = 0.9 + 0.25 * Math.abs(Math.sin(ph));
        col[o] = Math.min(2, baseCol[o] * b);
        col[o + 1] = Math.min(1.85, baseCol[o + 1] * b);
        col[o + 2] = Math.min(1.6, baseCol[o + 2] * b);
      }
    } else if (k === K_RING) {
      phi[i] += omega0 * 2.5 * dt;
      const c = Math.cos(phi[i]);
      const s = Math.sin(phi[i]);
      const r = shell[i];
      pos[o] = c * r;
      pos[o + 1] = s * r * 0.92;
      pos[o + 2] = s * r * 0.18;
    } else if (k === K_STAR) {
      phi[i] += (starSpin + shell[i]) * dt;
      const R = rho[i];
      const th = phi[i];
      const ph = seed[i];
      pos[o] = R * Math.sin(ph) * Math.cos(th);
      pos[o + 1] = R * Math.cos(ph);
      pos[o + 2] = R * Math.sin(ph) * Math.sin(th);
      const tw = 0.55 + 0.45 * Math.sin(performance.now() * 0.002 * (1 + lobe[i] * 2) + i);
      col[o] = baseCol[o] * tw;
      col[o + 1] = baseCol[o + 1] * tw;
      col[o + 2] = baseCol[o + 2] * tw;
    }
  }
  geo.attributes.position.needsUpdate = true;
  geo.attributes.customColor.needsUpdate = true;
}

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
geo.setAttribute('customColor', new THREE.BufferAttribute(col, 3));
geo.setAttribute('size', new THREE.BufferAttribute(size, 1));

const ptMat = new THREE.ShaderMaterial({
  uniforms: { pointTexture: { value: softSprite() } },
  vertexShader: document.getElementById('pt-vert').textContent,
  fragmentShader: document.getElementById('pt-frag').textContent,
  blending: THREE.AdditiveBlending,
  depthTest: true,
  depthWrite: false,
  transparent: true,
});
const points = new THREE.Points(geo, ptMat);
points.frustumCulled = false;
ptScene.add(points);

const hole = new THREE.Mesh(
  new THREE.SphereGeometry(0.98, 48, 32),
  new THREE.MeshBasicMaterial({ color: 0x000000 }),
);
ptScene.add(hole);

// ───────── orbit ─────────
// 默认略抬高，避免一上来就侧视刀片
const orbit = { yaw: 0.35, pitch: 0.42, dist: 13.5, roll: 0 };
const drag = { active: false, button: 0, lx: 0, ly: 0 };

function camBasis() {
  const cp = Math.cos(orbit.pitch);
  const sp = Math.sin(orbit.pitch);
  const cy = Math.cos(orbit.yaw);
  const sy = Math.sin(orbit.yaw);
  const posV = new THREE.Vector3(
    orbit.dist * cp * sy,
    orbit.dist * sp,
    orbit.dist * cp * cy,
  );
  const fwd = posV.clone().multiplyScalar(-1).normalize();
  let right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  right.normalize();
  let up = new THREE.Vector3().crossVectors(right, fwd).normalize();
  if (Math.abs(orbit.roll) > 1e-5) {
    const c = Math.cos(orbit.roll);
    const s = Math.sin(orbit.roll);
    const r2 = right.clone().multiplyScalar(c).add(up.clone().multiplyScalar(s));
    const u2 = up.clone().multiplyScalar(c).sub(right.clone().multiplyScalar(s));
    right = r2.normalize();
    up = u2.normalize();
  }
  uniforms.uCamPos.value.copy(posV);
  uniforms.uCamRight.value.copy(right);
  uniforms.uCamUp.value.copy(up);
  uniforms.uCamFwd.value.copy(fwd);

  ptCam.position.copy(posV);
  ptCam.up.copy(up);
  ptCam.lookAt(0, 0, 0);
  ptCam.fov = (uniforms.uFov.value * 180) / Math.PI;
  ptCam.updateProjectionMatrix();
}

function onPanel(el) {
  return !!(el && el.closest && el.closest('.tl-param-panel'));
}
container.style.touchAction = 'none';
container.style.cursor = 'grab';
container.addEventListener('pointerdown', (e) => {
  if (onPanel(e.target)) return;
  drag.active = true;
  drag.button = e.button;
  drag.lx = e.clientX;
  drag.ly = e.clientY;
  container.setPointerCapture?.(e.pointerId);
  container.style.cursor = 'grabbing';
  e.preventDefault();
});
container.addEventListener('pointermove', (e) => {
  if (!drag.active) return;
  const dx = e.clientX - drag.lx;
  const dy = e.clientY - drag.ly;
  drag.lx = e.clientX;
  drag.ly = e.clientY;
  if (drag.button === 2 || e.shiftKey) orbit.roll += dx * 0.005;
  else {
    orbit.yaw -= dx * 0.0055;
    orbit.pitch += dy * 0.0045;
    // 软夹：允许接近侧视但别死钉在 0 度
    const lim = Math.PI * 0.48;
    orbit.pitch = Math.max(-lim, Math.min(lim, orbit.pitch));
  }
  camBasis();
});
function endDrag(e) {
  if (!drag.active) return;
  drag.active = false;
  container.style.cursor = 'grab';
  try { container.releasePointerCapture?.(e.pointerId); } catch (_) {}
}
container.addEventListener('pointerup', endDrag);
container.addEventListener('pointercancel', endDrag);
container.addEventListener('pointerleave', endDrag);
container.addEventListener('contextmenu', (e) => e.preventDefault());
container.addEventListener(
  'wheel',
  (e) => {
    if (onPanel(e.target)) return;
    e.preventDefault();
    orbit.dist = Math.min(40, Math.max(6.5, orbit.dist * Math.exp(e.deltaY * 0.0012)));
    camBasis();
  },
  { passive: false },
);

function resize() {
  const w = container.clientWidth || innerWidth || 960;
  const h = container.clientHeight || innerHeight || 600;
  renderer.setSize(w, h, false);
  const pr = renderer.getPixelRatio();
  uniforms.uRes.value.set(w * pr, h * pr);
  ptCam.aspect = w / h;
  ptCam.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
camBasis();

// ───────── mode / params ─────────
let params = null;
let modeKey = 'geo';
let particlesReady = false;
let lastBuildKey = '';

function resolveMode(label) {
  return MODES[label] || 'geo';
}

function applyParams(p) {
  params = { ...p };
  modeKey = resolveMode(p.mode);

  uniforms.uTemp.value = Number(p.temp ?? 5200);
  uniforms.uInner.value = Number(p.inner ?? 2.0);
  uniforms.uOuter.value = Number(p.outer ?? 9.0);
  uniforms.uOpac.value = Number(p.opacity ?? 0.82);
  uniforms.uDopp.value = Number(p.doppler ?? 0.55);
  uniforms.uBeam.value = Number(p.beam ?? 2.4);
  uniforms.uGain.value = Number(p.gain ?? 1.9);
  uniforms.uContr.value = Number(p.contrast ?? 1.15);
  uniforms.uWind.value = Number(p.wind ?? 5.5);
  uniforms.uSpeed.value = Number(p.spin ?? 4.5);
  uniforms.uWaveSpeed.value = Number(p.waveSpeed ?? 3.2);
  uniforms.uWaveFreq.value = Number(p.waveFreq ?? 5.5);
  uniforms.uThick.value = Number(p.diskThick ?? 0.14);
  uniforms.uExpo.value = Number(p.exposure ?? 1.4);
  uniforms.uStar.value = Number(p.starGain ?? 0.75);
  uniforms.uSteps.value = Number(p.steps ?? 52);
  uniforms.uFov.value = ((Number(p.fov ?? 40) * Math.PI) / 180);

  if (modeKey === 'geo') {
    uniforms.uMotionBoost.value = 0.35;
    uniforms.uGeoMix.value = 1;
  } else if (modeKey === 'geo_fast') {
    uniforms.uMotionBoost.value = 1.4;
    uniforms.uContr.value = Math.max(uniforms.uContr.value, 1.35);
    uniforms.uWaveSpeed.value = Math.max(uniforms.uWaveSpeed.value, 5.5);
    uniforms.uSpeed.value = Math.max(uniforms.uSpeed.value, 6);
    uniforms.uGeoMix.value = 1;
  } else if (modeKey === 'particles') {
    uniforms.uGeoMix.value = 0;
    uniforms.uMotionBoost.value = 0;
  } else if (modeKey === 'hybrid') {
    uniforms.uMotionBoost.value = 0.55;
    uniforms.uGeoMix.value = 1;
    uniforms.uOpac.value *= 0.9;
  }

  const needPt = modeKey === 'particles' || modeKey === 'hybrid';
  points.visible = needPt;
  hole.visible = modeKey === 'particles';

  const buildKey = `${modeKey}|${Number(p.particleDensity ?? 1)}|${Number(p.dotScale ?? 1.2)}`;
  if (needPt && buildKey !== lastBuildKey) {
    buildParticles(params);
    lastBuildKey = buildKey;
    particlesReady = true;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.customColor.needsUpdate = true;
    geo.attributes.size.needsUpdate = true;
  }

  const q = Number(p.quality ?? 1);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.2 + 0.55 * q));
  resize();
  camBasis();
  updateHud(true);
}

function modeLabel() {
  for (const [k, v] of Object.entries(MODES)) if (v === modeKey) return k;
  return modeKey;
}

function updateHud(force) {
  if (!hud) return;
  if (!force && (frames & 31) !== 0) return;
  const degY = ((orbit.yaw * 180) / Math.PI).toFixed(0);
  const degP = ((orbit.pitch * 180) / Math.PI).toFixed(0);
  const ws = params ? Number(params.waveSpeed ?? 0).toFixed(1) : '–';
  hud.innerHTML = `${modeLabel()} · <strong>流速</strong> ${ws} · 拖转 ${degY}°/${degP}°`;
}

const t0 = performance.now();
let last = t0;
let frames = 0;

function frame(now) {
  requestAnimationFrame(frame);
  frames++;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  uniforms.uTime.value = (now - t0) * 0.001;

  const needPt = modeKey === 'particles' || modeKey === 'hybrid';
  if (needPt && particlesReady && params) tickParticles(dt, params);

  renderer.clear(true, true, true);
  renderer.render(geoScene, geoCam);

  if (needPt && particlesReady) {
    renderer.clearDepth();
    renderer.render(ptScene, ptCam);
  }

  updateHud(false);
}

// 清旧面板缓存(缓存键跟 slug 走)
try {
  localStorage.removeItem('themelab.blackhole-waves.params');
} catch (_) {}

const raw = await fetch('./params.json').then((r) => r.json());
const api = mountParamPanel({
  params: raw,
  corner: 'bl',
  title: '模式 / 参数',
  onChange: applyParams,
});
applyParams(api.getParams());
requestAnimationFrame(frame);
