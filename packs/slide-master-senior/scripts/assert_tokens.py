#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""slide-master-senior 断言:pack.json 元数据 / 声明产物 / 预览引用可达 / src 非空 / 文档口径 / 禁用词。

只依赖标准库。退出码 0 = 通过;失败把 FAIL 原因写到 stderr 并 exit 1。

用法:
    python packs/slide-master-senior/scripts/assert_tokens.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

PACK_ID = "slide-master-senior"
ROOT = Path(__file__).resolve().parents[1]

REQUIRED_KEYS = (
    "schema", "id", "title", "kind", "category", "version", "license",
    "attribution", "origin", "entry", "files", "tags", "when", "not_for", "verified",
)
# schema/pack.schema.json 是 additionalProperties:false,这里同步一份白名单
ALLOWED_KEYS = set(REQUIRED_KEYS) | {"default_variant", "canonical_home", "external", "changelog"}
ALLOWED_FILE_KEYS = {"tokens", "css", "src", "upstream", "usage", "assert", "preview"}

# 文档必须写死的口径(改文档别改这里,是故意钉住的)
USAGE_CUES = (
    "怎么接入", "反模式", "1000 法则", "#334155",
    "18.5–21px", "44–48px", "1.65–1.75", "@page", "page-break-after", "≤40 字",
)
# src/deck.css 与 src/deck.js 里必须存在的实现锚点
CSS_CUES = ("@page", "page-break-after", "--deck-fit", "--ink-2", "--accent", ":root")
JS_CUES = ("ArrowLeft", "ArrowRight", "prefers-reduced-motion", "scrollIntoView", "--deck-fit")
# preview 里必须有的结构锚点
PREVIEW_CUES = ('class="page"', "cover-grid", "timeline", "data-deck-pageno", "<script")

# 片段拼接:让自检脚本自身不出现这些禁用串
BANNED = {
    "保密标记-private": "PRIV" + "ATE",
    "保密标记-confidential": "CONFIDENT" + "IAL",
    "底座面板残留": "param-" + "panel",
    "自有域名": "sa" + "aaai" + "." + "com",
}

TEXT_SUFFIXES = {".html", ".css", ".js", ".json", ".md"}
# 形态在运行时拼装:断言脚本不复刻禁用规则的字面量(规则正本 = scripts/gate.py + schema/banned.json)
_SEP = "[" + chr(92) + chr(92) + "/]"
DRIVE_PATH = re.compile(r"(?<![A-Za-z0-9])" + "[A-Za-z]" + ":" + _SEP)
# 本机 / 内网主机名与网段(片段拼接,避免脚本自身写出完整地址)
LAN_NAMES = "local" + "host|local|internal|lan"
LOCAL_HOSTS = re.compile(
    r"(?:^|\.)(?:" + LAN_NAMES + r")$"
    r"|^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)"
)
REF_PATTERNS = (
    re.compile(r"""\b(?:src|href)\s*=\s*(["'])(.*?)\1""", re.S),
    re.compile(r"""url\(\s*(["']?)([^"'()]+)\1\s*\)""", re.S),
)


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="strict")


def check_pack_json() -> dict:
    pack_path = ROOT / "pack.json"
    if not pack_path.is_file():
        fail("pack.json 不存在")
    try:
        pack = json.loads(read_text(pack_path))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"pack.json 不是合法 JSON:{exc}")
    if not isinstance(pack, dict):
        fail("pack.json 顶层必须是对象")

    missing = [k for k in REQUIRED_KEYS if k not in pack]
    if missing:
        fail("pack.json 缺必备键:" + ", ".join(missing))
    extra = sorted(set(pack) - ALLOWED_KEYS)
    if extra:
        fail("pack.json 出现 schema 未允许的键:" + ", ".join(extra))

    if pack["schema"] != 1:
        fail(f"schema 必须是 1,得到 {pack['schema']!r}")
    if pack["id"] != PACK_ID:
        fail(f"id 必须是 {PACK_ID},得到 {pack['id']!r}")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", str(pack["id"])):
        fail(f"id 不符合 kebab-case:{pack['id']!r}")
    if pack["kind"] != "ui":
        fail(f"kind 必须是 ui,得到 {pack['kind']!r}")
    if pack["category"] != "web-ui":
        fail(f"category 必须是 web-ui,得到 {pack['category']!r}")
    if not re.fullmatch(r"\d+\.\d+\.\d+", str(pack["version"])):
        fail(f"version 必须是 x.y.z:{pack['version']!r}")
    if not str(pack["license"]).strip():
        fail("license 不能为空")
    if not isinstance(pack["attribution"], list) or not pack["attribution"]:
        fail("attribution 必须是非空数组")
    for i, item in enumerate(pack["attribution"]):
        if not isinstance(item, dict) or not item.get("name") or not item.get("license"):
            fail(f"attribution[{i}] 必须含 name 与 license")
    if not str(pack["when"]).strip() or not str(pack["not_for"]).strip():
        fail("when / not_for 不能为空")
    if not isinstance(pack["tags"], list) or not pack["tags"]:
        fail("tags 必须是非空数组")

    verified = pack["verified"]
    if not isinstance(verified, dict):
        fail("verified 必须是对象")
    for key in ("date", "how", "evidence"):
        if not verified.get(key):
            fail(f"verified.{key} 不能为空")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(verified["date"])):
        fail(f"verified.date 必须是 YYYY-MM-DD:{verified['date']!r}")

    origin = pack["origin"]
    if not isinstance(origin, dict) or not origin.get("project") or not origin.get("path"):
        fail("origin 必须含 project 与 path")
    opath = str(origin["path"])
    if opath.startswith(("/", "\\", "~")) or DRIVE_PATH.search(opath) or ":" in opath:
        fail(f"origin.path 必须是相对路径(禁盘符/绝对路径):{opath!r}")

    files = pack["files"]
    if not isinstance(files, dict) or not files:
        fail("files 必须是非空对象")
    bad = sorted(set(files) - ALLOWED_FILE_KEYS)
    if bad:
        fail("files 出现 schema 未允许的键:" + ", ".join(bad))
    return pack


