#!/usr/bin/env python3
"""Build catalog.json — 紧凑目录(目标 ≤8KB),供 agent / 脚本一次读全。

用法:python scripts/build_catalog.py [--check]
--check:只校验产物是否与当前 packs/ 一致(CI 用),不写盘。
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKS = ROOT / "packs"
OUT = ROOT / "catalog.json"
LIMIT = 8192

BASE = "https://raw.githubusercontent.com/nakamotosai/sai-assets/main/"
CATEGORIES = [
    ("themes", "主题 · 配色与字体"),
    ("fonts", "排版配方"),
    ("web-fx", "网页动效"),
    ("web-ui", "UI 组件"),
    ("fx-engines", "动效引擎 / 底座"),
    ("references", "外部参考观测"),
    ("video-motion", "视频动效(索引)"),
]


def stamp() -> str:
    """确定性时间戳:取 HEAD 提交日期(CI 重建才能与提交一致;无 git 则用今天)。"""
    try:
        out = subprocess.run(["git", "log", "-1", "--format=%cs"], cwd=ROOT,
                             capture_output=True, text=True, timeout=10)
        s = out.stdout.strip()
        if len(s) == 10:
            return s
    except Exception:
        pass
    return dt.date.today().isoformat()


def clip(text: str, n: int) -> str:
    text = " ".join(str(text).split())
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


def collect() -> dict:
    items = []
    for path in sorted(PACKS.glob("*/pack.json")):
        pack = json.loads(path.read_text(encoding="utf-8"))
        items.append(pack)
    cats = []
    for cid, title in CATEGORIES:
        bucket = [p for p in items if p["category"] == cid]
        if not bucket:
            continue
        entries = []
        for p in sorted(bucket, key=lambda x: (x.get("external", False), x["id"])):
            # 发现索引:只留"选包"必需字段;完整元数据(license/attribution/tags/not_for/files)
            # 在 packs/<id>/pack.json —— 这样 catalog 的体量不随包数爆炸,8KB 承诺守得住。
            # title 不进 catalog(纯装饰,占 UTF-8 字节最狠);人读清单走 `apply.py --list`(读 pack.json)
            entry = {
                "id": p["id"],
                "version": p["version"],
                "one_liner": clip(p.get("when", ""), 28),
                "path": f"packs/{p['id']}/",
            }
            if p.get("canonical_home"):
                entry["home"] = p["canonical_home"]
            entries.append(entry)
        cats.append({"id": cid, "title": title, "count": len(entries), "items": entries})
    return {
        "schema": 1,
        "repo": "nakamotosai/sai-assets",
        "updated": stamp(),
        "base": BASE,
        "how_to_use": "读本文件选包(只有发现字段)→ 取 base+path+pack.json 看完整元数据 → 读 SKILL.md 按 apply 步骤落地;项目侧用 python scripts/apply.py <id> --to <dir>",
        "categories": cats,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="只校验,不写盘")
    args = ap.parse_args()

    payload = json.dumps(collect(), ensure_ascii=False, indent=1)
    size = len(payload.encode("utf-8"))
    if size > LIMIT:
        print(f"FAIL catalog too big: {size}B > {LIMIT}B — 裁剪 when/tags 或改成分层索引", file=sys.stderr)
        sys.exit(1)

    if args.check:
        if not OUT.is_file():
            print("FAIL catalog.json missing", file=sys.stderr)
            sys.exit(1)
        on_disk = OUT.read_text(encoding="utf-8")
        # updated 字段每次都变,比较时忽略
        strip = lambda s: "\n".join(l for l in s.splitlines() if '"updated"' not in l)
        if strip(on_disk) != strip(payload):
            print("FAIL catalog.json is stale — run python scripts/build_catalog.py", file=sys.stderr)
            sys.exit(1)
        print(f"PASS catalog --check: {size}B")
        return

    OUT.write_text(payload, encoding="utf-8")
    total = sum(c["count"] for c in collect()["categories"])
    print(f"PASS build_catalog: {total} packs, {size}B ≤ {LIMIT}B")


if __name__ == "__main__":
    main()
