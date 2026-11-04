#!/usr/bin/env python3
"""Build dist/ — sai-assets 展示站(Cloudflare Pages)。

唯一入口是 `packs/*/pack.json`:新增/修改一个包目录,重跑本脚本,站点自动收录。
产出(全部写进 dist/,仓里不提交):
  index.html              目录:搜索 / 类目筛选 / 每个包一张活预览卡
  p/<id>/index.html       包详情:大预览 + 元数据 + 代码页签 + 安装方式
  p/<id>/demo/<slug>/     子 demo 详情(bg-fx effects / three-fx effects)
  packs/**                原样拷贝(iframe 预览的真实目标)
  downloads/<id>.zip      确定性 zip(固定 mtime,重复构建字节一致)
  assets/…                站点外壳 + 由 ouuut-editorial 包拷来的 token/排版层
  catalog.json / app.json / sitemap.xml / robots.txt / llms.txt / _headers / 404.html

用法:python scripts/build_site.py [--out dist]
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import shutil
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSET_VER = ""        # build() 里按外壳文件内容算,写进 URL 的 ?v=,避免部署后用户拿旧 JS
PACKS = ROOT / "packs"
SHELL = ROOT / "site"
REPO = "nakamotosai/sai-assets"
SITE = "https://assets.ouuut.com"
RAW = f"https://raw.githubusercontent.com/{REPO}/main/"
CDN = f"https://cdn.jsdelivr.net/gh/{REPO}@pack"
CDN_MAIN = f"https://cdn.jsdelivr.net/gh/{REPO}@main"  # 未打 tag 的包跟随 main
GH = f"https://github.com/{REPO}"

CAT_ORDER = ["sites", "themes", "fonts", "web-fx", "web-ui", "fx-engines", "references", "video-motion"]
CAT_TITLE = {
    "sites": "线上作品(用库内资产建成)",
    "themes": "主题 · 配色与字体",
    "fonts": "排版配方",
    "web-fx": "网页动效",
    "web-ui": "UI 组件",
    "fx-engines": "动效引擎 / 底座",
    "references": "外部参考观测",
    "video-motion": "视频动效(索引)",
}
# 卡片/详情用的类目短标签(导航 chip)
CAT_CHIP = {
    "sites": "作品",
    "themes": "主题",
    "fonts": "排版",
    "web-fx": "动效",
    "web-ui": "组件",
    "fx-engines": "引擎",
    "references": "参考",
    "video-motion": "视频",
}
# 这类包内容在本家,仓里只有索引 → 不出 zip 的“下载代码”语义改为外链
INDEX_ONLY = {"video-motion"}

HEAVY_RE = re.compile(r"webgl|WebGLRenderer|THREE\.|getContext\(\s*['\"]webgl", re.I)
CODE_CAP = 64 * 1024
MONO_EXT = {".css", ".js", ".json", ".md", ".html", ".txt", ".py", ".ts", ".svg"}


# ---------------------------------------------------------------- 基础工具
def esc(s: object) -> str:
    return html.escape(str(s if s is not None else ""), quote=True)


def md_inline(text: object) -> str:
    """包内文案允许 **粗体**:转义后再把成对星号变 <strong>。"""
    return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", esc(text))


def ld(obj: dict) -> str:
    """JSON-LD script 标签(避开 f-string 里嵌字典的花括号)。"""
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False) + "</script>\n"


def stamp() -> str:
    """确定性时间戳:取 HEAD 提交日期(CI 重建才能与提交一致;无 git 则用今天)。"""
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


def read_json(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def is_heavy(text: str) -> bool:
    return bool(HEAVY_RE.search(text))


def swatches(pack_dir: Path) -> list[str]:
    """从 tokens 里抽 ≤8 个色值,给无预览的包做降级卡。"""
    colors: list[str] = []
    abs_path = pack_dir / "tokens" / "absolute.json"
    if abs_path.is_file():
        data = read_json(abs_path)
        for key in ("colors", "neutrals", "palettes"):
            block = data.get(key)
            if isinstance(block, dict):
                stack = list(block.values())
                while stack:
                    v = stack.pop(0)
                    if isinstance(v, str) and v.startswith("#"):
                        colors.append(v)
                    elif isinstance(v, dict):
                        stack.extend(v.values())
    sem = pack_dir / "tokens" / "semantic"
    if sem.is_dir():
        for f in sorted(sem.glob("*.json")):
            data = read_json(f)
            for key in ("bg", "surface", "ink", "accent"):
                v = (data.get("colors") or {}).get(key)
                if isinstance(v, str) and v.startswith("#"):
                    colors.append(v)
    seen, uniq = set(), []
    for c in colors:
        if c.lower() not in seen:
            seen.add(c.lower())
            uniq.append(c)
    return uniq[:8]


def demo_pages(pack_dir: Path) -> list[dict]:
    """包内子 demo:effects/*/index.html 与 demos/*/index.html。"""
    out: list[dict] = []
    for sub in ("effects", "demos", "examples"):
        base = pack_dir / sub
        if not base.is_dir():
            continue
        for page in sorted(base.glob("*/index.html")):
            text = page.read_text(encoding="utf-8", errors="replace")
            m = re.search(r"<title[^>]*>(.*?)</title>", text, re.S | re.I)
            label = (m.group(1).strip() if m else page.parent.name)
            if len(label) > 60:
                label = page.parent.name
            out.append({
                "slug": f"{sub}-{page.parent.name}",
                "label": label or page.parent.name,
                "path": page.relative_to(pack_dir).as_posix(),
                "heavy": is_heavy(text),
            })
    return out


def code_files(pack: dict, pack_dir: Path) -> list[dict]:
    """详情页代码页签:小文件内嵌,大文件只给链接。"""
    picks: list[str] = ["pack.json"]
    files = pack.get("files") or {}
    picks += list(files.get("css") or [])
    picks += list(files.get("tokens") or [])
    for key in ("usage",):
        if files.get(key):
            picks.append(files[key])
    if pack.get("entry"):
        picks.append(pack["entry"])
    seen, out = set(), []
    for rel in picks:
        if not rel or rel in seen:
            continue
        seen.add(rel)
        p = pack_dir / rel
        if not p.is_file() or p.suffix.lower() not in MONO_EXT:
            continue
        size = p.stat().st_size
        if size > CODE_CAP:
            out.append({"label": rel, "rel": rel, "too_big": True, "size": size})
            continue
        out.append({"label": rel, "rel": rel, "text": p.read_text(encoding="utf-8", errors="replace")})
    return out


# ---------------------------------------------------------------- 数据装载
def load_packs() -> list[dict]:
    rows = []
    for path in sorted(PACKS.glob("*/pack.json")):
        pack = read_json(path)
        pd = path.parent
        files = pack.get("files") or {}
        preview = files.get("preview")
        has_preview = bool(preview) and (pd / preview).is_file()
        ptext = (pd / preview).read_text(encoding="utf-8", errors="replace") if has_preview else ""
        demos = demo_pages(pd)
        nfiles = sum(1 for f in pd.rglob("*") if f.is_file())
        nbytes = sum(f.stat().st_size for f in pd.rglob("*") if f.is_file())
        rows.append({
            "dir": pd,
            "pack": pack,
            "id": pack["id"],
            "title": pack.get("title", pack["id"]),
            "category": pack.get("category", "themes"),
            "version": pack.get("version", "0.0.0"),
            "license": pack.get("license", "—"),
            "when": pack.get("when", ""),
            "not_for": pack.get("not_for", ""),
            "tags": pack.get("tags") or [],
            "one_liner": pack.get("one_liner", ""),
            "external": bool(pack.get("external")) or pack["id"] in INDEX_ONLY,
            "preview_url": pack.get("preview_url"),
            "canonical_home": pack.get("canonical_home"),
            "attribution": pack.get("attribution") or [],
            "verified": pack.get("verified") or {},
            "origin": pack.get("origin") or {},
            "entry": pack.get("entry", "SKILL.md"),
            "preview": preview if has_preview else None,
            "heavy": is_heavy(ptext) if has_preview else False,
            "demos": demos,
            "files_n": nfiles,
            "kb": round(nbytes / 1024),
            "swatches": swatches(pd),
            "code": code_files(pack, pd),
        })
    return rows


def surfaces(row: dict) -> int:
    """可看面数:预览 1 + 子 demo n。"""
    return (1 if row["preview"] else 0) + len(row["demos"])


# ---------------------------------------------------------------- 片段渲染
THEME_ICON = ('<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" '
              'stroke="currentColor" stroke-width="1.6"><path class="sun" d="M12 6.6a5.4 5.4 0 1 0 0 10.8 '
              '5.4 5.4 0 0 0 0-10.8Z"/><path class="sun" d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 '
              '1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/><path class="moon" '
              'd="M20 14.4A8.2 8.2 0 0 1 9.6 4a8.4 8.4 0 1 0 10.4 10.4Z"/></svg>')


def head(title: str, desc: str, canonical: str, *, depth: int, jsonld: str = "",
         og_type: str = "website") -> str:
    up = "../" * depth
    v = f"?v={ASSET_VER}" if ASSET_VER else ""
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{esc(canonical)}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:type" content="{esc(og_type)}">
<meta property="og:url" content="{esc(canonical)}">
<meta property="og:image" content="{SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="sai-assets">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F5F3ED" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0E0E0C" media="(prefers-color-scheme: dark)">
<link rel="alternate" type="application/json" href="{up}catalog.json" title="catalog.json">
<link rel="stylesheet" href="{up}assets/all.css{v}">
<link rel="stylesheet" href="{up}assets/type.css{v}">
<link rel="stylesheet" href="{up}assets/site.css{v}">
<script>document.documentElement.classList.add('js');try{{var t=localStorage.getItem('sai-assets-theme');if(t)document.documentElement.dataset.theme=t;}}catch(e){{}}</script>
{jsonld}<script src="{up}assets/site.js{v}" defer></script>
</head>
<body>
<a class="skip" href="#main">跳到主内容</a>
<header class="top">
  <div class="top-in">
    <a class="mark" href="{up}">sai-assets<span class="mark-sub">可复用网页资产库</span></a>
    <nav class="top-nav" aria-label="站点">
      <a href="{up}#index">索引</a>
      <a href="{up}catalog.json">catalog</a>
      <a href="{GH}">源码</a>
    </nav>
    <div class="top-tools">
      <button class="icon-btn" id="theme-btn" type="button" aria-label="切换深浅色" title="切换深浅色">{THEME_ICON}</button>
      <a class="ghost" href="{GH}"><span class="txt">GitHub</span><span aria-hidden="true"> ↗</span></a>
    </div>
  </div>
</header>
"""


