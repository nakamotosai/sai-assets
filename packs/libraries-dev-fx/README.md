# libraries-dev-fx · Libraries.dev 全家桶试吃台

五个 React 特效组件(border-beam / thinking-orbs / liquid-gooey / metal-fx / img-fx)的**远程试吃台**:
真身从 esm.sh 现拉现跑,一页横比;谁挂掉就红字写在它自己的格子里,另外四个照常跑。**不含第三方源码,不是生产依赖。**

```html
<link rel="stylesheet" href="../src/bench.css" />
<script src="../src/bench.js" defer></script>
<!-- 脚本之前必须有 importmap:react / react-dom/client / three / htm → esm.sh -->
```

- 活预览:[`preview/index.html`](preview/index.html)(可直接 `file://` 打开,无需本地服务器)
- 用法 / 导出名 / 失败排查 / 反模式:[`docs/usage.md`](docs/usage.md) · agent 入口:[`SKILL.md`](SKILL.md)
- 自检:`python packs/libraries-dev-fx/scripts/assert_tokens.py`

组件源码来自 [Libraries.dev](https://github.com/Jakubantalik/Libraries.dev)(MIT);运行时 CDN 为 esm.sh;示例图来自 Lorem Picsum(仅外链)。
本包自身(外壳 CSS/JS/文档)许可:**MIT**。
