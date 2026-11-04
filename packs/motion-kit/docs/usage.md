# motion-kit · 用法

## 1 接入步骤

**① 引样式**(`<head>` 里,在宿主自己的样式之前或之后都可以,它只碰动效属性):

```html
<link rel="stylesheet" href="motion.css">
```

**② 挂启动类(同步、内联、必须在 `<head>`)** —— 这段决定"入场态在 JS 到齐前是否生效":

```html
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
```

- 系统开了「减少动效」→ 什么都不挂,页面直接就是静态版。
- 脚本(③)正常跑完会补上 `motion-ready`;2500ms 内没补上(网络慢、脚本挂了)就摘掉 `js-motion`,入场元素恢复可见 —— **不会留白屏**。

**③ 引脚本**,页面末尾一次:

```html
<script src="motion.js" defer></script>
```

**④ 按第 3 节的对照表,给元素加标记。** 不加标记的模块不会启动;只加一个,就只有那一个在跑。

## 2 宿主 token 清单

`motion.css` 不自带配色,只读下面这些名字。宿主缺哪个补哪个(值随宿主主题走):

| token | 用在哪 |
|---|---|
| `--background` | 跑马灯底、footer 跑马灯分隔 |
| `--card` | 倾斜卡片的底(可选) |
| `--foreground` | 进度线、轨道、光标、粒子连线、斜体回正后的字 |
| `--muted` | 导航静息、步骤标题、折叠答案 |
| `--muted-soft` | 序号、次要字 |
| `--border-hairline` | 跑马灯上下线、轨道底线、折叠分隔 |
| `--border-control` | 跑马灯分隔点 |
| `--surface-hover` | 磁吸/倾斜控件的悬停底(可选) |

外加 `motion.css` 自己的三档缓动:`--ease-out` `--ease-in-out` `--ease-spring`(可在宿主覆盖)。

## 3 模块与标记对照

| 模块 | 需要的标记 / class | 行为与参数 |
|---|---|---|
| 入场 | `[data-reveal]` | `opacity 0 → 1`、`translateY 26px → 0`、`blur 6px → 0`;`--reveal-delay`(整数)×70ms |
| 错峰 | `[data-reveal-stagger]`(容器) | 给每个子元素自动补 `data-reveal` 与 `--reveal-delay=下标` |
| 逐字上浮 | `[data-split]` / `[data-split="chars"]` | 默认按空白切词;**中文 / 日文标题用 `data-split="chars"` 按码位逐字切**(空白切词对无空格语言只会切出一个 token)。每段外包 `.split-word`,子 span 从 112% 下方位移 + 2° 旋转回正;`--i`×55ms |
| 计数 | `[data-count="42"]` | 进视口后 900ms `easeOutCubic` 数到 42,只跑一次 |
| 倾斜 + 光斑 | `[data-tilt]` | 指针位移写 `--rx`(±6°)/`--ry`(±8°)/`--mx`/`--my`;`::after` 用后两个画径向光 |
| 磁吸 | `[data-magnetic]` | 相对中心偏移写 `--mx`/`--my`(±7px),离开即清 |
| 光标 + 标签 | `[data-cursor-label="文案"]` | 生成 `.cursor`(环+点,lerp 0.2)与 `.cursor-label`(lerp 0.14);`<html>` 上挂 `has-cursor`;命中 `a/button/input/textarea/select/summary/[data-tilt]` 时环放大 |
| 首屏场 | `[data-hero]` + `[data-hero-canvas]` + `[data-hero-glow]` | 2D 粒子连线;粒子数 `clamp(面积/21000, 26, 88)`,窄屏 ×0.62;连线 132px 内、指针 176px 内;`dpr` 上限 1.5;离开视口或切后台停帧 |
| 过程轨道 | `[data-process]` + `.process-track > span` + `.process-step` | 轨道 `scaleX` 跟滚动;步骤按进度点亮 `is-active` |
| 图片漂移 | `.work-card` > `.work-media img` | 按卡片中心到视口中心的距离写 `--py`(±14px) |
| 顶部进度线 | `.scroll-progress > span` | `scaleX` = 页面滚动比例 |
| 头部 / 导航 | `.site-header`、`.nav > a[href^="#"]` | 滚过 6px 加 `is-scrolled`;按视口 32% 探针点亮 `is-active` |
| FAQ 折叠 | `.faq-item`(`<details>`) > `summary` + `.faq-answer` | 打开前量 `scrollHeight` 再过渡(0.38s),关闭 0.32s;动画中屏蔽二次点击 |
| 跑马灯 | `.ticker` / `.footer-marquee` | 纯 CSS:36s / 44s 线性无限;`.ticker:hover` 暂停 |
| 明暗过场 | `window.motionKit.applyTheme` | 宿主把"应用主题"挂上去;调用 `window.motionKit.viewTheme('light' \| 'dark')` 走 View Transition 圆形揭示(不支持则直接应用) |

