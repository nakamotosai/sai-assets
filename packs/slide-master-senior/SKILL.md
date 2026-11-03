---
name: slide-master-senior
description: Build 1920×1080 slide masters (cover page + timeline page) for senior / low-vision audiences. Use when a task needs a presentation deck, lecture handout, or print-to-PDF page set with 18.5–21px body type, 44–48px page titles, 1.65–1.75 line-height, a 1000px content height budget, keyboard/wheel paging with page-number sync, and no table-based timelines.
---

# slide-master-senior · 中老年大字号 Slide 母版

一页 = 一张 1920×1080 页卡。排版配方是"大字号 + 1000 高度预算 + 一页一观点",翻页交给 `src/deck.js`,打印成 PDF 由 `src/deck.css` 的 `@page` 兜住。

## When to use

- 做**演示母版 / 讲义 / 可打印 PDF**:每页 1920×1080(16:9),`@page` 与 `.page` 同尺寸,打印时一页一卡。
- 读者**年龄偏大 / 字号敏感**:正文 18.5–21px,内页标题 44–48px,行高 1.65–1.75,页面不塞满。
- 需要**封面页**(右侧通高图位 + 左双轨)或**行程类时间线页**(禁表格,三栏时间轴)。
- 要**键盘翻页 + 页码同步**且页面上不放任何浮动控件(打印不残留)。

## When not to use

- 密集数据页 / 图表墙(一页塞 5 个观点、需要小字表格)——用数据向主题包。
- 需要转场动画、视频、WebGL 的营销 Demo——用动效类包。
- 手机竖屏长页 / 响应式营销页:本包是固定 1920×1080 页卡的等比缩放,不是流式布局。

## Default

| 项 | 值 |
|---|---|
| 页卡 | 1920×1080(16:9),`.inner` = 1760×1000 |
| 正文 / 标签 | 21px / 19px |
| 内页标题 / 封面主标 | 48px / 96px |
| 行高 | 1.7(标题 1.2–1.25) |
| 页底 / 墨色 / 灰档 / 强调 | `#f6f1e7` / `#071529` / `#334155` / `#b34a32` |
| 翻页 | ← / →(兼容 ↑↓ PgUp PgDn 空格 Home/End)+ 滚轮 |
| 打印 | `@page { size: 1920px 1080px; margin: 0 }`,`.page` 走 `page-break-after: always` |

## Files

| path | use |
|---|---|
| `src/deck.css` | 令牌(:root)+ 页卡 + 顶栏/眉标/按钮/页脚条 + 封面页 + 时间线页 + `@page` 打印规则 |
| `src/deck.js` | 翻页(键盘/滚轮)、页码同步(`NN / TT`)、窄视口等比缩放(`--deck-fit`)、reduced-motion 直接跳页;无依赖 |
| `preview/index.html` | 两页母版活预览(封面 + 时间线),`file://` 直开可用 |
| `docs/usage.md` | 接入片段、变量/选项表、排版硬结论、换色、反模式 |
| `scripts/assert_tokens.py` | 断言:pack.json / 引用可达 / src 非空 / 文档口径 / 禁用词 |

## Agent apply steps

1. 拷 `src/deck.css` 与 `src/deck.js` 进项目(或整包复制),页面按 `preview/index.html` 的结构搭。
2. 每页写 `<section class="page"><div class="inner">…</div></section>`;内容区**只用 1000px 预算**,塞不下就拆页。
3. 顶栏两件套:左侧 `brand` 文案,右侧页码槽位 `<span class="pageno" data-deck-pageno>01 / 03</span>`(deck.js 会同步成实际页数)。
4. 封面页用 `.cover-grid`(左 `.cover-left` 双轨 + 右 `.cover-right` 通高图位);行程页用 `<ol class="timeline">`,每条 `li` 三栏:`.t-day` / `.t-what` / `.t-note`。
5. 引 `<script src="src/deck.js" defer></script>` 即自动装配;要自己控时机就 `<html data-deck-autorun="off">` + `window.initDeck()`。
6. 换色只改 `:root` 的令牌(见 `docs/usage.md` §换色),不要改组件里的写死值。
7. 自检:`python scripts/assert_tokens.py`;浏览器里按 ← / → 与滚轮确认翻页与页码同步。

## Hard rules

- 正文 **18.5–21px** 下限;标题 **44–48px**;行高 **1.65–1.75**。塞不下拆页,不缩字号。
- **1000 法则**:`.inner` 固定 1000px 高,上下各 40px 归 1080;超出即溢出裁切。
- 时间线**禁表格**;每栏 **≤40 字**,一页 ≤7 行。
- 灰**只许 `#334155` 级**(`--ink-2`)一档;不新增灰、不用 opacity 造灰。
- 强调色面积 **<10%**(眉标/日期/主按钮);`--accent` 同时满足 6 位 hex 与中等偏深亮度。
- 颜色与字号全走 `:root` 令牌,组件里不写死 hex。
- 页面上**不放浮动控件/悬浮面板**;打印规则保持 `@page 1920x1080` + `.page { page-break-after: always }`。
- 预览必须 `file://` 直开可用:相对路径引用,禁 `fetch()`、禁绝对路径、禁外部 CDN。
- `prefers-reduced-motion: reduce` 下翻页用 `instant`(不做平滑滚动)。
- 消费后必须在项目 `design-lock.json` 记 `assets[]`(`pack`/`version`/`sha`)。
