// gilded-topography.js — Gilded Topography · 鎏金地形(bg-fx)
// idea: a contour map of gold light drawn on graphite, redrawn by the cursor
//
// 机制(只做这一件事,不是“平均色背景”):
// - 标量场 + 域扭曲让等高线间距呼吸
// - dFdx/dFdy 取坡度 → 线宽随陡度变(陡处粗、缓处细)
// - 指数等高线(每 3.2 条一根)与 sheen 提亮,金属双色 skirt→gold
// - 低频谱 mask 把线限制在约 40% 画面,留出留白
//
// 依赖:./common.js 的 GLSL 前奏 + ../../src/engine.js 的四段后处理链。
// 场景片元输出线性 HDR(可 > 1.0),bloom/色差/颗粒/暗角/ACES/抖动都在引擎里,别在这里做。
import { COMMON } from "./common.js";

const FRAG = COMMON + `
float field(vec2 p, float t){ return fbm(p*1.8 + vec2(0.0, t*0.03)) + 0.15*sin(p.x*3.0 + t*0.2); }
void main(){
  vec2 uv=vUv; vec2 p=(uv-0.5)*vec2(uRes.x/uRes.y,1.0);
  float t=uTime; vec2 m=(uMouse-0.5)*vec2(uRes.x/uRes.y,1.0);
  vec2 pw = p + (vec2(fbm3(p*2.0+t*0.02), fbm3(p*2.0+5.0-t*0.02))-0.5)*0.38;   // second warp: spacing breathes
  float f = field(pw*0.6, t);
  f += 0.5*exp(-length(p-m)*6.0);                        // cursor raises a hill
  float mask = smoothstep(0.26,0.72, fbm3(p*0.9 - t*0.01));   // restraint: lines on ~40% of frame
  float lines = abs(fract(f*16.0)-0.5);
  float g = length(vec2(dFdx(f), dFdy(f)));
  float w = mix(0.006, 0.020, smoothstep(0.5,3.0,g));    // line weight by steepness
  w *= 0.55 + 0.9*fbm3(pw*3.0);                          // width modulates along the line (taper/thicken)
  float contour = 1.0-smoothstep(0.0,w,lines);
  float idxLine = 1.0-smoothstep(0.0,0.030,abs(fract(f*3.2)-0.5));
  float sheen = pow(1.0-abs(fract(f*16.0)-0.5)*2.0, 6.0);
  float safe = mix(0.18,1.0,textZone(uv));
  vec3 graphite=lin(vec3(0.050,0.053,0.060));
  vec3 skirt=lin(vec3(0.62,0.40,0.10));                  // deep amber in the shadow of each ridge
  vec3 gold=lin(vec3(0.86,0.68,0.34));
  vec3 hot =lin(vec3(1.0,0.91,0.66));                    // near-white ridge core
  vec3 lineCol = mix(skirt, gold, smoothstep(0.0,0.5,sheen));   // two-tone lit metal
  vec3 col=graphite;
  col += lineCol*contour*0.34*mask*safe;
  col += gold*idxLine*0.40*mask*safe;
  col += hot*sheen*0.30*mask*safe;
  col *= 0.82+0.30*exp(-length(p)*0.9);
  fragColor=vec4(col,1.0);
}`;

export const CONCEPT = {
  id: "gilded-topography",
  name: "Gilded Topography",
  name_cn: "鎏金地形",
  theme: "dark",
  accent: "gold",
  idea: "a contour map of gold light drawn on graphite, redrawn by the cursor",
  frag: FRAG,
};
