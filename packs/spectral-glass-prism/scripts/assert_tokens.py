#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""spectral-glass-prism 断言(零依赖)。

检查:
  1. pack.json 契约字段、kind/category、origin.path 非绝对路径
  2. files.* 声明的每个路径存在且非空(src / upstream / usage / assert / preview)
  3. preview/index.html 里每个 src=/href=/url() 引用:https 外链要真 https,相对引用要能在本包内解析
  4. src/ 里的 `new URL('<相对路径>', import.meta.url)` 动态引用(引擎地址)在本包内解析得到
  5. 引擎契约:preview 里五个契约节点 id 齐全;两条 JS 引用的是 vendored 引擎而不是外链
  6. vendored 引擎是真实构建产物(体积下限 + WGSL/WebGPU 特征串),LICENSE 是 MIT 原文
  7. docs/usage.md 含接入 / 反模式 / 许可 三个线索小节
  8. 宿主规则:先探测后加载(requestAdapter 出现在动态 import 之前);无明文 http 外链

退出码:0 = 通过;1 = 失败。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED_KEYS = (
    "schema", "id", "title", "kind", "category", "version", "license",
    "attribution", "origin", "entry", "files", "tags", "when", "not_for", "verified",
)
CONTRACT_IDS = ("gpu", "html-bg-root", "html-bg-photo", "html-bg-foreground", "fallback")
USAGE_CUES = ("接入", "反模式", "许可")
ENGINE_REL = "upstream/spectral-glass/engine.js"


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def resolve_ref(ref: str, base_dir: Path) -> Path:
    target = (base_dir / ref.split("#")[0].split("?")[0]).resolve()
    if not str(target).startswith(str(ROOT.resolve())):
        fail(f"引用越出包目录:{ref}")
    return target


