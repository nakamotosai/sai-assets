# Abyss Lab Record 暗黑实验记录 · 用法与配对规则

`abyss-lab-record` · mode `dark` · 默认变体 `abyss-lab-record`

**signature**:近黑底 + 工程网格 + 等宽 HUD + 单关键词橙，深色主叙事、纸面只做独立反转章节；面板全透明虚线检测框

- 原色表:`tokens/absolute.json`(源盘 `colors` 原样,不改名不近似)。
- 语义映射:`tokens/semantic/abyss-lab-record.json`(`derived` 记每个语义键取自哪个源键;`a11y` 记对比度实测)。
- 变量双发:裸语义名(`--bg`)与 `--theme-` 前缀别名(`--theme-bg`)同值,便于接既有项目。
- 你不需要发明 hex:缺哪个角色就用对应变量,不要拿别的色近似。

## 变体表

| id | mode | 何时用 |
|---|---|---|
| `abyss-lab-record` | `dark` | **默认**;近黑底 + 工程网格 + 等宽 HUD + 单关键词橙，深色主叙事、纸面只做独立反转章节；面板全透明虚线检测框 |

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
| `accent2` | `--accent-2` | `--theme-accent-2` |
| `red` | `--red` | `--theme-red` |
| `link` | `--link` | `--theme-link` |
| `grid` | `--grid` | `--theme-grid` |
| `glowW` | `--glow-w` | `--theme-glow-w` |
| `glowO` | `--glow-o` | `--theme-glow-o` |
| `paperBg` | `--paper-bg` | `--theme-paper-bg` |
| `paperInk` | `--paper-ink` | `--theme-paper-ink` |
| `paperStamp` | `--paper-stamp` | `--theme-paper-stamp` |
| `paperStampSmall` | `--paper-stamp-small` | `--theme-paper-stamp-small` |
| `paperField` | `--paper-field` | `--theme-paper-field` |
| `paperMuted` | `--paper-muted` | `--theme-paper-muted` |
| `shadow` | `--shadow` | `--theme-shadow` |
| `onAccent` | `--on-accent` | `--theme-on-accent` |

## 配对规则(谁配谁)

| 用途 | 变量 | 口径 |
|---|---|---|
| 正文 / 段落 | `--ink` | 页面主文字色,始终用于 `--bg` 之上 |
| 次要文字 | `--ink-muted` / `--ink-dim` | 说明、元信息、时间戳;`--ink-muted` 比 `--ink-dim` 更接近正文 |
| 卡面 / 面板 | `--surface` + `--border` | 卡底用 `--surface`,描边用 `--border`;需要抬升时 `--surface-2` |
| 主按钮 | `--accent` + `--on-accent` | 一个视区只放一个主 CTA;文字色必须用 `--on-accent`(实测 5.54:1) |
| 链接 | `--link` | 链接一律用 `--link`;**强调色(`--accent`)不与链接同色** —— 本主题 `--link` = `#FF7A33` 与 `--accent` = `#FF5A1F` 不同值,可直接并置 |
| 危险 / 破坏性 | `--red` | 删除、错误、警报 |
| 成功 | `--green` | 通过、已完成 (源色板无 green 角色,本包不发该变量) |
| 页面底 | `--bg` / `--bg-deep` | 大底用 `--bg`,更深的分层用 `--bg-deep` |

一行口径:正文 `--ink`,次要 `--ink-muted`/`--ink-dim`,卡面 `--surface`+`--border`,主按钮 `--accent`+`--on-accent`,链接 `--link`,危险 `--red`,成功 `--green`;强调色不做链接色。

## 字体配方(源 `fonts` 透传)

| 角色 | 变量 | 栈 |
|---|---|---|
| `display` | `--font-display` | "Abyss Display", "Archivo Black", "Arial Narrow Bold", "Noto Sans SC", sans-serif |
| `body` | `--font-body` | system-ui, "Noto Sans SC", "Noto Sans", "PingFang SC", "Microsoft YaHei", sans-serif |
| `mono` | `--font-mono` | "Abyss Mono", "JetBrains Mono", "IBM Plex Mono", "Noto Sans Mono", "Maple Mono NF CN", "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif |
| `hand` | `--font-hand` | "Abyss Hand", "Segoe Script", "Brush Script MT", "Snell Roundhand", "Caveat", "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif |

- 标题用 `var(--font-display)`,正文 `var(--font-body)`,代码/数字 `var(--font-mono)`;字重与字号档位不在本包内,按下方 `do` 的约束落地。

## 圆角(源 `radius` 透传)

| 变量 | 值 |
|---|---|
| `--radius-sm` | 8px |
| `--radius-md` | 8px |
| `--radius-lg` | 8px |

## 推荐做法(源 `do`)

- 近黑非纯黑底 + 单层工程网格（body 一层，透明度 <=0.14，不压文字）
- 标题无衬线 800-900，中文降一档；等宽管数据 HUD + tabular-nums；手写只做英文短句点缀
- 橙色只染单关键词/危险数值/选中态/光源，单屏 <=10%
- 面板全透明 + 1px 白线/虚线边框，检测框分静态虚线与描边流动两种
- 纸面只做独立 data-theme=light 反转章节（表单卡 + 墨字 + 单枚橙章）
- 动效只动 transform/opacity 150-300ms，描边流动是唯一的描边动画且降级静止
- mono 栈永不落回系统中文字体，裸 monospace/Menlo/Consolas 禁入生产栈

## 反模式(源 `dont`)

- 衬线标题/正文（Georgia/Noto Serif/SimSun/宋体禁入）
- 面板实底色 + 投影（纸面表单卡除外）
- 整词橙色大标题（23/24 类必须降为关键词橙 + 描边混排）
- 描边空心字常驻正文（只许 display 大字，须验对比度）
- 低透明 mono 小字（须提到 14px 或提亮到 4.5:1）
- 为状态新增强调色（用下划线/字重/底色微变）

## 对比度实测(WCAG,自写公式)

| 组合 | 实测 | 门槛 |
|---|---|---|
| `ink` on `bg` | 17.57:1 | ≥ 4.5:1 |
| `onAccent` on `accent` | 5.54:1 | ≥ 4.5:1 |

### 语义层修正记录(透明留痕)

- 源无可用 on-accent 配对;--on-accent 取源 paperInk(#1B1B18),配对 5.54:1

## 应用片段

```css
/* 单主题:把 css/default.css 全文贴进项目,或在 <head> 里 link 它 */
/* 多主题共存:link css/themes.css,用 <html data-theme="abyss-lab-record"> 决定何时生效(无 :root,不覆盖项目 token) */
```

```html
<html data-theme="abyss-lab-record" class="theme-abyss-lab-record" lang="zh-CN">
  <link rel="stylesheet" href="css/default.css">
```

## 来源 / Provenance

- 风格观测：桌面参考视频 @pleometric thats pretty cool（Opus 纯代码成片，156s/60fps），31 抽帧取 25 张关键帧
- 14 视角 workflow 合成（色彩/字体/版式/装饰/数据/材质/组件/对比度/动效/文案/层级/品牌/交互/响应式），全文见 opus55-motion/keyframes/lens-summary.md
- 本地验证：[本机路径已移除] demo，双视口截图已验）
