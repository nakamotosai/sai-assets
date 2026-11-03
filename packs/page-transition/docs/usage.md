# page-transition · 用法(过场三档:先选档,再接)

> 三档解决的是同一件事:**换屏/换页时别硬切**。但它们的能力与代价差一个量级,顺序永远是:
> **原生 API 优先 → 不行再上主包体过场 → 只有需要「粒子字」才上 Three。**

## 1 选档决策(何时用哪一档)

| 判据 | 用哪档 |
|---|---|
| 多页静态站(每次跳转都是新文档)、浏览器支持 View Transitions | **`vt-layer`**:一份 CSS 就接管翻页;再叠页内卡片进出场 / 弹层开合 / 懒加载淡入 |
| 单页内多屏切换,或目标浏览器不支持 View Transitions,或要「整块 DOM 一起位移」 | **`section-travel`**:纯 DOM + CSS,**不依赖任何新 API**;位移可双向对称 |
| 需要文字本身变成粒子(组字 / 炸散重组 / 流线汇入),且接受 three 的体积与首帧成本 | **`text-three`**:包内 vendor three r170 |
| 只要「淡入淡出」「上浮 8px」这类单元素动效 | 都不要用这三档,写一条 CSS transition 即可 |

两档可以叠加:`vt-layer` 管跨页 + `section-travel` 管页内某一段,不冲突(它们作用在不同层)。

## 2 vt-layer(原生 View Transitions API)

```html
<!-- 每一页、新旧文档都要有 -->
<link rel="stylesheet" href="./vt-layer.css">
...
<canvas id="bg" aria-hidden="true"></canvas>
<script src="./bg-boot.js" data-module="./starfield-bg.js" data-mount="mountBg" data-opacity="0.85"></script>
```

- 跨页:同源导航自动接管(`@view-transition { navigation: auto }`),**零 JS**。
- 背景层单独成组:`#bg { view-transition-name: bg }` + 新旧帧都不加动画 —— 旧帧保持可见,盖住新文档首帧的空窗;新画布不透明,一画出来就整体盖住。
- 页内卡片:JS **只改 inline `display`**(显示写 `''`、隐藏写 `'none'`),退场目标值交给 `.card[style*="display: none"]` 与 `transition-behavior: allow-discrete`,入场起点交给 `@starting-style`;重排(`appendChild` 挪 DOM)路径要临时挂 `.vt-skip`,否则整墙会重放入场。
- 可调项(预览页的调参板会写):`--vt-old-ms` / `--vt-new-ms` / `--vt-rise`。
- 预览必须经 http 服务打开:跨文档视图过渡与 ES module 都不在直接双击打开的页面上生效。

## 3 section-travel(DOM 整块上推/散射)

```html
<link rel="stylesheet" href="./section-travel.css">
<section class="stage is-active" data-i="0">…<div class="panel">…</div></section>
<script type="module" src="./section-travel.js"></script>
```

- 形状:三屏 + `go(n)`;`dir > 0`(往下切)= 新屏从底推上来、旧屏往上离开;`dir < 0` 对称反向。位移距离 `--travel`(vh)、时长 `--dur`(s)。
- 六个变体(`data-fx`):`chars`(整块 + 字粒)/ `travel`(纯整块)/ `stagger`(行阶梯)/ `blur`(解模糊)/ `stroke`(描边填色)/ `shine`(金线扫)。字粒的 delay 按 `--dur` 重算,所以调慢时字粒不会先落地。
- 锁:整段动画期间 `locked = true`,中途滚轮/按键会被忽略(打断会看到半截位移)。
- 可调项:`dur`(s)/ `travel`(vh)/ `variant`;`applyTravelParams(values)` 会把前两个写成 CSS 变量并同步内部锁表时长。

## 4 text-three(Three 粒子字)

```html
<canvas id="c"></canvas>
<script type="module" src="./text-three.js"></script>   <!-- 或 import 后自行驱动 -->
```

