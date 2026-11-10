#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""design-skill-verdicts · 预览页生成器(数据是唯一真相源,页面是派生物)。

读 `data/*.json`,写出自包含的 `preview/index.html`:
  - 13 条 verdict 与 33 条 rule 全部逐条摊开成卡片(一个个摆出来,可筛选)
  - 零外部子资源(无字体 CDN、无图片、无外链脚本),深浅双模带可见切换按钮
  - 配色取 `skill://design-system` §2.5 和色六景 · 纸白/炭黑;六个分组各取一章色

用法:
    python packs/design-skill-verdicts/scripts/build_preview.py
    python packs/design-skill-verdicts/scripts/build_preview.py --check   # 只验同步,不写盘

改 `data/*.json` 后必须重跑本脚本,否则包内断言会报「页面与数据不同步」。
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PACK = Path(__file__).resolve().parents[1]
DATA = PACK / "data"
OUT = PACK / "preview" / "index.html"

# 分组 → 中文名;章色与 ink 档在 tokens/palette.json(逐档实测对比度,断言会复算)
GROUPS = [
    ("review", "审查"),
    ("guidelines", "审计"),
    ("motion", "动效"),
    ("craft", "细节"),
    ("rules", "规则库"),
]
GROUP_LABEL = {g: label for g, label in GROUPS}
BADGE_KEYS = ["verdict"] + [g for g, _ in GROUPS]
PALETTE = json.loads((PACK / "tokens" / "palette.json").read_text(encoding="utf-8"))

CSS_TEMPLATE = """/* 和色六景 · 纸白 / 炭黑(skill://design-system §2.5) */
{root_tokens}
{dark_tokens}
*{box-sizing:border-box}
html,body{margin:0}
body{
  background:var(--bg); color:var(--ink);
  font-family:"Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,-apple-system,"Segoe UI",sans-serif;
  font-size:14px; font-weight:400; line-height:1.68;
  font-variant-numeric:tabular-nums;
  -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;
}
a{color:inherit; text-decoration-color:var(--line-2); text-underline-offset:3px}
a:hover{text-decoration-color:var(--muted)}
:focus-visible{outline:2px solid var(--accent); outline-offset:2px}
.skip{position:absolute; left:-9999px; top:8px; padding:8px 16px; background:var(--bg); border:1px solid var(--line-2); border-radius:8px}
.skip:focus{left:16px; z-index:9}
.wrap{max-width:1180px; margin:0 auto; padding:40px 24px 64px}
h1,h2,h3{margin:0; font-weight:600; line-height:1.28}
h1{font-size:34px; line-height:1.2}
h2{font-size:22px}
h3{font-size:17px}
p{margin:0}
.head{display:flex; align-items:flex-start; gap:16px; justify-content:space-between}
.lede{margin-top:12px; max-width:72ch; color:var(--muted)}
.facts{margin-top:16px; font-size:13px; color:var(--muted)}
.facts b{color:var(--ink); font-weight:600}
.facts .sep{margin:0 8px; color:var(--line-2)}
.tt{
  flex:none; width:44px; height:44px; display:grid; place-items:center;
  background:transparent; border:0; color:var(--ink); border-radius:8px; cursor:pointer;
  transition:opacity 120ms ease-out;
}
.tt:hover{opacity:.72}
.tt:active{opacity:.55}
.sun,.moon{fill:none; stroke:currentColor; stroke-width:1.6; stroke-linecap:round}
html[data-theme=dark] .sun{display:none}
html:not([data-theme=dark]) .moon{display:none}
@media (prefers-color-scheme: dark){
  html:not([data-theme]) .sun{display:none}
  html:not([data-theme]) .moon{display:block}
}
.facets{position:sticky; top:0; z-index:5; background:var(--bg); padding:16px 0 8px; margin-top:24px; border-bottom:1px solid var(--line)}
.chips{display:flex; flex-wrap:wrap; gap:8px; list-style:none; margin:0; padding:0}
.chip{
  min-height:44px; padding:0 16px; display:inline-flex; align-items:center; gap:8px;
  background:transparent; border:1px solid var(--line-2); border-radius:8px;
  color:var(--muted); font:inherit; font-size:13px; font-weight:500; cursor:pointer;
}
.chip:hover{color:var(--ink)}
.chip[aria-pressed=true]{background:var(--surface); border-color:var(--ink); color:var(--ink)}
.chip .n{font-weight:600}
.shown{margin-top:8px; font-size:12px; color:var(--muted)}
section{margin-top:32px}
section + section{margin-top:96px}
.sec-head{display:flex; align-items:baseline; gap:16px; flex-wrap:wrap; margin-bottom:24px}
.sec-head p{color:var(--muted); font-size:13px}
.grid{display:grid; gap:16px; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); align-items:start}
.card{
  background:var(--surface); border:1px solid var(--line); border-radius:12px;
  padding:16px; box-shadow:var(--shadow);
}
.card[hidden]{display:none}
.card-top{display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px}
.badge{
  display:inline-flex; align-items:center; min-height:24px; padding:0 8px; border-radius:8px;
  font-size:12px; font-weight:500; border:1px solid var(--g-line);
  background:var(--g-soft); color:var(--g-ink);
}
.num{font-size:12px; color:var(--muted); font-weight:400}
.card p.body{margin-top:8px; max-width:68ch; line-height:1.68}
.card dl{margin:16px 0 0; display:grid; gap:8px}
.card dl div{display:grid; grid-template-columns:64px 1fr; gap:8px}
.card dt{font-size:12px; color:var(--muted)}
.card dd{margin:0; font-size:13px; color:var(--ink)}
.card .src{margin-top:16px; font-size:12px; color:var(--muted)}
{badge_css()}
footer{margin-top:64px; padding-top:24px; border-top:1px solid var(--line); font-size:12px; color:var(--muted); max-width:68ch}
@media (prefers-reduced-motion: reduce){ *{transition:none !important} }
"""

