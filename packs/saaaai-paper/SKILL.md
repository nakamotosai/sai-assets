---
name: saaaai-paper
description: "saaaai Paper(light 暖纸浅底 + 陶土 accent，主页 t6)。触发:saaaai Paper / saaaai-paper / 暖纸浅底 + 陶土 accent，主页 t6。不做整站重构。"

---

# saaaai-paper

让任何网页/面板变成 **saaaai Paper** 的样子,不用 agent 自己编 hex。

暖纸浅底 + 陶土 accent，主页 t6

## When to use

- 用户点名 saaaai Paper / saaaai-paper / 暖纸浅底 + 陶土 accent，主页 t6
- 需要整套配色(bg / bg-deep / surface / ink / accent / 状态色)而不是单个色值
- 需要 陶土作唯一 accent
- 需要 浅底卡片白抬升

## When not to use

- 整站品牌设计系统(要自定义组件/字体体系)→ 用设计类 skill
- 别的主题族(用户点名其它风格)
- 和 Claude 色板完全照抄不改名
- 高饱和多色

## Default

**`saaaai-paper`**(mode `light`)

| role | hex |
|---|---|
| `bg` | `#F5F2EC` |
| `bgDeep` | `#EBE6DC` |
| `surface` | `#FFFFFF` |
| `ink` | `#4A4A4A` |
| `accent` | `#B85C3E` |
| `link` | `#CC7D5E` |
| `red` | `#C64545` |

## Sub-themes (id → when)

| id | mode | contrast | pick when |
|---|---|---|---|
| `saaaai-paper` | `light` | — | **默认**;暖纸浅底 + 陶土 accent，主页 t6 |

## Files

| path | use |
|---|---|
| `tokens/absolute.json` | 源盘原色表(原样,含未参与语义映射的色) |
| `tokens/index.json` | 变体目录 + default |
| `tokens/semantic/saaaai-paper.json` | 语义映射 + `derived`(取源哪个键)+ `a11y`(对比度实测) |
| `css/default.css` | 默认变体一份,含 `:root`,最快 apply |
| `css/all.css` | 全部变体 + 基础 chrome,含 `:root` |
| `css/themes.css` | 共存版:同 all.css 但**无 `:root`**,只 `[data-theme]` / `.theme-<id>` 作用域 |
| `docs/usage.md` | 配对规则 / 字体配方 / 反模式(中文) |
| `preview/index.html` | 活预览(独立单文件) |

## Agent apply steps

1. **Pick variant** — 用户点名变体就用它;否则 `saaaai-paper`。
2. **Read tokens** — `tokens/semantic/saaaai-paper.json`(`colors` 是语义键,`derived` 说明它取自源盘哪个键)。
3. **写入 CSS 变量** — 项目已有 `--bg/--ink/--accent` 就沿用同名;否则整份贴,或同时写 `--theme-*` 别名。
4. **挂主题作用域** — `<html data-theme="saaaai-paper" class="theme-saaaai-paper">`;多主题站点用 `css/themes.css`。
5. **选文件** — 单主题 `css/default.css`;多主题 `css/all.css`(带 `:root`)或 `css/themes.css`(不带)。
6. **按角色套件**:
   - 页面底 → `--bg` / `--bg-deep`
   - 卡面面板 → `--surface` + `--border`
   - 正文 → `--ink`;次要 → `--ink-muted` / `--ink-dim`
   - 主按钮 → `--accent` + `--on-accent`(一屏一个 CTA)
   - 链接 → `--link`(**不**用 `--accent`,强调色不做链接色)
   - 危险 → `--red`;成功 → `--green`
7. **不要发明 hex** — 颜色只能来自 `tokens/absolute.json`;缺角色就跳过该变量。
8. **自检** — `python scripts/assert_tokens.py` 必须打印 `PASS assert_tokens saaaai-paper`。

### Minimal `:root` snippet (`saaaai-paper`)

```css
:root {
  color-scheme: light;
  --bg: #F5F2EC;
  --bg-deep: #EBE6DC;
  --surface: #FFFFFF;
  --surface-2: #F8F5F0;
  --border: rgba(0,0,0,0.12);
  --ink: #4A4A4A;
  --ink-muted: #6A6A6A;
  --ink-dim: #8A8A8A;
  --accent: #B85C3E;
  --accent-2: #CC7D5E;
  --on-accent: #FFFFFF;
  --red: #C64545;
  --green: #3D9A55;
  --aqua: #3D8A8A;
  --blue: #3D6A9A;
  --purple: #8A5A7A;
  --link: #CC7D5E;
  --code-bg: #1A1816;
  --shadow: 0 10px 30px rgba(74,74,74,.10);
}
```

### HTML switch

```html
<html data-theme="saaaai-paper" class="theme-saaaai-paper">
  <link rel="stylesheet" href="css/default.css">
```

## Hard rules

- **Never** 和 Claude 色板完全照抄不改名(源 `dont`)
- **Never** 高饱和多色(源 `dont`)

## Notes

- 预览:`preview/index.html`,单文件可直接打开
- 来源与语义层修正:`docs/usage.md` 末节。
