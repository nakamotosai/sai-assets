// text-push.js — 粒子组字:字形采样成点阵,光标推散、松手弹回(push 变体)。
// 变体 id 交给 particle-motions.js 的 startParticleMotion(canvas, 'text-push', opts)。
import { startParticleMotion } from "../particle-motions.js";
import { hexToRgb, reducedMotion } from "../util.js";

export const VARIANT = "text-push";

/** @returns {{destroy: () => void}} */
export function mount(canvas, params = {}) {
  const stop = startParticleMotion(canvas, VARIANT, {
    density: params.density,
    spin: params.spin,
    dotScale: params.dotScale,
    text: params.text,
    goldRgb: hexToRgb(params.gold),
    whiteRgb: hexToRgb(params.star, [240, 242, 248]),
    reduced: reducedMotion(),
  });
  return { destroy: () => stop && stop() };
}
