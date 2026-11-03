# Swiss Inverted（瑞士反色 / 暗色） · 用法与配对规则

`swiss-inverted` · mode `dark` · 默认变体 `swiss-inverted`

**signature**:暖黑纸底 + 暖白墨 + 同一个结构红；纸↔墨互换，红保持不变 —— 同字体两种墨极性

- 原色表:`tokens/absolute.json`(源盘 `colors` 原样,不改名不近似)。
- 语义映射:`tokens/semantic/swiss-inverted.json`(`derived` 记每个语义键取自哪个源键;`a11y` 记对比度实测)。
- 变量双发:裸语义名(`--bg`)与 `--theme-` 前缀别名(`--theme-bg`)同值,便于接既有项目。
- 你不需要发明 hex:缺哪个角色就用对应变量,不要拿别的色近似。

## 变体表

| id | mode | 何时用 |
|---|---|---|
| `swiss-inverted` | `dark` | **默认**;暖黑纸底 + 暖白墨 + 同一个结构红；纸↔墨互换，红保持不变 —— 同字体两种墨极性 |

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
| `link` | `--link` | `--theme-link` |
| `codeBg` | `--code-bg` | `--theme-code-bg` |
| `hairline` | `--hairline` | `--theme-hairline` |
| `gridRed` | `--grid-red` | `--theme-grid-red` |
| `chipBg` | `--chip-bg` | `--theme-chip-bg` |
| `chipFg` | `--chip-fg` | `--theme-chip-fg` |
| `shadow` | `--shadow` | `--theme-shadow` |

## 配对规则(谁配谁)

| 用途 | 变量 | 口径 |
|---|---|---|
| 正文 / 段落 | `--ink` | 页面主文字色,始终用于 `--bg` 之上 |
| 次要文字 | `--ink-muted` / `--ink-dim` | 说明、元信息、时间戳;`--ink-muted` 比 `--ink-dim` 更接近正文 |
| 卡面 / 面板 | `--surface` + `--border` | 卡底用 `--surface`,描边用 `--border`;需要抬升时 `--surface-2` |
| 主按钮 | `--accent` + `--on-accent` | 一个视区只放一个主 CTA;文字色必须用 `--on-accent`(实测 5.01:1) |
| 链接 | `--link` | 链接一律用 `--link`;**强调色(`--accent`)不与链接同色** —— 本主题 `--link` = `#E5544B` 与 `--accent` = `#D8232A` 不同值,可直接并置 |
| 危险 / 破坏性 | `--red` | 删除、错误、警报 |
| 成功 | `--green` | 通过、已完成(源色板无 green 角色,本包不发该变量) |
| 页面底 | `--bg` / `--bg-deep` | 大底用 `--bg`,更深的分层用 `--bg-deep` |

一行口径:正文 `--ink`,次要 `--ink-muted`/`--ink-dim`,卡面 `--surface`+`--border`,主按钮 `--accent`+`--on-accent`,链接 `--link`,危险 `--red`,成功 `--green`;强调色不做链接色。

## 字体配方(源 `fonts` 透传)

| 角色 | 变量 | 栈 |
|---|---|---|
| `display` | `--font-display` | "Helvetica Neue","Neue Haas Grotesk Display Pro",Helvetica,Inter,"Noto Sans SC","Source Han Sans SC","PingFang SC","Microsoft YaHei",Arial,sans-serif |
| `body` | `--font-body` | "Helvetica Neue","Neue Haas Grotesk Display Pro",Inter,"Noto Sans SC","Source Han Sans SC","PingFang SC","Microsoft YaHei",Arial,sans-serif |
| `mono` | `--font-mono` | "JetBrains Mono",ui-monospace,monospace |

- 标题用 `var(--font-display)`,正文 `var(--font-body)`,代码/数字 `var(--font-mono)`;字重与字号档位不在本包内,按下方 `do` 的约束落地。

## 圆角(源 `radius` 透传)

| 变量 | 值 |
|---|---|
| `--radius-sm` | 0px |
| `--radius-md` | 4px |
| `--radius-lg` | 6px |

## 推荐做法(源 `do`)

- 深色底用暖黑 #121212，绝不用纯 #000
- 纸暖白 #EDEBE6 当墨色（不是纯白 #FFF）
- 层级仍靠明度差（surface 比 bg 亮一档）+ 发丝线，不用投影
- 红保持 #D8232A（反色时略提亮到 #E5544B 做小字链接以满足对比）
- 深色底禁细体衬线（锯齿糊）

## 反模式(源 `dont`)

- 纯黑 #000 底、纯白 #FFF 字、冷灰
- 深色底上用 300 细字重
- 给深底加发光/霓虹/玻璃拟态
- 换第二个强调色

## 对比度实测(WCAG,自写公式)

| 组合 | 实测 | 门槛 |
|---|---|---|
| `ink` on `bg` | 15.72:1 | ≥ 4.5:1 |
| `onAccent` on `accent` | 5.01:1 | ≥ 4.5:1 |



## 应用片段

```css
/* 单主题:把 css/default.css 全文贴进项目,或在 <head> 里 link 它 */
/* 多主题共存:link css/themes.css,用 <html data-theme="swiss-inverted"> 决定何时生效(无 :root,不覆盖项目 token) */
```

```html
<html data-theme="swiss-inverted" class="theme-swiss-inverted" lang="zh-CN">
  <link rel="stylesheet" href="css/default.css">
```

## 来源 / Provenance

- B站 BV1hWar6SEVP 帧分析：反色卡（同字体两种墨极性）
- sai-frontend §4.0：深色底禁纯 #000、禁冷灰；深色底禁细体衬线
- （研究补充见 notes/research-corpus.md）
