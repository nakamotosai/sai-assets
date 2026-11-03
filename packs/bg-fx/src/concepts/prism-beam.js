// prism-beam.js — Prism Beam · 棱镜光束(bg-fx)
// idea: a beam of white light bent through a prism into a slow fan of spectral bands
//
// 机制(只做这一件事,不是“平均色背景”):
// - 棱镜扇:锥形 fan × 按角度索引的波长 ramp(紫→红) = 真实色散
// - 未偏折核心保持白光,扇内光栅条纹给“光”的质感
// - 束内稀疏尘点(只在束内生成,不是全屏星场)
// - 光标操纵棱镜位置
//
// 依赖:./common.js 的 GLSL 前奏 + ../../src/engine.js 的四段后处理链。
// 场景片元输出线性 HDR(可 > 1.0),bloom/色差/颗粒/暗角/ACES/抖动都在引擎里,别在这里做。
import { COMMON } from "./common.js";

const FRAG = COMMON + `
void main(){
  vec2 uv=vUv; vec2 p=(uv-0.5)*vec2(uRes.x/uRes.y,1.0);
  float t=uTime*0.15;
  vec2 m=(uMouse-0.5)*vec2(uRes.x/uRes.y,1.0);
  vec2 apex = vec2(-0.12+0.05*sin(t), 0.06+0.04*cos(t*0.8));
  apex = mix(apex, m*0.5, 0.25);                           // cursor steers the prism
  vec2 rel = p-apex;
  float ang = atan(rel.y, rel.x);
  float rad = length(rel);
  float fan = smoothstep(0.62, 0.03, abs(ang-0.10));       // refracted beam cone to the right
  // true dispersion: wavelength ramp indexed on fan angle (violet -> red), white on the undeviated core
  float wl = clamp((ang+0.42)/0.76, 0.0, 1.0);
  vec3 ramp = mix(lin(vec3(0.45,0.20,0.95)), lin(vec3(0.20,0.35,1.0)), smoothstep(0.0,0.18,wl));
  ramp = mix(ramp, lin(vec3(0.20,0.85,0.95)), smoothstep(0.16,0.36,wl));
  ramp = mix(ramp, lin(vec3(0.35,0.95,0.45)), smoothstep(0.34,0.54,wl));
  ramp = mix(ramp, lin(vec3(1.0,0.92,0.30)), smoothstep(0.52,0.72,wl));
  ramp = mix(ramp, lin(vec3(1.0,0.45,0.18)), smoothstep(0.70,1.0,wl));
  float core = smoothstep(0.16,0.0, abs(ang-0.10));        // undeviated white core
  vec3 spec = mix(ramp, lin(vec3(1.0,1.0,1.0)), core);
  float band = 0.5+0.5*sin(wl*18.0 - t*1.2 + fbm3(p*3.0)*3.0);
  float rays = pow(band, 2.4);
  float inten = fan*rays*(0.55+0.45*exp(-rad*0.6));
  float motes = 0.0;                                       // sparse motes IN the beam (not a field)
  for(int i=0;i<2;i++){
    float fi=float(i);
    vec2 gp = p*(5.0+fi*4.0)+vec2(-t*0.4*(1.0+fi),0.0);
    vec2 cell=floor(gp); vec2 f=fract(gp)-0.5;
    motes += smoothstep(0.06,0.0,length(f))*step(0.93, hash(cell+fi));
  }
  float safe = mix(0.20,1.0,textZone(uv));
  vec3 col = lin(vec3(0.035,0.030,0.055));
  col += lin(vec3(0.10,0.08,0.16))*fbm3(p*1.5-t*0.05)*0.60;
  col += spec*inten*2.0*safe;
  col += lin(vec3(1.0,0.95,0.85))*motes*0.40*safe;
  col += lin(vec3(1.0,1.0,1.0))*fan*exp(-rad*3.0)*0.55*safe;
  fragColor=vec4(col,1.0);
}`;

export const CONCEPT = {
  id: "prism-beam",
  name: "Prism Beam",
  name_cn: "棱镜光束",
  theme: "dark",
  accent: "spectral",
  idea: "a beam of white light bent through a prism into a slow fan of spectral bands",
  frag: FRAG,
};
