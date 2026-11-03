# spectral-glass-prism · WebGPU 光谱色散玻璃

真玻璃的连续彩虹:SDF raymarching + 逐波长 Cauchy 色散 + 进出两次折射 + CIE 1931 光谱合成。
pill / prism / cube / plate / diamond 五种形状共享同一折射引擎,可在页面里拖拽、旋转、换材质。

```html
<link rel="stylesheet" href="src/spectral-glass.css">
<canvas id="gpu" layoutsubtree>
  <div id="html-bg-root" class="html-bg-root">
    <img id="html-bg-photo" class="html-bg-photo" alt="" width="1920" height="1080" crossorigin="anonymous" hidden>
    <div id="html-bg-foreground" class="html-bg-foreground">…文字轨…</div>
  </div>
</canvas>
<div id="fallback"></div>
<script src="src/spectral-glass.js" defer></script>
```

- 结构、契约 id 表、宿主 API 与参数:[`docs/usage.md`](docs/usage.md)
- agent 入口:[`SKILL.md`](SKILL.md)
- 活预览:[`preview/index.html`](preview/index.html)(需 WebGPU 浏览器;不支持时给兜底面板,不报错)
- 自检:`python scripts/assert_tokens.py`

引擎本体是上游 **Spectral Glass(Saqoosha,MIT)** 的构建产物,原样放在 `upstream/spectral-glass/engine.js`;
MIT 原文、HDR(Poly Haven **CC0**)、照片(Lorem Picsum)依赖登记在 `upstream/spectral-glass/NOTICE.md`。
宿主壳、兜底、文档为本仓自产(MIT)。**不要就地编辑 vendored 引擎** —— 要改去上游 fork 重新构建。

快捷键:`拖拽`移动 · `Z`(按住)强制 N=3 看假彩虹 · `空格`随机摆位 · `R` 换底图 · `T/S/B/F` 钻石视角 · `H` 显隐参数面板。
