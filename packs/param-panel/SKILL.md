---
name: param-panel
description: Add a floating, schema-driven parameter panel to a demo or preview page — tabs, swatches constrained to a palette, sliders/selects/checkboxes, collapse to a 56px square, drag and resize, set-default / reset / undo / copy / export, state kept in localStorage. Use when a page has three or more tunable parameters and you need to see two levels of a value side by side instead of editing code, especially when colours must stay inside a fixed palette. Lab-only by design; never mount it on a production surface.
---

# param-panel · 悬浮调参板

一件作品的参数从代码里搬到一个**可拖、可缩放、可收起、可导出**的小板上:面板由 `params.schema` 生成(标签分栏 / swatch 受色板约束 / range / select / checkbox / text),
底栏能「设为默认 → 复制 → 粘回 `params.json`」,位置、尺寸、折叠态与当前值都记在 `localStorage`。
**它是 lab 器具**:`shouldMountLabPanel()` 只在路径像 `preview` 或 URL 带 `?lab=1` 时返回 true,widget 不会漏到生产界面。

## When to use

- 做**可调参 demo / 动效预览 / 主题试色页**:参数 ≥3 个,调一下就想立刻看到差别。
- 需要**给用户当场看两档**(圆角 0→28、阴影 0→40、速度 0.2→4s),比改代码截图快一个量级。
- 颜色必须**受色板约束**:`type: "swatch"` + `swatches: []`,写进来的值会被吸附到最近的 swatch,禁自由取色。
- 调完要**把值带走**:底栏「复制」给出可直接粘回 `params.json.defaults` 的 JSON。

## When not to use

- 面向最终用户的生产界面 —— 板是半成品外观,只允许 `preview` 路径或 `?lab=1`。
- 没有参数可调的静态页(白装一层壳)。
- 需要校验与提交的表单场景(用表单件,不要拿调参板当表单)。
- 移动端为主的阅读页:板会占掉画面右下角。

## Files

| path | use |
|---|---|
| `src/param-panel.js` | 无依赖 ES module:面板生成、拖/缩放/折叠、localStorage、导入导出(`mountParamPanel` / `shouldMountLabPanel`) |
| `src/param-panel.css` | 面板全部样式(`.pp-param-panel` 作用域;含可见焦点环与 `prefers-reduced-motion` 降级) |
| `src/params.schema.json` | `params.json` 的 JSON Schema,可直接拿去校验自己的参数文件 |
| `preview/index.html` | 活预览:面板驱动一张真卡(色/圆角/内边距/阴影/速度/标题/网格),含深浅切换 |
| `docs/usage.md` | 接入步骤 + `opts` 与 `schema` 参数表 + 无障碍硬项 + 反模式 |
| `scripts/assert_tokens.py` | 自检:元数据 / 声明路径 / 预览引用解析 / 前缀一致性 / 旧命名空间残留 |

## Agent apply steps

1. 拷 `src/param-panel.{css,js}` 进项目静态资源(`apply.py` 整包拷贝时已在包里);CSS 用 `<link>`,JS 用 `<script type="module">`。
2. 写 `params.json`:`{slug, version, defaults, schema[]}`。`slug` 必须**每个 demo 唯一**(localStorage 命名空间靠它)。
3. 写 `apply(values)`:只做赋值(写 CSS 变量 / 调引擎参数),**不要**在里面重建 DOM 或重新 fetch。
4. 生产先 `apply(params.defaults)`;仅当 `shouldMountLabPanel()` 为真才 `mountParamPanel({params, onChange: apply})`。
5. 想固定落点用 `corner: "tl"|"tr"|"bl"|"br"`;想改板头 `title`;`force: true/false` 可覆盖挂载判断。
6. 自检:`python packs/param-panel/scripts/assert_tokens.py`;页面侧查四件事 —— 拖一次滑块卡片立刻变、刷新后值还在、点最小化收成 56×56 方块能点开、Tab 能走完控件且焦点环可见。

## Hard rules

- **lab-only**:除 `preview` 路径与 `?lab=1` 外不许挂板;要临时关掉用 `?lab=0`。
- 颜色只用 `type: "swatch"` + `swatches`;禁止 free color(手输 hex 会让作品漂到库外)。
- 每个 demo 的 `slug` 唯一;禁止多页共用一个 slug(会互相覆盖 localStorage)。
- `onChange` 里只做赋值;拖动时会连发几十次,重活一律 debounce 到板外。
- 默认值只在 `params.json.defaults` 写一次;代码里再抄一份就会出现两套默认。
- 控件一律原生 `input` / `select`,不许 div 假控件;可见焦点环与减少动效降级两块在 `src/param-panel.css` 末尾,别删。
- 板让你看到差别,**不**证明差别达标:对比度 / 字号地板 / 双视口仍照跑项目锁里的断言。
- 包内不写盘符路径、内网地址、自有域名或客户代号。
- 消费后必须在项目 `design-lock.json` 记 `assets[]`(`pack` / `version` / `sha`)。