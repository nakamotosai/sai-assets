// aurora-veil.js — Aurora Veil · 极光幕帘(bg-fx)
// idea: a vertical curtain of emissive light rippling over deep pine-black
//
// 机制(只做这一件事,不是“平均色背景”):
// - 5 条独立幕帘,每条随机顶高 → 层层叠叠的天幕
// - striae 频率与振幅都随空间/时间变 → 读作垂挂织物,不是条形码
// - 竖向 picket-ray 细节 + 幕帘背后的暗紫副带
// - 色相随高度:emerald 底 → teal 中段 → magenta 边缘(真实极光梯度)
//
// 依赖:./common.js 的 GLSL 前奏 + ../../src/engine.js 的四段后处理链。
// 场景片元输出线性 HDR(可 > 1.0),bloom/色差/颗粒/暗角/ACES/抖动都在引擎里,别在这里做。
import { COMMON } from "./common.js";

const FRAG = COMMON + `
void main(){
  vec2 uv=vUv; float t=uTime;
  vec2 m=uMouse-0.5;
  float curtain=0.0, glow=0.0, mag=0.0;
  for(int i=0;i<5;i++){
    float fi=float(i);
    float cx = fbm(vec2(uv.x*1.1 + fi*10.0, t*0.03))*1.2 - 0.10;
    float c = exp(-pow((uv.x-cx)*7.0,2.0));
    float origin = 0.70 + (hash(vec2(fi,7.0))-0.5)*0.36;      // per-ribbon random top
    c *= smoothstep(0.0,0.28,uv.y)*(1.0-smoothstep(origin,1.0,uv.y));
    c *= 1.0+0.35*exp(-length((uv-0.5)-m)*2.4);
    curtain+=c;
    // striae: frequency AND amplitude both vary in space+time -> no barcode, reads as hanging fabric
    float fq = 26.0 + 14.0*fbm(vec2(uv.y*2.0 + fi*3.0, t*0.10));
    float ph = uv.x*fq + uv.y*2.5 + fbm(vec2(uv.x*4.0, uv.y*0.7 - t*0.5))*9.0 + fi*2.1;
    float st = 0.5+0.5*sin(ph);
    st = mix(st, 0.5, 0.30*length(uv-vec2(cx,0.5)));         // fade striae away from the ribbon core
    float rays = 0.30 + 0.85*fbm(vec2(uv.x*58.0 + fi*7.0, uv.y*0.12 - t*0.5));   // picket-fence rays
    glow += c*st*rays;
    mag += exp(-pow((uv.x-cx-0.12)*6.0,2.0))*st*rays*0.40;    // dim violet ribbon behind
  }
  curtain=clamp(curtain,0.0,1.0);
  glow=clamp(glow,0.0,1.0)*curtain;
  float safe=mix(0.24,1.0,textZone(uv));
  // hue by height: emerald base -> teal mid -> magenta fringe at the top (physical aurora gradient)
  vec3 hue = mix(lin(vec3(0.55,0.98,0.58))*2.4, lin(vec3(0.10,0.70,0.72))*1.8, smoothstep(0.12,0.52,uv.y));
  hue = mix(hue, lin(vec3(0.85,0.35,0.80))*1.5, smoothstep(0.55,0.98,uv.y));
  vec3 dark=lin(vec3(0.008,0.020,0.022));                     // blue-tinted black
  vec3 teal=lin(vec3(0.05,0.40,0.40));
  vec3 col=dark + lin(vec3(0.02,0.05,0.06))*fbm3(uv*2.0-t*0.05);
  col=omix(col,teal,curtain*0.55*safe);
  col+=hue*pow(glow,2.0)*0.46*safe;
  col+=lin(vec3(0.70,0.30,0.85))*pow(clamp(mag,0.0,1.0),2.4)*0.18*safe;
  fragColor=vec4(col,1.0);
}`;

export const CONCEPT = {
  id: "aurora-veil",
  name: "Aurora Veil",
  name_cn: "极光幕帘",
  theme: "dark",
  accent: "lime",
  idea: "a vertical curtain of emissive light rippling over deep pine-black",
  frag: FRAG,
};
