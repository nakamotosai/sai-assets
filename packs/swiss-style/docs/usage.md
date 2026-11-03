# usage · swiss-style(版式与构件)

> 本包**只给版式与构件,不给配色**。
> 分工:配色 token 的权威在主题包 `packs/swiss-classic`(`css/default.css`)与
> `packs/swiss-inverted`;本包 `src/swiss-grid.css` 的 `:root` 里只有一份
> **兜底值(数值 = swiss-classic)**,只为「单独打开 preview 也能看」而存在。
> 正式接入请引主题包,**别把本包的 hex 当调色处**。

## 1 什么时候用

- 需要一套**可推导的模块网格**(先构造、再隐藏),而不是"看起来对齐"。
- 需要直角平涂、发丝线、单一结构红的构件集(按钮 / 输入 / 表格 / 标签 / 分页)。
- 需要海报 / deck / 跨页 / 报告封面 / 落地 hero 的骨架,且都对齐 12 栏与单一左轴。
- 需要 Isotype 等大图元计数与 small multiples 这类信息设计图元。
- **不用于**:要塞满装饰插画、渐变、阴影、玻璃拟态、圆角胶囊、居中大标题的页面;
  也不用于要求"两三种强调色同屏"的营销页(那是主题包的边界)。

## 2 接入步骤

本包不自带色板,所以接入是**两段**:先主题包,再本包。

```html
<!-- ① 主题包给 token(二选一,或两份都引做双模切换) -->
<link rel="stylesheet" href="styles/swiss-classic/default.css">
<!-- <link rel="stylesheet" href="styles/swiss-inverted/default.css"> -->

<!-- ② 本包给版式与构件 -->
<link rel="stylesheet" href="styles/swiss-grid.css">
<link rel="stylesheet" href="styles/swiss-ui.css">
<link rel="stylesheet" href="styles/swiss-layouts.css">
<script src="styles/swiss-motion.js" defer></script>
```

```html
<body class="sw">
  <div class="sw-page">
    <div class="swiss-grid">
      <h1 class="sw-col-title">标题</h1>
      <p class="sw-col-body">正文</p>
      <span class="sw-col-meta">页注</span>
    </div>
  </div>
</body>
```

- **不要同时引主题包的 `all.css` 和本包的兜底值并改色**——兜底值本来就是从主题包抄的。
- 消费后请在项目 `design-lock.json` 记 `assets[]`(`pack` / `version` / `sha`)。

## 3 参数与文件表

### 本包自有结构变量(改这些,不碰颜色)

| 变量 | 默认 | 含义 |
|---|---|---|
| `--swiss-cols` | `12` | 栏数(≥1280 用 12;768–1279 用 12;480–767 降到 6;<480 降到 4) |
| `--swiss-gutter` | `24px` | 沟槽 = 1 主基线(中档 20px / 小档 16px) |
| `--swiss-margin` | `120px` | 屏基准外边距(中档 64px / 小档 32px / 最小 16px) |
| `--swiss-baseline` | `24px` | 主基线(= 8pt × 3),行高取它的整数倍 |
| `--swiss-subgrid` | `8px` | 8pt 子网格,间距档位基数(4/8/12/16/24/32/48/64/96) |
| `--swiss-font` | 怪诞体 + 中文黑体栈 | 字体透传,不属于配色 |

### 消费的配色 token(定义在主题包)

`--bg` `--bg-deep` `--surface` `--surface-2` `--border` `--ink` `--ink-muted`
`--ink-dim` `--accent` `--on-accent` `--red` `--link` `--hairline` `--grid-red`

### 文件表

| 文件 | 内容 |
|---|---|
| `src/swiss-grid.css` | 12 栏模块网格 · 经典边距比 · 8pt 子网格 + 24px 主基线 · 复合网格 · 响应式断点 · 教学网格线 `.grid-lines` · 入场动效挂钩 |
| `src/swiss-ui.css` | 按钮 / 输入 / 表格 / 标签 / 分页 / 勾选 / 导航 / 提示条 + Isotype 与 small multiples 图元 |
| `src/swiss-layouts.css` | 海报 / deck / 跨页 / 报告封面 / 落地 hero 五套骨架 + 刊头四点轴 |
| `src/swiss-motion.js` | 计数入位 / 卡片归格 / 网格显影(IntersectionObserver + 单 rAF,**派生动效**) |
| `preview/index.html` | 标本页:网格线开关、控件集、数据图元、五套骨架缩略、入场动效各一次 |
| `docs/specs/swiss-specs.json` | 源 JSON 规格(网格构造 / 控件 / 版式 / 数据图元 / 字体 / 动效)的机读留存 |
| `scripts/assert_tokens.py` | 自检(契约 / 引用 / 空文件 / 文档小节) |

### 常用类

