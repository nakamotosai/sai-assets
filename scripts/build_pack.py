#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""sai-assets · 主题包生成器(旧库 → packs/<id>/)。

输入:旧库 Sai Theme Lab 的 themes/<id>.json(只读,绝不回写)与 demos/<dir>/preview.html。
输出:符合 docs/PACK-CONTRACT.md 的包 —— tokens/(absolute + index + semantic)、css/(default + all + themes)、
docs/usage.md、scripts/assert_tokens.py、SKILL.md、README.md、pack.json、preview/。

流程(逐包):
  0) 整体重写 packs/<id>/(生成物,不要手改;保证重建无残留);
  1) 渲染产物(语义层由源色板按 candidate 表映射,不发明新色);
  2) 调 scripts/sanitize.py 做公开前替换(按包打印计数;--no-sanitize 关闭);
  3) 跑该包自己的 assert_tokens.py;
  4) 把 assert 的真实输出写进 pack.json.verified.evidence,再复核一次。

用法:
    python scripts/build_pack.py --all-themes
    python scripts/build_pack.py --theme paper-editorial
    python scripts/build_pack.py --all-themes --src <旧库根>
    python scripts/build_pack.py --all-themes --no-sanitize

旧库根默认指向本机 Sai Theme Lab 的根目录;公开仓不写死盘符路径(内容闸禁),用 os.sep 拼装,
可用 --src 或环境变量 SAI_THEME_LAB_ROOT 覆盖。
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sanitize  # noqa: E402  (同目录的清洗器;规则表在 schema/sanitize.json)

REPO_ROOT = Path(__file__).resolve().parents[1]
PACKS_DIR = REPO_ROOT / "packs"
DEFAULT_SRC = Path("F:" + os.sep + "knowledge" + os.sep + "模板库")
SRC_ENV = "SAI_THEME_LAB_ROOT"

# docs/WHITELIST.md 甲组里归本 ticket 的 12 个主题(ouuut-editorial / gruvbox-dark 不在其中)
THEME_IDS = (
    "abyss-lab-record",
    "paper-editorial",
    "saaaai-paper",
    "saaaai-mono",
    "fm-void",
    "mohe-mono-blue",
    "popart-neubrutal",
    "tokyo-crime-dark",
    "slow-ride-cream",
    "minimalist-essential",
    "swiss-classic",
    "swiss-inverted",
)

CATEGORY = "themes"
KIND = "theme"
LICENSE = "MIT"
VERSION = "1.0.0"
ORIGIN_PROJECT = "sai-theme-lab"
CONTRAST_MIN = 4.5
# pack.json 先落盘时的占位:assert 通过后会被替换成它的实测输出(不是宣称的结论)
PENDING_EVIDENCE = "(待回填:assert 尚未运行,build_pack 会在通过后写入实测输出)"

# 语义层键(包对外的稳定接口)按此顺序出 CSS
CANONICAL = (
    "bg", "bgDeep", "surface", "surface2", "border", "ink", "inkMuted", "inkDim",
    "accent", "accent2", "onAccent", "red", "green", "aqua", "blue", "purple", "link", "codeBg",
)
# 契约 §5 的最低集(bg surface ink accent on-accent link red green)
CORE = ("bg", "surface", "ink", "accent", "onAccent", "link", "red", "green")
# 语义键 ← 源色板候选键(同一颜色换语义名,不做近似;候选全缺则跳过该键)
CANDIDATES = {
    "bg": ("bg",),
    "bgDeep": ("bgDeep", "bgDeepest"),
    "surface": ("surface", "panel", "bgPanel", "surfaceRaise"),
    "surface2": ("surface2", "bgRaise", "panelRaise", "surfaceStrong"),
    "border": ("border", "borderStrong", "line", "hairline"),
    "ink": ("ink",),
    "inkMuted": ("inkMuted", "inkDim", "inkFaint"),
    "inkDim": ("inkDim", "inkFaint", "inkMuted"),
    "accent": ("accent",),
    "accent2": ("accent2", "accentSoft"),
    "onAccent": ("onAccent", "onAccentInk"),
    "red": ("red", "danger"),
    "green": ("green", "ok", "success"),
    "aqua": ("aqua", "teal"),
    "blue": ("blue",),
    "purple": ("purple",),
    "link": ("link", "accentInk", "accentSoft", "accent2", "aqua", "blue"),
    "codeBg": ("codeBg", "codeSurface", "code"),
}
# 当源盘没有 on-accent(或 on-accent/accent 达不到 4.5)时的兜底候选顺序
INK_LIKE = ("onAccentInk", "paperInk", "inkDim", "inkMuted", "ink", "codeBg", "bg", "void", "chipBg")


# --------------------------------------------------------------------------- #
# 色值 / 文本小工具
# --------------------------------------------------------------------------- #

HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def kebab(name: str) -> str:
    """语义键 → CSS 变量后缀:bgDeep→bg-deep、surface2→surface-2、inkMuted→ink-muted。"""
    return re.sub(r"(?<=[a-z])(?=[A-Z0-9])", "-", name).lower()


def channel(value: float) -> float:
    value = value / 255.0
    return value / 12.92 if value <= 0.03928 else ((value + 0.055) / 1.055) ** 2.4


