---
name: abyss-lab-record
description: "Abyss Lab Record 暗黑实验记录(dark 近黑底 + 工程网格 + 等宽 HUD + 单关键词橙，深色主叙事、纸面只做独立反转章节；面板全透明虚线检测框)。触发:Abyss Lab Record 暗黑实验记录 / abyss-lab-record / 近黑底 + 工程网格 + 等宽 HUD + 单关键词橙，深色主叙事、纸面只做独立反转章节；面板全透明虚线检测框。不做整站重构。"

---

# abyss-lab-record

让任何网页/面板变成 **Abyss Lab Record 暗黑实验记录** 的样子,不用 agent 自己编 hex。

近黑底 + 工程网格 + 等宽 HUD + 单关键词橙，深色主叙事、纸面只做独立反转章节；面板全透明虚线检测框

## When to use

- 用户点名 Abyss Lab Record 暗黑实验记录 / abyss-lab-record / 近黑底 + 工程网格 + 等宽 HUD + 单关键词橙，深色主叙事、纸面只做独立反转章节；面板全透明虚线检测框
- 需要整套配色(bg / bg-deep / surface / ink / accent / 状态色)而不是单个色值
- 需要 近黑非纯黑底 + 单层工程网格（body 一层，透明度 <=0.14，不压文字）
- 需要 标题无衬线 800-900，中文降一档；等宽管数据 HUD + tabular-nums；手写只做英文短句点缀
- 需要 橙色只染单关键词/危险数值/选中态/光源，单屏 <=10%
- 需要 面板全透明 + 1px 白线/虚线边框，检测框分静态虚线与描边流动两种
- 需要 纸面只做独立 data-theme=light 反转章节（表单卡 + 墨字 + 单枚橙章）
- 需要 动效只动 transform/opacity 150-300ms，描边流动是唯一的描边动画且降级静止
- 需要 mono 栈永不落回系统中文字体，裸 monospace/Menlo/Consolas 禁入生产栈

## When not to use

- 整站品牌设计系统(要自定义组件/字体体系)→ 用设计类 skill
- 别的主题族(用户点名其它风格)
- 衬线标题/正文（Georgia/Noto Serif/SimSun/宋体禁入）
- 面板实底色 + 投影（纸面表单卡除外）
- 整词橙色大标题（23/24 类必须降为关键词橙 + 描边混排）
- 描边空心字常驻正文（只许 display 大字，须验对比度）
- 低透明 mono 小字（须提到 14px 或提亮到 4.5:1）
- 为状态新增强调色（用下划线/字重/底色微变）

## Default

**`abyss-lab-record`**(mode `dark`)

| role | hex |
|---|---|
| `bg` | `#0B0B0E` |
| `surface` | `#14141B` |
| `ink` | `#F5F2EA` |
| `accent` | `#FF5A1F` |
| `link` | `#FF7A33` |
| `red` | `#FF3B1F` |

## Sub-themes (id → when)

| id | mode | contrast | pick when |
|---|---|---|---|
| `abyss-lab-record` | `dark` | — | **默认**;近黑底 + 工程网格 + 等宽 HUD + 单关键词橙，深色主叙事、纸面只做独立反转章节；面板全透明虚线检测框 |

## Files

| path | use |
|---|---|
| `tokens/absolute.json` | 源盘原色表(原样,含未参与语义映射的色) |
| `tokens/index.json` | 变体目录 + default |
| `tokens/semantic/abyss-lab-record.json` | 语义映射 + `derived`(取源哪个键)+ `a11y`(对比度实测) |
| `css/default.css` | 默认变体一份,含 `:root`,最快 apply |
| `css/all.css` | 全部变体 + 基础 chrome,含 `:root` |
| `css/themes.css` | 共存版:同 all.css 但**无 `:root`**,只 `[data-theme]` / `.theme-<id>` 作用域 |
| `docs/usage.md` | 配对规则 / 字体配方 / 反模式(中文) |
| `preview/index.html` | 活预览(独立单文件) |

## Agent apply steps

1. **Pick variant** — 用户点名变体就用它;否则 `abyss-lab-record`。
2. **Read tokens** — `tokens/semantic/abyss-lab-record.json`(`colors` 是语义键,`derived` 说明它取自源盘哪个键)。
3. **写入 CSS 变量** — 项目已有 `--bg/--ink/--accent` 就沿用同名;否则整份贴,或同时写 `--theme-*` 别名。
4. **挂主题作用域** — `<html data-theme="abyss-lab-record" class="theme-abyss-lab-record">`;多主题站点用 `css/themes.css`。
5. **选文件** — 单主题 `css/default.css`;多主题 `css/all.css`(带 `:root`)或 `css/themes.css`(不带)。
6. **按角色套件**:
   - 页面底 → `--bg` / `--bg-deep`
   - 卡面面板 → `--surface` + `--border`
   - 正文 → `--ink`;次要 → `--ink-muted` / `--ink-dim`
   - 主按钮 → `--accent` + `--on-accent`(一屏一个 CTA)
   - 链接 → `--link`(**不**用 `--accent`,强调色不做链接色)
   - 危险 → `--red`;成功 → `--green`
7. **不要发明 hex** — 颜色只能来自 `tokens/absolute.json`;缺角色就跳过该变量。
8. **自检** — `python scripts/assert_tokens.py` 必须打印 `PASS assert_tokens abyss-lab-record`。

### Minimal `:root` snippet (`abyss-lab-record`)

```css
:root {
  color-scheme: dark;
  --bg: #0B0B0E;
  --surface: #14141B;
  --surface-2: #14161A;
  --border: rgba(245,242,234,0.16);
  --ink: #F5F2EA;
  --ink-muted: #B8B4AC;
  --ink-dim: #B8B4AC;
  --accent: #FF5A1F;
  --accent-2: #FF7A33;
  --red: #FF3B1F;
  --link: #FF7A33;
  --grid: rgba(255,255,255,0.08);
  --glow-w: 0 0 8px rgba(245,242,234,0.35), 0 0 24px rgba(245,242,234,0.16);
  --glow-o: 0 0 8px rgba(255,90,31,0.55), 0 0 24px rgba(255,90,31,0.28), 0 0 64px rgba(255,90,31,0.16);
  --paper-bg: #F2EEE3;
  --paper-ink: #1B1B18;
  --paper-stamp: #E8491D;
  --paper-stamp-small: #B23A00;
  --paper-field: #FFFFFF;
  --paper-muted: #5C574D;
  --shadow: 0 8px 32px rgba(0,0,0,0.45);
  --on-accent: #1B1B18;
}
```

### HTML switch

```html
<html data-theme="abyss-lab-record" class="theme-abyss-lab-record">
  <link rel="stylesheet" href="css/default.css">
```

## Hard rules

- **Never** 衬线标题/正文（Georgia/Noto Serif/SimSun/宋体禁入）(源 `dont`)
- **Never** 面板实底色 + 投影（纸面表单卡除外）(源 `dont`)
- **Never** 整词橙色大标题（23/24 类必须降为关键词橙 + 描边混排）(源 `dont`)
- **Never** 描边空心字常驻正文（只许 display 大字，须验对比度）(源 `dont`)
- **Never** 低透明 mono 小字（须提到 14px 或提亮到 4.5:1）(源 `dont`)
- **Never** 为状态新增强调色（用下划线/字重/底色微变）(源 `dont`)

## Notes

- 预览:`preview/index.html`,单文件可直接打开
- 来源与语义层修正:`docs/usage.md` 末节。
