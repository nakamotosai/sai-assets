# 用法：色令牌怎么落到网页组件

> 本仓库**不是**完整 UI 组件库，而是 **Gruvbox 色板合同 + 搭配说明书**。  
> 下面用语义令牌（`--bg` / `--ink` / `--accent` …）说明「页面各层该用哪几个色」。  
> 默认主题：`classic-dark-medium`（`#282828` / `#ebdbb2` / `#fe8019`）。

英文版：[usage.en.md](usage.en.md)

---

## 1. 先建立三层背景

Gruvbox 好看，靠的是**暖灰阶梯**，不是纯黑 + 冷灰。

| 层级 | 令牌 | 默认 hex | 用在哪 |
|------|------|----------|--------|
| 最深底 | `bgDeep` / `--bg-deep` | `#1d2021` | 侧栏外更深处、代码块底、全屏沉浸 |
| 页面底 | `bg` / `--bg` | `#282828` | `<body>` / 主画布 |
| 抬起面 | `surface` / `--surface` | `#3c3836` | 卡片、面板、弹层、输入框底板 |
| 再抬一层 | `surface2` / `--surface-2` | `#504945` | 悬停条、次级工具条、嵌套小块 |
| 描边 | `border` / `--border` | `#665c54` | 分割线、卡片边、输入框边 |

**规则**：同屏最多用 3 层背景（底 / 卡 / 悬停）。不要再叠 `#000` 或 Tailwind slate。

```css
body { background: var(--bg); color: var(--ink); }
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow);
}
.card:hover { background: var(--surface-2); }
```

---

## 2. 文字：主 / 次 / 弱

| 角色 | 令牌 | 默认 | 用在哪 |
|------|------|------|--------|
| 正文 | `ink` | `#ebdbb2` | 标题、段落、列表主文 |
| 次要 | `inkMuted` | `#a89984` | 说明、时间戳、表格次列 |
| 更弱 | `inkDim` | `#928374` | 占位符、禁用提示、图例小字 |
| 链接触发 | `link` / `aqua` | `#8ec07c` | `<a>`、可点标签（**不要**用橙色做默认链接） |

**对比纪律（暗色）**：

- 正文永远 `ink` 在 `bg` / `surface` 上；不要用 `inkDim` 写长文。
- 占位符才用 `inkDim`。
- 亮色主题（`classic-light-*`）换成深棕字 + 褪色强调色，规则相同、hex 不同。

```css
h1, h2, p { color: var(--ink); }
.meta, .hint { color: var(--ink-muted); }
::placeholder { color: var(--ink-dim); }
a { color: var(--link); }
a:hover { filter: brightness(1.08); }
```

---

## 3. 按钮与主操作

| 类型 | 背景 | 字色 | 边框 | 何时用 |
|------|------|------|------|--------|
| **主按钮** | `accent` `#fe8019` | `onAccent` `#1d2021` | 无 | 唯一主 CTA（每区最多 1 个） |
| **次按钮** | `surface` / `surface2` | `ink` | `border` | 取消、次要动作 |
| **幽灵** | 透明 | `ink` | `border` | 工具条、表头 |
| **危险** | 透明或极淡 red | `red` | `red` 或 `border` | 删除；**慎用**实心大红块 |
| **成功提示** | 不用大绿底 | `green` 字 / 小点 | — | 状态点、toast 文案 |

```css
.btn-primary {
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: 6px;
  font-weight: 600;
}
.btn-secondary {
  background: var(--surface-2);
  color: var(--ink);
  border: 1px solid var(--border);
}
.btn-danger {
  background: transparent;
  color: var(--red);
  border: 1px solid var(--border);
}
```

**别做**：主按钮用蓝紫渐变；橙色上再叠冷白字（对比发灰）——用 `onAccent`。

---

## 4. 表单

| 部件 | 建议 |
|------|------|
| 输入框底 | `surface` 或略深于页面的 `bgDeep` |
| 边框默认 | `border` |
| 聚焦环 | `accent`（`outline` / `box-shadow`） |
| 标签 | `inkMuted` 小字 + `ink` 必填星可用 `red` |
| 校验错误 | 边框/`help` 用 `red`；不要整框刷成大红底 |
| 开关开 | 轨道 `accent`，拇指 `onAccent` / 浅色块 |

