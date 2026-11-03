// lab-boot.js — page-transition 预览页共用接线:读 effects/<slug>/params.json → 挂标准调参板 → 把值交给页面的 apply()。
//
// 与 particle-fx 的 entry-boot.js 是同一套约定(那位负责 mount 效果实例,这里负责把值落到 CSS 变量上,
// 因为过场层的可调项本来就是 CSS 变量)。调参板本体来自 packs/fx-engines(整份拷贝,带版本常量)。
import { mountParamPanel } from "./param-panel.js";

/** 同帧合并:一帧内多次调用只跑最后一次(拖滑杆时用)。 */
function coalesce(fn) {
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

export async function bootPreview(opts) {
  const { slug, apply, title, corner = "bl", panel = true, panelOpts = {} } = opts;
  const params = await (await fetch(`../effects/${slug}/params.json`)).json();
  const run = coalesce((values) => apply({ ...params.defaults, ...values }));

  if (!panel) {
    run(params.defaults);
    return { params, api: null };
  }
  const api = mountParamPanel({
    params,
    corner,
    title: title || slug,
    storageKey: `themelab.${slug}.v${params.version || 1}.params`,
    ...panelOpts,
    onChange: run,
  });
  return { params, api };
}
