# Minimalist Essential 极简 essentials · 用法与配对规则

`minimalist-essential` · mode `light` · 默认变体 `minimalist-essential`

**signature**:删到不能再删：中性底 + 单强调色 + 8pt 网格 + 单列信息流；一屏一任务

- 原色表:`tokens/absolute.json`(源盘 `colors` 原样,不改名不近似)。
- 语义映射:`tokens/semantic/minimalist-essential.json`(`derived` 记每个语义键取自哪个源键;`a11y` 记对比度实测)。
- 变量双发:裸语义名(`--bg`)与 `--theme-` 前缀别名(`--theme-bg`)同值,便于接既有项目。
- 你不需要发明 hex:缺哪个角色就用对应变量,不要拿别的色近似。

## 变体表

| id | mode | 何时用 |
|---|---|---|
| `minimalist-essential` | `light` | **默认**;删到不能再删：中性底 + 单强调色 + 8pt 网格 + 单列信息流；一屏一任务 |

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
| 主按钮 | `--accent` + `--on-accent` | 一个视区只放一个主 CTA;文字色必须用 `--on-accent`(实测 5.00:1) |
| 链接 | `--link` | 链接一律用 `--link`;**强调色(`--accent`)不与链接同色** —— 本主题源里 `--link` 与 `--accent` 同为 `#0F62FE`;同屏同时出现时,链接补下划线或改用 `--accent-2`,按钮保持 `--accent` |
| 危险 / 破坏性 | `--red` | 删除、错误、警报 |
| 成功 | `--green` | 通过、已完成  |
| 页面底 | `--bg` / `--bg-deep` | 大底用 `--bg`,更深的分层用 `--bg-deep` |

一行口径:正文 `--ink`,次要 `--ink-muted`/`--ink-dim`,卡面 `--surface`+`--border`,主按钮 `--accent`+`--on-accent`,链接 `--link`,危险 `--red`,成功 `--green`;强调色不做链接色。

## 字体配方(源 `fonts` 透传)

| 角色 | 变量 | 栈 |
|---|---|---|
| `body` | `--font-body` | "Inter", system-ui, "PingFang SC", "Microsoft YaHei", sans-serif |
| `display` | `--font-display` | "Inter", system-ui, "PingFang SC", "Microsoft YaHei", sans-serif |
| `mono` | `--font-mono` | "JetBrains Mono", ui-monospace, monospace |

- 标题用 `var(--font-display)`,正文 `var(--font-body)`,代码/数字 `var(--font-mono)`;字重与字号档位不在本包内,按下方 `do` 的约束落地。

## 圆角(源 `radius` 透传)

| 变量 | 值 |
|---|---|
| `--radius-lg` | 10px |
| `--radius-md` | 10px |
| `--radius-sm` | 6px |

## 推荐做法(源 `do`)

- 中性色做 90% 面积 + 1 个强调色只占 ≤10%，强调色只给主 CTA 与关键高亮
- 单无衬线家族 + ≤3 字重 + 等比字阶（12/14/16/20/24/32/48），Display 可用 clamp 流体
- 8pt 间距只用 4/8/16/24/32/48/64/96/128；section 上下只用 64/96/128（mobile 48/56/64）
- 单列信息流 + 大负空间 + 少而大的图 + 零装饰；正文单列 max-width 600-720px
- 首屏只答 1 个问题 + 只给 1 个主 CTA（落地页唯一可双 CTA 例外）
- 顶导 ≤5 项、深度 ≤3 层；超限进 mega / 着陆页 / 搜索 / 页脚
- 动效只动 transform/opacity：按压 100-150ms、切换 150-200ms、转场 200-300ms
- 内容多时靠折叠 + 搜索 + 本地导航 + 面包屑做密度极简，不靠留白最大化
- 留白占比 40-60% 是甜点，>75% 按空洞页返工

## 反模式(源 `dont`)

- 为白而白的空洞页：无层级的空 = 荒，不是极简
- 低对比浅灰字：正文 <4.5:1、大字 <3:1 直接返工
- 桌面端也藏导航（汉堡）：可找性 > 完整性
- 把粗野当极简：粗野是叛逆版，不是删到本质
- 一屏多 CTA 轰炸 / 自动轮播 / 弹窗
- 装饰三件套叠加：分割线 / 阴影 / 圆角只用最低值三选一
- 字族 >2、字重 >3 档；全站裸色值 / 裸 px（必须走 token）

## 对比度实测(WCAG,自写公式)

| 组合 | 实测 | 门槛 |
|---|---|---|
| `ink` on `bg` | 18.07:1 | ≥ 4.5:1 |
| `onAccent` on `accent` | 5.00:1 | ≥ 4.5:1 |

### 语义层修正记录(透明留痕)

- 源里 --link 与 --accent 同为 #0F62FE(照源发;同屏同时出现时用 --accent-2 或下划线区分)

## 应用片段

```css
/* 单主题:把 css/default.css 全文贴进项目,或在 <head> 里 link 它 */
/* 多主题共存:link css/themes.css,用 <html data-theme="minimalist-essential"> 决定何时生效(无 :root,不覆盖项目 token) */
```

```html
<html data-theme="minimalist-essential" class="theme-minimalist-essential" lang="zh-CN">
  <link rel="stylesheet" href="css/default.css">
```

## 来源 / Provenance

- (源 JSON 未登记来源)
