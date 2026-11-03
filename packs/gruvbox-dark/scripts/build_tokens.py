#!/usr/bin/env python3
"""Build gruvbox token JSON + CSS from the official absolute palette.

Source of hex values: morhetz/gruvbox colors/gruvbox.vim (MIT/X11).
Material dark accents from sainnhe/gruvbox-material (MIT) — material palette only.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOKENS = ROOT / "tokens"
SEMANTIC = TOKENS / "semantic"
CSS = ROOT / "css"

# Official absolute palette (morhetz/gruvbox)
ABS = {
    "dark0_hard": "#1d2021",
    "dark0": "#282828",
    "dark0_soft": "#32302f",
    "dark1": "#3c3836",
    "dark2": "#504945",
    "dark3": "#665c54",
    "dark4": "#7c6f64",
    "gray": "#928374",
    "light0_hard": "#f9f5d7",
    "light0": "#fbf1c7",
    "light0_soft": "#f2e5bc",
    "light1": "#ebdbb2",
    "light2": "#d5c4a1",
    "light3": "#bdae93",
    "light4": "#a89984",
    "bright_red": "#fb4934",
    "bright_green": "#b8bb26",
    "bright_yellow": "#fabd2f",
    "bright_blue": "#83a598",
    "bright_purple": "#d3869b",
    "bright_aqua": "#8ec07c",
    "bright_orange": "#fe8019",
    "neutral_red": "#cc241d",
    "neutral_green": "#98971a",
    "neutral_yellow": "#d79921",
    "neutral_blue": "#458588",
    "neutral_purple": "#b16286",
    "neutral_aqua": "#689d6a",
    "neutral_orange": "#d65d0e",
    "faded_red": "#9d0006",
    "faded_green": "#79740e",
    "faded_yellow": "#b57614",
    "faded_blue": "#076678",
    "faded_purple": "#8f3f71",
    "faded_aqua": "#427b58",
    "faded_orange": "#af3a03",
}

# Material dark accents (sainnhe, palette=material) — shared across hard/medium/soft
MATERIAL_DARK_FG = {
    "fg0": "#d4be98",
    "fg1": "#ddc7a1",
    "red": "#ea6962",
    "orange": "#e78a4e",
    "yellow": "#d8a657",
    "green": "#a9b665",
    "aqua": "#89b482",
    "blue": "#7daea3",
    "purple": "#d3869b",
}
MATERIAL_DARK_BG0 = {
    "hard": "#1d2021",
    "medium": "#282828",
    "soft": "#32302f",
}
MATERIAL_DARK_BG_DIM = {
    "hard": "#141617",
    "medium": "#1b1b1b",
    "soft": "#252423",
}
MATERIAL_DARK_SURFACE = {
    # bg1 / bg3-ish steps used as surface tokens
    "hard": ("#282828", "#3c3836", "#504945"),
    "medium": ("#32302f", "#45403d", "#5a524c"),
    "soft": ("#3c3836", "#504945", "#665c54"),
}

# Baby medium (luisiacc/gruvbox-baby) — simplified semantic subset
BABY_MEDIUM = {
    "bg": "#282828",
    "bgDeep": "#242424",
    "surface": "#32302f",
    "surface2": "#504945",
    "border": "#665c54",
    "ink": "#ebdbb2",
    "inkMuted": "#a89984",
    "inkDim": "#928374",
    "accent": "#d65d0e",
    "accent2": "#fabd2f",
    "onAccent": "#1d2021",
    "red": "#fb4934",
    "green": "#8ec07c",
    "aqua": "#8ec07c",
    "blue": "#83a598",
    "purple": "#d4879c",
    "link": "#8ec07c",
    "codeBg": "#202020",
    "shadow": "0 8px 24px rgba(0,0,0,.45)",
}

CONTRAST_BG0 = {
    "dark": {"hard": "dark0_hard", "medium": "dark0", "soft": "dark0_soft"},
    "light": {"hard": "light0_hard", "medium": "light0", "soft": "light0_soft"},
}


def classic_semantic(mode: str, contrast: str) -> dict:
    """Map absolute palette → Theme Lab / MD Reader style semantic tokens."""
    bg0_key = CONTRAST_BG0[mode][contrast]
    if mode == "dark":
        colors = {
            "bg": ABS[bg0_key],
            "bgDeep": ABS["dark0_hard"] if contrast != "hard" else ABS["dark0_hard"],
            "surface": ABS["dark1"],
            "surface2": ABS["dark2"],
            "border": ABS["dark3"],
            "ink": ABS["light1"],
            "inkMuted": ABS["light4"],
            "inkDim": ABS["gray"],
            "accent": ABS["bright_orange"],
            "accent2": ABS["bright_yellow"],
            "onAccent": ABS["dark0_hard"],
            "red": ABS["bright_red"],
            "green": ABS["bright_green"],
            "aqua": ABS["bright_aqua"],
            "blue": ABS["bright_blue"],
            "purple": ABS["bright_purple"],
            "link": ABS["bright_aqua"],
            "codeBg": ABS["dark0_hard"],
            "shadow": "0 8px 24px rgba(0,0,0,.45)",
        }
        if contrast == "hard":
            colors["bgDeep"] = "#141617"  # slightly deeper for hard chrome
        elif contrast == "soft":
            colors["bgDeep"] = ABS["dark0"]
    else:
        colors = {
            "bg": ABS[bg0_key],
            "bgDeep": ABS["light0_hard"] if contrast != "hard" else ABS["light0_hard"],
            "surface": ABS["light1"],
            "surface2": ABS["light2"],
            "border": ABS["light3"],
            "ink": ABS["dark1"],
            "inkMuted": ABS["dark3"],
            "inkDim": ABS["dark4"],
            "accent": ABS["faded_orange"],
            "accent2": ABS["faded_yellow"],
            "onAccent": ABS["light0_hard"],
            "red": ABS["faded_red"],
            "green": ABS["faded_green"],
            "aqua": ABS["faded_aqua"],
            "blue": ABS["faded_blue"],
            "purple": ABS["faded_purple"],
            "link": ABS["faded_aqua"],
            "codeBg": ABS["light2"],
            "shadow": "0 8px 24px rgba(60,56,54,.12)",
        }
        if contrast == "hard":
            colors["bgDeep"] = ABS["light0"]
        elif contrast == "soft":
            colors["bgDeep"] = ABS["light1"]
    return {
        "id": f"classic-{mode}-{contrast}",
        "name": f"Gruvbox Classic {mode.title()} {contrast.title()}",
        "family": "classic",
        "mode": mode,
        "contrast": contrast,
        "source": "morhetz/gruvbox absolute palette",
        "colors": colors,
        "fonts": {
            "display": 'system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
            "body": 'system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
            "mono": '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
        },
        "radius": {"sm": "6px", "md": "10px", "lg": "14px"},
    }


def material_semantic(contrast: str) -> dict:
    bg0 = MATERIAL_DARK_BG0[contrast]
    s1, s2, border = MATERIAL_DARK_SURFACE[contrast]
    fg = MATERIAL_DARK_FG
    colors = {
        "bg": bg0,
        "bgDeep": MATERIAL_DARK_BG_DIM[contrast],
        "surface": s1,
        "surface2": s2,
        "border": border,
        "ink": fg["fg0"],
        "inkMuted": "#a89984",
        "inkDim": "#928374",
        "accent": fg["orange"],
        "accent2": fg["yellow"],
        "onAccent": MATERIAL_DARK_BG_DIM[contrast],
        "red": fg["red"],
        "green": fg["green"],
        "aqua": fg["aqua"],
        "blue": fg["blue"],
        "purple": fg["purple"],
        "link": fg["aqua"],
        "codeBg": MATERIAL_DARK_BG_DIM[contrast],
        "shadow": "0 8px 24px rgba(0,0,0,.45)",
    }
    return {
        "id": f"material-dark-{contrast}",
        "name": f"Gruvbox Material Dark {contrast.title()}",
        "family": "material",
        "mode": "dark",
        "contrast": contrast,
        "source": "sainnhe/gruvbox-material palette=material",
        "colors": colors,
        "fonts": classic_semantic("dark", "medium")["fonts"],
        "radius": {"sm": "6px", "md": "10px", "lg": "14px"},
    }


def baby_semantic() -> dict:
    return {
        "id": "baby-dark-medium",
        "name": "Gruvbox Baby Dark Medium",
        "family": "baby",
        "mode": "dark",
        "contrast": "medium",
        "source": "luisiacc/gruvbox-baby (simplified semantic)",
        "colors": BABY_MEDIUM,
        "fonts": classic_semantic("dark", "medium")["fonts"],
        "radius": {"sm": "6px", "md": "10px", "lg": "14px"},
    }


SEM_CSS_MAP = [
    ("bg", "--bg", "--gb-bg"),
    ("bgDeep", "--bg-deep", "--gb-bg-deep"),
    ("surface", "--surface", "--gb-surface"),
    ("surface2", "--surface-2", "--gb-surface-2"),
    ("border", "--border", "--gb-border"),
    ("ink", "--ink", "--gb-ink"),
    ("inkMuted", "--ink-muted", "--gb-ink-muted"),
    ("inkDim", "--ink-dim", "--gb-ink-dim"),
    ("accent", "--accent", "--gb-accent"),
    ("accent2", "--accent-2", "--gb-accent-2"),
    ("onAccent", "--on-accent", "--gb-on-accent"),
    ("red", "--red", "--gb-red"),
    ("green", "--green", "--gb-green"),
    ("aqua", "--aqua", "--gb-aqua"),
    ("blue", "--blue", "--gb-blue"),
    ("purple", "--purple", "--gb-purple"),
    ("link", "--link", "--gb-link"),
    ("codeBg", "--code-bg", "--gb-code-bg"),
    ("shadow", "--shadow", "--gb-shadow"),
]


def semantic_to_css(theme: dict) -> str:
    tid = theme["id"]
    c = theme["colors"]
    lines = [
        f"/* {theme['name']} — {theme.get('source', '')} */",
        f'[data-theme="{tid}"],',
        f'.theme-{tid},',
        f':root.theme-{tid} {{',
        f"  color-scheme: {theme['mode']};",
    ]
    for key, a, b in SEM_CSS_MAP:
        val = c[key]
        lines.append(f"  {a}: {val};")
        lines.append(f"  {b}: {val};")
    lines.append(f"  --radius-sm: {theme['radius']['sm']};")
    lines.append(f"  --radius-md: {theme['radius']['md']};")
    lines.append(f"  --radius-lg: {theme['radius']['lg']};")
    lines.append("}")
    return "\n".join(lines) + "\n"


def absolute_css() -> str:
    lines = [
        "/* Official absolute palette — morhetz/gruvbox (MIT/X11) */",
        ":root {",
    ]
    for k, v in ABS.items():
        css_name = k.replace("_", "-")
        lines.append(f"  --gruvbox-abs-{css_name}: {v};")
    lines.append("}")
    lines.append("")
    # classic dark medium convenience aliases (default)
    lines.append("/* Default aliases = classic-dark-medium */")
    lines.append(":root {")
    lines.append("  --gb-bg0: var(--gruvbox-abs-dark0);")
    lines.append("  --gb-bg0-h: var(--gruvbox-abs-dark0-hard);")
    lines.append("  --gb-bg0-s: var(--gruvbox-abs-dark0-soft);")
    lines.append("  --gb-bg1: var(--gruvbox-abs-dark1);")
    lines.append("  --gb-bg2: var(--gruvbox-abs-dark2);")
    lines.append("  --gb-bg3: var(--gruvbox-abs-dark3);")
    lines.append("  --gb-bg4: var(--gruvbox-abs-dark4);")
    lines.append("  --gb-fg0: var(--gruvbox-abs-light0);")
    lines.append("  --gb-fg1: var(--gruvbox-abs-light1);")
    lines.append("  --gb-fg2: var(--gruvbox-abs-light2);")
    lines.append("  --gb-fg3: var(--gruvbox-abs-light3);")
    lines.append("  --gb-fg4: var(--gruvbox-abs-light4);")
    lines.append("  --gb-gray: var(--gruvbox-abs-gray);")
    lines.append("  --gb-red: var(--gruvbox-abs-bright-red);")
    lines.append("  --gb-green: var(--gruvbox-abs-bright-green);")
    lines.append("  --gb-yellow: var(--gruvbox-abs-bright-yellow);")
    lines.append("  --gb-blue: var(--gruvbox-abs-bright-blue);")
    lines.append("  --gb-purple: var(--gruvbox-abs-bright-purple);")
    lines.append("  --gb-aqua: var(--gruvbox-abs-bright-aqua);")
    lines.append("  --gb-orange: var(--gruvbox-abs-bright-orange);")
    lines.append("}")
    return "\n".join(lines) + "\n"


def base_apply_css() -> str:
    return """/* Drop-in body chrome for panels / tools — opt-in via .gruvbox-apply */
