# motion-kit · 动效层(十模块)

两个文件,一层动效。无依赖、渐进增强、按需启动 —— **页面上没有对应标记的模块,开机时就退了**。

- **入场**:`[data-reveal]` 位移 26px + 模糊 6px,进视口归位;`[data-reveal-stagger]` 给子项自动错峰。
- **文字**:`[data-split]` 按词切 span,逐字上浮 112% + 2° 回正;`[data-count]` 900ms 缓出计数。
- **指针**:`[data-tilt]` ±6°/±8° 倾斜 + 光斑,`[data-magnetic]` 磁吸,`[data-cursor-label]` 跟随标签。
- **首屏**:`[data-hero]` + `[data-hero-canvas]` 2D 粒子连线场,指针连线,`[data-hero-glow]` 光晕跟随。
- **滚动**:顶部进度线、导航当前段、过程轨道、图片漂移 —— 全部合并进**同一个** rAF 滚动帧。
- **折叠**:`<details>` 用 `scrollHeight` 量高度再过渡。
- **过场**:`motionKit.viewTheme()` 走 View Transition 圆形揭示。

## 快速接法

```html
<head>
  <link rel="stylesheet" href="motion.css">
  <script>
    (function () {
      try {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        document.documentElement.classList.add('js-motion');
        window.setTimeout(function () {
          if (!document.documentElement.classList.contains('motion-ready')) {
            document.documentElement.classList.remove('js-motion');
          }
        }, 2500);
      } catch (e) {}
    })();
  </script>
</head>
<body>
  <h1 data-split>逐字上浮的标题</h1>
  <p data-reveal>进视口才出现的段落</p>
  <script src="motion.js" defer></script>
</body>
```

宿主只需自带 8 个颜色 token(`docs/usage.md` §2),其余条目的值都由 `motion.css` 自己的 `--ease-*` 与 `--reveal-delay` / `--i` / `--py` 系列提供。

预览:`preview/index.html`(首屏场、跑马灯、计数、轨道、倾斜/磁吸/光标、漂移卡、折叠、明暗过场)。
契约:`docs/usage.md`(标记对照表、参数、性能口径、反模式);自检:`scripts/assert_tokens.py`。