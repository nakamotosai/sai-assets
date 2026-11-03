---
name: libraries-dev-fx
description: Run the Libraries.dev "tasting bench" — five React effect components (border-beam, thinking-orbs, liquid-gooey, metal-fx, img-fx) loaded live from the esm.sh CDN to compare them in one page. Use when you need a remote, zero-install side-by-side look at these effects, or a copy-ready shell that shows per-stage load failures as red text. Not a production dependency.
---

# libraries-dev-fx · Libraries.dev 全家桶试吃台

五个开源特效组件的**远程试吃台**:组件真身(React 原包,非仿写)运行时从 esm.sh 现拉现跑,

同一底色同一网格横向对比。包内**不含**第三方源码,没有 npm/构建/服务器依赖。任一组件加载失败,

只把红字写进它自己那个格子(不抛未捕获错误),另外四个照常跑。

## When to use

- 选型:想在同一页对比 border-beam / thinking-orbs / liquid-gooey / metal-fx / img-fx 五个特效。
- 演示:给非开发者看"这个动效到底长什么样",不想装 node_modules、不想起服务器(file:// 直开即可)。
- 抄外壳:需要一个"每格独立加载 + 局部失败红字"的展示骨架,把里面的组件换成自己的库。

## When not to use

- 生产运行时依赖(浮动版本 + 公网 CDN,见 `docs/usage.md` 反模式)。
- 离线环境 / 内网演示(没网就只剩"加载中...")。
- 需要 SSR、打包进 bundle、固定版本可复现的工程。

## Files

| path | use |
|---|---|
| `preview/index.html` | 结构(5 个 `#stage-*`)+ importmap + 引 CSS/JS;可直接 file:// 打开 |
| `src/bench.css` | 外壳样式;token 集中在顶部 `:root`(`--bg/--panel/--stage/--fg/--dim/--acc/--err/--radius`) |
| `src/bench.js` | `CDN` 表 + `fail()/ok()` + 五个 demo(各自 try/catch)+ `boot().catch(failAll)` 兜底 |
| `docs/usage.md` | 导出名与参数、接入步骤、失败排查、反模式、来源与许可 |
| `scripts/assert_tokens.py` | 自检(元数据 / 引用 / 文档小节 / 外链协议) |

## Agent apply steps

1. 读 `preview/index.html` 确认你要的 stage 结构与 importmap;读 `src/bench.js` 的 `CDN` 表确认包名与导出名。
2. 原样拷 `preview/index.html` + `src/bench.css` + `src/bench.js`;引用顺序必须 importmap 在前、脚本在后。
3. 要加/换试吃项:在 `CDN` 加一条 `{stage, pkg, url}`,写一个 `async function xxxDemo()`(内部 `try { const mod = await import(CDN.x.url); ... } catch (e) { fail(...) }`),
   在 `preview` 里加一格 `<div class="stage" id="stage-xxx"><status>加载中...</status></div>`,并把函数加进 `Promise.all([...])`。
4. 要换配色:只改 `src/bench.css` 顶部 `:root`,不要散改组件内联样式。
5. 把选中的库真正用于生产时:**不要**沿用这里的 CDN 写法——固定版本号、走本地依赖/构建产物。
6. 自检:`python packs/libraries-dev-fx/scripts/assert_tokens.py`(必须打印 PASS)。

## Hard rules

- 五个 stage 一个都不能少:`stage-beam` / `stage-orbs` / `stage-gooey` / `stage-metal` / `stage-image`。
- 每个 demo **必须**独立 `try/catch`,失败只写红字进对应 stage;**禁止**未捕获错误、禁止静默失败。
- importmap 必须出现在 `src/bench.js` 之前;脚本用普通 `<script defer>` + 动态 `import()`,以便 `file://` 直开成立。
- 相对引用只许指向本包 `src/`(不许 `../` 越出包目录);外链只许 `https://`(禁 http / 本机 / 内网)。
- 保留 MIT 声明与 Libraries.dev 署名(`pack.json.attribution`、`README.md`、`preview` 页脚、`docs/usage.md`)。
- 消费后必须在项目 `design-lock.json` 记 `assets[]`(`pack`/`version`/`sha`)。
