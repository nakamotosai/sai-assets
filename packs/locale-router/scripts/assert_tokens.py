#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""locale-router 断言:元数据 / 声明路径 / 预览引用解析 / 产物非空 / 文档与实现标记 /
决策层干跑(参数 / 深链 / 记忆 / 探测 四种来源 + 爬虫)/ 开关三态对比度实测。

禁用内容形态的判定属于仓级 scripts/gate.py(规则正本),本脚本刻意不复刻那些规则 ——
规则字面量写进源码本身就会成为被禁形态的载体,也会造成第二套口径。

决策层这一段真的把 src/locale-router.js 载进 Node 跑 decide():四种决定来源各一例 + 爬虫一例,
实测值必须与期望一致(不比对结果就没法证明四条规则还在)。Node 缺失即 FAIL。

通过 = 打印 "PASS assert_tokens locale-router" + 实测摘要,退出 0;
失败 = 把 FAIL 原因打到 stderr,退出 1。仅用标准库,Python 3.12+。
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # packs/locale-router
PACK_ID = "locale-router"
JS_REL = "src/locale-router.js"
CSS_REL = "src/locale-router.css"

REQUIRED_KEYS = (
    "schema", "id", "title", "kind", "category", "version", "license", "attribution",
    "origin", "entry", "files", "tags", "when", "not_for", "verified",
)

# docs/usage.md 里必须逐字出现的关键词(改文档别忘了同步这里)
DOC_CUES = (
    "## 什么时候用",
    "## 决策规则",
    "## 接入步骤",
    "## 参数",
    "## 与源脚本的逐条对照",
    "## 无障碍硬项",
    "## 反模式",
    "## 来源与许可",
    "?lang=",
    "navigator.languages",
    "aria-current",
    "prefers-reduced-motion",
    "dryRun",
    "storageKey",
    "rootPath",
)
# 组件侧必须逐字出现的实现标记(防止退化成「只剩一句 location.replace」或删掉降级)
JS_CUES = (
    "window.LOCALE_ROUTER_CONFIG", "navigator.languages", "localStorage", "location.replace",
    "aria-current", "headless", "python-requests", "rootPath", "dryRun", "storageKey",
)
CSS_CUES = (
    "--lr-hit", "--lr-dim", "--lr-current-ink", "--lr-ring", ":focus-visible",
    'aria-current="page"', "prefers-reduced-motion", "min-height: var(--lr-hit)",
)
PREVIEW_CUES = (
    "window.LOCALE_ROUTER_CONFIG", "dryRun: true", "data-lr-locale", "decide(",
    "localerouter:decide", "<details",
)

# 决策层:四种决定来源各一例 + 爬虫放行;期望值 = 规则手算的结果,实测值由 Node 现跑
DECISION_CASES = (
    {
        "name": "参数优先 (?lang=ja 在根路径)",
        "input": {"pathname": "/", "search": "?lang=ja", "stored": None, "current": "en",
                  "languages": ["en-US"], "robot": False},
        "expect": {"reason": "param", "action": "redirect", "to": "/ja/", "remember": "ja"},
    },
    {
        "name": "深链保留 (/zh/ 落地,无记忆)",
        "input": {"pathname": "/zh/", "search": "", "stored": None, "current": "zh",
                  "languages": ["en-US"], "robot": False},
        "expect": {"reason": "deep-link", "action": "stay", "to": None, "remember": "zh"},
    },
    {
        "name": "深链保留 (/ja/ 落地,已有记忆)",
        "input": {"pathname": "/ja/", "search": "", "stored": "en", "current": "ja",
                  "languages": ["ja-JP"], "robot": False},
        "expect": {"reason": "deep-link", "action": "stay", "to": None, "remember": None},
    },
    {
        "name": "记忆优先 (记忆=ja,探测说 zh)",
        "input": {"pathname": "/", "search": "", "stored": "ja", "current": "en",
                  "languages": ["zh-CN"], "robot": False},
        "expect": {"reason": "memory", "action": "redirect", "to": "/ja/", "remember": "ja"},
    },
    {
        "name": "探测 (无记忆,浏览器说 zh-CN)",
        "input": {"pathname": "/", "search": "", "stored": None, "current": "en",
                  "languages": ["zh-CN", "en-US"], "robot": False},
        "expect": {"reason": "detect", "action": "redirect", "to": "/zh/", "remember": "zh"},
    },
    {
        "name": "默认 (无记忆,浏览器只认 fr)",
        "input": {"pathname": "/", "search": "", "stored": None, "current": "en",
                  "languages": ["fr-FR"], "robot": False},
        "expect": {"reason": "default", "action": "stay", "to": None, "remember": "en"},
    },
    {
        "name": "爬虫放行 (headless 在根路径)",
        "input": {"pathname": "/", "search": "", "stored": None, "current": "en",
                  "languages": ["zh-CN"], "robot": True},
        "expect": {"reason": "robot", "action": "stay", "to": None, "remember": None},
    },
)

