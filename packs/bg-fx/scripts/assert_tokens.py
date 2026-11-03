#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""bg-fx 断言:pack.json 必备键 / files.* 路径存在 / 预览相对引用可解析 /
effect id 与 src/concepts 一致 / 共享 engine.js 只此一份。内容层禁用形态由 scripts/gate.py 负责。

退出 0 = 通过,并打印 `PASS assert_tokens bg-fx`。只用标准库,不联网。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PACK_ID = "bg-fx"
ROOT = Path(__file__).resolve().parents[1]          # packs/bg-fx
REPO = ROOT.parents[1]                              # repo root

REQUIRED_KEYS = ("schema", "id", "title", "kind", "category", "version",
                 "license", "attribution", "origin", "entry", "files",
                 "tags", "when", "not_for", "verified")
SEMVER = re.compile(r"^\d+\.\d+\.\d+$")

REF_ATTR = re.compile(r"""(?:src|href)\s*=\s*["']([^"']+)["']""")
CSS_URL = re.compile(r"""url\(\s*["']?([^"')]+)["']?\s*\)""")
JS_IMPORT = re.compile(r"""(?:from|import)\s*["']([^"']+)["']""")

SCAN_EXT = {".html", ".css", ".js"}

# 内容层的禁用形态不在这里复刻:正本是 scripts/gate.py + schema/banned.json
# (在断言里重写一遍规则,既会漂移,也可能让规则字面量把本文件自己判红)。

problems: list[str] = []
notes: list[str] = []


def fail(msg: str) -> None:
    problems.append(msg)


def read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"读不了 {path.relative_to(REPO).as_posix()}:{exc}")
        return None


def check_ref(ref: str, base: Path, rel_file: str) -> None:
    ref = ref.strip()
    if not ref or ref.startswith("#") or ref.startswith("data:") or ref.startswith("mailto:"):
        return
    if re.match(r"^[A-Za-z][A-Za-z0-9+.\-]*:", ref) or ref.startswith("//"):
        if not ref.startswith("https://"):
            fail(f"{rel_file}: 外链只允许 https://,实为 {ref!r}")
        elif re.search(r"//(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)", ref):
            fail(f"{rel_file}: 外链指向内网地址 {ref!r}")
        return
    target = (base / ref.split("?")[0].split("#")[0]).resolve()
    if ROOT.resolve() not in target.parents and target != ROOT.resolve():
        fail(f"{rel_file}: 相对引用越出包外 {ref!r}")
    elif not target.is_file():
        fail(f"{rel_file}: 相对引用解析不到真实文件 {ref!r}")


