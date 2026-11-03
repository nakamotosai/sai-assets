// starfield.js — 星野漂移:定种星场 + 微漂 + 闪烁,光标轻微加速(starfield 变体)。
import { startParticleMotion } from "../particle-motions.js";
import { hexToRgb, reducedMotion } from "../util.js";

export const VARIANT = "starfield";

/** @returns {{destroy: () => void}} */
export function mount(canvas, params = {}) {
  const stop = startParticleMotion(canvas, VARIANT, {
    density: params.density,
    dotScale: params.dotScale,
    goldRgb: hexToRgb(params.gold),
    whiteRgb: hexToRgb(params.star, [240, 242, 248]),
    reduced: reducedMotion(),
  });
  return { destroy: () => stop && stop() };
}