# 开关三态对比度:颜色字面量从 src/locale-router.css 现解析,不在这里复写一遍
CONTRAST_PAIRS = (
    ("静息文字 --lr-dim on --lr-bg", "--lr-dim", "--lr-bg", 4.5),
    ("悬停文字 --lr-ink on --lr-hover-bg", "--lr-ink", "--lr-hover-bg", 4.5),
    ("当前文字 --lr-current-ink on --lr-current-bg", "--lr-current-ink", "--lr-current-bg", 4.5),
    ("焦点环 --lr-ring on --lr-bg(图形档)", "--lr-ring", "--lr-bg", 3.0),
)

ATTR_RE = re.compile(r"""(?:src|href)\s*=\s*["']([^"']+)["']""")
URL_RE = re.compile(r"""url\(\s*["']?([^"']+)["']?\s*\)""")
SCHEME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9+.\-]*:")
COLOR_RE = re.compile(r"(--lr-[a-z-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;")
BAD_HEX_RE = re.compile(r"--lr-[a-z-]+\s*:\s*#(?:[0-9a-fA-F]{1,5})\b")
SCAN_EXTS = (".md", ".json", ".html", ".css", ".js", ".py")
NODE_TIMEOUT = 60.0

NODE_HARNESS = r"""
/* 决策层干跑:把包里的脚本载进 Node,按 stdlib 传入的用例各跑一次 decide()。 */
var fs = require("fs");
var code = fs.readFileSync(process.argv[2], "utf8");
(0, eval)(code);
var R = globalThis.LocaleRouter;
if (!R || typeof R.decide !== "function") {
  console.error("LocaleRouter.decide 不存在");
  process.exit(2);
}
var cases = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
var out = cases.map(function (c) {
  var d = R.decide(c.input);
  return { name: c.name, reason: d.reason, action: d.action, to: d.to, remember: d.remember, robot: d.robot };
});
process.stdout.write(JSON.stringify(out));
"""


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
    if not pack.get("when") or "?lang=" not in str(pack["when"]):
        fail("when 必须保留四条规则的原话(含 ?lang=)")
    if not pack.get("not_for"):
        fail("not_for 不能为空")

    origin = pack["origin"]
    if not isinstance(origin, dict) or not origin.get("project") or not origin.get("path"):
        fail("origin 必须有 project 与 path")
    opath = str(origin["path"])
    if re.match(r"^([A-Za-z]:|[\\/]{1,2})", opath):
        fail(f"origin.path 必须是相对路径:{opath!r}")
    files = pack["files"]
    if not isinstance(files, dict) or not files:
        fail("files 必须是非空对象")
    allowed = {"tokens", "css", "src", "upstream", "usage", "assert", "preview"}
    extra = sorted(set(files) - allowed)
    if extra:
        fail(f"files 用了 schema 之外的键:{', '.join(extra)}")
    verified = pack["verified"]
    if not isinstance(verified, dict) or not verified.get("how") or not verified.get("evidence"):
        fail("verified 必须有 how 与 evidence")
    if "assert_tokens.py" not in str(verified["how"]):
        fail("verified.how 必须指向本包断言")
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


# --------------------------------------------------------------------------- #
# 4 · 决策层干跑(Node)
# --------------------------------------------------------------------------- #

