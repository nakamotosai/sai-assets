#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""three-fx 断言:pack.json 必备键 / files.* 路径存在 / 预览相对引用可解析 /
effect id 与 src 模块一致 / upstream three.js 只此一份且保留 SPDX 头 /
页面与模块的 DOM 契约(挂载点、内联着色器 id)。内容层禁用形态由 scripts/gate.py 负责。

退出 0 = 通过,并打印 `PASS assert_tokens three-fx`。只用标准库,不联网。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PACK_ID = "three-fx"
ROOT = Path(__file__).resolve().parents[1]          # packs/three-fx
REPO = ROOT.parents[1]                              # repo root

REQUIRED_KEYS = ("schema", "id", "title", "kind", "category", "version",
                 "license", "attribution", "origin", "entry", "files",
                 "tags", "when", "not_for", "verified")
SEMVER = re.compile(r"^\d+\.\d+\.\d+$")

REF_ATTR = re.compile(r"""(?:src|href)\s*=\s*["']([^"']+)["']""")
CSS_URL = re.compile(r"""url\(\s*["']?([^"')]+)["']?\s*\)""")
JS_IMPORT = re.compile(r"""(?:from|import)\s*["']([^"']+)["']""")

SCAN_EXT = {".html", ".css", ".js"}
SKIP_DIRS = {"upstream"}                            # 第三方 vendored 整块跳过(与 gate 同口径)

