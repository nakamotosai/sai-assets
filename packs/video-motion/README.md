# video-motion · mv-studio(只索引,内容不在本仓)

**视频动效不走本仓的承载模型**:那是 React + Remotion CLI 渲染成片,与网页的 DOM / CSS 运行时不同。所以这一条只是**索引**:本仓登记「有这么一套东西、它管什么」,内容留在外部工程里,不复制。

| 项 | 值 |
|---|---|
| 包 id | `video-motion` |
| 类别 | `video-motion`(只索引) |
| 内容本体 | 外部视频工程 `mv-studio`(Remotion 4.0.539) |
| `external` | `true` |
| `canonical_home` | `null` —— 外部工程**无远端**(单 commit、零备份),补双远端后回填 |
| 本仓内容 | 只有索引卡:`data/index.json`(22 张)与 `preview/index.html`;零源码、零图片、零视频 |

## 它管什么

- **16 个 archetype 注册项**:15 个成品镜头 + 1 个 `Placeholder` 兜底(打印 shot id 与时间码,用来找缺口)
- **riso 风格包**:四色专色 + 暖色纸 + 半调网点 + 故意套印错位 + 点阵字,一套孔版印刷外观
- **beat / motion 库**:节拍网格(每拍重音 + 小节 + 段落能量)与摄影机关键帧,都是 `frame` 的纯函数,因此并行渲染帧准确

| 用途 | 去这里 |
|---|---|
| 要做 MV / 歌词影像 / 音乐可视化 | 外部工程 `mv-studio` |
| 要网页动效(CSS / WebGL / 粒子) | web-fx 类包 |
| 要网页组件 / 版式 / 配色 | web-ui、themes 类包 |

## 活预览

`preview/index.html` —— 22 张索引卡(16 个 archetype + 风格包 + 节拍/摄影机库 + 成品曲目 + 边界),按五组筛选、深浅双模。**只登记名字与用途**,不含任何外部工程内容;由 `scripts/build_preview.py` 从 `data/index.json` 生成。

## 为什么不复制进本仓

1. **运行模型不同**:React + Remotion CLI,消费方式与「拷 CSS / token」完全不一样。
2. **许可不同**:该工程是私有 / `UNLICENSED`,渲染框架另有一套上游条款(部分实体需公司授权)。
3. 单一真相源:复制进来就是第二份真相源,必然漂移。

## 不用它的时候

- 你要的是网页动效或可抄的 CSS / JS 片段(去 web-fx / web-ui)
- 你期望在公开仓里直接读到源码(本仓只有这一页 + `pack.json`)

agent 取用口径见 [`SKILL.md`](SKILL.md)。