def run_decisions() -> list[dict]:
    node = shutil.which("node")
    if not node:
        fail("决策层断言需要 node(未在 PATH 上找到);它把 src/locale-router.js 载进 Node 跑 decide()")
    payload = [{"name": c["name"], "input": c["input"]} for c in DECISION_CASES]
    with tempfile.TemporaryDirectory(prefix="locale-router-") as tmp:
        tmp_dir = Path(tmp)
        harness = tmp_dir / "harness.js"
        harness.write_text(NODE_HARNESS, encoding="utf-8")
        cases = tmp_dir / "cases.json"
        cases.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        proc = subprocess.run(
            [node, str(harness), str(ROOT / JS_REL), str(cases)],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=NODE_TIMEOUT,
        )
    if proc.returncode != 0:
        tail = "\n".join((proc.stderr or proc.stdout or "").strip().splitlines()[-8:])
        fail(f"node 干跑 {JS_REL} 失败(退出码 {proc.returncode}):{tail}")
    try:
        got = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        fail(f"node 干跑输出不是 JSON:{exc} / {(proc.stdout or '')[:200]!r}")
    if len(got) != len(DECISION_CASES):
        fail(f"node 干跑返回 {len(got)} 条,期望 {len(DECISION_CASES)} 条")
    for case, row in zip(DECISION_CASES, got):
        for key, want in case["expect"].items():
            if row.get(key) != want:
                fail(f"决策不符:{case['name']} 的 {key} 实测 {row.get(key)!r},期望 {want!r}")
    return got


# --------------------------------------------------------------------------- #
# 5 · 对比度实测(颜色字面量从 CSS 现解析)
# --------------------------------------------------------------------------- #

def channel(value: int) -> float:
    c = value / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_color: str) -> float:
    m = re.match(r"^#([0-9a-fA-F]{6})$", hex_color)
    if not m:
        fail(f"不是 6 位 hex:{hex_color!r}")
    r, g, b = (int(m.group(1)[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def contrast(fg: str, bg: str) -> float:
    a, b = luminance(fg), luminance(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def check_contrast() -> list[tuple[str, float, float]]:
    body = read(CSS_REL)
    colors = dict(COLOR_RE.findall(body))
    bad = BAD_HEX_RE.search(body)
    if bad:
        fail(f"{CSS_REL} 里有非 6 位 hex 色值:{bad.group(0)}")
    out: list[tuple[str, float, float]] = []
    for label, fg_key, bg_key, floor in CONTRAST_PAIRS:
        for key in (fg_key, bg_key):
            if key not in colors:
                fail(f"{CSS_REL} 缺颜色变量:{key}")
        ratio = contrast(colors[fg_key], colors[bg_key])
        if ratio < floor:
            fail(f"对比度不足:{label} = {ratio:.2f}:1 < {floor}:1")
        out.append((label, ratio, floor))
    return out


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
    check_cues(JS_REL, JS_CUES, "实现标记")
    check_cues(CSS_REL, CSS_CUES, "实现标记")
    preview = read(str(preview_rel))
    for cue in PREVIEW_CUES:
        if cue not in preview:
            fail(f"{preview_rel} 缺标记:{cue}")

    # 5 · 决策层干跑:四种决定来源 + 爬虫,实测对期望
    rows = run_decisions()
    sources = {row["reason"] for row in rows}
    for need in ("param", "deep-link", "memory", "detect", "robot"):
        if need not in sources:
            fail(f"决策层用例没有覆盖到 {need}")

    # 6 · 开关三态对比度
    ratios = check_contrast()

    # 禁用内容形态由仓级 scripts/gate.py 判定(本脚本不复刻规则)
    scanned = count_scannable()

    all_files = [p for p in ROOT.rglob("*") if p.is_file()]
    pack_bytes = sum(p.stat().st_size for p in all_files)

    print(f"PASS assert_tokens {PACK_ID}")
    print(
        f"  引用 {len(refs)} 个(包内 {local_n} / https {https_n})· 声明路径 {len(declared)} 个全部存在"
        f" · src 文件 {src_n} 个({src_bytes} 字节)· 包内 {len(all_files)} 文件 {pack_bytes} 字节"
    )
    print(f"  决策层(node 干跑 {JS_REL} · decide() 输入 {len(rows)} 例,全部与期望一致):")
    for row in rows:
        print(
            f"    {row['name']}: reason={row['reason']} action={row['action']}"
            f" to={row['to'] or '-'} remember={row['remember'] or '-'}"
        )
    print("  开关对比度实测:")
    for label, ratio, floor in ratios:
        print(f"    {label} = {ratio:.2f}:1(下限 {floor}:1)")
    print(
        f"  docs 关键词 {len(DOC_CUES)}/{len(DOC_CUES)} · 形态闸交给 scripts/gate.py"
        f"(本包 {scanned} 个文本文件在其扫描面内)"
    )


if __name__ == "__main__":
    main()
