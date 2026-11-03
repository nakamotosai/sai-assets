// tidal-caustics.js — Tidal Caustics · 潮汐焦散(bg-fx)
// idea: refracted light through slow-moving water projected on a deep seabed
//
// 机制(只做这一件事,不是“平均色背景”):
// - 5 次迭代的折射焦散(屈光度迭代),得到细亮脉络而非光斑
// - 簇集掩码把亮脉络聚成簇、其余压成暗静水
// - 第二组焦散偏移跟随光标,制造水面深度差
// - light theme:亮点是唯一发射体,底为深海底
//
// 依赖:./common.js 的 GLSL 前奏 + ../../src/engine.js 的四段后处理链。
// 场景片元输出线性 HDR(可 > 1.0),bloom/色差/颗粒/暗角/ACES/抖动都在引擎里,别在这里做。
import { COMMON } from "./common.js";

const FRAG = COMMON + `
#define TAU 6.2831853
float caustic(vec2 p, float t){
  vec2 i = p; float c = 1.0; float inten = 0.005;
  for(int n=0;n<5;n++){
    float tt = t*(1.0 - (3.5/float(n+1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0/length(vec2(p.x/(sin(i.x+tt)/inten), p.y/(cos(i.y+tt)/inten)));
  }
  c /= 5.0; c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 6.5);                                 // thin bright veins
}
void main(){
  vec2 uv=vUv;
  vec2 p = mod(uv * vec2(uRes.x/uRes.y,1.0) * TAU, TAU) - 250.0;
  float t = uTime*0.4;
  float c = caustic(p, t);
  vec2 m = (uMouse-0.5)*vec2(uRes.x/uRes.y,1.0)*3.0;
  c += caustic(p - m*0.5, t*1.2)*0.5;
  float clus = smoothstep(0.18,0.92, fbm3(uv*1.6 - t*0.15));   // cluster & thin to dark calms
  c *= 0.48 + 0.75*clus;
  c *= mix(0.22,1.0,textZone(uv));                             // luminance hierarchy: dim behind text
  vec3 deep  = lin(vec3(0.014,0.055,0.100));               // deep seabed
  vec3 water = lin(vec3(0.30,0.62,0.80));
  vec3 col = omix(deep, water, clamp(c*1.6,0.0,1.0)*0.40);
  col += lin(vec3(0.92,1.0,1.0)) * smoothstep(0.10, 1.0, c) * 1.15;   // crests are the sole emissive
  col *= 1.0 - 0.42*length((uv-0.5)*vec2(uRes.x/uRes.y,1.0));
  fragColor=vec4(col,1.0);
}`;

export const CONCEPT = {
  id: "tidal-caustics",
  name: "Tidal Caustics",
  name_cn: "潮汐焦散",
  theme: "light",
  accent: "aqua",
  idea: "refracted light through slow-moving water projected on a deep seabed",
  frag: FRAG,
};
