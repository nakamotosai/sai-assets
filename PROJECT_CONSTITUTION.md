# PROJECT_CONSTITUTION · sai-assets

## 是什么

公开的可复用网页资产库:主题配色与字体、网页动效、UI 组件、排版配方、外部参考观测。单位是**包(pack)**,不是一个网站。

## 为什么存在

旧主题库(本地私有素材源)生产端完整、消费端为零:几个月只被 2 个项目手抄过 token,唯一真被复用的 `param-panel` 还被拷了 12 份并漂移。本仓把"能被用起来"作为唯一成功判据:包自带入口、产物、配对规则与断言,消费侧有 `catalog.json` + `apply.py` + `design-lock.json` 三条落地路径。

## 非目标

1. 不做营销站 / 组件 npm 发包(资产是抄进项目的,不是运行时依赖)。
2. 不做按类别分仓(见 ADR-0001 落选者)。
3. 不做 MCP server。
4. 不承载视频类(Remotion)资产,只索引其本家。
5. 不进任何含第三方品牌/客户内容/未授权素材的资产(白名单外一律不灌)。
6. 不把"目录建好了 / CI 绿了"当完成;完成 = 至少一个真实项目消费过一次。

## 铁律

- 公开不可撤回:闸门先于提交(`scripts/gate.py`)。
- 单一真相源:包进本仓后,旧库对应条目同轮改索引;外部已有本家的包只索引不复制。
- 包级版本、只增不改;行为改动抬版本并留 CHANGELOG 一行。
- 断言必须真跑过并把输出贴进 `pack.json.verified.evidence`。

## 事实源

| 面 | 位置 |
|---|---|
| 公开资产(唯一对外) | `github.com/nakamotosai/sai-assets`(本仓) |
| 素材 / 草稿(私有,本地) | 旧主题库(现为素材源,不进本仓) |
| 设计规则(harness 级) | `skill://sai-frontend` + `skills/sai-frontend/references/` |
| 消费落地 | 各项目 `design-lock.json.assets[]` |
| 展示站 | Cloudflare Pages(`https://assets.ouuut.com`;CF 项目 `sai-assets`,直传 `dist/`) |
