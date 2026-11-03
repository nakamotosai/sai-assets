#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""sai-assets · 入包文本清洗器(gate 之前的最后一道人工可审阅替换)。

对即将入包的文本文件(.html/.css/.js/.json/.md)执行 schema/sanitize.json 规则表:
本机绝对路径 / 私有业务域名 / 回环与内网地址 / 模板残留 tagline / 保密标记。

原则:
- 每处替换都计数,并按包汇总打印到 stdout(零静默改写);
- --verbose 逐处打印 `文件:行 规则 前 → 后`;
- --dry-run 只报告不落盘;
- 替换文本不含未转义引号/换行,故 .json/.md 结构保持可解析。

用法:
    python scripts/sanitize.py --all                     # 仓内 packs/** 全量
    python scripts/sanitize.py --pack paper-editorial    # 单包
    python scripts/sanitize.py --root <目录> --pack-id x  # 任意目录
    python scripts/sanitize.py --all --verbose --dry-run
    python scripts/sanitize.py --all --json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = REPO_ROOT / "schema" / "sanitize.json"
DEFAULT_PACKS = REPO_ROOT / "packs"
SKIP_DIRS = {".git", "node_modules"}
PLACEHOLDER = re.compile(r"\$\{(tagline|tagline_short)\}")
PREVIEW_LEN = 46


# --------------------------------------------------------------------------- #
# 配置
# --------------------------------------------------------------------------- #

def load_config(path: Path | None = None) -> dict:
    cfg_path = Path(path) if path else DEFAULT_CONFIG
    try:
        cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"sanitize 配置读取失败:{cfg_path}({exc})")
    if not isinstance(cfg, dict) or not cfg.get("rules"):
        raise SystemExit(f"sanitize 配置无 rules:{cfg_path}")
    for rule in cfg["rules"]:
        for key in ("id", "pattern", "replace", "why", "scope"):
            if key not in rule:
                raise SystemExit(f"sanitize 规则缺字段 {key}:{rule!r}")
        try:
            re.compile(rule["pattern"])
        except re.error as exc:
            raise SystemExit(f"sanitize 规则 {rule['id']} 正则不合法:{exc}")
    return cfg


def tagline_for(cfg: dict, pack_id: str) -> dict:
    table = cfg.get("taglines", {})
    return table.get(pack_id) or table.get("*") or {"tagline": "", "tagline_short": ""}


def _resolve_replace(template: str, cfg: dict, pack_id: str) -> str:
    bench = tagline_for(cfg, pack_id)
    return PLACEHOLDER.sub(lambda m: str(bench.get(m.group(1), "")), template)


# --------------------------------------------------------------------------- #
# 单文件替换
# --------------------------------------------------------------------------- #

def _line_no(text: str, pos: int) -> int:
    return text.count("\n", 0, pos) + 1


def _snippet(value: str, limit: int = PREVIEW_LEN) -> str:
    flat = " ".join(value.split())
    if len(flat) <= limit:
        return flat
    return flat[: limit - 1] + "…"


def sanitize_text(text: str, ext: str, pack_id: str, cfg: dict) -> tuple[str, list]:
    """按规则表替换;返回 (新文本, 命中列表)。命中项:{rule, line, before, after}。"""
    hits: list = []
    for rule in cfg["rules"]:
        scope = rule["scope"]
        if scope != "*" and ext not in scope:
            continue
        regex = re.compile(rule["pattern"])
        repl = _resolve_replace(rule["replace"], cfg, pack_id)
        if not regex.search(text):
            continue
        current = text

        def _record(match: re.Match, _repl=repl, _src=current) -> str:
            before = match.group(0)
            try:
                after = match.expand(_repl)  # 支持 replace 里的 \1 反向引用
            except (re.error, IndexError):
                after = _repl
            hits.append({
                "rule": rule["id"],
                "line": _line_no(_src, match.start()),
                "before": before,
                "after": after,
            })
            return after

        text = regex.sub(_record, text)
    return text, hits


def sanitize_file(path: Path, pack_id: str, cfg: dict, dry_run: bool = False) -> tuple[bool, list]:
    raw = path.read_bytes()
    text = raw.decode("utf-8", errors="surrogateescape")
    new_text, hits = sanitize_text(text, path.suffix.lower().lstrip("."), pack_id, cfg)
    if not hits or new_text == text:
        return False, []
    if not dry_run:
        path.write_bytes(new_text.encode("utf-8", errors="surrogateescape"))
    return True, hits


def iter_text_files(root: Path, cfg: dict):
    include = set(cfg.get("scope_include", ["html", "css", "js", "json", "md"]))
    skip = set(cfg.get("skip_filenames", []))
    if root.is_file():
        candidates = [root]
    else:
        candidates = []
        for path in sorted(root.rglob("*")):
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            if path.is_file():
                candidates.append(path)
    for path in candidates:
        if path.name in skip:
            continue
        if path.suffix.lower().lstrip(".") in include:
            yield path


# --------------------------------------------------------------------------- #
# 目录级
# --------------------------------------------------------------------------- #