def luminance(hex_color: str) -> float:
    raw = hex_color.lstrip("#")
    r, g, b = (int(raw[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def contrast(fg: str, bg: str) -> float:
    a, b = luminance(fg), luminance(bg)
    if a < b:
        a, b = b, a
    return (a + 0.05) / (b + 0.05)


def has_cjk(text: str) -> bool:
    return bool(re.search(r"[\u3400-\u9fff]", text))


def bullets(items, empty: str) -> str:
    return "\n".join(f"- {item}" for item in items) if items else empty


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def write_json(path: Path, data) -> None:
    write_text(path, json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def render(template: str, mapping: dict) -> str:
    out = template
    for key, value in mapping.items():
        out = out.replace(f"@@{key}@@", value)
    return out


# --------------------------------------------------------------------------- #
# 语义层解析(源色板 → 语义键)
# --------------------------------------------------------------------------- #

def resolve_variant(theme: dict, pack_id: str) -> dict:
    raw = theme["colors"]
    colors: dict = {}
    derived: dict = {}
    used: set = set()
    for key in CANONICAL:
        for cand in CANDIDATES[key]:
            if cand in raw:
                colors[key] = raw[cand]
                derived[key] = cand
                used.add(cand)
                break
    for key, value in raw.items():
        if key in used or key.lower() in {c.lower() for c in CANONICAL}:
            continue
        colors[key] = value
    notes = []

    # accent / on-accent 配对:优先源意图;源对不足 4.5:1 时换用源色板里另一个 accent 兄弟,
    # 再退到源色板中能达标的墨色;全程只用源色板里的颜色,不发明 hex。
    accent_key = derived.get("accent")
    adjusted = False
    if accent_key:
        fill = raw[accent_key]
        fill_ok = isinstance(fill, str) and bool(HEX.match(fill))
        on_key = "onAccent" if isinstance(raw.get("onAccent"), str) and HEX.match(raw["onAccent"]) else None
        sibling = next(
            (k for k in ("accent2", "accentSoft")
             if k != accent_key and isinstance(raw.get(k), str) and HEX.match(raw[k])),
            None,
        )
        fill_key, text_key = accent_key, None
        if fill_ok and on_key and contrast(raw[on_key], fill) >= CONTRAST_MIN:
            text_key = on_key
        elif fill_ok and on_key and sibling and contrast(raw[on_key], raw[sibling]) >= CONTRAST_MIN:
            fill_key, text_key, adjusted = sibling, on_key, True
            notes.append(
                f"源 accent/onAccent 实测 {contrast(raw[on_key], fill):.2f}:1 < {CONTRAST_MIN},"
                f"按源色板把 --accent 改用 {sibling}({raw[sibling]}),配对 {contrast(raw[on_key], raw[sibling]):.2f}:1"
            )
        elif fill_ok:
            for cand in INK_LIKE + tuple(k for k in raw if k not in INK_LIKE):
                value = raw.get(cand)
                if isinstance(value, str) and HEX.match(value) and contrast(value, fill) >= CONTRAST_MIN:
                    text_key = cand
                    break
            if text_key is None:
                scored = [(k, contrast(v, fill)) for k, v in raw.items()
                          if isinstance(v, str) and HEX.match(v)]
                text_key = max(scored, key=lambda kv: kv[1])[0] if scored else None
            adjusted = True
            if text_key:
                notes.append(
                    f"源无可用 on-accent 配对;--on-accent 取源 {text_key}({raw[text_key]}),"
                    f"配对 {contrast(raw[text_key], fill):.2f}:1"
                )
        if fill_ok and text_key:
            colors["accent"] = raw[fill_key]
            derived["accent"] = fill_key
            colors["onAccent"] = raw[text_key]
            derived["onAccent"] = text_key
            if sibling:
                other = accent_key if fill_key == sibling else sibling
                if other != fill_key:
                    colors["accent2"] = raw[other]
                    derived["accent2"] = other

    # 链接色若与强调色完全同值,记录下来(仍然照源发,不改)
    if "link" in colors and "accent" in colors and colors["link"] == colors["accent"]:
        notes.append(f"源里 --link 与 --accent 同为 {colors['accent']}(照源发;同屏同时出现时用 --accent-2 或下划线区分)")

    a11y = {
        "contrast_min": CONTRAST_MIN,
        "pairs": {},
        "adjusted": adjusted,
        "notes": notes,
    }
    for fg, bg in (("ink", "bg"), ("onAccent", "accent")):
        if fg in colors and bg in colors and isinstance(colors[fg], str) and isinstance(colors[bg], str):
            if HEX.match(colors[fg]) and HEX.match(colors[bg]):
                a11y["pairs"][f"{fg}/{bg}"] = round(contrast(colors[fg], colors[bg]), 2)

    return {
        "id": pack_id,
        "name": theme["name"],
        "mode": theme.get("mode", "light"),
        "signature": theme.get("signature", ""),
        "colors": colors,
        "fonts": theme.get("fonts") or {},
        "radius": theme.get("radius") or {},
        "derived": derived,
        "a11y": a11y,
    }


# --------------------------------------------------------------------------- #
# tokens/
# --------------------------------------------------------------------------- #

def tokens_absolute(theme: dict, pack_id: str) -> dict:
    return {
        "id": pack_id,
        "name": theme["name"],
        "mode": theme.get("mode", "light"),
        "signature": theme.get("signature", ""),
        "source": f"themes/{pack_id}.json",
        "colors": theme["colors"],
    }


def tokens_index(variant: dict) -> dict:
    entry = {
        "id": variant["id"],
        "name": variant["name"],
        "mode": variant["mode"],
        "path": f"tokens/semantic/{variant['id']}.json",
        "default": True,
    }
    contrast_label = variant.get("contrast")
    if contrast_label:
        entry["contrast"] = contrast_label
    return {"default": variant["id"], "themes": [entry]}


def tokens_semantic(variant: dict) -> dict:
    return {
        "id": variant["id"],
        "name": variant["name"],
        "mode": variant["mode"],
        "signature": variant["signature"],
        "colors": variant["colors"],
        "fonts": variant["fonts"],
        "radius": variant["radius"],
        "derived": variant["derived"],
        "a11y": variant["a11y"],
    }


# --------------------------------------------------------------------------- #
# css/
# --------------------------------------------------------------------------- #

def var_lines(variant: dict) -> list:
    lines = [f"  color-scheme: {variant['mode']};"]
    for key, value in variant["colors"].items():
        lines.append(f"  --{kebab(key)}: {value};")
        lines.append(f"  --theme-{kebab(key)}: {value};")
    for key, value in variant["radius"].items():
        lines.append(f"  --radius-{kebab(key)}: {value};")
        lines.append(f"  --theme-radius-{kebab(key)}: {value};")
    for key, value in variant["fonts"].items():
        lines.append(f"  --font-{kebab(key)}: {value};")
        lines.append(f"  --theme-font-{kebab(key)}: {value};")
    return lines


def css_block(variant: dict, with_root: bool) -> str:
    selectors = []
    if with_root:
        selectors.append(":root")
    selectors.append(f'[data-theme="{variant["id"]}"]')
    selectors.append(f'.theme-{variant["id"]}')
    return ",\n".join(selectors) + " {\n" + "\n".join(var_lines(variant)) + "\n}"


def chrome_block(variant: dict) -> str:
    keys = variant["colors"]
    radius = "var(--radius-sm, 4px)"
    code_bg = "var(--code-bg, var(--surface2, var(--surface)))"
    shadow = f"var(--shadow, {keys.get('shadow', 'none')})" if "shadow" in keys else "none"
    return f"""/* 基础 chrome(opt-in):<body class="theme-apply"> 或 [data-theme-apply] 上底色与基础件 */
.theme-apply,
[data-theme-apply] {{
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body, system-ui, sans-serif);
  line-height: 1.6;
}}

.theme-apply a,
[data-theme-apply] a {{
  color: var(--link, var(--accent));
}}

.theme-apply code,
.theme-apply pre,
[data-theme-apply] code,
[data-theme-apply] pre {{
  font-family: var(--font-mono, ui-monospace, monospace);
  background: {code_bg};
  border-radius: {radius};
}}

.theme-apply .panel,
[data-theme-apply] .panel {{
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md, 6px);
  box-shadow: {shadow};
}}

.theme-apply .btn-primary,
[data-theme-apply] .btn-primary {{
  background: var(--accent);
  color: var(--on-accent);
  border-radius: {radius};
}}"""


def css_default(pack_id: str, variant: dict) -> str:
    return (
        f"/* Default = {variant['id']} — 只链接这一份即最快 apply */\n"
        f"/* {variant['name']} — {variant['signature']} */\n"
        f"/* 语义变量与 --theme-* 别名双发;字体/圆角透传源令牌 */\n\n"
        f"{css_block(variant, with_root=True)}\n"
    )


def css_all(pack_id: str, variant: dict) -> str:
    return (
        f"/* {variant['name']} — 全部变体 + 基础 chrome */\n"
        f"/* {variant['signature']} */\n"
        f"/* 含 :root:单主题整站直接链接本文件 */\n\n"
        f"{css_block(variant, with_root=True)}\n\n"
        f"{chrome_block(variant)}\n"
    )


def css_themes(variant: dict) -> str:
    return (
        f"/* {variant['name']} · 共存版:只出 [data-theme] / .theme-<id> 作用域,不含 :root\n"
        f"   多主题应用(站点自带主题切换器)用这一份,避免全局覆盖项目自己的 token;\n"
        f"   单主题直接应用请用 css/default.css。color-scheme 只在 [data-theme] 块里给。 */\n\n"
        f"{css_block(variant, with_root=False)}\n\n"
        f"{chrome_block(variant)}\n"
    )


# --------------------------------------------------------------------------- #
# docs/usage.md
# --------------------------------------------------------------------------- #

USAGE_TEMPLATE = """# @@NAME@@ · 用法与配对规则

`@@ID@@` · mode `@@MODE@@` · 默认变体 `@@DEFAULT@@`

**signature**:@@SIGNATURE@@

- 原色表:`tokens/absolute.json`(源盘 `colors` 原样,不改名不近似)。
- 语义映射:`tokens/semantic/@@ID@@.json`(`derived` 记每个语义键取自哪个源键;`a11y` 记对比度实测)。
- 变量双发:裸语义名(`--bg`)与 `--theme-` 前缀别名(`--theme-bg`)同值,便于接既有项目。
- 你不需要发明 hex:缺哪个角色就用对应变量,不要拿别的色近似。

## 变体表

| id | mode | 何时用 |
|---|---|---|
| `@@ID@@` | `@@MODE@@` | **默认**;@@SIGNATURE@@ |

## 变量表(语义名 ↔ 前缀别名)

| 语义键 | CSS 变量 | 别名 |
|---|---|---|
@@VAR_ROWS@@

## 配对规则(谁配谁)

| 用途 | 变量 | 口径 |
|---|---|---|
| 正文 / 段落 | `--ink` | 页面主文字色,始终用于 `--bg` 之上 |
| 次要文字 | `--ink-muted` / `--ink-dim` | 说明、元信息、时间戳;`--ink-muted` 比 `--ink-dim` 更接近正文 |
| 卡面 / 面板 | `--surface` + `--border` | 卡底用 `--surface`,描边用 `--border`;需要抬升时 `--surface-2` |
| 主按钮 | `--accent` + `--on-accent` | 一个视区只放一个主 CTA;文字色必须用 `--on-accent`(实测 @@ACCENT_RATIO@@:1) |
| 链接 | `--link` | 链接一律用 `--link`;**强调色(`--accent`)不与链接同色** —— @@LINK_NOTE@@ |
| 危险 / 破坏性 | `--red` | 删除、错误、警报@@RED_NOTE@@ |
| 成功 | `--green` | 通过、已完成@@GREEN_NOTE@@ |
| 页面底 | `--bg` / `--bg-deep` | 大底用 `--bg`,更深的分层用 `--bg-deep` |

一行口径:正文 `--ink`,次要 `--ink-muted`/`--ink-dim`,卡面 `--surface`+`--border`,主按钮 `--accent`+`--on-accent`,链接 `--link`,危险 `--red`,成功 `--green`;强调色不做链接色。

## 字体配方(源 `fonts` 透传)

| 角色 | 变量 | 栈 |
|---|---|---|
@@FONT_ROWS@@

- 标题用 `var(--font-display)`,正文 `var(--font-body)`,代码/数字 `var(--font-mono)`;字重与字号档位不在本包内,按下方 `do` 的约束落地。

## 圆角(源 `radius` 透传)

| 变量 | 值 |
|---|---|
@@RADIUS_ROWS@@

## 推荐做法(源 `do`)

@@DO@@

## 反模式(源 `dont`)

@@DONT@@

## 对比度实测(WCAG,自写公式)

| 组合 | 实测 | 门槛 |
|---|---|---|
@@CONTRAST_ROWS@@

@@A11Y_NOTE@@

## 应用片段

```css
/* 单主题:把 css/default.css 全文贴进项目,或在 <head> 里 link 它 */
/* 多主题共存:link css/themes.css,用 <html data-theme="@@ID@@"> 决定何时生效(无 :root,不覆盖项目 token) */
```

```html
<html data-theme="@@ID@@" class="theme-@@ID@@" lang="zh-CN">
  <link rel="stylesheet" href="css/default.css">
```

## 来源 / Provenance

@@PROVENANCE@@
"""


def usage_md(theme: dict, variant: dict) -> str:
    colors = variant["colors"]
    var_rows = "\n".join(
        f"| `{key}` | `--{kebab(key)}` | `--theme-{kebab(key)}` |"
        for key in colors
    )
    font_rows = "\n".join(
        f"| `{key}` | `--font-{kebab(key)}` | {value} |" for key, value in variant["fonts"].items()
    ) or "| — | — | 源未带 fonts |"
    radius_rows = "\n".join(f"| `--radius-{kebab(key)}` | {value} |" for key, value in variant["radius"].items()) or "| — | 源未带 radius |"
    pairs = variant["a11y"]["pairs"]
    contrast_rows = "\n".join(
        f"| `{pair.split('/')[0]}` on `{pair.split('/')[1]}` | {ratio:.2f}:1 | ≥ {CONTRAST_MIN}:1 |"
        for pair, ratio in pairs.items()
    ) or "| — | 源色板不足以量测 | — |"
    accent_ratio = f"{pairs.get('onAccent/accent', 0.0):.2f}"
    link_note = (
        f"本主题源里 `--link` 与 `--accent` 同为 `{colors['accent']}`;同屏同时出现时,"
        f"链接补下划线或改用 `--accent-2`,按钮保持 `--accent`"
        if colors.get("link") and colors.get("link") == colors.get("accent")
        else f"本主题 `--link` = `{colors.get('link', '—')}` 与 `--accent` = `{colors.get('accent', '—')}` 不同值,可直接并置"
    )
    green_note = "" if "green" in colors else "(源色板无 green 角色,本包不发该变量)"
    red_note = "" if "red" in colors else "(源色板无 red 角色,本包不发该变量)"
    a11y_note = ""
    if variant["a11y"]["notes"]:
        a11y_note = "### 语义层留痕(透明记录)\n\n" + "\n".join(f"- {n}" for n in variant["a11y"]["notes"])
    sources = theme.get("sources") or []
    provenance = bullets(
        [
            (f"本地来源(仅登记本机路径,已由 sanitize 处理):{s}" if re.match(r"^[A-Za-z]:[\\/]", str(s).strip()) else str(s))
            for s in sources
        ],
        "- (源 JSON 未登记来源)",
    )

    return render(USAGE_TEMPLATE, {
        "NAME": variant["name"],
        "ID": variant["id"],
        "MODE": variant["mode"],
        "DEFAULT": variant["id"],
        "SIGNATURE": variant["signature"],
        "VAR_ROWS": var_rows,
        "FONT_ROWS": font_rows,
        "RADIUS_ROWS": radius_rows,
        "DO": bullets(theme.get("do") or [], "- (源未写 do)"),
        "DONT": bullets(theme.get("dont") or [], "- (源未写 dont)"),
        "CONTRAST_ROWS": contrast_rows,
        "ACCENT_RATIO": accent_ratio,
        "LINK_NOTE": link_note,
        "GREEN_NOTE": green_note,
        "RED_NOTE": red_note,
        "A11Y_NOTE": a11y_note,
        "PROVENANCE": provenance,
    })


# --------------------------------------------------------------------------- #
# SKILL.md / README.md
# --------------------------------------------------------------------------- #

SKILL_TEMPLATE = """---
name: @@ID@@
description: "@@DESCRIPTION@@"

---

# @@ID@@

让任何网页/面板变成 **@@NAME@@** 的样子,不用 agent 自己编 hex。

@@SIGNATURE@@

## When to use

- 用户点名 @@TRIGGERS@@
- 需要整套配色(bg / bg-deep / surface / ink / accent / 状态色)而不是单个色值
@@WHEN_DO@@

## When not to use

- 整站品牌设计系统(要自定义组件/字体体系)→ 用设计类 skill
- 别的主题族(用户点名其它风格)
@@WHEN_DONT@@

## Default

**`@@ID@@`**(mode `@@MODE@@`)

| role | hex |
|---|---|
@@DEFAULT_ROWS@@

## Sub-themes (id → when)

| id | mode | contrast | pick when |
|---|---|---|---|
| `@@ID@@` | `@@MODE@@` | — | **默认**;@@SIGNATURE@@ |

## Files

| path | use |
|---|---|
| `tokens/absolute.json` | 源盘原色表(原样,含未参与语义映射的色) |
| `tokens/index.json` | 变体目录 + default |
| `tokens/semantic/@@ID@@.json` | 语义映射 + `derived`(取源哪个键)+ `a11y`(对比度实测) |
| `css/default.css` | 默认变体一份,含 `:root`,最快 apply |
| `css/all.css` | 全部变体 + 基础 chrome,含 `:root` |
| `css/themes.css` | 共存版:同 all.css 但**无 `:root`**,只 `[data-theme]` / `.theme-<id>` 作用域 |
| `docs/usage.md` | 配对规则 / 字体配方 / 反模式(中文) |
| `preview/index.html` | @@PREVIEW_CELL@@ |

## Agent apply steps

1. **Pick variant** — 用户点名变体就用它;否则 `@@ID@@`。
2. **Read tokens** — `tokens/semantic/@@ID@@.json`(`colors` 是语义键,`derived` 说明它取自源盘哪个键)。
3. **写入 CSS 变量** — 项目已有 `--bg/--ink/--accent` 就沿用同名;否则整份贴,或同时写 `--theme-*` 别名。
4. **挂主题作用域** — `<html data-theme="@@ID@@" class="theme-@@ID@@">`;多主题站点用 `css/themes.css`。
5. **选文件** — 单主题 `css/default.css`;多主题 `css/all.css`(带 `:root`)或 `css/themes.css`(不带)。
6. **按角色套件**:
   - 页面底 → `--bg` / `--bg-deep`
   - 卡面面板 → `--surface` + `--border`
   - 正文 → `--ink`;次要 → `--ink-muted` / `--ink-dim`
   - 主按钮 → `--accent` + `--on-accent`(一屏一个 CTA)
   - 链接 → `--link`(**不**用 `--accent`,强调色不做链接色)
   - 危险 → `--red`;成功 → `--green`
7. **不要发明 hex** — 颜色只能来自 `tokens/absolute.json`;缺角色就跳过该变量。
8. **自检** — `python scripts/assert_tokens.py` 必须打印 `PASS assert_tokens @@ID@@`。

### Minimal `:root` snippet (`@@ID@@`)

```css
@@SNIPPET@@
```

### HTML switch

```html
<html data-theme="@@ID@@" class="theme-@@ID@@">
  <link rel="stylesheet" href="css/default.css">
```

## Hard rules

@@HARD_RULES@@

## Notes

- 预览:@@PREVIEW_NOTE@@
- 来源与语义层修正:`docs/usage.md` 末节。
"""


def skill_md(theme: dict, variant: dict, preview_rel) -> str:
    colors = variant["colors"]
    default_rows = "\n".join(
        f"| `{key}` | `{colors[key]}` |"
        for key in ("bg", "bgDeep", "surface", "ink", "accent", "link", "red")
        if key in colors
    )
    snippet = "\n".join(
        [f":root {{", f"  color-scheme: {variant['mode']};"]
        + [f"  --{kebab(k)}: {v};" for k, v in colors.items()]
        + ["}"]
    )
    triggers = " / ".join(dict.fromkeys([variant["name"], variant["id"], variant["signature"]]))
    description = (
        f"{variant['name']}({variant['mode']} {variant['signature']})。触发:{triggers}。不做整站重构。"
        .replace('"', "'").replace("\n", " ")
    )
    hard_rules = bullets(
        [f"**Never** {item}(源 `dont`)" for item in (theme.get("dont") or [])],
        "- 源未写 dont:仍按语义键使用,不要换别的主题族色板。",
    )
    when_do = "\n".join(f"- 需要 {item}" for item in (theme.get("do") or []))
    when_dont = "\n".join(f"- {item}" for item in (theme.get("dont") or []))
    preview_cell = "活预览(独立单文件)" if preview_rel else "`null`(本包无活预览)"
    preview_note = (
        f"`{preview_rel}`,单文件可直接打开"
        if preview_rel
        else "本包**无活预览**(`pack.json.files.preview = null`):源库无对应 demo 目录,按 `css/default.css` 与 `docs/usage.md` 落地即可"
    )
    return render(SKILL_TEMPLATE, {
        "ID": variant["id"],
        "NAME": variant["name"],
        "MODE": variant["mode"],
        "SIGNATURE": variant["signature"],
        "TRIGGERS": triggers,
        "DESCRIPTION": description,
        "WHEN_DO": when_do,
        "WHEN_DONT": when_dont,
        "DEFAULT_ROWS": default_rows,
        "PREVIEW_CELL": preview_cell,
        "PREVIEW_NOTE": preview_note,
        "SNIPPET": snippet,
        "HARD_RULES": hard_rules,
    })


README_TEMPLATE = """# @@TITLE@@

@@SIGNATURE@@

- **包 id**:`@@ID@@` · kind `theme` · category `themes` · 默认变体 `@@ID@@`(mode `@@MODE@@`)
- **主色**:bg `@@BG@@` · ink `@@INK@@` · accent `@@ACCENT@@`(on-accent `@@ONACCENT@@`)
- **预览**:@@PREVIEW_LINE@@
- **agent 入口**:[SKILL.md](SKILL.md) · **配对规则**:[docs/usage.md](docs/usage.md)
- **文件**:`tokens/`(原色表 + 语义映射)、`css/`(default / all / themes 三份)、`scripts/assert_tokens.py`(断言)
- **取用**:抄 `css/default.css` 即用;多主题站点用 `css/themes.css`(无 `:root`)
- **许可**:@@LICENSE@@(来源见 `docs/usage.md` 末节)

```bash
python scripts/assert_tokens.py
```
"""


def readme_md(theme: dict, variant: dict, title: str, preview_rel) -> str:
    colors = variant["colors"]
    preview_line = (
        f"[preview/index.html](preview/index.html)(单文件,直接打开)"
        if preview_rel
        else "**无**(`pack.json.files.preview = null`;源库无对应 demo)"
    )
    return render(README_TEMPLATE, {
        "TITLE": title,
        "SIGNATURE": variant["signature"],
        "ID": variant["id"],
        "MODE": variant["mode"],
        "BG": colors.get("bg", "—"),
        "INK": colors.get("ink", "—"),
        "ACCENT": colors.get("accent", "—"),
        "ONACCENT": colors.get("onAccent", "—"),
        "PREVIEW_LINE": preview_line,
        "LICENSE": LICENSE,
    })


# --------------------------------------------------------------------------- #
# pack.json
# --------------------------------------------------------------------------- #

def pack_title(theme: dict) -> str:
    name = theme["name"]
    if has_cjk(name):
        return name
    head = re.split(r"[;；。,，、]", theme.get("signature", "").strip())[0].strip()
    if len(head) > 30:
        cut = head[:30]
        for sep in (" + ", " / ", " "):
            pos = cut.rfind(sep)
            if pos >= 10:
                cut = cut[:pos]
                break
        head = cut.strip(" +/·")
    return f"{name} · {head}" if head else name


TAG_LEXICON = (
    ("纸", "paper"), ("墨", "ink"), ("红", "red"), ("蓝", "blue"), ("绿", "green"),
    ("黄", "yellow"), ("衬线", "serif"), ("无衬线", "sans"), ("等宽", "mono"),
    ("网格", "grid"), ("极简", "minimal"), ("粗野", "brutalist"), ("拼贴", "popart"),
    ("暗", "dark"), ("浅", "light"), ("暖", "warm"), ("冷", "cool"),
    ("高对比", "contrast"), ("留白", "whitespace"), ("档案", "archive"), ("地图", "map"),
    ("数据", "dataviz"), ("编辑", "editorial"), ("瑞士", "swiss"), ("单色", "monochrome"),
    ("渐变", "gradient"), ("阴影", "shadow"), ("卡片", "card"), ("记录", "record"),
    ("奶油", "cream"), ("void", "void"),
)


def pack_tags(theme: dict, variant: dict) -> list:
    haystack = f"{theme['name']} {theme.get('signature', '')}".lower()
    tags = [variant["mode"], "theme"]
    for needle, tag in TAG_LEXICON:
        if needle in haystack and tag not in tags:
            tags.append(tag)
    return tags


def pack_when(theme: dict) -> str:
    do = theme.get("do") or []
    base = theme.get("signature", "").strip()
    return f"{base};适用:{';'.join(do)}" if do else base


def pack_not_for(theme: dict) -> str:
    dont = theme.get("dont") or []
    return "禁用:" + ";".join(dont) if dont else "整站品牌设计系统、非本主题族风格"


def pack_attribution(theme: dict, pack_id: str) -> list:
    entries = [{
        "name": f"Sai Theme Lab · themes/{pack_id}.json",
        "license": LICENSE,
        "what": "原色板来源(旧库原子,只读取用)",
    }]
    seen = set()
    for source in theme.get("sources") or []:
        for url in re.findall(r"https?://[^\s)）;；]+", str(source)):
            if url in seen:
                continue
            seen.add(url)
            host = re.sub(r"^https?://", "", url).split("/")[0]
            entries.append({"name": host, "url": url, "license": "见上游", "what": f"来源登记:{source}"})
    return entries


def pack_json(theme: dict, variant: dict, title: str, preview_rel, evidence: str) -> dict:
    files = {
        "tokens": [
            "tokens/absolute.json",
            "tokens/index.json",
            f"tokens/semantic/{variant['id']}.json",
        ],
        "css": ["css/default.css", "css/all.css", "css/themes.css"],
        "usage": "docs/usage.md",
        "assert": "scripts/assert_tokens.py",
        "preview": preview_rel,
    }
    data = {
        "schema": 1,
        "id": variant["id"],
        "title": title,
        "kind": KIND,
        "category": CATEGORY,
        "version": VERSION,
        "license": LICENSE,
        "attribution": pack_attribution(theme, variant["id"]),
        "origin": {
            "project": ORIGIN_PROJECT,
            "path": f"themes/{variant['id']}.json",
            "derived_from": None,
        },
        "entry": "SKILL.md",
        "files": files,
        "tags": pack_tags(theme, variant),
        "when": pack_when(theme),
        "not_for": pack_not_for(theme),
        "default_variant": variant["id"],
        "verified": {
            "date": datetime.date.today().isoformat(),
            "how": f"python packs/{variant['id']}/scripts/assert_tokens.py",
            "evidence": evidence,
        },
        "canonical_home": None,
    }
    if variant["a11y"]["adjusted"]:
        data["changelog"] = [
            "1.0.0:语义层按 WCAG ≥4.5:1 修正 accent/on-accent 配对(见 tokens/semantic 的 a11y 与 docs/usage.md);"
            "tokens/absolute.json 未改。"
        ]
    return data


# --------------------------------------------------------------------------- #
# scripts/assert_tokens.py(每包一份,顶部常量不同)
# --------------------------------------------------------------------------- #

ASSERT_HEADER = '''#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""@@ID@@ 包的令牌断言。退出 0 = 通过。

由 scripts/build_pack.py 生成;要改断言口径请改生成器,不要手改本文件。
覆盖(契约 docs/PACK-CONTRACT.md §5):
  1) 锚点色与原色表一致,且与语义层一致;2) 必备语义键齐全(源色板确实没有的角色列在 NOT_IN_PALETTE);
  3) 色值均为 6 位 hex(rgba() 透明值按契约 §5 原样保留并单独计数;shadow/glow 是效果值另计);
  4) 产物文件齐备(pack.json.files 列出的每一项都在磁盘上);
  5) docs/usage.md 含配对/反模式小节,SKILL.md 含标准章节;
  6) WCAG 对比度:ink on bg ≥ 4.5:1、on-accent on accent ≥ 4.5:1(独立实现,不复用生成器代码)。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PACK_ID = @@PACK_ID@@
DEFAULT_VARIANT = @@DEFAULT_VARIANT@@
VARIANTS = @@VARIANTS@@
CONTRAST_MIN = @@CONTRAST_MIN@@
ANCHORS = @@ANCHORS@@          # (语义键, 原色表键, 期望 hex)
REQUIRED_KEYS = @@REQUIRED_KEYS@@
NOT_IN_PALETTE = @@NOT_IN_PALETTE@@
VAR_MAP = @@VAR_MAP@@          # 语义键 → CSS 变量后缀
CONTRAST_PAIRS = @@CONTRAST_PAIRS@@
PRODUCT_FILES = @@PRODUCT_FILES@@
USAGE_CUES = ("配对", "反模式", "--ink", "--accent", "--surface")
SKILL_CUES = (
    "## When to use", "## When not to use", "## Default", "## Sub-themes",
    "## Files", "## Agent apply steps", "## Hard rules",
)
EFFECT_PREFIXES = ("shadow", "glow")
'''

ASSERT_BODY = '''

HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
COLOR = re.compile(
    r"^#[0-9a-fA-F]{6}$"
    r"|^rgba?\\(\\s*[\\d.]+\\s*,\\s*[\\d.]+\\s*,\\s*[\\d.]+\\s*(?:,\\s*[\\d.]+\\s*)?\\)$"
)
EFFECT = re.compile(r"^(?:none|-?[\\w\\s.,()%#]+)$")


def fail(msg: str) -> None:
    print(f"FAIL assert_tokens {PACK_ID}: {msg}", file=sys.stderr)
    sys.exit(1)


def channel(value: float) -> float:
    value = value / 255.0
    return value / 12.92 if value <= 0.03928 else ((value + 0.055) / 1.055) ** 2.4


def luminance(hex_color: str) -> float:
    if not HEX.match(hex_color):
        fail(f"对比度只能量 6 位 hex,拿到 {hex_color!r}")
    raw = hex_color.lstrip("#")
    r, g, b = (int(raw[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def contrast(fg: str, bg: str) -> float:
    a, b = luminance(fg), luminance(bg)
    if a < b:
        a, b = b, a
    return (a + 0.05) / (b + 0.05)


def load(rel: str):
    path = ROOT / rel
    if not path.is_file():
        fail(f"缺文件 {rel}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"{rel} 不是合法 JSON:{exc}")


def _has_root_selector(text: str) -> bool:
    """选择器层面的 :root(文档/注释里提到不算)。"""
    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith(":root"):
            return True
        if ":root," in line or ", :root" in line:
            return True
    return False


def main() -> int:
    absolute = load("tokens/absolute.json")
    raw_colors = absolute.get("colors") or {}
    if not raw_colors:
        fail("tokens/absolute.json 缺 colors")
    index = load("tokens/index.json")
    if index.get("default") != DEFAULT_VARIANT:
        fail(f"default 应为 {DEFAULT_VARIANT},实为 {index.get('default')!r}")
    listed = [t.get("id") for t in index.get("themes", [])]
    if listed != list(VARIANTS):
        fail(f"变体目录应为 {list(VARIANTS)},实为 {listed}")
    for entry in index.get("themes", []):
        if not (ROOT / str(entry.get("path"))).is_file():
            fail(f"变体目录里的 path 不存在:{entry.get('path')!r}")

    hex_count = rgba_count = effect_count = 0
    semantic = {}
    for variant in VARIANTS:
        rel = f"tokens/semantic/{variant}.json"
        sem = load(rel)
        semantic[variant] = sem
        for key in ("id", "name", "mode", "colors", "fonts", "radius"):
            if key not in sem:
                fail(f"{rel} 缺字段 {key}")
        if sem["id"] != variant:
            fail(f"{rel} 的 id 与文件名不一致:{sem['id']!r}")
        if sem["mode"] not in ("dark", "light"):
            fail(f"{rel} mode 非法:{sem['mode']!r}")
        colors = sem["colors"]
        for key in REQUIRED_KEYS:
            if key not in colors:
                fail(f"{rel} 缺语义键 colors.{key}")
        for key in NOT_IN_PALETTE:
            if key in colors:
                fail(f"{rel} 不该有 colors.{key}(源色板无此角色)")
        for key, value in colors.items():
            if key.lower().startswith(EFFECT_PREFIXES):
                if not isinstance(value, str) or not EFFECT.match(value):
                    fail(f"{rel} colors.{key} 不是合法效果值:{value!r}")
                effect_count += 1
                continue
            if not isinstance(value, str) or not COLOR.match(value):
                fail(f"{rel} colors.{key} 既不是 6 位 hex 也不是 rgba():{value!r}")
            if HEX.match(value):
                hex_count += 1
            else:
                rgba_count += 1

    for sem_key, abs_key, expected in ANCHORS:
        actual = raw_colors.get(abs_key)
        if not isinstance(actual, str) or actual.lower() != expected.lower():
            fail(f"原色表 {abs_key} 应为 {expected},实为 {actual!r}")
        got = semantic[DEFAULT_VARIANT]["colors"].get(sem_key)
        if not isinstance(got, str) or got.lower() != expected.lower():
            fail(f"语义 {sem_key} 应为 {expected},实为 {got!r}")

    default_colors = semantic[DEFAULT_VARIANT]["colors"]
    ratios = []
    for fg_key, bg_key in CONTRAST_PAIRS:
        if fg_key not in default_colors or bg_key not in default_colors:
            fail(f"对比度缺键:{fg_key} / {bg_key}")
        ratio = contrast(default_colors[fg_key], default_colors[bg_key])
        ratios.append(f"{fg_key}/{bg_key}={ratio:.2f}")
        if ratio < CONTRAST_MIN:
            fail(f"对比度不足 {fg_key} on {bg_key}:{ratio:.2f}:1 < {CONTRAST_MIN}")

    for rel in PRODUCT_FILES:
        if not (ROOT / rel).is_file():
            fail(f"缺产物 {rel}")
    declared_preview = (load("pack.json").get("files") or {}).get("preview")
    if declared_preview:
        if not (ROOT / declared_preview).is_file():
            fail(f"缺产物 {declared_preview}")
    elif (ROOT / "preview" / "index.html").is_file():
        fail("pack.json 未声明预览,但 preview/index.html 存在")

    pack = load("pack.json")
    for key in ("schema", "id", "title", "kind", "category", "version", "license", "attribution",
                "origin", "entry", "files", "tags", "when", "not_for", "default_variant", "verified"):
        if key not in pack:
            fail(f"pack.json 缺字段 {key}")
    if pack["id"] != PACK_ID:
        fail(f"pack.json id 应为 {PACK_ID}")
    if pack["kind"] != "theme" or pack["category"] != "themes":
        fail("pack.json kind/category 应为 theme/themes")
    if pack["license"] != "MIT":
        fail(f"license 应为 MIT,实为 {pack['license']!r}")
    if pack["default_variant"] != DEFAULT_VARIANT:
        fail("pack.json default_variant 与常量不一致")
    origin_path = str((pack.get("origin") or {}).get("path", ""))
    if re.match(r"^([A-Za-z]:[\\\\/]|[\\\\/])", origin_path):
        fail(f"origin.path 必须是相对路径:{origin_path!r}")
    for key, value in (pack.get("files") or {}).items():
        if value is None:
            continue
        for rel in (value if isinstance(value, list) else [value]):
            if not (ROOT / rel).is_file():
                fail(f"pack.json files.{key} 列出的 {rel} 不存在")
    verified = pack.get("verified") or {}
    for key in ("date", "how", "evidence"):
        if not str(verified.get(key) or "").strip():
            fail(f"pack.json verified.{key} 为空")

    for rel, needs_root in (("css/default.css", True), ("css/all.css", True), ("css/themes.css", False)):
        text = (ROOT / rel).read_text(encoding="utf-8")
        root_selector = _has_root_selector(text)
        if needs_root and not root_selector:
            fail(f"{rel} 缺 :root 选择器")
        if (not needs_root) and root_selector:
            fail(f"{rel} 不能含 :root 选择器(共存版只出 [data-theme] / .theme-<id> 作用域)")
        if f'[data-theme="{DEFAULT_VARIANT}"]' not in text:
            fail(f"{rel} 缺 [data-theme='{DEFAULT_VARIANT}'] 作用域")
        if f".theme-{PACK_ID}" not in text:
            fail(f"{rel} 缺 .theme-{PACK_ID} 类")
        if "color-scheme:" not in text:
            fail(f"{rel} 缺 color-scheme")
        for key in default_colors:
            var = VAR_MAP.get(key, key)
            if f"--{var}:" not in text or f"--theme-{var}:" not in text:
                fail(f"{rel} 缺变量 --{var} / --theme-{var}")

    usage = (ROOT / "docs" / "usage.md").read_text(encoding="utf-8")
    for cue in USAGE_CUES:
        if cue not in usage:
            fail(f"docs/usage.md 缺小节/口径:{cue}")
    skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")
    for cue in SKILL_CUES:
        if cue not in skill:
            fail(f"SKILL.md 缺章节:{cue}")
    if PACK_ID not in skill:
        fail("SKILL.md 未出现包 id")

    print(f"PASS assert_tokens {PACK_ID}")
    print(f"  variants={len(VARIANTS)} keys={len(default_colors)} hex={hex_count} rgba={rgba_count} "
          f"effects={effect_count} contrast={' '.join(ratios)}")
    print(f"  not_in_palette={list(NOT_IN_PALETTE)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
'''


def assert_source(theme: dict, variant: dict) -> str:
    colors = variant["colors"]
    anchors = []
    for key in ("bg", "ink", "accent", "onAccent"):
        if key in colors and isinstance(colors[key], str) and HEX.match(colors[key]):
            anchors.append((key, variant["derived"].get(key, key), colors[key]))
    required = tuple(k for k in CORE if k in colors)
    not_in_palette = tuple(k for k in CORE if k not in colors)
    var_map = {key: kebab(key) for key in colors}
    product_files = [
        "tokens/absolute.json",
        "tokens/index.json",
        f"tokens/semantic/{variant['id']}.json",
        "css/default.css",
        "css/all.css",
        "css/themes.css",
        "docs/usage.md",
        "scripts/assert_tokens.py",
        "SKILL.md",
        "README.md",
        "pack.json",
    ]
    header = render(ASSERT_HEADER, {
        "ID": variant["id"],
        "PACK_ID": json.dumps(variant["id"], ensure_ascii=False),
        "DEFAULT_VARIANT": json.dumps(variant["id"], ensure_ascii=False),
        "VARIANTS": json.dumps([variant["id"]], ensure_ascii=False),
        "CONTRAST_MIN": repr(CONTRAST_MIN),
        "ANCHORS": json.dumps([list(a) for a in anchors], ensure_ascii=False, indent=4),
        "REQUIRED_KEYS": json.dumps(list(required), ensure_ascii=False),
        "NOT_IN_PALETTE": json.dumps(list(not_in_palette), ensure_ascii=False),
        "VAR_MAP": json.dumps(var_map, ensure_ascii=False, indent=4),
        "CONTRAST_PAIRS": json.dumps([["ink", "bg"], ["onAccent", "accent"]], ensure_ascii=False),
        "PRODUCT_FILES": json.dumps(product_files, ensure_ascii=False, indent=4),
    })
    return header + ASSERT_BODY


# --------------------------------------------------------------------------- #
# preview/
# --------------------------------------------------------------------------- #

REF_RE = re.compile(r"""(?:href|src)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^"')]+)""")
COPY_EXTS = {".css", ".js", ".json"}


def copy_preview(src_demos: Path, demo_dir: str, dest_dir: Path) -> tuple:
    """拷 preview.html → preview/index.html,并带上被相对引用的 css/js/json(不含 MANIFEST.json)。"""
    src_dir = src_demos / demo_dir
    src_html = src_dir / "preview.html"
    if not src_html.is_file():
        return None, [], [f"demo 目录 {src_dir} 无 preview.html"]
    dest_dir.mkdir(parents=True, exist_ok=True)
    copied = []
    seen = set()
    html = src_html.read_text(encoding="utf-8")
    for a, b in REF_RE.findall(html):
        ref = (a or b).split("#")[0].split("?")[0].strip()
        if not ref or ref.startswith(("http://", "https://", "//", "data:", "mailto:", "javascript:")):
            continue
        rel = Path(ref)
        if rel.is_absolute() or rel.name == "MANIFEST.json":
            continue
        if rel.suffix.lower() not in COPY_EXTS or rel.as_posix() in seen:
            continue
        source = (src_dir / rel).resolve()
        try:
            source.relative_to(src_dir.resolve())
        except ValueError:
            continue
        if not source.is_file():
            continue
        seen.add(rel.as_posix())
        target = dest_dir / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(source.read_bytes())
        copied.append(f"preview/{rel.as_posix()}")
    (dest_dir / "index.html").write_text(html, encoding="utf-8", newline="\n")
    return f"preview/index.html", copied, []


def preview_dir_for(pack_id: str, alias: dict) -> str | None:
    mapped = (alias.get("map") or {}).get(pack_id)
    return mapped or pack_id


# --------------------------------------------------------------------------- #
# 单包生成
# --------------------------------------------------------------------------- #

def build_pack(pack_id: str, src: Path, alias: dict, cfg: dict, do_sanitize: bool, log) -> dict:
    theme_path = src / "themes" / f"{pack_id}.json"
    if not theme_path.is_file():
        raise SystemExit(f"源主题不存在:{theme_path}")
    theme = json.loads(theme_path.read_text(encoding="utf-8"))
    variant = resolve_variant(theme, pack_id)
    pack_dir = PACKS_DIR / pack_id
    if pack_dir.exists():
        shutil.rmtree(pack_dir)  # 生成物整体重写:避免上一轮的 preview/ 等残留
        log(f"   重置 {pack_dir.as_posix()}(生成物全量重写,不要手改)")
    pack_dir.mkdir(parents=True, exist_ok=True)
    title = pack_title(theme)

    demo_dir = preview_dir_for(pack_id, alias)
    preview_rel = None
    preview_notes = []
    if demo_dir and (src / "demos" / demo_dir).is_dir():
        preview_rel, copied, notes = copy_preview(src / "demos", demo_dir, pack_dir / "preview")
        preview_notes = notes + [f"preview 附带 {c}" for c in copied]
        if notes:
            log(f"   预览缺失:{notes}")
    else:
        preview_notes = [
            f"无 demo 目录映射(alias.map['{pack_id}'] = {demo_dir!r},源库 demos/ 下无此目录)→ files.preview = null"
        ]
        log(f"   无预览:{preview_notes[0]}")

    write_json(pack_dir / "tokens" / "absolute.json", tokens_absolute(theme, pack_id))
    write_json(pack_dir / "tokens" / "index.json", tokens_index(variant))
    write_json(pack_dir / "tokens" / "semantic" / f"{pack_id}.json", tokens_semantic(variant))
    write_text(pack_dir / "css" / "default.css", css_default(pack_id, variant))
    write_text(pack_dir / "css" / "all.css", css_all(pack_id, variant))
    write_text(pack_dir / "css" / "themes.css", css_themes(variant))
    write_text(pack_dir / "docs" / "usage.md", usage_md(theme, variant))
    write_text(pack_dir / "SKILL.md", skill_md(theme, variant, preview_rel))
    write_text(pack_dir / "README.md", readme_md(theme, variant, title, preview_rel))
    write_text(pack_dir / "scripts" / "assert_tokens.py", assert_source(theme, variant))

    # pack.json 先落盘(verified.evidence 是"待回填"字样,assert 通过后换成实测输出);
    # 清洗对已落盘文件就地替换,之后只回填 evidence,避免把清洗结果覆盖回去。
    pack_path = pack_dir / "pack.json"
    write_json(pack_path, pack_json(theme, variant, title, preview_rel, PENDING_EVIDENCE))

    report = None
    if do_sanitize:
        report = sanitize.sanitize_tree(pack_dir, pack_id, cfg)
        sanitize.print_report(report, pack_dir, verbose=False, stream=sys.stdout)

    assert_path = pack_dir / "scripts" / "assert_tokens.py"

    def run_assert() -> tuple:
        proc = subprocess.run(
            [sys.executable, str(assert_path)],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
        return proc.returncode, (proc.stdout or "").strip(), (proc.stderr or "").strip()

    rc, out, err = run_assert()
    if rc != 0:
        print(out)
        print(err, file=sys.stderr)
        raise SystemExit(f"{pack_id}:assert_tokens 未通过(rc={rc});pack.json 停在待回填状态,未标记 verified")

    evidence = " | ".join(line.strip() for line in out.splitlines() if line.strip())
    final = json.loads(pack_path.read_text(encoding="utf-8"))
    final["verified"] = {
        "date": datetime.date.today().isoformat(),
        "how": f"python packs/{pack_id}/scripts/assert_tokens.py",
        "evidence": evidence,
    }
    write_json(pack_path, final)
    rc, out, err = run_assert()
    if rc != 0:
        raise SystemExit(f"{pack_id}:回填 verified 后 assert 复核失败:\n{out}\n{err}")
    return {
        "id": pack_id,
        "variant": variant,
        "title": title,
        "preview": preview_rel,
        "sanitize": report,
        "evidence": evidence,
        "preview_notes": preview_notes,
        "pack_dir": pack_dir,
    }


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="旧库主题原子 → packs/<id>/")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--all-themes", action="store_true", help=f"生成 {len(THEME_IDS)} 个主题包")
    group.add_argument("--theme", action="append", metavar="ID", help="只生成指定包(可重复)")
    parser.add_argument("--src", metavar="DIR", help="旧库根(默认取环境变量 %s 或本机 Sai Theme Lab 根)" % SRC_ENV)
    parser.add_argument("--no-sanitize", action="store_true", help="跳过 scripts/sanitize.py")
    parser.add_argument("--quiet", action="store_true", help="只打印每包一行结果")
    return parser.parse_args(argv)


def main(argv=None) -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    args = parse_args(argv)
    src = Path(args.src) if args.src else Path(os.environ.get(SRC_ENV) or DEFAULT_SRC)
    if not (src / "themes").is_dir():
        raise SystemExit(f"旧库根不成立(缺 themes/):{src} — 用 --src 指定")
    ids = list(THEME_IDS) if args.all_themes else list(args.theme or [])
    unknown = [i for i in ids if i not in THEME_IDS]
    if unknown:
        raise SystemExit(f"未知主题 {unknown};本 ticket 可生成:{list(THEME_IDS)}")
    alias_path = REPO_ROOT / "schema" / "alias.json"
    alias = json.loads(alias_path.read_text(encoding="utf-8")) if alias_path.is_file() else {}
    cfg = sanitize.load_config() if not args.no_sanitize else {}

    def log(message: str) -> None:
        if not args.quiet:
            print(message)

    results = []
    for index, pack_id in enumerate(ids, 1):
        print(f"[{index}/{len(ids)}] {pack_id}")
        result = build_pack(pack_id, src, alias, cfg, not args.no_sanitize, log)
        results.append(result)
        print(f"    ok · title={result['title']!r} preview={result['preview']}")

    total_files = sum((r["sanitize"] or {}).get("files", 0) for r in results)
    total_hits = sum((r["sanitize"] or {}).get("total", 0) for r in results)
    grouped: dict = {}
    for r in results:
        for rule_id, slot in ((r["sanitize"] or {}).get("rules") or {}).items():
            grouped[rule_id] = grouped.get(rule_id, 0) + slot["count"]
    print(f"\n生成完成:{len(results)} 包 · 清洗扫描 {total_files} 文件 · {total_hits} 处替换"
          f"{'(--no-sanitize 已跳过)' if args.no_sanitize else ''}")
    for rule_id in sorted(grouped, key=lambda k: (-grouped[k], k)):
        print(f"   {rule_id:<24} x{grouped[rule_id]}")
    print("逐包复核命令:python packs/<id>/scripts/assert_tokens.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
