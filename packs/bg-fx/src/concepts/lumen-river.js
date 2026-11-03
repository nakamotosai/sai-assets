// lumen-river.js — Lumen River · 流光之河(bg-fx)
// idea: domain-warped emissive ink drifting through a navy void, stirred by the cursor
//
// 机制(只做这一件事,不是“平均色背景”):
// - 域扭曲 (domain warp ×2) 的发光墨流 + curl 无散度漂移 → 卷须而非糊烟
// - 显式侧向掩码把发光质量锁在右侧 2/3,光标只“搅动”不改变构图
// - 第二层慢速密度 + 5 阶细丝(filament)做深浅层次
// - 色阶:navy 底 → 冰蓝墨 → 过曝发射体(给 bloom 吃)
//
// 依赖:./common.js 的 GLSL 前奏 + ../../src/engine.js 的四段后处理链。
// 场景片元输出线性 HDR(可 > 1.0),bloom/色差/颗粒/暗角/ACES/抖动都在引擎里,别在这里做。
import { COMMON } from "./common.js";

const FRAG = COMMON + `
vec2 warp2(vec2 p, float t){
  float w1 = fbm(p*1.15 + vec2(0.0, -t*0.05));
  float w2 = fbm(p*1.15 + vec2(4.7, -t*0.045) + w1*1.3);
  return p + vec2(w2-0.5, w1-0.5)*1.7;
}
void main(){
  vec2 uv=vUv; vec2 p=(uv-0.5)*vec2(uRes.x/uRes.y,1.0);
  vec2 m=(uMouse-0.5)*vec2(uRes.x/uRes.y,1.0);
  float t=uTime;
  // 发光质量固定在右 2/3（标题/正文在左），用显式空间掩码而非噪声偏移来定位
  float side = smoothstep(-0.42, 0.52, p.x + (fbm3(p*1.6 + t*0.03)-0.5)*0.55);
  vec2 cf = curl(p*0.9, t*0.10);                   // divergence-free flow (physical drift)
  vec2 flow = p - vec2(0.40,-0.16);                // 采样核右移，强化右侧
  flow += cf * 0.55;                               // stronger warp -> tendrils, not smeared smoke
  flow += (m-p)*0.24*exp(-length(p-m)*1.5);        // cursor stirs the ink
  vec2 q = warp2(flow*2.0, t);
  float band = fbm(q*1.05 + vec2(t*0.045,-t*0.08));
  float slow = fbm3(p*0.65 - t*0.02);              // second, slower density layer
  band += (slow-0.5)*0.38;
  float vel = length(cf);                          // velocity-modulated high-freq detail -> vortices
  float detail = fbm(q*9.0 + t*0.15) * (0.5 + 1.6*vel);
  float river = smoothstep(0.32,0.74,band)*(0.5+0.5*fbm(q*3.2-t*0.1));
  float fil   = smoothstep(0.38,0.74, fbm(q*5.0 + t*0.06) + detail*0.5);   // 5-octave filaments
  river *= 0.70+0.60*fil;
  float core = pow(smoothstep(0.54,0.92,band),1.7);
  float safe = mix(0.26,1.0,textZone(uv));
  vec3 navy=lin(vec3(0.020,0.032,0.075));
  vec3 deep=lin(vec3(0.06,0.15,0.34));
  vec3 ink =lin(vec3(0.22,0.48,0.82));
  vec3 emis=lin(vec3(0.55,0.90,1.0))*2.2;
  vec3 col=navy + deep*fbm3(p*2.0)*0.45;
  col=omix(col,ink,river*0.92*mix(0.40,1.0,side)*safe);       // 左侧留淡墨，不空
  col=omix(col,emis,core*0.95*side*safe);                     // 高光只在右侧
  col+=emis*core*0.70*side*safe;
  fragColor=vec4(col,1.0);
}`;

export const CONCEPT = {
  id: "lumen-river",
  name: "Lumen River",
  name_cn: "流光之河",
  theme: "dark",
  accent: "ice-blue",
  idea: "domain-warped emissive ink drifting through a navy void, stirred by the cursor",
  frag: FRAG,
};
