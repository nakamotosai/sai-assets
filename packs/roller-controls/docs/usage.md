# roller-controls · 使用说明

三件高频「手感型」控件:**滚筒选择器**(滚动吸附 + 惯性 + 键盘一档一步)、**波形滑杆**(原生 range 的可视化层)、
**锥形 dock**(指针距离驱动的放大)。纯 CSS + 一个零依赖脚本。

## 什么时候用

- 要做时间 / 日期 / 预设值的**滚筒**选择,要求「拖动有惯性、松手吸附、方向键能走一档」,而不是一排下拉框。
- 要一根**有形状的滑杆**(柱状波形、跟随指针起伏),但不想丢掉原生 `input[type=range]` 的键盘与读屏能力。
- 要一个 macOS 风格 **dock**:指针靠近时放大、离开回位,按 Tab 聚焦也放大。
- 页面已有 token,只缺这三件的手感与结构。

## 什么时候不用

- 表单里的普通数值区间(音量、亮度):直接给原生 range 加一点样式就够,波形柱是给「展示型调节」用的。
- 需要**多列联动且带单位换算**(如 年-月-日 且月份天数变化):滚筒只是视觉层,联动逻辑要你自己写;本包只做「相邻两枚各自独立」。
- 移动端为主且要求触感反馈(haptics):那需要原生桥接,web 层给不了。
- 要求 dock 里放图标字体以外的位图图标并要求精确 pixel 对齐:锥形缩放会让位图在非整数倍率下轻微模糊,改用 SVG。

## 接入步骤

1. 拷两个文件:

   ```text
   src/roller-controls.css  →  assets/roller-controls.css
   src/roller-controls.js   →  assets/roller-controls.js
   ```

2. 包裹根挂 `data-rc-root`,深浅用 `data-mode`:

   ```html
   <div class="rc" data-rc-root data-mode="light">
     <div class="rc-wheel" data-rc-wheel tabindex="0" role="listbox" aria-label="小时">
       <div class="rc-wheel-item" role="option" aria-selected="true">08</div>
       …
     </div>
   </div>
   ```

3. 三件控件独立启动:页面里没有对应标记就什么都不做。

## 标记对照

| 控件 | 标记 | 行为 |
|---|---|---|
| 滚筒 | `[data-rc-wheel]` + `.rc-wheel-item` | 原生滚动 + `scroll-snap-type: y mandatory`;`scrollTop` 变化后按「离中线最近」标 `aria-selected`;点某项滚过去;↑↓ 走一档 |
| 滚筒读数 | 同级 `[data-rc-readout]` | 当前项文字写进去(`aria-live="polite"`,读屏可播) |
| 滚筒联动 | `data-rc-onchange="事件名"` | 当前项变化时在滚筒元素上派发同名 `CustomEvent`,`detail.value` / `detail.index` |
| 波形滑杆 | `[data-rc-wave]` 内含 `.rc-bars > i` × n 与 `.rc-range` | `input` 时按拇指位置写每根柱的 `--rc-bar`;≤阈值的柱加 `data-on` |
| 滑杆读数 | 同级 `.rc-value` | 写 `value`,并同步 `aria-valuetext` |
| dock | `[data-rc-dock]` + `.rc-dock-btn` | `pointermove` 时按到各按钮中心的距离写 `--rc-s`(1 → 1.42);`focusin` 也触发 |
| dock 标签 | `.rc-dock-label` | hover / 聚焦时淡入 |

## 参数

| 变量 | 默认 | 说明 |
|---|---|---|
| `--rc-item` / `--rc-rows` | `34px` / `5` | 行高 × 可见行数 = 滚筒高度;JS 用 `clientHeight` 现算,不要手抄进脚本 |
| `--rc-mask` | `18%` | 上下淡出遮罩高度比例 |
| `--rc-accent` / `--rc-accent-ink` | `--accent` / `--accent-ink` | 选中线与拇指环;**小字用 `--accent-ink`** |
| `--rc-rule` / `--rc-rule-soft` | `--rule` / `--rule-soft` | 描边两档;未点亮的柱用 `--rc-rule` |
| `--rc-t` / `--rc-ease` | `.22s` / `cubic-bezier(.2,.7,.2,1)` | 过渡 |

dock 的两个内部常量写在 JS 顶部:`MAX = 1.42`(最大放大)、`REACH = 118`(影响半径 px)。改这两个值即可调手感。

## 无障碍硬项

- 滚筒:`role="listbox"` + 每项 `role="option"` + `aria-selected`,容器 `tabindex="0"` 与 `aria-label`;↑↓ 一档一步(`scroll-snap` 自身不响应方向键,必须显式接)。
- 滑杆:底层就是原生 `input[type=range]`,键盘(←→/Home/End)、读屏的 `aria-valuetext` 自动可用;柱层 `aria-hidden="true"`。
- dock:`role="toolbar"`,每个按钮真 `<button>`;焦点态 `outline: 2px solid var(--rc-accent)`;标签在 hover 与聚焦时都显示。
- `prefers-reduced-motion: reduce`:过渡归零、滚筒点击直接跳位、**锥形缩放整体关闭**(只留底部对齐),避免指针一动就抖。

## 反模式

- **不要**把波形柱做成可点区域:柱层是 `pointer-events: none`,交互全交给原生 range,否则键盘与触控会打架。
- **不要**给两枚并排滚筒留默认宽度:块级子项会各吃一半,中间冒号被挤出去(实测冒号飘到视口外)。必须给固定栏宽。
- **不要**在滚筒里用手写 `transform: translateY()` 做虚拟滚动:会和 `scroll-snap` 抢位置,`aria-selected` 也对不上。
- **不要**在 dock 里用 `filter: drop-shadow` 叠大阴影做放大:每帧重绘成本高;缩放只动 `transform`,阴影保持静态。
- **不要**指望 `scroll-snap` 一定落在正中:首尾要补白块(`::before` / `::after`),否则首项与末项永远吸不到中线。

## 来源与许可

MIT。原型取自本项目自建的控件对照 demo(同一交互的纯 CSS / 组件 / canvas 三档实现里的中间档),
滚筒与 dock 的手感参数(行高、吸附、放大半径)在本包内重测过;波形滑杆的可视化层为本包新写,
底层交互刻意保留原生 `input[type=range]`,不自己实现拇指。