```css
input, select, textarea {
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--border);
  border-radius: 6px;
}
input:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
```

---

## 5. 导航 / 侧栏 / Tab

| 部件 | 令牌 |
|------|------|
| 侧栏底 | `bgDeep` 或 `bg`（比主区深一档更稳） |
| 当前项 | 左条 `accent` **或** 底 `surface` + 字 `ink` |
| 非当前 | 字 `inkMuted`，悬停 `surface` |
| 顶栏 | `bg` / `surface`，底部分割 `border` |
| Badge | 小底 `surface2`，字 `accent` 或 `aqua` |

**原则**：导航不要整条刷成橙色；橙色只做「当前」指示。

---

## 6. 状态色（点 / 标签 / 图表）

| 语义 | 令牌 | 默认 | 用法 |
|------|------|------|------|
| 错 / 删 / 危 | `red` | `#fb4934` | 错误文案、危险图标、图表负向 |
| 成 / 过 | `green` | `#b8bb26` | 成功、通过（文案/点，少做满底按钮） |
| 信息 / 链 | `aqua` / `link` | `#8ec07c` | 链接、info、正向次强调 |
| 警告 | `accent2` | `#fabd2f` | 警告、注意（黄） |
| 次强调 | `blue` | `#83a598` | 信息系列、图表系列 2 |
| 特殊 | `purple` | `#d3869b` | 图表系列 3、标签 |

**图表**：背景 `bg`/`surface`，轴线 `border`，系列优先 `accent` → `aqua` → `blue` → `purple` → `red` → `green`。

---

## 7. 代码块 / 终端感面板

| 部件 | 令牌 |
|------|------|
| 代码底 | `codeBg` / `bgDeep` |
| 代码字 | `ink` |
| 关键字点缀 | `accent` / `aqua` / `red`（按高亮主题，别一次用满） |
| 行号 | `inkDim` |

工具型面板（监控台、参数板）优先 **暗色 classic**，信息密度高时用 `inkMuted` 降噪，不要把整页做成高饱和色块墙。

---

## 8. 一张对照表（classic-dark-medium）

| UI 部位 | 用 |
|---------|-----|
| 页面背景 | `--bg` |
| 卡片 / 弹窗 | `--surface` + `--border` |
| 主文字 | `--ink` |
| 说明文字 | `--ink-muted` |
| 主按钮 | `--accent` + `--on-accent` |
| 链接 | `--link` |
| 错误 | `--red` |
| 成功点 | `--green` |
| 警告 | `--accent-2` |
| 代码底 | `--code-bg` |

---

## 9. 反模式（看起来就不像 Gruvbox）

1. 把暖灰换成冷灰 / slate / `#111827`「伪深色」。  
2. 正文用半透明白字叠在黑底上（发雾）。  
3. 主按钮、链接、选中态**全用橙色**——链接请用 aqua。  
4. 大面积纯 `#000` 或纯白，丢掉 soft/medium 层次。  
5. 亮色模式仍用 bright 橙字（应改用 light 的 faded 强调色，见 `classic-light-*`）。  
6. 把 Material 的 `#e78a4e` 静默塞进 classic 背景却不声明家族。

---

## 10. 最小可用 HTML

```html
<link rel="stylesheet" href="css/all.css" />
<html data-theme="classic-dark-medium" class="gruvbox-apply">
<body>
  <main class="panel" style="margin:24px;padding:16px;max-width:420px">
    <h1 style="margin:0 0 8px">面板标题</h1>
    <p style="margin:0 0 12px;color:var(--ink-muted)">次要说明用 muted。</p>
    <button class="btn-primary" type="button">主操作</button>
    <p style="margin:12px 0 0"><a href="#">链接用 aqua</a></p>
  </main>
</body>
</html>
```

本地对照墙：[preview/index.html](../preview/index.html)  
令牌 JSON：`tokens/semantic/<id>.json`  
Agent 接线：根目录 [SKILL.md](../SKILL.md)
