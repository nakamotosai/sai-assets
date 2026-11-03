---
name: nav-rail-marquee
description: Add an edge-chrome navigation trio to a single-page site — a vertical seamless marquee on the left, a small lowercase nav centered at the top, a section rail on the right whose active bar grows and glows, and a bottom progress line that tracks the current section. Use when the page needs non-intrusive corner navigation with an explicit "current section" indicator, plus 44px hit areas, aria-current, keyboard paths and reduced-motion support.
---

# nav-rail-marquee · 左竖排跑马灯 + 顶导航 + 右段轨

一套压在画面四角、不抢内容的导航 chrome:**左竖排跑马灯(竖向无缝循环)+ 顶部居中小写导航 + 右侧段轨(当前条加长发光)+ 底部进度线(按段推进)**。
两处导航共用同一份当前态(`aria-current="page"`),点任一处两处同步;滚动到某一段也会自动切。

## When to use

- 单页作品集 / 工作室首页 / 长页叙事:要"边缘 chrome",不要通栏 header。
- 需要轻量占位式导航:顶上一个 3 项小写入口 + 右侧完整段轨,两边互为快捷与全图。
- 需要显式的"当前段"反馈:段轨条形加长发光 + 底部进度线按段推进。
- 希望在既有暗色页面上叠加一层纯装饰导航(CSS 全部限定在 `.nr` 内,不动 `html` / `body`)。

## When not to use

- 多级菜单 / 需要下拉、mega menu、面包屑的站点(这是一层平铺段导轨,不做层级)。
- 后台 / 表单密集的工具面板:固定边缘 chrome 会压住操作区。
- 浅色、纸质、大量正文的阅读页(白底黑字场景请走 editorial 类主题包)。
- 需要"真正的滚动进度百分比"(0–100% 连续值):本包按段离散推进,连续进度请自己接 scroll 比例。

## Files

| path | use |
|---|---|
| `src/nav-rail.css` | 组件全部样式与变量(`.nr` 作用域;含 44px 命中区、焦点环、减少动效降级) |
| `src/nav-rail.js` | 无依赖经典脚本:当前态同步、点击跳转、滚动联动、键盘移动焦点、进度线宽度 |
| `preview/index.html` | 整屏舞台 + 四段占位内容,可直接双击打开 |
| `docs/usage.md` | 接入步骤 + 参数表 + 标记契约 + 无障碍硬项 + 反模式 |
| `scripts/assert_tokens.py` | 自检:元数据 / 声明路径 / 引用解析 / 产物非空 / 文档与实现标记 |

## Agent apply steps

1. 读 `src/nav-rail.css` 的 `:root` 级变量块(在 `.nr` 上)确认默认值;不要自己新造颜色,先用变量覆盖。
2. 把 `src/nav-rail.css`、`src/nav-rail.js` 拷进项目静态资源目录。
3. 在页面里放 `<div class="nr" data-nav-rail>` 包裹根,四件套按 `docs/usage.md` 的标记契约落位:
   `[data-nr-top]`(按钮 `data-nr-target`)、`[data-nr-rail]`(按钮 `data-nr-target`)、`[data-nr-progress]`(内层 `[data-nr-bar]`)、`[data-nr-stage]`(滚动容器)、每个 `<section data-nr-section="<id>">`。
4. 引脚本(普通 `<script>`,不是 module):`<script src="nav-rail.js"></script>`;需要手动控制就 `NavRail.init('#nr')` 后 `go('demos')` / `sync('about')`。
5. 调参只改 `.nr` 上的变量:`--mq-opacity`(0.2–1,默认 0.72)、`--mq-sec`(8s–60s,默认 24s)、`--nr-hit`(默认 44px,别改小)。
6. 自检:`python packs/nav-rail-marquee/scripts/assert_tokens.py`;页面侧检查四件事 —— 两处导航同点同亮、进度线随段变宽、Tab 能走完所有按钮且焦点环可见、系统「减少动效」时跑马灯停。

## Hard rules

- 当前态只走 `aria-current="page"`,由脚本统一写到两个导航上;禁止再用 class 手搓一套高亮。
- 每个可点项最小命中区 44px(`--nr-hit`),禁止用负 margin / 缩小 padding 收掉热区。
- 进度线宽度由脚本按 `(段序号 + 1) / 段数` 写入,禁止在 CSS 里写死某个百分比当终值。
- 段轨按钮必须是原生 `<button type="button">`,并带 `aria-label`;跑马灯是装饰,保持 `aria-hidden="true"`。
- `prefers-reduced-motion: reduce` 必须同时停掉跑马灯动画、过渡与平滑滚动 —— 三条都在 `src/nav-rail.css` 第 7 节,别删。
- 跑马灯两份内容必须逐字等长,否则 `-50%` 处会跳帧。
- 不在包内写自有域名、盘符路径、内网地址或客户代号;示例字条里的域名用中性占位 `example.com`。
- 消费后必须在项目 `design-lock.json` 记 `assets[]`(`pack` / `version` / `sha`)。