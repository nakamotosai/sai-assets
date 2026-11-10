#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""references · 预览页生成器:40 条外部观测逐条摊开成卡片。

数据唯一真相源 = data/*.json;页面 = 派生物,改数据必须重跑。
样式与配色走仓级 scripts/meta_preview.py(与 video-motion / design-skill-verdicts 共用一份)。

用法:
    python packs/references/scripts/build_preview.py
    python packs/references/scripts/build_preview.py --check
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

DATA = PACK / "data"
OUT = PACK / "preview" / "index.html"

GROUPS = [("web", "网页", 6), ("print", "纸媒", 7), ("three", "三维", 7),
          ("news", "新闻", 15), ("swiss", "瑞士", 5)]
GROUP_CN = {g: cn for g, cn, _ in GROUPS}
GROUP_LINK = {"web": "#main", "print": "print", "three": "three", "news": "news", "swiss": "swiss"}


def load() -> list[dict]:
    return [json.loads(p.read_text(encoding="utf-8"))
            for p in sorted(DATA.glob("*.json")) if p.name != "index.json"]


def card(rec: dict, i: int) -> str:
    tag = rec["tag"]
    dna = rec.get("colorsDNA")
    sw = ""
    if isinstance(dna, dict) and dna:
        sw = ('<div class="swatches" aria-label="本条归纳过的配色">' +
              "".join(f'<i style="background:{esc(v)}" title="{esc(k)}: {esc(v)}"></i>'
                      for k, v in dna.items() if isinstance(v, str)) + "</div>")
    theme = rec.get("matchTheme") or "all"
    return f"""      <article class="card" id="{esc(rec['id'])}" data-facet="{esc(tag)}">
        <div class="card-top"><span class="badge g-{esc(tag)}">{esc(GROUP_CN.get(tag, tag))} · {esc(tag)}</span><span class="num">{i:02d}</span></div>
        <h3>{esc(rec['name'])}</h3>
        <p class="body">{esc(rec['layout'])}</p>
        {sw}
        <dl>
          <div><dt>观测</dt><dd>{esc(rec['observed'])}</dd></div>
          <div><dt>何时用</dt><dd>{esc(rec['when'])}</dd></div>
          <div><dt>联动主题</dt><dd>{esc(theme)}</dd></div>
        </dl>
        <p class="src"><a href="{esc(rec['source_url'])}" target="_blank" rel="noopener">回源核对 ↗</a> · {esc(rec['id'])}.json</p>
      </article>"""


def build_html() -> str:
    records = load()
    by_group = {g: [r for r in records if r["tag"] == g] for g, _, _ in GROUPS}
    chips = [("all", "全部", len(records))] + [(g, cn, len(by_group[g])) for g, cn, _ in GROUPS]
    sections = [
        (g, f"{cn} · {len(by_group[g])} 条观测",
         f"tag={g};structure 骨架写在 layout,出处与许可状态写在 observed。",
         "\n".join(card(r, i) for i, r in enumerate(by_group[g], 1)))
        for g, cn, _ in GROUPS]
    facts = (f"<b>{len(records)}</b> 条外部观测<span class=\"sep\">/</span>"
             "<b>5</b> 组<span class=\"sep\">/</span>零代码零原图<span class=\"sep\">/</span>"
             "数据是真相源,页面是派生物")
    footer = ("    <p>本页由 <code>scripts/build_preview.py</code> 从 <code>data/*.json</code> 生成;改数据必须重跑,包内断言会核对页面与数据同步。</p>\n"
              "    <p>本包只写观测与结论:禁搬运原站 HTML/CSS/JS、原图、标题正文与 logo;要色值去 <code>themes</code> 包的 tokens/。</p>")
    return meta_page(
        title="外部站点观测 · 40 条结构/版式/排印依据",
        lede="选版式、定字号、定网格之前先读这 40 条:别人怎么排、什么时候该翻它。全部是观测结论,零代码、零原图。",
        facts=facts, chips=chips, sections=sections, footer=footer,
        groups=[g for g, _, _ in GROUPS])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    html = build_html()
    if args.check:
        if not OUT.is_file() or OUT.read_text(encoding="utf-8") != html:
            print("FAIL --check: 预览页与 data/ 不同步,重跑 build_preview.py", file=sys.stderr)
            return 1
        print(f"PASS build_preview --check:{OUT.stat().st_size}B 与 data/ 同步")
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8", newline="\n")
    print(f"WROTE {OUT} {len(html.encode('utf-8'))}B")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
