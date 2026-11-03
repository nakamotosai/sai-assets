/**
 * void-fx.js · 黑洞测地线盘（第四背景）
 *
 * 用法：
 *   import { createVoidFx } from './void-fx.js';
 *   const fx = createVoidFx(container, THREE, { quality: 0.85 });
 *   // 每帧：
 *   fx.setEnergy({ bass, subBass, mid, high, level, hit, hitStrength });
 *   fx.render(dt);
 *   // 显隐：fx.setVisible(true/false)
 *   // 拖视角:默认绑 container pointer
 *
 * 音频映射(与 getBgEnergy 字段对齐):
 *   盘纹 / 尺寸 / 增益 / 曝光 / 相机 → 完全锁死
 *   high/mid/hit → 仅星空(闪/密/正向慢旋)
 * 构图:屏幕中心缩小版(uZoom + 固定 orbit.dist)
 */
/** 渲染器版本:拷贝/复用方按此比对(见 src/versions.json)。 */
export const VOID_FX_VERSION = '1.0.0';

export function createVoidFx(container, THREE, opts = {}) {
  const quality = Math.max(0.45, Math.min(1.4, Number(opts.quality ?? 0.9)));
  const steps = Math.round(Number(opts.steps ?? 44));
  const interactive = opts.interactive !== false;

  // ── 基线（接近用户认可的静帧观感）──
  // BASE 与 params.json v8 defaults 对齐（用户调参定版）
  const BASE = {
    temp: 5150,
    inner: 2,
    outer: 7.5,
    opac: 0.74,
    dopp: 1,
    beam: 3.1,
    gain: 2.7,
    contr: 2,
    wind: 1.9,
    speed: 2.5,
    wave: 3.4,
    waveFreq: 6.9,
    thick: 0.18,
    expo: 1.55,
    star: 1.85,
    starDensity: 1,
    starSize: 0.95,
    starTwinkle: 1.8,
    starSpin: 0.115,
    starAudio: 2.1,
    starPop: 1.8,
    fov: 35,
    tilt: 0.12,
    zoom: 2.15,
    panX: 0,
    panY: 0,
  };

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
uniform float uWaveFreq; // 条纹角向细度（越高越密）
uniform float uThick;
uniform float uExpo;
uniform float uStar;
uniform float uSteps;
uniform float uDiskTilt;
uniform float uFlowPhase; // 单调递增相位（只进不退）
uniform float uFlowBoost; // ≥1 当前正向流速倍率（可缓降到 1，不反向）
uniform float uStarDrive; // 0..1 星空音频驱动（轻）
uniform float uStarPhase; // 星空单向旋转相位
uniform float uStarDens;  // 0..1 密度（越高 thr 越低、星越多）
uniform float uStarSize;  // 点大小倍率
uniform float uStarTwink; // 闪烁幅度
uniform float uStarSpin;  // 基自转速
uniform float uStarAudio; // 音频对星增益倍率
uniform float uStarPop;   // 鼓点星爆
uniform vec2  uPan;   // 屏幕中心偏移（可拖）
uniform float uZoom;  // >1 画面上更小

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
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
  // 单向慢旋：可调基速 + 音频相位（只进不退）
  float a = uTime * max(uStarSpin, 0.0) + uStarPhase;
  float c = cos(a), s = sin(a);
  vec3 dr = vec3(c * d.x + s * d.z, d.y, -s * d.x + c * d.z);
  vec2 sph = vec2(atan(dr.x, -dr.z), asin(clamp(dr.y, -1.0, 1.0)));
  // dens↑ 网格更密 + thr 更低 → 星更多
  float dens = clamp(uStarDens, 0.0, 1.0);
  float grid = mix(36.0, 78.0, dens);
  vec2 g = sph * grid;
  vec2 id = floor(g);
  float h = hash21(id);
  // thr: dens=0 → 0.93 稀；dens=1 → 0.72 密；drive 再降一点
  float thr = mix(0.93, 0.72, dens) - clamp(uStarDrive, 0.0, 1.0) * 0.06;
  thr = clamp(thr, 0.55, 0.96);
  if (h < thr) return vec3(0.0);
  vec2 f = fract(g) - 0.5;
  vec2 off = (vec2(hash21(id + 17.3), hash21(id + 31.7)) - 0.5) * 0.65;
  float rad = 0.09 * max(uStarSize, 0.2);
  float spark = smoothstep(rad, 0.0, length(f - off));
  float twAmp = clamp(uStarTwink, 0.0, 3.0);
  float twRate = 1.2 + 3.5 * hash21(id + 5.1) + uStarDrive * 4.5;
  float tw = (1.0 - 0.45 * twAmp) + 0.45 * twAmp * sin(uTime * twRate + uStarPhase * 2.2 + 40.0 * h);
  float pop = 1.0 + uStarDrive * max(uStarPop, 0.0) * smoothstep(thr, 1.0, h);
  vec3 tint = mix(vec3(1.0, 0.85, 0.65), vec3(0.75, 0.85, 1.0), hash21(id + 2.9));
  return tint * spark * tw * pop * ((h - thr) / max(1.0 - thr, 0.02));
}

