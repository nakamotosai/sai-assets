---
name: optical-type
description: A four-tier recipe for variable fonts with an optical-size axis (opsz) — display, lead, body and small each get a matched opsz, weight, size, leading and tracking, plus a same-size comparison strip that proves whether the axis is actually live. Use when editorial typography must hold up from a 5.6rem headline down to 14px small text, or when big type looks weak because body glyphs were simply scaled up.
---

# optical-type

可变字体的**光学尺寸轴**(`opsz`)四档配方。大字自动变细、小字自动加厚;**不含字体文件**。

## When to use

- 用带 `opsz` 轴的可变衬线(如 OFL 的 Fraunces,实测 9–144)做编辑型排版,要一套「哪档给哪个 opsz、配多重字重」的口径
- 大标题「字越大越显虚」——那是把正文档字形放大用了,该换更大的 opsz
- 要一张能验证轴是否生效的对照台(同字号只改 opsz,五行不该一样)
- 要用 `font-optical-sizing: auto` 的自动档,而不是逐处手写轴值

## When not to use

- 字族没有 `opsz` 轴(JetBrains Mono / Figtree / Jost 只有 `wght`):本包对它无效,只会让你以为 CSS 没生效
- 需要字体文件:本包不分发字体,按各字体许可自托管或走 CDN
- 需要中文细体的整套档位:走 `cjk-thin-type-system`
- 静态字体加 `font-weight` 分档:静态字体没有轴,`font-variation-settings` 被忽略

## Default

| 档位 | opsz | 字重 | 字号 | 行高 | 字距 |
|---|---|---|---|---|---|
| display | 144 | 200 | `clamp(2.6rem,9vw,5.6rem)` | 0.94 | −0.03em |
| lead | 48 | 260 | `clamp(1.25rem,2.2vw,1.75rem)` | 1.34 | −0.012em |
| body | 24 | 340 | `clamp(1rem,1.15vw,1.125rem)` | 1.72 | 0 |
| small | 14 | 420 | 0.875rem | 1.62 | 0.01em |

规律:字越大 → opsz 越大、字重越轻、字距越紧。

## Files

| path | use |
|---|---|
| `src/optical-type.css` | 四档 + 自动档 + `@supports` 兜底 + 打印退回(作用域 `.ot`) |
| `tokens/opsz-axes.json` | 本机实测的轴范围与「是否真有 opsz」(可核对) |
| `tokens/index.json` | 包目录 + 与相邻包的分工 |
| `preview/index.html` | 活预览:四档 + 同字号五行对照(轴不生效时五行相同 = 验证法) |
| `docs/usage.md` | 档位表 + 参数 + 硬项 + 反模式 |
| `scripts/assert_tokens.py` | 契约 / 引用 / 产物 / 轴数据自洽 / 标记齐全 |

## Agent apply steps

1. 拷 `src/optical-type.css` 到项目 `assets/`。
2. **先验轴**:`fontTools` 读 `fvar`,确认有 `opsz` 及其范围;没有就别用这包。
3. 包裹根 `.ot`,给档位类 `ot-display / ot-lead / ot-body / ot-small`。
4. 想自动就只写 `font-optical-sizing: auto`,别同时写 `font-variation-settings`(手写优先)。
5. 小字档字距最多 0.01em;中文正文不加字距。

## 硬规则

- `font-synthesis: none`:缺档时禁浏览器合成假粗假斜,否则对照台会显示不存在的档。
- 字体文件不入包;轴值必须是实测值,不是抄文档。
- 没有 opsz 的字族标 `has_opsz:false`;假轴会把「全都一样」误诊成排版 bug。
- `opsz` 不是字号:它不改字形大小,只改设计参数。
- 打印媒体查询退回 `font-variation-settings: normal`。