.gruvbox-apply,
[data-gruvbox-apply] {
  background: var(--bg, var(--gb-bg, #282828));
  color: var(--ink, var(--gb-ink, #ebdbb2));
  font-family: system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.gruvbox-apply a,
[data-gruvbox-apply] a {
  color: var(--link, var(--gb-link, #8ec07c));
}

.gruvbox-apply code,
.gruvbox-apply pre,
[data-gruvbox-apply] code,
[data-gruvbox-apply] pre {
  background: var(--code-bg, var(--gb-code-bg, #1d2021));
  color: var(--ink, var(--gb-ink, #ebdbb2));
  border-radius: var(--radius-sm, 6px);
}

.gruvbox-apply .panel,
[data-gruvbox-apply] .panel {
  background: var(--surface, var(--gb-surface, #3c3836));
  border: 1px solid var(--border, var(--gb-border, #665c54));
  border-radius: var(--radius-md, 10px);
  box-shadow: var(--shadow, none);
}

.gruvbox-apply .btn-primary,
[data-gruvbox-apply] .btn-primary {
  background: var(--accent, var(--gb-accent, #fe8019));
  color: var(--on-accent, var(--gb-on-accent, #1d2021));
  border: none;
  border-radius: var(--radius-sm, 6px);
}

/* Scrollbar (optional chrome) */
.gruvbox-scrollbar,
.gruvbox-apply {
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--ink, #ebdbb2) 28%, transparent) transparent;
}
.gruvbox-scrollbar::-webkit-scrollbar,
.gruvbox-apply::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.gruvbox-scrollbar::-webkit-scrollbar-track,
.gruvbox-apply::-webkit-scrollbar-track {
  background: transparent;
}
.gruvbox-scrollbar::-webkit-scrollbar-thumb,
.gruvbox-apply::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--ink, #ebdbb2) 22%, transparent);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
"""


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    themes = []
    for mode in ("dark", "light"):
        for contrast in ("hard", "medium", "soft"):
            themes.append(classic_semantic(mode, contrast))
    for contrast in ("hard", "medium", "soft"):
        themes.append(material_semantic(contrast))
    themes.append(baby_semantic())

    write_json(TOKENS / "absolute.json", {
        "id": "gruvbox-absolute",
        "source": "morhetz/gruvbox colors/gruvbox.vim",
        "license": "MIT/X11",
        "colors": ABS,
    })

    index = []
    css_parts = [absolute_css(), "/* ---- semantic themes ---- */\n"]
    for t in themes:
        write_json(SEMANTIC / f"{t['id']}.json", t)
        css_parts.append(semantic_to_css(t))
        index.append({
            "id": t["id"],
            "name": t["name"],
            "family": t["family"],
            "mode": t["mode"],
            "contrast": t["contrast"],
            "path": f"tokens/semantic/{t['id']}.json",
            "default": t["id"] == "classic-dark-medium",
        })

    write_json(TOKENS / "index.json", {
        "default": "classic-dark-medium",
        "themes": index,
        "families": {
            "classic": "Official morhetz palette; dark uses bright_* accents; light uses faded_*.",
            "material": "sainnhe gruvbox-material palette=material (softer accents).",
            "baby": "luisiacc gruvbox-baby medium — deeper chrome, slightly different orange.",
        },
    })

    CSS.mkdir(parents=True, exist_ok=True)
    (CSS / "absolute.css").write_text(absolute_css(), encoding="utf-8")
    (CSS / "themes.css").write_text("".join(css_parts[1:]), encoding="utf-8")
    (CSS / "apply.css").write_text(base_apply_css(), encoding="utf-8")
    all_css = absolute_css() + "\n" + "".join(css_parts[1:]) + "\n" + base_apply_css()
    (CSS / "all.css").write_text(all_css, encoding="utf-8")

    # default theme drop-in (classic-dark-medium only) for one-file include
    default = next(t for t in themes if t["id"] == "classic-dark-medium")
    default_css = semantic_to_css(default).replace(
        f'[data-theme="{default["id"]}"],\n.theme-{default["id"]},\n:root.theme-{default["id"]}',
        f':root,\n[data-theme="{default["id"]}"],\n.theme-{default["id"]}',
    )
    (CSS / "default.css").write_text(
        "/* Default = classic-dark-medium — link this alone for fastest apply */\n"
        + default_css
        + "\n"
        + base_apply_css(),
        encoding="utf-8",
    )

    print(f"wrote {len(themes)} themes → {SEMANTIC}")
    print(f"css → {CSS}")

    # keep README compare art in sync when tokens rebuild
    try:
        from build_preview_svg import main as build_svg

        build_svg()
    except Exception as exc:  # noqa: BLE001 — optional companion script
        print(f"note: preview svg not rebuilt ({exc})")


if __name__ == "__main__":
    main()