void main() {
  vec2 res = max(uRes, vec2(2.0));
  // vUv 来自全屏四边形，与 CSS 缩放解耦，保证屏幕中心 = 黑洞
  vec2 uv = vUv * 2.0 - 1.0;
  // 若 vUv 异常则回退 gl_FragCoord（仍要求 uRes=drawingBuffer）
  if (abs(uv.x) > 1.5 || abs(uv.y) > 1.5) {
    uv = (gl_FragCoord.xy / res) * 2.0 - 1.0;
  }
  float aspect = res.x / max(res.y, 1.0);
  uv.x *= aspect;
  // 居中缩小：只改投影倍率，原点仍钉死屏幕中心
  uv *= max(uZoom, 0.6);
  uv -= uPan * vec2(aspect, 1.0);
  float fl = 1.0 / max(tan(max(uFov, 0.2) * 0.5), 0.15);
  vec3 rd = normalize(uCamRight * uv.x + uCamUp * uv.y + uCamFwd * fl);
  vec3 ro = uCamPos;

  float rin  = max(uInner, 1.6);
  float rout = max(uOuter, rin + 0.5);
  float t = uTime;
  // 单向流动：基速永远 >0；音频只加 flowPhase / boost，永不反向
  float boost = max(uFlowBoost, 1.0);
  float phase = max(uFlowPhase, 0.0);

  // 与 E-blackhole-void / ghostty 同：e2 绑倾角（用户认可有机盘）
  float ci = cos(uDiskTilt), si = sin(uDiskTilt);
  vec3 nDisk = normalize(vec3(0.0, ci, si));
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

  int maxSteps = int(clamp(uSteps, 24.0, 64.0));
  // 固定正旋向；禁止 uSpeed 变号
  float sdir = 1.0;
  float spd = abs(uSpeed) * boost * (0.55 + 0.18 * clamp(uWaveSpeed, 0.0, 10.0));
  float thick = max(uThick, 0.04);
  float contr = uContr;

  for (int i = 0; i < 64; i++) {
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
    // 平面穿越 = 主光（E / 屏保同款 · 用户认可版）
    if (s * sPrev < 0.0 && trans > 0.02 && uGain > 0.01) {
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

        // 相位 = 时间正向 + 预热相位（进场已从 ENTRY 秒起，首帧即缠臂）
        float swirl = rc * uWind * 0.12 - (t * spd + phase) * kep * gloc * sdir;
        // ghostty SSOT: azi≈19 / 次级 9；waveFreq 默认 5.6 → 约 20
        float aziScale = clamp(10.0 + max(uWaveFreq, 1.0) * 1.8, 10.0, 32.0);
        float aziScale2 = max(aziScale * 0.47, 6.0);
        float streaks =
          vnoiseWrapY(vec2(rc * 2.8, turns * aziScale + swirl * 3.0), aziScale) * 0.65 +
          vnoiseWrapY(vec2(rc * 1.0, turns * aziScale2 + swirl * 1.5 + 7.0), aziScale2) * 0.35;
        streaks = 0.35 + contr * streaks * streaks;
        // breath 跟 phase 走，不跟瞬时 waveSpeed 弹回
        float breath = 0.92 + 0.08 * sin(rc * 1.1 - (t * abs(uWaveSpeed) + phase * 0.55) * 0.35 * kep);
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
        emitc += trans * cbb * (uGain * 2.3 * density * tprof * tprof * boost);
        trans *= 1.0 - clamp(uOpac * density, 0.0, 0.95);
      }
    }

    // 很轻的厚度软化：侧视别刀片，绝不盖主盘
    float nearDisk = abs(s);
    if (trans > 0.08 && nearDisk < thick * 1.6 && nearDisk > 1e-4) {
      float vert = exp(-(nearDisk * nearDisk) / (2.0 * thick * thick));
      float rc = length(x - nDisk * s);
      if (vert > 0.15 && rc > rin && rc < rout) {
        float band = smoothstep(rin, rin * 1.25, rc) * (1.0 - smoothstep(rout * 0.72, rout, rc));
        float tprof = pow(rin / max(rc, rin), 0.75);
        vec3 cbb = blackbodyRGB(uTemp * tprof);
        emitc += trans * cbb * (uGain * 0.35 * band * vert * thick);
      }
    }

    sPrev = s;
    xPrev = x;
  }
  if (!captured && dot(x, x) < 2.25) captured = true;

  vec3 bg = vec3(0.0);
  if (!captured) {
    // 基星亮度 + 音频增益（uStarAudio 可拧；封顶防爆白）
    float starGain = uStar * (1.0 + max(uStarAudio, 0.0) * 0.55 * clamp(uStarDrive, 0.0, 1.0));
    bg += stars(normalize(v)) * starGain;
  }

  vec3 col = bg * trans + (vec3(1.0) - exp(-emitc * uExpo));
  col = pow(max(col, 0.0), vec3(0.95));
  fragColor = vec4(col, 1.0);
}
`;

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    alpha: false,
    preserveDrawingBuffer: true, // 隐藏预览窗也能探针/截图
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.15 + 0.45 * quality));
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.className = 'void-canvas';
  // 必须 width/height=100%：否则 setSize 缓冲按 dpr 放大后 CSS 仍用缓冲像素，
  // 窗口只露出左上角 → 黑洞看起来偏右下（用户截图就是这个）
  renderer.domElement.style.cssText =
    'display:block;position:absolute;inset:0;width:100%;height:100%;z-index:0;margin:0;padding:0;border:0;';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // 进场预热：time/phase 从 ENTRY 秒起算，首帧旋臂已缠密（用户：别等几秒才变密）
  const ENTRY_AGE = 16;

  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: ENTRY_AGE },
    uCamPos: { value: new THREE.Vector3(0, 1.2, 14) },
    uCamRight: { value: new THREE.Vector3(1, 0, 0) },
    uCamUp: { value: new THREE.Vector3(0, 1, 0) },
    uCamFwd: { value: new THREE.Vector3(0, 0, -1) },
    uFov: { value: (BASE.fov * Math.PI) / 180 },
    uTemp: { value: BASE.temp },
    uInner: { value: BASE.inner },
    uOuter: { value: BASE.outer },
    uOpac: { value: BASE.opac },
    uDopp: { value: BASE.dopp },
    uBeam: { value: BASE.beam },
    uGain: { value: BASE.gain },
    uContr: { value: BASE.contr },
    uWind: { value: BASE.wind },
    uSpeed: { value: BASE.speed },
    uWaveSpeed: { value: BASE.wave },
    uWaveFreq: { value: BASE.waveFreq },
    uThick: { value: BASE.thick },
    uExpo: { value: BASE.expo },
    uStar: { value: BASE.star },
    uSteps: { value: steps },
    uDiskTilt: { value: BASE.tilt },
    uFlowPhase: { value: ENTRY_AGE * 0.55 },
    uFlowBoost: { value: 1 },
    uStarDrive: { value: 0 },
    uStarPhase: { value: 0 },
    uStarDens: { value: BASE.starDensity },
    uStarSize: { value: BASE.starSize },
    uStarTwink: { value: BASE.starTwinkle },
    uStarSpin: { value: BASE.starSpin },
    uStarAudio: { value: BASE.starAudio },
    uStarPop: { value: BASE.starPop },
    uPan: { value: new THREE.Vector2(BASE.panX, BASE.panY) },
    uZoom: { value: BASE.zoom },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    glslVersion: THREE.GLSL3,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  // 卡冈图亚经典仰角（~E 认可版）：别面朝平视，否则平面盘会出直径刀口
  // 仍居中缩小：靠 dist+uZoom，不是压平 pitch
  // entry = 进场/reset 目标；可被 setEntryView / 面板 force 改
  // 进场默认：斜视对角（用户认可卡冈图亚静帧）
  // pitch≈0 侧视太平；pitch 高 → 正对椭圆；对角斜视 ≈ pitch 0.35 + yaw 1.1
  const entry = {
    yaw: opts.yaw != null ? Number(opts.yaw) : 1.1,
    pitch: opts.pitch != null ? Number(opts.pitch) : 0.35,
    dist: opts.dist != null ? Number(opts.dist) : 16.2,
    roll: 0,
    zoom: opts.zoom != null ? Number(opts.zoom) : BASE.zoom,
  };
  const orbit = { yaw: entry.yaw, pitch: entry.pitch, dist: entry.dist, roll: entry.roll };
  BASE.zoom = entry.zoom;
  const drag = { active: false, button: 0, lx: 0, ly: 0 };
  const onViewChange = typeof opts.onViewChange === 'function' ? opts.onViewChange : null;
  let viewNotifyTimer = 0;

  function notifyView(immediate = false) {
    if (!onViewChange) return;
    const fire = () => {
      viewNotifyTimer = 0;
      onViewChange({
        yaw: orbit.yaw,
        pitch: orbit.pitch,
        dist: orbit.dist,
        zoom: uniforms.uZoom.value,
        roll: orbit.roll,
      });
    };
    if (immediate) {
      if (viewNotifyTimer) {
        clearTimeout(viewNotifyTimer);
        viewNotifyTimer = 0;
      }
      fire();
      return;
    }
    // 拖动中节流
    if (viewNotifyTimer) return;
    viewNotifyTimer = setTimeout(fire, drag.active ? 80 : 0);
  }

  // 平滑音频态
  const energy = {
    bass: 0,
    subBass: 0,
    mid: 0,
    high: 0,
    level: 0,
    hit: false,
    hitStrength: 0,
  };
  // 单向律动：相位只增；boost 锁 1（盘不跟音频）
  let flowPhase = ENTRY_AGE * 0.55;
  let flowBoost = 1;
  let pendingHit = 0;
  // 星空：drive 可缓降（亮度），phase 只增（旋/闪相位不回弹）
  let starDrive = 0;
  let starPhase = 0;
  let time = ENTRY_AGE;
  let visible = true;
  let disposed = false;

  function camBasis() {
    // 距离锁死：音频/hit 绝不冲镜头
    const dist = orbit.dist;
    const cp = Math.cos(orbit.pitch);
    const sp = Math.sin(orbit.pitch);
    const cy = Math.cos(orbit.yaw);
    const sy = Math.sin(orbit.yaw);
    const posV = new THREE.Vector3(dist * cp * sy, dist * sp, dist * cp * cy);
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
  }

  function resize() {
    if (disposed) return;
    // 与 E-blackhole-void 同款：逻辑尺寸写缓冲，CSS 100% 铺满（styles.css !important）
    const w = Math.max(2, container.clientWidth || window.innerWidth || 960);
    const h = Math.max(2, container.clientHeight || window.innerHeight || 600);
    renderer.setSize(w, h, false);
    const el = renderer.domElement;
    el.style.width = '100%';
    el.style.height = '100%';
    uniforms.uRes.value.set(el.width, el.height);
  }

  function onPanel(el) {
    return !!(el && el.closest && (el.closest('.tl-param-panel') || el.closest('.dock') || el.closest('button') || el.closest('.mode-pop') || el.closest('.settings')));
  }

  const listeners = [];
  function on(el, type, fn, opt) {
    el.addEventListener(type, fn, opt);
    listeners.push(() => el.removeEventListener(type, fn, opt));
  }

  if (interactive) {
    const canvas = renderer.domElement;
    canvas.style.touchAction = 'none';
    on(canvas, 'pointerdown', (e) => {
      if (onPanel(e.target) || !visible) return;
      drag.active = true;
      drag.button = e.button;
      drag.lx = e.clientX;
      drag.ly = e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });
    on(canvas, 'pointermove', (e) => {
      if (!drag.active) return;
      const dx = e.clientX - drag.lx;
      const dy = e.clientY - drag.ly;
      drag.lx = e.clientX;
      drag.ly = e.clientY;
      if (drag.button === 2 || e.shiftKey) orbit.roll += dx * 0.005;
      else {
        orbit.yaw -= dx * 0.0055;
        orbit.pitch += dy * 0.0045;
        // 放宽仰角：允许接近侧视(0) 到强俯视，面板也能拧到
        const lim = Math.PI * 0.49;
        orbit.pitch = Math.max(-0.2, Math.min(lim, orbit.pitch));
      }
      camBasis();
      notifyView();
    });
    const end = (e) => {
      if (!drag.active) return;
      drag.active = false;
      try {
        canvas.releasePointerCapture?.(e.pointerId);
      } catch (_) {}
      notifyView(true);
    };
    on(canvas, 'pointerup', end);
    on(canvas, 'pointercancel', end);
    on(canvas, 'contextmenu', (e) => e.preventDefault());
    on(
      canvas,
      'wheel',
      (e) => {
        if (onPanel(e.target) || !visible) return;
        e.preventDefault();
        // 滚轮改 zoom（画面大小），不改物理 dist，避免“整洞在抖”
        const z = uniforms.uZoom.value * Math.exp(e.deltaY * 0.00115);
        uniforms.uZoom.value = Math.min(2.6, Math.max(0.85, z));
        BASE.zoom = uniforms.uZoom.value;
        notifyView();
      },
      { passive: false },
    );
  }

  on(window, 'resize', resize);
  resize();
  camBasis();

  /**
   * @param {{bass?:number,subBass?:number,mid?:number,high?:number,level?:number,hit?:boolean,hitStrength?:number}} e
   */
  function setEnergy(e = {}) {
    const a = 0.22; // 平滑读数；相位累加另算，禁用平滑去回弹
    energy.bass = energy.bass * (1 - a) + (e.bass ?? 0) * a;
    energy.subBass = energy.subBass * (1 - a) + (e.subBass ?? 0) * a;
    energy.mid = energy.mid * (1 - a) + (e.mid ?? 0) * a;
    energy.high = energy.high * (1 - a) + (e.high ?? 0) * a;
    energy.level = energy.level * (1 - a) + (e.level ?? 0) * a;
    if (e.hit) {
      // 鼓点只加一次性前冲，不存会衰减的「回弹量」
      pendingHit = Math.max(pendingHit, Math.min(1.5, e.hitStrength ?? 0.6));
    }
  }

  function applyAudioToUniforms(dt) {
    const d = Math.max(0.0001, dt);
    const hitSnap = pendingHit;
    pendingHit = 0;

    // ── 盘：音乐零响应 ──
    // 以前 flowBoost/phase 跟 bass/mid/hit 走 → 旋臂加速+亮纹起伏像整洞在放大喘气。
    // 现锁 boost=1；相位只按恒速走（纯 uTime 旋臂也够，这里留极慢相位方便以后面板调）。
    flowBoost = 1;
    flowPhase += 0.55 * d;

    // ── 星空：唯一听感层 ──
    // high 主导；mid/level 轻辅；hit 抬一截。不碰 gain/expo/zoom/orbit/盘纹。
    const starTarget = Math.min(
      1,
      energy.high * 0.95 + energy.mid * 0.35 + energy.level * 0.2 + hitSnap * 0.75,
    );
    if (starTarget > starDrive) starDrive += (starTarget - starDrive) * Math.min(1, d * 10);
    else starDrive += (starTarget - starDrive) * Math.min(1, d * 2.2);
    starPhase += (0.04 + starDrive * 0.22 + hitSnap * 0.35) * d;

    // ── 每帧钉 BASE（面板 setBase 改的值）+ 音频相位 ──
    uniforms.uGain.value = BASE.gain;
    uniforms.uExpo.value = BASE.expo;
    uniforms.uTemp.value = BASE.temp;
    uniforms.uStar.value = BASE.star;
    uniforms.uOpac.value = BASE.opac;
    uniforms.uDiskTilt.value = BASE.tilt;
    uniforms.uDopp.value = BASE.dopp;
    uniforms.uBeam.value = BASE.beam;
    uniforms.uInner.value = BASE.inner;
    uniforms.uOuter.value = BASE.outer;
    uniforms.uThick.value = BASE.thick;
    uniforms.uZoom.value = BASE.zoom;
    uniforms.uFov.value = (BASE.fov * Math.PI) / 180;
    uniforms.uPan.value.set(BASE.panX, BASE.panY);
    uniforms.uWaveSpeed.value = BASE.wave;
    uniforms.uWaveFreq.value = BASE.waveFreq;
    uniforms.uSpeed.value = Math.abs(BASE.speed);
    uniforms.uWind.value = BASE.wind;
    uniforms.uContr.value = BASE.contr;
    uniforms.uStarDens.value = BASE.starDensity;
    uniforms.uStarSize.value = BASE.starSize;
    uniforms.uStarTwink.value = BASE.starTwinkle;
    uniforms.uStarSpin.value = BASE.starSpin;
    uniforms.uStarAudio.value = BASE.starAudio;
    uniforms.uStarPop.value = BASE.starPop;
    uniforms.uFlowPhase.value = flowPhase;
    uniforms.uFlowBoost.value = flowBoost;
    uniforms.uStarDrive.value = starDrive;
    uniforms.uStarPhase.value = starPhase;
  }

  function render(dt = 1 / 60) {
    if (disposed || !visible) return;
    time += Math.max(0, dt); // 时间也只进
    uniforms.uTime.value = time;
    applyAudioToUniforms(dt);
    camBasis();
    renderer.render(scene, cam);
  }

  function setVisible(v) {
    visible = !!v;
    renderer.domElement.style.display = visible ? 'block' : 'none';
    if (visible) resize();
  }

  function dispose() {
    disposed = true;
    listeners.forEach((off) => off());
    mat.dispose();
    renderer.dispose();
    try {
      container.removeChild(renderer.domElement);
    } catch (_) {}
  }

  /** 记进场视角（面板 force / 用户另存为默认后） */
  function setEntryView(v = {}) {
    if (v.yaw != null && Number.isFinite(Number(v.yaw))) entry.yaw = Number(v.yaw);
    if (v.pitch != null && Number.isFinite(Number(v.pitch))) entry.pitch = Number(v.pitch);
    if (v.dist != null && Number.isFinite(Number(v.dist))) entry.dist = Number(v.dist);
    if (v.zoom != null && Number.isFinite(Number(v.zoom))) entry.zoom = Number(v.zoom);
    if (v.roll != null && Number.isFinite(Number(v.roll))) entry.roll = Number(v.roll);
  }

  /** 重置到进场视角（非写死常量） */
  function resetView() {
    orbit.yaw = entry.yaw;
    orbit.pitch = entry.pitch;
    orbit.dist = entry.dist;
    orbit.roll = entry.roll;
    BASE.zoom = entry.zoom;
    BASE.panX = 0;
    BASE.panY = 0;
    uniforms.uZoom.value = BASE.zoom;
    uniforms.uPan.value.set(0, 0);
    camBasis();
    notifyView();
  }

  return {
    setEnergy,
    render,
    setVisible,
    resize,
    dispose,
    resetView,
    setEntryView,
    get canvas() {
      return renderer.domElement;
    },
    get orbit() {
      return orbit;
    },
    get entry() {
      return { ...entry };
    },
    /**
     * 给面板/调试直接拧基线。
     * 注意：yaw/pitch/dist 仅在 partial 显式带键时才改 orbit（主控勿每次都塞默认）。
     */
    setBase(partial = {}) {
      if (!partial || typeof partial !== 'object') return;
      const map = {
        temp: 'temp',
        gain: 'gain',
        expo: 'expo',
        contr: 'contr',
        opac: 'opac',
        dopp: 'dopp',
        beam: 'beam',
        wind: 'wind',
        speed: 'speed',
        wave: 'wave',
        waveFreq: 'waveFreq',
        thick: 'thick',
        inner: 'inner',
        outer: 'outer',
        tilt: 'tilt',
        star: 'star',
        starDensity: 'starDensity',
        starSize: 'starSize',
        starTwinkle: 'starTwinkle',
        starSpin: 'starSpin',
        starAudio: 'starAudio',
        starPop: 'starPop',
        zoom: 'zoom',
        fov: 'fov',
        panX: 'panX',
        panY: 'panY',
      };
      let touchedOrbit = false;
      for (const k of Object.keys(map)) {
        if (partial[k] != null && Number.isFinite(Number(partial[k]))) {
          BASE[map[k]] = Number(partial[k]);
        }
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'yaw') && Number.isFinite(Number(partial.yaw))) {
        orbit.yaw = Number(partial.yaw);
        touchedOrbit = true;
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'pitch') && Number.isFinite(Number(partial.pitch))) {
        orbit.pitch = Number(partial.pitch);
        touchedOrbit = true;
      }
      if (Object.prototype.hasOwnProperty.call(partial, 'dist') && Number.isFinite(Number(partial.dist))) {
        orbit.dist = Number(partial.dist);
        touchedOrbit = true;
      }
      if (partial.steps != null && Number.isFinite(Number(partial.steps))) {
        uniforms.uSteps.value = Math.round(Number(partial.steps));
      }
      if (partial.quality != null && Number.isFinite(Number(partial.quality))) {
        const q = Math.max(0.45, Math.min(1.4, Number(partial.quality)));
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.15 + 0.45 * q));
        resize();
      }
      uniforms.uZoom.value = BASE.zoom;
      uniforms.uFov.value = (BASE.fov * Math.PI) / 180;
      uniforms.uPan.value.set(BASE.panX, BASE.panY);
      camBasis();
      if (touchedOrbit || partial.zoom != null) {
        // 不在这里 notify：面板自己拧的会更新 prevPanel；拖动手势另走 notifyView
      }
    },
  };
}
