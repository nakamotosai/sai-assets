# 外部设计规则观测 · 13 skill 逐个评审 + 33 条可落地判据

朋友推荐的 13 个 Interface 设计类 skill,逐个读完上游原文后的判定与提炼。**只写观测与结论,不带上游原文、代码、图像、字体**。

- **收 7 个**(提炼成规则条目):`pbakaus/quieter` `pbakaus/critique` `pbakaus/polish` `vercel-labs/web-design-guidelines` `emilkowalski/emil-design-eng` `jakubkrehel/make-interfaces-feel-better` `raphaelsalaja/userinterface-wiki`;`ibelick/ui-skills` 局部收 3 条
- **只记观测 6 个**:`anthropics/canvas-design` `pbakaus/distill` `emilkowalski/prototype` `jakubkrehel/oklch-skill` `arvindrk/extract-design-system`(`distill` 另摘 3 条)
- **全部 13 个**都有 `verdict` 观测条目,逐条给判定依据、许可状态、与自家规则的重复/冲突位置

## 判定表

| # | 注册表条目 | 判定 | 依据 |
|---|---|---|---|
| 1 | `anthropics/canvas-design` | 只记观测 | Apache-2.0 逐 skill / 字体 OFL;规则层 0 量化值,已被自家 §4.12 立意闸覆盖 |
| 2 | `pbakaus/quieter`(图作 quiter) | 收 | 饱和度 70–85%、位移 40→10–20px、字重 900→600 等自家缺的量化带 |
| 3 | `pbakaus/distill` | 只记观测(摘 3 条) | 与自家 `design-system §3` 极简风几乎逐条同构 |
| 4 | `pbakaus/critique` | 收 | Nielsen 10 项 0–4 分+分母口径、≤4 选项/≤5 导航、降级显式 banner |
| 5 | `pbakaus/polish` | 收 | 漂移四分类+最窄层修因、五档 triage、禁为验收而加动画 |
| 6 | `vercel-labs/web-design-guidelines` | 收 | 薄壳外抓,正本 MIT;URL 即状态/表单提交契约/i18n/触控三件套自家空白 |
| 7 | `emilkowalski/prototype` | 只记观测 | 与自家 §9 多方案对照台同题且口径不同,照搬=第二套标准 |
| 8 | `ibelick/ui-skills` | 收(局部提炼) | 实为网站+CLI+9 skill 的路由层;元数据闸/三证明门/性能禁令有增量 |
| 9 | `emilkowalski/emil-design-eng` | 收 | <300ms 分档表、频率否决、scale(0) 禁令、曲线三值、手势数值组 |
| 10 | `jakubkrehel/make-interfaces-feel-better` | 收 | 19 条原则+5 细则,图标描边/动画四值/描边数值/text-wrap 阈值均可断言 |
| 11 | `raphaelsalaja/userinterface-wiki` | 收 | 152 条规则;音效 27 / morphing 9 / container 7 / OpenType 6 整块自家空白 |
| 12 | `jakubkrehel/oklch-skill` | 只记观测 | 配色数学增量最大,但与 `PACK-CONTRACT §5`「只收 hex/rgba」硬冲突,本轮不改契约 |
| 13 | `arvindrk/extract-design-system` | 只记观测 | MIT CLI 依赖 dembrandt+Playwright;自家 `tokens.css` 单入口无反向抽 token 需求位 |

## 读法

0. 直接看 `preview/index.html` —— 46 条一张张摆开,按分组可筛

1. `SKILL.md` — agent 入口:何时用、分组、apply 步骤、硬规则
2. `data/index.json` — 46 条紧凑索引
3. `data/ref-ds*.json` — 13 条 verdict(判定 / 许可 / 依据 / 场景 / 自家对应条文)
4. `data/r*.json` — 33 条判据(含数值、出处、自家缺口)
5. `docs/usage.md` — 配对规则、用法示例、**冲突表**(6 处与自家正本冲突的裁决)

## 边界

本包是**弹药**,不是第二套标准。所有数值进项目前必须对照 `docs/usage.md` 冲突表,并写成 `design-lock.json.assertions` 挂到 `build`/`deploy`/`closeout` 执行点。预览:`preview/index.html` —— 46 条全部逐条摊开成可筛卡片,深浅双模带可见切换按钮,由 `scripts/build_preview.py` 从 `data/*.json` 生成。

上游许可与出处逐条记在 `data/ref-ds*.json` 的 `license` / `source_url`;本包自产重述部分为 `CC0-1.0`。
