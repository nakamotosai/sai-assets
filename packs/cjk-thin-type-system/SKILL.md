---
name: cjk-thin-type-system
description: Apply a thin-weight CJK type language (4 size tiers, 3 tracking tiers, 3 line-height tiers, 2 text-shadow tiers, 12px floor, bigger-is-thinner weight ladder) to dark single-page sites, portfolios and personal sites. Use when CJK type looks inconsistent — one size carrying several weights, every component writing its own line-height/letter-spacing/shadow — or when a site must read "thin, clean, one language".
---

# cjk-thin-type-system

一套中文**细体**排版语言:字号 4 档 / 字重 2 档 / 字距 3 档 / 行高 3 档 / 文字影 2 档。组件只继承,不再自己写 `font-size` / `font-weight` / `letter-spacing` / `line-height` / `text-shadow`。

## When to use

- 中文 / 日文**暗底**单页站、作品集、个人站,要求「细、干净、一套语言」
- 站点已经「字体乱」:同一字号挂多字重、每个组件一套行高 / 字距 / 阴影(先跑审计探针普查,再按本包收敛)
- 需要把响应式字号写成不可漂移的档位(而不是各断点改 `font-size`)

## When not to use

- 明亮纸媒长文 / 正文阅读 → `cjk-typography` 的 `article` 衬线栈
- 控制台、地图 HUD、内网工具 → 系统栈(`cjk-typography` 的 `sys-console` 档)
- 需要粗体力量感的营销落地页、霓虹 / 赛博风
- 只要概念、不管字族:`cjk-typography`

## Default

默认整站 = `body` 档:`17px` / 字重 `200` / 字距 `0` / 行高 `1.6` / 单层影 `0 1px 2px rgba(0,0,0,.9)`。

## Files

| path | use |
|------|-----|
| `tokens/index.json` | 五个轴的目录、默认档、地板与硬规则 |
| `tokens/scale.json` | 字号 4 档(giant / display / title / body)+ 每档绑定的字重 / 字距 / 行高 / 影 |
| `tokens/weights.json` | 字重 2 档(text 200 / mark 600)+「越大越细」配对阶梯 |
| `tokens/tracking.json` | 字距 3 档 + 中文禁字距 / 禁两端对齐 |
| `tokens/leading.json` | 行高 3 档(1.4 / 1.35 / 1.6)+ 最小行高 1.35 |
| `tokens/shadow.json` | 文字影 2 档 + 第二层只给 ≥28px |
| `docs/usage.md` | **配对规则 + 地板 + 反模式 + 审计探针** |
| `preview/index.html` | 活预览(档位阶梯 + 字号 / 行高 / 影对照) |
| `scripts/assert_tokens.py` | 断言:产物齐备 · 档位自洽 · 字号地板 · 最小行高 · 禁 `vw` 外推 |

## Agent apply steps

1. 读 `tokens/index.json`,把 `floors` 与 `rules` 当硬约束;再按页面元素读 `tokens/scale.json` 取档。
2. 字族去 `cjk-typography` 取(本包不下发字族);本包只决定档位。
3. 把六个 token 文件里的值抄进项目的 `:root`(变量名自定),**不要**在组件里写裸数值。
4. 组件的排版声明只允许「继承」或「挂某个档」两种写法;确需换档,挂 `scale.json` 里的档 id。
5. 收尾:改完跑 `python <pack>/scripts/assert_tokens.py`;若项目里有预览,顺手把审计探针那三条(字号地板 / 最小行高 / `vw` 外推)对本项目样式表跑一遍。

## Hard rules

- **地板 12px**:任何中文文字不许小于 12px;12px 起必须 400 字重。
- **越大越细**:200 只准 ≥17px;300 只准 ≥14px;400 只准 ≤12px。同一字号只挂一种字重。
- **最小行高 1.35**,且行高绑字号档、不绑组件。
- **细体只配单层影**;第二层扩散影只给 ≥28px。
- **禁用 `vw` 外推上限**:`clamp()` 的中段可以用 `vw`,上限必须是绝对单位。
- **CJK 禁斜体**、**禁 `border-bottom` 当前下划线**(中文没有斜体字形,合成斜体会糊;下划线会切掉下伸笔画)。
- 中文正文不加字距,禁两端对齐。
- 按钮不吃继承:`button,input,select,textarea{font:inherit;letter-spacing:inherit;text-shadow:inherit}`。
- 拉丁显示字族只给纯拉丁字标;给中文元素会**静默回落**宋体。
