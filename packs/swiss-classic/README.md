# Swiss Classic（瑞士国际主义）

暖米白纸底 + 暖黑 + 单一结构红；平涂无投影，靠明度差与发丝线造层次

- **包 id**:`swiss-classic` · kind `theme` · category `themes` · 默认变体 `swiss-classic`(mode `light`)
- **主色**:bg `#EDEBE6` · ink `#111111` · accent `#D8232A`(on-accent `#FFFFFF`)
- **预览**:[preview/index.html](preview/index.html)(单文件,直接打开)
- **agent 入口**:[SKILL.md](SKILL.md) · **配对规则**:[docs/usage.md](docs/usage.md)
- **文件**:`tokens/`(原色表 + 语义映射)、`css/`(default / all / themes 三份)、`scripts/assert_tokens.py`(断言)
- **取用**:抄 `css/default.css` 即用;多主题站点用 `css/themes.css`(无 `:root`)
- **许可**:MIT(来源见 `docs/usage.md` 末节)

```bash
python scripts/assert_tokens.py
```
