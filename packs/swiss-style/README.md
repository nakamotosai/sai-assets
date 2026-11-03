# swiss-style · 国际主义平面设计风格(版式与构件)

**只给版式与构件,不给配色**:可推导的 12 栏模块网格 + 8pt 子网格 / 24px 主基线、直角平涂控件、
海报 / deck / 跨页 / 报告封面 / 落地 hero 五套骨架、Isotype 与 small multiples 图元。
配色 token 的权威在主题包 `swiss-classic` 与 `swiss-inverted`。

```html
<link rel="stylesheet" href="styles/swiss-classic/default.css">
<link rel="stylesheet" href="styles/swiss-grid.css">
<link rel="stylesheet" href="styles/swiss-ui.css">
<link rel="stylesheet" href="styles/swiss-layouts.css">
```

- 活标本页:[`preview/index.html`](preview/index.html)(网格线开关 / 控件 / 图元 / 骨架缩略 / 入场动效)
- 配对与构造法:[`docs/usage.md`](docs/usage.md) · agent 入口:[`SKILL.md`](SKILL.md)
- 规格留存:[`docs/specs/swiss-specs.json`](docs/specs/swiss-specs.json)
- 自检:`python packs/swiss-style/scripts/assert_tokens.py`

MIT。来源与归属见 `pack.json.attribution`。