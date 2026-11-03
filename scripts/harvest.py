#!/usr/bin/env python3
"""harvest.py · 把项目里的资产收成一个包(闭环上游, M3)。

用法:
  python scripts/harvest.py <id> --from <src-dir> --kind fx --category web-fx \
      --when "何时用" --not-for "何时不用" --license MIT --entry index.html \
      [--usage <已有用法文档> | --gen-assert] [--max-mb 8] [--dry-run]

设计约束(为什么这么别扭是故意的):
  - **不许造内容**:`--when` / `--not-for` / `--license` 必填,`--usage` 必须指向一份**已存在**的
    用法文档(或显式 `--gen-assert` 让本脚本生成通用校验器)。缺一律报错退出,不写占位。
  - **不许灌不入闸的东西**:收完立刻用 `gate.py --scan-dir` 扫新包,报红即非零退出(文件照留,人工处置)。
  - 只搬文件、只生成机器可推导的字段(pack.json 的 id/title/version/files/tags/verified);
    正文(usage / SKILL / README)要么来自 `--usage`,要么由人工补——harvest 不写散文。
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
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".private", ".venv", "out", "dist", ".next"}
SKIP_FILES = {".DS_Store", "Thumbs.db"}

KIND_REQUIRES = {
    "theme": ("css", "tokens"),
    "fx": ("src", "preview"),
    "ui": ("src", "preview"),
    "fonts": ("tokens",),
    "meta": ("docs",),
}

GENERIC_ASSERT = '''#!/usr/bin/env python3
"""通用断言(pack.json 为唯一依据):必备键 / 声明文件存在 / 本地引用可解析。"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REF = re.compile(r"""(?:src|href)\\s*=\\s*["\\']([^"\\']+)["\\']|url\\(\\s*["\\']?([^"\\')]+)["\\']?\\s*\\)""")
SKIP_SCHEMES = ("http://", "https://", "data:", "mailto:", "#", "//")


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    pack = json.loads((ROOT / "pack.json").read_text(encoding="utf-8"))
    for key in ("schema", "id", "title", "kind", "category", "version", "license",
                "attribution", "origin", "entry", "files", "tags", "when", "not_for", "verified"):
        if key not in pack:
            fail(f"pack.json 缺必备键 {key}")
    declared: list[str] = []
    files = pack["files"] or {{}}
    for key, value in files.items():
        if isinstance(value, str):
            declared.append(value)
        elif isinstance(value, list):
            declared += [v for v in value if isinstance(v, str)]
    for rel in declared:
        if not (ROOT / rel).is_file():
            fail(f"声明了不存在的文件 {{rel}}")
    entry = pack.get("entry")
    if entry and not (ROOT / entry).is_file():
        fail(f"entry 不存在 {{entry}}")
    preview = files.get("preview")
    if preview:
        html = (ROOT / preview).read_text(encoding="utf-8")
        missing = []
        for m in REF.finditer(html):
            url = (m.group(1) or m.group(2) or "").strip()
            if not url or url.startswith(SKIP_SCHEMES):
                continue
            target = (ROOT / preview).parent / url.split("?")[0].split("#")[0]
            if not target.exists():
                missing.append(url)
        if missing:
            fail(f"{preview} 有无法解析的本地引用: {{missing[:5]}}")
    print(f"PASS assert_tokens {{pack['id']}}")
    print(f"  declared={{len(declared)}} entry={{entry}} preview={{'yes' if preview else 'none'}}")


if __name__ == "__main__":
    main()
'''


def collect(src: Path, max_mb: float) -> tuple[list[Path], list[str]]:
    kept, skipped = [], []
    limit = max_mb * 1024 * 1024
    for f in sorted(src.rglob("*")):
        if not f.is_file():
            continue
        rel = f.relative_to(src)
        if any(part in SKIP_DIRS for part in rel.parts) or f.name in SKIP_FILES:
            skipped.append(f"{rel}(排除目录)")
            continue
        if f.stat().st_size > limit:
            skipped.append(f"{rel}(>{max_mb}MB)")
            continue
        kept.append(f)
    return kept, skipped


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("pack_id")
    ap.add_argument("--from", dest="src", required=True)
    ap.add_argument("--kind", required=True, choices=sorted(KIND_REQUIRES))
    ap.add_argument("--category", required=True)
    ap.add_argument("--when", required=True)
    ap.add_argument("--not-for", dest="not_for", required=True)
    ap.add_argument("--license", required=True)
    ap.add_argument("--entry", required=True)
    ap.add_argument("--usage", help="已存在的用法文档(拷进包内 docs/usage.md)")
    ap.add_argument("--gen-assert", action="store_true", help="生成通用断言脚本")
    ap.add_argument("--title")
    ap.add_argument("--tag", action="append", default=[])
    ap.add_argument("--max-mb", type=float, default=8.0)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--keep-going", action="store_true", help="闸报红也留档(默认即留档,此键仅作显式声明)")
    args = ap.parse_args()

    if args.pack_id in {p.parent.name for p in PACKS.glob("*/pack.json")}:
        print(f"FAIL 包已存在:{args.pack_id}(要改就改包内文件,不要重复 harvest)", file=sys.stderr)
        sys.exit(1)
    src = Path(args.src).resolve()
    if not src.is_dir():
        print(f"FAIL 源目录不存在:{src}", file=sys.stderr)
        sys.exit(1)
    if not args.usage and not args.gen_assert:
        print("FAIL 必须给 --usage <已存在的用法文档> 或 --gen-assert(harvest 不写散文)", file=sys.stderr)
        sys.exit(1)
    usage_text = None
    if args.usage:
        up = Path(args.usage)
        if not up.is_file():
            print(f"FAIL --usage 文件不存在:{up}", file=sys.stderr)
            sys.exit(1)
        usage_text = up.read_text(encoding="utf-8")

    dest = PACKS / args.pack_id
    src_dest = dest / "src"
    files, skipped = collect(src, args.max_mb)
    if args.dry_run:
        print(f"[dry-run] {args.pack_id} ← {src}")
        print(f"  将拷 {len(files)} 个文件;跳过 {len(skipped)} 个")
        for s in skipped[:10]:
            print(f"    skip {s}")
        return

    src_dest.mkdir(parents=True, exist_ok=True)
    copied = []
    for f in files:
        rel = f.relative_to(src)
        target = src_dest / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(f, target)
        copied.append(f"src/{rel.as_posix()}")

    wants = KIND_REQUIRES[args.kind]
    if "docs" in wants or args.kind == "meta":
        (dest / "docs").mkdir(parents=True, exist_ok=True)
    if "preview" in wants or (src_dest / "index.html").is_file():
        (dest / "preview").mkdir(parents=True, exist_ok=True)
        if (src_dest / "index.html").is_file() and not (dest / "preview" / "index.html").is_file():
            shutil.copy2(src_dest / "index.html", dest / "preview" / "index.html")
            copied.append("preview/index.html")
    if usage_text is not None:
        (dest / "docs").mkdir(parents=True, exist_ok=True)
        (dest / "docs" / "usage.md").write_text(usage_text, encoding="utf-8")
    assert_rel = None
    if args.gen_assert:
        (dest / "scripts").mkdir(parents=True, exist_ok=True)
        (dest / "scripts" / "assert_tokens.py").write_text(GENERIC_ASSERT, encoding="utf-8")
        assert_rel = "scripts/assert_tokens.py"

    preview_rel = "preview/index.html" if (dest / "preview" / "index.html").is_file() else None
    pack = {
        "schema": 1,
        "id": args.pack_id,
        "title": args.title or args.pack_id,
        "kind": args.kind,
        "category": args.category,
        "version": "1.0.0",
        "license": args.license,
        "attribution": [],
        "origin": {"project": src.name, "path": f"<{args.pack_id}>", "derived_from": None},
        "entry": args.entry,
        "files": {
            "src": copied,
            "usage": "docs/usage.md" if usage_text is not None else None,
            "assert": assert_rel,
            "preview": preview_rel,
        },
        "tags": args.tag or [args.kind],
        "when": args.when,
        "not_for": args.not_for,
        "default_variant": None,
        "verified": {"date": dt.date.today().isoformat(), "how": "harvest + 人工补", "evidence": "待补"},
        "canonical_home": None,
    }
    (dest / "pack.json").write_text(json.dumps(pack, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"harvest {args.pack_id}: 拷入 {len(copied)} 文件;跳过 {len(skipped)}")
    for s in skipped[:10]:
        print(f"  skip {s}")

    # 清洗(有 sanitize 就调,计数打出来)
    san = ROOT / "scripts" / "sanitize.py"
    if san.is_file():
        r = subprocess.run([sys.executable, str(san), "--pack", str(dest)], cwd=ROOT,
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        print((r.stdout or r.stderr).strip()[-800:])

    # 闸:仓级跑(闸只扫 git 跟踪文件 → 先 add),只看本包是否干净
    subprocess.run(["git", "add", "-A"], cwd=ROOT, capture_output=True)
    gate = ROOT / "scripts" / "gate.py"
    r = subprocess.run([sys.executable, str(gate)], cwd=ROOT,
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    out = (r.stdout or "") + (r.stderr or "")
    print(out.strip()[-1500:])
    mine = [l for l in out.splitlines() if f"packs/{args.pack_id}/" in l]
    if mine:
        print(f"FAIL 本包闸未过({len(mine)} 条命中,见上);文件已留在包目录内", file=sys.stderr)
        sys.exit(1)
    if r.returncode != 0:
        others = [l for l in out.splitlines() if l.startswith(("[banned]", "[schema]", "[assert]"))]
        print(f"注:仓级闸有 {len(others)} 条命中不属本包(在建中的包),本包本身干净。")

    print(f"""
下一步(人工补完才算完,禁留占位):
  1. 写 packs/{args.pack_id}/SKILL.md 与 README.md;docs/usage.md 若无内容补齐;
  2. 若未 --gen-assert,补 scripts/assert_tokens.py(照 docs/PACK-CONTRACT.md §5);
  3. 填 pack.json 的 attribution / tags / verified(跑一遍断言把输出贴进 evidence);
  4. git add -A && python scripts/gate.py && python scripts/build_catalog.py && python scripts/build_wall.py;
  5. git switch -c pack/{args.pack_id} && git commit -m "feat(pack): {args.pack_id}" && git push -u origin pack/{args.pack_id} && gh pr create --fill""")


if __name__ == "__main__":
    main()
