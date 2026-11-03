// engine.js — award-grade background engine (WebGL2)
// Implements the DNA: scene -> bright -> separable blur (bloom) -> composite
// (bloom + radial chromatic aberration + film grain + smoothstep vignette + ACES tonemap).
// Guards: DPR cap, half-res scene on weak devices, delta clamp, pause on hidden/offscreen,
// damped cursor, prefers-reduced-motion static frame.

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const BRIGHT_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uScene; uniform float uThreshold;
void main(){
  vec3 c = texture(uScene, vUv).rgb;
  float l = dot(c, vec3(0.2126,0.7152,0.0722));
  float k = smoothstep(uThreshold, uThreshold + 0.35, l);
  o = vec4(c * k, 1.0);
}`;

const BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uDir; // texel-scaled direction
void main(){
  float w[5]; w[0]=0.227027; w[1]=0.1945946; w[2]=0.1216216; w[3]=0.054054; w[4]=0.016216;
  vec3 s = texture(uTex, vUv).rgb * w[0];
  for(int i=1;i<5;i++){
    s += texture(uTex, vUv + uDir * float(i)).rgb * w[i];
    s += texture(uTex, vUv - uDir * float(i)).rgb * w[i];
  }
  o = vec4(s, 1.0);
}`;

const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uScene, uBloom;
uniform float uTime, uGrain, uBloomAmt, uCA, uVig, uExposure;
uniform vec2 uRes;

vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }

void main(){
  vec2 uv = vUv;
  vec2 d = uv - 0.5;
  float r2 = dot(d,d);
  // radial chromatic aberration: zero at center, grows with distance
  float amt = uCA * (0.35 + r2 * 2.2);
  vec3 scene;
  scene.r = texture(uScene, uv + d * amt).r;
  scene.g = texture(uScene, uv).g;
  scene.b = texture(uScene, uv - d * amt).b;

  vec3 bloom = texture(uBloom, uv).rgb * uBloomAmt;
  vec3 col = scene + bloom;

  // luminance-gated film grain: heaviest in mid-tones, near-zero in the deep void and hot cores
  float lum = dot(col, vec3(0.2126,0.7152,0.0722));
  float gGate = smoothstep(0.02, 0.22, lum) * (1.0 - smoothstep(0.72, 1.05, lum));
  float g = hash(uv * uRes * 0.5 + fract(uTime) * 91.7) - 0.5;
  col += g * uGrain * (0.25 + 0.75 * gGate);

  // smoothstep vignette
  float v = smoothstep(0.95, 0.25, length(d) * 1.35);
  col *= mix(1.0, v, uVig);

  col *= uExposure;
  col = aces(col);
  // linear -> sRGB
  col = pow(col, vec3(1.0/2.2));
  // triangular-PDF dither before 8-bit quantize -> kills banding on smooth gradients
  float dth = (hash(uv * uRes + fract(uTime) * 13.1) - hash(uv * uRes * 1.7 + fract(uTime) * 7.3)) / 255.0;
  col += dth;
  o = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error('shader: ' + gl.getShaderInfoLog(s) + '\n' + src.split('\n').slice(0, 3).join('\n'));
  }
  return s;
}
function program(gl, frag) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
  return p;
}
function target(gl, w, h, hdr) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (hdr) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo, w, h };
}

