---
name: agent-workspace
description: Chat-workspace shell for AI agent UIs — left column task plan plus an approval card that actually locks after submit, right column thread bubbles, execution feed, tool receipt, streaming answer with caret, and an auto-growing composer. Use when building a copilot / agent console where the process (plan, activity, approval) must be visible next to the answer, with zero dependencies.
---

# agent-workspace

对话式 AI 工作台的**外壳层**。左栏任务计划 + 审批卡,右栏线程 + 流水 + 工具回执 + 流式回答 + 输入框。
纯 CSS + 一个零依赖脚本;**不含任何模型调用**,数据由宿主喂。

## When to use

- agent / copilot 控制台:要「计划 → 过程 → 产物 → 人审」四段同时在屏,不是一条纯聊天气泡流
- 要一个**真能提交、提交后锁死**的审批位(写文件 / 花钱 / 发消息前的确认)
- 要流式的可见回执(逐字 + 光标),但不想引 React / 动效库
- 已有 token(`--bg --surface --ink --muted --accent`),只缺结构样式

## When not to use

- 纯客服 / FAQ 聊天窗(重心是过程可见,单线程闲聊更该用普通气泡)
- 要多轮历史侧栏、分支、编辑重发等完整产品状态机(本包只有外壳与三类行为)
- 要富文本 / 代码编辑器级输入(contenteditable、@ 提及、附件拖拽)
- 要主题色随章节变(让宿主 token 变,本包不内置多主题)

## Default

浅色纸白(`#f5f3ed` 底 / `#1a1a16` 墨 / 强调 `#cd5545`),深色由 `data-mode="dark"` 切成近黑 `#0e0e0c`。两档都只作**回退值**——宿主给了 `--bg/--ink/--accent` 就全走宿主。布局 330px + 1fr,≤900px 收单列。

## Files

| path | use |
|---|---|
| `src/agent-workspace.css` | 全部结构样式 + 变量 + 降级(作用域 `.aw`) |
| `src/agent-workspace.js` | 输入框自成长 / 流式回放 / 审批提交 / 进度进视口 |
| `preview/index.html` | 活预览:真实可交互(回车流式、审批可选可提交) |
| `docs/usage.md` | 标记对照表 + 参数 + 无障碍硬项 + 反模式 |
| `scripts/assert_tokens.py` | 契约 / 引用 / 产物 / 对比度双档 / 标记齐全 |

## Agent apply steps

1. 拷 `src/agent-workspace.{css,js}` 到项目 `assets/`。
2. 包裹根 `<div class="aw" data-aw-root data-mode="light">`,内层 `.aw-shell > (.aw-side + .aw-main)`。
3. 按 `docs/usage.md` 的标记对照表摆积木;三个行为独立启动,缺标记即跳过。
4. 宿主已有一套 token 时**不要**覆盖 `--aw-*`,只在缺色时才依赖回退值。
5. 小字强调用 `--aw-accent-ink`,不用 `--aw-accent`(浅底到不了 4.5:1)。

## 硬规则

- 作用域只在 `.aw` 内:不写 `html` / `body`,可直接叠进既有页面。
- 网格子项必须 `min-width: 0`:否则 `code` 长串会把轨道顶出屏幕(实测溢出 9px)。
- 流式 body 用 `textContent` 写入:塞 HTML 会被当字面量。
- `prefers-reduced-motion` 下:进度直接到位、流式一次写全、呼吸点静止。
- 审批未选时提交必须 `disabled` 真属性。
