# param-panel · 悬浮调参板

按 `params.schema` 生成的悬浮调参板:标签分栏、色板约束的 swatch、range / select / checkbox / text,可拖、可缩放、可收成 56×56 方块;底栏「设为默认 / 恢复默认 / 撤回 / 复制 / 导出」,位置·尺寸·折叠态·当前值都记在 `localStorage`。**只在 preview 或 `?lab=1` 挂载**,不会漏到生产界面。

```html
<link rel="stylesheet" href="param-panel.css">
<script type="module">
  import { mountParamPanel, shouldMountLabPanel } from "./param-panel.js";
  apply(params.defaults);                        // 生产:只落默认值
  if (shouldMountLabPanel()) mountParamPanel({ params, onChange: apply });
</script>
```

- 预览 `preview/index.html`(双击即可) · 用法与参数表 `docs/usage.md` · agent 入口 `SKILL.md`
- 自检 `python packs/param-panel/scripts/assert_tokens.py` · 许可 MIT,出处见 `pack.json.attribution`
- 入包时做了三处改名(行为不变):CSS/JS 前缀 `tl-` → `pp-`、localStorage 命名空间改为 `saiassets.param-panel.*`(不再沿用旧库前缀)、删掉库内 `.prev.*` 旧版
- 补了两处原库缺的无障碍兜底:可见焦点环、`prefers-reduced-motion` 降级