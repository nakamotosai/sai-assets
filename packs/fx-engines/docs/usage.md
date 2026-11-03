# fx-engines · 用法(底座:粒子引擎 + 悬浮调参板)

> 这是**底座包**:`src/fx.js`(6 个「会动」粒子 fx 的仿真引擎)与 `src/param-panel.js`(悬浮调参板标准件)。
> 这两件在本仓**只有这一份权威副本**;`packs/particle-fx`、`packs/bg-fx` 等消费方按下节两种方式之一接进来。

## 1 引用方式:拷贝 vs 引入

| 方式 | 做法 | 适用 |
|---|---|---|
| **拷贝式(生产项目)** | 把 `src/fx.js`(或 `src/param-panel.js` + `src/param-panel.css`)拷进项目,**原样保留文件头**(版本常量 + 来源行),然后在项目 `design-lock.json` 的 `assets[]` 记一行 `{ "pack": "fx-engines", "version": "1.0.0", "sha256": "<versions.json 里的值>" }` | 项目要零运行时依赖、要固定版本 |
| **引入式(同仓/多包)** | 直接 `import { makeFx } from "../../fx-engines/src/fx.js"` 相对引入(路径按自己的目录算),**不要**再拷第二份 | 本仓内的包、预览页、共享 demo |

**禁令**:禁裸拷无版本副本。旧库里 `param-panel.js` 被拷了 12 份、各自手改到互不相同(壳行为分叉、`patchParams` 只有其中一份有),漂移就是这么发生的 —— 拷可以,但必须**带着版本常量拷**,并用 §4 的方式验。

## 2 引擎接线(生产:three.js Points)

```js
import * as THREE from './three.module.js';      // 或项目自己的 three
import { FX_META, makeFx, pickFxParams } from './fx.js';

const pack = makeFx(4, 6000, 'ASSETS', { galSpin: 0.2, galArms: 2 });  // id=4 银河盘
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(pack.buf, 3));
const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xe8c578, size: 1.2 }));
scene.add(points);

// 每帧(rAF):
pack.tick(t, dt);                                  // dt 单位秒;引擎内部不 clamp,调用方 clamp 到 ≤ 0.033
geo.attributes.position.needsUpdate = true;
```

口径(踩过的坑):

- `pack.buf` 是**世界坐标 xyz**(`Float32Array`,长度 `n*3`),不是屏幕坐标;相机/正交尺度由调用方定(银河盘半径 ≈ `galRadius`,默认 36)。`makeFx` 已 `tick` 过一帧,所以首帧即有位置。
- 引擎**不做**材质与后处理(bloom / 径向色差 / 颗粒 / 暗角 / ACES 都在 `bg-fx` 的 `engine.js`)。
- `pack.getGlow()` 返回银河核球的逐点亮度(`Float32Array`)或 `null`;有值就乘进点大小/透明度,核球才有层次。
- 6 个 fx:`0 Beast 涟漪` `1 吸引子星云` `2 Curl 流体` `3 活字尘` `4 银河盘` `5 喷泉环`(`FX_META` 里有名字与英文名)。`id=3` 需要传入字标 `label`。
- 省电:降 `n`、Curl 用 `curlStride` 隔点;`document.hidden` 时别 tick;`prefers-reduced-motion` 时只画一帧。

## 3 参数 schema 用法

- **默认值权威在引擎侧**:`fx.js` 的 `FX_PARAM_DEFAULTS`(gal* / curl* 共 20 键)。UI 侧不复制这些默认值的语义,只挑要暴露给用户的那部分。
- **UI 侧 schema** = `effects/fx-engine/params.json`:`{ slug, version, defaults, schema[] }`;每个 field `{ key, label, type, tab?, min?, max?, step?, options?, swatches? }`。
- 允许的 `type`:`range` `number` `select` `checkbox` `swatch` `text`。`color` **已废弃**(面板会降级成 `text`);要收色就用 `swatch` + `swatches: ["#rrggbb", ...]`。
- 这份 params.json 的形状由 `src/param-panel.schema.json`(JSON Schema draft 2020-12)约束,可给 agent / CI 校验。
- 面板只回传 `onChange(values)`;`values` 里可能有 `n` 之类非引擎键,交给 `pickFxParams()` 过滤后再进引擎(未知键直接忽略)。
- 挂板判据:生产只在预览页(`preview.html`)或 `?lab=1` 时挂(`shouldMountLabPanel()`),线上不挂。

## 4 验版本(防漂移)

- 两个文件各自带版本常量:`FX_ENGINE_VERSION`(`src/fx.js`)、`PARAM_PANEL_VERSION`(`src/param-panel.js`)。
- `src/versions.json` 记每个交付文件 `{ file, version, sha256, source, license }`。
- 自检:`python packs/fx-engines/scripts/assert_tokens.py` —— 重算 sha256 比对 `versions.json`、比对版本常量、校验 params.json 合 schema、校验预览页引用都在包内。任一不符立即 FAIL(拷走以后手改过、或拿了旧版,都跑不过)。
- 抬版本规则:`fx.js` 行为/接口改动 → minor;修 bug → patch;删 fx / 改 `FX_PARAM_DEFAULTS` 默认值 → major。参数面板同理。

## 5 反模式

- ✗ 在项目里再拷一份 `param-panel.js` 却不记 version/hash —— 这正是旧库漂移的成因。
- ✗ 把 `pack.buf` 当屏幕坐标直接画 —— 尺度/朝向全错(银河盘半径是 36 世界单位,不是 36 像素)。
- ✗ 每帧 `new Float32Array` / 建对象 —— 每帧分配会抖;复用 `pack.buf` 与 `pack.state`。
- ✗ 用 `color` 自由取色字段 —— 面板已废弃,色板失控;用 `swatch`。
- ✗ 把后处理(bloom/ACES/颗粒)塞进 `fx.js` —— 引擎只管「动」,后处理在 `bg-fx`。
- ✗ 一个项目同时引两份引擎(一份拷贝 + 一份 `../fx-engines/src/fx.js`) —— 同页两份仿真,粒子会互相打架。

## 6 文件

| 路径 | 作用 |
|---|---|
| `src/fx.js` | 粒子引擎唯一实现:6 个 fx + `FX_META` + `FX_PARAM_DEFAULTS` + `makeFx()` |
| `src/param-panel.js` | 悬浮调参板 v2:`mountParamPanel()` / `shouldMountLabPanel()` |
| `src/param-panel.css` | 调参板样式(自带 `--tl-*` 变量,不污染宿主) |
| `src/param-panel.schema.json` | params.json 的 JSON Schema |
| `src/versions.json` | 版本 + sha256 + 来源 + 许可(验版本用) |
| `src/engine-demo.js` | 参考消费者:6 个 fx 的 2D 正交预览(只为验证引擎) |
| `src/panel-demo.js` | 调参板全字段示例 + `apply()` 样张 |
| `effects/fx-engine/params.json` | 引擎预览用的 params.json(schema + defaults) |
| `preview/index.html` | 活预览:6 个 fx + 挂板 |
| `preview/param-panel.html` | 活预览:调参板全字段 |
| `scripts/assert_tokens.py` | 断言:版本/hash/schema/引用/产物 |
