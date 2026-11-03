---
name: dual-theme-toggle
description: Add a single-button light/dark theme toggle plus a fixed-duration smooth scroll to any web page. Use when a site needs dual themes with no-flash persistence, system-preference fallback without JS, an icon-only 44px-hit-area button, or a controllable (non-browser-timed) smooth scroll.
---

# dual-theme-toggle

一个按钮的两态深浅主题 + 一个定长丝滑滚动工具。原生 JS/CSS,零依赖,拷两个文件就能用。

## When to use

- 站点要深浅两态,且要求:**刷新不闪**、**无 JS 跟随系统**、**切换有可见回执**
- 需要一个"无边框纯图标"的切换按钮(44px 热区、太阳/月亮、`aria-label`)
- 需要一个时长可控的滚动(原生 `scrollIntoView({behavior:'smooth'})` 约 300ms,定不了 2 秒)
- 页面样式已经走 CSS 变量,只差一套"深浅只翻中性色"的 token

## When not to use

- 需要三套以上主题,或主题要连带切字体 / 密度 / 语言 —— 那是主题目录 + 属性分发,不是一个按钮
- 主题要在服务端渲染时就定死(SSR 首屏必须与客户端一致且不能有内联脚本)
- 页面样式写死了色值:先改成变量,否则切了也白切

## Default

深色(`#0E0E0C` 底 / `#EDEBE4` 墨)+ 浅色(`#F5F3ED` / `#1A1A16`);强调色朱 `#CD5545` 两模共用。

| token | 深色 | 浅色 |
|---|---|---|
| `--bg` | `#0E0E0C` | `#F5F3ED` |
| `--ink` | `#EDEBE4` | `#1A1A16` |
| `--muted` | `#A3A199` | `#5B5A53` |
| `--accent` | `#CD5545`(两模同值) | `#CD5545` |
| `--accent-ink` | `color-mix(accent 86%, #FFFDF5)` = `#D76E5D` | `color-mix(accent 85%, #14140F)` = `#AE4B3D` |

## Files

| path | use |
|------|-----|
| `src/theme-toggle.css` | 语义 token(深色默认 + 浅色重映射两处)+ `.tt` 按钮样式 |
| `src/theme-toggle.js` | 切换逻辑(存储 / 视图过渡 / 跨标签页 / `themechange` 事件)+ `smoothScrollTo` + `[data-scroll-to]` |
| `preview/index.html` | 活预览:按钮 + 状态活读数 + 定长滚动样品 |
| `docs/usage.md` | **接入三行 + token 表 + API + 反模式 + 实测对比度** |
| `scripts/assert_tokens.py` | 断言:契约 / 引用 / 两处浅色映射一致 / 对比度双档 / 按钮硬项 |

## Agent apply steps

1. `<head>` 最前面贴标(防闪那一行,见 `docs/usage.md`),再引 `src/theme-toggle.css` 与 `src/theme-toggle.js`。
2. 想自定位置就写 `<button class="tt" type="button" data-theme-toggle="theme" aria-label="切换深浅主题"></button>`;不写则由 JS 找 `header` / `.topbar` / `[data-tt-mount]`,再没有就浮到右上角。
3. 页面样式**只消费** `--bg --surface --ink --muted --line --line-strong --accent --accent-ink --accent-soft --focus`;禁写死色值。
4. 彩色小字与链接一律用 `--accent-ink`;`--accent` 只给图形与大字号。
5. 有常驻动效(背景动画 / 粒子)时,在 `themechange` 或 `data-resolved` 上挂判断:浅色下停渲染,别只是把画布藏起来。
6. 自检:`python scripts/assert_tokens.py`;然后真机点一遍按钮,确认 `html[data-theme]`、`computed --bg`、`localStorage.theme` 三者同步。

## Hard rules

- 重映射选择器**必须带元素名前缀**(`html[data-theme="light"]`),写成 `[data-theme="light"]` 会被页面自己的 `:root` 压掉:属性切了、颜色纹丝不动。
- 浅色映射在 CSS 里出现两次(显式选择 / 无 JS 跟随系统),**两段必须逐字一致**;断言会比对。
- 无 JS 时按钮保持 hidden,页面跟随系统 —— 不给点不动的假开关。
- 按钮:44px 热区、15px 图标、无边框无胶囊无文字、可见焦点环;禁两个圆点并排。
- 防闪贴标必须在 `<head>`,不许挪到 `</body>` 前。
- 消费后必须在项目 `design-lock.json` 记 `assets[]`(`pack` / `version` / `sha`)。