def row_html(row: dict, index: int) -> str:
    """索引行:编号 / 名称+id / 一句话 / 类目 / 版本+箭头。悬停由 JS 唤起右侧预览。"""
    src = (f'packs/{row["id"]}/{row["preview"]}' if row["preview"]
           else (row.get("preview_url") or ""))
    search = " ".join([row["id"], row["title"], row["category"], " ".join(row["tags"]),
                       row["when"], row["one_liner"]]).lower()
    ext = " data-external" if row["external"] else ""
    return (
        f'<li class="row reveal" id="row-{esc(row["id"])}" data-cat="{esc(row["category"])}"'
        f' data-search="{esc(search)}" data-src="{esc(src)}" data-heavy="{"1" if row["heavy"] else "0"}"'
        f' data-title="{esc(row["title"])}" data-id="{esc(row["id"])}"{ext}>'
        f'<a href="p/{esc(row["id"])}/">'
        f'<span class="no">{index:02d}</span>'
        f'<span class="name"><span class="dot" aria-hidden="true"></span>{esc(row["title"])}'
        f'<small>{esc(row["id"])}</small></span>'
        f'<span class="desc">{esc((row["when"] or row["one_liner"]).split(":")[0])}</span>'
        f'<span class="cat">{esc(CAT_CHIP.get(row["category"], row["category"]))}</span>'
        f'<span class="ver">v{esc(row["version"])}<span class="arrow" aria-hidden="true">→</span></span>'
        f'</a></li>')


