// magnetic-filings.js — Magnetic Filings · 铁屑磁力线(bg-fx)
// idea: iron filings aligning to two moving attractors
//
// 机制(只做这一件事,不是“平均色背景”):
// - 双极偶极场:两个吸引子在极角上加权混合 → 中间出现鞍线
// - |B| 决定每根铁屑的长短与亮度:极区密长、零点只剩短桩
// - 低频谱剪切 mask 让纹样有层次与“工艺感”
// - 单一暖色强调只在吸引子附近点亮
//
// 依赖:./common.js 的 GLSL 前奏 + ../../src/engine.js 的四段后处理链。
// 场景片元输出线性 HDR(可 > 1.0),bloom/色差/颗粒/暗角/ACES/抖动都在引擎里,别在这里做。
import { COMMON } from "./common.js";

const FRAG = COMMON + `
void main(){
  vec2 uv=vUv; vec2 p=(uv-0.5)*vec2(uRes.x/uRes.y,1.0);
  float t=uTime*0.2;
  vec2 m=(uMouse-0.5)*vec2(uRes.x/uRes.y,1.0);
  // two distinct poles on opposite sides -> a visible dipole field with a saddle between them
  vec2 a1=mix(vec2(0.40, 0.16), m, 0.30);
  vec2 a2=mix(vec2(-0.34,-0.20), m, 0.30);
  a1 += vec2(sin(t)*0.05, cos(t*0.9)*0.04);
  a2 += vec2(cos(t*0.8)*0.05, sin(t*0.7)*0.04);
  vec2 r1=p-a1, r2=p-a2;
  float w1=1.0/(0.16+length(r1)), w2=1.0/(0.16+length(r2));   // weighted blend -> saddle line
  float ang1=atan(r1.y,r1.x);
  float ang2=atan(r2.y,r2.x);
  float mixw=w1/(w1+w2);
  float ang=mix(ang2,ang1,mixw);                            // filings bridge the midpoint
  float mask=smoothstep(0.30,0.70, fbm3(p*1.6+t*0.05));     // low-freq shear for craft depth
  ang += (mask-0.5)*0.5;
  vec2 grid=p*22.0; vec2 cell=floor(grid);
  grid += (vec2(hash(cell), hash(cell+13.0))-0.5)*0.8;
  vec2 f=fract(grid)-0.5;
  float r=hash(cell);
  float a=ang+(r-0.5)*0.5;
  vec2 dir=vec2(cos(a),sin(a));
  float d=abs(dot(f, vec2(-dir.y,dir.x)));
  float len=length(f)/0.5;
  float stroke=smoothstep(0.10,0.0,d)*smoothstep(1.0,0.5,len);
  // per-particle length & brightness by local field strength |B| -> dense long at poles, stubs in nulls
  float B = (w1+w2)*0.16;
  stroke *= 0.45 + 0.75*clamp(B,0.0,1.4);
  float glow=exp(-length(r1)*1.3)+exp(-length(r2)*1.5)*0.6;
  float safe=mix(0.24,1.0,textZone(uv));
  vec3 base=lin(vec3(0.040,0.045,0.056));
  vec3 steel=lin(vec3(0.60,0.64,0.72));
  vec3 accent=lin(vec3(0.95,0.35,0.30))*1.7;               // single warm accent near attractors
  vec3 col=base;
  col=omix(col,steel,stroke*0.7*safe);
  col += accent*stroke*glow*0.5*safe;
  col += accent*pow(glow,6.0)*0.10*safe;
  fragColor=vec4(col,1.0);
}`;

export const CONCEPT = {
  id: "magnetic-filings",
  name: "Magnetic Filings",
  name_cn: "铁屑磁力线",
  theme: "dark",
  accent: "signal-red",
  idea: "iron filings aligning to two moving attractors",
  frag: FRAG,
};
