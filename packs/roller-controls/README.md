# roller-controls · 滚筒 / 波形滑杆 / 锥形 dock

三件「手感型」控件一起给:滚筒选择器(拖动有惯性、松手吸附、方向键一档一步)、波形滑杆(原生 `input[type=range]` 的可视化层)、锥形 dock(指针距离驱动的放大)。零依赖,两个文件。

```html
<link rel="stylesheet" href="roller-controls.css">  <!-- 标记契约:docs/usage.md -->
<script src="roller-controls.js"></script>

<div class="rc" data-rc-root data-mode="light">
  <div class="rc-wheel" data-rc-wheel data-rc-readout="#h" tabindex="0" role="listbox" aria-label="小时">
    <div class="rc-wheel-item" role="option" aria-selected="true">08</div>
  </div>
</div>
```

- 预览 `preview/index.html`(双击即可;滚筒真能拖 / 滚 / 点 / 方向键,滑杆真能调,dock 真会放大)
- 用法与参数 `docs/usage.md` · agent 入口 `SKILL.md` · 自检 `python packs/roller-controls/scripts/assert_tokens.py`
- 许可 MIT,归属见 `pack.json.attribution`。滑杆底层是原生 range,键盘与屏幕阅读器照常可用。