def stage_html(row: dict, preview: str | None, heavy: bool, up: str = "") -> str:
    if not preview and row.get("preview_url"):
        return (f'<div class="stage-inner" data-src="{esc(row["preview_url"])}" data-heavy="0">'
                f'<div class="poster"><span>载入外部站点…</span></div></div>')
    if not preview:
        return ('<div class="poster"><span>'
                + ("外部索引 · 内容在其本家仓库" if row["id"] in INDEX_ONLY else "本包没有预览页")
                + '</span></div>')
    src = f'{up}packs/{row["id"]}/{preview}'
    return (f'<div class="stage-inner" data-src="{esc(src)}" data-heavy="{"1" if heavy else "0"}">'
            f'<div class="poster"><span>载入预览…</span>'
            f'<button class="run" type="button">运行预览</button></div></div>')


_TAG_CACHE: dict[str, bool] = {}


def tag_exists(pid: str, ver: str) -> bool:
    """该包是否已有 `pack/<id>@<ver>` tag —— 固定版本 URL 只有打过 tag 才成立。"""
    key = f"{pid}@{ver}"
    if key not in _TAG_CACHE:
        r = subprocess.run(["git", "rev-parse", "-q", "--verify", f"refs/tags/pack/{key}"],
                           cwd=ROOT, capture_output=True, text=True)
        _TAG_CACHE[key] = r.returncode == 0
    return _TAG_CACHE[key]


