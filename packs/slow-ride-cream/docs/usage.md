# Slow Ride Cream 慢骑奶油 · 用法与配对规则

`slow-ride-cream` · mode `light` · 默认变体 `slow-ride-cream`

**signature**:暖奶油纸面 + 鼠尾草绿 + 番茄围巾，慢日子编辑风；拱形画框 + 双语微标签 + 一句文案

- 原色表:`tokens/absolute.json`(源盘 `colors` 原样,不改名不近似)。
- 语义映射:`tokens/semantic/slow-ride-cream.json`(`derived` 记每个语义键取自哪个源键;`a11y` 记对比度实测)。
- 变量双发:裸语义名(`--bg`)与 `--theme-` 前缀别名(`--theme-bg`)同值,便于接既有项目。
- 你不需要发明 hex:缺哪个角色就用对应变量,不要拿别的色近似。

## 变体表

| id | mode | 何时用 |
|---|---|---|
| `slow-ride-cream` | `light` | **默认**;暖奶油纸面 + 鼠尾草绿 + 番茄围巾，慢日子编辑风；拱形画框 + 双语微标签 + 一句文案 |

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
| `pine` | `--pine` | `--theme-pine` |
| `bike` | `--bike` | `--theme-bike` |
| `bikeDark` | `--bike-dark` | `--theme-bike-dark` |
| `sage` | `--sage` | `--theme-sage` |
| `seafoam` | `--seafoam` | `--theme-seafoam` |
| `dune` | `--dune` | `--theme-dune` |
| `duneDeep` | `--dune-deep` | `--theme-dune-deep` |
| `sun` | `--sun` | `--theme-sun` |
| `fur` | `--fur` | `--theme-fur` |
| `furDeep` | `--fur-deep` | `--theme-fur-deep` |
| `outline` | `--outline` | `--theme-outline` |
| `shadow` | `--shadow` | `--theme-shadow` |

## 配对规则(谁配谁)

| 用途 | 变量 | 口径 |
|---|---|---|
| 正文 / 段落 | `--ink` | 页面主文字色,始终用于 `--bg` 之上 |
| 次要文字 | `--ink-muted` / `--ink-dim` | 说明、元信息、时间戳;`--ink-muted` 比 `--ink-dim` 更接近正文 |
| 卡面 / 面板 | `--surface` + `--border` | 卡底用 `--surface`,描边用 `--border`;需要抬升时 `--surface-2` |
| 主按钮 | `--accent` + `--on-accent` | 一个视区只放一个主 CTA;文字色必须用 `--on-accent`(实测 5.12:1) |
| 链接 | `--link` | 链接一律用 `--link`;**强调色(`--accent`)不与链接同色** —— 本主题 `--link` = `#356f65` 与 `--accent` = `#b34a32` 不同值,可直接并置 |
| 危险 / 破坏性 | `--red` | 删除、错误、警报 |
| 成功 | `--green` | 通过、已完成 |
| 页面底 | `--bg` / `--bg-deep` | 大底用 `--bg`,更深的分层用 `--bg-deep` |

一行口径:正文 `--ink`,次要 `--ink-muted`/`--ink-dim`,卡面 `--surface`+`--border`,主按钮 `--accent`+`--on-accent`,链接 `--link`,危险 `--red`,成功 `--green`;强调色不做链接色。

## 字体配方(源 `fonts` 透传)

| 角色 | 变量 | 栈 |
|---|---|---|
| `display` | `--font-display` | "Noto Serif SC", "Songti SC", serif |
| `body` | `--font-body` | ui-rounded, "PingFang SC", "Microsoft YaHei", sans-serif |
| `mono` | `--font-mono` | "JetBrains Mono", monospace |

- 标题用 `var(--font-display)`,正文 `var(--font-body)`,代码/数字 `var(--font-mono)`;字重与字号档位不在本包内,按下方 `do` 的约束落地。

## 圆角(源 `radius` 透传)

| 变量 | 值 |
|---|---|
| `--radius-sm` | 8px |
| `--radius-md` | 16px |
| `--radius-lg` | 24px |
| `--radius-arch` | 220px |

## 推荐做法(源 `do`)

- 纸面底色 + 深棕墨字，英文微标签全大写宽字距（如 MOTION STUDY — 001）
- 标题中文大字 + 一句短文案 + 一句慢生活 caption（风很轻/慢慢向前）
- 画框用拱形大圆角（rx 220 级）或通栏横幅，场景内画天空/沙丘/海带
- 插画扁平矢量 + 全图统一深色描边（约 3px），渐变只给天空和皮毛
- 太阳必带光晕圈，云 2-3 椭圆拼，点缀小花/石子/海鸥 m 形/帆船
- 番茄色围巾是唯一的动态强调色，随风飘
- 动效要慢：1.6-2s 循环，脚踏 IK + 辐条转 + 背景无缝滚动，必带暂停钮，尊重 prefers-reduced-motion
- 编号感：STUDY 001 / CLUB / ROUTE 之类的 catalog 标签

## 反模式(源 `dont`)

- 高饱和原色、大面积渐变、紫粉 AI 风
- 描边粗细不一、有的部件有描边有的没有
- 科技蓝、深色底、发光阴影
- 快节奏动效（<1s 循环显得赶）
- 无暂停钮的自动播放
- 中文标题加粗黑体顶格（要用衬线感/圆体感大字 + 字距）

## 对比度实测(WCAG,自写公式)

| 组合 | 实测 | 门槛 |
|---|---|---|
| `ink` on `bg` | 9.25:1 | ≥ 4.5:1 |
| `onAccent` on `accent` | 5.12:1 | ≥ 4.5:1 |

### 语义层留痕(透明记录)

- 源 accent/onAccent 实测 3.56:1 < 4.5,按源色板把 --accent 改用 accent2(#b34a32),配对 5.12:1

## 应用片段

```css
/* 单主题:把 css/default.css 全文贴进项目,或在 <head> 里 link 它 */
/* 多主题共存:link css/themes.css,用 <html data-theme="slow-ride-cream"> 决定何时生效(无 :root,不覆盖项目 token) */
```

```html
<html data-theme="slow-ride-cream" class="theme-slow-ride-cream" lang="zh-CN">
  <link rel="stylesheet" href="css/default.css">
```

## 来源 / Provenance

- 风格观测：meerkat-bicycle.vercel.app（狐獴沙漠页，仅看设计语言，未复制代码）
- 风格观测：用户提供的 gpt6 鹈鹕骑行图 x3（海岸整页 / 沿海横幅 / 俱乐部卡片）
- 本地验证：[本地路径已移除]
