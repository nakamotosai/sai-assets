# three-fx · 三维特效两件

两种运行模型,各自独立打开:

| 效果 | 机制 | 运行模型 | 依赖 |
|---|---|---|---|
| **Blackhole Waves** · 体波测地线盘 | 体积薄盘 + 径向外推波 + 开普勒差速旋臂 + 多普勒左右冷热差,可拖转环视 | three.js 实时渲染(WebGL2) | `upstream/three.module.js`(r170,MIT) |
| **Blackhole Particles** · 粒子黑洞 | 开普勒轨道吸积盘 + 1/r 引力吸入/重生 + 光子环加密 + 多普勒黑体色偏 | Canvas2D 纯粒子 | 无 |

- 活预览(索引墙):[`preview/index.html`](preview/index.html) —— 两张卡各自链到独立效果页,无 iframe
- agent 入口:[`SKILL.md`](SKILL.md)
- 取用片段 / 全部参数表 / 无障碍补丁:[`docs/usage.md`](docs/usage.md)
- 自检:`python packs/three-fx/scripts/assert_tokens.py` → `PASS assert_tokens three-fx`

```
upstream/three.module.js   three.js r170(MIT,保留 SPDX 头,全包只此一份)
src/blackhole-waves.js     体波:20 参数 · 性能旋钮 steps / particleDensity / quality(DPR≤1.75)
src/blackhole-particles.js 粒子:11 参数 · 性能旋钮 density(DPR≤2)
src/param-panel.js         浮动面板:按 params.json 的 schema 生成原生控件,键盘可达
```

两者都是**页面级成品**(自己抓 DOM、自己跑 rAF),不导出 API;体波页含两段内联着色器
(`#pt-vert` / `#pt-frag`,模块按 id 取)。页面需要 http 服务打开(`import` / `fetch` 的限制)。

已知缺口:两个效果都**未内置** `prefers-reduced-motion` 分支,上线前按 `docs/usage.md` §无障碍
的两行补丁处理。