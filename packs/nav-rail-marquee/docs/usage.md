# nav-rail-marquee · 使用说明

导航三件套:**左竖排跑马灯(vertical-rl 无缝循环)+ 顶部居中小写导航 + 右侧段轨(当前条高亮发光)+ 底部进度线**。
三处状态由一个小脚本统一驱动:点任一处、或滚动到某一段,两处当前态与进度线同步更新。

## 什么时候用

- 单页作品集 / 工作室首页 / 长文长图页,需要"边缘 chrome"压住画面四角,而不是一条通栏 header。
- 想要一个不抢内容、只在边缘呼吸的导航:左侧竖向滚动字条 + 顶部三个小写入口 + 右侧段落轨 + 底部进度。
- 需要"当前段"有强反馈:段轨条形加长发光、进度线按段推进。
- 需要它作为纯装饰层叠在现有页面上(全部规则限定在 `.nr` 内,不动 `html` / `body`)。

## 接入步骤

1. 把两个文件拷进项目(无构建、无依赖):

   ```text
   src/nav-rail.css   →  assets/nav-rail.css
   src/nav-rail.js    →  assets/nav-rail.js
   ```

2. 页面外壳(组件只接管自己的 `.nr` 容器,页面级黑色底与 `overflow` 由你决定):

   ```html
   <link rel="stylesheet" href="assets/nav-rail.css">
   <style>
     html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
   </style>
   ```

3. 打标记(顺序无所谓,靠 `data-*` 认):

   ```html
   <div class="nr" data-nav-rail>
     <!-- 两份逐字等长(各重复到超过一屏高),两份之间不留空白字符 -->
     <div class="nr-marquee" aria-hidden="true">
       <div class="nr-marquee__track"><span>WHO · WORKS · DEMOS · ABOUT · example.com · WHO · WORKS · DEMOS · ABOUT · example.com · </span><span>WHO · WORKS · DEMOS · ABOUT · example.com · WHO · WORKS · DEMOS · ABOUT · example.com · </span></div>
     </div>

     <nav class="nr-top" data-nr-top aria-label="主导航">
       <button type="button" class="nr-btn" data-nr-target="works" aria-label="跳到 works 段">works</button>
       <button type="button" class="nr-btn" data-nr-target="demos" aria-label="跳到 demos 段">demos</button>
       <button type="button" class="nr-btn" data-nr-target="about" aria-label="跳到 contact 段">contact</button>
     </nav>

     <nav class="nr-rail" data-nr-rail aria-label="段落导航">
       <button type="button" class="nr-btn" data-nr-target="who" aria-current="page" aria-label="跳到 WHO 段">
         <span class="nr-lbl">WHO</span><span class="nr-bar" aria-hidden="true"></span>
       </button>
       <button type="button" class="nr-btn" data-nr-target="works" aria-label="跳到 WORKS 段">
         <span class="nr-lbl">WORKS</span><span class="nr-bar" aria-hidden="true"></span>
       </button>
       <button type="button" class="nr-btn" data-nr-target="demos" aria-label="跳到 DEMOS 段">
         <span class="nr-lbl">DEMOS</span><span class="nr-bar" aria-hidden="true"></span>
       </button>
       <button type="button" class="nr-btn" data-nr-target="about" aria-label="跳到 ABOUT 段">
         <span class="nr-lbl">ABOUT</span><span class="nr-bar" aria-hidden="true"></span>
       </button>
     </nav>

     <div class="nr-progress" data-nr-progress role="progressbar" aria-label="段落进度"
          aria-valuemin="1" aria-valuemax="4" aria-valuenow="1">
       <span class="nr-progress__bar" data-nr-bar></span>
     </div>

     <main class="nr-stage" data-nr-stage>
       <section class="nr-sec" data-nr-section="who" id="sec-who">…</section>
       <section class="nr-sec" data-nr-section="works" id="sec-works">…</section>
       <section class="nr-sec" data-nr-section="demos" id="sec-demos">…</section>
       <section class="nr-sec" data-nr-section="about" id="sec-about">…</section>
     </main>
   </div>

   <script src="assets/nav-rail.js"></script>
   ```

