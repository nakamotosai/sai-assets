# locale-router · 语言路由 + 三态语言开关

静态多语言站在首帧之前决定「第一次来的人进哪一版」:参数优先(`?lang=` 永远优先并写进记忆)、深链保留(`/zh/` 不被夺回)、根路径按记忆 -> `navigator.languages` 探测 -> 默认只重定向一次、爬虫与 headless 一概不动。纯前端、零依赖、同步内联在 `<head>`,不留闪白;决策函数是纯函数,可脱离浏览器单测。

```html
<script>window.LOCALE_ROUTER_CONFIG = { locales: { en: "/", zh: "/zh/", ja: "/ja/" }, defaultLocale: "en", storageKey: "locale", param: "lang", rootPath: "/" };</script>
<script src="locale-router.js"></script><!-- 同步,不能 defer/async -->
<link rel="stylesheet" href="locale-router.css"><!-- 开关:nav.locale-switch + [data-lr-locale] -->
```

- 预览 `preview/index.html`(双击即可,无需服务器;`dryRun: true`,加载与点击都不导航)
- 用法与参数 `docs/usage.md` · agent 入口 `SKILL.md`
- 自检 `python packs/locale-router/scripts/assert_tokens.py`(含决策层干跑四种来源 + 两档对比度实测)
- 许可 MIT,归属见 `pack.json.attribution`;原站品牌词与域名已换成中性占位与可配置项,包内无盘符路径、无内网地址。
