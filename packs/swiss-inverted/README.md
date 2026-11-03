# Swiss Inverted（瑞士反色 / 暗色）

暖黑纸底 + 暖白墨 + 同一个结构红；纸↔墨互换，红保持不变 —— 同字体两种墨极性

- **包 id**:`swiss-inverted` · kind `theme` · category `themes` · 默认变体 `swiss-inverted`(mode `dark`)
- **主色**:bg `#121212` · ink `#EDEBE6` · accent `#D8232A`(on-accent `#FFFFFF`)
- **预览**:[preview/index.html](preview/index.html)(单文件,直接打开)
- **agent 入口**:[SKILL.md](SKILL.md) · **配对规则**:[docs/usage.md](docs/usage.md)
- **文件**:`tokens/`(原色表 + 语义映射)、`css/`(default / all / themes 三份)、`scripts/assert_tokens.py`(断言)
- **取用**:抄 `css/default.css` 即用;多主题站点用 `css/themes.css`(无 `:root`)
- **许可**:MIT(来源见 `docs/usage.md` 末节)

```bash
python scripts/assert_tokens.py
```
