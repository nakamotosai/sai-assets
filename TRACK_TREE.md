# TRACK_TREE · sai-assets 里程碑树

> 纵轴 = 交付里程碑;每格 = 该里程碑唯一目标 + 验收证据。**验收以"真被用一次"为准,不以"CI 全绿"为准**(因:本项目上一次失败正是"生产端齐全、消费端为零")。

```
M0 建档拍板 ──► M1 单包打通 ──► M2 存量迁移 ──► M3 自动化 ──► M4 私有侧收口
（法源就位）    （一条真消费）    （27 包落仓）     （无人值守）     （双 SSOT 清零）
```

## M0 · 建档拍板(0.5d)✅ 2026-11-03

| 项 | 证据 |
|---|---|
| 生产根(本地) + `git init` + 门规 | 生产根路径见 README;本文件与 `AGENTS.md` 在仓 |
| ADR-0001(单仓多包 / 全新历史 / 外部只索引) | `docs/adr/adr-0001-*.md` |
| PACK 契约 v1 | `docs/PACK-CONTRACT.md` |
| 白名单(灌什么/不灌什么) | `docs/WHITELIST.md` 27 实体 + 2 索引 + 40 references |
| 登记 | 私有项目台账增行 + 项目本卡 `stage=active`(台账不在本仓) |

## M1 · 单包打通(2-3d)✅ 2026-11-03

唯一目标:**从一个包到一次真消费,通路全绿**。

| 项 | 证据 |
|---|---|
| 包生成器(theme JSON → tokens/css/usage/assert/SKILL) | `scripts/build_pack.py` 对 13 个主题跑通,产出落在 `packs/` |
| 清洗闸 + alias 表 | `scripts/gate.py` 对全仓 0 命中;`schema/alias.json` 收录 12 组 |
| catalog 生成器 | `catalog.json` ≤8KB,含 27 实体 + 2 索引 |
| 展示站 | ✅ `https://assets.ouuut.com`(Cloudflare Pages):卡片跑包内真预览、详情页切视口 + 代码页签 + 四路取用、每包 zip;旧 GitHub Pages 墙退役 |
| 公开仓建立 + 首推 | `nakamotosai/sai-assets` public;首个 tag |
| skill 取用协议 | `sai-frontend\SKILL.md` §1 重写为取用协议;`design-lock.json.assets[]` 口径落地 |
| **真消费一次** | 一个真实项目里 `design-lock.json` 出现 `pack@version` + 断言输出入档 |

## M2 · 存量迁移(3-5d)✅ 2026-11-04

| 项 | 证据 |
|---|---|
| 甲 14 + 字体 2 落仓 | catalog 计数与 WHITELIST 一致 |
| 乙 4(web-fx)+ 丙 6 + 底座 1 落仓 | 每包 `pack.json.verified` 有当日断言输出 |
| references 40 条清路径上墙 | 墙上有 references 入口,浏览器可开 |
| 外部索引 2(gruvbox-theme / mv-studio) | catalog `canonical_home` 非空且可达 |
| 旧库对应条目改索引 | 旧库 `themes/*.json` 与 `demos/<id>` 同轮留索引指针,复扫 0 重复内容 |

## M3 · 自动化(1-2d)✅ 2026-11-04

| 项 | 证据 |
|---|---|
| CI:gate + catalog + 墙重建 | PR 上红/绿可复现 |
| 发布脚本:tag `pack/<id>@<version>` | 一次真发布闭环 |
| harvest 走 PR + 回收链 `derived_from` | 从项目抓一个包 → PR → merge → catalog 更新 |

## M4 · 私有侧收口(0.5d)

| 项 | 证据 |
|---|---|
| Tailscale 站降级为草稿预览 | README 口径更新,不再是唯一入口 |
| 旧私仓 `sai-themelab` 归档、旧库目录化身源 | 远端 archive + 本地只读口径写进旧库 README |
| `mv-studio` 补双远端 | `git remote -v` 两条 + 首推成功 |
| `sai-frontend` / `DESIGN.md` 断链与数字漂移收尾 | 复扫 0 命中;`DESIGN.md` 存根指向真实文件 |
| 收口 | `HANDOFF.md` + `CLOSEOUT.md` + 项目本卡 `stage=paused` |
