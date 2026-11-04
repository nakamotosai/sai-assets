---
name: locale-router
description: Pick the right language version on a static multilingual site before the first paint — keep a ?lang= parameter always winning and remembered, never steal a deep link such as /zh/, resolve the root path once from memory then navigator.languages then the default, and leave crawlers and headless clients alone. Ships a synchronous, dependency-free script that can be inlined in <head>, plus a three-state locale switch (rest / hover / current aria-current) with a focus ring. Use when a static multi-page site needs a first-visit language decision and a header language switch.
---

# locale-router · 语言路由 + 三态语言开关

静态多语言站的「第一次来的人进哪一版」:**纯前端、零依赖、可同步内联在 `<head>`**,首帧之前就把语言定下来。
四条规则:**参数优先**(`?lang=` 永远优先并写进记忆)、**深链保留**(`/zh/` 不被夺回)、**根路径单次重定向**(记忆 -> `navigator.languages` 探测 -> 默认)、**爬虫放行**(爬虫 / headless 一概不动)。配一枚三态语言开关(静息 / 悬停 / 当前 `aria-current="page"`)。

## When to use

- 多语言静态站要决定「第一次来的人进哪一版」:根路径按记忆或 `navigator.languages` 探测后**只重定向一次**。
- 带 `?lang=` 的参数**永远优先**并写进记忆(分享链接、广告落地页、外包跳转全靠它)。
- 深链(如 `/zh/`)不被夺回:别人发来的具体版本链接就停在那里。
- 爬虫与 headless 一概不动,收录与监控截图不会拍到另一版语言。
- 需要一枚放头部、三态清楚、带焦点环、当前态走 `aria-current` 的语言开关。
- 要求纯前端、无依赖、可同步内联在 `<head>` 里跑,不留闪白;决策函数还要能脱离浏览器单测。

## When not to use

- 需要服务端按 `Accept-Language` 内容协商或构建期生成 `hreflang` —— 那是构建 / 边缘侧的事,本包是浏览器侧的一次性决定。
- 需要完整 i18n 运行时(文案抽取、复数与格式化):走专门的 i18n 库,本包只管「去哪一版」。
- 单语言站:没有第二版可进。
- SPA 内置路由前缀(路由自己管语言段):两边都会改 URL,只能留一个执行者。

## Files

| path | use |
|---|---|
| `src/locale-router.js` | 无依赖经典脚本:配置合并、纯函数 `decide()`、真入口 `run()`、`mark()` 同步 `aria-current` |
| `src/locale-router.css` | 语言开关样式(`.locale-switch` 作用域;三态 + 焦点环 + 减少动效降级) |
| `preview/index.html` | 决策演示:语言开关 + 五种输入的「谁赢」表 + 可折叠推演器(加载绝不跳转) |
| `docs/usage.md` | 接入步骤 + 参数表 + 与源脚本的逐条对照 + 无障碍硬项 + 反模式 |
| `scripts/assert_tokens.py` | 自检:元数据 / 声明路径 / 引用解析 / 产物非空 / 文档与实现标记 / 决策层干跑 / 对比度实测 |

## Agent apply steps

1. 读 `src/locale-router.js` 顶部的 `DEFAULTS`,确认要覆盖哪几个字段;站点配置写在 `<head>` 里脚本**之前**那段 `<script>`。
2. 把 `src/locale-router.js`、`src/locale-router.css` 拷进项目静态资源目录。
3. 在 `<head>` 内同步加载(**不能** `defer` / `async`),片段的字段名见 `docs/usage.md` 的「接入步骤」。
4. 每个语言版本页面把语言写进 `<html lang="…">`(脚本靠它判断当前在哪一版)。
5. 语言开关：`<nav class="locale-switch" aria-label="语言">` + 每个可点项一个 `[data-lr-locale="<code>"]`,链接带 `href` / `hreflang` / `lang`;当前项写 `aria-current="page"`,或 DOM 就绪后调一次 `LocaleRouter.mark()`。
6. 需要手动控制(单页应用、条件加载)就设 `auto: false`,自己在合适时机调 `LocaleRouter.run()`;只想看「会怎么决定」就设 `dryRun: true`(`run()` 返回决定对象但不写记忆、不导航)。
7. 自检:`python packs/locale-router/scripts/assert_tokens.py`;页面侧检查五件事 —— 首屏语言正确、`?lang=` 落在一版后刷新仍在同版、深链不被搬走、开关当前态与 `<html lang>` 一致、Tab 能走到每个开关项且焦点环可见。

## Hard rules

- 脚本必须**同步**内联在 `<head>` 且配置在它之前;`defer` / `async` / 挪到 `</body>` 都会让用户先看到错的一版再被换掉。
- 四条规则的判断顺序不许改:参数 -> 深链 -> 爬虫 -> 根路径决定。把深链检查挪到参数前面,`?lang=` 就失效;把爬虫检查挪到参数后面,爬虫会被参数带走。
- 只用 `location.replace`,不用 `assign`;锚点(`location.hash`)必须原样拼到跳转目标后面。
- 跳转目标路径是 `locales` 里的字面量(不补也不删斜杠);路径比较忽略尾斜杠,但改 URL 时不许顺手 normalize。
- 爬虫 / headless 名单(`ROBOT_RE`)逐条保留,不许精简 —— `headless` / `lighthouse` / `pagespeed` / `monitoring` 是给预览与监控用的。
- 当前态只走 `aria-current="page"`,由 `mark()` 或服务端模板写;禁止 `.is-active` 之类第二套高亮。
- `decide()` 保持纯函数:不读 `location`、不写存储、不导航;要碰浏览器状态就走 `run()`。
- 开关命中区只增不减(`--lr-hit`);触屏页给到 44px;`:focus-visible` 与 `prefers-reduced-motion` 两条别删。
- 预览必须加载不跳转:配置里 `dryRun: true`,并把模拟输入交给 `decide()` 现算,不许写死结论。
- 不在包内写自有域名、盘符路径、内网地址或客户代号;示例域名用中性占位。
- 消费后必须在项目 `design-lock.json` 记 `assets[]`(`pack` / `version` / `sha`)。
