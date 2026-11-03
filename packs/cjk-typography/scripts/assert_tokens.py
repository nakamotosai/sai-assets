#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""cjk-typography 断言:pack.json 齐备 / 产物存在 / 三场景数字 / 免费清单三列齐 / preview 引用 / 字号地板。

退出 0 = 通过,打印 PASS assert_tokens cjk-typography。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK_ID = "cjk-typography"

REQUIRED_PACK_KEYS = (
    "schema", "id", "title", "kind", "category", "version", "license", "attribution",
    "origin", "entry", "files", "tags", "when", "not_for", "verified",
)
SCENE_IDS = ("console", "print-1920", "landing")
SCENE_KEYS = ("scene", "h1", "body", "meta", "code", "note")
SCENE_ANCHORS = {
    "console": {"h1": "15–22px", "body": "14px(HUD 12)", "meta": "11–12px", "code": "11–13px"},
    "print-1920": {"h1": "64–110px", "body": "≥40px", "meta": "UI / 脚注 ≥26px"},
    "landing": {"h1": "clamp(2rem–7rem) 负字距", "body": "16–17px · lh 1.55–1.65"},
}
FREE_LICENSES = ("OFL-1.1", "Apache-2.0", "Unlicense")
BODY_ROLE_KEYS = ("body", "display", "article", "mono")
CONSOLE_ROLE_KEYS = ("display", "body", "mono")
SERIF_BAN = ("serif", "SimSun", "宋体", "Songti")
USAGE_CUES = ("三场景", "许可", "来源", "盗版", "子集化", "反模式", "300 陷阱")
FLOOR_PX = 12.0
# 禁用形态一律运行时拼:断言脚本里不出现被禁字面量(规则正本 = scripts/gate.py)
SCHEME_HTTP = "http" + ":" + "/" * 2
SCHEME_LOCAL = "file" + ":"
SCHEME_REL = "/" * 2
NON_HTTPS = (SCHEME_HTTP, SCHEME_LOCAL, SCHEME_REL)
HTTPS = "https" + ":" + "/" * 2
REF_ATTR = re.compile(r"""(?:src|href)\s*=\s*["']([^"']+)["']""", re.I)
REF_URL = re.compile(r"""url\(\s*["']?([^"')]+)["']?\s*\)""", re.I)
FONT_SIZE_DECL = re.compile(r"font-size\s*:\s*([^;{}]+)", re.I)
FONT_SIZE_CUSTOM = re.compile(r"--(?:fs|font-size)[\w-]*\s*:\s*([^;{}]+)", re.I)
PX = re.compile(r"^(-?\d+(?:\.\d+)?)px$", re.I)
REM = re.compile(r"^(-?\d+(?:\.\d+)?)rem$", re.I)  # rem 按 16px 折算
CLAMP = re.compile(r"^clamp\(([^)]*)\)$", re.I)


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def read_json(rel: str) -> dict:
    path = ROOT / rel
    if not path.is_file():
        fail(f"missing {rel}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"{rel} 不是合法 JSON:{exc}")


def main() -> None:
    pack = read_json("pack.json")
    for key in REQUIRED_PACK_KEYS:
        if key not in pack:
            fail(f"pack.json 缺必填键 {key!r}")
    if pack["id"] != PACK_ID:
        fail(f"pack.json id 须为 {PACK_ID},实为 {pack['id']!r}")
    if pack["kind"] != "fonts" or pack["category"] != "fonts":
        fail("pack.json kind / category 须为 fonts")
    # origin.path 的相对性由 gate.py schema 闸负责(本脚本不复刻禁用规则)

    files = pack.get("files") or {}
    listed_paths = []
    for key, listed in sorted(files.items()):
        if listed is None:
            continue
        for rel in (listed if isinstance(listed, list) else [listed]):
            listed_paths.append(rel)
            if not (ROOT / rel).is_file():
                fail(f"files.{key} 列出的文件不存在:{rel}")
    for rel in ("SKILL.md", "README.md", "docs/usage.md", "scripts/assert_tokens.py", "preview/index.html"):
        if not (ROOT / rel).is_file():
            fail(f"missing {rel}")

    idx = read_json("tokens/index.json")
    cards = {c["id"]: c for c in idx.get("cards", [])}
    if set(cards) != {"body-sans", "size-scale", "console", "free-thin"}:
        fail(f"tokens/index.json cards 须为四张,实为 {sorted(cards)}")
    for cid, card in cards.items():
        if not (ROOT / card["file"]).is_file():
            fail(f"card {cid} 指向的文件不存在:{card['file']}")
        if card["file"] not in listed_paths:
            fail(f"card {cid} 的文件未在 pack.json.files.tokens 列出:{card['file']}")
    if idx.get("related_pack") != "cjk-thin-type-system":
        fail("tokens/index.json 须把档位来源指向 cjk-thin-type-system 包")

    # 三场景表:场景齐 + 键齐 + 数字与源卡冻结值一致
    scale = read_json("tokens/size-scale.json")
    scenes = {s["id"]: s for s in scale.get("scenes", [])}
    if tuple(scenes) != SCENE_IDS:
        fail(f"三场景须为 {SCENE_IDS},实为 {tuple(scenes)}")
    for sid, scene in scenes.items():
        for key in SCENE_KEYS:
            if not str(scene.get(key, "")).strip():
                fail(f"scene {sid} 缺字段 {key}")
        for key, anchor in SCENE_ANCHORS[sid].items():
            if anchor not in scene[key]:
                fail(f"scene {sid}.{key} 与源卡冻结值不符:期望含 {anchor!r},实为 {scene[key]!r}")
    if not scale.get("mono_default"):
        fail("size-scale.json 缺 mono_default")
    if "12px" not in scale.get("cjk_floor_note", ""):
        fail("size-scale.json 的 cjk_floor_note 必须写明中文标签取 12px 上限(与 thin 包同口径)")

    # 回退栈:角色齐 + serif 禁入 body
    body = read_json("tokens/body-sans.json")
    for role in BODY_ROLE_KEYS:
        if not str(body["roles"].get(role, "")).strip():
            fail(f"body-sans.json 缺角色 {role}")
    probe_stack = body["roles"]["body"].replace("sans-serif", "")
    for term in SERIF_BAN:
        if term in probe_stack:
            fail(f"body 回退栈里出现 {term!r}:SimSun / 宋体 / serif 禁入 body")
    if "300" not in body.get("weights", "") or "陷阱" not in body.get("weights", ""):
        fail("body-sans.json.weights 必须写明 300 陷阱")
    if "SimSun" not in body.get("features", [""])[0]:
        fail("body-sans.json.features 必须写明 SimSun / 宋体 / serif 禁入 body")

    console = read_json("tokens/console.json")
    for role in CONSOLE_ROLE_KEYS:
        if not str(console["roles"].get(role, "")).strip():
            fail(f"console.json 缺角色 {role}")
    if "system-ui" not in console["roles"]["body"]:
        fail("console.json.body 必须是 system-ui 打头的系统栈")
    if not any("tabular-nums" in f for f in console.get("features", [])):
        fail("console.json 必须写明 tabular-nums")

    # 免费清单:三条 + 许可明确 + 来源可达(https)+ 上游标待核
    free = read_json("tokens/free-thin-cjk.json")
    cands = free.get("candidates", [])
    if len(cands) != 3:
        fail(f"免费清单须恰好 3 条,实为 {len(cands)}")
    licenses = []
    for cand in cands:
        for key in ("name", "license", "family_css"):
            if not str(cand.get(key, "")).strip():
                fail(f"候选 {cand.get('id')} 缺字段 {key}")
        if cand["license"] not in FREE_LICENSES:
            fail(f"候选 {cand['id']} 许可 {cand['license']!r} 不在白名单 {FREE_LICENSES}")
        if not cand.get("license_note"):
            fail(f"候选 {cand['id']} 缺 license_note(许可 id 必须带来源说明,禁裸写)")
        src = cand.get("source") or {}
        for key in ("package", "css", "checked", "upstream_home"):
            if not str(src.get(key, "")).strip():
                fail(f"候选 {cand['id']} source 缺字段 {key}")
        if not src["css"].startswith("https://"):
            fail(f"候选 {cand['id']} 下载来源必须是 https:{src['css']!r}")
        if "待核" not in src["upstream_home"]:
            fail(f"候选 {cand['id']} 的上游主页未核到就须标「待核」")
        licenses.append(f"{cand['name']} = {cand['license']}")
    if not free.get("refused"):
        fail("free-thin-cjk.json 缺 refused(禁推荐清单)")

    # docs:三场景 + 三列清单(同一行同时出现 名 / 许可 / 来源)
    usage = (ROOT / "docs" / "usage.md").read_text(encoding="utf-8")
    for cue in USAGE_CUES:
        if cue not in usage:
            fail(f"docs/usage.md 缺必备小节 / 关键词:{cue}")
    for sid, scene in scenes.items():
        if scene["body"] not in usage:
            fail(f"docs/usage.md 未贴出 {sid} 的 body 档:{scene['body']!r}")
    rows = usage.splitlines()
    for cand in cands:
        need = (cand["name"], cand["license"], cand["source"]["package"])
        if not any(all(n in row for n in need) for row in rows):
            fail(f"docs/usage.md 缺三列齐的清单行(字体名 / 许可 / 来源):{' | '.join(need)}")

    # preview 相对引用可解析 + 外链只允许 https
    refs = []
    for rel in ("preview/index.html", "preview/preview.css"):
        path = ROOT / rel
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        for ref in [m.group(1) for m in REF_ATTR.finditer(text)] + [m.group(1) for m in REF_URL.finditer(text)]:
            low = ref.strip().lower()
            if not low or low.startswith(("#", "data:", "mailto:", "tel:")):
                continue
            if low.startswith(HTTPS):
                continue
            if low.startswith(NON_HTTPS):
                fail(f"{rel} 引用了非 https 外链:{ref}")
            target = (path.parent / ref.split("?")[0].split("#")[0]).resolve()
            if not str(target).startswith(str(ROOT.resolve())) or not target.is_file():
                fail(f"{rel} 的相对引用解析不到本包内真实文件:{ref}")
            refs.append(f"{rel} → {target.relative_to(ROOT).as_posix()}")

    # 预览字号地板(中文标签下限;拉丁 / 数字标签的最低档是 11px,预览统一取 12px)
    decls, min_px = 0, None
    for path in sorted(ROOT.glob("preview/**/*.css")) + sorted(ROOT.glob("preview/**/*.html")):
        rel = path.relative_to(ROOT).as_posix()
        text = path.read_text(encoding="utf-8")
        for raw in FONT_SIZE_DECL.findall(text) + FONT_SIZE_CUSTOM.findall(text):
            value = raw.strip().rstrip("!").strip()
            if value.lower() in ("inherit", "initial", "unset", "revert") or value.lower().startswith(("var(", "calc(")):
                continue
            decls += 1
            clamp = CLAMP.match(value)
            if clamp:
                args = [a.strip() for a in clamp.group(1).split(",")]
                if len(args) != 3:
                    fail(f"{rel}: clamp 须三段,实为 {value!r}")
                lo, _, hi = args
                if re.search(r"vw", hi, re.I):
                    fail(f"{rel}: 禁用 vw 外推上限,clamp 上限为 {hi!r}")
                m = PX.match(lo) or REM.match(lo)
                if not m:
                    fail(f"{rel}: clamp 下限须是 px 或 rem,实为 {lo!r}")
                px = float(m.group(1)) * (16.0 if lo.lower().endswith("rem") else 1.0)
            else:
                if re.search(r"vw", value, re.I):
                    fail(f"{rel}: 禁用 vw 外推,裸字号 {value!r}")
                m = PX.match(value)
                if not m:
                    fail(f"{rel}: 字号 {value!r} 既不是 px 也不是 clamp(px, …, px)")
                px = float(m.group(1))
            if px < FLOOR_PX:
                fail(f"{rel}: 字号 {px:.0f}px 低于 {FLOOR_PX:.0f}px 地板")
            min_px = px if min_px is None else min(min_px, px)
    if decls == 0:
        fail("字号地板探针扫到 0 条字号声明(禁扫 0 条报绿)")

    if len(pack.get("attribution", [])) < 4:
        fail("pack.json.attribution 须登记四张来源卡与字体许可")
    if not pack["verified"]["evidence"]:
        fail("pack.json.verified.evidence 缺失")

    print(f"PASS assert_tokens {PACK_ID}")
    print("  scenes: " + " | ".join(f"{s['id']} h1 {s['h1']} / body {s['body']}" for s in scenes.values()))
    print("  free fonts: " + " · ".join(licenses) + " (逐条带来源,上游主页标待核)")
    print(f"  preview: {decls} 条字号声明,最小 {min_px:.0f}px(x8 中文标签地板);引用 {len(refs)} 条全部在本包内")


if __name__ == "__main__":
    main()
