# 墨河 · 深色单色蓝（群青）

近黑冷蓝底 + 单一色相 218–223° 明度梯；唯一有彩光是强调色 #6891d9；卡片半透明浮在 WebGL 墨河背景上；竖排书脊刊头（汉字竖排做书脊）；衬线标题 + 冷瓷白正文

- **包 id**:`mohe-mono-blue` · kind `theme` · category `themes` · 默认变体 `mohe-mono-blue`(mode `dark`)
- **主色**:bg `#04070F` · ink `#EAF0FA` · accent `#6891d9`(on-accent `#04070F`)
- **预览**:[preview/index.html](preview/index.html)(单文件,直接打开)
- **agent 入口**:[SKILL.md](SKILL.md) · **配对规则**:[docs/usage.md](docs/usage.md)
- **文件**:`tokens/`(原色表 + 语义映射)、`css/`(default / all / themes 三份)、`scripts/assert_tokens.py`(断言)
- **取用**:抄 `css/default.css` 即用;多主题站点用 `css/themes.css`(无 `:root`)
- **许可**:MIT(来源见 `docs/usage.md` 末节)

```bash
python scripts/assert_tokens.py
```
