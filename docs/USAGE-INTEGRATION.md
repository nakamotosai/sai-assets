# USAGE-INTEGRATION · 取用口径(项目 ↔ 资产库)

> 两件事:1 项目侧怎么记"我用了哪版";2 skill 侧怎么写"何时来取、怎么取"。

## 1 项目侧:`design-lock.json` 增 `assets[]`

项目根已有 `design-lock.json`(长项目治理件:字体地板/字族白名单/色板/间距档/动效/主题 id + `assertions[]`)。**取用资产库后,同轮追一条**:

```json
{
  "assets": [
    {
      "pack": "paper-editorial",
      "category": "themes",
      "version": "1.0.0",
      "sha": "3f9c1a2",
      "via": "apply.py",
      "applied_at": "2026-11-03",
      "files": ["css/default.css", "tokens/semantic/paper-editorial.json"],
      "note": "正文纸白底 + 衬线;强调色只用于 CTA"
    }
  ]
}
```

规则:

- `pack` + `version` 必填;`sha` 记本仓当时 commit 短 SHA(可空但推荐)。
- 一个项目可用多包;同一 `pack` 只允许一条(升级即改这条,不追加历史)。
- **禁**把包内容抄进项目后不记 lock;`gate`-like 检查在收口时对项目跑一遍(收口清单项)。
- 升级:对照 `catalog.json` 里的 `version`,变了就 `apply.py` 覆盖 + 改 lock 的 `version`/`sha`,`note` 里写一句变更原因。

## 2 消费命令面(单一入口)

```bash
python <repo>/scripts/apply.py --list                       # 列 catalog 摘要(≤8KB 口径)
python <repo>/scripts/apply.py paper-editorial --to src/styles
python <repo>/scripts/apply.py paper-editorial --to src/styles --dry-run   # 只打印将写哪些文件
```

`apply.py` 只做**拷贝 + 打印下一步**(无运行时依赖、不写 node_modules、不改目标项目其它文件)。它会在目标目录旁打印一段可直接粘进 `design-lock.json` 的 `assets[]` 片段。

## 3 skill 侧取用协议(`sai-frontend` §1 的目标文本)

要点(替换现有 §1/§1.5 的"读 registry.json + 内网网页手抄"口径,并删除 `SYNC:EXEMPT` 双副本机制):

1. **何时来取**:任何"要一套现成配色/字体/网页动效/UI 件"的设计类任务,先查资产库 catalog,再考虑从零写;库里没有合适项才走外部。
2. **怎么取**:
   - 目录:`https://raw.githubusercontent.com/nakamotosai/sai-assets/main/catalog.json`(紧凑,≤8KB)
   - 单包:`.../packs/<id>/SKILL.md` → 按其中的 apply 步骤落地
   - 项目落地:`python scripts/apply.py <id> --to <dir>` + `design-lock.json.assets[]` 记版本
   - 离线兜底:本地 clone(路径见 `README.md`,不写进仓内文档)
3. **硬规则**:不许自造 hex(以包内 `tokens/absolute.json` 为准);引用上游素材必须保留 `pack.json.attribution` 与 SPDX 头;升级按 `version` 走,禁"看着差不多"重抄一份。
4. **回写**:项目里改好的资产按 `harvest → PR`(M3)回收,禁直接改公开仓之外的副本。

## 4 与设计规则的分工

| 面 | 归谁 |
|---|---|
| 设计规则(字号地板、对比度、深色 UI 判据、获奖路线、字标几何) | `skill://design-system` + `sai-frontend/references/`(规则源) |
| 具体资产(色板、字体配方、动效实现、组件) | 本仓的包(实现源) |
| 项目实际用了哪版 | 项目 `design-lock.json.assets[]` |

三者不互相抄;规则改动只改规则源,包只实现规则。
