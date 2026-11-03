# 墨河 · 深色单色蓝（群青） · 用法与配对规则

`mohe-mono-blue` · mode `dark` · 默认变体 `mohe-mono-blue`

**signature**:近黑冷蓝底 + 单一色相 218–223° 明度梯；唯一有彩光是强调色 #6891d9；卡片半透明浮在 WebGL 墨河背景上；竖排书脊刊头（汉字竖排做书脊）；衬线标题 + 冷瓷白正文

- 原色表:`tokens/absolute.json`(源盘 `colors` 原样,不改名不近似)。
- 语义映射:`tokens/semantic/mohe-mono-blue.json`(`derived` 记每个语义键取自哪个源键;`a11y` 记对比度实测)。
- 变量双发:裸语义名(`--bg`)与 `--theme-` 前缀别名(`--theme-bg`)同值,便于接既有项目。
- 你不需要发明 hex:缺哪个角色就用对应变量,不要拿别的色近似。

## 变体表

| id | mode | 何时用 |
|---|---|---|
| `mohe-mono-blue` | `dark` | **默认**;近黑冷蓝底 + 单一色相 218–223° 明度梯；唯一有彩光是强调色 #6891d9；卡片半透明浮在 WebGL 墨河背景上；竖排书脊刊头（汉字竖排做书脊）；衬线标题 + 冷瓷白正文 |

## 变量表(语义名 ↔ 前缀别名)

| 语义键 | CSS 变量 | 别名 |
|---|---|---|
| `bg` | `--bg` | `--theme-bg` |
| `surface` | `--surface` | `--theme-surface` |
| `surface2` | `--surface-2` | `--theme-surface-2` |
| `border` | `--border` | `--theme-border` |
| `ink` | `--ink` | `--theme-ink` |
| `inkMuted` | `--ink-muted` | `--theme-ink-muted` |
| `inkDim` | `--ink-dim` | `--theme-ink-dim` |
| `accent` | `--accent` | `--theme-accent` |
| `link` | `--link` | `--theme-link` |
| `panel` | `--panel` | `--theme-panel` |
| `inkFaint` | `--ink-faint` | `--theme-ink-faint` |
| `borderStrong` | `--border-strong` | `--theme-border-strong` |
| `line` | `--line` | `--theme-line` |
| `void` | `--void` | `--theme-void` |
| `onAccent` | `--on-accent` | `--theme-on-accent` |

## 配对规则(谁配谁)

| 用途 | 变量 | 口径 |
|---|---|---|
| 正文 / 段落 | `--ink` | 页面主文字色,始终用于 `--bg` 之上 |
| 次要文字 | `--ink-muted` / `--ink-dim` | 说明、元信息、时间戳;`--ink-muted` 比 `--ink-dim` 更接近正文 |
| 卡面 / 面板 | `--surface` + `--border` | 卡底用 `--surface`,描边用 `--border`;需要抬升时 `--surface-2` |
| 主按钮 | `--accent` + `--on-accent` | 一个视区只放一个主 CTA;文字色必须用 `--on-accent`(实测 6.37:1) |
| 链接 | `--link` | 链接一律用 `--link`;**强调色(`--accent`)不与链接同色** —— 本主题 `--link` = `#9fbdf0` 与 `--accent` = `#6891d9` 不同值,可直接并置 |
| 危险 / 破坏性 | `--red` | 删除、错误、警报 |
| 成功 | `--green` | 通过、已完成 (源色板无 green 角色,本包不发该变量) |
| 页面底 | `--bg` / `--bg-deep` | 大底用 `--bg`,更深的分层用 `--bg-deep` |

一行口径:正文 `--ink`,次要 `--ink-muted`/`--ink-dim`,卡面 `--surface`+`--border`,主按钮 `--accent`+`--on-accent`,链接 `--link`,危险 `--red`,成功 `--green`;强调色不做链接色。

## 字体配方(源 `fonts` 透传)

| 角色 | 变量 | 栈 |
|---|---|---|
| `display` | `--font-display` | "Source Han Serif SC","Noto Serif SC",serif |
| `body` | `--font-body` | "Noto Sans SC","Noto Sans CJK SC","Source Han Sans SC","Microsoft YaHei",system-ui,sans-serif |
| `mono` | `--font-mono` | ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace |

- 标题用 `var(--font-display)`,正文 `var(--font-body)`,代码/数字 `var(--font-mono)`;字重与字号档位不在本包内,按下方 `do` 的约束落地。

## 圆角(源 `radius` 透传)

| 变量 | 值 |
|---|---|
| `--radius-sm` | 8px |
| `--radius-md` | 12px |
| `--radius-lg` | 12px |

## 推荐做法(源 `do`)

- 整套 UI 只用一个色相（背景的 218–223° 蓝），深度靠明度梯而非新色相
- 强调色取背景中光带同 hue 同饱和（h218 s52）再抬明度，别用高饱和电蓝
- 卡片半透明（rgba(12,22,44,.20)）浮在背景上，让背景墨河透出来
- 分类色只用同色相的明度/微彩差（亮蓝/中蓝灰/近中性冷灰蓝/蓝），靠文字标签辨义
- 竖排书脊刊头：writing-mode:vertical-rl + text-orientation:upright，衬线 900 字重
- 深色底衬线标题可用，正文一律无衬线（衬线细体在深底会糊）

## 反模式(源 `dont`)

- 4 个饱和分类色相（与蓝场打架，是「五颜六色」的根因）
- 高饱和电蓝强调色（h218 s86 = 读作另一个蓝）
- 在注释/代码里保留被 grep 的字符串（会让产物断言假红）
- 深色底用细体衬线正文（锯齿糊）

## 对比度实测(WCAG,自写公式)

| 组合 | 实测 | 门槛 |
|---|---|---|
| `ink` on `bg` | 17.60:1 | ≥ 4.5:1 |
| `onAccent` on `accent` | 6.37:1 | ≥ 4.5:1 |

### 语义层修正记录(透明留痕)

- 源无可用 on-accent 配对;--on-accent 取源 bg(#04070F),配对 6.37:1

## 应用片段

```css
/* 单主题:把 css/default.css 全文贴进项目,或在 <head> 里 link 它 */
/* 多主题共存:link css/themes.css,用 <html data-theme="mohe-mono-blue"> 决定何时生效(无 :root,不覆盖项目 token) */
```

```html
<html data-theme="mohe-mono-blue" class="theme-mohe-mono-blue" lang="zh-CN">
  <link rel="stylesheet" href="css/default.css">
```

## 来源 / Provenance

- 实盘：内部商业档案站(已脱敏)（群青·商业深度档案，2026-10-04 上线），源码 [本地路径已移除]
- 配色推导：背景分亮度带取像素实测（暗场 h226 s85 v13 / 中光带 h218 s52 v64 / 亮光 h220 s41 v96）→ 强调色取中光带同款 h218 s52 明度抬到 85 = #6891d9
- 用户验收：卡片不透明度 --panel-a 由用户肉眼定为 0.20，描边 rgba(104,145,217,.14)
- 背景：Lumen River WebGL 概念背景（engine.js + concepts.js，速度 15%，左侧遮罩 72%）
