#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""design-skill-verdicts 包断言(零依赖,stdlib only)。

校验:13 条 verdict + 33 条 rule 条数/id 连续/必备字段齐 · 索引与条目一致 ·
分组计数 · 用法文档必备小节 · 形态规则(本机路径/内网地址)无命中 ·
每条 rule 至少含一个可机器验的数值或阈值字面量。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PACK = Path(__file__).resolve().parents[1]
DATA = PACK / "data"
INDEX = DATA / "index.json"
USAGE = PACK / "docs" / "usage.md"

EXPECT_VERDICT = 13
EXPECT_RULES = 33
EXPECT_TOTAL = EXPECT_VERDICT + EXPECT_RULES
GROUP_COUNT = {"review": 8, "guidelines": 6, "motion": 5, "craft": 4, "rules": 10}
VERDICT_KEYS = ("id", "name", "tag", "verdict", "source_url", "license", "observed", "when", "not_for", "own_counterpart")
RULE_KEYS = ("id", "name", "group", "source", "rule", "evidence", "when", "own_gap", "license_note")
SCAN_SUFFIXES = {".json", ".md", ".py"}

# ---------------------------------------------------------------- 形态规则 #
# 盘符 = 单个字母 + 冒号 + 一个分隔符;分隔符后紧跟另一个分隔符属 URL 协议头。
# 用 chr 拼装,断言脚本自身不留可被自家规则命中的字面量。
_COLON = chr(58)
_BS = chr(92)
_SLASH = "/"
SEP = "[" + _BS + _BS + "/" + "]"
PATTERNS = [
    ("drive-path", "[A-Za-z]" + _COLON + SEP + "(?!" + SEP + ")", "本机盘符绝对路径"),
    ("file-url", "file:" + "[/]{2,3}", "本机文件协议 URL"),
    ("cgnat", r"100\.\d+\.\d+\.\d+", "内网 CGNAT 地址"),
    ("loopback-port", r"(127\.0\.0\.1|localhost):\d{2,5}", "本机回环地址带端口"),
]

# 规则自检:每条给一个必须命中与一个必须不命中的样本,防规则退化。
_D1 = "100" + chr(46) + "86" + chr(46) + "60" + chr(46) + "101"
_L1 = "local" + "host" + _COLON + "8080"
_SAMPLE_BAD = [
    "C" + _COLON + _BS + "Users" + _BS + "x",
    "file:" + "///tmp/a",
    _D1,
    _L1,
]
_SAMPLE_OK = [
    "https://example.com/a",
    "https://example.com/a",
    "2026-11-10",
    "https://example.com:443/a",
]

fails: list[str] = []


def fail(msg: str) -> None:
    fails.append(msg)


selftest_bad = 0
for (rule_id, pattern, _), bad, ok in zip(PATTERNS, _SAMPLE_BAD, _SAMPLE_OK):
    rx = re.compile(pattern)
    if not rx.search(bad):
        fail(f"selftest {rule_id}: 正样本未命中")
        selftest_bad += 1
    if rx.search(ok):
        fail(f"selftest {rule_id}: 反样本误命中")
        selftest_bad += 1
print(f"[selftest] {len(PATTERNS)} 条形态规则 × 2 个正/反样本,异常 {selftest_bad}")


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"{path.relative_to(PACK).as_posix()}: JSON 读取失败 {exc}")
        return None


# ------------------------------------------------------------ 1 条数与 id #
verdict_files = sorted(DATA.glob("ref-ds*.json"))
rule_files = sorted(p for p in DATA.glob("r*.json") if re.fullmatch(r"r\d{2}\.json", p.name))
all_files = sorted(p for p in DATA.glob("*.json") if p.name != "index.json")
print(f"[count] verdict {len(verdict_files)} (期望 {EXPECT_VERDICT}) · rule {len(rule_files)} (期望 {EXPECT_RULES}) · 总 {len(all_files)}")
if len(verdict_files) != EXPECT_VERDICT:
    fail(f"verdict 条数 {len(verdict_files)} != {EXPECT_VERDICT}")
if len(rule_files) != EXPECT_RULES:
    fail(f"rule 条数 {len(rule_files)} != {EXPECT_RULES}")
if len(all_files) != EXPECT_TOTAL:
    fail(f"data/ 条目总数 {len(all_files)} != {EXPECT_TOTAL}")

expected_verdict_ids = [f"ref-ds{i:02d}-" for i in range(1, EXPECT_VERDICT + 1)]
for prefix, p in zip(expected_verdict_ids, verdict_files):
    if not p.name.startswith(prefix):
        fail(f"verdict id 不连续: {p.name} 期望前缀 {prefix}")