JS = """(function(){
  var K="dsv-theme", root=document.documentElement, btn=document.getElementById("tt");
  var forced=(new URLSearchParams(location.search).get("theme")||"").replace(/[^a-z]/g,"");
  try{var v=forced||localStorage.getItem(K); if(v) root.setAttribute("data-theme", v);}catch(e){}
  btn.hidden=false;
  btn.addEventListener("click", function(){
    var dark = root.getAttribute("data-theme")==="dark" ||
      (!root.hasAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var next = dark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try{ localStorage.setItem(K, next); }catch(e){}
  });
  var cards=[].slice.call(document.querySelectorAll(".card")), shown=document.getElementById("shown");
  document.querySelectorAll(".chip").forEach(function(chip){
    chip.addEventListener("click", function(){
      var f=chip.dataset.facet, n=0;
      document.querySelectorAll(".chip").forEach(function(c){ c.setAttribute("aria-pressed", String(c===chip)); });
      cards.forEach(function(card){
        var ok = f==="all" || card.dataset.facet===f;
        card.hidden = !ok; if(ok) n++;
      });
      shown.textContent = "显示 " + n + " / " + cards.length + " 条";
    });
  });
})();
"""


def badge_css() -> str:
    """逐组出三档:原章色(--g)、文字 ink 档(--g-ink)、浅底与描边;浅/深/系统深三处都覆盖。"""
    lines = []
    for g in BADGE_KEYS:
        spec = PALETTE["groups"][g]
        r, gg, b = (int(spec["accent"][i:i + 2], 16) for i in (1, 3, 5))
        lines.append(
            f".g-{g}{{--g:{spec['accent']}; --g-soft:rgba({r},{gg},{b},0.12);"
            f" --g-line:rgba({r},{gg},{b},0.28);"
            f" --g-ink:{spec['ink_light']}}}")
        lines.append(f'html[data-theme=dark] .g-{g}{{--g-ink:{spec["ink_dark"]}}}')
        lines.append(
            f"@media (prefers-color-scheme: dark){{ html:not([data-theme]) .g-{g}"
            f'{{--g-ink:{spec["ink_dark"]}}} }}')
    return "\n".join(lines)