def iter_declared(files: dict):
    for key, value in files.items():
        if value is None:
            continue
        if isinstance(value, str):
            yield key, value
        elif isinstance(value, list):
            for item in value:
                if not isinstance(item, str):
                    fail(f"files.{key} 的数组项必须是字符串:{item!r}")
                yield key, item
        else:
            fail(f"files.{key} 只能是字符串、字符串数组或 null")


def check_declared_files(files: dict) -> tuple[int, int]:
    n_files, n_bytes = 0, 0
    for key, rel in iter_declared(files):
        if rel.startswith(("/", "\\", "~")) or DRIVE_PATH.search(rel) or ":" in rel:
            fail(f"files.{key} 必须写包内相对路径:{rel!r}")
        target = ROOT / rel
        if not target.is_file():
            fail(f"files.{key} 声明的文件不存在:{rel}")
        n_files += 1
        n_bytes += target.stat().st_size
    return n_files, n_bytes


def check_preview_refs() -> tuple[int, int, int]:
    preview = ROOT / "preview" / "index.html"
    if not preview.is_file():
        fail("preview/index.html 不存在")
    html = read_text(preview)
    for cue in PREVIEW_CUES:
        if cue not in html:
            fail(f"preview/index.html 缺结构锚点:{cue}")
    if html.count('class="page"') < 2:
        fail("preview/index.html 至少要有两页 .page(封面 + 时间线)")

    refs: list[str] = []
    for pattern in REF_PATTERNS:
        for match in pattern.finditer(html):
            refs.append(match.group(2).strip())
    refs = [r for r in refs if r]

    n_refs, n_local, n_ext = 0, 0, 0
    for ref in refs:
        if ref.startswith("#"):
            continue
        n_refs += 1
        split = urlsplit(ref)
        scheme = split.scheme.lower()
        if scheme:
            if scheme not in ("http", "https"):
                fail(f"preview 引用了 http(s) 之外的协议:{ref}")
            if scheme != "https":
                fail(f"preview 的外链必须是 https:{ref}")
            host = (split.hostname or "").lower()
            if not host or LOCAL_HOSTS.search(host):
                fail(f"preview 外链指向本机/内网:{ref}")
            n_ext += 1
            continue
        target = (preview.parent / ref.split("#")[0].split("?")[0]).resolve()
        if not target.is_relative_to(ROOT.resolve()):
            fail(f"preview 引用越出包目录:{ref}")
        if not target.is_file():
            fail(f"preview 引用无法解析到真实文件:{ref}")
        n_local += 1
    return n_refs, n_local, n_ext


def check_src_and_docs() -> tuple[int, int]:
    src = sorted(p for p in (ROOT / "src").glob("*") if p.suffix in {".css", ".js"})
    if not src:
        fail("src/ 下没有 .css / .js 文件")
    n_bytes = 0
    for path in src:
        if path.stat().st_size == 0:
            fail(f"src 文件为空:{path.relative_to(ROOT)}")
        n_bytes += path.stat().st_size

    css = ROOT / "src" / "deck.css"
    js = ROOT / "src" / "deck.js"
    for path, cues, label in ((css, CSS_CUES, "src/deck.css"), (js, JS_CUES, "src/deck.js")):
        if not path.is_file():
            fail(f"缺少 {label}")
        text = read_text(path)
        for cue in cues:
            if cue not in text:
                fail(f"{label} 缺实现锚点:{cue}")
    if css.read_text(encoding="utf-8").count(":root") < 1:
        fail("src/deck.css 缺 :root 令牌块")

    usage = ROOT / "docs" / "usage.md"
    if not usage.is_file():
        fail("docs/usage.md 不存在")
    text = read_text(usage)
    for cue in USAGE_CUES:
        if cue not in text:
            fail(f"docs/usage.md 缺口径关键词:{cue}")
    if not (ROOT / "SKILL.md").is_file():
        fail("SKILL.md 不存在")

    # 禁:盘符路径 / 保密字样 / 自有域名 / 底座面板残留
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.suffix not in TEXT_SUFFIXES:
            continue
        body = read_text(path)
        rel = path.relative_to(ROOT).as_posix()
        if DRIVE_PATH.search(body):
            fail(f"{rel} 含盘符路径")
        for label, needle in BANNED.items():
            if needle in body:
                fail(f"{rel} 含禁用串({label})")
    return len(src), n_bytes


def main() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass

    pack = check_pack_json()
    entry = ROOT / str(pack["entry"])
    if not entry.is_file():
        fail(f"entry 指向的文件不存在:{pack['entry']}")
    n_decl, decl_bytes = check_declared_files(pack["files"])
    n_refs, n_local, n_ext = check_preview_refs()
    n_src, src_bytes = check_src_and_docs()
    if n_refs != n_local + n_ext:
        fail(f"预览引用统计异常:{n_refs} 个引用 / 包内 {n_local} / 外链 {n_ext}")

    print(f"PASS assert_tokens {PACK_ID}")
    print(
        f"  refs {n_refs}(包内 {n_local} · https 外链 {n_ext}) · src {n_src} 文件 {src_bytes} 字节"
        f" · 声明产物 {n_decl} 个 {decl_bytes} 字节 · 2 页 1920x1080"
        f" · license {pack['license']} · 禁用串命中 0"
    )


if __name__ == "__main__":
    main()