| 类 | 作用 |
|---|---|
| `.sw-page` | 居中最大宽 1920 + 外边距 |
| `.swiss-grid` | 12 栏网格容器 |
| `.sw-c1`…`.sw-c12` / `.sw-full` | 跨栏 |
| `.sw-col-title` / `.sw-col-body` / `.sw-col-meta` | 角色栏位(1/9 · 1/7 · 9/13) |
| `.sw-sheet`(+ `.sw-sheet--vandegraaf` / `--mb` / `--golden` / `--medieval`) | 经典边距比 |
| `.sw-rhythm` / `.sw-stack` / `.sw-mt-<4…96>` | 基线与 4pt 阶梯 |
| `.sw-compound-2x3` / `-3x4` / `-4x5` | 复合网格(不等宽节奏列) |
| `.grid-lines` + `body.show-grid` | 教学网格线开关 |
| `.sw-btn` `.sw-input` `.sw-table` `.sw-tag` `.sw-pagination` | 控件 |
| `.sw-iso-unit` `.sw-multiples` `.sw-bars` | 数据图元 |

## 4 网格构造法(源自 swiss-grid-system 规格)

瑞士网格的核心不是"12 栏",而是**先推导**一条读者看不见的模块网格,再把线藏起来。

- **术语**:栏(Spalte/column)= 垂直文字列;字段(Rasterfeld/Feld)= 栏 × N 行的最小放置单元。
  Müller-Brockmann 书里的「8–32」说的是**字段**;「12 栏」是 2008–2011 的网页惯例,不是他的规则。
- **构造公式**:一栏总行数 `N = k·m + (k−1)·g`,解 `m = floor((N − (k−1)·g) / k)`
  (k = 字段数,g = 字段间空行数,m = 每字段正文行数)。
  例:`N=57, k=4, g=1 → m=13`,实际列深 `4×13+3=55` 行。
  同一正文区可切多种密度:`53 行 → 9×5 或 6×8`;`69 行 → 12×4 / 10×5 / 6×9 / 5×11 / 4×14`。
- **经典边距比(内:上:外:下)**:Van de Graaf `2:3:4:6`;Müller-Brockmann `1:1.5:2:3`;
  黄金比 `3:5:5:8`;中世纪 `1:1:2:3`。CSS 里用 `.sw-sheet--*` 做屏幕近似。
- **复合网格(Gerstner)**:两套规则网格叠加得不等宽节奏列 ——
  `2 栏叠 3 栏 → 2|1|1|2`;`3 叠 4 → 3|1|2|2|1|3`;`4 叠 5 → 4|1|3|2|2|3|1|4`。
- **栏宽 = 可读性函数**:正常阅读距离 30–35cm;一行 7–10 个西文词,中文对应 30–36 个汉字。
- **图注/图片注册**:图上下边缘压 cap-height / descender 线;尺寸取整数个字段。

## 5 字号与基线注册(源自 swiss-grotesque + grid-system)

- **所有字号的行高是同一模块 M 的整数倍**:正文 `10+2=12=M`,图注 `6+6=12`,标题 `20+4=24=2M`。
- 字号跳跃 ≥1.5×;**全站 ≤2 家族、≤3 字重**;一款中性怪诞体 + 一款真黑体。
- 拉丁正文行高 1.5;中文正文 1.6–1.8(中文无 x-height 缓冲);标题 0.9–1.05。
- 字距:拉丁大标题 `-0.03em`;**中文标题 `0 ~ +0.01em`(绝不负值)**;中文小标签 `+0.05~+0.1em`。
- 数字一律拉丁等宽(tabular);标点全角;中文大标题字重 900,正文 400–500。
- **禁**:衬线 / 圆体 / 书法 / 手写 / 斜体;11–15px 中文用 300;用网格线或装饰字当层级手段。
- 可合法打包字体:Inter、Noto Sans SC / 思源黑体(SIL OFL-1.1);系统 Helvetica Neue / PingFang
  只放进回退链做本地增强,**禁 @font-face 随包分发**。

## 6 控件规则(源自 swiss-ui 规格)

- 直角(圆角 ≤4px);禁胶囊、禁大圆角。
- 层级用明度差 + 1px 发丝线;禁 `box-shadow` / 渐变 / 玻璃拟态。
- **红只做焦点态 / 选中态 / 主按钮 hover**,不做大面积填充。
- 焦点必须可见(`:focus-visible`),对比 ≥3:1;禁 `outline:none` 了事。
- padding / 高度落 8pt 网格(8/16/24…)。
- 表格用发丝横线不用竖线;密集列表才画线,稀疏用间距分组。

## 7 版式骨架(源自 swiss-layouts 规格)

