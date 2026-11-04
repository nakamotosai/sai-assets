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

## 2026-11-04 · M2 完成(29 包全绿)

四个分身并行交付,收口后一次全仓验证:

| 类目 | 包 |
|---|---|
| themes | 14(13 实体 + gruvbox-dark 外部索引) |
| fonts | 2(cjk-thin-type-system / cjk-typography) |
| web-fx | 4(bg-fx 10 效果共享引擎 / page-transition 3 / particle-fx 6 / three-fx 2) |
| web-ui | 6(dual-theme-toggle / slide-master-senior / spectral-glass-prism / libraries-dev-fx / nav-rail-marquee / swiss-style) |
| fx-engines | 1(粒子引擎 + 悬浮调参板底座) |
| references | 1(40 条观测) |
| video-motion | 1(索引项,不承载内容) |

- 闸:`PASS gate: 0 findings, 29 packs, 27 assertions`;catalog 6698B ≤ 8KB(发现索引);墙 29 卡。
- CI 从两个 workflow 变成"三个真问题都抓到"的现场:①惰性时间戳(改取 HEAD 提交日期)②`apply.py` 漏拷 pack.json/preview(包内断言必失败)③**CRLF 工作区 vs LF 检出导致 `versions.json` 的 sha256 两值**(三包同因,改 LF 归一后再哈希)。
- 共享引擎去重:bg-fx 的 10 份 `engine.js` 合成 1 份;param-panel 以"带版本号的拷贝"分发(断言查版本 + LF 归一 sha256),堵住旧库"被拷 12 份后漂移"的坑。
- 视觉:32 张 1440px 截图,除三个包的 WebGL 降级路径外 0 控制台报错;本机 ego 窗口 `getContext('webgl2')` 为 null,包内已做**显式环境闸**(可见说明、不假渲染),有 GPU 的环境为真画面(bg-fx 截图已证).
- 待办口径:三方 vendored three.js 各包自带的决定记在 `docs/PACK-CONTRACT.md §7`。

## 2026-11-04 · M3 关键一环跑通(真 PR)+ 收口文书

- **PR #1 真跑**:`minimalist-essential` 补活预览(此前唯一 `files.preview=null` 的主题)+ 抬版本 1.0.1 → 分支 → 闸 → CI 绿 → squash 合并 → tag `pack/minimalist-essential@1.0.1`。回收链(harvest → gate → PR → tag)不再是纸面流程。
- 收口文书:`HANDOFF.md`(接手六节:状态/约定/命令/缺口/文件位置)+ `CLOSEOUT.md`(交付物 + 迁移中修掉的 6 个真问题 + 未完成清单)。
- 迁移中真问题全部留痕(惰性时间戳 / apply 漏拷 / CRLF×sha256 / 断言复刻规则自伤 / sanitize 改写 vendored / __pycache__ 折叠常量),见 CLOSEOUT §迁移中发现。

## 2026-11-04 · 展示站上线 Cloudflare Pages(assets.ouuut.com)

- **新建站点生成器** `scripts/build_site.py`(纯标准库):扫 `packs/*/pack.json` → `dist/`
  (目录 + 29 详情页 + 12 子 demo 页 + 每包确定性 zip + sitemap/robots/llms/_headers/404/app.json/og.png)。
  自带 `verify()`:包数 = 卡片数、详情页齐、预览文件在、zip 内含 pack.json、子 demo 页在、sitemap URL 数对得上、零外链子资源 —— 任一不符即非零退出,**CI 里等于不部署坏产物**。
