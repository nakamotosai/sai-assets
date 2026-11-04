#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""motion-kit 自检:元数据 / 声明路径 / 预览引用解析 / 产物非空 / 关键实现标记 / 无站点专有标识。

跑法:python packs/motion-kit/scripts/assert_tokens.py
退出码 0 = 全过。任一不过打印 FAIL 行并以 1 退出(仓级 gate 会把它当作本包未通过)。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # packs/motion-kit
PACK_ID = "motion-kit"

REQUIRED_KEYS = (
    "schema", "id", "title", "kind", "category", "version", "license",
    "attribution", "origin", "entry", "files", "tags", "when", "not_for", "verified",
)

# docs/usage.md 必须逐字存在的小节与关键词(改文档时同步这里)
DOC_CUES = ("## 1 接入步骤", "## 2 宿主 token 清单", "## 3 模块与标记对照",
            "## 5 性能口径", "## 6 反模式", "prefers-reduced-motion", "js-motion", "motion-ready")

# CSS 侧必须逐字存在的实现标记(防止退化成静态样式或删掉降级块)
CSS_CUES = ("--ease-out", "--reveal-delay", "--i, 0", "html.js-motion [data-reveal]",
            "html.motion-ready", "@media (prefers-reduced-motion: reduce)",
            "view-transition", "vt-theme", "--py, 0px", ".split-word", ".footer-marquee")

# JS 侧必须逐字存在的实现标记(防止删模块或去掉守卫)
JS_CUES = ("data-reveal", "data-reveal-stagger", "data-split", "data-count", "data-tilt",
           "data-magnetic", "data-cursor-label", "data-hero-canvas", "data-process", "work-card",
           "faq-answer", "prefers-reduced-motion", "pointer: fine", "requestAnimationFrame",
           "IntersectionObserver", "onScrollFrame", "doc.hidden", "devicePixelRatio", "Array.from(text)", "NO_LINE_START",
           "window.motionKit.applyTheme", "window.motionKit.viewTheme")

# 仓库外泄检查:这些字样不该出现在包里(站点专有标识)
FOREIGN_MARKERS = ("ouuut", "make-theme", "make-lang", "make.ouuut", "saaaai", "make-site")

ATTR_RE = re.compile(r"""(?:src|href)\s*=\s*["']([^"']+)["']""")
URL_RE = re.compile(r"""url\(\s*["']?([^"')]+)["']?\s*\)""")
SCHEME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9+.\-]*:")
SCAN_EXTS = (".md", ".json", ".html", ".css", ".js", ".py")

# 内联的 data: URI(如自带的 SVG 占位图)整体跳过 —— 里面的 url(%23g) 不是本地引用
# 注意:属性值里可能含另一种引号(如 xmlns='...'),所以按"属性自己的引号"收尾。
DATA_ATTR_RE = re.compile(r"""((?:src|href)\s*=\s*")(?:data:)[^"]*(")""")
DATA_ATTR_SQ_RE = re.compile(r"""((?:src|href)\s*=\s*')(?:data:)[^']*(')""")
DATA_URL_RE = re.compile(r"""url\(\s*["']?data:[^)]*["']?\s*\)""")


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)


def read(rel: str) -> str:
    path = ROOT / rel
    if not path.is_file():
        fail(f"缺文件:{rel}")
    return path.read_text(encoding="utf-8")


def check_meta(pack: dict) -> None:
    for key in REQUIRED_KEYS:
        if key not in pack:
            fail(f"pack.json 缺必备键 {key}")
    if pack["id"] != PACK_ID:
        fail(f"id 不符:{pack['id']}")
    if pack["kind"] != "fx" or pack["category"] != "web-fx":
        fail(f"kind/category 应为 fx / web-fx,实际 {pack['kind']} / {pack['category']}")
    origin_path = (pack.get("origin") or {}).get("path", "")
    if not origin_path or SCHEME_RE.match(origin_path) or re.match(r"^[A-Za-z]:", origin_path):
        fail(f"origin.path 必须是相对路径,实际:{origin_path!r}")
    if not pack.get("when") or not pack.get("not_for"):
        fail("when / not_for 不能为空")
    evidence = (pack.get("verified") or {}).get("evidence", "")
    if len(evidence) < 4 or "待补" in evidence:
        fail("verified.evidence 还是占位,必须贴真实断言输出")


