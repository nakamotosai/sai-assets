# footer-shapes · 页脚五形态

排印式 / 栅格式 / 大字式 / 动效式 / 小字式。同一份数据、同一个骨架,**换一个形态类就换一种信息密度取向**——不是五种风格,是五种「底部要承载多少」的选择。

```html
<link rel="stylesheet" href="footer-shapes.css">  <!-- 标记契约:docs/usage.md -->
<script src="footer-shapes.js"></script>          <!-- 只有栅格式的订阅表单需要 -->

<footer class="fs ft--typo" data-mode="light">
  <div class="fs-in">…</div>
</footer>
```

形态类五选一:`ft--typo` / `ft--grid` / `ft--large` / `ft--anim` / `ft--small`。

- 预览 `preview/index.html`(双击即可;五个页签切换,栅格式的表单可试空 / 非法 / 合法三态)
- 用法与参数 `docs/usage.md` · agent 入口 `SKILL.md` · 自检 `python packs/footer-shapes/scripts/assert_tokens.py`
- 许可 MIT,归属见 `pack.json.attribution`。实测高度(978px 宽):414 / 295 / 379 / 418 / 128 px。
