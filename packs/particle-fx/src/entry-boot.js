// entry-boot.js — 预览页共用接线:读 effects/<slug>/params.json → 挂标准调参板 → 把值交给该 entry 的 mount()。
//
// 约定:每个 entry 导出 mount(container, params) → { update?(p), destroy() }。
//   - 有 update():原地改参(例如 scroll-morph 只有 count/text/textScale 变了才重建点阵);
//   - 只有 destroy():改参即重建(4 个 canvas 变体就是这种,重建成本低)。
import { mountParamPanel } from "./param-panel.js";
import { coalesce } from "./util.js";

export async function bootEntry(opts) {
  const { slug, mount, container, title, corner = "bl", panel = true } = opts;
  const params = await (await fetch(`../effects/${slug}/params.json`)).json();

  let handle = null;
  const apply = coalesce((values) => {
    const merged = { ...params.defaults, ...values };
    if (handle && typeof handle.update === "function") handle.update(merged);
    else {
      if (handle && typeof handle.destroy === "function") handle.destroy();
      handle = mount(container, merged) || null;
    }
    opts.onParams?.(merged);
  });

  let api = null;
  if (panel) {
    api = mountParamPanel({
      params,
      corner,
      title: title || slug,
      storageKey: `themelab.${slug}.v${params.version || 1}.params`,
      onChange: (values) => apply(values), // 挂载时会立刻 emit 一次,首帧就由它驱动
    });
  } else {
    apply(params.defaults);
  }
  return { params, api, get handle() { return handle; } };
}
