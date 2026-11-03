# CLOSEOUT · sai-assets(2026-11-04)

## 一句话

旧主题库从"内网博物馆"变成**公开、可版本化取用的包库**:29 个包、两道 CI 全绿、Pages 墙已上线,并已在一个真实项目里被消费一次(项目侧记了 `pack@version`)。

## 交付物

| 面 | 结果 |
|---|---|
| 公开仓 | `github.com/nakamotosai/sai-assets`(public,全新历史,LICENSE MIT) |
| 预览墙 | https://nakamotosai.github.io/sai-assets/(29 卡;含 references 入口,修掉了旧墙"全局 id 去重吃掉一半 demo"的坑) |
| 机器目录 | `catalog.json` 6698B ≤ 8KB(发现索引:选中后再读 `packs/<id>/pack.json`) |
| 包 | themes 14(13 实体 + gruvbox-dark 外部索引)· fonts 2 · web-fx 4 · web-ui 6 · fx-engines 1 · references 1 · video-motion 1(索引) |
| 断言 | 27 份包内断言;`ink/bg` 7.93–20.62、`on-accent/accent` 4.53–21.00(实测值随断言打印) |
| 闸 | 两层规则(公开 11 条通用 + 本地 13 条内部标识);上游 vendored 目录按口径跳过;`--scan-dir` / `--scan-upstream` 可展开 |
| 发布 | tag `pack/ouuut-editorial@1.0.0`、`pack/minimalist-essential@1.0.1`;`release.py` 打 tag 前强制闸绿 |
| 取用 | `apply.py`(整包拷贝 + lock 片段)/ raw URL / jsDelivr 固定版本 / clone;`harvest.py` 收新包(必填 when/not-for/license + 已有用法文档,不写散文) |
| 真消费 | `panout-japan`:CSS 计算值 1760 cell 0 差异、`app.css` 段字节不变、截图差 9/1,296,000 px;`design-lock.assets[]` 记 `ouuut-editorial@1.0.0`(未 push,等其自身收口节奏) |
| 真 PR | PR #1(squash 合并):`minimalist-essential` 补活预览 + 1.0.1;CI 绿 → merge → tag,回收链跑通 |
| 旧库 | `F:\模板库` 降级为素材源(README/DESIGN 断链修正);`sai-frontend` §1/§1.5 + 9 份 references 口径改为 pack 路径,旧"内网 :18466 / registry.json / 手抄 token"口径清零 |
| 顺手补 | `mv-studio`(Remotion,16 archetype,原零备份)已推私有远端 |

## 迁移中发现并修掉的真问题(都留了痕)

1. **惰性时间戳**:catalog/墙用 `now()` → CI 重建必红;改为取 HEAD 提交日期。
2. **apply 漏拷**:只拷 css/tokens 会让包内断言因缺 `pack.json`/`preview` 必失败;默认改整包拷贝。
3. **CRLF × sha256**:Windows 工作区与 CI 检出算出两个哈希(fx 三包同因);统一"LF 归一后再算"。
4. **规则字面量自伤**:包内断言复刻禁用形态(盘符正则/品牌词)会被自己的闸判红;改为"形态判定归 gate 正本"。
5. **`sanitize.py` 会改写 vendored 源码**:缺 `upstream/**` 跳过,会把 three.js 原文改写坏;已补同口径跳过。
6. **`__pycache__` 折叠常量**:import 自己的断言脚本会把拼装的禁用串折叠进 `.pyc`;断言禁 import 自身,gate 也跳过 `__pycache__`。

## 未完成(明确留给下一步)

- 旧私仓 `sai-themelab` 归档(远端开着;本地已降级)。
- `mv-studio` 的 `canonical_home` 回填(私有仓不宜当公开入口,现为 `null`)。
- 主检出 ref 落后 origin/main 一个 commit(内容逐字节相同;工作区策略禁止在此切换/重置,下次干净时 `git pull` 即快进)。
- 9 个"只有卡片、没有实现产物"的动效(`blur-focus` / `clip-sweep` / `flip-in` / `hard-press` / `ambient-void` / `io-triggered-float-in` / `spotlight-hover` / `fx-mutex-system`;`theme-crossfade` 已并入 `dual-theme-toggle`):要真入库得先补产物,禁空壳。

## 判据复述(为什么这样做)

- 单位是**包**不是类别:上游 54KB 的单包仓(gruvbox-theme)能被用起来,而"库 + 内网网页"几个月只被 2 个项目手抄过 token —— 消费面的形状决定资产活不活。
- **公开不可撤回**:因此"闸门先于提交"、规则分两层(否则规则表本身就是泄漏面)、白名单外一律不灌。
- **不复制第二份真相源**:外部已有本家的(gruvbox-theme / mv-studio)只索引;包进仓后旧库对应条目改索引;共享底座(10 个背景动效的 `engine.js`)合并成一个包。
