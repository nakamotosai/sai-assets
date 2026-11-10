# 外部设计规则观测 · 判读与配对

> 本包只有**观测与结论**:13 条上游 skill 的逐个评审 + 33 条可落地判据的重述。零上游原文、零代码、零图像、零字体二进制。

## 字段语义

| 文件族 | 字段 | 怎么读 |
|---|---|---|
| `data/ref-ds*.json`(13 条) | `verdict` | `收(提炼)` = 有自家空白且可落断言;`只记观测` = 重复度高 / 与自家口径冲突 / 形态不符 |
| | `license` | 该上游**自身**的许可状态,不是本包许可;落地前回 `source_url` 复核 |
| | `observed` | 判定依据,含与自家哪条规则重复或冲突 |
| | `when` / `not_for` | 取用场景与禁区 |
| `data/r*.json`(33 条) | `rule` | 我方重述后的可执行判据,含数值/阈值/反例 |
| | `evidence` | 上游出处(文件名/小节),供回源核对,不是原文 |
| | `own_gap` | 自家库里缺什么 / 已覆盖什么 |
| | `group` | `review` 审查 · `guidelines` 审计 · `motion` 动效 · `craft` 细节 · `rules` 规则库 |
| `data/index.json` | — | 46 条紧凑索引,按 agent 一次读全 |

## 配对规则(谁配谁)

1. **先读 verdict 再读 rule**:`r*.json` 的 `source` 指向 `ref-ds*.json` 的 `name` 字段里的短名;判定为「只记观测」的上游,其规则条目只在**明确标注增量**时取用。
2. **判据进项目锁**:挑中一条后,把它写成项目 `design-lock.json.assertions` 的 `{id,kind,check,threshold,how,gate}` 六字段,并给 `gate` 一个执行点(`build` / `deploy` / `closeout`);只写在锁里不执行 = 未生效。
3. **色值不进本包**:本包无 hex/rgba/oklch 色板。要色值去 `themes` 包的 `tokens/`;要 OKLCH 算法见 `ref-ds12` 观测(本轮不落包,因与 `docs/PACK-CONTRACT.md §5` 的色值口径冲突)。
4. **冲突以自家正本为准**,顺序:`sai-frontend`(尤其 `front-rules.md` / `hard-gates-web.md` / `design-gates.md`)> `managed-skills/design-system` > `managed-skills/motion-scroll` > `sai-assets/docs/PACK-CONTRACT.md` > 本包。本包是弹药,不是第二套标准。

## 用法示例

- 要做「提交按钮为什么点不动」的评审:读 `r10`(表单提交契约)→ 写断言 `submit-enabled-before-request` → 挂 `build` gate。
- 要让一个「太吵」的页面降噪:读 `r07`(饱和度 70–85%、位移 10–20px)→ 与设计系统 §2.5 的和色六景比对后落 token。
- 要审既有站点(非新建):读 `r30`(三证明门)与 `r28`(`file:line - [rule-id]` 输出格式)→ 出报告带 Confidence 列。

## 反模式

- **禁把本包当代码抄**:`evidence` 是出处线索,不是可编译片段;上游实现一律回 `source_url` 自行实现。
- **禁照搬数值就当自家标准**:`r16` 的时长四档、`r26` 的阴影三档、`r21` 的纯黑白描边,都存在与自家已拍板口径不一致处(见下)。
- **禁复刻上游 skill 或站点**:本包只记录「我们看了什么、决定收什么」,不是上游镜像。
- **禁拿本包做许可裁定**:许可栏记的是读取时刻状态,落地前回源复核。

## 冲突表(逐条,禁自动生效)

| 条目 | 上游口径 | 自家正本 | 裁决 |
|---|---|---|---|
| `r16` 曲线与时长 | 三条强曲线 + 禁内置 easing;UI <300ms | `motion-scroll` 全站一条曲线 `cubic-bezier(.22,.61,.36,1)`;`front-rules.md:82` 页面级 300–500ms | 曲线用自家单值;**只补分元件时长档表**,不换曲线 |
| `r26` 阴影 | ≥3 层、禁纯黑、三档 elevation | `design-system §3` 阴影 1 套;部分主题包用纯黑投影 | 沿用自家;只在**用户明确要求多层阴影**时取 r26 |
| `r21` 图片描边 | 必须纯黑/纯白 `oklch(0/1 0 0 /.1)` | 无对应条目;自家 `--shadow` 为实心黑 | 可用,但与 r26「禁纯黑」适用对象不同(描边 vs 投影),同站同用时先定哪个优先 |
| `r10` 图片尺寸 | 上游指南要求 `<img>` 显式宽高 | `hard-gates-web.md:45` 明令 `<img>` 不写 width/height,用 `aspect-ratio` 容器 | **以自家为准**,上游该条不收 |
| `r33` 命中区 | 40/44px 分档 | `front-rules.md:116` ≥40×40、`design-system §3` ≥44px | 合并成单条阈值,不新增第三个标准 |
| `r23` 音效 | 27 条数值 | 自家全库无规则 | 可整块取用,但须先在真实播放器上复测再进锁 |

## 改本包

改任一 `data/*.json` 后必跑 `python packs/design-skill-verdicts/scripts/assert_tokens.py`,红了不许提交。新增条目同步改断言里的 `EXPECT_VERDICT` / `EXPECT_RULES` 与 `index.json.count`。
