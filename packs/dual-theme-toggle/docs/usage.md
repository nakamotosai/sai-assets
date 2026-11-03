# dual-theme-toggle · 使用说明

一个按钮的两态深浅主题 + 一个定长丝滑滚动工具。纯原生,零依赖,拷两个文件就能用。

## 这套东西解决什么

1. **无 JS 也不能闪**:没有 `data-theme` 属性时跟随系统 `prefers-color-scheme`;用户选过之后,选择在 `<head>` 里先贴一次,刷新不闪一帧。
2. **切换要有据可查**:换的是 `html[data-theme]`,不是给 `<body>` 塞一堆内联色;`--bg` 这类 token 真的跟着变(见下面的自检)。
3. **无 JS 不给假开关**:按钮靠 `html[data-js]` 控制显示,没有 JS 就藏起来 —— 一个点不动的开关比没有开关更糟。
4. **滚动时长可控**:原生 `scrollIntoView({behavior:'smooth'})` 时长由浏览器定(约 300ms),要"2 秒能看清的过程"只能 rAF 自算自缓。

## 接入:三行 + 一个按钮

```html
<!-- ① <head> 里,越早越好:贴标防闪(这一行不能挪到 </body> 前) -->
<script>document.documentElement.dataset.js='';try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;document.documentElement.dataset.resolved=t||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');}catch(e){}</script>
<link rel="stylesheet" href="src/theme-toggle.css"><!-- ② token + 按钮样式 -->
<script src="src/theme-toggle.js" defer></script><!-- ③ 行为:按钮不存在时自己造一个 -->
```

按钮(想自己放位置就写,不写则 JS 依次找 `header` / `.topbar` / `[data-tt-mount]`,再没有就浮在右上角):

```html
<button class="tt" type="button" data-theme-toggle="theme" aria-label="切换深浅主题"></button>
```

`data-theme-toggle` 的值就是 `localStorage` 的键(默认 `theme`,也可用 `<html data-theme-key="...">` 统一改)。图标(太阳 / 空心月亮,15px)与 `aria-label` 由 JS 注入并随状态更新,不用手写 SVG。

## 页面样式怎么写

页面只消费 token,禁写死色值 —— 写死一处,切主题就漏一处。

| token | 用途 |
|---|---|
| `--bg` | 页面底 |
| `--surface` | 卡面 / 面板底(透明叠色) |
| `--ink` | 正文 |
| `--muted` | 次要文字(两模都 ≥4.5:1) |
| `--line` / `--line-strong` | 分隔线 / 描边 |
| `--accent` | 图形、大字号(**不要**给小字) |
| `--accent-ink` | 链接与小字彩色文本(两模都 ≥4.5:1) |
| `--accent-soft` | 强调色的透明铺底 |
| `--focus` | 焦点环 |
| `--c-paper` / `--c-charcoal` / `--c-accent` | 原色表(改配色只动这一段) |

**深浅只翻中性色**:`--accent` 两模共用同一个色值(朱 `#CD5545`),不要为深色另调一套强调色。

## 文件

| 文件 | 作用 |
|---|---|
| `src/theme-toggle.css` | 语义 token(深色默认 / 浅色重映射 ×2 处)+ `.tt` 按钮样式 |
| `src/theme-toggle.js` | 切换逻辑(存储 / 视图过渡 / 跨标签页同步 / 事件)+ `smoothScrollTo` + `[data-scroll-to]` 声明式绑定 |
| `preview/index.html` | 活预览:右上角按钮 + 状态活读数 + 定长滚动样品 |
| `scripts/assert_tokens.py` | 断言:契约字段、manifest 路径、preview 引用、两段浅色映射逐字一致、对比度双档、按钮硬项 |

## API

```js
themeToggle.get()               // 'light' | 'dark'(当前生效值)
themeToggle.explicit            // 用户是否显式选过
themeToggle.set('dark')         // 写入并落笔;set(null) = 清选择回到跟随系统
themeToggle.toggle()            // 翻转
themeToggle.follow()            // 清掉选择,回到跟随系统
themeToggle.key()               // 当前存储键
themeToggle.smoothScrollTo(y, ms)

document.documentElement.addEventListener('themechange', e => {
  console.log(e.detail.theme, e.detail.explicit);  // 任何切换都会派发
});
```

```html
<button data-scroll-to="#section" data-scroll-ms="2000">滚过去</button>
```

## 参数

| 项 | 默认 | 说明 |
|---|---|---|
| 存储键 | `theme` | `<button data-theme-toggle="键名">` 或 `<html data-theme-key="键名">` |
| 图标尺寸 | 15px | 改 `.tt svg` 的宽高 |
| 按钮热区 | 44px | 改 `.tt` 的宽高;不要小于 44 |
| 滚动时长 | 2000ms | `data-scroll-ms`,或 `themeToggle.smoothScrollTo(y, ms)` |
| 视图过渡 | 有则用 | `document.startViewTransition` + `prefers-reduced-motion` 双重门控 |

## 反模式

- **把 `[data-theme]` 选择器写成不带元素名前缀**:属性贴 `<html>` 上,特异性 (0,1,0) 与页面自己的 `:root` 打平,写在后面的 `:root` 会赢 —— 属性切了、颜色纹丝不动。必须是 `html[data-theme="light"]`。
- **深色另配一套强调色**:两模共用一个 `--accent` 才对;为深色提亮一档会让"同一套品牌色"变成两套。
- **彩色小字直接用 `--accent`**:纸白侧只有 3.8:1,只用得起图形与大字号。
- **两处浅色映射只改一处**:`@media (prefers-color-scheme: light) :root:not([data-theme])` 与 `html[data-theme="light"]` 是同一份映射的两个触发条件,漏改一处就是"选过的人和没选过的人看到两个浅色"。断言会逐行比对这两段。
- **把贴标脚本挪到 `</body>` 前**:功能照样能用,但选过浅色的用户每次刷新先闪一帧深色。
- **用 `localStorage` 的异常当致命错误**:隐私模式下 `localStorage` 会抛,直接 try/catch 当作"没选过"继续跟系统。
- **切换时给整页加 CSS transition 补动画**:颜色会"爬"过去,而且用户按得快就追不上;用视图过渡,或什么都不做。

## 自检

```bash
python packs/dual-theme-toggle/scripts/assert_tokens.py
```

实测(2026-11-03,Chromium 156):

| 项 | 纸白 | 炭黑 |
|---|---|---|
| `--ink` on `--bg` | 15.73:1 | 16.20:1 |
| `--muted` on `--bg` | 6.24:1 | 7.47:1 |
| `--accent-ink` on `--bg` | 4.89:1 | 5.78:1 |
| `--accent` on `--bg` | 3.80:1(仅图形/大字) | 4.58:1 |

行为口径:点一次按钮 → `html[data-theme]` 翻转且 `getComputedStyle(body).--bg` 变成目标色;`localStorage.theme` 写入;刷新后首屏即是目标色且不闪;清存储后属性消失、跟随系统。

## 来源与许可

自产(MIT)。逻辑来源:内部 demo `demos/dual-theme-toggle`(曾跑在真实站点上,坑都是那里踩的);字号 / 对比度口径来自内部设计系统的双模条款;配色采用内部设计系统定稿的"纸白 / 炭黑"两模中性色 + 单一朱色强调。
