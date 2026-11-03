# dual-theme-toggle · 两态主题切换器

一个按钮的深浅两态主题:44px 热区、无边框纯图标、`aria-label`、选择写 `localStorage`、无 JS 跟随系统。
同一个文件里还有第二件工具:**定长丝滑滚动**(2 秒缓入缓出,中途用户一操作就交还控制权)。

```html
<script>document.documentElement.dataset.js='';try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;document.documentElement.dataset.resolved=t||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');}catch(e){}</script>
<link rel="stylesheet" href="src/theme-toggle.css">
<script src="src/theme-toggle.js" defer></script>
```

| | 深色(默认) | 浅色 |
|---|---|---|
| 底 | `#0E0E0C` | `#F5F3ED` |
| 墨 | `#EDEBE4` | `#1A1A16` |
| 灰 | `#A3A199` | `#5B5A53` |
| 强调 | `#CD5545`(两模共用) | `#CD5545` |
| 小字强调 | `#D76E5D` | `#AE4B3D` |

- 接入三行与 API:[`docs/usage.md`](docs/usage.md)
- agent 入口:[`SKILL.md`](SKILL.md)
- 活预览:[`preview/index.html`](preview/index.html)(右上角按钮;页内活读数实时显示 `data-theme` / `--bg` / `localStorage`)
- 自检:`python scripts/assert_tokens.py`

实测(2026-11-03):`--ink/--bg` 15.73(浅)/16.20(深),`--muted` 6.24/7.47,`--accent-ink` 4.89/5.78,`--accent` 亮度 Y=0.199(图形档 3.80/4.58)。三处浅色映射的 token 集合与深色一致。

MIT。来源与归属见 `pack.json.attribution`。