| 骨架 | 类 | 网格 | 结构要点 |
|---|---|---|---|
| 海报 Poster | `.sw-poster` | 12 栏 × 8pt 基线,A 系列 1:√2 | 顶部主规则 + 编号;标题跨 1/9;右下单元几何形跨 9/13;左下信息块 |
| Deck 幻灯片 | `.sw-deck` | 12 栏 × 24px 沟槽,16:9 | 页眉四点轴;大标题靠上 1/3;正文 1/7;页脚四栏 |
| 跨页 Spread | `.sw-spread` | 4 字段 × 2 页(12 栏内切) | 左页主图跨 2 字段 + 图注贴下伸线;右页正文 measure 30–36 汉字 |
| 报告封面 Cover | `.sw-cover` | 12 栏,大留白 | 左上编号+分类;中部大写标题跨 1/9;右下期次/日期;一条结构红线 |
| 落地 Hero | `.sw-hero` | 12 栏响应式,移动 4 栏 | 左标题右几何(不对称);下方规则线 + 四栏价值点 |

通用规则:每屏留白 ≥35–45% 且**成块**;标题靠上、左轴统一;不对称构图;禁底部大片空留白。

## 8 数据图元(源自 swiss-dataviz 规格)

- **Isotype**:用重复的**等大**图元表数量,**绝不放大单个图元**(最常见的错误);必须有
  「1 图元 = N」图例(`.sw-iso-legend`)。平黑剪影 + 单一饱和红作计量单位,无渐变无阴影。
- **Tufte**:数据墨水比最大化;Lie Factor ≈ 1(图形变化比例 = 数据变化比例);Small multiples
  同一坐标系重复小图;Sparkline;细灰网格线不用粗黑框。
- 红只标**一个**数据系列或一个高亮点;禁 3D 饼图 / 渐变填充 / 阴影;坐标轴标签 flush-left,数字 tabular。

## 9 动效(**派生,非官方规范**)

> ⚠️ **derived, not canon** —— 不存在官方"瑞士风格动效系统";瑞士风格是静态印刷方法。
> 下面是**从实践中派生的、与瑞士原则一致**的动效语言,按"派生规则"而非"历史规范"使用,
> 不要把规则当史实引用(`src/swiss-motion.js` 头部保留同一免责口径)。

- 时长:fast `150–200ms` / base `200–400ms` / slow `400–600ms`。
- 缓动:入场 `cubic-bezier(.2,.8,.2,1)` 短促 ease-out;退场更短的 ease-in。
- **禁**:弹跳 bounce、旋转 >10°、弹性/over-shoot 过冲、>800ms 的长动画。
- 配方:计数入位(编号从 0 滚到目标)、卡片归格 fly-and-settle(FLIP)、列表错峰揭示
  (每行延迟 60–100ms)、网格显影→隐藏、A/B 重排、冻结锚点换标题、注释层叠加、马赛克瀑布。
- 只动 `transform` / `opacity`,**不动 layout**;`prefers-reduced-motion: reduce` 时直接落终态。

挂钩(由 `src/swiss-motion.js` 驱动):

```html
<div data-swiss-count="1240">0</div>                     <!-- 计数入位 -->
<article data-swiss-settle data-swiss-index="0">…</article> <!-- 卡片归格,错峰 70ms -->
<div data-swiss-grid-reveal>…</div>                      <!-- 触发同容器 .grid-lines 显影再隐 -->
<button data-swiss-grid-toggle>显示网格</button>          <!-- 切换 body.show-grid -->
```

## 10 反模式

- 把兜底值当调色处:自己在本包里改 hex,而不是引主题包 → 双份真相,迟早跑偏。
- 把"12 栏"当瑞士定式:MB 是可变 8–32 **字段**,内容一变就该重算。
- 只当视觉概念、目测摆放:网格必须**真在 CSS Grid 里**。
- 把网格线留到成品里(除刻意教学演示)。
- 给卡片加边框或阴影来"分层"——本套用 `--surface-2` 与留白分层,线只给密集列表。
- 居中大标题、两端对齐(挤出色白"河")、中文负字距、中文斜体。
- 红铺大底 / 红填正文 / 一屏两种强调色。
- 用 `box-shadow` / 渐变 / 噪点 / 玻璃拟态。
- 用 Isotype 时放大单个图元来表数量(违反等大原则)。
- 给中文标题用 `vw` 外推无上限字号;给中文小字用 300 字重(笔画溶解)。
- 动效加弹跳、旋转、过冲,或动 layout 属性(触发重排)。
- 引系统字体 Helvetica Neue 做 `@font-face` 随包分发(侵权)。

## 11 来源与许可

- 版式与构造法提炼自该风格包的网格系统 / 控件 / 版式 / 数据图元 / 字体 / 动效六份规格
  (机读留存见 `docs/specs/swiss-specs.json`);构造法谱系:
  Josef Müller-Brockmann《Grid Systems in Graphic Design / Raster Systeme》(Niggli)、
  Karl Gerstner《Designing Programmes》、Van de Graaf canon;信息设计:Otto Neurath(Isotype)、
  Edward Tufte。
- 字体建议:Inter(rsms.me,SIL OFL-1.1)、Noto Sans SC / 思源黑体(SIL OFL-1.1);
  Helvetica 谱系为付费字体,仅可列入回退链,禁随包分发。
- 本包代码为自产,**MIT**。归属登记见 `pack.json.attribution`。
