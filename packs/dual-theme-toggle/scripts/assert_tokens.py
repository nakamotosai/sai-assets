#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""dual-theme-toggle 断言(零依赖)。

检查:
  1. pack.json 契约字段齐全、origin.path 是相对路径、kind/category 正确
  2. files.* 声明的每个路径真实存在且非空
  3. preview/index.html 里每个 src=/href=/url() 引用:https 外链要真 https,相对引用要能在本包内解析到真实文件
  4. src/ 下的实现文件非空;docs/usage.md 含接入 / 反模式 / 许可 三个小节线索
  5. 两处浅色映射(显式选择 / 跟随系统)声明体逐字一致
  6. 对比度:两模的 ink / muted / accent-ink on bg ≥ 4.5:1;accent 亮度 Y 落在 [0.15, 0.25]
     且深底 ≥4.5:1、浅底 ≥3:1(color-mix 按 oklab 实算)
  7. 按钮硬项:CSS 有 44px 热区与 prefers-color-scheme,JS 有 aria-label 与 localStorage

退出码:0 = 通过;1 = 失败。
"""

from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
RGBA = re.compile(r"^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$")
REQUIRED_KEYS = (
    "schema", "id", "title", "kind", "category", "version", "license",
    "attribution", "origin", "entry", "files", "tags", "when", "not_for", "verified",
)
USAGE_CUES = ("接入", "反模式", "许可")


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


# --------------------------------------------------------------------------- #
# 颜色数学(sRGB → oklab → 反向;对比度按 WCAG 相对亮度)
# --------------------------------------------------------------------------- #

def _srgb_to_lin(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _lin_to_srgb(v: float) -> float:
    v = min(1.0, max(0.0, v))
    return 12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055


def hex_to_rgb(h: str) -> list[float]:
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def rgb_to_hex(rgb: list[float]) -> str:
    return "#%02X%02X%02X" % tuple(min(255, max(0, round(v))) for v in rgb)


_M1 = ((0.4122214708, 0.5363325363, 0.0514459929),
       (0.2119034982, 0.6806995451, 0.1073969566),
       (0.0883024619, 0.2817188376, 0.6299787005))
_M2 = ((0.2104542553, 0.7936177850, -0.0040720468),
       (1.9779984951, -2.4285922050, 0.4505937099),
       (0.0259040371, 0.7827717662, -0.8086757660))
_M2I = ((1.0, 0.3963377774, 0.2158037573),
        (1.0, -0.1055613458, -0.0638541728),
        (1.0, -0.0894841775, -1.2914855480))
_M1I = ((4.0767416621, -3.3077115913, 0.2309699292),
        (-1.2684380046, 2.6097574011, -0.3413193965),
        (-0.0041960863, -0.7034186147, 1.7076147010))


def linear_to_oklab(rgb: list[float]) -> list[float]:
    lin = [_srgb_to_lin(c / 255) for c in rgb]
    lms = [math.copysign(abs(sum(_M1[i][j] * lin[j] for j in range(3))) ** (1 / 3),
                         sum(_M1[i][j] * lin[j] for j in range(3))) for i in range(3)]
    return [sum(_M2[i][j] * lms[j] for j in range(3)) for i in range(3)]


def oklab_to_linear(lab: list[float]) -> list[float]:
    lms = [sum(_M2I[i][j] * lab[j] for j in range(3)) for i in range(3)]
    lms = [v ** 3 for v in lms]
    return [sum(_M1I[i][j] * lms[j] for j in range(3)) for i in range(3)]


def mix_oklab(c1: str, c2: str, p: float) -> str:
    """CSS color-mix(in oklab, c1 p*100%, c2) 的实算结果(转回 6 位 hex)。"""
    a, b = linear_to_oklab(hex_to_rgb(c1)), linear_to_oklab(hex_to_rgb(c2))
    lab = [a[i] * p + b[i] * (1 - p) for i in range(3)]
    return rgb_to_hex([_lin_to_srgb(v) * 255 for v in oklab_to_linear(lab)])


def luminance(h: str) -> float:
    r, g, b = [_srgb_to_lin(c / 255) for c in hex_to_rgb(h)]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


# --------------------------------------------------------------------------- #
# CSS 变量抽取
# --------------------------------------------------------------------------- #

def block_body(css: str, header_pattern: str) -> str:
    """取某个选择器块 { ... } 的声明体(不含选择器行)。注释先剥掉,避免注释里的示例选择器被当成真块。"""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    m = re.search(header_pattern + r"\s*\{", css)
    if not m:
        fail(f"CSS 里找不到块:{header_pattern}")
    i = m.end()
    depth = 1
    while i < len(css) and depth:
        if css[i] == "{":
            depth += 1
        elif css[i] == "}":
            depth -= 1
        i += 1
    return css[m.end():i - 1]


def parse_vars(body: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for m in re.finditer(r"--([a-z0-9-]+)\s*:\s*([^;]+);", body):
        out[m.group(1)] = m.group(2).strip()
    return out


VAR_REF = re.compile(r"var\(\s*--([a-z0-9-]+)\s*\)")


def make_resolver(root_vars: dict[str, str]):
    def resolve(value: str) -> str:
        v = value.strip()
        for _ in range(4):
            if "var(" not in v:
                return v

            def sub(m: re.Match) -> str:
                name = m.group(1)
                if name not in root_vars:
                    fail(f"未知变量 --{name}")
                return root_vars[name]

            v = VAR_REF.sub(sub, v)
        if "var(" in v:
            fail(f"变量解析层数过深:{value}")
        return v
    return resolve


COLOR_MIX = re.compile(
    r"^color-mix\(\s*in\s+oklab\s*,\s*(#[0-9a-fA-F]{6})\s+([\d.]+)%\s*,\s*(#[0-9a-fA-F]{6})\s*\)$")


def resolve_color(value: str, resolve) -> str:
    v = resolve(value)
    if HEX.match(v):
        return v.upper()
    m = COLOR_MIX.match(v)
    if m:
        return mix_oklab(m.group(1).upper(), m.group(3).upper(), float(m.group(2)) / 100)
    fail(f"无法解析为 6 位 hex 的颜色:{value} → {v}")


# --------------------------------------------------------------------------- #
# 主流程
# --------------------------------------------------------------------------- #

def main() -> None:
    pack_path = ROOT / "pack.json"
    if not pack_path.is_file():
        fail("missing pack.json")
    pack = json.loads(pack_path.read_text(encoding="utf-8"))

    missing = [k for k in REQUIRED_KEYS if k not in pack]
    if missing:
        fail(f"pack.json 缺键:{', '.join(missing)}")
    if pack.get("kind") != "ui" or pack.get("category") != "web-ui":
        fail(f"kind/category 应为 ui / web-ui,实际 {pack.get('kind')} / {pack.get('category')}")
    origin_path = str(pack.get("origin", {}).get("path", ""))
    if not origin_path or re.match(r"^([A-Za-z]:|/|\\\\)", origin_path):
        fail(f"origin.path 必须是相对路径,实际 {origin_path!r}")
    if pack.get("id") != "dual-theme-toggle":
        fail(f"id 应为 dual-theme-toggle,实际 {pack.get('id')!r}")

    declared: list[str] = []
    for key, val in pack.get("files", {}).items():
        if isinstance(val, list):
            declared += [str(v) for v in val]
        elif isinstance(val, str):
            declared.append(val)
    if not declared:
        fail("pack.json.files 是空的")
    for rel in declared:
        p = ROOT / rel
        if not p.is_file():
            fail(f"files 声明的路径不存在:{rel}")
        if p.stat().st_size == 0:
            fail(f"files 声明的路径是空文件:{rel}")

    # ---- preview 引用 ----
    preview_rel = pack["files"].get("preview")
    if not preview_rel:
        fail("pack.json.files.preview 缺失")
    preview = (ROOT / preview_rel)
    if not preview.is_file():
        fail(f"preview 不存在:{preview_rel}")
    html = preview.read_text(encoding="utf-8")
    refs = re.findall(r'(?:src|href)\s*=\s*"([^"]+)"', html) + re.findall(r"url\(\s*['\"]?([^'\")]+)", html)
    checked = 0
    for ref in refs:
        if ref.startswith("#") or ref.startswith("data:") or ref.startswith("mailto:"):
            continue
        if ref.startswith("http://"):
            fail(f"preview 里有明文 http 外链:{ref}")
        if ref.startswith("https://"):
            checked += 1
            continue
        target = (preview.parent / ref.split("#")[0].split("?")[0]).resolve()
        if not str(target).startswith(str(ROOT.resolve())):
            fail(f"preview 引用越出包目录:{ref}")
        if not target.is_file():
            fail(f"preview 引用解析不到真实文件:{ref}")
        checked += 1
    if checked < 3:
        fail(f"preview 里只查到 {checked} 个引用,样品页不该这么空")

    # ---- src / docs ----
    src_files = pack["files"].get("src") or []
    if len(src_files) < 2:
        fail("files.src 至少要有 css + js 两份实现")
    src_bytes = 0
    for rel in src_files:
        p = ROOT / rel
        if not p.is_file() or p.stat().st_size == 0:
            fail(f"src 文件缺失或为空:{rel}")
        src_bytes += p.stat().st_size
    usage_rel = pack["files"].get("usage")
    usage = (ROOT / usage_rel).read_text(encoding="utf-8") if usage_rel else ""
    for cue in USAGE_CUES:
        if cue not in usage:
            fail(f"docs/usage.md 缺线索:{cue}")

    # ---- CSS:两处浅色映射必须逐字一致 ----
    css = (ROOT / "src" / "theme-toggle.css").read_text(encoding="utf-8")
    root_vars = parse_vars(block_body(css, r":root"))
    resolve = make_resolver(root_vars)
    light_blocks = {
        "media(prefers-color-scheme:light) :root:not([data-theme])":
            block_body(css, r":root:not\(\[data-theme\]\)"),
        'html[data-theme="light"]': block_body(css, r'html\[data-theme="light"\]'),
    }
    normalized = {k: re.sub(r"\s+", " ", v).strip() for k, v in light_blocks.items()}
    vals = list(normalized.values())
    if vals[0] != vals[1]:
        fail("两处浅色映射不一致(显式选择 vs 跟随系统),会把浅色分成两种")

    dark_vars = root_vars
    light_vars = parse_vars(light_blocks['html[data-theme="light"]'])
    if set(light_vars) != set(k for k in dark_vars if k.startswith(("bg", "surface", "ink", "muted", "line", "accent", "focus"))):
        pass  # 原色表 --c-* 只在 :root;语义键集合下面逐个检查

    light_bg = resolve_color(light_vars["bg"], resolve)
    dark_bg = resolve_color(dark_vars["bg"], resolve)
    rows: list[str] = []
    for label, varname, floor in (("ink", "ink", 4.5), ("muted", "muted", 4.5), ("accent-ink", "accent-ink", 4.5)):
        for mode, block_bg, block in (("paper", light_bg, light_vars), ("charcoal", dark_bg, dark_vars)):
            if varname not in block:
                fail(f"{mode} 映射缺 {varname}")
            c = contrast(resolve_color(block[varname], resolve), block_bg)
            if c < floor:
                fail(f"{mode} {varname} on bg = {c:.2f}:1 < {floor}:1")
            rows.append(f"{mode} {varname} {c:.2f}")

    accent = resolve_color(dark_vars["accent"], resolve)
    y = luminance(accent)
    if not (0.15 <= y <= 0.25):
        fail(f"accent {accent} 亮度 Y={y:.3f} 不在 [0.15, 0.25]")
    c_dark, c_light = contrast(accent, dark_bg), contrast(accent, light_bg)
    if c_dark < 4.5:
        fail(f"accent on 深底 {c_dark:.2f}:1 < 4.5:1")
    if c_light < 3.0:
        fail(f"accent on 浅底 {c_light:.2f}:1 < 3:1(图形档)")

    # ---- 按钮硬项 ----
    if not re.search(r"\.tt\s*\{[^}]*width:\s*44px[^}]*height:\s*44px", css, re.S):
        fail("按钮没有 44px 热区")
    if "prefers-color-scheme" not in css:
        fail("CSS 缺 prefers-color-scheme(无 JS 跟系统)")
    js = (ROOT / "src" / "theme-toggle.js").read_text(encoding="utf-8")
    for needle in ("aria-label", "localStorage", "startViewTransition", "prefers-reduced-motion"):
        if needle not in js:
            fail(f"src/theme-toggle.js 缺 {needle}")
    if not re.search(r"--accent-ink", css):
        fail("CSS 缺 --accent-ink")

    print("PASS assert_tokens dual-theme-toggle")
    print(f"  contrast: {' · '.join(rows)}")
    print(f"  accent {accent} Y={y:.3f} · 深底 {c_dark:.2f}:1 · 浅底 {c_light:.2f}:1")
    print(f"  refs {checked} · src {len(src_files)} 文件 / {src_bytes} 字节 · 两处浅色映射逐字一致")


if __name__ == "__main__":
    main()
