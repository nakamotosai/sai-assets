#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""meta 预览页共用核心(布局 / 配色 / 深浅切换 / 筛选 / 断言口径)。

`references` 与 `video-motion` 两个 meta 包的预览页生成器都 import 本件,
共用一份 CSS、一份色板、一套断言 —— 避免第二个样式真相源。

用法(由各包 scripts/build_preview.py 调用):
    meta_page(title, lede, facts, chips, sections, footer) -> str(html)
"""
from __future__ import annotations

import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]          # 仓根(scripts/ 的上一级)
PALETTE = json.loads((REPO / "packs" / "design-skill-verdicts" / "tokens" /
                      "palette.json").read_text(encoding="utf-8"))

SHADOW = {"light": "0 1px 2px rgba(26,26,22,.06), 0 12px 28px -18px rgba(26,26,22,.28)",
          "dark": "0 1px 2px rgba(0,0,0,.4), 0 16px 32px -20px rgba(0,0,0,.7)"}

# 六组取章色:references 五组 + 通用组(verdict 青磁),video-motion 用通用组
GROUP_ACCENT = {"web": "c4", "print": "c2", "three": "c6", "news": "c3", "swiss": "c5",
                "verdict": "c1", "review": "c3", "guidelines": "c4", "motion": "c6",
                "craft": "c5", "rules": "c2", "index": "c1", "all": "c1"}


def esc(text: str) -> str:
    return (str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


def token_block(selector: str, mode: str) -> str:
    n, a = PALETTE["neutral"][mode], PALETTE["accent"]
    return (selector + "{\n"
            f"  --bg:{n['bg']}; --ink:{n['ink']}; --muted:{n['muted']}; --surface:{n['surface']};\n"
            f"  --line:{n['line']}; --line-2:{n['line2']};\n"
            f"  --c1:{a['c1']}; --c2:{a['c2']}; --c3:{a['c3']}; --c4:{a['c4']}; --c5:{a['c5']}; --c6:{a['c6']};\n"
            f"  --accent:var(--c3);\n  --shadow:{SHADOW[mode]};\n  color-scheme:{mode};\n}}")


def badge_css(groups: list[str]) -> str:
    """按分组出章色 ink 档(浅/深/系统深三处覆盖);文字档取自 palette 实测值。"""
    lines = []
    for g in groups:
        c = GROUP_ACCENT.get(g, "c1")
        a = PALETTE["accent"][c]
        r, gg, b = (int(a[i:i + 2], 16) for i in (1, 3, 5))
        # palette.groups 以组名存 ink;这里用对应章色的键名复用实测值
        key = next((k for k, v in PALETTE["groups"].items() if v["accent"] == a), None)
        ink_l = PALETTE["groups"][key]["ink_light"] if key else PALETTE["neutral"]["light"]["ink"]
        ink_d = PALETTE["groups"][key]["ink_dark"] if key else PALETTE["neutral"]["dark"]["ink"]
        lines.append(f".g-{g}{{--g:{a}; --g-soft:rgba({r},{gg},{b},0.12);"
                     f" --g-line:rgba({r},{gg},{b},0.28); --g-ink:{ink_l}}}")
        lines.append(f'html[data-theme=dark] .g-{g}{{--g-ink:{ink_d}}}')
        lines.append(f"@media (prefers-color-scheme: dark){{ html:not([data-theme]) .g-{g}"
                     f'{{--g-ink:{ink_d}}} }}')
    return "\n".join(lines)


CSS_TEMPLATE = """/* 和色六景 · 纸白 / 炭黑(skill://design-system §2.5);token 由共用 palette.json 生成 */
{root_tokens}
{dark_tokens}
{badges}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--bg); color:var(--ink);
  font-family:"Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,-apple-system,"Segoe UI",sans-serif;
  font-size:14px; font-weight:400; line-height:1.68; font-variant-numeric:tabular-nums;
  -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;}
a{color:inherit; text-decoration-color:var(--line-2); text-underline-offset:3px}
a:hover{text-decoration-color:var(--muted)}
:focus-visible{outline:2px solid var(--accent); outline-offset:2px}
.skip{position:absolute; left:-9999px; top:8px; padding:8px 16px; background:var(--bg); border:1px solid var(--line-2); border-radius:8px}
.skip:focus{left:16px; z-index:9}
.wrap{max-width:1180px; margin:0 auto; padding:40px 24px 64px}
.head{display:flex; align-items:flex-start; gap:16px; justify-content:space-between}
h1,h2,h3{margin:0; font-weight:600; line-height:1.28}
h1{font-size:34px; line-height:1.2}
h2{font-size:22px}
h3{font-size:17px}
p{margin:0}
.lede{margin-top:12px; max-width:72ch; color:var(--muted)}
.facts{margin-top:16px; font-size:13px; color:var(--muted)}
.facts b{color:var(--ink); font-weight:600}
.facts .sep{margin:0 8px; color:var(--line-2)}
.tt{flex:none; width:44px; height:44px; display:grid; place-items:center;
  background:transparent; border:0; color:var(--ink); border-radius:8px; cursor:pointer;
  transition:opacity 120ms ease-out}
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
.chip{min-height:44px; padding:0 16px; display:inline-flex; align-items:center; gap:8px;
  background:transparent; border:1px solid var(--line-2); border-radius:8px;
  color:var(--muted); font:inherit; font-size:13px; font-weight:500; cursor:pointer}
