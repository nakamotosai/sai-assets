// common.js — 十个背景共用的 GLSL 前奏(只此一份)。
// 提供:uniform 约定(uTime/uRes/uMouse/uScroll/uSeed)、hash/noise/fbm/fbm3、
// lin()/srgb()/omix() 色彩空间助手、sdBox、textZone() 标题安全区、curl() 无散度流场。
// 每个 effect 的 concept 文件 = 本前奏 + 自己的 main();片元一律输出线性 HDR。
export const COMMON = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform float uTime, uScroll, uSeed;
uniform vec2 uRes, uMouse;
#define PI 3.14159265359
float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.02; a*=0.5; } return s; }
float fbm3(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<3;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5; } return s; }
vec3 lin(vec3 c){ return pow(max(c,0.0), vec3(2.2)); }   // author display sRGB -> linear working space
vec3 srgb(vec3 c){ return pow(max(c,0.0), vec3(1.0/2.2)); }
vec3 omix(vec3 a, vec3 b, float t){ vec3 A=pow(max(a,0.0),vec3(1.0/3.0)), B=pow(max(b,0.0),vec3(1.0/3.0)); return pow(mix(A,B,t), vec3(3.0)); }
float sdBox(vec2 p, vec2 b){ vec2 d=abs(p)-b; return length(max(d,0.0))+min(max(d.x,d.y),0.0); }
// headline-safe mask: ~0 inside the upper-left title block, 1 outside (luminance hierarchy)
float textZone(vec2 uv){ vec2 d=(uv-vec2(0.28,0.84))/vec2(0.36,0.18); return smoothstep(0.55,1.55,length(d)); }
// curl of an fbm field -> divergence-free flow (physical, not linear)
vec2 curl(vec2 p, float t){
  float e=0.10;
  float n1=fbm(p+vec2(0.0,e)+vec2(0.0,t));
  float n2=fbm(p-vec2(0.0,e)+vec2(0.0,t));
  float n3=fbm(p+vec2(e,0.0)+vec2(0.0,t));
  float n4=fbm(p-vec2(e,0.0)+vec2(0.0,t));
  return vec2(n1-n2, n4-n3)/(2.0*e);
}
`;
