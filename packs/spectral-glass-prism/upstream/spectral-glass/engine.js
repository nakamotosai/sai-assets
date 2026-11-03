(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))r(i);new MutationObserver(i=>{for(const a of i)if(a.type==="childList")for(const o of a.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&r(o)}).observe(document,{childList:!0,subtree:!0});function n(i){const a={};return i.integrity&&(a.integrity=i.integrity),i.referrerPolicy&&(a.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?a.credentials="include":i.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function r(i){if(i.ep)return;i.ep=!0;const a=n(i);fetch(i.href,a)}})();async function Mo(t,e){if(!("gpu"in navigator))return{kind:"no-webgpu"};const n=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!n)return{kind:"no-adapter"};const r=n.features.has("timestamp-query"),i=await n.requestDevice(r?{requiredFeatures:["timestamp-query"]}:void 0),a=i.features.has("timestamp-query");let o=!0;i.addEventListener("uncapturederror",u=>{const p=u.error;console.error("[webgpu] uncaptured error:",p),o&&(o=!1,e(`GPU validation error: ${p.message}. Please reload the page.`))}),i.lost.then(u=>{console.error("[webgpu] device lost:",u.reason,u.message),e(`GPU device was lost (${u.reason}): ${u.message}. Please reload the page.`)});const s=document.getElementById(t);if(!(s instanceof HTMLCanvasElement))throw new Error(`Canvas #${t} not found`);const l=s.getContext("webgpu");if(!l)return{kind:"no-context"};const d=navigator.gpu.getPreferredCanvasFormat(),c=Math.min(window.devicePixelRatio??1,2);return ht(s,c),l.configure({device:i,format:d,alphaMode:"opaque"}),{device:i,canvas:s,context:l,format:d,dpr:c,hasTimestamp:a}}function ht(t,e){const n=Math.floor(t.clientWidth*e),r=Math.floor(t.clientHeight*e);return(t.width!==n||t.height!==r)&&(t.width=n,t.height=r),{width:n,height:r}}function Vo(t){return!t.endsWith("-srgb")}const Bo=`struct VsOut {\r
  @builtin(position) pos: vec4<f32>,\r
  @location(0)       uv : vec2<f32>,\r
};\r
\r
@vertex\r
fn vs_main(@builtin(vertex_index) vi: u32) -> VsOut {\r
  let x = f32((vi << 1u) & 2u) * 2.0 - 1.0;\r
  let y = f32(vi & 2u) * 2.0 - 1.0;\r
  var out: VsOut;\r
  out.pos = vec4<f32>(x, y, 0.0, 1.0);\r
  out.uv  = vec2<f32>((x + 1.0) * 0.5, 1.0 - (y + 1.0) * 0.5);\r
  return out;\r
}\r
`,Fo=`const MAX_PILLS: u32 = 8u;\r
const MAX_N:      i32 = 64;\r
const HIT_EPS:    f32 = 0.25;  // hit tolerance (small — thin pills survive)\r
const MIN_STEP:   f32 = 0.5;   // min march step (larger — loop doesn't stall on near-zero SDF)\r
// Diamond TIR chain: nudge the bounce origin along the internal ray (pixel\r
// space) so the start is unambiguously inside. Scales with \`diamondSize\`\r
// but clamps: floor ~ DIAMOND_BOUNCE_EPS, ceil below neighbour-facet gaps\r
// so we never replay the 0.5 px MIN_STEP overshoot failure mode.\r
const TIR_BOUNCE_RO_NUDGE_SCALE: f32 = 0.0001;\r
const TIR_BOUNCE_RO_NUDGE_FLOOR: f32 = 0.01;\r
const TIR_BOUNCE_RO_NUDGE_CEIL:  f32 = 0.08;\r
\r
struct PillGpu {\r
  center:   vec3<f32>,\r
  edgeR:    f32,\r
  halfSize: vec3<f32>,\r
  _pad:     f32,\r
};\r
\r
struct Frame {\r
  resolution:         vec2<f32>,\r
  photoSize:          vec2<f32>,\r
  n_d:                f32,\r
  V_d:                f32,\r
  sampleCount:        f32,\r
  refractionStrength: f32,\r
  jitter:             f32,  // < 0 disables wavelength jitter; >= 0 seeds per-pixel/per-frame spectral strata\r
  refractionMode:     f32,\r
  pillCount:          f32,\r
  applySrgbOetf:      f32,  // unused by this shader (sRGB encoding moved to postprocess.wgsl). Slot is kept so the Frame UBO layout stays stable — host still writes 0/1 (uniforms.ts) and tests/uniformsLayout.test.ts pins the name. Reclaiming it means touching all three together.\r
  shape:              f32,  // 0 = pill (stadium), 1 = prism, 2 = cube (rotates), 3 = plate (wavy, tumbles), 4 = diamond (round brilliant, rotates)\r
  time:               f32,  // wall-clock seconds since start (always advancing, even while paused). Drives the noise streams: TAA sub-pixel jitter and per-pixel wavelength stratification (the latter only when \`jitter >= 0\`; the sentinel branch in \`spectralStratumJitter\` skips the time-seeded hash). Rotation matrices are derived from \`sceneTime\` (below), NOT from this field — see \`cubeRot\` / \`plateRot\` / \`diamondRot\` and the time-stream split in src/main.ts.\r
  historyBlend:       f32,  // 0.2 steady state, 1.0 when the scene changed this frame\r
  heroLambda:         f32,  // jittered each frame in [380,700], or fixed 540nm when temporal jitter is off\r
  cameraZ:            f32,  // distance from screen plane (z=0) to camera, in pixels\r
  projection:         f32,  // 0 = orthographic, 1 = perspective\r
  debugProxy:         f32,  // 1 = tint every proxy fragment pink (debug view)\r
  taaEnabled:         f32,  // 1 = jitter ray origin within the pixel so history EMA antialiases shader-decided silhouettes\r
  // Cube rotation (rz·rx composed on the host from \`sceneTime\` — see\r
  // src/math/cube.ts). Driven by the scene/motion stream so "Stop the world"\r
  // freezes the tumble while the noise stream (\`time\`) keeps advancing AA.\r
  // Uploaded as a uniform so every cube SDF evaluation is just one mat-vec\r
  // instead of four cos/sin. With cubeAnalyticExit replacing\r
  // the per-wavelength inside-trace, the cube path's remaining sdfCube traffic\r
  // is sphereTrace (up to 64 iters) + the front sceneNormal (6 evals), each\r
  // going through sceneSdf which scans all live pills, plus a per-pill scan\r
  // inside hitCubePillIdx — sdfCube evaluations still total roughly 70 ×\r
  // pillCount per fragment, so that many cos/sin pairs are saved per frame.\r
  // cubeAnalyticExit also uses cubeRot a few more times directly (two forward\r
  // multiplies, one transpose, two inverse multiplies — all from the same\r
  // uniform, no extra cos/sin).\r
  cubeRot:            mat3x3<f32>,\r
  // Previous frame's cube rotation. Together with the current \`cubeRot\` this\r
  // lets the TAA reprojection path recover the screen position of the hit\r
  // point one frame ago, so the history read follows the rotating cube's\r
  // surface instead of smearing stale neighboring pixels into it.\r
  cubeRotPrev:        mat3x3<f32>,\r
  // Plate rotation (rx·ry composed on the host from \`sceneTime\` — see\r
  // src/math/plate.ts). Same scene/motion-stream gating as \`cubeRot\` above,\r
  // so paused plates freeze too. Used by sdfWavyPlate for both SDF evaluation\r
  // and by vs_proxy to rotate the proxy bounding box so it stays tight\r
  // (cube-style).\r
  plateRot:           mat3x3<f32>,\r
  // Previous frame's plate rotation. Analogous to cubeRotPrev above — feeds\r
  // the TAA reprojection path so tumbling plates also keep sharp refracted\r
  // texture instead of ghosting.\r
  plateRotPrev:       mat3x3<f32>,\r
  // Diamond rotation (rx·ry composed on the host from \`sceneTime\` — see\r
  // src/math/diamond.ts). Fixed -20° X-axis tilt + Y-axis spin, same host-side\r
  // pattern as cube/plate. Used by sdfDiamond (fold to fundamental wedge) and\r
  // by vs_proxy (rotate the AABB so the proxy stays tight as the diamond\r
  // spins).\r
  diamondRot:         mat3x3<f32>,\r
  // Previous frame's diamond rotation for the TAA reprojection path — mirrors\r
  // cubeRotPrev / plateRotPrev so spinning diamonds keep sharp refracted\r
  // texture instead of ghosting.\r
  diamondRotPrev:     mat3x3<f32>,\r
  // Plate wave parameters. \`waveLipFactor\` is the precomputed safety factor\r
  // 1/sqrt(1 + (amp·freq)²) applied inside sdfWavyPlate so the raw\r
  // (box - wave) value is a valid Lipschitz bound — host-side computation\r
  // avoids an \`inverseSqrt\` on every SDF eval. (See the derivation in\r
  // src/webgpu/uniforms.ts for why max|∇waveZ|² = (amp·k)², not 2·(amp·k)².)\r
  //\r
  // \`sceneTime\` is the time value for scene motion (rotation + wave phase).\r
  // It freezes when the user hits "Stop the world" while the noise-seeding\r
  // \`time\` field above keeps advancing — so TAA sub-pixel jitter keeps\r
  // accumulating and AA quality continues to improve on paused scenes.\r
  waveAmp:            f32,\r
  waveFreq:           f32,\r
  waveLipFactor:      f32,\r
  sceneTime:          f32,\r
  // Diamond parameters. \`diamondSize\` is the girdle diameter in pixels — the\r
  // sdfDiamond SDF scales all facet offsets by this at eval time so one uniform\r
  // covers every diamond in the scene (all instances share the size slider).\r
  // \`diamondWireframe\` toggles the facet-edge overlay (1.0 = on).\r
  // \`diamondFacetColor\` toggles a flat-shaded debug fill where each facet\r
  // class gets a distinct colour — useful for checking adjacency + coverage\r
  // without refraction / dispersion confusing the signal.\r
  // \`diamondTirDebug\` (1.0 = on): where the TIR-bounce path doesn't resolve,\r
  // tint pixels — hot pink = chain used the full \`diamondTirMaxBounces\` budget\r
  // but refract(s→air) still TIRs; orange = \`diamondAnalyticExit\` miss (zero\r
  // or invalid nBack) so the failure isn't necessarily "need more bounces".\r
  // When off, the exhausted path blends with silhouette \`bg\` (no envmap) or\r
  // envmap-at-front-reflection; see the wavelength loop "exhausted" branch.\r
  // \`diamondTirMaxBounces\`: cap on internal reflections in the\r
  // diamond TIR-bounce loop (clamped 1..32 in fs_main; host default 6).\r
  // Three trailing pads keep this sub-block 32 B for uniform alignment.\r
  diamondSize:         f32,\r
  diamondWireframe:    f32,\r
  diamondFacetColor:   f32,\r
  diamondTirDebug:     f32,\r
  diamondTirMaxBounces: f32,\r
  _diamondParamsPad0:  f32,\r
  _diamondParamsPad1:  f32,\r
  _diamondParamsPad2:  f32,\r
  // HDR environment map parameters (Phase C).\r
  // \`envmapExposure\`: linear-light multiplier on the sampled panorama.\r
  // Most HDRIs have peaks in the 100-1000 range; 0.25 keeps them\r
  // visible without washing out the Fresnel mix.\r
  // \`envmapRotation\`: radians, rotate the sky around world-Y. Lets the\r
  // user "move the sun" without re-downloading.\r
  // \`envmapEnabled\`: 1.0 = use envmap for reflection/TIR paths, 0.0 =\r
  // keep the Phase A \`reflSrc\` fallback for A/B comparison and as a\r
  // graceful degrade while a new envmap is still fetching.\r
  envmapExposure:     f32,\r
  envmapRotation:     f32,\r
  envmapEnabled:      f32,\r
  smoothCurvature:    f32,  // 1 = L4 squircle rim on pill/cube/plate, 0 = legacy circular rim\r
  pills:              array<PillGpu, MAX_PILLS>,\r
};\r
\r
@group(0) @binding(0) var<uniform> frame: Frame;\r
@group(0) @binding(1) var photoTex: texture_2d<f32>;\r
@group(0) @binding(2) var photoSmp: sampler;\r
@group(0) @binding(3) var historyTex: texture_2d<f32>;\r
@group(0) @binding(4) var historySmp: sampler;\r
// HDR environment panorama (Phase C). rgba16float, equirectangular\r
// projection: U spans longitude ±π (repeat), V spans latitude from +π/2\r
// at the top to -π/2 at the bottom (clamp). Sampled by \`sampleEnvmap()\`\r
// below for reflection/TIR paths so diamond facets reflect a real sky\r
// /room instead of a UV-shifted photo hack.\r
@group(0) @binding(5) var envmapTex: texture_2d<f32>;\r
@group(0) @binding(6) var envmapSmp: sampler;\r
\r
// Sample the equirectangular envmap in a given WORLD-space direction.\r
// Convention:\r
//   - WORLD +Y points VISUALLY DOWN on screen (DOM-top-origin world;\r
//     see pipeline.ts's \`frontFace:'cw'\` comment — NDC-up maps to\r
//     world-down). So a ray going world -Y is going visually UP toward\r
//     the HDRI's zenith, and we sample the panorama's top row (V=0)\r
//     there. The sign convention is baked into the V formula below.\r
//   - Longitude 0 at world +Z (toward camera), wraps ±π as you sweep\r
//     around Y — matches Poly Haven's canonical orientation so users\r
//     who've seen an HDRI in another tool see the same sun position.\r
//   - \`envmapRotation\` (radians) rotates the sky around Y, giving the\r
//     user a "turn the sun" knob without re-downloading a different\r
//     HDRI.\r
//   - \`envmapExposure\` multiplies linear-light intensity. HDRIs can\r
//     be 100×+ brighter than 1.0; the default 0.25 keeps typical peaks\r
//     visible without blowing out the rest of the image.\r
fn sampleEnvmap(dir: vec3<f32>) -> vec3<f32> {\r
  // Defend against zero / near-zero direction vectors. The refraction\r
  // call sites hand in \`mix(rd, r2, strength)\` which collapses to ~0\r
  // when r2 ≈ -rd at strength ≈ 0.5 (can happen on glancing-angle\r
  // refractions at diamond pavilion/crown rims). WGSL's normalize is\r
  // undefined for zero-length input — typically NaN, which then\r
  // poisons atan2 / asin / textureSampleLevel and re-introduces the\r
  // exact "black dots along bright edges" symptom the fp16 clamp in\r
  // envmap.ts was added to eliminate. Return the panorama's zenith as\r
  // a finite, "roughly upward" fallback — the ray was trying to look\r
  // somewhere ambiguous and any coherent direction beats NaN.\r
  let lenSq = dot(dir, dir);\r
  if (!(lenSq > 1.0e-8)) {\r
    return textureSampleLevel(envmapTex, envmapSmp, vec2<f32>(0.5, 0.0), 0.0).rgb\r
         * frame.envmapExposure;\r
  }\r
  let d = dir * inverseSqrt(lenSq);\r
  let twoPi = 6.28318530717958647693;\r
  let lon = atan2(d.x, d.z) + frame.envmapRotation;\r
  let u   = lon / twoPi + 0.5;\r
  // Map world-Y to HDRI-V with the sign that puts the zenith at V=0.\r
  // Since world +Y is visually down:\r
  //   d.y = -1 (ray pointing up)   → V = 0 (top of panorama = sky)\r
  //   d.y = +1 (ray pointing down) → V = 1 (bottom = ground)\r
  // The \`+ asin(...)\` (rather than \`- asin(...)\`) gets this mapping in\r
  // one go. A sign flip here inverts the HDRI upside-down on the\r
  // reflecting surface — the "gray region fed by upward rays" symptom\r
  // that the Phase C review caught.\r
  let v   = 0.5 + asin(clamp(d.y, -1.0, 1.0)) / 3.14159265358979323846;\r
  let raw = textureSampleLevel(envmapTex, envmapSmp, vec2<f32>(u, v), 0.0).rgb;\r
  return raw * frame.envmapExposure;\r
}\r
\r
// ---------- coords ----------\r
\r
fn coverUv(uv: vec2<f32>) -> vec2<f32> {\r
  let sA = frame.resolution.x / frame.resolution.y;\r
  let pA = frame.photoSize.x  / frame.photoSize.y;\r
  var s  = vec2<f32>(1.0);\r
  if (sA > pA) { s = vec2<f32>(1.0, pA / sA); } else { s = vec2<f32>(sA / pA, 1.0); }\r
  return (uv - vec2<f32>(0.5)) * s + vec2<f32>(0.5);\r
}\r
`,zo=`// ---------- SDF ----------\r
\r
const L4_VISUAL_RADIUS_SCALE: f32 = 1.84089642;\r
const ADAPTIVE_ROUND_START: f32 = 0.65;\r
\r
fn superellipseLength2(v: vec2<f32>) -> f32 {\r
  let v2 = v * v;\r
  return sqrt(sqrt(dot(v2, v2)));\r
}\r
\r
fn superellipsoidLength3(v: vec3<f32>) -> f32 {\r
  let v2 = v * v;\r
  return sqrt(sqrt(dot(v2, v2)));\r
}\r
\r
fn adaptiveRoundBlend(edgeR: f32, limit: f32) -> f32 {\r
  if (frame.smoothCurvature <= 0.5) {\r
    return 1.0;\r
  }\r
  return smoothstep(ADAPTIVE_ROUND_START, 1.0, edgeR / max(limit, 1e-6));\r
}\r
\r
fn visualRoundRadius(edgeR: f32, limit: f32) -> f32 {\r
  let blend = adaptiveRoundBlend(edgeR, limit);\r
  let scale = mix(L4_VISUAL_RADIUS_SCALE, 1.0, blend);\r
  return min(edgeR * scale, limit);\r
}\r
\r
fn roundedLength2(v: vec2<f32>, blend: f32) -> f32 {\r
  if (frame.smoothCurvature > 0.5) {\r
    return mix(superellipseLength2(v), length(v), blend);\r
  }\r
  return length(v);\r
}\r
\r
fn roundedLength3(v: vec3<f32>, blend: f32) -> f32 {\r
  if (frame.smoothCurvature > 0.5) {\r
    return mix(superellipsoidLength3(v), length(v), blend);\r
  }\r
  return length(v);\r
}\r
\r
fn sdfPill(p: vec3<f32>, halfSize: vec3<f32>, edgeR: f32) -> f32 {\r
  let xyR  = min(edgeR, min(halfSize.x, halfSize.y));\r
  let zR   = visualRoundRadius(edgeR, halfSize.z);\r
  let zBlend = adaptiveRoundBlend(edgeR, halfSize.z);\r
  let qXY  = abs(p.xy) - (halfSize.xy - vec2<f32>(xyR));\r
  // Keep the front silhouette a true circular capsule. Smooth curvature only\r
  // affects the Z roundover, so toggling it changes refraction joins without\r
  // turning the pill outline into a squircle.\r
  let dXy  = length(max(qXY, vec2<f32>(0.0))) + min(max(qXY.x, qXY.y), 0.0) - xyR;\r
  let w    = vec2<f32>(dXy + zR, abs(p.z) - halfSize.z + zR);\r
  return roundedLength2(max(w, vec2<f32>(0.0)), zBlend) + min(max(w.x, w.y), 0.0) - zR;\r
}\r
\r
// Unnormalised ∇(sdfPill) via central differences — for Newton refinement and\r
// single-pill surface normals (avoids scanning all instances in \`sceneSdf\`).\r
fn sdfPillGrad(p: vec3<f32>, halfSize: vec3<f32>, edgeR: f32) -> vec3<f32> {\r
  let e = HIT_EPS;\r
  let s = 0.5 / e;\r
  return vec3<f32>(\r
    (sdfPill(p + vec3<f32>(e, 0.0, 0.0), halfSize, edgeR) - sdfPill(p - vec3<f32>(e, 0.0, 0.0), halfSize, edgeR)) * s,\r
    (sdfPill(p + vec3<f32>(0.0, e, 0.0), halfSize, edgeR) - sdfPill(p - vec3<f32>(0.0, e, 0.0), halfSize, edgeR)) * s,\r
    (sdfPill(p + vec3<f32>(0.0, 0.0, e), halfSize, edgeR) - sdfPill(p - vec3<f32>(0.0, 0.0, e), halfSize, edgeR)) * s,\r
  );\r
}\r
\r
// Rounded box / cuboid. The rim uses an L4 superellipsoid/squircle norm so\r
// face-to-rim curvature eases in from zero instead of stepping from flat to\r
// circular. Equal halfSize = cube.\r
fn sdfCube(p: vec3<f32>, halfSize: vec3<f32>, edgeR: f32) -> f32 {\r
  let limit = min(halfSize.x, min(halfSize.y, halfSize.z));\r
  let blend = adaptiveRoundBlend(edgeR, limit);\r
  let r = visualRoundRadius(edgeR, limit);\r
  let q = abs(p) - halfSize + vec3<f32>(r);\r
  return roundedLength3(max(q, vec3<f32>(0.0)), blend) + min(max(q.x, max(q.y, q.z)), 0.0) - r;\r
}\r
\r
fn sdfCubeGrad(p: vec3<f32>, halfSize: vec3<f32>, edgeR: f32) -> vec3<f32> {\r
  let limit = min(halfSize.x, min(halfSize.y, halfSize.z));\r
  let blend = adaptiveRoundBlend(edgeR, limit);\r
  let r = visualRoundRadius(edgeR, limit);\r
  let q = abs(p) - halfSize + vec3<f32>(r);\r
  let a = max(q, vec3<f32>(0.0));\r
  let s = select(vec3<f32>(-1.0), vec3<f32>(1.0), p >= vec3<f32>(0.0));\r
  if (frame.smoothCurvature > 0.5) {\r
    let l4 = superellipsoidLength3(a);\r
    if (l4 > 1e-6) {\r
      let l2 = length(a);\r
      let l4Grad = (a * a * a) / (l4 * l4 * l4);\r
      let l2Grad = a / l2;\r
      return s * mix(l4Grad, l2Grad, blend);\r
    }\r
  } else {\r
    let l = length(a);\r
    if (l > 1e-6) {\r
      return s * a / l;\r
    }\r
  }\r
  if (q.x >= q.y && q.x >= q.z) {\r
    return vec3<f32>(s.x, 0.0, 0.0);\r
  }\r
  if (q.y >= q.z) {\r
    return vec3<f32>(0.0, s.y, 0.0);\r
  }\r
  return vec3<f32>(0.0, 0.0, s.z);\r
}\r
\r
// Isosceles triangle in YZ (apex +Z, base -Z), extruded along X. Half-sizes\r
// match sdfPill: halfSize.x is extrusion length, halfSize.y the triangle base\r
// half-width, halfSize.z the apex height. Sharp edges (no rim radius) so the\r
// proxy AABB \`±halfSize\` tightly bounds the solid.\r
fn sdfPrism(p: vec3<f32>, halfSize: vec3<f32>) -> f32 {\r
  let hY = halfSize.y;\r
  let hZ = halfSize.z;\r
  let qy = abs(p.y);\r
  let qz = p.z;\r
  let lenInv = 1.0 / sqrt(hY * hY + 4.0 * hZ * hZ);\r
  let dSlant = (qy * 2.0 * hZ + (qz - hZ) * hY) * lenInv;\r
  let dBase  = -hZ - qz;\r
  let d2     = max(dSlant, dBase);\r
\r
  let dX = abs(p.x) - halfSize.x;\r
  let w  = vec2<f32>(d2, dX);\r
  return length(max(w, vec2<f32>(0.0))) + min(max(w.x, w.y), 0.0);\r
}\r
\r
fn sdfPrismGrad(p: vec3<f32>, halfSize: vec3<f32>) -> vec3<f32> {\r
  let e = HIT_EPS;\r
  let s = 0.5 / e;\r
  return vec3<f32>(\r
    (sdfPrism(p + vec3<f32>(e, 0.0, 0.0), halfSize) - sdfPrism(p - vec3<f32>(e, 0.0, 0.0), halfSize)) * s,\r
    (sdfPrism(p + vec3<f32>(0.0, e, 0.0), halfSize) - sdfPrism(p - vec3<f32>(0.0, e, 0.0), halfSize)) * s,\r
    (sdfPrism(p + vec3<f32>(0.0, 0.0, e), halfSize) - sdfPrism(p - vec3<f32>(0.0, 0.0, e), halfSize)) * s,\r
  );\r
}\r
\r
// Diamond (round brilliant cut) SDF + proxy-mesh helpers live in a separate\r
// shader unit: src/shaders/diamond.wgsl. It's concatenated at pipeline build\r
// time so sdfDiamond / diamondAnalyticExit / diamondAnalyticHitScene /\r
// diamondProxyVertex are visible to the dispatch sites below (sceneSdf,\r
// fs_main, fs_main_diamond, vs_proxy). The split keeps the dispersion/\r
// shader bundle focused on trace + SDF framework and leaves Phase B's\r
// multi-bounce TIR trace for diamond a clear home.\r
\r
// Thick square plate as a CONSTANT-THICKNESS bent sheet. The midsurface\r
// follows a sin·sin cross wave; both faces of the plate ride that midsurface\r
// together so the thickness stays uniform at every (x, y) — the plate reads\r
// as a rippling sheet rather than a pulsating blob.\r
//\r
// \`halfSize.x\` drives the square face extent (y is forced to match so the\r
// plate stays square regardless of the pillShort slider), \`halfSize.z\` is\r
// the half-thickness. Wave amplitude + frequency come from uniforms so they\r
// can be wired to UI sliders without per-shape slot juggling.\r
//\r
// Tumble rotation is precomputed on the host as \`frame.plateRot\` (see\r
// src/math/plate.ts) — same trick as cubeRot, saves four cos/sin per SDF eval.\r
//\r
// The returned distance is scaled by \`frame.waveLipFactor\` (computed on the\r
// host as 1/sqrt(1 + (amp·freq)²)) because the z-shift breaks the Lipschitz\r
// constant along x/y: the shifted SDF has gradient magnitude\r
// sqrt(1 + (∂waveZ/∂x)² + (∂waveZ/∂y)²) which grows with amp·freq. Dividing\r
// by that tight bound — see the derivation in src/webgpu/uniforms.ts on why\r
// max(|∇waveZ|²) = (amp·k)², NOT 2·(amp·k)² — keeps raymarch steps safely\r
// inside the true distance so the trace never tunnels through the thin slab,\r
// while staying as aggressive as the current wave parameters allow (~0.92 at\r
// defaults, previously a conservative hardcoded 0.6 — ≈35% fewer sphereTrace\r
// steps at the same safety margin, or equivalently ≈53% more progress per\r
// step).\r
fn sdfWavyPlate(pIn: vec3<f32>, halfSize: vec3<f32>, edgeR: f32) -> f32 {\r
  let p = frame.plateRot * pIn;\r
\r
  // Force square XY face (halfSize.y ignored — UI hides pillShort for plate).\r
  let h = vec3<f32>(halfSize.x, halfSize.x, halfSize.z);\r
\r
  // Midsurface z-displacement. Animated via phase-shift on scene time so the\r
  // plate "pulses" independently of its tumble; 2·sceneTime reads faster\r
  // than the 0.2–0.3 rad/s tumble so both motions are visible at once.\r
  // Scene time is used (not the caller's \`t\`) so pause/unpause freezes the\r
  // wave in sync with the rotation.\r
  let k     = frame.waveFreq;\r
  let st    = frame.sceneTime;\r
  let waveZ = frame.waveAmp * sin(k * p.x + st * 2.0) * sin(k * p.y + st * 2.0);\r
\r
  // Slab centered on the wavy midsurface. Both faces ride \`waveZ\` together,\r
  // giving a constant-thickness bent sheet instead of a bulge/pinch volume.\r
  // Rounded box (same shrink-then-rim pattern as sdfCube, edgeR for the\r
  // fillet between the wavy front Z face and the flat side X / Y faces) so\r
  // the rim crease that would otherwise live at \`q.x = q.z = 0\` doesn't\r
  // exist as a math singularity — the rounded transition gives a continuous\r
  // gradient across the corner, which removes the dominant source of the\r
  // "speckle along plate edge" artifact at its origin instead of relying\r
  // on \`plateCreaseAt\` to detect-and-divert it.\r
  //\r
  // Use the same smooth-curvature switch and visual radius compensation as\r
  // sdfCube so the plate's rim can be compared against the legacy circular\r
  // fillet without changing the slider value.\r
  let pShift = vec3<f32>(p.x, p.y, p.z - waveZ);\r
  let limit  = min(h.x, min(h.y, h.z));\r
  let blend  = adaptiveRoundBlend(edgeR, limit);\r
  let r      = visualRoundRadius(edgeR, limit);\r
  let q      = abs(pShift) - h + vec3<f32>(r);\r
  let box    = roundedLength3(max(q, vec3<f32>(0.0)), blend) + min(max(q.x, max(q.y, q.z)), 0.0) - r;\r
\r
  return box * frame.waveLipFactor;\r
}\r
`,Uo=`fn sceneSdf(p: vec3<f32>) -> f32 {\r
  let count   = min(u32(frame.pillCount), MAX_PILLS);\r
  let shapeId = i32(frame.shape + 0.5);\r
  var d: f32 = 1e9;\r
  for (var i: u32 = 0u; i < count; i = i + 1u) {\r
    let pill  = frame.pills[i];\r
    let local = p - pill.center;\r
    var pd: f32;\r
    if (shapeId == 2) {\r
      // Cube is rotated in local space before SDF evaluation. Rotation is a\r
      // uniform (computed once on the host per frame), so every SDF call here\r
      // is just one mat-vec — the heavy cos/sin used to run per call.\r
      pd = sdfCube(frame.cubeRot * local, pill.halfSize, pill.edgeR);\r
    } else if (shapeId == 1) {\r
      pd = sdfPrism(local, pill.halfSize);\r
    } else if (shapeId == 3) {\r
      // Plate: wave amp + freq + time come from global uniforms\r
      // (frame.waveAmp / frame.waveFreq / frame.sceneTime). pill.edgeR is\r
      // the rim radius for the rounded corner that smooths the wavy front\r
      // Z face into the flat side X / Y faces (eliminates the rim crease).\r
      pd = sdfWavyPlate(local, pill.halfSize, pill.edgeR);\r
    } else if (shapeId == 4) {\r
      // Diamond: size comes from \`frame.diamondSize\` (single global slider),\r
      // so per-pill \`halfSize\` / \`edgeR\` slots are ignored. Multi-instance\r
      // still works because \`local\` is relative to each pill's \`center\`.\r
      pd = sdfDiamond(local, frame.diamondSize);\r
    } else {\r
      pd = sdfPill(local, pill.halfSize, pill.edgeR);\r
    }\r
    d = min(d, pd);\r
  }\r
  return d;\r
}\r
\r
// Upper bound on the internal path length a ray can take inside any pill in\r
// the scene. Used to cap insideTrace. For a rotated cube the diagonal (√3\r
// times the max half-side, doubled) is the longest possible chord; for pill\r
// and prism the 3D diagonal of the AABB is an upper bound too.\r
//\r
// Diamond takes a shape-specific path: its halfSize is coincidental (main.ts\r
// writes \`pill.hx/hy/hz = diamondSize/2\` so the drag hit-test works, but the\r
// SDF reads \`frame.diamondSize\` directly). Using the diamondSize-derived\r
// upper bound here decouples the internal-trace cap from the pills array,\r
// so a future refactor that stops initialising halfSize for diamond can't\r
// silently clip the pavilion's deepest rays.\r
fn maxInternalPath() -> f32 {\r
  let shapeId = i32(frame.shape + 0.5);\r
  if (shapeId == 4) {\r
    // Diamond: true longest interior chord is 2·R_GIRDLE = diameter\r
    // (between opposite girdle points). Doubled again for safety covers\r
    // multi-bounce paths Phase B will eventually add; \`* 2.0\` is what\r
    // cube/pill/prism/plate also use (2× the half-size = full extent).\r
    return max(frame.diamondSize * 2.0, 32.0);\r
  }\r
  let count = min(u32(frame.pillCount), MAX_PILLS);\r
  var m: f32 = 0.0;\r
  for (var i: u32 = 0u; i < count; i = i + 1u) {\r
    let hs = frame.pills[i].halfSize;\r
    m = max(m, length(hs) * 2.0);\r
  }\r
  return max(m, 32.0);  // floor so degenerate zero-size pills don't stop march\r
}\r
\r
// Returns a unit-length surface normal at \`p\`, OR the zero vector as a\r
// sentinel meaning "the local SDF gradient is degenerate, don't trust this\r
// hit". Callers must check \`dot(n, n) > 0.5\` and fall back to the bg path\r
// for sentinel hits — see fs_main below.\r
//\r
// Degenerate-gradient guard exists because at a silhouette / wave crest\r
// the six finite-diff probes can land on near-equal SDF values (e.g. a\r
// wavy plate hit exactly at the apex of a bump where ∇sdf is tangent to\r
// the view ray), making \`g\` near-zero. \`normalize(0)\` returns NaN, which\r
// would cascade:\r
//   refract(rd, NaN, eta) → all-NaN r1\r
//   dot(r1, r1) < 1e-4 compares NaN < 1e-4 → false → continue NOT taken\r
//   the NaN flows through inside-trace, photo sample, CMF normalise →\r
//   final outRgb NaN → written to history → permanent white/black pixel.\r
// Visible specifically when TAA is off: with the ray frozen at the pixel\r
// centre every frame, the same degenerate hit re-fires forever; with TAA\r
// jitter the ±0.5 px sub-pixel offset usually misses the singular point.\r
//\r
// An arbitrary fallback normal (e.g. \`(0, 0, 1)\`) is worse than no normal:\r
// it produces a valid-but-wrong refraction that visibly differs from the\r
// neighbours' correct refraction, leaving a dot speckle along edges. The\r
// honest sentinel + bg fallback at the call site renders these pixels as\r
// background, which blends seamlessly with the surrounding silhouette.\r
fn sceneNormal(p: vec3<f32>) -> vec3<f32> {\r
  let e = vec2<f32>(HIT_EPS, 0.0);\r
  let g = vec3<f32>(\r
    sceneSdf(p + e.xyy) - sceneSdf(p - e.xyy),\r
    sceneSdf(p + e.yxy) - sceneSdf(p - e.yxy),\r
    sceneSdf(p + e.yyx) - sceneSdf(p - e.yyx),\r
  );\r
  let len2 = dot(g, g);\r
  if (len2 < 1e-8) {\r
    return vec3<f32>(0.0);\r
  }\r
  return g * inverseSqrt(len2);\r
}\r
\r
// Front normal for prism (shapeId==1): single \`sdfPrism\` / \`sdfPrismGrad\`.\r
fn sceneNormalPrism(p: vec3<f32>, pillIdx: u32) -> vec3<f32> {\r
  let pill  = frame.pills[pillIdx];\r
  let local = p - pill.center;\r
  let g     = sdfPrismGrad(local, pill.halfSize);\r
  let len2  = dot(g, g);\r
  if (len2 < 1e-8) {\r
    return vec3<f32>(0.0);\r
  }\r
  return g * inverseSqrt(len2);\r
}\r
\r
// Front normal for the pill shape (shapeId==0) using one instance's sdfPill\r
// only — \`sceneNormal\` would run 6× \`sceneSdf\` = 6× pillCount SDFs per eval.\r
fn sceneNormalPill(p: vec3<f32>, pillIdx: u32) -> vec3<f32> {\r
  let pill  = frame.pills[pillIdx];\r
  let local = p - pill.center;\r
  let g     = sdfPillGrad(local, pill.halfSize, pill.edgeR);\r
  let len2  = dot(g, g);\r
  if (len2 < 1e-8) {\r
    return vec3<f32>(0.0);\r
  }\r
  return g * inverseSqrt(len2);\r
}\r
`,Ho=`// ---------- tracing ----------\r
\r
struct Hit { ok: bool, p: vec3<f32>, t: f32 };\r
\r
fn sphereTrace(ro: vec3<f32>, rd: vec3<f32>, maxT: f32) -> Hit {\r
  var t: f32 = 0.0;\r
  for (var i: i32 = 0; i < 64; i = i + 1) {\r
    let p = ro + rd * t;\r
    let d = sceneSdf(p);\r
    if (d < HIT_EPS) { return Hit(true, p, t); }\r
    t = t + max(d, MIN_STEP);\r
    if (t > maxT) { break; }\r
  }\r
  return Hit(false, vec3<f32>(0.0), 0.0);\r
}\r
\r
// March from just inside the front surface until we reach the back surface.\r
// \`ro\` is the front-hit point; we skip a small entry band so the on-surface\r
// start pixel doesn't short-circuit at t=0.\r
fn insideTrace(ro: vec3<f32>, rd: vec3<f32>, maxT: f32) -> vec3<f32> {\r
  var t: f32 = 2.0;\r
  var p = ro + rd * t;\r
  for (var i: i32 = 0; i < 48; i = i + 1) {\r
    p = ro + rd * t;\r
    let d = -sceneSdf(p);\r
    if (abs(d) < HIT_EPS) { return p; }\r
    t = t + max(abs(d), MIN_STEP);\r
    if (t > maxT) { break; }\r
  }\r
  return p;\r
}\r
\r
// Which cube pill does a world-space point belong to? Used once per fragment\r
// after the front hit to pick the pill whose analytical back-face intersection\r
// we'll evaluate in the wavelength loop. Only meaningful when the front hit is\r
// itself on a cube; the call site gates this with \`isCube\`. (Pill / prism use\r
// \`hitPillPillIdx\` / \`hitPrismPillIdx\` instead.)\r
//\r
// Uses per-pill rotated-cube SDF (same expression as sceneSdf's cube branch),\r
// then ranks by ABSOLUTE distance to the surface so that:\r
//   - On the surface (typical sphere-trace exit, |d| ≈ HIT_EPS): the pill we\r
//     actually hit wins.\r
//   - When MIN_STEP=0.5 > HIT_EPS=0.25 lets the trace overshoot and report a\r
//     point slightly INSIDE a pill (sceneSdf < 0): the pill containing the\r
//     point still wins, because |d| is smallest for the surface closest to it.\r
// Picking by center distance is wrong when pills overlap or have asymmetric\r
// sizes — a hit on pill A's big face can be closer to pill B's center, which\r
// would then drive \`cubeAnalyticExit\` with B's halfSize/edgeR/center and\r
// produce a bogus exit. Linear scan, capped at MAX_PILLS=8 so it's cheap.\r
//\r
// pillCount==0 returns the unmodified default (best=0u). The caller never\r
// reaches this with pillCount==0 because the front sphere-trace would miss,\r
// but documenting the invariant keeps the function safe to repurpose.\r
fn hitCubePillIdx(p: vec3<f32>) -> u32 {\r
  let count = min(u32(frame.pillCount), MAX_PILLS);\r
  var best:  u32 = 0u;\r
  var bestD: f32 = 1e9;\r
  for (var i: u32 = 0u; i < count; i = i + 1u) {\r
    let pill  = frame.pills[i];\r
    let local = frame.cubeRot * (p - pill.center);\r
    let d     = abs(sdfCube(local, pill.halfSize, pill.edgeR));\r
    if (d < bestD) { bestD = d; best = i; }\r
  }\r
  return best;\r
}\r
\r
// Which pill does the front hit belong to? Same distance logic as\r
// \`hitCubePillIdx\`, but the surface SDF is \`sdfPill\` (stadium) not \`sdfCube\`.\r
fn hitPillPillIdx(p: vec3<f32>) -> u32 {\r
  let count = min(u32(frame.pillCount), MAX_PILLS);\r
  var best:  u32 = 0u;\r
  var bestD: f32 = 1e9;\r
  for (var i: u32 = 0u; i < count; i = i + 1u) {\r
    let pill  = frame.pills[i];\r
    let local = p - pill.center;\r
    let d     = abs(sdfPill(local, pill.halfSize, pill.edgeR));\r
    if (d < bestD) { bestD = d; best = i; }\r
  }\r
  return best;\r
}\r
\r
// Which prism instance owns the front hit? Same pattern as \`hitPillPillIdx\`.\r
fn hitPrismPillIdx(p: vec3<f32>) -> u32 {\r
  let count = min(u32(frame.pillCount), MAX_PILLS);\r
  var best:  u32 = 0u;\r
  var bestD: f32 = 1e9;\r
  for (var i: u32 = 0u; i < count; i = i + 1u) {\r
    let pill  = frame.pills[i];\r
    let local = p - pill.center;\r
    let d     = abs(sdfPrism(local, pill.halfSize));\r
    if (d < bestD) { bestD = d; best = i; }\r
  }\r
  return best;\r
}\r
\r
// Analytical back-face exit for axis-aligned \`sdfPill\` (no world rotation).\r
// Same AABB slab + Newton refinement idea as \`cubeAnalyticExit\`, but the\r
// SDF/gradient are \`sdfPill\` / \`sdfPillGrad\` instead of rounded-box.\r
fn pillAnalyticExit(roWorld: vec3<f32>, rdWorld: vec3<f32>, pillIdx: u32) -> CubeExit {\r
  let pill = frame.pills[pillIdx];\r
  let h    = pill.halfSize;\r
  let roL  = roWorld - pill.center;\r
  let rdL  = rdWorld;\r
  let rdInv = vec3<f32>(1.0) / rdL;\r
  let tHi   = (h - roL) * rdInv;\r
  let tLo   = (-h - roL) * rdInv;\r
  let tExitAxis = max(tHi, tLo);\r
  var tExit: f32;\r
  var faceAxisN: vec3<f32>;\r
  if (tExitAxis.x <= tExitAxis.y && tExitAxis.x <= tExitAxis.z) {\r
    tExit = tExitAxis.x;\r
    let faceDir = select(-1.0, 1.0, tHi.x >= tLo.x);\r
    faceAxisN = vec3<f32>(faceDir, 0.0, 0.0);\r
  } else if (tExitAxis.y <= tExitAxis.z) {\r
    tExit = tExitAxis.y;\r
    let faceDir = select(-1.0, 1.0, tHi.y >= tLo.y);\r
    faceAxisN = vec3<f32>(0.0, faceDir, 0.0);\r
  } else {\r
    tExit = tExitAxis.z;\r
    let faceDir = select(-1.0, 1.0, tHi.z >= tLo.z);\r
    faceAxisN = vec3<f32>(0.0, 0.0, faceDir);\r
  }\r
  var pL = roL + rdL * tExit;\r
  for (var i: i32 = 0; i < 4; i = i + 1) {\r
    let d = sdfPill(pL, h, pill.edgeR);\r
    if (abs(d) < HIT_EPS * 0.1) { break; }\r
    let n = sdfPillGrad(pL, h, pill.edgeR);\r
    let nLen2 = dot(n, n);\r
    if (nLen2 < 1e-8) { break; }\r
    pL = pL - n * (d / nLen2);\r
  }\r
  let nG = sdfPillGrad(pL, h, pill.edgeR);\r
  let nL2 = dot(nG, nG);\r
  var nOutL: vec3<f32>;\r
  if (nL2 > 1e-8) {\r
    nOutL = nG * inverseSqrt(nL2);\r
  } else {\r
    nOutL = faceAxisN;\r
  }\r
  let pWorld = pL + pill.center;\r
  return CubeExit(pWorld, -nOutL);\r
}\r
\r
// Analytical back-face for sharp \`sdfPrism\` (axis-aligned, no fillet).\r
fn prismAnalyticExit(roWorld: vec3<f32>, rdWorld: vec3<f32>, pillIdx: u32) -> CubeExit {\r
  let pill = frame.pills[pillIdx];\r
  let h    = pill.halfSize;\r
  let roL  = roWorld - pill.center;\r
  let rdL  = rdWorld;\r
  let rdInv = vec3<f32>(1.0) / rdL;\r
  let tHi   = (h - roL) * rdInv;\r
  let tLo   = (-h - roL) * rdInv;\r
  let tExitAxis = max(tHi, tLo);\r
  var tExit: f32;\r
  var faceAxisN: vec3<f32>;\r
  if (tExitAxis.x <= tExitAxis.y && tExitAxis.x <= tExitAxis.z) {\r
    tExit = tExitAxis.x;\r
    let faceDir = select(-1.0, 1.0, tHi.x >= tLo.x);\r
    faceAxisN = vec3<f32>(faceDir, 0.0, 0.0);\r
  } else if (tExitAxis.y <= tExitAxis.z) {\r
    tExit = tExitAxis.y;\r
    let faceDir = select(-1.0, 1.0, tHi.y >= tLo.y);\r
    faceAxisN = vec3<f32>(0.0, faceDir, 0.0);\r
  } else {\r
    tExit = tExitAxis.z;\r
    let faceDir = select(-1.0, 1.0, tHi.z >= tLo.z);\r
    faceAxisN = vec3<f32>(0.0, 0.0, faceDir);\r
  }\r
  var pL = roL + rdL * tExit;\r
  for (var i: i32 = 0; i < 4; i = i + 1) {\r
    let d = sdfPrism(pL, h);\r
    if (abs(d) < HIT_EPS * 0.1) { break; }\r
    let n = sdfPrismGrad(pL, h);\r
    let nLen2 = dot(n, n);\r
    if (nLen2 < 1e-8) { break; }\r
    pL = pL - n * d * inverseSqrt(nLen2);\r
  }\r
  let nG = sdfPrismGrad(pL, h);\r
  let nL2 = dot(nG, nG);\r
  var nOutL: vec3<f32>;\r
  if (nL2 > 1e-8) {\r
    nOutL = nG * inverseSqrt(nL2);\r
  } else {\r
    nOutL = faceAxisN;\r
  }\r
  let pWorld = pL + pill.center;\r
  return CubeExit(pWorld, -nOutL);\r
}\r
\r
// Analytical back-face intersection for a rotated rounded cube. Given a ray\r
// starting inside the cube (typically the refracted direction at the front\r
// hit), returns (pExit_world, nBack_world) where nBack faces INTO the glass —\r
// matching the \`-sceneNormal(pExit)\` convention the caller passes to\r
// \`refract()\`. Replaces the per-wavelength \`insideTrace\` (up to 48 SDF evals)\r
// plus \`sceneNormal\` (6 SDF evals for finite-diff gradient) with one slab\r
// intersection, so the savings multiply by N in Exact mode.\r
//\r
// Uses ray-box slab intersection in the cube's local (rotated) frame:\r
//   \`pExit_local = roL + rdL * tExit\`, where tExit is the smallest t at which\r
//   the ray leaves one of the three axis-aligned slabs [-halfSize, +halfSize].\r
// The outward normal is the superellipsoid rounded-box gradient at\r
// \`pExit_local\`. It smoothly blends face→rim→corner exactly like the\r
// finite-diff normal did, so the rounded rim keeps its soft refraction.\r
//\r
// The slab intersection alone overshoots the rounded surface by up to edgeR\r
// at rim and corner exits — invisible on a still cube but visibly flickering\r
// on a rotating one because the overshoot direction shifts axis frame to\r
// frame. After the slab we run 3 Newton-style refinement steps using the\r
// rounded-box SDF gradient. Each step is an implicit-surface Newton update,\r
// which matters because the L4 squircle rim is a distance estimator whose\r
// gradient is shorter than one on diagonal rim/corner spans.\r
// Cost: 3 cheap SDF+analytic-gradient evals per back-trace, vs the 48-eval\r
// inside-trace + 6-eval finite-diff normal we replaced — still much cheaper\r
// than the original path.\r
struct CubeExit {\r
  pWorld: vec3<f32>,\r
  nBack:  vec3<f32>,  // inward-facing (into the glass), same sign convention as -sceneNormal\r
};\r
\r
fn cubeAnalyticExit(roWorld: vec3<f32>, rdWorld: vec3<f32>, pillIdx: u32) -> CubeExit {\r
  let pill = frame.pills[pillIdx];\r
  let h    = pill.halfSize;\r
\r
  // World → local (axis-aligned cube at origin). The rotation is orthonormal,\r
  // so rdL is already unit-length if rdWorld was.\r
  let roL = frame.cubeRot * (roWorld - pill.center);\r
  let rdL = frame.cubeRot * rdWorld;\r
\r
  // Slab intersection per axis. A zero component in rdL gives ±inf which\r
  // \`max\` naturally rejects: ro is inside the cube so \`h - roL > 0\` and\r
  // \`-h - roL < 0\`, and inf carries the rejection across \`max\`. The tricky\r
  // case \`(h - roL) == 0\` with \`rdL == 0\` would give 0/0 = NaN, but that\r
  // requires ro exactly on the slab boundary AND a ray parallel to it — not\r
  // reachable from a refracted ray starting strictly inside.\r
  let rdInv = vec3<f32>(1.0) / rdL;\r
  let tHi   = (h - roL) * rdInv;\r
  let tLo   = (-h - roL) * rdInv;\r
  let tExitAxis = max(tHi, tLo);\r
\r
  // First slab crossing on the way out wins. \`faceDir\` is +1 if we exit the\r
  // positive slab and -1 if we exit the negative one — derived from tHi vs tLo\r
  // (not \`sign(rdL)\`, which is 0 for rdL == 0 and would zero the normal).\r
  var tExit: f32;\r
  var faceAxisN: vec3<f32>;\r
  if (tExitAxis.x <= tExitAxis.y && tExitAxis.x <= tExitAxis.z) {\r
    tExit = tExitAxis.x;\r
    let faceDir = select(-1.0, 1.0, tHi.x >= tLo.x);\r
    faceAxisN = vec3<f32>(faceDir, 0.0, 0.0);\r
  } else if (tExitAxis.y <= tExitAxis.z) {\r
    tExit = tExitAxis.y;\r
    let faceDir = select(-1.0, 1.0, tHi.y >= tLo.y);\r
    faceAxisN = vec3<f32>(0.0, faceDir, 0.0);\r
  } else {\r
    tExit = tExitAxis.z;\r
    let faceDir = select(-1.0, 1.0, tHi.z >= tLo.z);\r
    faceAxisN = vec3<f32>(0.0, 0.0, faceDir);\r
  }\r
\r
  var pL    = roL + rdL * tExit;\r
  // Refine pL onto the rounded surface. For flat-face exits this loop exits\r
  // immediately because the slab plane IS the rounded surface; for rim/corner\r
  // exits each iteration applies Newton's method on the rounded-box implicit\r
  // field. 3 iterations gets us within float precision of the surface even at\r
  // acute corners — without\r
  // refinement the exit position oscillates by up to edgeR per frame as the\r
  // cube rotates and the dominant slab axis flips, producing visible\r
  // blur-sharp shimmer on the rim.\r
  for (var i: i32 = 0; i < 3; i = i + 1) {\r
    let d        = sdfCube(pL, h, pill.edgeR);\r
    let grad     = sdfCubeGrad(pL, h, pill.edgeR);\r
    let gradLen2 = dot(grad, grad);\r
    if (gradLen2 < 1e-8) { break; }  // pL is at the inner core (degenerate)\r
    if (abs(d)   < HIT_EPS * 0.1) { break; }  // already on the surface\r
    pL = pL - grad * (d / gradLen2);\r
  }\r
\r
  // Rounded-box gradient at the refined pL: normal blends from axis-aligned\r
  // in the flat face region to superellipsoid rim/corner, matching the\r
  // finite-diff normal the sphere-trace path would compute.\r
  let roundedN  = sdfCubeGrad(pL, h, pill.edgeR);\r
  let roundedL2 = dot(roundedN, roundedN);\r
  var nOutL: vec3<f32>;\r
  if (roundedL2 > 1e-8) {\r
    nOutL = roundedN * inverseSqrt(roundedL2);\r
  } else {\r
    // Degenerate: pL is exactly on the inner-core AABB (only reachable when\r
    // edgeR ≥ smallest halfSize, which is filtered host-side). Fall back to\r
    // the slab face normal so refraction still has a defined direction.\r
    nOutL = faceAxisN;\r
  }\r
\r
  // Local → world. rotation is orthonormal, so transpose == inverse.\r
  let rotT    = transpose(frame.cubeRot);\r
  let pWorld  = rotT * pL     + pill.center;\r
  let nOut    = rotT * nOutL;\r
  return CubeExit(pWorld, -nOut);\r
}\r
\r
// (Earlier \`plateCreaseAt\` detector was retired in favour of the rounded-rim\r
// \`sdfWavyPlate\` — the geometric crease no longer exists, and the sentinel\r
// \`sceneNormal\` degenerate guard catches any residual cases at no extra\r
// per-pixel cost.)\r
\r
// Same idea as hitCubePillIdx but for plates. Picks the plate whose surface\r
// is closest (by absolute SDF) to the front-hit point, so \`plateAnalyticExit\`\r
// operates on the plate we actually hit even when multiple plates overlap.\r
fn hitPlatePillIdx(p: vec3<f32>) -> u32 {\r
  let count = min(u32(frame.pillCount), MAX_PILLS);\r
  var best:  u32 = 0u;\r
  var bestD: f32 = 1e9;\r
  for (var i: u32 = 0u; i < count; i = i + 1u) {\r
    let pill  = frame.pills[i];\r
    let local = p - pill.center;\r
    let d     = abs(sdfWavyPlate(local, pill.halfSize, pill.edgeR));\r
    if (d < bestD) { bestD = d; best = i; }\r
  }\r
  return best;\r
}\r
\r
// (Diamond's \`diamondAnalyticHitScene\` lives in src/shaders/diamond.wgsl\r
// alongside sdfDiamond. The diamond-specific fs entry picks a hit through\r
// it directly — no back-trace reprojection picker is needed.)\r
\r
// Analytical back-face intersection for a rotated wavy plate. Same payoff as\r
// \`cubeAnalyticExit\`: replaces the per-wavelength \`insideTrace\` (up to 48 SDF\r
// evals) + finite-diff \`sceneNormal\` (6 SDF evals) with one slab intersection\r
// plus 3 Newton iterations for the Z-face refinement, so in N-sample Exact\r
// mode we save ~60× N SDF evals per fragment.\r
//\r
// Pipeline:\r
//   1. World → plate-local via \`frame.plateRot\`, same trick as cube.\r
//   2. Axis-aligned slab intersection over (halfXY, halfXY, halfZ) — identical\r
//      to cube except the box is asymmetric (thinner in Z).\r
//   3. Pick the earliest-exit axis. Most refracted rays exit through the\r
//      opposite Z face because the plate is thin relative to its face; side\r
//      exits only happen at steep grazing angles near the plate rim.\r
//   4. For a Z-face exit: Newton-refine t against the true wavy surface\r
//      z = faceSign·halfZ + waveZ(x, y). Converges in 3 steps from the flat\r
//      slab guess because the waveZ gradient magnitude is small (≤ amp·freq\r
//      ≈ 0.4 at defaults) — the fixed point is very close to the slab plane.\r
//   5. Normal on a wavy Z face is the gradient of z − faceSign·halfZ − waveZ:\r
//      \`(−faceSign·∂waveZ/∂x, −faceSign·∂waveZ/∂y, faceSign)\` normalized. For\r
//      X/Y face exits (flat) it's just the unit axis.\r
//   6. Local → world via transpose(plateRot). Return inward-facing normal.\r
fn plateAnalyticExit(roWorld: vec3<f32>, rdWorld: vec3<f32>, pillIdx: u32) -> CubeExit {\r
  let pill = frame.pills[pillIdx];\r
  // Plate forces a square face (y ≡ x), so override halfSize.y from the slot\r
  // that might still be carrying a pill/cube/plate preset value.\r
  let h = vec3<f32>(pill.halfSize.x, pill.halfSize.x, pill.halfSize.z);\r
\r
  let roL = frame.plateRot * (roWorld - pill.center);\r
  let rdL = frame.plateRot * rdWorld;\r
\r
  let rdInv = vec3<f32>(1.0) / rdL;\r
  let tHi   = (h - roL) * rdInv;\r
  let tLo   = (-h - roL) * rdInv;\r
  let tExitAxis = max(tHi, tLo);\r
\r
  var tExit: f32;\r
  var faceSign: f32;\r
  var axis: i32;\r
  if (tExitAxis.x <= tExitAxis.y && tExitAxis.x <= tExitAxis.z) {\r
    axis = 0;\r
    tExit = tExitAxis.x;\r
    faceSign = select(-1.0, 1.0, tHi.x >= tLo.x);\r
  } else if (tExitAxis.y <= tExitAxis.z) {\r
    axis = 1;\r
    tExit = tExitAxis.y;\r
    faceSign = select(-1.0, 1.0, tHi.y >= tLo.y);\r
  } else {\r
    axis = 2;\r
    tExit = tExitAxis.z;\r
    faceSign = select(-1.0, 1.0, tHi.z >= tLo.z);\r
  }\r
\r
  var pL    = roL + rdL * tExit;\r
  var nOutL = vec3<f32>(0.0);\r
\r
  if (axis == 0) {\r
    nOutL = vec3<f32>(faceSign, 0.0, 0.0);\r
  } else if (axis == 1) {\r
    nOutL = vec3<f32>(0.0, faceSign, 0.0);\r
  } else {\r
    // Z face: Newton-refine against the wavy surface. f(t) = pL.z − z*(pL.xy),\r
    // where z*(x, y) = faceSign·halfZ + amp·sin(kx+φ)·sin(ky+φ). Phase is\r
    // driven by scene time so it freezes with "Stop the world" instead of\r
    // drifting past the frozen rotation.\r
    let k     = frame.waveFreq;\r
    let amp   = frame.waveAmp;\r
    let phase = frame.sceneTime * 2.0;\r
    for (var i: i32 = 0; i < 3; i = i + 1) {\r
      let sx = sin(k * pL.x + phase);\r
      let sy = sin(k * pL.y + phase);\r
      let cx = cos(k * pL.x + phase);\r
      let cy = cos(k * pL.y + phase);\r
      let waveZ = amp * sx * sy;\r
      let dWdx  = amp * k * cx * sy;\r
      let dWdy  = amp * k * sx * cy;\r
      let f     = pL.z - faceSign * h.z - waveZ;\r
      let dfdt  = rdL.z - dWdx * rdL.x - dWdy * rdL.y;\r
      if (abs(f) < HIT_EPS * 0.1) { break; }         // already on the surface\r
      if (abs(dfdt) < 1e-4)       { break; }         // tangential — bail out\r
      tExit = tExit - f / dfdt;\r
      pL    = roL + rdL * tExit;\r
    }\r
    // Validate the refined pL is actually inside the plate's XY extent.\r
    // The slab pre-pick used the FLAT z slab (\`±h.z\`), but the real plate\r
    // surface is \`±h.z + waveZ(x, y)\`; at corner cases (grazing rays at\r
    // the plate's XY edges) the flat-Z \`tExit\` can win the axis race when\r
    // the true exit is through an X or Y face. Newton then refines pL\r
    // against a Z surface that doesn't apply at this XY, and pL ends up\r
    // outside the plate.\r
    //\r
    // Returning a zero-normal sentinel here makes \`refract(r1, vec3(0),\r
    // ior)\` collapse to (0,0,0) — the wavelength loop's \`r2TIR\` branch\r
    // catches that and falls back to the external reflection (\`reflSrc\`).\r
    // That's the same path real TIR takes, which is acceptable for a\r
    // back-exit corner case (the front-side \`plateCreaseAt\` gate already\r
    // catches most of these as bg fallbacks at the front-hit stage; this\r
    // post-Newton bail is the secondary defense for back-exit corners\r
    // that the front gate can miss). Most plate creases hit the front\r
    // gate first, so this path is rarely executed in practice.\r
    if (any(abs(pL.xy) > h.xy + vec2<f32>(HIT_EPS))) {\r
      let rotT   = transpose(frame.plateRot);\r
      let pWorld = rotT * pL + pill.center;\r
      return CubeExit(pWorld, vec3<f32>(0.0));\r
    }\r
    // Rebuild waveZ gradient at the refined pL for the normal.\r
    let sx = sin(k * pL.x + phase);\r
    let sy = sin(k * pL.y + phase);\r
    let cx = cos(k * pL.x + phase);\r
    let cy = cos(k * pL.y + phase);\r
    let dWdx = amp * k * cx * sy;\r
    let dWdy = amp * k * sx * cy;\r
    // Outward normal on the wavy Z face. Derivation: for the back face\r
    // (faceSign = -1), outward is (+∂waveZ/∂x, +∂waveZ/∂y, -1); for the front\r
    // face (faceSign = +1), outward is (-∂waveZ/∂x, -∂waveZ/∂y, +1). Combined:\r
    //   (−faceSign·∂waveZ/∂x, −faceSign·∂waveZ/∂y, faceSign).\r
    nOutL = normalize(vec3<f32>(-faceSign * dWdx, -faceSign * dWdy, faceSign));\r
  }\r
\r
  let rotT   = transpose(frame.plateRot);\r
  let pWorld = rotT * pL + pill.center;\r
  let nOut   = rotT * nOutL;\r
  return CubeExit(pWorld, -nOut);\r
}\r
`,Wo=`// ---------- spectral math ----------\r
\r
// Cauchy + Abbe number (glTF KHR_materials_dispersion formulation).\r
// Clamped to 1.0 because ior<1 breaks Snell direction via refract().\r
fn cauchyIor(lambda: f32, n_d: f32, V_d: f32) -> f32 {\r
  return max(n_d + (n_d - 1.0) / V_d * (523655.0 / (lambda * lambda) - 1.5168), 1.0);\r
}\r
\r
fn gLobe(lambda: f32, mu: f32, s1: f32, s2: f32) -> f32 {\r
  let sigma = select(s2, s1, lambda < mu);\r
  let t = (lambda - mu) / sigma;\r
  return exp(-0.5 * t * t);\r
}\r
\r
// Wyman-Sloan-Shirley (JCGT 2013) analytic CIE 1931 2° XYZ matching functions.\r
fn cieXyz(lambda: f32) -> vec3<f32> {\r
  let x =  0.362 * gLobe(lambda, 442.0, 16.0, 26.7)\r
        +  1.056 * gLobe(lambda, 599.8, 37.9, 31.0)\r
        -  0.065 * gLobe(lambda, 501.1, 20.4, 26.2);\r
  let y =  0.821 * gLobe(lambda, 568.8, 46.9, 40.5)\r
        +  0.286 * gLobe(lambda, 530.9, 16.3, 31.1);\r
  let z =  1.217 * gLobe(lambda, 437.0, 11.8, 36.0)\r
        +  0.681 * gLobe(lambda, 459.0, 26.0, 13.8);\r
  return vec3<f32>(x, y, z);\r
}\r
\r
// D65 XYZ → linear sRGB. WGSL mat3x3 is column-major, so each row of literals\r
// below is the column of the textbook matrix.\r
fn xyzToSrgb(c: vec3<f32>) -> vec3<f32> {\r
  let m = mat3x3<f32>(\r
     3.2404542, -0.9692660,  0.0556434,\r
    -1.5371385,  1.8760108, -0.2040259,\r
    -0.4985314,  0.0415560,  1.0572252,\r
  );\r
  return m * c;\r
}\r
\r
fn schlickFresnel(cosT: f32, n_d: f32) -> f32 {\r
  let f0 = pow((n_d - 1.0) / (n_d + 1.0), 2.0);\r
  let k  = 1.0 - clamp(cosT, 0.0, 1.0);\r
  return f0 + (1.0 - f0) * k * k * k * k * k;\r
}\r
\r
// Hash a 2D input to [0,1). Dave Hoskins' hash12, small-footprint + low bias\r
// enough for variance reduction (we're not doing security here).\r
fn hash21(p: vec2<f32>) -> f32 {\r
  var p3 = fract(vec3<f32>(p.xyx) * 0.1031);\r
  p3 = p3 + vec3<f32>(dot(p3, p3.yzx + vec3<f32>(33.33)));\r
  return fract((p3.x + p3.y) * p3.z);\r
}\r
`,jo=`// ---------- proxy vertex shader ----------\r
//\r
// Draws a per-pill 3D AABB (unit cube scaled to \`halfSize\`, optionally rotated\r
// for shape==cube). \`sdfPill\` / \`sdfCube\` fold rim radius into the field;\r
// their outer extent is \`halfSize\` (no extra proxy pad). The prism SDF is\r
// sharp and fits the same AABB, so the cube proxy is tight. Adding \`edgeR\`\r
// here was wrong for prisms and is no longer used in their SDF.\r
\r
// Unit cube, 36 verts (= CUBE_PROXY_VERT_COUNT from src/math/diamond.ts),\r
// 12 tris, CCW outward winding (so \`cullMode: 'back'\` leaves one invocation\r
// per covered pixel). The array size must match CUBE_PROXY_VERT_COUNT, which\r
// the pipeline.ts draw call and the maxVerts guard below also read from.\r
const CUBE_VERTS: array<vec3<f32>, CUBE_PROXY_VERT_COUNT> = array<vec3<f32>, CUBE_PROXY_VERT_COUNT>(\r
  // +X face (CCW outward: swap V1,V2 vs the other faces' pattern because the\r
  // outward normal flips sign of cross(E1, E2) when the face is on the +X side)\r
  vec3<f32>( 1.0,-1.0,-1.0), vec3<f32>( 1.0, 1.0, 1.0), vec3<f32>( 1.0,-1.0, 1.0),\r
  vec3<f32>( 1.0,-1.0,-1.0), vec3<f32>( 1.0, 1.0,-1.0), vec3<f32>( 1.0, 1.0, 1.0),\r
  // -X face\r
  vec3<f32>(-1.0,-1.0,-1.0), vec3<f32>(-1.0,-1.0, 1.0), vec3<f32>(-1.0, 1.0, 1.0),\r
  vec3<f32>(-1.0,-1.0,-1.0), vec3<f32>(-1.0, 1.0, 1.0), vec3<f32>(-1.0, 1.0,-1.0),\r
  // +Y face\r
  vec3<f32>(-1.0, 1.0,-1.0), vec3<f32>(-1.0, 1.0, 1.0), vec3<f32>( 1.0, 1.0, 1.0),\r
  vec3<f32>(-1.0, 1.0,-1.0), vec3<f32>( 1.0, 1.0, 1.0), vec3<f32>( 1.0, 1.0,-1.0),\r
  // -Y face\r
  vec3<f32>(-1.0,-1.0,-1.0), vec3<f32>( 1.0,-1.0,-1.0), vec3<f32>( 1.0,-1.0, 1.0),\r
  vec3<f32>(-1.0,-1.0,-1.0), vec3<f32>( 1.0,-1.0, 1.0), vec3<f32>(-1.0,-1.0, 1.0),\r
  // +Z face\r
  vec3<f32>(-1.0,-1.0, 1.0), vec3<f32>( 1.0,-1.0, 1.0), vec3<f32>( 1.0, 1.0, 1.0),\r
  vec3<f32>(-1.0,-1.0, 1.0), vec3<f32>( 1.0, 1.0, 1.0), vec3<f32>(-1.0, 1.0, 1.0),\r
  // -Z face\r
  vec3<f32>(-1.0,-1.0,-1.0), vec3<f32>(-1.0, 1.0,-1.0), vec3<f32>( 1.0, 1.0,-1.0),\r
  vec3<f32>(-1.0,-1.0,-1.0), vec3<f32>( 1.0, 1.0,-1.0), vec3<f32>( 1.0,-1.0,-1.0),\r
);\r
\r
// Perspective projection: a world point \`p\` seen through a pinhole camera at\r
// \`(cx, cy, cameraZ)\` looking down -Z, with the z=0 plane mapping to the\r
// screen exactly 1:1 in world pixels. A point at the screen plane projects to\r
// its own (x, y). A point closer to the camera than z=0 projects outward; a\r
// point beyond z=0 projects inward. The perspective divide is applied here in\r
// xy (not by the rasterizer), so the return always has w=1 for in-front\r
// vertices; w=-1 is used as a near-plane sentinel that the rasterizer clips.\r
fn projectWorld(p: vec3<f32>) -> vec4<f32> {\r
  let persp = frame.projection > 0.5;\r
  let camXY = frame.resolution * 0.5;\r
\r
  var uv: vec2<f32>;\r
  if (persp) {\r
    let dz = frame.cameraZ - p.z;\r
    // \`dz <= 0\` means the vertex is at or behind the camera. Return w=-1 so\r
    // WebGPU's near-plane clipper drops the vertex; legitimate front-facing\r
    // vertices with tiny-but-positive dz still rasterize (threshold used to\r
    // be 1.0 which incorrectly clipped near-camera proxy corners at wide FOV).\r
    if (dz <= 0.0) {\r
      return vec4<f32>(0.0, 0.0, 0.0, -1.0);\r
    }\r
    uv = (p.xy - camXY) * (frame.cameraZ / dz) + camXY;\r
  } else {\r
    uv = p.xy;\r
  }\r
  let ndcX = 2.0 * uv.x / frame.resolution.x - 1.0;\r
  let ndcY = 1.0 - 2.0 * uv.y / frame.resolution.y;\r
  return vec4<f32>(ndcX, ndcY, 0.5, 1.0);\r
}\r
\r
// Project a world point to screen-space pixel coordinates using the same\r
// pinhole model as projectWorld() but returning pixel units directly (no NDC\r
// flip). The z component carries a validity flag: > 0 = in front of camera,\r
// <= 0 = behind / at camera. Used by reprojectHit() below — the NDC return\r
// shape of projectWorld is awkward for "did this reprojection land inside\r
// the history texture?" checks.\r
fn worldToScreenPx(p: vec3<f32>) -> vec3<f32> {\r
  let camXY = frame.resolution * 0.5;\r
  if (frame.projection > 0.5) {\r
    let dz = frame.cameraZ - p.z;\r
    if (dz <= 0.0) {\r
      return vec3<f32>(0.0, 0.0, -1.0);\r
    }\r
    let px = (p.xy - camXY) * (frame.cameraZ / dz) + camXY;\r
    return vec3<f32>(px.x, px.y, 1.0);\r
  }\r
  return vec3<f32>(p.x, p.y, 1.0);\r
}\r
\r
// TAA motion-vector reprojection. Given a world-space hit point on a rotating\r
// shape AND the unjittered fragment coordinate it came from, returns the\r
// screen UV where that SAME point on the shape was one frame ago — so the\r
// history read tracks the rotating surface instead of smearing stale\r
// neighbouring pixels into the output.\r
//\r
// Cube / plate both cache their previous rotation as a uniform (\`cubeRotPrev\`\r
// / \`plateRotPrev\`), so the math is: world → local (current rotation) → world\r
// (previous rotation) → screen. pill / prism don't rotate, so their hit\r
// point's prev screen position is just the current one — the caller passes\r
// in \`fallbackUv\` and we return it untouched (modulo the out-of-bounds check\r
// below, which catches disocclusion at the screen edge).\r
//\r
// Critical detail: \`hitWorld\` came from a JITTERED ray, so its raw screen\r
// projection isn't pixel-aligned. Using \`projection(prevWorld) / resolution\`\r
// directly would shift the history read by a fresh sub-pixel offset every\r
// frame, and bilinear filtering would compound a fractional-pixel blur into\r
// the history with each accumulation step (visible as "super blurry plates"\r
// when long-pause progressive averaging drives α toward 0).\r
//\r
// The fix below is the standard TAA technique: compute the motion DELTA in\r
// screen pixels (jitter cancels because it's present in both the current and\r
// previous projections) and add it to the unjittered FRAGCOORD. Static scenes\r
// then read history at exactly the pixel centre — no bilinear blur — and\r
// moving scenes still get the correct motion-corrected sample.\r
fn reprojectHit(hitWorld: vec3<f32>, fragCoord: vec2<f32>, pillIdx: u32, shapeId: i32, fallbackUv: vec2<f32>) -> vec2<f32> {\r
  var prevWorld = hitWorld;\r
  if (shapeId == 2) {\r
    let pill  = frame.pills[pillIdx];\r
    let local = frame.cubeRot * (hitWorld - pill.center);\r
    prevWorld = transpose(frame.cubeRotPrev) * local + pill.center;\r
  } else if (shapeId == 3) {\r
    let pill  = frame.pills[pillIdx];\r
    let local = frame.plateRot * (hitWorld - pill.center);\r
    prevWorld = transpose(frame.plateRotPrev) * local + pill.center;\r
  } else if (shapeId == 4) {\r
    // Diamond: same trick as cube/plate. The fold inside sdfDiamond is a\r
    // non-linear symmetry operation, but reprojection only cares about the\r
    // surface's rigid-body motion (rotation + translation), which \`diamondRot\`\r
    // captures fully. Reading history via \`transpose(diamondRotPrev)\` pulls\r
    // each spinning facet's own pixel from the previous frame.\r
    let pill  = frame.pills[pillIdx];\r
    let local = frame.diamondRot * (hitWorld - pill.center);\r
    prevWorld = transpose(frame.diamondRotPrev) * local + pill.center;\r
  }\r
\r
  let prevPx = worldToScreenPx(prevWorld);\r
  let currPx = worldToScreenPx(hitWorld);\r
  // Behind-camera fallback: if the rotation moved the hit point through the\r
  // near plane between frames (rare — needs a fast tumble + perspective\r
  // mode), there's no meaningful history pixel to reproject from. Falling\r
  // back to \`fallbackUv\` reads stale history at the current pixel; under\r
  // the steady-state α = 0.2 EMA that washes out in ~5 frames. The pause\r
  // path can't hit this because plateRot == plateRotPrev when paused, so\r
  // the reprojection collapses to identity and prevPx == currPx — safe.\r
  if (prevPx.z <= 0.0 || currPx.z <= 0.0) { return fallbackUv; }\r
\r
  // \`currPx\` carries the sub-pixel jitter of the original ray, and\r
  // \`prevPx\` is the SAME world point reprojected to the previous frame's\r
  // camera — both share that jitter, so it cancels in the delta to first\r
  // order. Strictly the perspective divide is non-linear in p.z, so there's\r
  // a residual of order (jitter × per-frame rotation × perspective factor),\r
  // ≤ 0.5 px × ≈ 0.005 rad ≈ < 0.01 px at typical FOVs — well below the\r
  // pixel grid, invisible after EMA. (Adding to the unjittered \`fragCoord\`\r
  // — not to \`currPx\` — is the part that actually pins the read to the\r
  // pixel grid for static scenes.)\r
  let motionPx = prevPx.xy - currPx.xy;\r
  let prevUv   = (fragCoord + motionPx) / frame.resolution;\r
  // Disocclusion: the point was outside the screen a frame ago. Same\r
  // fallback strategy — read stale and let EMA fade in fresh data.\r
  if (any(prevUv < vec2<f32>(0.0)) || any(prevUv > vec2<f32>(1.0))) {\r
    return fallbackUv;\r
  }\r
  return prevUv;\r
}\r
\r
struct ProxyVsOut {\r
  @builtin(position) pos: vec4<f32>,\r
  @location(0) @interpolate(flat) instanceIdx: u32,\r
};\r
\r
@vertex\r
fn vs_proxy(\r
  @builtin(vertex_index)   vi: u32,\r
  @builtin(instance_index) ii: u32,\r
) -> ProxyVsOut {\r
  var out: ProxyVsOut;\r
  if (ii >= u32(frame.pillCount)) {\r
    // Over pillCount → degenerate position so the triangle is clipped.\r
    out.pos = vec4<f32>(2.0, 2.0, 0.5, 1.0);\r
    out.instanceIdx = 0u;\r
    return out;\r
  }\r
  let pill    = frame.pills[ii];\r
  let shapeId = i32(frame.shape + 0.5);\r
\r
  // Per-shape vertex budget: CUBE_PROXY_VERT_COUNT for cube/pill/prism/plate\r
  // (the CUBE_VERTS array size above), DIAMOND_PROXY_VERT_COUNT for diamond.\r
  // Both constants are injected from src/math/diamond.ts so the draw call\r
  // (pipeline.ts), this guard, and the CUBE_VERTS array literal all track\r
  // the same TS numbers. A Phase B mesh change updates the TS constants\r
  // (or, for diamond, the mesh body in diamond.wgsl) — the guard and draw\r
  // count follow automatically. The guard prevents CUBE_VERTS out-of-bounds\r
  // access for non-diamond shapes when vi ≥ CUBE_PROXY_VERT_COUNT; past\r
  // DIAMOND_PROXY_VERT_COUNT the diamond branch has no valid vertex either.\r
  let maxVerts = select(CUBE_PROXY_VERT_COUNT, DIAMOND_PROXY_VERT_COUNT, shapeId == 4);\r
  if (vi >= maxVerts) {\r
    out.pos = vec4<f32>(2.0, 2.0, 0.5, 1.0);\r
    out.instanceIdx = ii;\r
    return out;\r
  }\r
\r
  // Unit cube corner in [-1, 1]^3 → local AABB \`±halfSize\`. Matches the\r
  // true shape's outer bounds; \`edgeR\` must not be added (see file header).\r
  var corner: vec3<f32>;\r
  if (shapeId == 3) {\r
    // Plate: box sized to the square face + wave-amplitude margin on the Z\r
    // (thickness) axis so the rippling midsurface never pokes through. Then\r
    // apply the plate's current rotation so the proxy tracks the tumble —\r
    // same tight-bounding trick as the cube path below.\r
    let extent = vec3<f32>(pill.halfSize.x,\r
                           pill.halfSize.x,\r
                           pill.halfSize.z + frame.waveAmp);\r
    corner = transpose(frame.plateRot) * (CUBE_VERTS[vi] * extent);\r
  } else if (shapeId == 4) {\r
    // Diamond: exact convex-hull proxy mesh (DIAMOND_PROXY_VERT_COUNT\r
    // vertices = 46 triangles — see diamondProxyVertex in diamond.wgsl\r
    // for the topology breakdown). The split keeps the geometry details\r
    // next to sdfDiamond where future diamond-only trace work can land.\r
    //\r
    // vi < DIAMOND_PROXY_VERT_COUNT is guaranteed by the maxVerts guard\r
    // at the top of vs_proxy.\r
    let local = diamondProxyVertex(vi, frame.diamondSize);\r
    corner    = transpose(frame.diamondRot) * local;\r
  } else {\r
    let extent = pill.halfSize;\r
    corner     = CUBE_VERTS[vi] * extent;\r
    if (shapeId == 2) {\r
      // The shader defines the cube via \`local = rot * (p - center)\`, so a\r
      // world-space proxy corner that maps to the unit-cube local-space\r
      // corner \`c\` is \`center + transpose(rot) * (c * extent)\`.\r
      corner = transpose(frame.cubeRot) * corner;\r
    }\r
  }\r
  out.pos = projectWorld(pill.center + corner);\r
  out.instanceIdx = ii;\r
  return out;\r
}\r
`,Go=`// ---------- fragment ----------\r
\r
struct FsOut {\r
  @location(0) color:   vec4<f32>,\r
  @location(1) history: vec4<f32>,\r
};\r
\r
struct ProxyFsIn {\r
  @builtin(position) fragCoord: vec4<f32>,\r
  @location(0) @interpolate(flat) instanceIdx: u32,\r
};\r
\r
// Cheap background pass: sample photo, blend history, done. No sphere-trace,\r
// no refraction, no per-wavelength loop. Runs for the whole screen; the proxy\r
// pass then overrides covered pixels with the heavy shader's output.\r
@fragment\r
fn fs_bg(@builtin(position) fragCoord: vec4<f32>) -> FsOut {\r
  let uv    = fragCoord.xy / frame.resolution;\r
  // Match fs_main's bg source: envmap when enabled (unified scene),\r
  // Picsum photo otherwise. Rebuild the per-pixel view ray matching\r
  // fs_main's construction — MINUS the sub-pixel TAA jitter. fs_bg is\r
  // a single fullscreen pass with no per-sample accumulation, so\r
  // jitter would just add temporal noise to the sky without aiding\r
  // convergence; the proxy fragments that DO need jitter sit inside\r
  // the silhouette and are shaded by fs_main instead. The small\r
  // sub-pixel offset at the silhouette edge is invisible because the\r
  // proxy pass overwrites those pixels anyway.\r
  let bgPhoto = textureSampleLevel(photoTex, photoSmp, coverUv(uv), 0.0).rgb;\r
  var rdBg: vec3<f32>;\r
  if (frame.projection > 0.5) {\r
    let roP = vec3<f32>(frame.resolution * 0.5, frame.cameraZ);\r
    rdBg = normalize(vec3<f32>(fragCoord.xy, 0.0) - roP);\r
  } else {\r
    rdBg = vec3<f32>(0.0, 0.0, -1.0);\r
  }\r
  let bgEnv = sampleEnvmap(rdBg);\r
  let bg    = select(bgPhoto, bgEnv, frame.envmapEnabled > 0.5);\r
  let prev  = textureSampleLevel(historyTex, historySmp, uv, 0.0).rgb;\r
  let blend = mix(prev, bg, frame.historyBlend);\r
  var o: FsOut;\r
  o.color   = vec4<f32>(blend, 1.0);\r
  o.history = vec4<f32>(blend, 1.0);\r
  return o;\r
}\r
\r
// Karis-2014-style single-tap variance clamp + EMA blend. When the new\r
// sample disagrees with history (large \`diff\`) the effective alpha is\r
// pushed toward 1.0 so the new sample dominates — kills motion ghost on\r
// rotating refractive shapes. Gated by historyBlend so paused-scene\r
// progressive averaging (\`α = max(1/n, 1/256)\` → 0) stays unfaded.\r
//\r
// Used by both the bg-fallback path (for hit↔miss transitions at\r
// silhouettes) and the hit-path EMA at the end of fs_main.\r
fn adaptiveBlend(prev: vec3<f32>, next: vec3<f32>) -> vec3<f32> {\r
  let diff  = length(next - prev);\r
  let gate  = smoothstep(0.05, 0.15, frame.historyBlend);\r
  let mixT  = gate * smoothstep(0.05, 0.30, diff);\r
  let alpha = mix(frame.historyBlend, 1.0, mixT);\r
  return mix(prev, next, alpha);\r
}\r
\r
fn proxyBgOut(uv: vec2<f32>, bg: vec3<f32>) -> FsOut {\r
  var bgFinal = bg;\r
  if (frame.debugProxy > 0.5) {\r
    bgFinal = mix(bg, vec3<f32>(1.0, 0.3, 0.7), 0.5);\r
  }\r
\r
  let prevMiss = textureSampleLevel(historyTex, historySmp, uv, 0.0).rgb;\r
  let blend    = adaptiveBlend(prevMiss, bgFinal);\r
  var out: FsOut;\r
  out.color   = vec4<f32>(blend, 1.0);\r
  out.history = vec4<f32>(blend, 1.0);\r
  return out;\r
}\r
\r
// Per-stratum spatial/temporal noise for the wavelength loop. The host writes\r
// \`frame.jitter\` to the \`SPECTRAL_JITTER_DISABLED\` sentinel (-1; defined in\r
// \`src/spectralSampling.ts\`) when **Temporal jitter** is off — we treat any\r
// negative value as the off signal and return 0 so every pixel samples the\r
// stratum centre, making the toggle visibly stop fizzling at high \`sampleCount\`.\r
fn spectralStratumJitter(px: vec2<f32>, jitter: f32) -> f32 {\r
  if (jitter < 0.0) {\r
    return 0.0;\r
  }\r
  return hash21(px + vec2<f32>(jitter * 1000.0, frame.time * 37.0)) - 0.5;\r
}\r
\r
// Back-face exit dispatcher. Centralises the entry-bias trick (push the\r
// front-hit point one MIN_STEP inward along the refracted ray so the\r
// analytic exits' slab math doesn't divide 0/0 → silent wrong-axis pick →\r
// edge speckle) plus the cube/plate/other dispatch — both used by the\r
// hero-mode shared trace and the per-wavelength loop.\r
fn backExit(hitP: vec3<f32>, r1: vec3<f32>, shapeId: i32, pillIdx: u32, internalMax: f32) -> CubeExit {\r
  let roEntry = hitP + r1 * MIN_STEP;\r
  if (shapeId == 0) { return pillAnalyticExit(roEntry, r1, pillIdx); }\r
  if (shapeId == 1) { return prismAnalyticExit(roEntry, r1, pillIdx); }\r
  if (shapeId == 2) { return cubeAnalyticExit(roEntry, r1, pillIdx); }\r
  if (shapeId == 3) { return plateAnalyticExit(roEntry, r1, pillIdx); }\r
  // Phase B: diamond uses an analytical polytope exit + short TIR chain (≤3\r
  // bounces, wired in the wavelength loop below). The analytical normal eliminates\r
  // the finite-diff gradient degeneracy at facet edges that previously\r
  // sent TIR fallback to \`reflSrc\` and produced the "sudden face\r
  // appearing" tumble artifact.\r
  if (shapeId == 4) { return diamondAnalyticExit(roEntry, r1, pillIdx); }\r
  let pExit = insideTrace(hitP, r1, internalMax);\r
  return CubeExit(pExit, -sceneNormal(pExit));\r
}\r
\r
@fragment\r
fn fs_main(in: ProxyFsIn) -> FsOut {\r
  // DOM-top-origin pixel coords so they match pointer events and defaultPills.\r
  let px = in.fragCoord.xy;\r
  let uv = px / frame.resolution;\r
\r
  // Temporal antialiasing: jitter the ray's sub-pixel position by a\r
  // per-frame-decorrelated vector in [-0.5, 0.5)², and let the history EMA\r
  // average the shifted samples. The fragment still writes to the\r
  // unjittered fragCoord, so history reads/writes use \`uv\` as-is — only\r
  // ray generation and sampling-along-the-ray see the jittered position.\r
  // Handles the shape silhouette (decided inside this shader by\r
  // sphere-trace hit/miss, which MSAA can't touch) AND smooths any\r
  // wave/refraction texture aliasing for free. Steady-state α = 0.2 =>\r
  // full convergence in ~5 frames; imperceptible ghost for slow tumble,\r
  // only noticeable on fast drags.\r
  var rayPx = px;\r
  if (frame.taaEnabled > 0.5) {\r
    let taaJit = vec2<f32>(\r
      hash21(px + vec2<f32>(frame.time * 7.19, 3.141)) - 0.5,\r
      hash21(px + vec2<f32>(frame.time * 11.23, 6.283)) - 0.5,\r
    );\r
    rayPx = px + taaJit;\r
  }\r
\r
  // Ortho: parallel rays going -Z, origin just above the scene volume.\r
  // Perspective: rays diverge from the camera through each screen pixel,\r
  // hitting the z=0 screen plane exactly at (rayPx.x, rayPx.y, 0). FOV is\r
  // encoded in cameraZ (smaller = wider FOV).\r
  var ro: vec3<f32>;\r
  var rd: vec3<f32>;\r
  if (frame.projection > 0.5) {\r
    ro = vec3<f32>(frame.resolution * 0.5, frame.cameraZ);\r
    rd = normalize(vec3<f32>(rayPx, 0.0) - ro);\r
  } else {\r
    ro = vec3<f32>(rayPx, 400.0);\r
    rd = vec3<f32>(0.0, 0.0, -1.0);\r
  }\r
  // One upper bound that works for both projections: a ray can't travel\r
  // further than the camera-to-far-plane distance in the scene.\r
  let maxT = 2.0 * max(frame.cameraZ, 400.0) + 400.0;\r
  let h    = sphereTrace(ro, rd, maxT);\r
  // Background source: when envmap is enabled, sample the HDR panorama\r
  // in the VIEW direction (rd) so bg, reflection, AND refraction all\r
  // read from the same unified environment — the scene reads as a\r
  // diamond floating in a real studio/outdoor space instead of a\r
  // diamond pasted on top of an unrelated Picsum photo. Legacy photo\r
  // sampling path preserved for A/B comparison and for when the user\r
  // disables envmap entirely.\r
  let bgPhoto  = textureSampleLevel(photoTex, photoSmp, coverUv(uv), 0.0).rgb;\r
  let bgEnv    = sampleEnvmap(rd);\r
  let bg       = select(bgPhoto, bgEnv, frame.envmapEnabled > 0.5);\r
\r
  // Helper for the "render as background" path — used for miss, for hits\r
  // whose front normal came out degenerate, and for the no-data fallback at\r
  // the end of the hit path. Wraps the bg sample in \`adaptiveBlend\` so a\r
  // pixel transitioning from hit-path refraction to bg also gets the same\r
  // variance clamp the hit path uses (without it, 20% of stale refraction\r
  // colour bleeds into each frame's blend → visible silhouette flicker).\r
  // \`frame.debugProxy\` tints these pixels pink so the proxy over-coverage\r
  // halo is visible in the UI's "Show proxy" mode.\r
  // (kept inline rather than a helper because it returns from fs_main; WGSL\r
  // can't early-return from a callee.)\r
\r
  let shapeId   = i32(frame.shape + 0.5);\r
  let isPill    = shapeId == 0;\r
  let isPrism   = shapeId == 1;\r
  let isCube    = shapeId == 2;\r
  let isPlate   = shapeId == 3;\r
  // Diamond (shapeId == 4) is dispatched to \`fs_main_diamond\` via the\r
  // \`diamondProxy\` pipeline (see encodeScene in src/webgpu/pipeline.ts),\r
  // so it never reaches \`fs_main\`. No \`isDiamond\` branches here.\r
  //\r
  // \`hasMotionPivot\` gates the TAA reprojection call below: a shape needs\r
  // a per-frame rotation uniform (cubeRot / plateRot) for reprojection to\r
  // make sense. (Diamond has its own motion-pivot path inside\r
  // \`fs_main_diamond\`.)\r
  let hasMotionPivot  = isCube || isPlate;\r
\r
  // Bg-fallback short-circuit. Run BEFORE \`sceneNormal\` because WGSL \`select\`\r
  // evaluates both arms — wrapping \`sceneNormal(h.p)\` in select(_, _, h.ok)\r
  // would still cost 6 SDF evals per miss pixel, and the proxy mesh\r
  // intentionally over-covers the silhouette so misses are common.\r
  if (!h.ok) {\r
    return proxyBgOut(uv, bg);\r
  }\r
\r
  // Hit path. Pill-index scan is per-shape; gated on h.ok above so misses\r
  // skip it entirely. (Diamond's instanceIdx dispatch lives in\r
  // \`fs_main_diamond\` — it never reaches this \`fs_main\` path.)\r
  var analyticIdx: u32 = 0u;\r
  if      (isPill)    { analyticIdx = hitPillPillIdx(h.p); }\r
  else if (isPrism)   { analyticIdx = hitPrismPillIdx(h.p); }\r
  else if (isCube)    { analyticIdx = hitCubePillIdx(h.p); }\r
  else if (isPlate)   { analyticIdx = hitPlatePillIdx(h.p); }\r
\r
  // \`sceneNormal\` returns the zero vector when the local gradient is too\r
  // small to normalise (silhouette / wave-crest singularity). Falling back\r
  // to an arbitrary normal would produce visible-but-wrong refraction\r
  // colours; routing those pixels through the bg path instead lets them\r
  // blend cleanly with the silhouette neighbourhood.\r
  var nFront: vec3<f32>;\r
  if (isPill) {\r
    nFront = sceneNormalPill(h.p, analyticIdx);\r
  } else if (isPrism) {\r
    nFront = sceneNormalPrism(h.p, analyticIdx);\r
  } else {\r
    nFront = sceneNormal(h.p);\r
  }\r
  if (dot(nFront, nFront) <= 0.5) {\r
    return proxyBgOut(uv, bg);\r
  }\r
\r
  let n_d      = frame.n_d;\r
  let V_d      = frame.V_d;\r
  let N        = clamp(i32(frame.sampleCount), 1, MAX_N);\r
  let strength = frame.refractionStrength;\r
  let jitter   = frame.jitter;\r
  let useHero  = frame.refractionMode > 0.5;\r
\r
  // Cap the inside-trace at the longest possible chord through the largest\r
  // pill in the scene. Thick configurations would otherwise bail out mid-body.\r
  let internalMax = maxInternalPath();\r
\r
  // Hero mode: one back-face trace at a PER-FRAME-RANDOMIZED wavelength\r
  // (Wilkie 2014). Unlike plain "approx" fixed at 540 nm, the randomization +\r
  // temporal history accumulation averages out the single-trace error across\r
  // ~5 frames — so 4–8 samples in Hero mode look like 16–32 samples in Exact.\r
  var sharedExit  = h.p;\r
  var sharedNBack = -nFront;\r
  if (useHero) {\r
    let iorHero = cauchyIor(frame.heroLambda, n_d, V_d);\r
    let r1hero  = refract(rd, nFront, 1.0 / iorHero);\r
    // Entry TIR — leave sharedExit / sharedNBack at their defaults\r
    // (h.p, -nFront) so the wavelength loop falls through to the reflection\r
    // path via Fresnel. Practically this can't fire today (cauchyIor clamps\r
    // ior >= 1.0 and the entry is vacuum→glass), but both back-trace branches\r
    // would misbehave with r1hero ≈ 0: cube/plateAnalyticExit divide by rdL\r
    // and would emit NaN, insideTrace would stall with no forward progress.\r
    if (dot(r1hero, r1hero) >= 1e-4) {\r
      let ex = backExit(h.p, r1hero, shapeId, analyticIdx, internalMax);\r
      sharedExit  = ex.pWorld;\r
      sharedNBack = ex.nBack;\r
    }\r
  }\r
\r
  // External front-face reflection — used BOTH as TIR fallback and as the\r
  // per-wavelength reflection color (mixed via per-λ Fresnel below).\r
  // Falls back to the local bg when the reflected UV lands outside the\r
  // photo (the sampler is mirror-repeat — see photo.ts — and an OOB\r
  // reflUv would mirror back to a visually-unrelated photo region,\r
  // matching the UV-OOB symptom we already guard against on the\r
  // refraction sample below). Bg is the same colour the miss-path\r
  // neighbours render, so silhouette TIR pixels blend cleanly.\r
  // Refraction / reflection UV base: the pixel's own screen UV. Adding\r
  // the DEVIATION \`(out_ray - rd).xy\` (rather than \`out_ray.xy\`) makes\r
  // non-refracting configurations collapse to the miss-path sample —\r
  // critical for perspective, where \`rd.xy != 0\` away from the optical\r
  // axis so \`out_ray.xy * strength\` gave a spurious offset even for a\r
  // plate facing straight at the camera (visible as a slightly shrunk\r
  // bg inside the glass). \`(refl - rd).xy\` / \`(r2 - rd).xy\` isolate the\r
  // optical bend itself; refraction strength now scales only the bend.\r
  let refl = reflect(rd, nFront);\r
  // Two source strategies for the reflection colour:\r
  //   Phase A legacy: sample the BACKGROUND photo at a UV offset along\r
  //     the reflection vector. Cheap, looks "reflective" at first glance,\r
  //     but physically wrong — the reflection should depend on the\r
  //     ENVIRONMENT direction, not on a shifted view of the thing BEHIND\r
  //     the glass. Produces the "same photo slightly shifted" artefact\r
  //     that looks like mis-refraction at glancing angles.\r
  //   Phase C envmap: sample a linear HDR panorama at the reflection\r
  //     direction. Real reflections of a real environment; drives the\r
  //     Fresnel highlight with bright sky/studio-light HDR peaks which\r
  //     is what makes diamonds actually sparkle.\r
  // Gate by \`frame.envmapEnabled\` so a user can toggle between the two\r
  // for A/B comparison and so the startup frame (before the real HDRI\r
  // arrives) falls back gracefully to the legacy path.\r
  let reflUv     = uv + (refl - rd).xy * 0.2;\r
  let reflCover  = coverUv(reflUv);\r
  let reflInBnds = all(reflCover >= vec2<f32>(0.0)) && all(reflCover <= vec2<f32>(1.0));\r
  let reflRaw    = textureSampleLevel(photoTex, photoSmp, reflCover, 0.0).rgb;\r
  let reflLegacy = select(bg, reflRaw, reflInBnds) * vec3<f32>(0.85, 0.9, 1.0);\r
  let reflSrc    = select(reflLegacy, sampleEnvmap(refl), frame.envmapEnabled > 0.5);\r
\r
  // Front-face cosine (angle of incidence). Identical for every wavelength at\r
  // the front face, so compute once.\r
  let cosT = max(dot(-rd, nFront), 0.0);\r
\r
  // Texture-footprint LOD for the per-wavelength photo sample below. Two\r
  // regimes cause the refracted-UV Jacobian w.r.t. screen pixels to spike,\r
  // each driving a separate term:\r
  //\r
  //   (A) Grazing incidence — d(uv)/d(px) scales as ~1/cosT. Captured by\r
  //       \`-log2(cosT)\`. The -1.0 bias keeps level 0 active for cosT >= 0.5\r
  //       so normal viewing stays sharp.\r
  //\r
  //   (B) Rounded-edge normal turn — on the cube/plate's rounded rim the\r
  //       surface normal rotates ~90° across the rim's ~edgeR-wide footprint\r
  //       in screen space. Per-pixel δn there is large, and refract's\r
  //       Jacobian amplifies that into a big δuv even at moderate cosT.\r
  //       Detect by transforming nFront into the shape's local frame (where\r
  //       flat faces align with one axis) and measuring tilt via the\r
  //       complement of the largest |axis component|: flat face → 0, rim\r
  //       edge → ~0.29, corner → ~0.42. Multiply by 8 for a ~2.3 LOD boost\r
  //       at mid-rim — enough to suppress the sparkle while leaving flat\r
  //       faces untouched. Plate's wavy ±Z faces also pick up a small tilt\r
  //       that softens their own mild refraction aliasing.\r
  //\r
  // Pill / prism don't participate in (B) — their silhouettes are either\r
  // flat faces or continuous quadric curves that (A) already handles.\r
  //\r
  // Clamp 6.0 caps the LOD at roughly mip-6 — ~30 px wide on a 1920x1080\r
  // photo, ~4 px on the 256² gradient fallback. Further blurring stops\r
  // adding AA benefit and just washes the refraction color to an average.\r
  var curvatureTilt: f32 = 0.0;\r
  if (isCube) {\r
    let nLocal    = frame.cubeRot * nFront;\r
    curvatureTilt = 1.0 - max(max(abs(nLocal.x), abs(nLocal.y)), abs(nLocal.z));\r
  } else if (isPlate) {\r
    let nLocal    = frame.plateRot * nFront;\r
    curvatureTilt = 1.0 - max(max(abs(nLocal.x), abs(nLocal.y)), abs(nLocal.z));\r
  }\r
  let photoLod = clamp(-log2(max(cosT, 0.02)) - 1.0 + curvatureTilt * 8.0, 0.0, 6.0);\r
\r
  // Per-pixel stratified jitter: each pixel gets its own wavelength phase so\r
  // adjacent pixels sample DIFFERENT λ. The eye (and post-process history\r
  // accumulation) averages the spatial noise, so the rainbow looks smooth at\r
  // a given N — effectively 2-4× more samples worth of quality for free.\r
  // \`jitter\` is a per-frame random offset (host-side Math.random()/N); using\r
  // it as part of the hash seed decorrelates the stratum choice across\r
  // frames so history accumulates new samples instead of locking on.\r
  //\r
  // Shift hash output from [0,1) to [-0.5, 0.5) so the jitter is SIGNED around\r
  // the stratum center. With t = (i + 0.5 + pxJit)/N that keeps every sample\r
  // inside its own stratum [i/N, (i+1)/N) — critically, the i=N-1 sample\r
  // cannot spill past t=1 into invisible λ > 700nm. Without this shift, at\r
  // N=3 about a third of pixels lose their red-end sample (CMF≈0 at 720-753\r
  // nm), rgbWeight.b drops to zero there, and the renormaliser flips a white\r
  // background pixel to yellow.\r
  //\r
  // When **Temporal jitter** is off the host writes \`SPECTRAL_JITTER_DISABLED\`\r
  // (-1) and \`spectralStratumJitter\` returns 0, so \`t\` lands at every stratum's\r
  // exact centre — the on/off difference becomes visible instead of being\r
  // washed out by per-pixel hash.\r
  let pxJit = spectralStratumJitter(px, jitter);\r
\r
  // For each wavelength λ:\r
  //   1. compute per-λ IOR via Cauchy\r
  //   2. refract into the glass\r
  //   3. find the back-face exit point + inward normal (skipped in Approx\r
  //      mode — reuses sharedExit/sharedNBack):\r
  //        pill  → pillAnalyticExit  (AABB slab + sdfPill / sdfPillGrad)\r
  //        prism → prismAnalyticExit (AABB slab + sdfPrism / sdfPrismGrad)\r
  //        cube  → cubeAnalyticExit  (O(1) slab + rounded-box gradient)\r
  //        plate → plateAnalyticExit (O(1) slab + Newton-refined wavy Z face)\r
  //        diam. → diamondAnalyticExit\r
  //   4. refract out\r
  //   5. sample photo at the exit UV; TIR → reflection color instead\r
  //   6. PER-WAVELENGTH Fresnel mix between refract and reflect (blue λ has\r
  //      higher IOR → higher Fresnel → more reflective at rim, produces the\r
  //      visible blue-tinged rim we see in real prisms and diamonds)\r
  //   7. weight by xyzToSrgb(cmf(λ)) and accumulate\r
  var rgbAccum  = vec3<f32>(0.0);\r
  var rgbWeight = vec3<f32>(0.0);\r
\r
  for (var i: i32 = 0; i < N; i = i + 1) {\r
    let t      = (f32(i) + 0.5 + pxJit) / f32(N);\r
    let lambda = mix(380.0, 700.0, t);\r
    let ior    = cauchyIor(lambda, n_d, V_d);\r
    let r1     = refract(rd, nFront, 1.0 / ior);\r
    if (dot(r1, r1) < 1e-4) { continue; }  // TIR on entry (shouldn't fire for vacuum→denser)\r
\r
    var pExit = sharedExit;\r
    var nBack = sharedNBack;\r
    if (!useHero) {\r
      let ex = backExit(h.p, r1, shapeId, analyticIdx, internalMax);\r
      pExit = ex.pWorld;\r
      nBack = ex.nBack;\r
    }\r
    let r2 = refract(r1, nBack, ior);\r
\r
    var refractL: vec3<f32>;\r
    // Bad-r2 gate covers three failure modes that all produce single-pixel\r
    // speckles along plate edges if left to fall through:\r
    //   1. Real TIR — refract returned (0,0,0) because k < 0. Standard.\r
    //   2. NaN r2 — happens when nBack came out NaN-ish from a corner-case\r
    //      back exit. WGSL's \`<\` against NaN is always false, so we add an\r
    //      explicit \`r2dot != r2dot\` self-comparison to catch it.\r
    //   3. The refracted UV would land outside the photo's [0, 1] range.\r
    //      The sampler is mirror-repeat (see photo.ts), so a wildly-off\r
    //      UV folds back to an unrelated photo region: bright photo\r
    //      content there → white speckle, dark there → black.\r
    //\r
    // For #2 and #3 we substitute the LOCAL bg sample (the photo at this\r
    // fragment's own pixel position) — that's the same colour the miss\r
    // path / silhouette neighbours render, so the bad pixel blends into\r
    // the surrounding silhouette instead of sticking out as either a\r
    // bright reflection sample or a wrong-photo-region speckle. For real\r
    // TIR (#1) we still use the external reflection because it's the\r
    // physically-correct response, even if it can be visually noisy.\r
    let uvOff       = uv + (r2 - rd).xy * strength;\r
    let uvCover     = coverUv(uvOff);\r
    let uvInBounds  = all(uvCover >= vec2<f32>(0.0)) && all(uvCover <= vec2<f32>(1.0));\r
    let r2dot       = dot(r2, r2);\r
    let r2NaN       = r2dot != r2dot;\r
    let r2TIR       = r2dot < 1e-4 && !r2NaN;\r
    let r2OOB       = !uvInBounds;\r
    if (r2TIR) {\r
      // Non-diamond shapes (pill/prism/cube/plate) fall back to \`reflSrc\` on\r
      // TIR. Their TIR still benefits from the envmap indirectly: \`reflSrc\`\r
      // resolves to \`sampleEnvmap(refl)\` when envmap is enabled, so cube/plate\r
      // TIR samples the real environment instead of the legacy Phase A\r
      // UV-offset photo hack. Upgrading them to their own bounce chain would\r
      // need analytical cube/plate TIR facet picking — Phase D territory.\r
      // (Diamond has its own multi-bounce analytic TIR chain in\r
      // \`fs_main_diamond\`.)\r
      refractL = reflSrc;\r
    } else if (r2NaN || r2OOB) {\r
      refractL = bg;\r
    } else {\r
      // Successful refract. Envmap: sample the panorama at the\r
      // refracted direction; strength interpolates between rd (bg\r
      // direction = no refraction visible) and r2 (full refraction).\r
      // Photo: classic UV-offset sample.\r
      if (frame.envmapEnabled > 0.5) {\r
        refractL = sampleEnvmap(mix(rd, r2, strength));\r
      } else {\r
        refractL = textureSampleLevel(photoTex, photoSmp, uvCover, photoLod).rgb;\r
      }\r
    }\r
\r
    // Per-wavelength Schlick Fresnel: short λ (blue) has higher IOR → higher F.\r
    let F_lambda = schlickFresnel(cosT, ior);\r
    let L        = mix(refractL, reflSrc, F_lambda);\r
\r
    let lambdaRgb = max(xyzToSrgb(cieXyz(lambda)), vec3<f32>(0.0));\r
    rgbAccum  = rgbAccum  + L * lambdaRgb;\r
    rgbWeight = rgbWeight + lambdaRgb;\r
  }\r
\r
  // Normalize against the per-wavelength primary sum — keeps a flat white\r
  // spectrum neutral for any N. Then sanitize: if every wavelength entered\r
  // the loop's \`continue\` branch (TIR-on-entry — shouldn't happen with the\r
  // 1.0-clamped IOR but defensively guarded), \`rgbWeight\` is exactly 0 and\r
  // \`max(_, 1e-4)\` saves the divide but the result can spike to absurdly\r
  // large values from tiny \`rgbAccum\` jitter; downstream that becomes a\r
  // saturated white pixel. NaN can also slip in from a borderline-\r
  // degenerate normal that passed sceneNormal's gradient threshold, or\r
  // from a Newton bail in plateAnalyticExit that left \`pL\` outside the\r
  // plate's XY extent and made nBack point in a near-tangent direction\r
  // that refracts to a NaN r2.\r
  //\r
  // We replace bad outputs with the BG photo sample, not zero — these\r
  // failure modes happen at single pixels along silhouettes, and\r
  // surrounding pixels render as either bg (miss path) or normal\r
  // refraction. Substituting the local bg lets the dot vanish into the\r
  // silhouette neighbourhood; substituting black would leave a visible\r
  // dark speckle. (Without the substitution, NaN burns into history and\r
  // becomes permanent garbage at that pixel until a scene-change reset.)\r
  let raw     = rgbAccum / max(rgbWeight, vec3<f32>(1e-4));\r
  // NaN-only whole-pixel guard. The \`any(...)\` reduces vec3<bool> to a\r
  // scalar so a single bad channel sends the entire pixel to bg (otherwise\r
  // component-wise select would replace e.g. just R, leaving G/B as the\r
  // raw NaN-y values → off-coloured speckle worse than a clean fallback).\r
  // Magnitude is bounded by the clamp on the next line.\r
  let safe    = select(raw, bg, vec3<bool>(any(raw != raw)));\r
  let clamped = clamp(safe, vec3<f32>(0.0), vec3<f32>(8.0));\r
\r
  // Silhouette anti-alias by blending toward bg at near-grazing angles.\r
  // Without this, the rasterised proxy edge produces a 1-pixel binary\r
  // hit/miss boundary; the hit side has wildly view-dependent refraction\r
  // (the per-wavelength loop's UV samples are extreme at cosT → 0 and\r
  // even legitimate TIR fallbacks to reflSrc can be uncorrelated with\r
  // the miss side's plain bg). With TAA off we have no temporal averaging\r
  // to dilute the discontinuity, so the silhouette flickers as a hard\r
  // pixel-wide colour jump.\r
  //\r
  // Threshold 0.05 is deliberately tight: cosT < 0.05 means incidence\r
  // angle > ~87°, the regime where refraction is genuinely meaningless\r
  // (Fresnel ≈ 1, the proxy mesh is in pixel-thin coverage of the\r
  // actual silhouette). A wider band (we tried 0.15 ≈ 81°) dimmed\r
  // legitimate interior pixels of plates tumbling steeply edge-on,\r
  // where the entire face is at a grazing-but-fully-hit angle and\r
  // the rim Fresnel reflection is the visually-correct answer.\r
  //\r
  // Gated by historyBlend so paused-scene progressive averaging\r
  // (\`α = max(1/n, 1/256)\` → 0) sees \`silhouetteMix = 1\` and stays on\r
  // the unfaded refraction. Otherwise the bg-tinted output would\r
  // accumulate into the converged paused mean and pull silhouettes\r
  // toward bg over time — the same failure mode the variance clamp\r
  // is also gated against.\r
  let silhouetteGate = smoothstep(0.05, 0.15, frame.historyBlend);\r
  let silhouetteMix  = mix(1.0, smoothstep(0.0, 0.05, cosT), silhouetteGate);\r
  let outRgb = mix(bg, clamped, silhouetteMix);\r
\r
  // History is stored in rgba16float (linear). Blend in linear space; encode\r
  // for display only on the swapchain write. \`historyBlend\` is normally 0.2 —\r
  // host bumps it to 1.0 for one frame on any scene change (photo reload,\r
  // preset click, shape switch) so the previous scene doesn't ghost in.\r
  //\r
  // TAA motion-vector reprojection: for rotating shapes (cube / plate /\r
  // diamond), read history at the screen location where the hit point was\r
  // one frame ago. This is what turns naive TAA (which blurs tumbling\r
  // refraction texture into mush) into real TAA that keeps refracted detail\r
  // sharp under motion. Pill / prism pass through unchanged (reprojectHit\r
  // returns fallbackUv for non-rotating shapes, and we short-circuit when\r
  // TAA is off).\r
  var historyUv = uv;\r
  if (frame.taaEnabled > 0.5 && hasMotionPivot) {\r
    // Pass the unjittered \`px\` so the reprojection cancels jitter in the\r
    // motion delta, keeping static-scene history reads pixel-aligned.\r
    historyUv = reprojectHit(h.p, px, analyticIdx, shapeId, uv);\r
  }\r
  let prev  = textureSampleLevel(historyTex, historySmp, historyUv, 0.0).rgb;\r
\r
  // EMA blend with adaptive variance clamp — see \`adaptiveBlend\` above.\r
  var blend = adaptiveBlend(prev, outRgb);\r
\r
  // Debug: tint every proxy fragment pink so the proxy silhouette is visible.\r
  // This path (ray hit the cube) gets a light tint; the miss path above gets\r
  // a heavier tint so the over-coverage halo stands out.\r
  if (frame.debugProxy > 0.5) {\r
    blend = mix(blend, vec3<f32>(1.0, 0.3, 0.7), 0.2);\r
  }\r
\r
  // Diamond debug overlays live in \`fs_main_diamond\`; \`fs_main\` only handles\r
  // non-diamond shapes and has no facet-color / wireframe pass to draw.\r
\r
  var o: FsOut;\r
  o.color   = vec4<f32>(blend, 1.0);\r
  o.history = vec4<f32>(blend, 1.0);\r
  return o;\r
}\r
\r
@fragment\r
fn fs_main_diamond(in: ProxyFsIn) -> FsOut {\r
  let px = in.fragCoord.xy;\r
  let uv = px / frame.resolution;\r
\r
  var rayPx = px;\r
  if (frame.taaEnabled > 0.5) {\r
    let taaJit = vec2<f32>(\r
      hash21(px + vec2<f32>(frame.time * 7.19, 3.141)) - 0.5,\r
      hash21(px + vec2<f32>(frame.time * 11.23, 6.283)) - 0.5,\r
    );\r
    rayPx = px + taaJit;\r
  }\r
\r
  var ro: vec3<f32>;\r
  var rd: vec3<f32>;\r
  if (frame.projection > 0.5) {\r
    ro = vec3<f32>(frame.resolution * 0.5, frame.cameraZ);\r
    rd = normalize(vec3<f32>(rayPx, 0.0) - ro);\r
  } else {\r
    ro = vec3<f32>(rayPx, 400.0);\r
    rd = vec3<f32>(0.0, 0.0, -1.0);\r
  }\r
\r
  let bgPhoto = textureSampleLevel(photoTex, photoSmp, coverUv(uv), 0.0).rgb;\r
  let bgEnv   = sampleEnvmap(rd);\r
  let bg      = select(bgPhoto, bgEnv, frame.envmapEnabled > 0.5);\r
\r
  // Unlike the generic path, this dedicated diamond path bypasses the\r
  // scene-wide sphereTrace. Keep the front hit scene-wide anyway so overlapping\r
  // diamond proxies still resolve to the nearest instance even though the proxy\r
  // pass has no depth buffer.\r
  let front       = diamondAnalyticHitScene(ro, rd);\r
  if (!front.ok) {\r
    return proxyBgOut(uv, bg);\r
  }\r
\r
  let analyticIdx = front.pillIdx;\r
  let hP     = front.pWorld;\r
  // Keep the analytic front-hit POSITION (cheap, exact, no 64-step march),\r
  // but use the SDF gradient for the entry normal. The exact per-facet normal\r
  // makes every crown facet transition razor-sharp, which visually doubles the\r
  // back-facet lines seen through the front surface under FXAA. \`sceneNormal\`\r
  // preserves the old soft blend across facet boundaries while retaining the\r
  // performance win from the analytic hit point.\r
  let nFront = sceneNormal(front.pWorld);\r
  if (dot(nFront, nFront) <= 0.5) {\r
    return proxyBgOut(uv, bg);\r
  }\r
\r
  let n_d      = frame.n_d;\r
  let V_d      = frame.V_d;\r
  let N        = clamp(i32(frame.sampleCount), 1, MAX_N);\r
  let strength = frame.refractionStrength;\r
  let jitter   = frame.jitter;\r
  let useHero  = frame.refractionMode > 0.5;\r
\r
  var sharedExit  = hP;\r
  var sharedNBack = -nFront;\r
  if (useHero) {\r
    let iorHero = cauchyIor(frame.heroLambda, n_d, V_d);\r
    let r1hero  = refract(rd, nFront, 1.0 / iorHero);\r
    if (dot(r1hero, r1hero) >= 1e-4) {\r
      let ex = diamondAnalyticExit(hP + r1hero * MIN_STEP, r1hero, analyticIdx);\r
      sharedExit  = ex.pWorld;\r
      sharedNBack = ex.nBack;\r
    }\r
  }\r
\r
  let refl = reflect(rd, nFront);\r
  let reflUv     = uv + (refl - rd).xy * 0.2;\r
  let reflCover  = coverUv(reflUv);\r
  let reflInBnds = all(reflCover >= vec2<f32>(0.0)) && all(reflCover <= vec2<f32>(1.0));\r
  let reflRaw    = textureSampleLevel(photoTex, photoSmp, reflCover, 0.0).rgb;\r
  let reflLegacy = select(bg, reflRaw, reflInBnds) * vec3<f32>(0.85, 0.9, 1.0);\r
  let reflSrc    = select(reflLegacy, sampleEnvmap(refl), frame.envmapEnabled > 0.5);\r
\r
  let cosT     = max(dot(-rd, nFront), 0.0);\r
  let photoLod = clamp(-log2(max(cosT, 0.02)) - 1.0, 0.0, 6.0);\r
  let pxJit    = spectralStratumJitter(px, jitter);\r
\r
  var rgbAccum  = vec3<f32>(0.0);\r
  var rgbWeight = vec3<f32>(0.0);\r
  for (var i: i32 = 0; i < N; i = i + 1) {\r
    let t      = (f32(i) + 0.5 + pxJit) / f32(N);\r
    let lambda = mix(380.0, 700.0, t);\r
    let ior    = cauchyIor(lambda, n_d, V_d);\r
    let r1     = refract(rd, nFront, 1.0 / ior);\r
    if (dot(r1, r1) < 1e-4) { continue; }\r
\r
    var pExit = sharedExit;\r
    var nBack = sharedNBack;\r
    if (!useHero) {\r
      let ex = diamondAnalyticExit(hP + r1 * MIN_STEP, r1, analyticIdx);\r
      pExit = ex.pWorld;\r
      nBack = ex.nBack;\r
    }\r
    let r2 = refract(r1, nBack, ior);\r
\r
    var refractL: vec3<f32>;\r
    let uvOff      = uv + (r2 - rd).xy * strength;\r
    let uvCover    = coverUv(uvOff);\r
    let uvInBounds = all(uvCover >= vec2<f32>(0.0)) && all(uvCover <= vec2<f32>(1.0));\r
    let r2dot      = dot(r2, r2);\r
    let r2NaN      = r2dot != r2dot;\r
    let r2TIR      = r2dot < 1e-4 && !r2NaN;\r
    let r2OOB      = !uvInBounds;\r
    if (r2TIR) {\r
      if (!useHero) {\r
        var curR1    = r1;\r
        var curNBack = nBack;\r
        var curP     = pExit;\r
        var outDir: vec3<f32> = vec3<f32>(0.0);\r
        var resolved: bool     = false;\r
        var tirDbgAnalyticMiss: bool = false;\r
        let tirMaxB = u32(clamp(round(frame.diamondTirMaxBounces), 1.0, 32.0));\r
        for (var bounce: u32 = 0u; bounce < tirMaxB; bounce = bounce + 1u) {\r
          let bouncedR1 = reflect(curR1, curNBack);\r
          let roNudge = clamp(\r
            frame.diamondSize * TIR_BOUNCE_RO_NUDGE_SCALE,\r
            TIR_BOUNCE_RO_NUDGE_FLOOR,\r
            TIR_BOUNCE_RO_NUDGE_CEIL,\r
          );\r
          let roChain = curP + bouncedR1 * roNudge;\r
          let exN     = diamondAnalyticExit(roChain, bouncedR1, analyticIdx);\r
          if (dot(exN.nBack, exN.nBack) < 0.25) {\r
            tirDbgAnalyticMiss = true;\r
            break;\r
          }\r
          let trial    = refract(bouncedR1, exN.nBack, ior);\r
          let trialDot = dot(trial, trial);\r
          let trialNaN = trialDot != trialDot;\r
          if (trialDot >= 1e-4 && !trialNaN) {\r
            outDir   = trial;\r
            resolved = true;\r
            break;\r
          }\r
          curR1    = bouncedR1;\r
          curNBack = exN.nBack;\r
          curP     = exN.pWorld;\r
        }\r
        if (resolved) {\r
          let uvOffB    = uv + (outDir - rd).xy * strength;\r
          let uvCoverB  = coverUv(uvOffB);\r
          let inBoundsB = all(uvCoverB >= vec2<f32>(0.0)) && all(uvCoverB <= vec2<f32>(1.0));\r
          if (frame.envmapEnabled > 0.5) {\r
            refractL = sampleEnvmap(mix(rd, outDir, strength));\r
          } else if (inBoundsB) {\r
            refractL = textureSampleLevel(photoTex, photoSmp, uvCoverB, photoLod).rgb;\r
          } else {\r
            refractL = bg;\r
          }\r
        } else {\r
          let exhaustedFallback = select(bg, reflSrc, frame.envmapEnabled > 0.5);\r
          let dbgTir    = vec3<f32>(1.0, 0.2, 0.75);\r
          let dbgAnMiss = vec3<f32>(1.0, 0.45, 0.05);\r
          let dbgTint   = select(dbgTir, dbgAnMiss, tirDbgAnalyticMiss);\r
          refractL = select(exhaustedFallback, dbgTint, frame.diamondTirDebug > 0.5);\r
        }\r
      } else {\r
        refractL = reflSrc;\r
      }\r
    } else if (r2NaN || r2OOB) {\r
      refractL = bg;\r
    } else {\r
      if (frame.envmapEnabled > 0.5) {\r
        refractL = sampleEnvmap(mix(rd, r2, strength));\r
      } else {\r
        refractL = textureSampleLevel(photoTex, photoSmp, uvCover, photoLod).rgb;\r
      }\r
    }\r
\r
    let F_lambda = schlickFresnel(cosT, ior);\r
    let L        = mix(refractL, reflSrc, F_lambda);\r
    let lambdaRgb = max(xyzToSrgb(cieXyz(lambda)), vec3<f32>(0.0));\r
    rgbAccum  = rgbAccum  + L * lambdaRgb;\r
    rgbWeight = rgbWeight + lambdaRgb;\r
  }\r
\r
  let raw     = rgbAccum / max(rgbWeight, vec3<f32>(1e-4));\r
  let safe    = select(raw, bg, vec3<bool>(any(raw != raw)));\r
  let clamped = clamp(safe, vec3<f32>(0.0), vec3<f32>(8.0));\r
\r
  let silhouetteGate = smoothstep(0.05, 0.15, frame.historyBlend);\r
  let silhouetteMix  = mix(1.0, smoothstep(0.0, 0.05, cosT), silhouetteGate);\r
  let outRgb         = mix(bg, clamped, silhouetteMix);\r
\r
  var historyUv = uv;\r
  if (frame.taaEnabled > 0.5) {\r
    historyUv = reprojectHit(hP, px, analyticIdx, 4, uv);\r
  }\r
  let prev  = textureSampleLevel(historyTex, historySmp, historyUv, 0.0).rgb;\r
  var blend = adaptiveBlend(prev, outRgb);\r
  if (frame.debugProxy > 0.5) {\r
    blend = mix(blend, vec3<f32>(1.0, 0.3, 0.7), 0.2);\r
  }\r
\r
  var display = blend;\r
  if (frame.diamondFacetColor > 0.5) {\r
    let pillCenter = frame.pills[analyticIdx].center;\r
    display = sdfDiamondFacetColor(hP - pillCenter, frame.diamondSize);\r
  }\r
  if (frame.diamondWireframe > 0.5) {\r
    let pillCenter = frame.pills[analyticIdx].center;\r
    let edgeW      = sdfDiamondEdgeWeight(hP - pillCenter, frame.diamondSize);\r
    display = mix(display, vec3<f32>(1.0, 0.25, 0.25), edgeW * 0.85);\r
  }\r
\r
  var o: FsOut;\r
  o.color   = vec4<f32>(display, 1.0);\r
  o.history = vec4<f32>(blend, 1.0);\r
  return o;\r
}\r
`,qo=`// Diamond-specific WGSL — split from dispersion.wgsl to keep the main shader\r
// focused on trace/SDF framework and isolate the brilliant-cut geometry work\r
// (sdfDiamond + proxy mesh + analytic diamond intersections). Intended home for future diamond-\r
// only trace paths so the diamond geometry stays in one file.\r
//\r
// Depends on:\r
//   - Plane / dimension constants injected by src/math/diamond.ts\r
//     (DIAMOND_H_TOP, DIAMOND_H_BOT, DIAMOND_H_GIRDLE_HALF, DIAMOND_R_GIRDLE,\r
//      DIAMOND_R_TABLE_VERTEX, DIAMOND_GIRDLE_R_CIRC,\r
//      DIAMOND_{BEZEL,STAR,UPPER_HALF,LOWER_HALF,PAVILION}_{N,O},\r
//      DIAMOND_PROXY_VERT_COUNT)\r
//   - \`struct Frame\` and the \`@group(0) @binding(0) var<uniform> frame\`\r
//     binding from dispersion.wgsl\r
//   - \`MAX_PILLS\` from dispersion.wgsl\r
//\r
// See src/webgpu/pipeline.ts for the concat order — this file is last, so\r
// everything it references is already in scope by the time WGSL's\r
// single-pass compile reaches these function bodies. WGSL resolves cross-\r
// function calls across the whole module, so \`sceneSdf\` → \`sdfDiamond\`\r
// works even though sceneSdf appears earlier.\r
\r
// -----------------------------------------------------------------------------\r
// SDF — round brilliant cut\r
// -----------------------------------------------------------------------------\r
//\r
// 58 facets reduced to 7 distance terms via D_8 (octagonal) symmetry folding.\r
// Produces a convex polytope that reads as a classic jewelry-store brilliant\r
// cut.\r
//\r
// Strategy:\r
//   1. Apply \`diamondRot\` (fixed tilt + Y-axis spin) to the local point.\r
//   2. Fold XY into the 1/16 fundamental wedge [0°, 22.5°] via three\r
//      reflections: abs on both components of p.xy (folds across the X\r
//      and Y axes → first quadrant, 4-fold), swap-if-y>x (folds across\r
//      the y=x line → first octant, 8-fold), and reflect across the\r
//      22.5° line (folds the octant's upper half onto its lower half →\r
//      fundamental π/8 wedge, 16-fold). Each facet class has exactly ONE\r
//      representative in the wedge, so evaluating its plane once gives\r
//      the correct distance by symmetry — no \`min\` over multiple rotated\r
//      copies.\r
//   3. Evaluate 7 signed-distance terms: table (+Z cap), bezel (crown\r
//      main), star, upper half (girdle-adjacent crown facet), girdle\r
//      cylinder, lower half (girdle-adjacent pavilion facet), pavilion\r
//      main. The pointed culet is naturally handled by the pavilion\r
//      planes converging at (0, 0, H_BOT) — \`max()\` closes the shape\r
//      correctly at the apex.\r
//   4. Return the max (intersection of half-spaces = convex polytope SDF),\r
//      with all offsets multiplied by \`frame.diamondSize\` so the runtime\r
//      slider scales the whole shape uniformly.\r
//\r
// Unlike cube/pill/prism this SDF has NO \`edgeR\` rounding — sharp facets\r
// are the look. Facet creases trip sceneNormal()'s degenerate-gradient\r
// sentinel and render as bg (thin dark seam), matching the expected\r
// real-diamond crease appearance.\r
fn sdfDiamond(pIn: vec3<f32>, diameter: f32) -> f32 {\r
  let p0 = frame.diamondRot * pIn;\r
\r
  // 1/16 fold: abs on BOTH xy components [4-fold — folds across X and Y\r
  // axes], swap if y>x [8-fold — reflection across y=x], reflect across\r
  // θ=π/8 line [16-fold].\r
  var q = abs(p0.xy);\r
  if (q.y > q.x) { q = q.yx; }\r
  // π/8 ≈ 22.5°. The reflection-line normal is the vector perpendicular to\r
  // the π/8 line pointing into the θ>π/8 half; reflecting points with\r
  // dot(q, nRefl) > 0 folds them back into [0°, 22.5°].\r
  let nRefl = vec2<f32>(-0.3826834324, 0.9238795325);   // (-sin(π/8), cos(π/8))\r
  let d     = dot(q, nRefl);\r
  if (d > 0.0) { q = q - 2.0 * d * nRefl; }\r
\r
  let p = vec3<f32>(q, p0.z);\r
  let r = length(q);   // radial distance — for the cylindrical girdle term\r
\r
  // 7 distance terms. Offsets are in units of diameter; multiply each by\r
  // \`diameter\` so the whole shape scales with the runtime slider.\r
  let d_table    = p.z - DIAMOND_H_TOP * diameter;\r
  let d_bezel    = dot(p, DIAMOND_BEZEL_N)      - DIAMOND_BEZEL_O      * diameter;\r
  let d_star     = dot(p, DIAMOND_STAR_N)       - DIAMOND_STAR_O       * diameter;\r
  let d_uhalf    = dot(p, DIAMOND_UPPER_HALF_N) - DIAMOND_UPPER_HALF_O * diameter;\r
  let d_girdle   = r                            - DIAMOND_R_GIRDLE     * diameter;\r
  let d_lhalf    = dot(p, DIAMOND_LOWER_HALF_N) - DIAMOND_LOWER_HALF_O * diameter;\r
  let d_pavmain  = dot(p, DIAMOND_PAVILION_N)   - DIAMOND_PAVILION_O   * diameter;\r
\r
  return max(max(max(d_table, d_bezel), max(d_star, d_uhalf)),\r
             max(d_girdle, max(d_lhalf, d_pavmain)));\r
}\r
\r
// -----------------------------------------------------------------------------\r
// Facet-edge weight — debug overlay\r
// -----------------------------------------------------------------------------\r
//\r
// Returns an edge intensity in [0, 1] for a local-space surface point.\r
// 1.0 at facet boundaries (two plane SDFs equidistant, i.e. the point sits\r
// on the edge between two facets); 0.0 in facet interiors. Used by fs_main\r
// to draw a wireframe overlay when \`frame.diamondWireframe\` is on —\r
// useful for cross-checking that the cut geometry matches a real round\r
// brilliant reference.\r
//\r
// Strategy: evaluate the same 7 plane distances as sdfDiamond, find the\r
// MAX (= the "outer" facet at this point — the surface plane) and the\r
// SECOND-MAX (= the facet that would take over if you stepped outward).\r
// The smaller the gap, the closer to the edge between them. Smoothstep\r
// the gap against a pixel-scale threshold so edges render ~1 px wide at\r
// typical diamond sizes.\r
fn sdfDiamondEdgeWeight(pIn: vec3<f32>, diameter: f32) -> f32 {\r
  // Same fold as sdfDiamond — keep them in sync if the fold ever changes.\r
  let p0 = frame.diamondRot * pIn;\r
  var q = abs(p0.xy);\r
  if (q.y > q.x) { q = q.yx; }\r
  let nRefl = vec2<f32>(-0.3826834324, 0.9238795325);\r
  let d     = dot(q, nRefl);\r
  if (d > 0.0) { q = q - 2.0 * d * nRefl; }\r
  let p = vec3<f32>(q, p0.z);\r
  let r = length(q);\r
\r
  let d_table    = p.z - DIAMOND_H_TOP * diameter;\r
  let d_bezel    = dot(p, DIAMOND_BEZEL_N)      - DIAMOND_BEZEL_O      * diameter;\r
  let d_star     = dot(p, DIAMOND_STAR_N)       - DIAMOND_STAR_O       * diameter;\r
  let d_uhalf    = dot(p, DIAMOND_UPPER_HALF_N) - DIAMOND_UPPER_HALF_O * diameter;\r
  let d_girdle   = r                            - DIAMOND_R_GIRDLE     * diameter;\r
  let d_lhalf    = dot(p, DIAMOND_LOWER_HALF_N) - DIAMOND_LOWER_HALF_O * diameter;\r
  let d_pavmain  = dot(p, DIAMOND_PAVILION_N)   - DIAMOND_PAVILION_O   * diameter;\r
\r
  let maxD = max(max(max(d_table, d_bezel), max(d_star, d_uhalf)),\r
                 max(d_girdle, max(d_lhalf, d_pavmain)));\r
\r
  // Second-max: replace any value equal to maxD with a very negative\r
  // sentinel, then re-max. The ">= maxD" comparison tolerates the single\r
  // tied value but correctly excludes only the true maximum.\r
  let NEG: f32 = -1e9;\r
  let d2_table   = select(d_table,   NEG, d_table   >= maxD);\r
  let d2_bezel   = select(d_bezel,   NEG, d_bezel   >= maxD);\r
  let d2_star    = select(d_star,    NEG, d_star    >= maxD);\r
  let d2_uhalf   = select(d_uhalf,   NEG, d_uhalf   >= maxD);\r
  let d2_girdle  = select(d_girdle,  NEG, d_girdle  >= maxD);\r
  let d2_lhalf   = select(d_lhalf,   NEG, d_lhalf   >= maxD);\r
  let d2_pavmain = select(d_pavmain, NEG, d_pavmain >= maxD);\r
  let secondD = max(max(max(d2_table, d2_bezel), max(d2_star, d2_uhalf)),\r
                    max(d2_girdle, max(d2_lhalf, d2_pavmain)));\r
\r
  // Gap in world-space units (pixels since the diamond is sized in pixels).\r
  // 1.5 px smoothstep gives a crisp single-pixel line with soft anti-alias.\r
  let gap = maxD - secondD;\r
  return 1.0 - smoothstep(0.0, 1.5, gap);\r
}\r
\r
// -----------------------------------------------------------------------------\r
// Facet-type flat-shade colour — debug fill\r
// -----------------------------------------------------------------------------\r
//\r
// Returns a distinct flat colour per facet class at a local-space surface\r
// point. Used when \`frame.diamondFacetColor\` is on so the user can see\r
// which parts of the SDF surface belong to which facet without refraction\r
// muddying the signal. Colours:\r
//   table        → red\r
//   bezel        → green\r
//   star         → blue\r
//   upper half   → yellow\r
//   girdle       → cyan\r
//   lower half   → magenta\r
//   pavilion     → orange\r
fn sdfDiamondFacetColor(pIn: vec3<f32>, diameter: f32) -> vec3<f32> {\r
  let p0 = frame.diamondRot * pIn;\r
  var q = abs(p0.xy);\r
  if (q.y > q.x) { q = q.yx; }\r
  let nRefl = vec2<f32>(-0.3826834324, 0.9238795325);\r
  let d     = dot(q, nRefl);\r
  if (d > 0.0) { q = q - 2.0 * d * nRefl; }\r
  let p = vec3<f32>(q, p0.z);\r
  let r = length(q);\r
\r
  let d_table    = p.z - DIAMOND_H_TOP * diameter;\r
  let d_bezel    = dot(p, DIAMOND_BEZEL_N)      - DIAMOND_BEZEL_O      * diameter;\r
  let d_star     = dot(p, DIAMOND_STAR_N)       - DIAMOND_STAR_O       * diameter;\r
  let d_uhalf    = dot(p, DIAMOND_UPPER_HALF_N) - DIAMOND_UPPER_HALF_O * diameter;\r
  let d_girdle   = r                            - DIAMOND_R_GIRDLE     * diameter;\r
  let d_lhalf    = dot(p, DIAMOND_LOWER_HALF_N) - DIAMOND_LOWER_HALF_O * diameter;\r
  let d_pavmain  = dot(p, DIAMOND_PAVILION_N)   - DIAMOND_PAVILION_O   * diameter;\r
\r
  let dMax = max(max(max(d_table, d_bezel), max(d_star, d_uhalf)),\r
                 max(d_girdle, max(d_lhalf, d_pavmain)));\r
\r
  // Classify by which plane is the outermost (equal to dMax).\r
  if (d_table  >= dMax) { return vec3<f32>(1.0, 0.25, 0.25); }   // red    — table\r
  if (d_bezel  >= dMax) { return vec3<f32>(0.25, 1.0, 0.25); }   // green  — bezel\r
  if (d_star   >= dMax) { return vec3<f32>(0.25, 0.4, 1.0);  }   // blue   — star\r
  if (d_uhalf  >= dMax) { return vec3<f32>(1.0, 0.95, 0.2);  }   // yellow — upper half\r
  if (d_girdle >= dMax) { return vec3<f32>(0.25, 1.0, 1.0);  }   // cyan   — girdle\r
  if (d_lhalf  >= dMax) { return vec3<f32>(1.0, 0.3, 1.0);   }   // magenta — lower half\r
  return                   vec3<f32>(1.0, 0.6, 0.15);            // orange — pavilion main\r
}\r
\r
// -----------------------------------------------------------------------------\r
// Proxy mesh — exact convex-hull synthesis\r
// -----------------------------------------------------------------------------\r
//\r
// Generates a local-space vertex for the 46-triangle (138-vertex) convex-hull\r
// proxy mesh given a WebGPU \`vertex_index\`. Triangles split into four groups:\r
//\r
//   0..5   Table fan (top octagon): 6 triangles rooted at table[0], fanning\r
//          out to table[t+1]/table[t+2]. Outward normal +Z.\r
//\r
//   6..21  Crown trapezoids: 8 kite-shaped bezel facets, each split into 2\r
//          triangles → 16 total. Connects each table edge (table[k]-\r
//          table[k+1]) down to the corresponding GIRDLE-TOP edge\r
//          (girdleTop[k]-girdleTop[k+1]) at z=+H_GIRDLE_HALF. Outward\r
//          normal points radially + upward.\r
//\r
//   22..37 Girdle band: 8 rectangular faces wrapping the cylindrical\r
//          girdle, each split into 2 triangles → 16 total. Connects\r
//          girdleTop[k]-girdleTop[k+1] (z=+H_GIRDLE_HALF) to\r
//          girdleBot[k]-girdleBot[k+1] (z=-H_GIRDLE_HALF). Outward normal\r
//          points radially (no vertical component). Without this ring the\r
//          proxy would pinch inward toward z=0 at octagon edge midpoints\r
//          and fail to cover the true cylindrical girdle — visible as\r
//          8 thin dark seams at the equator of a rendered diamond.\r
//\r
//   38..45 Pavilion cone: 8 triangles from girdleBot[k]-girdleBot[k+1]\r
//          converging to the culet apex at (0, 0, H_BOT). Outward normal\r
//          points radially + downward.\r
//\r
// Table vertices live at (R_TABLE_VERTEX, angle=π/8+k·π/4, z=H_TOP). Girdle\r
// vertices live at (R_CIRC, same angle, z=±H_GIRDLE_HALF), where R_CIRC is\r
// the CIRCUMSCRIBING octagon radius = R_GIRDLE/cos(π/8) so the girdle\r
// cylinder stays fully covered between vertex pairs at every z in the band.\r
// The ~8 % radial slack at the angle=π/8 corners is the only over-coverage\r
// this proxy has.\r
//\r
// Callers (vs_proxy in dispersion.wgsl) are expected to bound-check\r
// \`vi < DIAMOND_PROXY_VERT_COUNT\` (138) before calling. The vertex budget\r
// is enforced at the draw call (pipeline.ts) and by the maxVerts guard at\r
// the top of vs_proxy — both read the same DIAMOND_PROXY_VERT_COUNT\r
// constant injected by src/math/diamond.ts. A mesh-topology change\r
// touches this function here AND \`DIAMOND_PROXY_TRI_COUNT\` in\r
// src/math/diamond.ts; the draw count + maxVerts guard follow automatically.\r
fn diamondProxyVertex(vi: u32, d: f32) -> vec3<f32> {\r
  let triIdx    = vi / 3u;        // 0..45\r
  let vertInTri = vi % 3u;        // 0..2\r
\r
  // Table vertices sit at φ = k·π/4 (= bezel / pavilion-main azimuths, see\r
  // src/math/diamond.ts PHI_BEZEL doc). Girdle vertices share the same\r
  // azimuths so each crown trapezoid + girdle-band quad stays planar.\r
  let kAngleStep = 0.7853981633974483;          // π/4\r
  let kAngleBias = 0.0;                         // vertex 0 at φ = 0 (on the +X axis)\r
\r
  if (triIdx < 6u) {\r
    // ----- Table fan ----- verts: (table[0], table[t+1], table[t+2]).\r
    // Fan-triangulation of the table octagon. Outward normal = +Z.\r
    let tk = select(0u, triIdx + vertInTri, vertInTri > 0u);\r
    let angle = f32(tk) * kAngleStep + kAngleBias;\r
    let r = DIAMOND_R_TABLE_VERTEX * d;\r
    return vec3<f32>(r * cos(angle), r * sin(angle), DIAMOND_H_TOP * d);\r
  }\r
\r
  if (triIdx < 22u) {\r
    // ----- Crown trapezoids (8 kites, 16 triangles) -----\r
    // Each trapezoid connects (table[k]-table[k+1]) at z=H_TOP to the\r
    // GIRDLE-TOP ring (girdleTop[k]-girdleTop[k+1]) at z=+H_GIRDLE_HALF.\r
    // Triangle 0 (sub=0): (table[k], girdleTop[k], girdleTop[kNext])\r
    // Triangle 1 (sub=1): (table[k], girdleTop[kNext], table[kNext])\r
    // Winding picked so cross(edge1, edge2) points radially outward + up.\r
    let trapK = (triIdx - 6u) / 2u;    // 0..7\r
    let sub   = (triIdx - 6u) % 2u;    // 0 or 1\r
    let kNext = (trapK + 1u) % 8u;\r
\r
    // Resolve (vertInTri, sub) → (onTable flag, k index).\r
    //   sub=0: [table[k], girdleTop[k], girdleTop[kNext]]\r
    //   sub=1: [table[k], girdleTop[kNext], table[kNext]]\r
    var onTable: bool;\r
    var kIdx:    u32;\r
    if (sub == 0u) {\r
      if      (vertInTri == 0u) { onTable = true;  kIdx = trapK; }\r
      else if (vertInTri == 1u) { onTable = false; kIdx = trapK; }\r
      else                      { onTable = false; kIdx = kNext; }\r
    } else {\r
      if      (vertInTri == 0u) { onTable = true;  kIdx = trapK; }\r
      else if (vertInTri == 1u) { onTable = false; kIdx = kNext; }\r
      else                      { onTable = true;  kIdx = kNext; }\r
    }\r
    let angle = f32(kIdx) * kAngleStep + kAngleBias;\r
    let r     = select(DIAMOND_GIRDLE_R_CIRC, DIAMOND_R_TABLE_VERTEX, onTable) * d;\r
    let z     = select(DIAMOND_H_GIRDLE_HALF * d, DIAMOND_H_TOP * d, onTable);\r
    return vec3<f32>(r * cos(angle), r * sin(angle), z);\r
  }\r
\r
  if (triIdx < 38u) {\r
    // ----- Girdle band (8 quads, 16 triangles) -----\r
    // Each quad wraps the cylindrical girdle between its octagon corners.\r
    // Triangle 0 (sub=0): (girdleTop[k], girdleBot[k], girdleBot[kNext])\r
    // Triangle 1 (sub=1): (girdleTop[k], girdleBot[kNext], girdleTop[kNext])\r
    // Winding: radial-outward normal, no vertical component (cylinder band).\r
    let bandK = (triIdx - 22u) / 2u;    // 0..7\r
    let sub   = (triIdx - 22u) % 2u;    // 0 or 1\r
    let kNext = (bandK + 1u) % 8u;\r
\r
    // (top vs bot ring, k index).\r
    //   sub=0: [top[k], bot[k], bot[kNext]]\r
    //   sub=1: [top[k], bot[kNext], top[kNext]]\r
    var onTop: bool;\r
    var kIdx:  u32;\r
    if (sub == 0u) {\r
      if      (vertInTri == 0u) { onTop = true;  kIdx = bandK; }\r
      else if (vertInTri == 1u) { onTop = false; kIdx = bandK; }\r
      else                      { onTop = false; kIdx = kNext; }\r
    } else {\r
      if      (vertInTri == 0u) { onTop = true;  kIdx = bandK; }\r
      else if (vertInTri == 1u) { onTop = false; kIdx = kNext; }\r
      else                      { onTop = true;  kIdx = kNext; }\r
    }\r
    let angle = f32(kIdx) * kAngleStep + kAngleBias;\r
    let r     = DIAMOND_GIRDLE_R_CIRC * d;\r
    let z     = select(-DIAMOND_H_GIRDLE_HALF * d, DIAMOND_H_GIRDLE_HALF * d, onTop);\r
    return vec3<f32>(r * cos(angle), r * sin(angle), z);\r
  }\r
\r
  // ----- Pavilion cone (8 triangles) -----\r
  // Each triangle: (culet, girdleBot[kNext], girdleBot[k]). Winding chosen so\r
  // the outward normal points radially + downward for pavilion faces.\r
  let k     = triIdx - 38u;       // 0..7\r
  let kNext = (k + 1u) % 8u;\r
  if (vertInTri == 0u) {\r
    return vec3<f32>(0.0, 0.0, DIAMOND_H_BOT * d);\r
  }\r
  let idx   = select(k, kNext, vertInTri == 1u);\r
  let angle = f32(idx) * kAngleStep + kAngleBias;\r
  let r     = DIAMOND_GIRDLE_R_CIRC * d;\r
  return vec3<f32>(r * cos(angle), r * sin(angle), -DIAMOND_H_GIRDLE_HALF * d);\r
}\r
\r
// -----------------------------------------------------------------------------\r
// Analytical back-exit — Phase B\r
// -----------------------------------------------------------------------------\r
//\r
// Mirror of src/math/diamondExit.ts (see that file for the motivation).\r
// Returns a CubeExit { pWorld, nBack } where \`nBack\` is the INWARD normal\r
// (i.e. \`-nOut\`) matching cubeAnalyticExit / plateAnalyticExit so backExit()\r
// can dispatch uniformly. Any drift between this function and the JS mirror\r
// surfaces as a failed \`tests/diamondAnalyticExit.test.ts\` case — the JS\r
// impl is the regression pin.\r
//\r
// Algorithm:\r
//   1. Rotate ray into the diamond's local frame (around pill.center).\r
//   2. Test all 57 unfolded facet planes (1 table + 8 bezel + 8 star +\r
//      16 upper half + 16 lower half + 8 pavilion) and the girdle\r
//      cylinder. Keep the MIN positive t. The exit normal is the winning\r
//      facet's outward normal (exact — no finite-diff degeneracy at facet\r
//      edges, which was the root cause of the "other facets suddenly\r
//      appearing" artifact during tumble).\r
//   3. Rotate the exit point back to world space; return with the normal\r
//      negated (convention: \`nBack = -nOut\`).\r
//\r
// DIAMOND_BOUNCE_EPS is the facet-to-facet self-hit tolerance used here,\r
// NOT the project-wide sphere-tracer \`HIT_EPS = 0.25 px\`. The sphere\r
// tracer's threshold is too loose for bounce-chain exits — adjacent\r
// diamond facets can be within 0.1 px of each other at the default size,\r
// and a 0.25 px floor would silently discard legitimate nearby hits\r
// (e.g. upper-half→girdle second bounces that complete in ~0.08 px), so\r
// the min-t search would roll through to a wrong far facet. 0.01 px\r
// clears the floating-point noise around the previous facet's plane\r
// (where dot(n_prev, ro_bounce) ≈ offset_prev) while still admitting any\r
// real next-facet hit. The JS mirror uses \`DIAMOND_HIT_EPS = 1e-6\` in\r
// unit-diameter space (~2e-4 px at d=200), even tighter because f64 has\r
// the headroom; see src/math/diamondExit.ts.\r
const DIAMOND_BOUNCE_EPS: f32 = 0.01;\r
fn diamondAnalyticExit(roWorld: vec3<f32>, rdWorld: vec3<f32>, pillIdx: u32) -> CubeExit {\r
  let pill = frame.pills[pillIdx];\r
  let d    = frame.diamondSize;\r
\r
  // World → local. Rotation is orthonormal, so rdL stays unit length if\r
  // rdWorld was. No translation for rdL (direction is translation-invariant).\r
  let roL = frame.diamondRot * (roWorld - pill.center);\r
  let rdL = frame.diamondRot * rdWorld;\r
\r
  // Running min-t tracker. The initial normal is ZERO (not a unit vector)\r
  // so that "nothing was hit" is distinguishable at the caller: after the\r
  // facet/cylinder sweep, \`dot(bestN, bestN) < 0.5\` means the ray missed\r
  // every surface and the exit is a sentinel, not a real intersection.\r
  // This shouldn't fire for an interior ray but DOES fire in degenerate\r
  // bounce-chain conditions (e.g. ro on a shared vertex with rd exiting\r
  // through multiple coincident planes).\r
  //\r
  // How this sentinel propagates safely: the wavelength loop calls\r
  // \`refract(bouncedR1, exN.nBack, ior)\` on the returned struct. For\r
  // ior = n_d > 1 (glass → vacuum exit), \`refract\` with a zero N hits\r
  // the \`k = 1 - eta² * (1 - dot² = 0) = 1 - ior² < 0\` branch and\r
  // returns the zero vector. The downstream \`trialDot < 1e-4\` TIR gate\r
  // then routes into the chain's exhaustion fallback (bg or hot pink).\r
  // It does NOT propagate a bogus unit-normal as if a real facet had\r
  // been hit. A future caller that consumes \`nBack\` WITHOUT going\r
  // through refract (e.g. direct Fresnel evaluation) must add an\r
  // explicit \`dot(nBack, nBack) > 0.5\` guard.\r
  var bestT: f32            = 1.0e30;\r
  var bestN: vec3<f32>      = vec3<f32>(0.0, 0.0, 0.0);\r
\r
  // ---- Table cap (+Z plane at z = H_TOP · d) ----\r
  if (rdL.z > 0.0) {\r
    let tTable = (DIAMOND_H_TOP * d - roL.z) / rdL.z;\r
    if (tTable > DIAMOND_BOUNCE_EPS && tTable < bestT) {\r
      bestT = tTable;\r
      bestN = vec3<f32>(0.0, 0.0, 1.0);\r
    }\r
  }\r
\r
  // ---- Bezel (8) ----\r
  let oBezel = DIAMOND_BEZEL_O * d;\r
  for (var i: u32 = 0u; i < 8u; i = i + 1u) {\r
    let n = DIAMOND_BEZEL_N_ARR[i];\r
    let denom = dot(n, rdL);\r
    if (denom > 0.0) {\r
      let t = (oBezel - dot(n, roL)) / denom;\r
      if (t > DIAMOND_BOUNCE_EPS && t < bestT) {\r
        bestT = t; bestN = n;\r
      }\r
    }\r
  }\r
\r
  // ---- Star (8) ----\r
  let oStar = DIAMOND_STAR_O * d;\r
  for (var i: u32 = 0u; i < 8u; i = i + 1u) {\r
    let n = DIAMOND_STAR_N_ARR[i];\r
    let denom = dot(n, rdL);\r
    if (denom > 0.0) {\r
      let t = (oStar - dot(n, roL)) / denom;\r
      if (t > DIAMOND_BOUNCE_EPS && t < bestT) {\r
        bestT = t; bestN = n;\r
      }\r
    }\r
  }\r
\r
  // ---- Upper half (16) ----\r
  let oUhalf = DIAMOND_UPPER_HALF_O * d;\r
  for (var i: u32 = 0u; i < 16u; i = i + 1u) {\r
    let n = DIAMOND_UPPER_HALF_N_ARR[i];\r
    let denom = dot(n, rdL);\r
    if (denom > 0.0) {\r
      let t = (oUhalf - dot(n, roL)) / denom;\r
      if (t > DIAMOND_BOUNCE_EPS && t < bestT) {\r
        bestT = t; bestN = n;\r
      }\r
    }\r
  }\r
\r
  // ---- Lower half (16) ----\r
  let oLhalf = DIAMOND_LOWER_HALF_O * d;\r
  for (var i: u32 = 0u; i < 16u; i = i + 1u) {\r
    let n = DIAMOND_LOWER_HALF_N_ARR[i];\r
    let denom = dot(n, rdL);\r
    if (denom > 0.0) {\r
      let t = (oLhalf - dot(n, roL)) / denom;\r
      if (t > DIAMOND_BOUNCE_EPS && t < bestT) {\r
        bestT = t; bestN = n;\r
      }\r
    }\r
  }\r
\r
  // ---- Pavilion mains (8) ----\r
  let oPav = DIAMOND_PAVILION_O * d;\r
  for (var i: u32 = 0u; i < 8u; i = i + 1u) {\r
    let n = DIAMOND_PAVILION_N_ARR[i];\r
    let denom = dot(n, rdL);\r
    if (denom > 0.0) {\r
      let t = (oPav - dot(n, roL)) / denom;\r
      if (t > DIAMOND_BOUNCE_EPS && t < bestT) {\r
        bestT = t; bestN = n;\r
      }\r
    }\r
  }\r
\r
  // ---- Girdle cylinder ----\r
  // Radius R_GIRDLE · d in the XY plane; z-band [-H_GIRDLE_HALF · d, +].\r
  // Interior ray ⇒ c < 0 ⇒ the OUTGOING root is (-b + √disc)/(2a). The\r
  // a > 1e-6 guard skips near-vertical rays (no cylinder contribution).\r
  let a = rdL.x * rdL.x + rdL.y * rdL.y;\r
  if (a > 1.0e-6) {\r
    let b = 2.0 * (roL.x * rdL.x + roL.y * rdL.y);\r
    let rG = DIAMOND_R_GIRDLE * d;\r
    let c  = roL.x * roL.x + roL.y * roL.y - rG * rG;\r
    let disc = b * b - 4.0 * a * c;\r
    if (disc >= 0.0) {\r
      let t = (-b + sqrt(disc)) / (2.0 * a);\r
      if (t > DIAMOND_BOUNCE_EPS && t < bestT) {\r
        let z  = roL.z + t * rdL.z;\r
        let gh = DIAMOND_H_GIRDLE_HALF * d;\r
        // Slack the band check by DIAMOND_BOUNCE_EPS on each side —\r
        // floating-point near-misses at the exact girdle/facet\r
        // transition should still register. Same spirit as the\r
        // DIAMOND_BOUNCE_EPS guard on the plane tests above.\r
        if (z >= -gh - DIAMOND_BOUNCE_EPS && z <= gh + DIAMOND_BOUNCE_EPS) {\r
          let px = roL.x + t * rdL.x;\r
          let py = roL.y + t * rdL.y;\r
          let invLen = inverseSqrt(px * px + py * py);\r
          bestT = t;\r
          bestN = vec3<f32>(px * invLen, py * invLen, 0.0);\r
        }\r
      }\r
    }\r
  }\r
\r
  // Miss every facet (e.g. ro on a bad boundary, parallel/degenerate rd).\r
  // Do NOT build pL with bestT still at the sentinels: would poison the TIR\r
  // chain with an enormous \`pWorld\` and a bogus nBack. Zero \`nBack\` makes\r
  // \`refract\` fail; callers must not advance \`curP\` from a miss.\r
  if (dot(bestN, bestN) < 0.5) {\r
    return CubeExit(roWorld, vec3<f32>(0.0, 0.0, 0.0));\r
  }\r
\r
  // Local exit point, then local → world (inverse rotation = transpose).\r
  let pL     = roL + rdL * bestT;\r
  let rotT   = transpose(frame.diamondRot);\r
  let pWorld = rotT * pL + pill.center;\r
  let nOut   = rotT * bestN;\r
  // CubeExit's \`nBack\` convention is the INWARD normal (same sign as\r
  // -sceneNormal). Caller uses it in refract() where the inside-facing\r
  // form is what the Snell math expects.\r
  return CubeExit(pWorld, -nOut);\r
}\r
\r
struct DiamondFrontHit {\r
  ok:     bool,\r
  pWorld: vec3<f32>,\r
  nFront: vec3<f32>,\r
  pillIdx: u32,\r
};\r
\r
struct DiamondCandidateWindow {\r
  mode:      i32,         // 0 = all, 1 = filtered, 2 = none\r
  centerDir: vec2<f32>,\r
  cosMin:    f32,\r
};\r
\r
const DIAMOND_STEP_PI_4: f32 = 0.7853981633974483;\r
const DIAMOND_STEP_PI_8: f32 = 0.39269908169872414;\r
\r
fn diamondCandidateWindow(\r
  rdL: vec3<f32>,\r
  normalXYLen: f32,\r
  nz: f32,\r
  stepRad: f32,\r
  wantsPositiveDenom: bool,\r
) -> DiamondCandidateWindow {\r
  let rho = length(rdL.xy);\r
  if (rho < 1.0e-6 || normalXYLen < 1.0e-6) {\r
    return DiamondCandidateWindow(0, vec2<f32>(1.0, 0.0), -1.0);\r
  }\r
\r
  let threshold = -(nz * rdL.z) / (normalXYLen * rho);\r
  let k         = select(-threshold, threshold, wantsPositiveDenom);\r
  if (k >= 1.0) {\r
    return DiamondCandidateWindow(2, vec2<f32>(1.0, 0.0), 2.0);\r
  }\r
  if (k <= -1.0) {\r
    return DiamondCandidateWindow(0, vec2<f32>(1.0, 0.0), -1.0);\r
  }\r
\r
  let dir       = rdL.xy / rho;\r
  let centerDir = select(-dir, dir, wantsPositiveDenom);\r
  let cosMin    = cos(acos(clamp(k, -1.0, 1.0)) + stepRad * 0.5 + 1.0e-3);\r
  return DiamondCandidateWindow(1, centerDir, cosMin);\r
}\r
\r
fn diamondWindowAccept(n: vec3<f32>, window: DiamondCandidateWindow) -> bool {\r
  if (window.mode == 0) { return true; }\r
  if (window.mode == 2) { return false; }\r
  let nxyLen2 = max(dot(n.xy, n.xy), 1.0e-8);\r
  let nxyDir  = n.xy * inverseSqrt(nxyLen2);\r
  return dot(nxyDir, window.centerDir) >= window.cosMin;\r
}\r
\r
fn pointInsideDiamondLocal(p: vec3<f32>, d: f32, eps: f32) -> bool {\r
  if (p.z > DIAMOND_H_TOP * d + eps) { return false; }\r
  if (length(p.xy) > DIAMOND_R_GIRDLE * d + eps) { return false; }\r
\r
  let oBezel = DIAMOND_BEZEL_O * d;\r
  for (var i: u32 = 0u; i < 8u; i = i + 1u) {\r
    let n = DIAMOND_BEZEL_N_ARR[i];\r
    if (dot(n, p) - oBezel > eps) { return false; }\r
  }\r
\r
  let oStar = DIAMOND_STAR_O * d;\r
  for (var i: u32 = 0u; i < 8u; i = i + 1u) {\r
    let n = DIAMOND_STAR_N_ARR[i];\r
    if (dot(n, p) - oStar > eps) { return false; }\r
  }\r
\r
  let oUhalf = DIAMOND_UPPER_HALF_O * d;\r
  for (var i: u32 = 0u; i < 16u; i = i + 1u) {\r
    let n = DIAMOND_UPPER_HALF_N_ARR[i];\r
    if (dot(n, p) - oUhalf > eps) { return false; }\r
  }\r
\r
  let oLhalf = DIAMOND_LOWER_HALF_O * d;\r
  for (var i: u32 = 0u; i < 16u; i = i + 1u) {\r
    let n = DIAMOND_LOWER_HALF_N_ARR[i];\r
    if (dot(n, p) - oLhalf > eps) { return false; }\r
  }\r
\r
  let oPav = DIAMOND_PAVILION_O * d;\r
  for (var i: u32 = 0u; i < 8u; i = i + 1u) {\r
    let n = DIAMOND_PAVILION_N_ARR[i];\r
    if (dot(n, p) - oPav > eps) { return false; }\r
  }\r
\r
  return true;\r
}\r
\r
fn diamondAnalyticHit(roWorld: vec3<f32>, rdWorld: vec3<f32>, pillIdx: u32) -> DiamondFrontHit {\r
  let pill = frame.pills[pillIdx];\r
  let d    = frame.diamondSize;\r
  let roL  = frame.diamondRot * (roWorld - pill.center);\r
  let rdL  = frame.diamondRot * rdWorld;\r
\r
  var bestT: f32       = 1.0e30;\r
  var bestN: vec3<f32> = vec3<f32>(0.0);\r
\r
  if (rdL.z < 0.0) {\r
    let tTable = (DIAMOND_H_TOP * d - roL.z) / rdL.z;\r
    if (tTable > DIAMOND_BOUNCE_EPS && tTable < bestT) {\r
      let pL = roL + rdL * tTable;\r
      if (pointInsideDiamondLocal(pL, d, HIT_EPS)) {\r
        bestT = tTable;\r
        bestN = vec3<f32>(0.0, 0.0, 1.0);\r
      }\r
    }\r
  }\r
\r
  let bezelWindow = diamondCandidateWindow(\r
    rdL,\r
    length(DIAMOND_BEZEL_N_ARR[0].xy),\r
    DIAMOND_BEZEL_N_ARR[0].z,\r
    DIAMOND_STEP_PI_4,\r
    false,\r
  );\r
  let oBezel = DIAMOND_BEZEL_O * d;\r
  for (var i: u32 = 0u; i < 8u; i = i + 1u) {\r
    let n = DIAMOND_BEZEL_N_ARR[i];\r
    if (!diamondWindowAccept(n, bezelWindow)) { continue; }\r
    let denom = dot(n, rdL);\r
    if (denom >= 0.0) { continue; }\r
    let t = (oBezel - dot(n, roL)) / denom;\r
    if (t > DIAMOND_BOUNCE_EPS && t < bestT) {\r
      let pL = roL + rdL * t;\r
      if (pointInsideDiamondLocal(pL, d, HIT_EPS)) {\r
        bestT = t;\r
        bestN = n;\r
      }\r
    }\r
  }\r
\r
  let starWindow = diamondCandidateWindow(\r
    rdL,\r
    length(DIAMOND_STAR_N_ARR[0].xy),\r
    DIAMOND_STAR_N_ARR[0].z,\r
    DIAMOND_STEP_PI_4,\r
    false,\r
  );\r
  let oStar = DIAMOND_STAR_O * d;\r
  for (var i: u32 = 0u; i < 8u; i = i + 1u) {\r
    let n = DIAMOND_STAR_N_ARR[i];\r
    if (!diamondWindowAccept(n, starWindow)) { continue; }\r
    let denom = dot(n, rdL);\r
    if (denom >= 0.0) { continue; }\r
    let t = (oStar - dot(n, roL)) / denom;\r
    if (t > DIAMOND_BOUNCE_EPS && t < bestT) {\r
      let pL = roL + rdL * t;\r
      if (pointInsideDiamondLocal(pL, d, HIT_EPS)) {\r
        bestT = t;\r
        bestN = n;\r
      }\r
    }\r
  }\r
\r
  let uhalfWindow = diamondCandidateWindow(\r
    rdL,\r
    length(DIAMOND_UPPER_HALF_N_ARR[0].xy),\r
    DIAMOND_UPPER_HALF_N_ARR[0].z,\r
    DIAMOND_STEP_PI_8,\r
    false,\r
  );\r
  let oUhalf = DIAMOND_UPPER_HALF_O * d;\r
  for (var i: u32 = 0u; i < 16u; i = i + 1u) {\r
    let n = DIAMOND_UPPER_HALF_N_ARR[i];\r
    if (!diamondWindowAccept(n, uhalfWindow)) { continue; }\r
    let denom = dot(n, rdL);\r
    if (denom >= 0.0) { continue; }\r
    let t = (oUhalf - dot(n, roL)) / denom;\r
    if (t > DIAMOND_BOUNCE_EPS && t < bestT) {\r
      let pL = roL + rdL * t;\r
      if (pointInsideDiamondLocal(pL, d, HIT_EPS)) {\r
        bestT = t;\r
        bestN = n;\r
      }\r
    }\r
  }\r
\r
  let lhalfWindow = diamondCandidateWindow(\r
    rdL,\r
    length(DIAMOND_LOWER_HALF_N_ARR[0].xy),\r
    DIAMOND_LOWER_HALF_N_ARR[0].z,\r
    DIAMOND_STEP_PI_8,\r
    false,\r
  );\r
  let oLhalf = DIAMOND_LOWER_HALF_O * d;\r
  for (var i: u32 = 0u; i < 16u; i = i + 1u) {\r
    let n = DIAMOND_LOWER_HALF_N_ARR[i];\r
    if (!diamondWindowAccept(n, lhalfWindow)) { continue; }\r
    let denom = dot(n, rdL);\r
    if (denom >= 0.0) { continue; }\r
    let t = (oLhalf - dot(n, roL)) / denom;\r
    if (t > DIAMOND_BOUNCE_EPS && t < bestT) {\r
      let pL = roL + rdL * t;\r
      if (pointInsideDiamondLocal(pL, d, HIT_EPS)) {\r
        bestT = t;\r
        bestN = n;\r
      }\r
    }\r
  }\r
\r
  let pavWindow = diamondCandidateWindow(\r
    rdL,\r
    length(DIAMOND_PAVILION_N_ARR[0].xy),\r
    DIAMOND_PAVILION_N_ARR[0].z,\r
    DIAMOND_STEP_PI_4,\r
    false,\r
  );\r
  let oPav = DIAMOND_PAVILION_O * d;\r
  for (var i: u32 = 0u; i < 8u; i = i + 1u) {\r
    let n = DIAMOND_PAVILION_N_ARR[i];\r
    if (!diamondWindowAccept(n, pavWindow)) { continue; }\r
    let denom = dot(n, rdL);\r
    if (denom >= 0.0) { continue; }\r
    let t = (oPav - dot(n, roL)) / denom;\r
    if (t > DIAMOND_BOUNCE_EPS && t < bestT) {\r
      let pL = roL + rdL * t;\r
      if (pointInsideDiamondLocal(pL, d, HIT_EPS)) {\r
        bestT = t;\r
        bestN = n;\r
      }\r
    }\r
  }\r
\r
  let a = rdL.x * rdL.x + rdL.y * rdL.y;\r
  if (a > 1.0e-6) {\r
    let b = 2.0 * (roL.x * rdL.x + roL.y * rdL.y);\r
    let rG = DIAMOND_R_GIRDLE * d;\r
    let c  = roL.x * roL.x + roL.y * roL.y - rG * rG;\r
    let disc = b * b - 4.0 * a * c;\r
    if (disc >= 0.0) {\r
      let sqrtDisc = sqrt(disc);\r
      let t0 = (-b - sqrtDisc) / (2.0 * a);\r
      let t1 = (-b + sqrtDisc) / (2.0 * a);\r
      for (var rootIdx: u32 = 0u; rootIdx < 2u; rootIdx = rootIdx + 1u) {\r
        let t = select(t1, t0, rootIdx == 0u);\r
        if (t > DIAMOND_BOUNCE_EPS && t < bestT) {\r
          let pL = roL + rdL * t;\r
          if (pointInsideDiamondLocal(pL, d, HIT_EPS)) {\r
            let invLen = inverseSqrt(max(dot(pL.xy, pL.xy), 1.0e-8));\r
            bestT = t;\r
            bestN = vec3<f32>(pL.x * invLen, pL.y * invLen, 0.0);\r
          }\r
        }\r
      }\r
    }\r
  }\r
\r
  if (dot(bestN, bestN) < 0.5) {\r
    return DiamondFrontHit(false, roWorld, vec3<f32>(0.0), pillIdx);\r
  }\r
\r
  let pL     = roL + rdL * bestT;\r
  let rotT   = transpose(frame.diamondRot);\r
  let pWorld = rotT * pL + pill.center;\r
  let nWorld = rotT * bestN;\r
  return DiamondFrontHit(true, pWorld, nWorld, pillIdx);\r
}\r
\r
fn diamondAnalyticHitScene(roWorld: vec3<f32>, rdWorld: vec3<f32>) -> DiamondFrontHit {\r
  var bestT   = 1.0e30;\r
  var bestHit = DiamondFrontHit(false, roWorld, vec3<f32>(0.0), 0u);\r
  for (var pillIdx: u32 = 0u; pillIdx < u32(frame.pillCount); pillIdx = pillIdx + 1u) {\r
    let hit = diamondAnalyticHit(roWorld, rdWorld, pillIdx);\r
    if (!hit.ok) { continue; }\r
    let t = dot(hit.pWorld - roWorld, rdWorld);\r
    if (t > DIAMOND_BOUNCE_EPS && t < bestT) {\r
      bestT   = t;\r
      bestHit = hit;\r
    }\r
  }\r
  return bestHit;\r
}\r
`,Un=50,Hn=400,$o=.53,Xo=34.5,Ko=40.75,Yo=22,Zo=39.9,Jo=42,Qo=.02,es=0,ts=0,sn=Math.PI/8,ns=Math.PI/16,rs=Math.PI/16,et=Math.PI/180,Ei=Xo*et,Pi=Ko*et,is=Yo*et,as=Zo*et,os=Jo*et,we=.5,Wn=we*$o,Rr=Wn*Math.cos(Math.PI/8),ss=(we-Wn)*Math.tan(Ei),ls=we*Math.tan(Pi),We=Qo/2,Ci=We+ss,ds=-(We+ls);function xt(t,e,n,r){const i=Math.cos(t)*Math.sin(e),a=Math.sin(t)*Math.sin(e),o=n*Math.cos(e),s=r[0]*i+r[1]*a+r[2]*o;return{nx:i,ny:a,nz:o,offset:s}}const Si=xt(es,Ei,1,[we,0,We]),Ai=xt(sn,is,1,[Rr*Math.cos(sn),Rr*Math.sin(sn),Ci]),Li=xt(ns,as,1,[we,0,We]),ki=xt(rs,os,-1,[we,0,-We]),Ti=xt(ts,Pi,-1,[we,0,-We]);function cs(t,e){const n=Math.cos(e),r=Math.sin(e);return[n*t[0]-r*t[1],r*t[0]+n*t[1],t[2]]}function yt(t,e,n){const r=[t.nx,t.ny,t.nz],i=[];for(let a=0;a<e;a++)i.push(cs(r,a*n));return i}const ps=yt(Si,8,Math.PI/4),us=yt(Ai,8,Math.PI/4),hs=yt(Li,16,Math.PI/8),ms=yt(ki,16,Math.PI/8),fs=yt(Ti,8,Math.PI/4),vs=-20*et,bs=.3,jn=["free","top","side","bottom"];function gs(t){const e=new Float32Array(12);let n=1,r=0,i=0,a=0,o=1,s=0,l=0,d=0,c=1;if(t!=="top")if(t==="side")a=0,o=0,s=1,l=0,d=-1,c=0;else if(t==="bottom")o=-1,c=-1;else{const u=t;throw new Error(`diamondViewRotationColumns: unknown view ${String(u)}`)}return e[0]=n,e[1]=a,e[2]=l,e[4]=r,e[5]=o,e[6]=d,e[8]=i,e[9]=s,e[10]=c,e}function Ir(t){if(!Number.isFinite(t))throw new Error(`diamondRotationColumns: time must be finite, got ${t}`);const e=t*bs,n=vs,r=Math.cos(e),i=Math.sin(e),a=Math.cos(n),o=Math.sin(n),s=new Float32Array(12);return s[0]=r,s[1]=o*i,s[2]=-a*i,s[4]=0,s[5]=a,s[6]=o,s[8]=i,s[9]=-o*r,s[10]=a*r,s}function Q(t){return Number.isInteger(t)?`${t}.0`:t.toPrecision(9)}function ot(t,e){return`const ${t}_N: vec3<f32> = vec3<f32>(${Q(e.nx)}, ${Q(e.ny)}, ${Q(e.nz)});
const ${t}_O: f32       = ${Q(e.offset)};
`}function st(t,e){const n=e.length,r=e.map(i=>`  vec3<f32>(${Q(i[0])}, ${Q(i[1])}, ${Q(i[2])})`).join(`,
`);return`const ${t}_N_ARR: array<vec3<f32>, ${n}> = array<vec3<f32>, ${n}>(
${r}
);
`}const _s=46,Di=_s*3,Ri=36;function ws(){const t=we/Math.cos(Math.PI/8);return["// ---- generated by src/math/diamond.ts — do not edit here ----",`const DIAMOND_H_TOP:             f32 = ${Q(Ci)};`,`const DIAMOND_H_BOT:             f32 = ${Q(ds)};`,`const DIAMOND_H_GIRDLE_HALF:     f32 = ${Q(We)};`,`const DIAMOND_R_GIRDLE:          f32 = ${Q(we)};`,`const DIAMOND_R_TABLE_VERTEX:    f32 = ${Q(Wn)};`,`const DIAMOND_GIRDLE_R_CIRC:     f32 = ${Q(t)};`,`const CUBE_PROXY_VERT_COUNT:     u32 = ${Ri}u;`,`const DIAMOND_PROXY_VERT_COUNT:  u32 = ${Di}u;`,ot("DIAMOND_BEZEL",Si),ot("DIAMOND_STAR",Ai),ot("DIAMOND_UPPER_HALF",Li),ot("DIAMOND_LOWER_HALF",ki),ot("DIAMOND_PAVILION",Ti),st("DIAMOND_BEZEL",ps),st("DIAMOND_STAR",us),st("DIAMOND_UPPER_HALF",hs),st("DIAMOND_LOWER_HALF",ms),st("DIAMOND_PAVILION",fs),"// ---- end generated ----",""].join(`
`)}const xs=Math.max(Ri,Di);async function ys(t,e,n,r,i){const{device:a}=t,o=[Fo,zo,qo,Uo,Ho,Wo,jo,Go].join(`
`),s=a.createShaderModule({label:"dispersion",code:ws()+Bo+`
`+o}),l=await s.getCompilationInfo();for(const h of l.messages){const E=`[WGSL ${h.type}] line ${h.lineNum}:${h.linePos}: ${h.message}`;h.type==="error"?console.error(E):h.type==="warning"?console.warn(E):console.info(E)}if(l.messages.some(h=>h.type==="error"))throw new Error("WGSL shader compile failed — see console for diagnostics");const d=[{format:"rgba16float"},{format:"rgba16float"}],c=a.createBindGroupLayout({label:"frame-bgl",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:4,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:5,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:6,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}]}),u=a.createPipelineLayout({bindGroupLayouts:[c]}),p=await a.createRenderPipelineAsync({label:"bg-pipeline",layout:u,vertex:{module:s,entryPoint:"vs_main"},fragment:{module:s,entryPoint:"fs_bg",targets:d},primitive:{topology:"triangle-list"}}),w=await a.createRenderPipelineAsync({label:"proxy-pipeline",layout:u,vertex:{module:s,entryPoint:"vs_proxy"},fragment:{module:s,entryPoint:"fs_main",targets:d},primitive:{topology:"triangle-list",cullMode:"back",frontFace:"cw"}}),f=await a.createRenderPipelineAsync({label:"diamond-proxy-pipeline",layout:u,vertex:{module:s,entryPoint:"vs_proxy"},fragment:{module:s,entryPoint:"fs_main_diamond",targets:d},primitive:{topology:"triangle-list",cullMode:"back",frontFace:"cw"}});return{bg:p,proxy:w,diamondProxy:f,bindGroups:Ii(t,p,e,n,r,i)}}function Ii(t,e,n,r,i,a){const o=e.getBindGroupLayout(0),s=l=>t.device.createBindGroup({label:`frame-bind-${l}`,layout:o,entries:[{binding:0,resource:{buffer:n}},{binding:1,resource:r.texture.createView()},{binding:2,resource:r.sampler},{binding:3,resource:a.views[l]},{binding:4,resource:a.sampler},{binding:5,resource:i.texture.createView()},{binding:6,resource:i.sampler}]});return[s(0),s(1)]}function lt(t,e,n,r,i,a){e.bindGroups=Ii(t,e.bg,n,r,i,a)}function Es(t,e,n,r,i,a,o){const s=e.current===0?1:0,l=e.views[e.current],d=a.beginRenderPass({label:"scene-pass",colorAttachments:[{view:n.view,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}},{view:l,loadOp:"load",storeOp:"store"}],...o?{timestampWrites:o}:{}});d.setPipeline(t.bg),d.setBindGroup(0,t.bindGroups[s]),d.draw(3,1,0,0),r>0&&(d.setPipeline(i===4?t.diamondProxy:t.proxy),d.draw(xs,r,0,0)),d.end()}const Nr=new WeakMap,Ps=`
struct Vout {
  @builtin(position) pos: vec4<f32>,
  @location(0)       uv:  vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) i: u32) -> Vout {
  // Fullscreen triangle covering [-1,1]^2 in NDC / [0,1]^2 in UV.
  let x = f32((i << 1u) & 2u);
  let y = f32(i & 2u);
  var o: Vout;
  o.uv  = vec2<f32>(x, y);
  o.pos = vec4<f32>(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  return o;
}

@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var tex:  texture_2d<f32>;

@fragment
fn fs(v: Vout) -> @location(0) vec4<f32> {
  return textureSample(tex, samp, v.uv);
}
`;function Ni(t){let e=Nr.get(t);return e||(e={pipelines:new Map,sampler:t.createSampler({label:"mipmap-blit",magFilter:"linear",minFilter:"linear"})},Nr.set(t,e)),e}function Cs(t,e){const n=Ni(t),r=n.pipelines.get(e);if(r)return r;const i=t.createShaderModule({label:"mipmap-blit",code:Ps});t.pushErrorScope("validation");const a=t.createRenderPipeline({label:`mipmap-blit-${e}`,layout:"auto",vertex:{module:i,entryPoint:"vs"},fragment:{module:i,entryPoint:"fs",targets:[{format:e}]},primitive:{topology:"triangle-list"}});return t.popErrorScope().then(o=>{o&&(console.error(`[mipmap] pipeline creation failed for ${e}: ${o.message}`),n.pipelines.delete(e))}).catch(o=>{console.error("[mipmap] popErrorScope rejected (device lost?):",o),n.pipelines.delete(e)}),n.pipelines.set(e,a),a}function Oi(t,e){return Math.floor(Math.log2(Math.max(t,e)))+1}function Mi(t,e,n,r){if(r<=1)return;const i=Cs(t,n),a=Ni(t).sampler,o=t.createCommandEncoder({label:"mipmap-gen"});for(let s=1;s<r;s++){const l=e.createView({baseMipLevel:s-1,mipLevelCount:1}),d=e.createView({baseMipLevel:s,mipLevelCount:1}),c=t.createBindGroup({layout:i.getBindGroupLayout(0),entries:[{binding:0,resource:a},{binding:1,resource:l}]}),u=o.beginRenderPass({colorAttachments:[{view:d,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:0}}]});u.setPipeline(i),u.setBindGroup(0,c),u.draw(3),u.end()}t.queue.submit([o.finish()])}const qt="rgba8unorm-srgb",Ss=1920,As=1080;function Vi(t,e=Ss,n=As){return`https://picsum.photos/seed/${t}/${e}/${n}`}async function Or(t,e=Date.now()){const n=Vi(e);let r;try{const i=await fetch(n,{mode:"cors"});if(!i.ok)throw new Error(`Photo fetch failed: ${i.status} ${i.statusText} (${n})`);const a=await i.blob();r=await createImageBitmap(a,{colorSpaceConversion:"none"})}catch(i){return console.error("[photo] fetch/decode failed, using gradient fallback:",i),{photo:ks(t),usedGradientFallback:!0}}return{photo:Ls(t,r),usedGradientFallback:!1}}function Ls(t,e){const n=e.width,r=e.height,i=Oi(n,r),a=t.createTexture({label:"photo",size:[n,r,1],mipLevelCount:i,format:qt,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});return t.queue.copyExternalImageToTexture({source:e},{texture:a},[n,r,1]),e.close(),Mi(t,a,qt,i),{texture:a,sampler:Gn(t),width:n,height:r}}function ks(t){const r=new Uint8Array(262144);for(let o=0;o<256;o++){const s=o/255,l=Math.round(60+180*(1-s)),d=Math.round(80+140*Math.abs(.5-s)*2),c=Math.round(180-120*(1-s));for(let u=0;u<256;u++){const p=(o*256+u)*4;r[p+0]=l,r[p+1]=d,r[p+2]=c,r[p+3]=255}}const i=Oi(256,256),a=t.createTexture({label:"photo-fallback",size:[256,256,1],mipLevelCount:i,format:qt,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});return t.queue.writeTexture({texture:a},r,{bytesPerRow:256*4},[256,256,1]),Mi(t,a,qt,i),{texture:a,sampler:Gn(t),width:256,height:256}}const Mr=new WeakMap;function Gn(t){return Ts(t)}function Ts(t){let e=Mr.get(t);return e||(e=t.createSampler({magFilter:"linear",minFilter:"linear",mipmapFilter:"linear",addressModeU:"mirror-repeat",addressModeV:"mirror-repeat"}),Mr.set(t,e),e)}function ln(t){t.texture.destroy()}const Ds="rgba8unorm-srgb";function Rs(t){return typeof t.queue.copyElementImageToTexture=="function"}function Is(t,e){return e.parentElement===t}function Ns(t,e,n){const r=Math.max(1,Math.floor(e)),i=Math.max(1,Math.floor(n));return{texture:t.createTexture({label:"html-bg",size:[r,i,1],mipLevelCount:1,format:Ds,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT}),sampler:Gn(t),width:r,height:i}}function Vr(t){t.texture.destroy()}function Os(t,e,n){const r=t.copyElementImageToTexture;if(typeof r!="function")return!0;const i={texture:n,mipLevel:0,origin:{x:0,y:0,z:0},colorSpace:"srgb",premultipliedAlpha:!1};try{return r.call(t,e,i),!0}catch(a){return console.error("[html-bg] copyElementImageToTexture failed:",a),!1}}function Br(t){if(!Number.isFinite(t))throw new Error(`cubeRotationColumns: time must be finite, got ${t}`);const e=t*.31,n=t*.2,r=Math.cos(e),i=Math.sin(e),a=Math.cos(n),o=Math.sin(n),s=new Float32Array(12);return s[0]=a,s[1]=o,s[2]=0,s[4]=-o*r,s[5]=a*r,s[6]=i,s[8]=o*i,s[9]=-a*i,s[10]=r,s}function Fr(t){if(!Number.isFinite(t))throw new Error(`plateRotationColumns: time must be finite, got ${t}`);const e=t*.2,n=t*.3,r=Math.cos(e),i=Math.sin(e),a=Math.cos(n),o=Math.sin(n),s=new Float32Array(12);return s[0]=r,s[1]=o*i,s[2]=-a*i,s[4]=0,s[5]=a,s[6]=o,s[8]=i,s[9]=-o*r,s[10]=a*r,s}const Cn=8,Bi=20,Fi=12,zi=12,Ui=12,Hi=12,Sn=12,An=12,Wi=4,ji=8,Gi=4,qi=8,$i=Bi+Fi+zi+Ui+Hi+Sn+An+Wi+ji+Gi+qi*Cn,Ms=$i*4,m=new Float32Array($i);function Vs(t){return t.createBuffer({label:"frame",size:Ms,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST})}function Bs(t,e,n){m.fill(0),m[0]=n.resolution[0],m[1]=n.resolution[1],m[2]=n.photoSize[0],m[3]=n.photoSize[1],m[4]=n.n_d,m[5]=n.V_d,m[6]=n.sampleCount,m[7]=n.refractionStrength,m[8]=n.jitter,m[9]=n.refractionMode,m[10]=Math.min(n.pills.length,Cn),m[11]=n.applySrgbOetf?1:0,m[12]=n.shape,m[13]=n.time,m[14]=n.historyBlend,m[15]=n.heroLambda,m[16]=n.cameraZ,m[17]=n.projection,m[18]=n.debugProxy?1:0,m[19]=n.taaEnabled?1:0;let r=Bi;if(m.set(Br(n.sceneTime),r),r+=Fi,m.set(Br(n.prevSceneTime),r),r+=zi,m.set(Fr(n.sceneTime),r),r+=Ui,m.set(Fr(n.prevSceneTime),r),r+=Hi,n.diamondView==="free")m.set(Ir(n.sceneTime),r),r+=Sn,m.set(Ir(n.prevSceneTime),r),r+=An;else{const c=gs(n.diamondView);m.set(c,r),r+=Sn,m.set(c,r),r+=An}const i=r,a=n.waveAmp*n.waveFreq;m[i+0]=n.waveAmp,m[i+1]=n.waveFreq,m[i+2]=1/Math.sqrt(1+a*a),m[i+3]=n.sceneTime;const o=i+Wi;m[o+0]=n.diamondSize,m[o+1]=n.diamondWireframe?1:0,m[o+2]=n.diamondFacetColor?1:0,m[o+3]=n.diamondTirDebug?1:0,m[o+4]=Math.min(32,Math.max(1,Math.round(n.diamondTirMaxBounces)));const s=o+ji;m[s+0]=n.envmapExposure,m[s+1]=n.envmapRotation,m[s+2]=n.envmapEnabled?1:0,m[s+3]=n.smoothCurvature?1:0;const l=s+Gi,d=Math.min(n.pills.length,Cn);for(let c=0;c<d;c++){const u=n.pills[c],p=l+c*qi;m[p+0]=u.cx,m[p+1]=u.cy,m[p+2]=u.cz,m[p+3]=u.edgeR,m[p+4]=u.hx,m[p+5]=u.hy,m[p+6]=u.hz}t.queue.writeBuffer(e,0,m)}function Fs(t){const e=t.createQuerySet({label:"perf-timestamps",type:"timestamp",count:2}),n=[0,1].map(()=>({resolveBuf:t.createBuffer({label:"perf-resolve",size:2*8,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}),readBuf:t.createBuffer({label:"perf-read",size:2*8,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),inFlight:!1,mapping:!1}));let r=0;return{querySet:e,writes:{querySet:e,beginningOfPassWriteIndex:0,endOfPassWriteIndex:1},resolve(a){const o=n[r];o.inFlight||(a.resolveQuerySet(e,0,2,o.resolveBuf,0),a.copyBufferToBuffer(o.resolveBuf,0,o.readBuf,0,16),o.inFlight=!0,r=1-r)},async readMs(){const a=n[1-r];if(!a.inFlight||a.mapping)return null;a.mapping=!0;let o,s,l=!1;try{await a.readBuf.mapAsync(GPUMapMode.READ),l=!0;const d=a.readBuf.getMappedRange(),c=new BigUint64Array(d);o=c[0],s=c[1],a.readBuf.unmap(),l=!1}catch(d){throw l&&a.readBuf.unmap(),a.mapping=!1,a.inFlight=!1,d}return a.mapping=!1,a.inFlight=!1,s<o?null:Number(s-o)/1e6}}}function zs(t){let e=0;const n=new TextDecoder("ascii"),r=()=>{let f=e;for(;f<t.length&&t[f]!==10;)f++;const h=n.decode(t.subarray(e,f));return e=f+1,h},i=r();if(i!=="#?RADIANCE"&&!i.startsWith("#?"))throw new Error(`HDR: missing #?RADIANCE magic line, got: ${i}`);let a=null;for(;;){const f=r();if(f==="")break;if(f.startsWith("#"))continue;const h=f.indexOf("=");if(h<0)continue;const E=f.slice(0,h),v=f.slice(h+1);E==="FORMAT"&&(a=v)}if(a!=="32-bit_rle_rgbe")throw new Error(`HDR: unsupported FORMAT=${a}; only RGBE handled.`);const o=r(),s=/([-+]Y)\s+(\d+)\s+([-+]X)\s+(\d+)/.exec(o);if(!s)throw new Error(`HDR: unparseable resolution line: ${o}`);const l=s[1],d=parseInt(s[2],10);if(s[3]!=="+X")throw new Error(`HDR: reversed X direction (${s[3]}) not supported.`);const c=parseInt(s[4],10),u=l==="+Y";if(c<8||c>32767)throw new Error(`HDR: width=${c} requires legacy RLE (unsupported).`);const p=new Float32Array(c*d*3),w=new Uint8Array(c*4);for(let f=0;f<d;f++){if(e+4>t.length)throw new Error(`HDR: unexpected EOF at scanline ${f}`);const h=t[e],E=t[e+1],v=t[e+2],P=t[e+3];if(h!==2||E!==2||v&128)throw new Error(`HDR: scanline ${f} not in adaptive RLE format (got [${h}, ${E}, ${v}, ${P}])`);const x=v<<8|P;if(x!==c)throw new Error(`HDR: scanline ${f} width=${x} != image width=${c}`);e+=4;for(let _=0;_<4;_++){let I=0;for(;I<c;){if(e>=t.length)throw new Error(`HDR: EOF mid-RLE at scanline ${f}, channel ${_}, x=${I}`);const re=t[e++];if(re>128){const H=re-128;if(I+H>c||e>=t.length)throw new Error(`HDR: RLE run overflows scanline at y=${f} ch=${_}`);const oe=t[e++],G=_*c;for(let J=0;J<H;J++)w[G+I+J]=oe;I+=H}else{const H=re;if(I+H>c||e+H>t.length)throw new Error(`HDR: RLE dump overflows scanline at y=${f} ch=${_}`);const oe=_*c;for(let G=0;G<H;G++)w[oe+I+G]=t[e++];I+=H}}}const j=(u?d-1-f:f)*c*3;for(let _=0;_<c;_++){const I=w[_],re=w[_+c],H=w[_+c*2],oe=w[_+c*3];if(oe===0)p[j+_*3+0]=0,p[j+_*3+1]=0,p[j+_*3+2]=0;else{const G=Math.pow(2,oe-136);p[j+_*3+0]=I*G,p[j+_*3+1]=re*G,p[j+_*3+2]=H*G}}}return{width:c,height:d,rgb:p}}const Us="rgba16float";async function Hs(t,e){const n=await fetch(e,{mode:"cors"});if(!n.ok)throw new Error(`Envmap fetch failed: ${n.status} ${n.statusText} (${e})`);const r=new Uint8Array(await n.arrayBuffer()),i=zs(r);return Xi(t,i.width,i.height,i.rgb)}function Xi(t,e,n,r){if(r.length!==e*n*3)throw new Error(`Envmap upload: rgb length=${r.length} does not match ${e}×${n}×3.`);const i=e*n,a=new Uint16Array(i*4);for(let l=0;l<i;l++)a[l*4+0]=dn(cn(r[l*3+0])),a[l*4+1]=dn(cn(r[l*3+1])),a[l*4+2]=dn(cn(r[l*3+2])),a[l*4+3]=qs;const o=t.createTexture({label:"envmap",size:[e,n,1],format:Us,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),s=e*4*2;if(s%256!==0)throw new Error(`Envmap upload: width=${e} gives bytesPerRow=${s}, not a multiple of 256`);return t.queue.writeTexture({texture:o},a,{bytesPerRow:s,rowsPerImage:n},[e,n,1]),{__brand:"envmap",texture:o,sampler:$s(t),width:e,height:n}}function Ws(t){const r=new Float32Array(1536);for(let i=0;i<16;i++){const a=i/15,o=(1-a)*.3+a*.15,s=(1-a)*.5+a*.35,l=(1-a)*1.2+a*.1,d=1+.8*Math.exp(-Math.pow((a-.55)*8,2));for(let c=0;c<32;c++){const u=(i*32+c)*3;r[u+0]=o*d,r[u+1]=s*d,r[u+2]=l*d}}return Xi(t,32,16,r)}function zr(t){t.texture.destroy()}const Ki=new ArrayBuffer(4),js=new Float32Array(Ki),Gs=new Uint32Array(Ki);function dn(t){js[0]=t;const e=Gs[0],n=e>>>16&32768;let r=e>>>23&255,i=e&8388607;return r===255?n|31744|(i!==0?1:0):(r=r-127+15,r>=31?n|31744:r<=0?n:n|r<<10|i>>>13)}const qs=15360,Ft=65504;function cn(t){return t!==t?0:t>Ft?Ft:t<-Ft?-Ft:t}const Ur=new WeakMap;function $s(t){let e=Ur.get(t);return e||(e=t.createSampler({label:"envmap",magFilter:"linear",minFilter:"linear",mipmapFilter:"nearest",addressModeU:"repeat",addressModeV:"clamp-to-edge"}),Ur.set(t,e),e)}const Ye=[{slug:"studio_small_03",label:"Small Studio",kind:"studio"},{slug:"studio_small_08",label:"Small Studio 2",kind:"studio"},{slug:"studio_small_09",label:"Small Studio 3",kind:"studio"},{slug:"photo_studio_01",label:"Photo Studio",kind:"studio"},{slug:"brown_photostudio_02",label:"Brown Studio",kind:"studio"},{slug:"brown_photostudio_06",label:"Brown Studio 2",kind:"studio"},{slug:"neon_photostudio",label:"Neon Studio",kind:"studio"},{slug:"blue_photo_studio",label:"Blue Studio",kind:"studio"},{slug:"christmas_photo_studio_04",label:"Christmas Studio",kind:"studio"},{slug:"pine_attic",label:"Pine Attic",kind:"indoor"},{slug:"royal_esplanade",label:"Royal Esplanade",kind:"outdoor"},{slug:"kloofendal_43d_clear_puresky",label:"Clear Sky",kind:"outdoor"},{slug:"kloofendal_48d_partly_cloudy_puresky",label:"Partly Cloudy",kind:"outdoor"},{slug:"autumn_forest_04",label:"Autumn Forest",kind:"outdoor"},{slug:"spaichingen_hill",label:"Spaichingen Hill",kind:"outdoor"},{slug:"belfast_sunset_puresky",label:"Belfast Sunset",kind:"sunset"},{slug:"golden_gate_hills",label:"Golden Gate Hills",kind:"sunset"},{slug:"venice_sunset",label:"Venice Sunset",kind:"sunset"},{slug:"kiara_1_dawn",label:"Dawn",kind:"sunset"},{slug:"dikhololo_night",label:"Starry Night",kind:"night"},{slug:"satara_night",label:"Savanna Night",kind:"night"},{slug:"little_paris_eiffel_tower",label:"Paris",kind:"outdoor"},{slug:"shanghai_bund",label:"Shanghai",kind:"outdoor"}],Yi=Ye[0].slug,Zi=["1k","2k","4k"],Ji="2k";function Xs(t,e=Ji){return`https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${e}/${t}_${e}.hdr`}function Ks(t,e=Math.random){if(Ye.length<=1)return t;let n=t;for(;n===t;){const r=Math.floor(e()*Ye.length);n=Ye[r].slug}return n}function Qi(t){return Ye.some(e=>e.slug===t)}const Ht=8,ea=4,Ys=1;function $t(t){return t==="diamond"?Ys:ea}function ta(t,e,n){if(n.length!==0)for(;t.length<e;)t.push({...n[t.length%n.length]})}function Zs(t,e,n,r=ea){const i=t.length>Ht?t.slice(0,Ht).map(o=>({...o})):t.map(o=>({...o})),a=Math.min(r,Ht);return i.length>=a||ta(i,a,Xt(e,n)),i}function Hr(t,e,n,r){const i=Number.isFinite(r)?Math.floor(r):1,a=Math.min(Math.max(1,i),Ht),o=t.slice(0,a).map(s=>({...s}));return o.length>=a||ta(o,a,Xt(e,n)),o}function Xt(t,e){return[[.22,.31],[.49,.43],[.31,.59],[.67,.77]].map(([r,i])=>({cx:t*r,cy:e*i,cz:0,hx:150,hy:150,hz:150,edgeR:30}))}function Js(t,e,n,r=()=>0,i=()=>0,a=()=>{}){let o={kind:"idle"};const s=h=>{const E=t.getBoundingClientRect();return{x:(h.clientX-E.left)*n,y:(h.clientY-E.top)*n}},l=(h,E)=>{const v=r();for(let P=e.length-1;P>=0;P--){const x=e[P],W=h-x.cx,j=E-x.cy;if(v===2||v===3||v===4){const _=Math.max(x.hx,x.hy,x.hz)+(v===3?i():0);if(W*W+j*j<=_*_)return P}else if(Math.abs(W)<=x.hx&&Math.abs(j)<=x.hy)return P}return-1},d=h=>{if(o.kind==="dragging"){try{t.releasePointerCapture(h)}catch(E){console.debug("[pills] releasePointerCapture failed:",E)}o={kind:"idle"}}},c=h=>{const{x:E,y:v}=s(h),P=l(E,v);if(!(P<0)){o={kind:"dragging",pillIndex:P,offsetX:E-e[P].cx,offsetY:v-e[P].cy,pointerId:h.pointerId};try{t.setPointerCapture(h.pointerId)}catch(x){console.debug("[pills] setPointerCapture failed:",x)}}},u=h=>{if(o.kind!=="dragging")return;const{x:E,y:v}=s(h),P=e[o.pillIndex];if(!P){d(h.pointerId);return}const x=E-o.offsetX,W=v-o.offsetY;P.cx===x&&P.cy===W||(P.cx=x,P.cy=W,a())},p=h=>d(h.pointerId),w=()=>{o.kind==="dragging"&&d(o.pointerId)},f=()=>{document.hidden&&o.kind==="dragging"&&d(o.pointerId)};return t.addEventListener("pointerdown",c),t.addEventListener("pointermove",u),t.addEventListener("pointerup",p),t.addEventListener("pointercancel",p),window.addEventListener("blur",w),document.addEventListener("visibilitychange",f),()=>{o.kind==="dragging"&&d(o.pointerId),t.removeEventListener("pointerdown",c),t.removeEventListener("pointermove",u),t.removeEventListener("pointerup",p),t.removeEventListener("pointercancel",p),window.removeEventListener("blur",w),document.removeEventListener("visibilitychange",f)}}/*! Tweakpane 4.0.5 (c) 2016 cocopon, licensed under the MIT license. */function R(t){return t==null}function qn(t){return t!==null&&typeof t=="object"}function Ln(t){return t!==null&&typeof t=="object"}function Qs(t,e){if(t.length!==e.length)return!1;for(let n=0;n<t.length;n++)if(t[n]!==e[n])return!1;return!0}function ze(t,e){return Array.from(new Set([...Object.keys(t),...Object.keys(e)])).reduce((r,i)=>{const a=t[i],o=e[i];return Ln(a)&&Ln(o)?Object.assign(Object.assign({},r),{[i]:ze(a,o)}):Object.assign(Object.assign({},r),{[i]:i in e?o:a})},{})}function $n(t){return qn(t)?"target"in t:!1}const el={alreadydisposed:()=>"View has been already disposed",invalidparams:t=>`Invalid parameters for '${t.name}'`,nomatchingcontroller:t=>`No matching controller for '${t.key}'`,nomatchingview:t=>`No matching view for '${JSON.stringify(t.params)}'`,notbindable:()=>"Value is not bindable",notcompatible:t=>`Not compatible with  plugin '${t.id}'`,propertynotfound:t=>`Property '${t.name}' not found`,shouldneverhappen:()=>"This error should never happen"};class B{static alreadyDisposed(){return new B({type:"alreadydisposed"})}static notBindable(){return new B({type:"notbindable"})}static notCompatible(e,n){return new B({type:"notcompatible",context:{id:`${e}.${n}`}})}static propertyNotFound(e){return new B({type:"propertynotfound",context:{name:e}})}static shouldNeverHappen(){return new B({type:"shouldneverhappen"})}constructor(e){var n;this.message=(n=el[e.type](e.context))!==null&&n!==void 0?n:"Unexpected error",this.name=this.constructor.name,this.stack=new Error(this.message).stack,this.type=e.type}toString(){return this.message}}class Kt{constructor(e,n){this.obj_=e,this.key=n}static isBindable(e){return!(e===null||typeof e!="object"&&typeof e!="function")}read(){return this.obj_[this.key]}write(e){this.obj_[this.key]=e}writeProperty(e,n){const r=this.read();if(!Kt.isBindable(r))throw B.notBindable();if(!(e in r))throw B.propertyNotFound(e);r[e]=n}}class z{constructor(){this.observers_={}}on(e,n,r){var i;let a=this.observers_[e];return a||(a=this.observers_[e]=[]),a.push({handler:n,key:(i=r==null?void 0:r.key)!==null&&i!==void 0?i:n}),this}off(e,n){const r=this.observers_[e];return r&&(this.observers_[e]=r.filter(i=>i.key!==n)),this}emit(e,n){const r=this.observers_[e];r&&r.forEach(i=>{i.handler(n)})}}class tl{constructor(e,n){var r;this.constraint_=n==null?void 0:n.constraint,this.equals_=(r=n==null?void 0:n.equals)!==null&&r!==void 0?r:(i,a)=>i===a,this.emitter=new z,this.rawValue_=e}get constraint(){return this.constraint_}get rawValue(){return this.rawValue_}set rawValue(e){this.setRawValue(e,{forceEmit:!1,last:!0})}setRawValue(e,n){const r=n??{forceEmit:!1,last:!0},i=this.constraint_?this.constraint_.constrain(e):e,a=this.rawValue_;this.equals_(a,i)&&!r.forceEmit||(this.emitter.emit("beforechange",{sender:this}),this.rawValue_=i,this.emitter.emit("change",{options:r,previousRawValue:a,rawValue:i,sender:this}))}}class nl{constructor(e){this.emitter=new z,this.value_=e}get rawValue(){return this.value_}set rawValue(e){this.setRawValue(e,{forceEmit:!1,last:!0})}setRawValue(e,n){const r=n??{forceEmit:!1,last:!0},i=this.value_;i===e&&!r.forceEmit||(this.emitter.emit("beforechange",{sender:this}),this.value_=e,this.emitter.emit("change",{options:r,previousRawValue:i,rawValue:this.value_,sender:this}))}}class rl{constructor(e){this.emitter=new z,this.onValueBeforeChange_=this.onValueBeforeChange_.bind(this),this.onValueChange_=this.onValueChange_.bind(this),this.value_=e,this.value_.emitter.on("beforechange",this.onValueBeforeChange_),this.value_.emitter.on("change",this.onValueChange_)}get rawValue(){return this.value_.rawValue}onValueBeforeChange_(e){this.emitter.emit("beforechange",Object.assign(Object.assign({},e),{sender:this}))}onValueChange_(e){this.emitter.emit("change",Object.assign(Object.assign({},e),{sender:this}))}}function O(t,e){const n=e==null?void 0:e.constraint,r=e==null?void 0:e.equals;return!n&&!r?new nl(t):new tl(t,e)}function il(t){return[new rl(t),(e,n)=>{t.setRawValue(e,n)}]}class g{constructor(e){this.emitter=new z,this.valMap_=e;for(const n in this.valMap_)this.valMap_[n].emitter.on("change",()=>{this.emitter.emit("change",{key:n,sender:this})})}static createCore(e){return Object.keys(e).reduce((r,i)=>Object.assign(r,{[i]:O(e[i])}),{})}static fromObject(e){const n=this.createCore(e);return new g(n)}get(e){return this.valMap_[e].rawValue}set(e,n){this.valMap_[e].rawValue=n}value(e){return this.valMap_[e]}}class Et{constructor(e){this.values=g.fromObject({max:e.max,min:e.min})}constrain(e){const n=this.values.get("max"),r=this.values.get("min");return Math.min(Math.max(e,r),n)}}class al{constructor(e){this.values=g.fromObject({max:e.max,min:e.min})}constrain(e){const n=this.values.get("max"),r=this.values.get("min");let i=e;return R(r)||(i=Math.max(i,r)),R(n)||(i=Math.min(i,n)),i}}class ol{constructor(e,n=0){this.step=e,this.origin=n}constrain(e){const n=this.origin%this.step,r=Math.round((e-n)/this.step);return n+r*this.step}}class sl{constructor(e){this.text=e}evaluate(){return Number(this.text)}toString(){return this.text}}const ll={"**":(t,e)=>Math.pow(t,e),"*":(t,e)=>t*e,"/":(t,e)=>t/e,"%":(t,e)=>t%e,"+":(t,e)=>t+e,"-":(t,e)=>t-e,"<<":(t,e)=>t<<e,">>":(t,e)=>t>>e,">>>":(t,e)=>t>>>e,"&":(t,e)=>t&e,"^":(t,e)=>t^e,"|":(t,e)=>t|e};class dl{constructor(e,n,r){this.left=n,this.operator=e,this.right=r}evaluate(){const e=ll[this.operator];if(!e)throw new Error(`unexpected binary operator: '${this.operator}`);return e(this.left.evaluate(),this.right.evaluate())}toString(){return["b(",this.left.toString(),this.operator,this.right.toString(),")"].join(" ")}}const cl={"+":t=>t,"-":t=>-t,"~":t=>~t};class pl{constructor(e,n){this.operator=e,this.expression=n}evaluate(){const e=cl[this.operator];if(!e)throw new Error(`unexpected unary operator: '${this.operator}`);return e(this.expression.evaluate())}toString(){return["u(",this.operator,this.expression.toString(),")"].join(" ")}}function Xn(t){return(e,n)=>{for(let r=0;r<t.length;r++){const i=t[r](e,n);if(i!=="")return i}return""}}function ft(t,e){var n;const r=t.substr(e).match(/^\s+/);return(n=r&&r[0])!==null&&n!==void 0?n:""}function ul(t,e){const n=t.substr(e,1);return n.match(/^[1-9]$/)?n:""}function vt(t,e){var n;const r=t.substr(e).match(/^[0-9]+/);return(n=r&&r[0])!==null&&n!==void 0?n:""}function hl(t,e){const n=vt(t,e);if(n!=="")return n;const r=t.substr(e,1);if(e+=1,r!=="-"&&r!=="+")return"";const i=vt(t,e);return i===""?"":r+i}function Kn(t,e){const n=t.substr(e,1);if(e+=1,n.toLowerCase()!=="e")return"";const r=hl(t,e);return r===""?"":n+r}function na(t,e){const n=t.substr(e,1);if(n==="0")return n;const r=ul(t,e);return e+=r.length,r===""?"":r+vt(t,e)}function ml(t,e){const n=na(t,e);if(e+=n.length,n==="")return"";const r=t.substr(e,1);if(e+=r.length,r!==".")return"";const i=vt(t,e);return e+=i.length,n+r+i+Kn(t,e)}function fl(t,e){const n=t.substr(e,1);if(e+=n.length,n!==".")return"";const r=vt(t,e);return e+=r.length,r===""?"":n+r+Kn(t,e)}function vl(t,e){const n=na(t,e);return e+=n.length,n===""?"":n+Kn(t,e)}const bl=Xn([ml,fl,vl]);function gl(t,e){var n;const r=t.substr(e).match(/^[01]+/);return(n=r&&r[0])!==null&&n!==void 0?n:""}function _l(t,e){const n=t.substr(e,2);if(e+=n.length,n.toLowerCase()!=="0b")return"";const r=gl(t,e);return r===""?"":n+r}function wl(t,e){var n;const r=t.substr(e).match(/^[0-7]+/);return(n=r&&r[0])!==null&&n!==void 0?n:""}function xl(t,e){const n=t.substr(e,2);if(e+=n.length,n.toLowerCase()!=="0o")return"";const r=wl(t,e);return r===""?"":n+r}function yl(t,e){var n;const r=t.substr(e).match(/^[0-9a-f]+/i);return(n=r&&r[0])!==null&&n!==void 0?n:""}function El(t,e){const n=t.substr(e,2);if(e+=n.length,n.toLowerCase()!=="0x")return"";const r=yl(t,e);return r===""?"":n+r}const Pl=Xn([_l,xl,El]),Cl=Xn([Pl,bl]);function Sl(t,e){const n=Cl(t,e);return e+=n.length,n===""?null:{evaluable:new sl(n),cursor:e}}function Al(t,e){const n=t.substr(e,1);if(e+=n.length,n!=="(")return null;const r=ia(t,e);if(!r)return null;e=r.cursor,e+=ft(t,e).length;const i=t.substr(e,1);return e+=i.length,i!==")"?null:{evaluable:r.evaluable,cursor:e}}function Ll(t,e){var n;return(n=Sl(t,e))!==null&&n!==void 0?n:Al(t,e)}function ra(t,e){const n=Ll(t,e);if(n)return n;const r=t.substr(e,1);if(e+=r.length,r!=="+"&&r!=="-"&&r!=="~")return null;const i=ra(t,e);return i?(e=i.cursor,{cursor:e,evaluable:new pl(r,i.evaluable)}):null}function kl(t,e,n){n+=ft(e,n).length;const r=t.filter(i=>e.startsWith(i,n))[0];return r?(n+=r.length,n+=ft(e,n).length,{cursor:n,operator:r}):null}function Tl(t,e){return(n,r)=>{const i=t(n,r);if(!i)return null;r=i.cursor;let a=i.evaluable;for(;;){const o=kl(e,n,r);if(!o)break;r=o.cursor;const s=t(n,r);if(!s)return null;r=s.cursor,a=new dl(o.operator,a,s.evaluable)}return a?{cursor:r,evaluable:a}:null}}const Dl=[["**"],["*","/","%"],["+","-"],["<<",">>>",">>"],["&"],["^"],["|"]].reduce((t,e)=>Tl(t,e),ra);function ia(t,e){return e+=ft(t,e).length,Dl(t,e)}function Rl(t){const e=ia(t,0);return!e||e.cursor+ft(t,e.cursor).length!==t.length?null:e.evaluable}function xe(t){var e;const n=Rl(t);return(e=n==null?void 0:n.evaluate())!==null&&e!==void 0?e:null}function aa(t){if(typeof t=="number")return t;if(typeof t=="string"){const e=xe(t);if(!R(e))return e}return 0}function Il(t){return String(t)}function Z(t){return e=>e.toFixed(Math.max(Math.min(t,20),0))}function k(t,e,n,r,i){const a=(t-e)/(n-e);return r+a*(i-r)}function Wr(t){return String(t.toFixed(10)).split(".")[1].replace(/0+$/,"").length}function U(t,e,n){return Math.min(Math.max(t,e),n)}function oa(t,e){return(t%e+e)%e}function Nl(t,e){return R(t.step)?Math.max(Wr(e),2):Wr(t.step)}function sa(t){var e;return(e=t.step)!==null&&e!==void 0?e:1}function la(t,e){var n;const r=Math.abs((n=t.step)!==null&&n!==void 0?n:e);return r===0?.1:Math.pow(10,Math.floor(Math.log10(r))-1)}function da(t,e){return R(t.step)?null:new ol(t.step,e)}function ca(t){return!R(t.max)&&!R(t.min)?new Et({max:t.max,min:t.min}):!R(t.max)||!R(t.min)?new al({max:t.max,min:t.min}):null}function pa(t,e){var n,r,i;return{formatter:(n=t.format)!==null&&n!==void 0?n:Z(Nl(t,e)),keyScale:(r=t.keyScale)!==null&&r!==void 0?r:sa(t),pointerScale:(i=t.pointerScale)!==null&&i!==void 0?i:la(t,e)}}function ua(t){return{format:t.optional.function,keyScale:t.optional.number,max:t.optional.number,min:t.optional.number,pointerScale:t.optional.number,step:t.optional.number}}function Yn(t){return{constraint:t.constraint,textProps:g.fromObject(pa(t.params,t.initialValue))}}class je{constructor(e){this.controller=e}get element(){return this.controller.view.element}get disabled(){return this.controller.viewProps.get("disabled")}set disabled(e){this.controller.viewProps.set("disabled",e)}get hidden(){return this.controller.viewProps.get("hidden")}set hidden(e){this.controller.viewProps.set("hidden",e)}dispose(){this.controller.viewProps.set("disposed",!0)}importState(e){return this.controller.importState(e)}exportState(){return this.controller.exportState()}}class en{constructor(e){this.target=e}}class Pt extends en{constructor(e,n,r){super(e),this.value=n,this.last=r??!0}}class Ol extends en{constructor(e,n){super(e),this.expanded=n}}class Ml extends en{constructor(e,n){super(e),this.index=n}}class Vl extends en{constructor(e,n){super(e),this.native=n}}class bt extends je{constructor(e){super(e),this.onValueChange_=this.onValueChange_.bind(this),this.emitter_=new z,this.controller.value.emitter.on("change",this.onValueChange_)}get label(){return this.controller.labelController.props.get("label")}set label(e){this.controller.labelController.props.set("label",e)}get key(){return this.controller.value.binding.target.key}get tag(){return this.controller.tag}set tag(e){this.controller.tag=e}on(e,n){const r=n.bind(this);return this.emitter_.on(e,i=>{r(i)},{key:n}),this}off(e,n){return this.emitter_.off(e,n),this}refresh(){this.controller.value.fetch()}onValueChange_(e){const n=this.controller.value;this.emitter_.emit("change",new Pt(this,n.binding.target.read(),e.options.last))}}class Bl{constructor(e,n){this.onValueBeforeChange_=this.onValueBeforeChange_.bind(this),this.onValueChange_=this.onValueChange_.bind(this),this.binding=n,this.value_=e,this.value_.emitter.on("beforechange",this.onValueBeforeChange_),this.value_.emitter.on("change",this.onValueChange_),this.emitter=new z}get rawValue(){return this.value_.rawValue}set rawValue(e){this.value_.rawValue=e}setRawValue(e,n){this.value_.setRawValue(e,n)}fetch(){this.value_.rawValue=this.binding.read()}push(){this.binding.write(this.value_.rawValue)}onValueBeforeChange_(e){this.emitter.emit("beforechange",Object.assign(Object.assign({},e),{sender:this}))}onValueChange_(e){this.push(),this.emitter.emit("change",Object.assign(Object.assign({},e),{sender:this}))}}function Fl(t){if(!("binding"in t))return!1;const e=t.binding;return $n(e)&&"read"in e&&"write"in e}function zl(t,e){const r=Object.keys(e).reduce((i,a)=>{if(i===void 0)return;const o=e[a],s=o(t[a]);return s.succeeded?Object.assign(Object.assign({},i),{[a]:s.value}):void 0},{});return r}function Ul(t,e){return t.reduce((n,r)=>{if(n===void 0)return;const i=e(r);if(!(!i.succeeded||i.value===void 0))return[...n,i.value]},[])}function Hl(t){return t===null?!1:typeof t=="object"}function ve(t){return e=>n=>{if(!e&&n===void 0)return{succeeded:!1,value:void 0};if(e&&n===void 0)return{succeeded:!0,value:void 0};const r=t(n);return r!==void 0?{succeeded:!0,value:r}:{succeeded:!1,value:void 0}}}function jr(t){return{custom:e=>ve(e)(t),boolean:ve(e=>typeof e=="boolean"?e:void 0)(t),number:ve(e=>typeof e=="number"?e:void 0)(t),string:ve(e=>typeof e=="string"?e:void 0)(t),function:ve(e=>typeof e=="function"?e:void 0)(t),constant:e=>ve(n=>n===e?e:void 0)(t),raw:ve(e=>e)(t),object:e=>ve(n=>{if(Hl(n))return zl(n,e)})(t),array:e=>ve(n=>{if(Array.isArray(n))return Ul(n,e)})(t)}}const kn={optional:jr(!0),required:jr(!1)};function M(t,e){const n=e(kn),r=kn.required.object(n)(t);return r.succeeded?r.value:void 0}function te(t,e,n,r){if(e&&!e(t))return!1;const i=M(t,n);return i?r(i):!1}function ne(t,e){var n;return ze((n=t==null?void 0:t())!==null&&n!==void 0?n:{},e)}function Fe(t){return"value"in t}function ha(t){if(!qn(t)||!("binding"in t))return!1;const e=t.binding;return $n(e)}const ue="http://www.w3.org/2000/svg";function Yt(t){t.offsetHeight}function Wl(t,e){const n=t.style.transition;t.style.transition="none",e(),t.style.transition=n}function Zn(t){return t.ontouchstart!==void 0}function jl(){return globalThis}function Gl(){return jl().document}function ql(t){const e=t.ownerDocument.defaultView;return e&&"document"in e?t.getContext("2d",{willReadFrequently:!0}):null}const $l={check:'<path d="M2 8l4 4l8 -8"/>',dropdown:'<path d="M5 7h6l-3 3 z"/>',p2dpad:'<path d="M8 4v8"/><path d="M4 8h8"/><circle cx="12" cy="12" r="1.2"/>'};function tn(t,e){const n=t.createElementNS(ue,"svg");return n.innerHTML=$l[e],n}function ma(t,e,n){t.insertBefore(e,t.children[n])}function Jn(t){t.parentElement&&t.parentElement.removeChild(t)}function fa(t){for(;t.children.length>0;)t.removeChild(t.children[0])}function Xl(t){for(;t.childNodes.length>0;)t.removeChild(t.childNodes[0])}function va(t){return t.relatedTarget?t.relatedTarget:"explicitOriginalTarget"in t?t.explicitOriginalTarget:null}function _e(t,e){t.emitter.on("change",n=>{e(n.rawValue)}),e(t.rawValue)}function he(t,e,n){_e(t.value(e),n)}const Kl="tp";function C(t){return(n,r)=>[Kl,"-",t,"v",n?`_${n}`:"",r?`-${r}`:""].join("")}const dt=C("lbl");function Yl(t,e){const n=t.createDocumentFragment();return e.split(`
`).map(i=>t.createTextNode(i)).forEach((i,a)=>{a>0&&n.appendChild(t.createElement("br")),n.appendChild(i)}),n}class ba{constructor(e,n){this.element=e.createElement("div"),this.element.classList.add(dt()),n.viewProps.bindClassModifiers(this.element);const r=e.createElement("div");r.classList.add(dt("l")),he(n.props,"label",a=>{R(a)?this.element.classList.add(dt(void 0,"nol")):(this.element.classList.remove(dt(void 0,"nol")),Xl(r),r.appendChild(Yl(e,a)))}),this.element.appendChild(r),this.labelElement=r;const i=e.createElement("div");i.classList.add(dt("v")),this.element.appendChild(i),this.valueElement=i}}class ga{constructor(e,n){this.props=n.props,this.valueController=n.valueController,this.viewProps=n.valueController.viewProps,this.view=new ba(e,{props:n.props,viewProps:this.viewProps}),this.view.valueElement.appendChild(this.valueController.view.element)}importProps(e){return te(e,null,n=>({label:n.optional.string}),n=>(this.props.set("label",n.label),!0))}exportProps(){return ne(null,{label:this.props.get("label")})}}function Zl(){return["veryfirst","first","last","verylast"]}const Gr=C(""),qr={veryfirst:"vfst",first:"fst",last:"lst",verylast:"vlst"};class nn{constructor(e){this.parent_=null,this.blade=e.blade,this.view=e.view,this.viewProps=e.viewProps;const n=this.view.element;this.blade.value("positions").emitter.on("change",()=>{Zl().forEach(r=>{n.classList.remove(Gr(void 0,qr[r]))}),this.blade.get("positions").forEach(r=>{n.classList.add(Gr(void 0,qr[r]))})}),this.viewProps.handleDispose(()=>{Jn(n)})}get parent(){return this.parent_}set parent(e){this.parent_=e,this.viewProps.set("parent",this.parent_?this.parent_.viewProps:null)}importState(e){return te(e,null,n=>({disabled:n.required.boolean,hidden:n.required.boolean}),n=>(this.viewProps.importState(n),!0))}exportState(){return ne(null,Object.assign({},this.viewProps.exportState()))}}class Ue extends nn{constructor(e,n){if(n.value!==n.valueController.value)throw B.shouldNeverHappen();const r=n.valueController.viewProps,i=new ga(e,{blade:n.blade,props:n.props,valueController:n.valueController});super(Object.assign(Object.assign({},n),{view:new ba(e,{props:n.props,viewProps:r}),viewProps:r})),this.labelController=i,this.value=n.value,this.valueController=n.valueController,this.view.valueElement.appendChild(this.valueController.view.element)}importState(e){return te(e,n=>{var r,i,a;return super.importState(n)&&this.labelController.importProps(n)&&((a=(i=(r=this.valueController).importProps)===null||i===void 0?void 0:i.call(r,e))!==null&&a!==void 0?a:!0)},n=>({value:n.optional.raw}),n=>(n.value&&(this.value.rawValue=n.value),!0))}exportState(){var e,n,r;return ne(()=>super.exportState(),Object.assign(Object.assign({value:this.value.rawValue},this.labelController.exportProps()),(r=(n=(e=this.valueController).exportProps)===null||n===void 0?void 0:n.call(e))!==null&&r!==void 0?r:{}))}}function $r(t){const e=Object.assign({},t);return delete e.value,e}class _a extends Ue{constructor(e,n){super(e,n),this.tag=n.tag}importState(e){return te(e,n=>super.importState($r(e)),n=>({tag:n.optional.string}),n=>(this.tag=n.tag,!0))}exportState(){return ne(()=>$r(super.exportState()),{binding:{key:this.value.binding.target.key,value:this.value.binding.target.read()},tag:this.tag})}}function Jl(t){return Fe(t)&&ha(t.value)}class Ql extends _a{importState(e){return te(e,n=>super.importState(n),n=>({binding:n.required.object({value:n.required.raw})}),n=>(this.value.binding.inject(n.binding.value),this.value.fetch(),!0))}}function ed(t){return Fe(t)&&Fl(t.value)}function wa(t,e){for(;t.length<e;)t.push(void 0)}function td(t){const e=[];return wa(e,t),e}function nd(t){const e=t.indexOf(void 0);return e<0?t:t.slice(0,e)}function rd(t,e){const n=[...nd(t),e];return n.length>t.length?n.splice(0,n.length-t.length):wa(n,t.length),n}class id{constructor(e){this.emitter=new z,this.onTick_=this.onTick_.bind(this),this.onValueBeforeChange_=this.onValueBeforeChange_.bind(this),this.onValueChange_=this.onValueChange_.bind(this),this.binding=e.binding,this.value_=O(td(e.bufferSize)),this.value_.emitter.on("beforechange",this.onValueBeforeChange_),this.value_.emitter.on("change",this.onValueChange_),this.ticker=e.ticker,this.ticker.emitter.on("tick",this.onTick_),this.fetch()}get rawValue(){return this.value_.rawValue}set rawValue(e){this.value_.rawValue=e}setRawValue(e,n){this.value_.setRawValue(e,n)}fetch(){this.value_.rawValue=rd(this.value_.rawValue,this.binding.read())}onTick_(){this.fetch()}onValueBeforeChange_(e){this.emitter.emit("beforechange",Object.assign(Object.assign({},e),{sender:this}))}onValueChange_(e){this.emitter.emit("change",Object.assign(Object.assign({},e),{sender:this}))}}function ad(t){if(!("binding"in t))return!1;const e=t.binding;return $n(e)&&"read"in e&&!("write"in e)}class od extends _a{exportState(){return ne(()=>super.exportState(),{binding:{readonly:!0}})}}function sd(t){return Fe(t)&&ad(t.value)}class ld extends je{get label(){return this.controller.labelController.props.get("label")}set label(e){this.controller.labelController.props.set("label",e)}get title(){var e;return(e=this.controller.buttonController.props.get("title"))!==null&&e!==void 0?e:""}set title(e){this.controller.buttonController.props.set("title",e)}on(e,n){const r=n.bind(this);return this.controller.buttonController.emitter.on(e,a=>{r(new Vl(this,a.nativeEvent))}),this}off(e,n){return this.controller.buttonController.emitter.off(e,n),this}}function dd(t,e,n){n?t.classList.add(e):t.classList.remove(e)}function tt(t,e){return n=>{dd(t,e,n)}}function Qn(t,e){_e(t,n=>{e.textContent=n??""})}const pn=C("btn");class cd{constructor(e,n){this.element=e.createElement("div"),this.element.classList.add(pn()),n.viewProps.bindClassModifiers(this.element);const r=e.createElement("button");r.classList.add(pn("b")),n.viewProps.bindDisabled(r),this.element.appendChild(r),this.buttonElement=r;const i=e.createElement("div");i.classList.add(pn("t")),Qn(n.props.value("title"),i),this.buttonElement.appendChild(i)}}class pd{constructor(e,n){this.emitter=new z,this.onClick_=this.onClick_.bind(this),this.props=n.props,this.viewProps=n.viewProps,this.view=new cd(e,{props:this.props,viewProps:this.viewProps}),this.view.buttonElement.addEventListener("click",this.onClick_)}importProps(e){return te(e,null,n=>({title:n.optional.string}),n=>(this.props.set("title",n.title),!0))}exportProps(){return ne(null,{title:this.props.get("title")})}onClick_(e){this.emitter.emit("click",{nativeEvent:e,sender:this})}}class Xr extends nn{constructor(e,n){const r=new pd(e,{props:n.buttonProps,viewProps:n.viewProps}),i=new ga(e,{blade:n.blade,props:n.labelProps,valueController:r});super({blade:n.blade,view:i.view,viewProps:n.viewProps}),this.buttonController=r,this.labelController=i}importState(e){return te(e,n=>super.importState(n)&&this.buttonController.importProps(n)&&this.labelController.importProps(n),()=>({}),()=>!0)}exportState(){return ne(()=>super.exportState(),Object.assign(Object.assign({},this.buttonController.exportProps()),this.labelController.exportProps()))}}class xa{constructor(e){const[n,r]=e.split("-"),i=n.split(".");this.major=parseInt(i[0],10),this.minor=parseInt(i[1],10),this.patch=parseInt(i[2],10),this.prerelease=r??null}toString(){const e=[this.major,this.minor,this.patch].join(".");return this.prerelease!==null?[e,this.prerelease].join("-"):e}}const nt=new xa("2.0.5");function K(t){return Object.assign({core:nt},t)}const ud=K({id:"button",type:"blade",accept(t){const e=M(t,n=>({title:n.required.string,view:n.required.constant("button"),label:n.optional.string}));return e?{params:e}:null},controller(t){return new Xr(t.document,{blade:t.blade,buttonProps:g.fromObject({title:t.params.title}),labelProps:g.fromObject({label:t.params.label}),viewProps:t.viewProps})},api(t){return t.controller instanceof Xr?new ld(t.controller):null}});function hd(t,e){return t.addBlade(Object.assign(Object.assign({},e),{view:"button"}))}function md(t,e){return t.addBlade(Object.assign(Object.assign({},e),{view:"folder"}))}function fd(t,e){return t.addBlade(Object.assign(Object.assign({},e),{view:"tab"}))}function vd(t){return qn(t)?"refresh"in t&&typeof t.refresh=="function":!1}function bd(t,e){if(!Kt.isBindable(t))throw B.notBindable();return new Kt(t,e)}class gd{constructor(e,n){this.onRackValueChange_=this.onRackValueChange_.bind(this),this.controller_=e,this.emitter_=new z,this.pool_=n,this.controller_.rack.emitter.on("valuechange",this.onRackValueChange_)}get children(){return this.controller_.rack.children.map(e=>this.pool_.createApi(e))}addBinding(e,n,r){const i=r??{},a=this.controller_.element.ownerDocument,o=this.pool_.createBinding(a,bd(e,n),i),s=this.pool_.createBindingApi(o);return this.add(s,i.index)}addFolder(e){return md(this,e)}addButton(e){return hd(this,e)}addTab(e){return fd(this,e)}add(e,n){const r=e.controller;return this.controller_.rack.add(r,n),e}remove(e){this.controller_.rack.remove(e.controller)}addBlade(e){const n=this.controller_.element.ownerDocument,r=this.pool_.createBlade(n,e),i=this.pool_.createApi(r);return this.add(i,e.index)}on(e,n){const r=n.bind(this);return this.emitter_.on(e,i=>{r(i)},{key:n}),this}off(e,n){return this.emitter_.off(e,n),this}refresh(){this.children.forEach(e=>{vd(e)&&e.refresh()})}onRackValueChange_(e){const n=e.bladeController,r=this.pool_.createApi(n),i=ha(n.value)?n.value.binding:null;this.emitter_.emit("change",new Pt(r,i?i.target.read():n.value.rawValue,e.options.last))}}class er extends je{constructor(e,n){super(e),this.rackApi_=new gd(e.rackController,n)}refresh(){this.rackApi_.refresh()}}class tr extends nn{constructor(e){super({blade:e.blade,view:e.view,viewProps:e.rackController.viewProps}),this.rackController=e.rackController}importState(e){return te(e,n=>super.importState(n),n=>({children:n.required.array(n.required.raw)}),n=>this.rackController.rack.children.every((r,i)=>r.importState(n.children[i])))}exportState(){return ne(()=>super.exportState(),{children:this.rackController.rack.children.map(e=>e.exportState())})}}function Tn(t){return"rackController"in t}class _d{constructor(e){this.emitter=new z,this.items_=[],this.cache_=new Set,this.onSubListAdd_=this.onSubListAdd_.bind(this),this.onSubListRemove_=this.onSubListRemove_.bind(this),this.extract_=e}get items(){return this.items_}allItems(){return Array.from(this.cache_)}find(e){for(const n of this.allItems())if(e(n))return n;return null}includes(e){return this.cache_.has(e)}add(e,n){if(this.includes(e))throw B.shouldNeverHappen();const r=n!==void 0?n:this.items_.length;this.items_.splice(r,0,e),this.cache_.add(e);const i=this.extract_(e);i&&(i.emitter.on("add",this.onSubListAdd_),i.emitter.on("remove",this.onSubListRemove_),i.allItems().forEach(a=>{this.cache_.add(a)})),this.emitter.emit("add",{index:r,item:e,root:this,target:this})}remove(e){const n=this.items_.indexOf(e);if(n<0)return;this.items_.splice(n,1),this.cache_.delete(e);const r=this.extract_(e);r&&(r.allItems().forEach(i=>{this.cache_.delete(i)}),r.emitter.off("add",this.onSubListAdd_),r.emitter.off("remove",this.onSubListRemove_)),this.emitter.emit("remove",{index:n,item:e,root:this,target:this})}onSubListAdd_(e){this.cache_.add(e.item),this.emitter.emit("add",{index:e.index,item:e.item,root:this,target:e.target})}onSubListRemove_(e){this.cache_.delete(e.item),this.emitter.emit("remove",{index:e.index,item:e.item,root:this,target:e.target})}}function wd(t,e){for(let n=0;n<t.length;n++){const r=t[n];if(Fe(r)&&r.value===e)return r}return null}function xd(t){return Tn(t)?t.rackController.rack.bcSet_:null}class yd{constructor(e){var n,r;this.emitter=new z,this.onBladePositionsChange_=this.onBladePositionsChange_.bind(this),this.onSetAdd_=this.onSetAdd_.bind(this),this.onSetRemove_=this.onSetRemove_.bind(this),this.onChildDispose_=this.onChildDispose_.bind(this),this.onChildPositionsChange_=this.onChildPositionsChange_.bind(this),this.onChildValueChange_=this.onChildValueChange_.bind(this),this.onChildViewPropsChange_=this.onChildViewPropsChange_.bind(this),this.onRackLayout_=this.onRackLayout_.bind(this),this.onRackValueChange_=this.onRackValueChange_.bind(this),this.blade_=(n=e.blade)!==null&&n!==void 0?n:null,(r=this.blade_)===null||r===void 0||r.value("positions").emitter.on("change",this.onBladePositionsChange_),this.viewProps=e.viewProps,this.bcSet_=new _d(xd),this.bcSet_.emitter.on("add",this.onSetAdd_),this.bcSet_.emitter.on("remove",this.onSetRemove_)}get children(){return this.bcSet_.items}add(e,n){var r;(r=e.parent)===null||r===void 0||r.remove(e),e.parent=this,this.bcSet_.add(e,n)}remove(e){e.parent=null,this.bcSet_.remove(e)}find(e){return this.bcSet_.allItems().filter(e)}onSetAdd_(e){this.updatePositions_();const n=e.target===e.root;if(this.emitter.emit("add",{bladeController:e.item,index:e.index,root:n,sender:this}),!n)return;const r=e.item;if(r.viewProps.emitter.on("change",this.onChildViewPropsChange_),r.blade.value("positions").emitter.on("change",this.onChildPositionsChange_),r.viewProps.handleDispose(this.onChildDispose_),Fe(r))r.value.emitter.on("change",this.onChildValueChange_);else if(Tn(r)){const i=r.rackController.rack;if(i){const a=i.emitter;a.on("layout",this.onRackLayout_),a.on("valuechange",this.onRackValueChange_)}}}onSetRemove_(e){this.updatePositions_();const n=e.target===e.root;if(this.emitter.emit("remove",{bladeController:e.item,root:n,sender:this}),!n)return;const r=e.item;if(Fe(r))r.value.emitter.off("change",this.onChildValueChange_);else if(Tn(r)){const i=r.rackController.rack;if(i){const a=i.emitter;a.off("layout",this.onRackLayout_),a.off("valuechange",this.onRackValueChange_)}}}updatePositions_(){const e=this.bcSet_.items.filter(i=>!i.viewProps.get("hidden")),n=e[0],r=e[e.length-1];this.bcSet_.items.forEach(i=>{const a=[];i===n&&(a.push("first"),(!this.blade_||this.blade_.get("positions").includes("veryfirst"))&&a.push("veryfirst")),i===r&&(a.push("last"),(!this.blade_||this.blade_.get("positions").includes("verylast"))&&a.push("verylast")),i.blade.set("positions",a)})}onChildPositionsChange_(){this.updatePositions_(),this.emitter.emit("layout",{sender:this})}onChildViewPropsChange_(e){this.updatePositions_(),this.emitter.emit("layout",{sender:this})}onChildDispose_(){this.bcSet_.items.filter(n=>n.viewProps.get("disposed")).forEach(n=>{this.bcSet_.remove(n)})}onChildValueChange_(e){const n=wd(this.find(Fe),e.sender);if(!n)throw B.alreadyDisposed();this.emitter.emit("valuechange",{bladeController:n,options:e.options,sender:this})}onRackLayout_(e){this.updatePositions_(),this.emitter.emit("layout",{sender:this})}onRackValueChange_(e){this.emitter.emit("valuechange",{bladeController:e.bladeController,options:e.options,sender:this})}onBladePositionsChange_(){this.updatePositions_()}}class nr{constructor(e){this.onRackAdd_=this.onRackAdd_.bind(this),this.onRackRemove_=this.onRackRemove_.bind(this),this.element=e.element,this.viewProps=e.viewProps;const n=new yd({blade:e.root?void 0:e.blade,viewProps:e.viewProps});n.emitter.on("add",this.onRackAdd_),n.emitter.on("remove",this.onRackRemove_),this.rack=n,this.viewProps.handleDispose(()=>{for(let r=this.rack.children.length-1;r>=0;r--)this.rack.children[r].viewProps.set("disposed",!0)})}onRackAdd_(e){e.root&&ma(this.element,e.bladeController.view.element,e.index)}onRackRemove_(e){e.root&&Jn(e.bladeController.view.element)}}function rt(){return new g({positions:O([],{equals:Qs})})}class Ct extends g{constructor(e){super(e)}static create(e){const n={completed:!0,expanded:e,expandedHeight:null,shouldFixHeight:!1,temporaryExpanded:null},r=g.createCore(n);return new Ct(r)}get styleExpanded(){var e;return(e=this.get("temporaryExpanded"))!==null&&e!==void 0?e:this.get("expanded")}get styleHeight(){if(!this.styleExpanded)return"0";const e=this.get("expandedHeight");return this.get("shouldFixHeight")&&!R(e)?`${e}px`:"auto"}bindExpandedClass(e,n){const r=()=>{this.styleExpanded?e.classList.add(n):e.classList.remove(n)};he(this,"expanded",r),he(this,"temporaryExpanded",r)}cleanUpTransition(){this.set("shouldFixHeight",!1),this.set("expandedHeight",null),this.set("completed",!0)}}function Ed(t,e){let n=0;return Wl(e,()=>{t.set("expandedHeight",null),t.set("temporaryExpanded",!0),Yt(e),n=e.clientHeight,t.set("temporaryExpanded",null),Yt(e)}),n}function Kr(t,e){e.style.height=t.styleHeight}function rr(t,e){t.value("expanded").emitter.on("beforechange",()=>{if(t.set("completed",!1),R(t.get("expandedHeight"))){const n=Ed(t,e);n>0&&t.set("expandedHeight",n)}t.set("shouldFixHeight",!0),Yt(e)}),t.emitter.on("change",()=>{Kr(t,e)}),Kr(t,e),e.addEventListener("transitionend",n=>{n.propertyName==="height"&&t.cleanUpTransition()})}class ya extends er{constructor(e,n){super(e,n),this.emitter_=new z,this.controller.foldable.value("expanded").emitter.on("change",r=>{this.emitter_.emit("fold",new Ol(this,r.sender.rawValue))}),this.rackApi_.on("change",r=>{this.emitter_.emit("change",r)})}get expanded(){return this.controller.foldable.get("expanded")}set expanded(e){this.controller.foldable.set("expanded",e)}get title(){return this.controller.props.get("title")}set title(e){this.controller.props.set("title",e)}get children(){return this.rackApi_.children}addBinding(e,n,r){return this.rackApi_.addBinding(e,n,r)}addFolder(e){return this.rackApi_.addFolder(e)}addButton(e){return this.rackApi_.addButton(e)}addTab(e){return this.rackApi_.addTab(e)}add(e,n){return this.rackApi_.add(e,n)}remove(e){this.rackApi_.remove(e)}addBlade(e){return this.rackApi_.addBlade(e)}on(e,n){const r=n.bind(this);return this.emitter_.on(e,i=>{r(i)},{key:n}),this}off(e,n){return this.emitter_.off(e,n),this}}const Ea=C("cnt");class Pd{constructor(e,n){var r;this.className_=C((r=n.viewName)!==null&&r!==void 0?r:"fld"),this.element=e.createElement("div"),this.element.classList.add(this.className_(),Ea()),n.viewProps.bindClassModifiers(this.element),this.foldable_=n.foldable,this.foldable_.bindExpandedClass(this.element,this.className_(void 0,"expanded")),he(this.foldable_,"completed",tt(this.element,this.className_(void 0,"cpl")));const i=e.createElement("button");i.classList.add(this.className_("b")),he(n.props,"title",d=>{R(d)?this.element.classList.add(this.className_(void 0,"not")):this.element.classList.remove(this.className_(void 0,"not"))}),n.viewProps.bindDisabled(i),this.element.appendChild(i),this.buttonElement=i;const a=e.createElement("div");a.classList.add(this.className_("i")),this.element.appendChild(a);const o=e.createElement("div");o.classList.add(this.className_("t")),Qn(n.props.value("title"),o),this.buttonElement.appendChild(o),this.titleElement=o;const s=e.createElement("div");s.classList.add(this.className_("m")),this.buttonElement.appendChild(s);const l=e.createElement("div");l.classList.add(this.className_("c")),this.element.appendChild(l),this.containerElement=l}}class Dn extends tr{constructor(e,n){var r;const i=Ct.create((r=n.expanded)!==null&&r!==void 0?r:!0),a=new Pd(e,{foldable:i,props:n.props,viewName:n.root?"rot":void 0,viewProps:n.viewProps});super(Object.assign(Object.assign({},n),{rackController:new nr({blade:n.blade,element:a.containerElement,root:n.root,viewProps:n.viewProps}),view:a})),this.onTitleClick_=this.onTitleClick_.bind(this),this.props=n.props,this.foldable=i,rr(this.foldable,this.view.containerElement),this.rackController.rack.emitter.on("add",()=>{this.foldable.cleanUpTransition()}),this.rackController.rack.emitter.on("remove",()=>{this.foldable.cleanUpTransition()}),this.view.buttonElement.addEventListener("click",this.onTitleClick_)}get document(){return this.view.element.ownerDocument}importState(e){return te(e,n=>super.importState(n),n=>({expanded:n.required.boolean,title:n.optional.string}),n=>(this.foldable.set("expanded",n.expanded),this.props.set("title",n.title),!0))}exportState(){return ne(()=>super.exportState(),{expanded:this.foldable.get("expanded"),title:this.props.get("title")})}onTitleClick_(){this.foldable.set("expanded",!this.foldable.get("expanded"))}}const Cd=K({id:"folder",type:"blade",accept(t){const e=M(t,n=>({title:n.required.string,view:n.required.constant("folder"),expanded:n.optional.boolean}));return e?{params:e}:null},controller(t){return new Dn(t.document,{blade:t.blade,expanded:t.params.expanded,props:g.fromObject({title:t.params.title}),viewProps:t.viewProps})},api(t){return t.controller instanceof Dn?new ya(t.controller,t.pool):null}}),Sd=C("");function Yr(t,e){return tt(t,Sd(void 0,e))}class Ee extends g{constructor(e){var n;super(e),this.onDisabledChange_=this.onDisabledChange_.bind(this),this.onParentChange_=this.onParentChange_.bind(this),this.onParentGlobalDisabledChange_=this.onParentGlobalDisabledChange_.bind(this),[this.globalDisabled_,this.setGlobalDisabled_]=il(O(this.getGlobalDisabled_())),this.value("disabled").emitter.on("change",this.onDisabledChange_),this.value("parent").emitter.on("change",this.onParentChange_),(n=this.get("parent"))===null||n===void 0||n.globalDisabled.emitter.on("change",this.onParentGlobalDisabledChange_)}static create(e){var n,r,i;const a=e??{};return new Ee(g.createCore({disabled:(n=a.disabled)!==null&&n!==void 0?n:!1,disposed:!1,hidden:(r=a.hidden)!==null&&r!==void 0?r:!1,parent:(i=a.parent)!==null&&i!==void 0?i:null}))}get globalDisabled(){return this.globalDisabled_}bindClassModifiers(e){_e(this.globalDisabled_,Yr(e,"disabled")),he(this,"hidden",Yr(e,"hidden"))}bindDisabled(e){_e(this.globalDisabled_,n=>{e.disabled=n})}bindTabIndex(e){_e(this.globalDisabled_,n=>{e.tabIndex=n?-1:0})}handleDispose(e){this.value("disposed").emitter.on("change",n=>{n&&e()})}importState(e){this.set("disabled",e.disabled),this.set("hidden",e.hidden)}exportState(){return{disabled:this.get("disabled"),hidden:this.get("hidden")}}getGlobalDisabled_(){const e=this.get("parent");return(e?e.globalDisabled.rawValue:!1)||this.get("disabled")}updateGlobalDisabled_(){this.setGlobalDisabled_(this.getGlobalDisabled_())}onDisabledChange_(){this.updateGlobalDisabled_()}onParentGlobalDisabledChange_(){this.updateGlobalDisabled_()}onParentChange_(e){var n;const r=e.previousRawValue;r==null||r.globalDisabled.emitter.off("change",this.onParentGlobalDisabledChange_),(n=this.get("parent"))===null||n===void 0||n.globalDisabled.emitter.on("change",this.onParentGlobalDisabledChange_),this.updateGlobalDisabled_()}}const Zr=C("tbp");class Ad{constructor(e,n){this.element=e.createElement("div"),this.element.classList.add(Zr()),n.viewProps.bindClassModifiers(this.element);const r=e.createElement("div");r.classList.add(Zr("c")),this.element.appendChild(r),this.containerElement=r}}const ct=C("tbi");class Ld{constructor(e,n){this.element=e.createElement("div"),this.element.classList.add(ct()),n.viewProps.bindClassModifiers(this.element),he(n.props,"selected",a=>{a?this.element.classList.add(ct(void 0,"sel")):this.element.classList.remove(ct(void 0,"sel"))});const r=e.createElement("button");r.classList.add(ct("b")),n.viewProps.bindDisabled(r),this.element.appendChild(r),this.buttonElement=r;const i=e.createElement("div");i.classList.add(ct("t")),Qn(n.props.value("title"),i),this.buttonElement.appendChild(i),this.titleElement=i}}class kd{constructor(e,n){this.emitter=new z,this.onClick_=this.onClick_.bind(this),this.props=n.props,this.viewProps=n.viewProps,this.view=new Ld(e,{props:n.props,viewProps:n.viewProps}),this.view.buttonElement.addEventListener("click",this.onClick_)}onClick_(){this.emitter.emit("click",{sender:this})}}class Rn extends tr{constructor(e,n){const r=new Ad(e,{viewProps:n.viewProps});super(Object.assign(Object.assign({},n),{rackController:new nr({blade:n.blade,element:r.containerElement,viewProps:n.viewProps}),view:r})),this.onItemClick_=this.onItemClick_.bind(this),this.ic_=new kd(e,{props:n.itemProps,viewProps:Ee.create()}),this.ic_.emitter.on("click",this.onItemClick_),this.props=n.props,he(this.props,"selected",i=>{this.itemController.props.set("selected",i),this.viewProps.set("hidden",!i)})}get itemController(){return this.ic_}importState(e){return te(e,n=>super.importState(n),n=>({selected:n.required.boolean,title:n.required.string}),n=>(this.ic_.props.set("selected",n.selected),this.ic_.props.set("title",n.title),!0))}exportState(){return ne(()=>super.exportState(),{selected:this.ic_.props.get("selected"),title:this.ic_.props.get("title")})}onItemClick_(){this.props.set("selected",!0)}}class Td extends er{constructor(e,n){super(e,n),this.emitter_=new z,this.onSelect_=this.onSelect_.bind(this),this.pool_=n,this.rackApi_.on("change",r=>{this.emitter_.emit("change",r)}),this.controller.tab.selectedIndex.emitter.on("change",this.onSelect_)}get pages(){return this.rackApi_.children}addPage(e){const n=this.controller.view.element.ownerDocument,r=new Rn(n,{blade:rt(),itemProps:g.fromObject({selected:!1,title:e.title}),props:g.fromObject({selected:!1}),viewProps:Ee.create()}),i=this.pool_.createApi(r);return this.rackApi_.add(i,e.index)}removePage(e){this.rackApi_.remove(this.rackApi_.children[e])}on(e,n){const r=n.bind(this);return this.emitter_.on(e,i=>{r(i)},{key:n}),this}off(e,n){return this.emitter_.off(e,n),this}onSelect_(e){this.emitter_.emit("select",new Ml(this,e.rawValue))}}class Dd extends er{get title(){var e;return(e=this.controller.itemController.props.get("title"))!==null&&e!==void 0?e:""}set title(e){this.controller.itemController.props.set("title",e)}get selected(){return this.controller.props.get("selected")}set selected(e){this.controller.props.set("selected",e)}get children(){return this.rackApi_.children}addButton(e){return this.rackApi_.addButton(e)}addFolder(e){return this.rackApi_.addFolder(e)}addTab(e){return this.rackApi_.addTab(e)}add(e,n){this.rackApi_.add(e,n)}remove(e){this.rackApi_.remove(e)}addBinding(e,n,r){return this.rackApi_.addBinding(e,n,r)}addBlade(e){return this.rackApi_.addBlade(e)}}const Jr=-1;class Rd{constructor(){this.onItemSelectedChange_=this.onItemSelectedChange_.bind(this),this.empty=O(!0),this.selectedIndex=O(Jr),this.items_=[]}add(e,n){const r=n??this.items_.length;this.items_.splice(r,0,e),e.emitter.on("change",this.onItemSelectedChange_),this.keepSelection_()}remove(e){const n=this.items_.indexOf(e);n<0||(this.items_.splice(n,1),e.emitter.off("change",this.onItemSelectedChange_),this.keepSelection_())}keepSelection_(){if(this.items_.length===0){this.selectedIndex.rawValue=Jr,this.empty.rawValue=!0;return}const e=this.items_.findIndex(n=>n.rawValue);e<0?(this.items_.forEach((n,r)=>{n.rawValue=r===0}),this.selectedIndex.rawValue=0):(this.items_.forEach((n,r)=>{n.rawValue=r===e}),this.selectedIndex.rawValue=e),this.empty.rawValue=!1}onItemSelectedChange_(e){if(e.rawValue){const n=this.items_.findIndex(r=>r===e.sender);this.items_.forEach((r,i)=>{r.rawValue=i===n}),this.selectedIndex.rawValue=n}else this.keepSelection_()}}const pt=C("tab");class Id{constructor(e,n){this.element=e.createElement("div"),this.element.classList.add(pt(),Ea()),n.viewProps.bindClassModifiers(this.element),_e(n.empty,tt(this.element,pt(void 0,"nop")));const r=e.createElement("div");r.classList.add(pt("t")),this.element.appendChild(r),this.itemsElement=r;const i=e.createElement("div");i.classList.add(pt("i")),this.element.appendChild(i);const a=e.createElement("div");a.classList.add(pt("c")),this.element.appendChild(a),this.contentsElement=a}}class Qr extends tr{constructor(e,n){const r=new Rd,i=new Id(e,{empty:r.empty,viewProps:n.viewProps});super({blade:n.blade,rackController:new nr({blade:n.blade,element:i.contentsElement,viewProps:n.viewProps}),view:i}),this.onRackAdd_=this.onRackAdd_.bind(this),this.onRackRemove_=this.onRackRemove_.bind(this);const a=this.rackController.rack;a.emitter.on("add",this.onRackAdd_),a.emitter.on("remove",this.onRackRemove_),this.tab=r}add(e,n){this.rackController.rack.add(e,n)}remove(e){this.rackController.rack.remove(this.rackController.rack.children[e])}onRackAdd_(e){if(!e.root)return;const n=e.bladeController;ma(this.view.itemsElement,n.itemController.view.element,e.index),n.itemController.viewProps.set("parent",this.viewProps),this.tab.add(n.props.value("selected"))}onRackRemove_(e){if(!e.root)return;const n=e.bladeController;Jn(n.itemController.view.element),n.itemController.viewProps.set("parent",null),this.tab.remove(n.props.value("selected"))}}const Pa=K({id:"tab",type:"blade",accept(t){const e=M(t,n=>({pages:n.required.array(n.required.object({title:n.required.string})),view:n.required.constant("tab")}));return!e||e.pages.length===0?null:{params:e}},controller(t){const e=new Qr(t.document,{blade:t.blade,viewProps:t.viewProps});return t.params.pages.forEach(n=>{const r=new Rn(t.document,{blade:rt(),itemProps:g.fromObject({selected:!1,title:n.title}),props:g.fromObject({selected:!1}),viewProps:Ee.create()});e.add(r)}),e},api(t){return t.controller instanceof Qr?new Td(t.controller,t.pool):t.controller instanceof Rn?new Dd(t.controller,t.pool):null}});function Nd(t,e){const n=t.accept(e.params);if(!n)return null;const r=M(e.params,i=>({disabled:i.optional.boolean,hidden:i.optional.boolean}));return t.controller({blade:rt(),document:e.document,params:Object.assign(Object.assign({},n.params),{disabled:r==null?void 0:r.disabled,hidden:r==null?void 0:r.hidden}),viewProps:Ee.create({disabled:r==null?void 0:r.disabled,hidden:r==null?void 0:r.hidden})})}class ir extends bt{get options(){return this.controller.valueController.props.get("options")}set options(e){this.controller.valueController.props.set("options",e)}}class Od{constructor(){this.disabled=!1,this.emitter=new z}dispose(){}tick(){this.disabled||this.emitter.emit("tick",{sender:this})}}class Md{constructor(e,n){this.disabled_=!1,this.timerId_=null,this.onTick_=this.onTick_.bind(this),this.doc_=e,this.emitter=new z,this.interval_=n,this.setTimer_()}get disabled(){return this.disabled_}set disabled(e){this.disabled_=e,this.disabled_?this.clearTimer_():this.setTimer_()}dispose(){this.clearTimer_()}clearTimer_(){if(this.timerId_===null)return;const e=this.doc_.defaultView;e&&e.clearInterval(this.timerId_),this.timerId_=null}setTimer_(){if(this.clearTimer_(),this.interval_<=0)return;const e=this.doc_.defaultView;e&&(this.timerId_=e.setInterval(this.onTick_,this.interval_))}onTick_(){this.disabled_||this.emitter.emit("tick",{sender:this})}}class St{constructor(e){this.constraints=e}constrain(e){return this.constraints.reduce((n,r)=>r.constrain(n),e)}}function Zt(t,e){if(t instanceof e)return t;if(t instanceof St){const n=t.constraints.reduce((r,i)=>r||(i instanceof e?i:null),null);if(n)return n}return null}class At{constructor(e){this.values=g.fromObject({options:e})}constrain(e){const n=this.values.get("options");return n.length===0||n.filter(i=>i.value===e).length>0?e:n[0].value}}function Lt(t){var e;const n=kn;if(Array.isArray(t))return(e=M({items:t},r=>({items:r.required.array(r.required.object({text:r.required.string,value:r.required.raw}))})))===null||e===void 0?void 0:e.items;if(typeof t=="object")return n.required.raw(t).value}function ar(t){if(Array.isArray(t))return t;const e=[];return Object.keys(t).forEach(n=>{e.push({text:n,value:t[n]})}),e}function or(t){return R(t)?null:new At(ar(t))}const un=C("lst");class Vd{constructor(e,n){this.onValueChange_=this.onValueChange_.bind(this),this.props_=n.props,this.element=e.createElement("div"),this.element.classList.add(un()),n.viewProps.bindClassModifiers(this.element);const r=e.createElement("select");r.classList.add(un("s")),n.viewProps.bindDisabled(r),this.element.appendChild(r),this.selectElement=r;const i=e.createElement("div");i.classList.add(un("m")),i.appendChild(tn(e,"dropdown")),this.element.appendChild(i),n.value.emitter.on("change",this.onValueChange_),this.value_=n.value,he(this.props_,"options",a=>{fa(this.selectElement),a.forEach(o=>{const s=e.createElement("option");s.textContent=o.text,this.selectElement.appendChild(s)}),this.update_()})}update_(){const e=this.props_.get("options").map(n=>n.value);this.selectElement.selectedIndex=e.indexOf(this.value_.rawValue)}onValueChange_(){this.update_()}}class Ie{constructor(e,n){this.onSelectChange_=this.onSelectChange_.bind(this),this.props=n.props,this.value=n.value,this.viewProps=n.viewProps,this.view=new Vd(e,{props:this.props,value:this.value,viewProps:this.viewProps}),this.view.selectElement.addEventListener("change",this.onSelectChange_)}onSelectChange_(e){const n=e.currentTarget;this.value.rawValue=this.props.get("options")[n.selectedIndex].value}importProps(e){return te(e,null,n=>({options:n.required.custom(Lt)}),n=>(this.props.set("options",ar(n.options)),!0))}exportProps(){return ne(null,{options:this.props.get("options")})}}const ei=C("pop");class Bd{constructor(e,n){this.element=e.createElement("div"),this.element.classList.add(ei()),n.viewProps.bindClassModifiers(this.element),_e(n.shows,tt(this.element,ei(void 0,"v")))}}class Ca{constructor(e,n){this.shows=O(!1),this.viewProps=n.viewProps,this.view=new Bd(e,{shows:this.shows,viewProps:this.viewProps})}}const ti=C("txt");class Fd{constructor(e,n){this.onChange_=this.onChange_.bind(this),this.element=e.createElement("div"),this.element.classList.add(ti()),n.viewProps.bindClassModifiers(this.element),this.props_=n.props,this.props_.emitter.on("change",this.onChange_);const r=e.createElement("input");r.classList.add(ti("i")),r.type="text",n.viewProps.bindDisabled(r),this.element.appendChild(r),this.inputElement=r,n.value.emitter.on("change",this.onChange_),this.value_=n.value,this.refresh()}refresh(){const e=this.props_.get("formatter");this.inputElement.value=e(this.value_.rawValue)}onChange_(){this.refresh()}}class gt{constructor(e,n){this.onInputChange_=this.onInputChange_.bind(this),this.parser_=n.parser,this.props=n.props,this.value=n.value,this.viewProps=n.viewProps,this.view=new Fd(e,{props:n.props,value:this.value,viewProps:this.viewProps}),this.view.inputElement.addEventListener("change",this.onInputChange_)}onInputChange_(e){const r=e.currentTarget.value,i=this.parser_(r);R(i)||(this.value.rawValue=i),this.view.refresh()}}function zd(t){return String(t)}function Sa(t){return t==="false"?!1:!!t}function ni(t){return zd(t)}function Ud(t){return e=>t.reduce((n,r)=>n!==null?n:r(e),null)}const Hd=Z(0);function Jt(t){return Hd(t)+"%"}function Aa(t){return String(t)}function In(t){return t}function it({primary:t,secondary:e,forward:n,backward:r}){let i=!1;function a(o){i||(i=!0,o(),i=!1)}t.emitter.on("change",o=>{a(()=>{e.setRawValue(n(t.rawValue,e.rawValue),o.options)})}),e.emitter.on("change",o=>{a(()=>{t.setRawValue(r(t.rawValue,e.rawValue),o.options)}),a(()=>{e.setRawValue(n(t.rawValue,e.rawValue),o.options)})}),a(()=>{e.setRawValue(n(t.rawValue,e.rawValue),{forceEmit:!1,last:!0})})}function Y(t,e){const n=t*(e.altKey?.1:1)*(e.shiftKey?10:1);return e.upKey?+n:e.downKey?-n:0}function _t(t){return{altKey:t.altKey,downKey:t.key==="ArrowDown",shiftKey:t.shiftKey,upKey:t.key==="ArrowUp"}}function ye(t){return{altKey:t.altKey,downKey:t.key==="ArrowLeft",shiftKey:t.shiftKey,upKey:t.key==="ArrowRight"}}function Wd(t){return t==="ArrowUp"||t==="ArrowDown"}function La(t){return Wd(t)||t==="ArrowLeft"||t==="ArrowRight"}function hn(t,e){var n,r;const i=e.ownerDocument.defaultView,a=e.getBoundingClientRect();return{x:t.pageX-(((n=i&&i.scrollX)!==null&&n!==void 0?n:0)+a.left),y:t.pageY-(((r=i&&i.scrollY)!==null&&r!==void 0?r:0)+a.top)}}class Ge{constructor(e){this.lastTouch_=null,this.onDocumentMouseMove_=this.onDocumentMouseMove_.bind(this),this.onDocumentMouseUp_=this.onDocumentMouseUp_.bind(this),this.onMouseDown_=this.onMouseDown_.bind(this),this.onTouchEnd_=this.onTouchEnd_.bind(this),this.onTouchMove_=this.onTouchMove_.bind(this),this.onTouchStart_=this.onTouchStart_.bind(this),this.elem_=e,this.emitter=new z,e.addEventListener("touchstart",this.onTouchStart_,{passive:!1}),e.addEventListener("touchmove",this.onTouchMove_,{passive:!0}),e.addEventListener("touchend",this.onTouchEnd_),e.addEventListener("mousedown",this.onMouseDown_)}computePosition_(e){const n=this.elem_.getBoundingClientRect();return{bounds:{width:n.width,height:n.height},point:e?{x:e.x,y:e.y}:null}}onMouseDown_(e){var n;e.preventDefault(),(n=e.currentTarget)===null||n===void 0||n.focus();const r=this.elem_.ownerDocument;r.addEventListener("mousemove",this.onDocumentMouseMove_),r.addEventListener("mouseup",this.onDocumentMouseUp_),this.emitter.emit("down",{altKey:e.altKey,data:this.computePosition_(hn(e,this.elem_)),sender:this,shiftKey:e.shiftKey})}onDocumentMouseMove_(e){this.emitter.emit("move",{altKey:e.altKey,data:this.computePosition_(hn(e,this.elem_)),sender:this,shiftKey:e.shiftKey})}onDocumentMouseUp_(e){const n=this.elem_.ownerDocument;n.removeEventListener("mousemove",this.onDocumentMouseMove_),n.removeEventListener("mouseup",this.onDocumentMouseUp_),this.emitter.emit("up",{altKey:e.altKey,data:this.computePosition_(hn(e,this.elem_)),sender:this,shiftKey:e.shiftKey})}onTouchStart_(e){e.preventDefault();const n=e.targetTouches.item(0),r=this.elem_.getBoundingClientRect();this.emitter.emit("down",{altKey:e.altKey,data:this.computePosition_(n?{x:n.clientX-r.left,y:n.clientY-r.top}:void 0),sender:this,shiftKey:e.shiftKey}),this.lastTouch_=n}onTouchMove_(e){const n=e.targetTouches.item(0),r=this.elem_.getBoundingClientRect();this.emitter.emit("move",{altKey:e.altKey,data:this.computePosition_(n?{x:n.clientX-r.left,y:n.clientY-r.top}:void 0),sender:this,shiftKey:e.shiftKey}),this.lastTouch_=n}onTouchEnd_(e){var n;const r=(n=e.targetTouches.item(0))!==null&&n!==void 0?n:this.lastTouch_,i=this.elem_.getBoundingClientRect();this.emitter.emit("up",{altKey:e.altKey,data:this.computePosition_(r?{x:r.clientX-i.left,y:r.clientY-i.top}:void 0),sender:this,shiftKey:e.shiftKey})}}const ie=C("txt");class jd{constructor(e,n){this.onChange_=this.onChange_.bind(this),this.props_=n.props,this.props_.emitter.on("change",this.onChange_),this.element=e.createElement("div"),this.element.classList.add(ie(),ie(void 0,"num")),n.arrayPosition&&this.element.classList.add(ie(void 0,n.arrayPosition)),n.viewProps.bindClassModifiers(this.element);const r=e.createElement("input");r.classList.add(ie("i")),r.type="text",n.viewProps.bindDisabled(r),this.element.appendChild(r),this.inputElement=r,this.onDraggingChange_=this.onDraggingChange_.bind(this),this.dragging_=n.dragging,this.dragging_.emitter.on("change",this.onDraggingChange_),this.element.classList.add(ie()),this.inputElement.classList.add(ie("i"));const i=e.createElement("div");i.classList.add(ie("k")),this.element.appendChild(i),this.knobElement=i;const a=e.createElementNS(ue,"svg");a.classList.add(ie("g")),this.knobElement.appendChild(a);const o=e.createElementNS(ue,"path");o.classList.add(ie("gb")),a.appendChild(o),this.guideBodyElem_=o;const s=e.createElementNS(ue,"path");s.classList.add(ie("gh")),a.appendChild(s),this.guideHeadElem_=s;const l=e.createElement("div");l.classList.add(C("tt")()),this.knobElement.appendChild(l),this.tooltipElem_=l,n.value.emitter.on("change",this.onChange_),this.value=n.value,this.refresh()}onDraggingChange_(e){if(e.rawValue===null){this.element.classList.remove(ie(void 0,"drg"));return}this.element.classList.add(ie(void 0,"drg"));const n=e.rawValue/this.props_.get("pointerScale"),r=n+(n>0?-1:n<0?1:0),i=U(-r,-4,4);this.guideHeadElem_.setAttributeNS(null,"d",[`M ${r+i},0 L${r},4 L${r+i},8`,`M ${n},-1 L${n},9`].join(" ")),this.guideBodyElem_.setAttributeNS(null,"d",`M 0,4 L${n},4`);const a=this.props_.get("formatter");this.tooltipElem_.textContent=a(this.value.rawValue),this.tooltipElem_.style.left=`${n}px`}refresh(){const e=this.props_.get("formatter");this.inputElement.value=e(this.value.rawValue)}onChange_(){this.refresh()}}class kt{constructor(e,n){var r;this.originRawValue_=0,this.onInputChange_=this.onInputChange_.bind(this),this.onInputKeyDown_=this.onInputKeyDown_.bind(this),this.onInputKeyUp_=this.onInputKeyUp_.bind(this),this.onPointerDown_=this.onPointerDown_.bind(this),this.onPointerMove_=this.onPointerMove_.bind(this),this.onPointerUp_=this.onPointerUp_.bind(this),this.parser_=n.parser,this.props=n.props,this.sliderProps_=(r=n.sliderProps)!==null&&r!==void 0?r:null,this.value=n.value,this.viewProps=n.viewProps,this.dragging_=O(null),this.view=new jd(e,{arrayPosition:n.arrayPosition,dragging:this.dragging_,props:this.props,value:this.value,viewProps:this.viewProps}),this.view.inputElement.addEventListener("change",this.onInputChange_),this.view.inputElement.addEventListener("keydown",this.onInputKeyDown_),this.view.inputElement.addEventListener("keyup",this.onInputKeyUp_);const i=new Ge(this.view.knobElement);i.emitter.on("down",this.onPointerDown_),i.emitter.on("move",this.onPointerMove_),i.emitter.on("up",this.onPointerUp_)}constrainValue_(e){var n,r;const i=(n=this.sliderProps_)===null||n===void 0?void 0:n.get("min"),a=(r=this.sliderProps_)===null||r===void 0?void 0:r.get("max");let o=e;return i!==void 0&&(o=Math.max(o,i)),a!==void 0&&(o=Math.min(o,a)),o}onInputChange_(e){const r=e.currentTarget.value,i=this.parser_(r);R(i)||(this.value.rawValue=this.constrainValue_(i)),this.view.refresh()}onInputKeyDown_(e){const n=Y(this.props.get("keyScale"),_t(e));n!==0&&this.value.setRawValue(this.constrainValue_(this.value.rawValue+n),{forceEmit:!1,last:!1})}onInputKeyUp_(e){Y(this.props.get("keyScale"),_t(e))!==0&&this.value.setRawValue(this.value.rawValue,{forceEmit:!0,last:!0})}onPointerDown_(){this.originRawValue_=this.value.rawValue,this.dragging_.rawValue=0}computeDraggingValue_(e){if(!e.point)return null;const n=e.point.x-e.bounds.width/2;return this.constrainValue_(this.originRawValue_+n*this.props.get("pointerScale"))}onPointerMove_(e){const n=this.computeDraggingValue_(e.data);n!==null&&(this.value.setRawValue(n,{forceEmit:!1,last:!1}),this.dragging_.rawValue=this.value.rawValue-this.originRawValue_)}onPointerUp_(e){const n=this.computeDraggingValue_(e.data);n!==null&&(this.value.setRawValue(n,{forceEmit:!0,last:!0}),this.dragging_.rawValue=null)}}const mn=C("sld");class Gd{constructor(e,n){this.onChange_=this.onChange_.bind(this),this.props_=n.props,this.props_.emitter.on("change",this.onChange_),this.element=e.createElement("div"),this.element.classList.add(mn()),n.viewProps.bindClassModifiers(this.element);const r=e.createElement("div");r.classList.add(mn("t")),n.viewProps.bindTabIndex(r),this.element.appendChild(r),this.trackElement=r;const i=e.createElement("div");i.classList.add(mn("k")),this.trackElement.appendChild(i),this.knobElement=i,n.value.emitter.on("change",this.onChange_),this.value=n.value,this.update_()}update_(){const e=U(k(this.value.rawValue,this.props_.get("min"),this.props_.get("max"),0,100),0,100);this.knobElement.style.width=`${e}%`}onChange_(){this.update_()}}class qd{constructor(e,n){this.onKeyDown_=this.onKeyDown_.bind(this),this.onKeyUp_=this.onKeyUp_.bind(this),this.onPointerDownOrMove_=this.onPointerDownOrMove_.bind(this),this.onPointerUp_=this.onPointerUp_.bind(this),this.value=n.value,this.viewProps=n.viewProps,this.props=n.props,this.view=new Gd(e,{props:this.props,value:this.value,viewProps:this.viewProps}),this.ptHandler_=new Ge(this.view.trackElement),this.ptHandler_.emitter.on("down",this.onPointerDownOrMove_),this.ptHandler_.emitter.on("move",this.onPointerDownOrMove_),this.ptHandler_.emitter.on("up",this.onPointerUp_),this.view.trackElement.addEventListener("keydown",this.onKeyDown_),this.view.trackElement.addEventListener("keyup",this.onKeyUp_)}handlePointerEvent_(e,n){e.point&&this.value.setRawValue(k(U(e.point.x,0,e.bounds.width),0,e.bounds.width,this.props.get("min"),this.props.get("max")),n)}onPointerDownOrMove_(e){this.handlePointerEvent_(e.data,{forceEmit:!1,last:!1})}onPointerUp_(e){this.handlePointerEvent_(e.data,{forceEmit:!0,last:!0})}onKeyDown_(e){const n=Y(this.props.get("keyScale"),ye(e));n!==0&&this.value.setRawValue(this.value.rawValue+n,{forceEmit:!1,last:!1})}onKeyUp_(e){Y(this.props.get("keyScale"),ye(e))!==0&&this.value.setRawValue(this.value.rawValue,{forceEmit:!0,last:!0})}}const fn=C("sldtxt");class $d{constructor(e,n){this.element=e.createElement("div"),this.element.classList.add(fn());const r=e.createElement("div");r.classList.add(fn("s")),this.sliderView_=n.sliderView,r.appendChild(this.sliderView_.element),this.element.appendChild(r);const i=e.createElement("div");i.classList.add(fn("t")),this.textView_=n.textView,i.appendChild(this.textView_.element),this.element.appendChild(i)}}class Qt{constructor(e,n){this.value=n.value,this.viewProps=n.viewProps,this.sliderC_=new qd(e,{props:n.sliderProps,value:n.value,viewProps:this.viewProps}),this.textC_=new kt(e,{parser:n.parser,props:n.textProps,sliderProps:n.sliderProps,value:n.value,viewProps:n.viewProps}),this.view=new $d(e,{sliderView:this.sliderC_.view,textView:this.textC_.view})}get sliderController(){return this.sliderC_}get textController(){return this.textC_}importProps(e){return te(e,null,n=>({max:n.required.number,min:n.required.number}),n=>{const r=this.sliderC_.props;return r.set("max",n.max),r.set("min",n.min),!0})}exportProps(){const e=this.sliderC_.props;return ne(null,{max:e.get("max"),min:e.get("min")})}}function ka(t){return{sliderProps:new g({keyScale:t.keyScale,max:t.max,min:t.min}),textProps:new g({formatter:O(t.formatter),keyScale:t.keyScale,pointerScale:O(t.pointerScale)})}}const Xd={containerUnitSize:"cnt-usz"};function Ta(t){return`--${Xd[t]}`}function wt(t){return ua(t)}function De(t){if(Ln(t))return M(t,wt)}function ge(t,e){if(!t)return;const n=[],r=da(t,e);r&&n.push(r);const i=ca(t);return i&&n.push(i),new St(n)}function Kd(t){return t?t.major===nt.major:!1}function Da(t){if(t==="inline"||t==="popup")return t}function Tt(t,e){t.write(e)}const zt=C("ckb");class Yd{constructor(e,n){this.onValueChange_=this.onValueChange_.bind(this),this.element=e.createElement("div"),this.element.classList.add(zt()),n.viewProps.bindClassModifiers(this.element);const r=e.createElement("label");r.classList.add(zt("l")),this.element.appendChild(r),this.labelElement=r;const i=e.createElement("input");i.classList.add(zt("i")),i.type="checkbox",this.labelElement.appendChild(i),this.inputElement=i,n.viewProps.bindDisabled(this.inputElement);const a=e.createElement("div");a.classList.add(zt("w")),this.labelElement.appendChild(a);const o=tn(e,"check");a.appendChild(o),n.value.emitter.on("change",this.onValueChange_),this.value=n.value,this.update_()}update_(){this.inputElement.checked=this.value.rawValue}onValueChange_(){this.update_()}}class Zd{constructor(e,n){this.onInputChange_=this.onInputChange_.bind(this),this.onLabelMouseDown_=this.onLabelMouseDown_.bind(this),this.value=n.value,this.viewProps=n.viewProps,this.view=new Yd(e,{value:this.value,viewProps:this.viewProps}),this.view.inputElement.addEventListener("change",this.onInputChange_),this.view.labelElement.addEventListener("mousedown",this.onLabelMouseDown_)}onInputChange_(e){const n=e.currentTarget;this.value.rawValue=n.checked,e.preventDefault(),e.stopPropagation()}onLabelMouseDown_(e){e.preventDefault()}}function Jd(t){const e=[],n=or(t.options);return n&&e.push(n),new St(e)}const Qd=K({id:"input-bool",type:"input",accept:(t,e)=>{if(typeof t!="boolean")return null;const n=M(e,r=>({options:r.optional.custom(Lt),readonly:r.optional.constant(!1)}));return n?{initialValue:t,params:n}:null},binding:{reader:t=>Sa,constraint:t=>Jd(t.params),writer:t=>Tt},controller:t=>{const e=t.document,n=t.value,r=t.constraint,i=r&&Zt(r,At);return i?new Ie(e,{props:new g({options:i.values.value("options")}),value:n,viewProps:t.viewProps}):new Zd(e,{value:n,viewProps:t.viewProps})},api(t){return typeof t.controller.value.rawValue!="boolean"?null:t.controller.valueController instanceof Ie?new ir(t.controller):null}}),Me=C("col");class ec{constructor(e,n){this.element=e.createElement("div"),this.element.classList.add(Me()),n.foldable.bindExpandedClass(this.element,Me(void 0,"expanded")),he(n.foldable,"completed",tt(this.element,Me(void 0,"cpl")));const r=e.createElement("div");r.classList.add(Me("h")),this.element.appendChild(r);const i=e.createElement("div");i.classList.add(Me("s")),r.appendChild(i),this.swatchElement=i;const a=e.createElement("div");if(a.classList.add(Me("t")),r.appendChild(a),this.textElement=a,n.pickerLayout==="inline"){const o=e.createElement("div");o.classList.add(Me("p")),this.element.appendChild(o),this.pickerElement=o}else this.pickerElement=null}}function tc(t,e,n){const r=U(t/255,0,1),i=U(e/255,0,1),a=U(n/255,0,1),o=Math.max(r,i,a),s=Math.min(r,i,a),l=o-s;let d=0,c=0;const u=(s+o)/2;return l!==0&&(c=l/(1-Math.abs(o+s-1)),r===o?d=(i-a)/l:i===o?d=2+(a-r)/l:d=4+(r-i)/l,d=d/6+(d<0?1:0)),[d*360,c*100,u*100]}function nc(t,e,n){const r=(t%360+360)%360,i=U(e/100,0,1),a=U(n/100,0,1),o=(1-Math.abs(2*a-1))*i,s=o*(1-Math.abs(r/60%2-1)),l=a-o/2;let d,c,u;return r>=0&&r<60?[d,c,u]=[o,s,0]:r>=60&&r<120?[d,c,u]=[s,o,0]:r>=120&&r<180?[d,c,u]=[0,o,s]:r>=180&&r<240?[d,c,u]=[0,s,o]:r>=240&&r<300?[d,c,u]=[s,0,o]:[d,c,u]=[o,0,s],[(d+l)*255,(c+l)*255,(u+l)*255]}function rc(t,e,n){const r=U(t/255,0,1),i=U(e/255,0,1),a=U(n/255,0,1),o=Math.max(r,i,a),s=Math.min(r,i,a),l=o-s;let d;l===0?d=0:o===r?d=60*(((i-a)/l%6+6)%6):o===i?d=60*((a-r)/l+2):d=60*((r-i)/l+4);const c=o===0?0:l/o,u=o;return[d,c*100,u*100]}function Ra(t,e,n){const r=oa(t,360),i=U(e/100,0,1),a=U(n/100,0,1),o=a*i,s=o*(1-Math.abs(r/60%2-1)),l=a-o;let d,c,u;return r>=0&&r<60?[d,c,u]=[o,s,0]:r>=60&&r<120?[d,c,u]=[s,o,0]:r>=120&&r<180?[d,c,u]=[0,o,s]:r>=180&&r<240?[d,c,u]=[0,s,o]:r>=240&&r<300?[d,c,u]=[s,0,o]:[d,c,u]=[o,0,s],[(d+l)*255,(c+l)*255,(u+l)*255]}function ic(t,e,n){const r=n+e*(100-Math.abs(2*n-100))/200;return[t,r!==0?e*(100-Math.abs(2*n-100))/r:0,n+e*(100-Math.abs(2*n-100))/(2*100)]}function ac(t,e,n){const r=100-Math.abs(n*(200-e)/100-100);return[t,r!==0?e*n/r:0,n*(200-e)/(2*100)]}function me(t){return[t[0],t[1],t[2]]}function rn(t,e){return[t[0],t[1],t[2],e]}const oc={hsl:{hsl:(t,e,n)=>[t,e,n],hsv:ic,rgb:nc},hsv:{hsl:ac,hsv:(t,e,n)=>[t,e,n],rgb:Ra},rgb:{hsl:tc,hsv:rc,rgb:(t,e,n)=>[t,e,n]}};function Qe(t,e){return[e==="float"?1:t==="rgb"?255:360,e==="float"?1:t==="rgb"?255:100,e==="float"?1:t==="rgb"?255:100]}function sc(t,e){return t===e?e:oa(t,e)}function Ia(t,e,n){var r;const i=Qe(e,n);return[e==="rgb"?U(t[0],0,i[0]):sc(t[0],i[0]),U(t[1],0,i[1]),U(t[2],0,i[2]),U((r=t[3])!==null&&r!==void 0?r:1,0,1)]}function ri(t,e,n,r){const i=Qe(e,n),a=Qe(e,r);return t.map((o,s)=>o/i[s]*a[s])}function Na(t,e,n){const r=ri(t,e.mode,e.type,"int"),i=oc[e.mode][n.mode](...r);return ri(i,n.mode,"int",n.type)}class A{static black(){return new A([0,0,0],"rgb")}constructor(e,n){this.type="int",this.mode=n,this.comps_=Ia(e,n,this.type)}getComponents(e){return rn(Na(me(this.comps_),{mode:this.mode,type:this.type},{mode:e??this.mode,type:this.type}),this.comps_[3])}toRgbaObject(){const e=this.getComponents("rgb");return{r:e[0],g:e[1],b:e[2],a:e[3]}}}const Ae=C("colp");class lc{constructor(e,n){this.alphaViews_=null,this.element=e.createElement("div"),this.element.classList.add(Ae()),n.viewProps.bindClassModifiers(this.element);const r=e.createElement("div");r.classList.add(Ae("hsv"));const i=e.createElement("div");i.classList.add(Ae("sv")),this.svPaletteView_=n.svPaletteView,i.appendChild(this.svPaletteView_.element),r.appendChild(i);const a=e.createElement("div");a.classList.add(Ae("h")),this.hPaletteView_=n.hPaletteView,a.appendChild(this.hPaletteView_.element),r.appendChild(a),this.element.appendChild(r);const o=e.createElement("div");if(o.classList.add(Ae("rgb")),this.textsView_=n.textsView,o.appendChild(this.textsView_.element),this.element.appendChild(o),n.alphaViews){this.alphaViews_={palette:n.alphaViews.palette,text:n.alphaViews.text};const s=e.createElement("div");s.classList.add(Ae("a"));const l=e.createElement("div");l.classList.add(Ae("ap")),l.appendChild(this.alphaViews_.palette.element),s.appendChild(l);const d=e.createElement("div");d.classList.add(Ae("at")),d.appendChild(this.alphaViews_.text.element),s.appendChild(d),this.element.appendChild(s)}}get allFocusableElements(){const e=[this.svPaletteView_.element,this.hPaletteView_.element,this.textsView_.modeSelectElement,...this.textsView_.inputViews.map(n=>n.inputElement)];return this.alphaViews_&&e.push(this.alphaViews_.palette.element,this.alphaViews_.text.inputElement),e}}function dc(t){return t==="int"?"int":t==="float"?"float":void 0}function sr(t){return M(t,e=>({color:e.optional.object({alpha:e.optional.boolean,type:e.optional.custom(dc)}),expanded:e.optional.boolean,picker:e.optional.custom(Da),readonly:e.optional.constant(!1)}))}function He(t){return t?.1:1}function Oa(t){var e;return(e=t.color)===null||e===void 0?void 0:e.type}class lr{constructor(e,n){this.type="float",this.mode=n,this.comps_=Ia(e,n,this.type)}getComponents(e){return rn(Na(me(this.comps_),{mode:this.mode,type:this.type},{mode:e??this.mode,type:this.type}),this.comps_[3])}toRgbaObject(){const e=this.getComponents("rgb");return{r:e[0],g:e[1],b:e[2],a:e[3]}}}const cc={int:(t,e)=>new A(t,e),float:(t,e)=>new lr(t,e)};function dr(t,e,n){return cc[n](t,e)}function pc(t){return t.type==="float"}function uc(t){return t.type==="int"}function hc(t){const e=t.getComponents(),n=Qe(t.mode,"int");return new A([Math.round(k(e[0],0,1,0,n[0])),Math.round(k(e[1],0,1,0,n[1])),Math.round(k(e[2],0,1,0,n[2])),e[3]],t.mode)}function mc(t){const e=t.getComponents(),n=Qe(t.mode,"int");return new lr([k(e[0],0,n[0],0,1),k(e[1],0,n[1],0,1),k(e[2],0,n[2],0,1),e[3]],t.mode)}function X(t,e){if(t.type===e)return t;if(uc(t)&&e==="float")return mc(t);if(pc(t)&&e==="int")return hc(t);throw B.shouldNeverHappen()}function fc(t,e){return t.alpha===e.alpha&&t.mode===e.mode&&t.notation===e.notation&&t.type===e.type}function ae(t,e){const n=t.match(/^(.+)%$/);return Math.min(n?parseFloat(n[1])*.01*e:parseFloat(t),e)}const vc={deg:t=>t,grad:t=>t*360/400,rad:t=>t*360/(2*Math.PI),turn:t=>t*360};function Ma(t){const e=t.match(/^([0-9.]+?)(deg|grad|rad|turn)$/);if(!e)return parseFloat(t);const n=parseFloat(e[1]),r=e[2];return vc[r](n)}function Va(t){const e=t.match(/^rgb\(\s*([0-9A-Fa-f.]+%?)\s*,\s*([0-9A-Fa-f.]+%?)\s*,\s*([0-9A-Fa-f.]+%?)\s*\)$/);if(!e)return null;const n=[ae(e[1],255),ae(e[2],255),ae(e[3],255)];return isNaN(n[0])||isNaN(n[1])||isNaN(n[2])?null:n}function bc(t){const e=Va(t);return e?new A(e,"rgb"):null}function Ba(t){const e=t.match(/^rgba\(\s*([0-9A-Fa-f.]+%?)\s*,\s*([0-9A-Fa-f.]+%?)\s*,\s*([0-9A-Fa-f.]+%?)\s*,\s*([0-9A-Fa-f.]+%?)\s*\)$/);if(!e)return null;const n=[ae(e[1],255),ae(e[2],255),ae(e[3],255),ae(e[4],1)];return isNaN(n[0])||isNaN(n[1])||isNaN(n[2])||isNaN(n[3])?null:n}function gc(t){const e=Ba(t);return e?new A(e,"rgb"):null}function Fa(t){const e=t.match(/^hsl\(\s*([0-9A-Fa-f.]+(?:deg|grad|rad|turn)?)\s*,\s*([0-9A-Fa-f.]+%?)\s*,\s*([0-9A-Fa-f.]+%?)\s*\)$/);if(!e)return null;const n=[Ma(e[1]),ae(e[2],100),ae(e[3],100)];return isNaN(n[0])||isNaN(n[1])||isNaN(n[2])?null:n}function _c(t){const e=Fa(t);return e?new A(e,"hsl"):null}function za(t){const e=t.match(/^hsla\(\s*([0-9A-Fa-f.]+(?:deg|grad|rad|turn)?)\s*,\s*([0-9A-Fa-f.]+%?)\s*,\s*([0-9A-Fa-f.]+%?)\s*,\s*([0-9A-Fa-f.]+%?)\s*\)$/);if(!e)return null;const n=[Ma(e[1]),ae(e[2],100),ae(e[3],100),ae(e[4],1)];return isNaN(n[0])||isNaN(n[1])||isNaN(n[2])||isNaN(n[3])?null:n}function wc(t){const e=za(t);return e?new A(e,"hsl"):null}function Ua(t){const e=t.match(/^#([0-9A-Fa-f])([0-9A-Fa-f])([0-9A-Fa-f])$/);if(e)return[parseInt(e[1]+e[1],16),parseInt(e[2]+e[2],16),parseInt(e[3]+e[3],16)];const n=t.match(/^(?:#|0x)([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/);return n?[parseInt(n[1],16),parseInt(n[2],16),parseInt(n[3],16)]:null}function xc(t){const e=Ua(t);return e?new A(e,"rgb"):null}function Ha(t){const e=t.match(/^#([0-9A-Fa-f])([0-9A-Fa-f])([0-9A-Fa-f])([0-9A-Fa-f])$/);if(e)return[parseInt(e[1]+e[1],16),parseInt(e[2]+e[2],16),parseInt(e[3]+e[3],16),k(parseInt(e[4]+e[4],16),0,255,0,1)];const n=t.match(/^(?:#|0x)?([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/);return n?[parseInt(n[1],16),parseInt(n[2],16),parseInt(n[3],16),k(parseInt(n[4],16),0,255,0,1)]:null}function yc(t){const e=Ha(t);return e?new A(e,"rgb"):null}function Wa(t){const e=t.match(/^\{\s*r\s*:\s*([0-9A-Fa-f.]+%?)\s*,\s*g\s*:\s*([0-9A-Fa-f.]+%?)\s*,\s*b\s*:\s*([0-9A-Fa-f.]+%?)\s*\}$/);if(!e)return null;const n=[parseFloat(e[1]),parseFloat(e[2]),parseFloat(e[3])];return isNaN(n[0])||isNaN(n[1])||isNaN(n[2])?null:n}function Ec(t){return e=>{const n=Wa(e);return n?dr(n,"rgb",t):null}}function ja(t){const e=t.match(/^\{\s*r\s*:\s*([0-9A-Fa-f.]+%?)\s*,\s*g\s*:\s*([0-9A-Fa-f.]+%?)\s*,\s*b\s*:\s*([0-9A-Fa-f.]+%?)\s*,\s*a\s*:\s*([0-9A-Fa-f.]+%?)\s*\}$/);if(!e)return null;const n=[parseFloat(e[1]),parseFloat(e[2]),parseFloat(e[3]),parseFloat(e[4])];return isNaN(n[0])||isNaN(n[1])||isNaN(n[2])||isNaN(n[3])?null:n}function Pc(t){return e=>{const n=ja(e);return n?dr(n,"rgb",t):null}}const Cc=[{parser:Ua,result:{alpha:!1,mode:"rgb",notation:"hex"}},{parser:Ha,result:{alpha:!0,mode:"rgb",notation:"hex"}},{parser:Va,result:{alpha:!1,mode:"rgb",notation:"func"}},{parser:Ba,result:{alpha:!0,mode:"rgb",notation:"func"}},{parser:Fa,result:{alpha:!1,mode:"hsl",notation:"func"}},{parser:za,result:{alpha:!0,mode:"hsl",notation:"func"}},{parser:Wa,result:{alpha:!1,mode:"rgb",notation:"object"}},{parser:ja,result:{alpha:!0,mode:"rgb",notation:"object"}}];function Sc(t){return Cc.reduce((e,{parser:n,result:r})=>e||(n(t)?r:null),null)}function Ac(t,e="int"){const n=Sc(t);return n?n.notation==="hex"&&e!=="float"?Object.assign(Object.assign({},n),{type:"int"}):n.notation==="func"?Object.assign(Object.assign({},n),{type:e}):null:null}function Dt(t){const e=[xc,yc,bc,gc,_c,wc];e.push(Ec("int"),Pc("int"));const n=Ud(e);return r=>{const i=n(r);return i?X(i,t):null}}function Lc(t){const e=Dt("int");if(typeof t!="string")return A.black();const n=e(t);return n??A.black()}function Ga(t){const e=U(Math.floor(t),0,255).toString(16);return e.length===1?`0${e}`:e}function cr(t,e="#"){const n=me(t.getComponents("rgb")).map(Ga).join("");return`${e}${n}`}function pr(t,e="#"){const n=t.getComponents("rgb"),r=[n[0],n[1],n[2],n[3]*255].map(Ga).join("");return`${e}${r}`}function qa(t){const e=Z(0),n=X(t,"int");return`rgb(${me(n.getComponents("rgb")).map(i=>e(i)).join(", ")})`}function Wt(t){const e=Z(2),n=Z(0);return`rgba(${X(t,"int").getComponents("rgb").map((a,o)=>(o===3?e:n)(a)).join(", ")})`}function kc(t){const e=[Z(0),Jt,Jt],n=X(t,"int");return`hsl(${me(n.getComponents("hsl")).map((i,a)=>e[a](i)).join(", ")})`}function Tc(t){const e=[Z(0),Jt,Jt,Z(2)];return`hsla(${X(t,"int").getComponents("hsl").map((i,a)=>e[a](i)).join(", ")})`}function $a(t,e){const n=Z(e==="float"?2:0),r=["r","g","b"],i=X(t,e);return`{${me(i.getComponents("rgb")).map((o,s)=>`${r[s]}: ${n(o)}`).join(", ")}}`}function Dc(t){return e=>$a(e,t)}function Xa(t,e){const n=Z(2),r=Z(e==="float"?2:0),i=["r","g","b","a"];return`{${X(t,e).getComponents("rgb").map((s,l)=>{const d=l===3?n:r;return`${i[l]}: ${d(s)}`}).join(", ")}}`}function Rc(t){return e=>Xa(e,t)}const Ic=[{format:{alpha:!1,mode:"rgb",notation:"hex",type:"int"},stringifier:cr},{format:{alpha:!0,mode:"rgb",notation:"hex",type:"int"},stringifier:pr},{format:{alpha:!1,mode:"rgb",notation:"func",type:"int"},stringifier:qa},{format:{alpha:!0,mode:"rgb",notation:"func",type:"int"},stringifier:Wt},{format:{alpha:!1,mode:"hsl",notation:"func",type:"int"},stringifier:kc},{format:{alpha:!0,mode:"hsl",notation:"func",type:"int"},stringifier:Tc},...["int","float"].reduce((t,e)=>[...t,{format:{alpha:!1,mode:"rgb",notation:"object",type:e},stringifier:Dc(e)},{format:{alpha:!0,mode:"rgb",notation:"object",type:e},stringifier:Rc(e)}],[])];function Ka(t){return Ic.reduce((e,n)=>e||(fc(n.format,t)?n.stringifier:null),null)}const ut=C("apl");class Nc{constructor(e,n){this.onValueChange_=this.onValueChange_.bind(this),this.value=n.value,this.value.emitter.on("change",this.onValueChange_),this.element=e.createElement("div"),this.element.classList.add(ut()),n.viewProps.bindClassModifiers(this.element),n.viewProps.bindTabIndex(this.element);const r=e.createElement("div");r.classList.add(ut("b")),this.element.appendChild(r);const i=e.createElement("div");i.classList.add(ut("c")),r.appendChild(i),this.colorElem_=i;const a=e.createElement("div");a.classList.add(ut("m")),this.element.appendChild(a),this.markerElem_=a;const o=e.createElement("div");o.classList.add(ut("p")),this.markerElem_.appendChild(o),this.previewElem_=o,this.update_()}update_(){const e=this.value.rawValue,n=e.getComponents("rgb"),r=new A([n[0],n[1],n[2],0],"rgb"),i=new A([n[0],n[1],n[2],255],"rgb"),a=["to right",Wt(r),Wt(i)];this.colorElem_.style.background=`linear-gradient(${a.join(",")})`,this.previewElem_.style.backgroundColor=Wt(e);const o=k(n[3],0,1,0,100);this.markerElem_.style.left=`${o}%`}onValueChange_(){this.update_()}}class Oc{constructor(e,n){this.onKeyDown_=this.onKeyDown_.bind(this),this.onKeyUp_=this.onKeyUp_.bind(this),this.onPointerDown_=this.onPointerDown_.bind(this),this.onPointerMove_=this.onPointerMove_.bind(this),this.onPointerUp_=this.onPointerUp_.bind(this),this.value=n.value,this.viewProps=n.viewProps,this.view=new Nc(e,{value:this.value,viewProps:this.viewProps}),this.ptHandler_=new Ge(this.view.element),this.ptHandler_.emitter.on("down",this.onPointerDown_),this.ptHandler_.emitter.on("move",this.onPointerMove_),this.ptHandler_.emitter.on("up",this.onPointerUp_),this.view.element.addEventListener("keydown",this.onKeyDown_),this.view.element.addEventListener("keyup",this.onKeyUp_)}handlePointerEvent_(e,n){if(!e.point)return;const r=e.point.x/e.bounds.width,i=this.value.rawValue,[a,o,s]=i.getComponents("hsv");this.value.setRawValue(new A([a,o,s,r],"hsv"),n)}onPointerDown_(e){this.handlePointerEvent_(e.data,{forceEmit:!1,last:!1})}onPointerMove_(e){this.handlePointerEvent_(e.data,{forceEmit:!1,last:!1})}onPointerUp_(e){this.handlePointerEvent_(e.data,{forceEmit:!0,last:!0})}onKeyDown_(e){const n=Y(He(!0),ye(e));if(n===0)return;const r=this.value.rawValue,[i,a,o,s]=r.getComponents("hsv");this.value.setRawValue(new A([i,a,o,s+n],"hsv"),{forceEmit:!1,last:!1})}onKeyUp_(e){Y(He(!0),ye(e))!==0&&this.value.setRawValue(this.value.rawValue,{forceEmit:!0,last:!0})}}const Xe=C("coltxt");function Mc(t){const e=t.createElement("select"),n=[{text:"RGB",value:"rgb"},{text:"HSL",value:"hsl"},{text:"HSV",value:"hsv"},{text:"HEX",value:"hex"}];return e.appendChild(n.reduce((r,i)=>{const a=t.createElement("option");return a.textContent=i.text,a.value=i.value,r.appendChild(a),r},t.createDocumentFragment())),e}class Vc{constructor(e,n){this.element=e.createElement("div"),this.element.classList.add(Xe()),n.viewProps.bindClassModifiers(this.element);const r=e.createElement("div");r.classList.add(Xe("m")),this.modeElem_=Mc(e),this.modeElem_.classList.add(Xe("ms")),r.appendChild(this.modeSelectElement),n.viewProps.bindDisabled(this.modeElem_);const i=e.createElement("div");i.classList.add(Xe("mm")),i.appendChild(tn(e,"dropdown")),r.appendChild(i),this.element.appendChild(r);const a=e.createElement("div");a.classList.add(Xe("w")),this.element.appendChild(a),this.inputsElem_=a,this.inputViews_=n.inputViews,this.applyInputViews_(),_e(n.mode,o=>{this.modeElem_.value=o})}get modeSelectElement(){return this.modeElem_}get inputViews(){return this.inputViews_}set inputViews(e){this.inputViews_=e,this.applyInputViews_()}applyInputViews_(){fa(this.inputsElem_);const e=this.element.ownerDocument;this.inputViews_.forEach(n=>{const r=e.createElement("div");r.classList.add(Xe("c")),r.appendChild(n.element),this.inputsElem_.appendChild(r)})}}function Bc(t){return Z(t==="float"?2:0)}function Fc(t,e,n){const r=Qe(t,e)[n];return new Et({min:0,max:r})}function zc(t,e,n){return new kt(t,{arrayPosition:n===0?"fst":n===2?"lst":"mid",parser:e.parser,props:g.fromObject({formatter:Bc(e.colorType),keyScale:He(!1),pointerScale:e.colorType==="float"?.01:1}),value:O(0,{constraint:Fc(e.colorMode,e.colorType,n)}),viewProps:e.viewProps})}function Uc(t,e){const n={colorMode:e.colorMode,colorType:e.colorType,parser:xe,viewProps:e.viewProps};return[0,1,2].map(r=>{const i=zc(t,n,r);return it({primary:e.value,secondary:i.value,forward(a){return X(a,e.colorType).getComponents(e.colorMode)[r]},backward(a,o){const s=e.colorMode,d=X(a,e.colorType).getComponents(s);d[r]=o;const c=dr(rn(me(d),d[3]),s,e.colorType);return X(c,"int")}}),i})}function Hc(t,e){const n=new gt(t,{parser:Dt("int"),props:g.fromObject({formatter:cr}),value:O(A.black()),viewProps:e.viewProps});return it({primary:e.value,secondary:n.value,forward:r=>new A(me(r.getComponents()),r.mode),backward:(r,i)=>new A(rn(me(i.getComponents(r.mode)),r.getComponents()[3]),r.mode)}),[n]}function Wc(t){return t!=="hex"}class jc{constructor(e,n){this.onModeSelectChange_=this.onModeSelectChange_.bind(this),this.colorType_=n.colorType,this.value=n.value,this.viewProps=n.viewProps,this.colorMode=O(this.value.rawValue.mode),this.ccs_=this.createComponentControllers_(e),this.view=new Vc(e,{mode:this.colorMode,inputViews:[this.ccs_[0].view,this.ccs_[1].view,this.ccs_[2].view],viewProps:this.viewProps}),this.view.modeSelectElement.addEventListener("change",this.onModeSelectChange_)}createComponentControllers_(e){const n=this.colorMode.rawValue;return Wc(n)?Uc(e,{colorMode:n,colorType:this.colorType_,value:this.value,viewProps:this.viewProps}):Hc(e,{value:this.value,viewProps:this.viewProps})}onModeSelectChange_(e){const n=e.currentTarget;this.colorMode.rawValue=n.value,this.ccs_=this.createComponentControllers_(this.view.element.ownerDocument),this.view.inputViews=this.ccs_.map(r=>r.view)}}const vn=C("hpl");class Gc{constructor(e,n){this.onValueChange_=this.onValueChange_.bind(this),this.value=n.value,this.value.emitter.on("change",this.onValueChange_),this.element=e.createElement("div"),this.element.classList.add(vn()),n.viewProps.bindClassModifiers(this.element),n.viewProps.bindTabIndex(this.element);const r=e.createElement("div");r.classList.add(vn("c")),this.element.appendChild(r);const i=e.createElement("div");i.classList.add(vn("m")),this.element.appendChild(i),this.markerElem_=i,this.update_()}update_(){const e=this.value.rawValue,[n]=e.getComponents("hsv");this.markerElem_.style.backgroundColor=qa(new A([n,100,100],"hsv"));const r=k(n,0,360,0,100);this.markerElem_.style.left=`${r}%`}onValueChange_(){this.update_()}}class qc{constructor(e,n){this.onKeyDown_=this.onKeyDown_.bind(this),this.onKeyUp_=this.onKeyUp_.bind(this),this.onPointerDown_=this.onPointerDown_.bind(this),this.onPointerMove_=this.onPointerMove_.bind(this),this.onPointerUp_=this.onPointerUp_.bind(this),this.value=n.value,this.viewProps=n.viewProps,this.view=new Gc(e,{value:this.value,viewProps:this.viewProps}),this.ptHandler_=new Ge(this.view.element),this.ptHandler_.emitter.on("down",this.onPointerDown_),this.ptHandler_.emitter.on("move",this.onPointerMove_),this.ptHandler_.emitter.on("up",this.onPointerUp_),this.view.element.addEventListener("keydown",this.onKeyDown_),this.view.element.addEventListener("keyup",this.onKeyUp_)}handlePointerEvent_(e,n){if(!e.point)return;const r=k(U(e.point.x,0,e.bounds.width),0,e.bounds.width,0,360),i=this.value.rawValue,[,a,o,s]=i.getComponents("hsv");this.value.setRawValue(new A([r,a,o,s],"hsv"),n)}onPointerDown_(e){this.handlePointerEvent_(e.data,{forceEmit:!1,last:!1})}onPointerMove_(e){this.handlePointerEvent_(e.data,{forceEmit:!1,last:!1})}onPointerUp_(e){this.handlePointerEvent_(e.data,{forceEmit:!0,last:!0})}onKeyDown_(e){const n=Y(He(!1),ye(e));if(n===0)return;const r=this.value.rawValue,[i,a,o,s]=r.getComponents("hsv");this.value.setRawValue(new A([i+n,a,o,s],"hsv"),{forceEmit:!1,last:!1})}onKeyUp_(e){Y(He(!1),ye(e))!==0&&this.value.setRawValue(this.value.rawValue,{forceEmit:!0,last:!0})}}const bn=C("svp"),ii=64;class $c{constructor(e,n){this.onValueChange_=this.onValueChange_.bind(this),this.value=n.value,this.value.emitter.on("change",this.onValueChange_),this.element=e.createElement("div"),this.element.classList.add(bn()),n.viewProps.bindClassModifiers(this.element),n.viewProps.bindTabIndex(this.element);const r=e.createElement("canvas");r.height=ii,r.width=ii,r.classList.add(bn("c")),this.element.appendChild(r),this.canvasElement=r;const i=e.createElement("div");i.classList.add(bn("m")),this.element.appendChild(i),this.markerElem_=i,this.update_()}update_(){const e=ql(this.canvasElement);if(!e)return;const r=this.value.rawValue.getComponents("hsv"),i=this.canvasElement.width,a=this.canvasElement.height,o=e.getImageData(0,0,i,a),s=o.data;for(let c=0;c<a;c++)for(let u=0;u<i;u++){const p=k(u,0,i,0,100),w=k(c,0,a,100,0),f=Ra(r[0],p,w),h=(c*i+u)*4;s[h]=f[0],s[h+1]=f[1],s[h+2]=f[2],s[h+3]=255}e.putImageData(o,0,0);const l=k(r[1],0,100,0,100);this.markerElem_.style.left=`${l}%`;const d=k(r[2],0,100,100,0);this.markerElem_.style.top=`${d}%`}onValueChange_(){this.update_()}}class Xc{constructor(e,n){this.onKeyDown_=this.onKeyDown_.bind(this),this.onKeyUp_=this.onKeyUp_.bind(this),this.onPointerDown_=this.onPointerDown_.bind(this),this.onPointerMove_=this.onPointerMove_.bind(this),this.onPointerUp_=this.onPointerUp_.bind(this),this.value=n.value,this.viewProps=n.viewProps,this.view=new $c(e,{value:this.value,viewProps:this.viewProps}),this.ptHandler_=new Ge(this.view.element),this.ptHandler_.emitter.on("down",this.onPointerDown_),this.ptHandler_.emitter.on("move",this.onPointerMove_),this.ptHandler_.emitter.on("up",this.onPointerUp_),this.view.element.addEventListener("keydown",this.onKeyDown_),this.view.element.addEventListener("keyup",this.onKeyUp_)}handlePointerEvent_(e,n){if(!e.point)return;const r=k(e.point.x,0,e.bounds.width,0,100),i=k(e.point.y,0,e.bounds.height,100,0),[a,,,o]=this.value.rawValue.getComponents("hsv");this.value.setRawValue(new A([a,r,i,o],"hsv"),n)}onPointerDown_(e){this.handlePointerEvent_(e.data,{forceEmit:!1,last:!1})}onPointerMove_(e){this.handlePointerEvent_(e.data,{forceEmit:!1,last:!1})}onPointerUp_(e){this.handlePointerEvent_(e.data,{forceEmit:!0,last:!0})}onKeyDown_(e){La(e.key)&&e.preventDefault();const[n,r,i,a]=this.value.rawValue.getComponents("hsv"),o=He(!1),s=Y(o,ye(e)),l=Y(o,_t(e));s===0&&l===0||this.value.setRawValue(new A([n,r+s,i+l,a],"hsv"),{forceEmit:!1,last:!1})}onKeyUp_(e){const n=He(!1),r=Y(n,ye(e)),i=Y(n,_t(e));r===0&&i===0||this.value.setRawValue(this.value.rawValue,{forceEmit:!0,last:!0})}}class Kc{constructor(e,n){this.value=n.value,this.viewProps=n.viewProps,this.hPaletteC_=new qc(e,{value:this.value,viewProps:this.viewProps}),this.svPaletteC_=new Xc(e,{value:this.value,viewProps:this.viewProps}),this.alphaIcs_=n.supportsAlpha?{palette:new Oc(e,{value:this.value,viewProps:this.viewProps}),text:new kt(e,{parser:xe,props:g.fromObject({pointerScale:.01,keyScale:.1,formatter:Z(2)}),value:O(0,{constraint:new Et({min:0,max:1})}),viewProps:this.viewProps})}:null,this.alphaIcs_&&it({primary:this.value,secondary:this.alphaIcs_.text.value,forward:r=>r.getComponents()[3],backward:(r,i)=>{const a=r.getComponents();return a[3]=i,new A(a,r.mode)}}),this.textsC_=new jc(e,{colorType:n.colorType,value:this.value,viewProps:this.viewProps}),this.view=new lc(e,{alphaViews:this.alphaIcs_?{palette:this.alphaIcs_.palette.view,text:this.alphaIcs_.text.view}:null,hPaletteView:this.hPaletteC_.view,supportsAlpha:n.supportsAlpha,svPaletteView:this.svPaletteC_.view,textsView:this.textsC_.view,viewProps:this.viewProps})}get textsController(){return this.textsC_}}const gn=C("colsw");class Yc{constructor(e,n){this.onValueChange_=this.onValueChange_.bind(this),n.value.emitter.on("change",this.onValueChange_),this.value=n.value,this.element=e.createElement("div"),this.element.classList.add(gn()),n.viewProps.bindClassModifiers(this.element);const r=e.createElement("div");r.classList.add(gn("sw")),this.element.appendChild(r),this.swatchElem_=r;const i=e.createElement("button");i.classList.add(gn("b")),n.viewProps.bindDisabled(i),this.element.appendChild(i),this.buttonElement=i,this.update_()}update_(){const e=this.value.rawValue;this.swatchElem_.style.backgroundColor=pr(e)}onValueChange_(){this.update_()}}class Zc{constructor(e,n){this.value=n.value,this.viewProps=n.viewProps,this.view=new Yc(e,{value:this.value,viewProps:this.viewProps})}}class ur{constructor(e,n){this.onButtonBlur_=this.onButtonBlur_.bind(this),this.onButtonClick_=this.onButtonClick_.bind(this),this.onPopupChildBlur_=this.onPopupChildBlur_.bind(this),this.onPopupChildKeydown_=this.onPopupChildKeydown_.bind(this),this.value=n.value,this.viewProps=n.viewProps,this.foldable_=Ct.create(n.expanded),this.swatchC_=new Zc(e,{value:this.value,viewProps:this.viewProps});const r=this.swatchC_.view.buttonElement;r.addEventListener("blur",this.onButtonBlur_),r.addEventListener("click",this.onButtonClick_),this.textC_=new gt(e,{parser:n.parser,props:g.fromObject({formatter:n.formatter}),value:this.value,viewProps:this.viewProps}),this.view=new ec(e,{foldable:this.foldable_,pickerLayout:n.pickerLayout}),this.view.swatchElement.appendChild(this.swatchC_.view.element),this.view.textElement.appendChild(this.textC_.view.element),this.popC_=n.pickerLayout==="popup"?new Ca(e,{viewProps:this.viewProps}):null;const i=new Kc(e,{colorType:n.colorType,supportsAlpha:n.supportsAlpha,value:this.value,viewProps:this.viewProps});i.view.allFocusableElements.forEach(a=>{a.addEventListener("blur",this.onPopupChildBlur_),a.addEventListener("keydown",this.onPopupChildKeydown_)}),this.pickerC_=i,this.popC_?(this.view.element.appendChild(this.popC_.view.element),this.popC_.view.element.appendChild(i.view.element),it({primary:this.foldable_.value("expanded"),secondary:this.popC_.shows,forward:a=>a,backward:(a,o)=>o})):this.view.pickerElement&&(this.view.pickerElement.appendChild(this.pickerC_.view.element),rr(this.foldable_,this.view.pickerElement))}get textController(){return this.textC_}onButtonBlur_(e){if(!this.popC_)return;const n=this.view.element,r=e.relatedTarget;(!r||!n.contains(r))&&(this.popC_.shows.rawValue=!1)}onButtonClick_(){this.foldable_.set("expanded",!this.foldable_.get("expanded")),this.foldable_.get("expanded")&&this.pickerC_.view.allFocusableElements[0].focus()}onPopupChildBlur_(e){if(!this.popC_)return;const n=this.popC_.view.element,r=va(e);r&&n.contains(r)||r&&r===this.swatchC_.view.buttonElement&&!Zn(n.ownerDocument)||(this.popC_.shows.rawValue=!1)}onPopupChildKeydown_(e){this.popC_?e.key==="Escape"&&(this.popC_.shows.rawValue=!1):this.view.pickerElement&&e.key==="Escape"&&this.swatchC_.view.buttonElement.focus()}}function Jc(t){return me(t.getComponents("rgb")).reduce((e,n)=>e<<8|Math.floor(n)&255,0)}function Qc(t){return t.getComponents("rgb").reduce((e,n,r)=>{const i=Math.floor(r===3?n*255:n)&255;return e<<8|i},0)>>>0}function ep(t){return new A([t>>16&255,t>>8&255,t&255],"rgb")}function tp(t){return new A([t>>24&255,t>>16&255,t>>8&255,k(t&255,0,255,0,1)],"rgb")}function np(t){return typeof t!="number"?A.black():ep(t)}function rp(t){return typeof t!="number"?A.black():tp(t)}function jt(t,e){return typeof t!="object"||R(t)?!1:e in t&&typeof t[e]=="number"}function Ya(t){return jt(t,"r")&&jt(t,"g")&&jt(t,"b")}function Za(t){return Ya(t)&&jt(t,"a")}function Ja(t){return Ya(t)}function hr(t,e){if(t.mode!==e.mode||t.type!==e.type)return!1;const n=t.getComponents(),r=e.getComponents();for(let i=0;i<n.length;i++)if(n[i]!==r[i])return!1;return!0}function ai(t){return"a"in t?[t.r,t.g,t.b,t.a]:[t.r,t.g,t.b]}function ip(t){const e=Ka(t);return e?(n,r)=>{Tt(n,e(r))}:null}function ap(t){const e=t?Qc:Jc;return(n,r)=>{Tt(n,e(r))}}function op(t,e,n){const i=X(e,n).toRgbaObject();t.writeProperty("r",i.r),t.writeProperty("g",i.g),t.writeProperty("b",i.b),t.writeProperty("a",i.a)}function sp(t,e,n){const i=X(e,n).toRgbaObject();t.writeProperty("r",i.r),t.writeProperty("g",i.g),t.writeProperty("b",i.b)}function lp(t,e){return(n,r)=>{t?op(n,r,e):sp(n,r,e)}}function dp(t){var e;return!!(!((e=t==null?void 0:t.color)===null||e===void 0)&&e.alpha)}function cp(t){return t?e=>pr(e,"0x"):e=>cr(e,"0x")}function pp(t){return"color"in t||t.view==="color"}const up=K({id:"input-color-number",type:"input",accept:(t,e)=>{if(typeof t!="number"||!pp(e))return null;const n=sr(e);return n?{initialValue:t,params:Object.assign(Object.assign({},n),{supportsAlpha:dp(e)})}:null},binding:{reader:t=>t.params.supportsAlpha?rp:np,equals:hr,writer:t=>ap(t.params.supportsAlpha)},controller:t=>{var e,n;return new ur(t.document,{colorType:"int",expanded:(e=t.params.expanded)!==null&&e!==void 0?e:!1,formatter:cp(t.params.supportsAlpha),parser:Dt("int"),pickerLayout:(n=t.params.picker)!==null&&n!==void 0?n:"popup",supportsAlpha:t.params.supportsAlpha,value:t.value,viewProps:t.viewProps})}});function hp(t,e){if(!Ja(t))return X(A.black(),e);if(e==="int"){const n=ai(t);return new A(n,"rgb")}if(e==="float"){const n=ai(t);return new lr(n,"rgb")}return X(A.black(),"int")}function mp(t){return Za(t)}function fp(t){return e=>{const n=hp(e,t);return X(n,"int")}}function vp(t,e){return n=>t?Xa(n,e):$a(n,e)}const bp=K({id:"input-color-object",type:"input",accept:(t,e)=>{var n;if(!Ja(t))return null;const r=sr(e);return r?{initialValue:t,params:Object.assign(Object.assign({},r),{colorType:(n=Oa(e))!==null&&n!==void 0?n:"int"})}:null},binding:{reader:t=>fp(t.params.colorType),equals:hr,writer:t=>lp(mp(t.initialValue),t.params.colorType)},controller:t=>{var e,n;const r=Za(t.initialValue);return new ur(t.document,{colorType:t.params.colorType,expanded:(e=t.params.expanded)!==null&&e!==void 0?e:!1,formatter:vp(r,t.params.colorType),parser:Dt("int"),pickerLayout:(n=t.params.picker)!==null&&n!==void 0?n:"popup",supportsAlpha:r,value:t.value,viewProps:t.viewProps})}}),gp=K({id:"input-color-string",type:"input",accept:(t,e)=>{if(typeof t!="string"||e.view==="text")return null;const n=Ac(t,Oa(e));if(!n)return null;const r=Ka(n);if(!r)return null;const i=sr(e);return i?{initialValue:t,params:Object.assign(Object.assign({},i),{format:n,stringifier:r})}:null},binding:{reader:()=>Lc,equals:hr,writer:t=>{const e=ip(t.params.format);if(!e)throw B.notBindable();return e}},controller:t=>{var e,n;return new ur(t.document,{colorType:t.params.format.type,expanded:(e=t.params.expanded)!==null&&e!==void 0?e:!1,formatter:t.params.stringifier,parser:Dt("int"),pickerLayout:(n=t.params.picker)!==null&&n!==void 0?n:"popup",supportsAlpha:t.params.format.alpha,value:t.value,viewProps:t.viewProps})}});class mr{constructor(e){this.components=e.components,this.asm_=e.assembly}constrain(e){const n=this.asm_.toComponents(e).map((r,i)=>{var a,o;return(o=(a=this.components[i])===null||a===void 0?void 0:a.constrain(r))!==null&&o!==void 0?o:r});return this.asm_.fromComponents(n)}}const oi=C("pndtxt");class _p{constructor(e,n){this.textViews=n.textViews,this.element=e.createElement("div"),this.element.classList.add(oi()),this.textViews.forEach(r=>{const i=e.createElement("div");i.classList.add(oi("a")),i.appendChild(r.element),this.element.appendChild(i)})}}function wp(t,e,n){return new kt(t,{arrayPosition:n===0?"fst":n===e.axes.length-1?"lst":"mid",parser:e.parser,props:e.axes[n].textProps,value:O(0,{constraint:e.axes[n].constraint}),viewProps:e.viewProps})}class fr{constructor(e,n){this.value=n.value,this.viewProps=n.viewProps,this.acs_=n.axes.map((r,i)=>wp(e,n,i)),this.acs_.forEach((r,i)=>{it({primary:this.value,secondary:r.value,forward:a=>n.assembly.toComponents(a)[i],backward:(a,o)=>{const s=n.assembly.toComponents(a);return s[i]=o,n.assembly.fromComponents(s)}})}),this.view=new _p(e,{textViews:this.acs_.map(r=>r.view)})}get textControllers(){return this.acs_}}class xp extends bt{get max(){return this.controller.valueController.sliderController.props.get("max")}set max(e){this.controller.valueController.sliderController.props.set("max",e)}get min(){return this.controller.valueController.sliderController.props.get("min")}set min(e){this.controller.valueController.sliderController.props.set("min",e)}}function yp(t,e){const n=[],r=da(t,e);r&&n.push(r);const i=ca(t);i&&n.push(i);const a=or(t.options);return a&&n.push(a),new St(n)}const Ep=K({id:"input-number",type:"input",accept:(t,e)=>{if(typeof t!="number")return null;const n=M(e,r=>Object.assign(Object.assign({},ua(r)),{options:r.optional.custom(Lt),readonly:r.optional.constant(!1)}));return n?{initialValue:t,params:n}:null},binding:{reader:t=>aa,constraint:t=>yp(t.params,t.initialValue),writer:t=>Tt},controller:t=>{const e=t.value,n=t.constraint,r=n&&Zt(n,At);if(r)return new Ie(t.document,{props:new g({options:r.values.value("options")}),value:e,viewProps:t.viewProps});const i=pa(t.params,e.rawValue),a=n&&Zt(n,Et);return a?new Qt(t.document,Object.assign(Object.assign({},ka(Object.assign(Object.assign({},i),{keyScale:O(i.keyScale),max:a.values.value("max"),min:a.values.value("min")}))),{parser:xe,value:e,viewProps:t.viewProps})):new kt(t.document,{parser:xe,props:g.fromObject(i),value:e,viewProps:t.viewProps})},api(t){return typeof t.controller.value.rawValue!="number"?null:t.controller.valueController instanceof Qt?new xp(t.controller):t.controller.valueController instanceof Ie?new ir(t.controller):null}});class Re{constructor(e=0,n=0){this.x=e,this.y=n}getComponents(){return[this.x,this.y]}static isObject(e){if(R(e))return!1;const n=e.x,r=e.y;return!(typeof n!="number"||typeof r!="number")}static equals(e,n){return e.x===n.x&&e.y===n.y}toObject(){return{x:this.x,y:this.y}}}const Qa={toComponents:t=>t.getComponents(),fromComponents:t=>new Re(...t)},Ke=C("p2d");class Pp{constructor(e,n){this.element=e.createElement("div"),this.element.classList.add(Ke()),n.viewProps.bindClassModifiers(this.element),_e(n.expanded,tt(this.element,Ke(void 0,"expanded")));const r=e.createElement("div");r.classList.add(Ke("h")),this.element.appendChild(r);const i=e.createElement("button");i.classList.add(Ke("b")),i.appendChild(tn(e,"p2dpad")),n.viewProps.bindDisabled(i),r.appendChild(i),this.buttonElement=i;const a=e.createElement("div");if(a.classList.add(Ke("t")),r.appendChild(a),this.textElement=a,n.pickerLayout==="inline"){const o=e.createElement("div");o.classList.add(Ke("p")),this.element.appendChild(o),this.pickerElement=o}else this.pickerElement=null}}const Le=C("p2dp");class Cp{constructor(e,n){this.onFoldableChange_=this.onFoldableChange_.bind(this),this.onPropsChange_=this.onPropsChange_.bind(this),this.onValueChange_=this.onValueChange_.bind(this),this.props_=n.props,this.props_.emitter.on("change",this.onPropsChange_),this.element=e.createElement("div"),this.element.classList.add(Le()),n.layout==="popup"&&this.element.classList.add(Le(void 0,"p")),n.viewProps.bindClassModifiers(this.element);const r=e.createElement("div");r.classList.add(Le("p")),n.viewProps.bindTabIndex(r),this.element.appendChild(r),this.padElement=r;const i=e.createElementNS(ue,"svg");i.classList.add(Le("g")),this.padElement.appendChild(i),this.svgElem_=i;const a=e.createElementNS(ue,"line");a.classList.add(Le("ax")),a.setAttributeNS(null,"x1","0"),a.setAttributeNS(null,"y1","50%"),a.setAttributeNS(null,"x2","100%"),a.setAttributeNS(null,"y2","50%"),this.svgElem_.appendChild(a);const o=e.createElementNS(ue,"line");o.classList.add(Le("ax")),o.setAttributeNS(null,"x1","50%"),o.setAttributeNS(null,"y1","0"),o.setAttributeNS(null,"x2","50%"),o.setAttributeNS(null,"y2","100%"),this.svgElem_.appendChild(o);const s=e.createElementNS(ue,"line");s.classList.add(Le("l")),s.setAttributeNS(null,"x1","50%"),s.setAttributeNS(null,"y1","50%"),this.svgElem_.appendChild(s),this.lineElem_=s;const l=e.createElement("div");l.classList.add(Le("m")),this.padElement.appendChild(l),this.markerElem_=l,n.value.emitter.on("change",this.onValueChange_),this.value=n.value,this.update_()}get allFocusableElements(){return[this.padElement]}update_(){const[e,n]=this.value.rawValue.getComponents(),r=this.props_.get("max"),i=k(e,-r,+r,0,100),a=k(n,-r,+r,0,100),o=this.props_.get("invertsY")?100-a:a;this.lineElem_.setAttributeNS(null,"x2",`${i}%`),this.lineElem_.setAttributeNS(null,"y2",`${o}%`),this.markerElem_.style.left=`${i}%`,this.markerElem_.style.top=`${o}%`}onValueChange_(){this.update_()}onPropsChange_(){this.update_()}onFoldableChange_(){this.update_()}}function si(t,e,n){return[Y(e[0],ye(t)),Y(e[1],_t(t))*(n?1:-1)]}class Sp{constructor(e,n){this.onPadKeyDown_=this.onPadKeyDown_.bind(this),this.onPadKeyUp_=this.onPadKeyUp_.bind(this),this.onPointerDown_=this.onPointerDown_.bind(this),this.onPointerMove_=this.onPointerMove_.bind(this),this.onPointerUp_=this.onPointerUp_.bind(this),this.props=n.props,this.value=n.value,this.viewProps=n.viewProps,this.view=new Cp(e,{layout:n.layout,props:this.props,value:this.value,viewProps:this.viewProps}),this.ptHandler_=new Ge(this.view.padElement),this.ptHandler_.emitter.on("down",this.onPointerDown_),this.ptHandler_.emitter.on("move",this.onPointerMove_),this.ptHandler_.emitter.on("up",this.onPointerUp_),this.view.padElement.addEventListener("keydown",this.onPadKeyDown_),this.view.padElement.addEventListener("keyup",this.onPadKeyUp_)}handlePointerEvent_(e,n){if(!e.point)return;const r=this.props.get("max"),i=k(e.point.x,0,e.bounds.width,-r,+r),a=k(this.props.get("invertsY")?e.bounds.height-e.point.y:e.point.y,0,e.bounds.height,-r,+r);this.value.setRawValue(new Re(i,a),n)}onPointerDown_(e){this.handlePointerEvent_(e.data,{forceEmit:!1,last:!1})}onPointerMove_(e){this.handlePointerEvent_(e.data,{forceEmit:!1,last:!1})}onPointerUp_(e){this.handlePointerEvent_(e.data,{forceEmit:!0,last:!0})}onPadKeyDown_(e){La(e.key)&&e.preventDefault();const[n,r]=si(e,[this.props.get("xKeyScale"),this.props.get("yKeyScale")],this.props.get("invertsY"));n===0&&r===0||this.value.setRawValue(new Re(this.value.rawValue.x+n,this.value.rawValue.y+r),{forceEmit:!1,last:!1})}onPadKeyUp_(e){const[n,r]=si(e,[this.props.get("xKeyScale"),this.props.get("yKeyScale")],this.props.get("invertsY"));n===0&&r===0||this.value.setRawValue(this.value.rawValue,{forceEmit:!0,last:!0})}}class Ap{constructor(e,n){var r,i;this.onPopupChildBlur_=this.onPopupChildBlur_.bind(this),this.onPopupChildKeydown_=this.onPopupChildKeydown_.bind(this),this.onPadButtonBlur_=this.onPadButtonBlur_.bind(this),this.onPadButtonClick_=this.onPadButtonClick_.bind(this),this.value=n.value,this.viewProps=n.viewProps,this.foldable_=Ct.create(n.expanded),this.popC_=n.pickerLayout==="popup"?new Ca(e,{viewProps:this.viewProps}):null;const a=new Sp(e,{layout:n.pickerLayout,props:new g({invertsY:O(n.invertsY),max:O(n.max),xKeyScale:n.axes[0].textProps.value("keyScale"),yKeyScale:n.axes[1].textProps.value("keyScale")}),value:this.value,viewProps:this.viewProps});a.view.allFocusableElements.forEach(o=>{o.addEventListener("blur",this.onPopupChildBlur_),o.addEventListener("keydown",this.onPopupChildKeydown_)}),this.pickerC_=a,this.textC_=new fr(e,{assembly:Qa,axes:n.axes,parser:n.parser,value:this.value,viewProps:this.viewProps}),this.view=new Pp(e,{expanded:this.foldable_.value("expanded"),pickerLayout:n.pickerLayout,viewProps:this.viewProps}),this.view.textElement.appendChild(this.textC_.view.element),(r=this.view.buttonElement)===null||r===void 0||r.addEventListener("blur",this.onPadButtonBlur_),(i=this.view.buttonElement)===null||i===void 0||i.addEventListener("click",this.onPadButtonClick_),this.popC_?(this.view.element.appendChild(this.popC_.view.element),this.popC_.view.element.appendChild(this.pickerC_.view.element),it({primary:this.foldable_.value("expanded"),secondary:this.popC_.shows,forward:o=>o,backward:(o,s)=>s})):this.view.pickerElement&&(this.view.pickerElement.appendChild(this.pickerC_.view.element),rr(this.foldable_,this.view.pickerElement))}get textController(){return this.textC_}onPadButtonBlur_(e){if(!this.popC_)return;const n=this.view.element,r=e.relatedTarget;(!r||!n.contains(r))&&(this.popC_.shows.rawValue=!1)}onPadButtonClick_(){this.foldable_.set("expanded",!this.foldable_.get("expanded")),this.foldable_.get("expanded")&&this.pickerC_.view.allFocusableElements[0].focus()}onPopupChildBlur_(e){if(!this.popC_)return;const n=this.popC_.view.element,r=va(e);r&&n.contains(r)||r&&r===this.view.buttonElement&&!Zn(n.ownerDocument)||(this.popC_.shows.rawValue=!1)}onPopupChildKeydown_(e){this.popC_?e.key==="Escape"&&(this.popC_.shows.rawValue=!1):this.view.pickerElement&&e.key==="Escape"&&this.view.buttonElement.focus()}}function Lp(t){return Re.isObject(t)?new Re(t.x,t.y):new Re}function kp(t,e){t.writeProperty("x",e.x),t.writeProperty("y",e.y)}function Tp(t,e){return new mr({assembly:Qa,components:[ge(Object.assign(Object.assign({},t),t.x),e.x),ge(Object.assign(Object.assign({},t),t.y),e.y)]})}function li(t,e){var n,r;if(!R(t.min)||!R(t.max))return Math.max(Math.abs((n=t.min)!==null&&n!==void 0?n:0),Math.abs((r=t.max)!==null&&r!==void 0?r:0));const i=sa(t);return Math.max(Math.abs(i)*10,Math.abs(e)*10)}function Dp(t,e){var n,r;const i=li(ze(t,(n=t.x)!==null&&n!==void 0?n:{}),e.x),a=li(ze(t,(r=t.y)!==null&&r!==void 0?r:{}),e.y);return Math.max(i,a)}function Rp(t){if(!("y"in t))return!1;const e=t.y;return e&&"inverted"in e?!!e.inverted:!1}const Ip=K({id:"input-point2d",type:"input",accept:(t,e)=>{if(!Re.isObject(t))return null;const n=M(e,r=>Object.assign(Object.assign({},wt(r)),{expanded:r.optional.boolean,picker:r.optional.custom(Da),readonly:r.optional.constant(!1),x:r.optional.custom(De),y:r.optional.object(Object.assign(Object.assign({},wt(r)),{inverted:r.optional.boolean}))}));return n?{initialValue:t,params:n}:null},binding:{reader:()=>Lp,constraint:t=>Tp(t.params,t.initialValue),equals:Re.equals,writer:()=>kp},controller:t=>{var e,n;const r=t.document,i=t.value,a=t.constraint,o=[t.params.x,t.params.y];return new Ap(r,{axes:i.rawValue.getComponents().map((s,l)=>{var d;return Yn({constraint:a.components[l],initialValue:s,params:ze(t.params,(d=o[l])!==null&&d!==void 0?d:{})})}),expanded:(e=t.params.expanded)!==null&&e!==void 0?e:!1,invertsY:Rp(t.params),max:Dp(t.params,i.rawValue),parser:xe,pickerLayout:(n=t.params.picker)!==null&&n!==void 0?n:"popup",value:i,viewProps:t.viewProps})}});class Ze{constructor(e=0,n=0,r=0){this.x=e,this.y=n,this.z=r}getComponents(){return[this.x,this.y,this.z]}static isObject(e){if(R(e))return!1;const n=e.x,r=e.y,i=e.z;return!(typeof n!="number"||typeof r!="number"||typeof i!="number")}static equals(e,n){return e.x===n.x&&e.y===n.y&&e.z===n.z}toObject(){return{x:this.x,y:this.y,z:this.z}}}const eo={toComponents:t=>t.getComponents(),fromComponents:t=>new Ze(...t)};function Np(t){return Ze.isObject(t)?new Ze(t.x,t.y,t.z):new Ze}function Op(t,e){t.writeProperty("x",e.x),t.writeProperty("y",e.y),t.writeProperty("z",e.z)}function Mp(t,e){return new mr({assembly:eo,components:[ge(Object.assign(Object.assign({},t),t.x),e.x),ge(Object.assign(Object.assign({},t),t.y),e.y),ge(Object.assign(Object.assign({},t),t.z),e.z)]})}const Vp=K({id:"input-point3d",type:"input",accept:(t,e)=>{if(!Ze.isObject(t))return null;const n=M(e,r=>Object.assign(Object.assign({},wt(r)),{readonly:r.optional.constant(!1),x:r.optional.custom(De),y:r.optional.custom(De),z:r.optional.custom(De)}));return n?{initialValue:t,params:n}:null},binding:{reader:t=>Np,constraint:t=>Mp(t.params,t.initialValue),equals:Ze.equals,writer:t=>Op},controller:t=>{const e=t.value,n=t.constraint,r=[t.params.x,t.params.y,t.params.z];return new fr(t.document,{assembly:eo,axes:e.rawValue.getComponents().map((i,a)=>{var o;return Yn({constraint:n.components[a],initialValue:i,params:ze(t.params,(o=r[a])!==null&&o!==void 0?o:{})})}),parser:xe,value:e,viewProps:t.viewProps})}});class Je{constructor(e=0,n=0,r=0,i=0){this.x=e,this.y=n,this.z=r,this.w=i}getComponents(){return[this.x,this.y,this.z,this.w]}static isObject(e){if(R(e))return!1;const n=e.x,r=e.y,i=e.z,a=e.w;return!(typeof n!="number"||typeof r!="number"||typeof i!="number"||typeof a!="number")}static equals(e,n){return e.x===n.x&&e.y===n.y&&e.z===n.z&&e.w===n.w}toObject(){return{x:this.x,y:this.y,z:this.z,w:this.w}}}const to={toComponents:t=>t.getComponents(),fromComponents:t=>new Je(...t)};function Bp(t){return Je.isObject(t)?new Je(t.x,t.y,t.z,t.w):new Je}function Fp(t,e){t.writeProperty("x",e.x),t.writeProperty("y",e.y),t.writeProperty("z",e.z),t.writeProperty("w",e.w)}function zp(t,e){return new mr({assembly:to,components:[ge(Object.assign(Object.assign({},t),t.x),e.x),ge(Object.assign(Object.assign({},t),t.y),e.y),ge(Object.assign(Object.assign({},t),t.z),e.z),ge(Object.assign(Object.assign({},t),t.w),e.w)]})}const Up=K({id:"input-point4d",type:"input",accept:(t,e)=>{if(!Je.isObject(t))return null;const n=M(e,r=>Object.assign(Object.assign({},wt(r)),{readonly:r.optional.constant(!1),w:r.optional.custom(De),x:r.optional.custom(De),y:r.optional.custom(De),z:r.optional.custom(De)}));return n?{initialValue:t,params:n}:null},binding:{reader:t=>Bp,constraint:t=>zp(t.params,t.initialValue),equals:Je.equals,writer:t=>Fp},controller:t=>{const e=t.value,n=t.constraint,r=[t.params.x,t.params.y,t.params.z,t.params.w];return new fr(t.document,{assembly:to,axes:e.rawValue.getComponents().map((i,a)=>{var o;return Yn({constraint:n.components[a],initialValue:i,params:ze(t.params,(o=r[a])!==null&&o!==void 0?o:{})})}),parser:xe,value:e,viewProps:t.viewProps})}});function Hp(t){const e=[],n=or(t.options);return n&&e.push(n),new St(e)}const Wp=K({id:"input-string",type:"input",accept:(t,e)=>{if(typeof t!="string")return null;const n=M(e,r=>({readonly:r.optional.constant(!1),options:r.optional.custom(Lt)}));return n?{initialValue:t,params:n}:null},binding:{reader:t=>Aa,constraint:t=>Hp(t.params),writer:t=>Tt},controller:t=>{const e=t.document,n=t.value,r=t.constraint,i=r&&Zt(r,At);return i?new Ie(e,{props:new g({options:i.values.value("options")}),value:n,viewProps:t.viewProps}):new gt(e,{parser:a=>a,props:g.fromObject({formatter:In}),value:n,viewProps:t.viewProps})},api(t){return typeof t.controller.value.rawValue!="string"?null:t.controller.valueController instanceof Ie?new ir(t.controller):null}}),Rt={monitor:{defaultInterval:200,defaultRows:3}},di=C("mll");class jp{constructor(e,n){this.onValueUpdate_=this.onValueUpdate_.bind(this),this.formatter_=n.formatter,this.element=e.createElement("div"),this.element.classList.add(di()),n.viewProps.bindClassModifiers(this.element);const r=e.createElement("textarea");r.classList.add(di("i")),r.style.height=`calc(var(${Ta("containerUnitSize")}) * ${n.rows})`,r.readOnly=!0,n.viewProps.bindDisabled(r),this.element.appendChild(r),this.textareaElem_=r,n.value.emitter.on("change",this.onValueUpdate_),this.value=n.value,this.update_()}update_(){const e=this.textareaElem_,n=e.scrollTop===e.scrollHeight-e.clientHeight,r=[];this.value.rawValue.forEach(i=>{i!==void 0&&r.push(this.formatter_(i))}),e.textContent=r.join(`
`),n&&(e.scrollTop=e.scrollHeight)}onValueUpdate_(){this.update_()}}class vr{constructor(e,n){this.value=n.value,this.viewProps=n.viewProps,this.view=new jp(e,{formatter:n.formatter,rows:n.rows,value:this.value,viewProps:this.viewProps})}}const ci=C("sgl");class Gp{constructor(e,n){this.onValueUpdate_=this.onValueUpdate_.bind(this),this.formatter_=n.formatter,this.element=e.createElement("div"),this.element.classList.add(ci()),n.viewProps.bindClassModifiers(this.element);const r=e.createElement("input");r.classList.add(ci("i")),r.readOnly=!0,r.type="text",n.viewProps.bindDisabled(r),this.element.appendChild(r),this.inputElement=r,n.value.emitter.on("change",this.onValueUpdate_),this.value=n.value,this.update_()}update_(){const e=this.value.rawValue,n=e[e.length-1];this.inputElement.value=n!==void 0?this.formatter_(n):""}onValueUpdate_(){this.update_()}}class br{constructor(e,n){this.value=n.value,this.viewProps=n.viewProps,this.view=new Gp(e,{formatter:n.formatter,value:this.value,viewProps:this.viewProps})}}const qp=K({id:"monitor-bool",type:"monitor",accept:(t,e)=>{if(typeof t!="boolean")return null;const n=M(e,r=>({readonly:r.required.constant(!0),rows:r.optional.number}));return n?{initialValue:t,params:n}:null},binding:{reader:t=>Sa},controller:t=>{var e;return t.value.rawValue.length===1?new br(t.document,{formatter:ni,value:t.value,viewProps:t.viewProps}):new vr(t.document,{formatter:ni,rows:(e=t.params.rows)!==null&&e!==void 0?e:Rt.monitor.defaultRows,value:t.value,viewProps:t.viewProps})}});class $p extends bt{get max(){return this.controller.valueController.props.get("max")}set max(e){this.controller.valueController.props.set("max",e)}get min(){return this.controller.valueController.props.get("min")}set min(e){this.controller.valueController.props.set("min",e)}}const ke=C("grl");class Xp{constructor(e,n){this.onCursorChange_=this.onCursorChange_.bind(this),this.onValueUpdate_=this.onValueUpdate_.bind(this),this.element=e.createElement("div"),this.element.classList.add(ke()),n.viewProps.bindClassModifiers(this.element),this.formatter_=n.formatter,this.props_=n.props,this.cursor_=n.cursor,this.cursor_.emitter.on("change",this.onCursorChange_);const r=e.createElementNS(ue,"svg");r.classList.add(ke("g")),r.style.height=`calc(var(${Ta("containerUnitSize")}) * ${n.rows})`,this.element.appendChild(r),this.svgElem_=r;const i=e.createElementNS(ue,"polyline");this.svgElem_.appendChild(i),this.lineElem_=i;const a=e.createElement("div");a.classList.add(ke("t"),C("tt")()),this.element.appendChild(a),this.tooltipElem_=a,n.value.emitter.on("change",this.onValueUpdate_),this.value=n.value,this.update_()}get graphElement(){return this.svgElem_}update_(){const{clientWidth:e,clientHeight:n}=this.element,r=this.value.rawValue.length-1,i=this.props_.get("min"),a=this.props_.get("max"),o=[];this.value.rawValue.forEach((u,p)=>{if(u===void 0)return;const w=k(p,0,r,0,e),f=k(u,i,a,n,0);o.push([w,f].join(","))}),this.lineElem_.setAttributeNS(null,"points",o.join(" "));const s=this.tooltipElem_,l=this.value.rawValue[this.cursor_.rawValue];if(l===void 0){s.classList.remove(ke("t","a"));return}const d=k(this.cursor_.rawValue,0,r,0,e),c=k(l,i,a,n,0);s.style.left=`${d}px`,s.style.top=`${c}px`,s.textContent=`${this.formatter_(l)}`,s.classList.contains(ke("t","a"))||(s.classList.add(ke("t","a"),ke("t","in")),Yt(s),s.classList.remove(ke("t","in")))}onValueUpdate_(){this.update_()}onCursorChange_(){this.update_()}}class no{constructor(e,n){if(this.onGraphMouseMove_=this.onGraphMouseMove_.bind(this),this.onGraphMouseLeave_=this.onGraphMouseLeave_.bind(this),this.onGraphPointerDown_=this.onGraphPointerDown_.bind(this),this.onGraphPointerMove_=this.onGraphPointerMove_.bind(this),this.onGraphPointerUp_=this.onGraphPointerUp_.bind(this),this.props=n.props,this.value=n.value,this.viewProps=n.viewProps,this.cursor_=O(-1),this.view=new Xp(e,{cursor:this.cursor_,formatter:n.formatter,rows:n.rows,props:this.props,value:this.value,viewProps:this.viewProps}),!Zn(e))this.view.element.addEventListener("mousemove",this.onGraphMouseMove_),this.view.element.addEventListener("mouseleave",this.onGraphMouseLeave_);else{const r=new Ge(this.view.element);r.emitter.on("down",this.onGraphPointerDown_),r.emitter.on("move",this.onGraphPointerMove_),r.emitter.on("up",this.onGraphPointerUp_)}}importProps(e){return te(e,null,n=>({max:n.required.number,min:n.required.number}),n=>(this.props.set("max",n.max),this.props.set("min",n.min),!0))}exportProps(){return ne(null,{max:this.props.get("max"),min:this.props.get("min")})}onGraphMouseLeave_(){this.cursor_.rawValue=-1}onGraphMouseMove_(e){const{clientWidth:n}=this.view.element;this.cursor_.rawValue=Math.floor(k(e.offsetX,0,n,0,this.value.rawValue.length))}onGraphPointerDown_(e){this.onGraphPointerMove_(e)}onGraphPointerMove_(e){if(!e.data.point){this.cursor_.rawValue=-1;return}this.cursor_.rawValue=Math.floor(k(e.data.point.x,0,e.data.bounds.width,0,this.value.rawValue.length))}onGraphPointerUp_(){this.cursor_.rawValue=-1}}function Nn(t){return R(t.format)?Z(2):t.format}function Kp(t){var e;return t.value.rawValue.length===1?new br(t.document,{formatter:Nn(t.params),value:t.value,viewProps:t.viewProps}):new vr(t.document,{formatter:Nn(t.params),rows:(e=t.params.rows)!==null&&e!==void 0?e:Rt.monitor.defaultRows,value:t.value,viewProps:t.viewProps})}function Yp(t){var e,n,r;return new no(t.document,{formatter:Nn(t.params),rows:(e=t.params.rows)!==null&&e!==void 0?e:Rt.monitor.defaultRows,props:g.fromObject({max:(n=t.params.max)!==null&&n!==void 0?n:100,min:(r=t.params.min)!==null&&r!==void 0?r:0}),value:t.value,viewProps:t.viewProps})}function pi(t){return t.view==="graph"}const Zp=K({id:"monitor-number",type:"monitor",accept:(t,e)=>{if(typeof t!="number")return null;const n=M(e,r=>({format:r.optional.function,max:r.optional.number,min:r.optional.number,readonly:r.required.constant(!0),rows:r.optional.number,view:r.optional.string}));return n?{initialValue:t,params:n}:null},binding:{defaultBufferSize:t=>pi(t)?64:1,reader:t=>aa},controller:t=>pi(t.params)?Yp(t):Kp(t),api:t=>t.controller.valueController instanceof no?new $p(t.controller):null}),Jp=K({id:"monitor-string",type:"monitor",accept:(t,e)=>{if(typeof t!="string")return null;const n=M(e,r=>({multiline:r.optional.boolean,readonly:r.required.constant(!0),rows:r.optional.number}));return n?{initialValue:t,params:n}:null},binding:{reader:t=>Aa},controller:t=>{var e;const n=t.value;return n.rawValue.length>1||t.params.multiline?new vr(t.document,{formatter:In,rows:(e=t.params.rows)!==null&&e!==void 0?e:Rt.monitor.defaultRows,value:n,viewProps:t.viewProps}):new br(t.document,{formatter:In,value:n,viewProps:t.viewProps})}});class Qp{constructor(){this.map_=new Map}get(e){var n;return(n=this.map_.get(e))!==null&&n!==void 0?n:null}has(e){return this.map_.has(e)}add(e,n){return this.map_.set(e,n),e.viewProps.handleDispose(()=>{this.map_.delete(e)}),n}}class eu{constructor(e){this.target=e.target,this.reader_=e.reader,this.writer_=e.writer}read(){return this.reader_(this.target.read())}write(e){this.writer_(this.target,e)}inject(e){this.write(this.reader_(e))}}function tu(t,e){var n;const r=t.accept(e.target.read(),e.params);if(R(r))return null;const i={target:e.target,initialValue:r.initialValue,params:r.params},a=M(e.params,u=>({disabled:u.optional.boolean,hidden:u.optional.boolean,label:u.optional.string,tag:u.optional.string})),o=t.binding.reader(i),s=t.binding.constraint?t.binding.constraint(i):void 0,l=new eu({reader:o,target:e.target,writer:t.binding.writer(i)}),d=new Bl(O(o(r.initialValue),{constraint:s,equals:t.binding.equals}),l),c=t.controller({constraint:s,document:e.document,initialValue:r.initialValue,params:r.params,value:d,viewProps:Ee.create({disabled:a==null?void 0:a.disabled,hidden:a==null?void 0:a.hidden})});return new Ql(e.document,{blade:rt(),props:g.fromObject({label:"label"in e.params?(n=a==null?void 0:a.label)!==null&&n!==void 0?n:null:e.target.key}),tag:a==null?void 0:a.tag,value:d,valueController:c})}class nu{constructor(e){this.target=e.target,this.reader_=e.reader}read(){return this.reader_(this.target.read())}}function ru(t,e){return e===0?new Od:new Md(t,e??Rt.monitor.defaultInterval)}function iu(t,e){var n,r,i;const a=t.accept(e.target.read(),e.params);if(R(a))return null;const o={target:e.target,initialValue:a.initialValue,params:a.params},s=M(e.params,p=>({bufferSize:p.optional.number,disabled:p.optional.boolean,hidden:p.optional.boolean,interval:p.optional.number,label:p.optional.string})),l=t.binding.reader(o),d=(r=(n=s==null?void 0:s.bufferSize)!==null&&n!==void 0?n:t.binding.defaultBufferSize&&t.binding.defaultBufferSize(a.params))!==null&&r!==void 0?r:1,c=new id({binding:new nu({reader:l,target:e.target}),bufferSize:d,ticker:ru(e.document,s==null?void 0:s.interval)}),u=t.controller({document:e.document,params:a.params,value:c,viewProps:Ee.create({disabled:s==null?void 0:s.disabled,hidden:s==null?void 0:s.hidden})});return u.viewProps.bindDisabled(c.ticker),u.viewProps.handleDispose(()=>{c.ticker.dispose()}),new od(e.document,{blade:rt(),props:g.fromObject({label:"label"in e.params?(i=s==null?void 0:s.label)!==null&&i!==void 0?i:null:e.target.key}),value:c,valueController:u})}class au{constructor(e){this.pluginsMap_={blades:[],inputs:[],monitors:[]},this.apiCache_=e}getAll(){return[...this.pluginsMap_.blades,...this.pluginsMap_.inputs,...this.pluginsMap_.monitors]}register(e,n){if(!Kd(n.core))throw B.notCompatible(e,n.id);n.type==="blade"?this.pluginsMap_.blades.unshift(n):n.type==="input"?this.pluginsMap_.inputs.unshift(n):n.type==="monitor"&&this.pluginsMap_.monitors.unshift(n)}createInput_(e,n,r){return this.pluginsMap_.inputs.reduce((i,a)=>i??tu(a,{document:e,target:n,params:r}),null)}createMonitor_(e,n,r){return this.pluginsMap_.monitors.reduce((i,a)=>i??iu(a,{document:e,params:r,target:n}),null)}createBinding(e,n,r){const i=n.read();if(R(i))throw new B({context:{key:n.key},type:"nomatchingcontroller"});const a=this.createInput_(e,n,r);if(a)return a;const o=this.createMonitor_(e,n,r);if(o)return o;throw new B({context:{key:n.key},type:"nomatchingcontroller"})}createBlade(e,n){const r=this.pluginsMap_.blades.reduce((i,a)=>i??Nd(a,{document:e,params:n}),null);if(!r)throw new B({type:"nomatchingview",context:{params:n}});return r}createInputBindingApi_(e){const n=this.pluginsMap_.inputs.reduce((r,i)=>{var a,o;return r||((o=(a=i.api)===null||a===void 0?void 0:a.call(i,{controller:e}))!==null&&o!==void 0?o:null)},null);return this.apiCache_.add(e,n??new bt(e))}createMonitorBindingApi_(e){const n=this.pluginsMap_.monitors.reduce((r,i)=>{var a,o;return r||((o=(a=i.api)===null||a===void 0?void 0:a.call(i,{controller:e}))!==null&&o!==void 0?o:null)},null);return this.apiCache_.add(e,n??new bt(e))}createBindingApi(e){if(this.apiCache_.has(e))return this.apiCache_.get(e);if(ed(e))return this.createInputBindingApi_(e);if(sd(e))return this.createMonitorBindingApi_(e);throw B.shouldNeverHappen()}createApi(e){if(this.apiCache_.has(e))return this.apiCache_.get(e);if(Jl(e))return this.createBindingApi(e);const n=this.pluginsMap_.blades.reduce((r,i)=>r??i.api({controller:e,pool:this}),null);if(!n)throw B.shouldNeverHappen();return this.apiCache_.add(e,n)}}const ou=new Qp;function su(){const t=new au(ou);return[Ip,Vp,Up,Wp,Ep,gp,bp,up,Qd,qp,Jp,Zp,ud,Cd,Pa].forEach(e=>{t.register("core",e)}),t}class lu extends je{constructor(e){super(e),this.emitter_=new z,this.controller.value.emitter.on("change",n=>{this.emitter_.emit("change",new Pt(this,n.rawValue))})}get label(){return this.controller.labelController.props.get("label")}set label(e){this.controller.labelController.props.set("label",e)}get options(){return this.controller.valueController.props.get("options")}set options(e){this.controller.valueController.props.set("options",e)}get value(){return this.controller.value.rawValue}set value(e){this.controller.value.rawValue=e}on(e,n){const r=n.bind(this);return this.emitter_.on(e,i=>{r(i)},{key:n}),this}off(e,n){return this.emitter_.off(e,n),this}}class du extends je{}class cu extends je{constructor(e){super(e),this.emitter_=new z,this.controller.value.emitter.on("change",n=>{this.emitter_.emit("change",new Pt(this,n.rawValue))})}get label(){return this.controller.labelController.props.get("label")}set label(e){this.controller.labelController.props.set("label",e)}get max(){return this.controller.valueController.sliderController.props.get("max")}set max(e){this.controller.valueController.sliderController.props.set("max",e)}get min(){return this.controller.valueController.sliderController.props.get("min")}set min(e){this.controller.valueController.sliderController.props.set("min",e)}get value(){return this.controller.value.rawValue}set value(e){this.controller.value.rawValue=e}on(e,n){const r=n.bind(this);return this.emitter_.on(e,i=>{r(i)},{key:n}),this}off(e,n){return this.emitter_.off(e,n),this}}class pu extends je{constructor(e){super(e),this.emitter_=new z,this.controller.value.emitter.on("change",n=>{this.emitter_.emit("change",new Pt(this,n.rawValue))})}get label(){return this.controller.labelController.props.get("label")}set label(e){this.controller.labelController.props.set("label",e)}get formatter(){return this.controller.valueController.props.get("formatter")}set formatter(e){this.controller.valueController.props.set("formatter",e)}get value(){return this.controller.value.rawValue}set value(e){this.controller.value.rawValue=e}on(e,n){const r=n.bind(this);return this.emitter_.on(e,i=>{r(i)},{key:n}),this}off(e,n){return this.emitter_.off(e,n),this}}const uu=function(){return{id:"list",type:"blade",core:nt,accept(t){const e=M(t,n=>({options:n.required.custom(Lt),value:n.required.raw,view:n.required.constant("list"),label:n.optional.string}));return e?{params:e}:null},controller(t){const e=new At(ar(t.params.options)),n=O(t.params.value,{constraint:e}),r=new Ie(t.document,{props:new g({options:e.values.value("options")}),value:n,viewProps:t.viewProps});return new Ue(t.document,{blade:t.blade,props:g.fromObject({label:t.params.label}),value:n,valueController:r})},api(t){return!(t.controller instanceof Ue)||!(t.controller.valueController instanceof Ie)?null:new lu(t.controller)}}}();class hu extends ya{constructor(e,n){super(e,n)}get element(){return this.controller.view.element}}class mu extends Dn{constructor(e,n){super(e,{expanded:n.expanded,blade:n.blade,props:n.props,root:!0,viewProps:n.viewProps})}}const ui=C("spr");class fu{constructor(e,n){this.element=e.createElement("div"),this.element.classList.add(ui()),n.viewProps.bindClassModifiers(this.element);const r=e.createElement("hr");r.classList.add(ui("r")),this.element.appendChild(r)}}class hi extends nn{constructor(e,n){super(Object.assign(Object.assign({},n),{view:new fu(e,{viewProps:n.viewProps})}))}}const vu={id:"separator",type:"blade",core:nt,accept(t){const e=M(t,n=>({view:n.required.constant("separator")}));return e?{params:e}:null},controller(t){return new hi(t.document,{blade:t.blade,viewProps:t.viewProps})},api(t){return t.controller instanceof hi?new du(t.controller):null}},bu={id:"slider",type:"blade",core:nt,accept(t){const e=M(t,n=>({max:n.required.number,min:n.required.number,view:n.required.constant("slider"),format:n.optional.function,label:n.optional.string,value:n.optional.number}));return e?{params:e}:null},controller(t){var e,n;const r=(e=t.params.value)!==null&&e!==void 0?e:0,i=new Et({max:t.params.max,min:t.params.min}),a=O(r,{constraint:i}),o=new Qt(t.document,Object.assign(Object.assign({},ka({formatter:(n=t.params.format)!==null&&n!==void 0?n:Il,keyScale:O(1),max:i.values.value("max"),min:i.values.value("min"),pointerScale:la(t.params,r)})),{parser:xe,value:a,viewProps:t.viewProps}));return new Ue(t.document,{blade:t.blade,props:g.fromObject({label:t.params.label}),value:a,valueController:o})},api(t){return!(t.controller instanceof Ue)||!(t.controller.valueController instanceof Qt)?null:new cu(t.controller)}},gu=function(){return{id:"text",type:"blade",core:nt,accept(t){const e=M(t,n=>({parse:n.required.function,value:n.required.raw,view:n.required.constant("text"),format:n.optional.function,label:n.optional.string}));return e?{params:e}:null},controller(t){var e;const n=O(t.params.value),r=new gt(t.document,{parser:t.params.parse,props:g.fromObject({formatter:(e=t.params.format)!==null&&e!==void 0?e:i=>String(i)}),value:n,viewProps:t.viewProps});return new Ue(t.document,{blade:t.blade,props:g.fromObject({label:t.params.label}),value:n,valueController:r})},api(t){return!(t.controller instanceof Ue)||!(t.controller.valueController instanceof gt)?null:new pu(t.controller)}}}();function _u(t){const e=t.createElement("div");return e.classList.add(C("dfw")()),t.body&&t.body.appendChild(e),e}function wu(t,e,n){if(t.querySelector(`style[data-tp-style=${e}]`))return;const r=t.createElement("style");r.dataset.tpStyle=e,r.textContent=n,t.head.appendChild(r)}class xu extends hu{constructor(e){var n,r;const i=e??{},a=(n=i.document)!==null&&n!==void 0?n:Gl(),o=su(),s=new mu(a,{expanded:i.expanded,blade:rt(),props:g.fromObject({title:i.title}),viewProps:Ee.create()});super(s,o),this.pool_=o,this.containerElem_=(r=i.container)!==null&&r!==void 0?r:_u(a),this.containerElem_.appendChild(this.element),this.doc_=a,this.usesDefaultWrapper_=!i.container,this.setUpDefaultPlugins_()}get document(){if(!this.doc_)throw B.alreadyDisposed();return this.doc_}dispose(){const e=this.containerElem_;if(!e)throw B.alreadyDisposed();if(this.usesDefaultWrapper_){const n=e.parentElement;n&&n.removeChild(e)}this.containerElem_=null,this.doc_=null,super.dispose()}registerPlugin(e){e.css&&wu(this.document,`plugin-${e.id}`,e.css),("plugin"in e?[e.plugin]:"plugins"in e?e.plugins:[]).forEach(r=>{this.pool_.register(e.id,r)})}setUpDefaultPlugins_(){this.registerPlugin({id:"default",css:'.tp-tbiv_b,.tp-coltxtv_ms,.tp-colswv_b,.tp-ckbv_i,.tp-sglv_i,.tp-mllv_i,.tp-grlv_g,.tp-txtv_i,.tp-p2dpv_p,.tp-colswv_sw,.tp-rotv_b,.tp-fldv_b,.tp-p2dv_b,.tp-btnv_b,.tp-lstv_s{-webkit-appearance:none;-moz-appearance:none;appearance:none;background-color:rgba(0,0,0,0);border-width:0;font-family:inherit;font-size:inherit;font-weight:inherit;margin:0;outline:none;padding:0}.tp-p2dv_b,.tp-btnv_b,.tp-lstv_s{background-color:var(--btn-bg);border-radius:var(--bld-br);color:var(--btn-fg);cursor:pointer;display:block;font-weight:bold;height:var(--cnt-usz);line-height:var(--cnt-usz);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tp-p2dv_b:hover,.tp-btnv_b:hover,.tp-lstv_s:hover{background-color:var(--btn-bg-h)}.tp-p2dv_b:focus,.tp-btnv_b:focus,.tp-lstv_s:focus{background-color:var(--btn-bg-f)}.tp-p2dv_b:active,.tp-btnv_b:active,.tp-lstv_s:active{background-color:var(--btn-bg-a)}.tp-p2dv_b:disabled,.tp-btnv_b:disabled,.tp-lstv_s:disabled{opacity:.5}.tp-rotv_c>.tp-cntv.tp-v-lst,.tp-tbpv_c>.tp-cntv.tp-v-lst,.tp-fldv_c>.tp-cntv.tp-v-lst{margin-bottom:calc(-1*var(--cnt-vp))}.tp-rotv_c>.tp-fldv.tp-v-lst .tp-fldv_c,.tp-tbpv_c>.tp-fldv.tp-v-lst .tp-fldv_c,.tp-fldv_c>.tp-fldv.tp-v-lst .tp-fldv_c{border-bottom-left-radius:0}.tp-rotv_c>.tp-fldv.tp-v-lst .tp-fldv_b,.tp-tbpv_c>.tp-fldv.tp-v-lst .tp-fldv_b,.tp-fldv_c>.tp-fldv.tp-v-lst .tp-fldv_b{border-bottom-left-radius:0}.tp-rotv_c>*:not(.tp-v-fst),.tp-tbpv_c>*:not(.tp-v-fst),.tp-fldv_c>*:not(.tp-v-fst){margin-top:var(--cnt-usp)}.tp-rotv_c>.tp-sprv:not(.tp-v-fst),.tp-tbpv_c>.tp-sprv:not(.tp-v-fst),.tp-fldv_c>.tp-sprv:not(.tp-v-fst),.tp-rotv_c>.tp-cntv:not(.tp-v-fst),.tp-tbpv_c>.tp-cntv:not(.tp-v-fst),.tp-fldv_c>.tp-cntv:not(.tp-v-fst){margin-top:var(--cnt-vp)}.tp-rotv_c>.tp-sprv+*:not(.tp-v-hidden),.tp-tbpv_c>.tp-sprv+*:not(.tp-v-hidden),.tp-fldv_c>.tp-sprv+*:not(.tp-v-hidden),.tp-rotv_c>.tp-cntv+*:not(.tp-v-hidden),.tp-tbpv_c>.tp-cntv+*:not(.tp-v-hidden),.tp-fldv_c>.tp-cntv+*:not(.tp-v-hidden){margin-top:var(--cnt-vp)}.tp-rotv_c>.tp-sprv:not(.tp-v-hidden)+.tp-sprv,.tp-tbpv_c>.tp-sprv:not(.tp-v-hidden)+.tp-sprv,.tp-fldv_c>.tp-sprv:not(.tp-v-hidden)+.tp-sprv,.tp-rotv_c>.tp-cntv:not(.tp-v-hidden)+.tp-cntv,.tp-tbpv_c>.tp-cntv:not(.tp-v-hidden)+.tp-cntv,.tp-fldv_c>.tp-cntv:not(.tp-v-hidden)+.tp-cntv{margin-top:0}.tp-tbpv_c>.tp-cntv,.tp-fldv_c>.tp-cntv{margin-left:4px}.tp-tbpv_c>.tp-fldv>.tp-fldv_b,.tp-fldv_c>.tp-fldv>.tp-fldv_b{border-top-left-radius:var(--bld-br);border-bottom-left-radius:var(--bld-br)}.tp-tbpv_c>.tp-fldv.tp-fldv-expanded>.tp-fldv_b,.tp-fldv_c>.tp-fldv.tp-fldv-expanded>.tp-fldv_b{border-bottom-left-radius:0}.tp-tbpv_c .tp-fldv>.tp-fldv_c,.tp-fldv_c .tp-fldv>.tp-fldv_c{border-bottom-left-radius:var(--bld-br)}.tp-tbpv_c>.tp-cntv+.tp-fldv>.tp-fldv_b,.tp-fldv_c>.tp-cntv+.tp-fldv>.tp-fldv_b{border-top-left-radius:0}.tp-tbpv_c>.tp-cntv+.tp-tabv>.tp-tabv_t,.tp-fldv_c>.tp-cntv+.tp-tabv>.tp-tabv_t{border-top-left-radius:0}.tp-tbpv_c>.tp-tabv>.tp-tabv_t,.tp-fldv_c>.tp-tabv>.tp-tabv_t{border-top-left-radius:var(--bld-br)}.tp-tbpv_c .tp-tabv>.tp-tabv_c,.tp-fldv_c .tp-tabv>.tp-tabv_c{border-bottom-left-radius:var(--bld-br)}.tp-rotv_b,.tp-fldv_b{background-color:var(--cnt-bg);color:var(--cnt-fg);cursor:pointer;display:block;height:calc(var(--cnt-usz) + 4px);line-height:calc(var(--cnt-usz) + 4px);overflow:hidden;padding-left:var(--cnt-hp);padding-right:calc(4px + var(--cnt-usz) + var(--cnt-hp));position:relative;text-align:left;text-overflow:ellipsis;white-space:nowrap;width:100%;transition:border-radius .2s ease-in-out .2s}.tp-rotv_b:hover,.tp-fldv_b:hover{background-color:var(--cnt-bg-h)}.tp-rotv_b:focus,.tp-fldv_b:focus{background-color:var(--cnt-bg-f)}.tp-rotv_b:active,.tp-fldv_b:active{background-color:var(--cnt-bg-a)}.tp-rotv_b:disabled,.tp-fldv_b:disabled{opacity:.5}.tp-rotv_m,.tp-fldv_m{background:linear-gradient(to left, var(--cnt-fg), var(--cnt-fg) 2px, transparent 2px, transparent 4px, var(--cnt-fg) 4px);border-radius:2px;bottom:0;content:"";display:block;height:6px;right:calc(var(--cnt-hp) + (var(--cnt-usz) + 4px - 6px)/2 - 2px);margin:auto;opacity:.5;position:absolute;top:0;transform:rotate(90deg);transition:transform .2s ease-in-out;width:6px}.tp-rotv.tp-rotv-expanded .tp-rotv_m,.tp-fldv.tp-fldv-expanded>.tp-fldv_b>.tp-fldv_m{transform:none}.tp-rotv_c,.tp-fldv_c{box-sizing:border-box;height:0;opacity:0;overflow:hidden;padding-bottom:0;padding-top:0;position:relative;transition:height .2s ease-in-out,opacity .2s linear,padding .2s ease-in-out}.tp-rotv.tp-rotv-cpl:not(.tp-rotv-expanded) .tp-rotv_c,.tp-fldv.tp-fldv-cpl:not(.tp-fldv-expanded)>.tp-fldv_c{display:none}.tp-rotv.tp-rotv-expanded .tp-rotv_c,.tp-fldv.tp-fldv-expanded>.tp-fldv_c{opacity:1;padding-bottom:var(--cnt-vp);padding-top:var(--cnt-vp);transform:none;overflow:visible;transition:height .2s ease-in-out,opacity .2s linear .2s,padding .2s ease-in-out}.tp-txtv_i,.tp-p2dpv_p,.tp-colswv_sw{background-color:var(--in-bg);border-radius:var(--bld-br);box-sizing:border-box;color:var(--in-fg);font-family:inherit;height:var(--cnt-usz);line-height:var(--cnt-usz);min-width:0;width:100%}.tp-txtv_i:hover,.tp-p2dpv_p:hover,.tp-colswv_sw:hover{background-color:var(--in-bg-h)}.tp-txtv_i:focus,.tp-p2dpv_p:focus,.tp-colswv_sw:focus{background-color:var(--in-bg-f)}.tp-txtv_i:active,.tp-p2dpv_p:active,.tp-colswv_sw:active{background-color:var(--in-bg-a)}.tp-txtv_i:disabled,.tp-p2dpv_p:disabled,.tp-colswv_sw:disabled{opacity:.5}.tp-lstv,.tp-coltxtv_m{position:relative}.tp-lstv_s{padding:0 20px 0 4px;width:100%}.tp-lstv_m,.tp-coltxtv_mm{bottom:0;margin:auto;pointer-events:none;position:absolute;right:2px;top:0}.tp-lstv_m svg,.tp-coltxtv_mm svg{bottom:0;height:16px;margin:auto;position:absolute;right:0;top:0;width:16px}.tp-lstv_m svg path,.tp-coltxtv_mm svg path{fill:currentColor}.tp-sglv_i,.tp-mllv_i,.tp-grlv_g{background-color:var(--mo-bg);border-radius:var(--bld-br);box-sizing:border-box;color:var(--mo-fg);height:var(--cnt-usz);scrollbar-color:currentColor rgba(0,0,0,0);scrollbar-width:thin;width:100%}.tp-sglv_i::-webkit-scrollbar,.tp-mllv_i::-webkit-scrollbar,.tp-grlv_g::-webkit-scrollbar{height:8px;width:8px}.tp-sglv_i::-webkit-scrollbar-corner,.tp-mllv_i::-webkit-scrollbar-corner,.tp-grlv_g::-webkit-scrollbar-corner{background-color:rgba(0,0,0,0)}.tp-sglv_i::-webkit-scrollbar-thumb,.tp-mllv_i::-webkit-scrollbar-thumb,.tp-grlv_g::-webkit-scrollbar-thumb{background-clip:padding-box;background-color:currentColor;border:rgba(0,0,0,0) solid 2px;border-radius:4px}.tp-pndtxtv,.tp-coltxtv_w{display:flex}.tp-pndtxtv_a,.tp-coltxtv_c{width:100%}.tp-pndtxtv_a+.tp-pndtxtv_a,.tp-coltxtv_c+.tp-pndtxtv_a,.tp-pndtxtv_a+.tp-coltxtv_c,.tp-coltxtv_c+.tp-coltxtv_c{margin-left:2px}.tp-rotv{--bs-bg: var(--tp-base-background-color, hsl(230, 7%, 17%));--bs-br: var(--tp-base-border-radius, 6px);--bs-ff: var(--tp-base-font-family, Roboto Mono, Source Code Pro, Menlo, Courier, monospace);--bs-sh: var(--tp-base-shadow-color, rgba(0, 0, 0, 0.2));--bld-br: var(--tp-blade-border-radius, 2px);--bld-hp: var(--tp-blade-horizontal-padding, 4px);--bld-vw: var(--tp-blade-value-width, 160px);--btn-bg: var(--tp-button-background-color, hsl(230, 7%, 70%));--btn-bg-a: var(--tp-button-background-color-active, #d6d7db);--btn-bg-f: var(--tp-button-background-color-focus, #c8cad0);--btn-bg-h: var(--tp-button-background-color-hover, #bbbcc4);--btn-fg: var(--tp-button-foreground-color, hsl(230, 7%, 17%));--cnt-bg: var(--tp-container-background-color, rgba(187, 188, 196, 0.1));--cnt-bg-a: var(--tp-container-background-color-active, rgba(187, 188, 196, 0.25));--cnt-bg-f: var(--tp-container-background-color-focus, rgba(187, 188, 196, 0.2));--cnt-bg-h: var(--tp-container-background-color-hover, rgba(187, 188, 196, 0.15));--cnt-fg: var(--tp-container-foreground-color, hsl(230, 7%, 75%));--cnt-hp: var(--tp-container-horizontal-padding, 4px);--cnt-vp: var(--tp-container-vertical-padding, 4px);--cnt-usp: var(--tp-container-unit-spacing, 4px);--cnt-usz: var(--tp-container-unit-size, 20px);--in-bg: var(--tp-input-background-color, rgba(187, 188, 196, 0.1));--in-bg-a: var(--tp-input-background-color-active, rgba(187, 188, 196, 0.25));--in-bg-f: var(--tp-input-background-color-focus, rgba(187, 188, 196, 0.2));--in-bg-h: var(--tp-input-background-color-hover, rgba(187, 188, 196, 0.15));--in-fg: var(--tp-input-foreground-color, hsl(230, 7%, 75%));--lbl-fg: var(--tp-label-foreground-color, rgba(187, 188, 196, 0.7));--mo-bg: var(--tp-monitor-background-color, rgba(0, 0, 0, 0.2));--mo-fg: var(--tp-monitor-foreground-color, rgba(187, 188, 196, 0.7));--grv-fg: var(--tp-groove-foreground-color, rgba(187, 188, 196, 0.1))}.tp-btnv_b{width:100%}.tp-btnv_t{text-align:center}.tp-ckbv_l{display:block;position:relative}.tp-ckbv_i{left:0;opacity:0;position:absolute;top:0}.tp-ckbv_w{background-color:var(--in-bg);border-radius:var(--bld-br);cursor:pointer;display:block;height:var(--cnt-usz);position:relative;width:var(--cnt-usz)}.tp-ckbv_w svg{display:block;height:16px;inset:0;margin:auto;opacity:0;position:absolute;width:16px}.tp-ckbv_w svg path{fill:none;stroke:var(--in-fg);stroke-width:2}.tp-ckbv_i:hover+.tp-ckbv_w{background-color:var(--in-bg-h)}.tp-ckbv_i:focus+.tp-ckbv_w{background-color:var(--in-bg-f)}.tp-ckbv_i:active+.tp-ckbv_w{background-color:var(--in-bg-a)}.tp-ckbv_i:checked+.tp-ckbv_w svg{opacity:1}.tp-ckbv.tp-v-disabled .tp-ckbv_w{opacity:.5}.tp-colv{position:relative}.tp-colv_h{display:flex}.tp-colv_s{flex-grow:0;flex-shrink:0;width:var(--cnt-usz)}.tp-colv_t{flex:1;margin-left:4px}.tp-colv_p{height:0;margin-top:0;opacity:0;overflow:hidden;transition:height .2s ease-in-out,opacity .2s linear,margin .2s ease-in-out}.tp-colv.tp-colv-expanded.tp-colv-cpl .tp-colv_p{overflow:visible}.tp-colv.tp-colv-expanded .tp-colv_p{margin-top:var(--cnt-usp);opacity:1}.tp-colv .tp-popv{left:calc(-1*var(--cnt-hp));right:calc(-1*var(--cnt-hp));top:var(--cnt-usz)}.tp-colpv_h,.tp-colpv_ap{margin-left:6px;margin-right:6px}.tp-colpv_h{margin-top:var(--cnt-usp)}.tp-colpv_rgb{display:flex;margin-top:var(--cnt-usp);width:100%}.tp-colpv_a{display:flex;margin-top:var(--cnt-vp);padding-top:calc(var(--cnt-vp) + 2px);position:relative}.tp-colpv_a::before{background-color:var(--grv-fg);content:"";height:2px;left:calc(-1*var(--cnt-hp));position:absolute;right:calc(-1*var(--cnt-hp));top:0}.tp-colpv.tp-v-disabled .tp-colpv_a::before{opacity:.5}.tp-colpv_ap{align-items:center;display:flex;flex:3}.tp-colpv_at{flex:1;margin-left:4px}.tp-svpv{border-radius:var(--bld-br);outline:none;overflow:hidden;position:relative}.tp-svpv.tp-v-disabled{opacity:.5}.tp-svpv_c{cursor:crosshair;display:block;height:calc(var(--cnt-usz)*4);width:100%}.tp-svpv_m{border-radius:100%;border:rgba(255,255,255,.75) solid 2px;box-sizing:border-box;filter:drop-shadow(0 0 1px rgba(0, 0, 0, 0.3));height:12px;margin-left:-6px;margin-top:-6px;pointer-events:none;position:absolute;width:12px}.tp-svpv:focus .tp-svpv_m{border-color:#fff}.tp-hplv{cursor:pointer;height:var(--cnt-usz);outline:none;position:relative}.tp-hplv.tp-v-disabled{opacity:.5}.tp-hplv_c{background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAABCAYAAABubagXAAAAQ0lEQVQoU2P8z8Dwn0GCgQEDi2OK/RBgYHjBgIpfovFh8j8YBIgzFGQxuqEgPhaDOT5gOhPkdCxOZeBg+IDFZZiGAgCaSSMYtcRHLgAAAABJRU5ErkJggg==);background-position:left top;background-repeat:no-repeat;background-size:100% 100%;border-radius:2px;display:block;height:4px;left:0;margin-top:-2px;position:absolute;top:50%;width:100%}.tp-hplv_m{border-radius:var(--bld-br);border:rgba(255,255,255,.75) solid 2px;box-shadow:0 0 2px rgba(0,0,0,.1);box-sizing:border-box;height:12px;left:50%;margin-left:-6px;margin-top:-6px;position:absolute;top:50%;width:12px}.tp-hplv:focus .tp-hplv_m{border-color:#fff}.tp-aplv{cursor:pointer;height:var(--cnt-usz);outline:none;position:relative;width:100%}.tp-aplv.tp-v-disabled{opacity:.5}.tp-aplv_b{background-color:#fff;background-image:linear-gradient(to top right, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%),linear-gradient(to top right, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%);background-size:4px 4px;background-position:0 0,2px 2px;border-radius:2px;display:block;height:4px;left:0;margin-top:-2px;overflow:hidden;position:absolute;top:50%;width:100%}.tp-aplv_c{inset:0;position:absolute}.tp-aplv_m{background-color:#fff;background-image:linear-gradient(to top right, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%),linear-gradient(to top right, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%);background-size:12px 12px;background-position:0 0,6px 6px;border-radius:var(--bld-br);box-shadow:0 0 2px rgba(0,0,0,.1);height:12px;left:50%;margin-left:-6px;margin-top:-6px;overflow:hidden;position:absolute;top:50%;width:12px}.tp-aplv_p{border-radius:var(--bld-br);border:rgba(255,255,255,.75) solid 2px;box-sizing:border-box;inset:0;position:absolute}.tp-aplv:focus .tp-aplv_p{border-color:#fff}.tp-colswv{background-color:#fff;background-image:linear-gradient(to top right, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%),linear-gradient(to top right, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%);background-size:10px 10px;background-position:0 0,5px 5px;border-radius:var(--bld-br);overflow:hidden}.tp-colswv.tp-v-disabled{opacity:.5}.tp-colswv_sw{border-radius:0}.tp-colswv_b{cursor:pointer;display:block;height:var(--cnt-usz);left:0;position:absolute;top:0;width:var(--cnt-usz)}.tp-colswv_b:focus::after{border:rgba(255,255,255,.75) solid 2px;border-radius:var(--bld-br);content:"";display:block;inset:0;position:absolute}.tp-coltxtv{display:flex;width:100%}.tp-coltxtv_m{margin-right:4px}.tp-coltxtv_ms{border-radius:var(--bld-br);color:var(--lbl-fg);cursor:pointer;height:var(--cnt-usz);line-height:var(--cnt-usz);padding:0 18px 0 4px}.tp-coltxtv_ms:hover{background-color:var(--in-bg-h)}.tp-coltxtv_ms:focus{background-color:var(--in-bg-f)}.tp-coltxtv_ms:active{background-color:var(--in-bg-a)}.tp-coltxtv_mm{color:var(--lbl-fg)}.tp-coltxtv.tp-v-disabled .tp-coltxtv_mm{opacity:.5}.tp-coltxtv_w{flex:1}.tp-dfwv{position:absolute;top:8px;right:8px;width:256px}.tp-fldv{position:relative}.tp-fldv_t{padding-left:4px}.tp-fldv_b:disabled .tp-fldv_m{display:none}.tp-fldv_c{padding-left:4px}.tp-fldv_i{bottom:0;color:var(--cnt-bg);left:0;overflow:hidden;position:absolute;top:calc(var(--cnt-usz) + 4px);width:max(var(--bs-br),4px)}.tp-fldv_i::before{background-color:currentColor;bottom:0;content:"";left:0;position:absolute;top:0;width:4px}.tp-fldv_b:hover+.tp-fldv_i{color:var(--cnt-bg-h)}.tp-fldv_b:focus+.tp-fldv_i{color:var(--cnt-bg-f)}.tp-fldv_b:active+.tp-fldv_i{color:var(--cnt-bg-a)}.tp-fldv.tp-v-disabled>.tp-fldv_i{opacity:.5}.tp-grlv{position:relative}.tp-grlv_g{display:block;height:calc(var(--cnt-usz)*3)}.tp-grlv_g polyline{fill:none;stroke:var(--mo-fg);stroke-linejoin:round}.tp-grlv_t{margin-top:-4px;transition:left .05s,top .05s;visibility:hidden}.tp-grlv_t.tp-grlv_t-a{visibility:visible}.tp-grlv_t.tp-grlv_t-in{transition:none}.tp-grlv.tp-v-disabled .tp-grlv_g{opacity:.5}.tp-grlv .tp-ttv{background-color:var(--mo-fg)}.tp-grlv .tp-ttv::before{border-top-color:var(--mo-fg)}.tp-lblv{align-items:center;display:flex;line-height:1.3;padding-left:var(--cnt-hp);padding-right:var(--cnt-hp)}.tp-lblv.tp-lblv-nol{display:block}.tp-lblv_l{color:var(--lbl-fg);flex:1;-webkit-hyphens:auto;hyphens:auto;overflow:hidden;padding-left:4px;padding-right:16px}.tp-lblv.tp-v-disabled .tp-lblv_l{opacity:.5}.tp-lblv.tp-lblv-nol .tp-lblv_l{display:none}.tp-lblv_v{align-self:flex-start;flex-grow:0;flex-shrink:0;width:var(--bld-vw)}.tp-lblv.tp-lblv-nol .tp-lblv_v{width:100%}.tp-lstv_s{padding:0 20px 0 var(--bld-hp);width:100%}.tp-lstv_m{color:var(--btn-fg)}.tp-sglv_i{padding-left:var(--bld-hp);padding-right:var(--bld-hp)}.tp-sglv.tp-v-disabled .tp-sglv_i{opacity:.5}.tp-mllv_i{display:block;height:calc(var(--cnt-usz)*3);line-height:var(--cnt-usz);padding-left:var(--bld-hp);padding-right:var(--bld-hp);resize:none;white-space:pre}.tp-mllv.tp-v-disabled .tp-mllv_i{opacity:.5}.tp-p2dv{position:relative}.tp-p2dv_h{display:flex}.tp-p2dv_b{height:var(--cnt-usz);margin-right:4px;position:relative;width:var(--cnt-usz)}.tp-p2dv_b svg{display:block;height:16px;left:50%;margin-left:-8px;margin-top:-8px;position:absolute;top:50%;width:16px}.tp-p2dv_b svg path{stroke:currentColor;stroke-width:2}.tp-p2dv_b svg circle{fill:currentColor}.tp-p2dv_t{flex:1}.tp-p2dv_p{height:0;margin-top:0;opacity:0;overflow:hidden;transition:height .2s ease-in-out,opacity .2s linear,margin .2s ease-in-out}.tp-p2dv.tp-p2dv-expanded .tp-p2dv_p{margin-top:var(--cnt-usp);opacity:1}.tp-p2dv .tp-popv{left:calc(-1*var(--cnt-hp));right:calc(-1*var(--cnt-hp));top:var(--cnt-usz)}.tp-p2dpv{padding-left:calc(var(--cnt-usz) + 4px)}.tp-p2dpv_p{cursor:crosshair;height:0;overflow:hidden;padding-bottom:100%;position:relative}.tp-p2dpv.tp-v-disabled .tp-p2dpv_p{opacity:.5}.tp-p2dpv_g{display:block;height:100%;left:0;pointer-events:none;position:absolute;top:0;width:100%}.tp-p2dpv_ax{opacity:.1;stroke:var(--in-fg);stroke-dasharray:1}.tp-p2dpv_l{opacity:.5;stroke:var(--in-fg);stroke-dasharray:1}.tp-p2dpv_m{border:var(--in-fg) solid 1px;border-radius:50%;box-sizing:border-box;height:4px;margin-left:-2px;margin-top:-2px;position:absolute;width:4px}.tp-p2dpv_p:focus .tp-p2dpv_m{background-color:var(--in-fg);border-width:0}.tp-popv{background-color:var(--bs-bg);border-radius:var(--bs-br);box-shadow:0 2px 4px var(--bs-sh);display:none;max-width:var(--bld-vw);padding:var(--cnt-vp) var(--cnt-hp);position:absolute;visibility:hidden;z-index:1000}.tp-popv.tp-popv-v{display:block;visibility:visible}.tp-sldv.tp-v-disabled{opacity:.5}.tp-sldv_t{box-sizing:border-box;cursor:pointer;height:var(--cnt-usz);margin:0 6px;outline:none;position:relative}.tp-sldv_t::before{background-color:var(--in-bg);border-radius:1px;content:"";display:block;height:2px;inset:0;margin:auto;position:absolute}.tp-sldv_k{height:100%;left:0;position:absolute;top:0}.tp-sldv_k::before{background-color:var(--in-fg);border-radius:1px;content:"";display:block;height:2px;inset:0;margin-bottom:auto;margin-top:auto;position:absolute}.tp-sldv_k::after{background-color:var(--btn-bg);border-radius:var(--bld-br);bottom:0;content:"";display:block;height:12px;margin-bottom:auto;margin-top:auto;position:absolute;right:-6px;top:0;width:12px}.tp-sldv_t:hover .tp-sldv_k::after{background-color:var(--btn-bg-h)}.tp-sldv_t:focus .tp-sldv_k::after{background-color:var(--btn-bg-f)}.tp-sldv_t:active .tp-sldv_k::after{background-color:var(--btn-bg-a)}.tp-sldtxtv{display:flex}.tp-sldtxtv_s{flex:2}.tp-sldtxtv_t{flex:1;margin-left:4px}.tp-tabv{position:relative}.tp-tabv_t{align-items:flex-end;color:var(--cnt-bg);display:flex;overflow:hidden;position:relative}.tp-tabv_t:hover{color:var(--cnt-bg-h)}.tp-tabv_t:has(*:focus){color:var(--cnt-bg-f)}.tp-tabv_t:has(*:active){color:var(--cnt-bg-a)}.tp-tabv_t::before{background-color:currentColor;bottom:0;content:"";height:2px;left:0;pointer-events:none;position:absolute;right:0}.tp-tabv.tp-v-disabled .tp-tabv_t::before{opacity:.5}.tp-tabv.tp-tabv-nop .tp-tabv_t{height:calc(var(--cnt-usz) + 4px);position:relative}.tp-tabv.tp-tabv-nop .tp-tabv_t::before{background-color:var(--cnt-bg);bottom:0;content:"";height:2px;left:0;position:absolute;right:0}.tp-tabv_i{bottom:0;color:var(--cnt-bg);left:0;overflow:hidden;position:absolute;top:calc(var(--cnt-usz) + 4px);width:max(var(--bs-br),4px)}.tp-tabv_i::before{background-color:currentColor;bottom:0;content:"";left:0;position:absolute;top:0;width:4px}.tp-tabv_t:hover+.tp-tabv_i{color:var(--cnt-bg-h)}.tp-tabv_t:has(*:focus)+.tp-tabv_i{color:var(--cnt-bg-f)}.tp-tabv_t:has(*:active)+.tp-tabv_i{color:var(--cnt-bg-a)}.tp-tabv.tp-v-disabled>.tp-tabv_i{opacity:.5}.tp-tbiv{flex:1;min-width:0;position:relative}.tp-tbiv+.tp-tbiv{margin-left:2px}.tp-tbiv+.tp-tbiv.tp-v-disabled::before{opacity:.5}.tp-tbiv_b{display:block;padding-left:calc(var(--cnt-hp) + 4px);padding-right:calc(var(--cnt-hp) + 4px);position:relative;width:100%}.tp-tbiv_b:disabled{opacity:.5}.tp-tbiv_b::before{background-color:var(--cnt-bg);content:"";inset:0 0 2px;pointer-events:none;position:absolute}.tp-tbiv_b:hover::before{background-color:var(--cnt-bg-h)}.tp-tbiv_b:focus::before{background-color:var(--cnt-bg-f)}.tp-tbiv_b:active::before{background-color:var(--cnt-bg-a)}.tp-tbiv_t{color:var(--cnt-fg);height:calc(var(--cnt-usz) + 4px);line-height:calc(var(--cnt-usz) + 4px);opacity:.5;overflow:hidden;position:relative;text-overflow:ellipsis}.tp-tbiv.tp-tbiv-sel .tp-tbiv_t{opacity:1}.tp-tbpv_c{padding-bottom:var(--cnt-vp);padding-left:4px;padding-top:var(--cnt-vp)}.tp-txtv{position:relative}.tp-txtv_i{padding-left:var(--bld-hp);padding-right:var(--bld-hp)}.tp-txtv.tp-txtv-fst .tp-txtv_i{border-bottom-right-radius:0;border-top-right-radius:0}.tp-txtv.tp-txtv-mid .tp-txtv_i{border-radius:0}.tp-txtv.tp-txtv-lst .tp-txtv_i{border-bottom-left-radius:0;border-top-left-radius:0}.tp-txtv.tp-txtv-num .tp-txtv_i{text-align:right}.tp-txtv.tp-txtv-drg .tp-txtv_i{opacity:.3}.tp-txtv_k{cursor:pointer;height:100%;left:calc(var(--bld-hp) - 5px);position:absolute;top:0;width:12px}.tp-txtv_k::before{background-color:var(--in-fg);border-radius:1px;bottom:0;content:"";height:calc(var(--cnt-usz) - 4px);left:50%;margin-bottom:auto;margin-left:-1px;margin-top:auto;opacity:.1;position:absolute;top:0;transition:border-radius .1s,height .1s,transform .1s,width .1s;width:2px}.tp-txtv_k:hover::before,.tp-txtv.tp-txtv-drg .tp-txtv_k::before{opacity:1}.tp-txtv.tp-txtv-drg .tp-txtv_k::before{border-radius:50%;height:4px;transform:translateX(-1px);width:4px}.tp-txtv_g{bottom:0;display:block;height:8px;left:50%;margin:auto;overflow:visible;pointer-events:none;position:absolute;top:0;visibility:hidden;width:100%}.tp-txtv.tp-txtv-drg .tp-txtv_g{visibility:visible}.tp-txtv_gb{fill:none;stroke:var(--in-fg);stroke-dasharray:1}.tp-txtv_gh{fill:none;stroke:var(--in-fg)}.tp-txtv .tp-ttv{margin-left:6px;visibility:hidden}.tp-txtv.tp-txtv-drg .tp-ttv{visibility:visible}.tp-ttv{background-color:var(--in-fg);border-radius:var(--bld-br);color:var(--bs-bg);padding:2px 4px;pointer-events:none;position:absolute;transform:translate(-50%, -100%)}.tp-ttv::before{border-color:var(--in-fg) rgba(0,0,0,0) rgba(0,0,0,0) rgba(0,0,0,0);border-style:solid;border-width:2px;box-sizing:border-box;content:"";font-size:.9em;height:4px;left:50%;margin-left:-2px;position:absolute;top:100%;width:4px}.tp-rotv{background-color:var(--bs-bg);border-radius:var(--bs-br);box-shadow:0 2px 4px var(--bs-sh);font-family:var(--bs-ff);font-size:11px;font-weight:500;line-height:1;text-align:left}.tp-rotv_b{border-bottom-left-radius:var(--bs-br);border-bottom-right-radius:var(--bs-br);border-top-left-radius:var(--bs-br);border-top-right-radius:var(--bs-br);padding-left:calc(4px + var(--cnt-usz) + var(--cnt-hp));text-align:center}.tp-rotv.tp-rotv-expanded .tp-rotv_b{border-bottom-left-radius:0;border-bottom-right-radius:0;transition-delay:0s;transition-duration:0s}.tp-rotv.tp-rotv-not>.tp-rotv_b{display:none}.tp-rotv_b:disabled .tp-rotv_m{display:none}.tp-rotv_c>.tp-fldv.tp-v-lst>.tp-fldv_c{border-bottom-left-radius:var(--bs-br);border-bottom-right-radius:var(--bs-br)}.tp-rotv_c>.tp-fldv.tp-v-lst>.tp-fldv_i{border-bottom-left-radius:var(--bs-br)}.tp-rotv_c>.tp-fldv.tp-v-lst:not(.tp-fldv-expanded)>.tp-fldv_b{border-bottom-left-radius:var(--bs-br);border-bottom-right-radius:var(--bs-br)}.tp-rotv_c>.tp-fldv.tp-v-lst.tp-fldv-expanded>.tp-fldv_b{transition-delay:0s;transition-duration:0s}.tp-rotv_c .tp-fldv.tp-v-vlst:not(.tp-fldv-expanded)>.tp-fldv_b{border-bottom-right-radius:var(--bs-br)}.tp-rotv.tp-rotv-not .tp-rotv_c>.tp-fldv.tp-v-fst{margin-top:calc(-1*var(--cnt-vp))}.tp-rotv.tp-rotv-not .tp-rotv_c>.tp-fldv.tp-v-fst>.tp-fldv_b{border-top-left-radius:var(--bs-br);border-top-right-radius:var(--bs-br)}.tp-rotv_c>.tp-tabv.tp-v-lst>.tp-tabv_c{border-bottom-left-radius:var(--bs-br);border-bottom-right-radius:var(--bs-br)}.tp-rotv_c>.tp-tabv.tp-v-lst>.tp-tabv_i{border-bottom-left-radius:var(--bs-br)}.tp-rotv.tp-rotv-not .tp-rotv_c>.tp-tabv.tp-v-fst{margin-top:calc(-1*var(--cnt-vp))}.tp-rotv.tp-rotv-not .tp-rotv_c>.tp-tabv.tp-v-fst>.tp-tabv_t{border-top-left-radius:var(--bs-br);border-top-right-radius:var(--bs-br)}.tp-rotv.tp-v-disabled,.tp-rotv .tp-v-disabled{pointer-events:none}.tp-rotv.tp-v-hidden,.tp-rotv .tp-v-hidden{display:none}.tp-sprv_r{background-color:var(--grv-fg);border-width:0;display:block;height:2px;margin:0;width:100%}.tp-sprv.tp-v-disabled .tp-sprv_r{opacity:.5}',plugins:[uu,vu,bu,Pa,gu]})}}new xa("4.0.5");const ro=1,io=32,gr=80,_r=800,wr=20,xr=200,yr=10,Er=200,ao=1,oo=100,so=0,lo=60,co=60,po=800,Be={pillLen:300,pillShort:300,pillThick:300,edgeR:30},On={...Be,waveAmp:20,waveWavelength:300},Ve={diamondSize:200,diamondWireframe:!1,diamondFacetColor:!1,diamondTirDebug:!1,diamondTirMaxBounces:6,diamondView:"free"};function Mn(){return{pill:{...Be},prism:{pillLen:393,pillShort:149,pillThick:117},cube:{...Be,pillLen:230,pillShort:230,pillThick:230,edgeR:44},plate:{...On,pillLen:400,pillThick:100,edgeR:4},diamond:{...Ve}}}function yu(t){const{shape:e,shapes:n,n_d:r,V_d:i,refractionStrength:a}=t;if(e==="diamond"){const s=n.diamond;return{n_d:r,V_d:i,refractionStrength:a,pillLen:s.diamondSize,pillShort:s.diamondSize,pillThick:s.diamondSize,edgeR:0,waveAmp:n.plate.waveAmp,waveWavelength:n.plate.waveWavelength,diamondSize:s.diamondSize,diamondWireframe:s.diamondWireframe,diamondFacetColor:s.diamondFacetColor,diamondTirDebug:s.diamondTirDebug,diamondTirMaxBounces:s.diamondTirMaxBounces,diamondView:s.diamondView}}if(e==="plate"){const s=n.plate;return{n_d:r,V_d:i,refractionStrength:a,pillLen:s.pillLen,pillShort:s.pillLen,pillThick:s.pillThick,edgeR:s.edgeR,waveAmp:s.waveAmp,waveWavelength:s.waveWavelength,diamondSize:n.diamond.diamondSize,diamondWireframe:n.diamond.diamondWireframe,diamondFacetColor:n.diamond.diamondFacetColor,diamondTirDebug:n.diamond.diamondTirDebug,diamondTirMaxBounces:n.diamond.diamondTirMaxBounces,diamondView:n.diamond.diamondView}}if(e==="prism"){const s=n.prism;return{n_d:r,V_d:i,refractionStrength:a,pillLen:s.pillLen,pillShort:s.pillShort,pillThick:s.pillThick,edgeR:0,waveAmp:n.plate.waveAmp,waveWavelength:n.plate.waveWavelength,diamondSize:n.diamond.diamondSize,diamondWireframe:n.diamond.diamondWireframe,diamondFacetColor:n.diamond.diamondFacetColor,diamondTirDebug:n.diamond.diamondTirDebug,diamondTirMaxBounces:n.diamond.diamondTirMaxBounces,diamondView:n.diamond.diamondView}}const o=e==="pill"?n.pill:n.cube;return{n_d:r,V_d:i,refractionStrength:a,pillLen:o.pillLen,pillShort:o.pillShort,pillThick:o.pillThick,edgeR:o.edgeR,waveAmp:n.plate.waveAmp,waveWavelength:n.plate.waveWavelength,diamondSize:n.diamond.diamondSize,diamondWireframe:n.diamond.diamondWireframe,diamondFacetColor:n.diamond.diamondFacetColor,diamondTirDebug:n.diamond.diamondTirDebug,diamondTirMaxBounces:n.diamond.diamondTirMaxBounces,diamondView:n.diamond.diamondView}}function Eu(t,e){const n=(w,f)=>ee(t[w])?t[w]:f,r=(w,f)=>typeof t[w]=="boolean"?t[w]:f,i=Math.min(_r,Math.max(gr,n("pillLen",Be.pillLen))),a=Math.min(xr,Math.max(wr,n("pillShort",Be.pillShort))),o=Math.min(Er,Math.max(yr,n("pillThick",Be.pillThick))),s=Math.min(oo,Math.max(ao,n("edgeR",Be.edgeR))),l={pillLen:i,pillShort:a,pillThick:o,edgeR:s},d=Math.min(lo,Math.max(so,n("waveAmp",On.waveAmp))),c=Math.min(po,Math.max(co,n("waveWavelength",On.waveWavelength))),u=Math.min(Hn,Math.max(Un,n("diamondSize",Ve.diamondSize))),p=Math.min(io,Math.max(ro,Math.round(ee(t.diamondTirMaxBounces)?t.diamondTirMaxBounces:Ve.diamondTirMaxBounces)));return{pill:{...e.pill,...l},prism:{...e.prism,pillLen:i,pillShort:a,pillThick:o},cube:{...e.cube,...l},plate:{...e.plate,...l,waveAmp:d,waveWavelength:c},diamond:{diamondSize:u,diamondWireframe:r("diamondWireframe",Ve.diamondWireframe),diamondFacetColor:r("diamondFacetColor",Ve.diamondFacetColor),diamondTirDebug:r("diamondTirDebug",Ve.diamondTirDebug),diamondTirMaxBounces:p,diamondView:typeof t.diamondView=="string"&&jn.includes(t.diamondView)?t.diamondView:Ve.diamondView}}}function se(t,e,n){return Math.min(Math.max(t,e),n)}function Vn(t,e){if(t===null||typeof t!="object")return{...e};const n=t;return{pillLen:ee(n.pillLen)?se(n.pillLen,gr,_r):e.pillLen,pillShort:ee(n.pillShort)?se(n.pillShort,wr,xr):e.pillShort,pillThick:ee(n.pillThick)?se(n.pillThick,yr,Er):e.pillThick,edgeR:ee(n.edgeR)?se(n.edgeR,ao,oo):e.edgeR}}function uo(t,e){if(e===null||typeof e!="object"||Array.isArray(e))return{...t};const n=e;return{pillLen:ee(n.pillLen)?se(n.pillLen,gr,_r):t.pillLen,pillShort:ee(n.pillShort)?se(n.pillShort,wr,xr):t.pillShort,pillThick:ee(n.pillThick)?se(n.pillThick,yr,Er):t.pillThick}}function Pu(t,e){if(t===null||typeof t!="object")return{...e};const n=Vn(t,e),r=t;return{...n,waveAmp:ee(r.waveAmp)?se(r.waveAmp,so,lo):e.waveAmp,waveWavelength:ee(r.waveWavelength)?se(r.waveWavelength,co,po):e.waveWavelength}}function Cu(t,e){if(t===null||typeof t!="object")return{...e};const n=t,r=n.diamondView;return{diamondSize:ee(n.diamondSize)?se(n.diamondSize,Un,Hn):e.diamondSize,diamondWireframe:typeof n.diamondWireframe=="boolean"?n.diamondWireframe:e.diamondWireframe,diamondFacetColor:typeof n.diamondFacetColor=="boolean"?n.diamondFacetColor:e.diamondFacetColor,diamondTirDebug:typeof n.diamondTirDebug=="boolean"?n.diamondTirDebug:e.diamondTirDebug,diamondTirMaxBounces:ee(n.diamondTirMaxBounces)?Math.round(se(n.diamondTirMaxBounces,ro,io)):e.diamondTirMaxBounces,diamondView:typeof r=="string"&&jn.includes(r)?r:e.diamondView}}function Su(t,e){if(t===null||typeof t!="object"||Array.isArray(t))return Eu(e,Mn());const n=t,r=Mn();return{pill:Vn(n.pill,r.pill),prism:uo(r.prism,n.prism),cube:Vn(n.cube,r.cube),plate:Pu(n.plate,r.plate),diamond:Cu(n.diamond,r.diamond)}}function ee(t){return typeof t=="number"&&Number.isFinite(t)}const ho=.01,mo=2,fo=-Math.PI,vo=Math.PI,Au=1,Lu=32,bo=20,go=120,ku=0,Tu=60,Du=60,Ru=800,_n=1,wn=100,Ut=80,xn=800,mi=20,fi=200,yn=10,En=200,_o=.05,wo=1,vi=1,bi=3.5,gi=1,_i=90,wi=0,xi=1,Iu=[{text:"3 (fake RGB)",value:3},{text:"8",value:8},{text:"16",value:16},{text:"32",value:32},{text:"64 (max)",value:64}],Nu=[{text:"Exact",value:"exact"},{text:"Approx",value:"approx"}],Ou=[{text:"Pill",value:"pill"},{text:"Prism (rainbow)",value:"prism"},{text:"Cube (rotating)",value:"cube"},{text:"Plate (wavy)",value:"plate"},{text:"Diamond (brilliant)",value:"diamond"}],Mu=[{text:"Free (tumble)",value:"free"},{text:"Top (table)",value:"top"},{text:"Side (girdle)",value:"side"},{text:"Bottom (culet)",value:"bottom"}],Vu=[{text:"Orthographic",value:"ortho"},{text:"Perspective",value:"perspective"}],Bu=[{text:"None",value:"none"},{text:"FXAA",value:"fxaa"},{text:"TAA",value:"taa"}],Fu=Ye.map(t=>({text:`${t.label} (${t.kind})`,value:t.slug})),zu=Zi.map(t=>({text:t.toUpperCase(),value:t})),Uu=[{text:"Picsum only",value:"photo"},{text:"Picsum + text (HTML)",value:"html"}],Hu=[{label:"Water",n_d:1.333,V_d:55.7},{label:"Fused silica",n_d:1.458,V_d:67.7},{label:"PMMA (acrylic)",n_d:1.491,V_d:58},{label:"Crown (BK7)",n_d:1.517,V_d:64.2},{label:"Polycarbonate",n_d:1.586,V_d:30},{label:"Lead crystal",n_d:1.6,V_d:32},{label:"Flint (SF10)",n_d:1.728,V_d:28.4},{label:"Dense flint (SF11)",n_d:1.785,V_d:25.4},{label:"Cubic zirconia",n_d:2.15,V_d:30},{label:"Diamond",n_d:2.418,V_d:55},{label:"Moissanite",n_d:2.648,V_d:31},{label:"✨ Rainbow glass",n_d:1.55,V_d:8},{label:"✨ Fire crystal",n_d:2.2,V_d:12},{label:"✨ Unobtanium",n_d:3.2,V_d:4},{label:"✨ Rainbow soap",n_d:1.272,V_d:2}],Wu=[{label:"Subtle pill",apply:t=>{t.shape="pill",t.sampleCount=8,t.n_d=1.517,t.V_d=6.5,t.refractionStrength=.035,t.temporalJitter=!0,t.smoothCurvature=!0,t.projection="perspective",t.fov=45,t.paused=!1,t.aaMode="none",t.historyAlpha=.5,t.debugProxy=!1,t.envmapEnabled=!1,Object.assign(t.shapes.pill,{pillLen:400,pillShort:115,pillThick:62,edgeR:100}),t.refractionMode="exact"}},{label:"Prism rainbow",apply:t=>{t.shape="prism",t.sampleCount=16,t.n_d=1.6,t.V_d=12,t.refractionStrength=.155,t.temporalJitter=!0,t.smoothCurvature=!0,t.projection="perspective",t.fov=45,t.paused=!1,t.aaMode="none",t.historyAlpha=.5,t.debugProxy=!1,t.envmapEnabled=!1,Object.assign(t.shapes.prism,{pillLen:393,pillShort:149,pillThick:117}),t.refractionMode="exact"}},{label:"Rotating cube",apply:t=>{t.shape="cube",t.sampleCount=16,t.n_d=1.272,t.V_d=2,t.refractionStrength=.15,t.temporalJitter=!0,t.smoothCurvature=!0,t.projection="perspective",t.fov=45,t.paused=!1,t.aaMode="none",t.historyAlpha=.5,t.debugProxy=!1,t.envmapEnabled=!1,Object.assign(t.shapes.cube,{pillLen:230,pillShort:230,pillThick:230,edgeR:44}),t.refractionMode="exact"}},{label:"Wavy plate",apply:t=>{t.shape="plate",t.sampleCount=16,t.n_d=1.272,t.V_d=2,t.refractionStrength=.2,t.temporalJitter=!0,t.smoothCurvature=!0,t.projection="perspective",t.fov=45,t.paused=!1,t.aaMode="none",t.historyAlpha=.5,t.debugProxy=!1,t.envmapEnabled=!1,Object.assign(t.shapes.plate,{pillLen:346,pillShort:346,pillThick:60,edgeR:10.5,waveAmp:17,waveWavelength:535}),t.refractionMode="exact"}},{label:"Diamond",apply:t=>{t.shape="diamond",t.sampleCount=16,t.n_d=2.418,t.V_d=55,t.refractionStrength=.2,t.temporalJitter=!0,t.smoothCurvature=!0,t.projection="perspective",t.fov=45,t.paused=!1,t.aaMode="none",t.historyAlpha=.5,t.debugProxy=!1,t.envmapEnabled=!0,t.envmapSlug="brown_photostudio_06",t.envmapSize="2k",t.envmapExposure=.75,t.envmapRotation=-1.0995,t.bgSource="html",Object.assign(t.shapes.diamond,{diamondSize:400,diamondWireframe:!1,diamondFacetColor:!1,diamondTirDebug:!1,diamondTirMaxBounces:6,diamondView:"free"}),t.refractionMode="exact"}}];function ju(t,e,n,r=()=>{},i=null,a=()=>{},o=()=>{},s=()=>{},l=null,d=()=>{}){const c=new xu({title:"Spectral Dispersion",expanded:!0}),u=c.addFolder({title:"Spectral"});u.addBinding(t,"sampleCount",{options:Iu}),u.addBinding(t,"n_d",{min:1,max:3.5,step:.001,label:"IOR n_d"}),u.addBinding(t,"V_d",{min:1,max:90,step:.5,label:"Abbe V_d"}),u.addBinding(t,"refractionStrength",{min:0,max:1,step:.001,label:"Refraction"}),u.addBinding(t,"refractionMode",{options:Nu}),u.addBinding(t,"temporalJitter",{label:"Temporal jitter"});const p=c.addFolder({title:"Shape"}),w=p.addBinding(t,"shape",{options:Ou});p.addBinding(t,"smoothCurvature",{label:"Smooth curvature"});const f=p.addFolder({title:"Pill",expanded:!0});f.addBinding(t.shapes.pill,"pillLen",{min:Ut,max:xn,step:1,label:"Length (X)"}),f.addBinding(t.shapes.pill,"pillShort",{min:mi,max:fi,step:1,label:"Short (Y)"}),f.addBinding(t.shapes.pill,"pillThick",{min:yn,max:En,step:1,label:"Thick (Z)"}),f.addBinding(t.shapes.pill,"edgeR",{min:_n,max:wn,step:.5,label:"Edge radius"});const h=p.addFolder({title:"Prism (rainbow)",expanded:!0});h.addBinding(t.shapes.prism,"pillLen",{min:Ut,max:xn,step:1,label:"Length (X)"}),h.addBinding(t.shapes.prism,"pillShort",{min:mi,max:fi,step:1,label:"Short (Y)"}),h.addBinding(t.shapes.prism,"pillThick",{min:yn,max:En,step:1,label:"Thick (Z)"});const E=p.addFolder({title:"Cube (rotating)",expanded:!0}),v={value:t.shapes.cube.pillLen};E.addBinding(v,"value",{min:Ut,max:600,step:1,label:"Size"}).on("change",()=>{t.shape==="cube"&&(t.shapes.cube.pillLen=v.value,t.shapes.cube.pillShort=v.value,t.shapes.cube.pillThick=v.value)}),E.addBinding(t.shapes.cube,"edgeR",{min:_n,max:wn,step:.5,label:"Edge radius"});const x=p.addFolder({title:"Plate (wavy)",expanded:!0});x.addBinding(t.shapes.plate,"pillLen",{min:Ut,max:xn,step:1,label:"Face (square)"}),x.addBinding(t.shapes.plate,"pillThick",{min:yn,max:En,step:1,label:"Thick (Z)"}),x.addBinding(t.shapes.plate,"waveAmp",{min:ku,max:Tu,step:.5,label:"Wave amp"}),x.addBinding(t.shapes.plate,"waveWavelength",{min:Du,max:Ru,step:1,label:"Wavelength"}),x.addBinding(t.shapes.plate,"edgeR",{min:_n,max:wn,step:.5,label:"Rim radius"});const W=p.addFolder({title:"Diamond (brilliant)",expanded:!0});W.addBinding(t.shapes.diamond,"diamondSize",{min:Un,max:Hn,step:1,label:"Girdle size"}),W.addBinding(t.shapes.diamond,"diamondView",{label:"View",options:Mu}),W.addBinding(t.shapes.diamond,"diamondWireframe",{label:"Wireframe"}),W.addBinding(t.shapes.diamond,"diamondFacetColor",{label:"Facet color"}),W.addBinding(t.shapes.diamond,"diamondTirDebug",{label:"TIR debug"}),W.addBinding(t.shapes.diamond,"diamondTirMaxBounces",{min:Au,max:Lu,step:1,label:"TIR max bounces (costly ↑)"});function j(){const y=t.shape;f.hidden=y!=="pill",h.hidden=y!=="prism",E.hidden=y!=="cube",x.hidden=y!=="plate",W.hidden=y!=="diamond";const q=y==="cube",de=y==="plate";if(q){const $=t.shapes.cube,fe=Math.round(($.pillLen+$.pillShort+$.pillThick)/3);v.value=fe,$.pillLen=fe,$.pillShort=fe,$.pillThick=fe}else v.value=t.shapes.cube.pillLen,de&&(t.shapes.plate.pillShort=t.shapes.plate.pillLen)}j(),w.on("change",()=>{j(),d($t(t.shape)),c.refresh()});const _=c.addFolder({title:"Environment"}),I=_.addBinding(t,"envmapEnabled",{label:"HDR env"}),re=_.addBinding(t,"envmapSlug",{label:"Panorama",options:Fu});re.on("change",y=>{a(y.value)});const H=_.addBinding(t,"envmapSize",{label:"Size",options:zu});H.on("change",()=>{a(t.envmapSlug)});const oe=_.addButton({title:"Random panorama"});oe.on("click",()=>{o()});const G=_.addBinding(t,"envmapExposure",{min:ho,max:mo,step:.01,label:"Exposure"}),J=_.addBinding(t,"envmapRotation",{min:fo,max:vo,step:Math.PI/180,label:"Rotation (rad)"}),qe=_.addButton({title:"Random photo"});qe.on("click",e);let Ne=null;l&&(Ne=_.addBinding(t,"bgSource",{label:"Background",options:Uu}),Ne.on("change",()=>{Oe(),c.refresh(),n(),r()}));function Oe(){const y=t.envmapEnabled;re.hidden=!y,H.hidden=!y,oe.hidden=!y,G.hidden=!y,J.hidden=!y;const q=l!==null&&t.bgSource==="html";qe.hidden=y&&!q,Ne&&(Ne.hidden=!1)}Oe();const le=c.addFolder({title:"Misc"});le.addBinding(t,"projection",{options:Vu}),le.addBinding(t,"fov",{min:bo,max:go,step:1,label:"FOV°"}),le.addBinding(t,"paused",{label:"Stop the world"}),le.addBinding(t,"aaMode",{label:"AA",options:Bu}),le.addBinding(t,"historyAlpha",{min:_o,max:wo,step:.01,label:"History α"}),le.addBinding(t,"debugProxy",{label:"Show proxy"});const It=c.addFolder({title:"Presets"});for(const y of Wu)It.addButton({title:y.label}).on("click",()=>{y.apply(t),!l&&t.bgSource==="html"&&(t.bgSource="photo"),d($t(t.shape)),j(),Oe(),t.envmapEnabled&&a(t.envmapSlug),c.refresh(),r(),n()});const Nt=c.addFolder({title:"Materials",expanded:!1});for(const y of Hu)Nt.addButton({title:`${y.label}  (n=${y.n_d}, V=${y.V_d})`}).on("click",()=>{t.n_d=y.n_d,t.V_d=y.V_d,c.refresh(),r(),n()});if(i){const y=i.stats,q={get fps(){return y.fps},get cpuMs(){return y.cpuMs},get gpuMs(){return y.gpuMs}},de=c.addFolder({title:"Perf",expanded:!0}),$=250,fe=ce=>Number.isFinite(ce)?ce.toFixed(2):"—",Ot=ce=>Number.isFinite(ce)?ce.toFixed(3):"—";de.addBinding(q,"fps",{readonly:!0,label:"FPS",interval:$,format:ce=>ce.toFixed(1)}),de.addBinding(i.stats,"fps",{readonly:!0,label:"FPS trend",view:"graph",min:0,max:120,interval:$}),de.addBinding(q,"cpuMs",{readonly:!0,label:"CPU ms",interval:$,format:fe}),de.addBinding(i.stats,"cpuMs",{readonly:!0,label:"CPU trend",view:"graph",min:0,max:33,interval:$}),i.hasGpuTiming&&(de.addBinding(q,"gpuMs",{readonly:!0,label:"GPU ms (scene)",interval:$,format:Ot}),de.addBinding(i.stats,"gpuMs",{readonly:!0,label:"GPU (scene) trend",view:"graph",min:0,max:16,interval:$}))}const Pe=y=>{y.last&&r(),n()};u.on("change",Pe),p.on("change",Pe),le.on("change",Pe);const Ce=()=>{r(),n()};return I.on("change",y=>{y.value&&s(),Oe(),c.refresh(),Ce()}),G.on("change",Ce),J.on("change",Ce),c}function Gu(){return{sampleCount:16,shape:"prism",n_d:1.6,V_d:12,refractionStrength:.155,shapes:Mn(),refractionMode:"exact",temporalJitter:!0,projection:"perspective",fov:45,debugProxy:!1,smoothCurvature:!0,aaMode:"none",paused:!1,historyAlpha:.5,envmapEnabled:!1,envmapExposure:.25,envmapRotation:0,envmapSlug:Yi,envmapSize:Ji,bgSource:"html"}}function qu(t,e){const n=e.shapes,r=n?{pill:{...t.shapes.pill,...n.pill},prism:uo(t.shapes.prism,n.prism),cube:{...t.shapes.cube,...n.cube},plate:{...t.shapes.plate,...n.plate},diamond:{...t.shapes.diamond,...n.diamond}}:t.shapes;return{...t,...e,shapes:r}}function $u(t,e){const n=t*(Math.PI/180);return e*.5/Math.tan(n*.5)}function xo(t,e,n){const r=()=>t.createTexture({label:"history",size:[e,n,1],format:"rgba16float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT}),i=[r(),r()],a=[i[0].createView(),i[1].createView()],o=t.createSampler({magFilter:"linear",minFilter:"linear"});return{textures:i,views:a,sampler:o,current:0,width:e,height:n}}function Xu(t,e,n,r){return e.width===n&&e.height===r?e:(e.textures.forEach(i=>i.destroy()),xo(t,n,r))}const Ku=`// Post-process pipelines: passthrough and FXAA. Both sample the scene's\r
// linear-rgba16f intermediate and emit display-encoded output to the\r
// swapchain. FXAA runs on perceptual-space luma for accurate edge\r
// detection, but blends color in linear space (physically correct).\r
//\r
// Uses the same vertex-index fullscreen-triangle trick as\r
// fullscreen.wgsl's vs_main; the vertex code is copied here (not\r
// shared) so this module stays self-contained — different bind-group\r
// layout, and \`Vout\` carries an explicit \`uv\` that \`VsOut\` in\r
// fullscreen.wgsl would need to gain too. UV is V-flipped so (0,0)\r
// lands at the top-left like the DOM origin.\r
\r
struct Post {\r
  // f32 flag: 1 = apply sRGB OETF manually (swapchain is non-sRGB, e.g.\r
  // bgra8unorm); 0 = pass linear through (sRGB swapchain auto-encodes).\r
  applySrgbOetf: f32,\r
  // 3 pad floats to round the UBO up to 16 B.\r
  _pad0:         f32,\r
  _pad1:         f32,\r
  _pad2:         f32,\r
};\r
\r
@group(0) @binding(0) var<uniform> post: Post;\r
@group(0) @binding(1) var samp:  sampler;\r
@group(0) @binding(2) var tex:   texture_2d<f32>;\r
\r
struct Vout {\r
  @builtin(position) pos: vec4<f32>,\r
  @location(0)       uv:  vec2<f32>,\r
};\r
\r
@vertex\r
fn vs(@builtin(vertex_index) vi: u32) -> Vout {\r
  // Fullscreen triangle covering NDC [-1,1]²; UV [0,1]² via (x+1)/2 etc.\r
  let x = f32((vi << 1u) & 2u) * 2.0 - 1.0;\r
  let y = f32(vi & 2u) * 2.0 - 1.0;\r
  var o: Vout;\r
  o.pos = vec4<f32>(x, y, 0.0, 1.0);\r
  o.uv  = vec2<f32>((x + 1.0) * 0.5, 1.0 - (y + 1.0) * 0.5);\r
  return o;\r
}\r
\r
// sRGB OETF — same impl as dispersion.wgsl's linearToSrgb. Kept local so\r
// this module is self-contained.\r
fn linearToSrgb(c: vec3<f32>) -> vec3<f32> {\r
  let cutoff = vec3<f32>(0.0031308);\r
  let low    = c * 12.92;\r
  let high   = 1.055 * pow(max(c, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.4)) - 0.055;\r
  return select(high, low, c <= cutoff);\r
}\r
\r
fn encodeOut(c: vec3<f32>) -> vec3<f32> {\r
  if (post.applySrgbOetf > 0.5) { return linearToSrgb(c); }\r
  return c;\r
}\r
\r
// Perceptual luma. FXAA edge detection thresholds are tuned for\r
// gamma-encoded (sRGB-space) luma, so we transform linear → sRGB first.\r
// Blending still happens in linear space (below), which is physically\r
// correct for refracted light.\r
fn lumaOf(c: vec3<f32>) -> f32 {\r
  let g = linearToSrgb(c);\r
  return dot(g, vec3<f32>(0.299, 0.587, 0.114));  // Rec.601\r
}\r
\r
// Passthrough: linear intermediate → swapchain with optional sRGB encode.\r
// Used for aaMode = 'none' and aaMode = 'taa' (TAA already ran in the\r
// scene pass — post-process just forwards the result).\r
@fragment\r
fn fs_passthrough(v: Vout) -> @location(0) vec4<f32> {\r
  let c = textureSampleLevel(tex, samp, v.uv, 0.0).rgb;\r
  return vec4<f32>(encodeOut(c), 1.0);\r
}\r
\r
// FXAA 3.x-style spatial AA. 9-tap neighbourhood: NW/NE/SW/SE + center +\r
// 4 samples along the detected edge direction. Parameters follow Lottes'\r
// canonical tuning — 0.0625 minimum absolute contrast (i.e. skip flat\r
// regions), 0.125 relative contrast (skip very dark-but-low-contrast),\r
// 8-pixel direction clamp for long edges, and a luma-scaled \`dirReduce\`\r
// (average of the 4 corner lumas × 0.125, floored at 1/128) that damps\r
// the step on bright edges where the raw direction vector would dominate\r
// and guards axis-aligned edges from a divide-by-zero.\r
//\r
// Runs entirely in a single pass, no temporal history. Cost ≈ 0.3 ms at\r
// 1080p — dominated by the bilinear taps, which are fast on every GPU.\r
@fragment\r
fn fs_fxaa(v: Vout) -> @location(0) vec4<f32> {\r
  let rcpFrame = 1.0 / vec2<f32>(textureDimensions(tex, 0));\r
\r
  let rgbNW = textureSampleLevel(tex, samp, v.uv + vec2<f32>(-1.0, -1.0) * rcpFrame, 0.0).rgb;\r
  let rgbNE = textureSampleLevel(tex, samp, v.uv + vec2<f32>( 1.0, -1.0) * rcpFrame, 0.0).rgb;\r
  let rgbSW = textureSampleLevel(tex, samp, v.uv + vec2<f32>(-1.0,  1.0) * rcpFrame, 0.0).rgb;\r
  let rgbSE = textureSampleLevel(tex, samp, v.uv + vec2<f32>( 1.0,  1.0) * rcpFrame, 0.0).rgb;\r
  let rgbM  = textureSampleLevel(tex, samp, v.uv, 0.0).rgb;\r
\r
  let lumaNW = lumaOf(rgbNW);\r
  let lumaNE = lumaOf(rgbNE);\r
  let lumaSW = lumaOf(rgbSW);\r
  let lumaSE = lumaOf(rgbSE);\r
  let lumaM  = lumaOf(rgbM);\r
\r
  let lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));\r
  let lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));\r
  let range   = lumaMax - lumaMin;\r
\r
  // Skip flat regions — no perceivable edge here.\r
  if (range < max(0.0625, lumaMax * 0.125)) {\r
    return vec4<f32>(encodeOut(rgbM), 1.0);\r
  }\r
\r
  // Edge direction from 2×2 luma gradient. Perpendicular to the edge is\r
  // the axis along which we step for the blend.\r
  var dir = vec2<f32>(\r
    -((lumaNW + lumaNE) - (lumaSW + lumaSE)),\r
     ((lumaNW + lumaSW) - (lumaNE + lumaSE)),\r
  );\r
\r
  // Prevent axis-aligned edges from degenerating into a zero vector.\r
  let dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * 0.25 * 0.125, 1.0 / 128.0);\r
  let rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);\r
  dir = clamp(dir * rcpDirMin, vec2<f32>(-8.0), vec2<f32>(8.0)) * rcpFrame;\r
\r
  // Two pairs of samples along the edge: the first pair averages two taps\r
  // 1/6 of a pixel from center (fine AA), the second pair extends further\r
  // out for thicker edges. \`rgbB\` is the "wider" blend; we fall back to\r
  // \`rgbA\` (tighter) if the wide blend's luma falls outside the\r
  // neighbourhood range — guard against over-blur at corners.\r
  let rgbA = 0.5 * (\r
    textureSampleLevel(tex, samp, v.uv + dir * (1.0 / 3.0 - 0.5), 0.0).rgb +\r
    textureSampleLevel(tex, samp, v.uv + dir * (2.0 / 3.0 - 0.5), 0.0).rgb\r
  );\r
  let rgbB = rgbA * 0.5 + 0.25 * (\r
    textureSampleLevel(tex, samp, v.uv + dir * -0.5, 0.0).rgb +\r
    textureSampleLevel(tex, samp, v.uv + dir *  0.5, 0.0).rgb\r
  );\r
\r
  let lumaB = lumaOf(rgbB);\r
  let result = select(rgbA, rgbB, lumaB >= lumaMin && lumaB <= lumaMax);\r
  return vec4<f32>(encodeOut(result), 1.0);\r
}\r
`,yo=4,Yu=yo*4,yi=new Float32Array(yo);function Eo(t,e,n){const r=t.createTexture({label:"post-intermediate",size:[e,n,1],format:"rgba16float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT});return{texture:r,view:r.createView(),width:e,height:n}}function Po(t,e,n,r,i){return t.createBindGroup({label:"post-bind",layout:e,entries:[{binding:0,resource:{buffer:n}},{binding:1,resource:r},{binding:2,resource:i}]})}async function Zu(t,e,n){const{device:r,format:i}=t,a=r.createShaderModule({label:"post",code:Ku}),o=await a.getCompilationInfo();for(const v of o.messages){const P=`[WGSL ${v.type}] line ${v.lineNum}:${v.linePos}: ${v.message}`;v.type==="error"?console.error(P):v.type==="warning"?console.warn(P):console.info(P)}if(o.messages.some(v=>v.type==="error"))throw new Error("WGSL post-process shader compile failed — see console");const s=r.createBindGroupLayout({label:"post-bgl",entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}}]}),l=r.createPipelineLayout({bindGroupLayouts:[s]}),d=[{format:i}],c=(v,P)=>r.createRenderPipelineAsync({label:v,layout:l,vertex:{module:a,entryPoint:"vs"},fragment:{module:a,entryPoint:P,targets:d},primitive:{topology:"triangle-list"}}),[u,p]=await Promise.all([c("post-passthrough","fs_passthrough"),c("post-fxaa","fs_fxaa")]),w=r.createBuffer({label:"post-frame",size:Yu,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),f=r.createSampler({label:"post-linear",magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),h=Eo(r,e,n),E=Po(r,s,w,f,h.view);return{passthrough:u,fxaa:p,bindGroup:E,intermediate:h,postBuf:w,bgLayout:s,sampler:f}}function Ju(t,e,n,r){return e.intermediate.width===n&&e.intermediate.height===r?!1:(e.intermediate.texture.destroy(),e.intermediate=Eo(t,n,r),e.bindGroup=Po(t,e.bgLayout,e.postBuf,e.sampler,e.intermediate.view),!0)}function Qu(t,e,n){yi[0]=n?1:0,t.queue.writeBuffer(e.postBuf,0,yi)}function eh(t,e,n,r){const i=r==="fxaa"?e.fxaa:e.passthrough,a=n.beginRenderPass({label:"post-pass",colorAttachments:[{view:t.context.getCurrentTexture().createView(),loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1}}]});a.setPipeline(i),a.setBindGroup(0,e.bindGroup),a.draw(3,1,0,0),a.end()}const Bn="realrefraction:config",Fn=1,th=new Set(["pill","prism","cube","plate","diamond"]),nh=new Set(["exact","approx"]),rh=new Set(["ortho","perspective"]),ih=new Set([3,8,16,32,64]),ah=new Set(["none","fxaa","taa"]),oh=new Set(["photo","html"]);new Set(jn);function F(t){return typeof t=="number"&&Number.isFinite(t)}const sh=["pill","prism","cube","plate","diamond"];function lh(t){if(t===null||typeof t!="object"||Array.isArray(t))return{};const e=t,n={};for(const r of sh){const i=e[r];if(i===null||typeof i!="object")continue;const a=i;n.n_d===void 0&&F(a.n_d)&&(n.n_d=a.n_d),n.V_d===void 0&&F(a.V_d)&&(n.V_d=a.V_d),n.refractionStrength===void 0&&F(a.refractionStrength)&&(n.refractionStrength=a.refractionStrength)}return n}function dh(t){if(t===null||typeof t!="object")return{};const e=t,n={};typeof e.shape=="string"&&th.has(e.shape)&&(n.shape=e.shape),typeof e.refractionMode=="string"&&nh.has(e.refractionMode)&&(n.refractionMode=e.refractionMode),typeof e.projection=="string"&&rh.has(e.projection)&&(n.projection=e.projection),F(e.fov)&&(n.fov=Math.min(Math.max(e.fov,bo),go)),F(e.sampleCount)&&ih.has(e.sampleCount)&&(n.sampleCount=e.sampleCount),n.shapes=Su(e.shapes,e);const r=lh(e.shapes);return F(e.n_d)?n.n_d=be(e.n_d,vi,bi):F(r.n_d)&&(n.n_d=be(r.n_d,vi,bi)),F(e.V_d)?n.V_d=be(e.V_d,gi,_i):F(r.V_d)&&(n.V_d=be(r.V_d,gi,_i)),F(e.refractionStrength)?n.refractionStrength=be(e.refractionStrength,wi,xi):F(r.refractionStrength)&&(n.refractionStrength=be(r.refractionStrength,wi,xi)),typeof e.temporalJitter=="boolean"&&(n.temporalJitter=e.temporalJitter),typeof e.debugProxy=="boolean"&&(n.debugProxy=e.debugProxy),typeof e.smoothCurvature=="boolean"&&(n.smoothCurvature=e.smoothCurvature),typeof e.aaMode=="string"&&ah.has(e.aaMode)?n.aaMode=e.aaMode:typeof e.taa=="boolean"&&(n.aaMode=e.taa?"taa":"none"),typeof e.paused=="boolean"&&(n.paused=e.paused),F(e.historyAlpha)&&(n.historyAlpha=be(e.historyAlpha,_o,wo)),typeof e.envmapEnabled=="boolean"&&(n.envmapEnabled=e.envmapEnabled),F(e.envmapExposure)&&(n.envmapExposure=be(e.envmapExposure,ho,mo)),F(e.envmapRotation)&&(n.envmapRotation=be(e.envmapRotation,fo,vo)),typeof e.envmapSlug=="string"&&Qi(e.envmapSlug)&&(n.envmapSlug=e.envmapSlug),typeof e.envmapSize=="string"&&Zi.includes(e.envmapSize)&&(n.envmapSize=e.envmapSize),typeof e.bgSource=="string"&&oh.has(e.bgSource)&&(n.bgSource=e.bgSource),n}function be(t,e,n){return Math.min(Math.max(t,e),n)}function ch(t){if(!Array.isArray(t))return null;const e=[];for(const n of t){if(n===null||typeof n!="object")continue;const r=n;F(r.cx)&&F(r.cy)&&F(r.cz)&&F(r.hx)&&F(r.hy)&&F(r.hz)&&F(r.edgeR)&&e.push({cx:r.cx,cy:r.cy,cz:r.cz,hx:r.hx,hy:r.hy,hz:r.hz,edgeR:r.edgeR})}return e.length>0?e:null}function ph(){let t;try{t=localStorage.getItem(Bn)}catch(r){return console.warn("[persistence] localStorage unavailable:",r),null}if(!t)return null;let e;try{e=JSON.parse(t)}catch(r){console.warn("[persistence] stored config corrupt, resetting:",r);try{localStorage.removeItem(Bn)}catch{}return null}if(e===null||typeof e!="object")return null;const n=e;return n.version!==Fn?(console.info(`[persistence] schema mismatch (have ${String(n.version)}, want ${Fn}); using defaults`),null):{params:dh(n.params),pills:ch(n.pills)}}function uh(t,e){try{const n={version:Fn,params:t,pills:[...e]};localStorage.setItem(Bn,JSON.stringify(n))}catch(n){console.warn("[persistence] save failed:",n)}}function hh(t=250){let e=null,n=null;const r=()=>{e=null,n&&uh(n.params,n.pills)};return{schedule(i,a){n={params:i,pills:a},e!==null&&clearTimeout(e),e=setTimeout(r,t)},flush(){e!==null&&(clearTimeout(e),r())}}}const mh=30;function fh(){return{cpuMs:0,fps:0,gpuMs:0}}function vh(t){let e=null;const n=[];return()=>{const r=performance.now();if(e!==null){const i=r-e;t.cpuMs=i,n.push(i),n.length>mh&&n.shift();const a=n.reduce((o,s)=>o+s,0);t.fps=n.length>0?1e3*n.length/a:0}e=r}}const bh=-1,gh=540,_h=380,wh=320;function xh(t,e,n=Math.random){if(!t)return{wavelengthJitter:bh,heroLambda:gh};const r=Number.isFinite(e)&&e>=1?Math.floor(e):1;return{wavelengthJitter:n()/r,heroLambda:_h+n()*wh}}function yh(t){if(!(t instanceof HTMLElement))return!1;const e=t.tagName;return e==="INPUT"||e==="TEXTAREA"||e==="SELECT"||t.isContentEditable}const Pn={pill:0,prism:1,cube:2,plate:3,diamond:4},Eh={ortho:0,perspective:1};let mt=null,zn=!1;function Co(){mt!==null&&(window.clearTimeout(mt),mt=null)}function Gt(t){var n;zn=!0,Co();const e=document.getElementById("fallback");e&&(e.textContent=t,e.classList.add("visible")),(n=document.getElementById("gpu"))==null||n.setAttribute("style","display:none")}function Te(t,e=3e3){if(zn)return;const n=document.getElementById("fallback");n&&(Co(),n.textContent=t,n.classList.add("visible"),mt=window.setTimeout(()=>{mt=null,zn||n.classList.remove("visible")},e))}async function Ph(){const t=await Mo("gpu",Gt);if("kind"in t){Gt({"no-webgpu":"This demo needs a WebGPU-capable browser (Chrome/Edge 120+ or Safari 18+).","no-adapter":"No GPU adapter available. Try reloading or updating your GPU driver.","no-context":"Failed to create a WebGPU canvas context."}[t.kind]);return}const e=t,n=Vs(e.device);let r=Date.now();const i=await Or(e.device,r);let a=i.photo,o=Ws(e.device);const s=ht(e.canvas,e.dpr);let l=xo(e.device,s.width,s.height);const d=await ys(e,n,a,o,l),c=await Zu(e,s.width,s.height),u=ph(),p=qu(Gu(),(u==null?void 0:u.params)??{}),w=document.getElementById("html-bg-root"),f=document.getElementById("html-bg-foreground"),h=document.getElementById("html-bg-photo"),E=Rs(e.device)&&w instanceof HTMLElement&&Is(e.canvas,w);!E&&p.bgSource==="html"&&(p.bgSource="photo");let v=null;const P=()=>E&&p.bgSource==="html"&&v?v:a;let x=u!=null&&u.pills&&u.pills.length>0?u.pills.map(S=>({...S})):Xt(s.width,s.height);const W=x.length,j=$t(p.shape);x=Hr(Zs(x,s.width,s.height,j),s.width,s.height,j);let _=2;const I=()=>{_=2},re=()=>Js(e.canvas,x,e.dpr,()=>Pn[p.shape],()=>p.shape==="plate"?p.shapes.plate.waveAmp:0,I);let H=re();const oe=S=>{H();const L=ht(e.canvas,e.dpr);x=Hr(x,L.width,L.height,S),H=re(),I()},G=hh(250),J=()=>G.schedule(p,x);x.length!==W&&G.schedule(p,x);let qe=0;const Ne=()=>{if(!E||!(h instanceof HTMLImageElement)||!(w instanceof HTMLElement))return;const S=++qe,L=Vi(r),N=()=>{var b,V;(V=(b=e.canvas).requestPaint)==null||V.call(b),queueMicrotask(()=>{var D,Vt;(Vt=(D=e.canvas).requestPaint)==null||Vt.call(D)})};h.onload=()=>{S===qe&&(w.classList.remove("html-bg--gradient-fallback"),h.removeAttribute("hidden"),N())},h.onerror=b=>{S===qe&&(console.error("[html-bg] underlay image failed to load:",L,b),h.setAttribute("hidden",""),w.classList.add("html-bg--gradient-fallback"),Te("HTML background image failed — underlay uses gradient (GPU photo unchanged)."),N())},h.removeAttribute("hidden"),h.src=L};let Oe=0;const le=async()=>{const S=++Oe;try{const L=Date.now(),{photo:N,usedGradientFallback:b}=await Or(e.device,L);if(S!==Oe){console.info("[photo] reload superseded by newer request, discarding rev",S),ln(N);return}if(b){ln(N),Te("Picsum photo fetch failed — previous image kept.");return}const V=a;a=N,r=L,Ne(),lt(e,d,n,P(),o,l),I(),e.device.queue.onSubmittedWorkDone().then(()=>ln(V)).catch(D=>console.error("[photo] queue drain failed, skipping destroy:",D))}catch(L){console.error("[photo] reload failed:",L),Te(`Photo reload failed: ${L instanceof Error?L.message:String(L)}`)}};let It=0,Nt=!1;const Pe=async(S,L=!1)=>{const N=++It;try{const b=await Hs(e.device,Xs(S,p.envmapSize));if(N!==It){zr(b);return}const V=o;o=b,Nt=!0,p.envmapSlug=S,lt(e,d,n,P(),o,l),I(),J(),e.device.queue.onSubmittedWorkDone().then(()=>zr(V)).catch(D=>console.error("[envmap] queue drain failed, skipping destroy:",D))}catch(b){console.error("[envmap] reload failed:",b);const V=b instanceof Error?b.message:String(b);L?Te(`Envmap fetch failed — using fallback gradient. ${V}`,12e3):Te(`Envmap fetch failed: ${V}`)}},Ce=fh(),y=vh(Ce);let q=null;const de=()=>{const S=Ks(p.envmapSlug);p.envmapSlug=S,Pe(S),q==null||q.refresh()},$=ju(p,()=>{le()},J,I,{stats:Ce,hasGpuTiming:e.hasTimestamp},S=>{Pe(S)},de,()=>{Nt||Pe(p.envmapSlug)},E?{}:null,oe);if(q=$,E){e.canvas.layoutSubtree=!0;let S=0;const L=3,N=()=>{if(p.bgSource!=="html"||!v||!(w instanceof HTMLElement))return;if(Os(e.device.queue,w,v.texture)){S=0;return}S+=1,S>=L&&p.bgSource==="html"&&(p.bgSource="photo",q==null||q.refresh(),I(),J(),Te("HTML background sync failed — falling back to Picsum.",6e3))};e.canvas.addEventListener("paint",N),f instanceof HTMLElement&&f.addEventListener("input",()=>{var b,V;(V=(b=e.canvas).requestPaint)==null||V.call(b)}),new ResizeObserver(()=>{var b,V;p.bgSource==="html"&&((V=(b=e.canvas).requestPaint)==null||V.call(b))}).observe(e.canvas,{box:"device-pixel-content-box"}),i.usedGradientFallback?(w instanceof HTMLElement&&h instanceof HTMLImageElement&&(w.classList.add("html-bg--gradient-fallback"),h.setAttribute("hidden","")),Te("Picsum photo fetch failed — background uses gradient until reload.",6e3)):Ne()}else i.usedGradientFallback&&Te("Picsum photo fetch failed — using gradient background.",6e3);const fe=Qi(p.envmapSlug)?p.envmapSlug:Yi;p.envmapEnabled?Pe(fe,!0):p.envmapSlug=fe;const Ot=()=>G.flush();window.addEventListener("pagehide",Ot),window.addEventListener("beforeunload",Ot),document.addEventListener("visibilitychange",()=>{document.hidden&&G.flush()});const ce=()=>J();e.canvas.addEventListener("pointerup",ce),e.canvas.addEventListener("pointercancel",ce);let $e=!1;const So=S=>{var N;if(yh(S.target))return;const L=S.key.toLowerCase();if(L==="z"&&!$e&&($e=!0,I()),S.key===" "){S.preventDefault(),H();const b=ht(e.canvas,e.dpr);x=Xt(b.width,b.height).slice(0,$t(p.shape)).map(V=>({...V,cx:Math.random()*b.width,cy:Math.random()*b.height})),H=re(),I(),J()}if(L==="r"&&!p.envmapEnabled&&le(),L==="h"){const b=document.querySelectorAll(".tp-dfwv"),V=((N=b[0])==null?void 0:N.style.display)==="none";b.forEach(D=>{D.style.display=V?"":"none"})}if(p.shape==="diamond"&&(L==="t"||L==="s"||L==="b"||L==="f")){const b=L==="t"?"top":L==="s"?"side":L==="b"?"bottom":"free";p.shapes.diamond.diamondView!==b&&(p.shapes.diamond.diamondView=b,$.refresh(),I(),J())}},Ao=S=>{S.key.toLowerCase()==="z"&&$e&&($e=!1,I())};window.addEventListener("keydown",So),window.addEventListener("keyup",Ao);const Pr=Vo(e.format);Qu(e.device,c,Pr);const Cr=performance.now();let Sr=Cr,Mt=0,Ar=0,an=1;const Se=e.hasTimestamp?Fs(e.device):null,Lr=Se!==null&&new URLSearchParams(location.search).has("perf"),at={samples:[],lastMs:0};window._perf=Lr?at:void 0;const kr=()=>{var S,L;try{y();const{width:N,height:b}=ht(e.canvas,e.dpr),V=Xu(e.device,l,N,b);if(V!==l&&(l=V,lt(e,d,n,P(),o,l),I()),Ju(e.device,c,N,b),E){if(p.bgSource==="html"){if(!v||v.width!==N||v.height!==b){if(v){const T=v;e.device.queue.onSubmittedWorkDone().then(()=>Vr(T)).catch(pe=>console.error("[html-bg] queue drain failed, skipping destroy:",pe)),v=null}v=Ns(e.device,N,b),lt(e,d,n,P(),o,l),I(),(L=(S=e.canvas).requestPaint)==null||L.call(S),queueMicrotask(()=>{var T,pe;(pe=(T=e.canvas).requestPaint)==null||pe.call(T)})}}else if(v){const T=v;v=null,e.device.queue.onSubmittedWorkDone().then(()=>Vr(T)).catch(pe=>console.error("[html-bg] queue drain failed, skipping destroy:",pe)),lt(e,d,n,a,o,l)}}const D=yu(p),Vt=p.shape==="plate",Lo=p.shape==="prism",ko=p.shape==="diamond";for(const T of x)if(ko){const pe=D.diamondSize/2;T.hx=pe,T.hy=pe,T.hz=pe,T.edgeR=0}else T.hx=D.pillLen/2,T.hy=Vt?T.hx:D.pillShort/2,T.hz=D.pillThick/2,T.edgeR=Lo?0:p.shape==="pill"?D.edgeR:Math.min(D.edgeR,T.hx,T.hy,T.hz);!p.paused||_>0?an=1:an+=1;const To=p.paused?Math.max(1/an,1/256):p.historyAlpha,Do=_>0?1:To;_>0&&(_-=1);const on=performance.now(),Ro=(on-Cr)*.001%1e4,Io=(on-Sr)*.001;Sr=on,p.paused||(Mt=(Mt+Io)%1e4);const Tr=$e?3:p.sampleCount,No=p.temporalJitter&&!$e,Dr=xh(No,Tr),Oo=$u(p.fov,b);Bs(e.device,n,{resolution:[N,b],photoSize:[P().width,P().height],n_d:D.n_d,V_d:D.V_d,sampleCount:Tr,refractionStrength:D.refractionStrength,jitter:Dr.wavelengthJitter,refractionMode:p.refractionMode==="exact"?0:1,applySrgbOetf:Pr,shape:Pn[p.shape],time:Ro,historyBlend:Do,heroLambda:Dr.heroLambda,cameraZ:Oo,projection:Eh[p.projection],debugProxy:p.debugProxy,smoothCurvature:p.smoothCurvature,taaEnabled:p.aaMode==="taa",sceneTime:Mt,prevSceneTime:Ar,waveAmp:D.waveAmp,waveFreq:2*Math.PI/Math.max(D.waveWavelength,1),diamondSize:D.diamondSize,diamondWireframe:D.diamondWireframe,diamondFacetColor:D.diamondFacetColor,diamondTirDebug:D.diamondTirDebug,diamondTirMaxBounces:D.diamondTirMaxBounces,diamondView:D.diamondView,envmapEnabled:p.envmapEnabled,envmapExposure:p.envmapExposure,envmapRotation:p.envmapRotation,pills:x});const Bt=e.device.createCommandEncoder({label:"frame"});Es(d,l,c.intermediate,x.length,Pn[p.shape],Bt,Se==null?void 0:Se.writes),eh(e,c,Bt,p.aaMode),Se&&Se.resolve(Bt),e.device.queue.submit([Bt.finish()]),l.current=l.current===0?1:0,Ar=Mt,Se&&Se.readMs().then(T=>{T===null||!Number.isFinite(T)||(Ce.gpuMs=T,Lr&&(at.lastMs=T,at.samples.push(T),at.samples.length>240&&at.samples.shift()))}).catch(T=>{console.warn("[perf] readMs failed (likely GPU device lost):",T),Ce.gpuMs=NaN})}catch(N){console.error("[frame] render loop aborted:",N),Gt(`Render loop stopped: ${N instanceof Error?N.message:String(N)}. Please reload the page.`);return}requestAnimationFrame(kr)};requestAnimationFrame(kr)}Ph().catch(t=>{console.error(t),Gt(`Couldn't start the demo: ${t instanceof Error?t.message:String(t)}. See the browser console for details.`)});
