---
name: fx-engines
description: Reuse the shared particle-fx engine (6 simulated effects) and the floating param panel component in any web project. Use when a page needs continuous particle simulation (beast ripple, attractors, curl flow, living glyph, galaxy disk, fountain rings) or a schema-driven floating tuning panel, and when you must avoid forking those files per project.
---

# fx-engines

底座包:**粒子引擎**(`src/fx.js`,6 个持续仿真的 fx)+ **悬浮调参板**(`src/param-panel.js`,schema 驱动)。
本仓里这两件只有这一份权威实现;拷贝可以,**必须带版本常量拷**,并用 sha256 验。

## When to use

- 要做「会动」的粒子背景/舞台:径向波前、吸引子星云、Curl 流场、活字尘、银河盘、喷泉环。
- 要给 demo/工具页挂一块**schema 驱动**的悬浮调参板(range/number/select/checkbox/swatch/text + 分页 + 拖拽 + 缩放)。
- 项目里已经散着几份 `param-panel.js` 副本、行为各不相同(漂移)时:换成本包这一份。

## When not to use

- 只要一层静态点阵/星点(用 `page-transition` 的 `starfield-bg.js` 更便宜)。
- 要的是「背景满屏 + bloom/ACES 后处理链」(用 `bg-fx`)。
- 要的是页面/文字过场(用 `page-transition`)。
- 要 Three 粒子字(用 `page-transition` 的 `text-three`)。

## Default

`makeFx(id, n, label, params)` —— 默认 `n` 由调用方给(6000 是预览值);fx id:`0 Beast` `1 吸引子` `2 Curl` `3 活字尘` `4 银河盘` `5 喷泉环`。

| 键 | 值 |
|---|---|
| `FX_ENGINE_VERSION` | `1.0.0` |
| `PARAM_PANEL_VERSION` | `2.0.0` |
| 输出 | `pack.buf` = 世界坐标 xyz(`Float32Array`,长 `n*3`) |
| 每帧 | `pack.tick(t, dt)`(dt 秒,调用方 clamp ≤ 0.033) |

## Variants and axes

| 轴 | 取值 | 说明 |
|---|---|---|
| fx | `0..5` | 见上;`makeFx`/`fxById` 轮转取模 |
| 粒子数 | `n` | 200–20000;`curlStride` 隔点省 CPU |
| 银河参数 | `FX_PARAM_DEFAULTS` 的 `gal*` | `galTilt/galYaw/galLift/galRadius/galSpin/galArms/galPitch/galScatter/galBulge/galCoreBright` |
| Curl 参数 | `FX_PARAM_DEFAULTS` 的 `curl*` | `curlSpeed/curlScale/curlStride/curlBound/curlBright/curlTurb/curlDensity` |
| 面板定位 | `corner` | `tl/tr/bl/br`;`is-collapsed` 时收成右下角方块 |

## Files

| path | use |
|---|---|
| `src/fx.js` | 引擎唯一实现(6 fx + `makeFx` + `FX_PARAM_DEFAULTS`) |
| `src/param-panel.js` / `src/param-panel.css` | 调参板 js/css |
| `src/param-panel.schema.json` | params.json 的 JSON Schema |
| `src/versions.json` | 版本 + sha256(验版本权威) |
| `src/engine-demo.js` / `src/panel-demo.js` | 参考消费者(预览用) |
| `effects/fx-engine/params.json` | 引擎预览的 params.json |
| `preview/index.html` / `preview/param-panel.html` | 活预览 |
| `docs/usage.md` | **引用方式 / 接线 / schema / 验版本 / 反模式** |

## Agent apply steps

1. 读 `src/versions.json` 拿 `version` 与 `sha256`;决定**拷贝式**还是**引入式**(见 `docs/usage.md` §1)。
2. 拷贝式:把 `src/fx.js`(或 `param-panel.js` + `param-panel.css`)拷进项目,**保留文件头**;在项目 `design-lock.json` 的 `assets[]` 记 `pack/version/sha256`。
3. 引擎接线:`makeFx(id, n, label, params)` → `BufferAttribute(pack.buf, 3)` → 每帧 `pack.tick(t, dt)` + `needsUpdate = true`;`pack.getGlow()` 有值就乘进点大小。
4. 调参板接线:`fetch('./params.json')` → `mountParamPanel({ params, corner, onChange })`;`onChange` 里把值交给 `pickFxParams()` 再进引擎。
5. 自检:`python packs/fx-engines/scripts/assert_tokens.py`(版本/hash/schema/引用/产物),再跑一次预览页(`preview/index.html`、`preview/param-panel.html`)看控制台 0 报错。

## Hard rules

- **禁裸拷无版本副本**:拷贝必须带 `FX_ENGINE_VERSION` / `PARAM_PANEL_VERSION`,并在项目里记 sha256;`src/versions.json` 是比对基准。
- 引擎只管「动」:bloom/色差/颗粒/ACES 等后处理**不进** `fx.js`(那属于 `bg-fx`)。
- `pack.buf` 是世界坐标,不是屏幕坐标;尺度/相机由调用方定。
- 每帧零分配:复用 `pack.buf`/`pack.state`,不要在 tick 路径里 `new`。
- 颜色走 `swatch` 有限色板,不用 `color` 自由取色(面板已废弃该类型)。
- `prefers-reduced-motion: reduce` 时只渲染一帧静态画面,不要继续跑 rAF。
