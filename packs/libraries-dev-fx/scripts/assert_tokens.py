#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""libraries-dev-fx 断言。

覆盖:
1. pack.json 可解析 + 必备键齐全 + origin.path 相对 + kind/category 正确;
2. files.* 声明的每个路径真实存在(数组逐项);
3. preview/index.html 里 src= / href= / url(...) 的引用:https 外链只许 https 且非本机/内网,
   相对引用必须落在包目录内且指向真实文件(禁 ../ 越出包目录);importmap 条目同样查;
4. src/ 下每个 .css/.js 存在且非空;docs/usage.md 含硬编码关键词(接入步骤 / 反模式 / 失败排查);
5. 五个 stage 结构齐备、bench.js 五个 CDN 包齐全、无静态 import、preview 无 type="module";
6. 全包文本外链协议卫生:不出现 http:// 、本机地址、内网 IP。

通过:stdout 打印 "PASS assert_tokens libraries-dev-fx" + 一行实测摘要;失败:stderr 打印 FAIL 并 exit 1。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PACK_ID = "libraries-dev-fx"
ROOT = Path(__file__).resolve().parents[1]

REQUIRED_KEYS = (
    "schema", "id", "title", "kind", "category", "version", "license",
    "attribution", "origin", "entry", "files", "tags", "when", "not_for", "verified",
)
FILES_ARRAY_KEYS = ("tokens", "css", "src", "upstream")
FILES_STR_KEYS = ("usage", "assert", "preview")

STAGES = ("stage-beam", "stage-orbs", "stage-gooey", "stage-metal", "stage-image")
PACKAGES = ("border-beam", "thinking-orbs", "liquid-gooey", "metal-fx", "img-fx")
IMPORTMAP_KEYS = ("react", "react-dom/client", "three", "htm")
USAGE_CUES = ("接入步骤", "反模式", "失败排查", "Libraries.dev", "MIT")
TEXT_EXTS = (".html", ".css", ".js", ".md", ".json")

