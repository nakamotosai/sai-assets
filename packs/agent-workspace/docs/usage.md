# agent-workspace · 使用说明

对话式 AI 工作台的**外壳层**:左栏任务计划 + 审批卡,右栏线程气泡 + 执行流水 + 工具回执 + 流式回答 + 输入框。
纯 CSS + 一个零依赖脚本,不含任何模型调用——数据由宿主喂进来。

## 什么时候用

- 做一个 agent / copilot 界面,需要「计划 → 过程 → 产物 → 人审」四段同时在屏,而不是一条纯聊天气泡流。
- 需要**流式回答**的可见回执(逐字吐出 + 光标),但不想引 React 或任何动效库。
- 需要一个**真的能选、能提交、提交后锁死**的审批卡(代理要写文件 / 花钱 / 发消息前的确认位)。
- 已有设计 token(`--bg --surface --ink --muted --accent`),只缺一套不打架的结构样式。

## 什么时候不用

- 纯客服 / FAQ 聊天窗口:这个外壳的重心是「过程可见」,单线程闲聊用普通气泡布局更轻。
- 需要多轮会话历史侧栏、分支、编辑重发等完整产品级交互:本包只有外壳与三类行为,状态机请在上层做。
- 需要富文本 / 代码编辑器级输入(contenteditable、@ 提及、附件拖拽):本包输入框是自动成长 textarea。
- 深色/浅色之外还要主题色随章节切换:请让宿主 token 变,本包不内置多主题。

## 接入步骤

1. 拷两个文件(无构建、无依赖):

   ```text
   src/agent-workspace.css  →  assets/agent-workspace.css
   src/agent-workspace.js   →  assets/agent-workspace.js
   ```

2. 给一个包裹根,挂 `data-aw-root`;深浅二选一挂 `data-mode`(宿主不给 token 时的回退色靠它):

   ```html
   <div class="aw" data-aw-root data-mode="light">
     <div class="aw-shell">
       <aside class="aw-side">…</aside>
       <section class="aw-main">…</section>
     </div>
   </div>
   ```

3. 按需摆积木(标记见下表)。三个行为是独立启动的:页面里没有对应标记就什么都不做。

## 标记对照

| 块 | 标记 | 行为 |
|---|---|---|
| 两栏外壳 | `.aw-shell` | 330px + 1fr;≤900px 收成单列 |
| 任务计划 | `.aw-card` + `.aw-todo li[data-status="pending\|active\|complete"]` | 三态由 `data-status` 驱动;`active` 的点会呼吸 |
| 进度条 | `[data-aw-progress-to="0.62"]` + `.aw-bar > i` | 进视口(35%)把 `--aw-progress` 推到目标值,一次 |
| 执行流水 | `.aw-feed li[data-status]` | 搜索条可带 `.aw-hits` 展开列表;`+n/−n` 用 `.aw-plus/.aw-minus` |
| 气泡 | `.aw-bubble[data-variant="soft\|solid\|tint\|outline"][data-align="start\|end"]` | 四变体 × 两端对齐,`max-width: 62ch` |
| 流式回答 | `[data-aw-stream]` + `[data-aw-stream-body][data-aw-source="全文"]` + `[data-aw-replay]` | 回车或点重放:逐字 16ms/2 字;完成后去掉光标 |
| 引用标记 | `.aw-cite` | 上标小方块,指向页面内 `#id` 的参考列表 |
| 工具回执 | `.aw-tool` + `pre` 内 `.k/.n/.c` | 只三档灰 + 一个强调色,不引调色板 |
| 审批卡 | `[data-aw-approve]` + `input[type=radio]` + `[data-aw-submit]` + `[data-aw-reject]` + `[data-aw-verdict]` | 未选时提交禁用;提交/拒绝后整卡锁死并写回执文案 |
| 输入框 | `[data-aw-input]` | 自成长到 168px 封顶;Enter 发送、Shift+Enter 换行、输入法组合期不拦 |

## 参数

| 变量 | 默认 | 说明 |
|---|---|---|
| `--aw-bg` | `--bg` → `#f5f3ed` | 卡面底 |
| `--aw-surface` / `--aw-surface-2` | `--surface` → 6%/10% 墨 | 浅底块;第二档用于引用角标 |
| `--aw-ink` / `--aw-muted` | `--ink` / `--muted` | 正文与次要字 |
| `--aw-rule` / `--aw-rule-soft` | `--rule` / `--rule-soft` | 描边两档 |
| `--aw-accent` / `--aw-accent-ink` | `--accent` / `--accent-ink` | 强调;**小字一律用 `--aw-accent-ink`**(`--aw-accent` 在浅底到不了 4.5:1) |
| `--aw-radius` | `6px` | 卡片圆角 |
| `--aw-t` / `--aw-ease` | `.22s` / `cubic-bezier(.2,.7,.2,1)` | 过渡时长与曲线 |

## 无障碍硬项

- 全部可点项 `min-height: 38px`(按钮)/ 44px 级热区(选项行整行 `label` 可点);焦点态统一 `outline: 2px solid var(--aw-accent)` + `outline-offset`。
- 审批卡禁用态用 `disabled` 真属性,不是只改颜色;锁死后 radio 一并 `disabled`。
- `prefers-reduced-motion: reduce` 时:进度条直接落到位、流式一次写全、呼吸点静止。
- 流式区域是 `aria-live` 候选位:`data-state="streaming"` 期间宿主若要播报,建议自行加 `aria-live="polite"` 并节流,不要每字播报。

## 反模式

- **不要**把这套外壳当「聊天机器人皮肤」只留气泡:任务计划 + 流水是它的价值,删掉就退化成普通聊天框。
- **不要**给小字用 `--aw-accent` 原色:浅底上最大约 4.3:1,到不了 4.5;用 `--aw-accent-ink`。
- **不要**在 `.aw` 之外写规则改 `html` / `body`:本包所有选择器都限定在 `.aw` 内,宿主可整页叠用。
- **不要**给 `.aw-shell` / `.aw-main` 加回 `min-width: auto`:网格子项默认 `auto`,内部 `code` 长串会把轨道顶出去造成横向溢出(实测 1366px 页面溢出 9px)。必须显式写 `min-width: 0`。
- **不要**在流式 body 里塞富 HTML:脚本用 `textContent` 写入,标记会被当字面量显示。要富文本请换你自己的渲染器,只保留 `data-state` 语义。

## 来源与许可

MIT。结构原型取自本项目自建的 demo 工作台(五套前端资产 demo 的第一页),
配色回退值取自库内 `ouuut-editorial` 的纸白 / 炭黑两档,已在包内断言的对比度档上验过。
组件形态参考了公开 registry 的 agent 组件族**分类方式**(计划 / 过程 / 产物 / 审批),不含其代码或样式。
