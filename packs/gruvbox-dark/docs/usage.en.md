# Usage: mapping tokens to UI components

> This repo is **not** a full component library. It is a **Gruvbox palette contract + pairing guide**.  
> Semantic tokens (`--bg`, `--ink`, `--accent`, …) tell you which role paints which chrome.  
> Default theme: `classic-dark-medium` (`#282828` / `#ebdbb2` / `#fe8019`).

Chinese: [usage.md](usage.md)

---

## 1. Three background layers

| Layer | Token | Default | Use for |
|-------|-------|---------|---------|
| Deepest | `bgDeep` | `#1d2021` | Deeper chrome, code bg, immersion |
| Page | `bg` | `#282828` | `<body>` / canvas |
| Raised | `surface` | `#3c3836` | Cards, panels, dialogs, inputs |
| Raised+ | `surface2` | `#504945` | Hover rows, nested chips |
| Stroke | `border` | `#665c54` | Dividers, card edges |

Stay within ~3 bg steps on one screen. No pure `#000` / cool slate fakes.

## 2. Text

| Role | Token | Default | Use |
|------|-------|---------|-----|
| Body | `ink` | `#ebdbb2` | Titles, paragraphs |
| Secondary | `inkMuted` | `#a89984` | Meta, timestamps |
| Quiet | `inkDim` | `#928374` | Placeholders, disabled hints |
| Link | `link` / `aqua` | `#8ec07c` | Anchors (not orange) |

## 3. Buttons

| Kind | Fill | Text | Border |
|------|------|------|--------|
| Primary | `accent` | `onAccent` | none — one CTA per region |
| Secondary | `surface`/`surface2` | `ink` | `border` |
| Ghost | transparent | `ink` | `border` |
| Danger | transparent | `red` | `border` / soft red |

## 4. Forms

Input fill `surface` or `bgDeep`; border `border`; focus ring `accent`; labels `inkMuted`; errors in `red` text/border (not full red floods).

## 5. Nav

Sidebar often `bgDeep`; active item = `accent` rail **or** `surface` fill; inactive `inkMuted`. Do not orange-wash the whole nav.

## 6. Status / charts

`red` error · `green` success dots · `aqua` info/links · `accent2` warn · series: accent → aqua → blue → purple → red → green. Axes use `border`.

## 7. Anti-patterns

Cool gray “dark mode”, translucent white body text, orange used for buttons **and** links **and** selection, pure black/white flats, bright accents on light mode without `classic-light-*`, silent Material accents on classic bg.

## 8. Minimal HTML

```html
<link rel="stylesheet" href="css/all.css" />
<html data-theme="classic-dark-medium" class="gruvbox-apply">
<body>
  <main class="panel" style="margin:24px;padding:16px;max-width:420px">
    <h1>Panel title</h1>
    <p style="color:var(--ink-muted)">Secondary copy uses muted ink.</p>
    <button class="btn-primary" type="button">Primary</button>
    <p><a href="#">Links use aqua</a></p>
  </main>
</body>
</html>
```

Wall: [preview/index.html](../preview/index.html) · tokens: `tokens/semantic/<id>.json` · agent: [SKILL.md](../SKILL.md)