4. 标记到位后脚本自动初始化(`DOMContentLoaded` 时扫 `[data-nav-rail]`)。要手动接管:

   ```js
   const nr = NavRail.init('#nr', { scroll: true, spy: true, keyboard: true });
   nr.go('demos');       // 跳到 demos 段并同步两处当前态
   nr.sync('about');     // 只改状态,不滚动
   nr.destroy();         // 解绑观察器与滚动监听
   ```

5. 想改外观只动 `.nr` 上的变量(见下表),别去改组件规则本身。

## 参数

CSS 变量(写在 `.nr` 上,或任何包住它的祖先元素上):

| 变量 | 默认值 | 取值范围 | 说明 |
|---|---|---|---|
| `--mq-opacity` | `.72` | `0.2` – `1`,步进 `0.02` | 左竖排跑马灯整体透明度(对应源 params 的 `marqueeOpacity`) |
| `--mq-sec` | `24s` | `8s` – `60s`,步进 `1s` | 跑马灯跑完一轮的时长(对应源 params 的 `marqueeSec`);数值越小跑得越快 |
| `--nr-bg` / `--nr-ink` / `--nr-dim` | `#000` / 白 92% / 白 55% | 任意色值 | 底、当前态文字、常态文字 |
| `--nr-accent` / `--nr-glow` | `#fff` / 白 55% | 任意色值 | 段轨当前条与其发光 |
| `--nr-focus` | `#7fd7ff` | 任意色值 | 键盘焦点环颜色 |
| `--nr-hit` | `44px` | 建议 `≥44px` | 每个可点项的最小命中区 |
| `--nr-bar-h` / `--nr-bar-h-on` | `18px` / `40px` | 任意长度 | 段轨条形常态高 / 当前态高 |
| `--nr-prog-h` | `2px` | 任意长度 | 底部进度线高 |
| `--nr-t` | `.4s` | 任意时长 | 过渡时长(减少动效时归零) |
| `--nr-gutter` / `--nr-top-offset` | `24px` / `14px` | 任意长度 | 段轨距右边 / 顶导航距上边(段轨默认要让开滚动条槽位) |

脚本选项(`NavRail.init(root, options)`):

| 选项 | 默认 | 说明 |
|---|---|---|
| `scroll` | `true` | 点击时把目标段滚进视野;`false` 只管状态 |
| `spy` | `true` | 滚动联动(中间带命中的段成为当前段) |
| `keyboard` | `true` | 段轨上下键 / 顶导航左右键 / Home / End 移动焦点 |

标记契约:

| 属性 | 挂在哪 | 作用 |
|---|---|---|
| `data-nav-rail` | 包裹根 | 变量作用域 + 查找边界,一个页面可以有多套 |
| `data-nr-top` / `data-nr-rail` | 两个 `<nav>` | 分组(键盘方向键按分组生效) |
| `data-nr-target="<id>"` | 每个按钮 | 目标段 id;两处导航里的同 id 按钮同步当前态 |
| `data-nr-section="<id>"` | 每个 `<section>` | 段落;DOM 顺序即进度顺序 |
| `data-nr-stage` | 滚动容器 | 观察器与滚动兜底的根;省略则退回页面滚动 |
| `data-nr-progress` / `data-nr-bar` | 进度线容器 / 内层条 | 脚本写 `width` 与 `--nr-progress` |

映射说明:顶导航只有 3 项(`works` / `demos` / `contact`),段轨有 4 段(`WHO` / `WORKS` / `DEMOS` / `ABOUT`)。同步按 `data-nr-target` 的值配对,所以 `contact` 与 `about` 是同一段 —— 当前段是 `who` 时只有段轨那一项亮(顶导航没有对应项)。要全量一一对应,给顶导航补一个 `data-nr-target="who"` 的按钮即可,脚本不需要改。

