# particle-fx · 六档粒子效果

轻量粒子层:星野 / 银河盘 / 云絮流场 / 字标粒子 / 滚动组字 / 音频反应黑洞盘。零构建,**除音频档外零依赖**。

```js
import { mount } from './src/concepts/galaxy.js';
const fx = mount(document.querySelector('#stage'), { density: 1, spin: 0.14 });  // { destroy() }
```

| entry | 一句话 | 预览 |
|---|---|---|
| `text-push` | 字形采样成点阵,光标推散、松手弹回 | `preview/text-push.html` |
| `starfield` | 定种星场 + 微漂 + 闪烁 | `preview/starfield.html` |
| `galaxy` | 核球 + 对数螺线臂 + 盘雾 | `preview/galaxy.html` |
| `curl` | 正弦流场 + 5 个移动引力核 | `preview/curl.html` |
| `scroll-morph` | 散开 ↔ 组字,6.5s 一个循环 | `preview/scroll-morph.html` |
| `void-audio`(可选) | 音频反应黑洞盘:麦克风 / 直播流 / 假频谱 | `preview/void-audio.html` |

| | 值 |
|---|---|
| 四档共用 | `src/particle-motions.js`(`PARTICLE_MOTIONS_VERSION` 1.0.0) |
| 调参板 | 与 `packs/fx-engines` **同版本**(`PARAM_PANEL_VERSION` 2.0.0),sha256 校验 |
| 音源降级 | 麦克风被拒 / 流失败 → 假频谱(零权限),HUD 写明原因 |
| three | `upstream/three.module.js`(r170,MIT,保留 SPDX 头)—— 只给音频档 |

- 接线与音源细节:[`docs/usage.md`](docs/usage.md)
- agent 入口:[`SKILL.md`](SKILL.md)
- 活预览(索引):[`preview/index.html`](preview/index.html)(需经 http 服务打开)
- 自检:`python scripts/assert_tokens.py`(条目 ↔ 实现 ↔ 参数 ↔ 预览 对齐 + 版本 + sha256)
- 实测(2026-11-03):`preview/galaxy.html` 与 `preview/index.html` 在 Chrome 打开、控制台 0 报错。

MIT。来源与归属见 `pack.json.attribution`。
