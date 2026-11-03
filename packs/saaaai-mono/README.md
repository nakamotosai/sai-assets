# saaaai Mono · 近黑 void + 银灰 ink

近黑 void + 银灰 ink + 等高线轮廓当 accent

- **包 id**:`saaaai-mono` · kind `theme` · category `themes` · 默认变体 `saaaai-mono`(mode `dark`)
- **主色**:bg `#06070A` · ink `#F4F4F5` · accent `#E8E8EC`(on-accent `#06070A`)
- **预览**:[preview/index.html](preview/index.html)(单文件,直接打开)
- **agent 入口**:[SKILL.md](SKILL.md) · **配对规则**:[docs/usage.md](docs/usage.md)
- **文件**:`tokens/`(原色表 + 语义映射)、`css/`(default / all / themes 三份)、`scripts/assert_tokens.py`(断言)
- **取用**:抄 `css/default.css` 即用;多主题站点用 `css/themes.css`(无 `:root`)
- **许可**:MIT(来源见 `docs/usage.md` 末节)

```bash
python scripts/assert_tokens.py
```
