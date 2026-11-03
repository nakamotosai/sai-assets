---
name: minimalist-essential
description: "Minimalist Essential 极简 essentials(light 删到不能再删：中性底 + 单强调色 + 8pt 网格 + 单列信息流；一屏一任务)。触发:Minimalist Essential 极简 essentials / minimalist-essential / 删到不能再删：中性底 + 单强调色 + 8pt 网格 + 单列信息流；一屏一任务。不做整站重构。"

---

# minimalist-essential

让任何网页/面板变成 **Minimalist Essential 极简 essentials** 的样子,不用 agent 自己编 hex。

删到不能再删：中性底 + 单强调色 + 8pt 网格 + 单列信息流；一屏一任务

## When to use

- 用户点名 Minimalist Essential 极简 essentials / minimalist-essential / 删到不能再删：中性底 + 单强调色 + 8pt 网格 + 单列信息流；一屏一任务
- 需要整套配色(bg / bg-deep / surface / ink / accent / 状态色)而不是单个色值
- 需要 中性色做 90% 面积 + 1 个强调色只占 ≤10%，强调色只给主 CTA 与关键高亮
- 需要 单无衬线家族 + ≤3 字重 + 等比字阶（12/14/16/20/24/32/48），Display 可用 clamp 流体
- 需要 8pt 间距只用 4/8/16/24/32/48/64/96/128；section 上下只用 64/96/128（mobile 48/56/64）
- 需要 单列信息流 + 大负空间 + 少而大的图 + 零装饰；正文单列 max-width 600-720px
- 需要 首屏只答 1 个问题 + 只给 1 个主 CTA（落地页唯一可双 CTA 例外）
- 需要 顶导 ≤5 项、深度 ≤3 层；超限进 mega / 着陆页 / 搜索 / 页脚
- 需要 动效只动 transform/opacity：按压 100-150ms、切换 150-200ms、转场 200-300ms
- 需要 内容多时靠折叠 + 搜索 + 本地导航 + 面包屑做密度极简，不靠留白最大化
- 需要 留白占比 40-60% 是甜点，>75% 按空洞页返工

## When not to use

- 整站品牌设计系统(要自定义组件/字体体系)→ 用设计类 skill
- 别的主题族(用户点名其它风格)
- 为白而白的空洞页：无层级的空 = 荒，不是极简
- 低对比浅灰字：正文 <4.5:1、大字 <3:1 直接返工
- 桌面端也藏导航（汉堡）：可找性 > 完整性
- 把粗野当极简：粗野是叛逆版，不是删到本质
- 一屏多 CTA 轰炸 / 自动轮播 / 弹窗
- 装饰三件套叠加：分割线 / 阴影 / 圆角只用最低值三选一
- 字族 >2、字重 >3 档；全站裸色值 / 裸 px（必须走 token）

## Default

**`minimalist-essential`**(mode `light`)

| role | hex |
|---|---|
| `bg` | `#FAFAF8` |
| `bgDeep` | `#F1F0EC` |
| `surface` | `#FFFFFF` |
| `ink` | `#111111` |
| `accent` | `#0F62FE` |
| `link` | `#0F62FE` |
| `red` | `#C81E1E` |

## Sub-themes (id → when)

| id | mode | contrast | pick when |
|---|---|---|---|
| `minimalist-essential` | `light` | — | **默认**;删到不能再删：中性底 + 单强调色 + 8pt 网格 + 单列信息流；一屏一任务 |

## Files

| path | use |
|---|---|
| `tokens/absolute.json` | 源盘原色表(原样,含未参与语义映射的色) |
| `tokens/index.json` | 变体目录 + default |
| `tokens/semantic/minimalist-essential.json` | 语义映射 + `derived`(取源哪个键)+ `a11y`(对比度实测) |
| `css/default.css` | 默认变体一份,含 `:root`,最快 apply |
| `css/all.css` | 全部变体 + 基础 chrome,含 `:root` |
| `css/themes.css` | 共存版:同 all.css 但**无 `:root`**,只 `[data-theme]` / `.theme-<id>` 作用域 |
| `docs/usage.md` | 配对规则 / 字体配方 / 反模式(中文) |
| `preview/index.html` | `null`(本包无活预览) |

## Agent apply steps

1. **Pick variant** — 用户点名变体就用它;否则 `minimalist-essential`。
2. **Read tokens** — `tokens/semantic/minimalist-essential.json`(`colors` 是语义键,`derived` 说明它取自源盘哪个键)。
3. **写入 CSS 变量** — 项目已有 `--bg/--ink/--accent` 就沿用同名;否则整份贴,或同时写 `--theme-*` 别名。
4. **挂主题作用域** — `<html data-theme="minimalist-essential" class="theme-minimalist-essential">`;多主题站点用 `css/themes.css`。
5. **选文件** — 单主题 `css/default.css`;多主题 `css/all.css`(带 `:root`)或 `css/themes.css`(不带)。
6. **按角色套件**:
   - 页面底 → `--bg` / `--bg-deep`
   - 卡面面板 → `--surface` + `--border`
   - 正文 → `--ink`;次要 → `--ink-muted` / `--ink-dim`
   - 主按钮 → `--accent` + `--on-accent`(一屏一个 CTA)
   - 链接 → `--link`(**不**用 `--accent`,强调色不做链接色)
   - 危险 → `--red`;成功 → `--green`
7. **不要发明 hex** — 颜色只能来自 `tokens/absolute.json`;缺角色就跳过该变量。
8. **自检** — `python scripts/assert_tokens.py` 必须打印 `PASS assert_tokens minimalist-essential`。

### Minimal `:root` snippet (`minimalist-essential`)

```css
:root {
  color-scheme: light;
  --bg: #FAFAF8;
  --bg-deep: #F1F0EC;
  --surface: #FFFFFF;
  --surface-2: #F4F3EF;
  --border: #E8E6E1;
  --ink: #111111;
  --ink-muted: #6B6B6B;
  --ink-dim: #B5B5B5;
  --accent: #0F62FE;
  --accent-2: #0043CE;
  --on-accent: #FFFFFF;
  --red: #C81E1E;
  --green: #1E7E34;
  --blue: #0F62FE;
  --purple: #8E4EC6;
  --link: #0F62FE;
  --code-bg: #141414;
  --shadow: 0 1px 2px rgba(0,0,0,.06);
}
```

### HTML switch

```html
<html data-theme="minimalist-essential" class="theme-minimalist-essential">
  <link rel="stylesheet" href="css/default.css">
```

## Hard rules

- **Never** 为白而白的空洞页：无层级的空 = 荒，不是极简(源 `dont`)
- **Never** 低对比浅灰字：正文 <4.5:1、大字 <3:1 直接返工(源 `dont`)
- **Never** 桌面端也藏导航（汉堡）：可找性 > 完整性(源 `dont`)
- **Never** 把粗野当极简：粗野是叛逆版，不是删到本质(源 `dont`)
- **Never** 一屏多 CTA 轰炸 / 自动轮播 / 弹窗(源 `dont`)
- **Never** 装饰三件套叠加：分割线 / 阴影 / 圆角只用最低值三选一(源 `dont`)
- **Never** 字族 >2、字重 >3 档；全站裸色值 / 裸 px（必须走 token）(源 `dont`)

## Notes

- 预览:本包**无活预览**(`pack.json.files.preview = null`):源库无对应 demo 目录,按 `css/default.css` 与 `docs/usage.md` 落地即可
- 来源与语义层修正:`docs/usage.md` 末节。
