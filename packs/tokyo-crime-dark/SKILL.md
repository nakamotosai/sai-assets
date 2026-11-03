---
name: tokyo-crime-dark
description: "Tokyo Crime Dark 暖黑数据图(dark 暖黑底 #16130e 配暖色顺序带：深色底上把 ColorBrewer YlOrRd 整体提亮 15% 修对比（断点不动），深棕分隔线代替白描边；数据密集型地图/图表的深色方案。)。触发:Tokyo Crime Dark 暖黑数据图 / tokyo-crime-dark / 暖黑底 #16130e 配暖色顺序带：深色底上把 ColorBrewer YlOrRd 整体提亮 15% 修对比（断点不动），深棕分隔线代替白描边；数据密集型地图/图表的深色方案。。不做整站重构。"

---

# tokyo-crime-dark

让任何网页/面板变成 **Tokyo Crime Dark 暖黑数据图** 的样子,不用 agent 自己编 hex。

暖黑底 #16130e 配暖色顺序带：深色底上把 ColorBrewer YlOrRd 整体提亮 15% 修对比（断点不动），深棕分隔线代替白描边；数据密集型地图/图表的深色方案。

## When to use

- 用户点名 Tokyo Crime Dark 暖黑数据图 / `tokyo-crime-dark` / Tokyo Crime Dark 暖黑数据图 / tokyo-crime-dark / 暖黑底 #16130e 配暖色顺序带：深色底上把 ColorBrewer YlOrRd 整体提亮 15% 修对比（断点不动），深棕分隔线代替白描边；数据密集型地图/图表的深色方案。
- 需要整套配色(bg / bg-deep / surface / ink / accent / 状态色)而不是单个色值
- 需要 暖黑（#16130e 系）而非中性纯黑——配暖色带（YlOrRd/暖橙红）不发蓝、不发脏
- 需要 顺序色带在深色底整体提亮 ~15%（逐通道 c+(255-c)*0.15），只深色生效；断点/档位/数据一字不改，保证跨主题同色=同危险度
- 需要 深色底的地图分隔线用深棕 #3a3128，别用纯白——白线在暖黑上像网格噪点
- 需要 无数据/无人口档单独给灰（#4a4238 / #55504a），别混进色带
- 需要 顶栏按钮选中态反白改「强调色底 + 深字」（onAccent=bg），焦点环换成亮蓝 #7cc4ff 保证可见
- 需要 localStorage 记住选择 + 默认浅色；切换不重建数据/不改断点，只重设色
- 需要 深色独立调色，不把浅色 token 直接反相

## When not to use

- 整站品牌设计系统(要自定义组件/字体体系)→ 用设计类 skill
- 别的主题族(用户点名其它风格)
- 别用中性纯黑 #000/#111 配暖色带（冷暖打架，浅黄档发灰）
- 别为深色重算分档断点（会破坏跨主题/跨时间可比性）
- 别把地图描边留在纯白（暖黑底上白线过曝刺眼）
- 别在深色下沿用浅色的无数据浅灰 #eeeeee（会变成高亮块）

## Default

**`tokyo-crime-dark`**(mode `dark`)

| role | hex |
|---|---|
| `bg` | `#16130e` |
| `bgDeep` | `#0f0d09` |
| `surface` | `#211c14` |
| `ink` | `#f5efe2` |
| `accent` | `#fc4e2a` |
| `link` | `#7cc4ff` |
| `red` | `#e31a1c` |

## Sub-themes (id → when)

| id | mode | contrast | pick when |
|---|---|---|---|
| `tokyo-crime-dark` | `dark` | — | **默认**;暖黑底 #16130e 配暖色顺序带：深色底上把 ColorBrewer YlOrRd 整体提亮 15% 修对比（断点不动），深棕分隔线代替白描边；数据密集型地图/图表的深色方案。 |

## Files