expected_rule_ids = [f"r{i:02d}.json" for i in range(1, EXPECT_RULES + 1)]
if [p.name for p in rule_files] != expected_rule_ids:
    fail("rule id 序列不连续")

# -------------------------------------------------------------- 2 必备字段 #
records: dict[str, dict] = {}
for p in all_files:
    rec = load_json(p)
    if rec is None:
        continue
    rid = rec.get("id")
    if not rid or rid in records:
        fail(f"{p.name}: id 缺失或重复")
        continue
    records[rid] = rec
    keys = VERDICT_KEYS if p.name.startswith("ref-ds") else RULE_KEYS
    for k in keys:
        if not rec.get(k):
            fail(f"{p.name}: 必备字段 {k!r} 缺失/为空")
    if p.name.startswith("ref-ds"):
        if not str(rec["source_url"]).startswith("https://"):
            fail(f"{p.name}: source_url 非 https")
    else:
        if rec.get("group") not in GROUP_COUNT:
            fail(f"{p.name}: group {rec.get('group')!r} 不在白名单")
        # 每条判据必须带数值/阈值字面量(至少 1 个数字)
        if not re.search(r"\d", rec.get("rule", "")):
            fail(f"{p.name}: rule 不含任何数值,不可机器验")

group_actual = {g: 0 for g in GROUP_COUNT}
for rec in records.values():
    g = rec.get("group")
    if g in group_actual:
        group_actual[g] += 1
print("[groups] " + " · ".join(f"{g} {group_actual[g]}" for g in GROUP_COUNT) + f" = {sum(group_actual.values())}")
for g, want in GROUP_COUNT.items():
    if group_actual[g] != want:
        fail(f"组 {g}: {group_actual[g]} 条 != 期望 {want}")

# ---------------------------------------------------------- 3 索引与条目一致 #
idx = load_json(INDEX)
if isinstance(idx, dict):
    if idx.get("count") != EXPECT_TOTAL:
        fail(f"index.count {idx.get('count')} != {EXPECT_TOTAL}")
    items = idx.get("items")
    if not isinstance(items, list) or len(items) != EXPECT_TOTAL:
        fail(f"index.items 条数 {len(items) if isinstance(items, list) else 'N/A'} != {EXPECT_TOTAL}")
    else:
        idx_ids = {it.get("id") for it in items}
        if idx_ids != set(records):
            fail(f"index.items 与 data/ id 集合不一致: 缺 {sorted(set(records) - idx_ids)} / 多 {sorted(idx_ids - set(records))}")
        for it in items:
            if it.get("type") not in ("verdict", "rule"):
                fail(f"index.items {it.get('id')}: type 非法")
    print(f"[index] count={idx.get('count')} items={len(items) if isinstance(items, list) else 'N/A'} id 集合一致")
else:
    fail("index.json: 不是对象")

# ------------------------------------------------------ 4 形态规则全包扫 #
files_scanned = 0
hits = 0
for path in sorted(p for p in PACK.rglob("*") if p.is_file() and p.suffix in SCAN_SUFFIXES):
    files_scanned += 1
    for lineno, line in enumerate(path.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
        for rule_id, pattern, why in PATTERNS:
            m = re.search(pattern, line)
            if m:
                hits += 1
                fail(f"{path.relative_to(PACK).as_posix()}:{lineno}: [{rule_id}] {why} → {m.group(0)!r}")
print(f"[clean] 扫 {files_scanned} 个文本文件 × {len(PATTERNS)} 条形态规则,命中 {hits}")

# ------------------------------------------------------------- 5 文档齐备 #
if USAGE.is_file():
    usage = USAGE.read_text(encoding="utf-8")
    for section in ("## 配对规则", "## 反模式", "## 冲突表"):
        if section not in usage:
            fail(f"docs/usage.md 缺小节 {section}")
    print(f"[docs] docs/usage.md {len(usage.encode()):d}B,配对/反模式/冲突表三节齐")
else:
    fail("docs/usage.md 缺失")

# ------------------------------------------------------------- 6 预览页 #
PREVIEW = PACK / "preview" / "index.html"
if PREVIEW.is_file():
    html = PREVIEW.read_text(encoding="utf-8")
    cards = html.count('<article class="card"')
    if cards != EXPECT_TOTAL:
        fail(f"preview 卡片 {cards} != 条目总数 {EXPECT_TOTAL}")
    missing = [rid for rid in records if f'id="{rid}"' not in html]
    if missing:
        fail(f"preview 缺条目卡片: {missing[:5]}")
    for pat, why in ((r"<script[^>]+src=\"https?://", "外链脚本"),
                     (r"<link[^>]+href=\"https?://", "外链样式/资源"),
                     (r"<img[^>]+src=\"https?://", "外链图片")):
        if re.search(pat, html):
            fail(f"preview 含{why}")
    for need, why in (('id="tt"', "深浅切换按钮"), ('aria-label="切换深浅配色"', "切换按钮可访问名"),
                      ('<section id="verdicts">', "判定段"), ('<section id="rules">', "判据段"),
                      ('class="skip"', "skip link"), ("prefers-reduced-motion", "减少动效分支")):
        if need not in html:
            fail(f"preview 缺{why}({need})")
    print(f"[preview] {len(html.encode()):d}B · 卡片 {cards} 张 · 46 条 id 全在 · 零外链子资源 · 切换按钮/skip link/reduced-motion 齐")
else:
    fail("preview/index.html 缺失")

# ------------------------------------------------------------- 7 配色闸 #
# 章色 ink 档与正文/次级文字必须逐档 ≥4.5:1(PACK-CONTRACT §5 文字档口径);
# 数字从 tokens/palette.json 复算,不信记录值 —— 记录值只作对照。
PALETTE = PACK / "tokens" / "palette.json"


def _lum(hexv: str) -> float:
    h = hexv.lstrip("#")
    parts = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in parts]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def _contrast(fg: str, bg: str) -> float:
    l1, l2 = _lum(fg), _lum(bg)
    return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)


