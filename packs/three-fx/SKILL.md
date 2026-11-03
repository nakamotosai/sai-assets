---
name: three-fx
description: Two independent 3D effects — a three.js volumetric accretion disk with radial outward waves, Keplerian shear and Doppler asymmetry (20 live params, draggable camera), and a dependency-free Canvas2D particle black hole with Kepler orbits, 1/r infall, photon-ring crowding and 8 disk presets. Use when a hero/deck/scifi page needs a real 3D object with physics-ish motion, not a decorative loop.
---

# three-fx

两件三维特效,运行模型不同、互不 import,各自能用:

| id | 是什么 | 依赖 | 参数 |
|---|---|---|---|
| `blackhole-waves` | 体波测地线盘:体积薄盘(高斯厚度)+ 径向外推波 + 开普勒差速旋臂 + 多普勒左右冷热差;可拖转/滚轮/右键滚转环视 | `upstream/three.module.js`(r170,MIT,仅一份) | 20 |
| `blackhole-particles` | 粒子黑洞:开普勒轨道吸积盘 + 1/r 引力吸入与重生 + 光子环加密 + 多普勒黑体色偏 | 无(Canvas2D) | 11 |

## When to use

- 需要**空间感 / 物理感**的主视觉:科幻、暗色宇宙、数据"引力井"隐喻、展厅墙、deck 封面
- 需要"可被人拖着看"的三维玩具(体波版有轨道相机)
- 需要同一题材的两种成本档:体波(重、真渲染)↔ 粒子(轻、零依赖)

## When not to use

- 移动端首屏且 LCP 敏感(体波要 1.3MB three.js + 着色器编译)
- 要求 `prefers-reduced-motion` 自动静帧的场景:**本包不内置**,必须按 `docs/usage.md` §无障碍 打补丁
- 长文阅读页背景、仪表盘背景(持续旋转会疲劳)
- 必须直接双击本地文件打开的环境(`import` / `fetch` 需要 http 服务)
- 想要一个能被 `import` 进组件树、可销毁可复用的库(这两个是页面级成品,自己抓 DOM)

## Files

| path | 是什么 |
|---|---|
| `src/blackhole-waves.js` | 体波测地线盘(单文件成品:场景/材质/相机/环绕控制/面板挂载/主循环) |
| `src/blackhole-particles.js` | 粒子黑洞(单文件成品:粒子系统/引力/绘制/面板挂载/主循环) |
| `src/param-panel.js` · `src/param-panel.css` | 浮动调参面板(按 `params.json` 的 schema 生成原生控件) |
| `src/stage.css` | 两个效果页共用的舞台样式(`#magic` / `#stage` / HUD / 提示 / 返回链) |
| `upstream/three.module.js` | three.js r170,**只此一份**,保留 `@license` + Copyright + SPDX 头 |
| `effects/blackhole-waves/index.html` | 体波页(含两段内联着色器源码,模块按 `id="pt-vert"/"pt-frag"` 取) |
| `effects/blackhole-particles/index.html` | 粒子页(挂 `#stage`) |
| `effects/<id>/params.json` | 该效果的参数默认值 + 面板 schema |
| `preview/index.html` | 两件效果的索引墙(链接,无 iframe) |
| `docs/usage.md` | 取用片段、全部参数表、性能与无障碍口径、反模式 |
| `scripts/assert_tokens.py` | 断言:pack.json / 产物 / 相对引用 / effect↔模块对齐 / SPDX 头 / 脱敏残留 |

## Agent apply steps

1. 读 `pack.json` 的 `when` / `not_for` 选版本:重(体波)还是轻(粒子)。
2. 按 `docs/usage.md` §取用 拷**对应那一组**文件(粒子版**不要**带 three.js)。
3. 页面里给出模块要的 DOM:`#magic`+`#hud`+两段内联着色器(体波),或 `#stage`+`#hud`(粒子)。
4. `fetch('./params.json')` 相对**页面**解析:把 `effects/<id>/params.json` 放到页面同级。
5. 必须走静态服务器验证(`python -m http.server` 或项目 dev server),别用本机文件协议直接开。
6. 交付前自检:`python packs/three-fx/scripts/assert_tokens.py` 必须打印 `PASS assert_tokens three-fx`。

## Hard rules

- **`upstream/three.module.js` 只此一份**;项目里已有 three.js 时,别让两个 three 实例同时存在。
- 体波页的 `#pt-vert` / `#pt-frag` 内联着色器是**模块的输入**(按 id 读取),删了页面就是全黑 + 报错。
- `params.json` 里的 `style` 选项字符串就是 `STYLE_TABLE` 的键,改名要两边一起改(断言会查)。
- 面板缓存键 = `themelab.<slug>.params`;改 slug 必须同时改模块里的 `localStorage.removeItem(...)`。
- 本包**不含** `prefers-reduced-motion` 分支:上线到公共站点前按 `docs/usage.md` §无障碍 的补丁处理,
  不要假装引擎已经帮你做了。
- 一页一个效果;两个都想要就做索引墙链接,或分两个 section 并各自按需加载。