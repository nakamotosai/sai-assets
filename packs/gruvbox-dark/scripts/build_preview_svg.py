#!/usr/bin/env python3
"""Build multi-theme comparison SVG for GitHub README from semantic tokens."""
from __future__ import annotations

import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOKENS = ROOT / "tokens"
OUT_COMPARE = ROOT / "docs" / "compare.svg"
OUT_HINT = ROOT / "docs" / "swatch-hint.svg"

CHIP_KEYS = [
    ("bg", "bg"),
    ("bgDeep", "deep"),
    ("surface", "surf"),
    ("ink", "ink"),
    ("accent", "acc"),
    ("accent2", "acc2"),
    ("aqua", "aqua"),
    ("green", "grn"),
    ("red", "red"),
    ("blue", "blu"),
    ("purple", "pur"),
]


def load_themes() -> list[dict]:
    idx = json.loads((TOKENS / "index.json").read_text(encoding="utf-8"))
    themes = []
    for t in idx["themes"]:
        data = json.loads((ROOT / t["path"]).read_text(encoding="utf-8"))
        themes.append(data)
    # stable display order: classic dark → classic light → material → baby
    order = {
        "classic-dark-hard": 0,
        "classic-dark-medium": 1,
        "classic-dark-soft": 2,
        "classic-light-hard": 3,
        "classic-light-medium": 4,
        "classic-light-soft": 5,
        "material-dark-hard": 6,
        "material-dark-medium": 7,
        "material-dark-soft": 8,
        "baby-dark-medium": 9,
    }
    themes.sort(key=lambda d: order.get(d["id"], 99))
    return themes


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def build_compare(themes: list[dict]) -> str:
    cols = 2
    card_w = 560
    card_h = 132
    pad = 16
    gap = 12
    header_h = 52
    rows = (len(themes) + cols - 1) // cols
    width = pad * 2 + cols * card_w + (cols - 1) * gap
    height = pad + header_h + rows * card_h + (rows - 1) * gap + pad

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        f'<rect width="{width}" height="{height}" fill="#1d2021"/>',
        f'<text x="{pad}" y="28" fill="#ebdbb2" font-family="ui-monospace,Consolas,monospace" font-size="16" font-weight="700">gruvbox-theme · all sub-themes</text>',
        f'<text x="{pad}" y="46" fill="#a89984" font-family="ui-monospace,Consolas,monospace" font-size="11">classic · light · material · baby · ★ default = classic-dark-medium</text>',
    ]

    for i, t in enumerate(themes):
        col = i % cols
        row = i // cols
        x = pad + col * (card_w + gap)
        y = pad + header_h + row * (card_h + gap)
        c = t["colors"]
        is_def = t["id"] == "classic-dark-medium"
        title = t["id"] + (" ★" if is_def else "")
        family = f'{t.get("family","")} · {t.get("mode","")} · {t.get("contrast","")}'

        parts.append(f'<rect x="{x}" y="{y}" width="{card_w}" height="{card_h}" rx="10" fill="{esc(c["bg"])}" stroke="{esc(c["border"])}" stroke-width="1.5"/>')
        parts.append(f'<rect x="{x+10}" y="{y+10}" width="36" height="36" rx="6" fill="{esc(c["bgDeep"])}" stroke="{esc(c["border"])}"/>')
        parts.append(f'<rect x="{x+52}" y="{y+10}" width="36" height="36" rx="6" fill="{esc(c["surface"])}" stroke="{esc(c["border"])}"/>')
        parts.append(f'<text x="{x+100}" y="{y+26}" fill="{esc(c["ink"])}" font-family="ui-monospace,Consolas,monospace" font-size="13" font-weight="700">{esc(title)}</text>')
        parts.append(f'<text x="{x+100}" y="{y+42}" fill="{esc(c["inkMuted"])}" font-family="ui-monospace,Consolas,monospace" font-size="10">{esc(family)}</text>')

        chip_y = y + 56
        chip_x = x + 10
        for key, label in CHIP_KEYS:
            hexv = c[key]
            parts.append(f'<rect x="{chip_x}" y="{chip_y}" width="44" height="26" rx="5" fill="{esc(hexv)}" stroke="{esc(c["border"])}" stroke-opacity="0.5"/>')
            parts.append(f'<text x="{chip_x+22}" y="{chip_y+40}" fill="{esc(c["inkDim"])}" font-family="ui-monospace,Consolas,monospace" font-size="8" text-anchor="middle">{esc(label)}</text>')
            chip_x += 48

        sample_y = y + 118
        parts.append(f'<text x="{x+10}" y="{sample_y}" fill="{esc(c["ink"])}" font-family="system-ui,Segoe UI,sans-serif" font-size="11">Aa · panel ink</text>')
        parts.append(f'<rect x="{x+120}" y="{sample_y-12}" width="72" height="16" rx="4" fill="{esc(c["accent"])}"/>')
        parts.append(f'<text x="{x+156}" y="{sample_y}" fill="{esc(c["onAccent"])}" font-family="ui-monospace,Consolas,monospace" font-size="9" text-anchor="middle">accent</text>')
        parts.append(f'<text x="{x+210}" y="{sample_y}" fill="{esc(c["link"])}" font-family="ui-monospace,Consolas,monospace" font-size="10">link</text>')

    parts.append("</svg>\n")
    return "\n".join(parts)