- **站点外壳零框架零外链** `site/site.css` + `site/site.js`(约 10KB):token 与排版刻度在构建时从库内 `ouuut-editorial` 包直接拷来(站自己就是取用示例);卡片跑包内真实 `preview/index.html`,IntersectionObserver 懒挂 + 并发上限 8 + 视口外卸载,WebGL 类点「运行预览」才建上下文;深浅切换用 `sai-assets-theme`(避开预览里的 `theme` 键)。
- **部署** `site.yml`:push main → 闸 → 重建 catalog 校验 → 构建 → `wrangler pages deploy`;`preview.yml`:PR → `pr-<n>` 预览环境 + 回评地址。退役 `pages.yml` 并删除仓库 Pages(单一部署面)。
- **域名** CF 项目 `sai-assets` + `assets.ouuut.com`(CNAME 手建,自动证书);线上实测:目录 200 且 29 卡、详情/子 demo/zip/css/js/robots/sitemap/llms 全 200,`sai-assets.pages.dev` 同时可用。
- **验收口径落锁** `design-lock.json`(10 条 assertions)+ `concept.md` + `direction-approved.json` + `MASTER-CHECKLIST.md`(59 项裁剪版)+ `docs/adr/adr-0002-site-cloudflare-pages.md`。
- **探针实测**(ego lite,`.private/ego/round-06…10.mjs`):对比度违例 0(深浅两模 × 目录/详情/代码区)、`scrollWidth-clientWidth = 0`(1440/500/390)、字号 5 档且最小 14px、外链子资源 0、pageerror 0;截图 `.private/shots/final-*.png`。
- 过程中探针自己踩的两个坑(记一笔):把 `oklab()` 当 RGB 缩放算对比度 → 假失败 15 条;色卡底色用 `--surface` 半透明叠加到 ~20% → 浅色文字真掉到 4.05:1(已改不透明 tint)。
- **待补**:C3 社交卡实测 / D3 Search Console / E8 Lighthouse 基线 / G3 Uptime Kuma 监控项 —— 见 `MASTER-CHECKLIST.md` 的未勾项。

## 2026-11-04 · 自动导入管线端到端验证

- **加包即上站**:临时包 `packs/zz-smoke-test/` → push → CI(site)构建 → 线上目录 **30 卡**、详情页标题正确、`/downloads/zz-smoke-test.zip` 200(2124B)、`app.json` 收录 → 删除该包再 push → 回到 **29 卡**、详情页与 zip 均 404。两条方向都实测过。
- **闸真的会拦**:第一次推冒烟包时忘了重建 `catalog.json`,site workflow 直接红在「catalog 新鲜度」这一步,**没有部署**;错误信息就是"请本地重建后提交"。这就是设计意图,不是故障。
- 文档补齐:README「加一个包(自动上站)」三步;HANDOFF 关键约定表同一行(漏了 ① 会被 CI 拦)。
- PR 预览环境:另开 `smoke/preview-test` 分支 + PR #2 验证 `preview.yml`(构建 → `pr-2` 预览别名 → 回评),验证后关闭并删分支。

## 2026-11-04 · ouuut.com 入索引 + 本轮收口

- **新增 sites 类目**(schema + catalog + 站内 chip「作品」):`packs/ouuut-com` 把 ouuut.com 作为**线上作品条目**入索引,内容不复制进仓。
- **新增顶层 `preview_url`**(schema):站点型条目没有本地预览页,浮层与舞台直接嵌本家 https 地址;该站响应无 `X-Frame-Options`、无 CSP `frame-ancestors`,已验证可嵌。
- **动画与其它条目完全一致**:同一 `.row` / `.reveal` 入场 / 同一浮层过渡;外部条目箭头显示 ↗,不出 zip。
- 顺手:`ouuut-editorial` 的 `css/type.css` @font-face 补 `font-display: swap` → 包版本 **1.0.0 → 1.0.1**(包内断言重跑 PASS)。
- 线上实测:30 条索引、ouuut-com 详情页 200、`app.json` counts={packs:30,surfaces:39}、悬停浮层 src=https://ouuut.com/(545×341)、首页初始 iframe 数 = 0。
- 体检(`web_audit.py report`):exit 1;适用项 S2/S3/S4/S5/S7/D4/Z2/A4 通过,红项与「未跑」集中在两类 —— ①`dist/packs/**` 的 400+ 个预览页被当成站点页面(它们是**资产内容**,不是本站页面);②单语站不适用的 i18n 组。**工具未实现 `exclude`/`scan_roots`**,本轮据实记录、不刷绿;尾巴见 CLOSEOUT。

## 2026-11-04 · catalog 派生化(裸上传也能自动上站)

回答「以后往库里传新东西,站会自动更新吗」时测出的一处人工依赖:原来 `site.yml` 用 `git diff --exit-code -- catalog.json` 把关 —— **只要 `packs/` 有新增(或改 `version`/`when`),忘了跑 `build_catalog.py` 就会 CI 红、不部署**。改成 CI 自己重建 + bot 回提交:

