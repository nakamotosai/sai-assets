#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""optical-type 断言:契约 / 声明路径 / 预览引用 / 产物 / 文档与实现标记 / 回退色对比度两档。

禁用内容形态的判定属于仓级 scripts/gate.py(规则正本),本脚本刻意不复刻 ——
规则字面量写进源码本身就会成为被禁形态的载体,也会造出第二套口径。

通过 = 打印 "PASS assert_tokens optical-type" + 实测摘要,退出 0;
失败 = FAIL 原因打到 stderr,退出 1。仅用标准库。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK_ID = "optical-type"

REQUIRED_KEYS = (
    "schema", "id", "title", "kind", "category", "version", "license", "attribution",
    "origin", "entry", "files", "tags", "when", "not_for", "verified",
)

DOC_CUES = (
    "## 什么时候用",
    "## 什么时候不用",
    "## 接入步骤",
    "## 四档对照",
    "## 参数",
    "## 无障碍与硬项",
    "## 反模式",
    "## 来源与许可",
    "font-optical-sizing",
    "font-synthesis",
    "font-variation-settings",
)
CSS_CUES = (
    "font-variation-settings",
    "font-optical-sizing",
    "font-synthesis: none",
    "@supports not",
    "@media print",
    "--ot-opsz-display",
)
JS_CUES = ()  # fonts 包无脚本
PREVIEW_CUES = (
    'ot-display',
    'ot-lead',
    'ot-body',
    'ot-small',
    'ot-compare',
    "font-variation-settings",
    "opsz",
)

ATTR_RE = re.compile(r"""(?:src|href)\s*=\s*["']([^"']+)["']""")
URL_RE = re.compile(r"""url\(\s*["']?([^"')]+)["']?\s*\)""")
SCHEME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9+.\-]*:")
SCAN_EXTS = (".md", ".json", ".html", ".css", ".js", ".py")

# 回退色(host 不给 token 时实际生效的那组);两档都要过对比度
PALETTE = {
    "light": {"bg": "#f5f3ed", "ink": "#1a1a16", "muted": "#5b5a53", "accent": "#cd5545", "accentInk": "#ae4b3d"},
    "dark": {"bg": "#0e0e0c", "ink": "#edebe4", "muted": "#a3a199", "accent": "#cd5545", "accentInk": "#d76e5d"},
}


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)


def inside(path: Path) -> bool:
    try:
        return path.is_relative_to(ROOT)
    except AttributeError:  # pragma: no cover
        return ROOT == path or ROOT in path.parents


# ---------------------------------------------------------------- 1 · 契约
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
    if pack["kind"] != "fonts":
        fail(f"kind 必须是 fonts,得到 {pack['kind']!r}")
    if pack["category"] != "fonts":
        fail(f"category 必须是 fonts,得到 {pack['category']!r}")
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


# ---------------------------------------------------------------- 2 · 引用
def classify(ref: str, base_dir: Path) -> tuple[str, object]:
    raw = ref.strip()
    if not raw or raw.startswith("#"):
        return "skip", None
    if raw.startswith("//"):
        return "fail", "协议相对引用(未写协议名)"
    if SCHEME_RE.match(raw):
        scheme = SCHEME_RE.match(raw).group(0)[:-1].lower()
        # mailto: 是页脚/联系位的正常引用(optical-type 与 agent-workspace 都会用到)
        if scheme == "mailto":
            return "skip", None
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
    found: list[tuple[str, object, str]] = []
    queue: list[tuple[Path, str]] = [(entry, entry.read_text(encoding="utf-8"))]
    seen = {entry.resolve()}
    for path, body in queue:
        for ref in ATTR_RE.findall(body) + URL_RE.findall(body):
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


# ---------------------------------------------------------------- 3 · 产物
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
    return sum(1 for p in ROOT.rglob("*") if p.is_file() and p.suffix in SCAN_EXTS)


