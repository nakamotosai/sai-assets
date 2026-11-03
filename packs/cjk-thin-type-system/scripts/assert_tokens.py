#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""cjk-thin-type-system 断言:pack.json 齐备 / 产物存在 / 档位自洽 / 审计探针。

审计探针(硬断言,能判失败):
  1 字号地板   —— 纯 px 字号与 clamp() 下限都不得 < 12px
  2 最小行高   —— 无单位 line-height 不得 < 1.35
  3 vw 外推    —— 字号里的 vw 只准出现在 clamp() 中段,上限必须绝对单位
  4 中文禁斜体 —— 样式表里不得出现 font-style:italic

退出 0 = 通过,打印 PASS assert_tokens cjk-thin-type-system。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK_ID = "cjk-thin-type-system"

REQUIRED_PACK_KEYS = (
    "schema", "id", "title", "kind", "category", "version", "license", "attribution",
    "origin", "entry", "files", "tags", "when", "not_for", "verified",
)
# 禁用形态一律运行时拼:断言脚本里不出现被禁字面量(规则正本 = scripts/gate.py)
SCHEME_HTTP = "http" + ":" + "/" * 2
SCHEME_LOCAL = "file" + ":"
SCHEME_REL = "/" * 2
NON_HTTPS = (SCHEME_HTTP, SCHEME_LOCAL, SCHEME_REL)
HTTPS = "https" + ":" + "/" * 2
# origin.path 是否为相对路径由 gate.py 的 schema 闸判定,这里不复刻该规则(第二份规则会先于闸过期)
AXIS_COUNTS = {"scale": 4, "weights": 2, "tracking": 3, "leading": 3, "shadow": 2}
FLOOR_PX = 12.0
MIN_LEADING = 1.35
DISPLAY_SHADOW_MIN_PX = 28.0
THIN_LADDER = {200: 17.0, 300: 14.0, 400: 12.0}
USAGE_CUES = ("配", "反模式", "审计探针", "12px", "越大越细", "vw", "斜体", "border-bottom")

FONT_SIZE_DECL = re.compile(r"font-size\s*:\s*([^;{}]+)", re.I)
# 自定义属性里的字号同样要过地板(clamp / vw 规则一视同仁),否则 --fs-* 会绕过探针
FONT_SIZE_CUSTOM = re.compile(r"--(?:fs|font-size)[\w-]*\s*:\s*([^;{}]+)", re.I)
LINE_HEIGHT_DECL = re.compile(r"line-height\s*:\s*([^;{}]+)", re.I)
LINE_HEIGHT_CUSTOM = re.compile(r"--lh[\w-]*\s*:\s*([^;{}]+)", re.I)
ITALIC_DECL = re.compile(r"font-style\s*:\s*italic", re.I)
REF_ATTR = re.compile(r"""(?:src|href)\s*=\s*["']([^"']+)["']""", re.I)
REF_URL = re.compile(r"""url\(\s*["']?([^"')]+)["']?\s*\)""", re.I)
CLAMP = re.compile(r"^clamp\(\s*([^,]+?)\s*,\s*([^,]+?)\s*,\s*([^)]+?)\s*\)$", re.I)
PX = re.compile(r"^(-?\d+(?:\.\d+)?)px$", re.I)
NUMBER = re.compile(r"^-?\d+(?:\.\d+)?$")
PROBE_GLOBS = ("preview/**/*.css", "preview/**/*.html")


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


def split_layers(css: str) -> list[str]:
    """按顶层逗号切分 box-shadow 层(括号内的逗号不算)。"""
    layers, depth, buf = [], 0, ""
    for ch in css:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            layers.append(buf.strip())
            buf = ""
            continue
        buf += ch
    if buf.strip():
        layers.append(buf.strip())
    return layers


