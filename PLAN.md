# PLAN · M1 单包打通

> 分解依据 `SPEC.md`;每一步给"文件变更 + 验证方式",禁跳过验证。

## 步骤

| # | 步骤 | 文件变更 | 验证 |
|---|---|---|---|
| 1 | 契约与映射落盘 | `schema/pack.schema.json`、`schema/alias.json` | `python -c "import json;json.load(open('schema/alias.json'))"` |
| 2 | 包生成器 | `scripts/build_pack.py`(新增) | 对 13 个主题跑通:每包 `assert_tokens` 退出 0 |
| 3 | 清洗闸 | `scripts/gate.py`(新增)+ `.github/workflows/gate.yml` | 全仓 0 命中;故意植入一条盘符路径试红 |
| 4 | catalog | `scripts/build_catalog.py`(新增) | `catalog.json` ≤8192B,条目 = 白名单 |
| 5 | 预览墙 | `scripts/build_wall.py`(新增,复用旧库形态) | 墙含 references;demo 计数不再被去重吃掉 |
| 6 | 应用脚本 | `scripts/apply.py`(新增) | 抄进临时目录,产物齐全 + 打印 lock 片段 |
| 7 | 取用口径文档 | `docs/USAGE-INTEGRATION.md` | 含 `design-lock.json.assets[]` 示例与 skill 协议文本 |
| 8 | CI + Pages | `.github/workflows/pages.yml` | 红/绿可复现(先在本地跑 gate) |
| 9 | 公开仓 + 首推 | `nakamotosai/sai-assets` | `gh repo view` + `git ls-remote --tags` 有形 tag |
| 10 | skill 取用协议 | 全局 skill 目录下 `sai-frontend/SKILL.md` §1 重写、删 `SYNC:EXEMPT` | 复扫旧口径(数字/双副本)0 命中 |
| 11 | **真消费一次** | 目标项目 `design-lock.json` + 其样式文件 | lock 里有 `pack`/`version`/`sha`;项目里跑一次视觉冒烟 |

## 接口冻结(禁中途改)

- `pack.json` 字段集:**以 `schema/pack.schema.json` 为准**,加字段须先改 schema + PACK-CONTRACT。
- `catalog.json` 顶层:`{ "schema":1, "repo", "updated":"<YYYY-MM-DD>", "base":"<raw 前缀>", "how_to_use", "categories":[{ "id","title","count","items":[{ "id","version","one_liner","path","home"? }] }] }` —— **发现索引**(≤8KB 承诺;title/tags/license/attribution/not_for 与完整元数据在 `packs/<id>/pack.json`,人读清单走 `apply.py --list`)
- 取用入口固定为 `scripts/apply.py <id> --to <dir>`;`--list` 打印 catalog 摘要。

## 依赖与风险

- 生成器**只读**旧库(本地素材源,路径不入仓);旧库条目改索引推迟到 M2(避免迁移期双写)。
- Pages 需仓库 public:gate 全绿前不建公开仓、不推任何 commit。
- 主题变体结构(`themes/*.json` 的 `variants[]`)不齐时:单变体主题按"一个变体"生成,`default_variant` 取该变体 id。