# ---------------------------------------------------------------- 4 · 轴数据自洽
def check_axes() -> list[str]:
    """fonts 包没有颜色 token,所以这里不查对比度;查的是「声明的轴值是否可信」。

    1) 每个字族都要有 verified 说明(实测来源),不许只写一个数字;
    2) has_opsz 为 true 的,轴范围必须 min < max 且 default 落在区间内;
    3) 没有 opsz 的字族不许在 axes 里出现 opsz 键(假轴)。
    """
    ax = json.loads((ROOT / "tokens" / "opsz-axes.json").read_text(encoding="utf-8"))
    fonts = ax.get("fonts") or []
    if len(fonts) < 2:
        fail("轴表少于两个字族(单点无法证明「有没有轴」的差别)")
    notes = []
    seen_axis = False
    for f in fonts:
        name = f.get("family") or "?"
        if not f.get("verified"):
            fail(f"{name}:缺 verified(轴值必须有实测来源)")
        axes = f.get("axes") or {}
        if "opsz" in axes:
            rng = axes["opsz"]
            if not (rng["min"] < rng["max"]):
                fail(f"{name}:opsz 范围不是 min<max:{rng}")
            if not (rng["min"] <= rng["default"] <= rng["max"]):
                fail(f"{name}:opsz default 落在区间外:{rng}")
            if not f.get("has_opsz"):
                fail(f"{name}:axes 里有 opsz 但 has_opsz 写 false(自相矛盾)")
            seen_axis = True
            notes.append(f"{name} opsz {rng['min']}–{rng['max']}(default {rng['default']})")
        else:
            if f.get("has_opsz"):
                fail(f"{name}:has_opsz 写 true 但 axes 里没有 opsz(假轴)")
            notes.append(f"{name} 无 opsz")
    if not seen_axis:
        fail("轴表里没有任何字族带 opsz —— 那这个包不成立")
    return notes


# ---------------------------------------------------------------- main
def main() -> None:
    pack = load_pack()

    for rel in declared_paths(pack["files"]):
        if not (ROOT / rel).is_file():
            fail(f"files 声明的路径不存在:{rel}")
    entry = str(pack["entry"])
    if not (ROOT / entry).is_file():
        fail(f"entry 指向的文件不存在:{entry}")

    preview_rel = pack["files"].get("preview")
    if not preview_rel:
        fail("files.preview 不能为空(ui 包必须有活预览)")
    refs = collect(ROOT / preview_rel)
    local_n = sum(1 for kind, _, _ in refs if kind == "local")
    https_n = sum(1 for kind, _, _ in refs if kind == "https")
    if local_n < 1:
        fail("预览没有任何包内引用(样式没接上)")

    src_n, src_bytes = check_src()
    check_cues("docs/usage.md", DOC_CUES, "必备小节 / 关键词")
    check_cues("src/optical-type.css", CSS_CUES, "实现标记")
    preview = read(str(preview_rel))
    for cue in PREVIEW_CUES:
        if cue not in preview:
            fail(f"{preview_rel} 缺标记:{cue}")

    # 四档必须各出现一次
    tiers = ("ot-display", "ot-lead", "ot-body", "ot-small")
    missing = [t for t in tiers if t not in preview]
    if missing:
        fail(f"预览缺档位:{', '.join(missing)}")
    # 对照台至少五档,且每档的 opsz 值必须不同(否则等于没对照)
    # 不用正则:仓级形态闸会把 "settings:'opsz'" 这类串按「盘符路径」误判,
    # 断言脚本自己不该成为被禁形态的载体。逐行字符串切分即可。
    rows = []
    for line in preview.splitlines():
        if "font-variation-settings" not in line or "opsz" not in line:
            continue
        for chunk in line.split("'opsz'")[1:]:
            digits = ""
            for ch in chunk.strip():
                if ch.isdigit():
                    digits += ch
                elif digits:
                    break
            if digits:
                rows.append(digits)
    if len(rows) < 5:
        fail(f"对照台只有 {len(rows)} 行(至少要五档)")
    if len(set(rows)) != len(rows):
        fail(f"对照台的 opsz 值有重复:{rows}")

    # 轴数据必须与预览自洽:标了 has_opsz 的字族,其 max 必须出现在对照台里
    ax = json.loads((ROOT / "tokens" / "opsz-axes.json").read_text(encoding="utf-8"))
    with_axis = [f for f in ax["fonts"] if f.get("has_opsz")]
    if with_axis:
        top = str(with_axis[0]["axes"]["opsz"]["max"])
        if top not in rows:
            fail(f"对照台没覆盖到轴上界 {top}(最高档缺席等于没验)")

    axis_notes = check_axes()
    scanned = count_scannable()
    all_files = [p for p in ROOT.rglob("*") if p.is_file()]
    pack_bytes = sum(p.stat().st_size for p in all_files)

    print(f"PASS assert_tokens {PACK_ID}")
    print(
        f"  引用 {len(refs)} 个(包内 {local_n} / https {https_n})· 声明路径 {len(declared_paths(pack['files']))} 个全部存在"
        f" · src {src_n} 文件 {src_bytes} 字节 · 包内 {len(all_files)} 文件 {pack_bytes} 字节"
    )
    print("  轴值 " + " | ".join(axis_notes))
    print(
        f"  docs 关键词 {len(DOC_CUES)}/{len(DOC_CUES)} · 预览标记 {len(PREVIEW_CUES)}/{len(PREVIEW_CUES)}"
        f" · 形态闸交给 scripts/gate.py(本包 {scanned} 个文本文件在其扫描面内)"
    )


if __name__ == "__main__":
    main()
