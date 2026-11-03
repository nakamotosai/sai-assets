# Paper Editorial · 用法与配对规则

`paper-editorial` · mode `light` · 默认变体 `paper-editorial`

**signature**:纸感编辑：米白画布、墨色正文、刊头朱红

- 原色表:`tokens/absolute.json`(源盘 `colors` 原样,不改名不近似)。
- 语义映射:`tokens/semantic/paper-editorial.json`(`derived` 记每个语义键取自哪个源键;`a11y` 记对比度实测)。
- 变量双发:裸语义名(`--bg`)与 `--theme-` 前缀别名(`--theme-bg`)同值,便于接既有项目。
- 你不需要发明 hex:缺哪个角色就用对应变量,不要拿别的色近似。

## 变体表

| id | mode | 何时用 |
|---|---|---|
| `paper-editorial` | `light` | **默认**;纸感编辑：米白画布、墨色正文、刊头朱红 |

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

## 配对规则(谁配谁)

| 用途 | 变量 | 口径 |
|---|---|---|
| 正文 / 段落 | `--ink` | 页面主文字色,始终用于 `--bg` 之上 |
| 次要文字 | `--ink-muted` / `--ink-dim` | 说明、元信息、时间戳;`--ink-muted` 比 `--ink-dim` 更接近正文 |
| 卡面 / 面板 | `--surface` + `--border` | 卡底用 `--surface`,描边用 `--border`;需要抬升时 `--surface-2` |
| 主按钮 | `--accent` + `--on-accent` | 一个视区只放一个主 CTA;文字色必须用 `--on-accent`(实测 5.71:1) |
| 链接 | `--link` | 链接一律用 `--link`;**强调色(`--accent`)不与链接同色** —— 本主题源里 `--link` 与 `--accent` 同为 `#C41E3A`;同屏同时出现时,链接补下划线或改用 `--accent-2`,按钮保持 `--accent` |
| 危险 / 破坏性 | `--red` | 删除、错误、警报 |
| 成功 | `--green` | 通过、已完成  |
| 页面底 | `--bg` / `--bg-deep` | 大底用 `--bg`,更深的分层用 `--bg-deep` |

一行口径:正文 `--ink`,次要 `--ink-muted`/`--ink-dim`,卡面 `--surface`+`--border`,主按钮 `--accent`+`--on-accent`,链接 `--link`,危险 `--red`,成功 `--green`;强调色不做链接色。

## 字体配方(源 `fonts` 透传)

| 角色 | 变量 | 栈 |
|---|---|---|
| `display` | `--font-display` | "Noto Serif SC", "Source Han Serif SC", serif |
| `body` | `--font-body` | "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif |
| `mono` | `--font-mono` | "JetBrains Mono", Consolas, monospace |

- 标题用 `var(--font-display)`,正文 `var(--font-body)`,代码/数字 `var(--font-mono)`;字重与字号档位不在本包内,按下方 `do` 的约束落地。

## 圆角(源 `radius` 透传)

| 变量 | 值 |
|---|---|
| `--radius-sm` | 2px |
| `--radius-md` | 4px |
| `--radius-lg` | 8px |

## 推荐做法(源 `do`)

- 浅色 only
- 大标题衬线加粗
- 红只作强调不铺大底

## 反模式(源 `dont`)

- 深色底
- 细字重大标题
- 文字贴边

## 对比度实测(WCAG,自写公式)

| 组合 | 实测 | 门槛 |
|---|---|---|
| `ink` on `bg` | 16.13:1 | ≥ 4.5:1 |
| `onAccent` on `accent` | 5.71:1 | ≥ 4.5:1 |

### 语义层修正记录(透明留痕)

- 源里 --link 与 --accent 同为 #C41E3A(照源发;同屏同时出现时用 --accent-2 或下划线区分)

## 应用片段

```css
/* 单主题:把 css/default.css 全文贴进项目,或在 <head> 里 link 它 */
/* 多主题共存:link css/themes.css,用 <html data-theme="paper-editorial"> 决定何时生效(无 :root,不覆盖项目 token) */
```

```html
<html data-theme="paper-editorial" class="theme-paper-editorial" lang="zh-CN">
  <link rel="stylesheet" href="css/default.css">
```

## 来源 / Provenance

- [本地路径已移除]
