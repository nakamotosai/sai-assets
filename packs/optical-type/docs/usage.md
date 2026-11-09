# optical-type · 使用说明

可变字体里的**光学尺寸轴**(OpenType 标准轴 `opsz`)怎么用:四档(display / lead / body / small)各给一组轴值 +
一张同字号对照台。本包**不含字体文件**——只给轴值与配方,字体按各自许可自取。

## 什么时候用

- 站点用**带 `opsz` 轴的可变衬线**(如 OFL 的 Fraunces,实测范围 9–144)做编辑型排版,需要一套「哪档给哪个 opsz、配多重的字重」的口径。
- 大标题已经出现「字越大越显虚」的问题:那是把正文档的字形放大用了,该换更大的 opsz。
- 要一张**能验证轴是否生效**的对照台(同一字号只改 opsz,五行不该长得一样)。
- 需要与 `font-optical-sizing: auto` 配合的自动档,而不是逐处手写轴值。

## 什么时候不用

- 字族根本没有 `opsz` 轴(JetBrains Mono / Figtree / Jost 都只有 `wght`):这一包对它无效,只会让你以为 CSS 没生效。
- 要用字体文件:本包不分发字体。请按字体自身许可(OFL 等)自托管或走 CDN。
- 需要中文细体的整套档位(字重/字距/行高/阴影一网打尽):那是 `cjk-thin-type-system` 的范围。
- 需要静态字体文件加 `font-weight` 分档:静态字体没有轴,`font-variation-settings` 会被忽略。

## 接入步骤

1. 拷一个文件(纯 CSS,无脚本):

   ```text
   src/optical-type.css  →  assets/optical-type.css
   ```

2. 自己先确认字族有没有这条轴(不要凭印象):

   ```bash
   python -c "from fontTools.ttLib import TTFont; f=TTFont('X.woff2'); print([(a.axisTag,a.minValue,a.defaultValue,a.maxValue) for a in f['fvar'].axes])"
   ```

3. 包裹根挂 `.ot`,再给具体档位类:

   ```html
   <div class="ot">
     <h1 class="ot-display">大标题</h1>
     <p class="ot-lead">引导句</p>
     <p class="ot-body">正文</p>
     <p class="ot-small">小字</p>
   </div>
   ```

## 四档对照

| 档位 | 类名 | opsz | 字重 | 字号 | 行高 | 字距 |
|---|---|---|---|---|---|---|
| 展示 | `.ot-display` | 144 | 200 | `clamp(2.6rem, 9vw, 5.6rem)` | 0.94 | −0.03em |
| 引导 | `.ot-lead` | 48 | 260 | `clamp(1.25rem, 2.2vw, 1.75rem)` | 1.34 | −0.012em |
| 正文 | `.ot-body` | 24 | 340 | `clamp(1rem, 1.15vw, 1.125rem)` | 1.72 | 0 |
| 小字 | `.ot-small` | 14 | 420 | 0.875rem | 1.62 | 0.01em |

规律:**字越大 → opsz 越大、字重越轻、字距越紧**;字越小 → 反过来。这不是审美偏好,是光学尺寸轴的设计意图:
大字需要更细的笔画与更开的字腔,小字需要更厚的笔画才站得住。

## 参数

| 变量 | 默认 | 说明 |
|---|---|---|
| `--ot-opsz-display` … `--ot-opsz-small` | 144 / 48 / 24 / 14 | 四档的轴值;字族范围不同就按比例缩 |
| `--ot-wght-display` … `--ot-wght-small` | 200 / 260 / 340 / 420 | 与 opsz 配对的字重 |
| `--ot-size-*` / `--ot-lh-*` / `--ot-ls-*` | 见上表 | 字号 / 行高 / 字距 |
| `--serif` | Georgia 系回退 | 宿主给了就用宿主的字族 |

## 无障碍与硬项

- `font-synthesis: none`:缺档时禁浏览器合成假粗/假斜,否则对照台会显示并不存在的档。
- 手动 `font-variation-settings` 优先于 `font-optical-sizing: auto`;**两者别同时依赖**,想自动就别手工写轴值。
- 打印媒体查询里退回 `font-variation-settings: normal`:纸面 DPI 固定,光学尺寸的收益消失,固定字重更可预测。
- `@supports not (font-variation-settings: "wght" 400)` 分支给静态字体兜底(只改 `font-weight`),不会把文字渲染成空白。

## 反模式

- **不要**把 `opsz` 当字号用:`font-variation-settings: "opsz" 144` 不会让字变大——它是字形设计参数,字号仍归 `font-size`。
- **不要**全站只用一档:那等于放弃这条轴;至少 display / body 两档分开。
- **不要**在没轴的字族上硬写 `font-variation-settings`:静默无效,且会让你误判「字重设置失效」。
- **不要**把 `wght` 的 default 当作推荐档:Fraunces 的 `wght` 默认是 900(最粗),正文几乎一定不用它。
- **不要**给中文加 0.02em 以上的字距来「透气」:中文是等宽方块字,加字距只会破坏节奏;小字档 0.01em 是上限。

## 来源与许可

MIT(本包 CSS / JSON / 文档 / 断言为自产)。所列字族的轴值由本机 `fontTools` 读 `fvar` 实测,字体文件本身
不随包分发;各字族许可见 `tokens/opsz-axes.json` 的 `license` 字段。四档配方的规律(大字更细、小字更厚)
是 OpenType 光学尺寸轴的设计意图,不是本包自创。
