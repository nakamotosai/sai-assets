#!/usr/bin/env python3
"""apply.py · 把包拷进项目(拷贝式,无运行时依赖)。

用法:
  python scripts/apply.py --list
  python scripts/apply.py ouuut-editorial --to src/styles [--dry-run]

行为:
  - 默认**整包拷贝**(含 pack.json 与 preview,包内断言才能在项目里自证);`--minimal` 只拷产物子集;
  - 不写 node_modules、不改目标项目其它文件;
  - 打印可直接粘进 design-lock.json 的 assets[] 片段;
  - 外部包(canonical_home 非空)拒绝拷贝,给出去本家取的指引。
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKS = ROOT / "packs"


def load(pack_id: str) -> tuple[dict, Path]:
    d = PACKS / pack_id
    f = d / "pack.json"
    if not f.is_file():
        print(f"FAIL unknown pack: {pack_id}(用 --list 看可用包)", file=sys.stderr)
        sys.exit(1)
    return json.loads(f.read_text(encoding="utf-8")), d


def git_sha() -> str | None:
    try:
        out = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT,
                             capture_output=True, text=True, timeout=10)
        return out.stdout.strip() or None
    except Exception:
        return None


def list_packs() -> None:
    """人读清单:直接读 pack.json(标题/tags/外部标记都在那儿),不依赖 catalog 的瘦身字段。"""
    rows = []
    for path in sorted(PACKS.glob("*/pack.json")):
        p = json.loads(path.read_text(encoding="utf-8"))
        rows.append(p)
    by_cat: dict[str, list[dict]] = {}
    for p in rows:
        by_cat.setdefault(p["category"], []).append(p)
    for cat in sorted(by_cat):
        items = by_cat[cat]
        print(f'## {cat} ({len(items)})')
        for p in sorted(items, key=lambda x: x["id"]):
            mark = "外部" if p.get("external") else "    "
            title = " ".join(str(p.get("title", "")).split())[:34]
            print(f'  {mark} {p["id"]:24s} v{p["version"]:7s} {title}')


def apply(pack_id: str, target: str, dry: bool, minimal: bool = False) -> None:
    pack, src_dir = load(pack_id)
    if pack.get("canonical_home"):
        print(f'外部包:{pack["id"]} 内容不在本仓。请从本家取用 → {pack["canonical_home"]}', file=sys.stderr)
        sys.exit(2)

    dest_root = Path(target).resolve() / pack_id
    files = pack.get("files") or {}
    if minimal:
        wanted: list[str] = []
        for key in ("css", "src", "tokens", "upstream"):
            wanted += [f for f in (files.get(key) or [])]
        for rel in (files.get("usage"), files.get("assert"), pack.get("entry"), "README.md"):
            if rel:
                wanted.append(rel)
        wanted = [w for w in dict.fromkeys(wanted) if (src_dir / w).is_file()]
    else:
        # 默认整包拷贝:包自带 `scripts/assert_tokens.py` 要读 pack.json 与 preview,
        # 少了它们包内断言必失败(真实消费时踩到过)。整包拷 = 项目里也自证得起来。
        wanted = sorted(
            str(f.relative_to(src_dir)).replace("\\", "/")
            for f in src_dir.rglob("*")
            if f.is_file()
        )

    if not wanted:
        print(f"FAIL pack {pack_id} declares no copyable files", file=sys.stderr)
        sys.exit(1)

    print(f'{"[dry-run] " if dry else ""}{pack_id} v{pack["version"]} → {dest_root}')
    for rel in wanted:
        size = (src_dir / rel).stat().st_size
        print(f"  + {rel} ({size}B)")
        if not dry:
            dst = dest_root / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_dir / rel, dst)

    if dry:
        print("\n(dry-run:未写盘)")
        return

    entry = pack.get("entry")
    print(f"\n下一步:在页面里引入 {pack_id}/ 下产物;入口文档 {entry}。")
    lock_entry = {
        "pack": pack["id"],
        "category": pack["category"],
        "version": pack["version"],
        "sha": git_sha(),
        "via": "apply.py",
        "applied_at": dt.date.today().isoformat(),
        "files": wanted,
        "note": "",
    }
    print("\n把这段加进项目 design-lock.json 的 assets[](同一 pack 只留一条):")
    print(json.dumps([lock_entry], ensure_ascii=False, indent=2))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("pack", nargs="?", help="包 id")
    ap.add_argument("--to", help="目标目录(会创建 <to>/<id>/)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--minimal", action="store_true",
                    help="只拷 css/src/tokens/usage/entry/README(默认整包拷贝,含 pack.json 与 preview)")
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()

    if args.list or not args.pack:
        list_packs()
        return
    if not args.to:
        print("FAIL 需要 --to <dir>", file=sys.stderr)
        sys.exit(1)
    apply(args.pack, args.to, args.dry_run, args.minimal)


if __name__ == "__main__":
    main()
