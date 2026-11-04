# param-panel · 用法与配对规则

> 悬浮调参板:把一件作品的参数从代码里搬到一个**可拖、可缩放、可导出**的小板上,调完把值抄回 `params.json` 就是定稿。它只解决"看得见地调参",不解决"参数该是什么"。

## 什么时候用

- 做**可调参 demo / 动效预览 / 主题试色页**:参数 ≥3 个、且"看一眼就知道该往哪调"的场景。
- 需要**给用户当场看两档差别**(圆角 0→28、阴影 0→40、速度 0.2→4s)时,比改代码截图快一个量级。
- 需要**色板约束**:颜色只允许从给定 swatches 里挑(禁自由取色),避免调出库外颜色。
- 需要**调完能带走**:底栏「复制 / 导出」把当前值变成可粘贴的 JSON,直接回写 `params.json`。

## 接入步骤

```html
<link rel="stylesheet" href="./src/param-panel.css" />
<script type="module">
  import { mountParamPanel, shouldMountLabPanel } from "./src/param-panel.js";

  const params = await fetch("./params.json").then((r) => r.json()); // {slug, version, defaults, schema}
  const apply = (p) => {
    const s = document.documentElement.style;
    s.setProperty("--demo-radius", p.radius + "px");
    s.setProperty("--demo-shadow", p.shadow + "px");
    s.setProperty("--demo-accent", p.accent);
  };
  apply(params.defaults);                       // 生产:先落默认值,不挂板
  if (shouldMountLabPanel()) {                  // preview / ?lab=1 才挂板
    mountParamPanel({ params, title: "调参", corner: "br", onChange: apply });
  }
</script>
```

1. 把 `src/param-panel.{css,js}` 拷进项目(`apply.py` 整包拷贝时已在包里)。
2. 写一份 `params.json`:`defaults` 给一套能看的默认值,`schema` 每项必带 `key/label/type`。
3. `onChange` 里**只做赋值**(写 CSS 变量 / 调引擎参数),不要在里面做重活;面板每次输入都会调它。
4. 生产环境**不挂板**:`shouldMountLabPanel()` 只在路径像 `preview`、或 URL 带 `?lab=1` 时返回 true;要强制也可以 `mountParamPanel({force:true})` / 关掉用 `?lab=0`。
5. 调好后点底栏「复制」,把 JSON 粘回 `params.json.defaults`。

## 参数

`mountParamPanel(opts)`:

| 字段 | 默认 | 说明 |
|---|---|---|
| `params` | — | `{slug, version, defaults, current?, schema[]}`;`slug` 决定 localStorage 命名空间 |
| `onChange` | `()=>{}` | 每次改动收到一份当前值对象(含全部 key) |
| `title` | `"参数"` | 板头标题 |
| `corner` | `"br"` | 最小化方块落点:`tl` / `tr` / `bl` / `br` |
| `force` | — | `true`/`false` 覆盖 `shouldMountLabPanel()` 的判断 |
| `storageKey` / `defaultsKey` / `positionKey` / `sizeKey` / `collapseKey` | 自动 | 想自己控命名空间时才传 |

`params.schema[]` 每项:

| 字段 | 说明 |
|---|---|
| `key` | 取值键名(与 `defaults` 对应) |
| `label` | 板上显示名 |
| `type` | `range` / `number` / `select` / `checkbox` / `swatch` / `text`(`color` 已废弃,降级为 `text`) |
| `tab` | 可选,归到「颜色 / 字体 / 版式 / 组件 / 其它」中的一栏;不写按顺序放进默认栏 |
| `min` / `max` / `step` | `range` / `number` 用 |
| `options` | `select` 用 |
| `swatches` | `swatch` 用:只允许从这里挑;写进 `defaults` 的值会被吸附到最近的 swatch |

板本身的能力(不用配置):整板收到 56×56 方块(点开)、标题拖动、右下角缩放、底栏**设为默认 / 恢复默认 / 撤回 / 复制 / 导出**、滚轮滚动(无可见滚动条)、位置与尺寸与折叠态记在 `localStorage`。

## 无障碍硬项

- 所有输入都是原生 `input`/`select`(可键盘聚焦、可 Tab 走完、有可见焦点环),不是 div 假控件。
- 每个控件有 `label`(点标签即聚焦控件)。
- 最小化方块 56×56、按钮命中区 ≥44px,鼠标与触屏都能点。
- `prefers-reduced-motion: reduce` 时小板不做位移/缩放动画(瞬时切换)。
- 焦点不留在折叠后的隐藏控件上:折叠时把焦点交回方块按钮。

## 反模式

- **把板挂到生产界面** —— 板是 lab 器具,终用户看到等于"半成品";只允许 `preview` 路径或 `?lab=1`。
- **颜色开自由取色** —— 一旦允许手输 hex,作品很快会漂到库外;颜色一律用 `swatch` + `swatches` 约束。
- **一个 key 全局复用** —— 多个 demo 用同一个 `slug` 会互相覆盖 localStorage;`slug` 必须唯一。
- **在 `onChange` 里重建 DOM / 重新 fetch** —— 拖一次 range 会触发几十次,必须只做赋值。
- **把 `params.json` 当真相源之外再抄一份默认值** —— 默认值只在 `params.json.defaults` 里写一次;代码里再写一遍就会出现两套默认。
- **用板替代验收** —— 板让你看到差别,不证明差别达标;对比度/字号地板/双视口仍要照跑项目锁里的断言。

## 来源与许可

- 出处:本机旧主题库 `components/param-panel/`(2026-07 起在多个 demo 里被复用,旧库时代被手抄出 12 份副本并漂移 —— 本包就是为终结手抄而收进公开包仓)。
- 许可:**MIT**(自产)。随包拷贝 `src/params.schema.json` 可拿去校验自己的 `params.json`。
- 变更历史:入包时重命名 CSS/JS 前缀为 `pp-`、localStorage 命名空间改为 `saiassets.param-panel.*`(不再沿用旧库前缀),并删掉库内 `.prev.*` 旧版;行为未改。
