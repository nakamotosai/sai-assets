# ADR-0001 · 单仓多包 + 全新建史 + 外部包只索引

- 日期:2026-11-03
- 状态:accepted

## 处境

自用主题库(私有素材源,Gitea+GitHub 双 private,仅内网预览)建了几个月,**生产端完整**(入库 → LLM 判官 → 晋升 → 建墙 → 部署 → 指纹对账,17 个脚本),**消费端几乎为零**:全库真实消费只有 2 例,且都是人肉手抄 token;库内没有任何按 id 取用的命令;唯一的"复制"功能是内网 SPA 的剪贴板按钮。同时静态墙因全局 id 去重把 73 个 demo 只上墙 27 个,40 条 references 根本不上墙;机器索引 48.6KB 无版本字段;多个原子卡内嵌本机路径与客户名。

反观用户自己的单包公开仓 `nakamotosai/gruvbox-theme`(54KB):`SKILL.md` 入口 + `tokens/semantic/*.json` + drop-in `css/*.css` + `docs/usage.md` 配对规则 + `scripts/assert_tokens.py` 断言 + Pages 预览墙 —— **这个形态是"能被用起来"的**,而"库"这个形态不是。

## 拍板

1. **新建公开仓 `nakamotosai/sai-assets` 作为唯一公开真相源**,单位是**包(pack)**不是类别;类目仅是目录与标签(themes / web-fx / web-ui / fonts / video-motion / references)。
2. **全新历史**:新仓从零 `git init`,旧库私仓保持 private 并归档为素材源。理由:旧历史含已清除但仍在 commit 对象里的大文件残留(约 15MB 的浏览器 profile 缓存)与提交者个人邮箱;就地转公开 = 不可逆 PII 公开,事后重写还要 mailmap 补刀。
3. **消费三通道**,优先零依赖:agent 走 `catalog.json`(≤8KB)+ 单包 `SKILL.md`;项目走 `scripts/apply.py` **拷贝式**(设计资产应抄进项目,不做运行时依赖)并在 `design-lock.json.assets[]` 记 `pack@version`;人走 GitHub Pages 墙。
4. **外部包只索引不复制**:已有独立公开仓的(gruvbox-theme)或运行模型不同的(Remotion 的 mv-studio)只进 catalog,`canonical_home` 指向其本家。
5. **共享底座的资产合包**:10 个背景动效共享 `engine.js` → 一个 `bg-fx` 包含 10 个 entry;**不**做 10 个包。理由:否则 10 份 engine 副本,违反"禁第二份真相源"。

## 落选者(具名)

- **按类别分 6 个仓**(themes / components / fonts / motions / demos / references 各一仓):落选原因是维护税。全部原子仅 ~230 条 JSON(<300KB)+ 25MB demos,分仓换来 6 套 CI/版本矩阵,而跨类引用极密(46 个 id 跨类重复,LB 里 `gruvbox-dark` 同时在 themes 与 demos),引用一断就全断。
- **每 pack 一仓(纯 gruvbox 模式)**:落选原因是发现性。54KB 单包能成,但 26 个包各一仓 = 26 处要自己记得存在;且字体配方/共用 engine 无处安放。
- **就地改名转公开现有私仓**:落选原因见拍板 2(历史 PII + 15.4MB 残留)。
- **只做公开站不动消费面**(保留现有 Tailscale 站 + 只把 index.html 挂 Pages):落选原因是不解决核心痛点——消费侧仍是手抄,站再好看也不产生复用。
- **MCP server / npm 发布**:落选原因是收益/成本比。catalog + raw + clone + copy-in 已覆盖 agent 与项目两条通道;MCP 与 npm 各增一条维护面,而当前需要的是"能取用",不是"更多入口"。留待真实需求出现再议。

## 代价

- 迁移期存在两处内容(旧库素材 + 新仓包),必须**同轮索引化**收口,否则违反单一真相源;M2 收尾前不要并行编辑同一份原子。
- 包级版本 + Pages 重建 + 断言让每次改动多一步 `gate.py`;换来的是"公开不可撤回"这条不可逆约束下的唯一安全姿势。
- 全新历史 = 旧仓的提交历史不再沿革(但内容经白名单重导入,信息不丢;历史仅作素材源留档)。
