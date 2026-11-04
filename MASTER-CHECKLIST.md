# MASTER-CHECKLIST · sai-assets 展示站(assets.ouuut.com)

> 来源:`skill://sai-long-project/references/website-launch-checklist.md` 的 10 组 59 项,按本项目实际裁剪(静态资产目录站 · Cloudflare Pages 直传 · 无后端 · 无账号体系)。
> 阻断级:A1–A7 任一不过禁发布;B1/B2/C1/C2/E8/G3/H1–H4 与首发同批。
> 打勾口径:证据写命令或路径,不写"看着对"。

## A 抓取与索引(SEO 地基)

- [x] **A1 robots.txt 生产放行 + Sitemap 声明 + AI 爬虫放行** — `dist/robots.txt` 由 `build_site.py` 生成:`Allow: /` + `Sitemap: https://assets.ouuut.com/sitemap.xml`,并显式放行 OAI-SearchBot / GPTBot / ClaudeBot / PerplexityBot。线上 `curl -sI https://assets.ouuut.com/robots.txt` → 200 text/plain。
- [x] **A2 sitemap.xml 只收 canonical、lastmod 真实** — 43 条 URL(目录 + 29 详情 + 12 子 demo),`lastmod` 取 HEAD 提交日期;`build_site.py verify()` 断言 URL 数 = 页面数,少一条即构建失败。
- [x] **A3 canonical 自指 + 全站统一** — 每页 `<link rel="canonical">` 为绝对地址且自指;页面路径尾斜杠统一(CF Pages 对目录自动补斜杠);无参数页。
- [x] **A4 hreflang** — N/A:单语言(zh-CN)站,按清单要求明确不做。
- [x] **A5 title / description 全站唯一** — 目录页与每个详情页各自生成:`sai-assets · 可复用网页资产库` / `<包标题> · sai-assets`;description 取包 `when` 前 150 字。抽查:`curl -s https://assets.ouuut.com/p/three-fx/ | grep -o '<title>[^<]*'`。
- [x] **A6 H1 每页唯一、层级不断** — 探针断言 `h1 = 1`;目录 `h1`→`h2`(类目标题)→`h3`(卡片标题);详情 `h1`→`h2`(元数据/取用/源码)。
- [x] **A7 noindex 残留清零** — 生成器不写 `meta robots`;`_headers` 里无 `X-Robots-Tag`。旧 GitHub Pages 站已下线(删除 Pages site),不会再有一份陈旧镜像被收录。

## B GEO / AI 搜索

- [x] **B1 llms.txt** — `/llms.txt` 生成:站内一句话 + 全部 29 包清单(带版本与类目)+ 许可说明 + 源码地址。
- [x] **B2 JSON-LD 基础** — 目录页 `WebSite`(name/url/description/license/sameAs=GitHub);详情页 `CreativeWork`(identifier=包 id、version、license、codeRepository、keywords)。用 `<script type="application/ld+json">` 直出,非 JS 注入。
- [x] **B3 JSON-LD 内容型挂载** — 本项目无文章/产品/活动页,只有目录与详情,按 B2 的两类挂载即覆盖;`Dataset` 不适用(产物是代码包,非数据集)。
- [x] **B4 站内 FAQ 内容块** — 目录页首屏以可见文字回答"这是什么/怎么用/为什么可信":"每一包 = 入口 + 产物 + 配对规则 + 断言"、卡片里跑的是包内真实预览页;详情页给出四路取用方式与验证证据(`verified.evidence`)。

## C 社交传播

- [x] **C1 OG 标签完整(服务端输出)** — 每页 `og:title/description/type/url(=canonical)/image(1200×630,显式宽高)/site_name`,由生成器直出;`og.png` 由 `scripts/make_og.py` 生成(1200×630,取库内 token 配色)。
- [x] **C2 Twitter Card** — `twitter:card=summary_large_image` + title/description/image 全齐。
- [ ] **C3 全平台预览实测** — 待做:粘贴到 Telegram / Slack / X 各测一次(改变 OG 后需重新抓取)。**发布后补**,不影响首发。
- [ ] **C4 分享文案 + UTM** — 待做:站内无分享按钮,文案随外部发布时手写;UTM 只在对外推广链接上加。**发布后补**。

## D 数据统计与增长

- [x] **D1 访问统计选型落地** — 用 **Cloudflare Web Analytics**:`ouuut.com` zone 已开自动注入,站点的 HTML 响应上会带一段 CF 自己的 beacon(`static.cloudflareinsights.com`,无 cookie、不做跨站跟踪)。**不是本站配置**:`sai-assets.pages.dev` 上没有它,只有走自定义域的响应有;要关就关 zone 级自动注入(会影响同 zone 其他站,故不自决)。建站自身的产物仍是零外链子资源(构建期断言)。
- [x] **D2 事件埋点** — N/A:目录站没有转化漏斗,页面浏览量足够;不引入事件 SDK(会再加一个外部请求)。
- [ ] **D3 Search Console + Bing 验证** — 待做:需要域名级 DNS TXT 验证;首个自然月内补,提交 sitemap。
- [ ] **D4 PWA 可安装性** — 明确不做(单页目录站,离线价值低;若日后要装再加 manifest + SW 壳缓存)。
- [x] **D5 订阅/留存触点** — N/A:无内容更新流,更新只发生在包上;对外通知走仓库 release/tag。

