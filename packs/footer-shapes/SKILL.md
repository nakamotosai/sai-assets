---
name: footer-shapes
description: Five ready-made footer shapes for the bottom of a page — typographic wordmark, link grid with a working subscribe form, oversized contact line, marquee-plus-FAQ, and a one-line minimal bar. Use when a site needs more than a copyright line, or when comparing footer layouts (information density) before committing to one.
---

# footer-shapes

页脚**五形态**。同一份数据、同一个骨架,换一个形态类就换一种信息密度取向。

## When to use

- 底部收口不只是版权行:品牌当唯一大件 / 链接成栅格 / 联系语最大化
- 要**可切换**地比五种排法再定一个落地
- 要「栅格式」那种带可用订阅表单的底(空 / 非法 / 合法三态回执已做全)
- 要「动效式」的跑马灯 + 折叠 FAQ,且要求减速模式退化成静态折行

## When not to use

- 只要一行版权:直接取 `.fs-small-meta` 一段,不必整包
- 页脚要承载三层以上站点地图:栅格式最多四列平铺
- 跑马灯文字必须被完整索引:它是装饰层,正文入口要另放列表
- 需要 cookie 同意、语言切换等合规件:本包不管合规逻辑

## Default

浅色纸白(`#f5f3ed` / `#1a1a16` / 强调 `#cd5545`),`data-mode="dark"` 切近黑 `#0e0e0c`。两档都是**回退值**,宿主给 token 就全走宿主。

实测高度(978px 宽):排印 414 / 栅格 295 / 大字 379 / 动效 418 / 小字 128 px。

## Files

| path | use |
|---|---|
| `src/footer-shapes.css` | 五形态 + 共用零件 + 变量 + 减速降级(作用域 `.fs`) |
| `src/footer-shapes.js` | 只有订阅表单的回执逻辑;其余形态纯 CSS |
| `preview/index.html` | 活预览:五个形态页签切换 + 表单三态可试 |
| `docs/usage.md` | 形态对照表 + 参数 + 无障碍硬项 + 反模式 |
| `scripts/assert_tokens.py` | 契约 / 引用 / 产物 / 对比度两档 / 五形态齐全 |

## Agent apply steps

1. 拷 `src/footer-shapes.{css,js}` 到项目 `assets/`。
2. 写骨架 `<footer class="fs ft--xxx" data-mode="light"><div class="fs-in">…</div></footer>`。
3. 形态类五选一:**HTML 骨架不用改**,只换类名。
4. 小字强调用 `--fs-accent-ink`(`--fs-accent` 在浅底到不了 4.5:1)。
5. 跑马灯第二份重复内容必须 `aria-hidden="true"`,真链接另放 `.fs-bar`。

## 硬规则

- `.fs-cols` 必须 `minmax(min(150px,100%), 1fr)`:留默认 `auto` 时长邮箱会把整列撑出横向溢出。
- 跑马灯是装饰:不可聚焦、不响应点击,别把导航放进去。
- 折叠 FAQ 用原生 `<details>/<summary>`,别自己写 JS 手风琴。
- 减速模式下跑马灯要退化成**可折行的静态列表**,不能只关动画(那会留下一条被切掉的静止长条)。
- 形态类与骨架解耦:任何形态都不该要求改 HTML 结构。
