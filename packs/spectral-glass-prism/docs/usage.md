# spectral-glass-prism · 使用说明

WebGPU 真玻璃光谱色散:**SDF raymarching + 逐波长 Cauchy 色散 + 进出两次折射 + CIE 1931 光谱合成**。
白光进、连续彩虹出;pill / prism / cube / plate / diamond 五种形状共享同一套折射引擎。

## 什么时候用

- 落地页 / 作品集需要一个"能拖、能转、有真火彩"的实时玻璃舞台
- 要演示**物理正确的色散**(而不是把 R/G/B 的 IOR 各挪一点那种三色带近似)
- 想要一个既有活预览、又能整套抄走的 WebGPU 参考件(宿主壳 + 兜底 + 引擎契约都写清了)

## 不适合

- 要兼容老浏览器 / 移动端低端机的商业页面:WebGPU 是硬门槛,不支持时只剩兜底面板
- 需要 SEO 或首屏纯文本的页面:这页的重心是画布
- 想改引擎内部算法的场景:本包对 vendored 引擎的承诺是"字节一致",要改去上游 fork 后重新构建

## 结构:谁是谁

| 角色 | 文件 | 说明 |
|---|---|---|
| 宿主 / 引导 | `src/spectral-glass.js` | 普通脚本(IIFE):能力探测、契约节点自检、注入 `<script>` 加载引擎、兜底、对外状态 |
| 宿主样式 | `src/spectral-glass.css` | 舞台几何(引擎硬契约)+ 文字轨 + 署名条 + 兜底面板 |
| 活预览 | `preview/index.html` | 完整可交互页面 |
| 引擎本体 | `upstream/spectral-glass/engine.js` | 上游构建产物,**原样 vendored** |
| 来源与许可 | `upstream/spectral-glass/{LICENSE,NOTICE.md}` | MIT 原文 + 上游 HDR/照片依赖登记 |

## 接入:三步

```html
<!-- ① 样式(舞台几何是引擎的硬契约,别改尺寸规则) -->
<link rel="stylesheet" href="src/spectral-glass.css" />
```

```html
<!-- ② 契约节点:id 一个都不能改名,少一个引擎就拿到 null -->
<canvas id="gpu" layoutsubtree>
  <div id="html-bg-root" class="html-bg-root">
    <img id="html-bg-photo" class="html-bg-photo" alt="" width="1920" height="1080" crossorigin="anonymous" hidden />
    <div id="html-bg-foreground" class="html-bg-foreground">
      <h1 class="html-t-hero">标题</h1>
      <p class="html-t-mono">副题</p>
      <!-- 画布内的 DOM:只在 Chrome + CanvasDrawElement 下会被光栅化;其他浏览器里它仍是取景与兜底依据 -->
    </div>
  </div>
</canvas>
<div id="fallback"><!-- 失败/提示文本由引擎与宿主写入 --></div>
```

```html
<!-- ③ 引导:自动探测 + 起引擎(不满足条件就只出兜底,不加载引擎) -->
<script src="src/spectral-glass.js" defer></script>
```

`preview/index.html` 就是这三步的完整示例,可直接抄骨架。

宿主是**普通脚本不是 ES module**(引擎本身也是无 import/export 的 IIFE bundle):这样双击打开本地文件就能跑,
不需要先起本地服务器 —— 动态 `import()` 在本地文件页面会被 CORS 拦。

## 引擎的硬契约(改了就坏)

| id | 元素 | 作用 | 不能改的部分 |
|---|---|---|---|
| `gpu` | `<canvas>` | WebGPU 画布 | 必须是 `100vw × 100vh`;`touch-action: none`(否则拖拽被页面滚动抢走) |
| `html-bg-root` | `<div>` | 画布内 DOM 背景容器 | `position:absolute; inset:0`;渐变兜底的 class 落点 |
| `html-bg-photo` | `<img crossorigin="anonymous">` | 底图;引擎写 `src` | `crossorigin` 必须有;"换一张图"会把新地址写到这里 |
| `html-bg-foreground` | `<div>` | 左侧可滚动文字轨 | 有界高度 + `overflow-y:auto`(无边界的轨滚不动,还可能撑破画布) |
| `fallback` | `<div>` | 提示/错误文本 | 引擎自己切 `.visible`;**即使不用也要留着** |

`<canvas layoutsubtree>` + `canvas.requestPaint()` 是 Chrome 的 `CanvasDrawElement` 试验特性:没有该标志时画布内 DOM 不会被光栅化,但那些节点仍然是取景与兜底依据 —— **不能因为"看不见"就删掉**。

## 宿主 API

```js
window.spectralGlass.state        // 'idle' | 'probing' | 'live' | 'fallback'
await window.spectralGlass.probe() // { ok, kind: 'webgpu'|'no-webgpu'|'no-adapter'|'no-dom', detail? }
await window.spectralGlass.mount() // { mode: 'live'|'fallback', kind, reason? }(重复调用返回同一个 promise)
window.spectralGlass.engineUrl     // 引擎地址(包内 upstream/)
window.spectralGlass.requiredIds   // 引擎需要的节点 id

document.addEventListener('spectral-glass:ready',  (e) => { /* e.detail.engine */ });
document.addEventListener('spectral-glass:fallback', (e) => { /* e.detail.kind */ });
document.documentElement.dataset.sgState; // 同 state,CSS 可挂 [data-sg-state="fallback"] 样式
```

