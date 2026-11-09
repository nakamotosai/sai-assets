# optical-type · 光学尺寸档(opsz)

可变字体的**光学尺寸轴**四档配方:大字自动变细、小字自动加厚。**不含字体文件**——只给轴值、档位与配方。

```html
<link rel="stylesheet" href="optical-type.css">  <!-- 档位表:docs/usage.md -->

<div class="ot">
  <h1 class="ot-display">大标题</h1>
  <p class="ot-lead">引导句</p>
  <p class="ot-body">正文</p>
  <p class="ot-small">小字</p>
</div>
```

| 档位 | opsz | 字重 | 字号 | 行高 | 字距 |
|---|---|---|---|---|---|
| display | 144 | 200 | `clamp(2.6rem,9vw,5.6rem)` | 0.94 | −0.03em |
| lead | 48 | 260 | `clamp(1.25rem,2.2vw,1.75rem)` | 1.34 | −0.012em |
| body | 24 | 340 | `clamp(1rem,1.15vw,1.125rem)` | 1.72 | 0 |
| small | 14 | 420 | `0.875rem` | 1.62 | 0.01em |

- 预览 `preview/index.html`(双击即可;含同字号五行对照,轴不生效时五行相同 = 验证法)
- 用法与参数 `docs/usage.md` · agent 入口 `SKILL.md` · 自检 `python packs/optical-type/scripts/assert_tokens.py`
- 轴值由本机 `fontTools` 读 `fvar` 实测,见 `tokens/opsz-axes.json`;字体文件不随包分发。
