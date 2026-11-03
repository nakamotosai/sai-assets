# AGENTS.md · sai-assets 门规

> 公开资产库(themes / web-fx / web-ui / fonts)。**本仓是公开仓,写进去的东西不可撤回**——已被 fork / 缓存 / CDN 收录的内容无法删除,因此"闸门先于提交"是本项目第一条铁律。

## 0 硬闸:公开内容闸(gate before commit)

任何 commit 前必须跑通,失败即阻断,禁 `--no-verify` 绕过:

```bash
python scripts/gate.py          # schema 校验 + 清洗正则 + 断言 + catalog/墙重建一致性
```

规则字面量**只有一份**,在 `schema/banned.json`(每条的 `why` 写清它为什么会阻断公开)。闸按类别拒绝:

| 类别 | 说明 |
|---|---|
| 本机绝对路径 | 任何盘符路径、`file://` 本地引用、本机 home 目录 |
| 内网拓扑 | 内网地址、隧道域名、SSH 主机别名、本机服务端口 |
| 凭据 | API key / token / 私钥 / 口令字面量 |
| 品牌词 | 第三方品牌名与其宣传语(致谢中明确指向开源上游的除外) |
| 客户 / 业务 | 客户名表、业务线域名、保密标记 |
| 第三方内容 | 真实媒体标题正文与配图、外部站点镜像、第三方 logo 清单 |

新增规则只改 `schema/banned.json` 一处;文档里**禁**再抄一份规则串(第二份规则文本会先于闸过期)。

例外只有两处,且每次放行都打印:`schema/banned.json` 自身(规则必须含字面量)、`packs/*/upstream/**` 的上游版权行。

## 1 提交纪律

- 每轮验证通过**当轮 commit**,绝不攒;push 留到收口。
- 含 `version` 的包随行为改动抬版本(semver,`pack.json.version` + CHANGELOG 一行)。
- 双远端:`origin` = Gitea(private 镜像)、`github` = GitHub(**public**,本项目唯一对外面)。
- 动核心文件前备份到本地归档区(路径不入仓)。

## 2 单一真相源

- 本仓 = 公开资产的唯一真相源;本地旧素材库 = **素材源 / 私有暂存**,不是第二份真相源。
- 某个包一旦进本仓,旧库里对应的 `demos/<id>` 与原子卡**同轮改为索引**(不得两处各留一份)。
- 某个包若长出独立受众并移出成独立仓(如 `gruvbox-theme`),本仓只保留 catalog 索引项(`canonical_home` 指向新家),不复制内容。

## 3 包的形状

见 `docs/PACK-CONTRACT.md`。要点:一个包 = **入口(`SKILL.md`)+ 产物(tokens/css/src)+ 用法(`docs/usage.md`)+ 断言(`scripts/assert_tokens.py`)+ 许可与出处(`pack.json`)**。缺任一项不算包,禁以"目录建好了"充当完成。

## 4 边界

- 不做 MCP server;不做 npm 发布(取用走 raw / clone / copy-in CLI);不按类别分仓。
- 视频类(Remotion)资产**只索引不承载**:运行模型不同(React + Remotion CLI),`pack.json.entry` 指向外部 `canonical_home`。
- 审美与观感类改动属主观项,验收需给证据(截图 / 断言输出),禁口头断言"更好看了"。
