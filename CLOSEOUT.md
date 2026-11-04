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
| 旧库 | 本地旧素材库降级为素材源(README/DESIGN 断链修正);`sai-frontend` §1/§1.5 + 9 份 references 口径改为 pack 路径,旧"内网 :18466 / registry.json / 手抄 token"口径清零 |
| 顺手补 | `mv-studio`(Remotion,16 archetype,原零备份)已推私有远端 |

## 迁移中发现并修掉的真问题(都留了痕)

1. **惰性时间戳**:catalog/墙用 `now()` → CI 重建必红;改为取 HEAD 提交日期。
2. **apply 漏拷**:只拷 css/tokens 会让包内断言因缺 `pack.json`/`preview` 必失败;默认改整包拷贝。
3. **CRLF × sha256**:Windows 工作区与 CI 检出算出两个哈希(fx 三包同因);统一"LF 归一后再算"。
4. **规则字面量自伤**:包内断言复刻禁用形态(盘符正则/品牌词)会被自己的闸判红;改为"形态判定归 gate 正本"。
5. **`sanitize.py` 会改写 vendored 源码**:缺 `upstream/**` 跳过,会把 three.js 原文改写坏;已补同口径跳过。
6. **`__pycache__` 折叠常量**:import 自己的断言脚本会把拼装的禁用串折叠进 `.pyc`;断言禁 import 自身,gate 也跳过 `__pycache__`。

## 未完成(明确留给下一步)

- 旧私仓 `sai-themelab` 归档(**已完成**:远端已置 archived=true;Gitea 侧内网不可达,未动)。
- `mv-studio` 的 `canonical_home` 回填(私有仓不宜当公开入口,现为 `null`)。
- 主检出 ref 落后 origin/main 一个 commit(内容逐字节相同;工作区策略禁止在此切换/重置,下次干净时 `git pull` 即快进)。
- 9 个"只有卡片、没有实现产物"的动效(`blur-focus` / `clip-sweep` / `flip-in` / `hard-press` / `ambient-void` / `io-triggered-float-in` / `spotlight-hover` / `fx-mutex-system`;`theme-crossfade` 已并入 `dual-theme-toggle`):要真入库得先补产物,禁空壳。

## 判据复述(为什么这样做)

- 单位是**包**不是类别:上游 54KB 的单包仓(gruvbox-theme)能被用起来,而"库 + 内网网页"几个月只被 2 个项目手抄过 token —— 消费面的形状决定资产活不活。
- **公开不可撤回**:因此"闸门先于提交"、规则分两层(否则规则表本身就是泄漏面)、白名单外一律不灌。
- **不复制第二份真相源**:外部已有本家的(gruvbox-theme / mv-studio)只索引;包进仓后旧库对应条目改索引;共享底座(10 个背景动效的 `engine.js`)合并成一个包。


---

# CLOSEOUT · 展示站(2026-11-04)

## 一句话

资产库有了一个「打开就能看到每件资产实际在跑」的站:**https://assets.ouuut.com**(Cloudflare Pages),加一个包目录就自动上站,每包带活预览、可切视口、代码页签、四路取用与确定性 zip。

## 交付物

| 面 | 结果 | 证据 |
|---|---|---|
| 站点 | `https://assets.ouuut.com`(CF 项目 `sai-assets`,`sai-assets.pages.dev` 同时可用) | 线上 200;目录 29 卡 |
| 页面 | 目录 + 29 详情 + 12 子 demo = 43 页;38 个可看面 | `build_site.py` 输出行 |
| 生成器 | `scripts/build_site.py`(纯标准库,扫 `packs/*/pack.json`,无第二注册表) | `PASS verify: 29 包 · 详情页/预览/zip/子 demo/sitemap 全对 · 零外部子资源` |
| 外壳 | `site/site.css` + `site/site.js`(约 10 KB,零框架);token 与排版刻度构建时取自 `ouuut-editorial` 包 | 探针:对比度违例 0 / ovx 0 / 字号 5 档 |
| 管线 | `site.yml`(push main → 闸 → catalog 校验 → 构建 → wrangler 直传)、`preview.yml`(PR → `pr-<n>` 预览 + 回评) | 多次 push 的 CI 均 success;**加包/删包端到端实测**:临时包上线 30 卡 → 删除回 29 卡,详情页与 zip 同步 404 |
| 旧面退役 | `pages.yml` 删除、GitHub Pages site 已删(旧 URL 404) | `gh api repos/…/pages` → 404 |
| 真相源 | `design-lock.json`(10 条 assertions)、`concept.md`、`direction-approved.json`、`MASTER-CHECKLIST.md`(59 项)、`docs/adr/adr-0002-site-cloudflare-pages.md` | 均在本仓 |

## 站点自身用到的库内资产

站点外壳直接吃 `ouuut-editorial@1.0.0` 的 `css/all.css` + `css/type.css`(构建时拷贝,不做第二份副本)——**站自己就是取用示例**。这也让「默认配色 = 和色六景 纸白/炭黑」的拍板在真实产物上落地一次。

## 过程中真踩到的问题(都留痕)

