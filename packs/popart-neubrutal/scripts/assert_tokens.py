#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""popart-neubrutal 包的令牌断言。退出 0 = 通过。

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

PACK_ID = "popart-neubrutal"
DEFAULT_VARIANT = "popart-neubrutal"
VARIANTS = ["popart-neubrutal"]
CONTRAST_MIN = 4.5
ANCHORS = [
    [
        "bg",
        "bg",
        "#FFFDF5"
    ],
    [
        "ink",
        "ink",
        "#000000"
    ],
    [
        "accent",
        "accent",
        "#FF6B6B"
    ],
    [
        "onAccent",
        "onAccent",
        "#000000"
    ]
]          # (语义键, 原色表键, 期望 hex)
REQUIRED_KEYS = ["bg", "surface", "ink", "accent", "onAccent", "link", "red", "green"]
NOT_IN_PALETTE = []
VAR_MAP = {
    "bg": "bg",
    "bgDeep": "bg-deep",
    "surface": "surface",
    "surface2": "surface-2",
    "border": "border",
    "ink": "ink",
    "inkMuted": "ink-muted",
    "inkDim": "ink-dim",
    "accent": "accent",
    "accent2": "accent-2",
    "onAccent": "on-accent",
    "red": "red",
    "green": "green",
    "aqua": "aqua",
    "blue": "blue",
    "purple": "purple",
    "link": "link",
    "codeBg": "code-bg",
    "shadow": "shadow"
}          # 语义键 → CSS 变量后缀
CONTRAST_PAIRS = [["ink", "bg"], ["onAccent", "accent"]]
PRODUCT_FILES = [
    "tokens/absolute.json",
    "tokens/index.json",
    "tokens/semantic/popart-neubrutal.json",
    "css/default.css",
    "css/all.css",
    "css/themes.css",
    "docs/usage.md",
    "scripts/assert_tokens.py",
    "SKILL.md",
    "README.md",
    "pack.json"
]
USAGE_CUES = ("配对", "反模式", "--ink", "--accent", "--surface")
SKILL_CUES = (
    "## When to use", "## When not to use", "## Default", "## Sub-themes",
    "## Files", "## Agent apply steps", "## Hard rules",
)
EFFECT_PREFIXES = ("shadow", "glow")


HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
COLOR = re.compile(
    r"^#[0-9a-fA-F]{6}$"
    r"|^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)$"
)
EFFECT = re.compile(r"^(?:none|-?[\w\s.,()%#]+)$")


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
    if re.match(r"^([A-Za-z]:[\\/]|[\\/])", origin_path):
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
