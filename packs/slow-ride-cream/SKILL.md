---
name: slow-ride-cream
description: "Slow Ride Cream 慢骑奶油(light 暖奶油纸面 + 鼠尾草绿 + 番茄围巾，慢日子编辑风；拱形画框 + 双语微标签 + 一句文案)。触发:Slow Ride Cream 慢骑奶油 / slow-ride-cream / 暖奶油纸面 + 鼠尾草绿 + 番茄围巾，慢日子编辑风；拱形画框 + 双语微标签 + 一句文案。不做整站重构。"

---

# slow-ride-cream

让任何网页/面板变成 **Slow Ride Cream 慢骑奶油** 的样子,不用 agent 自己编 hex。

暖奶油纸面 + 鼠尾草绿 + 番茄围巾，慢日子编辑风；拱形画框 + 双语微标签 + 一句文案

## When to use

- 用户点名 Slow Ride Cream 慢骑奶油 / slow-ride-cream / 暖奶油纸面 + 鼠尾草绿 + 番茄围巾，慢日子编辑风；拱形画框 + 双语微标签 + 一句文案
- 需要整套配色(bg / bg-deep / surface / ink / accent / 状态色)而不是单个色值
- 需要 纸面底色 + 深棕墨字，英文微标签全大写宽字距（如 MOTION STUDY — 001）
- 需要 标题中文大字 + 一句短文案 + 一句慢生活 caption（风很轻/慢慢向前）
- 需要 画框用拱形大圆角（rx 220 级）或通栏横幅，场景内画天空/沙丘/海带
- 需要 插画扁平矢量 + 全图统一深色描边（约 3px），渐变只给天空和皮毛
- 需要 太阳必带光晕圈，云 2-3 椭圆拼，点缀小花/石子/海鸥 m 形/帆船
- 需要 番茄色围巾是唯一的动态强调色，随风飘
- 需要 动效要慢：1.6-2s 循环，脚踏 IK + 辐条转 + 背景无缝滚动，必带暂停钮，尊重 prefers-reduced-motion
- 需要 编号感：STUDY 001 / CLUB / ROUTE 之类的 catalog 标签

## When not to use

- 整站品牌设计系统(要自定义组件/字体体系)→ 用设计类 skill
- 别的主题族(用户点名其它风格)
- 高饱和原色、大面积渐变、紫粉 AI 风
- 描边粗细不一、有的部件有描边有的没有
- 科技蓝、深色底、发光阴影
- 快节奏动效（<1s 循环显得赶）
- 无暂停钮的自动播放
- 中文标题加粗黑体顶格（要用衬线感/圆体感大字 + 字距）

## Default

**`slow-ride-cream`**(mode `light`)

| role | hex |
|---|---|
| `bg` | `#f6f1e7` |
| `bgDeep` | `#efe7d3` |
| `surface` | `#fffdf6` |
| `ink` | `#493e31` |
| `accent` | `#b34a32` |
| `link` | `#356f65` |
| `red` | `#c64545` |

## Sub-themes (id → when)

| id | mode | contrast | pick when |
|---|---|---|---|
| `slow-ride-cream` | `light` | — | **默认**;暖奶油纸面 + 鼠尾草绿 + 番茄围巾，慢日子编辑风；拱形画框 + 双语微标签 + 一句文案 |

## Files

| path | use |
|---|---|
| `tokens/absolute.json` | 源盘原色表(原样,含未参与语义映射的色) |
| `tokens/index.json` | 变体目录 + default |
| `tokens/semantic/slow-ride-cream.json` | 语义映射 + `derived`(取源哪个键)+ `a11y`(对比度实测) |
| `css/default.css` | 默认变体一份,含 `:root`,最快 apply |
| `css/all.css` | 全部变体 + 基础 chrome,含 `:root` |
| `css/themes.css` | 共存版:同 all.css 但**无 `:root`**,只 `[data-theme]` / `.theme-<id>` 作用域 |
| `docs/usage.md` | 配对规则 / 字体配方 / 反模式(中文) |
| `preview/index.html` | 活预览(独立单文件) |

## Agent apply steps

1. **Pick variant** — 用户点名变体就用它;否则 `slow-ride-cream`。
2. **Read tokens** — `tokens/semantic/slow-ride-cream.json`(`colors` 是语义键,`derived` 说明它取自源盘哪个键)。
3. **写入 CSS 变量** — 项目已有 `--bg/--ink/--accent` 就沿用同名;否则整份贴,或同时写 `--theme-*` 别名。
4. **挂主题作用域** — `<html data-theme="slow-ride-cream" class="theme-slow-ride-cream">`;多主题站点用 `css/themes.css`。
5. **选文件** — 单主题 `css/default.css`;多主题 `css/all.css`(带 `:root`)或 `css/themes.css`(不带)。
6. **按角色套件**:
   - 页面底 → `--bg` / `--bg-deep`
   - 卡面面板 → `--surface` + `--border`
   - 正文 → `--ink`;次要 → `--ink-muted` / `--ink-dim`
   - 主按钮 → `--accent` + `--on-accent`(一屏一个 CTA)
   - 链接 → `--link`(**不**用 `--accent`,强调色不做链接色)
   - 危险 → `--red`;成功 → `--green`
7. **不要发明 hex** — 颜色只能来自 `tokens/absolute.json`;缺角色就跳过该变量。
8. **自检** — `python scripts/assert_tokens.py` 必须打印 `PASS assert_tokens slow-ride-cream`。

### Minimal `:root` snippet (`slow-ride-cream`)

```css
:root {
  color-scheme: light;
  --bg: #f6f1e7;
  --bg-deep: #efe7d3;
  --surface: #fffdf6;
  --surface-2: #f1e9d4;
  --border: #e3d7bd;
  --ink: #493e31;
  --ink-muted: #93846c;
  --ink-dim: #a89a7f;
  --accent: #b34a32;
  --accent-2: #d95f43;
  --on-accent: #fffaf0;
  --red: #c64545;
  --green: #5d8a6a;
  --aqua: #6a9a8e;
  --blue: #5a7a8a;
  --purple: #8a6a7a;
  --link: #356f65;
  --code-bg: #2f4038;
  --pine: #33544a;
  --bike: #356f65;
  --bike-dark: #3c4945;
  --sage: #8a9e78;
  --seafoam: #b9cdc0;
  --dune: #e8d8b6;
  --dune-deep: #deca9f;
  --sun: #edc67e;
  --fur: #c69a61;
  --fur-deep: #946538;
  --outline: #785536;
  --shadow: 0 12px 32px rgba(73,62,49,.10);
}
```

### HTML switch

```html
<html data-theme="slow-ride-cream" class="theme-slow-ride-cream">
  <link rel="stylesheet" href="css/default.css">
```

## Hard rules

- **Never** 高饱和原色、大面积渐变、紫粉 AI 风(源 `dont`)
- **Never** 描边粗细不一、有的部件有描边有的没有(源 `dont`)
- **Never** 科技蓝、深色底、发光阴影(源 `dont`)
- **Never** 快节奏动效（<1s 循环显得赶）(源 `dont`)
- **Never** 无暂停钮的自动播放(源 `dont`)
- **Never** 中文标题加粗黑体顶格（要用衬线感/圆体感大字 + 字距）(源 `dont`)

## Notes

- 预览:`preview/index.html`,单文件可直接打开
- 来源与语义层修正:`docs/usage.md` 末节。