def check_pack_json() -> dict:
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
    for key, listed in sorted(files.items()):
        if listed is None:
            continue
        for rel in (listed if isinstance(listed, list) else [listed]):
            if not (ROOT / rel).is_file():
                fail(f"files.{key} 列出的文件不存在:{rel}")
    for rel in ("SKILL.md", "README.md", "docs/usage.md", "scripts/assert_tokens.py", "preview/index.html"):
        if not (ROOT / rel).is_file():
            fail(f"missing {rel}")
    return pack


def check_tokens() -> dict:
    idx = read_json("tokens/index.json")
    axes = {a["id"]: a for a in idx.get("axes", [])}
    for axis_id, count in AXIS_COUNTS.items():
        if axis_id not in axes:
            fail(f"tokens/index.json 缺轴 {axis_id}")
        if axes[axis_id]["count"] != count:
            fail(f"轴 {axis_id} 声明 {axes[axis_id]['count']} 档,应为 {count}")
        if not (ROOT / axes[axis_id]["file"]).is_file():
            fail(f"轴 {axis_id} 指向的文件不存在:{axes[axis_id]['file']}")
    if idx.get("family_pack") != "cjk-typography":
        fail("tokens/index.json 须把字族来源指向 cjk-typography 包")

    scale = read_json("tokens/scale.json")
    weights = read_json("tokens/weights.json")
    tracking = read_json("tokens/tracking.json")
    leading = read_json("tokens/leading.json")
    shadow = read_json("tokens/shadow.json")

    tiers = scale["tiers"]
    if len(tiers) != AXIS_COUNTS["scale"]:
        fail(f"scale 档数 {len(tiers)},应为 {AXIS_COUNTS['scale']}")
    if scale.get("floor_px") != 12:
        fail("scale.floor_px 须为 12")

    w_by_id = {t["id"]: t for t in weights["tiers"]}
    if len(w_by_id) != AXIS_COUNTS["weights"]:
        fail(f"weights 档数 {len(weights['tiers'])},应为 {AXIS_COUNTS['weights']}")
    thin = weights["pair"]["text"]

    l_min = min(t["value"] for t in leading["tiers"])
    if len(leading["tiers"]) != AXIS_COUNTS["leading"]:
        fail(f"leading 档数 {len(leading['tiers'])},应为 {AXIS_COUNTS['leading']}")
    if l_min < MIN_LEADING:
        fail(f"leading 最小档 {l_min} < {MIN_LEADING}")
    if leading.get("floor") != MIN_LEADING:
        fail(f"leading.floor 须为 {MIN_LEADING}")

    if len(tracking["tiers"]) != AXIS_COUNTS["tracking"]:
        fail(f"tracking 档数 {len(tracking['tiers'])},应为 {AXIS_COUNTS['tracking']}")

    sh = {t["id"]: t for t in shadow["tiers"]}
    if len(sh) != AXIS_COUNTS["shadow"]:
        fail(f"shadow 档数 {len(sh)},应为 {AXIS_COUNTS['shadow']}")
    for sid, tier in sh.items():
        layers = len(split_layers(tier["css"]))
        if layers != tier["layers"]:
            fail(f"shadow.{sid} 声明 {tier['layers']} 层,实测 {layers} 层")
    if sh["text"]["layers"] > 1:
        fail("细体只准单层影:shadow.text 层数须为 1")
    if sh["display"]["min_px"] < DISPLAY_SHADOW_MIN_PX:
        fail(f"第二层扩散影只给 ≥{DISPLAY_SHADOW_MIN_PX:.0f}px,shadow.display.min_px={sh['display']['min_px']}")

    # 档位 × 字重 / 行高 / 影 的配对自洽
    measured = []
    for tier in tiers:
        tid = tier["id"]
        w = w_by_id.get(tier["weight"])
        if w is None:
            fail(f"scale.{tid} 指向不存在的字重档 {tier['weight']!r}")
        if w["value"] in THIN_LADDER and tier["min_px"] < THIN_LADDER[w["value"]]:
            fail(f"越大越细:字重 {w['value']} 只准 ≥{THIN_LADDER[w['value']]:.0f}px,scale.{tid}.min_px={tier['min_px']}")
        if tier["min_px"] < FLOOR_PX:
            fail(f"字号地板 {FLOOR_PX:.0f}px:scale.{tid}.min_px={tier['min_px']}")
        if tier.get("tracking") and tier["tracking"] not in {t["id"] for t in tracking["tiers"]}:
            fail(f"scale.{tid} 指向不存在的字距档 {tier['tracking']!r}")
        if tier["leading"] not in {t["id"] for t in leading["tiers"]}:
            fail(f"scale.{tid} 指向不存在的行高档 {tier['leading']!r}")
        if tier["shadow"] not in sh:
            fail(f"scale.{tid} 指向不存在的影档 {tier['shadow']!r}")
        if tier["shadow"] == "display" and tier["min_px"] < DISPLAY_SHADOW_MIN_PX:
            fail(f"scale.{tid}({tier['min_px']}px) 不许挂双层扩散影")
        measured.append(f"{tid} {tier['min_px']:.0f}-{tier['max_px']:.0f}px/w{w['value']}")

    return {
        "scale": scale,
        "weights": weights,
        "tracking": tracking,
        "leading": leading,
        "shadow": shadow,
        "measured": measured,
        "thin": thin,
    }


