# libraries-dev-fx · 使用说明(远程试吃台)

## 这是什么时候用的

**只有当你要"先看一眼真身再决定要不要用"的时候。** 这是一个**远程试吃台**:五个开源组件在运行时

通过 https 从 CDN(esm.sh)现拉现跑,包内**不含**任何第三方源码(vendored = 否),也不含 `node_modules`、

构建步骤、npm 依赖声明。它存在的理由是:组件真身(React 原包,不是仿写)长什么样,一屏就能对比出来;

谁加载失败,红色文字直接写在它自己的格子里,不会连累别人。

典型场景:

- 选型对比:五个候选特效放在同一页、同一底色、同一网格下横向比。
- 验收/演示:给非开发者看"这个动效到底长什么样",不需要装环境。
- 抄思路:确定了要哪个,再去那个库里抄**用得上的那部分**,而不是把 CDN 链接搬进生产。

## 五个试吃项:导出名与用法

| stage id | 包(esm.sh) | 导出名 | 试吃参数 | 备注 |
|---|---|---|---|---|
| `stage-beam` | `border-beam@1.3.0` | `BorderBeam`(兜底 `default`) | `size="md" colorVariant="colorful"` / `size="line" colorVariant="ocean"` | 两条:整圈流光 + 只闪底部一条线 |
| `stage-orbs` | `thinking-orbs`(无版本) | `ThinkingOrb` | `state="searching" \| "working" \| "breathing"`,`size=64` | 三个 state 并排 |
| `stage-gooey` | `liquid-gooey`(无版本) | `Liquid` + `Liquid.Item` | `blur=6 contrast=18 fill="#b8bb26"`,`Item` 传 `x/y/transition="bouncy"` | 两滴自动开合吸附 |
| `stage-metal` | `metal-fx`(无版本) | `MetalFx` | `variant="button" preset="chromatic" \| "silver" \| "gold" theme="dark"` | 三个预设竖排 |
| `stage-image` | `img-fx`(无版本) | `ImageGeneration` | `preset="pixels-organic"`,`images=[...]`,`autoReveal` | 图来自 Lorem Picsum 占位服务 |

五个包一律用 `?deps=react@18.3.1,react-dom@18.3.1` 拉取(`img-fx` 另加 `three@0.169.0`),

保证页面里的 React 只有一份副本;没有版本号的四个包吃的是"最新版",这正是试吃台的本意(也是它不能进生产的原因)。

## 接入步骤

这是**试吃台**,不是库。把整页搬走最快,三步:

1. 拷目录:`src/`、`preview/` 两份(要改样式只动 `src/bench.css`,要加减试吃项只动 `src/bench.js`)。
2. `preview/index.html` 里保留两处引用,顺序不能反——importmap 必须在脚本之前:

```html
<link rel="stylesheet" href="../src/bench.css" />
<script type="importmap">
{ "imports": {
  "react": "https://esm.sh/react@18.3.1",
  "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
  "three": "https://esm.sh/three@0.169.0",
  "htm": "https://esm.sh/htm@3.1.1"
} }
</script>
<script src="../src/bench.js" defer></script>
```

3. 结构照着留:`<div class="stage" id="stage-<名字>"><status>加载中...</status></div>`。

`src/bench.js` 靠 `document.getElementById` 找 stage、靠 `CDN` 表决定拉哪个包,**加第六个试吃项 = 加一格结构 + 加一条 `CDN` 记录 + 加一个 demo 函数**。

直接双击打开 `preview/index.html` 即可(脚本是普通 `<script defer>`,不是 module,所以不会被本地文件源(null origin)的 CORS 规则拦掉;

模块本身走动态 `import()`,本地文件页面对 https 的跨源请求按 CORS 通配许可)。不需要任何本地服务器、构建或安装。

## 失败排查

