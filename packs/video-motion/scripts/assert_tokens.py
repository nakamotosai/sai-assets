#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""video-motion 包断言:索引卡与预览页同步、零外部内容、零本机路径。

外部工程是私有 / UNLICENSED,本包按契约只做索引:
  1) data/index.json 22 张卡 id 唯一、字段齐、groups 覆盖齐;
  2) preview/index.html 每张卡都在、无外链子资源、无本机路径、有深浅切换;
  3) 包内不出现外部工程的源码/图片/视频/本机路径。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PACK = Path(__file__).resolve().parents[1]
INDEX = PACK / "data" / "index.json"
PREVIEW = PACK / "preview" / "index.html"
EXPECT = 22
fails: list[str] = []


def fail(msg: str) -> None:
    fails.append(msg)


def load(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"{path.name}: 读取失败 {exc}")
        return None


d = load(INDEX)
if isinstance(d, dict):
    cards = d.get("cards") or []
    print(f"[cards] {len(cards)} 张(期望 {EXPECT})")
    if len(cards) != EXPECT:
        fail(f"索引卡 {len(cards)} != {EXPECT}")
    ids = [c.get("id") for c in cards]
    if len(set(ids)) != len(ids) or any(not x for x in ids):
        fail("索引卡 id 重复/为空")
    groups = {g for g, _ in d.get("groups", [])}
    for c in cards:
        for k in ("id", "name", "tag", "kind", "summary", "meta", "source"):
            if not c.get(k):
                fail(f"{c.get('id')}: 字段 {k} 缺失/为空")
        if c.get("tag") not in groups:
            fail(f"{c.get('id')}: tag {c.get('tag')} 不在 groups")
    print(f"[groups] {len(groups)} 组 · 每张卡字段齐")
else:
    fail("data/index.json 不是对象")

if PREVIEW.is_file():
    html = PREVIEW.read_text(encoding="utf-8")
    ncards = html.count('<article class="card"')
    if ncards != EXPECT:
        fail(f"preview 卡片 {ncards} != {EXPECT}")
    if isinstance(d, dict):
        missing = [c["id"] for c in d.get("cards", []) if f'id="{c["id"]}"' not in html]
        if missing:
            fail(f"preview 缺卡片 {missing[:5]}")
    for pat, why in ((r'<script[^>]+src="https?://', "外链脚本"),
                     (r'<link[^>]+href="https?://', "外链样式"),
                     (r'<img[^>]+src="https?://', "外链图片"),
                     (r'<video[^>]+src=', "视频文件"),
                     (r'<audio[^>]+src=', "音频文件")):
        if re.search(pat, html):
            fail(f"preview 含{why}(本包只索引,不承载媒体)")
    for need, why in (('id="tt"', "深浅切换按钮"), ("切换深浅配色", "按钮可访问名"),
                      ('class="skip"', "skip link"), ("prefers-reduced-motion", "减少动效分支")):
        if need not in html:
            fail(f"preview 缺{why}")
    print(f"[preview] {len(html.encode()):d}B · 卡片 {ncards} 张 · 零外链子资源 · 零音视频")
else:
    fail("preview/index.html 缺失")

# 形态规则:本机盘符路径 / 内网地址(断言脚本自身不留可被命中的字面量)
_COLON = chr(58)
_BS = chr(92)
_SEP = "[" + _BS + _BS + "/" + "]"
_PATTERNS = [("drive-path", "[A-Za-z]" + _COLON + _SEP + "(?!" + _SEP + ")", "本机盘符路径"), ("cgnat", r"100\.\d+\.\d+\.\d+", "内网 CGNAT 地址")]
for path in sorted(p for p in PACK.rglob("*") if p.is_file() and p.suffix in {".json", ".md", ".html", ".py"}):
    for lineno, line in enumerate(path.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
        for rid, pat, why in _PATTERNS:
            if re.search(pat, line):
                fail(f"{path.relative_to(PACK).as_posix()}:{lineno}: [{rid}] {why}")
print("[clean] 本机路径/内网标识扫描完成")

if fails:
    for f in fails:
        print("FAIL:", f, file=sys.stderr)
    print(f"FAIL assert_tokens video-motion — {len(fails)} 条", file=sys.stderr)
    sys.exit(1)
print(f"PASS assert_tokens video-motion — 索引卡 {EXPECT} 张 · preview 同步 · 零外部内容 · 零本机路径")
