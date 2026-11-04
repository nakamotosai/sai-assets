# token-harbor · 墨色双模设计语言

**无色相**的一套设计语言:近黑为默认、暖白并存,两模共用同一套语义键名;唯一强调色就是墨色本身,层次靠墨/纸互换与一条细线。正文 14px、按钮 4px 圆角、卡片 14px、无渐变、标题不外挂衬线。含 announce 条、吸顶 header、语言与主题按钮、tag / chip、作品卡、定价卡、案例卡、流程、FAQ、表单(含校验态)与 footer 全套构件。

```html
<link rel="stylesheet" href="default.css">   <!-- 近黑 + 全部构件,单主题直用 -->
<link rel="stylesheet" href="themes.css">    <!-- 只出 [data-theme] 作用域的 token,双模并存 -->
<html data-theme="dark">
```

- 预览 `preview/index.html`(双击即可,无需服务器:自包含、零外部子资源、加载不跳转、不用 localStorage 也能看) · 用法与配对规则 `docs/usage.md` · agent 入口 `SKILL.md`
- 实测对比度:近黑 ink/bg 14.78:1 · muted/bg 6.34:1;暖白 ink/bg 16.66:1 · muted/bg 5.02:1(四档全部 ≥ 4.5:1)
- 自检 `python packs/token-harbor/scripts/assert_tokens.py` · 许可 MIT,归属见 `pack.json.attribution`
- 包内无 webfont、无第三方素材、无站点自有 logo 图形;文案里的邮箱、公司名与价格都是中性占位。
