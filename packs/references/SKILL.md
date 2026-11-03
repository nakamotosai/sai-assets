---
name: references
description: 40 observation notes on public sites and specs (web / print / three / news / swiss), used before layout and theme selection to fix column counts, type floors, grid formulas and print budgets. Use when picking a structure or type scale and you need evidence-backed rules instead of taste; do not use it as a colour palette, a code source, or a licence ruling.
---

# references

选版式 / 定字号 / 定网格**之前**先读这一包:40 条外部观测说清"别人怎么排"以及"什么时候该翻它"。这是**观测结论**,零代码零原图。

## When to use

- 定信息站 / 新闻站骨架(三布局、极简四页、多栏、分类网格)
- 定中文字号与行高行宽三值,或查中文禁则与标点挤压的依据
- 定网格:瑞士构造公式、边距经典比、复合网格
- 选一屏一效的技术路线(WebGPU 反射 / 后处理 / Compute / 流体 / 文字碎裂)
- 定纸媒与打印规矩:标题正文地板、纸面质感、刊头、一页一重心、高度预算

## When not to use

- 要**色值**:去 `themes` 包的 `tokens/`,本包只有 1 条给过配色归纳
- 要**可执行代码 / 组件 / 动效实现**:去 `web-fx` `web-ui` 包
- 想**复刻某个原站**:禁区,见 `docs/usage.md` 反模式
- 要**许可裁定**:本包只记观测时的出处状态,落地前回 `source_url` 复核

## 分组

| 分组 | `tag` | 条数 |
|---|---|---|
| 网页 | `web` | 6 |
| 纸媒 | `print` | 7 |
| 三维 | `three` | 7 |
| 新闻 | `news` | 15 |
| 瑞士 | `swiss` | 5 |

## Files

| path | use |
|------|-----|
| `data/index.json` | 紧凑索引:40 条只留 `id/name/tag/when/matchTheme/source_url`(≤16KB,一次读全) |
| `data/<id>.json` | 逐条全文:加 `observed` / `layout` / `colorsDNA` |
| `docs/usage.md` | 判读规则:字段语义、`when` 与 `matchTheme` 怎么读、用法示例、反模式 |
| `README.md` | 人读入口 |
| `scripts/assert_tokens.py` | 断言:40 条齐、索引一致、必备字段齐、无本机路径与内网标识 |

## Agent apply steps

1. 读 `data/index.json`,按 `tag` 分组、用 `when` 的场景词筛出 2–4 条候选。
2. 打开候选的 `data/<id>.json`,读 `layout` 拿结构骨架,读 `observed` 拿出处与许可状态。
3. 要落地配色:转向 `matchTheme` 同名的 `themes` 包读 `tokens/`(**禁止**凭本包编色)。
4. 引用时把 `id` 与 `source_url` 一起带上,便于回源复核。

## Hard rules

- 本包只有观测:禁搬运原站 HTML/CSS/JS、原图、标题正文与 logo。
- `when` 里的 `许可:` 是该**出处自身**的许可,不是本包的许可;本包自产部分是 `CC0-1.0`。
- 观测描述 (layout) 拿来定规矩,**禁止**照着复刻原站。
- `得分 n/12` 只是观测记录的强弱排序,不是质量背书。
- 改本包必跑 `python packs/references/scripts/assert_tokens.py`,红了不许提交。
