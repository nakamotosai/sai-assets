// galaxy.js — 银河盘:核球 + 对数螺线臂 + 盘雾,整体倾斜投影(galaxy 变体)。
import { startParticleMotion } from "../particle-motions.js";
import { hexToRgb, reducedMotion } from "../util.js";

export const VARIANT = "galaxy";

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
