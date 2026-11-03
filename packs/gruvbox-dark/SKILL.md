---
name: gruvbox-theme
description: Apply official Gruvbox (and Material/Baby variants) color tokens to web panels, dashboards, and HTML apps. Use when the user asks for gruvbox, retro groove palette, warm dark tool UI, or to retheme a page/panel with classic-dark-medium / hard / soft / light / material.
---

# gruvbox-theme

Make any web UI look like **Gruvbox** without the agent inventing hex values.

## When to use

- User says gruvbox / 格鲁夫 / retro groove / warm dark panel
- Need a full palette (bg/surface/ink/accent + status colors)
- Switching contrast: hard / medium / soft, or dark / light
- Prefer Material (softer accents) or Baby (deeper chrome)

## When not to use

- Full brand design system with custom fonts/components → use a design skill
- Non-Gruvbox themes (Catppuccin, Nord, etc.)
- Terminal-only configs (this skill targets CSS/web; absolute hex still usable)

## Default

**`classic-dark-medium`**

| role | hex |
|------|-----|
| bg | `#282828` |
| bgDeep | `#1d2021` |
| surface | `#3c3836` |
| ink | `#ebdbb2` |
| accent | `#fe8019` |
| link/aqua | `#8ec07c` |

## Sub-themes (id → when)

| id | family | mode | contrast | pick when |
|----|--------|------|----------|-----------|
| `classic-dark-medium` | classic | dark | medium | **default** tool panels |
| `classic-dark-hard` | classic | dark | hard | max contrast, deeper bg0 `#1d2021` |
| `classic-dark-soft` | classic | dark | soft | softer bg0 `#32302f` |
| `classic-light-medium` | classic | light | medium | paper cream light |
| `classic-light-hard` | classic | light | hard | brightest light |
| `classic-light-soft` | classic | light | soft | muted light |
| `material-dark-medium` | material | dark | medium | softer Material accents |
| `material-dark-hard` | material | dark | hard | material + hard bg |
| `material-dark-soft` | material | dark | soft | material + soft bg |
| `baby-dark-medium` | baby | dark | medium | baby chrome / alt orange |

Contrast only swaps **bg0** (and related deep/surface steps). Accents stay bright_* in dark classic, faded_* in light classic.

## Files

| path | use |
|------|-----|
| `tokens/absolute.json` | Full official hex table |
| `tokens/index.json` | Catalog + default id |
| `tokens/semantic/<id>.json` | Semantic map for agents |
| `css/default.css` | One file: classic-dark-medium on `:root` + apply helpers |
| `css/all.css` | Absolute + all themes + apply |
| `css/themes.css` | Only `[data-theme="<id>"]` blocks |
| `preview/index.html` | Swatch wall |

## Agent apply steps

1. **Pick id** — user named a variant → that id; else `classic-dark-medium`.
2. **Read tokens** — `tokens/semantic/<id>.json` (or `tokens/index.json` to list).
3. **Write CSS variables** into the target project:
   - Prefer existing names if the project already uses `--bg/--ink/--accent` (Theme Lab style).
   - Else set both semantic and `--gb-*` aliases from the JSON `colors` object.
4. **Attach theme selector** on `<html>` or root:
   - `data-theme="<id>"` **or** class `theme-<id>`
   - Optionally add class `gruvbox-apply` on body for base chrome.
5. **Link or paste CSS**:
   - Fastest: copy contents of `css/default.css` (default only)
   - Multi-variant: link `css/all.css` and switch `data-theme`
6. **Map components** (full recipe: `docs/usage.md` / `docs/usage.en.md`):
   - page bg → `bg` / `bgDeep`
   - cards/panels → `surface` / `border` / `shadow`
   - body text → `ink`; secondary → `inkMuted` / `inkDim`
   - primary button / hot accent → `accent` + `onAccent` (one primary CTA per region)
   - links → `link` / `aqua` (**not** orange — orange is for primary actions)
   - danger → `red`; warn → `accent2` (yellow); success dots → `green`
7. **Do not invent hex.** If a color is missing, re-read absolute.json; do not approximate with cool grays or blue-purple SaaS gradients.
8. **Sanity check**: background warm charcoal/cream (not pure `#000` / cold gray); text cream/beige on dark; orange accent present; links aqua not orange.

### Minimal `:root` snippet (classic-dark-medium)

```css
:root {
  color-scheme: dark;
  --bg: #282828;
  --bg-deep: #1d2021;
  --surface: #3c3836;
  --surface-2: #504945;
  --border: #665c54;
  --ink: #ebdbb2;
  --ink-muted: #a89984;
  --ink-dim: #928374;
  --accent: #fe8019;
  --accent-2: #fabd2f;
  --on-accent: #1d2021;
  --red: #fb4934;
  --green: #b8bb26;
  --aqua: #8ec07c;
  --blue: #83a598;
  --purple: #d3869b;
  --link: #8ec07c;
  --code-bg: #1d2021;
}
```

### HTML switch

```html
<html data-theme="classic-dark-medium" class="gruvbox-apply">
  <link rel="stylesheet" href="path/to/css/all.css">
```

## Hard rules for agents

- Never replace Gruvbox warm neutrals with cool gray (`#111827`, Tailwind slate) unless the user abandons Gruvbox.
- Dark mode accents = **bright_***; light mode accents = **faded_*** (classic family).
- Material family uses different accent hex (e.g. orange `#e78a4e`); do not mix Material accents onto classic bg without saying so.
- Keep scrollbar subtle (transparent track, low-opacity thumb from ink) if styling chrome.

## Install (Claude Code)

```bash
git clone https://github.com/nakamotosai/gruvbox-theme.git ~/.claude/skills/gruvbox-theme
```

Or copy this folder into a project’s `.claude/skills/gruvbox-theme/`.

## Credits

- Classic palette: [morhetz/gruvbox](https://github.com/morhetz/gruvbox) (MIT/X11)
- Material accents: [sainnhe/gruvbox-material](https://github.com/sainnhe/gruvbox-material) (MIT)
- Baby reference: [luisiacc/gruvbox-baby](https://github.com/luisiacc/gruvbox-baby)
