#!/usr/bin/env python3
"""Build index.html — GitHub Pages 预览墙。

与旧库墙的区别(修掉旧病):
1. 旧墙按"全局 id"去重,73 个 demo 只上墙 27 个 → 本墙按类别列出每个包,不做全局去重;
2. 旧墙的 CAT_ORDER 不含 references,40 条观测永不显示 → 本墙含 references 类;
3. 每个包给出色卡(读 tokens/absolute.json)与活预览链接(preview/index.html)。

用法:python scripts/build_wall.py
"""
from __future__ import annotations

import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKS = ROOT / "packs"
OUT = ROOT / "index.html"

PAGE = """<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>sai-assets · 可复用网页资产库</title>
<meta name="description" content="主题配色与字体、网页动效、UI 组件的可复用包目录;每个包自带入口、产物、配对规则与断言。">
<style>
 :root{{--bg:#fbfaf7;--ink:#1b1b18;--muted:#6b6a63;--line:#e6e3db;--card:#fff;--accent:#b4451f}}
 @media (prefers-color-scheme: dark){{:root{{--bg:#111110;--ink:#ecebe5;--muted:#9c9a92;--line:#2a2a27;--card:#181817;--accent:#e08a6a}}}}
 *{{box-sizing:border-box}}
 body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.65 system-ui,-apple-system,"Segoe UI","Noto Sans SC",sans-serif}}
 .wrap{{max-width:1180px;margin:0 auto;padding:40px 22px 80px}}
 h1{{font-size:30px;margin:0 0 6px;letter-spacing:-.01em}}
 .lede{{color:var(--muted);margin:0 0 8px;max-width:70ch}}
 .meta{{color:var(--muted);font-size:13px;margin:0 0 28px}}
 .meta code{{font-family:ui-monospace,monospace}}
 h2{{font-size:17px;margin:38px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--line)}}
 h2 em{{color:var(--muted);font-style:normal;font-weight:400;font-size:13px;margin-left:8px}}
 .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:14px}}
 .card{{background:var(--card);border:1px solid var(--line);border-radius:9px;padding:14px 15px}}
 .card h3{{margin:0 0 4px;font-size:15px}}
 .card h3 span{{color:var(--muted);font-weight:400;font-size:12px;margin-left:6px}}
 .card p{{margin:0 0 10px;color:var(--muted);font-size:13px}}
 .tags{{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}}
 .tag{{font-size:11px;color:var(--muted);border:1px solid var(--line);border-radius:99px;padding:1px 8px}}
 .sw{{display:flex;height:16px;border-radius:4px;overflow:hidden;margin:0 0 10px;border:1px solid var(--line)}}
 .sw i{{flex:1}}
 .links{{display:flex;gap:12px;font-size:13px}}
 a{{color:var(--accent);text-decoration:none}}
 a:hover{{text-decoration:underline}}
 .ext{{font-size:11px;border:1px dashed var(--line);border-radius:99px;padding:1px 8px;color:var(--muted)}}
 .foot{{margin-top:44px;color:var(--muted);font-size:13px;border-top:1px solid var(--line);padding-top:16px}}
</style></head><body><div class="wrap">
<h1>sai-assets · 可复用网页资产库</h1>
<p class="lede">主题配色与字体、网页动效、UI 组件、排版配方。一个包 = 入口 + 产物 + 配对规则 + 断言,能直接抄进项目。</p>
<p class="meta">共 {total} 个包 · 更新 {updated} · 目录 <code>catalog.json</code> · 取用 <code>python scripts/apply.py &lt;id&gt; --to &lt;dir&gt;</code></p>
{body}
<p class="foot">每个包的 <code>SKILL.md</code> 是 agent 入口;<code>docs/usage.md</code> 是配对规则;<code>scripts/assert_tokens.py</code> 是断言。<br>
内容许可见各包 <code>pack.json</code> 的 <code>license</code> 与 <code>attribution</code>;外部包只做索引,内容在其本家。</p>
</div></body></html>
"""


def stamp() -> str:
    """确定性时间戳:取 HEAD 提交日期(CI 重建才能与提交一致;无 git 则用今天)。"""
    import subprocess
    try:
        out = subprocess.run(["git", "log", "-1", "--format=%cs"], cwd=ROOT,
                             capture_output=True, text=True, timeout=10)
        s = out.stdout.strip()
        if len(s) == 10:
            return s
    except Exception:
        pass
    import datetime as dt
    return dt.date.today().isoformat()


