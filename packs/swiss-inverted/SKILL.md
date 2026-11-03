---
name: swiss-inverted
description: "Swiss Inverted（瑞士反色 / 暗色）(dark 暖黑纸底 + 暖白墨 + 同一个结构红；纸↔墨互换，红保持不变 —— 同字体两种墨极性)。触发:Swiss Inverted（瑞士反色 / 暗色） / swiss-inverted / 暖黑纸底 + 暖白墨 + 同一个结构红；纸↔墨互换，红保持不变 —— 同字体两种墨极性。不做整站重构。"

---

# swiss-inverted

让任何网页/面板变成 **Swiss Inverted（瑞士反色 / 暗色）** 的样子,不用 agent 自己编 hex。

暖黑纸底 + 暖白墨 + 同一个结构红；纸↔墨互换，红保持不变 —— 同字体两种墨极性

## When to use

- 用户点名 Swiss Inverted（瑞士反色 / 暗色） / `swiss-inverted` / Swiss Inverted（瑞士反色 / 暗色） / swiss-inverted / 暖黑纸底 + 暖白墨 + 同一个结构红；纸↔墨互换，红保持不变 —— 同字体两种墨极性
- 需要整套配色(bg / bg-deep / surface / ink / accent / 状态色)而不是单个色值
- 需要 深色底用暖黑 #121212，绝不用纯 #000
- 需要 纸暖白 #EDEBE6 当墨色（不是纯白 #FFF）
- 需要 层级仍靠明度差（surface 比 bg 亮一档）+ 发丝线，不用投影
- 需要 红保持 #D8232A（反色时略提亮到 #E5544B 做小字链接以满足对比）
- 需要 深色底禁细体衬线（锯齿糊）

## When not to use

- 整站品牌设计系统(要自定义组件/字体体系)→ 用设计类 skill
- 别的主题族(用户点名其它风格)
- 纯黑 #000 底、纯白 #FFF 字、冷灰
- 深色底上用 300 细字重
- 给深底加发光/霓虹/玻璃拟态
- 换第二个强调色

## Default

**`swiss-inverted`**(mode `dark`)

| role | hex |
|---|---|
| `bg` | `#121212` |
| `bgDeep` | `#0E0E0E` |
| `surface` | `#1A1A1A` |
| `ink` | `#EDEBE6` |
| `accent` | `#D8232A` |
| `link` | `#E5544B` |
| `red` | `#D8232A` |

## Sub-themes (id → when)

| id | mode | contrast | pick when |
|---|---|---|---|
| `swiss-inverted` | `dark` | — | **默认**;暖黑纸底 + 暖白墨 + 同一个结构红；纸↔墨互换，红保持不变 —— 同字体两种墨极性 |

## Files

| path | use |
|---|---|
| `tokens/absolute.json` | 源盘原色表(原样,含未参与语义映射的色) |
| `tokens/index.json` | 变体目录 + default |
| `tokens/semantic/swiss-inverted.json` | 语义映射 + `derived`(取源哪个键)+ `a11y`(对比度实测) |
| `css/default.css` | 默认变体一份,含 `:root`,最快 apply |
| `css/all.css` | 全部变体 + 基础 chrome,含 `:root` |
| `css/themes.css` | 共存版:同 all.css 但**无 `:root`**,只 `[data-theme]` / `.theme-<id>` 作用域 |
| `docs/usage.md` | 配对规则 / 字体配方 / 反模式(中文) |
| `preview/index.html` | 活预览(独立单文件) |

## Agent apply steps

1. **Pick variant** — 用户点名变体就用它;否则 `swiss-inverted`。
2. **Read tokens** — `tokens/semantic/swiss-inverted.json`(`colors` 是语义键,`derived` 说明它取自源盘哪个键)。
3. **写入 CSS 变量** — 项目已有 `--bg/--ink/--accent` 就沿用同名;否则整份贴,或同时写 `--theme-*` 别名。
4. **挂主题作用域** — `<html data-theme="swiss-inverted" class="theme-swiss-inverted">`;多主题站点用 `css/themes.css`。
5. **选文件** — 单主题 `css/default.css`;多主题 `css/all.css`(带 `:root`)或 `css/themes.css`(不带)。
6. **按角色套件**:
   - 页面底 → `--bg` / `--bg-deep`
   - 卡面面板 → `--surface` + `--border`
   - 正文 → `--ink`;次要 → `--ink-muted` / `--ink-dim`
   - 主按钮 → `--accent` + `--on-accent`(一屏一个 CTA)
   - 链接 → `--link`(**不**用 `--accent`,强调色不做链接色)
   - 危险 → `--red`;成功 → `--green`
7. **不要发明 hex** — 颜色只能来自 `tokens/absolute.json`;缺角色就跳过该变量。
8. **自检** — `python scripts/assert_tokens.py` 必须打印 `PASS assert_tokens swiss-inverted`。

### Minimal `:root` snippet (`swiss-inverted`)

```css
:root {
  color-scheme: dark;
  --bg: #121212;
  --bg-deep: #0E0E0E;
  --surface: #1A1A1A;
  --surface-2: #222222;
  --border: #EDEBE6;
  --ink: #EDEBE6;
  --ink-muted: #9A958D;
  --ink-dim: #6B6862;
  --accent: #D8232A;
  --accent-2: #E5544B;
  --on-accent: #FFFFFF;
  --red: #D8232A;
  --link: #E5544B;
  --code-bg: #1F1F1F;
  --hairline: #5A5651;
  --grid-red: #7A4A42;
  --chip-bg: #EDEBE6;
  --chip-fg: #121212;
  --shadow: none;
}
```

### HTML switch

```html
<html data-theme="swiss-inverted" class="theme-swiss-inverted">
  <link rel="stylesheet" href="css/default.css">
```

## Hard rules

- **Never** 纯黑 #000 底、纯白 #FFF 字、冷灰(源 `dont`)
- **Never** 深色底上用 300 细字重(源 `dont`)
- **Never** 给深底加发光/霓虹/玻璃拟态(源 `dont`)
- **Never** 换第二个强调色(源 `dont`)

## Notes

- 预览:`preview/index.html`,单文件可直接打开
- 来源与语义层修正:`docs/usage.md` 末节。