进度算法:`宽度 = (当前段序号 + 1) / 段数 × 100%` —— 四个段就是 25% / 50% / 75% / 100%,由脚本在每次状态同步时写入;CSS 里那 25% 只是脚本接管前的一帧兜底。

## 无障碍硬项

- 每个可点项最小命中区 `44px`(`--nr-hit`,含顶导航的三枚小写字)。
- 每个可点项都有 `aria-label`;当前项写 `aria-current="page"`,与视觉态同源(不是两套状态)。
- 键盘可达:所有按钮是原生 `<button>`;焦点环用 `:focus-visible`(不会被鼠标点击误触);段轨内上下键、顶导航内左右键、`Home` / `End` 到首尾。
- 进度线带 `role="progressbar"` + `aria-valuemin` / `aria-valuemax` / `aria-valuenow`,并随当前段更新。
- `prefers-reduced-motion: reduce` 下:跑马灯停跑(`animation: none`)、所有过渡归零、滚动改为瞬时(`scroll-behavior: auto`),脚本侧也把 `scrollIntoView` 的 `behavior` 降级为 `auto`。
- 跑马灯是纯装饰(`aria-hidden="true"`),里面的字条不参与朗读。

## 反模式

- **把跑马灯当正内容**:它是装饰层,`aria-hidden` + `pointer-events: none`;别往里放必须读到的信息(域名、电话、关键提示)。
- **两份内容之间留了空白**:轨道里两份之间夹了换行或缩进,在竖排里会折成一个空格 = 循环接缝处一条可见的缝;两份必须逐字等长且首尾相接(还要保证每一份本身超过一屏高,否则底部会露空)。
- **改小命中区**:为了"看起来更细"把 `--nr-hit` 调到 44px 以下,或者给段轨按钮加负 margin 收掉热区 —— 触屏直接点不中。
- **两处导航各写一套状态**:用 CSS `:hover` 自己模拟当前态、绕开 `aria-current`,结果是"看起来亮了但读屏不知道",键盘用户也跟丢。当前态永远走 `aria-current="page"`,由脚本统一写。
- **进度线写静态宽度**:每段都写死 25%(或写死 33%)只是装饰;段数一变就错。宽度只由脚本按段数算。
- **给 `.nr` 之外的 `html` / `body` 加样式**:组件故意不管页面级 `overflow` 与底色;接进既有页面时若需要整页锁滚,请在自己的样式表里写,别改包里的文件(升级会覆盖)。
- **靠 `data-nr-target` 之外的自定义属性**:脚本只认契约里的属性名,自创属性不会被同步。
- **段数变了忘了改 `aria-valuemax`**:脚本会在首次同步时按实际段数覆写,但如果你把进度线换成非标准结构,记得自己维护。
- **在 `prefers-reduced-motion` 下只停一部分**:必须同时停掉跑马灯动画、过渡与平滑滚动,只停一个等于没停。
- **忽略滚动条槽位**:段轨是 `position: fixed`,不会自动让开内部滚动容器的滚动条;把 `--nr-gutter` 调到 24px 以下会让段轨条压在滚动条上,滚动条出现/消失还会左右跳。要么留够 `--nr-gutter`,要么给滚动容器 `scrollbar-gutter: stable`(预览就是这么做的)。
- **用跑马灯来测性能**:它只是 `transform` 位移动画;真正的重活留给背景效果包,别把别的动效塞进这条轨道。

## 来源与许可

- 结构原型来源:自产导航 chrome demo(`demos/nav-rail-marquee`),已按公开口径脱敏:原字条里的自有域名替换为中性占位 `example.com`,内部代号替换为中性描述。
- 本包全部文件(CSS / JS / 预览 / 文档 / 断言)为本仓自产,许可 **MIT**,归属登记见 `pack.json.attribution`。
- 不包含任何第三方源码、字体文件、品牌 logo 或真实媒体内容;字体只按名字引用系统/通用等宽族,不做外部加载。
- 预览:直接双击 `preview/index.html` 即可(不依赖任何本地服务器)。
- 自检:`python packs/nav-rail-marquee/scripts/assert_tokens.py`。