def install_html(row: dict, up: str) -> str:
    pid, ver = row["id"], row["version"]
    raw = f"{RAW}packs/{pid}/"
    cdn = f"{CDN}/{pid}@{ver}/packs/{pid}/"
    files = (row.get("pack") or {}).get("files") or {}

    def first(*keys: str) -> list[str]:
        out: list[str] = []
        for k in keys:
            v = files.get(k) or []
            out += [v] if isinstance(v, str) else list(v)
        return [x for x in out if isinstance(x, str) and x]

    # 零安装单文件:挑该包**真有**的主产物(主题/字体优先 css,组件/动效优先 src),
    # 不再写死 css/default.css —— ui / fx 包没有 css/ 目录,写死会给出 404 链接。
    primary = (first("css", "src", "tokens") or [row.get("pack", {}).get("entry") or "SKILL.md"])[0]
    # 版本面:只有打过 tag 的包才能用「固定版本」URL;其余跟随 main(否则整条链接 404)
    pinned = tag_exists(pid, ver)
    onefile = f"{cdn}{primary}" if pinned else f"{CDN_MAIN}/packs/{pid}/{primary}"
    if primary.endswith(".css"):
        onefile_code = f'<link rel="stylesheet" href="{onefile}">'
    elif primary.endswith(".js"):
        onefile_code = f'<script type="module" src="{onefile}"></script>'
    else:
        onefile_code = f"curl -O {onefile}"
    snippets = [
        ("固定版本(CDN)" if pinned else "CDN(未打 tag · 跟随 main)", onefile_code),
        ("raw 直取(跟随 main)", f'curl -O {raw}SKILL.md'),
        ("仓库内落地", f'python scripts/apply.py {pid} --to <项目目录>'),
        ("整包下载", f'{SITE}/downloads/{pid}.zip' if not row["external"] else str(row.get("preview_url") or "")),
    ]
    blocks = []
    for label, code in snippets:
        blocks.append(
            f'<div class="snip"><div class="snip-head"><span>{esc(label)}</span>'
            f'<button class="copy" type="button" data-copy="{esc(code)}">复制</button></div>'
            f'<pre><code>{esc(code)}</code></pre></div>')
    return f'<div class="snips">{"".join(blocks)}</div>'


def code_html(row: dict, up: str) -> str:
    if not row["code"]:
        return '<p class="muted">本包没有可内嵌的文本产物,内容见本家仓库。</p>'
    heads, panes = [], []
    for i, f in enumerate(row["code"]):
        sel = " selected" if i == 0 else ""
        heads.append(f'<button class="tab{sel}" type="button" role="tab" aria-selected="{"true" if i == 0 else "false"}" '
                     f'data-tab="f{i}">{esc(f["label"])}</button>')
        body = (f'<p class="muted">文件 {f["size"] // 1024} KB,超出内嵌上限,'
                f'<a href="{GH}/blob/main/packs/{esc(row["id"])}/{esc(f["rel"])}">在 GitHub 打开</a></p>'
                if f.get("too_big") else
                f'<pre><code>{esc(f["text"])}</code></pre>')
        head_btn = "" if f.get("too_big") else (
            '<button class="copy" type="button" data-copy-file="' + esc(f["rel"]) + '">复制</button>')
        panes.append(f'<div class="pane{sel}" role="tabpanel" id="f{i}">'
                     f'<div class="pane-head"><code>{esc(f["rel"])}</code>{head_btn}</div>{body}</div>')
    return (f'<div class="tabs" role="tablist">{"".join(heads)}</div>'
            f'<div class="panes">{"".join(panes)}</div>')


def write_page(path: Path, html: str) -> None:
    """写 HTML 页:整页包在 Cloudflare 的 `email_off` 注释里。

    为什么:CF 的 Email Obfuscation 会把页面里像邮箱的串(典型是 CDN 链接里的
    `.../sai-assets@pack/<id>@<ver>/...`)替换成 `__cf_email__` 锚点 —— 浏览器里
    由 CF 的 decode 脚本还原,但**抓 HTML 的下游(agent / 爬虫 / 我们的闸)拿到的是残片**。
    本站在展示的正是包内文本与取用 URL,没有需要保护的邮箱,整页关掉更合适。
    """
    i = html.find("<body")
    assert i >= 0, "页面缺少 <body>"
    j = html.find(">", i) + 1
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html[:j] + "<!--email_off-->" + html[j:] + "<!--/email_off-->\n</body>\n</html>\n",
                    encoding="utf-8")


def page_footer(up: str, updated: str) -> str:
    return f"""<footer class="foot">
  <span>本站用库内 <code>ouuut-editorial</code> 包的 token 与字阶构建 —— 展示站本身就是取用示例。</span>
  <span>许可见各包 <code>pack.json</code>;外部包只做索引。</span>
  <span><a href="{up}catalog.json">catalog.json</a></span>
  <span><a href="{up}assets/app.json">app.json</a></span>
  <span><a href="{GH}">源码</a></span>
  <span>更新 {esc(updated)}</span>
</footer>
"""