def main() -> None:
    pack_path = ROOT / "pack.json"
    if not pack_path.is_file():
        fail("missing pack.json")
    pack = json.loads(pack_path.read_text(encoding="utf-8"))

    missing = [k for k in REQUIRED_KEYS if k not in pack]
    if missing:
        fail(f"pack.json 缺键:{', '.join(missing)}")
    if pack.get("kind") != "ui" or pack.get("category") != "web-ui":
        fail(f"kind/category 应为 ui / web-ui,实际 {pack.get('kind')} / {pack.get('category')}")
    if pack.get("id") != "spectral-glass-prism":
        fail(f"id 应为 spectral-glass-prism,实际 {pack.get('id')!r}")
    origin_path = str(pack.get("origin", {}).get("path", ""))
    if not origin_path or re.match(r"^([A-Za-z]:|/|\\\\)", origin_path):
        fail(f"origin.path 必须是相对路径,实际 {origin_path!r}")

    files = pack.get("files", {})
    declared: list[str] = []
    for key, val in files.items():
        if isinstance(val, list):
            declared += [str(v) for v in val]
        elif isinstance(val, str):
            declared.append(val)
    if not declared:
        fail("pack.json.files 是空的")
    total_bytes = 0
    for rel in declared:
        p = ROOT / rel
        if not p.is_file():
            fail(f"files 声明的路径不存在:{rel}")
        if p.stat().st_size == 0:
            fail(f"files 声明的路径是空文件:{rel}")
        total_bytes += p.stat().st_size

    # ---- preview 引用 ----
    preview_rel = files.get("preview")
    if not preview_rel:
        fail("pack.json.files.preview 缺失")
    preview = ROOT / preview_rel
    if not preview.is_file():
        fail(f"preview 不存在:{preview_rel}")
    html = preview.read_text(encoding="utf-8")
    refs = re.findall(r'(?:src|href)\s*=\s*"([^"]+)"', html) + re.findall(r"url\(\s*['\"]?([^'\")]+)", html)
    checked = 0
    for ref in refs:
        if ref.startswith("#") or ref.startswith("data:") or ref.startswith("mailto:"):
            continue
        if ref.startswith("http://"):
            fail(f"preview 里有明文 http 外链:{ref}")
        if ref.startswith("https://"):
            fail(f"preview 不应有外链(引擎与样式都必须是包内文件):{ref}")
        target = resolve_ref(ref, preview.parent)
        if not target.is_file():
            fail(f"preview 引用解析不到真实文件:{ref}")
        checked += 1
    if checked < 2:
        fail(f"preview 里只查到 {checked} 个包内引用")

    # ---- 契约节点 ----
    for cid in CONTRACT_IDS:
        if f'id="{cid}"' not in html:
            fail(f"preview 缺引擎契约节点 id=\"{cid}\"")

    # ---- 宿主 JS:动态引用解析 + 先探测后加载 ----
    host_rel = "src/spectral-glass.js"
    host = (ROOT / host_rel).read_text(encoding="utf-8")
    dyn = re.findall(r"new URL\(\s*'([^']+)'\s*,\s*", host)
    if not dyn:
        fail("宿主 JS 里没有 `new URL('<相对路径>', ...)` 形式的包内引用")
    for rel in dyn:
        target = resolve_ref(rel, (ROOT / host_rel).parent)
        if not target.is_file():
            fail(f"宿主引用的包内文件不存在:{rel}")
    if ("navigator.gpu" not in host) or ("requestAdapter" not in host):
        fail("宿主缺 WebGPU 能力探测")
    if ("createElement('script')" not in host) and ("createElement(\"script\")" not in host):
        fail("宿主没有用 script 标签加载引擎")
    if re.search(r"\bimport\s*\(\s*[A-Za-z_$'\"]", host):
        fail("宿主用了动态 import():在本地文件页面会被 CORS 拦,改用 script 标签")
    if host.index("requestAdapter") > host.index("injectEngine()"):
        fail("宿主把加载放到了探测之前(必须先探测、后加载)")
    for cid in CONTRACT_IDS:
        if cid not in host:
            fail(f"宿主没有声明契约节点 {cid}")

    # ---- vendored 引擎 ----
    engine = ROOT / ENGINE_REL
    if not engine.is_file():
        fail(f"缺 vendored 引擎:{ENGINE_REL}")
    if engine.stat().st_size < 200_000:
        fail(f"vendored 引擎只有 {engine.stat().st_size} 字节,不像真实构建产物")
    engine_text = engine.read_text(encoding="utf-8", errors="ignore")
    for needle in ("WGSL", "createShaderModule", "requestAnimationFrame"):
        if needle not in engine_text:
            fail(f"vendored 引擎里找不到特征串 {needle}")
    if "import(" in engine_text.split("</script>")[0][:2000]:
        fail("vendored 引擎意外变成了转发壳")
    license_text = (ROOT / "upstream" / "spectral-glass" / "LICENSE").read_text(encoding="utf-8")
    if "MIT License" not in license_text:
        fail("upstream LICENSE 不是 MIT 原文")
    notice = (ROOT / "upstream" / "spectral-glass" / "NOTICE.md").read_text(encoding="utf-8")
    for needle in ("MIT", "Poly Haven", "CC0", "Picsum"):
        if needle not in notice:
            fail(f"NOTICE.md 缺来源登记:{needle}")
    attribution = json.dumps(pack.get("attribution", []), ensure_ascii=False)
    for needle in ("MIT", "CC0"):
        if needle not in attribution:
            fail(f"pack.json.attribution 缺 {needle} 登记")

    # ---- docs ----
    usage = (ROOT / files.get("usage", "")).read_text(encoding="utf-8") if files.get("usage") else ""
    for cue in USAGE_CUES:
        if cue not in usage:
            fail(f"docs/usage.md 缺线索:{cue}")

    # ---- 明文 http / 本机地址 ----
    for rel in [preview_rel, host_rel, files.get("usage", ""), "SKILL.md", "README.md"]:
        if not rel:
            continue
        text = (ROOT / rel).read_text(encoding="utf-8", errors="ignore")
        if re.search(r"http://", text):
            fail(f"{rel} 里有明文 http 链接")
        if re.search(r"\b(?:localhost|127\.0\.0\.1)\b", text):
            fail(f"{rel} 里有本机地址")

    print("PASS assert_tokens spectral-glass-prism")
    print(f"  refs {checked} · 契约节点 {len(CONTRACT_IDS)}/{len(CONTRACT_IDS)} · 声明产物 {len(declared)} 个 {total_bytes} 字节")
    print(f"  engine {engine.stat().st_size} 字节(MIT vendored) · 宿主先探测后加载 · 明文 http/本机地址 0")


if __name__ == "__main__":
    main()
