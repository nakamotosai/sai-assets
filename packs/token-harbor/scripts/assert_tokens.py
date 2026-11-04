#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""token-harbor 断言:原色表 / 语义键 / 色值合法 / 两份 CSS 与语义表逐条一致 / 对比度双档 / 产物齐备。

口径:
- tokens/semantic/<variant>.json 是唯一真值;css/default.css 的 :root 必须逐条等于 dark,
  css/themes.css 的 [data-theme="dark"] / [data-theme="light"] 两个作用域必须分别逐条等于两个变体。
  这样"改一个 hex 忘了同步"会在本地立刻红,而不是等上线才发现。
- 对比度用 WCAG 相对亮度实测数学,不查表、不硬编:四档(两模 × ink/muted)全部必须 ≥ 4.5:1。
- 禁用内容形态(盘符路径 / 内网地址 / 品牌词)由仓级 scripts/gate.py 判定,本脚本刻意不复刻规则 ——
  规则字面量写进源码本身就会成为被禁形态的载体,也会造成第二套口径。

通过 = 打印 "PASS assert_tokens token-harbor" + 实测摘要,退出 0;失败 = FAIL 原因打到 stderr,退出 1。
仅用标准库。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK_ID = "token-harbor"

HEX6 = re.compile(r"^#[0-9a-fA-F]{6}$")
RGBA = re.compile(r"^rgba\(\s*\d{1,3},\s*\d{1,3},\s*\d{1,3},\s*(?:0|1|0?\.\d+)\s*\)$")
COMMENT = re.compile(r"/\*.*?\*/", re.S)
DECL = re.compile(r"--([a-z0-9-]+)\s*:\s*([^;{}]+);")
HEX_OR_FUNC = re.compile(r"#[0-9a-fA-F]{3,8}\b|\brgba?\(")
ATTR_RE = re.compile(r"""(?:src|href)\s*=\s*["']([^"']+)["']""")
URL_RE = re.compile(r"""url\(\s*["']?([^"')]+)["']?\s*\)""")
SCHEME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9+.\-]*:")

REQUIRED_PACK_KEYS = (
    "schema", "id", "title", "kind", "category", "version", "license", "attribution",
    "origin", "entry", "files", "tags", "when", "not_for", "default_variant", "verified",
)
ALLOWED_FILES_KEYS = {"tokens", "css", "src", "upstream", "usage", "assert", "preview"}

REQUIRED_TOKENS = (
    "bg", "surface", "surface-raised", "ink", "muted", "muted-soft",
    "line", "line-hairline", "line-field", "line-control",
    "surface-hover", "surface-pressed", "accent", "on-accent",
    "promo-bg", "promo-fg", "footer-bg", "footer-fg",
    "shadow-btn", "shadow-card", "shadow-pill",
)
SHADOW_TOKENS = ("shadow-btn", "shadow-card", "shadow-pill")
CONTRAST_MIN = 4.5

DOC_CUES = (
    "## 什么时候用",
    "## 组件 → token",
    "## 双模怎么切",
    "## 刻度",
    "## 接入步骤",
    "## 取用",
    "## 反模式",
    "## 来源与许可",
    "data-theme",
    "--line-hairline",
    "--promo-bg",
    "--footer-bg",
    "on-accent",
    "aria-invalid",
)
SKILL_CUES = (
    "## When to use",
    "## When not to use",
    "## Default",
    "## Variants and axes",
    "## Files",
    "## Agent apply steps",
    "## Hard rules",
    "tokens/semantic/dark.json",
    "css/themes.css",
)
CSS_CUES = (
    "color-scheme: dark",
    "--radius-btn: 4px",
    "--radius-card: 14px",
    "--fs-body: 14px",
    ":focus-visible",
    "position: sticky",
    "width: var(--hit)",
    "var(--shadow-pill)",
    'aria-invalid="true"',
    "prefers-reduced-motion: reduce",
)
THEMES_CUES = ('[data-theme="dark"]', '[data-theme="light"]', "color-scheme: light")
PREVIEW_CUES = (
    'class="announce"',
    'class="site-header"',
    'class="site-footer"',
    'class="faq-item',
    'class="project-form"',
    "sku-card is-featured",
    "data-theme-toggle",
    'aria-invalid="true"',
    "../css/default.css",
    "../css/themes.css",
    'data-token="--bg"',
    "var(--fs-display)",
)
NAV_CALLS = ("location.href", "location.replace", "location.assign", "http-equiv=\"refresh\"", "http-equiv='refresh'", "window.open")


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def load_json(rel: str) -> dict:
    path = ROOT / rel
    if not path.is_file():
        fail(f"缺少 {rel}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"{rel} 无法解析:{exc}")
    if not isinstance(data, dict):
        fail(f"{rel} 根必须是对象")
    return data


def norm(value: str) -> str:
    return re.sub(r"\s+", "", value)


# --------------------------------------------------------------------------- #
# 1 · 色值与对比度
# --------------------------------------------------------------------------- #

def is_color(value: str) -> bool:
    return bool(HEX6.match(value) or RGBA.match(value))


SHADOW_COLOR = re.compile(r"rgba\([^)]*\)")
SHADOW_JUNK = re.compile(r"[^0-9a-z%.\s,\-]")


def is_shadow(value: str) -> bool:
    """影值:去掉里面的每个 rgba() 后,剩下的只能是长度 / 偏移 / 逗号(不许留别的颜色写法)。"""
    found = SHADOW_COLOR.findall(value)
    if not found:
        return False
    if SHADOW_JUNK.search(SHADOW_COLOR.sub("", value)):
        return False
    return all(RGBA.match(norm(color)) for color in found)


def lum(hex6: str) -> float:
    h = hex6.lstrip("#")
    ch = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in ch]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def contrast(fg: str, bg: str) -> float:
    la, lb = lum(fg), lum(bg)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


