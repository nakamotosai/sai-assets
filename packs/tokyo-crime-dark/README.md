# Tokyo Crime Dark 暖黑数据图

暖黑底 #16130e 配暖色顺序带：深色底上把 ColorBrewer YlOrRd 整体提亮 15% 修对比（断点不动），深棕分隔线代替白描边；数据密集型地图/图表的深色方案。

- **包 id**:`tokyo-crime-dark` · kind `theme` · category `themes` · 默认变体 `tokyo-crime-dark`(mode `dark`)
- **主色**:bg `#16130e` · ink `#f5efe2` · accent `#fc4e2a`(on-accent `#16130e`)
- **预览**:[preview/index.html](preview/index.html)(单文件,直接打开)
- **agent 入口**:[SKILL.md](SKILL.md) · **配对规则**:[docs/usage.md](docs/usage.md)
- **文件**:`tokens/`(原色表 + 语义映射)、`css/`(default / all / themes 三份)、`scripts/assert_tokens.py`(断言)
- **取用**:抄 `css/default.css` 即用;多主题站点用 `css/themes.css`(无 `:root`)
- **许可**:MIT(来源见 `docs/usage.md` 末节)

```bash
python scripts/assert_tokens.py
```
