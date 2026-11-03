#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""references 包断言(零依赖,stdlib only)。

四件事:
  1. 40 条齐            —— data/ 下的条目文件数 == 40;id 唯一,且与文件名一致;
  2. 索引与条目一致      —— data/index.json 的 count / items 条数 / id 集合 == data/ 文件集合;
  3. 必备字段齐          —— 每条含 id/name/tag/when/matchTheme/layout/observed(colorsDNA 允许 null);
                          索引每条只留 id/name/tag/when/matchTheme(+ source_url);
  4. 无本机路径 / 内网标识 —— 盘符路径、转义盘符、file 协议、UNC 共享、类 Unix 家目录、
                          隧道域名、回环端口、CGNAT 网段;命中即失败。

用法:
    python packs/references/scripts/assert_tokens.py
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

EXPECT_COUNT = 40
GROUPS = ("web", "print", "three", "news", "swiss")
GROUP_CN = {"web": "网页", "print": "纸媒", "three": "三维", "news": "新闻", "swiss": "瑞士"}
GROUP_COUNT = {"web": 6, "print": 7, "three": 7, "news": 15, "swiss": 5}
ITEM_KEYS = ("id", "name", "tag", "when", "matchTheme", "source_url")
REQUIRED = ("id", "name", "tag", "when", "matchTheme", "layout", "observed")
ALLOWED_ITEM_KEYS = set(ITEM_KEYS)
BACKSLASH = chr(92)  # 反斜杠:chr 拼装,断言脚本自身不留可被自家规则命中的字面量
BS2 = BACKSLASH + BACKSLASH  # 正则里表示"字面反斜杠"要写两次
SEP = "[" + BS2 + "/]"

# ---------------------------------------------------------------- 形态规则 #
# 盘符 = 单个字母 + 冒号 + 一个分隔符;分隔符后紧跟另一个分隔符的写法属于 URL 协议头
# (冒号后两个正斜杠),按 URL 处理,不判为盘符。
PATTERNS = [
    ("drive-root", re.compile(r"(?<![A-Za-z0-9])[A-Za-z]:" + SEP + "(?!" + SEP + ")"),
     "Windows 盘符绝对路径"),
    ("drive-escaped", re.compile(r"(?<![A-Za-z0-9])[A-Za-z]:" + "[" + BS2 + "]{2}"),
     "转义写法(两个反斜杠)的盘符路径"),
    ("file-url", re.compile("file:[/]{2,3}"), "本机文件协议 URL"),
    ("unc-path", re.compile("[" + BS2 + "]{2}[^" + BS2 + "/]"), "UNC 网络共享路径"),
    ("unix-home", re.compile("(?<=[" + BACKSLASH + "s(])/(?:Users|home)/"), "类 Unix 家目录"),
    ("tunnel-domain", re.compile("[.]ts[.]net"), "隧道组网域名"),
    ("loopback-port", re.compile("(127[.]0[.]0[.]1|localhost):[0-9]{2,5}"), "本机回环地址+端口"),
    ("cgnat", re.compile("100[.][0-9]+[.][0-9]+[.][0-9]+"), "100.64/10 网段地址"),
]
SCAN_SUFFIXES = {".json", ".md", ".py", ".html", ".css", ".js"}

# 规则自检:每条规则给一个"必须命中"与一个"必须不命中"的样本,防止规则退化成永不命中
# 或把 URL 误判成盘符(样本用 chr/拼接构造,断言脚本自身不得出现被禁字面量)。
_COLON = chr(58)
_SLASH2 = "/" + "/"
SELFTEST = [
    ("drive-root", "C" + _COLON + BACKSLASH + "work" + BACKSLASH + "x.json", True),
    ("drive-root", "c" + _COLON + "/work/x.json", True),
    ("drive-root", "https" + _COLON + _SLASH2 + "example.com/a", False),
    ("drive-root", "docs/usage.md", False),
    ("drive-escaped", '"d' + _COLON + BS2 + "tmp" + BS2 + 'x.json"', True),
    ("file-url", "file" + _COLON + _SLASH2 + "share/x", True),
    ("unc-path", BS2 + "server" + BACKSLASH + "share", True),
    ("unix-home", " (" + "/Use" + "rs/me/x", True),
    ("unix-home", "packages/home/page", False),
    ("tunnel-domain", "host" + "." + "ts" + "." + "net", True),
    ("loopback-port", "127" + "." + "0" + "." + "0" + "." + "1" + _COLON + "8080", True),
    ("cgnat", "100" + "." + "64" + "." + "0" + "." + "1", True),
]

fails: list[str] = []


def fail(msg: str) -> None:
    fails.append(msg)


_rules = {rule_id: pattern for rule_id, pattern, _ in PATTERNS}
selftest_bad = 0
for rule_id, sample, want in SELFTEST:
    got = bool(_rules[rule_id].search(sample))
    if got != want:
        selftest_bad += 1
        fail(
            f"规则自检失败:{rule_id} 样本 {sample!r} 期望"
            f" {'命中' if want else '不命中'},实为 {'命中' if got else '不命中'}"
        )
print(f"[selftest] {len(PATTERNS)} 条形态规则 × {len(SELFTEST)} 个正/反样本,异常 {selftest_bad}")


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"{path.relative_to(PACK).as_posix()}: 无法读取/解析({exc})")
        return None


