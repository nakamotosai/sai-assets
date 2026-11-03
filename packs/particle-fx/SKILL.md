---
name: particle-fx
description: Drop-in particle effects for web pages — glyph push, starfield drift, galaxy disk, curl flow, scroll morph, and an optional audio-reactive black-hole disk. Use when a page needs a lightweight (zero-dependency) particle layer, a cursor-reactive glyph field, a star/galaxy backdrop, or a mic/stream driven visual, without pulling in three.js or a build step.
---

# particle-fx

六档粒子效果:四档共用一份 canvas 2D 变体实现,加一个滚动组字、一个音频反应黑洞盘(可选)。
零构建、零依赖(`void-audio` 除外,它需要包内 `upstream/three.module.js`)。

## When to use

- 要一层**轻量**粒子:星野、银河盘、云絮流场、字标粒子(点数量 900–1400 级)。
- 要光标交互:推散字标粒子、加速星野。
- 要「散开 ↔ 组字」的 morph(自动循环或跟滚动)。
- 要音频驱动的画面(麦克风 / 直播流 / 无权限时的假频谱),且能接受可选依赖。

## When not to use

- 要生产级密度、three.js 粒子池(用 `packs/fx-engines` 的 `src/fx.js`,6 个 fx 同一套思路)。
- 要满屏背景 + bloom/ACES 后处理(用 `packs/bg-fx`)。
- 要页面/文字过场(用 `packs/page-transition`)。
- 要 WebGL 但不想要 three 依赖(用 `bg-fx` 的 WebGL2 引擎)。

## Default

| 档 | 默认 | 说明 |
|---|---|---|
| `text-push` | `density 1` `dotScale 1` `text "ASSETS"` | 字形采样成点阵 |
| `starfield` | `density 1` `dotScale 1` | 定种星场 |
| `galaxy` | `density 1` `spin 0.14` | 核球 + 螺线臂 + 雾 |
| `curl` | `density 1` | 正弦流场 + 5 个移动引力核 |
| `scroll-morph` | `count 13000` `text "ASSETS"` | 6.5s 一个 morph 循环 |
| `void-audio` | `react 1.05` `quality 0.8` `steps 39` | 默认假频谱(零权限) |

## Variants and axes

| 轴 | 取值 | 说明 |
|---|---|---|
| 档位 | 上表 6 个 entry id | 各自独立预览页与 params.json |
| 音源 | `fake` / `mic` / `stream` | 见 `docs/usage.md` §3;失败一律回落 `fake` |
| 尺寸 | 容器尺寸驱动 | `scroll-morph` 在窄容器里自动降到约 8% 点数 |
| 动效偏好 | `prefers-reduced-motion` | 全部档位降级为「一帧静态」或停在字形端 |

## Files

| path | use |
|---|---|
| `src/particle-motions.js` | 四档共用变体实现(+ `PARTICLE_MOTIONS_VERSION`) |
| `src/concepts/<entry>.js` | 六档入口:`mount(container, params) → {update?, destroy}` |
| `src/concepts/void-fx.js` | 黑洞盘 shader 渲染器(+ `VOID_FX_VERSION`) |
| `src/concepts/void-audio.js` | 音频反应接线(音源三档 + 降级 + 面板同步) |
| `src/entry-boot.js` | 预览页共用接线(params.json → 调参板 → mount) |
| `src/param-panel.js` `src/param-panel.css` | 标准调参板(**与 fx-engines 同版本**,sha256 校验) |
| `src/stage.css` | 预览页共用舞台样式 |
| `src/versions.json` | 版本 + sha256(验版本) |
| `effects/<entry>/params.json` | 六份参数定义 |
| `preview/index.html` + `preview/<entry>.html` | 索引 + 各档活预览 |
| `docs/usage.md` | **接线 / 音源降级 / schema / 验版本 / 反模式** |

## Agent apply steps

1. 选档(上表),读 `effects/<entry>/params.json` 拿默认值与字段;要改默认就在自己项目里覆盖,不要改包内文件。
2. 接线:预览页式用 `bootEntry({ slug, mount, container, corner })`;只要效果就直接 `mount(container, params)`。
3. 颜色只给 `swatch` 色板里的 hex;`params` 里不要塞实现不读的键。
4. `void-audio` 只在明确要音频反应时接:默认走假频谱,麦克风要用户手势 + 授权,直播流要给 `?stream=https://…`;务必保留失败回落。
5. 自检:`python packs/particle-fx/scripts/assert_tokens.py`;再用浏览器打开 `preview/<entry>.html`(需经 http 服务打开,ES module 才能加载),看控制台 0 报错。

## Hard rules

- 面板只此一份版本:要改调参板 → 改 `packs/fx-engines/src/param-panel.js` 并抬版本,再整份替换本包副本(sha256 会立刻报漂移)。
- 音源必须可降级:任何 `getUserMedia` / 流播放失败都要回落到假频谱,且把原因写进 HUD。
- 麦克风档**不许**接扬声器(只分析):接上去就是啸叫。
- 不要在本包里造第二份 `particle-motions.js`/`param-panel.js` 副本。
- `prefers-reduced-motion: reduce` 时必须能停下来(一帧静态),不许继续跑 rAF。
- `preview/*.html` 里的相对引用必须落在本包内;外链只用 `https://`。
