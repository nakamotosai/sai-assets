# page-transition · 过场三档

换屏/换页别硬切。三档按代价从低到高,**先挑最省的那档**:

| 档 | 做法 | 代价 |
|---|---|---|
| `vt-layer` | 原生 View Transitions API:跨页过渡 + 背景层跨页连续 + 卡片/弹层/懒加载进出场 | 一份 CSS,跨页部分零 JS |
| `section-travel` | DOM 整块位移(下切底进 / 上切顶进),再叠字粒、阶梯、解模糊、描边、扫光 | 一份 CSS + 一份 JS,不依赖新 API |
| `text-three` | Three 粒子字:字形采样成粒子,飞入 / 炸散重组 / 层叠 / 流线汇入 | 包内 vendor three r170,首帧要建纹理与采样 |

```html
<link rel="stylesheet" href="./vt-layer.css">
<canvas id="bg" aria-hidden="true"></canvas>
<script src="./bg-boot.js" data-module="./starfield-bg.js" data-mount="mountBg" data-opacity="0.85"></script>
```

| | 值 |
|---|---|
| 跨页过渡 | 同源导航自动接管(`@view-transition { navigation: auto }`) |
| 背景连续 | 背景层单独成组、新旧帧都不加动画(旧帧盖住新页首帧空窗) |
| 可调项 | `--vt-old-ms` / `--vt-new-ms` / `--vt-rise`;`section-travel` 的 `dur` / `travel` / `variant`;`text-three` 的 `density` / `glow` |
| three | `upstream/three.module.js`(r170,MIT,保留 SPDX 头)—— 只给 `text-three` |
| 调参板 | 与 `packs/fx-engines` 同版本(`PARAM_PANEL_VERSION` 2.0.0),sha256 校验 |

- 选型判据与接线:[`docs/usage.md`](docs/usage.md)
- agent 入口:[`SKILL.md`](SKILL.md)
- 活预览:[`preview/index.html`](preview/index.html)(含 `vt-a.html` ⇄ `vt-b.html` 跨文档演示)
- 自检:`python scripts/assert_tokens.py`(三档 实现↔参数↔预览 对齐 + 版本 + sha256 + three 头)
- 实测(2026-11-03):`preview/index.html`、`preview/vt-a.html`、`preview/section-travel.html` 经本地 http 服务在 Chrome 打开、控制台 0 报错。

MIT。来源与归属见 `pack.json.attribution`。