# ------------------------------------------------------------------ 1 条数 #
entries = sorted(p for p in DATA.glob("*.json") if p.name != "index.json")
print(f"[count] data/ 条目文件 {len(entries)} 个(期望 {EXPECT_COUNT})")
if len(entries) != EXPECT_COUNT:
    fail(f"data/ 条目文件数 {len(entries)} != {EXPECT_COUNT}")

records: dict[str, dict] = {}
for path in entries:
    rec = load_json(path)
    if not isinstance(rec, dict):
        continue
    rid = rec.get("id")
    if rid != path.stem:
        fail(f"{path.name}: id 与文件名不一致(id={rid!r})")
        continue
    if rid in records:
        fail(f"{path.name}: id 重复({rid!r})")
        continue
    records[rid] = rec

# ------------------------------------------------------ 2 索引与条目一致 #
idx = load_json(INDEX)
group_actual = {g: 0 for g in GROUPS}
for rec in records.values():
    tag = rec.get("tag")
    if tag in group_actual:
        group_actual[tag] += 1
group_text = " · ".join(f"{GROUP_CN[g]} {group_actual[g]}" for g in GROUPS)
print(f"[groups] {group_text} = {sum(group_actual.values())}")

if isinstance(idx, dict):
    items = idx.get("items")
    if not isinstance(items, list):
        fail("index.json: items 不是数组")
        items = []
    print(f"[index] count={idx.get('count')} items={len(items)} bytes={INDEX.stat().st_size}")
    if idx.get("count") != len(items):
        fail(f"index.json: count={idx.get('count')} 与 items 条数 {len(items)} 不一致")
    if len(items) != len(records) or idx.get("count") != len(records):
        fail(f"index.json 条数 {len(items)} / count={idx.get('count')} != data/ 文件数 {len(records)}")
    idx_ids = [it.get("id") for it in items if isinstance(it, dict)]
    if len(set(idx_ids)) != len(idx_ids):
        fail("index.json: id 有重复")
    if set(idx_ids) != set(records):
        missing = sorted(set(records) - set(idx_ids))
        extra = sorted(set(idx_ids) - set(records))
        fail(f"index.json 与 data/ 的 id 集合不一致(缺 {missing},多 {extra})")
    groups_declared = idx.get("groups")
    if groups_declared != group_actual:
        fail(f"index.json: groups={groups_declared} 与实际 {group_actual} 不一致")
    for it in items:
        if not isinstance(it, dict):
            fail("index.json: 条目不是对象")
            continue
        extra_keys = set(it) - ALLOWED_ITEM_KEYS
        if extra_keys:
            fail(f"index.json {it.get('id')}: 多余字段 {sorted(extra_keys)}")
        for key in ("id", "name", "tag", "when", "matchTheme"):
            if not it.get(key):
                fail(f"index.json {it.get('id')}: 索引字段 {key!r} 缺失/为空")
else:
    fail("index.json: 不是对象")

# ---------------------------------------------------------- 3 必备字段齐 #
for rid, rec in sorted(records.items()):
    for key in REQUIRED:
        if key not in rec:
            fail(f"{rid}: 缺字段 {key!r}")
        elif not isinstance(rec[key], str) or not rec[key].strip():
            fail(f"{rid}: 字段 {key!r} 非字符串或为空")
    if rec.get("tag") not in GROUPS:
        fail(f"{rid}: tag={rec.get('tag')!r} 不在 {list(GROUPS)}")
    cdn = rec.get("colorsDNA")
    if cdn is not None and not isinstance(cdn, dict):
        fail(f"{rid}: colorsDNA 既非 null 也非对象")

for g in GROUPS:
    if group_actual[g] != GROUP_COUNT[g]:
        fail(f"组 {g}: {group_actual[g]} 条 != 期望 {GROUP_COUNT[g]}")

# ---------------------------------------------------- 4 本机路径/内网标识 #
files_scanned = 0
hits = 0
for path in sorted(p for p in PACK.rglob("*") if p.is_file() and p.suffix in SCAN_SUFFIXES):
    files_scanned += 1
    for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        for rule_id, pattern, why in PATTERNS:
            m = pattern.search(line)
            if m:
                hits += 1
                fail(f"{path.relative_to(PACK).as_posix()}:{lineno}: [{rule_id}] {why} → {m.group(0)!r}")
print(f"[clean] 扫 {files_scanned} 个文本文件 × {len(PATTERNS)} 条形态规则,命中 {hits}")

# ------------------------------------------------------------- 5 文档齐备 #
if USAGE.is_file():
    usage = USAGE.read_text(encoding="utf-8")
    for token in ("反模式",) + tuple(GROUP_CN[g] for g in GROUPS):
        if token not in usage:
            fail(f"docs/usage.md: 缺小节/词 {token!r}")
    print(f"[docs] docs/usage.md {len(usage.encode()):d}B,五组名与反模式小节齐")
else:
    fail("docs/usage.md 缺失")

# ------------------------------------------------------------------ 结果 #
if fails:
    for f in fails:
        print(f"FAIL {f}")
    print(f"FAIL assert_tokens references: {len(fails)} 项不通过")
    sys.exit(1)

print(
    "PASS assert_tokens references — 40 条 · index 40 条一致 · 必备字段齐 · "
    f"形态规则 {len(PATTERNS)} 条 0 命中 · index.json {INDEX.stat().st_size}B"
)
