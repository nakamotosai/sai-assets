// curl.js — Curl 流场:正弦流场 + 5 个移动的吸引/排斥核,云絮状卷动(curl 变体)。
import { startParticleMotion } from "../particle-motions.js";
import { hexToRgb, reducedMotion } from "../util.js";

export const VARIANT = "curl";

/** @returns {{destroy: () => void}} */
export function mount(canvas, params = {}) {
  const stop = startParticleMotion(canvas, VARIANT, {
    density: params.density,
    spin: params.spin,
    dotScale: params.dotScale,
    goldRgb: hexToRgb(params.gold),
    whiteRgb: hexToRgb(params.star, [240, 242, 248]),
    reduced: reducedMotion(),
  });
  return { destroy: () => stop && stop() };
}
