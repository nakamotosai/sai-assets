#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""sai-assets 公开内容闸(gate before commit)。

三层:
  1. schema  — 逐个 packs/*/pack.json 按 schema/pack.schema.json 校验(内置校验器,零依赖);
               另查 files.* 列出的路径真实存在、origin.path 不是绝对路径;
               packs/*/pack.json 少于 1 个即报红(扫 0 个包不许报绿)。
  2. banned  — 扫 git 跟踪的文本文件(git ls-files -z;非 git 目录回退为遍历,两种情况都排除
               .git/、node_modules/、.private/),按 schema/banned.json 的规则找公开风险串。
  3. assert  — 逐个 packs/*/scripts/assert_tokens.py 子进程执行(超时 120s),每包打印一行
               `[assert] <pack>: PASS|退出码 N|超时`,失败回传尾部输出 ≤20 行。

用法:
    python scripts/gate.py                  # 全仓三层闸
    python scripts/gate.py --json           # 机器可读输出
    python scripts/gate.py --scan-dir DIR   # 内容层改扫 DIR(试红 / 外部目录审计)
    python scripts/gate.py --scan-upstream  # 连 packs/*/upstream/** 一起扫(默认整块跳过)

退出码:0 = 全绿;1 = 有 findings;2 = 闸自身配置 / 环境错误。
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
PACK_SCHEMA_PATH = REPO_ROOT / "schema" / "pack.schema.json"
BANNED_RULES_PATH = REPO_ROOT / "schema" / "banned.json"

PACKS_DIRNAME = "packs"
SCAN_EXTS = {".md", ".json", ".html", ".css", ".js", ".py", ".yml"}
SKIP_DIRS = {".git", "node_modules", ".private", "__pycache__", ".venv", "out", "dist"}
LOCAL_RULES_REL = ".private/banned.local.json"
# 第三方 vendored 文件整块跳过(内容非本仓自产,任何串都不代表本仓泄漏);--scan-upstream 可解开。
SKIP_PATH_GLOBS = ("packs/*/upstream/**",)

ASSERT_TIMEOUT = 120.0
ASSERT_TAIL_LINES = 20
SNIPPET_MAX = 72


# --------------------------------------------------------------------------- #
# 1. 内置 JSON Schema 校验器(覆盖 pack.schema.json 用到的子集)
# --------------------------------------------------------------------------- #

def _type_ok(value: object, want: str) -> bool:
    if want == "object":
        return isinstance(value, dict)
    if want == "array":
        return isinstance(value, list)
    if want == "string":
        return isinstance(value, str)
    if want == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if want == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if want == "boolean":
        return isinstance(value, bool)
    if want == "null":
        return value is None
    raise SystemExit(f"gate 内部错误:未支持的 type {want!r}")


def _typename(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    if isinstance(value, int):
        return "integer"
    return "number"


def validate(value: object, schema: dict, where: str, out: list) -> None:
    """把 schema 的违规写进 out(字符串列表);支持 required/type/enum/const/pattern/
    minLength/minItems/additionalProperties/嵌套 object 与数组 items/not。"""
    if "type" in schema:
        types = schema["type"]
        types = [types] if isinstance(types, str) else list(types)
        if not any(_type_ok(value, t) for t in types):
            out.append(f"{where}: 类型须为 {'|'.join(types)},实为 {_typename(value)}")
            return
    if "const" in schema and value != schema["const"]:
        out.append(f"{where}: 须为常量 {schema['const']!r},实为 {value!r}")
    if "enum" in schema and value not in schema["enum"]:
        out.append(f"{where}: 取值须属于 {schema['enum']},实为 {value!r}")
    if isinstance(value, str):
        if "minLength" in schema and len(value) < schema["minLength"]:
            out.append(f"{where}: 长度 {len(value)} < minLength {schema['minLength']}")
        if "pattern" in schema and not re.search(schema["pattern"], value):
            out.append(f"{where}: 不匹配 pattern {schema['pattern']!r},实为 {value!r}")
    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            out.append(f"{where}: 元素 {len(value)} 个 < minItems {schema['minItems']}")
        if isinstance(schema.get("items"), dict):
            for i, item in enumerate(value):
                validate(item, schema["items"], f"{where}/{i}", out)
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                out.append(f"{where}: 缺必填字段 {key!r}")
        props = schema.get("properties", {})
        for key, sub in props.items():
            if key in value and isinstance(sub, dict):
                validate(value[key], sub, f"{where}/{key}", out)
        if schema.get("additionalProperties") is False:
            for key in sorted(set(value) - set(props)):
                out.append(f"{where}: 多余字段 {key!r}(additionalProperties=false)")
    if "not" in schema:
        probe: list = []
        validate(value, schema["not"], where, probe)
        if not probe:
            out.append(f"{where}: 命中 not 禁例 {json.dumps(schema['not'], ensure_ascii=False)}")


def _json_pointer(where: str) -> str:
    rel = where.strip("/")
    return "#" if not rel else "#/" + rel


def check_packs(packs_dir: Path, pack_schema: dict, tracked: set[str] | None = None) -> tuple[list, int]:
    """返回 (schema findings, 包数);0 个包本身就是 findings(禁止扫 0 个包报绿)。

    tracked 非空时只认 git 跟踪的 pack.json(与清扫面同口径:未 add 的新包不计入,
    这样"先 add 再跑闸"这一条对 schema 与 assert 都成立,CI 与本地结论一致)。"""
    findings: list = []
    pack_files = sorted(packs_dir.glob("*/pack.json")) if packs_dir.is_dir() else []
    if tracked is not None:
        pack_files = [p for p in pack_files if p.relative_to(packs_dir.parent).as_posix() in tracked]
    if not pack_files:
        findings.append(
            "[schema] packs/*/pack.json: 找到 0 个(至少须 1 个;扫 0 个包不许报绿)"
        )
    for pack_json in pack_files:
        pack_id = pack_json.parent.name
        try:
            raw = pack_json.read_text(encoding="utf-8")
            data = json.loads(raw)
        except (OSError, json.JSONDecodeError) as exc:
            findings.append(f"[schema] {pack_id}/pack.json: 无法解析({exc})")
            continue
        errors: list = []
        validate(data, pack_schema, "", errors)
        for err in errors:
            where, _, msg = err.partition(": ")
            findings.append(f"[schema] {pack_id}/{_json_pointer(where)}: {msg}")
        if isinstance(data, dict):
            origin = data.get("origin")
            path = origin.get("path") if isinstance(origin, dict) else None
            if isinstance(path, str) and re.match(r"^([A-Za-z]:[\\/]|[\\/])", path):
                findings.append(
                    f"[schema] {pack_id}/#/origin/path: 必须是相对路径,实为 {path!r}"
                )
            files = data.get("files")
            if isinstance(files, dict):
                for key in sorted(files):
                    listed = files[key]
                    if listed is None:
                        continue
                    paths = listed if isinstance(listed, list) else [listed]
                    for rel in paths:
                        if not isinstance(rel, str) or not rel:
                            continue
                        if not (pack_json.parent / rel).exists():
                            findings.append(
                                f"[schema] {pack_id}/#/files/{key}: 列出的文件不存在 {rel!r}"
                            )
    return findings, len(pack_files)


