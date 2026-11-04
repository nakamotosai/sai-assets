#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""param-panel 断言:元数据 / 声明路径 / 预览引用解析 / 前缀一致性 / 计数与实测。

禁用内容形态的判定属于仓级 scripts/gate.py(规则正本),本脚本刻意不复刻那些规则 ——
规则字面量写进源码本身就会成为被禁形态的载体,也会造成第二套口径。

通过 = 打印 "PASS assert_tokens param-panel" + 实测摘要,退出 0;
失败 = 把 FAIL 原因打到 stderr,退出 1。仅用标准库。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # packs/param-panel
PACK_ID = "param-panel"

REQUIRED_KEYS = (
    "schema", "id", "title", "kind", "category", "version", "license", "attribution",
    "origin", "entry", "files", "tags", "when", "not_for", "verified",
)

DOC_CUES = (
    "## 什么时候用",
    "## 接入步骤",
    "## 参数",
    "## 反模式",
    "## 来源与许可",
    "shouldMountLabPanel",
    "swatches",
    "prefers-reduced-motion",
    "params.json",
)
# 组件侧必须逐字出现的实现标记(退化即红:删掉导出、改回旧命名空间、去掉无障碍兜底)
CSS_CUES = ("pp-param-panel", "pp-param-board", "focus-visible", "prefers-reduced-motion")
JS_CUES = (
    "export function mountParamPanel",
    "export function shouldMountLabPanel",
    "saiassets.param-panel.",
    "localStorage",
    "aria-label",
)
LEGACY_CUES = ("themelab", "tl-param", "Theme Lab", "F:\\", "C:\\")
ATTR_RE = re.compile(r"""(?:src|href)\s*=\s*["']([^"']+)["']""")
SCHEME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9+.\-]*:")
CLASS_RE = re.compile(r"pp-[a-z0-9]+(?:-[a-z0-9]+)*")


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def main() -> None:
    pack = json.loads(read(ROOT / "pack.json"))

    # 1 元数据
    missing = [k for k in REQUIRED_KEYS if k not in pack]
    if missing:
        fail(f"pack.json 缺字段: {missing}")
    if pack["id"] != PACK_ID or pack["kind"] != "ui" or pack["category"] != "web-ui":
        fail(f"id/kind/category 不对: {pack['id']} / {pack['kind']} / {pack['category']}")
    if not re.fullmatch(r"\d+\.\d+\.\d+", str(pack["version"])):
        fail(f"version 不是 x.y.z: {pack['version']}")
    if not pack.get("license") or not pack.get("when") or not pack.get("not_for"):
        fail("license / when / not_for 必须非空")
    origin = pack.get("origin") or {}
    op = str(origin.get("path") or "")
    if not op or re.match(r"^[A-Za-z]:", op) or op.startswith(("/", "\\\\")):
        fail(f"origin.path 必须是相对路径: {op!r}")
    if not (pack.get("verified") or {}).get("evidence"):
        fail("verified.evidence 必填(要贴实测输出)")
    if pack.get("entry") != "SKILL.md":
        fail(f"entry 应为 SKILL.md: {pack.get('entry')!r}")

    # 2 声明路径存在
    declared: list[str] = []
    for key, val in (pack.get("files") or {}).items():
        if isinstance(val, str):
            declared.append(val)
        elif isinstance(val, list):
            declared += val
    missing_files = [f for f in declared if not (ROOT / f).is_file()]
    if missing_files:
        fail(f"pack.json 声明了不存在的文件: {missing_files}")
    if not any(f.startswith("src/") for f in declared):
        fail("files 里没有 src/ 产物")
    for need in ("SKILL.md", "README.md", "docs/usage.md", "preview/index.html"):
        if not (ROOT / need).is_file():
            fail(f"缺产物文件: {need}")

    # 3 预览引用必须解析到包内
    preview = read(ROOT / "preview" / "index.html")
    refs = ATTR_RE.findall(preview)
    if not refs:
        fail("preview/index.html 没有任何 src/href 引用")
    for ref in refs:
        if SCHEME_RE.match(ref) or ref.startswith("//"):
            fail(f"预览引用了包外资源: {ref}")
        target = (ROOT / "preview" / ref).resolve()
        if not target.is_file():
            fail(f"预览引用解析不到: {ref}")
        if ROOT.resolve() not in target.parents:
            fail(f"预览引用跳出包外: {ref}")

    # 4 文档与实现标记
    doc = read(ROOT / "docs" / "usage.md")
    for cue in DOC_CUES:
        if cue not in doc:
            fail(f"docs/usage.md 缺关键词: {cue!r}")
    css = read(ROOT / "src" / "param-panel.css")
    js = read(ROOT / "src" / "param-panel.js")
    for cue in CSS_CUES:
        if cue not in css:
            fail(f"src/param-panel.css 缺实现标记: {cue!r}")
    for cue in JS_CUES:
        if cue not in js:
            fail(f"src/param-panel.js 缺实现标记: {cue!r}")
    for old in LEGACY_CUES:
        for name, text in (("css", css), ("js", js), ("usage", doc), ("preview", preview)):
            if old in text:
                fail(f"{name} 残留旧库标记 {old!r}")

    # 5 前缀一致性:JS 里用到的 pp-* 类名必须在 CSS 里有定义
    js_classes = set(CLASS_RE.findall(js))
    css_classes = set(CLASS_RE.findall(css))
    orphan = sorted(c for c in js_classes if c not in css_classes)
    if orphan:
        fail(f"JS 用到但 CSS 未定义的类名: {orphan[:6]}")

    # 6 挂载判定:从 JS 里抠出那段正则,用代表性路径实测(静态服务器与站点 iframe 两种落法都要命中)
    i = js.find("/\\/preview")
    j = js.find(".test(path)", i)
    if i < 0 or j < 0:
        fail("src/param-panel.js 里找不到 preview 挂载判定正则")
    pattern = js[i + 1:js.rindex("/", i, j)].replace("\\/", "/")
    probe = re.compile(pattern)
    hits = ["/x/preview", "/x/preview/", "/x/preview.html", "/x/preview/index.html"]
    miss = ["/x/previewx/", "/x/other/index.html", "/x/labpreview/"]
    bad = [q for q in hits if not probe.search(q)] + [q for q in miss if probe.search(q)]
    if bad:
        fail(f"preview 挂载判定正则行为不对: {bad}")

    # 6 计数(实测摘要)
    schema = json.loads(read(ROOT / "src" / "params.schema.json"))
    fields = (schema.get("properties") or {}).get("schema", {}).get("items", {})
    types = fields.get("properties", {}).get("type", {}).get("enum", [])
    swatches = len(re.findall(r"#[0-9A-Fa-f]{6}", preview))
    print(
        f"PASS assert_tokens {PACK_ID} / "
        f"css {len(css)} 字节 · {len(css_classes)} 个类 / "
        f"js {len(js)} 字节 · 导出 2 · 用到类 {len(js_classes)} 个(缺定义 {len(orphan)}) / "
        f"schema 类型 {len(types)} 种 / 预览引用 {len(refs)} 条全部解析 / "
        f"预览 hex {swatches} 个 / 挂载判定 命中 {len(hits)} 例 · 反例 {len(miss)} 例全不中"
    )


if __name__ == "__main__":
    main()
