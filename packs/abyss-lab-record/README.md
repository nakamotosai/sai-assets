# Abyss Lab Record 暗黑实验记录

近黑底 + 工程网格 + 等宽 HUD + 单关键词橙，深色主叙事、纸面只做独立反转章节；面板全透明虚线检测框

- **包 id**:`abyss-lab-record` · kind `theme` · category `themes` · 默认变体 `abyss-lab-record`(mode `dark`)
- **主色**:bg `#0B0B0E` · ink `#F5F2EA` · accent `#FF5A1F`(on-accent `#1B1B18`)
- **预览**:[preview/index.html](preview/index.html)(单文件,直接打开)
- **agent 入口**:[SKILL.md](SKILL.md) · **配对规则**:[docs/usage.md](docs/usage.md)
- **文件**:`tokens/`(原色表 + 语义映射)、`css/`(default / all / themes 三份)、`scripts/assert_tokens.py`(断言)
- **取用**:抄 `css/default.css` 即用;多主题站点用 `css/themes.css`(无 `:root`)
- **许可**:MIT(来源见 `docs/usage.md` 末节)

```bash
python scripts/assert_tokens.py
```
