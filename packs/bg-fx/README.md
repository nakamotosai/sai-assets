# bg-fx · 十款 WebGL2 动态背景

**一份引擎,十个机制。** 引擎是固定的一条电影后处理链——`scene(HDR) → 亮部提取 → 可分离模糊 →
bloom + 径向色差 + 亮度门控颗粒 + smoothstep 暗角 + ACES + 三角抖动`;每个效果只写自己的
着色器(极光幕帘、域扭曲墨流、折射焦散、摩尔丝缎、拉丝金属、棱镜色散、余烬、等高线地图、暖阳、铁屑场线)。

- 活预览(索引墙):[`preview/index.html`](preview/index.html) —— 10 张卡,各自链到独立效果页,无 iframe
- agent 入口:[`SKILL.md`](SKILL.md)
- 取用片段 / 参数含义 / 反模式:[`docs/usage.md`](docs/usage.md)
- 自检:`python packs/bg-fx/scripts/assert_tokens.py` → `PASS assert_tokens bg-fx`

| | |
|---|---|
| 取用面 | `src/engine.js` + `src/concepts/common.js` + `src/concepts/<id>.js`(三文件、零构建、零依赖) |
| 旋钮 | `speed` `bloom` `exposure` `grain` `ca` `vig`(默认值在各 `effects/<id>/params.json`) |
| 性能 | DPR 封顶 1.25/1.75 · 场景半分辨率 · 泛光 1/4 分辨率 · 页隐藏与离屏整帧跳过 · 零每帧分配 |
| 无障碍 | `prefers-reduced-motion` 出静态帧(不播)· 无 WebGL2 返回 `{ok:false}` 由你兜底 · 内建标题区压暗 |

```js
import { createEngine } from "./bg/engine.js";
import { CONCEPT } from "./bg/concepts/aurora-veil.js";
const eng = createEngine(document.querySelector("#stage"), CONCEPT.frag, { speed: 0.6, bloomAmt: 0.3 });
if (!eng.ok) document.body.dataset.bgFallback = eng.reason;   // 必须兜底,别留黑画布
```