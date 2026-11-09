# agent-workspace · 对话工作台外壳

AI agent / copilot 控制台的外壳:左栏任务计划 + 审批卡,右栏线程气泡 + 执行流水 + 工具回执 + 流式回答 + 自成长输入框。四段同时在屏,让「代理在干什么」比「代理说了什么」更早被看见。

```html
<link rel="stylesheet" href="agent-workspace.css">  <!-- 标记契约:docs/usage.md -->
<script src="agent-workspace.js"></script>

<div class="aw" data-aw-root data-mode="light">
  <div class="aw-shell">
    <aside class="aw-side">任务计划 / 审批</aside>
    <section class="aw-main">线程 / 流水 / 回执 / 回答 / 输入</section>
  </div>
</div>
```

- 预览 `preview/index.html`(双击即可,无需服务器;输入框按回车会重放一次流式回答,审批卡可选可提交)
- 用法与参数 `docs/usage.md` · agent 入口 `SKILL.md` · 自检 `python packs/agent-workspace/scripts/assert_tokens.py`
- 许可 MIT,归属见 `pack.json.attribution`。零依赖、无构建;不含任何模型调用。
