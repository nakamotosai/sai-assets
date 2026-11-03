# Paper Editorial · 纸感编辑：米白画布

纸感编辑：米白画布、墨色正文、刊头朱红

- **包 id**:`paper-editorial` · kind `theme` · category `themes` · 默认变体 `paper-editorial`(mode `light`)
- **主色**:bg `#F7F3EB` · ink `#1A1714` · accent `#C41E3A`(on-accent `#FFFCF7`)
- **预览**:**无**(`pack.json.files.preview = null`;源库无对应 demo)
- **agent 入口**:[SKILL.md](SKILL.md) · **配对规则**:[docs/usage.md](docs/usage.md)
- **文件**:`tokens/`(原色表 + 语义映射)、`css/`(default / all / themes 三份)、`scripts/assert_tokens.py`(断言)
- **取用**:抄 `css/default.css` 即用;多主题站点用 `css/themes.css`(无 `:root`)
- **许可**:MIT(来源见 `docs/usage.md` 末节)

```bash
python scripts/assert_tokens.py
```
