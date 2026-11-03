# three-fx · 用法与配对规则

两件**三维**特效,运行模型完全不同,各自独立:

| id | 机制 | 运行模型 | 依赖 |
|---|---|---|---|
| `blackhole-waves` | 体波测地线盘:体积薄盘 + 径向外推波 + 开普勒差速旋臂 + 多普勒 | three.js 实时渲染(WebGL2) | `upstream/three.module.js`(1.3MB,MIT) |
| `blackhole-particles` | 粒子黑洞:开普勒轨道吸积盘 + 1/r 引力吸入/重生 + 光子环 + 多普勒 | Canvas2D(2D 上下文 + 手写粒子系统) | 无 |

## 取用

**A · 体波测地线盘**(需要一个静态服务器,`import` + `fetch` 不能用本机文件协议直接开):

```html
<link rel="stylesheet" href="src/stage.css">
<link rel="stylesheet" href="src/param-panel.css">
<div id="magic" aria-label="体波测地线盘"></div>
<div class="hud" id="hud"></div>

<!-- 模块按 id 取这两段着色器源码,必须在 body 之前存在 -->
<script type="x-shader/x-vertex" id="pt-vert">…</script>
<script type="x-shader/x-fragment" id="pt-frag">…</script>
<script type="module" src="src/blackhole-waves.js"></script>
```

要拷的文件:`src/blackhole-waves.js` · `upstream/three.module.js` · `src/param-panel.js` · `src/param-panel.css` ·
`src/stage.css` · `effects/blackhole-waves/params.json`(页面里的 `fetch('./params.json')` 相对**页面**解析,所以 json 要放在页面同级)。

**B · 粒子黑洞**(零依赖,同样需要一个静态服务器才能读到 `params.json`,否则面板回落默认值):

```html
<link rel="stylesheet" href="src/stage.css">
<link rel="stylesheet" href="src/param-panel.css">
<canvas id="stage" aria-label="粒子黑洞"></canvas>
<div class="hud" id="hud"></div>
<script type="module" src="src/blackhole-particles.js"></script>
```

要拷的文件:`src/blackhole-particles.js` · `src/param-panel.js` · `src/param-panel.css` · `src/stage.css` ·
`effects/blackhole-particles/params.json`。**不要**为了粒子版去拷 three.js —— 它整个用不上。

两个模块都**不导出 API**:它们是"页面级成品"(自己拿 `#magic` / `#stage`、自己挂面板、自己跑 rAF)。
要嵌进 SPA 里,推荐用 `<iframe>` 或独立的静态页;要改行为,直接改模块里那几行(见 §无障碍 的补丁)。
调参面板底部有它的折叠按钮,拖动标题栏可换位置(默认左下角)。

## 参数

### `blackhole-waves`(面板 19 个,`effects/blackhole-waves/params.json`)

> `defaults` 里另有 4 个**未上面板**的进阶项:`inner` / `outer`(盘内外半径)、`beam`(盘面亮度增益)、
> `starDrift`(背景星漂移)——模块会读,但面板不生成控件,要改就直接改 json。

| key | 默认 | 范围 | 含义 / 怎么调 |
|---|---|---|---|
| `mode` | 测地线连续盘 | 4 档 | 测地线连续盘 / 测地线·转速加强 / 纯粒子盘 / 混合·底盘+飞尘 |
| `waveSpeed` | 4.5 | 0–12 | **动感主开关**:盘面纹理向外推的速度。0 = 冻结的静态盘 |
| `spin` | 5.5 | 0.5–14 | 角向转速:越大旋臂拧得越紧 |
| `wind` | 6.5 | 0–12 | 螺旋臂数/缠绕强度;配合 `spin` 出开普勒差速 |
| `contrast` | 1.55 | 0.3–2.4 | 盘面条纹对比;>2 会开始出硬边摩尔 |
| `waveFreq` | 5.0 | 1.5–8 | 条纹细度:大值=细密环纹,小值=厚带 |
| `diskThick` | 0.08 | 0.03–0.25 | 高斯厚度:决定侧视时盘是"薄盘"还是"厚环" |
| `temp` | 5200 | 2500–12000 K | 黑体色温:2500K 偏橙红,12000K 偏蓝白 |
| `opacity` | 0.88 | 0.2–1.0 | 盘浓度(累积不透明度) |
| `doppler` | 0.55 | 0–1 | 多普勒左右冷热差:0 = 对称盘,1 = 一侧明显发蓝 |
| `gain` | 2.1 | 0.5–3.5 | 盘增益(发射强度) |
| `exposure` | 1.4 | 0.5–2.5 | 全画面曝光 |
| `starGain` | 0.7 | 0–1.4 | 背景星亮度 |
| `steps` | 52 | 28–72 | **性能旋钮**:测地线步数,直接决定 GPU 时间 |
| `fov` | 40 | 28–70 | 视场角(相机) |
| `particleSpin` | 1.5 | 0.3–3.5 | 粒子盘转速倍率 |
| `particleDensity` | 1.0 | 0.4–1.5 | **性能旋钮**:粒子数量 |
| `dotScale` | 1.2 | 0.5–2.4 | 粒子点大小 |
| `quality` | 1.0 | 0.5–1.5 | **性能旋钮**:综合画质,直接改 `setPixelRatio`(1.2 + 0.55·q) |

### `blackhole-particles`(11 个,`effects/blackhole-particles/params.json`)

