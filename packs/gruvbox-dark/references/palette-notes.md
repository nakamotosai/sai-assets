# Palette notes (research)

## Official classic (morhetz)

- Absolute colors live in `colors/gruvbox.vim`.
- Contrast hard/medium/soft changes **bg0 only** within a mode.
- Dark semantic accents = `bright_*`; light = `faded_*`.
- License: MIT/X11 (README). Hex redistribution OK with credit.

## Material (sainnhe)

- Softer, slightly desaturated accents (orange `#e78a4e`, fg `#d4be98`).
- Still hard/medium/soft backgrounds; default medium bg0 `#282828` matches classic medium.
- License: MIT. This repo ships material **dark** semantic themes only.

## Baby (luisiacc)

- Deeper secondary chrome; medium bg still `#282828`.
- Optional family for people who already use gruvbox-baby in nvim.
- Simplified one semantic pack: `baby-dark-medium`.

## Why not only absolute CSS?

Agents retheme **products** faster with semantic roles (`--bg`, `--ink`, `--accent`) than with `dark0`/`light1` editor names. This repo ships both.