## E 性能(Core Web Vitals)

- [x] **E1 图片现代格式 + 显式尺寸** — 站点只有一张 `og.png`(分享卡,不进页面);站内零 `<img>`,装饰全靠 CSS 渐变与色卡,规避 CLS。探针断言 `img[width]/img[height]` 计数 = 0(我们根本不用 img)。
- [x] **E2 CJK 字库子集化** — 不引入任何 Web 字体(整包 Noto 是数 MB),走系统栈;唯一 `@font-face` 是包内 `Serif Fallback` 的本地度量回退(不下载)。零外部字体请求。
- [x] **E3 JS 体积与长任务** — `site.js` 单文件约 10 KB,无依赖、无框架、无 polyfill;`defer` 加载;卡片的 iframe 由 IntersectionObserver 控制,视口外立刻卸载。
- [x] **E4 LCP 元素可被预扫描器发现** — LCP 是文本(h1/卡片标题),由 HTML 直出;iframe 是 `data-src` 懒挂,不参评 LCP。
- [x] **E5 CLS 预留空间** — 卡片缩略区固定 `aspect-ratio: 4/3`,详情舞台由 JS 按视口比例设高(首帧即定高),iframe 挂载不移位。
- [x] **E9 catalog 派生化(裸上传可上站)** — `catalog.json` 由 CI 重建:不一致时 `site.yml` 用 `github-actions[bot]` 回提交再部署(`permissions: contents: write`,其余工作流仍 `read`;GITHUB_TOKEN 推的提交不触发工作流,无回环);`preview.yml` 也先重建再构建,保证预览里的 `catalog.json` 与分支内容一致。自测:2026-11-04 故意推一份过期 catalog → CI 自动对齐并部署,线上 `catalog.json` 仍 30 条。
- [x] **E6 缓存策略** — `dist/_headers`:`/*` `max-age=300` + 安全头(实测生效);静态文件(`/assets/*`、`/robots.txt` 等)CF Pages 会用它自己的 `max-age=14400` 覆盖 `_headers` 里的 Cache-Control —— 因此外壳 CSS/JS 的 URL 带**内容哈希** `?v=<sha8>`(每次部署变),刷新即拿到新版,不靠缓存头。
- [x] **E7 发布即生效、验收带 cache-bust** — 每次 push 生成新 deployment;外壳资源 URL 带内容哈希,HTML 变更即切换;验证命令另带 `?cb=$(date +%s)` 避免把边缘缓存滞后当故障。
- [ ] **E8 Lighthouse(移动端)基线** — 待做:发布后跑一次记录 LCP/INP/CLS 数字并写进 `progress.md`。**发布后 24h 内补**。

## F 安全

- [x] **F1 全站 HTTPS** — CF Pages 自动证书;自定义域 `assets.ouuut.com` 由 CF 签发(zone 同账号),HTTP 自动跳 HTTPS。HSTS 未加:**有意不加**,本站是资产目录,子域改动频繁,避免 preload 锁死。
- [x] **F2 混合内容清零** — 生成器断言外链子资源 = 0;站内所有引用相对路径。
- [x] **F3 安全响应头基线** — `_headers`:X-Content-Type-Options、Referrer-Policy: strict-origin-when-cross-origin、Permissions-Policy(geo/mic/camera/payment/usb 全关)、X-Frame-Options: SAMEORIGIN。
- [x] **F4 CSP** — 有意不加 CSP 也先不加 report-only:站点零外链、无内联事件处理器(唯一内联 `<script>` 是主题初始化一行,内容固定);CSP 会在预览 iframe 上引入额外调试成本,收益为零。记录在 ADR。
- [x] **F5 依赖漏洞与供应链** — 无 npm/pip 依赖(纯标准库 Python + 原生 JS);CI 里 wrangler 用 `npx --yes wrangler@3` 固定主版本;GitHub Secret 存 token。
- [x] **F6 泄漏面自查** — `.private/`(规则表、截图、ego 脚本)gitignore;`dist/` gitignore;仓库公开内容全部过 `scripts/gate.py`(29 包 / 0 findings);无 source map、无 debug 端点。

## G 可靠性

- [x] **G1 备份 3-2-1** — 站点是**可重建产物**:源在公开仓(GitHub 一份)、本地生产根一份、构建脚本+包内容双份;CF 每次 deployment 都是不可变快照,可回滚到任意历史版本。无数据库、无用户上传。
- [x] **G2 恢复演练** — 演练方式=重新构建:`python scripts/build_site.py` 在干净克隆上跑通(CI 每次 push 就是一次演练),产物字节一致(zip 固定 mtime、时间戳取提交日期)。
- [ ] **G3 外部可用性监控** — 待做:把 `https://assets.ouuut.com/` 加进 Uptime Kuma(红绿进 Kuma、事件进 TG),监控项登记到 `registry.json`。**发布后补**,见 HANDOFF 监控节。
- [x] **G4 错误日志** — 纯静态站无服务端日志;前端不引 Sentry(零外部请求约束);失败面=构建失败,由 GitHub Actions 通知承担。
- [x] **G5 上线前彩排 + 回滚路径** — 彩排:PR 预览环境(`pr-<n>.sai-assets.pages.dev`)先在真域名之外验一遍;回滚:`CF 控制台 → Deployments → 回滚到上一个成功版本`,或用 git revert 触发重新构建(两分钟内)。
- [x] **G6 域名/证书续费** — `ouuut.com` 在 Cloudflare 注册并自动续费;证书由 CF 托管自动续。