- `site.yml`:`permissions: contents: write` → 重建 `catalog.json` → 有差异就 `github-actions[bot]` 提交并 `git push origin HEAD:main` → 再构建部署(同一 run 里用的是重建后的 catalog)。GITHUB_TOKEN 推出的提交不会再触发工作流,天然无回环。
- `preview.yml`:构建前也 `build_catalog.py`(不提交),PR 预览里的 `catalog.json` 不再可能落后于分支内容。
- 本地实测裸上传路径:只丢 `packs/upload-smoke/` 不重建 catalog → `build_site` 出 **31 条索引 + 详情页 + app.json=31**,但 `dist/catalog.json` 仍是 30 条(机器目录与站点不一致)—— 这正是原来 CI 要拦的状态;删包重建后回到 30。
- 线上自测(全在线上跑真包):
  - **裸上传**:`04bf49d` 只丢 `packs/upload-smoke/`、catalog 停在 30 → site.yml 绿 + bot 补 `c4966cf` → 线上 31 条索引、`/p/upload-smoke/` 200、线上 catalog 31 条含该包、app.json 31。
  - **删除**:`67308a7` 只删目录、catalog 不重建 → bot 补 `da7960d` → 线上回 30、该详情页 404。
  - **改 catalog 本身**:29 条 → bot 补 `d7d3d8b` 回 30 含 `ouuut-com`。
  - 三次 bot 推送均未触发第二个 run(无回环);写权限靠工作流 `permissions: contents: write` 提权(仓库默认是 read)。
- 结论口径:**改包内容/pack.json 之外的任何文件 = 直接传就上站;新增包或改 `version`/`when` = 以前必须跑 `build_catalog`,现在 CI 兜底**。

## 2026-11-04 · 从 make.ouuut.com 拆件入库(3 包)

用户要求把另一条线正在做的 `https://make.ouuut.com/`(源码在工作目录 `make-site`)"各个零件拆出来"复用。先做只读侦察(一个 scout 全量清点 + 我读动效层与 CSS),对照既有 30 包划出三处真空位,再收三包:

- **motion-kit**(web-fx,kind fx)← `assets/css/motion.css` + `assets/js/motion.js`(两文件 38.9KB)。十四个模块,每个只在页面上存在对应标记时启动:入场(位移+模糊)、逐字上浮、错峰、计数、倾斜+指针光斑、磁吸、自定义光标+上下文标签、首屏 2D 粒子场+指针光、过程轨道、图片漂移、顶部进度线、导航当前段、FAQ 高度折叠、明暗切换的 View Transition 圆形揭示。**两处本包增补**(源站没有,已写进 SKILL/usage 并在源码里注释):`data-split="chars"` 逐字切 + 禁则粘标点 —— 源站是英文站,空白切词对中文标题只会切出一个 token。脚本里两个主题钩子改成中性命名空间 `window.motionKit.applyTheme / viewTheme`。
- **token-harbor**(themes,kind theme)← `assets/css/site.css`(1025 行)。按契约拆成 tokens/absolute.json(38 色 + 6 影)+ tokens/index.json + tokens/semantic/{dark,light}.json(32 条 × 2)+ css/default.css(暗色默认 + 全套构件 38KB)+ css/themes.css(只出两个 [data-theme] 作用域)。实测对比度:近黑 ink/bg 14.78:1、muted/bg 6.34:1;暖白 16.66:1 / 5.02:1。与源表 6 处归一化差异(无引用的 accent-fg/bg 与 border 折叠、chrome 分隔线改 --line、主按钮文字统一 --on-accent、主推卡删掉 light 覆盖、去 @font-face 自托管字体、8 位 hex 折 rgba)全部写进 docs。
- **locale-router**(web-ui,kind ui)← `assets/js/lang.js` + `.lang-switch` 段。改写成配置化零件(四规则逐条保留:参数优先/深链保留/根路径单次重定向/爬虫放行),决策层抽成纯函数 `decide()` 可用 Node 单测;预览 `dryRun:true` 保证加载与点击都不跳转。命中区桌面 32px、`@media (pointer: coarse)` 自动抬到 44px(我加的)。

**没拆的(明确留档)**:`build.py` + `templates/` + `content.json`(三语生成器)、`tools/check_build.py`、`tools/deploy.py`(原子替换 + nginx)、`deploy/analytics_api.py`(第一方无 cookie 事件汇)—— 都是站点绑定或基建:硬编码 host/域名/本机凭据路径、断言与当前内容强耦合、仓内无 requirements/manifest,且 `fx-engines` 是"动效引擎"、没有装"生成器/服务"的类目。表单状态机(原生校验 + 蜜罐 + 状态文案)与主题包重叠,列为候选。

