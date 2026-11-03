# upstream · Spectral Glass(来源与许可)

## 这是什么

`engine.js` 是上游 WebGPU 光谱色散演示的**构建产物(原样 vendored,未改一个字节)**。
它自启动:一被 import 就去 `document` 里按 id 取节点并起渲染循环,参数面板(Tweakpane,右上角)也在其中。

| 项 | 值 |
|---|---|
| 上游项目 | Spectral Glass(`npm name: spectral-glass`) |
| 作者 | Saqoosha |
| 许可 | MIT(原文见同目录 `LICENSE`,Copyright (c) 2026 Saqoosha) |
| 上游仓库 | https://github.com/saqoosha/Spectral-Glass |
| 线上演示 | https://saqoosha.github.io/Spectral-Glass/ |
| 构建方式 | Vite 构建输出(ESM 单文件),本仓保留其原始字节 |

构建产物里没有 SPDX 头(打包器把注释剥了),所以许可原文单独放在 `LICENSE`,来源单独记在本文件与
包的 `pack.json.attribution` 里。**改引擎就去上游 fork 后重新构建,不要直接编辑 `engine.js`** ——
本仓对它的承诺是"字节一致",任何就地编辑都会让下一次同步变成人工合并。

## 引擎的运行期外部依赖(不随包分发)

| 依赖 | 用途 | 许可 / 说明 |
|---|---|---|
| Poly Haven HDRIs(`dl.polyhaven.org`) | 可选 HDR 环境贴图(背景/折射/反射共用同一张全景) | CC0(公共领域);运行时按需下载,本仓不转载任何 HDR 文件 |
| Lorem Picsum(`picsum.photos`) | 默认底图与"换一张图" | 第三方占位图服务(图源 Unsplash);运行时取图,本仓不转载照片 |
| Tweakpane v4 | 参数面板 | MIT,已打进 `engine.js` |

网络不可用时引擎不会崩:底图退回渐变并在页面上给出提示条(见上游 `usedGradientFallback` 分支)。

## 引擎对宿主页面的硬契约(别改)

引擎按 **id** 取节点,缺一个就静默拿到 `null`:

| id | 元素 | 作用 |
|---|---|---|
| `gpu` | `<canvas>` | WebGPU 画布;`100vw × 100vh`,`touch-action:none` |
| `html-bg-root` | `<div>` | 画布内 DOM 背景层容器(取景尺寸 + 渐变兜底的 class 落点) |
| `html-bg-photo` | `<img crossorigin="anonymous">` | 引擎写入 Picsum 地址;加载失败会加 `.html-bg--gradient-fallback` |
| `html-bg-foreground` | `<div>` | 左侧可滚动的文字轨(也是"画布内 DOM"的取样源) |
| `fallback` | `<div>` | 失败/提示文本落点;`.visible` 由引擎自己加 |

`<canvas layoutsubtree>` 与 `canvas.requestPaint()` 是 Chrome `CanvasDrawElement` 试验特性:
**没有这个标志的浏览器里画布内的 DOM 不会被光栅化**,但那些节点仍然是引擎的取景与兜底依据,不能删。