# ---------------------------------------------------------------- 页面
def render_home(rows: list[dict], updated: str) -> str:
    shown = [r for r in rows if r["category"] in CAT_ORDER]
    ordered = sorted(shown, key=lambda r: (CAT_ORDER.index(r["category"]), r["id"]))
    rows_html = "\n".join(row_html(r, i + 1) for i, r in enumerate(ordered))
    counts = {c: sum(1 for r in rows if r["category"] == c) for c in CAT_ORDER}
    chips = ['<button class="filter on" type="button" data-cat="all">全部<em>%d</em></button>' % len(rows)]
    for c in CAT_ORDER:
        if counts[c]:
            chips.append(f'<button class="filter" type="button" data-cat="{c}">'
                         f'{esc(CAT_CHIP[c])}<em>{counts[c]}</em></button>')
    n_surf = sum(surfaces(r) for r in rows)
    jsonld = ld({
        "@context": "https://schema.org", "@type": "WebSite", "name": "sai-assets",
        "url": SITE + "/",
        "description": "可复用网页资产库:主题配色、排版配方、网页动效、UI 组件",
        "license": "https://opensource.org/license/mit", "sameAs": [GH],
    })
    return (head("sai-assets · 可复用网页资产库",
                 f"{len(rows)} 个可复用网页资产包:{('、'.join(CAT_CHIP[c] for c in CAT_ORDER if counts[c]))}"
                 f"。每一包 = 入口 + 产物 + 配对规则 + 断言,带活预览与整包下载。",
                 SITE + "/", depth=0, jsonld=jsonld)
            + f"""<main id="main">
  <section class="hero">
    <div class="hero-top">
      <div>
        <h1>可复用的<em>网页资产库</em></h1>
        <p class="lede">主题、排版、动效、组件 —— 每一包都是一份<strong>能当场试印</strong>的样张:
          悬停任意一行,右边跑的就是它自己的预览页。</p>
      </div>
      <div class="counts">
        <div><b>{len(rows)}</b><span>包</span></div>
        <div><b>{n_surf}</b><span>可看面</span></div>
        <div><b>{len([c for c in CAT_ORDER if counts[c]])}</b><span>类目</span></div>
        <div><b>{esc(updated[5:])}</b><span>更新</span></div>
      </div>
    </div>
  </section>
  <section class="toolbar" id="index">
    <div class="filters" role="group" aria-label="按类目筛选">{"".join(chips)}</div>
    <div class="search">
      <label class="sr" for="q">搜索资产</label>
      <input id="q" type="search" placeholder="搜索 id / 标签 / 场景" autocomplete="off">
      <kbd aria-hidden="true">/</kbd>
      <span class="hint" id="q-hint" aria-live="polite"></span>
    </div>
  </section>
  <section class="index">
    <ol class="rows" id="rows">
{rows_html}
    </ol>
    <p class="empty" id="empty" hidden>没有匹配的资产。清空搜索或换个类目再看看。</p>
  </section>
  <aside class="peek" id="peek" aria-hidden="true"></aside>
</main>
"""
            + page_footer("", updated))


def render_detail(row: dict, rows: list[dict], updated: str) -> str:
    up = "../../"
    demos = ""
    if row["demos"]:
        chips = "".join(f'<a href="demo/{esc(d["slug"])}/">{esc(d["label"])}</a>' for d in row["demos"])
        demos = f'<div class="demos" role="group" aria-label="子 demo">{chips}</div>'
    stage = stage_html(row, row["preview"], row["heavy"], up)
    attrs = ""
    if row["attribution"]:
        items = "".join(
            f'<li>{esc(a.get("name", "—"))}'
            + (f' · <a href="{esc(a["url"])}" target="_blank" rel="noopener">来源</a>' if a.get("url") else "")
            + f' · {esc(a.get("license", "—"))}<div class="what">{esc(a.get("what", ""))}</div></li>'
            for a in row["attribution"])
        attrs = f'<div class="block"><h2>归属与许可</h2><ul class="attr">{items}</ul></div>'
    verified = ""
    if row["verified"]:
        verified = (f'<div class="block"><h2>验证证据</h2>'
                    f'<p class="muted">{esc(row["verified"].get("date", ""))} · '
                    f'<code>{esc(row["verified"].get("how", ""))}</code></p>'
                    f'<pre class="evidence"><code>{esc(row["verified"].get("evidence", ""))}</code></pre></div>')
    meta_rows = [("类目", CAT_TITLE.get(row["category"], row["category"])),
                 ("版本", "v" + row["version"]),
                 ("许可", row["license"]),
                 ("规模", f'{row["files_n"]} 文件 · {row["kb"]} KB')]
    if row["origin"].get("project"):
        meta_rows.append(("来源", f'{row["origin"].get("project")} · {row["origin"].get("path", "")}'))
    dl = "".join(f'<dt>{esc(k)}</dt><dd>{esc(v)}</dd>' for k, v in meta_rows)
    tags = "".join(f'<li>{esc(t)}</li>' for t in row["tags"])
    jsonld = ld({
        "@context": "https://schema.org", "@type": "CreativeWork", "name": row["title"],
        "identifier": row["id"], "version": row["version"], "license": row["license"],
        "description": row["when"] or row["one_liner"], "codeRepository": GH,
        "url": f"{SITE}/p/{row['id']}/", "keywords": ", ".join(row["tags"]),
    })
    return (head(f'{row["title"]} · sai-assets', (row["when"] or row["one_liner"])[:150],
                 f'{SITE}/p/{row["id"]}/', depth=2, jsonld=jsonld, og_type="article")
            + f"""<main id="main">
  <nav class="crumbs" aria-label="面包屑">
    <a href="{up}">索引</a><span aria-hidden="true">/</span>
    <a href="{up}#{esc(row['category'])}">{esc(CAT_CHIP.get(row['category'], row['category']))}</a>
    <span aria-hidden="true">/</span><span aria-current="page">{esc(row['id'])}</span>
  </nav>
  <header class="item-head">
    <h1>{esc(row['title'])}</h1>
    <div class="item-meta">
      <code>{esc(row['id'])}</code><span class="sep" aria-hidden="true">/</span>
      <span>v{esc(row['version'])}</span><span class="sep" aria-hidden="true">/</span>
      <span>{esc(row['license'])}</span><span class="sep" aria-hidden="true">/</span>
      <span>{esc(CAT_TITLE.get(row['category'], row['category']))}</span><span class="sep" aria-hidden="true">/</span>
      <span>{row['files_n']} 文件 · {row['kb']} KB</span>
    </div>
  </header>
  <section class="stage-wrap">
    <div class="stage-head">
      <button class="on" type="button" data-w="1280">桌面</button>
      <button type="button" data-w="834">平板</button>
      <button type="button" data-w="390">手机</button>
      <span class="divider" aria-hidden="true"></span>
      <button type="button" id="reload">重新加载</button>
      <span class="spacer"></span>
      {f'<a href="{up}packs/{esc(row["id"])}/{esc(row["preview"])}" target="_blank" rel="noopener">新窗口 ↗</a>' if row['preview'] else ''}
    </div>
    <div class="stage" id="stage">{stage}</div>
    {demos}
  </section>
  <div class="intro">
    <p class="lede-row">{md_inline(row['when'] or row['one_liner'])}</p>
    {f'<details class="notfor"><summary>不适用场景</summary><p>{md_inline(row["not_for"])}</p></details>' if row['not_for'] else ''}
  </div>
  <div class="cols">
    <section>
      <div class="block"><h2>元数据</h2><dl class="meta-list">{dl}</dl></div>
      <div class="block"><h2>标签</h2><ul class="tags">{tags}</ul></div>
      {verified}
      {attrs}
    </section>
    <section>
      <div class="block"><h2>取用</h2>{install_html(row, up)}</div>
      <div class="block"><h2>源码与规则</h2><div class="code-box">{code_html(row, up)}</div></div>
    </section>
  </div>
  <p class="back"><a href="{up}">← 回索引</a></p>
</main>
"""
            + page_footer(up, updated))