SHADOW = {"light": "0 1px 2px rgba(26,26,22,.06), 0 12px 28px -18px rgba(26,26,22,.28)",
          "dark": "0 1px 2px rgba(0,0,0,.4), 0 16px 32px -20px rgba(0,0,0,.7)"}


def token_block(selector: str, mode: str) -> str:
    """从 tokens/palette.json 渲染一份 token 块;浅/深/系统深三份同源,禁手抄第二套色值。"""
    n = PALETTE["neutral"][mode]
    a = PALETTE["accent"]
    return (
        selector + "{\n"
        f"  --bg:{n['bg']}; --ink:{n['ink']}; --muted:{n['muted']}; --surface:{n['surface']};\n"
        f"  --line:{n['line']}; --line-2:{n['line2']};\n"
        f"  --c1:{a['c1']}; --c2:{a['c2']}; --c3:{a['c3']}; --c4:{a['c4']}; --c5:{a['c5']}; --c6:{a['c6']};\n"
        f"  --accent:var(--c3);\n  --shadow:{SHADOW[mode]};\n  color-scheme:{mode};\n}}"
    )


def esc(text: str) -> str:
    return (str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


def load() -> tuple[list[dict], list[dict], dict]:
    verdicts, rules = [], []
    for path in sorted(DATA.glob("ref-ds*.json")):
        verdicts.append(json.loads(path.read_text(encoding="utf-8")))
    for path in sorted(DATA.glob("r*.json")):
        if path.name.startswith("ref-"):
            continue
        rules.append(json.loads(path.read_text(encoding="utf-8")))
    index = json.loads((DATA / "index.json").read_text(encoding="utf-8"))
    return verdicts, rules, index


def verdict_card(rec: dict, i: int) -> str:
    kind = "收" if rec["verdict"].startswith("收") else "只记观测"
    return f"""      <article class="card" id="{esc(rec['id'])}" data-facet="verdict" data-kind="{esc(kind)}">
        <div class="card-top"><span class="badge g-verdict">{esc(rec['verdict'])}</span><span class="num">{i:02d}</span></div>
        <h3>{esc(rec['name'])}</h3>
        <p class="body">{esc(rec['observed'])}</p>
        <dl>
          <div><dt>许可</dt><dd>{esc(rec['license'])}</dd></div>
          <div><dt>何时用</dt><dd>{esc(rec['when'])}</dd></div>
          <div><dt>别用</dt><dd>{esc(rec['not_for'])}</dd></div>
          <div><dt>自家对应</dt><dd>{esc(rec['own_counterpart'])}</dd></div>
        </dl>
        <p class="src"><a href="{esc(rec['source_url'])}" target="_blank" rel="noopener">回源核对 ↗</a> · {esc(rec['id'])}.json</p>
      </article>"""


def rule_card(rec: dict, url: str) -> str:
    g = rec["group"]
    return f"""      <article class="card" id="{esc(rec['id'])}" data-facet="{esc(g)}">
        <div class="card-top"><span class="badge g-{esc(g)}">{esc(GROUP_LABEL.get(g, g))} · {esc(g)}</span><span class="num">{esc(rec['id'])}</span></div>
        <h3>{esc(rec['name'])}</h3>
        <p class="body">{esc(rec['rule'])}</p>
        <dl>
          <div><dt>何时核对</dt><dd>{esc(rec['when'])}</dd></div>
          <div><dt>自家缺口</dt><dd>{esc(rec['own_gap'])}</dd></div>
          <div><dt>出处</dt><dd>{esc(rec['evidence'])}</dd></div>
        </dl>
        <p class="src"><a href="{esc(url)}" target="_blank" rel="noopener">回源核对 ↗</a> · {esc(rec['id'])}.json</p>
      </article>"""


def build_html() -> str:
    verdicts, rules, index = load()
    url_by_source = {r["name"]: r["source_url"] for r in verdicts}
    fallback = "https://github.com/nakamotosai/sai-assets"
    by_group = {g: [r for r in rules if r["group"] == g] for g, _ in GROUPS}
    collected = sum(1 for r in verdicts if r["verdict"].startswith("收"))
    total = len(verdicts) + len(rules)

    chip_parts = [f'<li><button class="chip" type="button" data-facet="all" aria-pressed="true">全部 <span class="n">{total}</span></button></li>',
                  f'<li><button class="chip" type="button" data-facet="verdict" aria-pressed="false">判定 <span class="n">{len(verdicts)}</span></button></li>']
    for g, label in GROUPS:
        chip_parts.append(f'<li><button class="chip" type="button" data-facet="{g}" aria-pressed="false">{label} <span class="n">{len(by_group[g])}</span></button></li>')

    vcards = "\n".join(verdict_card(r, i) for i, r in enumerate(verdicts, 1))
    rcards = "\n".join(rule_card(r, url_by_source.get(r["source"], fallback)) for r in rules)

    css = (CSS_TEMPLATE
           .replace("{root_tokens}", token_block(":root", "light"))
           .replace("{dark_tokens}", token_block("html[data-theme=dark]", "dark")
                    + "\n@media (prefers-color-scheme: dark){\n  "
                    + token_block("html:not([data-theme])", "dark").replace("\n", "\n  ")
                    + "\n}")
           .replace("{badge_css()}", badge_css()))
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>外部设计规则观测 · 13 skill 判定 + 33 条判据</title>
<meta name="theme-color" content="#F5F3ED" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0E0E0C" media="(prefers-color-scheme: dark)">
<style>
{css}</style>
</head>
<body>
<a class="skip" href="#main">跳到主内容</a>
<div class="wrap">
  <header class="head">
    <div>
      <h1>外部设计规则观测</h1>
      <p class="lede">13 个 Interface 设计类 skill 逐个读完上游原文后的判定,以及从里面提炼的 33 条可落地判据。全部是观测与结论:零上游原文、零代码、零图像、零字体二进制。</p>
    </div>
    <button class="tt" id="tt" type="button" aria-label="切换深浅配色" hidden>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle class="sun" cx="12" cy="12" r="4.6"></circle>
        <path class="sun" d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"></path>
        <path class="moon" d="M20 14.4A8.2 8.2 0 0 1 9.6 4a8.4 8.4 0 1 0 10.4 10.4Z"></path>
      </svg>
    </button>
  </header>

  <p class="facts"><b>{total}</b> 条观测<span class="sep">/</span><b>{collected}</b> 个判定为收<span class="sep">/</span><b>{len(verdicts)}</b> 个 skill 逐个评审<span class="sep">/</span><b>{len(rules)}</b> 条判据 · {len(GROUPS)} 组<span class="sep">/</span>数据是真相源,页面是派生物</p>

  <nav class="facets" aria-label="按分组筛选">
    <ul class="chips">
{chr(10).join("      " + c for c in chip_parts)}
    </ul>
    <p class="shown" id="shown" role="status">显示 {total} / {total} 条</p>
  </nav>

  <main id="main">
    <section id="verdicts">
      <div class="sec-head">
        <h2>13 个 skill 的判定</h2>
        <p>判定为「收」= 有自家空白且可落断言;「只记观测」= 重复度高、口径冲突或形态不符。</p>
      </div>
      <div class="grid">
{vcards}
      </div>
    </section>

    <section id="rules">
      <div class="sec-head">
        <h2>33 条可落地判据</h2>
        <p>每条都带数值或阈值,可直接写成项目 design-lock.json 的断言;冲突项以自家正本为准。</p>
      </div>
      <div class="grid">
{rcards}
      </div>
    </section>
  </main>

  <footer>
    <p>本页由 <code>scripts/build_preview.py</code> 从 <code>data/*.json</code> 生成 —— 改数据必须重跑,包内断言会核对页面与数据是否同步。</p>
    <p>上游许可与出处逐条记在 <code>data/*.json</code> 的 license / source_url;本包自产重述部分为 CC0-1.0。</p>
  </footer>
</div>
<script>
{JS}</script>
</body>
</html>
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="只验同步,不写盘")
    args = ap.parse_args()
    html = build_html()
    if args.check:
        if not OUT.is_file():
            print(f"FAIL --check: 预览页不存在 {OUT}", file=sys.stderr)
            return 1
        if OUT.read_text(encoding="utf-8") != html:
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
