#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""nav-rail-marquee 断言:元数据 / 声明路径 / 预览引用解析 / 产物非空 / 文档与实现标记。

禁用内容形态的判定属于仓级 scripts/gate.py(规则正本),本脚本刻意不复刻那些规则 ——
规则字面量写进源码本身就会成为被禁形态的载体,也会造成第二套口径。

通过 = 打印 "PASS assert_tokens nav-rail-marquee" + 实测摘要,退出 0;
失败 = 把 FAIL 原因打到 stderr,退出 1。仅用标准库,Python 3.14。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # packs/nav-rail-marquee
PACK_ID = "nav-rail-marquee"

REQUIRED_KEYS = (
    "schema", "id", "title", "kind", "category", "version", "license", "attribution",
    "origin", "entry", "files", "tags", "when", "not_for", "verified",
)

# docs/usage.md 里必须逐字出现的关键词(改文档别忘了同步这里)
DOC_CUES = (
    "## 什么时候用",
    "## 接入步骤",
    "## 参数",
    "## 反模式",
    "## 来源与许可",
    "--mq-opacity",
    "--mq-sec",
    "aria-current",
    "prefers-reduced-motion",
)
# 组件侧必须逐字出现的实现标记(防止退化成静态 25% 或删掉无障碍降级)
CSS_CUES = ("--mq-opacity", "--mq-sec", "prefers-reduced-motion", "min-height: var(--nr-hit)", "aria-current")
JS_CUES = ("aria-current", "style.width", "--nr-progress", "prefers-reduced-motion", "data-nr-section")

ATTR_RE = re.compile(r"""(?:src|href)\s*=\s*["']([^"']+)["']""")
URL_RE = re.compile(r"""url\(\s*["']?([^"')]+)["']?\s*\)""")
SCHEME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9+.\-]*:")
SCAN_EXTS = (".md", ".json", ".html", ".css", ".js", ".py")


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)


def inside(path: Path) -> bool:
    try:
        return path.is_relative_to(ROOT)
    except AttributeError:  # pragma: no cover - 3.9 以下兜底
        return ROOT == path or ROOT in path.parents


# --------------------------------------------------------------------------- #
# 1 · pack.json
# --------------------------------------------------------------------------- #

def load_pack() -> dict:
    path = ROOT / "pack.json"
    if not path.is_file():
        fail("缺少 pack.json")
    try:
        pack = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"pack.json 无法解析:{exc}")
    if not isinstance(pack, dict):
        fail("pack.json 根必须是对象")

    missing = [k for k in REQUIRED_KEYS if k not in pack]
    if missing:
        fail(f"pack.json 缺必备键:{', '.join(missing)}")
    if pack["schema"] != 1:
        fail(f"schema 必须是 1,得到 {pack['schema']!r}")
    if pack["id"] != PACK_ID:
        fail(f"id 必须是 {PACK_ID},得到 {pack['id']!r}")
    if pack["kind"] != "ui":
        fail(f"kind 必须是 ui,得到 {pack['kind']!r}")
    if pack["category"] != "web-ui":
        fail(f"category 必须是 web-ui,得到 {pack['category']!r}")
    if not re.match(r"^\d+\.\d+\.\d+$", str(pack["version"])):
        fail(f"version 不是 x.y.z:{pack['version']!r}")
    if not isinstance(pack["attribution"], list) or not pack["attribution"]:
        fail("attribution 必须是非空数组")
    for i, item in enumerate(pack["attribution"]):
        if not isinstance(item, dict) or not item.get("name") or not item.get("license"):
            fail(f"attribution[{i}] 缺 name / license")

    origin = pack["origin"]
    if not isinstance(origin, dict) or not origin.get("project") or not origin.get("path"):
        fail("origin 必须有 project 与 path")
    opath = str(origin["path"])
    if re.match(r"^([A-Za-z]:|[\\/]{1,2})", opath):
        fail(f"origin.path 必须是相对路径:{opath!r}")
    files = pack["files"]
    if not isinstance(files, dict) or not files:
        fail("files 必须是非空对象")
    return pack


def declared_paths(files: dict) -> list[str]:
    out: list[str] = []
    for key, value in files.items():
        if isinstance(value, list):
            if not value:
                fail(f"files.{key} 是空数组")
            out.extend(str(v) for v in value)
        elif isinstance(value, str):
            out.append(value)
        elif value is not None:
            fail(f"files.{key} 类型不对:{type(value).__name__}")
    return out


# --------------------------------------------------------------------------- #
# 2 · 引用解析
# --------------------------------------------------------------------------- #

def classify(ref: str, base_dir: Path) -> tuple[str, object]:
    raw = ref.strip()
    if not raw or raw.startswith("#"):
        return "skip", None
    if raw.startswith("//"):
        return "fail", "协议相对引用(未写协议名)"
    if SCHEME_RE.match(raw):
        scheme = SCHEME_RE.match(raw).group(0)[:-1].lower()
        if scheme != "https":
            return "fail", f"非 https 协议:{scheme}:"
        return "https", raw
    target = raw.split("#", 1)[0].split("?", 1)[0]
    if not target:
        return "skip", None
    if target.startswith("/"):
        return "fail", f"站点绝对路径:{raw}"
    path = (base_dir / target).resolve()
    if not inside(path):
        return "fail", f"引用越出包目录:{raw}"
    if not path.is_file():
        return "fail", f"引用解析不到真实文件:{raw}"
    return "local", path


