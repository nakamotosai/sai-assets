---
name: cjk-typography
description: CJK typography recipe pack — body sans fallback stacks, a three-scene type-size table (console / 1920 print-and-TV / marketing landing), the zero-web-font system stack, and three free-for-commercial-use thin CJK faces with explicit licenses and download sources. Use when starting a Chinese/Japanese project and deciding font stacks, size floors, or a free thin CJK webfont; skip when the task is about size tiers, line-height, tracking or text-shadow convergence.
---

# cjk-typography

中文排版四件套合成一包:**用哪些字 + 多大**。四张来源卡:正文无衬线回退栈、三场景字号总表、系统等宽栈、免费细体中文三选(纯许可清单)。

## When to use

- 新中文项目**定字族**:正文 / UI / 长文衬线 / 等宽四个角色各用什么
- **对字号**:先判断是工具台、纸媒电视 1920 还是营销落地,再照表取数
- 需要「中文要细、要高级、**免费商用**」的正文:三选候选 + 许可 + 下载来源都在这
- 零 Web 字体场景(控制台 / HUD / 内网工具):直接用系统栈

## When not to use

- 档位收敛(几档字号 / 字距 / 行高 / 文字影、地板 12px、越大越细):走 `cjk-thin-type-system`
- 配色与主题:走 themes 类包
- 需要商业字体文件:**本包不提供**;也不接受"从哪下破解版"这类用法

## Default

正文 / UI = `"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`;长文阅读切 `article` 衬线栈;工具台走 `system-ui` 系统栈。

## Files

| path | use |
|------|-----|
| `tokens/index.json` | 四张卡的目录 + 与 `cjk-thin-type-system` 的分工 + 硬规则 |
| `tokens/body-sans.json` | 正文无衬线回退栈(4 个角色)+ 字号地板 + 300 陷阱 |
| `tokens/size-scale.json` | 三场景字号总表:工具台 / 纸媒电视 1920 / 营销落地 |
| `tokens/console.json` | 系统栈(零 Web 字体的工具台默认) |
| `tokens/free-thin-cjk.json` | 免费细体中文三选:许可 / 可变轴 / 下载来源 / 子集化 |
| `docs/usage.md` | **三场景表 + 免费字体清单(字体名 / 许可 / 来源三列)+ 反模式** |
| `preview/index.html` | 活预览(三场景字号对照 + 三选字族展示) |
| `scripts/assert_tokens.py` | 断言:产物齐备 · 三场景数字 · 清单三列齐 · preview 引用 · 字号地板 |

## Agent apply steps

1. 读 `tokens/size-scale.json`,按项目场景取一行数字(工具台 / 纸媒电视 1920 / 营销落地),不要跨场景混用。
2. 读 `tokens/body-sans.json` 取回退栈;**禁止**自己编字族顺序,`serif` / 宋体不许进 `body`。
3. 要细体中文:读 `tokens/free-thin-cjk.json`,按「许可最宽松 / 要几何 / 要中性」三选一,连许可与下载来源一起抄进项目 `design-lock.json`。
4. 上 Web 字体必须挂 `font-display:swap` 并子集化;零 Web 字体场景改读 `tokens/console.json`。
5. 档位(几档、多细、多宽)去 `cjk-thin-type-system` 取,本包不给档位。

## Hard rules

- 清单只列**许可明确**的字体,逐条给「字体名 | 许可 | 来源」;许可或来源没核到就写「待核」,不许当已验证。
- **禁推荐需盗版 / 破解的商业字体文件**;商业字族最多只写字族名。
- `SimSun` / 宋体 / `serif` 禁入 `body` 回退栈(静默回退 = 硬错误)。
- 中文 11–15px 不许挂 300 以下字重(笔画溶解);小字抬字重,不要往下拉字重。
- 中文正文禁 `letter-spacing`、禁两端对齐。
- 工具台场景 meta `11–12px` / code `11–13px` 是拉丁与数字标签的档;**中文标签取 12px 上限**,与 `cjk-thin-type-system` 同口径。
- 有 `@font-face` 必须挂 SC 安全回落;不把日文字重当中文品牌字重。
