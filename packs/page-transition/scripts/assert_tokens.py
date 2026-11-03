#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""page-transition 断言:pack.json 必备键 / 三档「实现 ↔ 参数 ↔ 预览」对齐 / 版本常量 + sha256 /
three vendor 头与版本 / params.json 与实现读的键一致 / 预览页相对引用全部落在本包内(外链只允许 https://)。

说明:本断言**不复制** gate 的禁用形态规则(内网域名 / 盘符路径 / 隧道域名等一律交给
scripts/gate.py 的规则表判定)—— 规则字面量写进源码会自伤。

用法:python scripts/assert_tokens.py。退出 0 时打印一行 `PASS assert_tokens page-transition`。
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK_ID = "page-transition"
SCHEMA_PATH = Path(__file__).resolve().parents[3] / "schema" / "pack.schema.json"
REQUIRED_KEYS = (
    "schema", "id", "title", "kind", "category", "version", "license",
    "attribution", "origin", "entry", "files", "tags", "when", "not_for", "verified",
)
ABS_PATH_RE = re.compile("^([A-Za-z]:" + chr(92) + "|" + chr(92) + chr(92) + "|/)")
ALLOWED_FIELD_TYPES = {"range", "number", "select", "checkbox", "swatch", "text"}

# 档 → (实现文件(相对 src/), 预览页(相对 preview/))
ENTRIES = {
    "vt-layer": (["vt-layer.css", "bg-boot.js", "starfield-bg.js"], ["vt-a.html", "vt-b.html"]),
    "section-travel": (["section-travel.js", "section-travel.css"], ["section-travel.html"]),
    "text-three": (["text-three.js", "text-three.css"], ["text-three.html"]),
}
PINNED_PANEL_VERSION = "2.0.0"
THREE_REL = "upstream/three.module.js"
THREE_REVISION = "'170'"

ATTR_RE = re.compile(r"""(?:src|href)\s*=\s*["']([^"']+)["']""", re.I)
URLFN_RE = re.compile(r"""(?<![\w-])url\(\s*(['"]?)([^)'"]+)\1\s*\)""", re.I)


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def read_json(rel: str):
    path = ROOT / rel
    if not path.is_file():
        fail(f"missing {rel}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"{rel} 不是合法 JSON:{exc}")


def sha256(rel: str) -> str:
    return hashlib.sha256((ROOT / rel).read_bytes()).hexdigest()


def js_const(rel: str, name: str) -> str:
    text = (ROOT / rel).read_text(encoding="utf-8")
    m = re.search(rf"export const {name}\s*=\s*'([^']+)'", text)
    if not m:
        fail(f"{rel} 缺少版本常量 {name}")
    return m.group(1)


def check_pack_json() -> dict:
    pack = read_json("pack.json")
    for key in REQUIRED_KEYS:
        if key not in pack:
            fail(f"pack.json missing required key: {key}")
    if pack["id"] != PACK_ID:
        fail(f"pack.json id 应为 {PACK_ID},实为 {pack['id']}")
    if pack["kind"] != "fx":
        fail(f"kind 应为 fx,实为 {pack['kind']}")
    if pack["category"] != "web-fx":
        fail(f"category 应为 web-fx,实为 {pack['category']}")
    if ABS_PATH_RE.match(str(pack["origin"].get("path", ""))):
        fail(f"origin.path 必须是相对路径:{pack['origin'].get('path')}")
    for key in ("src", "css", "upstream"):
        for rel in pack["files"].get(key, []):
            if not (ROOT / rel).is_file():
                fail(f"files.{key} 列出的文件不存在:{rel}")
    for key in ("usage", "assert", "preview"):
        rel = pack["files"].get(key)
        if not rel or not (ROOT / rel).is_file():
            fail(f"files.{key} 缺失或指向不存在的文件:{rel}")
    if not (ROOT / pack["entry"]).is_file():
        fail(f"entry 指向的文件不存在:{pack['entry']}")
    if SCHEMA_PATH.is_file():
        schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
        for key in schema.get("required", []):
            if key not in pack:
                fail(f"pack.json 缺少 schema 必填键:{key}")
    return pack


def check_entries() -> int:
    declared = set()
    for entry, (impls, previews) in ENTRIES.items():
        for impl in impls:
            rel = f"src/{impl}"
            declared.add(impl)
            if not (ROOT / rel).is_file():
                fail(f"档 {entry} 的实现文件不存在:{rel}")
        if not (ROOT / "effects" / entry / "params.json").is_file():
            fail(f"档 {entry} 缺 effects/{entry}/params.json")
        for page in previews:
            rel = ROOT / "preview" / page
            if not rel.is_file():
                fail(f"档 {entry} 缺预览页 preview/{page}")
            text = rel.read_text(encoding="utf-8")
            if not any(impl in text for impl in impls):
                fail(f"preview/{page} 没有引用档 {entry} 的任何实现文件 {impls}")
    for child in sorted((ROOT / "effects").iterdir()):
        if child.is_dir() and child.name not in ENTRIES:
            fail(f"effects/{child.name} 不对应任何档(禁孤儿参数)")
    for js in sorted((ROOT / "src").glob("*.js")):
        if js.name in declared or js.name in {"lab-boot.js", "param-panel.js"}:
            continue
        fail(f"src/{js.name} 既不是档实现也不是共用件(禁无主文件)")
    return len(ENTRIES)


def check_versions() -> dict:
    versions = read_json("src/versions.json")
    entries = versions.get("files") or []
    if not entries:
        fail("src/versions.json 缺少 files[]")
    found = {}
    for entry in entries:
        for key in ("file", "version", "sha256", "license", "source"):
            if key not in entry:
                fail(f"src/versions.json 条目缺字段 {key}:{entry}")
        rel = entry["file"]
        if not (ROOT / rel).is_file():
            fail(f"versions.json 声明的文件不存在:{rel}")
        actual = sha256(rel)
        if actual != entry["sha256"]:
            fail(f"{rel} 内容已变(sha256 {actual[:12]} ≠ 记录 {entry['sha256'][:12]})——改了就抬版本并更新 versions.json")
        found[rel] = entry["version"]
    if found.get("src/param-panel.js") != PINNED_PANEL_VERSION:
        fail(f"param-panel 副本版本必须是 {PINNED_PANEL_VERSION}(与 fx-engines 同版本)")
    if js_const("src/param-panel.js", "PARAM_PANEL_VERSION") != PINNED_PANEL_VERSION:
        fail("PARAM_PANEL_VERSION 常量与 pin 的版本不一致")
    if THREE_REL not in found:
        fail(f"versions.json 必须登记 {THREE_REL}(three 也要有版本与 sha256)")
    three = (ROOT / THREE_REL).read_text(encoding="utf-8", errors="replace")
    if "SPDX-License-Identifier: MIT" not in three[:400]:
        fail(f"{THREE_REL} 头部缺少 SPDX MIT 声明(第三方 vendored 文件必须保留许可头)")
    if THREE_REVISION not in three[:900]:
        fail(f"{THREE_REL} 的 REVISION 不是 {THREE_REVISION}(升级要同步 versions.json)")
    return found


def check_params() -> tuple[int, int]:
    fields = 0
    defaults = 0
    for entry in ENTRIES:
        data = read_json(f"effects/{entry}/params.json")
        for key in ("slug", "defaults", "schema"):
            if key not in data:
                fail(f"effects/{entry}/params.json 缺 {key}")
        if data["slug"] != entry:
            fail(f"effects/{entry}/params.json:slug {data['slug']} 与目录名不一致")
        keys = []
        for field in data["schema"]:
            for key in ("key", "label", "type"):
                if key not in field:
                    fail(f"{entry} 字段缺 {key}:{field}")
            if field["type"] not in ALLOWED_FIELD_TYPES:
                fail(f"{entry} 用了不允许的 field type:{field['type']}")
            if field["type"] == "swatch" and not field.get("swatches"):
                fail(f"{entry} 的 swatch 字段 {field['key']} 缺 swatches 色板")
            if field["type"] == "select" and not field.get("options"):
                fail(f"{entry} 的 select 字段 {field['key']} 缺 options")
            keys.append(field["key"])
            fields += 1
        missing = [k for k in data["defaults"] if k not in keys]
        if missing:
            fail(f"{entry} defaults 里有 schema 没暴露的键:{missing}")
        extra = [k for k in keys if k not in data["defaults"]]
        if extra:
            fail(f"{entry} schema 里有 defaults 缺省值的键:{extra}")
        defaults += len(data["defaults"])
    return fields, defaults


def check_preview_refs() -> tuple[int, int]:
    pages = sorted((ROOT / "preview").glob("*.html"))
    if not pages:
        fail("preview/ 下没有 html")
    internal = 0
    external = 0
    for page in pages:
        text = page.read_text(encoding="utf-8")
        for ref in ATTR_RE.findall(text) + [m[1] for m in URLFN_RE.findall(text)]:
            ref = ref.strip()
            if not ref or ref.startswith(("#", "data:", "mailto:", "javascript:")):
                continue
            if ref.startswith("//"):
                fail(f"{page.name}: 协议相对引用不允许:{ref}")
            if ref.startswith("http://"):
                fail(f"{page.name}: 外链只允许 https://:{ref}")
            if ref.startswith("https://"):
                external += 1
                continue
            target = (page.parent / ref.split("#", 1)[0].split("?", 1)[0]).resolve()
            try:
                target.relative_to(ROOT.resolve())
            except ValueError:
                fail(f"{page.name}: 引用越出本包:{ref}")
            if not target.is_file():
                fail(f"{page.name}: 引用在本包内解析不到真实文件:{ref}")
            internal += 1
    return internal, external


def check_docs() -> None:
    usage = (ROOT / "docs" / "usage.md").read_text(encoding="utf-8")
    for cue in ("何时用哪一档", "原生", "DOM", "粒子", "schema", "验版本", "sha256", "反模式", "prefers-reduced-motion"):
        if cue not in usage:
            fail(f"docs/usage.md 缺小节/关键词:{cue}")
    skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")
    for cue in ("When to use", "When not to use", "Files", "Agent apply steps", "Hard rules"):
        if cue not in skill:
            fail(f"SKILL.md 缺小节:{cue}")
    if len((ROOT / "README.md").read_text(encoding="utf-8")) < 400:
        fail("README.md 太短")


def main() -> None:
    pack = check_pack_json()
    count = check_entries()
    versions = check_versions()
    fields, defaults = check_params()
    internal, external = check_preview_refs()
    check_docs()
    if pack["files"]["preview"] != "preview/index.html":
        fail("files.preview 必须指向 preview/index.html")
    print(f"PASS assert_tokens {PACK_ID}")
    print(f"  entries: {count} 档(vt-layer / section-travel / text-three)· 实现↔参数↔预览 三者对齐")
    print(
        f"  versions: param-panel {versions.get('src/param-panel.js')}(= fx-engines)· "
        f"three {versions.get(THREE_REL)}(SPDX 头完整)· sha256 {len(versions)} 个文件"
    )
    print(f"  params: {fields} 个字段 / {defaults} 个默认值 · 预览引用 {internal} 个包内 / {external} 个外链")


if __name__ == "__main__":
    main()
