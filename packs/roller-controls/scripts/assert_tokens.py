#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""roller-controls 断言:契约 / 声明路径 / 预览引用 / 产物 / 文档与实现标记 / 回退色对比度两档。

禁用内容形态的判定属于仓级 scripts/gate.py(规则正本),本脚本刻意不复刻 ——
规则字面量写进源码本身就会成为被禁形态的载体,也会造出第二套口径。

通过 = 打印 "PASS assert_tokens roller-controls" + 实测摘要,退出 0;
失败 = FAIL 原因打到 stderr,退出 1。仅用标准库。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK_ID = "roller-controls"

REQUIRED_KEYS = (
    "schema", "id", "title", "kind", "category", "version", "license", "attribution",
    "origin", "entry", "files", "tags", "when", "not_for", "verified",
)

DOC_CUES = (
    "## 什么时候用",
    "## 什么时候不用",
    "## 接入步骤",
    "## 标记对照",
    "## 参数",
    "## 无障碍硬项",
    "## 反模式",
    "## 来源与许可",
    "--rc-accent-ink",
    "prefers-reduced-motion",
    "scroll-snap",
)
CSS_CUES = (
    "--rc-accent-ink",
    "prefers-reduced-motion",
    "scroll-snap-type",
    "--rc-bar",
    "mask-image",
    "data-mode",
)
JS_CUES = (
    "prefers-reduced-motion",
    "data-rc-wheel",
    "data-rc-wave",
    "data-rc-dock",
    "aria-selected",
    "aria-valuetext",
)
PREVIEW_CUES = (
    'data-rc-root',
    'data-rc-wheel',
    'data-rc-readout',
    'data-rc-wave',
    'data-rc-dock',
    'role="listbox"',
    'role="option"',
    'type="range"',
    'aria-selected="true"',
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


# ---------------------------------------------------------------- 2 · 引用
def classify(ref: str, base_dir: Path) -> tuple[str, object]:
    raw = ref.strip()
    if not raw or raw.startswith("#"):
        return "skip", None
    if raw.startswith("//"):
        return "fail", "协议相对引用(未写协议名)"
    if SCHEME_RE.match(raw):
        scheme = SCHEME_RE.match(raw).group(0)[:-1].lower()
        # mailto: 是页脚/联系位的正常引用(footer-shapes 与 agent-workspace 都会用到)
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


# ---------------------------------------------------------------- 4 · 对比度
def _srgb(v: float) -> float:
    v /= 255
    return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4


def _lum(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    if len(h) != 6:
        fail(f"色值不是 6 位 hex:{hex_color}")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * _srgb(r) + 0.7152 * _srgb(g) + 0.0722 * _srgb(b)


def ratio(fg: str, bg: str) -> float:
    a, b = _lum(fg), _lum(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def check_contrast() -> list[str]:
    """文字档 ≥4.5(ink / muted / accent-ink);图形档 accent on bg ≥3。"""
    notes = []
    for mode, pal in PALETTE.items():
        for key in ("ink", "muted", "accentInk"):
            r = ratio(pal[key], pal["bg"])
            if r < 4.5:
                fail(f"{mode}:{key} on bg = {r:.2f} < 4.5")
        r_accent = ratio(pal["accent"], pal["bg"])
        if r_accent < 3:
            fail(f"{mode}:accent on bg = {r_accent:.2f} < 3(图形档)")
        notes.append(
            f"{mode} ink {ratio(pal['ink'], pal['bg']):.2f}"
            f" · muted {ratio(pal['muted'], pal['bg']):.2f}"
            f" · accent-ink {ratio(pal['accentInk'], pal['bg']):.2f}"
            f" · accent(图形) {r_accent:.2f}"
        )
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
    if local_n < 2:
        fail(f"预览的包内引用只有 {local_n} 个(css 与 js 都要接上)")

    src_n, src_bytes = check_src()
    check_cues("docs/usage.md", DOC_CUES, "必备小节 / 关键词")
    check_cues("src/roller-controls.css", CSS_CUES, "实现标记")
    check_cues("src/roller-controls.js", JS_CUES, "实现标记")
    preview = read(str(preview_rel))
    for cue in PREVIEW_CUES:
        if cue not in preview:
            fail(f"{preview_rel} 缺标记:{cue}")

    # 滚筒:每枚都要有显式读数引用;两枚并排时「往上找一个」必然抢
    wheels = preview.count("data-rc-wheel")
    readout_refs = preview.count('data-rc-readout="')
    if wheels < 2:
        fail(f"滚筒只有 {wheels} 枚(至少两枚才验得了并排栏宽与各自读数)")
    if readout_refs != wheels:
        fail(f"滚筒 {wheels} 枚但显式读数引用 {readout_refs} 个(必须一一对应)")
    # 滑杆必须是原生 range;柱层必须对读屏隐藏
    if 'class="rc-range"' not in preview or 'type="range"' not in preview:
        fail("滑杆不是原生 input[type=range](键盘与读屏会丢)")
    if 'aria-hidden="true"' not in preview:
        fail("柱层没有 aria-hidden(读屏会把 40 根装饰柱念出来)")

    contrast_notes = check_contrast()
    scanned = count_scannable()
    all_files = [p for p in ROOT.rglob("*") if p.is_file()]
    pack_bytes = sum(p.stat().st_size for p in all_files)

    print(f"PASS assert_tokens {PACK_ID}")
    print(
        f"  引用 {len(refs)} 个(包内 {local_n} / https {https_n})· 声明路径 {len(declared_paths(pack['files']))} 个全部存在"
        f" · src {src_n} 文件 {src_bytes} 字节 · 包内 {len(all_files)} 文件 {pack_bytes} 字节"
    )
    print("  对比度 " + " | ".join(contrast_notes))
    print(
        f"  docs 关键词 {len(DOC_CUES)}/{len(DOC_CUES)} · 预览标记 {len(PREVIEW_CUES)}/{len(PREVIEW_CUES)}"
        f" · 形态闸交给 scripts/gate.py(本包 {scanned} 个文本文件在其扫描面内)"
    )


if __name__ == "__main__":
    main()
