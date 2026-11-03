---
name: fm-void
description: "FM Void(dark 全黑 void + 半透明等宽字；戏在 canvas 背景)。触发:FM Void / fm-void / 全黑 void + 半透明等宽字；戏在 canvas 背景。不做整站重构。"

---

# fm-void

让任何网页/面板变成 **FM Void** 的样子,不用 agent 自己编 hex。

全黑 void + 半透明等宽字；戏在 canvas 背景

## When to use

- 用户点名 FM Void / fm-void / 全黑 void + 半透明等宽字；戏在 canvas 背景
- 需要整套配色(bg / bg-deep / surface / ink / accent / 状态色)而不是单个色值
- 需要 UI 字小、letter-spacing 宽
- 需要 背景用 canvas 表演
- 需要 静音用 GainNode 思路

## When not to use

- 整站品牌设计系统(要自定义组件/字体体系)→ 用设计类 skill
- 别的主题族(用户点名其它风格)
- 整屏 CSS 抖
- 第二层粒子堆叠
- 彩色 UI chrome

## Default

**`fm-void`**(mode `dark`)

| role | hex |
|---|---|
| `bg` | `#000000` |
| `bgDeep` | `#000000` |
| `surface` | `rgba(255,255,255,0.04)` |
| `ink` | `#f5f5f5` |
| `accent` | `#ffffff` |
| `link` | `rgba(255,255,255,0.88)` |
| `red` | `#ff4d6d` |

## Sub-themes (id → when)

| id | mode | contrast | pick when |
|---|---|---|---|
| `fm-void` | `dark` | — | **默认**;全黑 void + 半透明等宽字；戏在 canvas 背景 |

## Files

| path | use |
|---|---|
| `tokens/absolute.json` | 源盘原色表(原样,含未参与语义映射的色) |
| `tokens/index.json` | 变体目录 + default |
| `tokens/semantic/fm-void.json` | 语义映射 + `derived`(取源哪个键)+ `a11y`(对比度实测) |
| `css/default.css` | 默认变体一份,含 `:root`,最快 apply |
| `css/all.css` | 全部变体 + 基础 chrome,含 `:root` |
| `css/themes.css` | 共存版:同 all.css 但**无 `:root`**,只 `[data-theme]` / `.theme-<id>` 作用域 |
| `docs/usage.md` | 配对规则 / 字体配方 / 反模式(中文) |
| `preview/index.html` | 活预览(独立单文件) |

## Agent apply steps

1. **Pick variant** — 用户点名变体就用它;否则 `fm-void`。
2. **Read tokens** — `tokens/semantic/fm-void.json`(`colors` 是语义键,`derived` 说明它取自源盘哪个键)。
3. **写入 CSS 变量** — 项目已有 `--bg/--ink/--accent` 就沿用同名;否则整份贴,或同时写 `--theme-*` 别名。
4. **挂主题作用域** — `<html data-theme="fm-void" class="theme-fm-void">`;多主题站点用 `css/themes.css`。
5. **选文件** — 单主题 `css/default.css`;多主题 `css/all.css`(带 `:root`)或 `css/themes.css`(不带)。
6. **按角色套件**:
   - 页面底 → `--bg` / `--bg-deep`
   - 卡面面板 → `--surface` + `--border`
   - 正文 → `--ink`;次要 → `--ink-muted` / `--ink-dim`
   - 主按钮 → `--accent` + `--on-accent`(一屏一个 CTA)
   - 链接 → `--link`(**不**用 `--accent`,强调色不做链接色)
   - 危险 → `--red`;成功 → `--green`
7. **不要发明 hex** — 颜色只能来自 `tokens/absolute.json`;缺角色就跳过该变量。
8. **自检** — `python scripts/assert_tokens.py` 必须打印 `PASS assert_tokens fm-void`。

### Minimal `:root` snippet (`fm-void`)

```css
:root {
  color-scheme: dark;
  --bg: #000000;
  --bg-deep: #000000;
  --surface: rgba(255,255,255,0.04);
  --surface-2: rgba(255,255,255,0.07);
  --border: rgba(255,255,255,0.12);
  --ink: #f5f5f5;
  --ink-muted: rgba(255,255,255,0.5);
  --ink-dim: rgba(255,255,255,0.35);
  --accent: #ffffff;
  --accent-2: rgba(255,255,255,0.72);
  --on-accent: #000000;
  --red: #ff4d6d;
  --green: #7dffa3;
  --aqua: #7dd3ff;
  --blue: #7dd3ff;
  --purple: #d4a5ff;
  --link: rgba(255,255,255,0.88);
  --code-bg: #0a0a0a;
  --shadow: none;
}
```

### HTML switch

```html
<html data-theme="fm-void" class="theme-fm-void">
  <link rel="stylesheet" href="css/default.css">
```

## Hard rules

- **Never** 整屏 CSS 抖(源 `dont`)
- **Never** 第二层粒子堆叠(源 `dont`)
- **Never** 彩色 UI chrome(源 `dont`)

## Notes

- 预览:`preview/index.html`,单文件可直接打开
- 来源与语义层修正:`docs/usage.md` 末节。
