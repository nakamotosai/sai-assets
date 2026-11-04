---
name: motion-kit
description: Add a dependency-free motion layer to long pages and landing pages — scroll reveal with blur, per-word headline rise, stagger groups, counters, card tilt with a pointer spotlight, magnetic controls, a custom cursor with contextual labels, a hero canvas particle field lit by the pointer, a scroll-linked process rail, image parallax, a top progress line, active-section nav highlighting, height-animated FAQ, and a circular View-Transition theme swap. Every module boots only when its markup exists; the whole layer disappears under prefers-reduced-motion and without JS.
---

# motion-kit · 动效层(十模块)

两个文件(`motion.css` + `motion.js`),一层动效:**滚动入场**、**逐字上浮**、**错峰**、**计数**、**倾斜+指针光斑**、**磁吸**、**自定义光标+上下文标签**、**首屏粒子场+指针光**、**过程轨道**、**图片漂移**、**顶部进度线**、**导航当前段**、**FAQ 高度折叠**、**明暗切换的圆形揭示**。

设计前提只有两条:**渐进增强**(没有 `js-motion` / `motion-ready` 类时,所有动效规则不命中,页面就是静态排版)与**按需启动**(每个模块都先找自己的标记,找不到就 `return`,不占帧)。

## When to use

- 长页 / 落地页 / 作品集要给"一层入场与指针反馈",但不想引 GSAP / Lenis / Motion One 之类运行时。
- 需要**只取其中几个模块**:页面上不放对应标记,其余模块完全不启动。
- 需要动效**在减少动效与无 JS 时整体消失**,而不是靠一堆 `@media` 打补丁。
- 需要首屏一块"轻"的动态场(2D 粒子连线,粒子数按面积夹在 26–88),而不是 WebGL 重背景。
- 站点已有自己的主题切换按钮,只想加"切换那一刻的圆形揭示"过场。

## When not to use

- 需要 3D / WebGL / 满屏重背景(走 `bg-fx`、`three-fx`)。
- 需要整页翻页过场,或文字解散后再聚成新字(走 `page-transition`)。
- 需要压在四角的竖排跑马灯导航(走 `nav-rail-marquee`)。
- 要的是「深浅两态按钮 + 无闪切换」本身(走 `dual-theme-toggle`;本包只做切换那一刻的 View Transition)。
- React / Vue 组件封装(这是无依赖经典脚本层,`<script defer>` 一条)。

## Files

| path | use |
|---|---|
| `src/motion.css` | 动效层全部样式:入场态、指针层、跑马灯、轨道、光标、View Transition。只依赖宿主的颜色 token(见 `docs/usage.md` §2) |
| `src/motion.js` | 无依赖经典脚本:共享滚动帧、IntersectionObserver 入场、倾斜/磁吸/光标、粒子场、轨道、漂移、进度线、导航当前段、FAQ、主题过场 |
| `preview/index.html` | 舞台页:首屏场 + 跑马灯 + 计数 + 轨道 + 倾斜/磁吸/光标 + 漂移卡 + 折叠 + 明暗过场,双击即开 |
| `docs/usage.md` | 接入步骤、宿主 token 清单、模块与标记对照表、参数、性能口径、反模式 |
| `scripts/assert_tokens.py` | 自检:元数据 / 声明路径 / 预览引用解析 / 产物非空 / 关键实现标记 / 无站点专有标识 |

## Agent apply steps

1. 读 `docs/usage.md` §2 的宿主 token 清单(`--background` `--foreground` `--muted` `--muted-soft` `--border-hairline` `--border-control` `--surface-hover` `--card`),确认项目里已经有;没有就补一份 `:root`。
2. 把 `src/motion.css` 与 `src/motion.js` 拷进项目静态资源目录,页面 `<head>` 引 CSS。
3. 在 `<head>` 里**(同步、内联)**放启动脚本:非 `prefers-reduced-motion` 时给 `<html>` 挂 `js-motion`,并在 2500ms 后若仍无 `motion-ready` 则摘掉 —— 这段是防"入场态卡死"的兜底,`docs/usage.md` §1 有可直接抄的 6 行。
4. 按 `docs/usage.md` §3 的对照表给元素加标记(`data-reveal` / `data-split` / `data-count` / `data-tilt` / `data-magnetic` / `data-cursor-label` / `data-hero*` / `data-process`),宿主 class(`.site-header` `.nav` `.work-card` `.faq-item` `.ticker` `.scroll-progress` 等)按表保留原名。
5. `<script src="motion.js" defer></script>` 放一次即可,不要重复引入。
6. 宿主若有主题切换,把"应用主题"的函数挂到 `window.motionKit.applyTheme`,并在切换按钮里改调 `window.motionKit.viewTheme(next)`(没有该函数时脚本会自己降级,不报错)。
7. 自检:`python packs/motion-kit/scripts/assert_tokens.py`;页面侧验四件事 —— 关 JS 内容全可见、系统「减少动效」时无位移无跑马灯、Tab 焦点环可见、首屏场在切后台/离开视口时停帧。

## Hard rules

- **不许改标记名与宿主 class 名**:`motion.js` 按 `data-*` 与 `.site-header` / `.nav` / `.work-card` / `.work-media img` / `.faq-item` / `.process-track` / `.scroll-progress` 找目标,改名必须同步改脚本。
- **`js-motion` 必须在 `<head>` 同步挂上**,且必须带 2500ms 兜底;否则入场元素会永久停在 `opacity: 0`。
- **`prefers-reduced-motion: reduce` 是硬停**:`motion.css` 末尾那块不许删;脚本在文件顶部就直接 `return`(不注册任何监听)。
- 指针类模块(tilt / magnetic / cursor)只在 `pointer: fine` 下启用,别改成"有指针就上"。
- 粒子场帧循环必须在**页面隐藏或离开视口时停帧**;`devicePixelRatio` 上限 1.5,粒子数上限 88,不许为了"更密"抬这两个数。
- 中文 / 日文标题要逐字上浮时用 `data-split="chars"`(按码位切);默认的空白切词对无空格语言只会切出一个 token,看起来像"没效果"。
- 入场元素不要手写 `opacity: 0` 兜底 —— 入场态由 `html.js-motion [data-reveal]` 统一给,手写会绕过无 JS 降级。
- FAQ 用原生 `<details>/<summary>`,高度用 `scrollHeight` 量出来再过渡,不许写死 `max-height` 猜值。
- 同一页只引一次脚本;`init*` 都在 `boot()` 里跑,不要自己再调一遍。
- 消费后必须在项目 `design-lock.json` 记 `assets[]`(`pack` / `version` / `sha`)。