.chip:hover{color:var(--ink)}
.chip[aria-pressed=true]{background:var(--surface); border-color:var(--ink); color:var(--ink)}
.chip .n{font-weight:600}
.shown{margin-top:8px; font-size:12px; color:var(--muted)}
section{margin-top:32px}
section + section{margin-top:96px}
.sec-head{display:flex; align-items:baseline; gap:16px; flex-wrap:wrap; margin-bottom:24px}
.sec-head p{color:var(--muted); font-size:13px}
.grid{display:grid; gap:16px; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); align-items:start}
.card{background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:16px; box-shadow:var(--shadow)}
.card[hidden]{display:none}
.card-top{display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px}
.badge{display:inline-flex; align-items:center; min-height:24px; padding:0 8px; border-radius:8px;
  font-size:12px; font-weight:500; border:1px solid var(--g-line); background:var(--g-soft); color:var(--g-ink)}
.num{font-size:12px; color:var(--muted); font-weight:400}
.card p.body{margin-top:8px; max-width:68ch; line-height:1.68}
.card dl{margin:16px 0 0; display:grid; gap:8px}
.card dl div{display:grid; grid-template-columns:64px minmax(0, 1fr); gap:8px}
.card dd, .card .body, .card .src{overflow-wrap:anywhere}
.card dt{font-size:12px; color:var(--muted)}
.card dd{margin:0; font-size:13px; color:var(--ink)}
.card .src{margin-top:16px; font-size:12px; color:var(--muted)}
.swatches{display:flex; gap:8px; margin-top:8px}
.swatches i{width:24px; height:24px; border-radius:8px; border:1px solid var(--line-2); display:block}
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


def meta_page(title: str, lede: str, facts: str, chips: list[tuple[str, str, int]],
              sections: list[tuple[str, str, str, str]], footer: str,
              groups: list[str]) -> str:
    """sections = [(section_id, h2, 说明, 卡片 HTML)]。"""
    css = (CSS_TEMPLATE
           .replace("{root_tokens}", token_block(":root", "light"))
           .replace("{dark_tokens}", token_block("html[data-theme=dark]", "dark")
                    + "\n@media (prefers-color-scheme: dark){\n  "
                    + token_block("html:not([data-theme])", "dark").replace("\n", "\n  ")
                    + "\n}")
           .replace("{badges}", badge_css(groups)))
    chip_html = "\n".join(
        f'      <li><button class="chip" type="button" data-facet="{esc(f)}" '
        f'aria-pressed="{"true" if f == "all" else "false"}">{esc(label)} '
        f'<span class="n">{n}</span></button></li>'
        for f, label, n in chips)
    sec_html = "\n".join(
        f'    <section id="{esc(sid)}">\n'
        f'      <div class="sec-head"><h2>{esc(h2)}</h2><p>{esc(note)}</p></div>\n'
        f'      <div class="grid">\n{cards}\n      </div>\n    </section>'
        for sid, h2, note, cards in sections)
    total = sum(n for f, _, n in chips if f == "all")
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
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
      <h1>{esc(title)}</h1>
      <p class="lede">{esc(lede)}</p>
      <p class="facts">{facts}</p>
    </div>
    <button class="tt" id="tt" type="button" aria-label="切换深浅配色" hidden>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle class="sun" cx="12" cy="12" r="4.6"></circle>
        <path class="sun" d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"></path>
        <path class="moon" d="M20 14.4A8.2 8.2 0 0 1 9.6 4a8.4 8.4 0 1 0 10.4 10.4Z"></path>
      </svg>
    </button>
  </header>
  <nav class="facets" aria-label="按分组筛选">
    <ul class="chips">
{chip_html}
    </ul>
    <p class="shown" id="shown" role="status">显示 {total} / {total} 条</p>
  </nav>
  <main id="main">
{sec_html}
  </main>
  <footer>
{footer}
  </footer>
</div>
<script>
{JS}</script>
</body>
</html>
"""