def check_preview_refs(rel: str) -> list[str]:
    """preview 里的相对引用必须能在本包内解析;外链只允许 https。"""
    path = ROOT / rel
    text = path.read_text(encoding="utf-8")
    refs = [m.group(1) for m in REF_ATTR.finditer(text)] + [m.group(1) for m in REF_URL.finditer(text)]
    resolved = []
    for ref in refs:
        low = ref.strip().lower()
        if not low or low.startswith(("#", "data:", "mailto:", "tel:", "javascript:")):
            continue
        if low.startswith(HTTPS):
            continue
        if low.startswith(NON_HTTPS):
            fail(f"{rel} 引用了非 https 外链:{ref}")
        target = (path.parent / ref.split("?")[0].split("#")[0]).resolve()
        if not str(target).startswith(str(ROOT.resolve())):
            fail(f"{rel} 的相对引用逃出本包:{ref}")
        if not target.is_file():
            fail(f"{rel} 的相对引用解析不到真实文件:{ref}")
        resolved.append(f"{rel} → {target.relative_to(ROOT).as_posix()}")
    return resolved


def check_probe() -> dict:
    """审计探针:字号地板 / 最小行高 / vw 外推 / 中文禁斜体。"""
    files = sorted({p for pattern in PROBE_GLOBS for p in ROOT.glob(pattern)})
    if not files:
        fail("audit probe 扫到 0 个 preview 文件(禁扫 0 个文件报绿)")
    decls = 0
    min_px = None
    min_lh = None
    for path in files:
        rel = path.relative_to(ROOT).as_posix()
        text = path.read_text(encoding="utf-8")
        if ITALIC_DECL.search(text):
            fail(f"{rel}: 中文禁斜体,出现 font-style:italic")
        for raw in FONT_SIZE_DECL.findall(text) + FONT_SIZE_CUSTOM.findall(text):
            value = raw.strip().rstrip("!").strip()
            if value.lower() in ("inherit", "initial", "unset", "revert", "smaller", "larger"):
                continue
            if value.lower().startswith(("var(", "min(", "max(", "calc(")):
                continue  # 间接值:实际值由自定义属性承担,那里再查
            decls += 1
            clamp = CLAMP.match(value)
            if clamp:
                lo, mid, hi = (g.strip() for g in clamp.groups())
                m_lo, m_hi = PX.match(lo), PX.match(hi)
                if not m_lo:
                    rem_lo = re.match(r"^(-?\d+(?:\.\d+)?)rem$", lo, re.I)
                    if not rem_lo:
                        fail(f"{rel}: clamp 下限须是 px 或 rem,实为 {lo!r}")
                    lo_px = float(rem_lo.group(1)) * 16.0
                else:
                    lo_px = float(m_lo.group(1))
                if lo_px < FLOOR_PX:
                    fail(f"{rel}: clamp 下限 {lo} 低于 {FLOOR_PX:.0f}px 地板")
                if not mid.lower().endswith(("vw", "vh", "%", "em", "rem")):
                    fail(f"{rel}: clamp 中段 {mid!r} 不是相对单位")
                if re.search(r"vw", hi, re.I):
                    fail(f"{rel}: 禁用 vw 外推上限,clamp 上限为 {hi!r}")
                if not m_hi:
                    fail(f"{rel}: clamp 上限须是绝对单位,实为 {hi!r}")
                px = lo_px
            elif re.search(r"vw", value, re.I):
                fail(f"{rel}: 禁用 vw 外推,裸字号 {value!r}")
            else:
                m = PX.match(value)
                rem = re.match(r"^(-?\d+(?:\.\d+)?)rem$", value, re.I)
                if not m and not rem:
                    fail(f"{rel}: 字号 {value!r} 既不是 px / rem 也不是 clamp(px, …, px)")
                px = float(m.group(1)) if m else float(rem.group(1)) * 16.0
                if px < FLOOR_PX:
                    fail(f"{rel}: 字号 {value} 低于 {FLOOR_PX:.0f}px 地板")
            min_px = px if min_px is None else min(min_px, px)
        for raw in LINE_HEIGHT_DECL.findall(text) + LINE_HEIGHT_CUSTOM.findall(text):
            value = raw.strip()
            if not NUMBER.match(value):
                continue
            lh = float(value)
            if lh < MIN_LEADING:
                fail(f"{rel}: 行高 {value} 低于最小行高 {MIN_LEADING}")
            min_lh = lh if min_lh is None else min(min_lh, lh)
    if decls == 0:
        fail("audit probe 扫到 0 条字号声明(禁扫 0 条报绿)")
    if min_lh is None:
        fail("audit probe 扫到 0 条行高声明(禁扫 0 条报绿)")
    return {"files": len(files), "decls": decls, "min_px": min_px, "min_lh": min_lh}