# effect 目录 id → src 模块 + 预览页必须引用的模块路径
EFFECTS = {
    "blackhole-waves": "src/blackhole-waves.js",
    "blackhole-particles": "src/blackhole-particles.js",
}

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
        print("FAIL assert_tokens three-fx: 缺 pack.json", file=sys.stderr)
        return 1

    # 1 · pack.json
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
        fail("license 须写明(自产 + 上游)")
    elif "MIT" not in str(meta["license"]):
        fail("license 须写清上游 three.js 的 MIT")
    attrs = meta.get("attribution") or []
    if not isinstance(attrs, list) or not attrs:
        fail("attribution 须为非空数组")
    else:
        if any(not isinstance(a, dict) or not a.get("name") or not a.get("license") for a in attrs):
            fail("attribution 每项须含 name 与 license")
        if not any("three" in str(a.get("name", "")).lower() for a in attrs):
            fail("attribution 必须登记 three.js")
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
    for key in ("when", "not_for"):
        if len(str(meta.get(key, ""))) < 8:
            fail(f"{key} 须写清适用/禁忌")
    if not meta.get("tags"):
        fail("tags 至少一个")

    files = meta.get("files") or {}
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
    if files.get("upstream") != ["upstream/three.module.js"]:
        fail(f"files.upstream 须为 ['upstream/three.module.js'],实为 {files.get('upstream')!r}")

    # 2 · 相对引用(vendored upstream 整块跳过,与 gate 同口径)
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SCAN_EXT:
            continue
        if SKIP_DIRS.intersection(path.relative_to(ROOT).parts[:-1]):
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
                fail(f"{rel_file}: 引用含模板占位 {ref!r}")
                continue
            check_ref(ref, path.parent, rel_file)

    # 3 · effect id ↔ src 模块 ↔ 预览页
    eff_dirs = sorted(p.name for p in (ROOT / "effects").iterdir() if p.is_dir())
    if eff_dirs != sorted(EFFECTS):
        fail(f"effects/ 目录须为 {sorted(EFFECTS)},实为 {eff_dirs}")
    wall = (ROOT / "preview" / "index.html").read_text(encoding="utf-8")
    if "<iframe" in wall.lower():
        fail("preview/index.html 不许内嵌 iframe")
    for cid, module in EFFECTS.items():
        module_path = ROOT / module
        if not module_path.is_file():
            fail(f"缺效果模块 {module}")
        page_path = ROOT / "effects" / cid / "index.html"
        if not page_path.is_file():
            fail(f"缺 {page_path.relative_to(REPO).as_posix()}")
            continue
        page = page_path.read_text(encoding="utf-8")
        rel_module = "../../" + module
        if rel_module not in page:
            fail(f"effects/{cid}/index.html 未相对引用 {rel_module}")
        if f"../effects/{cid}/index.html" not in wall:
            fail(f"preview/index.html 没有链到 effects/{cid}/index.html")
        if not (ROOT / "effects" / cid / "params.json").is_file():
            fail(f"缺 effects/{cid}/params.json")

    # 4 · 渲染器契约(页面提供模块要的 DOM 与内联着色器)
    waves_src = (ROOT / "src" / "blackhole-waves.js").read_text(encoding="utf-8")
    if "from '../upstream/three.module.js'" not in waves_src:
        fail("src/blackhole-waves.js 必须 import '../upstream/three.module.js'")
    if re.search(r"""from\s+['"]three['"]""", waves_src):
        fail("src/blackhole-waves.js 出现了裸模块名 'three'(本包不做 importmap)")
    waves_page = (ROOT / "effects" / "blackhole-waves" / "index.html").read_text(encoding="utf-8")
    for dom_id in ("magic", "hud", "pt-vert", "pt-frag"):
        if f'id="{dom_id}"' not in waves_page:
            fail(f"effects/blackhole-waves/index.html 缺 id={dom_id!r}(模块按 id 取)")
    parts_page = (ROOT / "effects" / "blackhole-particles" / "index.html").read_text(encoding="utf-8")
    for dom_id in ("stage", "hud"):
        if f'id="{dom_id}"' not in parts_page:
            fail(f"effects/blackhole-particles/index.html 缺 id={dom_id!r}(模块按 id 取)")
    parts_src = (ROOT / "src" / "blackhole-particles.js").read_text(encoding="utf-8")
    if "卡冈图亚" in parts_src or "星际穿越" in parts_src:
        fail("src/blackhole-particles.js 残留影片/角色名样式键")
    # 样式键必须与 params.json 的 select options 对齐
    pj = read_json(ROOT / "effects" / "blackhole-particles" / "params.json") or {}
    opts = next((s.get("options") for s in pj.get("schema", []) if s.get("key") == "style"), None)
    if not opts:
        fail("effects/blackhole-particles/params.json 缺 style.options")
    else:
        for name in opts:
            if f'"{name}"' not in parts_src:
                fail(f"样式选项 {name!r} 在 src/blackhole-particles.js 的 STYLE_TABLE 里找不到")
        if pj.get("defaults", {}).get("style") not in opts:
            fail("effects/blackhole-particles/params.json 的 defaults.style 不在 options 里")
    if pj.get("slug") != "blackhole-particles":
        fail(f"effects/blackhole-particles/params.json slug 须为 'blackhole-particles',实为 {pj.get('slug')!r}")
    pjw = read_json(ROOT / "effects" / "blackhole-waves" / "params.json") or {}
    if pjw.get("slug") != "blackhole-waves":
        fail(f"effects/blackhole-waves/params.json slug 须为 'blackhole-waves',实为 {pjw.get('slug')!r}")
    if 'themelab.blackhole-waves.params' not in waves_src:
        fail("src/blackhole-waves.js 的面板缓存键须与新 slug 一致")

    # 5 · upstream three.js 只此一份 + SPDX 头
    three_copies = [p for p in ROOT.rglob("*") if p.is_file() and p.name.startswith("three") and p.suffix == ".js"]
    if three_copies != [ROOT / "upstream" / "three.module.js"]:
        fail(f"three.js 必须只此一份且在 upstream/,实测:{[p.relative_to(ROOT).as_posix() for p in three_copies]}")
    upstream = ROOT / "upstream" / "three.module.js"
    if upstream.is_file():
        head = upstream.read_text(encoding="utf-8", errors="replace")[:400]
        for token in ("@license", "Copyright", "SPDX-License-Identifier: MIT"):
            if token not in head:
                fail(f"upstream/three.module.js 头部缺 {token!r}(SPDX 头必须原样保留)")
    # 6 · 文档
    usage = ROOT / "docs" / "usage.md"
    if not usage.is_file():
        fail("缺 docs/usage.md")
    else:
        utext = usage.read_text(encoding="utf-8")
        for heading in ("## 取用", "## 参数", "## 性能", "## 无障碍", "## 反模式"):
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

    notes.append(f"upstream/three.module.js {upstream.stat().st_size}B(1 份,SPDX 头在)")
    for cid, module in EFFECTS.items():
        notes.append(f"{cid}: {module} {(ROOT / module).stat().st_size}B + params.json {(ROOT / 'effects' / cid / 'params.json').stat().st_size}B")
    notes.append(f"effects {len(eff_dirs)} 个;相对引用全部解析到包内真实文件;HTTPS 外链 0 条")
    notes.append("内容层禁用形态交给 scripts/gate.py(规则正本),本断言不复刻")
    for line in notes:
        print(f"  {line}")
    print(f"PASS assert_tokens {PACK_ID}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
