#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""make_thumbs_targets.py — 生成缩略图清单(.private/thumbs-targets.json)。

规则:凡 pack.json 里 files.preview 指向真实文件的包都要一张图;
heavy(带 canvas / WebGL 的预览)多给截图脚本一点等待时间。
之后跑 scripts/make_thumbs.mjs(ego 截 PNG)→ scripts/make_thumbs.py(缩成 WebP)。
"""
from __future__ import annotations

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / ".private" / "thumbs-targets.json"
HEAVY_HINTS = ("requestAnimationFrame", "webgl", "webgpu", "getContext", "three", "shader")


def main() -> int:
    targets = []
    for pj in sorted((ROOT / "packs").glob("*/pack.json")):
        pack = json.loads(pj.read_text(encoding="utf-8"))
        prev = (pack.get("files") or {}).get("preview")
        if not prev or not (pj.parent / prev).is_file():
            continue
        text = (pj.parent / prev).read_text(encoding="utf-8", errors="replace").lower()
        targets.append({
            "id": pack["id"],
            "preview": prev,
            "heavy": any(h in text for h in HEAVY_HINTS),
        })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(targets, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(targets)} 个目标(heavy {sum(1 for t in targets if t['heavy'])})→ {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
