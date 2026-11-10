# references · 用法与判读规则

本包是**外部站点的观测结论**,不是可执行资产:40 条记录,每条讲"某个公开站点(或某份公开规范)在结构 / 版式 / 字栈上长什么样",以及"什么时候该翻它"。

## 选型怎么读(三步,10 秒)

| 顺序 | 字段 | 读法 |
|---|---|---|
| 1 | `tag` + `when` | 先按 `tag` 锁定组(网页 / 纸媒 / 三维 / 新闻 / 瑞士),再用 `when` 的场景词筛出候选。`when` 的第一句就是"什么时候翻这条" |
| 2 | `matchTheme` | 该观测对齐的主题族标识。仓内 `themes` 包 id 同名者可直接联动;`all` = 任何主题都相关 |
| 3 | `observed` / `layout` | 定版式时读这两条:`observed` 是观测到什么(含出处与许可结论),`layout` 是可直接照着排的结构骨架 |

`colorsDNA` 只有 1 条有值(瑞士 **Isotype** 的暖米底 + 平黑剪影 + 单一饱和红),其余为 `null` —— 本包**不提色**:要色值去 `themes` 包的 `tokens/`。载荷与索引分离:`data/index.json` 是紧凑索引(≤16KB,一次读全),逐条详情在 `data/<id>.json`。

## 字段语义

| 字段 | 含义 |
|---|---|
| `id` | 稳定标识,与 `data/<id>.json` 文件名一一对应 |
| `name` | 中文条目名,括号里的 `(基准)` 表示它是**依据类**条目(规范原文 / 参数基准),不是站点版式 |
| `tag` | 分组:`web` `print` `three` `news` `swiss` |
| `source_url` | 观测出处(公开第三方站点 / 规范页 / 上游仓库);保留全 URL 便于回源复核 |
| `observed` | 观测结论 + 出处状态 + 许可结论。句尾 `得分 n/12` 是观测时 12 项检查的记录,**只作强弱排序,不构成许可结论** |
| `layout` | 可直接照着排的结构骨架(栏数 / 网格 / 层级 / 字栈),不含代码 |
| `colorsDNA` | 该条是否给出过配色归纳;多数为 `null`(见上) |
| `matchTheme` | 该观测对齐的主题族标识;与仓内 `themes` 包 id 同名即可直连 |
| `when` | 什么时候用这条:前半句是场景,后半句 `许可:` 是该条内容的可用边界 |

### `when` 怎么读

- 前半句 = **触发场景**:"做中文双栏信息站时先对本条定信息密度与栏宽"。
- 后半句 `许可:` = **该条内容的可用边界**,三类:
  - `观测归纳(不搬运原文/图/码)` —— 只有结论可用,出处内容一律不动;
  - `观测放行(源码不入库)` —— 可以学思路,示例源码不入任何库;
  - 具体许可号(`MIT` / `CC BY 3.0` / `GPL-3.0` / `W3C Document License` …) —— 指的是**该出处自身的许可**,落地前回 `source_url` 复核当前版本,本包不代行许可判断。

### `matchTheme` 怎么读

值是主题族标识,不是文件路径:同名 `themes` 包存在时,先读那个包的 `tokens/` 与 `docs/usage.md`,再按本条 `layout` 排结构。`all` 表示与主题无关的通用规矩(如动效克制)。

## 分组与数量(共 40 条)

| 分组 | `tag` | 条数 | 覆盖什么 | 代表条目 |
|---|---|---|---|---|
| 网页 | `web` | 6 | 现代网页观感与动效尺度:衬线/等宽排印、Bento 留白、深色电影感、浅色暖系、滚动叙事克制 | `ref-w1-typo-serif` · `ref-w4-dark-cinematic` |
| 纸媒 | `print` | 7 | 纸媒与印刷版式规矩:标题/正文字号地板、纸面质感、一页一重心、刊头范式、时间线禁表格、高度预算与打印 | `ref-p1-title-floor` · `ref-p7-height-print` |
| 三维 | `three` | 7 | WebGPU / Three 一屏一效路线:粗糙度反射、后处理管线、Compute 粒子、流体揭示、程序化几何、文字碎裂 | `ref-t2-render-pipeline` · `ref-t6-fluid-presets` |
| 新闻 | `news` | 15 | 新闻/信息站整站结构 与 3 条**中文排版基准**(W3C clreq、中文排印参数、Noto Sans SC 字栈)+ 聚合流后端参考 | `ref-n2-papermod` · `ref-n13-clreq` |
| 瑞士 | `swiss` | 5 | 瑞士国际主义的构造法:网格公式、边距经典比、Gerstner 复合网格、Isotype 统计图形、可分发字体栈 | `ref-s1-grid-formula` · `ref-s4-isotype` |

## 用法示例

1. **定信息站骨架**:`tag=news` → 读 `ref-n2-papermod`(三布局 + 客户端搜索)与 `ref-n9-cleanblog`(极简四页),`layout` 直接当骨架。
2. **定中文正文参数**:`ref-n13-clreq`(禁则与挤压)+ `ref-n14-cntypeset`(字号/行高/行宽三值)→ 第 2 步再回 `themes` 包取色。
3. **定一屏一效**:`tag=three` → 按 `ref-t2`/`ref-t3` 选路线,`when` 里的"源码不入库"照办。

## 反模式(禁区)

- **观测不是代码**:本包不含任何原站 HTML/CSS/JS。禁把 `layout` 描述当实现抄,禁按 `observed` 复刻原站的版式细节到"像原站"的程度 —— 学的是**规矩**,不是皮。
- **禁据此复刻原站**:不得整站仿制、不得搬原站配图/标题正文/logo,不得把条目做成"某站同款"的对外宣称。
- **禁把 `observed` 里的许可结论当法律意见**:那是观测时的记录,落地前回 `source_url` 复核。
- **禁拿本包当色板**:要 hex 去 `themes` 包;`colorsDNA` 只有 1 条有值。
- **禁摘索引当全文**:`index.json` 只留 6 个字段,判读要看 `data/<id>.json` 的 `layout`。

## 维护

新增 / 修订一条 = ① `data/<id>.json`(id 与文件名一致)② 更新 `data/index.json` 的 `count` / `groups` / `items` ③ 跑 `python packs/references/scripts/assert_tokens.py`。断言同时管四件事:条目数与索引一致、必备字段齐、包内无本机路径与内网标识、预览页与 `data/` 同步。改完数据跑 `python packs/references/scripts/build_preview.py` 再跑断言。
