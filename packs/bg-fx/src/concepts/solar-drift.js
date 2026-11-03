// solar-drift.js — Solar Drift · 暖阳漂移(bg-fx)
// idea: a slow-orbiting sun breathing through a warm ochre haze on paper
//
// 机制(只做这一件事,不是“平均色背景”):
// - 亮底(纸)上的轨道太阳:小过曝核心 + 平方反比日冕 + 盘缘暗化
// - 定向体积光轴(god-ray)沿云带散射
// - 两层结构:fbm 云密度 + 水平层状带,避免一整片渐变
// - 地平带做第二个焦点;双尺度纸张纤维颗粒压住台阶
// - light theme:文字区只靠 textZone 收光,不做暗色反转
//
// 依赖:./common.js 的 GLSL 前奏 + ../../src/engine.js 的四段后处理链。
// 场景片元输出线性 HDR(可 > 1.0),bloom/色差/颗粒/暗角/ACES/抖动都在引擎里,别在这里做。
import { COMMON } from "./common.js";

const FRAG = COMMON + `
void main(){
  vec2 uv=vUv; vec2 p=(uv-0.5)*vec2(uRes.x/uRes.y,1.0);
  float t=uTime*0.05;
  vec2 sun=vec2(cos(t)*0.34, sin(t*0.8)*0.20+0.10);
  vec2 m=(uMouse-0.5)*vec2(uRes.x/uRes.y,1.0);
  sun=mix(sun,m*0.6,0.22);
  float d=length(p-sun);
  float haze=fbm(p*1.5+vec2(t*0.5,-t*0.35));
  float slow=fbm3(p*0.6-vec2(t*0.25,t*0.18));       // second layer: density modulator
  float dens=haze*0.6+slow*0.4;
  // soft cloud strata — a second structural layer so the field isn't one flat ramp
  float strata = fbm3(vec2(p.x*1.1, p.y*3.4) - vec2(t*0.2, -t*0.1));
  vec3 paper=lin(vec3(0.88,0.80,0.66));
  vec3 warm =lin(vec3(0.97,0.80,0.52));
  vec3 shade=lin(vec3(0.78,0.68,0.54));              // cooler haze shadows -> depth
  vec3 core =lin(vec3(1.0,0.76,0.46));
  vec3 col=omix(paper,warm, smoothstep(0.95,0.10,d)*0.60 + (dens-0.5)*0.12);
  col = omix(col, shade, smoothstep(0.55,0.9,strata)*0.22*smoothstep(0.2,0.8,d));
  // real radial structure: small blown core + inverse-square corona + limb darkening at the disc edge
  float R = 0.15*(1.0+0.10*sin(uTime*0.35));
  float coreD = smoothstep(R*0.30, 0.0, d);
  float disc  = smoothstep(R, R*0.55, d);
  float corona= pow(R/(d + R*0.12), 2.0);
  col = omix(col, core, disc*0.72);
  col += core * (coreD*1.6 + corona*0.14);
  // god-ray: directional volumetric shaft streaking from the sun through the haze
  vec2 rayDir = normalize(vec2(0.55, -0.35));
  float along = dot(p - sun, rayDir);
  float across = abs(dot(p - sun, vec2(-rayDir.y, rayDir.x)));
  float shaft = smoothstep(0.34, 0.0, across) * smoothstep(0.0, 0.5, along)
              * (0.55 + 0.45*fbm3(p*2.4 + vec2(-t*0.5, t*0.3)));
  col += core * shaft * 0.14;
  // parallax rim/reflection band behind the sun (cooler)
  float rim = exp(-pow(length(p - sun*0.55 - vec2(0.10,-0.05))*2.3, 2.0));
  col += lin(vec3(0.72,0.66,0.52)) * rim * 0.10;
  // horizon band — a second focal beat for a second look
  float hor = smoothstep(0.025,0.0, abs(p.y+0.30 + (fbm3(p*1.4+t*0.1)-0.5)*0.06));
  col = omix(col, lin(vec3(0.80,0.66,0.44)), hor*0.16);
  // paper fiber grain (two anisotropic scales)
  float fib = vnoise(vec2(p.x*170.0,p.y*22.0))*0.5 + vnoise(vec2(p.x*40.0,p.y*320.0))*0.5;
  col *= 0.985 + (fib-0.5)*0.030;
  col *= 1.0 - 0.55*smoothstep(0.10,1.1,length(p-vec2(0.45,-0.35)));
  fragColor=vec4(col,1.0);
}`;

export const CONCEPT = {
  id: "solar-drift",
  name: "Solar Drift",
  name_cn: "暖阳漂移",
  theme: "light",
  accent: "amber",
  idea: "a slow-orbiting sun breathing through a warm ochre haze on paper",
  frag: FRAG,
};