# --------------------------------------------------------------------------- #
# 2 · CSS 块抽取
# --------------------------------------------------------------------------- #

def block_span(text: str, selector: str) -> tuple[int, int]:
    """取 selector + { ... } 的第一个真实块的头尾下标(注释里出现的同名文字后面没有 {,不会被误取)。"""
    match = re.search(re.escape(selector) + r"\s*\{", text)
    if not match:
        fail(f"CSS 里找不到作用域 {selector} {{ }}")
    start = text.index("{", match.start())
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return match.start(), i + 1
    fail(f"CSS 里作用域 {selector} 的花括号没有闭合")


def block_body(text: str, selector: str) -> str:
    start, end = block_span(text, selector)
    return text[text.index("{", start) + 1:end - 1]


def decls(body: str) -> dict[str, str]:
    clean = COMMENT.sub("", body)
    return {name: norm(value) for name, value in DECL.findall(clean)}


def strip_blocks(text: str, selectors) -> str:
    """整块删掉(含选择器与花括号),再去注释 —— 剩下的就是"构件区"。"""
    out = text
    for selector in selectors:
        start, end = block_span(out, selector)
        out = out[:start] + out[end:]
    return COMMENT.sub("", out).strip()


# --------------------------------------------------------------------------- #
# 3 · 逐段校验
# --------------------------------------------------------------------------- #

def check_pack() -> dict:
    pack = load_json("pack.json")
    missing = [k for k in REQUIRED_PACK_KEYS if k not in pack]
    if missing:
        fail(f"pack.json 缺必备键:{', '.join(missing)}")
    if pack["schema"] != 1:
        fail(f"schema 必须是 1,得到 {pack['schema']!r}")
    if pack["id"] != PACK_ID:
        fail(f"id 必须是 {PACK_ID},得到 {pack['id']!r}")
    if pack["kind"] != "theme":
        fail(f"kind 必须是 theme,得到 {pack['kind']!r}")
    if pack["category"] != "themes":
        fail(f"category 必须是 themes,得到 {pack['category']!r}")
    if pack["license"] != "MIT":
        fail(f"license 必须是 MIT,得到 {pack['license']!r}")
    if not re.match(r"^\d+\.\d+\.\d+$", str(pack["version"])):
        fail(f"version 不是 x.y.z:{pack['version']!r}")
    if pack.get("default_variant") != "dark":
        fail(f"default_variant 必须是 dark,得到 {pack.get('default_variant')!r}")
    if not isinstance(pack["attribution"], list) or not pack["attribution"]:
        fail("attribution 必须是非空数组")
    for i, item in enumerate(pack["attribution"]):
        if not isinstance(item, dict) or not item.get("name") or not item.get("license"):
            fail(f"attribution[{i}] 缺 name / license")

    origin = pack["origin"]
    if not isinstance(origin, dict) or not origin.get("project") or not origin.get("path"):
        fail("origin 必须有 project 与 path")
    opath = str(origin["path"])
    if re.match(r"^([A-Za-z]:|[\\/]{1,2})", opath):
        fail(f"origin.path 必须是相对路径:{opath!r}")

    files = pack["files"]
    if not isinstance(files, dict) or not files:
        fail("files 必须是非空对象")
    unknown = sorted(set(files) - ALLOWED_FILES_KEYS)
    if unknown:
        fail(f"files 用了 schema 不允许的键:{', '.join(unknown)}")
    declared: list[str] = []
    for key, value in files.items():
        if isinstance(value, list):
            if not value:
                fail(f"files.{key} 是空数组")
            declared.extend(str(v) for v in value)
        elif isinstance(value, str):
            declared.append(value)
        elif value is not None:
            fail(f"files.{key} 类型不对:{type(value).__name__}")
    for rel in declared:
        path = ROOT / rel
        if not path.is_file():
            fail(f"files 声明的路径不存在:{rel}")
        if path.stat().st_size == 0:
            fail(f"files 声明的产物是空文件:{rel}")
    entry = str(pack["entry"])
    if not (ROOT / entry).is_file():
        fail(f"entry 指向的文件不存在:{entry}")
    verified = pack.get("verified")
    if not isinstance(verified, dict) or not verified.get("evidence"):
        fail("verified.evidence 必须是真实跑过的断言输出摘要")
    return pack


