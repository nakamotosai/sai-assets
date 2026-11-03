# usage · cjk-typography 中文排版四件套

> 先定**场景与字族**,再谈档位。档位(几档字号、多细、多宽、多高、几层影)在 `cjk-thin-type-system`;本包只管「用哪些字、多大」。

## 1 三场景字号表(数字即口径)

| 场景 | h1 | body | meta / 脚注 | code | 备注 |
|---|---|---|---|---|---|
| **工具台** | 15–22px | 14px(HUD 12) | 11–12px | 11–13px | 零 Web 字体优先;数字 `tabular-nums` |
| **纸媒 / 电视 1920** | 64–110px(封面可 100+) | ≥40px | ≥26px | — | Serif 标题 + Sans 正文;真字重 |
| **营销落地** | `clamp(2rem–7rem)` 负字距 | 16–17px · lh 1.55–1.65 | mono eyebrow ~0.72rem · ls .14–.2em | mono 元信息 | 手写体 / 衬线只上拉丁标题;正文用中文安全栈 |

- 一个屏幕只有一套场景,不跨场景混用数字。
- 工具台的 `meta 11–12px` / `code 11–13px` 是**拉丁与数字标签**的档;中文标签取上限 **12px** —— 与 `cjk-thin-type-system` 的 12px 中文地板同口径(不是两套标准)。
- 等宽一律 JetBrains Mono;印刷 / 波普风可换 Space Mono。

## 2 字族与回退栈(四个角色)

| 角色 | 字族栈 | 什么时候用 |
|---|---|---|
| 正文 / UI | `"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif` | 一切正文与界面 |
| 显示 / 标题 | 同正文栈 | 标题不用衬线时;要衬线标题走主题包的 display 档 |
| 长文阅读 | `"Noto Serif SC", "Source Han Serif SC", "Songti SC", serif` | `article` 长文正文 |
| 等宽 | `"JetBrains Mono", "Maple Mono NF CN", ui-monospace, monospace` | 代码、数字、eyebrow |

- **`SimSun` / 宋体 / `serif` 禁入 `body` 回退栈**:静默回退到宋体是硬错误(字形与字面全变),不是风格选择。
- 字号地板:正文 16px(移动 15px)· 次级 / 卡片 14px · 角标 12px · 整页可读最小 14px;卡片禁 9 / 10 / 11 / 13px;标题 20px 起、层级差 ≥4px。
- 行高:中文正文 1.7–1.8 · 长文衬线 ≥1.6。中文正文**禁** `letter-spacing`、**禁**两端对齐。
- 字重:正文 400–500 · 强调 700;**中文 11–15px 不许挂 300 以下**(「300 陷阱」:笔画溶解);禁加粗宋体冒充黑体。
- 大容器字号 ≥ 同屏小容器。

## 3 免费细体中文三选(许可 + 来源)

「中文要细、要高级、**免费商用**」的三个候选。三份都免费可商用、都有真细体、都按 `unicode-range` 分片(浏览器只拉页面实际用到的字形)。

| 字体名 | 许可 | 下载来源(npm 包 · CDN 文件) |
|---|---|---|
| Noto Sans SC(可变) | OFL-1.1(SIL Open Font License 1.1) | `@fontsource-variable/noto-sans-sc@5.3.0` · `https://cdn.jsdelivr.net/npm/@fontsource-variable/noto-sans-sc@5.3.0/index.css` |
| MiSans VF | Apache-2.0(三份里最宽松) | `misans@5.0.0` · `https://cdn.jsdelivr.net/npm/misans@5.0.0/lib/Normal/MiSansVF.min.css` |
| HarmonyOS Sans SC | Unlicense(等同公有领域) | `harmonyos-sans-sc-webfont-splitted@1.1.0` · `https://cdn.jsdelivr.net/npm/harmonyos-sans-sc-webfont-splitted@1.1.0/dist/Light.css` |

- 三份**只引用字族名 / 走 CDN,不随包分发字体文件**;许可与版本随上游走,落地时把版本号钉死。
- 每条来源都在 **2026-10-06 实查过 npm 与 CDN**(unicode-range 分片:Noto 101 片 / HarmonyOS 82 片 / MiSans 80KB CSS)。**上游项目主页未联网核对 → 标「待核」**;要写进对外文档前请自行核一次。
- 选型:许可最宽松 → **MiSans**;要几何方正 → **HarmonyOS Sans SC**;要中性稳妥 → **Noto Sans SC**。
- 可变轴:Noto `100–900` · MiSans `150–700`;HarmonyOS 分片包按档给(如 Light 300)。
- 字重分档而不是全局统一:**首屏那两行(15px / 25px)才压得住 150**,其余一律 300;中文 11–15px 别再往下拉。
- 拉丁与中文分家:UI 字族用 `"Inter", var(--f-sans)` 打头,拉丁走 Inter,中文自然落到中文栈。

### 子集化(必做)

CDN 直连实测 **1.5–2.4MB**(整页滚完);而页面唯一字符往往只有两三百个 → 本地子集化可压到 **20–40KB**,差 **50 倍**。上 Web 字体必须 `font-display:swap` 防 FOIT,并做子集化。

## 4 系统栈(零 Web 字体)

| 角色 | 栈 |
|---|---|
| UI / 正文 | `system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif` |
| 等宽 | `"JetBrains Mono", "Cascadia Code", Consolas, monospace` |

字重 400 / 600 / 700,数字开 `tabular-nums`,不引外部字体请求。适用于控制台、地图 HUD、内网工具。系统栈的取值随操作系统,视觉不可完全控制;**要「一套语言」的暗色单页站走 `cjk-thin-type-system`,不要拿系统栈硬凑**。

## 5 反模式

- **推荐需盗版 / 破解的商业字体文件**;或把商业字族连同字体文件一起塞进项目(本包一条都不收)。
- 列了字体名却不写**许可与来源**;把「来源未核」写成「已验证」。
- `serif` / 宋体 / `SimSun` 混进 `body` 回退栈(换台机器静默变宋体)。
- 中文 15px 挂 300 字重;或给加粗宋体冒充黑体。
- 中文正文加 `letter-spacing`、`text-align: justify`。
- 不子集化直接整包拉中文字库(整页 1.5–2.4MB)。
- 拿日文字重当中文品牌字重(有 `@font-face` 必须挂 SC 安全回落)。
- 跨场景抄数字:把纸媒 1920 的 `≥40px` 正文塞进工具台。

## 6 取用

```bash
python <sai-assets>/scripts/apply.py cjk-typography --to src/tokens
```

消费后在项目 `design-lock.json` 记 `assets[]`:`pack=cjk-typography`、`version`、`sha`,并把选中的字体名 + 许可 + 来源一并记下(见 `docs/USAGE-INTEGRATION.md`)。