def main() -> int:
    pack_json = ROOT / "pack.json"
    if not pack_json.is_file():
        print("FAIL assert_tokens bg-fx: 缺 pack.json", file=sys.stderr)
        return 1

    # 1 · pack.json 必备键与取值
    meta = read_json(pack_json) or {}
    for key in REQUIRED_KEYS:
        if key not in meta:
            fail(f"pack.json 缺必填键 {key!r}")
    if meta.get("schema") != 1:
        fail("pack.json schema 必须为 1")
    if meta.get("id") != PACK_ID:
        fail(f"pack.json id 须为 {PACK_ID!r},实为 {meta.get('id')!r}")
    if meta.get("kind") != "fx":
        fail(f"kind 须为 'fx',实为 {meta.get('kind')!r}")
    if meta.get("category") != "web-fx":
        fail(f"category 须为 'web-fx',实为 {meta.get('category')!r}")
    if not SEMVER.match(str(meta.get("version", ""))):
        fail(f"version 须为 x.y.z,实为 {meta.get('version')!r}")
    if len(str(meta.get("license", ""))) < 2:
        fail("license 须写明(自产 + 上游 attribution)")
    attrs = meta.get("attribution")
    if not isinstance(attrs, list):
        fail("attribution 须为数组")
    elif any(not isinstance(a, dict) or not a.get("name") or not a.get("license") for a in attrs):
        fail("attribution 每项须含 name 与 license")
    origin = meta.get("origin") or {}
    opath = str(origin.get("path", ""))
    if not opath:
        fail("origin.path 必填")
    elif re.match(r"^([A-Za-z]:|/|\\\\)", opath):
        fail(f"origin.path 必须是相对路径,实为 {opath!r}")
    verified = meta.get("verified") or {}
    for key in ("date", "how", "evidence"):
        if not verified.get(key):
            fail(f"verified.{key} 必填(必须贴实测输出)")
    if not meta.get("tags"):
        fail("tags 至少一个(须含 webgl2/postfx)")
    else:
        for want in ("webgl2", "postfx"):
            if want not in meta["tags"]:
                fail(f"tags 缺少 {want!r}")
    for key in ("when", "not_for"):
        if len(str(meta.get(key, ""))) < 8:
            fail(f"{key} 须写清适用/禁忌(现 {len(str(meta.get(key, '')))} 字)")

    files = meta.get("files") or {}
    src_list = files.get("src")
    if not isinstance(src_list, list) or not src_list:
        fail("files.src 须列清共享引擎 / concepts / 参数")

    # 2 · files.* 声明的路径都存在
    declared: list[str] = []
    for key, value in files.items():
        if isinstance(value, str):
            declared.append(value)
        elif isinstance(value, list):
            declared.extend(value)
        elif value is not None:
            fail(f"files.{key} 类型不合法:{type(value).__name__}")
    for rel in declared:
        if not (ROOT / rel).is_file():
            fail(f"files 声明的路径不存在:{rel}")

    # 3 · 每条相对引用都要能在本包内解析到真实文件
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SCAN_EXT:
            continue
        rel_file = path.relative_to(REPO).as_posix()
        text = path.read_text(encoding="utf-8", errors="replace")
        refs = set(REF_ATTR.findall(text))
        if path.suffix.lower() == ".css":
            refs |= set(CSS_URL.findall(text))
        if path.suffix.lower() in {".js", ".html"}:
            refs |= set(JS_IMPORT.findall(text))
        for ref in refs:
            if "${" in ref:
                fail(f"{rel_file}: 引用含模板占位 {ref!r}(断言读不出真实目标)")
                continue
            check_ref(ref, path.parent, rel_file)

    # 4 · effect id 与 src/concepts/<id>.js 一一对应
    eff_dirs = sorted(p.name for p in (ROOT / "effects").iterdir() if p.is_dir())
    concepts = sorted(p.stem for p in (ROOT / "src" / "concepts").glob("*.js") if p.stem != "common")
    if eff_dirs != concepts:
        fail(f"effects/ 目录与 src/concepts/ 不一致:effects={eff_dirs} concepts={concepts}")
    if len(eff_dirs) != 10:
        fail(f"effects/ 须有 10 个效果,实为 {len(eff_dirs)}")
    for cid in eff_dirs:
        for rel in (f"effects/{cid}/index.html", f"effects/{cid}/params.json"):
            if not (ROOT / rel).is_file():
                fail(f"缺产物 {rel}")
        page = (ROOT / "effects" / cid / "index.html").read_text(encoding="utf-8")
        for want in (f"../../src/concepts/{cid}.js", "../../src/engine.js"):
            if want not in page:
                fail(f"effects/{cid}/index.html 未相对引用 {want}")
        if f"../effects/{cid}/index.html" not in (ROOT / "preview" / "index.html").read_text(encoding="utf-8"):
            fail(f"preview/index.html 没有链到 effects/{cid}/index.html")
    if "<iframe" in (ROOT / "preview" / "index.html").read_text(encoding="utf-8").lower():
        fail("preview/index.html 不许内嵌 iframe")

    # 5 · 共享引擎只有一份
    engines = [p for p in ROOT.rglob("engine.js")]
    if len(engines) != 1 or engines[0] != ROOT / "src" / "engine.js":
        fail(f"engine.js 必须只留一份且在 src/,实测:{[p.relative_to(ROOT).as_posix() for p in engines]}")
    elif not (ROOT / "src" / "engine.js").read_text(encoding="utf-8").startswith("// engine.js"):
        fail("src/engine.js 首行丢失(引擎头注释被改过)")

    # 6 · params.json 结构
    for cid in eff_dirs:
        pj = read_json(ROOT / "effects" / cid / "params.json")
        if not pj:
            continue
        if pj.get("slug") != cid:
            fail(f"effects/{cid}/params.json 的 slug 应为 {cid!r},实为 {pj.get('slug')!r}")
        for key in ("speed", "bloom", "grain", "exposure", "ca", "vig"):
            if key not in (pj.get("defaults") or {}):
                fail(f"effects/{cid}/params.json defaults 缺 {key!r}")
            if not any(s.get("key") == key for s in (pj.get("schema") or [])):
                fail(f"effects/{cid}/params.json schema 缺 {key!r}")

    # 7 · 文档小节
    usage = (ROOT / "docs" / "usage.md")
    if not usage.is_file():
        fail("缺 docs/usage.md")
    else:
        utext = usage.read_text(encoding="utf-8")
        for heading in ("## 反模式", "## 性能", "## 无障碍", "## 参数"):
            if heading not in utext:
                fail(f"docs/usage.md 缺小节 {heading!r}")
    for doc in ("SKILL.md", "README.md"):
        if not (ROOT / doc).is_file():
            fail(f"缺 {doc}")

    if problems:
        print(f"FAIL assert_tokens {PACK_ID}: {len(problems)} 项", file=sys.stderr)
        for msg in problems:
            print(f"  - {msg}", file=sys.stderr)
        return 1

    engine_bytes = (ROOT / "src" / "engine.js").stat().st_size
    concept_bytes = sum(p.stat().st_size for p in (ROOT / "src" / "concepts").glob("*.js"))
    notes.append(f"engine.js {engine_bytes}B(1 份) · concepts {len(concepts)} + common 共 {concept_bytes}B")
    notes.append(f"effects {len(eff_dirs)} 个,每个 index.html + params.json")
    notes.append("相对引用全部解析到包内真实文件;HTTP(S) 外链 0 条")
    notes.append("内容层禁用形态交给 scripts/gate.py(规则正本),本断言不复刻")
    for line in notes:
        print(f"  {line}")
    print(f"PASS assert_tokens {PACK_ID}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
