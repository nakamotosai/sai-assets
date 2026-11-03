---
name: paper-editorial
description: "Paper Editorial(light 纸感编辑：米白画布、墨色正文、刊头朱红)。触发:Paper Editorial / paper-editorial / 纸感编辑：米白画布、墨色正文、刊头朱红。不做整站重构。"

---

# paper-editorial

让任何网页/面板变成 **Paper Editorial** 的样子,不用 agent 自己编 hex。

纸感编辑：米白画布、墨色正文、刊头朱红

## When to use

- 用户点名 Paper Editorial / paper-editorial / 纸感编辑：米白画布、墨色正文、刊头朱红
- 需要整套配色(bg / bg-deep / surface / ink / accent / 状态色)而不是单个色值
- 需要 浅色 only
- 需要 大标题衬线加粗
- 需要 红只作强调不铺大底

## When not to use

- 整站品牌设计系统(要自定义组件/字体体系)→ 用设计类 skill
- 别的主题族(用户点名其它风格)
- 深色底
- 细字重大标题
- 文字贴边

## Default

**`paper-editorial`**(mode `light`)

| role | hex |
|---|---|
| `bg` | `#F7F3EB` |
| `bgDeep` | `#EFE9DF` |
| `surface` | `#FFFCF7` |
| `ink` | `#1A1714` |
| `accent` | `#C41E3A` |
| `link` | `#C41E3A` |
| `red` | `#C41E3A` |

## Sub-themes (id → when)

| id | mode | contrast | pick when |
|---|---|---|---|
| `paper-editorial` | `light` | — | **默认**;纸感编辑：米白画布、墨色正文、刊头朱红 |

## Files

| path | use |
|---|---|
| `tokens/absolute.json` | 源盘原色表(原样,含未参与语义映射的色) |
| `tokens/index.json` | 变体目录 + default |
| `tokens/semantic/paper-editorial.json` | 语义映射 + `derived`(取源哪个键)+ `a11y`(对比度实测) |
| `css/default.css` | 默认变体一份,含 `:root`,最快 apply |
| `css/all.css` | 全部变体 + 基础 chrome,含 `:root` |
| `css/themes.css` | 共存版:同 all.css 但**无 `:root`**,只 `[data-theme]` / `.theme-<id>` 作用域 |
| `docs/usage.md` | 配对规则 / 字体配方 / 反模式(中文) |
| `preview/index.html` | `null`(本包无活预览) |

## Agent apply steps

1. **Pick variant** — 用户点名变体就用它;否则 `paper-editorial`。
2. **Read tokens** — `tokens/semantic/paper-editorial.json`(`colors` 是语义键,`derived` 说明它取自源盘哪个键)。
3. **写入 CSS 变量** — 项目已有 `--bg/--ink/--accent` 就沿用同名;否则整份贴,或同时写 `--theme-*` 别名。
4. **挂主题作用域** — `<html data-theme="paper-editorial" class="theme-paper-editorial">`;多主题站点用 `css/themes.css`。
5. **选文件** — 单主题 `css/default.css`;多主题 `css/all.css`(带 `:root`)或 `css/themes.css`(不带)。
6. **按角色套件**:
   - 页面底 → `--bg` / `--bg-deep`
   - 卡面面板 → `--surface` + `--border`
   - 正文 → `--ink`;次要 → `--ink-muted` / `--ink-dim`
   - 主按钮 → `--accent` + `--on-accent`(一屏一个 CTA)
   - 链接 → `--link`(**不**用 `--accent`,强调色不做链接色)
   - 危险 → `--red`;成功 → `--green`
7. **不要发明 hex** — 颜色只能来自 `tokens/absolute.json`;缺角色就跳过该变量。
8. **自检** — `python scripts/assert_tokens.py` 必须打印 `PASS assert_tokens paper-editorial`。

### Minimal `:root` snippet (`paper-editorial`)

```css
:root {
  color-scheme: light;
  --bg: #F7F3EB;
  --bg-deep: #EFE9DF;
  --surface: #FFFCF7;
  --surface-2: #EFE9DF;
  --border: #D4CDC2;
  --ink: #1A1714;
  --ink-muted: #6B6560;
  --ink-dim: #8A847C;
  --accent: #C41E3A;
  --accent-2: #9A1830;
  --on-accent: #FFFCF7;
  --red: #C41E3A;
  --green: #2F6B4F;
  --aqua: #3D6B6B;
  --blue: #2C4A6E;
  --purple: #6B4A6B;
  --link: #C41E3A;
  --code-bg: #EFE9DF;
  --shadow: none;
}
```

### HTML switch

```html
<html data-theme="paper-editorial" class="theme-paper-editorial">
  <link rel="stylesheet" href="css/default.css">
```

## Hard rules

- **Never** 深色底(源 `dont`)
- **Never** 细字重大标题(源 `dont`)
- **Never** 文字贴边(源 `dont`)

## Notes

- 预览:本包**无活预览**(`pack.json.files.preview = null`):源库无对应 demo 目录,按 `css/default.css` 与 `docs/usage.md` 落地即可
- 来源与语义层修正:`docs/usage.md` 末节。