def check_usage(pack: dict) -> None:
    usage = (ROOT / "docs" / "usage.md").read_text(encoding="utf-8")
    for cue in USAGE_CUES:
        if cue not in usage:
            fail(f"docs/usage.md 缺必备小节 / 关键词:{cue}")
    if not isinstance(pack.get("verified", {}).get("evidence"), str) or len(pack["verified"]["evidence"]) < 4:
        fail("pack.json.verified.evidence 缺失")
    if pack["verified"]["date"] != "2026-11-03":
        fail(f"pack.json.verified.date 不是本轮实测日期:{pack['verified']['date']}")


def main() -> None:
    pack = check_pack_json()
    tok = check_tokens()
    refs = []
    for rel in sorted(p for p in ("preview/index.html", "preview/preview.css")):
        if (ROOT / rel).is_file():
            refs += check_preview_refs(rel)
    probe = check_probe()
    check_usage(pack)

    print(f"PASS assert_tokens {PACK_ID}")
    print(f"  tokens: scale {len(tok['scale']['tiers'])} · weights {len(tok['weights']['tiers'])} · "
          f"tracking {len(tok['tracking']['tiers'])} · leading {len(tok['leading']['tiers'])} · "
          f"shadow {len(tok['shadow']['tiers'])}")
    print("  scale: " + " | ".join(tok["measured"]))
    print(f"  probe: preview {probe['files']} 文件 / {probe['decls']} 条 font-size,最小 {probe['min_px']:.0f}px,"
          f"最小行高 {probe['min_lh']},vw 外推 0,斜体 0")
    if refs:
        print("  refs: " + "; ".join(refs))


if __name__ == "__main__":
    main()