1. **探针把 `oklab()` 当 RGB 缩放** → 假失败 15 条(对比度读数 2.6)。改成按 oklab→线性 sRGB 正确换算、并逐层合成背景后清零。教训:对比度探针必须先确认颜色空间。
2. **半透明 tint 嵌套** → 卡片里 `--surface` 叠了两三层,浅色文字真掉到 4.05:1。改成不透明 tint(`color-mix(…, var(--bg))`)。
3. **栅格子项 `min-width: auto`** → 代码区 `<pre>` 长行把整页撑出 2055px 横向滚动。加 `min-width: 0`。
4. **WebGL 卡被自动挂载** → 「点运行才建上下文」的设计被 IntersectionObserver 绕过(挂载时会移除 `.run` 按钮)。观察器里显式跳过 `data-heavy`。
5. **`og:image` 指向站根但文件拷进了 `/assets/`** → 线上 404,已改为拷到站根并进 verify。
6. **CF zone 级 Web Analytics 自动注入 beacon** → 自定义域的 HTML 上多一条 `static.cloudflareinsights.com` 请求(`pages.dev` 上没有)。**不自决关掉**:关的是 zone 级开关,会影响同 zone 其他站;已记入 `MASTER-CHECKLIST` D1 与 `design-lock` 的 `edge-injected-beacon` 条。

## 上线后修复(2026-11-04,用户实测反馈)

- **卡片空白**:旧池用 IntersectionObserver 的边沿事件,卸载时只删 iframe 不放回占位,快速滚动后可见卡片会变成空白渐变。改为滚动对账式池(scroll/resize + rAF,回收 ±1.4 屏外、上限 14),卸载一律放回带文案的占位;实测 19 个滚动位置空白块 = 0。缩略区同时改 16:10(同屏多看一档)。
- **gruvbox 去外部化**:内容整体入库 `packs/gruvbox-dark@2.0.0`(css 5 / tokens 12 / preview / docs / SKILL / assert / references),包内断言自跑 PASS(themes=10 absolute=36);旧仓 `nakamotosai/gruvbox-theme` 已归档。仓内只剩 `video-motion` 一个外部索引(Remotion 工程,运行模型不同)。

## 视觉重做(2026-11-04 第二轮,用户令:站本身要高级、极简)

- **方案**:卡片墙退役,改「印刷索引」—— 行是条目(编号/名称+id/一句话/类目/版本),预览改为**悬停右侧浮层**(一次只跑一个 iframe,首屏零 iframe);详情页舞台前置(标题正下方)、控制条上移、舞台宽高双向 fit。
- **参考**:minimal.gallery(大标题 + 零界面)、recent.design / godly.website(作品优先)、reactbits / 21st.dev(详情页代码页签)、Linear/Vercel(近黑底 + 发丝线 + 等宽元数据)。
- **取舍**:不做瀑布流截图墙(丢"跑真预览"卖点)、不做 3D 滚动长镜头(与极简冲突、LCP 不可控)。
- **探针**:1440 / 390 / 500 三档 `ovx = 0`,对比度违例 0,字号 5 档(14/15/17/22/hero),首页 iframe 初始 0 / 悬停 1,`class=card` 残留 0,`html.js` 兜底 + `@media print` 可见。
- **修掉**:舞台 iframe 相对路径在 detail 两层深度下 404(现在按 `up` 前缀生成);`.reveal` 无 JS 时整页不可见。

## ouuut.com 入索引(2026-11-04 第三轮)

- 新增 `sites` 类目(线上作品)与顶层 `preview_url`:站点型条目无本地预览,浮层/舞台直接嵌本家;`packs/ouuut-com` 为第一条(索引 01)。
- 动画与其它条目同一套(行入场 / 浮层过渡 / hover 位移);外部条目箭头 ↗、不出 zip。
- 顺手修:包内 `@font-face` 补 `font-display: swap` → `ouuut-editorial` 升 1.0.1(断言重跑 PASS)。

## catalog 派生化(2026-11-04 第四轮)

用户问「以后传新东西会不会自动更新」时验证出的唯一人工依赖:新增包/改 `version`·`when` 时 `catalog.json` 过期 → 旧 CI 直接红、不部署。现改为 CI 重建 + bot 回提交,裸上传(含 GitHub 网页拖文件)也能上站;真会拦下不部署的只剩 `gate.py` 与 `build_site.py verify()`。见 `MASTER-CHECKLIST` E9。

## 未完成(明确留档)

- **体检工具口径**:`web_audit.py` 未实现 `exclude`/`scan_roots`,会把 `dist/packs/**`(400+ 个被嵌的预览页)当站点页面判 canonical/meta,且把 `<title>` 文本误判为资源引用;本轮据实记录为「红项不适用」,未刷绿。修这一条要动 harness 侧工具,不在本仓范围。
- `MASTER-CHECKLIST.md` 未勾 5 项:C3(社交卡平台实测)、D3(Search Console/Bing 验证)、E8(Lighthouse 移动端基线)、G3(Uptime Kuma 监控项)、J6(发布后 24h/首周巡检)。都不阻断首发。
- 展示站的 `mv-studio` / `gruvbox-dark` / `video-motion` 三个外部索引包只有降级卡(内容在本家),没有活预览 —— 这是设计选择,不是缺口。
- 账本比对撞 1/8(与 `jewelry-site-lab` 色板距离 0.026):刻意接受(默认配色是用户拍板),理由写在 `concept.md` 与 `direction-approved.json`。