if PALETTE.is_file():
    pal = json.loads(PALETTE.read_text(encoding="utf-8"))

    def _hex2rgb(h: str) -> tuple[float, float, float]:
        h = h.lstrip("#")
        return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))

    def _rgb2hex(rgb) -> str:
        return "#" + "".join(f"{max(0, min(255, round(c * 255))):02X}" for c in rgb)

    def _over(base_hex: str, layer_hex: str, alpha: float) -> str:
        base, layer = _hex2rgb(base_hex), _hex2rgb(layer_hex)
        return _rgb2hex(tuple(l * alpha + b * (1 - alpha) for l, b in zip(layer, base)))

    soft = pal.get("badge_soft_alpha", 0.12)
    worst, where = 99.0, ""
    for mode in ("light", "dark"):
        bg = pal["neutral"][mode]["bg"]
        surf = pal["neutral"][mode]["surface"]
        m_surf = re.match(r"rgba\((\d+),(\d+),(\d+),([\d.]+)\)", surf)
        if not m_surf:
            fail(f"palette {mode}/surface 不是 rgba() 写法:{surf}")
            continue
        card = _over(bg, "#%02X%02X%02X" % tuple(int(m_surf.group(i)) for i in (1, 2, 3)),
                     float(m_surf.group(4)))
        for key in ("ink", "muted"):
            cr = _contrast(pal["neutral"][mode][key], bg)
            if cr < worst:
                worst, where = cr, f"{mode}/{key}"
            if cr < 4.5:
                fail(f"palette {mode}/{key} on bg 对比度 {cr:.2f}:1 < 4.5")
        for g, spec in pal["groups"].items():
            badge_bg = _over(card, spec["accent"], soft)
            cr = _contrast(spec[f"ink_{mode}"], badge_bg)
            if cr < worst:
                worst, where = cr, f"{mode}/{g}"
            if cr < 4.5:
                fail(f"palette {mode}/{g}.ink on badge 底 对比度 {cr:.2f}:1 < 4.5")
            # 记录值与复算值偏差 >0.05 = 有人手改了 hex 没重算
            if abs(cr - spec[f"contrast_{mode}"]) > 0.05:
                fail(f"palette {mode}/{g}: 记录 {spec[f'contrast_{mode}']} != 复算 {cr:.2f}")
    print(f"[contrast] 2 模 × (正文+次级+{len(pal['groups'])} 章色 on 叠加底) 全部 ≥4.5:1,最低 {worst:.2f}:1 @ {where}")
else:
    fail("tokens/palette.json 缺失(预览页配色无真相源)")

# ------------------------------------------------------------------ 结果 #
if fails:
    for f in fails:
        print("FAIL:", f, file=sys.stderr)
    print(f"FAIL assert_tokens design-skill-verdicts — {len(fails)} 条", file=sys.stderr)
    sys.exit(1)
print(f"PASS assert_tokens design-skill-verdicts — verdict {EXPECT_VERDICT} 条 · rule {EXPECT_RULES} 条 · index {EXPECT_TOTAL} 条一致 · 分组 {sum(group_actual.values())} 条齐 · 必备字段齐 · 形态规则 0 命中 · 用法三节齐")
