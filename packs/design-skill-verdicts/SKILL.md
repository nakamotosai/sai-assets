---
name: design-skill-verdicts
description: Observation notes on 13 public design skills from the Interface registry, with per-skill verdicts and 33 machine-checkable UI rules distilled from them. Use before a UI review or polish pass to find a numeric criterion and check it against our own design system; do not use it as code, a colour palette, a licence ruling, or a replacement for our own gates.
---

# 外部设计规则观测

13 个上游设计 skill **逐个评审** + 33 条**可落地判据**的重述。本包只有观测与结论:零上游原文、零代码、零图像、零字体二进制。

## When to use

- 评审/打磨 UI 前,想找一条能写进 `design-lock.json.assertions` 的数值判据
- 要判断「这个外部设计 skill 值不值得进库」时,先看 13 条 verdict 的判定依据
- 遇到具体场景:审查评分口径、表单提交契约、动效时长分档、图标描边、音效数值、发布元数据闸

## When not to use

- 要**色值**:去 `themes` 包的 `tokens/`;本包无色板
- 要**可执行代码/组件/动效实现**:去 `web-fx` / `web-ui` 包
- 要**许可裁定**:`license` 记的是读取时刻状态,落地前回 `source_url` 复核
- 想**照搬数值当自家标准**:冲突项见 `docs/usage.md` 冲突表,以自家正本为准

## Files

| path | use |
|------|-----|
| `data/index.json` | 46 条紧凑索引,一次读全 |
| `data/ref-ds01…13-*.json` | 13 条上游 skill 逐个评审:`verdict` / `license` / `observed` / `when` / `not_for` / `own_counterpart` |
| `data/r01…r33.json` | 33 条判据:`rule`(含数值/阈值/反例) / `evidence` / `group` / `own_gap` |
| `docs/usage.md` | 字段语义、配对规则、用法示例、反模式、冲突表 |
| `scripts/assert_tokens.py` | 断言:条数/id 连续/必备字段/index 一致/分组计数/形态规则 0 命中/用法三节齐 |

## 分组

| group | 条数 | 覆盖 |
|---|---|---|
| `review` | 8 | 审查评分、认知阈值、降级可见、漂移归因、triage、降噪、减法 |
| `guidelines` | 6 | URL 即状态、表单提交契约、加载防闪烁、i18n、触控三件套、a11y 底线 |
| `motion` | 5 | 频率否决、时长分档、入场起点、慢放复检、手势数值组 |
| `craft` | 4 | 图标描边、图标动画四值、表面描边、文本与性能细则 |
| `rules` | 10 | 音效合成、容器两 div、UX 可测值、阴影伪元素、OpenType、报告格式、元数据闸、三证明门、性能禁令、命中区分层 |

## Agent apply steps

1. 读 `data/index.json`,按 `type` 与 `group` 筛出候选;要判「收不收」读 `ref-ds*.json` 的 `verdict` 与 `observed`。
2. 打开 `data/r*.json`,读 `rule` 拿判据、读 `own_gap` 看自家库缺什么、读 `evidence` 回源核对。
3. 对照 `docs/usage.md` 的**冲突表**,确认该条与自家正本(sai-frontend / design-system / motion-scroll)不打架。
4. 把判据写成项目 `design-lock.json.assertions` 的 `{id,kind,check,threshold,how,gate}`,并给 `gate` 一个执行点;只写不执行 = 未生效。
5. 引用时带 `id` 与 `source_url`,便于回源复核。

## Hard rules

- 本包只有观测:禁搬运上游 SKILL.md 原文、代码、图像、字体文件、原站内容。
- `license` 是**上游自身**的许可,不是本包许可;本包自产重述部分为 `CC0-1.0`。
- 所有数值只是**候选弹药**,不是第二套标准;冲突时以 `sai-frontend` / `design-system` / `motion-scroll` 为准。
- `evidence` 是出处线索,不是可编译片段。
- 改本包必跑 `python packs/design-skill-verdicts/scripts/assert_tokens.py`,红了不许提交。
