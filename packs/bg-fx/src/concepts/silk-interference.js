// silk-interference.js — Silk Interference · 丝缎干涉(bg-fx)
// idea: two grating planes beating into slow iridescent silk folds
//
// 机制(只做这一件事,不是“平均色背景”):
// - 两块光栅平面的真实 moiré 拍频(频率/角度各自随 fbm 变)
// - 折叠脊线锐化 + 慢速 drape 层改色相
// - fold-normal 镜面高光(用梯度)，把“布”变成“丝”
// - 虹彩来自拍频相位而非贴图
//
// 依赖:./common.js 的 GLSL 前奏 + ../../src/engine.js 的四段后处理链。
// 场景片元输出线性 HDR(可 > 1.0),bloom/色差/颗粒/暗角/ACES/抖动都在引擎里,别在这里做。
import { COMMON } from "./common.js";

const FRAG = COMMON + `
void main(){
  vec2 uv=vUv; vec2 p=(uv-0.5)*vec2(uRes.x/uRes.y,1.0);
  float t=uTime*0.12; vec2 m=(uMouse-0.5)*vec2(uRes.x/uRes.y,1.0);
  // domain-warp the grating coordinate so the lattice shears into flowing folds, not blobs
  vec2 pw = p + (vec2(fbm3(p*1.2 + t*0.5), fbm3(p*1.2 + 9.0 - t*0.5)) - 0.5) * 1.1;
  float a=fbm3(pw*1.6+t*0.4);
  float b=fbm3(pw*1.6-t*0.4+3.7);
  float f1=30.0 + (a-0.5)*14.0;
  float ang1=0.30+(a-0.5)*0.7;
  float f2=34.0 + (b-0.5)*16.0;
  float ang2=ang1+0.85+(b-0.5)*0.8;                     // second plane at a different angle
  float g1=sin(f1*(pw.x*cos(ang1)+pw.y*sin(ang1)));
  float g2=sin(f2*(pw.x*cos(ang2)+pw.y*sin(ang2)));
  float beat=g1*g2;                                     // the real moiré beat envelope
  float fold=smoothstep(0.08,0.92, 0.5+0.5*beat);
  fold = pow(fold, 1.3);                                // sharpen ridges into fold crests
  float drape=smoothstep(0.35,0.85, fbm3(p*0.9 - t*0.5));   // slow second layer
  vec3 c1=lin(vec3(0.26,0.13,0.46));
  vec3 c2=lin(vec3(0.10,0.44,0.64));
  vec3 c3=lin(vec3(0.92,0.42,0.64));
  vec3 col=omix(c1,c2,smoothstep(0.2,0.9,a)*0.75);
  col=omix(col,c3,smoothstep(0.55,1.0,drape)*0.50);
  col *= 0.10+0.72*pow(fold,1.8);
  vec3 irid=0.5+0.5*cos(6.2831*(vec3(0.0,0.33,0.67)+0.7*beat+0.12*t));
  col += irid*pow(fold,6.0)*0.45;
  // fold-normal specular: crests catch a hard sheen (silk, not flat cloth)
  float fg = length(vec2(dFdx(fold), dFdy(fold)));
  col += lin(vec3(1.0,0.98,0.95)) * pow(smoothstep(0.0,0.06,fg),1.3) * pow(fold,3.0) * 0.85;
  col *= mix(0.28,1.0,textZone(uv));
  col *= 1.0-0.32*length(p);
  fragColor=vec4(col,1.0);
}`;

export const CONCEPT = {
  id: "silk-interference",
  name: "Silk Interference",
  name_cn: "丝缎干涉",
  theme: "dark",
  accent: "violet-rose",
  idea: "two grating planes beating into slow iridescent silk folds",
  frag: FRAG,
};
