#!/usr/bin/env python3
"""release.py · 包级发布(M3)。

用法:
  python scripts/release.py --list                 # 列出各包版本与最近 tag
  python scripts/release.py paper-editorial        # 给该包打 tag:pack/<id>@<version>
  python scripts/release.py --all --dry-run        # 看会给哪些包打

行为:
  - 版本读 `packs/<id>/pack.json` 的 `version`;
  - tag 名 `pack/<id>@<version>`;
  - 已存在的 tag 跳过(包级"只增不改"的落地检查);
  - 打 tag 前必须 gate 绿(直接调用 scripts/gate.py);
  - push tag 需显式 `--push`(默认只本地打)。
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKS = ROOT / "packs"


def git(*args: str, check: bool = True) -> str:
    out = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if check and out.returncode != 0:
        print(out.stderr.strip(), file=sys.stderr)
        sys.exit(1)
    return out.stdout.strip()


def tag_name(pack_id: str, version: str) -> str:
    return f"pack/{pack_id}@{version}"


def existing_tags() -> set[str]:
    return set(git("tag", "--list").splitlines())


def run_gate() -> None:
    out = subprocess.run([sys.executable, str(ROOT / "scripts" / "gate.py")], cwd=ROOT,
                         capture_output=True, text=True, encoding="utf-8", errors="replace")
    print((out.stdout or "").strip() or (out.stderr or "").strip())
    if out.returncode != 0:
        print("FAIL gate 未过,拒绝打 tag", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("pack", nargs="?")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()

    packs = {}
    for path in sorted(PACKS.glob("*/pack.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        packs[data["id"]] = data

    tags = existing_tags()
    if args.list:
        for pid, data in packs.items():
            t = tag_name(pid, data["version"])
            print(f'{pid:26s} v{data["version"]:8s} {"已发布" if t in tags else "未发布":6s} {t}')
        return

    targets = list(packs.values()) if (args.all or not args.pack) else [packs.get(args.pack)]
    if not targets or targets[0] is None:
        print(f"FAIL unknown pack: {args.pack}", file=sys.stderr)
        sys.exit(1)

    if not args.dry_run:
        run_gate()

    made = []
    for data in targets:
        t = tag_name(data["id"], data["version"])
        if t in tags:
            print(f"skip {t}(已存在)")
            continue
        if data.get("external"):
            print(f"skip {t}(外部包,内容不在本仓,不发布)")
            continue
        if args.dry_run:
            print(f"[dry-run] git tag {t}")
            continue
        git("tag", t)
        print(f"tagged {t}")
        made.append(t)

    if args.push and made:
        for t in made:
            git("push", "origin", t)
            print(f"pushed {t}")
    elif made:
        print(f"\n{len(made)} 个 tag 只在本地;要推远端加 --push")


if __name__ == "__main__":
    main()
