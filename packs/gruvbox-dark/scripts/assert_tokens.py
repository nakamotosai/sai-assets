#!/usr/bin/env python3
"""Sanity checks for gruvbox-theme tokens. Exit 0 on pass."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")

ANCHORS = {
    "dark0": "#282828",
    "light1": "#ebdbb2",
    "bright_orange": "#fe8019",
    "bright_aqua": "#8ec07c",
}


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    abs_path = ROOT / "tokens" / "absolute.json"
    idx_path = ROOT / "tokens" / "index.json"
    if not abs_path.is_file():
        fail("missing tokens/absolute.json — run build_tokens.py")
    if not idx_path.is_file():
        fail("missing tokens/index.json")

    abs_data = json.loads(abs_path.read_text(encoding="utf-8"))
    colors = abs_data["colors"]
    for k, v in ANCHORS.items():
        if colors.get(k, "").lower() != v.lower():
            fail(f"anchor {k} expected {v} got {colors.get(k)}")

    for k, v in colors.items():
        if not HEX.match(v):
            fail(f"absolute {k} not hex6: {v}")

    idx = json.loads(idx_path.read_text(encoding="utf-8"))
    if idx.get("default") != "classic-dark-medium":
        fail("default must be classic-dark-medium")

    themes = idx["themes"]
    if len(themes) < 8:
        fail(f"expected ≥8 themes, got {len(themes)}")

    ids = {t["id"] for t in themes}
    for need in ("classic-dark-medium", "classic-dark-hard", "material-dark-medium", "baby-dark-medium"):
        if need not in ids:
            fail(f"missing theme {need}")

    for t in themes:
        p = ROOT / t["path"]
        if not p.is_file():
            fail(f"missing {t['path']}")
        data = json.loads(p.read_text(encoding="utf-8"))
        c = data["colors"]
        for key in ("bg", "ink", "accent", "red", "green", "aqua"):
            if key not in c:
                fail(f"{t['id']} missing colors.{key}")
            if not HEX.match(c[key]):
                fail(f"{t['id']}.{key} not hex: {c[key]}")

    for name in ("all.css", "default.css", "absolute.css", "themes.css", "apply.css"):
        if not (ROOT / "css" / name).is_file():
            fail(f"missing css/{name}")

    compare = ROOT / "docs" / "compare.svg"
    if not compare.is_file():
        fail("missing docs/compare.svg — run build_preview_svg.py")
    svg = compare.read_text(encoding="utf-8")
    for need in ("classic-dark-medium", "classic-light-medium", "material-dark-medium", "baby-dark-medium"):
        if need not in svg:
            fail(f"compare.svg missing theme id {need}")

    skill = ROOT / "SKILL.md"
    if not skill.is_file():
        fail("missing SKILL.md")
    text = skill.read_text(encoding="utf-8")
    if "classic-dark-medium" not in text:
        fail("SKILL.md must mention classic-dark-medium")
    if "data-theme" not in text and "--bg" not in text:
        fail("SKILL.md missing apply instructions")

    readme = ROOT / "README.md"
    if not readme.is_file():
        fail("missing README.md")
    rtext = readme.read_text(encoding="utf-8")
    if "docs/usage.md" not in rtext:
        fail("README.md must link docs/usage.md (component pairing)")
    if "README.zh-CN.md" not in rtext or "README.ja.md" not in rtext:
        fail("README.md must link zh-CN/ja language switcher")
    if "classic-dark-medium" not in rtext:
        fail("README.md must mention classic-dark-medium")

    usage = ROOT / "docs" / "usage.md"
    if not usage.is_file():
        fail("missing docs/usage.md")
    utext = usage.read_text(encoding="utf-8")
    for need in ("--ink", "--accent", "--surface", "主按钮", "反模式"):
        if need not in utext:
            fail(f"docs/usage.md missing section cue: {need}")
    if not (ROOT / "docs" / "usage.en.md").is_file():
        fail("missing docs/usage.en.md")
    if not (ROOT / "README.zh-CN.md").is_file():
        fail("missing README.zh-CN.md")
    if not (ROOT / "README.ja.md").is_file():
        fail("missing README.ja.md")

    default = json.loads(
        (ROOT / "tokens" / "semantic" / "classic-dark-medium.json").read_text(encoding="utf-8")
    )
    if default["colors"]["bg"].lower() != "#282828":
        fail("classic-dark-medium.bg must be #282828")
    if default["colors"]["accent"].lower() != "#fe8019":
        fail("classic-dark-medium.accent must be #fe8019")

    print("PASS assert_tokens")
    print(f"  themes={len(themes)} absolute={len(colors)} default={idx['default']}")


if __name__ == "__main__":
    main()
