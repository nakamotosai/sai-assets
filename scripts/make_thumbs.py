#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""make_thumbs.py — 把 .private/thumbs-raw/*.png(ego 截的 720×450 原图)
缩成 site/thumbs/<id>.webp(640×400,首页列表里显示 72×45,足够 retina)。

跑法:
    python scripts/make_thumbs.py            # 全部转换
    python scripts/make_thumbs.py --check    # 只报缺哪些包
缩略图是**内容**:换包/改预览后重跑 capture 与本次转换,结果提交进仓。
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    print("需要 Pillow:pip install pillow", file=sys.stderr)
    raise SystemExit(1)

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT / ".private" / "thumbs-raw"
OUT = ROOT / "site" / "thumbs"
SIZE = (640, 400)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="只报缺哪些包,不转换")
    args = ap.parse_args()

    packs = [p.parent.name for p in sorted((ROOT / "packs").glob("*/pack.json"))]
    raws = {p.stem: p for p in RAW.glob("*.png")} if RAW.is_dir() else {}
    missing = [i for i in packs if i not in raws and not (OUT / f"{i}.webp").is_file()]

    if args.check:
        print(f"包 {len(packs)} · 原图 {len(raws)} · 缺 {len(missing)}: {missing}")
        return 0

    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    done = []
    for pid, src in sorted(raws.items()):
        im = Image.open(src).convert("RGB")
        if im.size != SIZE:
            im = im.resize(SIZE, Image.LANCZOS)
        dst = OUT / f"{pid}.webp"
        im.save(dst, "WEBP", quality=82, method=6)
        kb = dst.stat().st_size / 1024
        total += kb
        done.append(f"{pid} {kb:.0f}KB")
    print(f"转换 {len(done)} 张 · 合计 {total:.0f} KB · 尺寸 {SIZE[0]}×{SIZE[1]}")
    if missing:
        print(f"没有原图(列表里回落到序号瓦片):{missing}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