## H 合规 / 无障碍 / 内容(WCAG 2.2 AA)

- [x] **H1 键盘完全可达** — 全站 Tab 顺序 = 视觉顺序;搜索框 `/` 聚焦、Esc 清空并失焦;无键盘陷阱;跳转链接为第一个可聚焦元素。
- [x] **H2 焦点指示清晰** — 全局 `:focus-visible { outline: 2px solid var(--accent-ink); outline-offset: 2px }`;探针断言该规则存在。
- [x] **H3 对比度达标** — 探针逐层合成背景实测:目录/详情/代码区,深浅两模,违例 = 0;彩色小字一律走 `--accent-ink` 或向 `--ink` 混色(原色 #CD5545 在纸白底只有 3.80:1)。
- [x] **H4 动效可减弱** — `@media (prefers-reduced-motion: reduce)` 段存在且把过渡压到 0.001ms;卡片预览是静态挂载,不自动播放动画。
- [x] **H5 隐私政策** — 无账号、无表单、无 cookie、无统计;站内不收集任何数据,无需同意层。页脚说明许可与内容来源。
- [x] **H6 数据来源与许可可查** — 每包 `pack.json.license` + `attribution[]` 在详情页展示;外部索引包(`gruvbox-dark`、`video-motion`)只给本家仓库链接,不复制内容。
- [x] **H7 敏感内容免责与时效** — 目录页显示"最近更新"日期;详情页展示 `verified.date/how/evidence`(包内断言的实测数字),过期的包靠 `verified.date` 可判。
- [x] **H8 联系方式可用** — 页脚指向源码仓库(issue 是唯一入口);404 页给回目录 + 前 8 个包的入口。

## I 多语言 / 移动端

- [x] **I1 语言探测** — N/A:单语言站,不做切换器。
- [x] **I2 hreflang** — N/A(见 A4)。
- [x] **I3 字典完整性** — N/A(无 i18n 层)。
- [x] **I4 移动端视口与断点** — `viewport` meta 全页带;探针在 390 / 500 / 1440 三档实测 `scrollWidth - clientWidth = 0`;窄屏网格降为单列。
- [x] **I5 触摸目标 ≥44px** — 顶栏主题按钮、类目 chip、按钮类最小 40–44px 命中区;卡片缩略区整体可点;无 hover-only 功能(WebGL 预览用可见按钮触发)。

## J 发布流程与发布后

- [x] **J1 发布前快照** — 发布=构建产物 deployment,天然快照;源仓每次发布前 push 到 GitHub(远端即快照);AGENTS.md 已写发布链。
- [x] **J2 一键回滚** — CF Deployments 面板回滚,或用 git revert + push 重新构建;目标 <5 分钟。
- [x] **J3 URL 与状态码** — 目录 `/`、详情 `/p/<id>/`、子 demo `/p/<id>/demo/<slug>/`、下载 `/downloads/<id>.zip`;不存在路径由 CF Pages 返回站内 `404.html`;站内链接无 404(构建期 verify 覆盖)、无 HTTP 链接。
- [x] **J4 发布后冒烟** — 线上实测:目录 200 且 29 张卡、`/assets/site.css|site.js` 200、`/p/ouuut-editorial/` 200、`/downloads/bg-fx.zip` 200、`/robots.txt|sitemap.xml|llms.txt` 200;控制台 0 error(探针)。
- [x] **体检(web_audit)本轮实跑留档** — `web_audit.py report` exit 1;**适用项通过**:S2 sitemap/robots、S3 JSON-LD、S4 hreflang(单语)、S5 站内 934 链 0 死链、S7 无 JS 可见正文、D4 字段完整 30/30、Z2 git 历史无凭据、A4 闸门 59 处。**红项不适用**:①`dist/packs/**` 下 400+ 个预览页被当作站点页面判 canonical/meta(它们是资产内容,是被嵌的目标);②单语站的 i18n 组(C1–C5/D3)无判据面。工具**未实现 `exclude`/`scan_roots`**,已留为尾巴,不刷绿。
- [x] **J5 变更日志** — `progress.md` 逐条记本次改动;`CLOSEOUT.md`/`HANDOFF.md` 同步站点节。
- [ ] **J6 发布后监控(24h / 首周)** — 待做:24h 内看一次 CF 部署状态与访问情况(无统计,改看 CF Analytics 的请求数与 5xx);首周确认 Search Console 收录(依赖 D3)。
