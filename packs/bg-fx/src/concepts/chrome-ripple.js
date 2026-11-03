// chrome-ripple.js — Chrome Ripple · 铬面涟漪(bg-fx)
// idea: a brushed metal plane rippled by concentric waves from the cursor
//
// 机制(只做这一件事,不是“平均色背景”):
// - 波纹半径被表面 fbm 扭曲 → 不是同心靶环
// - 拉丝金属 = 各向异性镜面条纹(fwidth 抗锯齿),不是全屏条纹遮罩
// - 大尺度 sheen 扫过拉丝纹 → 卖“金属”而不是“烟”
// - 三档金属 ramp(dark→steel→blue)+ 白高光沿切线拉长
//
// 依赖:./common.js 的 GLSL 前奏 + ../../src/engine.js 的四段后处理链。
// 场景片元输出线性 HDR(可 > 1.0),bloom/色差/颗粒/暗角/ACES/抖动都在引擎里,别在这里做。
import { COMMON } from "./common.js";

const FRAG = COMMON + `
void main(){
  vec2 uv=vUv; vec2 p=(uv-0.5)*vec2(uRes.x/uRes.y,1.0);
  vec2 m=(uMouse-0.5)*vec2(uRes.x/uRes.y,1.0);
  float t=uTime;
  // ripple radius warped by the surface so the waves never read as concentric bullseye rings
  float r=length(p-m);
  float rw = r + (fbm3(p*3.0 + t*0.2)-0.5)*0.55 + (fbm3(p*7.0)-0.5)*0.18;
  float ripple=sin(rw*19.0 - t*1.9)*exp(-r*1.15)*0.7;
  float wave = fbm3(p*2.0 + ripple*0.6);
  float slow = fbm3(p*0.8 - t*0.03);                        // second layer: broad sheen drift
  float n = 0.42 + wave*0.58 + ripple*0.48 + (slow-0.5)*0.30;   // smooth base form (no stripes here)
  float g = length(vec2(dFdx(n), dFdy(n)));
  // brushed metal = anisotropic specular streaks only, NOT a full-frame stripe mask
  float bx = p.x*70.0;
  float bw = fwidth(bx)*1.5;
  float brush = (vnoise(vec2(bx, p.y*2.0))-0.5) * exp(-bw*bw*0.5);
  float streak = pow(smoothstep(0.0,0.30,g), 1.2) * (0.55 + 0.85*brush);   // streaks ride the crests
  // broad directional sheen sweeping across the brushed grain -> sells "metal" over "smoke"
  float sheen = vnoise(vec2(p.x*7.0 - t*0.25, p.y*1.1)) ;
  float metal = pow(clamp(sheen*0.7 + 0.5*brush, 0.0, 1.4), 1.6);
  vec3 dark =lin(vec3(0.055,0.070,0.100));
  vec3 steel=lin(vec3(0.48,0.53,0.62));
  vec3 blue =lin(vec3(0.30,0.50,0.92));
  vec3 white=lin(vec3(1.0,0.99,0.96));
  vec3 col=dark;
  col=omix(col,steel,smoothstep(0.42,0.80,n));              // 3-stop metal ramp
  col=omix(col,blue, smoothstep(0.66,0.96,n)*0.65);
  col=mix(col, steel*1.05+white*0.06*metal, smoothstep(0.5,1.2,metal)*0.45);   // brushed sheen bands
  col += white*clamp(streak,0.0,1.6)*0.55;                  // speculars streak along the brush tangent
  col *= mix(0.28,1.0,textZone(uv));
  col *= 1.0 - 0.38*length(p);
  fragColor=vec4(col,1.0);
}`;

export const CONCEPT = {
  id: "chrome-ripple",
  name: "Chrome Ripple",
  name_cn: "铬面涟漪",
  theme: "dark",
  accent: "cold-white",
  idea: "a brushed metal plane rippled by concentric waves from the cursor",
  frag: FRAG,
};
