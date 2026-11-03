# cjk-typography · 中文排版四件套

**用哪些字 + 多大**。四张卡合成一包:正文无衬线回退栈 · 三场景字号总表 · 系统等宽栈 · 免费细体中文三选(纯许可清单)。

```css
/* 正文 / UI */
body { font-family: "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; }
/* 长文阅读 */
article { font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif; }
```

## 三场景字号(先选场景,再取数)

| 场景 | h1 | body | meta | code |
|---|---|---|---|---|
| 工具台 | 15–22px | 14px(HUD 12) | 11–12px | 11–13px |
| 纸媒 / 电视 1920 | 64–110px | ≥40px | ≥26px | — |
| 营销落地 | `clamp(2rem–7rem)` 负字距 | 16–17px · lh 1.55–1.65 | mono eyebrow ~0.72rem | mono 元信息 |

## 免费细体中文三选(许可明确才进清单)

| 字体名 | 许可 | 下载来源 |
|---|---|---|
| Noto Sans SC(可变) | OFL-1.1 | npm `@fontsource-variable/noto-sans-sc@5.3.0`(CDN 分片 CSS) |
| MiSans VF | Apache-2.0 | npm `misans@5.0.0`(`lib/Normal/MiSansVF.min.css`) |
| HarmonyOS Sans SC | Unlicense | npm `harmonyos-sans-sc-webfont-splitted@1.1.0`(`dist/Light.css`) |

完整 URL、版本与「上游主页待核」标记见 `tokens/free-thin-cjk.json` 与 [`docs/usage.md`](docs/usage.md)。

- 全套规则(回退栈 / 地板 / 300 陷阱 / 子集化 / 反模式):[`docs/usage.md`](docs/usage.md)
- agent 入口:[`SKILL.md`](SKILL.md)
- 活预览:[`preview/index.html`](preview/index.html)
- 自检:`python scripts/assert_tokens.py`

档位(几档字号 / 字距 / 行高 / 文字影)不在本包:去 `cjk-thin-type-system`。

MIT(本包整理部分)。字体各自沿用自己的许可,汇总见 `pack.json.attribution`。