# HANDOFF · sai-assets

> 接手先读:`README.md`(状态与取用)→ `TRACK_TREE.md`(里程碑)→ `progress.md`(流水)→ 本文件(接手要点)。
> 真相源:`github.com/nakamotosai/sai-assets`(公开,唯一对外面)。

## 1 现在是什么状态(2026-11-04)

- **M0/M1/M2 全部完成**,M3 除"真 PR 回收链"已跑通(PR #1 已 squash 合并),M4 只剩旧私仓归档与最终收尾。
- 仓内 **29 个包**、闸全绿(`PASS gate: 0 findings, 29 packs, 27 assertions`)、`catalog.json` 6698B ≤ 8KB、展示站 **https://assets.ouuut.com** 29 卡(38 个可看面)。
- 三个 CI workflow:`gate.yml`(公开内容闸 + 断言)、`site.yml`(闸 → 重建 catalog → `build_site.py` 构建自检 → `wrangler pages deploy`)、`preview.yml`(PR → `pr-<n>` 预览环境 + 回评地址)。旧 `pages.yml` 已退役,GitHub Pages 已下线。
- 已发布 tag:`pack/ouuut-editorial@1.0.0`、`pack/minimalist-essential@1.0.1`。

## 2 关键约定(别踩)

| 主题 | 约定 |
|---|---|
| 提交前 | **先 `git add -A` 再 `python scripts/gate.py`**——闸只扫 git 跟踪文件,未 add 的新文件不在扫描面 |
| 站点 | `scripts/build_site.py` 扫 `packs/*/pack.json` 出 `dist/`(详情页/子 demo/zip/sitemap/llms/_headers),自带 `verify()`:任一不符即构建失败。CF 项目 `sai-assets`,域 `assets.ouuut.com`。 |
| 规则 | 禁用形态的**字面量只有一份**在公开层 `schema/banned.json`;内部标识在本地 `.private/banned.local.json`(gitignore)。**包内断言不许复刻规则**(源码里出现该形态即被判自伤) |
| 行尾 | 仓内统一 LF(`.gitattributes`)。**任何 sha256 必须"LF 归一后再算"**,否则 Windows 工作区(CRLF)与 CI 检出(LF)会算出两个值 |
| 版本 | 包级 `pack.json.version`,只增不改;`versions.json` 若记录文件哈希,改文件必须同轮重算 |
| apply | `scripts/apply.py` 默认**整包拷贝**(含 pack.json/preview);`--minimal` 只拷产物子集 |
| vendored 依赖 | 每包自带,不做仓级共享池(契约 §7);保留 SPDX/许可头 + `attribution` 登记 |

## 3 常用命令

```bash
git add -A && python scripts/gate.py                      # 公开内容闸(必须绿)
python scripts/build_catalog.py && python scripts/build_site.py   # 重建目录 + 站点(产物 dist/,自带 verify)
python -m http.server 8791 --directory dist                       # 本地看站点
python scripts/release.py <id> --push                     # 打 tag(内部先跑闸)
python scripts/apply.py <id> --to <dir>                   # 拷进项目 + 打印 design-lock 片段
python scripts/harvest.py <id> --from <src> --kind fx --category web-fx \
    --when "…" --not-for "…" --license MIT --entry index.html --usage <文档>   # 收新包
```

## 4 已知缺口 / 未做完

1. **旧私仓 `nakamotosai/sai-themelab`(private)未归档**:本地旧素材库已降级为素材源,远端还开着(现已归档);
2. **本地的 Remotion 视频工程(mv-studio)**:已补私有远端 `nakamotosai/mv-studio`,但**尚未在 catalog 里回填 `canonical_home`**(private 仓不宜当公开入口,现为 `null` + 说明)。
3. **WebGL 预览的环境依赖**:本机 ego 窗口 `getContext('webgl2')` 为 null;`bg-fx` / `three-fx` / `page-transition(text-three)` / `particle-fx(void-audio)` 已做**显式环境闸**(可见说明、不假渲染)。真画面需有 GPU 的浏览器(bg-fx 的截图已证)。
4. **主检出(shared checkout)落后 origin/main 一个 commit**:工作树内容与 `origin/main` 逐字节相同,只是 ref 停在 `20f57e5`(工作区策略禁止在此切换/重置/暂存)。下次干净状态下 `git pull` 即快进。
5. `demos/` 里被排除的 10 项(第三方品牌/媒体内容)与 9 个"卡片-only 无产物"的动效:留在旧库,不进公开仓。

## 5 相关文件在哪

| 面 | 位置 |
|---|---|
| 公开资产(唯一对外) | 本仓(GitHub) |
| 素材 / 草稿(私有,本地) | 旧素材库(已降级;含未公开原子与待清理件,路径不入仓) |
| 私有规则补充表 | `.private/banned.local.json`(gitignore) |
| 设计规则(harness 级) | `skill://sai-frontend` §1(取用协议)、`skill://design-system`、`sai-frontend/references/` |
| 消费记录 | 各项目 `design-lock.json.assets[]` |
