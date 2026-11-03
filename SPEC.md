# SPEC · M1 单包打通

## 目标(一句话)

从旧库的一个主题原子出发,自动产出一个符合 PACK 契约的包,经清洗闸与断言后进入公开仓,并在一个真实项目里**被真正消费一次**(`design-lock.json` 落 `pack@version`)。

## 范围

1. `schema/alias.json` — 原子 id ↔ demo 目录名映射(12 组起,含 9 个卡片-only 的判定)。
2. `scripts/build_pack.py` — theme JSON → 包:tokens/absolute+index+semantic、css/default+all、docs/usage.md、scripts/assert_tokens.py、SKILL.md、pack.json、preview 拷贝。
3. `scripts/gate.py` — 三层闸:schema(`schema/pack.schema.json`)+ 清洗正则(绝对路径/内网/凭据/品牌/客户)+ 每包断言并发执行。
4. `scripts/build_catalog.py` — `catalog.json`(≤8KB,字段 id/title/kind/category/version/one_liner/when/tags/url/license/canonical_home)。
5. `scripts/build_wall.py` — 复用旧库墙的形态,修 id 去重 bug,补 references 渲染,输出 `index.html`(Pages 根)。
6. `scripts/apply.py` — 拷贝式应用到目标目录 + 打印落 `design-lock.json` 的片段。
7. `.github/workflows/pages.yml` — 校验 + 重建 catalog/墙 + 部署 Pages。
8. `docs/USAGE-INTEGRATION.md` — `design-lock.json.assets[]` 口径 + skill 侧取用协议文本。
9. skill 侧:`sai-frontend\SKILL.md` §1 重写为取用协议(删 `SYNC:EXEMPT` 双副本机制)。

## 非目标(M1 不做)

- 不搬 web-fx / web-ui / references 的存量(M2)
- 不做 tag/release 自动化、不做 harvest→PR 链(M3)
- 不做 npm 发布、不做 MCP server(ADR-0001 落选者)
- 不改旧库的生产脚本(deposit/judge/promote 继续按旧口径跑,M4 再收口)
- 不动 `mv-studio`

## 验收条件(全部可观测)

| # | 条件 | 证据 |
|---|---|---|
| 1 | 13 个主题包在 `packs/` 生成,每个 `python scripts/assert_tokens.py` 退出 0 | 13 行 `PASS assert_tokens` |
| 2 | `python scripts/gate.py` 全仓 0 命中 | `PASS gate: 0 findings, N packs` |
| 3 | `catalog.json` ≤8192 字节且条目数 = 白名单一致 | `wc -c catalog.json` + 条数 |
| 4 | Pages 墙可开,含 references 入口且 demo 计数不再被去重吃掉 | 公开 URL + 页面内计数 |
| 5 | 公开仓 `nakamotosai/sai-assets` 存在且已推首个 tag | `gh repo view` + `git ls-remote --tags` |
| 6 | **一个真实项目消费一次**:`design-lock.json` 出现 `assets[]` 项含 `pack`/`version`/`sha` | 该项目文件 + 断言输出 |
| 7 | 未过闸内容从未进入任何 commit | `git log -p` 抽样 + gate 在 CI 上跑一次红/绿 |

## 风险

- 干跑 M1 期间旧库仍在被写(定时 promote)→ 生成器只读旧库,不回写;旧库条目改动推迟到 M2 同轮索引化。
- 主题配色与 `design-system` §2.5(和色六景)重叠 → 以 skill 为规则源、包为实现源,§2.5 只留指针。
- Pages 部署需仓库 public(免费计划)→ 首次推之前必须 gate 全绿。
