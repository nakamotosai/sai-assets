# locale-router · 使用说明

静态多语言站的语言路由:**纯前端、零依赖、同步执行**,一行内联在 `<head>` 里就能在首帧之前决定「第一次来的人进哪一版」。
四条规则:参数优先、深链保留、根路径单次重定向、爬虫放行;配一枚三态语言开关(静息 / 悬停 / 当前 `aria-current="page"`)。

## 什么时候用

- 静态多语言站(每版一个路径前缀,如 `/` `/zh/` `/ja/`),要决定「第一次来的人进哪一版」。
- 要 `?lang=` 参数在任意页面永远优先,并且把这次选择记下来。
- 要深链不被夺回:别人发来 `/zh/` 的链接,就停在 `/zh/`。
- 要根路径只按「记忆 -> `navigator.languages` 探测 -> 默认语言」决定,而且**只重定向一次**(落在深链上就结束)。
- 要爬虫 / headless 客户端看到稳定内容,不被语言跳转搅乱收录。
- 要一个放在头部、三态清楚、带焦点环的语言开关。

## 决策规则

按顺序判断,先命中先返回(与源脚本一致):

| 顺序 | 规则 | 条件 | 动作 | 写记忆 |
|---|---|---|---|---|
| 1 | 参数优先 | `?lang=<code>` 且 code 在 `locales` 里 | 与当前语言不同则 `location.replace(入口路径 + hash)` | 总是写 |
| 2 | 深链保留 | 路径 ≠ `rootPath` | 不动 | 仅当还没有记忆、且不是爬虫时,补写当前语言 |
| 3 | 爬虫放行 | 路径 = `rootPath` 且 UA 命中名单 | 不动 | 不写 |
| 4 | 根路径决定 | 路径 = `rootPath`,非爬虫 | 记忆 -> 探测 -> 默认;结果入口与当前路径不同才 `replace` | 总是写 |

- 「当前语言」= `<html lang>` 的取值(大小写不敏感、`zh-CN` 按 `zh` 认);认不出来就是 `defaultLocale`。
- 探测 = 按 `navigator.languages` 顺序找第一个认得的语言;`navigator.languages` 为空时退到 `navigator.language`。
- 因为规则 2 在规则 4 之前,根路径那次重定向落地后就是深链,**一跳即止**;刷新、回退都不会再被搬走。
- 只用 `location.replace`,不往历史里压一条,浏览器「后退」不会在两个语言之间来回弹。

## 接入步骤

1. 把两个文件拷进项目(无构建、无依赖):

   ```text
   src/locale-router.js   →  assets/locale-router.js
   src/locale-router.css  →  assets/locale-router.css
   ```

2. 在 `<head>` 里、**先配置再加载**(必须同步、不能加 `defer` / `async`,否则首帧已经画完了):

   ```html
   <script>
   window.LOCALE_ROUTER_CONFIG = {
     locales: { en: "/", zh: "/zh/", ja: "/ja/" },
     defaultLocale: "en",
     storageKey: "locale",
     param: "lang",
     rootPath: "/"
   };
   </script>
   <script src="assets/locale-router.js"></script>
   ```

   也可以把命名空间对象当配置写(等价写法,两种都认):

   ```html
   <script>
   window.LocaleRouter = {
     locales: { en: "/", zh: "/zh/", ja: "/ja/" },
     defaultLocale: "en",
     storageKey: "locale",
     param: "lang",
     rootPath: "/"
   };
   </script>
   <script src="assets/locale-router.js"></script>
   ```

3. 每个语言版本的页面把语言写进 `<html lang>`(源脚本就靠这个属性判断「当前在哪一版」):

   ```html
   <html lang="zh-CN">
   ```

4. 语言开关放头部(静态直出,当前项写 `aria-current="page"`;也可以留给脚本写):

   ```html
   <link rel="stylesheet" href="assets/locale-router.css">
   <nav class="locale-switch" aria-label="语言">
     <a class="locale-switch__item" href="/" data-lr-locale="en" hreflang="en" lang="en">English</a>
     <a class="locale-switch__item" href="/zh/" data-lr-locale="zh" hreflang="zh" lang="zh-CN">中文</a>
     <a class="locale-switch__item" href="/ja/" data-lr-locale="ja" hreflang="ja" lang="ja">日本語</a>
   </nav>
   ```

   想让脚本按 `<html lang>` 自动同步当前态,在 DOM 就绪后调一次(幂等,可重复调):

   ```js
   LocaleRouter.mark();                       // 整页扫描,或 LocaleRouter.mark(navElement)
   ```

5. 自检:`python packs/locale-router/scripts/assert_tokens.py`(含决策层干跑与对比度实测)。

## 参数

配置字段(写在 `window.LOCALE_ROUTER_CONFIG` 上;**只认这几个名字**,写错的名字会被忽略):

