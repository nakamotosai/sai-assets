# Tokyo Crime Dark 暖黑数据图 · 用法与配对规则

`tokyo-crime-dark` · mode `dark` · 默认变体 `tokyo-crime-dark`

**signature**:暖黑底 #16130e 配暖色顺序带：深色底上把 ColorBrewer YlOrRd 整体提亮 15% 修对比（断点不动），深棕分隔线代替白描边；数据密集型地图/图表的深色方案。

- 原色表:`tokens/absolute.json`(源盘 `colors` 原样,不改名不近似)。
- 语义映射:`tokens/semantic/tokyo-crime-dark.json`(`derived` 记每个语义键取自哪个源键;`a11y` 记对比度实测)。
- 变量双发:裸语义名(`--bg`)与 `--theme-` 前缀别名(`--theme-bg`)同值,便于接既有项目。
- 你不需要发明 hex:缺哪个角色就用对应变量,不要拿别的色近似。

## 变体表

| id | mode | 何时用 |
|---|---|---|
| `tokyo-crime-dark` | `dark` | **默认**;暖黑底 #16130e 配暖色顺序带：深色底上把 ColorBrewer YlOrRd 整体提亮 15% 修对比（断点不动），深棕分隔线代替白描边；数据密集型地图/图表的深色方案。 |

## 变量表(语义名 ↔ 前缀别名)

| 语义键 | CSS 变量 | 别名 |
|---|---|---|
| `bg` | `--bg` | `--theme-bg` |
| `bgDeep` | `--bg-deep` | `--theme-bg-deep` |
| `surface` | `--surface` | `--theme-surface` |
| `surface2` | `--surface-2` | `--theme-surface-2` |
| `border` | `--border` | `--theme-border` |
| `ink` | `--ink` | `--theme-ink` |
| `inkMuted` | `--ink-muted` | `--theme-ink-muted` |
| `inkDim` | `--ink-dim` | `--theme-ink-dim` |
| `accent` | `--accent` | `--theme-accent` |
| `accent2` | `--accent-2` | `--theme-accent-2` |
| `onAccent` | `--on-accent` | `--theme-on-accent` |
| `red` | `--red` | `--theme-red` |
| `green` | `--green` | `--theme-green` |
| `aqua` | `--aqua` | `--theme-aqua` |
| `blue` | `--blue` | `--theme-blue` |
| `purple` | `--purple` | `--theme-purple` |
| `link` | `--link` | `--theme-link` |
| `codeBg` | `--code-bg` | `--theme-code-bg` |
| `shadow` | `--shadow` | `--theme-shadow` |
| `nodata` | `--nodata` | `--theme-nodata` |
| `nopop` | `--nopop` | `--theme-nopop` |
| `hi` | `--hi` | `--theme-hi` |
| `mapbg` | `--mapbg` | `--theme-mapbg` |

## 配对规则(谁配谁)

| 用途 | 变量 | 口径 |
|---|---|---|
| 正文 / 段落 | `--ink` | 页面主文字色,始终用于 `--bg` 之上 |
| 次要文字 | `--ink-muted` / `--ink-dim` | 说明、元信息、时间戳;`--ink-muted` 比 `--ink-dim` 更接近正文 |
| 卡面 / 面板 | `--surface` + `--border` | 卡底用 `--surface`,描边用 `--border`;需要抬升时 `--surface-2` |
| 主按钮 | `--accent` + `--on-accent` | 一个视区只放一个主 CTA;文字色必须用 `--on-accent`(实测 5.52:1) |
| 链接 | `--link` | 链接一律用 `--link`;**强调色(`--accent`)不与链接同色** —— 本主题 `--link` = `#7cc4ff` 与 `--accent` = `#fc4e2a` 不同值,可直接并置 |
| 危险 / 破坏性 | `--red` | 删除、错误、警报 |
| 成功 | `--green` | 通过、已完成  |
| 页面底 | `--bg` / `--bg-deep` | 大底用 `--bg`,更深的分层用 `--bg-deep` |

一行口径:正文 `--ink`,次要 `--ink-muted`/`--ink-dim`,卡面 `--surface`+`--border`,主按钮 `--accent`+`--on-accent`,链接 `--link`,危险 `--red`,成功 `--green`;强调色不做链接色。

## 字体配方(源 `fonts` 透传)

| 角色 | 变量 | 栈 |
|---|---|---|
| `display` | `--font-display` | "Noto Serif SC", "Songti SC", serif |
| `body` | `--font-body` | "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif |
| `mono` | `--font-mono` | "JetBrains Mono", ui-monospace, monospace |

- 标题用 `var(--font-display)`,正文 `var(--font-body)`,代码/数字 `var(--font-mono)`;字重与字号档位不在本包内,按下方 `do` 的约束落地。

## 圆角(源 `radius` 透传)

| 变量 | 值 |
|---|---|
| `--radius-sm` | 8px |
| `--radius-md` | 10px |
| `--radius-lg` | 12px |

## 推荐做法(源 `do`)

- 暖黑（#16130e 系）而非中性纯黑——配暖色带（YlOrRd/暖橙红）不发蓝、不发脏
- 顺序色带在深色底整体提亮 ~15%（逐通道 c+(255-c)*0.15），只深色生效；断点/档位/数据一字不改，保证跨主题同色=同危险度
- 深色底的地图分隔线用深棕 #3a3128，别用纯白——白线在暖黑上像网格噪点
- 无数据/无人口档单独给灰（#4a4238 / #55504a），别混进色带
- 顶栏按钮选中态反白改「强调色底 + 深字」（onAccent=bg），焦点环换成亮蓝 #7cc4ff 保证可见
- localStorage 记住选择 + 默认浅色；切换不重建数据/不改断点，只重设色
- 深色独立调色，不把浅色 token 直接反相

## 反模式(源 `dont`)

- 别用中性纯黑 #000/#111 配暖色带（冷暖打架，浅黄档发灰）
- 别为深色重算分档断点（会破坏跨主题/跨时间可比性）
- 别把地图描边留在纯白（暖黑底上白线过曝刺眼）
- 别在深色下沿用浅色的无数据浅灰 #eeeeee（会变成高亮块）

## 对比度实测(WCAG,自写公式)

| 组合 | 实测 | 门槛 |
|---|---|---|
| `ink` on `bg` | 16.17:1 | ≥ 4.5:1 |
| `onAccent` on `accent` | 5.52:1 | ≥ 4.5:1 |



## 应用片段

```css
/* 单主题:把 css/default.css 全文贴进项目,或在 <head> 里 link 它 */
/* 多主题共存:link css/themes.css,用 <html data-theme="tokyo-crime-dark"> 决定何时生效(无 :root,不覆盖项目 token) */
```

```html
<html data-theme="tokyo-crime-dark" class="theme-tokyo-crime-dark" lang="zh-CN">
  <link rel="stylesheet" href="css/default.css">
```

## 来源 / Provenance

- 本地验证：[本地路径已移除] choropleth 深色模式，QA 72/72 含 T1–T8 深色项）
- 配色来源：本项目浅色版（白底 + YlOrRd 9 级绝对标尺）的深色姊妹版，独立调色不搬浅色套色
- 方法：ColorBrewer YlOrRd 9 色 + 深色下 lighten(c, 0.15)（只深色生效，断点/档位不变，跨主题同色=同危险度）
