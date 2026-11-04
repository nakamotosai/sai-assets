# usage · token-harbor 配对规则

> 这套语言的核心主张:**无色相**。唯一强调色就是墨色本身,层次靠墨/纸互换(反色块)与一条细线制造;
> 没有渐变、没有彩色状态色、标题不外挂衬线。任何"用颜色区分信息"的需求都不属于这里。

## 什么时候用

- 营销 / 服务型站点与产品落地页:要一套安静的、结构感强的设计语言,而不是靠配色抢眼。
- 需要深浅双模(近黑为默认、暖白并存),并且两模共用同一套语义键名。
- 需要成套构件:announce 条、吸顶 header、语言切换与主题按钮、tag / chip、作品卡、定价卡、案例卡、流程、FAQ、表单与 footer。
- 需要小字也达到 AA:正文与次要文字两档都必须 ≥ 4.5:1。

## 什么时候不用

- 内容型 / 杂志型长文排版(走 ouuut-editorial 或 paper-editorial)。
- 需要三套以上主题或换肤。
- 需要色相当信息编码(状态红绿、数据可视化配色)——这套语言里没有色相。
- 要的是动效而不是配色(走 motion-kit)。

## 组件 → token(配谁)

| UI 部位 | token | 说明 |
|---|---|---|
| 页面底、header 背景、输入底 | `--bg` | 近黑 `#141413` / 暖白 `#f7f6f2` |
| 卡面(作品 / 服务 / 定价 / 案例 / why / 表单卡、hero 胶囊) | `--surface` | 近黑比底亮一档,暖白比底白;卡面无常驻阴影 |
| 作品卡媒体框底 | `--surface-raised` | 再高一档的面 |
| 正文与标题 | `--ink` | 近黑 14.78:1 / 暖白 16.66:1 |
| 次要文字、描述、导航默认色、图注 | `--muted` | 近黑 6.34:1 / 暖白 5.02:1 |
| 法务页脚注等可放弃的小字 | `--muted-soft` | 近黑 3.53:1 / 暖白 2.81:1,**禁止用在正文与小字信息** |
| announce 条与吸顶 header 的下边线 | `--line` | chrome 分隔线,比 hairline 略实 |
| 卡片描边、卡内分隔、faq 上下线、proof / process 分隔 | `--line-hairline` | 最细一档 |
| 输入框 / 下拉 / 文本域、次要按钮描边、卡片悬停描边 | `--line-field` | 控件一档 |
| 次要按钮悬停描边、下划线默认色 | `--line-control` | 交互一档 |
| 悬停洗色(导航、语言按钮、开关、次要按钮) | `--surface-hover` | 半透明一层 |
| 当前态 / 按下(tag 底、chip 底、`.is-active`、聚焦外环) | `--surface-pressed` | 半透明两层 |
| 主按钮底、焦点环、选中文本底、勾选态 | `--accent` | 就是墨本身,不做彩色强调 |
| 压在 accent 上的文字 | `--on-accent` | 主按钮文字、移动端 `.nav-cta`、skip-link |
| announce 条底、定价主推卡底 | `--promo-bg` | 大面积反色块 |
| 反色块上的文字 | `--promo-fg` | 主推卡的标题 / 价格 / 清单 / 按钮文字 |
| 反色块里的次要文字 | `--promo-muted` | 主推卡的档位名、单位、描述 |
| 反色块里的 tag 底 | `--promo-tag-bg` | 主推卡上的「推荐」标签 |
| 页脚底 / 页脚文字 | `--footer-bg` · `--footer-fg` | 两模共用同一块深色,页脚是全站唯一固定深色区 |
| 页脚列标题 / 链接 / 正文 / 品牌副标 | `--footer-strong` · `--footer-link` · `--footer-muted` · `--footer-faint` | 页脚内部四级 |
| 页脚底栏上边线 / 品牌副标左边线 | `--footer-line` · `--footer-line-strong` | 页脚内部两条线 |
| 媒体图上的类型徽标 | `--overlay-bg` · `--overlay-fg` · `--overlay-line` | 与主题无关,两模同值 |
| 主按钮 / 卡片悬停 / hero 胶囊 | `--shadow-btn` · `--shadow-card` · `--shadow-pill` | 影只有三档,只给浮起元素 |

