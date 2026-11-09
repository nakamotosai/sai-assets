---
name: roller-controls
description: Three tactile web controls — a scroll-snap roller picker with inertia and one-step arrow keys, a waveform slider built on top of a native range input, and a macOS-style conical dock driven by pointer distance. Use when a picker needs real feel (drag, flick, snap, keyboard) instead of a select, when a slider needs visual shape without losing native accessibility, or when a toolbar should grow under the cursor.
---

# roller-controls

三件「手感型」控件:滚筒、波形滑杆、锥形 dock。纯 CSS + 一个零依赖脚本。

## When to use

- 时间 / 日期 / 预设值要**滚筒**:拖动有惯性、松手吸附、方向键一档一步
- 滑杆要有**形状**(波形柱、跟随指针起伏),但不能丢原生 `input[type=range]` 的键盘与读屏
- 工具条要做 **dock**:指针靠近放大、离开回位,按 Tab 聚焦也放大
- 已有 token,只缺这三件的手感与结构

## When not to use

- 表单里的普通区间(音量、亮度)——原生 range 加样式就够,波形是给展示型调节用的
- 多列联动且带单位换算(年-月-日、月份天数变化):本包只做各自独立的滚筒
- 要求触感反馈(haptics):需要原生桥接,web 层给不了
- dock 里放位图图标并要求精确像素对齐:锥形缩放会让位图在非整数倍率下轻微发虚,改用 SVG

## Default

浅色纸白(`#f5f3ed` / `#1a1a16` / 强调 `#cd5545`),`data-mode="dark"` 切近黑 `#0e0e0c`。两档都是**回退值**:宿主给了 `--bg/--ink/--accent` 就全走宿主。

滚筒 `34px × 5 行 = 170px`,上下 18% 遮罩淡出;dock 放大上限 1.42、影响半径 118px。

## Files

| path | use |
|---|---|
| `src/roller-controls.css` | 三件控件样式 + 变量 + 减速降级(作用域 `.rc`) |
| `src/roller-controls.js` | 滚筒当前项 / 波形柱高 / dock 距离缩放 |
| `preview/index.html` | 活预览:滚筒可拖可滚可点可方向键,滑杆真能调,dock 真会放大 |
| `docs/usage.md` | 标记对照 + 参数 + 无障碍硬项 + 反模式 |
| `scripts/assert_tokens.py` | 契约 / 引用 / 产物 / 对比度两档 / 标记齐全 |

## Agent apply steps

1. 拷 `src/roller-controls.{css,js}` 到项目 `assets/`。
2. 包裹根 `<div class="rc" data-rc-root data-mode="light">`;三件各自挂 `data-rc-wheel` / `data-rc-wave` / `data-rc-dock`。
3. 滚筒读数用 `data-rc-readout="#选择器"` **显式指向**目标元素——不要依赖"往上找一个",两枚并排时必然抢。
4. 阻尼、行高、放大半径都在 CSS 变量 / JS 顶部两个常量里,别改选择器。
5. 小字强调用 `--rc-accent-ink`(`--rc-accent` 在浅底到不了 4.5:1)。

## 硬规则

- 滚筒必须 `role="listbox"` + 每项 `role="option"` + `aria-selected`,并显式接 ↑↓(`scroll-snap` 自己不响应方向键)。
- 方向键连按时**先落标再滚**:只等 `scroll` 事件会读到上一档位置,连按两下只走一步。
- 滑杆底层必须是原生 `input[type=range]`;柱层 `pointer-events: none` + `aria-hidden="true"`。
- 并排滚筒必须给固定栏宽,否则块级 flex 子项各吃一半,中间冒号被挤出视口。
- `prefers-reduced-motion` 下锥形缩放**整体关闭**(只留底部对齐),否则指针一动就抖。