def build_hint(themes: list[dict]) -> str:
    """Compact strip still used as fallback; now one row per family sample."""
    picks = [
        "classic-dark-hard",
        "classic-dark-medium",
        "classic-dark-soft",
        "classic-light-medium",
        "material-dark-medium",
        "baby-dark-medium",
    ]
    by_id = {t["id"]: t for t in themes}
    samples = [by_id[i] for i in picks if i in by_id]
    n = len(samples)
    cell = 100
    pad = 12
    width = pad * 2 + n * cell + (n - 1) * 8
    height = 88
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        f'<rect width="{width}" height="{height}" fill="#1d2021"/>',
    ]
    for i, t in enumerate(samples):
        x = pad + i * (cell + 8)
        c = t["colors"]
        short = t["id"].replace("classic-", "c-").replace("material-", "m-").replace("baby-", "b-")
        parts.append(f'<rect x="{x}" y="10" width="{cell}" height="52" rx="8" fill="{esc(c["bg"])}" stroke="{esc(c["border"])}"/>')
        parts.append(f'<rect x="{x+8}" y="18" width="20" height="20" rx="4" fill="{esc(c["accent"])}"/>')
        parts.append(f'<rect x="{x+32}" y="18" width="20" height="20" rx="4" fill="{esc(c["aqua"])}"/>')
        parts.append(f'<rect x="{x+56}" y="18" width="20" height="20" rx="4" fill="{esc(c["ink"])}"/>')
        parts.append(f'<text x="{x+cell/2}" y="56" fill="{esc(c["inkMuted"])}" font-family="ui-monospace,Consolas,monospace" font-size="8" text-anchor="middle">{esc(short)}</text>')
    parts.append(
        f'<text x="{pad}" y="80" fill="#a89984" font-family="ui-monospace,Consolas,monospace" font-size="10">'
        f'all 10 themes → docs/compare.svg · preview/index.html</text>'
    )
    parts.append("</svg>\n")
    return "\n".join(parts)


def main() -> None:
    themes = load_themes()
    OUT_COMPARE.parent.mkdir(parents=True, exist_ok=True)
    OUT_COMPARE.write_text(build_compare(themes), encoding="utf-8")
    OUT_HINT.write_text(build_hint(themes), encoding="utf-8")
    print(f"wrote {OUT_COMPARE} ({len(themes)} themes)")
    print(f"wrote {OUT_HINT}")


if __name__ == "__main__":
    main()
