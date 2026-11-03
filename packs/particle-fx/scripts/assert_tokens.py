#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""particle-fx 断言:pack.json 必备键 / 六档「实现 ↔ 参数 ↔ 预览」三者对齐 / 版本常量 + sha256 /
params.json 与实现读的键一致 / 预览页相对引用全部落在本包内(外链只允许 https://)。

说明:本断言**不复制** gate 的禁用形态规则(内网域名 / 盘符路径 / 隧道域名等一律交给
scripts/gate.py 的规则表判定)—— 规则字面量写进源码会自伤。

用法:python scripts/assert_tokens.py。退出 0 时打印一行 `PASS assert_tokens particle-fx`。
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK_ID = "particle-fx"
SCHEMA_PATH = Path(__file__).resolve().parents[3] / "schema" / "pack.schema.json"
REQUIRED_KEYS = (
    "schema", "id", "title", "kind", "category", "version", "license",
    "attribution", "origin", "entry", "files", "tags", "when", "not_for", "verified",
)
ABS_PATH_RE = re.compile("^([A-Za-z]:" + chr(92) + "|" + chr(92) + chr(92) + "|/)")
ALLOWED_FIELD_TYPES = {"range", "number", "select", "checkbox", "swatch", "text"}

# entry id → 实现文件(相对 src/);这是本包「条目 id 与 src/ 子目录一致」的对照表。
ENTRIES = {
    "text-push": "concepts/text-push.js",
    "starfield": "concepts/starfield.js",
    "galaxy": "concepts/galaxy.js",
    "curl": "concepts/curl.js",
    "scroll-morph": "concepts/scroll-morph.js",
    "void-audio": "concepts/void-audio.js",
}
OPTIONAL_ENTRIES = {"void-audio"}
# 面板副本必须与 fx-engines 同版本(改面板请改 fx-engines 再整份替换)。
PINNED_PANEL_VERSION = "2.0.0"

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
    for key in ("src", "css"):
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


def check_entries() -> tuple[int, list[str]]:
    ids = []
    for entry, impl in ENTRIES.items():
        if not (ROOT / "src" / impl).is_file():
            fail(f"entry {entry} 的实现文件不存在:src/{impl}")
        if not (ROOT / "effects" / entry / "params.json").is_file():
            fail(f"entry {entry} 缺 effects/{entry}/params.json")
        if not (ROOT / "preview" / f"{entry}.html").is_file():
            fail(f"entry {entry} 缺 preview/{entry}.html(每档一个预览页)")
        text = (ROOT / "preview" / f"{entry}.html").read_text(encoding="utf-8")
        if f"concepts/{entry}.js" not in text:
            fail(f"preview/{entry}.html 没有引用 src/concepts/{entry}.js")
        ids.append(entry)
    # effects/ 下不许有对不上 entry 的目录
    for child in sorted((ROOT / "effects").iterdir()):
        if child.is_dir() and child.name not in ENTRIES:
            fail(f"effects/{child.name} 不对应任何 entry id(禁孤儿参数)")
    # 每个 concept 文件都要被 entry 表点到
    seen = {Path(p).name for p in ENTRIES.values()}
    for concept in sorted((ROOT / "src" / "concepts").glob("*.js")):
        if concept.name not in seen and concept.name != "void-fx.js":
            fail(f"src/concepts/{concept.name} 没有被任何 entry 引用")
    return len(ids), ids


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
    for rel, name in (
        ("src/particle-motions.js", "PARTICLE_MOTIONS_VERSION"),
        ("src/concepts/void-fx.js", "VOID_FX_VERSION"),
        ("src/param-panel.js", "PARAM_PANEL_VERSION"),
    ):
        if rel not in found:
            fail(f"versions.json 必须登记 {rel}")
        if js_const(rel, name) != found[rel]:
            fail(f"{rel} 的 {name} 与 versions.json 不一致(应为 {found[rel]})")
    if found.get("src/param-panel.js") != PINNED_PANEL_VERSION:
        fail(
            "param-panel 副本版本必须是 "
            f"{PINNED_PANEL_VERSION}(与 packs/fx-engines 同版本),实为 {found.get('src/param-panel.js')}"
        )
    return found


def check_params() -> tuple[int, int]:
    fields = 0
    default_keys = 0
    for entry in ENTRIES:
        data = read_json(f"effects/{entry}/params.json")
        for key in ("slug", "defaults", "schema"):
            if key not in data:
                fail(f"effects/{entry}/params.json 缺 {key}")
        if data["slug"] != entry:
            fail(f"effects/{entry}/params.json:slug {data['slug']} 与目录名不一致")
        schema_keys = []
        for field in data["schema"]:
            for key in ("key", "label", "type"):
                if key not in field:
                    fail(f"{entry} 字段缺 {key}:{field}")
            if field["type"] not in ALLOWED_FIELD_TYPES:
                fail(f"{entry} 用了不允许的 field type:{field['type']}(颜色请用 swatch)")
            if field["type"] == "swatch" and not field.get("swatches"):
                fail(f"{entry} 的 swatch 字段 {field['key']} 缺 swatches 色板")
            schema_keys.append(field["key"])
            fields += 1
        missing = [k for k in data["defaults"] if k not in schema_keys]
        if missing:
            fail(f"{entry} defaults 里有 schema 没暴露的键(死参数):{missing}")
        extra = [k for k in schema_keys if k not in data["defaults"]]
        if extra:
            fail(f"{entry} schema 里有 defaults 缺省值的键:{extra}")
        default_keys += len(data["defaults"])
    return fields, default_keys


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
    for cue in ("音源", "麦克风", "降级", "假频谱", "schema", "验版本", "sha256", "反模式", "swatch"):
        if cue not in usage:
            fail(f"docs/usage.md 缺小节/关键词:{cue}")
    skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")
    for cue in ("When to use", "When not to use", "Files", "Agent apply steps", "Hard rules"):
        if cue not in skill:
            fail(f"SKILL.md 缺小节:{cue}")
    if len((ROOT / "README.md").read_text(encoding="utf-8")) < 400:
        fail("README.md 太短")
    for entry in OPTIONAL_ENTRIES:
        if entry not in (ROOT / "docs" / "usage.md").read_text(encoding="utf-8"):
            fail(f"docs/usage.md 没写到可选 entry:{entry}")


def main() -> None:
    pack = check_pack_json()
    count, ids = check_entries()
    versions = check_versions()
    fields, defaults = check_params()
    internal, external = check_preview_refs()
    check_docs()
    if pack["files"]["preview"] != "preview/index.html":
        fail("files.preview 必须指向 preview/index.html")
    print(f"PASS assert_tokens {PACK_ID}")
    print(f"  entries: {count} 档({' · '.join(ids)})· 实现↔参数↔预览 三者对齐")
    print(
        f"  versions: particle-motions {versions.get('src/particle-motions.js')} · "
        f"void-fx {versions.get('src/concepts/void-fx.js')} · "
        f"param-panel {versions.get('src/param-panel.js')}(= fx-engines)· sha256 {len(versions)} 个文件"
    )
    print(f"  params: {fields} 个字段 / {defaults} 个默认值(无死参数、无缺省键)· 预览引用 {internal} 个包内 / {external} 个外链")


if __name__ == "__main__":
    main()
