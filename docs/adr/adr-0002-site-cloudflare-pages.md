# ADR-0002 · 展示站:仓内生成器 + Cloudflare Pages 直传 + 零框架外壳

- 日期:2026-11-04
- 状态:accepted

## 处境

ADR-0001 定的"人走 Pages 墙"落地成了 `scripts/build_wall.py` 出的单页卡片墙:每包一行字 + 色卡 + 链接,**看不到资产实际效果**。而库的价值恰恰在于"每包自带一份能跑的 `preview/index.html`"(29 包里 26 个有)。同时需求升级为:①一个能看到全部资产实际效果的站;②新包入库后自动上站;③每包给出下载/安装入口。原墙部署在 GitHub Pages,与 GitHub 仓库耦合,PR 预览、自定义域、回滚都不好办。

## 拍板

1. **站点生成器留在仓内**(`scripts/build_site.py`,纯标准库 Python,读 `packs/*/pack.json`),产物写 `dist/`(gitignore);**没有第二个注册表**——加一个包目录就上站。
2. **部署走 Cloudflare Pages 直传**(GitHub Actions 里 `wrangler pages deploy dist`),不用 CF 自己的构建镜像:构建链只需要 Python 3.12,不引入 Node 工具链,CI 30 秒级。
3. **站点外壳零框架、零外部请求**:一个 `site.css` + 一个 `site.js`(约 10 KB,原生 JS),token 与排版刻度在构建时直接从库内 `ouuut-editorial` 包拷来——**站自己就是取用示例**。
4. **预览用活 iframe,不截图**:卡片里跑的就是包内那份 `preview/index.html`;视口内懒挂、并发上限 8、视口外卸载,WebGL 类(`three-fx`/`particle-fx`/`bg-fx` 等)点"运行预览"才建立渲染上下文(浏览器 WebGL context 上限约 16,自动挂载会把后面的预览顶黑)。
5. **单一部署面**:退役 `pages.yml`(GitHub Pages),删除仓库 Pages 配置;自定义域 `assets.ouuut.com`(zone 同账号,CF 自动签证书)。
6. **有意不装统计、不加 CSP、不加 HSTS**:站点零第三方请求是硬约束之一(构建期断言外链子资源 = 0),统计会破坏它;CSP 会在 30+ 个同源预览 iframe 上引入调试成本而收益为零;HSTS preload 与"子域频繁增删"冲突。三项都写在 `MASTER-CHECKLIST.md` F/D 组里备查。

## 落选者(具名)

- **Astro / Vite + 框架**:站点无路由状态、无数据层,只是内容展示;引入 Node 工具链会让 CI 从 30s 变分钟级,并多出 lockfile 与依赖审计面。
- **构建期截图做缩略图**(ego/Playwright 批量截图):能拿到清晰静帧,但 CI 里要跑真浏览器(重、易碎),且"静态图"恰恰丢掉了本站最强的卖点——卡片里跑的是真的。若日后移动端性能吃紧,可作为"首帧静图 → hover 换活预览"的二期方案。
- **CF Pages 的 Git 集成(让 CF 自己构建)**:CF 构建镜像里 Python 版本与我们的脚本链不可控,且会引入"两边都构建"的双真相源。
- **保留 GitHub Pages 作镜像**:两个 URL 都是"官网"= 双 SSOT,且旧墙看不到效果,留着只会误导。

## 代价

- 站点行为测试靠 ego lite + 仓内探针(`.private/ego/probe.js`),不是单元测试;探针报红口径写在 `design-lock.json.assertions`。
- `dist/` 体积约 9.8 MB(包内容 + 确定性 zip),每次部署全量上传 —— CF Pages 免费层 2 万文件/次够用,但包数量增长到数百时要重新评估。
- 包内 `pack.json` 的 `when/not_for` 是长文,卡片上靠 CSS 三行截断,详情页才全文——文案质量直接决定观感。