- 五种形态:`plane`(canvas 字贴平面,整板位移)/ `glyph`(字形采样成粒子飞入)/ `scatter`(旧字炸散、新字对侧聚拢)/ `depth`(多层 Z 层叠)/ `ribbon`(沿流线汇入)。
- 字形来自 `makeTextCanvas` → `sampleCanvas`(非透明像素采样),所以换文案只是换 `SECTIONS`;**粒子数 = 采样点数 × `density`**。
- 包内 `upstream/three.module.js`(r170,MIT,保留 SPDX 头)只给这一档用;其它两档不加载它。
- 可调项:`density`(0.2–1.4)/ `glow`(点大小与不透明度);`applyTextParams(values)` 改完会重建当前形态。
- 代价:首帧要建纹理 + 采样字形;`prefers-reduced-motion` 下星空停止漂移、层叠不再呼吸。

## 5 参数 schema

- 每档一份 `effects/<id>/params.json`:`{ slug, version, defaults, schema[] }`,由标准调参板(`packs/fx-engines/src/param-panel.js` 的**同版本拷贝**)渲染。
- 允许 `range` / `number` / `select` / `checkbox` / `swatch` / `text`;`select` 的 options 支持 `{ value, label }`(`section-travel` 的变体就是这么给的)。
- 字段形状由 `packs/fx-engines/src/param-panel.schema.json` 约束。

## 6 验版本(防漂移)

- `src/param-panel.js` / `src/param-panel.css` 是 `packs/fx-engines` 的**同版本拷贝**(`PARAM_PANEL_VERSION` 2.0.0),`src/versions.json` 记 sha256;要改面板请改 fx-engines 再整份替换。
- `upstream/three.module.js` 固定 r170;升级要同时改 `src/versions.json` 的 sha256 与 `pack.json.changelog`。
- 自检:`python packs/page-transition/scripts/assert_tokens.py`(三档 实现↔参数↔预览 对齐 + 版本 + sha256 + 预览引用 + three 头完整性)。

## 7 反模式

- ✗ 在需要 `section-travel` 的场合硬上 View Transitions —— 不支持该 API 的浏览器会直接硬切,观感比没有过场更差。
- ✗ 给 `vt-layer` 的旧背景帧加 `opacity: 0` —— 过渡期间背景整段消失(新页还没初始化),看起来就是「背景重新加载」。
- ✗ 用 `appendChild` 重排卡片却不挂 `.vt-skip` —— 整墙重放入场。
- ✗ 把 `text-three` 当默认过场 —— 它要下载 three、要采样字形;能用 CSS 的场合不要上 WebGL。
- ✗ 过渡中途打断(section-travel 的 `locked`)—— 会看到半截位移。
- ✗ 三档同时套在同一次切换上 —— 叠加成双重位移。

## 8 文件

| 路径 | 作用 |
|---|---|
| `src/vt-layer.css` | 跨页 + 页内动效层(原生 View Transitions,含无障碍降级) |
| `src/bg-boot.js` | 背景层引导器(普通脚本,站内翻页立即挂,首访走 idle) |
| `src/starfield-bg.js` | 演示用零依赖星空(定种 + 墙上时钟相位,翻页接着动) |
| `src/section-travel.js` / `src/section-travel.css` | 整块位移过场 + 六个变体 |
| `src/text-three.js` / `src/text-three.css` | Three 粒子字过场(五种形态) |
| `src/lab-boot.js` | 预览页共用:params.json → 调参板 → CSS 变量/参数 |
| `src/param-panel.js` / `src/param-panel.css` | 标准调参板(与 fx-engines 同版本) |
| `src/stage.css` | 预览页共用导航/提示 chrome |
| `src/versions.json` | 版本 + sha256 + 来源 + 许可 |
| `effects/<id>/params.json` | 三份参数定义 |
| `preview/index.html` + `preview/<id>.html` | 索引 + 各档预览(含 A/B 两页跨文档演示) |
| `upstream/three.module.js` | three r170(MIT,保留 SPDX 头),只给 text-three |