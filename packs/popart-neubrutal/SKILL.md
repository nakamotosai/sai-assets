---
name: popart-neubrutal
description: "Pop Art · Neo Brutal(light 奶油底 + 厚黑描边 + 硬偏移阴影 + 贴纸撞色)。触发:Pop Art · Neo Brutal / popart-neubrutal / 奶油底 + 厚黑描边 + 硬偏移阴影 + 贴纸撞色。不做整站重构。"

---

# popart-neubrutal

让任何网页/面板变成 **Pop Art · Neo Brutal** 的样子,不用 agent 自己编 hex。

奶油底 + 厚黑描边 + 硬偏移阴影 + 贴纸撞色

## When to use

- 用户点名 Pop Art · Neo Brutal / `popart-neubrutal` / Pop Art · Neo Brutal / popart-neubrutal / 奶油底 + 厚黑描边 + 硬偏移阴影 + 贴纸撞色
- 需要整套配色(bg / bg-deep / surface / ink / accent / 状态色)而不是单个色值
- 需要 4px 黑边
- 需要 硬阴影无模糊
- 需要 按下阴影收 2px

## When not to use

- 整站品牌设计系统(要自定义组件/字体体系)→ 用设计类 skill
- 别的主题族(用户点名其它风格)
- 柔光模糊阴影
- 细灰边框当主结构
- 渐变背景

## Default

**`popart-neubrutal`**(mode `light`)

| role | hex |
|---|---|
| `bg` | `#FFFDF5` |
| `bgDeep` | `#FFF6D8` |
| `surface` | `#FFFFFF` |
| `ink` | `#000000` |
| `accent` | `#FF6B6B` |
| `link` | `#000000` |
| `red` | `#FF6B6B` |

## Sub-themes (id → when)

| id | mode | contrast | pick when |
|---|---|---|---|
| `popart-neubrutal` | `light` | — | **默认**;奶油底 + 厚黑描边 + 硬偏移阴影 + 贴纸撞色 |

## Files

| path | use |
|---|---|
| `tokens/absolute.json` | 源盘原色表(原样,含未参与语义映射的色) |
| `tokens/index.json` | 变体目录 + default |
| `tokens/semantic/popart-neubrutal.json` | 语义映射 + `derived`(取源哪个键)+ `a11y`(对比度实测) |
| `css/default.css` | 默认变体一份,含 `:root`,最快 apply |
| `css/all.css` | 全部变体 + 基础 chrome,含 `:root` |
| `css/themes.css` | 共存版:同 all.css 但**无 `:root`**,只 `[data-theme]` / `.theme-<id>` 作用域 |
| `docs/usage.md` | 配对规则 / 字体配方 / 反模式(中文) |
| `preview/index.html` | 活预览(独立单文件) |

## Agent apply steps

1. **Pick variant** — 用户点名变体就用它;否则 `popart-neubrutal`。
2. **Read tokens** — `tokens/semantic/popart-neubrutal.json`(`colors` 是语义键,`derived` 说明它取自源盘哪个键)。
3. **写入 CSS 变量** — 项目已有 `--bg/--ink/--accent` 就沿用同名;否则整份贴,或同时写 `--theme-*` 别名。
4. **挂主题作用域** — `<html data-theme="popart-neubrutal" class="theme-popart-neubrutal">`;多主题站点用 `css/themes.css`。
5. **选文件** — 单主题 `css/default.css`;多主题 `css/all.css`(带 `:root`)或 `css/themes.css`(不带)。
6. **按角色套件**:
   - 页面底 → `--bg` / `--bg-deep`
   - 卡面面板 → `--surface` + `--border`
   - 正文 → `--ink`;次要 → `--ink-muted` / `--ink-dim`
   - 主按钮 → `--accent` + `--on-accent`(一屏一个 CTA)
   - 链接 → `--link`(**不**用 `--accent`,强调色不做链接色)
   - 危险 → `--red`;成功 → `--green`
7. **不要发明 hex** — 颜色只能来自 `tokens/absolute.json`;缺角色就跳过该变量。
8. **自检** — `python scripts/assert_tokens.py` 必须打印 `PASS assert_tokens popart-neubrutal`。

### Minimal `:root` snippet (`popart-neubrutal`)

```css
:root {
  color-scheme: light;
  --bg: #FFFDF5;
  --bg-deep: #FFF6D8;
  --surface: #FFFFFF;
  --surface-2: #FFF0F0;
  --border: #000000;
  --ink: #000000;
  --ink-muted: #333333;
  --ink-dim: #666666;
  --accent: #FF6B6B;
  --accent-2: #FFD93D;
  --on-accent: #000000;
  --red: #FF6B6B;
  --green: #6BCB77;
  --aqua: #4D96FF;
  --blue: #4D96FF;
  --purple: #C4B5FD;
  --link: #000000;
  --code-bg: #FFF6D8;
  --shadow: 6px 6px 0 #000000;
}
```

### HTML switch

```html
<html data-theme="popart-neubrutal" class="theme-popart-neubrutal">
  <link rel="stylesheet" href="css/default.css">
```

## Hard rules

- **Never** 柔光模糊阴影(源 `dont`)
- **Never** 细灰边框当主结构(源 `dont`)
- **Never** 渐变背景(源 `dont`)

## Notes

- 预览:`preview/index.html`,单文件可直接打开
- 来源与语义层修正:`docs/usage.md` 末节。
