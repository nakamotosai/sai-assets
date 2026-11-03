---
name: swiss-classic
description: "Swiss Classic（瑞士国际主义）(light 暖米白纸底 + 暖黑 + 单一结构红；平涂无投影，靠明度差与发丝线造层次)。触发:Swiss Classic（瑞士国际主义） / swiss-classic / 暖米白纸底 + 暖黑 + 单一结构红；平涂无投影，靠明度差与发丝线造层次。不做整站重构。"

---

# swiss-classic

让任何网页/面板变成 **Swiss Classic（瑞士国际主义）** 的样子,不用 agent 自己编 hex。

暖米白纸底 + 暖黑 + 单一结构红；平涂无投影，靠明度差与发丝线造层次

## When to use

- 用户点名 Swiss Classic（瑞士国际主义） / swiss-classic / 暖米白纸底 + 暖黑 + 单一结构红；平涂无投影，靠明度差与发丝线造层次
- 需要整套配色(bg / bg-deep / surface / ink / accent / 状态色)而不是单个色值
- 需要 暖色纸白（#EDEBE6）与暖黑（#111111），绝不用纯 #000 / 冷灰
- 需要 强调红只做线/编号/单块几何形，覆盖率 ≤3%，落在预留空白里
- 需要 一屏只有一个饱和色相，红不填正文
- 需要 层次靠 1px 发丝线 + 明度差（bgDeep 托 surface），不用投影/渐变
- 需要 大面积留白（≥35–45%），成块成区
- 需要 不对称构图：一侧文字、一侧几何形

## When not to use

- 整站品牌设计系统(要自定义组件/字体体系)→ 用设计类 skill
- 别的主题族(用户点名其它风格)
- 两种强调色同屏
- 红铺大底 / 红填正文
- box-shadow / 渐变 / 纹理 / 噪点 / 玻璃拟态
- 纯黑 #000、纯白 #FFF、冷灰
- 圆角 > 6px（唯一例外是底部居中字幕 chip）
- 对称居中构图

## Default

**`swiss-classic`**(mode `light`)

| role | hex |
|---|---|
| `bg` | `#EDEBE6` |
| `bgDeep` | `#DCDAD1` |
| `surface` | `#F7F5F0` |
| `ink` | `#111111` |
| `accent` | `#D8232A` |
| `link` | `#D8232A` |
| `red` | `#D8232A` |

## Sub-themes (id → when)

| id | mode | contrast | pick when |
|---|---|---|---|
| `swiss-classic` | `light` | — | **默认**;暖米白纸底 + 暖黑 + 单一结构红；平涂无投影，靠明度差与发丝线造层次 |

## Files

| path | use |
|---|---|
| `tokens/absolute.json` | 源盘原色表(原样,含未参与语义映射的色) |
| `tokens/index.json` | 变体目录 + default |
| `tokens/semantic/swiss-classic.json` | 语义映射 + `derived`(取源哪个键)+ `a11y`(对比度实测) |
| `css/default.css` | 默认变体一份,含 `:root`,最快 apply |
| `css/all.css` | 全部变体 + 基础 chrome,含 `:root` |
| `css/themes.css` | 共存版:同 all.css 但**无 `:root`**,只 `[data-theme]` / `.theme-<id>` 作用域 |
| `docs/usage.md` | 配对规则 / 字体配方 / 反模式(中文) |
| `preview/index.html` | 活预览(独立单文件) |

## Agent apply steps

1. **Pick variant** — 用户点名变体就用它;否则 `swiss-classic`。
2. **Read tokens** — `tokens/semantic/swiss-classic.json`(`colors` 是语义键,`derived` 说明它取自源盘哪个键)。
3. **写入 CSS 变量** — 项目已有 `--bg/--ink/--accent` 就沿用同名;否则整份贴,或同时写 `--theme-*` 别名。
4. **挂主题作用域** — `<html data-theme="swiss-classic" class="theme-swiss-classic">`;多主题站点用 `css/themes.css`。
5. **选文件** — 单主题 `css/default.css`;多主题 `css/all.css`(带 `:root`)或 `css/themes.css`(不带)。
6. **按角色套件**:
   - 页面底 → `--bg` / `--bg-deep`
   - 卡面面板 → `--surface` + `--border`
   - 正文 → `--ink`;次要 → `--ink-muted` / `--ink-dim`
   - 主按钮 → `--accent` + `--on-accent`(一屏一个 CTA)
   - 链接 → `--link`(**不**用 `--accent`,强调色不做链接色)
   - 危险 → `--red`;成功 → `--green`
7. **不要发明 hex** — 颜色只能来自 `tokens/absolute.json`;缺角色就跳过该变量。
8. **自检** — `python scripts/assert_tokens.py` 必须打印 `PASS assert_tokens swiss-classic`。

### Minimal `:root` snippet (`swiss-classic`)

```css
:root {
  color-scheme: light;
  --bg: #EDEBE6;
  --bg-deep: #DCDAD1;
  --surface: #F7F5F0;
  --surface-2: #E4E1D9;
  --border: #111111;
  --ink: #111111;
  --ink-muted: #6B6862;
  --ink-dim: #4A4A4A;
  --accent: #D8232A;
  --accent-2: #B72E25;
  --on-accent: #FFFFFF;
  --red: #D8232A;
  --link: #D8232A;
  --code-bg: #E4E1D9;
  --hairline: #9A9995;
  --grid-red: #DB9382;
  --chip-bg: #2A2A2A;
  --chip-fg: #F5F3EE;
  --shadow: none;
}
```

### HTML switch

```html
<html data-theme="swiss-classic" class="theme-swiss-classic">
  <link rel="stylesheet" href="css/default.css">
```

## Hard rules

- **Never** 两种强调色同屏(源 `dont`)
- **Never** 红铺大底 / 红填正文(源 `dont`)
- **Never** box-shadow / 渐变 / 纹理 / 噪点 / 玻璃拟态(源 `dont`)
- **Never** 纯黑 #000、纯白 #FFF、冷灰(源 `dont`)
- **Never** 圆角 > 6px（唯一例外是底部居中字幕 chip）(源 `dont`)
- **Never** 对称居中构图(源 `dont`)

## Notes

- 预览:`preview/index.html`,单文件可直接打开
- 来源与语义层修正:`docs/usage.md` 末节。
