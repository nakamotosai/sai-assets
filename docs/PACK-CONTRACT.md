# PACK-CONTRACT v1 · 资产包契约

> 一个包 = 一个**可克隆、可抄走、可被 agent 直接读懂**的自洽单元。参考实现:`packs/gruvbox-dark/`(2026-11-04 从 `gruvbox-theme` 整体并入,54KB 单包成品;本契约是它的泛化)。

## 1 目录形状

```
packs/<id>/
  pack.json                  # 机器元数据(见 §2),schema 校验
  SKILL.md                   # agent 入口:何时用 / 何时不用 / 默认 / 文件表 / apply 步骤 / 硬规则
  README.md                  # 人读入口(首屏 12 行讲清是什么、贴一张预览)
  tokens/
    absolute.json            # 该包的原色表(色板原子,不许近似值)
    index.json               # 变体目录 + default
    semantic/<variant>.json  # 每个变体的语义映射(bg/surface/ink/accent/...)
  css/
    default.css              # 只含默认变体,最快 apply
    all.css                  # 全部变体 + 基础 chrome
  docs/usage.md              # **配对规则**:谁配谁、什么时候用、反模式(中文)
  scripts/assert_tokens.py   # 断言:锚点色、必填语义键、文档必备小节、产物存在
  preview/index.html         # 活预览(无则 pack.json.preview = null 并在 README 说明)
  src/                       # 仅 fx / ui 包:可直接引用的 js/css 模块
  upstream/                  # 仅第三方 vendored 文件:保留原始 SPDX 头 + attribution 登记
```

`kind` 决定哪些子目录必填:

| kind | 必填产物 | 说明 |
|---|---|---|
| `theme` | `tokens/` + `css/` + `docs/usage.md` + `scripts/assert_tokens.py` | 配色 + 字体 + 配对规则;`css/` 必含 `default.css(含 :root,单主题直用)` 与 `themes.css(只出 [data-theme] 作用域,多主题并存)` |
| `fonts` | `docs/usage.md` + `tokens/`(字号/字距档) | 排版配方,无主题色 |
| `fx` | `src/` + `preview/index.html` + `docs/usage.md` | 动效,含 apply 片段与性能口径 |
| `ui` | `src/` + `preview/index.html` + `docs/usage.md` | 组件 |
| `meta` | `docs/` | 根级规则(`catalog` 里作 reference 条目,不占包位) |

## 2 `pack.json` 字段(必填 = 缺则 gate 失败)

```json
{
  "schema": 1,
  "id": "paper-editorial",
  "title": "Paper Editorial · 纸媒社论",
  "kind": "theme",
  "category": "themes",
  "version": "1.0.0",
  "license": "MIT",
  "attribution": [
    { "name": "morhetz/gruvbox", "url": "https://github.com/morhetz/gruvbox", "license": "MIT/X11", "what": "原色板来源" }
  ],
  "origin": { "project": "sai-homepage", "path": "demos/paper-editorial", "derived_from": null },
  "entry": "SKILL.md",
  "files": {
    "tokens": ["tokens/absolute.json", "tokens/index.json", "tokens/semantic/paper-editorial.json"],
    "css": ["css/default.css", "css/all.css"],
    "usage": "docs/usage.md",
    "assert": "scripts/assert_tokens.py",
    "preview": "preview/index.html"
  },
  "tags": ["editorial", "paper", "serif", "light"],
  "when": "纸媒/长文/新闻类站点,需要纸白底 + 衬线正文 + 弱强调",
  "not_for": "夜间工具面板、霓虹/赛博风格",
  "default_variant": "paper-editorial",
  "verified": { "date": "2026-11-03", "how": "python scripts/assert_tokens.py", "evidence": "PASS assert_tokens" },
  "canonical_home": null
}
```

规则:

- `origin.path` **必须是相对路径**(旧库内的相对位置),绝对路径是硬闸失败项。
- `license` 必填;`MIT` / `CC0-1.0` 用于自产;上游素材写各自的许可(如 `OFL-1.1`),并在 `upstream/` 保留许可原文。
- `canonical_home` 非空 = **外部包索引**(内容不在本仓,`entry` 指向外部),此时本仓只留 `pack.json` + 一页说明。
- `verified` 必填:包必须在当前机器上跑过一次断言并把输出贴进 `evidence`;禁"看起来没问题"。

## 3 取用(消费侧三条通道)

