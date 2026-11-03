---
name: saaaai-mono
description: "saaaai Mono(dark 近黑 void + 银灰 ink + 等高线轮廓当 accent)。触发:saaaai Mono / saaaai-mono / 近黑 void + 银灰 ink + 等高线轮廓当 accent。不做整站重构。"

---

# saaaai-mono

让任何网页/面板变成 **saaaai Mono** 的样子,不用 agent 自己编 hex。

近黑 void + 银灰 ink + 等高线轮廓当 accent

## When to use

- 用户点名 saaaai Mono / `saaaai-mono` / saaaai Mono / saaaai-mono / 近黑 void + 银灰 ink + 等高线轮廓当 accent
- 需要整套配色(bg / bg-deep / surface / ink / accent / 状态色)而不是单个色值
- 需要 单色强调
- 需要 留大负空间
- 需要 contour 与 accent 可分离

## When not to use

- 整站品牌设计系统(要自定义组件/字体体系)→ 用设计类 skill
- 别的主题族(用户点名其它风格)
- 彩虹装饰默认开
- 浅色 token 混进 t1

## Default

**`saaaai-mono`**(mode `dark`)

| role | hex |
|---|---|
| `bg` | `#06070A` |
| `bgDeep` | `#040508` |
| `surface` | `#0E0F14` |
| `ink` | `#F4F4F5` |
| `accent` | `#E8E8EC` |
| `link` | `#E8E8EC` |
| `red` | `#FF2D7E` |

## Sub-themes (id → when)

| id | mode | contrast | pick when |
|---|---|---|---|
| `saaaai-mono` | `dark` | — | **默认**;近黑 void + 银灰 ink + 等高线轮廓当 accent |

## Files

| path | use |
|---|---|
| `tokens/absolute.json` | 源盘原色表(原样,含未参与语义映射的色) |
| `tokens/index.json` | 变体目录 + default |
| `tokens/semantic/saaaai-mono.json` | 语义映射 + `derived`(取源哪个键)+ `a11y`(对比度实测) |
| `css/default.css` | 默认变体一份,含 `:root`,最快 apply |
| `css/all.css` | 全部变体 + 基础 chrome,含 `:root` |
| `css/themes.css` | 共存版:同 all.css 但**无 `:root`**,只 `[data-theme]` / `.theme-<id>` 作用域 |
| `docs/usage.md` | 配对规则 / 字体配方 / 反模式(中文) |
| `preview/index.html` | 活预览(独立单文件) |

## Agent apply steps

1. **Pick variant** — 用户点名变体就用它;否则 `saaaai-mono`。
2. **Read tokens** — `tokens/semantic/saaaai-mono.json`(`colors` 是语义键,`derived` 说明它取自源盘哪个键)。
3. **写入 CSS 变量** — 项目已有 `--bg/--ink/--accent` 就沿用同名;否则整份贴,或同时写 `--theme-*` 别名。
4. **挂主题作用域** — `<html data-theme="saaaai-mono" class="theme-saaaai-mono">`;多主题站点用 `css/themes.css`。
5. **选文件** — 单主题 `css/default.css`;多主题 `css/all.css`(带 `:root`)或 `css/themes.css`(不带)。
6. **按角色套件**:
   - 页面底 → `--bg` / `--bg-deep`
   - 卡面面板 → `--surface` + `--border`
   - 正文 → `--ink`;次要 → `--ink-muted` / `--ink-dim`
   - 主按钮 → `--accent` + `--on-accent`(一屏一个 CTA)
   - 链接 → `--link`(**不**用 `--accent`,强调色不做链接色)
   - 危险 → `--red`;成功 → `--green`
7. **不要发明 hex** — 颜色只能来自 `tokens/absolute.json`;缺角色就跳过该变量。
8. **自检** — `python scripts/assert_tokens.py` 必须打印 `PASS assert_tokens saaaai-mono`。

### Minimal `:root` snippet (`saaaai-mono`)

```css
:root {
  color-scheme: dark;
  --bg: #06070A;
  --bg-deep: #040508;
  --surface: #0E0F14;
  --surface-2: #161820;
  --border: rgba(255,255,255,0.12);
  --ink: #F4F4F5;
  --ink-muted: #A8A8A8;
  --ink-dim: #8B8D94;
  --accent: #E8E8EC;
  --accent-2: #C8C8CC;
  --on-accent: #06070A;
  --red: #FF2D7E;
  --green: #3DDC97;
  --aqua: #00D4FF;
  --blue: #00D4FF;
  --purple: #FF2D7E;
  --link: #E8E8EC;
  --code-bg: #0E0F14;
  --shadow: 0 12px 40px rgba(0,0,0,.55);
}
```

### HTML switch

```html
<html data-theme="saaaai-mono" class="theme-saaaai-mono">
  <link rel="stylesheet" href="css/default.css">
```

## Hard rules

- **Never** 彩虹装饰默认开(源 `dont`)
- **Never** 浅色 token 混进 t1(源 `dont`)

## Notes

- 预览:`preview/index.html`,单文件可直接打开
- 来源与语义层修正:`docs/usage.md` 末节。
