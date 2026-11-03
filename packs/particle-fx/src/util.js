// util.js — 各 entry 共用的小工具(无依赖)。

/** '#rrggbb' / 'rrggbb' → [r,g,b];给不出合法值时用 fallback。 */
export function hexToRgb(hex, fallback = [232, 197, 120]) {
  const s = String(hex || "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return fallback;
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 本机是否开了「减少动态」。 */
export function reducedMotion() {
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (_) {
    return false;
  }
}

/** 同帧合并:一帧内多次调用只跑最后一次(拖调参板滑杆时用)。 */
export function coalesce(fn) {
  let queued = false;
  let last;
  return (value) => {
    last = value;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(last);
    });
  };
}
