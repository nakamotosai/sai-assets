# Minimalist Essential 极简 essentials

删到不能再删：中性底 + 单强调色 + 8pt 网格 + 单列信息流；一屏一任务

- **包 id**:`minimalist-essential` · kind `theme` · category `themes` · 默认变体 `minimalist-essential`(mode `light`)
- **主色**:bg `#FAFAF8` · ink `#111111` · accent `#0F62FE`(on-accent `#FFFFFF`)
- **预览**:**无**(`pack.json.files.preview = null`;源库无对应 demo)
- **agent 入口**:[SKILL.md](SKILL.md) · **配对规则**:[docs/usage.md](docs/usage.md)
- **文件**:`tokens/`(原色表 + 语义映射)、`css/`(default / all / themes 三份)、`scripts/assert_tokens.py`(断言)
- **取用**:抄 `css/default.css` 即用;多主题站点用 `css/themes.css`(无 `:root`)
- **许可**:MIT(来源见 `docs/usage.md` 末节)

```bash
python scripts/assert_tokens.py
```