# --------------------------------------------------------------------------- #
# 2. 清洗闸(禁用内容扫描)
# --------------------------------------------------------------------------- #

def load_rules(cfg: dict, root: Path) -> tuple[list, dict]:
    """公开层规则 + 私有补充表(root/.private/banned.local.json,存在则合并,同 id 本地优先)。"""
    merged: dict = {}
    for rule in cfg.get("rules", []):
        merged[rule["id"]] = rule
    public_count = len(merged)
    local_path = root / LOCAL_RULES_REL
    meta = {"public": public_count, "local": 0}
    if not local_path.is_file():
        return list(merged.values()), meta
    data = json.loads(local_path.read_text(encoding="utf-8"))
    local_rules = data.get("rules", []) if isinstance(data, dict) else []
    for rule in local_rules:
        merged[rule["id"]] = rule
    meta["local"] = len(local_rules)
    return list(merged.values()), meta


def _match_any_glob(rel: str, globs) -> str | None:
    for glob in globs:
        if fnmatch.fnmatchcase(rel, glob):
            return glob
    return None


def _scan_mode(root: Path) -> tuple[list[str] | None, str]:
    """git 跟踪文件(相对 root 的 posix 路径)+ 模式名;不可用/索引为空时返回 (None, "walk")。"""
    try:
        proc = subprocess.run(
            ["git", "-C", str(root), "ls-files", "-z"],
            capture_output=True,
            timeout=60,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return None, f"walk(git 不可用:{exc.__class__.__name__})"
    if proc.returncode != 0:
        return None, f"walk(不是 git 工作树:exit {proc.returncode})"
    names = [name for name in proc.stdout.decode("utf-8", errors="surrogateescape").split("\0") if name]
    if not names:
        return None, "walk(git 索引为空 → 回退遍历,避免扫 0 个文件却报绿)"
    return names, f"git ls-files({len(names)} 个文件)"


def _candidate_rels(root: Path, stats: dict) -> list[str]:
    tracked, mode = _scan_mode(root)
    stats["scan_mode"] = mode
    if tracked is not None:
        return sorted(set(tracked))
    rels = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        for name in sorted(filenames):
            rels.append((Path(dirpath) / name).relative_to(root).as_posix())
    return sorted(set(rels))


def _iter_text_files(root: Path, skip_upstream: bool, stats: dict):
    for rel in _candidate_rels(root, stats):
        parts = rel.split("/")
        if any(part in SKIP_DIRS for part in parts[:-1]):
            continue
        path = root / rel
        if path.suffix.lower() not in SCAN_EXTS:
            continue
        if skip_upstream and _match_any_glob(rel, SKIP_PATH_GLOBS):
            stats["upstream"] = stats.get("upstream", 0) + 1
            continue
        try:
            if not path.is_file():
                continue
        except OSError:
            continue
        yield path, rel


def _snippet(line: str, start: int) -> str:
    left = max(0, start - 24)
    return line[left:left + SNIPPET_MAX].strip()


def scan_banned(root: Path, rule_set: list, scan_upstream: bool, exempt_files: list) -> tuple[list, list, list, dict]:
    """返回 (findings, allow 命中, 豁免文件留痕, 扫描统计)。"""
    rules = []
    for rule in rule_set:
        rules.append((
            rule["id"],
            re.compile(rule["pattern"]),
            rule.get("allow", []),
            rule.get("why", ""),
        ))
    findings: list = []
    allow_hits: list = []
    allow_seen: set = set()
    exempt_hits: list = []
    exempt_seen: set = set()
    exempt_globs = [entry.get("path", "") for entry in exempt_files]
    stats: dict = {}
    for path, rel in _iter_text_files(root, skip_upstream=not scan_upstream, stats=stats):
        glob = _match_any_glob(rel, exempt_globs)
        if glob:
            why = next((e.get("why", "") for e in exempt_files if e.get("path") == glob), "")
            notice = f"[exempt] {rel} 跳过({why})"
            if notice not in exempt_seen:
                exempt_seen.add(notice)
                exempt_hits.append(notice)
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for lineno, line in enumerate(text.splitlines(), 1):
            for rule_id, regex, allow, why in rules:
                match = regex.search(line)
                if not match:
                    continue
                allow_hit = None
                for entry in allow:
                    if _match_any_glob(rel, [entry.get("path", "")]) and entry.get("contains", "") in line:
                        allow_hit = entry
                        break
                if allow_hit is not None:
                    key = (rel, lineno, rule_id, allow_hit.get("why", ""))
                    if key not in allow_seen:
                        allow_seen.add(key)
                        allow_hits.append(
                            f"[allow] {rel}:{lineno}: {rule_id} 放行({allow_hit.get('why', '')})"
                        )
                    continue
                findings.append({
                    "file": rel,
                    "line": lineno,
                    "rule": rule_id,
                    "why": why,
                    "snippet": _snippet(line, match.start()),
                })
    return findings, allow_hits, exempt_hits, stats


# --------------------------------------------------------------------------- #
# 3. 断言闸
# --------------------------------------------------------------------------- #

def run_assertions(packs_dir: Path, tracked: set[str] | None = None) -> tuple[list, int]:
    """逐个包跑 scripts/assert_tokens.py;返回 (逐包结果(含失败尾部), 执行数)。

    与 schema/清扫同口径:tracked 非空时只跑 git 跟踪的断言脚本(在建中、未 add 的包不参与)。"""
    results: list = []
    scripts = sorted(packs_dir.glob("*/scripts/assert_tokens.py")) if packs_dir.is_dir() else []
    if tracked is not None:
        scripts = [s for s in scripts if s.relative_to(packs_dir.parent).as_posix() in tracked]
    for script in scripts:
        pack_dir = script.parents[1]
        pack_id = pack_dir.name
        try:
            proc = subprocess.run(
                [sys.executable, str(script)],
                cwd=str(pack_dir),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=ASSERT_TIMEOUT,
            )
        except subprocess.TimeoutExpired:
            results.append({
                "pack": pack_id,
                "ok": False,
                "detail": f"[assert] {pack_id}: 超时(>{ASSERT_TIMEOUT:.0f}s)",
                "tail": [],
            })
            continue
        except OSError as exc:
            results.append({
                "pack": pack_id,
                "ok": False,
                "detail": f"[assert] {pack_id}: 无法执行({exc})",
                "tail": [],
            })
            continue
        if proc.returncode != 0:
            combined = (proc.stdout or "") + (proc.stderr or "")
            tail = combined.strip().splitlines()[-ASSERT_TAIL_LINES:]
            results.append({
                "pack": pack_id,
                "ok": False,
                "detail": f"[assert] {pack_id}: 退出码 {proc.returncode}",
                "tail": tail,
            })
        else:
            results.append({
                "pack": pack_id,
                "ok": True,
                "detail": f"[assert] {pack_id}: PASS",
                "tail": [],
            })
    return results, len(scripts)


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #

def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        prog="gate.py",
        description="sai-assets 公开内容闸:schema + 清洗 + 断言",
    )
    parser.add_argument(
        "--scan-dir",
        metavar="DIR",
        default=None,
        help="内容层改扫该目录(默认 = 本仓根);git 目录扫 git ls-files,非 git 目录回退遍历",
    )
    parser.add_argument("--json", action="store_true", help="输出 JSON(机器可读)")
    parser.add_argument(
        "--scan-upstream",
        action="store_true",
        help="连 packs/*/upstream/** 一起扫(默认整块跳过;第三方版权行按 allow 放行)",
    )
    return parser.parse_args(argv)