def check_absolute() -> dict:
    absolute = load_json("tokens/absolute.json")
    colors = absolute.get("colors")
    shadows = absolute.get("shadows")
    if not isinstance(colors, dict) or not colors:
        fail("tokens/absolute.json 缺 colors(非空)")
    if not isinstance(shadows, dict) or not shadows:
        fail("tokens/absolute.json 缺 shadows(非空)")
    for value, meta in colors.items():
        if not is_color(value):
            fail(f"原色表里的色值不合法(要 6 位 hex 或 rgba):{value!r}")
        if not isinstance(meta, dict) or not meta.get("section") or not meta.get("origin"):
            fail(f"原色 {value} 缺 section / origin(来源小节)")
    for value, meta in shadows.items():
        if not is_shadow(value):
            fail(f"影值里的颜色段不合法:{value!r}")
        if not isinstance(meta, dict) or not meta.get("section") or not meta.get("origin"):
            fail(f"影值 {value} 缺 section / origin(来源小节)")
    return absolute


def check_index(pack: dict) -> list[dict]:
    index = load_json("tokens/index.json")
    variants = index.get("variants")
    if not isinstance(variants, list) or len(variants) != 2:
        fail("tokens/index.json 必须给出两个变体(dark / light)")
    ids = [v.get("id") for v in variants]
    if sorted(ids) != ["dark", "light"]:
        fail(f"变体 id 必须是 dark 与 light,得到 {ids}")
    if index.get("default") != pack.get("default_variant"):
        fail(f"index.default({index.get('default')!r})与 pack.default_variant 不一致")
    default_flags = [v for v in variants if v.get("default") is True]
    if len(default_flags) != 1 or default_flags[0]["id"] != "dark":
        fail("两个变体里必须有且只有 dark 标 default: true")
    for variant in variants:
        rel = str(variant.get("path", ""))
        if not (ROOT / rel).is_file():
            fail(f"变体 {variant.get('id')} 的 path 不存在:{rel}")
        if variant.get("mode") not in ("dark", "light"):
            fail(f"变体 {variant.get('id')} 的 mode 必须是 dark / light")
    return variants


def check_semantic(variant: dict, absolute: dict) -> dict[str, str]:
    rel = str(variant["path"])
    data = load_json(rel)
    tokens = data.get("tokens")
    if not isinstance(tokens, dict) or not tokens:
        fail(f"{rel} 缺 tokens(非空)")
    missing = [name for name in REQUIRED_TOKENS if name not in tokens]
    if missing:
        fail(f"{rel} 缺必备语义键:{', '.join(missing)}")
    values: dict[str, str] = {}
    for name, meta in tokens.items():
        if not isinstance(meta, dict) or not meta.get("value") or not meta.get("atom") or not meta.get("use"):
            fail(f"{rel} 的 {name} 缺 value / atom / use")
        value, atom = str(meta["value"]), str(meta["atom"])
        if name in SHADOW_TOKENS or meta.get("kind") == "shadow":
            if atom not in absolute["shadows"]:
                fail(f"{rel} 的 {name} 影值不在原色表里:{atom!r}")
            if norm(atom) != norm(value):
                fail(f"{rel} 的 {name} 与 atom 不一致:{value!r} vs {atom!r}")
        else:
            if not is_color(value):
                fail(f"{rel} 的 {name} 色值不合法(要 6 位 hex 或 rgba):{value!r}")
            if atom not in absolute["colors"]:
                fail(f"{rel} 的 {name} 引用的原子不在原色表里:{atom!r}")
            if norm(atom) != norm(value):
                fail(f"{rel} 的 {name} 与原色表不一致:{value!r} vs {atom!r}")
        values[name] = value
    if data.get("mode") != variant.get("mode"):
        fail(f"{rel} 的 mode 与 index.json 不一致")
    return values


