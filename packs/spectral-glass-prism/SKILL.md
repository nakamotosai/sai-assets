---
name: spectral-glass-prism
description: A WebGPU spectral-dispersion glass stage (SDF raymarching, per-wavelength Cauchy dispersion, CIE 1931 reconstruction) with five shapes and a host layer. Use when a page needs real refractive glass with a live, draggable stage, or when you need the exact DOM contract a WebGPU canvas engine requires.
---

# spectral-glass-prism

真玻璃的光谱色散:逐波长采样可见光谱 → 逐波长折射 → CIE 1931 合成。五种形状(pill / prism / cube /
plate / diamond)共享同一引擎;本包给的是**可直接抄走的宿主壳 + 引擎契约**,引擎本体是上游 MIT 构建产物。

## When to use

- 落地页 / 作品集要一块能拖、能转、有真火彩的实时玻璃舞台
- 需要演示"真色散 vs 三色带近似"的差别(按住 `Z` 降到 N=3 对比)
- 需要一个 WebGPU 画布引擎与宿主页面之间的**契约样板**:能力探测 → 契约节点自检 → 动态加载 → 兜底

## When not to use

- 必须兼容无 WebGPU 的浏览器 / 低端机(只剩兜底面板)
- 要改引擎内部算法:去上游 fork 重新构建,别就地改 vendored 文件
- 首屏以文本与 SEO 为主的页面(这页重心是画布)

## Default

引擎默认场景:四个旋转玻璃立方体,N=16,`n_d = 1.272` / `V_d = 2.0`,透视 FOV 45°,背景 = 画布内 DOM 叠 Picsum 照片(不支持时退回 Picsum 单层,再不行退回渐变)。

| 轴 | 值 |
|---|---|
| shape | `pill` / `prism` / `cube` / `plate` / `diamond` |
| sampleCount (N) | 3 / 8 / 16(默认) / 32 / 64 |
| refractionMode | `exact`(默认)/ `approx` |
| bgSource | `photo` / `html`(需 Chrome CanvasDrawElement) |
| aaMode | `none` / `fxaa` / `taa` |
| envmap | Poly Haven HDR(CC0),可选;Diamond 预设默认开 |

## Files

| path | use |
|------|-----|
| `src/spectral-glass.js` | 宿主:探测 / 契约自检 / 动态加载 / 兜底 / `spectral-glass:ready` 事件 / `window.spectralGlass` |
| `src/spectral-glass.css` | 舞台几何(引擎硬契约)+ 文字轨 + 署名条 + 兜底面板 |
| `preview/index.html` | 活预览(1440px 可直接开) |
| `upstream/spectral-glass/engine.js` | 上游构建产物,原样 vendored(别改) |
| `upstream/spectral-glass/LICENSE` | 上游 MIT 原文 |
| `upstream/spectral-glass/NOTICE.md` | 来源、运行期依赖、引擎硬契约速查 |
| `docs/usage.md` | 接入三步 + 契约表 + API + 参数 + 反模式 |
| `scripts/assert_tokens.py` | 断言:契约字段 / 引用解析 / 契约节点齐全 / src 与 upstream 一致声明 |

## Agent apply steps

1. 拷 `src/spectral-glass.{css,js}` 与 `upstream/spectral-glass/engine.js`(保持目录相对关系:`src/` 与 `upstream/` 同级,宿主用的是 `../upstream/...`)。
2. 页面里铺契约节点:`<canvas id="gpu" layoutsubtree>` 包住 `#html-bg-root`(`#html-bg-photo` + `#html-bg-foreground`),画布外留一个 `#fallback`。**id 一个都不能改名**。
3. 引样式与 `<script src="src/spectral-glass.js" defer></script>`(普通脚本,`双击打开本地文件即可);宿主会自动探测,不满足就只出兜底,不加载引擎。
4. 要自己控制时机:`await window.spectralGlass.probe()`,不 ok 就别 `mount()`。
5. 换成自己的内容:文字轨里的文案随便改,但**别删节点**;底图想自持就替换 `#html-bg-photo` 的地址来源(默认是引擎写入 Picsum)。
6. 自检:`python scripts/assert_tokens.py`;真机页面里确认 `documentElement[data-sg-state]` 从 `probing` 走到 `live`,且控制台干净。

## Hard rules

- **先探测、后加载**:不要在缺 `navigator.gpu` / 无 adapter 时加载引擎 —— 那会在控制台留下一条引擎自身的失败错误。
- 宿主与预览**不要改成 ES module**:以本地文件方式打开时模块会被 CORS 拦(引擎是无 import/export 的 IIFE,普通 `<script>` 就能跑)。
- 引擎文件**字节一致**:`upstream/spectral-glass/engine.js` 不许就地编辑;要改就 fork 上游重新构建。
- 契约 id 与画布尺寸规则(`#gpu` 100vw×100vh、`touch-action:none`、`#html-bg-root` absolute 铺满)不许改。
- **隐藏 ≠ 暂停**:停渲染用面板 `paused` 或 `visibilitychange`,别只是把画布藏起来。
- 底图与 HDR 都是运行期外部依赖(Picsum / Poly Haven CC0):断网会退回渐变,这是设计内行为。
- 只支持 WebGPU 浏览器(Chrome/Edge 120+、Safari 18+);不支持时给兜底面板而不是假装能跑。
- 消费后必须在项目 `design-lock.json` 记 `assets[]`(`pack` / `version` / `sha`)。
