# sai-assets · 可复用网页资产库(themes / web-fx / web-ui / fonts)

> 一个包 = 一个能直接抄进项目的自洽单元:配色与字体、配对规则、断言、活预览。
> 公开仓:`github.com/nakamotosai/sai-assets` · 预览墙:GitHub Pages
> 事实源:nakotosai/gruvbox-theme(单包成品范例)、sai-assets `docs/PACK-CONTRACT.md`

## 状态

- 阶段:**M2 完成(29 包全绿)→ M3/M4 收尾**
- 里程碑树:`TRACK_TREE.md` · 范围白名单:`docs/WHITELIST.md` · 包契约:`docs/PACK-CONTRACT.md`
- 决策记录:`docs/adr/adr-0001-single-repo-multi-pack-fresh-history.md`

## 取用(三条通道,按零依赖优先)

```bash
# 1) 人 / agent:克隆后读目录,再进单包 SKILL.md
git clone --depth 1 https://github.com/nakamotosai/sai-assets.git
cat sai-assets/catalog.json            # 紧凑目录(≤8KB)
cat sai-assets/packs/paper-editorial/SKILL.md

# 2) 项目:拷贝式应用(无运行时依赖)+ 记版本
python sai-assets/scripts/apply.py paper-editorial --to src/styles

# 3) 收一个新包(从项目里 harvest,自动 sanitize + 闸)
python sai-assets/scripts/harvest.py <id> --from <项目目录> --kind fx --category web-fx \
    --when "何时用" --not-for "何时不用" --license MIT --entry index.html --usage <已有用法文档>

# 4) 零安装单文件(固定版本)
curl -O https://cdn.jsdelivr.net/gh/nakamotosai/sai-assets@pack/paper-editorial@1.0.0/packs/paper-editorial/css/default.css
```

消费后须在项目 `design-lock.json` 记 `assets[]`(见 `docs/USAGE-INTEGRATION.md`)。

## 类目

数量以 `catalog.json` 为准(不在文档里写死,防漂移):

| 类目 | 内容 |
|---|---|
| `themes` | 主题:配色 + 字体 + 配对规则 + 变体(含外部索引项) |
| `fonts` | 中文排版配方(细体语言 / 字号档 / 免费字体清单) |
| `web-fx` | 背景动效(共享引擎)、过场、粒子、三维 |
| `web-ui` | 调参底座、深浅切换、deck 母版、WebGPU 玻璃、导航、瑞士风格包 |
| `fx-engines` | 动效引擎 / 调参板底座(被上面几类引用) |
| `references` | 外部站点观测(选型依据,只写结论不带原图原码) |
| `video-motion` | Remotion 视频动效,仅索引;内容在其本家 |

## 进度

- **M0 建档拍板** ✅ 生产根 + 门规 + ADR-0001 + PACK 契约 v1 + 公开收录判据 `docs/SCOPE.md`
- **M1 单包打通** ✅ 生成器 + 清洗闸 + catalog + 墙 + 公开仓 + Pages + skill 取用协议 + 一次真消费(`design-lock.assets[]` 已记版本)
- **M2 存量迁移** ✅ 29 包:themes 14 · fonts 2 · web-fx 4 · web-ui 6 · fx-engines 1 · references 1 · video-motion 1(索引)
- **M3 自动化** ⏳ CI 已绿(gate + pages);tag/release 可用;harvest → PR 回收链已备待跑一次真 PR
- M4 私有侧收口 ⏳ 旧库已降级;待:旧私仓归档、最终 closeout

## 链接

- `TRACK_TREE.md` 里程碑与验收 · `SPEC.md` / `PLAN.md` 当前里程碑
- `progress.md` 会话流水 · `HANDOFF.md` 接手(首次收口时生成)
- 素材源(私有,本地):旧主题库 → 只作素材与草稿,不再是公开资产真相源