| 字段 | 默认值 | 说明 |
|---|---|---|
| `locales` | `{ en: "/", zh: "/zh/", ja: "/ja/" }` | 语言代码 -> 该语言的入口路径。跳转目标就是这里的字面量,不补也不删斜杠 |
| `defaultLocale` | `"en"` | 兜底语言,必须是 `locales` 的键;写错则退到 `locales` 的第一个键 |
| `storageKey` | `"locale"` | 记忆用的存储键 |
| `param` | `"lang"` | 参数名:`?lang=` |
| `rootPath` | `"/"` | 触发自动决定的路径;其余路径一律按深链对待(路径比较忽略尾斜杠) |
| `auto` | `true` | `false` = 加载时不动手,自己调 `LocaleRouter.run()` |
| `dryRun` | `false` | `true` = 只算不跳、也不写记忆(预览页与自检就是靠它拿到「真实入口会怎么决定」) |

运行时接口(`window.LocaleRouter`):

| 方法 | 返回 | 说明 |
|---|---|---|
| `LocaleRouter.decide(input)` | 决定对象 | **纯函数**:不碰 DOM、不写存储、不导航;输入字段见下表,缺省字段按「浏览器当前状态」取值 |
| `LocaleRouter.run()` | 决定对象 / `null` | 真入口:算一次,按结果写记忆与 `replace`;无 DOM 环境(如 Node)返回 `null` |
| `LocaleRouter.mark(root?)` | 命中项个数 | 按当前语言给 `[data-lr-locale]` 写 `aria-current="page"`,其余清掉 |
| `LocaleRouter.read()` / `LocaleRouter.remember(code)` | 存储值 / 是否写入成功 | 直接读写记忆(隐私模式、存储被禁时静默返回 `null` / `false`) |
| `LocaleRouter.detect(list)` / `LocaleRouter.isRobot(ua)` | 语言代码 / 布尔 | 把内部探测与 UA 判定暴露出来,便于自检与调试 |
| `LocaleRouter.config` / `LocaleRouter.paths()` | 生效配置 / 跳转表 | 合并默认值之后的实际配置 |

`decide(input)` 的输入字段:

| 字段 | 缺省 | 说明 |
|---|---|---|
| `pathname` | `location.pathname` | 落地路径 |
| `search` | `""` | 查询串(用来取 `?lang=`) |
| `hash` | `""` | 会原样拼到跳转目标后面(保留锚点) |
| `current` / `htmlLang` | `<html lang>` | 当前语言代码;两者取其一 |
| `stored` | 读存储 | 记忆值;显式传 `null` = 「没有记忆」 |
| `languages` | `navigator.languages` | 探测用的语言列表 |
| `forced` | 从 `search` 取 | 直接给参数值(测试用) |
| `robot` | 按 UA 判定 | 是否按爬虫处理 |

决定对象:`{ reason, action, from, target, to, remember, robot }`。
`reason` 取值 `param` / `deep-link` / `memory` / `detect` / `default` / `robot`;`action` 取 `redirect` / `stay`;
`to` 是**会跳到哪个路径**(`null` = 不跳);`remember` 是**会写进记忆的代码**(`null` = 不写)。

脚本还会在 document 上派发一个 `localerouter:decide` 事件,`event.detail` 就是决定对象(想埋点或做调试面板时用)。

开关的 CSS 变量(写在 `.locale-switch` 上;深底页只换配色,别动组件规则):

| 变量 | 默认值 | 说明 |
|---|---|---|
| `--lr-bg` | `#ffffff` | 所在条带的底色:对比度按它算,请与页面实际底色一致 |
| `--lr-ink` | `#1b1b1b` | 悬停 / 常态文字色 |
| `--lr-dim` | `#5c5c5c` | 静息文字色(须 ≥ 4.5:1 on `--lr-bg`) |
| `--lr-hover-bg` | `#f0f0f0` | 悬停底 |
| `--lr-current-bg` | `#e6e6e6` | 当前项底 |
| `--lr-current-ink` | `#101010` | 当前项文字色(须 ≥ 4.5:1 on `--lr-current-bg`) |
| `--lr-ring` | `#1f6feb` | 焦点环(须 ≥ 3:1 on `--lr-bg`) |
| `--lr-hit` | `32px` | 每个可点项的最小高度;触屏页建议 `44px` |
| `--lr-pad` / `--lr-radius` / `--lr-gap` | `8px` / `4px` / `2px` | 内边距 / 圆角 / 项间距 |
| `--lr-t` | `0.16s` | 过渡时长(`prefers-reduced-motion: reduce` 下归零) |

深底页示例(只换配色,文字与图形的对比度按同样的两档自查):

```css
.locale-switch {
  --lr-bg: #0f0f0f;
  --lr-ink: #f2f2f2;
  --lr-dim: #a8a8a8;
  --lr-hover-bg: #1e1e1e;
  --lr-current-bg: #2a2a2a;
  --lr-current-ink: #ffffff;
  --lr-ring: #7fd7ff;
}
```

## 与源脚本的逐条对照

本包是把一份站点专有的语言路由改写成通用零件,行为逐条保留,站点常量换成了配置:

