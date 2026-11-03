// panel-demo.js — 调参板全字段示例(参考消费者):把 schema 的每种 field type 都摆一遍,
// 并把回传值写进一块可见的样张上,证明「面板 → 你的 apply()」这条链路是通的。
//
// 用法(生产):见 docs/usage.md「引用方式」;本文件是给预览页复用的最小接线。

import { mountParamPanel, shouldMountLabPanel, PARAM_PANEL_VERSION } from './param-panel.js';

export { PARAM_PANEL_VERSION };

export const PANEL_DEMO_PARAMS = {
  slug: 'param-panel-demo',
  version: 1,
  defaults: {
    accent: '#fe8019',
    radius: 12,
    columns: 3,
    density: 'comfortable',
    grain: 0.35,
    live: true,
    caption: 'PARAM',
  },
  schema: [
    {
      key: 'accent',
      label: '强调色 · swatch',
      type: 'swatch',
      tab: '颜色',
      swatches: ['#fe8019', '#8ec07c', '#fabd2f', '#83a598', '#d3869b', '#ebdbb2'],
    },
    { key: 'radius', label: '圆角 · range', type: 'range', tab: '版式', min: 0, max: 40, step: 1 },
    { key: 'columns', label: '列数 · range', type: 'range', tab: '版式', min: 1, max: 6, step: 1 },
    {
      key: 'density',
      label: '密度 · select',
      type: 'select',
      tab: '版式',
      options: [
        { value: 'compact', label: '紧凑' },
        { value: 'comfortable', label: '舒适' },
        { value: 'loose', label: '宽松' },
      ],
    },
    { key: 'grain', label: '颗粒 · number', type: 'number', tab: '动效', min: 0, max: 1, step: 0.01 },
    { key: 'live', label: '随光标 · checkbox', type: 'checkbox', tab: '动效' },
    { key: 'caption', label: '字标 · text', type: 'text', tab: '其它' },
  ],
};

export function mountPanelDemo(root, opts = {}) {
  const api = mountParamPanel({
    params: PANEL_DEMO_PARAMS,
    corner: opts.corner || 'br',
    title: opts.title || 'Param Panel · 全字段',
    storageKey: 'themelab.param-panel-demo.v1.params',
    onChange(values) {
      apply(root, values);
    },
  });
  return api;
}

export function apply(root, values) {
  if (!root) return;
  const gap = { compact: 6, comfortable: 12, loose: 20 }[values.density] ?? 12;
  const tile = root.querySelector('[data-tile]');
  root.style.setProperty('--demo-accent', values.accent || '#fe8019');
  root.style.setProperty('--demo-radius', (values.radius || 0) + 'px');
  root.style.setProperty('--demo-gap', gap + 'px');
  root.style.setProperty('--demo-grain', String(values.grain ?? 0));
  root.dataset.live = values.live ? '1' : '0';
  root.dataset.columns = String(values.columns || 3);
  if (tile) {
    tile.textContent = values.caption || 'PARAM';
    for (const cell of root.querySelectorAll('[data-cell]')) {
      cell.classList.toggle('is-on', values.live === true);
    }
  }
  const out = root.querySelector('[data-panel-json]');
  if (out) out.textContent = JSON.stringify(values, null, 2);
  const tag = root.querySelector('[data-panel-version]');
  if (tag) tag.textContent = 'param-panel v' + PARAM_PANEL_VERSION;
}

/** 面板是否该挂:生产只在 preview / ?lab=1 挂(见 shouldMountLabPanel)。 */
export function labOnly() {
  return shouldMountLabPanel();
}