## 4 参数

| 变量 | 默认 | 说明 |
|---|---|---|
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` | 入场/位移主缓动 |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` | 呼吸/脉冲 |
| `--ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | 预留的过冲 |
| `--reveal-delay` | `0` | 入场错峰,单位 = 70ms |
| `--i` | `0` | 逐字错峰,单位 = 55ms |
| `--py` | `0px` | 图片漂移,脚本写 |
| `--rx` `--ry` `--mx` `--my` | — | 倾斜/磁吸,脚本写;别手写死值 |
| `--vt-x` `--vt-y` | `50%` | 主题揭示的圆心,脚本按按钮位置写 |

## 5 性能口径

- 所有滚动监听合并进**一条** rAF 帧(`onScrollFrame`);页面里再加滚动逻辑请复用 `requestScroll()` 的思路,别各自 `addEventListener('scroll')`。
- 入场优先 `IntersectionObserver`(`rootMargin 0 0 -10%`,`threshold .06`),并额外做一次视口预扫,首屏元素两条 rAF 后直接放行。
- 粒子场是唯一持续绘制的模块:粒子数上限 88、`dpr` 上限 1.5、离开视口或 `document.hidden` 停帧。**这三条不许放宽**。
- `will-change` 只加在入场与倾斜元素上,`.is-inview` 后立刻回收。

## 6 反模式

- ❌ 给元素手写 `opacity: 0` 当兜底 —— 无 JS 或减少动效的用户会永远看不见内容。入场态只由 `html.js-motion [data-reveal]` 给。
- ❌ 把 `js-motion` 放到 `<body>` 末尾或 `defer` 脚本里加:首帧已经画完,入场会从"突然消失再出现"开始闪一下。
- ❌ 同一页引两次 `motion.js`(会注册两套监听,粒子场变两台)。
- ❌ 在移动端也开 tilt / magnetic / cursor:脚本已按 `pointer: fine` 拦掉,别为了"平板也能看效果"去掉这条。
- ❌ 用 `max-height` 猜 FAQ 高度:答案换行一变就露馅,这里量的是 `scrollHeight`。
- ❌ 把 `.work-card` / `.faq-item` / `.site-header` 改成别的类名后不同步脚本 —— 模块会静默不启动(看起来像"没效果"),这是最容易被当成 bug 的一类。
- ❌ 需要"整页翻页"或"文字解散重聚"却用本包硬塞:那两件在 `page-transition` 里,本包只做页内。

## 7 配对

| 一起用 | 为什么 |
|---|---|
| `dual-theme-toggle` | 它给按钮与无闪切换,本包给切换那一刻的圆形揭示(`motionKit.viewTheme`) |
| `token-harbor` 或任一主题包 | 本包不定义配色,只读宿主 token;同名的 `--background` / `--foreground` 直接复用 |
| `nav-rail-marquee` | 若用角上的竖排跑马灯导航,关掉本包的 `.nav` 当前段高亮,避免两套"当前段"打架 |
| `page-transition` | 翻页过场归它,页内入场归本包;两者都挂时先确认 `view-transition` 不互相抢 root |

## 8 无障碍

- 减少动效:脚本顶部 `matchMedia('(prefers-reduced-motion: reduce)')` 命中即整体 `return`;CSS 末尾另有一块硬停(跑马灯、脉冲点、倾斜光斑、光标)。
- 光标是**叠加层**,不动原生指针;`aria-hidden="true"`。
- 入场只改 `opacity` / `transform` / `filter`,不改可访问性树;内容在 HTML 里,没有懒加载文案。
- 键盘用户不受影响:所有命中逻辑只挂 `pointermove`,焦点环用宿主的 `:focus-visible`。