| 源脚本行为 | 本包 | 差异 |
|---|---|---|
| `?lang=` 命中即 `remember()` 并跳转 | 规则 1,`param` 可配 | 无 |
| 语言表与记忆键写死(三种语言、单一键名) | `locales` / `storageKey` 可配 | 常量改配置 |
| 当前语言取 `<html lang>`,不在表内退默认 | 同 | 无(按主语言前缀认 `zh-CN` -> `zh`) |
| 深链只在「无记忆且非爬虫」时补写记忆 | 同 | 无 |
| 根路径爬虫 / headless 直接 return | 同,名单逐条保留 | 无 |
| 跳转条件:目标 ≠ 默认语言 | 目标入口路径 ≠ 当前路径 | 源配置(`en` 就是 `/`)下两者等价;`defaultLocale` 不在根路径时(如各语言都在前缀下)本包才不会漏跳 |
| 跳转拼 `location.hash`、只用 `replace` | 同 | 无 |
| 硬编码 `zh` / `ja` / `en` 探测分支 | 按 `locales` 的键探测,`navigator.languages` 顺序优先 | 支持任意语言集、支持 `pt-BR` 这类带地区的代码 |
| 只能整段执行,无法单测 | `decide()` 是纯函数,`dryRun` 可干跑 | 新增:决策层可脱离浏览器验证(`scripts/assert_tokens.py`) |

不做的两件事(见 `pack.json.not_for`):服务端按 `Accept-Language` 内容协商、构建期生成 hreflang —— 那属于构建 / 边缘侧,本包是浏览器侧的一次性决定。

## 无障碍硬项

- 语言开关的当前项**只**由 `aria-current="page"` 表达,视觉底色是它的映射;禁止另起 `.is-active` 第二套高亮。
- 每个可点项都是原生 `<a>`(或 `<button>`),可 Tab 到、可回车触发;焦点环用 `:focus-visible`(鼠标点击不留残影)。
- 每个可点项带 `hreflang` 与 `lang`(`lang="zh-CN"` 让读屏用对语音);`<html lang>` 必须与所在版本一致。
- 命中区由 `--lr-hit` 控制,只增不减;触屏页给到 44px。
- `prefers-reduced-motion: reduce` 下过渡归零(开关本身没有动画,只关过渡)。
- 语言开关整体放在 `<nav aria-label="语言">` 里,和主站导航区分开。

## 反模式

- **把脚本放 `</body>` 前或给它加 `defer`**:首帧已经画完,语言还没决定,用户先看到一版错的再被换掉(闪白)。只有 `<head>` 内同步执行这一条路。
- **先加载脚本再配置**:脚本在解析时就把配置合并好了,后写的 `window.LOCALE_ROUTER_CONFIG` 不生效。配置必须在脚本前面那段 `<script>` 里。
- **在 `<head>` 里做重活**(等网络、等 `DOMContentLoaded`、等异步探测):同步执行的前提是这里只有字符串比较。要接服务端信号就构建期直出 `<html lang>`,不要在这里加 await。
- **根路径上还留着其它重定向**:比如服务器把 `/` 跳到 `/zh/`,等于两次跳转,用户看到中间那一次空白。语言决定只能有一个执行者。
- **忘了写 `<html lang>`**:脚本会把所有页面都当成默认语言,深链上「补写记忆」和开关的 `aria-current` 都会指向错的语言。
- **用 `locales` 逗号分隔的字符串**:它必须是对象(代码 -> 路径);写成字符串会被忽略并退回默认值。
- **深链上再挂一层语言跳转**:别在 `/zh/` 页面里检测语言再跳到 `/ja/`,那会夺回用户明确选择的链接;要换只走开关。
- **爬虫名单随手精简**:名单里的 `headless` / `lighthouse` / `pagespeed` / `monitoring` 是给预览与监控用的 —— 被跳转带走的截图会全都拍到另一版语言。
- **给开关写第二套高亮**:见上面的无障碍硬项。
- **动态改 `locales`**:脚本在加载时就把配置合并并建好索引,运行中改 `LocaleRouter.config` 不保证生效;要换语言集就改那段内联配置。

## 来源与许可

- 规则与 UA 名单来源:一份静态多语言站的语言路由脚本(`assets/js/lang.js`,约 60 行),四条规则逐条保留;开关样式结构来自同站的头部语言开关(`assets/css/site.css` 的 `.lang-switch` 段)。
- 已按公开口径脱敏:原站品牌词、自有域名、记忆键名、语言表换成中性占位与可配置项;包内出现的路径一律是站点相对路径(如 `/zh/`),无盘符路径、无内网地址、无客户代号。
- 本包全部文件(JS / CSS / 预览 / 文档 / 断言)为本仓自产,许可 **MIT**,归属登记见 `pack.json.attribution`。
- 不包含任何第三方源码与字体文件;字体只按名字引用系统族,不做外部加载。
- 预览:直接双击 `preview/index.html` 即可(不依赖本地服务器);预览以 `dryRun: true` 加载,**加载与点击都不会发生任何导航**。
- 自检:`python packs/locale-router/scripts/assert_tokens.py`(决策层干跑四种来源 + 两档对比度实测)。
