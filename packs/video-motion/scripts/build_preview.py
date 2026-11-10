#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""video-motion · 外部索引卡预览生成器。

这是**索引卡**,不是内容:16 个 archetype 只登记名字与用途,零源码、零图片、零视频、
零私有工程路径。数据来自本包 `data/index.json`(由 `scripts/index_cards.json` 生成),
样式共用仓级 `scripts/meta_preview.py`。

用法:
    python packs/video-motion/scripts/build_preview.py
    python packs/video-motion/scripts/build_preview.py --check
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PACK = Path(__file__).resolve().parents[1]
REPO = PACK.parents[1]
sys.path.insert(0, str(REPO / "scripts"))
from meta_preview import meta_page, esc  # noqa: E402

DATA = PACK / "data" / "index.json"
OUT = PACK / "preview" / "index.html"


def load() -> dict:
    return json.loads(DATA.read_text(encoding="utf-8"))


def card(rec: dict, i: int) -> str:
    tag = rec["tag"]
    meta = "".join(f"<div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>" for k, v in rec.get("meta", []))
    return f"""      <article class="card" id="{esc(rec['id'])}" data-facet="{esc(tag)}">
        <div class="card-top"><span class="badge g-{esc(tag)}">{esc(rec['kind'])}</span><span class="num">{i:02d}</span></div>
        <h3>{esc(rec['name'])}</h3>
        <p class="body">{esc(rec['summary'])}</p>
        <dl>{meta}</dl>
        <p class="src">{esc(rec['source'])}</p>
      </article>"""


def build_html() -> str:
    d = load()
    cards = d["cards"]
    by_tag = {}
    for c in cards:
        by_tag.setdefault(c["tag"], []).append(c)
    chips = [("all", "全部", len(cards))] + [
        (tag, label, len(by_tag.get(tag, []))) for tag, label in d["groups"]]
    sections = [
        (tag, f"{label} · {len(by_tag.get(tag, []))} 项", d["section_notes"].get(tag, ""),
         "\n".join(card(r, i) for i, r in enumerate(by_tag.get(tag, []), 1)))
        for tag, label in d["groups"]]
    facts = (f"<b>{len(cards)}</b> 张索引卡<span class=\"sep\">/</span>"
             f"<b>{len(d['groups'])}</b> 组<span class=\"sep\">/</span>"
             "外部工程只索引不承载<span class=\"sep\">/</span>零源码零图片零视频")
    footer = ("    <p>本页只登记「有什么、管什么」,不复制外部工程任何内容;内容本体在私有工程 mv-studio,"
              "运行模型为 React + Remotion CLI,与网页 DOM/CSS 不同。</p>\n"
              "    <p>许可:外部工程私有 / UNLICENSED,渲染框架另有上游条款;取用前先确认授权。"
              "canonical_home 为空时不得臆造远端地址。</p>")
    return meta_page(
        title="Video Motion · 外部视频工程索引卡",
        lede="把一首歌排成印刷质感 MV 时,先看这张索引卡确认有哪些镜头语言与风格包;本仓不承载内容,只告诉你去哪里取。",
        facts=facts, chips=chips, sections=sections, footer=footer,
        groups=[t for t, _ in d["groups"]])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    html = build_html()
    if args.check:
        if not OUT.is_file() or OUT.read_text(encoding="utf-8") != html:
            print("FAIL --check: 预览页与 data/index.json 不同步,重跑 build_preview.py", file=sys.stderr)
            return 1
        print(f"PASS build_preview --check:{OUT.stat().st_size}B 与索引卡同步")
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8", newline="\n")
    print(f"WROTE {OUT} {len(html.encode('utf-8'))}B")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