| 现象 | 原因 | 怎么办 |
|---|---|---|
| 五个格子同时红字「React 运行时 加载失败」 | importmap 缺失/被改坏、或网络拿不到 esm.sh | 检查 importmap 是否在脚本之前;换一个能访问 esm.sh 的网络 |
| 单个格子红字「xxx 加载失败」 | 只有这个包失败(被墙 / CDN 挂了 / 包名或导出名变了) | 红字里带原始错误信息;换网络重试,或去 [esm.sh](https://esm.sh/) 核对该包当时的导出名 |
| 红字「找不到导出 ThinkingOrb,实际导出: ...」 | 上游改了导出名(试吃台不带版本号的四个包吃最新版) | 按红字里列出的实际导出名改 `src/bench.js` 对应那一行 |
| 格子一直停在「加载中...」 | JS 被禁用,或该 stage 的 id 与 `CDN` 表对不上 | 打开控制台看是否有解析错误;核对 `stage-*` id |
| `img-fx` 只有底块没有图 | picsum.photos 被墙 | 改 `images` 数组换成自己可访问的图源 |

失败是**局部**的:任一组件加载失败只把红字写进对应 stage,不抛未捕获错误,其余四个照常跑。
| 本机/浏览器没有 WebGL(例如软件渲染被禁用) | img-fx(three.js 滤镜)整格显示「⏭ 已跳过」中性说明,**不报错**;其余四格照常 |

## 参数与文件表

| 文件 | 作用 |
|---|---|
| `preview/index.html` | 结构(5 个 stage)+ importmap + 两处引用;可直接双击打开(不经过服务器) |
| `src/bench.css` | 外壳样式(token 集中在顶部 `:root`:底色/面板/前景/强调/红/圆角/网格宽) |
| `src/bench.js` | 五个 demo:`CDN` 表 + `fail()`/`ok()` + 每个 demo 独立 try/catch |
| `docs/usage.md` | 本文件 |
| `SKILL.md` | agent 入口(何时用/何时不用/apply 步骤) |
| `README.md` | 人读首屏 |
| `scripts/assert_tokens.py` | 自检:`python scripts/assert_tokens.py` |

主要 token:`--bg #121212`(页底)、`--panel #1d1d1d`(卡片)、`--stage #161616`(格子底)、

`--fg #eeeeef`(正文)、`--dim`(次要文字)、`--acc #b8bb26`(强调/成功)、`--err #fb4934`(失败红字)。

## 反模式

- **别把它当生产依赖。** 它的 `<script type="importmap">` 指向 `esm.sh` 的浮动版本:四个包没写版本号,
  上游一发新版你明天就换了实现,页面随上游一起变。
- **别把 CDN 链接直接复制进生产。** 试吃台的 `import('https://esm.sh/...')` 是"看货"用的;生产要么装到本地依赖树,
  要么至少把版本号钉死并加完整性校验(SRI / 本地副本),再用自己的构建产物发布。
- **别把 `?deps=react@18.3.1` 的写法当规范。** 那是为了让试吃台只有一个 React 实例;生产里你的 React 版本由你自己决定。
- **别往这台子上加业务逻辑。** 它是展示页:无状态持久化、无路由、无错误上报。要真做成应用,请从零起一个工程,
  把选中的那个库当依赖引入。
- **别指望离线。** 没有网络时它只剩 5 个"加载中..."。要离线演示,先把选中的库 vendored 进项目。
- **别改这里的红字逻辑成静默失败。** "失败就红字写在格子里"是这个包的契约:任何组件挂掉都不该让另外四个变黑。

## 来源与许可

- 五个组件源码与页面外壳设计来自 **Libraries.dev**(github.com/Jakubantalik/Libraries.dev,MIT 许可证)。
  MIT 允许商用与修改,按许可靠谱做法保留本声明与 `pack.json.attribution`。
- 运行时由 **esm.sh** 提供(按需转译并加载上述包);示例图来自 **Lorem Picsum**(picsum.photos,占位图,仅外链,未随包分发)。
- 本包自身(外壳 CSS/JS/文档)许可:**MIT**。

因为包内不含第三方源码,所以没有 `upstream/` 目录;所有第三方内容都是运行时外链。