def swatches(pack_dir: Path, pack: dict) -> str:
    colors: list[str] = []
    abs_path = pack_dir / "tokens" / "absolute.json"
    if abs_path.is_file():
        data = json.loads(abs_path.read_text(encoding="utf-8"))
        for key in ("colors", "neutrals"):
            block = data.get(key)
            if isinstance(block, dict):
                for value in block.values():
                    if isinstance(value, str) and value.startswith("#"):
                        colors.append(value)
                    elif isinstance(value, dict):
                        for v in value.values():
                            if isinstance(v, str) and v.startswith("#"):
                                colors.append(v)
        for palette in (data.get("palettes") or {}).values():
            for value in (palette.get("colors") or {}).values():
                if isinstance(value, str) and value.startswith("#"):
                    colors.append(value)
    semantic_dir = pack_dir / "tokens" / "semantic"
    if semantic_dir.is_dir():
        for f in sorted(semantic_dir.glob("*.json")):
            data = json.loads(f.read_text(encoding="utf-8"))
            for key in ("bg", "surface", "ink", "accent"):
                v = (data.get("colors") or {}).get(key)
                if isinstance(v, str):
                    colors.append(v)
    seen, uniq = set(), []
    for c in colors:
        if c.lower() not in seen:
            seen.add(c.lower())
            uniq.append(c if c.startswith("#") else "#888888")
    uniq = uniq[:10]
    if not uniq:
        return ""
    cells = "".join(f'<i style="background:{html.escape(c)}"></i>' for c in uniq)
    return f'<div class="sw">{cells}</div>'


def render_card(pack: dict, pack_dir: Path) -> str:
    tags = "".join(f'<span class="tag">{html.escape(t)}</span>' for t in pack["tags"][:5])
    sw = swatches(pack_dir, pack)
    ext = '<span class="ext">外部索引</span>' if pack.get("external") else ""
    links = []
    if (pack_dir / "preview" / "index.html").is_file():
        links.append(f'<a href="packs/{pack["id"]}/preview/">活预览</a>')
    links.append(f'<a href="packs/{pack["id"]}/SKILL.md">SKILL.md</a>')
    if (pack_dir / "docs" / "usage.md").is_file():
        links.append(f'<a href="packs/{pack["id"]}/docs/usage.md">配对规则</a>')
    if pack.get("canonical_home"):
        links.append(f'<a href="{html.escape(pack["canonical_home"])}">本家仓库</a>')
    return (
        f'<article class="card"><h3>{html.escape(pack["title"])}'
        f'<span>{html.escape(pack["id"])} · v{html.escape(pack["version"])}</span></h3>'
        f'<p>{html.escape(pack.get("when", ""))}</p>{sw}'
        f'<div class="tags">{tags}{ext}</div>'
        f'<div class="links">{"".join(links)}</div></article>'
    )


def main() -> None:
    packs = []
    for path in sorted(PACKS.glob("*/pack.json")):
        packs.append((json.loads(path.read_text(encoding="utf-8")), path.parent))

    order = ["themes", "fonts", "web-fx", "web-ui", "fx-engines", "references", "video-motion"]
    titles = {
        "themes": "主题 · 配色与字体", "fonts": "排版配方", "web-fx": "网页动效",
        "web-ui": "UI 组件", "fx-engines": "动效引擎 / 底座",
        "references": "外部参考观测", "video-motion": "视频动效(索引)",
    }
    blocks = []
    for cid in order:
        bucket = [(p, d) for p, d in packs if p["category"] == cid]
        if not bucket:
            continue
        cards = "".join(render_card(p, d) for p, d in sorted(bucket, key=lambda x: x[0]["id"]))
        blocks.append(f'<h2>{titles[cid]}<em>{len(bucket)} 个</em></h2><div class="grid">{cards}</div>')

    body = "\n".join(blocks) if blocks else '<p class="lede">还没有包。</p>'
    updated = stamp()
    OUT.write_text(PAGE.format(total=len(packs), updated=updated, body=body), encoding="utf-8")
    print(f"PASS build_wall: {len(packs)} packs → index.html ({OUT.stat().st_size}B)")


if __name__ == "__main__":
    main()