ABS_PATH = re.compile(r"^([A-Za-z]:[\\/]|/|\\\\)")
VERSION = re.compile(r"^\d+\.\d+\.\d+$")
LOCAL_HOST = re.compile(r"(?i)(localhost|\b127\.0\.0\.1\b|\[::1\]|\b0\.0\.0\.0\b|\.local\b)")
PRIVATE_IP = re.compile(r"\b(?:10\.\d{1,3}|192\.168\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b")
HTTP_PLAIN = re.compile(r"http://", re.I)
SCHEME = re.compile(r"^([A-Za-z][A-Za-z0-9+.\-]*):")
ATTR_REF = re.compile(r"""\b(?:src|href)\s*=\s*["']([^"']*)["']""")
CSS_URL = re.compile(r"""url\(\s*['"]?([^'")\s]+)""")
STATIC_IMPORT = re.compile(r"^\s*import\s+(?!\()", re.M)
IMPORTMAP = re.compile(r"""<script\s+type=["']importmap["']\s*>(.*?)</script>""", re.S | re.I)


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def text_of(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def check_pack_json() -> dict:
    pj = ROOT / "pack.json"
    if not pj.is_file():
        fail("missing pack.json")
    try:
        pack = json.loads(text_of(pj))
    except json.JSONDecodeError as exc:
        fail(f"pack.json not parseable: {exc}")
    if not isinstance(pack, dict):
        fail("pack.json must be an object")

    missing = [k for k in REQUIRED_KEYS if k not in pack]
    if missing:
        fail("pack.json missing required keys: " + ", ".join(missing))
    if pack["schema"] != 1:
        fail(f"schema must be 1, got {pack['schema']!r}")
    if pack["id"] != PACK_ID:
        fail(f"id must be {PACK_ID}, got {pack['id']!r}")
    if not isinstance(pack["title"], str) or len(pack["title"]) < 2:
        fail("title must be a non-empty string")
    if pack["kind"] != "ui":
        fail(f"kind must be ui, got {pack['kind']!r}")
    if pack["category"] != "web-ui":
        fail(f"category must be web-ui, got {pack['category']!r}")
    if not VERSION.match(str(pack["version"])):
        fail(f"version must be x.y.z, got {pack['version']!r}")
    if not str(pack["license"]).strip():
        fail("license must be non-empty")

    attribution = pack["attribution"]
    if not isinstance(attribution, list) or not attribution:
        fail("attribution must be a non-empty array")
    for i, item in enumerate(attribution):
        if not isinstance(item, dict) or not item.get("name") or not item.get("license"):
            fail(f"attribution[{i}] needs name + license")

    origin = pack["origin"]
    if not isinstance(origin, dict) or not origin.get("project") or not origin.get("path"):
        fail("origin needs project + path")
    if ABS_PATH.match(str(origin["path"])):
        fail(f"origin.path must be relative, got {origin['path']!r}")

    entry = ROOT / str(pack["entry"])
    if not entry.is_file():
        fail(f"entry not found: {pack['entry']}")

    files = pack["files"]
    if not isinstance(files, dict) or not files:
        fail("files must be a non-empty object")
    for key in files:
        if key not in FILES_ARRAY_KEYS + FILES_STR_KEYS:
            fail(f"files.{key} is not an allowed key")

    verified = pack["verified"]
    for key in ("date", "how", "evidence"):
        if not str(verified.get(key, "")).strip():
            fail(f"verified.{key} must be non-empty")

    tag_set = {t.strip().lower() for t in map(str, pack["tags"])}
    for cue in ("react", "cdn"):
        if cue not in tag_set:
            fail(f"tags must include {cue!r}")
    return pack


def check_declared_files(pack: dict) -> tuple[list[Path], list[Path]]:
    """files.* 里声明的每个路径都要在包内存在(数组逐项)。返回声明的 src 文件。"""
    declared: list[Path] = []
    src_files: list[Path] = []
    for key, value in pack["files"].items():
        if key in FILES_ARRAY_KEYS:
            if not isinstance(value, list) or not value:
                fail(f"files.{key} must be a non-empty array")
            for raw in value:
                declared.append(_resolve_declared(raw, f"files.{key}"))
        elif value is not None:
            declared.append(_resolve_declared(value, f"files.{key}"))
    for rel in pack["files"].get("src", []):
        src_files.append(ROOT / str(rel))
    if not src_files:
        fail("files.src must declare the src/ assets")
    for path in src_files:
        if path.suffix.lower() not in (".css", ".js"):
            fail(f"files.src item must be .css/.js, got {path.name}")
    return declared, src_files


def _resolve_declared(raw: object, where: str) -> Path:
    if not isinstance(raw, str) or not raw.strip():
        fail(f"{where} must be a non-empty string, got {raw!r}")
    if ABS_PATH.match(raw) or raw.startswith(".."):
        fail(f"{where} must be a pack-relative path, got {raw!r}")
    path = ROOT / raw
    if not path.is_file():
        fail(f"{where} -> {raw} does not exist")
    return path


def check_src_files(src_files: list[Path]) -> tuple[int, int]:
    """src/ 下每个 .css/.js 都要存在且非空。返回 (文件数, 总字节)。"""
    found = sorted(p for p in (ROOT / "src").rglob("*") if p.is_file() and p.suffix.lower() in (".css", ".js"))
    if not found:
        fail("src/ has no .css/.js file")
    for path in found:
        if not path.is_file():
            fail(f"missing src file: {path.relative_to(ROOT).as_posix()}")
        if path.stat().st_size == 0:
            fail(f"empty src file: {path.relative_to(ROOT).as_posix()}")
    for path in src_files:
        if path not in found:
            fail(f"declared src file not found under src/: {path.name} (got {[p.name for p in found]})")
    src_js = ROOT / "src" / "bench.js"
    body = text_of(src_js)
    if STATIC_IMPORT.search(body):
        fail("src/bench.js must not use static import (file:// would break); use dynamic import()")
    for pkg in PACKAGES:
        if f"esm.sh/{pkg}" not in body:
            fail(f"src/bench.js missing CDN url for package {pkg}")
    if body.count("catch (e)") < len(PACKAGES):
        fail("src/bench.js must wrap every component load in try/catch")
    if "boot().catch(" not in body:
        fail("src/bench.js must have a top-level boot().catch(...) fallback")
    return len(found), sum(p.stat().st_size for p in found)


def check_ref(ref: str, base: Path, where: str, stats: dict) -> None:
    raw = ref.strip()
    if not raw or raw.startswith("#"):
        stats["inline"] += 1
        return
    if LOCAL_HOST.search(raw) or PRIVATE_IP.search(raw):
        fail(f"{where}: reference points at local/private host: {raw!r}")
    if raw.startswith("//"):
        fail(f"{where}: protocol-relative reference is not allowed: {raw!r}")
    match = SCHEME.match(raw)
    if match:
        scheme = match.group(1).lower()
        if scheme in ("http", "https"):
            if scheme != "https":
                fail(f"{where}: external reference must be https: {raw!r}")
            stats["external"] += 1
            return
        if scheme == "data":
            stats["inline"] += 1
            return
        fail(f"{where}: unsupported scheme {scheme!r} in reference: {raw!r}")
    target_ref = raw.split("#", 1)[0].split("?", 1)[0]
    if not target_ref:
        stats["inline"] += 1
        return
    target = (base / target_ref).resolve()
    root = ROOT.resolve()
    if target != root and root not in target.parents:
        fail(f"{where}: relative reference escapes the pack: {raw!r}")
    if not target.is_file():
        fail(f"{where}: relative reference does not resolve to a file: {raw!r} -> {target_ref}")
    stats["relative"] += 1


def check_preview() -> dict:
    preview = ROOT / "preview" / "index.html"
    if not preview.is_file():
        fail("missing preview/index.html")
    html = text_of(preview)
    if re.search(r"""type\s*=\s*["']module["']""", html, re.I):
        fail("preview/index.html must load src/bench.js as a classic deferred script (file:// safe)")

    stats = {"external": 0, "relative": 0, "inline": 0, "importmap": 0}
    for ref in ATTR_REF.findall(html):
        check_ref(ref, preview.parent, "preview/index.html", stats)
    for ref in CSS_URL.findall(html):
        check_ref(ref, preview.parent, "preview/index.html(url())", stats)

    for path in sorted((ROOT / "src").rglob("*.css")):
        for ref in CSS_URL.findall(text_of(path)):
            check_ref(ref, path.parent, f"{path.relative_to(ROOT).as_posix()}(url())", stats)

    blocks = IMPORTMAP.findall(html)
    if len(blocks) != 1:
        fail(f"preview/index.html needs exactly one importmap, got {len(blocks)}")
    try:
        imports = json.loads(blocks[0]).get("imports", {})
    except json.JSONDecodeError as exc:
        fail(f"importmap is not valid JSON: {exc}")
    for key in IMPORTMAP_KEYS:
        if key not in imports:
            fail(f"importmap missing specifier {key!r}")
    for key, url in imports.items():
        if not isinstance(url, str) or not url.startswith("https://"):
            fail(f"importmap entry {key!r} must be an https url, got {url!r}")
        if LOCAL_HOST.search(url) or PRIVATE_IP.search(url):
            fail(f"importmap entry {key!r} points at a local/private host: {url!r}")
        stats["importmap"] += 1

    for stage in STAGES:
        if html.count(f'id="{stage}"') != 1:
            fail(f'preview/index.html needs exactly one element with id="{stage}"')
        if not re.search(rf"""<div[^>]*class=["']stage["'][^>]*id=["']{stage}["']""", html):
            fail(f"{stage} must be a div.stage")
    for rel in ("../src/bench.css", "../src/bench.js"):
        if rel not in re.findall(r"""\b(?:src|href)\s*=\s*["']([^"']*)["']""", html):
            fail(f"preview/index.html must reference {rel}")
    return stats


def check_usage() -> None:
    usage = ROOT / "docs" / "usage.md"
    if not usage.is_file():
        fail("missing docs/usage.md")
    body = text_of(usage)
    for cue in USAGE_CUES:
        if cue not in body:
            fail(f"docs/usage.md missing required cue: {cue}")
    for pkg in PACKAGES:
        if pkg not in body:
            fail(f"docs/usage.md missing package mention: {pkg}")


def check_protocol_hygiene() -> int:
    """全包文本外链卫生:0 处 http:// 、0 处本机/内网地址。"""
    hits = 0
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in TEXT_EXTS:
            continue
        body = text_of(path)
        rel = path.relative_to(ROOT).as_posix()
        for label, pattern in (("http://", HTTP_PLAIN), ("local-host", LOCAL_HOST), ("private-ip", PRIVATE_IP)):
            for m in pattern.finditer(body):
                hits += 1
                fail(f"{rel}: {label} hit -> {m.group(0)!r}")
    return hits


def main() -> None:
    if not ROOT.is_dir():
        fail(f"pack root not found: {ROOT}")
    pack = check_pack_json()
    declared, src_files = check_declared_files(pack)
    n_src, src_bytes = check_src_files(src_files)
    refs = check_preview()
    check_usage()
    hygiene = check_protocol_hygiene()

    total_refs = refs["external"] + refs["relative"]
    print(f"PASS assert_tokens {PACK_ID}")
    print(
        f"  引用 {total_refs} 个(https {refs['external']} / 包内相对 {refs['relative']})"
        f" + importmap {refs['importmap']} 条 · src {n_src} 个文件 {src_bytes} 字节"
        f" · files 声明 {len(declared)} 条全部命中"
        f" · {len(STAGES)} 个 stage / {len(PACKAGES)} 个 CDN 包"
        f" · http/本机/内网命中 {hygiene}"
    )


if __name__ == "__main__":
    main()