| path | use |
|---|---|
| `tokens/absolute.json` | 源盘原色表(原样,含未参与语义映射的色) |
| `tokens/index.json` | 变体目录 + default |
| `tokens/semantic/tokyo-crime-dark.json` | 语义映射 + `derived`(取源哪个键)+ `a11y`(对比度实测) |
| `css/default.css` | 默认变体一份,含 `:root`,最快 apply |
| `css/all.css` | 全部变体 + 基础 chrome,含 `:root` |
| `css/themes.css` | 共存版:同 all.css 但**无 `:root`**,只 `[data-theme]` / `.theme-<id>` 作用域 |
| `docs/usage.md` | 配对规则 / 字体配方 / 反模式(中文) |
| `preview/index.html` | 活预览(独立单文件) |

## Agent apply steps

1. **Pick variant** — 用户点名变体就用它;否则 `tokyo-crime-dark`。
2. **Read tokens** — `tokens/semantic/tokyo-crime-dark.json`(`colors` 是语义键,`derived` 说明它取自源盘哪个键)。
3. **写入 CSS 变量** — 项目已有 `--bg/--ink/--accent` 就沿用同名;否则整份贴,或同时写 `--theme-*` 别名。
4. **挂主题作用域** — `<html data-theme="tokyo-crime-dark" class="theme-tokyo-crime-dark">`;多主题站点用 `css/themes.css`。
5. **选文件** — 单主题 `css/default.css`;多主题 `css/all.css`(带 `:root`)或 `css/themes.css`(不带)。
6. **按角色套件**:
   - 页面底 → `--bg` / `--bg-deep`
   - 卡面面板 → `--surface` + `--border`
   - 正文 → `--ink`;次要 → `--ink-muted` / `--ink-dim`
   - 主按钮 → `--accent` + `--on-accent`(一屏一个 CTA)
   - 链接 → `--link`(**不**用 `--accent`,强调色不做链接色)
   - 危险 → `--red`;成功 → `--green`
7. **不要发明 hex** — 颜色只能来自 `tokens/absolute.json`;缺角色就跳过该变量。
8. **自检** — `python scripts/assert_tokens.py` 必须打印 `PASS assert_tokens tokyo-crime-dark`。

### Minimal `:root` snippet (`tokyo-crime-dark`)

```css
:root {
  color-scheme: dark;
  --bg: #16130e;
  --bg-deep: #0f0d09;
  --surface: #211c14;
  --surface-2: #2c2417;
  --border: #3a3128;
  --ink: #f5efe2;
  --ink-muted: #b8ab93;
  --ink-dim: #8a7f6b;
  --accent: #fc4e2a;
  --accent-2: #b30000;
  --on-accent: #16130e;
  --red: #e31a1c;
  --green: #5d8a6a;
  --aqua: #6a9a8e;
  --blue: #7cc4ff;
  --purple: #8a6a7a;
  --link: #7cc4ff;
  --code-bg: #211c14;
  --shadow: 0 12px 32px rgba(0,0,0,.45);
  --nodata: #4a4238;
  --nopop: #55504a;
  --hi: #3a2c14;
  --mapbg: #16130e;
}
```

### HTML switch

```html
<html data-theme="tokyo-crime-dark" class="theme-tokyo-crime-dark">
  <link rel="stylesheet" href="css/default.css">
```

## Hard rules

- **Never** 别用中性纯黑 #000/#111 配暖色带（冷暖打架，浅黄档发灰）(源 `dont`)
- **Never** 别为深色重算分档断点（会破坏跨主题/跨时间可比性）(源 `dont`)
- **Never** 别把地图描边留在纯白（暖黑底上白线过曝刺眼）(源 `dont`)
- **Never** 别在深色下沿用浅色的无数据浅灰 #eeeeee（会变成高亮块）(源 `dont`)

## Notes

- 预览:`preview/index.html`,单文件可直接打开
- 来源与语义层修正:`docs/usage.md` 末节。