def compare_css(rel: str, scope_label: str, expected: dict[str, str], names) -> int:
    body = decls(block_body(read(rel), scope_label))
    compared = 0
    for name in names:
        if name not in body:
            fail(f"{rel} 的 {scope_label} 缺 token:--{name}")
        if body[name] != norm(expected[name]):
            fail(
                f"{rel} 的 {scope_label} 里 --{name} 与语义表不一致:"
                f"{body[name]} vs {norm(expected[name])}"
            )
        compared += 1
    return compared


def check_css_drift(absolute: dict, variants: list[dict]) -> tuple[int, int]:
    """两份 CSS 与语义表逐条比对;构件区不许出现颜色字面值;themes.css 不许有构件规则。"""
    dark: dict[str, str] = {}
    light: dict[str, str] = {}
    for variant in variants:
        values = check_semantic(variant, absolute)
        if variant["id"] == "dark":
            dark = values
        else:
            light = values

    names = sorted(dark)
    compared = compare_css("css/default.css", ":root", dark, names)
    compared += compare_css("css/themes.css", '[data-theme="dark"]', dark, names)
    compared += compare_css("css/themes.css", '[data-theme="light"]', light, names)

    chrome = strip_blocks(read("css/default.css"), (":root",))
    leaks = sorted(set(HEX_OR_FUNC.findall(chrome)))
    if leaks:
        fail(f"css/default.css 的构件区出现颜色字面值(必须走 token):{', '.join(leaks)}")

    themes_extra = strip_blocks(read("css/themes.css"), ('[data-theme="dark"]', '[data-theme="light"]'))
    if themes_extra:
        fail(f"css/themes.css 只能出 token 覆盖,却多了构件内容:{themes_extra[:60]!r}")
    return compared, len(names)


def check_contrast(dark: dict[str, str], light: dict[str, str]):
    """四档文字对比度 + 反色块与页脚的实测(全部用真实数学,不硬编)。"""
    measured = []
    for vid, values in (("dark", dark), ("light", light)):
        for name in ("bg", "ink", "muted", "promo-bg", "promo-fg", "footer-bg", "footer-fg"):
            if not HEX6.match(values[name]):
                fail(f"{vid} 的 --{name} 不是 6 位 hex,对比度算不了:{values[name]!r}")
        for fg_key, bg_key in (("ink", "bg"), ("muted", "bg")):
            ratio = contrast(values[fg_key], values[bg_key])
            if ratio < CONTRAST_MIN:
                gap = CONTRAST_MIN - ratio
                fail(
                    f"{vid} 的 {fg_key} on {bg_key} = {ratio:.2f}:1 < {CONTRAST_MIN}:1(差 {gap:.2f});"
                    f"当前 {fg_key} = {values[fg_key]}、{bg_key} = {values[bg_key]} —— "
                    f"改 tokens/semantic/{vid}.json 的 {fg_key}(往远离 {bg_key} 的方向调)后重跑本断言"
                )
            measured.append((vid, fg_key, bg_key, ratio))
    extra = []
    for vid, values in (("dark", dark), ("light", light)):
        extra.append((vid, "promo", contrast(values["promo-fg"], values["promo-bg"])))
        extra.append((vid, "footer", contrast(values["footer-fg"], values["footer-bg"])))
    return measured, extra