def render_demo(row: dict, demo: dict, updated: str) -> str:
    up = "../../../../"
    rel = f'{up}packs/{row["id"]}/{demo["path"]}'
    title = demo["label"] if row["id"] in demo["label"] else f'{demo["label"]} · {row["title"]}'
    return (head(f'{title} · sai-assets', f'{row["title"]} 的子 demo:{demo["label"]}',
                 f'{SITE}/p/{row["id"]}/demo/{demo["slug"]}/', depth=4)
            + f"""<main id="main">
  <nav class="crumbs" aria-label="面包屑">
    <a href="{up}">索引</a><span aria-hidden="true">/</span>
    <a href="{up}p/{esc(row['id'])}/">{esc(row['id'])}</a>
    <span aria-hidden="true">/</span><span aria-current="page">{esc(demo['label'])}</span>
  </nav>
  <header class="item-head">
    <h1>{esc(demo['label'])}</h1>
    <div class="item-meta"><code>{esc(row['id'])}</code><span class="sep" aria-hidden="true">/</span><span>子 demo</span></div>
    <p class="lede-row">{md_inline(row['when'])}</p>
  </header>
  <section class="stage-wrap">
    <div class="stage-head">
      <button class="on" type="button" data-w="1280">桌面</button>
      <button type="button" data-w="834">平板</button>
      <button type="button" data-w="390">手机</button>
      <span class="divider" aria-hidden="true"></span>
      <button type="button" id="reload">重新加载</button>
      <span class="spacer"></span>
      <a href="{esc(rel)}" target="_blank" rel="noopener">新窗口 ↗</a>
    </div>
    <div class="stage" id="stage">{stage_html({**row, 'id': row['id']}, demo['path'], demo['heavy'], up)}</div>
  </section>
  <p class="back"><a href="{up}p/{esc(row['id'])}/">← 回 {esc(row['id'])}</a></p>
</main>
"""
            + page_footer(up, updated))


def render_404(rows: list[dict], updated: str) -> str:
    links = "".join(f'<li><a href="/p/{esc(r["id"])}/">{esc(r["title"])}</a></li>' for r in rows[:8])
    return (head("页面不存在 · sai-assets", "没找到这个页面。", SITE + "/404", depth=0)
            + f"""<main id="main" class="notfound">
  <h1>404 · 没找到这个页面</h1>
  <p class="lede">链接可能已经换了位置。回 <a href="/">目录</a> 看看,或从下面几包进:</p>
  <ul class="plain">{links}</ul>
</main>
""" + page_footer("", updated))