验收:三包各自断言 PASS(31 assertions 全绿);`gate.py` 0 findings / 33 packs;`build_site.py` PASS 33 包 · 42 可看面 · 47 页 · 568 文件;浏览器实测 motion-kit 预览(js-motion/motion-ready 正常、16 个入场元素、逐字 17 字、计数到 10/0/2/60、倾斜 --rx/--ry、磁吸 ±7px、光标标签、进度线、折叠、footer 跑马灯);**降级实测**:摘掉 js-motion/motion-ready 后 16 个入场元素与 17 个字全部可见、进度线/画布/光标 display:none;token-harbor 画廊两模切换实测(暗/亮各截,亮色 body #f7f6f2 + ink #17170f);locale-router 点开关只换 aria-current、URL 不变。站点侧:33 行索引、悬停新行浮层跑包内预览、三张详情页舞台 src 指向包内 preview。

## 2026-11-04 · 旧主题库收口 + 回收链真跑(param-panel)

用户问三件事:旧库退役了吗 / 从 omp 里移除了吗 / 入库→前端 skill 自动调用闭环了吗。查完三件都不彻底,全部修掉:

**A 旧库运行时退役**(日区主机):`theme-lab.service`(只为内网草稿预览、绑定 tailnet 地址的旧预览墙)原为 enabled+active → `disable --now`,墙目录与 unit 归档进该机归档目录;`housekeeper_heartbeat.py` 里每小时 SSH 回本机跑「旧库 promote + 漂移 deploy」的两条窄边 chore(常量块 + 两个函数 + 调用点 + docstring 段)整段摘除,`py_compile` + `--dry-run` 实跑通过、输出里再无旧库字样;private 双仓(Gitea + GitHub)此前已归档 ✓。

**B 旧口径清出 omp / Claude / 两台 vps**:真正的问题不在「有没有提旧库」,而在「还有没有 *指令* 指向它」。修了 7 处:
- `sai-frontend references/design-gates.md §7` 的**入库腿**(两侧共用文件):原文是「原子可直接写对应目录 + 更新 `catalog.json` / 含 demo 走 harvest → sanitize → gate → PR」——那是旧库的四类目录口径;改成公开包仓三步(harvest 参数全列 + 包内断言 + build_catalog + gate + PR)、主题必带 `accept`、消费后写项目 `design-lock.json.assets[]`。
- `sai-closeout` 条件档 ③(omp + Claude 两侧):原写「回写本机旧素材库 + 更新 `registry.json`」→ 改为入库到本公开包仓并报 pack id + PR 链接,明写旧库已退役禁再回写。
- 两台 vps 的 `sai-frontend/SKILL.md`:都是旧 Windows 版的陈旧副本(`0` 处 `sai-assets`,§1 仍指本机旧库目录 + 内网预览端口,§7 入库腿仍写 `registry.json`)。整块 §1/§1.5 换成公开库取用协议(vps 版 clone 到家目录),§7 入库腿同上改;顺手把两台的 `SKILL.md.bak-20261019-*` 墓碑收进归档;并在两台 clone 了公开仓,`apply.py --list` 实跑通过 —— 取用腿在 vps 上也能走。
- 校验:三台复扫,残留仅剩「出处/进化账」的历史记录行(非指令),已逐条说明。

**C 回收链真跑一次**(README 里挂了很久的 "待跑一次真 PR"):从旧库 `components/param-panel/` 收 **`param-panel`** 包(web-ui)。harvest → 人工补 SKILL/README/usage/assert → 包内断言 → `build_catalog` → `gate 0 findings` → 分支 PR #3 → PR 预览环境 → CI 全绿 → 合并 → 线上 34 包 · 43 可看面。入包时修 4 处:前缀 `tl-`→`pp-`、localStorage 去旧库前缀、删 `.prev.*`、**修 `shouldMountLabPanel()` 路径判定**(原只认 `*.preview.html`;本仓预览是 `preview/index.html`,站点卡片 iframe 与静态服务器两种落法都挂不上板 → 现四态命中、三反例不中,断言里用 Python 复算该正则)。真机:三态挂载、三栏切换、6 个控件即时驱动卡片、色板跨刷新保留、收起 56×56、Tab 焦点环、console 0 报错。

**闸的一次反咬(如实记)**:新断言里为检测旧库残留写了盘符字面量 → CI 的 banned 规则当场命中(「检查规则自己成为被禁形态的载体」),改成拆字拼接;而本地仓级闸此前报绿是因为那次跑闸时该文件还没 `git add`(闸只扫跟踪文件),漏扫。教训:**改断言后必须 `git add -A` 再跑闸**。