| 通道 | 命令 | 适用 |
|---|---|---|
| agent / 人 | `git clone --depth 1 https://github.com/nakamotosai/sai-assets.git` → 读 `catalog.json`(**发现索引**,≤8KB:只有 id/version/一句话/path)→ 进 `packs/<id>/pack.json` 与 `SKILL.md` | 首次、通用 |
| 项目(拷贝式) | `python scripts/apply.py <id> --to <target-dir>` **默认整包拷贝**(含 `pack.json` 与 `preview/`,包内断言才能在项目里自证);`--minimal` 只拷产物子集 | 把资产抄进项目,**无运行时依赖** |
| 零安装单文件 | `https://cdn.jsdelivr.net/gh/nakamotosai/sai-assets@<tag>/packs/<id>/css/default.css` | 需要固定版本的单文件 |

消费后**必须**在项目 `design-lock.json` 记一行(`assets[]`),见 `docs/USAGE-INTEGRATION.md`。

## 4 版本与发布

- 版本粒度 = **包级** `pack.json.version`,不是整仓 semver。
- 发布 = `git tag "pack/<id>@<version>"` + push tag(+ M3 起由 CI 生成 release note 与 catalog 重建)。
- 包内容一经发布即**只增不改**:行为改动 → 抬版本;颜色/接口微调 → patch;新增变体 → minor;删变体或改默认 → major。

## 5 断言要求(最低集)

`scripts/assert_tokens.py` 必须至少校验:

1. 锚点色与原色表一致(防"顺手改一个 hex");
2. 每个变体的语义键齐全(`bg` `surface` `ink` `accent` `on-accent` `link` `red` `green`);
3. 所有色值为 6 位 hex 或合法 `rgba()`;
4. 产物文件存在(`css/`、`tokens/`、`SKILL.md`、`docs/usage.md`);
5. `docs/usage.md` 含配对小节与反模式小节;
6. 对比度分两档(依据 `skill://design-system` §2.5 的实测数学:同一色值同时适配黑白时 4.5:1 不可能,只能落在 Y 0.112–0.265 的 3:1 带):
   - **文字档**:正文 `ink` on `bg` ≥ 4.5:1;`muted` on `bg` ≥ 4.5:1;`accent-ink`(同色相提亮/压暗一档)on `bg` ≥ 4.5:1 —— 小字必须用 `--accent-ink`,不许用 `--accent`。
   - **图形档**:每个强调色 on **深色底** ≥ 4.5:1、on **浅色底** ≥ 3:1;每个强调色相对亮度 Y 落在 [0.15, 0.25](保证两模都能用)。
   断言须把这两档都跑出来并打印实测值。

## 6 闭环(harvest → gate → PR → tag → 消费)

| 阶段 | 入口 | 硬要求 |
|---|---|---|
| 收 | `python scripts/harvest.py <id> --from <src-dir> --kind … --when … --not-for … --license … --entry … (--usage <已有文档> \| --gen-assert)` | `--when/--not-for/--license` 必填、`--usage` 必须指向已存在的文档 —— **harvest 不写散文、不写占位**;收完自动 sanitize + 仓级闸,本包有命中即非零退出 |
| 闸 | `git add -A && python scripts/gate.py` | 只扫跟踪文件;`0 findings` 才算过 |
| 发布 | `python scripts/release.py <id> [--push]` | 打 tag 前强制 gate 绿;tag 名 `pack/<id>@<version>`;外部包跳过 |
| 消费 | `apply.py` / raw URL / clone | 消费后项目 `design-lock.json.assets[]` 记 `pack`/`version`/`sha` |
| 回收 | 项目里改好的资产回 harvest → PR | 禁在公开仓之外留第二份副本 |

## 7 第三方 vendored 依赖的口径(2026-11-03 拍板)

- **每个包自带自己的 vendored 依赖**(如 `three-fx/upstream/three.module.js`),**不做仓级共享 `upstream/` 池**。
  理由:包要能被 `apply.py` 整包抄进项目、也要能被 raw/jsDelivr 单包取用;共享池会让"单包"不再自洽。
- 代价已知:同一个 `three.module.js` 在多个包里各一份(当前 3 份 ≈ 3.9MB)。体积可接受,换取自洽与零安装取用。
- 硬约束:vendored 文件**必须保留原始许可头**(`@license` / `Copyright` / `SPDX-License-Identifier`),并在 `pack.json.attribution` 登记 name/url/license;`gate.py` 默认整块跳过 `packs/*/upstream/**`(需要时用 `--scan-upstream` 解开),`sanitize.py` 同口径跳过。