def declared_paths(files: dict) -> list[str]:
    out: list[str] = []
    for value in (files or {}).values():
        if isinstance(value, str):
            out.append(value)
        elif isinstance(value, list):
            out += [v for v in value if isinstance(v, str)]
    return sorted(set(out))


def check_declared(pack: dict) -> int:
    declared = declared_paths(pack.get("files") or {})
    if not declared:
        fail("files 为空")
    for rel in declared:
        if not (ROOT / rel).is_file():
            fail(f"声明了不存在的文件 {rel}")
    for key in ("css", "src", "usage", "assert", "preview"):
        if not (pack["files"] or {}).get(key):
            fail(f"files.{key} 缺失(fx 包必须有 css/src/usage/assert/preview)")
    return len(declared)


def check_preview_refs() -> int:
    rel = "preview/index.html"
    html = read(rel)
    html = DATA_ATTR_RE.sub(r'\1data:URI\2', html)
    html = DATA_ATTR_SQ_RE.sub(r'\1data:URI\2', html)
    html = DATA_URL_RE.sub("url(data:URI)", html)
    base = (ROOT / rel).parent
    checked = 0
    refs = [m.group(1) for m in ATTR_RE.finditer(html)] + [m.group(1) for m in URL_RE.finditer(html)]
    for ref in refs:
        url = ref.strip()
        if not url or url.startswith(("#", "//", "data:", "mailto:")) or SCHEME_RE.match(url):
            continue
        checked += 1
        target = (base / url.split("?")[0].split("#")[0]).resolve()
        if not target.exists():
            fail(f"{rel} 引用了不存在的本地文件:{url}")
    return checked


def check_cues() -> None:
    for rel, cues, label in (("src/motion.css", CSS_CUES, "实现标记"),
                             ("src/motion.js", JS_CUES, "实现标记"),
                             ("docs/usage.md", DOC_CUES, "小节/关键词")):
        body = read(rel)
        missing = [c for c in cues if c not in body]
        if missing:
            fail(f"{rel} 缺{label}:{', '.join(missing)}")


def check_foreign() -> None:
    """只扫「会被抄进项目」的产物(src/ 与 preview/):元数据留着来源出处,不算外泄。"""
    hits = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.suffix not in SCAN_EXTS:
            continue
        rel = path.relative_to(ROOT).as_posix()
        if not (rel.startswith("src/") or rel.startswith("preview/")):
            continue
        text = path.read_text(encoding="utf-8", errors="replace").lower()
        for marker in FOREIGN_MARKERS:
            if marker in text:
                hits.append(f"{rel}:{marker}")
    if hits:
        fail(f"产物里出现站点专有标识:{hits[:6]}")


def check_src() -> tuple[int, int]:
    files = sorted(p for p in (ROOT / "src").rglob("*") if p.is_file())
    if not files:
        fail("src/ 为空")
    total = 0
    for path in files:
        size = path.stat().st_size
        if size < 200:
            fail(f"src/{path.name} 只有 {size}B,疑似占位")
        total += size
    return len(files), total


def main() -> None:
    pack = json.loads(read("pack.json"))
    check_meta(pack)
    declared = check_declared(pack)
    refs = check_preview_refs()
    check_cues()
    check_foreign()
    n_src, bytes_src = check_src()
    scanned = sum(1 for p in ROOT.rglob("*") if p.is_file() and p.suffix in SCAN_EXTS)

    print(f"PASS assert_tokens {PACK_ID}")
    print(f"  declared={declared} entry={pack['entry']} preview=yes refs={refs}")
    print(f"  src={n_src} files / {bytes_src}B · 可被仓级闸扫到的文本文件 {scanned} 个")
    print(f"  cues: css {len(CSS_CUES)} · js {len(JS_CUES)} · docs {len(DOC_CUES)} · 无站点专有标识")


if __name__ == "__main__":
    main()