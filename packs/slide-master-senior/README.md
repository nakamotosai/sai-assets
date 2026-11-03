# slide-master-senior · 中老年大字号 Slide 母版(封面 + 时间线)

1920×1080 一页一卡的演示母版:封面页(右侧通高图位 + 左双轨)与行程时间线页(禁表格)。正文 18.5–21px、内页标题 44–48px、行高 1.65–1.75,内容区固定 1000px(1000 法则);键盘 ← / → 与滚轮翻页、页码自动同步,`prefers-reduced-motion` 下直接跳页;`@page 1920x1080` 可直接打印成 PDF 一页一卡。

```html
<link rel="stylesheet" href="src/deck.css">
<script src="src/deck.js" defer></script>
```

- 活预览:`preview/index.html`(1440 视口下页卡仍是 16:9,`file://` 直开可用)
- 接入与排版口径:`docs/usage.md` · agent 入口:`SKILL.md`
- 自检:`python scripts/assert_tokens.py`
- 许可:MIT(归属见 `pack.json.attribution`)