def check_preview(pack: dict) -> tuple[int, str, int]:
    rel = str(pack["files"].get("preview") or "")
    if not rel:
        fail("files.preview 不能为空(theme 包要求活预览)")
    path = ROOT / rel
    body = path.read_text(encoding="utf-8")
    for cue in PREVIEW_CUES:
        if cue not in body:
            fail(f"{rel} 缺构件标记:{cue}")
    for call in NAV_CALLS:
        if call in body:
            fail(f"{rel} 出现跳转调用:{call}(预览加载不许跳转)")
    for api in ("localStorage.", "sessionStorage.", "localStorage[", "sessionStorage["):
        if api in body:
            fail(f"{rel} 用了本地存储:{api} —— 预览不写存储也要能看")

    refs: list[tuple[str, str]] = []
    for ref in ATTR_RE.findall(body) + URL_RE.findall(body):
        raw = ref.strip()
        if not raw or raw.startswith("#"):
            continue
        if raw.startswith("//"):
            fail(f"{rel} → {raw}:协议相对引用")
        if SCHEME_RE.match(raw):
            scheme = SCHEME_RE.match(raw).group(0)[:-1].lower()
            if scheme == "data":
                continue
            fail(f"{rel} → {raw}:预览必须是零外部子资源({scheme}: 引用)")
        target = (path.parent / raw.split("#", 1)[0].split("?", 1)[0]).resolve()
        if not target.is_file():
            fail(f"{rel} → {raw}:本地引用解析不到真实文件")
        refs.append((raw, target.relative_to(ROOT).as_posix()))

    linked = [str(t) for _, t in refs]
    for css_rel in ("css/default.css", "css/themes.css"):
        if css_rel not in linked:
            fail(f"{rel} 没有引到 {css_rel}")
    for css_rel in linked:
        if Path(css_rel).suffix == ".css" and URL_RE.search((ROOT / css_rel).read_text(encoding="utf-8")):
            fail(f"{css_rel} 里出现 url() 引用:必须是零外部子资源")

    ids = set(re.findall(r'id="([^"]+)"', body))
    anchors = set(re.findall(r'href="#([^"]+)"', body))
    orphan = sorted(anchors - ids)
    if orphan:
        fail(f"{rel} 的页内锚点指向不存在的 id:{', '.join('#' + a for a in orphan)}")
    if len(ids) < 8:
        fail(f"{rel} 的页内 id 只有 {len(ids)} 个,构件画廊缺分区")

    local = len(refs)
    if local == 0:
        fail("预览没有任何包内引用(样式没接上)")
    return local, rel, len(anchors)


def check_cues() -> None:
    for rel, cues, label in (
        ("docs/usage.md", DOC_CUES, "必备小节 / 关键词"),
        ("SKILL.md", SKILL_CUES, "必备小节 / 关键词"),
        ("css/default.css", CSS_CUES, "实现标记"),
        ("css/themes.css", THEMES_CUES, "作用域标记"),
    ):
        body = read(rel)
        missing = [cue for cue in cues if cue not in body]
        if missing:
            fail(f"{rel} 缺{label}:{', '.join(missing)}")


# --------------------------------------------------------------------------- #

def main() -> None:
    pack = check_pack()
    absolute = check_absolute()
    variants = check_index(pack)
    check_cues()
    compared, token_count = check_css_drift(absolute, variants)

    dark = check_semantic(next(v for v in variants if v["id"] == "dark"), absolute)
    light = check_semantic(next(v for v in variants if v["id"] == "light"), absolute)
    measured, extra = check_contrast(dark, light)
    local_refs, preview_rel, anchor_count = check_preview(pack)

    all_files = [p for p in ROOT.rglob("*") if p.is_file()]
    pack_bytes = sum(p.stat().st_size for p in all_files)

    dark_line = " · ".join(f"{fg}/{bg} {r:.2f}:1" for vid, fg, bg, r in measured if vid == "dark")
    light_line = " · ".join(f"{fg}/{bg} {r:.2f}:1" for vid, fg, bg, r in measured if vid == "light")
    extra_line = " · ".join(f"{vid} {name} {r:.2f}:1" for vid, name, r in extra)

    print(f"PASS assert_tokens {PACK_ID}")
    print(f"  对比度实测 · 近黑(dark):{dark_line}(阈值 {CONTRAST_MIN}:1,全部通过)")
    print(f"  对比度实测 · 暖白(light):{light_line}(阈值 {CONTRAST_MIN}:1,全部通过)")
    print(f"  反色块与页脚(次级实测):{extra_line}")
    print(
        f"  原色表 {len(absolute['colors'])} 色 + {len(absolute['shadows'])} 影 · 语义 token {token_count} 条 × 2 变体"
        f" · CSS 逐条比对通过 {compared} 处(default :root {token_count} + themes 两作用域 {token_count * 2})"
    )
    print(
        f"  预览 {preview_rel}:包内引用 {local_refs} 个(外部 0、url() 0)· 页内锚点 {anchor_count} 个全部命中 id"
        f" · 产物 {len(all_files)} 文件 {pack_bytes} 字节 · 禁用内容形态交给 scripts/gate.py"
    )


if __name__ == "__main__":
    main()
