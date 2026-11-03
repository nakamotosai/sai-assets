# FM Void · 全黑 void + 半透明等宽字

全黑 void + 半透明等宽字；戏在 canvas 背景

- **包 id**:`fm-void` · kind `theme` · category `themes` · 默认变体 `fm-void`(mode `dark`)
- **主色**:bg `#000000` · ink `#f5f5f5` · accent `#ffffff`(on-accent `#000000`)
- **预览**:[preview/index.html](preview/index.html)(单文件,直接打开)
- **agent 入口**:[SKILL.md](SKILL.md) · **配对规则**:[docs/usage.md](docs/usage.md)
- **文件**:`tokens/`(原色表 + 语义映射)、`css/`(default / all / themes 三份)、`scripts/assert_tokens.py`(断言)
- **取用**:抄 `css/default.css` 即用;多主题站点用 `css/themes.css`(无 `:root`)
- **许可**:MIT(来源见 `docs/usage.md` 末节)

```bash
python scripts/assert_tokens.py
```
