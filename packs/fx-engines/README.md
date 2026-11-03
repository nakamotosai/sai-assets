# fx-engines · 粒子引擎 + 悬浮调参板(底座)

一个引擎,**6 个持续仿真的粒子 fx** + 一块 **schema 驱动**的悬浮调参板。本仓唯一权威副本:别再各自 fork。

```js
import { makeFx } from './src/fx.js';
const pack = makeFx(4, 6000, 'ASSETS', { galSpin: 0.2 });   // 4 = 银河盘
// 每帧:pack.tick(t, dt) → 世界坐标写进 pack.buf → 你的 three.js Points
```

| fx id | 名字 | 一句话 |
|---|---|---|
| 0 | Beast 涟漪 | 径向波前 + 弹跳沙(电台背景同款) |
| 1 | 吸引子星云 | 多引力核拖曳 |
| 2 | Curl 流体 | 噪声流场卷云,永不静 |
| 3 | 活字尘 | 组字目标 + 呼吸尘(需给字标) |
| 4 | 银河盘 | 对数螺线臂 + 核球 + 差速 |
| 5 | 喷泉环 | 中心喷发 + 同心滑行环 |

| | 值 |
|---|---|
| `FX_ENGINE_VERSION` | `1.0.0` |
| `PARAM_PANEL_VERSION` | `2.0.0` |
| 输出 | `pack.buf` 世界坐标 xyz(`Float32Array`,长 `n*3`) |
| 每帧 | `pack.tick(t, dt)` · `pack.getGlow()` 银河逐点亮度 |

- 引用方式(拷贝 vs 引入)、接线、schema、**验版本**、反模式:[`docs/usage.md`](docs/usage.md)
- agent 入口:[`SKILL.md`](SKILL.md)
- 活预览:[`preview/index.html`](preview/index.html)(6 fx + 挂板) · [`preview/param-panel.html`](preview/param-panel.html)(面板全字段)
- 自检:`python scripts/assert_tokens.py`(版本常量 + sha256 + params schema + 预览引用)
- 实测(2026-11-03):`preview/index.html` 与 `preview/param-panel.html` 在 Chrome 打开、控制台 0 报错;6 个 fx 全部出图。

MIT。来源与归属见 `pack.json.attribution`;每个文件带版本常量与来源行,`src/versions.json` 记 sha256。
