#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""swiss-style 断言:契约键 / 文件齐备 / preview 引用可解析 / 非空 / 文档小节。

只依赖 stdlib。通过 → 打印 "PASS assert_tokens swiss-style" + 一行实测摘要,exit 0;
失败 → 把 FAIL 原因打到 stderr,exit 1。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PACK_ID = "swiss-style"
ROOT = Path(__file__).resolve().parents[1]
REQUIRED = (
    "schema", "id", "title", "kind", "category", "version", "license",
    "attribution", "origin", "entry", "files", "tags", "when", "not_for",
    "verified",
)
ABS_PATH = re.compile(r"^([A-Za-z]:|/|\\\\)")
REF_RE = re.compile(r'(?:src|href)\s*=\s*["\']([^"\']+)["\']|url\(\s*["\']?([^"\')]+)["\']?\s*\)', re.I)
BANNED_HOST = re.compile(
    r"^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
    r"|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$"
)
USAGE_CUES = ("反模式", "接入步骤")


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def in_pack(p: Path) -> bool:
    try:
        p.resolve().relative_to(ROOT.resolve())
        return True
    except ValueError:
        return False


def iter_declared(files: dict):
    """yield files.* 里声明的每个包内相对路径。"""
    for key, val in files.items():
        if isinstance(val, list):
            for item in val:
                if isinstance(item, str):
                    yield key, item
        elif isinstance(val, str):
            yield key, val


def check_pack_json() -> tuple[dict, int]:
    pj = ROOT / "pack.json"
    if not pj.is_file():
        fail("missing pack.json")
    try:
        pack = json.loads(pj.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        fail(f"pack.json not parseable: {exc}")

    missing = [k for k in REQUIRED if k not in pack]
    if missing:
        fail(f"pack.json missing keys: {', '.join(missing)}")
    if pack["kind"] != "ui":
        fail(f'kind must be "ui", got {pack["kind"]!r}')
    if pack["category"] != "web-ui":
        fail(f'category must be "web-ui", got {pack["category"]!r}')
    origin = pack.get("origin") or {}
    opath = origin.get("path", "")
    if not isinstance(opath, str) or not opath or ABS_PATH.match(opath):
        fail(f"origin.path must be a relative path, got {opath!r}")

    n = 0
    for key, rel in iter_declared(pack["files"]):
        n += 1
        target = ROOT / rel
        if not in_pack(target) or not target.is_file():
            fail(f"files.{key} declares missing/out-of-pack path: {rel}")
    return pack, n


def check_src() -> tuple[int, int]:
    src = ROOT / "src"
    if not src.is_dir():
        fail("missing src/")
    files = sorted(p for p in src.iterdir() if p.suffix in (".css", ".js"))
    if not files:
        fail("src/ has no .css/.js files")
    total = 0
    for p in files:
        size = p.stat().st_size
        if size == 0:
            fail(f"src file is empty: {p.name}")
        total += size
    if not any(p.suffix == ".css" for p in files):
        fail("src/ has no .css file")
    return len(files), total


def check_preview() -> int:
    pv = ROOT / "preview" / "index.html"
    if not pv.is_file():
        fail("missing preview/index.html")
    text = pv.read_text(encoding="utf-8")
    refs = 0
    for m in REF_RE.finditer(text):
        raw = (m.group(1) or m.group(2) or "").strip()
        if not raw or raw.startswith("#"):
            continue
        refs += 1
        low = raw.lower()
        if low.startswith("http://"):
            fail(f"preview has non-https external link: {raw}")
        if low.startswith("https://"):
            host = low[8:].split("/", 1)[0].split("@")[-1].split(":")[0]
            if BANNED_HOST.match(host):
                fail(f"preview links to local/intranet host: {raw}")
            continue
        if ":" in raw.split("/", 1)[0]:
            fail(f"preview uses a non-http(s) scheme: {raw}")
        target = (pv.parent / raw.split("?", 1)[0].split("#", 1)[0]).resolve()
        if not in_pack(target) or not target.is_file():
            fail(f"preview relative ref does not resolve inside pack: {raw}")
    return refs


def check_usage() -> None:
    usage = ROOT / "docs" / "usage.md"
    if not usage.is_file():
        fail("missing docs/usage.md")
    text = usage.read_text(encoding="utf-8")
    for cue in USAGE_CUES:
        if cue not in text:
            fail(f"docs/usage.md missing section cue: {cue}")


def main() -> None:
    pack, declared = check_pack_json()
    n_src, src_bytes = check_src()
    refs = check_preview()
    check_usage()

    print(f"PASS assert_tokens {PACK_ID}")
    print(
        f"  引用 {refs} 个 · 声明路径 {declared} 个 · src 文件 {n_src} 个 · "
        f"共 {src_bytes} 字节 · kind=ui category=web-ui"
    )


if __name__ == "__main__":
    main()