## 双模怎么切

```html
<html data-theme="dark">   <!-- 默认,可省 -->
<html data-theme="light">  <!-- 需要同时引入 css/themes.css -->
```

- `css/default.css` = `:root` 近黑 token + 全部基础 chrome;**单主题直接可用**,不引第二份文件也不会串色。
- `css/themes.css` = **只出** `[data-theme="dark"]` / `[data-theme="light"]` 两个作用域的 token 覆盖,不含构件规则;与项目自带主题体系并存时用这一份。
- 切换按钮:44px 命中区(`--hit`)、纯图标(浅色太阳 / 深色月亮)、`aria-pressed` 写当前是否暖白、`aria-label` 写"切到哪个模式";**不依赖 localStorage 也要能看**(预览页就是零存储的实现)。
- 想跟着系统走就加一份 `prefers-color-scheme` 的默认值,但页面上的显式 `data-theme` 必须优先。
- 建议同时更新 `<meta name="theme-color">`:近黑 `#141413`、暖白 `#f7f6f2`。

## token 折叠(源表变量 → 本包)

源样式表里有三个变量只被定义、没有被任何构件引用;本包不另立同名 token,值仍在:

| 源变量 | 本包 | 处理 |
|---|---|---|
| `--accent-fg` | `--accent` | 与墨色同值,语义并入 accent |
| `--accent-bg` | `--surface-pressed` | 与当前态洗色同值同原子 |
| `--border` | `--line` | 同原子;源构件全部走 hairline / field / control 三档,本包把 `--line` 用在 chrome 分隔线上 |

另有两处**刻意的归一化**(不是漏项,断言与文档同步):

1. 主按钮文字:源表用 `--card` 色,本包统一为 `--on-accent`(= 页面底)。差别只有 0.03 亮度,但口径统一后「accent 上的字」只有一条规则。
2. 主推卡:源表为暖白写了整整一组 `html[data-theme="light"]` 覆盖;本包改成 `--promo-*` 四件套,两模共用同一组规则,不再有模式分支。

## 刻度

字号十一档(`--fs-*`):`display 64` / `section 40` / `case 20` / `sub 18` / `card 17` / `lede 16` / `body 14` / `small 13` / `meta 12` / `caption 11` / `eyebrow 10.5`;
组件局部的 `10 / 11.5 / 12.5 / 13.5` 是子档,直接写字面值,不进 token(避免"每半像素一个变量")。

圆角(`--radius-*`):按钮与输入框 `4px`、移动端导航项 `6px`、icon chip `10px`、卡片与主推卡 `14px`、tag 与 hero 胶囊为整圆。

布局:`--maxw 1240px` / `--maxw-narrow 880px` / `--wrap-x 24px` / `--sec-y 80px` / 锚点偏移 `--anchor-offset 96px` / 最小命中区 `--hit 44px`。

动效(`--dur-*` + `--ease`):快互动 `0.16s`、常态 `0.18s`、影与主题过渡 `0.2s`、图像缩放 `0.4s`,`cubic-bezier(0.22, 0.61, 0.36, 1)`;
`prefers-reduced-motion: reduce` 下全部动画与过渡降到 `0.01ms`,卡片悬停不再位移。

## 表单校验态

这套语言没有色相,所以报错不靠红:靠三件事 —— 输入框描边提到墨色并加一圈内描边(`aria-invalid="true"`)、
错误行前置一个圆形叹号(`.field-error::before`)、一句说明文案。校验态与成功态都只改字重与描边:

