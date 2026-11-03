# usage · cjk-thin-type-system 配对规则

> 核心主张:排版声明**只继承、只挂档**。组件里出现裸的 `font-size` / `line-height` / `letter-spacing` / `text-shadow`,就是这套语言破口的开始。

## 1 谁配谁(元素 → 档)

| 元素 | 字号档 | 字重 | 字距 | 行高 | 文字影 |
|---|---|---|---|---|---|
| 字标(全站唯一显示字族) | `giant` | `mark` 600 | 0 | 1.4 | `display`(双层,≥28px) |
| 标语 / 邮箱 | `display` | `text` 200 | 0 | 1.4 | `display` |
| 区块标题 / 卡片标题 | `title` | `text` 200 | `.02em` | 1.35 | `text` |
| 正文 / 界面 | `body` | `text` 200 | 0 | 1.6 | `text` |
| 微标签 / eyebrow(12px 级) | 自定义小档 | 400 | `.12em` | ≥1.35 | `text` |

- 字族不在本包:去 `cjk-typography` 取(`body-sans` 回退栈 / `sys-console` 系统栈 / 免费细体三选)。
- 12px 级的微标签是**唯一**允许低于 17px 的中文,且必须把字重抬到 400 —— 细体小字会「笔画溶解」。

## 2 何时用细体(判据)

1. **暗底 + 大字号**才成立:细体靠白字在暗底上的发光量显出笔画;17px 以下、或亮底,笔画直接变灰。
2. 一页最多两档细体字号(标语 + 正文);第三档开始观感从「高级」滑向「没力气」。
3. 需要力量感、数据密度、亮底长文时不要用:分别走粗体档、系统栈、纸媒正文档。
4. 已有站点先普查后收敛,不要凭感觉改单个元素:`audit` 探针(见 §4)先输出「字重分布 / 字号分布 / 组合表」三张表。

## 3 硬约束(改坏一条即不算这套语言)

| 约束 | 值 | 反例 |
|---|---|---|
| 中文最小字号 | 12px | `font-size:11px` 的角标 |
| 细体最小字号 | 17px | 15px 挂 200 字重 |
| 最小行高 | 1.35 | 正文行高 1.2 |
| 第二层影 | ≥28px 才准 | 给 17px 正文加扩散影 |
| `vw` | 只在 `clamp()` 中段 | `font-size:5vw`(无上限) |
| 斜体 | 中文禁 | `font-style:italic` 套中文 |
| 下划线 | 禁 `border-bottom` 当下划线 | 中文正文 `border-bottom:1px solid` |

**越大越细**(字重阶梯):`200 ≥17px` · `300 14–16px` · `400 12–13px`。同一字号只挂一种字重;全站最小档 ≥17px 时,唯一合法正文档就是 200。

## 4 审计探针(能跑起来,不是建议)

`scripts/assert_tokens.py` 把探针做成了可失败的检查,四条都是硬断言:

1. **字号地板**:`preview/` 下所有 CSS / HTML 的 `font-size` 声明,纯 `px` 值不得 < 12px;`clamp()` 的最小值同样不得 < 12px。
2. **最小行高**:`line-height` 无单位值不得 < 1.35。
3. **`vw` 外推**:`font-size` 里出现 `vw` 时,只允许出现在 `clamp()` 的中段,且上限必须是绝对单位;裸 `font-size:Xvw` 直接判失败。
4. **中文禁斜体**:样式表里不得出现 `font-style:italic`。

ps:探针只扫打包产物(`preview/`),把它接到你的项目上时,把它指向项目的样式表即可。

浏览器里做同样的普查(源卡自带的 DOM 探针,按「叶子级文字节点」取样,避免父级重复计数):

```js
const rows = [];
document.querySelectorAll('body *').forEach(el => {
  const t = (el.textContent || '').trim();
  if (!t) return;
  if ([...el.children].some(c => (c.textContent || '').trim())) return;
  const cs = getComputedStyle(el);
  rows.push({ size: +parseFloat(cs.fontSize).toFixed(1), w: cs.fontWeight, ls: cs.letterSpacing, lh: cs.lineHeight, sh: cs.textShadow, fam: cs.fontFamily.split(',')[0] });
});
const g = new Map();
for (const r of rows) { const k = [r.fam, r.size, r.w, r.ls, r.lh, r.sh].join('|'); const e = g.get(k) || { ...r, n: 0 }; e.n++; g.set(k, e); }
console.log('组合数', g.size, '| 字号集合', [...new Set(rows.map(r => r.size))].sort((a, b) => b - a),
            '| 字重集合', [...new Set(rows.map(r => r.w))].sort(), '| 影种类', new Set(rows.map(r => r.sh)).size);
```

## 5 反模式

- 用行高当间距工具(要留白加 `margin`,不要拉 `line-height`)。
- 同一字号挂两种字重(200 与 300 并存)—— 最常见的「乱」。
- 给中文正文加 `letter-spacing` 冒充「高级感」;一页出现第四档字距值。
- 按断点逐组件改 `font-size`(会留下 18 / 20 / 24 / 26px 等散值);响应式一律写进 `clamp()` 中段。
- 给 17px 正文加第二层扩散影,或用彩色 glow 当文字影。
- 拉丁显示字族套中文元素(会静默回落宋体,笔画与字面全变)。
- 用 `text-align: justify` 排中文(字距被拿来填空,行宽抖动)。
- 把字标字族下放给普通标题;字标是全站唯一允许出现显示字族的元素。

## 6 实测样本(源卡)

某暗底单页站 2026-10-31 全站普查:**151 个文字元素 / 21 种样式组合**(9 种字距 / 11 种行高 / 11 种文字影 / 字族里混进 Arial),按本包收敛后:组合 21 → 9、排版声明 223 → 31 条、字族 3 → 2、行高 11 → 3、文字影 11 → 2。

## 7 取用

```bash
python <sai-assets>/scripts/apply.py cjk-thin-type-system --to src/tokens
```

消费后在项目 `design-lock.json` 记 `assets[]`:`pack=cjk-thin-type-system`、`version`、`sha`(见 `docs/USAGE-INTEGRATION.md`)。
