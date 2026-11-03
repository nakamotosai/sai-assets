---
name: swiss-style
description: Apply the Swiss / International Typographic Style layout system — constructable module grid, 8pt baseline, square flat controls, five layout skeletons (poster, deck, spread, cover, hero) and Isotype/small-multiples data primitives. Use when a page needs a visible grid spine, flush-left objectivity and hairline structure. Colours come from the companion theme packs swiss-classic / swiss-inverted; this pack ships layout and components only.
---

# swiss-style · 国际主义平面设计风格(版式与构件)

瑞士风格不是"性冷淡黑白灰"的样子货,而是**一套可搬运的排版系统**:一条先推导、再藏起来的
模块网格 + 一款中性无衬线体 + 一律左对齐右缘参差 + 让信息自己说话的客观性。

> **分工**:本包**只给版式与构件,不给配色**。配色 token 的权威在
> `packs/swiss-classic`(`css/default.css`)与 `packs/swiss-inverted`。
> `src/swiss-grid.css` 的 `:root` 只有一份兜底值(数值 = swiss-classic),正式接入请引主题包。

## When to use

- 内容型页面需要一条**可推导的网格脊柱**(12 栏 / 8pt 子网格 / 24px 主基线 / 复合网格)。
- 需要直角平涂 + 发丝线 + 单一结构红的控件集(按钮 / 输入 / 表格 / 标签 / 分页)。
- 需要海报 / deck / 跨页 / 报告封面 / 落地 hero 的骨架,且都对齐 12 栏与单一左轴。
- 需要 Isotype 等大图元计数、small multiples 这类信息设计图元。
- 需要"教学网格线开关"把构造过程展示出来。

## When not to use

- 只想换配色 → 用主题包 `swiss-classic` / `swiss-inverted`,不要拷本包。
- 需要渐变 / 阴影 / 玻璃拟态 / 圆角胶囊 / 居中大标题 / 多强调色同屏的营销页。
- 需要装饰插画填满版面的视觉风格。
- 需要印刷开本精确落版 → 本包的边距比是**屏幕近似**,印刷请按构造公式另算。

## Files

| path | use |
|---|---|
| `src/swiss-grid.css` | 12 栏模块网格 · 经典边距比 · 8pt 子网格 + 24px 主基线 · 复合网格 · 响应式断点 · 教学网格线 `.grid-lines` · 入场动效挂钩 |
| `src/swiss-ui.css` | 按钮 / 输入 / 表格 / 标签 / 分页 / 勾选 / 导航 / 提示条 + Isotype 与 small multiples 图元 |
| `src/swiss-layouts.css` | 海报 / deck / 跨页 / 报告封面 / 落地 hero 五套骨架 + 刊头四点轴 + 分区标题 |
| `src/swiss-motion.js` | 计数入位 / 卡片归格 / 网格显影(IntersectionObserver + 单 rAF,派生动效) |
| `docs/usage.md` | **配对接入步骤 + 构造法 + 反模式**(先读这份) |
| `docs/specs/swiss-specs.json` | 源规格机读留存(网格 / 控件 / 版式 / 数据图元 / 字体 / 动效),不进 `files.src` |
| `preview/index.html` | 活标本页:网格线开关、控件集、数据图元、五套骨架缩略、入场动效各一次 |
| `scripts/assert_tokens.py` | 自检 |

## Agent apply steps

1. 先引**主题包**给他 token:`packs/swiss-classic/css/default.css`(或 `swiss-inverted`)。
2. 再引本包三个 CSS;要动效再加 `src/swiss-motion.js`(defer)。
3. 在外层容器打 `class="sw"`,内容包一层 `.sw-page`(居中最大宽 1920 + 外边距)。
4. 用 `.swiss-grid` 建 12 栏;元素用 `.sw-c1`…`.sw-c12` / `.sw-col-title|body|meta` 落栏。
5. 版式骨架直接套 `.sw-poster` / `.sw-deck` / `.sw-spread` / `.sw-cover` / `.sw-hero`。
6. 控件用 `.sw-btn` / `.sw-input` / `.sw-table` / `.sw-tag` / `.sw-pagination`;
   红只出现在 focus / selected / primary-hover。
7. 动效只加数据属性:`data-swiss-count` / `data-swiss-settle` / `data-swiss-grid-reveal`;
   教学网格线开关用 `data-swiss-grid-toggle`。
8. 自检:`python packs/swiss-style/scripts/assert_tokens.py`。

## Hard rules

- **不许在本包里改色**:要换色引主题包;本包 `:root` 只是兜底值(= swiss-classic)。
- 网格必须**真在 CSS Grid 里**,不是目测摆放;成品藏线,教学才画。
- 直角(圆角 ≤4px);禁 `box-shadow`、渐变、纹理、玻璃拟态。
- 红只做结构(线 / 编号 / 焦点 / 单一数据系列),覆盖率 ≤3%,不填正文、不铺大底。
- 一切文字 flush-left、右缘参差;禁居中大标题、禁两端对齐。
- 中文标题字距 0~+0.01em(**禁负值**)、正文行高 ≥1.6、大标题 900 字重。
- 间距落 4/8/12/16/24/32/48/64/96;行高取 `--swiss-baseline` 的整数倍。
- 动效**是派生,非官方规范**(derived, not canon):只动 `transform`/`opacity`,
  禁弹跳 / 旋转 >10° / 过冲;`prefers-reduced-motion` 时直接落终态。
- 系统字体(Helvetica Neue / PingFang)只进回退链,**禁 @font-face 随包分发**。
- 消费后在项目 `design-lock.json` 记 `assets[]`(`pack` / `version` / `sha`)。