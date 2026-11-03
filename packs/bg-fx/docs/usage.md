# bg-fx · 用法与配对规则

十款 WebGL2 动态背景共用**一份引擎**。引擎负责"片子质感",concept 负责"这是个什么东西"——
两者加起来才是一块背景;只留引擎就是一团会动的雾(见 §反模式)。

## 取用(两种,都不要构建工具)

**A · 只拿走一个效果**(项目里写死一个背景,最常见):

```js
// 1) 拷这两个文件进项目:src/engine.js + src/concepts/<id>.js(concept 里 `import { COMMON } from "./common.js"`,
//    所以 src/concepts/common.js 也要一起拷——共 3 个文件,零依赖、零构建)
import { createEngine } from "./bg/engine.js";
import { CONCEPT } from "./bg/concepts/aurora-veil.js";

const eng = createEngine(document.querySelector("#stage"), CONCEPT.frag, {
  speed: 0.6,      // 引擎内部用累积时间,随时变速不跳帧
  bloomAmt: 0.30,
  exposure: 1.0,
  grain: 0.030,
  ca: 0.0026,
  vig: 0.5,
});
if (!eng.ok) document.body.dataset.bgFallback = eng.reason;   // 见 §无障碍:必须自己兜底
// eng.set(key, value) 热改任意参数;eng.setSpeed(0..1) 单独改速度;eng.stop() 停帧
```

`#stage` 得是一个已存在的 `<canvas>`(引擎自己管尺寸与 DPR),外层样式见 `src/stage.css`——
它只做三件事:`fixed inset:0` 的舞台、左上角 HUD、左下角一行提示。真用起来换掉 HUD 就行。

**B · 整块铺开当索引墙**:打开 [`../preview/index.html`](../preview/index.html),
每张卡链到 [`../effects/<id>/index.html`](../effects/aurora-veil/index.html)。
**一页只开一个 effect**:10 个 WebGL2 上下文同屏会被浏览器回收,墙是链接墙,不是网格画廊。

## 参数

十个效果的 `effects/<id>/params.json` 目前是同一套旋钮(每个效果可以各自分化,但默认值相同),
它是"后处理链旋钮",**不是**效果本身的形状参数——形状在 concept 的着色器里。

| key | 默认 | 范围 | 含义 / 怎么调 |
|---|---|---|---|
| `speed` | 100 | 0–100(%) | 动画速度倍率。0 = 冻帧(截图、打印、`prefers-reduced-motion` 的替代)。引擎用累积时间,所以 0↔1 来回拖不会跳帧 |
| `bloom` | 0.30 | 0–0.8 | 泛光强度。阈值固定 1.0(只吃 HDR >1 的发射体),所以它放大的是"光"而不是"整体":调到 0.6 以上时亮部会开始糊掉细节 |
| `exposure` | 1.0 | 0.5–2.0 | ACES tonemap 之前的曝光。与 `bloom` 的区别:曝光动全画面,泛光只动高光 |
| `grain` | 0.030 | 0–0.08 | 胶片颗粒。**亮度门控**:纯黑与过曝区几乎不加,只在中灰加;屏幕越大越要往 0.02 收 |
| `ca` | 0.0026 | 0–0.010 | 径向色差:中心为 0,按 r² 增长。>0.006 会开始"廉价镜头感",只在暗底效果上用 |
| `vig` | 0.5 | 0–1.0 | 暗角(smoothstep,不是线性)。它同时兼"把视线压回中心"的构图职责 |

引擎里另外两个**不进 params.json** 的旋钮(它们属于部署决策,不是设计参数):

| key | 默认 | 含义 |
|---|---|---|
| `dprCap` | 弱设备 1.25 / 桌面 1.75 | 设备像素比上限。`devicePixelRatio` 不封顶时 4K 屏会多烧 2–3 倍像素 |
| `threshold` | 1.0 | 亮部提取阈值。场景是线性 HDR,降到 0.8 会让泛光把中灰一起吃掉 |

效果清单(机制一句话;完整机制注释在各 `src/concepts/<id>.js` 头部):

| id | 主题 | 机制(不是"平均色"的地方) |
|---|---|---|
| `lumen-river` | dark | 域扭曲墨流 + curl 无散度漂移;发光质量锁在右侧 2/3 |
| `solar-drift` | light | 过曝核心 + 平方反比日冕 + 盘缘暗化 + 定向体积光轴 + 层状云 |
| `aurora-veil` | dark | 5 条独立顶高的幕帘 × 空变 striae × 竖向 picket ray,色相随高度变 |
| `gilded-topography` | dark | 等高线随坡度变线宽 + 指数等高线 + 金属双色 + sheen 提亮 |
| `silk-interference` | dark | 两块光栅的真实摩尔拍频 + 脊线镜面高光 |
| `tidal-caustics` | light | 5 次迭代折射焦散 + 簇集掩码,亮点是唯一发射体 |
| `ember-field` | dark | 三层深度带泪滴粒子(远糊近锐)+ 上升包裹流 |
| `chrome-ripple` | dark | 被表面曲率扭曲的波前 + 各向异性拉丝镜面条纹 + 大尺度 sheen |
| `prism-beam` | dark | 按角度索引波长的棱镜扇(真实色散)+ 束内稀疏尘点 |
| `magnetic-filings` | dark | 双极偶极场,|B| 调制每根铁屑的长短与亮度 |