def main(argv=None) -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(errors="backslashreplace")
            except (ValueError, OSError):
                pass

    args = parse_args(argv)

    try:
        pack_schema = json.loads(PACK_SCHEMA_PATH.read_text(encoding="utf-8"))
        banned_cfg = json.loads(BANNED_RULES_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"gate: 闸自身配置不可用:{exc}", file=sys.stderr)
        return 2

    root = Path(args.scan_dir).resolve() if args.scan_dir else REPO_ROOT
    if not root.is_dir():
        print(f"gate: --scan-dir 不是目录:{root}", file=sys.stderr)
        return 2

    packs_dir = root / PACKS_DIRNAME
    exempt_files = banned_cfg.get("exempt_files", [])

    try:
        rule_set, rules_meta = load_rules(banned_cfg, root)
        for rule in rule_set:
            re.compile(rule["pattern"])
    except (OSError, json.JSONDecodeError, KeyError, TypeError, re.error) as exc:
        print(f"gate: 规则表不可用({LOCAL_RULES_REL} 或 schema/banned.json):{exc}", file=sys.stderr)
        return 2

    tracked_files, _mode = _scan_mode(root)
    tracked_set = set(tracked_files) if tracked_files is not None else None

    schema_findings, pack_count = check_packs(packs_dir, pack_schema, tracked_set)
    banned_findings, allow_hits, exempt_hits, scan_stats = scan_banned(
        root, rule_set, args.scan_upstream, exempt_files
    )
    assert_results, assert_count = run_assertions(packs_dir, tracked_set)
    assert_findings = [r for r in assert_results if not r["ok"]]

    total = len(schema_findings) + len(banned_findings) + len(assert_findings)
    ok = total == 0

    if args.json:
        print(json.dumps({
            "ok": ok,
            "findings": total,
            "packs": pack_count,
            "assertions": assert_count,
            "scan_mode": scan_stats.get("scan_mode"),
            "rules": rules_meta,
            "schema": schema_findings,
            "banned": banned_findings,
            "assert": assert_results,
            "allowed": allow_hits,
            "exempted": exempt_hits,
            "skipped_upstream_files": scan_stats.get("upstream", 0),
        }, ensure_ascii=False, indent=2))
        return 0 if ok else 1

    print(f"[scan] {scan_stats.get('scan_mode', '?')}")
    if rules_meta["local"]:
        print(f"[rules] 公开 {rules_meta['public']} 条 + 本地 {rules_meta['local']} 条")
    else:
        print(f"[rules] 仅公开 {rules_meta['public']} 条(本地补充表缺失)")
    for detail in schema_findings:
        print(detail)
    for hit in banned_findings:
        print(f"[banned] {hit['file']}:{hit['line']}:{hit['rule']}: {hit['snippet']}")
    for result in assert_results:
        print(result["detail"])
        for line in result["tail"]:
            print(f"    {line}")
    for hit in exempt_hits:
        print(hit)
    for hit in allow_hits:
        print(hit)

    if ok:
        print(f"PASS gate: 0 findings, {pack_count} packs, {assert_count} assertions")
        return 0
    print(
        f"FAIL gate: {total} findings "
        f"({len(schema_findings)} schema / {len(banned_findings)} banned / "
        f"{len(assert_findings)} assert), {pack_count} packs, {assert_count} assertions"
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
