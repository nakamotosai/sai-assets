---
name: bg-fx
description: Ten award-grade WebGL2 animated backgrounds (aurora, ink river, caustics, moiré silk, brushed metal, prism, embers, contour map, sun haze, iron filings) sharing one engine — bloom → radial chromatic aberration → luminance-gated grain → smoothstep vignette → ACES → triangular dither. Use when a hero/section/deck cover needs a background with real mechanism instead of a moving gradient, and when DPR caps, pause-on-hidden and prefers-reduced-motion must be handled for you.
---

# bg-fx

一块背景 = **一份 `src/engine.js`** + **一个 `src/concepts/<id>.js`**。引擎管"片子质感"
(景深、光、颗粒、色调),concept 管"这是什么东西"。十个 concept 各自只写自己的机制,
共用同一套后处理——所以它们放在一起时看起来像同一部片的十个镜头,而不是十张素材拼贴。

## When to use

- 首屏 hero / 章节底 / deck 封面 / 展厅墙,需要一块**经得起近看**的动态底
- 需要一个统一的"片子感"外壳下换主题(同一引擎,10 种机制:极光、墨流、焦散、摩尔丝、金属拉丝……)
- 需要开箱即用的性能与无障碍口径(DPR 封顶、页隐藏/离屏暂停、`prefers-reduced-motion` 只出静态帧)
- 需要暗底 + 单个暖色强调,或亮底(纸 / 水)的克制版

## When not to use

- 前景内容密集的长文页、表单页、数据看板(背景有景深与高光,会跟正文抢注意力)
- 首帧 LCP 是硬指标的落地页(首帧要建 4 张离屏 target;这类页面用 CSS 渐变)
- 无 WebGL2 且不能接受静态兜底的场景
- 一页想同屏铺多个效果(10 个 WebGL 上下文会被回收;用索引墙做链接)
- 当插画 / 图标 / 贴纸用——这是环境光,不是图形素材

## Files

| path | 是什么 |
|---|---|
| `src/engine.js` | **唯一一份**引擎:Dhi 式后处理链 + 性能守卫 + 输入阻尼。工厂 `createEngine(canvas, frag, opts)` |
| `src/concepts/common.js` | 十个 concept 共用的 GLSL 前奏(uniform 约定、`hash/vnoise/fbm/fbm3`、`lin/srgb/omix`、`textZone()` 标题安全区、`curl()` 无散度流场) |
| `src/concepts/<id>.js` | 单个效果的**机制代码**(片元着色器)+ 元信息(`id/name/name_cn/theme/accent/idea`) |
| `src/stage.css` | 全屏舞台 + HUD + 提示行(预览页共用) |
| `effects/<id>/index.html` | 可**独立打开**的效果页(相对引用 `../../src/engine.js` 与 `../../src/concepts/<id>.js`) |
| `effects/<id>/params.json` | 该效果的调参默认值 + 面板 schema(6 个旋钮) |
| `preview/index.html` | 10 个效果的**索引墙**(每张卡链到 effect 页,不内嵌 iframe) |
| `docs/usage.md` | 取用片段、参数含义、性能与无障碍口径、反模式 |
| `scripts/assert_tokens.py` | 断言:pack.json / 产物存在 / 相对引用可解析 / id 对齐 / 脱敏残留 |

## Agent apply steps

1. 读 `pack.json` 的 `when` / `not_for`,确认场景对得上(前景别太密、首帧别卡 LCP)。
2. 选一个效果 id(见 `docs/usage.md` 的效果表),把这三个文件拷进项目:
   `src/engine.js`、`src/concepts/common.js`、`src/concepts/<id>.js`(concept 会 `import` common)。
3. 页面里放一个 `<canvas id="stage">`,按 `docs/usage.md` §取用 起引擎;参数从
   `effects/<id>/params.json` 的 `defaults` 抄,别在代码里另写一份默认值。
4. 必须写兜底:`if (!eng.ok) { ... }` 时给纯色/渐变,别留黑画布。
5. 需要换主题时**换 concept id**,不要改引擎;需要调观感时只动 6 个旋钮(`docs/usage.md` §参数)。
6. 交付前自检:`python packs/bg-fx/scripts/assert_tokens.py` 必须打印 `PASS assert_tokens bg-fx`。

## Hard rules

- **引擎只有一份**。不要在项目里复制第二份 `engine.js`,也不要改后处理顺序
  (bloom → 色差 → 颗粒 → 暗角 → ACES → 抖动):颗粒放到 ACES 之后会变数字噪点,
  暗角放到 bloom 之前会连泛光一起切掉。
- **concept 只输出线性 HDR**(可 > 1),不许在 concept 里做 blur / vignette / tonemap / gamma。
- **不许改 DPR 守卫与暂停逻辑**;要更省就降 `dprCap`,不要改"页隐藏继续画"。
- **`prefers-reduced-motion` 不是降速,是不播**:引擎出静态帧,别在外面包一层"慢速播放"绕过它。
- 一页一个背景;要多个 section 都用,第二个用 `speed: 0` 的静态帧。
- 调参面板属于底座包 `fx-engines`,本包预览用 `params.json` + `?speed=&bloom=` 查询串调,
  **不要**在 bg-fx 里再抄一份 param-panel。