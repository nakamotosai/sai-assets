# Variants research (deep)

## Worth shipping as sub-themes

| family | ship? | why |
|--------|-------|-----|
| classic hard/medium/soft × dark/light | **yes** | official SSOT; Alacritty/WT/iTerm all document same bg0 swap |
| material dark h/m/s | **yes** | largest soft-fork ecosystem; distinct accents |
| baby medium | **optional yes** | one pack for nvim-baby users; high hex overlap |
| flat.nvim | no separate | material-like; nvim-only |
| everforest | **no** | sibling green family, not gruvbox sub-palette |

## Terminal cross-check (Alacritty gruvbox_dark.toml)

- primary.background medium `#282828`, hard commented `#1d2021`, soft `#32302f`
- foreground `#ebdbb2`
- bright orange path = `#fe8019` (via bright palette in other ports)

## shadcn mapping (optional recipe, not shipped as CSS)

| gruvbox semantic | shadcn-ish |
|------------------|------------|
| bg | --background |
| ink | --foreground |
| accent | --primary |
| surface | --card |
| border | --border |
| red | --destructive |

Community: gruvblog, ui.jln.dev, wheatjs tailwind CSS vars — no official shadcn registry entry.

## Anti-pattern

Do **not** ship cool gray “gruvbox-ish” fakes; do not merge everforest greens into classic orange accent without labeling a new family.