## 性能

引擎内的四条硬措施(改引擎前先读这段,别把它们去掉):

1. **DPR 封顶**:`min(devicePixelRatio, dprCap)`;`hardwareConcurrency ≤ 4` / `innerWidth < 820` /
   触屏指针三者任一命中就按弱设备算(1.25)。
2. **分辨率分级**:场景渲染在半分辨率(含 HDR 时 RGBA16F),泛光链在 1/4 分辨率上做 4 次可分离模糊。
3. **不画就真不画**:`document.hidden` 或画布离屏(`IntersectionObserver`)时整帧 return,
   回到前台靠 delta clamp(0.05s)续播,不会"补帧"爆炸。
4. **无分配**:每帧只有 draw call,纹理/程序/uniform location 全部在 `createEngine` 里建好一次。

选型口径:移动端首屏尽量用 `solar-drift` / `tidal-caustics`(亮底、自发光面积小),
暗底效果里 `ember-field` / `magnetic-filings` 的填充率最重(叶子多、点状多)。
一屏只能有一个背景;需要两个 section 都用时,第二个用 `speed: 0`(静态帧)或干脆换 CSS。

## 无障碍

- **`prefers-reduced-motion: reduce`**:引擎只渲染一帧静态画面(`t = 6.0`),不做循环动画。
  这不是"降速",是**不播**——不要绕过它去做"慢速播放"。
- **静态兜底**:`createEngine` 无 WebGL2 时返回 `{ ok: false, reason }`,不抛异常也不画黑。
  取用方**必须**给一个非空兜底(纯 CSS 渐变或一张压缩过的图),别让 `#stage` 全黑。
- **对比度**:背景是环境光,正文对比度要按**叠加后的最亮像素**算。暗底效果都内建
  `textZone()`(左上标题区压暗到 0.18–0.26),但那只保护左上角那一块——正文区请自行
  叠一层 `rgba(0,0,0,.28)` 或把效果压在 `speed: 0` 的静态帧上。
- **动得少一点**:闪烁频率由 `speed` 控制,`speed ≤ 40` 时低频波动不再成"闪"。
  需要长时间曝露的页面(仪表盘、看板)建议 30 以下。
- 画布要有 `aria-label`(本包页面都有),HUD 文字别重复画布里已有信息。

## 反模式

1. **只渲染"平均色"**——拿一张渐变图、一层 `fbm` 平铺、或一个纯色大圆当背景。
   机制类效果一眼可辨:它有**结构层级**(核心 / 主体 / 底噪)、**速度差**(慢调制层 + 快细节层)、
   **方向性**(光轴、流场、场线)。砍掉任意一层都会立刻"一眼假"。
2. **全屏均质噪声**代替具体机制。噪声是素材不是机制:`aurora-veil` 的噪声只用于 striae 频率与
   位移,幕帘的**位置与顶高**是几何量。把噪声直接当输出 = 一张会动的纸。
3. **`bloom` 开大当"高级感"**。泛光吃的是 HDR > 1 的发射体;场景本身没有发射体时调大只是
   把中灰糊掉,画面变脏。要做光,先让 concept 有 `*2.2` 级别的过曝区。
4. **把 10 个效果同屏铺开**当画廊(上下文被回收,后开的会把先开的打黑)。
5. **在前景内容密集的页面上做全强度背景**。效果本身没错,场景错了;这类页面只用
   `speed: 0` 的静态帧 + `vig: 0.8`,或者干脆不用。
6. **改 `engine.js` 里的后处理顺序**。顺序是刻意的:bloom → 色差 → 颗粒 → 暗角 → ACES → 抖动。
   把颗粒放到 ACES 之后会变成"数字噪点",把暗角放到 bloom 之前会连泛光一起切掉。
7. **在 concept 里做 blur / vignette / tonemap**。那些属于引擎;concept 只输出**线性 HDR**
   (可以 > 1),一破这条,十个效果之间的观感一致性就没了。

## 与底座包(`fx-engines`)的关系

本包**自带** `src/engine.js` 与 `src/concepts/`,预览页因此可以单独 clone 出去自己跑。
调参面板(param-panel)不在本包——它是底座包 `fx-engines` 的产物,本包的预览页用
`params.json` + URL 查询串调参(`?speed=40&bloom=0.6`),避免同一份面板被拷成第二份。
需要面板 UI 时去 `fx-engines` 取,不要在 `bg-fx` 里再抄一份。
