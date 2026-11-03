# progress · sai-assets

## 2026-11-03 · M0 建档拍板(完成)

- 立项依据:三份取证(73 个 demo 逐项公开风险 / 现状调用面 / 公开前审计)得出——旧库生产端完整、消费端为零;全库真实消费仅 2 例且都是手抄;静态墙因全局 id 去重把 73 demo 只上墙 27 个;40 条 references 不上墙;主题原子内嵌本机路径与客户名;10 个 demo 含第三方品牌/媒体内容(硬阻断)。
- 落盘(本仓):`AGENTS.md` 门规 + `PROJECT_CONSTITUTION.md` + `TRACK_TREE.md` + `SPEC.md`(M1)+ `PLAN.md`(M1)+ `docs/adr/adr-0001-*.md` + `docs/PACK-CONTRACT.md`(v1)+ `docs/SCOPE.md`(公开收录判据)+ `docs/USAGE-INTEGRATION.md` + `schema/pack.schema.json` + `schema/alias.json`(公开安全的映射子集)。
- 落盘(私有,不进本仓):完整收录名单与逐项公开风险评估在 `.private/`。
- 登记:私有项目台账增行 + 项目本卡。
- 拍板要点:单仓多包(不按类别分仓);全新历史(旧历史含大文件残留与提交者邮箱,转公开不可逆);外部包只索引不复制;共享底座合包(10 个背景动效共 1 个 `bg-fx`);不做 MCP、不做 npm。
- 顺手记下的风险:本地的 Remotion 项目 `mv-studio`(16 archetype)**无远端、单 commit、零备份** → 列入 M4。

## 2026-11-03 · M1 进行中

- 已落盘并实测:
  - `packs/ouuut-editorial`(旗舰包,手写):双模 + 四套强调色组 + 章节提色 + 排版刻度 + 活预览;`python packs/ouuut-editorial/scripts/assert_tokens.py` → `PASS`(ink/bg 15.73 / 16.20,muted/bg 6.24 / 7.47,24 个强调色 Y 0.199–0.203、炭黑侧 ≥4.57、纸白侧 ≥3.75)。
  - `packs/gruvbox-dark`(外部索引项,内容在他仓,本仓只登记 `canonical_home`)。
  - `scripts/build_catalog.py` → `catalog.json`(2 包 1533B ≤ 8192B);`scripts/build_wall.py` → `index.html`;`scripts/apply.py`(含 `--list` / `--dry-run` / 外部包拒绝,已实测落盘与 lock 片段输出)。
- 并行在跑:12 个主题包的生成器与清洗规则(分身 PackGen)、公开内容闸 `scripts/gate.py`(分身 Gate)。
- 闸门收口:仓内文档里的本机路径/客户代号已改中性表述;完整名单与映射表的私有部分移入 `.private/`(gitignore),闸只扫 git 跟踪文件。

### 下一步

等 PackGen/Gate 结果 → 跑 `gate.py` 全绿 → 建公开仓 + 首推 → 把 `sai-frontend` §1 改成取用协议 → 在一个真实项目里消费一次(落 `design-lock.json.assets[]`)。

## 2026-11-03 · M1 收尾(公开仓已上线)

- 公开仓:`nakamotosai/sai-assets`(public),两个 workflow(gate / pages)全绿;Pages 已部署:
  - 墙 `https://nakamotosai.github.io/sai-assets/`
  - 目录 `https://raw.githubusercontent.com/nakamotosai/sai-assets/main/catalog.json`
  - 包预览 `.../packs/ouuut-editorial/preview/`
- 首个 release tag:`pack/ouuut-editorial@1.0.0`(release.py 打 tag 前强制 gate 绿)。
- 15 个包:13 主题(12 生成 + ouuut-editorial 手写)+ gruvbox-dark(外部索引)+ references(40 条观测,`index.json` 13407B)。
- 闸:`python scripts/gate.py` → `PASS gate: 0 findings, 15 packs, 14 assertions`;规则分两层(公开层 11 条通用 + `.private/banned.local.json` 内部标识 13 条)。
- 视觉验收(ego lite 1440px):墙 + ouuut-editorial 预览真开;纸白/A → 炭黑/D 切换后 `--bg #F5F3ED→#0E0E0C`、`--accent #CD5545→#688527`、`aria-label` 翻转、月亮图标显示;色卡 hex 随配色组实时更新。
- skill 侧:`sai-frontend` §1/§1.5 已重写为**取用协议**(三通道 + 硬规则 + 选型顺序),旧的"内网库 + 手抄 token"口径与 `registry.json` 索引写法退场(仅留一行"不再是取用方向")。
- CI 确定性:目录/墙的时间戳改取 HEAD 提交日期,消除"CI 重建必红"。

## 2026-11-03 · M2 进行中

四个分身并行:bg-fx/three-fx(WebGL 家族)、page-transition/particle-fx/fx-engines、web-ui 六包、fonts 两包 + video-motion 索引项。
