// ember-field.js — Ember Field · 余烬之野(bg-fx)
// idea: slow convective embers rising through heat shimmer
//
// 机制(只做这一件事,不是“平均色背景”):
// - 三层深度带并行(远小/暗/慢/糊,近大/亮/快/锐)→ 视差
// - 泪滴形粒子:中段肥、两端尖;每颗粒子独立长度与亮度
// - 上升流 + fract 包裹 + 域扭曲的热扰流
// - 远处用解析软核、近处用硬核,避免统一贴图感
//
// 依赖:./common.js 的 GLSL 前奏 + ../../src/engine.js 的四段后处理链。
// 场景片元输出线性 HDR(可 > 1.0),bloom/色差/颗粒/暗角/ACES/抖动都在引擎里,别在这里做。
import { COMMON } from "./common.js";

const FRAG = COMMON + `
float ember(vec2 uv, float seed, float t, float scale, float soft){
  vec2 w = vec2(fbm3(uv*3.0 + seed), fbm3(uv*3.0 + seed + 7.0)) - 0.5;
  vec2 uvp = uv + w*0.22;
  uvp.y = fract(uvp.y + t*0.055*(0.6+seed*0.2));           // rise + wrap
  vec2 sc = vec2(13.0, 9.0) * scale;
  vec2 cell = floor(uvp*sc);
  float r = hash(cell + seed*13.0);
  vec2 c = (cell + 0.15 + 0.70*vec2(hash(cell+seed), hash(cell+seed+7.7))) / sc;
  vec2 dv = (uvp - c) * sc;                                // local units (cell = 1)
  float ang = (hash(cell+seed+9.9)-0.5)*0.6;
  dv = mat2(cos(ang),-sin(ang),sin(ang),cos(ang)) * dv;
  float L = 0.32 + 0.55*hash(cell+seed+3.3);               // half-length (elongated)
  float W = 0.045 + 0.055*hash(cell+seed+4.4);             // half-width (thin)
  float ly = clamp(dv.y/L, -1.0, 1.0);
  float taper = pow(max(1.0-abs(ly), 0.0), 0.65);          // teardrop: fat middle, pointed tips
  float d = length(vec2(dv.x/(W*taper+1e-4), dv.y/L));
  float shape = mix(smoothstep(1.0,0.0,d), exp(-d*d*1.5), soft);   // soft=1 -> blurred far band
  float life = smoothstep(0.0,0.12,uvp.y)*smoothstep(1.0,0.5,uvp.y);
  return shape * step(0.5, r) * life;
}
void main(){
  vec2 uv = vUv; float t = uTime;
  // three depth bands -> parallax: far small/dim/slow/blurred, near large/bright/fast/sharp
  float e  = 0.32*ember(uv+ 0.0, 1.0, t*0.45, 0.55, 1.00);
  e += 0.60*ember(uv+17.3, 3.7, t*0.80, 1.00, 0.50);
  e += 1.00*ember(uv+31.1, 7.1, t*1.25, 1.70, 0.15);
  e = min(e, 1.0);
  vec2 m = uMouse-0.5;
  e *= 1.0 + 0.5*exp(-length((uv-0.5)-m)*3.0);
  e *= mix(0.20, 1.0, textZone(uv));                       // keep the headline zone dark
  vec3 dark = lin(vec3(0.024,0.016,0.024));
  vec3 amber = lin(vec3(1.0,0.42,0.10)) * 2.4;
  vec3 gold  = lin(vec3(1.0,0.86,0.42)) * 1.7;
  vec3 col = dark + lin(vec3(0.06,0.030,0.040))*fbm3(uv*2.0+t*0.05);
  col += amber * e * 0.70;
  col += gold * pow(e, 3.0) * 0.50;
  fragColor = vec4(col, 1.0);
}`;

export const CONCEPT = {
  id: "ember-field",
  name: "Ember Field",
  name_cn: "余烬之野",
  theme: "dark",
  accent: "ember-orange",
  idea: "slow convective embers rising through heat shimmer",
  frag: FRAG,
};