| key | 默认 | 范围 | 含义 / 怎么调 |
|---|---|---|---|
| `style` | 经典(侧视薄盘) | 8 档 | 盘样式预设:一次改色温/倾角/内外半径/浓度/多普勒/增益/对比/风(其余参数之上还有一层全局缩放) |
| `density` | 1.0 | 0.4–2.0 | **性能旋钮**:粒子密度 |
| `holeSize` | 0.55 | 0.2–1.0 | 视界半径(画面占比) |
| `diskOpacity` | 0.85 | 0–1 | 光环浓度 |
| `doppler` | 0.55 | 0–1 | 左右冷热(轨道速度投影) |
| `spin` | 1.0 | 0.2–2.5 | 盘转速(开普勒 Ω ∝ r^-1.5 的全局倍率) |
| `gravity` | 1.0 | 0.2–2.5 | 星尘被吸入的强度;>2 星尘会被快速清空并重生 |
| `starGain` | 0.55 | 0.1–1.2 | 星空亮度 |
| `exposure` | 1.15 | 0.5–2.0 | 全画面曝光 |
| `followMouse` | true | 开关 | 视界跟随指针(关掉=固定居中) |
| `autoCycle` | false | 开关 | 每 ~5s 自动轮换样式预设(演示用,别在生产页开) |

面板用原生 `<input type="range">` / `<select>` / `<input type="checkbox">`,键盘可达;
缓存键是 `themelab.<slug>.params`(localStorage),换 slug 要清缓存,否则会读到旧默认值。

## 性能

- **体波**:`renderer.setPixelRatio(min(dpr, 1.75))`,并随 `quality` 降到 `1.2`;主开销是
  `steps`(光线步进)与 `particleDensity`(混合/纯粒子模式)。移动端建议 `quality 0.6 / steps 36 / particleDensity 0.6`。
- **粒子**:DPR 封顶 2;主开销是 `density`(粒子数)与绘制时的逐粒子变换。老设备用 `density 0.6`。
- 两者都是 `requestAnimationFrame` 循环,**页隐藏时浏览器自动停帧**(rAF 不触发),不需要额外处理;
  帧间隔已 clamp 到 0.05s,回前台不会"补帧"跳一下。
- 体波首次进入要**下载 1.3MB three.js + 编译着色器**,首帧明显晚于粒子版。首屏敏感的落地页用粒子版,
  或者把体波页做成"点击后加载"。
- 两个效果都**不共享**任何代码:同页同时打开 = 一个 WebGL 上下文 + 一个 2D 上下文,没有冲突,
  但两套 rAF 会各吃掉一部分 GPU/CPU,建议还是一页一个。

## 无障碍

- 画布/挂载点都有 `aria-label`;HUD 只是状态文字,不承载唯一信息。
- 调参面板是原生表单控件(键盘可达);它的 `<label>` 与控件是**相邻**关系而非 `for` 关联,
  读屏会念控件类型与当前值,但不会念标签——要严格达标得在项目侧补 `htmlFor`。
- **两个效果都不内置 `prefers-reduced-motion`**:动效强度高(持续旋转 + 光晕),这是本包已知缺口。
  两种补法(都不需要动其它逻辑):

  ```js
  // 体波:src/blackhole-waves.js 的 frame() 里,把定时改成"定格"
  //   (第 749 行) uniforms.uTime.value = (now - t0) * 0.001;
  //   改成:
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  uniforms.uTime.value = mq.matches ? 6.0 : (now - t0) * 0.001;

  // 粒子:src/blackhole-particles.js 的 frame() 里,把 dt 归零(画面静止,状态不再演化)
  //   (第 439 行) const dt = Math.min(0.05, (now - lastT) / 1000);
  //   改成:
  const dt = mq.matches ? 0 : Math.min(0.05, (now - lastT) / 1000);
  ```

  更省事的替代:在页面层数 60 帧后停掉 rAF(`let n=0; const raf=requestAnimationFrame;
  window.requestAnimationFrame = cb => (n++ < 60 ? raf(cb) : 0)`),画面定格 —— 但面板改参数后
  不会立刻重绘,需要手动放行一帧。
- 这两个效果不适合长时间暴露的仪表盘场景(视野里一直有高速旋转),做看板请用 `bg-fx` 的静态帧模式。

## 反模式

1. **用体波当"背景图"**:它是强光焦点,占满屏会跟正文抢视线;要么缩小成一块画布,要么只用粒子版并压曝光。
2. **把 `upstream/three.module.js` 再拷一份进项目**,或反过来在项目里用别的 three.js 版本去 import
   这个模块(会拿到两个 three 实例,`instanceof` 与资源释放都会出错)。要么整包引用,要么只抄粒子版。
3. **直接双击本机文件打开页面**:`import` 与 `fetch('./params.json')` 都会被同源策略拦下,
   面板回落默认值、`#magic` 空白。必须过静态服务器。
4. **`autoCycle: true` 放进生产页**:每 5s 换一次盘样式,像幻灯片故障;它只是演示开关。
5. **把 `steps` / `density` / `quality` 都拉满**:三个性能旋钮同时顶格会让中端 GPU 掉到 20fps 以下,
   画面收益却接近零(步数超过 ~56 之后基本看不出差别)。
6. **指望面板参数被持久化到文件**:面板只写 localStorage;要固化默认值请改 `effects/<id>/params.json`。
7. **拿粒子版当"体波的降级方案"**:两者机制不同(一个真渲染体积盘,一个是 2D 粒子),
   视觉语言只在配色上相似;降级要提前决定用哪个,不要指望它们可以互相替换。