export function createEngine(canvas, sceneFrag, opts = {}) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return { ok: false, reason: 'no webgl2' };
  // RGBA16F render targets require this extension or the FBO is incomplete (scene reads black).
  const hdrOk = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || innerWidth < 820 ||
    (matchMedia('(pointer:coarse)').matches);
  const dprCap = opts.dprCap || (weak ? 1.25 : 1.75);

  const progScene = program(gl, sceneFrag);
  const progBright = program(gl, BRIGHT_FRAG);
  const progBlur = program(gl, BLUR_FRAG);
  const progComp = program(gl, COMPOSITE_FRAG);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  let W = 0, H = 0, sceneT, brightT, blurA, blurB;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, dprCap);
    W = Math.max(2, Math.floor(innerWidth * dpr));
    H = Math.max(2, Math.floor(innerHeight * dpr));
    canvas.width = W; canvas.height = H;
    canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
    const half = 0.5, quart = 0.25;
    sceneT = target(gl, Math.floor(W*half), Math.floor(H*half), hdrOk);   // HDR scene (if supported)
    brightT = target(gl, Math.floor(W*quart), Math.floor(H*quart), hdrOk);
    blurA = target(gl, brightT.w, brightT.h, hdrOk);
    blurB = target(gl, brightT.w, brightT.h, hdrOk);
  }
  resize();
  addEventListener('resize', resize);

  // input: damped cursor + scroll velocity
  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, vx: 0, vy: 0 };
  let scrollV = 0, lastScroll = scrollY;
  addEventListener('pointermove', e => { mouse.tx = e.clientX / innerWidth; mouse.ty = 1 - e.clientY / innerHeight; }, { passive: true });
  addEventListener('scroll', () => { const d = scrollY - lastScroll; lastScroll = scrollY; scrollV += d / innerHeight; }, { passive: true });

  const seed = Math.random() * 1000;
  let t0 = performance.now(), last = t0, running = true, inView = true, frames = 0, raf = 0;
  // 动画速度倍率：1 = 当前速度（预览里的最大值），0 = 静止。用累积时间而非 (now-t0)，才能随时变速不跳帧。
  let speed = (opts.speed != null ? opts.speed : 1);
  let simT = 0;

  function use(prog) { gl.useProgram(prog); return prog; }
  function uni(p, n) { return gl.getUniformLocation(p, n); }
  // cache uniform locations
  const U = {
    scene: { uTime: uni(progScene,'uTime'), uRes: uni(progScene,'uRes'), uMouse: uni(progScene,'uMouse'), uScroll: uni(progScene,'uScroll'), uSeed: uni(progScene,'uSeed') },
    bright: { uScene: uni(progBright,'uScene'), uThreshold: uni(progBright,'uThreshold') },
    blur: { uTex: uni(progBlur,'uTex'), uDir: uni(progBlur,'uDir') },
    comp: { uScene: uni(progComp,'uScene'), uBloom: uni(progComp,'uBloom'), uTime: uni(progComp,'uTime'), uRes: uni(progComp,'uRes'),
            uGrain: uni(progComp,'uGrain'), uBloomAmt: uni(progComp,'uBloomAmt'), uCA: uni(progComp,'uCA'), uVig: uni(progComp,'uVig'), uExposure: uni(progComp,'uExposure') },
  };
  const cfg = Object.assign({ grain: 0.030, bloomAmt: 0.30, threshold: 1.0, ca: 0.0026, vig: 0.5, exposure: 1.0 }, opts);

  function drawScene(t, dt) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneT.fbo);
    gl.viewport(0, 0, sceneT.w, sceneT.h);
    use(progScene);
    gl.uniform1f(U.scene.uTime, t);
    gl.uniform2f(U.scene.uRes, sceneT.w, sceneT.h);
    gl.uniform2f(U.scene.uMouse, mouse.x, mouse.y);
    gl.uniform1f(U.scene.uScroll, scrollV);
    gl.uniform1f(U.scene.uSeed, seed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function bloom() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, brightT.fbo);
    gl.viewport(0, 0, brightT.w, brightT.h);
    use(progBright);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneT.tex);
    gl.uniform1i(U.bright.uScene, 0); gl.uniform1f(U.bright.uThreshold, cfg.threshold);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // separable blur: bright -> blurA (H) -> blurB (V) -> blurA (H) for a wider kernel
    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, blurA.fbo); gl.viewport(0, 0, blurA.w, blurA.h);
      use(progBlur); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, brightT.tex);
      gl.uniform1i(U.blur.uTex, 0); gl.uniform2f(U.blur.uDir, 1.4 / blurA.w, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, blurB.fbo); gl.viewport(0, 0, blurB.w, blurB.h);
      use(progBlur); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, blurA.tex);
      gl.uniform1i(U.blur.uTex, 0); gl.uniform2f(U.blur.uDir, 0, 1.4 / blurB.h); gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }
  function composite(t) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    use(progComp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneT.tex); gl.uniform1i(U.comp.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, blurB.tex); gl.uniform1i(U.comp.uBloom, 1);
    gl.uniform1f(U.comp.uTime, t); gl.uniform2f(U.comp.uRes, W, H);
    gl.uniform1f(U.comp.uGrain, cfg.grain); gl.uniform1f(U.comp.uBloomAmt, cfg.bloomAmt);
    gl.uniform1f(U.comp.uCA, cfg.ca); gl.uniform1f(U.comp.uVig, cfg.vig); gl.uniform1f(U.comp.uExposure, cfg.exposure);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function render(now) {
    raf = requestAnimationFrame(render);
    if (!running || !inView || document.hidden) { last = now; return; }
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;           // clamp tab-return jumps
    simT += dt * speed;                  // 累积仿真时间 -> 变速平滑，不跳帧
    const t = reduced ? 6.0 : simT;
    // damped cursor (never raw 1:1)
    const k = 1 - Math.pow(0.0015, dt);
    mouse.vx = (mouse.tx - mouse.x) * k; mouse.vy = (mouse.ty - mouse.y) * k;
    mouse.x += mouse.vx; mouse.y += mouse.vy;
    scrollV *= Math.pow(0.02, dt);
    drawScene(t, dt); bloom(); composite(t);
    frames++;
  }
  raf = requestAnimationFrame(render);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => { for (const e of es) inView = e.isIntersecting; }).observe(canvas);
  }
  document.addEventListener('visibilitychange', () => { last = performance.now(); });

  return {
    ok: true, weak, reduced, gl,
    frames: () => frames,
    stop: () => cancelAnimationFrame(raf),
    set: (k, v) => { cfg[k] = v; },
    setSpeed: (v) => { speed = v; },
    time: () => simT,
    getSpeed: () => speed,
  };
}
