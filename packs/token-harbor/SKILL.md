---
name: token-harbor
description: Apply the Token Harbor monochrome dual-theme design language — a near-black default and a warm-white variant sharing one semantic token set, 14px body, 4px button radius, 14px card radius, hairline hierarchy, no gradients and no hue. Use when a marketing or service site or product landing page needs a full component kit (announcement bar, sticky header with language and theme buttons, tags, pricing cards, case cards, forms with validation states, footer) plus per-purpose semantic tokens in both modes.
---

# token-harbor · 墨色双模设计语言

**无色相**的一套设计语言:近黑为默认、暖白并存,两模共用同一套语义键名;
唯一强调色就是墨色本身 —— 层次靠墨/纸互换与一条细线,不靠渐变、不靠彩色状态色、标题不外挂衬线。

## When to use

- 营销 / 服务型站点与产品落地页:要结构感与克制,不要靠配色抢眼。
- 要深浅双模(近黑默认 / 暖白并存),且两模键名一致、可互换。
- 要成套构件:announce 条、吸顶 header、语言切换与主题按钮、tag / chip、作品卡、定价卡(含主推反色卡)、案例卡、流程、FAQ、联系表单与 footer。
- 要小字也达 AA:正文与次要文字两档都 ≥ 4.5:1(已实测并写进断言)。

## When not to use

- 内容型 / 杂志型长文排版(走 ouuut-editorial 或 paper-editorial)。
- 需要三套以上主题或换肤。
- 需要色相当信息编码(状态红绿、数据可视化配色)——这套语言里没有色相。
- 要的是动效而不是配色(走 motion-kit)。

## Default

`data-theme="dark"`(近黑)。默认值只写在 `css/default.css` 的 `:root`,引一个文件就能用。

| role | 近黑(dark) | 暖白(light) |
|------|-----------|-------------|
| bg | `#141413` | `#f7f6f2` |
| surface | `#1b1b19` | `#ffffff` |
| ink(正文) | `#e8e6e1` | `#17170f` |
| muted(次要文字) | `#9a9793` | `#6b6a64` |
| accent(唯一强调 = 墨) | `#e8e6e1` | `#17170f` |
| promo(反色块) | 底 `#e8e6e1` / 字 `#141413` | 底 `#17170f` / 字 `#f7f6f2` |
| footer | 底 `#0c0d09` | 底 `#11120d`(两模都深) |

## Variants and axes

| 轴 | 属性 | 取值 | 说明 |
|---|---|---|---|
| 主题 | `data-theme` | `dark`(默认) / `light` | 只翻中性色与影;`footer-*` 与 `overlay-*` 两模同值 |

## Files

| path | use |
|---|---|
| `tokens/absolute.json` | 原色表:38 个去重色值 + 6 组影,每个原子标注来源小节;含源表变量 → 本包 token 的折叠表 |
| `tokens/index.json` | 变体目录(dark / light)+ default + 两模同值的常量清单 |
| `tokens/semantic/dark.json` | 暗模语义映射(32 个 token:值 / 原子 / 用在哪) |
| `tokens/semantic/light.json` | 亮模语义映射(键名与暗模逐一对应) |
| `css/default.css` | 近黑为默认:一份 `:root` token + 全部基础 chrome,单主题直接可用 |
| `css/themes.css` | 只出 `[data-theme="dark"]` / `[data-theme="light"]` 作用域的 token 覆盖,多主题并存用 |
| `docs/usage.md` | **配谁(组件 → token)+ 双模规则 + 刻度 + 校验态 + 反模式** |
| `scripts/assert_tokens.py` | 自检:原色表 / 语义键 / 色值合法 / CSS 与语义逐条一致 / 对比度双档 / 文档与实现标记 |
| `preview/index.html` | 构件画廊(自包含、零外部子资源、加载不跳转、不依赖 localStorage) |

## Agent apply steps

1. 读 `tokens/semantic/dark.json`(或 `light.json`),**禁止自己编 hex**;需要原值出处就看 `atom` 指向的 `tokens/absolute.json` 条目。
2. 拷 `css/default.css` 进项目样式目录;要同页双模再拷 `css/themes.css`。
3. 在 `<html>` 上打 `data-theme`(近黑可省),页面根用 `.wrap`(+ `.section`)起版心与分区节奏。
4. 按 `docs/usage.md` §组件 → token 落构件类名:`announce` / `site-header` + `nav` + `lang-switch` + `theme-toggle` / `hero` / `section-head` / `work-card` / `service-card` / `sku-card`(`.is-featured` 是反色主推卡)/ `case-card` / `process-grid` / `faq-item` / `contact-form-card` + `field` / `site-footer`。
5. 切换按钮用 `<button class="theme-toggle" aria-pressed>` + 太阳/月亮两个内联 SVG(靠 `html[data-theme="light"]` 规则换图),点击只改 `data-theme`;不写 localStorage 也要能看。
6. 表单校验态走 `aria-invalid="true"` + `.field-error` + `.form-status`(`aria-live="polite"`),不要引入红色。
7. 自检:`python packs/token-harbor/scripts/assert_tokens.py`(会打印两组对比度实测值并逐条比对 CSS 与语义表)。

## Hard rules

- 只用一个强调色 = 墨本身;禁止加第二个彩色强调,禁止用色相承担状态或数据编码。
- `muted-soft`(近黑 3.53:1 / 暖白 2.81:1)只给可放弃的小字(法务页脚注),**禁止写正文**。
- 分层不用常驻阴影:卡面靠 `--surface` + `--line-hairline`,只有悬停才用 `--shadow-card` 浮起。
- 两模必须共用同一组语义键名;`footer-*` / `overlay-*` 是常量,不要各写一套值。
- `data-theme` 只写在 `<html>` 上;写在局部会漏掉页脚与表单。
- 禁止在组件里写颜色字面值(`#e8e6e1` 之类);一律走 token,否则两模与断言同时失效。
- 无渐变、无 webfont(包内零外部子资源),品牌标记用 CSS 画,不引外部图片或图标字体。
- `prefers-reduced-motion: reduce` 的降级块不许删;`--hit`(44px)是最小命中区,不许改小。
- 不在包内写域名、盘符路径、内网地址、内部标识或客户代号;示例文案用中性占位(`example.com` 之类)。
- 消费后必须在项目 `design-lock.json` 记 `assets[]`(`pack` / `version` / `sha`)。
