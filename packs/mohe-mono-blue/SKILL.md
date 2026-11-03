---
name: mohe-mono-blue
description: "墨河 · 深色单色蓝（群青）(dark 近黑冷蓝底 + 单一色相 218–223° 明度梯；唯一有彩光是强调色 #6891d9；卡片半透明浮在 WebGL 墨河背景上；竖排书脊刊头（汉字竖排做书脊）；衬线标题 + 冷瓷白正文)。触发:墨河 · 深色单色蓝（群青） / mohe-mono-blue / 近黑冷蓝底 + 单一色相 218–223° 明度梯；唯一有彩光是强调色 #6891d9；卡片半透明浮在 WebGL 墨河背景上；竖排书脊刊头（汉字竖排做书脊）；衬线标题 + 冷瓷白正文。不做整站重构。"

---

# mohe-mono-blue

让任何网页/面板变成 **墨河 · 深色单色蓝（群青）** 的样子,不用 agent 自己编 hex。

近黑冷蓝底 + 单一色相 218–223° 明度梯；唯一有彩光是强调色 #6891d9；卡片半透明浮在 WebGL 墨河背景上；竖排书脊刊头（汉字竖排做书脊）；衬线标题 + 冷瓷白正文

## When to use

- 用户点名 墨河 · 深色单色蓝（群青） / mohe-mono-blue / 近黑冷蓝底 + 单一色相 218–223° 明度梯；唯一有彩光是强调色 #6891d9；卡片半透明浮在 WebGL 墨河背景上；竖排书脊刊头（汉字竖排做书脊）；衬线标题 + 冷瓷白正文
- 需要整套配色(bg / bg-deep / surface / ink / accent / 状态色)而不是单个色值
- 需要 整套 UI 只用一个色相（背景的 218–223° 蓝），深度靠明度梯而非新色相
- 需要 强调色取背景中光带同 hue 同饱和（h218 s52）再抬明度，别用高饱和电蓝
- 需要 卡片半透明（rgba(12,22,44,.20)）浮在背景上，让背景墨河透出来
- 需要 分类色只用同色相的明度/微彩差（亮蓝/中蓝灰/近中性冷灰蓝/蓝），靠文字标签辨义
- 需要 竖排书脊刊头：writing-mode:vertical-rl + text-orientation:upright，衬线 900 字重
- 需要 深色底衬线标题可用，正文一律无衬线（衬线细体在深底会糊）

## When not to use

- 整站品牌设计系统(要自定义组件/字体体系)→ 用设计类 skill
- 别的主题族(用户点名其它风格)
- 4 个饱和分类色相（与蓝场打架，是「五颜六色」的根因）
- 高饱和电蓝强调色（h218 s86 = 读作另一个蓝）
- 在注释/代码里保留被 grep 的字符串（会让产物断言假红）
- 深色底用细体衬线正文（锯齿糊）

## Default

**`mohe-mono-blue`**(mode `dark`)

| role | hex |
|---|---|
| `bg` | `#04070F` |
| `surface` | `rgba(80,110,170,.10)` |
| `ink` | `#EAF0FA` |
| `accent` | `#6891d9` |
| `link` | `#9fbdf0` |

## Sub-themes (id → when)

| id | mode | contrast | pick when |
|---|---|---|---|
| `mohe-mono-blue` | `dark` | — | **默认**;近黑冷蓝底 + 单一色相 218–223° 明度梯；唯一有彩光是强调色 #6891d9；卡片半透明浮在 WebGL 墨河背景上；竖排书脊刊头（汉字竖排做书脊）；衬线标题 + 冷瓷白正文 |

## Files

| path | use |
|---|---|
| `tokens/absolute.json` | 源盘原色表(原样,含未参与语义映射的色) |
| `tokens/index.json` | 变体目录 + default |
| `tokens/semantic/mohe-mono-blue.json` | 语义映射 + `derived`(取源哪个键)+ `a11y`(对比度实测) |
| `css/default.css` | 默认变体一份,含 `:root`,最快 apply |
| `css/all.css` | 全部变体 + 基础 chrome,含 `:root` |
| `css/themes.css` | 共存版:同 all.css 但**无 `:root`**,只 `[data-theme]` / `.theme-<id>` 作用域 |
| `docs/usage.md` | 配对规则 / 字体配方 / 反模式(中文) |
| `preview/index.html` | 活预览(独立单文件) |

## Agent apply steps

1. **Pick variant** — 用户点名变体就用它;否则 `mohe-mono-blue`。
2. **Read tokens** — `tokens/semantic/mohe-mono-blue.json`(`colors` 是语义键,`derived` 说明它取自源盘哪个键)。
3. **写入 CSS 变量** — 项目已有 `--bg/--ink/--accent` 就沿用同名;否则整份贴,或同时写 `--theme-*` 别名。
4. **挂主题作用域** — `<html data-theme="mohe-mono-blue" class="theme-mohe-mono-blue">`;多主题站点用 `css/themes.css`。
5. **选文件** — 单主题 `css/default.css`;多主题 `css/all.css`(带 `:root`)或 `css/themes.css`(不带)。
6. **按角色套件**:
   - 页面底 → `--bg` / `--bg-deep`
   - 卡面面板 → `--surface` + `--border`
   - 正文 → `--ink`;次要 → `--ink-muted` / `--ink-dim`
   - 主按钮 → `--accent` + `--on-accent`(一屏一个 CTA)
   - 链接 → `--link`(**不**用 `--accent`,强调色不做链接色)
   - 危险 → `--red`;成功 → `--green`
7. **不要发明 hex** — 颜色只能来自 `tokens/absolute.json`;缺角色就跳过该变量。
8. **自检** — `python scripts/assert_tokens.py` 必须打印 `PASS assert_tokens mohe-mono-blue`。

### Minimal `:root` snippet (`mohe-mono-blue`)

```css
:root {
  color-scheme: dark;
  --bg: #04070F;
  --surface: rgba(80,110,170,.10);
  --surface-2: #101B33;
  --border: rgba(104,145,217,.14);
  --ink: #EAF0FA;
  --ink-muted: #9EB0CC;
  --ink-dim: #9EB0CC;
  --accent: #6891d9;
  --link: #9fbdf0;
  --panel: rgba(12,22,44,.20);
  --ink-faint: #6B7E9C;
  --border-strong: rgba(104,145,217,.34);
  --line: rgba(104,145,217,.14);
  --void: #00000F;
  --on-accent: #04070F;
}
```

### HTML switch

```html
<html data-theme="mohe-mono-blue" class="theme-mohe-mono-blue">
  <link rel="stylesheet" href="css/default.css">
```

## Hard rules

- **Never** 4 个饱和分类色相（与蓝场打架，是「五颜六色」的根因）(源 `dont`)
- **Never** 高饱和电蓝强调色（h218 s86 = 读作另一个蓝）(源 `dont`)
- **Never** 在注释/代码里保留被 grep 的字符串（会让产物断言假红）(源 `dont`)
- **Never** 深色底用细体衬线正文（锯齿糊）(源 `dont`)

## Notes

- 预览:`preview/index.html`,单文件可直接打开
- 来源与语义层修正:`docs/usage.md` 末节。
