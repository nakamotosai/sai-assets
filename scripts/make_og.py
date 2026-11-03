#!/usr/bin/env python3
"""生成 site/og.png(1200×630 分享卡)。本机一次性产物,提交进仓,CI 不跑。

配色取自库内 ouuut-editorial 包(tokens/absolute.json),不自造 hex。
用法:python scripts/make_og.py
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "site" / "og.png"
TOKENS = json.loads((ROOT / "packs" / "ouuut-editorial" / "tokens" / "absolute.json").read_text(encoding="utf-8"))
# 字体按候选表解析(不写死本机盘符路径;可用 OG_FONT / OG_FONT_BOLD 覆盖)
CJK_CANDIDATES = [
    (os.environ.get("OG_FONT"), os.environ.get("OG_FONT_BOLD")),
    (str(Path(os.environ.get("SystemRoot", "/usr")) / "Fonts/msyh.ttc"),
     str(Path(os.environ.get("SystemRoot", "/usr")) / "Fonts/msyhbd.ttc")),
    ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
     "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"),
    ("/System/Library/Fonts/PingFang.ttc", "/System/Library/Fonts/PingFang.ttc"),
]

W, H = 1200, 630
PAD = 72


def hexes() -> tuple[dict, list[str]]:
    flat: dict[str, str] = {}

    def walk(node, prefix=""):
        if isinstance(node, dict):
            for k, v in node.items():
                walk(v, f"{prefix}{k}.")
        elif isinstance(node, str) and node.startswith("#"):
            flat[prefix.rstrip(".")] = node

    walk(TOKENS)
    return flat, [v for v in flat.values()][:6]


def pick_fonts() -> tuple[str, str]:
    for regular, bold in CJK_CANDIDATES:
        if regular and bold and Path(regular).is_file() and Path(bold).is_file():
            return regular, bold
    raise SystemExit("找不到可用的 CJK 字体 —— 用 OG_FONT / OG_FONT_BOLD 指定字重文件后再跑")


def main() -> None:
    font_regular, font_bold = pick_fonts()
    flat, accents = hexes()
    bg = flat.get("neutrals.paper.bg") or flat.get("colors.bg") or "#F5F3ED"
    ink = flat.get("neutrals.paper.ink") or flat.get("colors.ink") or "#1A1A16"
    muted = flat.get("neutrals.paper.muted") or flat.get("colors.muted") or "#5B5A53"
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    f_mark = ImageFont.truetype(font_bold, 104)
    f_sub = ImageFont.truetype(font_regular, 40)
    f_meta = ImageFont.truetype(font_regular, 26)

    d.text((PAD, 128), "sai-assets", font=f_mark, fill=ink)
    d.text((PAD, 262), "可复用网页资产库", font=f_sub, fill=ink)
    d.line([(PAD, 336), (W - PAD, 336)], fill=muted + "55" if len(muted) == 7 else muted, width=1)
    d.text((PAD, 366), "主题配色 · 排版配方 · 网页动效 · UI 组件", font=f_meta, fill=muted)
    d.text((PAD, 408), "每包带活预览 · 配对规则 · 断言 · 确定性下载", font=f_meta, fill=muted)

    y = 500
    x = PAD
    for c in (accents or ["#CD5545"] * 6)[:6]:
        d.rectangle([x, y, x + 96, y + 10], fill=c)
        x += 112
    d.text((W - PAD - 300, 492), "assets.ouuut.com", font=f_meta, fill=muted)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "PNG", optimize=True)
    print(f"PASS make_og: {OUT} ({OUT.stat().st_size // 1024} KB) bg={bg} ink={ink} accents={len(accents)}")


if __name__ == "__main__":
    main()