```html
<label class="field">
  <span>邮箱</span>
  <input type="email" aria-invalid="true" aria-describedby="email-error">
  <span class="field-error" id="email-error">邮箱格式不对,例如 name@example.com</span>
</label>
```

- 提交结果写进 `.form-status`(`.is-ok` / `.is-error` 只加字重,不变色),容器带 `aria-live="polite"`。
- 通过校验后必须移除 `aria-invalid`,并把错误行 `hidden` 回去。
- 蜜罐字段用 `.honeypot`(移出视口,不占布局),不要用 `display:none`——那会被部分爬虫识别。

## 接入步骤

1. 读 `tokens/semantic/dark.json`(或 `light.json`)拿到语义色,**禁止自己编 hex**;每条的 `atom` 字段指向 `tokens/absolute.json` 里的原色原子。
2. 把 `css/default.css`(单主题)或 `css/default.css` + `css/themes.css`(双模)拷进项目静态资源目录。
3. 在 `<html>` 上打 `data-theme`(默认近黑可省),并按需在 `<body>` 上用 `.wrap` / `.section` 起版心与分区节奏。
4. 品牌标记 `.brand-mark` 是纯 CSS 画的方框含内芯,**不是**某个站点的 logo;换成自有图形时保持 28px(页脚 26px、窄屏 24px)与 `currentColor`,不要引入外部图片或图标字体。
5. 字体:包内**不引 webfont**(保证零外部子资源),用 `--font-sans` 的系统栈回退;项目要自托管字体时自行加 `@font-face`,不要改这套 token 的名字。
6. 自检:`python packs/token-harbor/scripts/assert_tokens.py` —— 它会把两组对比度实测值打印出来,并逐条比对两份 CSS 与语义表。

## 取用

```bash
python <sai-assets>/scripts/apply.py token-harbor --to src/styles
```

```html
<link rel="stylesheet" href="styles/token-harbor/default.css">
<link rel="stylesheet" href="styles/token-harbor/themes.css">
<html data-theme="dark">
```

消费后在项目 `design-lock.json` 记 `assets[]`:`pack=token-harbor`、`version`、`sha`(见 `docs/USAGE-INTEGRATION.md`)。

## 反模式

- 给这套语言加第二个彩色强调色;或者用彩色表示状态(成功 / 危险 / 警告)。这里只有墨色,a11y 状态靠文案与描边。
- 用 `muted-soft` 写正文或小字信息:近黑 3.53:1、暖白 2.81:1,是明确低于 AA 的一档。
- 给卡片加常驻阴影"分层";卡面靠 `--surface` 与一档细线,只有悬停才浮起。
- 用 `--accent` 之外的墨色值当强调(直接写 `#e8e6e1` / `#17170f` 之类字面值);硬编码会让两模与断言同时失效。
- 把 `[data-theme]` 写在 `<body>` 或单个卡片上:token 定义在 `:root` / `[data-theme]` 作用域,写在局部会漏掉页脚与表单。
- 用 `!important` 改 token,或在项目里再复制一份 `:root` 变量表(那就成了第二真相源,断言照不到)。
- 主推卡的按钮直接写死墨色;要用 `--promo-fg` / `--promo-bg` 这对(反色块里再翻一次)。
- 深浅切换偷偷写 `localStorage` 之后忘了无 JS 兜底:不写存储也必须能看,写了也要能在首屏前应用。
- 用渐变、玻璃拟态、彩色描边"提亮"这套语言;它要的就是无渐变、无色相。

## 来源与许可

- 来源:本站自有的营销 / 服务型站点样式表 `assets/css/site.css`(1025 行,只读原料),拆成 token 表 + 两份 CSS + 断言;见 `pack.json.attribution` 与 `tokens/absolute.json.source_map`。
- 许可:MIT(本家自产)。包内不含第三方素材、不含 webfont、不含站点自有 logo 图形。
- 文档里的邮箱、公司名、价格与案例文案都是中性占位,只为验证排版,不构成任何报价或背书。
