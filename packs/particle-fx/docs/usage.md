# particle-fx · 用法(六档粒子效果)

> 六档 = 四个 canvas 2D 变体(共用 `src/particle-motions.js`)+ 滚动组字 + 音频反应黑洞盘。
> 全部**零构建、零依赖**(除 `void-audio` 需要 `upstream/three.module.js`);每档一个预览页,参数走标准调参板。

## 1 六档清单

| entry id | 实现 | 预览 | 适用 |
|---|---|---|---|
| `text-push` | `src/concepts/text-push.js` → `particle-motions.js` | `preview/text-push.html` | 字标/标题级粒子组字,光标交互 |
| `starfield` | `src/concepts/starfield.js` → `particle-motions.js` | `preview/starfield.html` | 星野背景,低干扰 |
| `galaxy` | `src/concepts/galaxy.js` → `particle-motions.js` | `preview/galaxy.html` | 银河盘视觉,可当章节封面 |
| `curl` | `src/concepts/curl.js` → `particle-motions.js` | `preview/curl.html` | 云絮流场,抽象氛围 |
| `scroll-morph` | `src/concepts/scroll-morph.js` | `preview/scroll-morph.html` | 滚动/自动循环的散开↔组字 morph |
| `void-audio`(可选) | `src/concepts/void-audio.js` + `void-fx.js` | `preview/void-audio.html` | 音频反应黑洞盘(麦克风/直播流/假频谱) |

前四档是**同尺寸轻量示意**(canvas 2D,点数 900–1400 级);要生产级密度与 three.js 粒子池,
用 `packs/fx-engines` 的 `src/fx.js`(同一套「会动」思路,6 个 fx)。

> 点数与尺度是按**卡片/区块尺寸**定的(源件本来是墙上的卡片):放全屏当英雄区会显稀
> (`galaxy` / `curl` 尤其明显)。要么把 `density` 拧到 2.0,要么直接上 `fx-engines` 的生产引擎。

## 2 接线(三种)

```js
// A. 预览页这种「整套」接法:读 params.json + 挂标准调参板 + 把值交给 mount()
import { bootEntry } from './src/entry-boot.js';
import { mount } from './src/concepts/galaxy.js';
bootEntry({ slug: 'galaxy', mount, container: document.querySelector('#stage'), corner: 'br' });

// B. 只要效果,不要面板
import { mount } from './src/concepts/curl.js';
const handle = mount(canvas, { density: 1, dotScale: 1, gold: '#e8c578' });
handle.destroy();                  // 卸载

// C. 自己管参数(有 update() 的档位会原地改参,没有的就重建)
handle.update?.({ density: 1.4 });
```

- `mount(container, params)` 返回 `{ update?, destroy }`;`container` 可以是 `<canvas>`(`text-push`/`starfield`/`galaxy`/`curl`)或宿主元素(`scroll-morph` 自建 canvas、`void-audio` 自建整套壳)。
- 所有档位同时尊重 `prefers-reduced-motion`:4 个变体画一帧静态点阵,`scroll-morph` 停在字形端,`void-audio` 只渲染一帧。
- 这些是 2D 示意,不做 3D 光照/bloom;要后者请走 `bg-fx` / `fx-engines`。

## 3 音频反应档(void-audio)的音源、权限与降级

| 档位 | 触发 | 依赖 | 失败时 |
|---|---|---|---|
| **假频谱** | 默认 / 点「假频谱」 | 无(合成 ambient,零权限零网络) | —— 永远可用 |
| **麦克风** | 点「接麦克风」(`getUserMedia`) | 用户手势 + 授权;非 https 的远端页面浏览器会直接拒绝 | 拒绝(`NotAllowedError`)或环境无 `getUserMedia` → 回落假频谱,HUD 写明原因 |
| **直播流** | URL 加 `?stream=https://…` 后点「听直播流」 | 音频流必须放行 CORS,否则端口只出静谱 | 播放失败 → 回落假频谱;给的不是 `https://` 时按钮直接禁用 |

麦克风档**只做分析不接扬声器**(接上去会啸叫);「静音」只对直播流有意义。
验收降级路径的方法:不开流、不点麦克风直接开页面 = 假频谱档;点麦克风后拒绝授权 → HUD 必须显示「麦克风被拒 → 假频谱」而画面继续动。

## 4 参数 schema

- 每档一份 `effects/<entry>/params.json`:`{ slug, version, defaults, schema[] }`;面板按 `schema` 渲染控件,`onChange` 回传整份值。
- 允许的 `type`:`range` `number` `select` `checkbox` `swatch` `text`。颜色一律走 `swatch` + `swatches` 有限色板(不用自由取色)。
- 字段形状由 `packs/fx-engines/src/param-panel.schema.json` 约束;面板实现同样来自 `packs/fx-engines`。
- 参数只暴露「实现真的读了」的键:`text-push` 没有 `spin`,`starfield` 没有 `text` —— 死旋钮不进 params.json。

## 5 验版本(防漂移)

- `src/param-panel.js` 是从 `packs/fx-engines` **拷来的同一版本**(`PARAM_PANEL_VERSION` = `2.0.0`),`src/versions.json` 记 sha256;改面板请改 fx-engines 再整份替换,不要在本包手改。
- `particle-motions.js` 源库里曾有**四份内容相同的手拷副本**,所以本包只留一份并带 `PARTICLE_MOTIONS_VERSION`;`void-fx.js` 带 `VOID_FX_VERSION`。
- 自检:`python packs/particle-fx/scripts/assert_tokens.py`(版本常量 + sha256 + 参数一致性 + 预览引用 + 产物齐备)。

## 6 反模式

- ✗ 每帧 `new` 数组/对象 —— 这些都是逐帧循环,复用数组即可(实现里已经是就地累加)。
- ✗ 把点数量调到 4 万又想要 60fps —— `scroll-morph` 的 `count` 在 embed 尺寸下会被内部降到 8% 左右,别指望全量。
- ✗ 在非 https 的远端页面用麦克风 —— 浏览器直接拒;要演示就本机起个静态服务。
- ✗ 给粒子档加 bloom/色差 —— 本包是 2D 示意;后处理请走 `bg-fx`。
- ✗ 把 `void-audio` 当默认背景 —— 它是**可选 entry**:没有音频权限时只能跑假频谱,视觉信息量低于 5 个纯粒子档。

## 7 文件

| 路径 | 作用 |
|---|---|
| `src/particle-motions.js` | 四个 canvas 变体(text-push / starfield / galaxy / curl) |
| `src/concepts/*.js` | 每档入口(读参数 → 调实现 → 返回 `{update?, destroy}`) |
| `src/concepts/void-fx.js` | 黑洞盘 WebGL 渲染器(单 shader) |
| `src/concepts/void-audio.js` | 音频反应接线(音源三档 + 降级 + 面板同步) |
| `src/entry-boot.js` | 预览页共用:params.json → 调参板 → mount() |
| `src/util.js` | `hexToRgb` / `reducedMotion` / `coalesce` |
| `src/param-panel.js` `src/param-panel.css` | 标准调参板(与 fx-engines 同版本) |
| `src/stage.css` | 预览页共用舞台样式 |
| `src/versions.json` | 版本 + sha256 + 来源 + 许可 |
| `effects/<entry>/params.json` | 六份参数定义 |
| `preview/*.html` | 索引 + 六个预览页 |
| `upstream/three.module.js` | three r170(MIT,保留 SPDX 头),只给 `void-audio` 用 |