---
name: page-transition
description: Add page and section transitions to a site — cross-document View Transitions with a continuous background layer, whole-block DOM travel transitions, or Three.js particle text. Use when pages hard-cut between documents, when section scrolling needs a slow whole-block push, or when a title must dissolve into particles.
---

# page-transition

过场三档,按代价从低到高:**原生 View Transitions API → 主包体 DOM 过场 → Three 粒子字**。
先挑最省的那档,别为了效果统一就把 three 拖进静态站。

## When to use

- 多页静态站要「翻页有过渡」,且背景动画必须跨页连续(`vt-layer`)。
- 页内多屏切换要整块 DOM 位移(下切底进 / 上切顶进),且不想依赖新 API(`section-travel`)。
- 标题/字标要变成粒子飞入、炸散重组、流线汇入(`text-three`)。
- 需要卡片筛选进出场、弹层开合、懒加载媒体淡入,且不要「啪」地一跳(`vt-layer` 的页内部分)。

## When not to use

- 只要单元素淡入/上浮:写一条 CSS transition,别用这三档。
- 要的是满屏 WebGL 背景(用 `packs/bg-fx`)或生产级粒子池(用 `packs/fx-engines` 的 `fx.js`)。
- 目标浏览器既无 View Transitions 又不需要粒子字:优先 `section-travel`,不要上 three。

## Default

| 档 | 默认 | 关键量 |
|---|---|---|
| `vt-layer` | `--vt-old-ms 190` `--vt-new-ms 330` `--vt-rise 14` | 跨页零 JS |
| `section-travel` | `dur 2.6s` `travel 78vh` `variant chars` | 锁整段动画 |
| `text-three` | `density 0.8` `glow 0.6` `形态 glyph` | three r170(vendor 在包内) |

## Variants and axes

| 轴 | 取值 | 说明 |
|---|---|---|
| `section-travel` 变体 | `chars` `travel` `stagger` `blur` `stroke` `shine` | 位移之上叠的细节 |
| `text-three` 形态 | `plane` `glyph` `scatter` `depth` `ribbon` | 从「字板位移」到「流线汇字」 |
| `vt-layer` 页内 | 卡片 / 弹层 / 懒加载 | 都靠 `display` + `allow-discrete` + `@starting-style` |
| 动效偏好 | `prefers-reduced-motion` | 三档都有降级(时长压到 1ms / 停止漂移) |

## Files

| path | use |
|---|---|
| `src/vt-layer.css` | 跨页 + 页内动效层(每页 link) |
| `src/bg-boot.js` + `src/starfield-bg.js` | 背景层尽早挂载 + 跨页连续(演示用星空) |
| `src/section-travel.js` + `src/section-travel.css` | 整块位移过场(六变体) |
| `src/text-three.js` + `src/text-three.css` | Three 粒子字(五形态) |
| `src/lab-boot.js` | 预览页接线(params.json → 调参板 → CSS 变量) |
| `src/param-panel.js` `src/param-panel.css` | 标准调参板(**与 fx-engines 同版本**) |
| `src/versions.json` | 版本 + sha256(验版本) |
| `effects/<id>/params.json` | 三份参数定义 |
| `preview/index.html` + `preview/vt-a.html` `vt-b.html` `section-travel.html` `text-three.html` | 索引 + 各档预览 |
| `upstream/three.module.js` | three r170(MIT,保留 SPDX 头) |
| `docs/usage.md` | **何时用哪一档 / 接线 / 参数 / 验版本 / 反模式** |

## Agent apply steps

1. 先按 `docs/usage.md` §1 的判据选档(多数场景是 `vt-layer`,不支持时 `section-travel`,要粒子字才 `text-three`)。
2. `vt-layer`:每页 link `vt-layer.css`;背景层按 `bg-boot.js` 的三行接法放好;页内卡片只改 inline `display`,重排路径挂 `.vt-skip`。
3. `section-travel`:按 `.stage` / `.fx-item` 结构铺三屏,`import` 模块后调用 `go(n)`;调参用 `applyTravelParams(values)`。
4. `text-three`:替换 `SECTIONS` 文案;需要 `upstream/three.module.js` 同级可解析;调参用 `applyTextParams(values)`。
5. 自检:`python packs/page-transition/scripts/assert_tokens.py`;再用 http 服务打开 `preview/index.html` 与各档页,确认控制台 0 报错、A/B 两页翻页时背景不断档。

## Hard rules

- 顺序不可跳级:**能用原生 API 就不上 DOM 过场,能用 DOM 就不上 three**。
- `vt-layer` 的背景旧帧不许隐藏(`opacity: 0`),否则过渡期间背景整段消失。
- 页内卡片退场只改 inline `display`;别用 `visibility`/`height` 自创一套(会和 `@starting-style` 打架)。
- `section-travel` 动画期间必须锁定输入,禁止中途打断。
- `text-three` 的 three 版本固定在 `upstream/`(r170),升级要同步 `versions.json` 的 sha256。
- 调参板副本必须与 `packs/fx-engines` 同版本;要改面板请改 fx-engines 再整份替换。
- `preview/*.html` 的相对引用必须落在本包内;外链只用 `https://`。
