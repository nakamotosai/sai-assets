---
name: video-motion
description: Index entry for the external Remotion video-motion project (mv-studio) — 16 archetypes (15 finished shots plus a placeholder fallback), a riso style pack, and beat/motion libraries. Use when a task is "turn a song into a printed-look music video"; never use it as a source of copyable web CSS/JS — nothing is stored in this repo.
---

# video-motion

**外部包的索引条目**:内容不在本仓。本仓只有 `pack.json`、这一页与 `README.md`;`files` 全空、零复制。

## When to use

- 任务是把一首歌排成一支**印刷质感**的 MV / 歌词影像 / 音乐可视化
- 需要下列镜头语言之一(外部工程的 16 个 archetype):
  开场标题板 · 最响的标题行 · 单张照片推镜 · 剪贴簿拼贴 · 动态歌词排版 · 单据 / 清单 · 印章 · 表盘 · 纸片倾泻 · 静态诗行(含竖排)· 注解图 · 对白气泡 · 真实音频频谱 · 圆形遮罩过场 · 结尾署名板 · `Placeholder` 兜底
- 需要一套**孔版印刷外观**(riso 风格包:四色专色 + 暖色纸 + 半调网点 + 套印错位 + 点阵字)
- 需要把**节拍网格**或**摄影机关键帧**接到镜头上(beat / motion 库)

## When not to use

- 要网页动效(CSS / WebGL / 粒子 / 过场)→ web-fx 类包
- 要可抄进网页的组件、版式、配色 → web-ui / themes 类包
- 期望在本仓读到源码:本仓不承载内容;**`canonical_home` 现为 `null`**(外部工程无远端),当前只能按本机私有工程取用

## Files

| path | use |
|------|-----|
| `pack.json` | 索引条目:`kind=meta` · `category=video-motion` · `external=true` · `canonical_home=null` · `files` 全空 |
| `README.md` | 人读首屏:它管什么、为什么只索引、替代品在哪 |
| `SKILL.md` | 本文件:agent 的取用判据与硬规则 |

## Agent apply steps

1. 先判**运行模型**:任务要是「渲染成片」而不是「网页上跑」,才继续;否则退回 web-fx / web-ui 类包。
2. 去外部工程(`mv-studio`)取用;本仓**不提供**任何可拷文件 —— 不要指望在本仓 `packs/video-motion/` 里找到 `src/` 或 `css/`。
3. 选定 archetype 与风格包后,按该工程自己的 README / 脚本渲染;本包不代管其构建方式。
4. 消费后在项目 `design-lock.json` 记一行:`pack=video-motion`、说明为「外部索引,内容在 `mv-studio`」;`canonical_home` 回填前不要写远端 URL。

## Hard rules

- **禁**把该工程的内容复制进本仓(单一真相源;复制 = 第二份会漂移的真相)。
- **禁**在本仓为它造 `src/` / `css/` / `preview/`(本包 `files` 全空是设计,不是待办)。
- **禁**臆造 `canonical_home`:外部工程当前**无远端**,故为 `null`;补双远端并首推成功后回填,并同步 `verified.evidence`。
- 取用前先确认许可:该工程为私有 / `UNLICENSED`,渲染框架另有一套上游条款(部分实体需公司授权)。
- 本包不承载网页资产,不要把它的镜头语言当成 CSS 片段抄给浏览器。