# ---------------------------------------------------------------- 产物写出
def write_zip(zip_path: Path, pack_dir: Path) -> None:
    """确定性 zip:条目排序 + 固定 mtime,重复构建字节一致。"""
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    files = sorted(f for f in pack_dir.rglob("*") if f.is_file())
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for f in files:
            info = zipfile.ZipInfo(f"{pack_dir.name}/{f.relative_to(pack_dir).as_posix()}",
                                   date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            zf.writestr(info, f.read_bytes())


def write_meta(dist: Path, rows: list[dict], updated: str) -> None:
    urls = [f"{SITE}/"] + [f"{SITE}/p/{r['id']}/" for r in rows]
    for r in rows:
        urls += [f"{SITE}/p/{r['id']}/demo/{d['slug']}/" for d in r["demos"]]
    body = "\n".join(f"  <url><loc>{u}</loc><lastmod>{updated}</lastmod></url>" for u in urls)
    (dist / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + "\n</urlset>\n",
        encoding="utf-8")
    (dist / "robots.txt").write_text(
        "User-agent: *\nAllow: /\n\n"
        "User-agent: OAI-SearchBot\nAllow: /\nUser-agent: GPTBot\nAllow: /\n"
        "User-agent: ClaudeBot\nAllow: /\nUser-agent: PerplexityBot\nAllow: /\n\n"
        f"Sitemap: {SITE}/sitemap.xml\n", encoding="utf-8")
    lines = [f"# sai-assets", "",
             "> 可复用网页资产库:主题配色与字体、排版配方、网页动效、UI 组件、动效引擎与外部参考观测。",
             "> 一包 = 入口(SKILL.md)+ 产物(css/tokens/preview)+ 配对规则(docs/usage.md)+ 断言(scripts/assert_tokens.py)。",
             f"> 机器目录:{SITE}/catalog.json · 站点清单:{SITE}/assets/app.json", "",
             f"许可:各包 pack.json 的 license;外部包只做索引。源码:{GH}", "", "## 包"]
    for r in sorted(rows, key=lambda x: (CAT_ORDER.index(x["category"]) if x["category"] in CAT_ORDER else 99, x["id"])):
        lines.append(f"- [{r['id']}]({SITE}/p/{r['id']}/) v{r['version']} · {CAT_CHIP.get(r['category'], r['category'])}: "
                     + (r["one_liner"] or r["when"]).strip())
    (dist / "llms.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (dist / "_headers").write_text(
        "/*\n"
        "  X-Content-Type-Options: nosniff\n"
        "  Referrer-Policy: strict-origin-when-cross-origin\n"
        "  Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()\n"
        "  X-Frame-Options: SAMEORIGIN\n"
        "  Cache-Control: public, max-age=300\n"
        "/packs/*\n"
        "  Cache-Control: public, max-age=3600\n"
        "/assets/*\n"
        "  Cache-Control: public, max-age=3600\n"
        "/downloads/*\n"
        "  Cache-Control: public, max-age=3600\n", encoding="utf-8")


def write_app_json(dist: Path, rows: list[dict], updated: str) -> None:
    items = []
    for r in rows:
        items.append({
            "id": r["id"], "title": r["title"], "category": r["category"], "version": r["version"],
            "license": r["license"], "tags": r["tags"], "when": r["when"], "not_for": r["not_for"],
            "one_liner": r["one_liner"], "external": r["external"], "canonical_home": r["canonical_home"],
            "preview": f'packs/{r["id"]}/{r["preview"]}' if r["preview"] else None,
            "heavy": r["heavy"],
            "demos": [{"slug": d["slug"], "label": d["label"], "page": f'p/{r["id"]}/demo/{d["slug"]}/'} for d in r["demos"]],
            "page": f'p/{r["id"]}/', "zip": None if r["external"] else f'downloads/{r["id"]}.zip',
            "preview_url": r.get("preview_url"),
            "files": r["files_n"], "kb": r["kb"], "swatches": r["swatches"],
        })
    cats = [{"id": c, "title": CAT_TITLE[c], "chip": CAT_CHIP[c],
             "count": sum(1 for r in rows if r["category"] == c)} for c in CAT_ORDER if any(r["category"] == c for r in rows)]
    (dist / "assets" / "app.json").write_text(json.dumps(
        {"schema": 1, "site": SITE, "repo": REPO, "updated": updated,
         "counts": {"packs": len(rows), "surfaces": sum(surfaces(r) for r in rows)},
         "categories": cats, "items": items}, ensure_ascii=False, indent=1), encoding="utf-8")


def verify(out: Path, rows: list[dict]) -> None:
    """构建自检:任一不成立即非零退出(CI 里等于阻断部署)。"""
    bad: list[str] = []
    home = (out / "index.html").read_text(encoding="utf-8")
    n_rows = home.count('class="row reveal"')
    if n_rows != len(rows):
        bad.append(f"索引行数 {n_rows} != 包数 {len(rows)}")
    for r in rows:
        page = out / "p" / r["id"] / "index.html"
        if not page.is_file():
            bad.append(f"缺详情页 {r['id']}")
        if r["preview"] and not (out / "packs" / r["id"] / r["preview"]).is_file():
            bad.append(f"缺预览文件 {r['id']}/{r['preview']}")
        if not r["external"]:
            z = out / "downloads" / f'{r["id"]}.zip'
            if not z.is_file():
                bad.append(f"缺 zip {r['id']}")
            else:
                with zipfile.ZipFile(z) as zf:
                    names = zf.namelist()
                if f'{r["id"]}/pack.json' not in names:
                    bad.append(f"zip 内缺 pack.json: {r['id']}")
        for d in r["demos"]:
            if not (out / "p" / r["id"] / "demo" / d["slug"] / "index.html").is_file():
                bad.append(f"缺子 demo 页 {r['id']}/{d['slug']}")
    # 站点外壳不许有外部子资源(零外链运行);出站 <a> 链接不算
    for f in [out / "index.html", out / "404.html"] + [out / "p" / r["id"] / "index.html" for r in rows]:
        html = f.read_text(encoding="utf-8")
        for tag in re.finditer(r"<link\b[^>]*>", html):
            s = tag.group(0)
            rel = (re.search(r'rel="([^"]+)"', s) or [None, ""])[1]
            href = (re.search(r'href="([^"]+)"', s) or [None, ""])[1]
            if rel in {"stylesheet", "preload", "prefetch", "icon", "manifest"} and href.startswith("http"):
                bad.append(f"{f.name} 外链资源 {href}")
        for m in re.finditer(r'<script[^>]+src="(https?://[^"]+)"', html):
            bad.append(f"{f.name} 外链脚本 {m.group(1)}")
        for m in re.finditer(r'<iframe[^>]+src="(https?://[^"]+)"', html):
            bad.append(f"{f.name} 外链 iframe {m.group(1)}")
    if not (out / "og.png").is_file():
        bad.append("缺 og.png(分享卡)")
    n_url = (out / "sitemap.xml").read_text(encoding="utf-8").count("<url>")
    want = 2 + len(rows) + sum(len(r["demos"]) for r in rows) - 1
    if n_url != want:
        bad.append(f"sitemap url {n_url} != 预期 {want}")
    if bad:
        raise SystemExit("FAIL verify: " + "; ".join(bad))
    print(f"PASS verify: {len(rows)} 包 · 详情页/预览/zip/子 demo/sitemap 全对 · 零外部子资源")


def build(out: Path) -> None:
    global ASSET_VER
    updated = stamp()
    rows = load_packs()
    if not rows:
        raise SystemExit("没有找到 packs/*/pack.json —— 别在空目录上跑")
    if out.exists():
        shutil.rmtree(out)
    (out / "assets").mkdir(parents=True)
    (out / "downloads").mkdir()
    shutil.copytree(PACKS, out / "packs")
    for f in sorted(SHELL.glob("*")):
        if not f.is_file():
            continue
        if f.name == "og.png":          # 分享卡放站根:og:image 指向 {SITE}/og.png
            shutil.copy2(f, out / f.name)
        else:
            shutil.copy2(f, out / "assets" / f.name)
    # 站点外壳直接吃库内 ouuut-editorial 的 token / 排版层(取用示例,不做第二份)
    ed = PACKS / "ouuut-editorial" / "css"
    shutil.copy2(ed / "all.css", out / "assets" / "all.css")
    shutil.copy2(ed / "type.css", out / "assets" / "type.css")
    h = hashlib.sha256()
    for name in ("site.css", "site.js", "all.css", "type.css"):
        h.update((out / "assets" / name).read_bytes())
    ASSET_VER = h.hexdigest()[:8]
    shutil.copy2(ROOT / "catalog.json", out / "catalog.json")

    write_page(out / "index.html", render_home(rows, updated))
    write_page(out / "404.html", render_404(rows, updated))
    for r in rows:
        d = out / "p" / r["id"]
        d.mkdir(parents=True, exist_ok=True)
        write_page(d / "index.html", render_detail(r, rows, updated))
        for demo in r["demos"]:
            dd = d / "demo" / demo["slug"]
            dd.mkdir(parents=True, exist_ok=True)
            write_page(dd / "index.html", render_demo(r, demo, updated))
        if not r["external"]:
            write_zip(out / "downloads" / f'{r["id"]}.zip', r["dir"])
    write_app_json(out, rows, updated)
    write_meta(out, rows, updated)

    n_pages = 2 + len(rows) + sum(len(r["demos"]) for r in rows)
    n_files = sum(1 for _ in out.rglob("*") if _.is_file())
    size = sum(f.stat().st_size for f in out.rglob("*") if f.is_file())
    print(f"PASS build_site: {len(rows)} packs · {sum(surfaces(r) for r in rows)} surfaces · "
          f"{n_pages} pages · {n_files} files · {size // 1024} KB → {out}")
    verify(out, rows)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "dist"))
    build(Path(ap.parse_args().out))

