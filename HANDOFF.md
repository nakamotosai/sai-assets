# HANDOFF · sai-assets

> 接手先读:`README.md`(状态与取用)→ `TRACK_TREE.md`(里程碑)→ `progress.md`(流水)→ 本文件(接手要点)。
> 真相源:`github.com/nakamotosai/sai-assets`(公开,唯一对外面)。

## 1 现在是什么状态(2026-11-04)

- **M0–M4 全部完成**:harvest → gate → PR → tag → 上站 的回收链已真跑一次(PR #3 `param-panel`);旧主题库两头(私仓归档 + 运行时退役)都已收口。
- 仓内 **34 个包**(33 个资产包 + 1 个线上作品条目 `ouuut-com`)、闸全绿(`PASS gate: 0 findings, 34 packs, 32 assertions`)、`catalog.json` 7722B ≤ 8KB、展示站 **https://assets.ouuut.com** 34 条索引(43 个可看面;索引式版式,悬停出右侧活预览)。
- 2026-11-04 再有 1 包入仓:**param-panel**(web-ui,悬浮调参板)从旧主题库 `components/param-panel/` 收来 —— 旧库时代它被手抄出 12 份副本并漂移,入包即为终结手抄;入包时修了一处真 bug(`shouldMountLabPanel()` 原判定只认 `*.preview.html`,而本仓预览是 `preview/index.html`,站点卡片 iframe 与静态服务器两种落法都挂不上板)。
- 2026-11-04 新并入 3 包,全部来自自家成品站 `https://make.ouuut.com/`(源站(本机另一个工作目录)仍在迭代,包是当时的快照):**motion-kit**(web-fx,动效层十模块:入场/逐字/错峰/计数/倾斜/磁吸/光标/首屏粒子场/轨道/漂移/进度线/当前段/折叠/VT 过场)、**token-harbor**(themes,Token Harbor 墨色双模设计语言,32 条语义 token × 2 模 + 全套构件)、**locale-router**(web-ui,四规则语言路由 + 三态语言开关)。
- 三个 CI workflow:`gate.yml`(公开内容闸 + 断言)、`site.yml`(闸 → 重建 catalog → `build_site.py` 构建自检 → `wrangler pages deploy`)、`preview.yml`(PR → `pr-<n>` 预览环境 + 回评地址)。旧 `pages.yml` 已退役,GitHub Pages 已下线。
- 已发布 tag:`pack/ouuut-editorial@1.0.1`、`pack/minimalist-essential@1.0.1`、`pack/gruvbox-dark@2.0.0`、`pack/motion-kit@1.0.0`、`pack/token-harbor@1.0.0`、`pack/locale-router@1.0.0`。

## 2 关键约定(别踩)

| 主题 | 约定 |
|---|---|
| 提交前 | **先 `git add -A` 再 `python scripts/gate.py`**——闸只扫 git 跟踪文件,未 add 的新文件不在扫描面 |
| 加一个包(自动上站)三步 | ① `python scripts/build_catalog.py` ② `python scripts/build_site.py` ③ `git add -A && python scripts/gate.py` 然后 push。**漏了 ①,CI 的 catalog 新鲜度闸会红、不部署**(错误信息就是叫你跑这条命令) |
| 站点 | `scripts/build_site.py` 扫 `packs/*/pack.json` 出 `dist/`。**版式 = 印刷索引**:首页 30 条索引行(无卡片),悬停/聚焦某行右侧浮层跑该包真预览(一次一个 iframe,≥1100px 才出);详情页舞台在标题正下方,宽高双向 fit + 居中。构建自带 `verify()`(行数/详情页/预览/zip/子 demo/sitemap/零外链),任一不符即失败。CF 项目 `sai-assets`,域 `assets.ouuut.com`。 |
| 往包里加文件 | 记得同时登记进该包 `pack.json` 的 `files`(tokens/css/src/usage…):闸是**单向**校验(声明了却不存在 → 红),反方向不拦 —— 实测未登记的文件**照样进 zip 与详情页清单**,只是 `apply.py` 取用时看不到它 |
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
