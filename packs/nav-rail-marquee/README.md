# nav-rail-marquee · 左竖排跑马灯 + 顶导航 + 右段轨

压在画面四角的导航 chrome:左侧竖排无缝跑马灯、顶部居中小写导航、右侧段轨(当前条加长发光)、底部进度线。两处导航共用 `aria-current="page"`,点任一处两处同步,滚到某段也自动切;全部规则限定在 `.nr` 内,不动 `html` / `body`。

```html
<link rel="stylesheet" href="nav-rail.css">  <!-- 标记契约:docs/usage.md -->
<script src="nav-rail.js"></script>
```

- 预览 `preview/index.html`(双击即可,无需服务器) · 用法与参数 `docs/usage.md` · agent 入口 `SKILL.md`
- 自检 `python packs/nav-rail-marquee/scripts/assert_tokens.py` · 许可 MIT,归属见 `pack.json.attribution`
- 示例字条里的域名是中性占位 `example.com`;包内无盘符路径、无自有域名、无客户代号。