def sanitize_tree(root: Path, pack_id: str, cfg: dict, dry_run: bool = False) -> dict:
    report = {"pack": pack_id, "files": 0, "changed_files": 0, "total": 0, "hits": [], "rules": {}}
    for path in iter_text_files(root, cfg):
        report["files"] += 1
        changed, hits = sanitize_file(path, pack_id, cfg, dry_run=dry_run)
        if not hits:
            continue
        if changed:
            report["changed_files"] += 1
        for hit in hits:
            hit["file"] = path.relative_to(root).as_posix() if root.is_dir() else path.name
            report["hits"].append(hit)
            slot = report["rules"].setdefault(hit["rule"], {"count": 0, "examples": []})
            slot["count"] += 1
            if len(slot["examples"]) < 2:
                slot["examples"].append(f"「{_snippet(hit['before'])}」→「{_snippet(hit['after']) or '(删除)'}」")
        report["total"] += len(hits)
    return report


def print_report(report: dict, root: Path, verbose: bool, stream) -> None:
    where = root.as_posix() if root.is_dir() else root.as_posix()
    if report["total"] == 0:
        print(f"== {report['pack']} · {report['files']} 文件 · 0 处替换(干净,无需改写)—— {where}", file=stream)
        return
    print(
        f"== {report['pack']} · {report['files']} 文件 · {report['total']} 处替换"
        f"(改写 {report['changed_files']} 文件)—— {where}",
        file=stream,
    )
    for rule_id in sorted(report["rules"], key=lambda k: (-report["rules"][k]["count"], k)):
        slot = report["rules"][rule_id]
        print(f"   {rule_id:<24} x{slot['count']:<4} {' ; '.join(slot['examples'])}", file=stream)
    if verbose:
        for hit in report["hits"]:
            print(
                f"     {hit['file']}:{hit['line']}  {hit['rule']}  "
                f"「{_snippet(hit['before'])}」→「{_snippet(hit['after']) or '(删除)'}」",
                file=stream,
            )


def target_packs(args) -> list[tuple[str, Path]]:
    if args.root:
        pack_id = args.pack_id or Path(args.root).name
        return [(pack_id, Path(args.root))]
    if args.pack:
        ids = args.pack
    elif args.all:
        ids = [p.name for p in sorted(DEFAULT_PACKS.iterdir()) if p.is_dir()] if DEFAULT_PACKS.is_dir() else []
    else:
        raise SystemExit("请给 --all / --pack <id> / --root <目录>")
    out = []
    for pack_id in ids:
        path = DEFAULT_PACKS / pack_id
        if not path.is_dir():
            raise SystemExit(f"包目录不存在:{path}")
        out.append((pack_id, path))
    return out


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="入包文本清洗(规则表:schema/sanitize.json)")
    parser.add_argument("--all", action="store_true", help="处理 packs/** 下全部包")
    parser.add_argument("--pack", action="append", metavar="ID", help="只处理指定包(可重复)")
    parser.add_argument("--root", metavar="DIR", help="处理任意目录/文件(配合 --pack-id)")
    parser.add_argument("--pack-id", metavar="ID", help="--root 时使用的包 id(tagline 映射用)")
    parser.add_argument("--config", metavar="PATH", help="规则表路径(默认 schema/sanitize.json)")
    parser.add_argument("--dry-run", action="store_true", help="只报告不落盘")
    parser.add_argument("--verbose", action="store_true", help="逐处打印 文件:行")
    parser.add_argument("--json", action="store_true", dest="as_json", help="输出机器可读汇总")
    return parser.parse_args(argv)


def main(argv=None) -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    args = parse_args(argv)
    cfg = load_config(Path(args.config) if args.config else None)
    targets = target_packs(args)
    reports = []
    for pack_id, root in targets:
        report = sanitize_tree(root, pack_id, cfg, dry_run=args.dry_run)
        report["root"] = root.as_posix()
        reports.append(report)
    if args.as_json:
        print(json.dumps({"schema": 1, "dry_run": args.dry_run, "packs": reports}, ensure_ascii=False, indent=2))
        return 0
    mode = "(dry-run,未落盘)" if args.dry_run else ""
    print(f"sanitize · 规则表 {Path(args.config).as_posix() if args.config else 'schema/sanitize.json'}"
          f" · {len(cfg['rules'])} 条规则 · {len(reports)} 个目标 {mode}")
    for report in reports:
        print_report(report, Path(report["root"]), args.verbose, sys.stdout)
    total = sum(r["total"] for r in reports)
    files = sum(r["files"] for r in reports)
    grouped: dict = {}
    for report in reports:
        for rule_id, slot in report["rules"].items():
            grouped[rule_id] = grouped.get(rule_id, 0) + slot["count"]
    print(f"合计:{len(reports)} 包 · {files} 文件 · {total} 处替换")
    for rule_id in sorted(grouped, key=lambda k: (-grouped[k], k)):
        print(f"   {rule_id:<24} x{grouped[rule_id]}")
    if total == 0:
        print("   (本次 0 处替换:规则表全覆盖,但当前内容无命中)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