`mount()` 的顺序是**先探测再加载**:`navigator.gpu` 缺失或 `requestAdapter()` 返回 null 时**不会** import 引擎 —— 避免在控制台里堆一个起不来的引擎的错误。想自己决定何时占用 GPU,用 `probe()` 先问一句,再 `mount({ autoStart: false })`。

## 参数

参数面板是引擎自带的(右上角 Tweakpane),走 `localStorage` 持久化。常用的几个:

| 面板项 | 说明 |
|---|---|
| `shape` | pill / prism / cube / plate / diamond |
| `sampleCount` | 光谱采样数 `N` ∈ {3, 8, 16, 32, 64} —— **唯一的成本旋钮**,也是"假彩虹 vs 真彩虹"的分界线 |
| `n_d` / `V_d` | 折射率与 Abbe 数(材质预设:水 / BK7 / 火石 / 钻石 / 莫桑石 / 幻想玻璃) |
| `refractionMode` | `exact`(真折射)/ `approx`(近似,更稳) |
| `bgSource` | `photo`(Picsum)/ `html`(画布内 DOM,需 CanvasDrawElement) |
| `envmap*` | Poly Haven HDR 环境贴图(CC0):曝光 / 旋转 / 尺寸;关闭时退回照片 + UV 偏移反射 |
| `aaMode` | none / FXAA / TAA |
| `paused` | 暂停;TAA 在暂停时逐帧收敛 |

快捷键:`Z`(按住)强制 N=3 · `空格`随机摆位 · `R` 换底图 · `T/S/B/F` 钻石视角 · `H` 显隐参数面板。URL 加 `?perf` 会在支持 timestamp query 的机器上打印 GPU ms。

## 首帧与联网行为(实测)

- **首帧要等 5–15 秒**:引擎在第一次绘制前会先取底图、编 WGSL、建管线。这段时间画面是全黑的、页面上只有底部署名条 —— 属正常,不是卡死。判据是 `documentElement[data-sg-state]` 已经是 `live`,且右上角 Tweakpane 面板出现。
- **底图与 HDR 都是运行期外链**:Picsum(`picsum.photos`)与 Poly Haven(`dl.polyhaven.org`)。能连上就正常;连不上时引擎会退回渐变并弹提示条(此时控制台会留下一条引擎自己的 `console.error`,那是 vendored 引擎的行为,不是宿主的)。
- **引擎的取图请求没有超时**:网络"黑洞"(能建连但一直不回)会让首帧永远不来,此时既没有渐变兜底、也没有报错 —— 看起来就是纯黑。要更强壮的兜底,得改引擎(去上游 fork),宿主的探测与兜底只覆盖"没有 WebGPU / 没有适配器 / 脚本加载失败"三种。

## 反模式

- **把引擎文件当自己的源码改**:`upstream/spectral-glass/engine.js` 是构建产物,就地编辑等于放弃下次同步。要改算法去上游 fork 重新构建。
- **先 import 引擎再探测 WebGPU**:不支持时会走引擎内部的失败路径并在控制台留错误。宿主必须"先探测、后加载"。
- **只用 `@media` 藏掉画布就算停渲染**:隐藏 ≠ 暂停,后台标签页里 GPU 照样跑。要省电请用面板的 `paused`,或页面 `visibilitychange` 时暂停。
- **把文字轨删掉**:它在支持 `CanvasDrawElement` 的 Chrome 里是背景取样源;删了会让 `bgSource="html"` 静默退回照片。
- **给画布加 `overflow` / 改尺寸单位**:取景与拖拽的像素坐标都按 `100vw×100vh` 与 `devicePixelRatio` 算,改了就对不上。
- **以为不联网也能起**:底图来自 Picsum,不联网会退回渐变(引擎会给出提示条);HDR 环境贴图按需从 Poly Haven 拉,同样依赖网络。
- **在非 WebGPU 浏览器上硬上**:兜底面板是设计内行为,别拿它当 bug。

## 来源与许可

| 部分 | 来源 | 许可 |
|---|---|---|
| 引擎 `upstream/spectral-glass/engine.js` | Spectral Glass(Saqoosha)构建产物,原样 vendored | MIT(原文见 `upstream/spectral-glass/LICENSE`) |
| HDR 环境贴图(运行期下载,不随包分发) | Poly Haven | CC0 |
| 底图照片(运行期下载,不随包分发) | Lorem Picsum(图源 Unsplash) | 第三方占位图服务 |
| 宿主 `src/spectral-glass.{js,css}`、文档 | 本包自产 | MIT |

详见 `upstream/spectral-glass/NOTICE.md` 与 `pack.json.attribution`。