def collect(entry: Path) -> list[tuple[str, object, str]]:
    """返回 [(kind, payload, 出处)];入口文档 + 它引到的本地 css/js 各扫一层。"""
    found: list[tuple[str, object, str]] = []
    queue: list[tuple[Path, str]] = [(entry, entry.read_text(encoding="utf-8"))]
    seen = {entry.resolve()}
    for path, body in queue:
        refs = ATTR_RE.findall(body) + URL_RE.findall(body)
        for ref in refs:
            kind, payload = classify(ref, path.parent)
            if kind == "fail":
                fail(f"{path.relative_to(ROOT).as_posix()} → {ref}:{payload}")
            if kind == "skip":
                continue
            found.append((kind, payload, f"{path.relative_to(ROOT).as_posix()} → {ref}"))
            if kind == "local" and Path(payload).suffix in (".css", ".js"):
                target = Path(payload).resolve()
                if target not in seen:
                    seen.add(target)
                    queue.append((target, target.read_text(encoding="utf-8")))
    return found


# --------------------------------------------------------------------------- #
# 3 · 产物与关键词
# --------------------------------------------------------------------------- #

def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def check_cues(rel: str, cues, label: str) -> None:
    body = read(rel)
    missing = [c for c in cues if c not in body]
    if missing:
        fail(f"{rel} 缺{label}:{', '.join(missing)}")


def check_src() -> tuple[int, int]:
    src_dir = ROOT / "src"
    if not src_dir.is_dir():
        fail("缺少 src/ 目录")
    files = sorted(p for p in src_dir.rglob("*") if p.is_file() and p.suffix in (".css", ".js"))
    if not files:
        fail("src/ 下没有 .css / .js")
    total = 0
    for path in files:
        size = path.stat().st_size
        if size == 0:
            fail(f"src 文件为空:{path.relative_to(ROOT).as_posix()}")
        total += size
    return len(files), total


def count_scannable() -> int:
    """本包会被仓级内容闸扫到几个文本文件(形态判定本身交给 scripts/gate.py)。

    本包断言**不复刻**禁用规则:规则字面量一旦写进源码,自己就会变成被禁形态的载体,
    而且会出现第二套口径(gate 改规则这里不会跟着改)。
    """
    return sum(1 for p in ROOT.rglob("*") if p.is_file() and p.suffix in SCAN_EXTS)


# --------------------------------------------------------------------------- #

def main() -> None:
    pack = load_pack()

    # 2 · files.* 声明的每个路径都真实存在
    declared = declared_paths(pack["files"])
    for rel in declared:
        if not (ROOT / rel).is_file():
            fail(f"files 声明的路径不存在:{rel}")
    entry = str(pack["entry"])
    if not (ROOT / entry).is_file():
        fail(f"entry 指向的文件不存在:{entry}")

    # 3 · 预览引用解析
    preview_rel = pack["files"].get("preview")
    if not preview_rel:
        fail("files.preview 不能为空(ui 包必须有活预览)")
    refs = collect(ROOT / preview_rel)
    local_n = sum(1 for kind, _, _ in refs if kind == "local")
    https_n = sum(1 for kind, _, _ in refs if kind == "https")
    if local_n == 0:
        fail("预览没有任何包内引用(样式/脚本没接上)")

    # 4 · 产物非空 + 文档 / 实现关键词
    src_n, src_bytes = check_src()
    check_cues("docs/usage.md", DOC_CUES, "必备小节 / 关键词")
    check_cues("src/nav-rail.css", CSS_CUES, "实现标记")
    check_cues("src/nav-rail.js", JS_CUES, "实现标记")
    preview = read(str(preview_rel))
    for cue in ('aria-current="page"', "data-nr-target", "data-nr-section", "data-nr-progress", "data-nr-stage"):
        if cue not in preview:
            fail(f"{preview_rel} 缺标记:{cue}")
    ids = set(re.findall(r'data-nr-section="([^"]+)"', preview))
    buttons = re.findall(r'data-nr-target="([^"]+)"', preview)
    targets = set(buttons)
    if not ids or not targets:
        fail("预览里没有段落或没有可点项")
    orphan = sorted(targets - ids)
    if orphan:
        fail(f"可点项指向不存在的段:{', '.join(orphan)}")
    if ids != targets:
        fail(f"顶导航与段轨没有覆盖同一组段:{sorted(ids)} / {sorted(targets)}")

    # 禁用内容形态由仓级 scripts/gate.py 判定(本脚本不复刻规则)
    scanned = count_scannable()

    all_files = [p for p in ROOT.rglob("*") if p.is_file()]
    pack_bytes = sum(p.stat().st_size for p in all_files)

    print(f"PASS assert_tokens {PACK_ID}")
    print(
        f"  引用 {len(refs)} 个(包内 {local_n} / https {https_n})· 声明路径 {len(declared)} 个全部存在"
        f" · src 文件 {src_n} 个({src_bytes} 字节)· 包内 {len(all_files)} 文件 {pack_bytes} 字节"
    )
    print(
        f"  段落 {len(ids)} 段 · 可点项 {len(buttons)} 个(覆盖 {len(targets)} 段) · docs 关键词 {len(DOC_CUES)}/{len(DOC_CUES)}"
        f" · 形态闸交给 scripts/gate.py(本包 {scanned} 个文本文件在其扫描面内)"
    )


if __name__ == "__main__":
    main()
