# 剧本模式（Web 右栏批注工作台）详细设计

- 文档版本：v1（2026-11-07）
- 目标形态：DSH Web 客户端插件（bundle），装进当前 `desktop` profile，右栏可用
- 状态：设计待确认，确认后按 M1 实现

## 0. 一句话

在 DSH Web 右栏打开剧本，按段落直接写批注；右下角一键把批注作为一次"改稿事务"发送给编剧 Agent，Agent 按批注改原文件；每轮改稿自动成为版本，可对比、可回滚、可追溯"哪条意见改出了哪段"。

## 1. 目标与非目标

### 1.1 目标

1. 剧本在右栏以可批注的形态展示，不改动原文件即可写批注。
2. 批注攒完后一键发送；发送是一个可追溯的"改稿事务"，不是一条普通聊天消息。
3. 每轮改稿自动落版本：内容快照 + 批注原文 + 前后版本关系；支持段落级 diff 与回滚。
4. 文件被 Agent 或外部编辑器改动时，面板自动刷新并生成版本，不丢改动。
5. 一切落在现有 DSH 机制上：不新增会话事件类型、不改会话格式、不碰 DSH 源码。

### 1.2 非目标（v1 明确不做）

- 不做富文本编辑器：原稿只读，批注是叠加层；改稿由 Agent 完成。
- 不做实时协同、多人批注、云端同步。
- 不做句子级选区批注（M2 再做），v1 只做段落级。
- 不做自动分镜/自动生成剧本内容；与分镜/视频生成流水线的联动放 M3。
- 不接管非剧本目录下的 Markdown（仍走内置文档预览）。

## 2. 用户流程

### 2.1 打开

- 入口 A：会话右上「展开右侧栏」→ 引导页出现「剧本模式」卡片 → 打开剧本工作台页。
- 入口 B：在聊天里点击 `剧本/` 目录下的剧本文件链接，或在右栏文件树里点开剧本 → 直接以批注 tab 打开该文件。
- 入口 C（M2 可加）：输入框工具行放一个「剧本」按钮，一键打开最近使用的剧本。
- 工作台页（无具体文件时）：列出 `剧本/` 下的 `.md/.txt` 文件，点选即进入批注视图；也可以新建一个剧本模板。

### 2.2 批注

- 正文按空行切成"段落块"（Markdown 标题、场景标题也各自成块）。
- 悬停段落 → 右侧出现「＋批注」→ 点开就地写；可加标签（改写/删戏/加戏/逻辑/节奏/台词）。
- 已批注段落：左侧色条 + 内联批注卡（可编辑、可删除）。
- 批注只存在客户端（localStorage），按"段落序号 + 段落指纹 + 原文引用"锚定，不修改原文件。

### 2.3 发送与回改

- 右下角常驻主按钮：`发送 N 条批注`（N = 未发送条数）。
- 点击后客户端把当前文件版本、批注清单打包，通过会话命令发给宿主；宿主：
  1. 校验稿件版本（防止批注期间稿子被改）；
  2. 记录本次改稿事务（快照 + 批注原文）；
  3. 生成一条受约束的用户消息交给 Agent（只改批注涉及段落、用 `edit`、不重排全文、逐条报告落实位置）。
- 面板进入「改稿中…」状态；Agent 改文件 → 文件监听 → 面板自动刷新 → 新版本登记 → 每条批注自动标「已落实 / 未命中」。

### 2.4 版本

- 面板顶部信息条：`v4 · 3 条批注`；点版本号打开版本抽屉。
- 版本时间线：`v4 今天 21:20 批注改稿 3 条`、`v3 21:12 Agent 修稿`、`v2 …`；每条可查看（只读快照）、对比（vs 上一版或 vs 当前）、恢复。
- 恢复：先把当前存成新版本（类型=恢复），再把目标版本内容写回原文件；不调用模型。

### 2.5 面板线框

```
┌──────────────────────────────────────────────┐
│ 第一集.md                     v4 · 3 条批注  ⋯ │
├──────────────────────────────────────────────┤
│  1. 内景 出租屋 - 夜                          │
│     林小满把行李箱摔在地上，箱轮弹开。        │
│     「我们明天再谈。」                        │
│  ▍ 批注 · 节奏：这场太拖，删掉第 3 个来回  ✎ ✕│
│                                              │
│  2. 外景 楼道 - 夜                            │
│     ……                                        │
│                                              │
│                        ┌───────────────┐     │
│                        │ 发送 3 条批注 │     │
│                        └───────────────┘     │
└──────────────────────────────────────────────┘
```

版本抽屉（覆盖在面板内）：

```
┌ 版本 ─────────────────────────────────┐
│ v4  今天 21:20  批注改稿 3 条   [查看] │
│ v3  今天 21:12  Agent 修稿      [对比] │
│ v2  今天 21:05  批注改稿 2 条   [恢复] │
│ v1  今天 20:58  初稿                   │
└────────────────────────────────────────┘
```

## 3. 面板规格

### 3.1 结构

| 区域 | 内容 | 说明 |
|---|---|---|
| tab 条 | 「第一集.md」等 | 由右栏 tab 条渲染；标题在打开时捕获 |
| 信息条 | 文件名、当前版本、待发批注数、刷新按钮 | 吸顶 |
| 正文区 | 段落块 + 批注层 | 只读原文，批注是叠加 |
| 底部栏 | 版本入口、发送按钮 | 吸底，按钮右下 |
| 版本抽屉 | 版本时间线 / 快照预览 / diff | 面板内覆盖层 |

### 3.2 状态机

```
loading → picker（无文件/工作台页）或 ready
ready → editing（有未发送批注）
editing → sending（命令已发出，等待宿主确认）
sending → waiting（宿主已受理，等待 Agent 改稿）
waiting → updated（检测到新版本）→ ready（清空已发送批注）
waiting → timeout（90s 无变化）→ 提示：继续等待 / 重新发送 / 回滚
任意 → error（可重试；错误不丢草稿）
ready/editing → stale（发送时稿件版本已变）→ 重新定位 / 取消
```

### 3.3 文案与主题

- 新增 locale 命名空间 `screenplay`，zh/en 两套 JSON；宿主命令描述也走 host locale。
- 颜色全部用 `--dsw-alias-*` token；不加载 `dsh-client-ui-primitives` 模块，按钮/输入框/抽屉的交互样式按宿主页面复制实现。
- 面板宽 380–720px；正文用宿主体字号，场景标题加粗，动作行常规，对白缩进。

## 4. 版本模型（核心）

### 4.1 改稿事务

一次「发送批注 → Agent 改稿完成」= 一个 revision：

```
v2 ──(5 条批注)──▶ v3
      revision { kind: send, base: v2, result: v3, annotations: [...] }
```

- base 版本：发送那一刻的文件版本（FS 版本 token）。
- result 版本：Agent 改完后文件稳定时的版本（宿主监听 + 防抖后登记）。
- 发送后先写入 `pending` revision；改稿完成时补 result、转为 `applied`。
- 若 Agent 没有改文件：revision 保持 `pending`，面板提示"未检测到改动"，批注仍保留。

### 4.2 版本类型

| kind | 触发 | 是否可回滚 | 说明 |
|---|---|---|---|
| `initial` | 打开剧本时首次登记 | 是 | 首次建立版本链时对当前文件拍快照 |
| `send` | 用户发送批注 | 是 | 带批注全文，可追溯 |
| `manual` | 用户点「保存版本」 | 是 | 手动节点 |
| `external` | 文件被面板之外改动 | 是 | Agent 被别的途径调用、或用户在编辑器改稿 |
| `restore` | 版本恢复 | 是 | 恢复前先给当前状态拍快照 |

### 4.3 时间线与 diff

- 时间线按 seq 倒序。
- 默认对比：选中版本 vs 上一版本。
- diff 粒度：先段落级（新增/删除/修改块），再块内行级高亮；剧本通常段数不多，实现简单的 LCS 即可。
- 快照与当前稿差异用「改动 N 段」徽标展示，不自动改正文。

### 4.4 恢复

1. 读取目标版本内容；
2. 对当前文件拍快照（kind=restore，标注"恢复前"）；
3. 用当前版本 token 做乐观写回（`replaceIfVersion`），失败返回 `E_STALE`；
4. 面板刷新，版本链新增一条 restore。

### 4.5 自动快照策略

- 发送时：base 快照（内容去重存档）+ revision 元数据。
- 文件监听发现变化并稳定（4s 静默）后：
  - 有 pending send revision → 补 result，转 applied；
  - 没有 → 新建 `external` revision（标注"面板外改动"）。
- 同一内容 hash 只存一份快照（内容寻址去重）。

### 4.6 并发与冲突

- 同一文档同一时刻只允许一个在途 send；宿主用内存锁返回 `E_BUSY`。
- 客户端发送时带 base 版本 token；宿主与当前 `stat.version` 不一致 → `E_STALE`，客户端弹"重新定位"：
  - 按段落文本相似度把批注迁到最新稿；匹配不上的标"待人工确认"；用户确认后再发。
- 跨会话/多标签同时编辑同一文档：v1 以最后写入为准，并在设计上标注为已知限制。

## 5. 数据模型

### 5.1 目录布局

```text
剧本/
  第一集.md                      # 原文件（只由 Agent/用户改，插件不手改）
  .dsh-screenplay/
    第一集/
      index.json                # 版本链元数据（小）
      snapshots/
        <sha256>.md             # 内容寻址快照（去重）
      revisions/
        <revisionId>.json       # 该次改稿事务的批注原文
```

- sidecar 放剧本旁：随剧本目录一起备份/迁移，可被 git 追踪。
- sidecar 目录不存在时由宿主创建（M1 用 `node:fs/promises.mkdir(recursive)` 创建该目录；除建目录外，内容读写都用 `ctx.fs`，见 §11 风险项）。

### 5.2 index.json

```json
{
  "schemaVersion": 1,
  "script": "第一集.md",
  "head": "r20261107-2120-a1b2",
  "revisions": [
    {
      "id": "r20261107-2120-a1b2",
      "seq": 4,
      "time": "2026-11-07T21:20:00+08:00",
      "kind": "send",
      "label": "批注改稿 3 条",
      "baseVersion": "v:9c1f...",
      "resultVersion": "v:1ab7...",
      "baseHash": "sha256:...",
      "resultHash": "sha256:...",
      "annotationCount": 3,
      "state": "applied"
    }
  ]
}
```

- `baseVersion` / `resultVersion`：宿主 `ctx.fs.stat()` 返回的不透明版本 token，用于陈旧检测。
- `baseHash` / `resultHash`：内容 sha256，用于去重与展示。
- 文件可以含 pending 的 `send`（`resultVersion: null, state: "pending"`）。

### 5.3 revisions/<id>.json

```json
{
  "doc": "第一集.md",
  "baseHash": "sha256:...",
  "annotations": [
    {
      "id": "a1",
      "blockIndex": 12,
      "blockHash": "fnv1a:8f3c2a10",
      "quote": "「我们明天再谈。」",
      "note": "这里节奏太拖，删掉第 3 个来回",
      "tag": "节奏"
    }
  ]
}
```

### 5.4 客户端草稿（localStorage）

- key：`dsh.screenplay.draft.v1:<sessionId>:<fileAddress>`
- value：`{ baseVersion, baseHash, updatedAt, annotations: [...] }`
- 写入：批注变更后 300ms 防抖；发送成功后清空；页面刷新/重开恢复。
- 若恢复时 `baseVersion` 与当前文件不一致 → 顶部黄条"稿件已更新，批注基于旧版"，发送前触发重定位。

### 5.5 批注锚点

- 锚 = 段落序号 + 段落文本指纹（FNV-1a 32 位十六进制）+ 原文前 80 字引用。
- 发送时以"指纹 + 引用"为主、序号为辅；重定位时按指纹匹配，匹配不到的进人工确认列表。
- 不做逐字符偏移锚定（Agent 改稿会重排，偏移不可靠）。

## 6. 系统架构

### 6.1 bundle 组成

```text
dsh-screenplay/
  package.json          # private 包；dsh.bundle.patch + dsh.client(platform:web)
  cordis.patch.yml      # insert 一条宿主插件行
  index.js              # 宿主：命令、版本存储、文件监听、steer 改稿消息
  client.js             # 浏览器：右栏 tab 类型 + 面板 React（纯 JS，无构建）
  locale/en.json        # meta.title/description + UI 文案
  locale/zh.json
  icon.svg              # 原创图标
  DESIGN.md             # 本文档
```

- 单包双半：`package.json` 的 `dsh.client` 声明客户端模块；bundle patch 插入宿主行。
- 安装：`plugin_manager install_bundle`（目标为绝对包目录）；安装后刷新页面即可见。

### 6.2 客户端职责

1. 注册右栏 tab 类型（`sidebarRightTabs.register`）：
   - `id`：包名；`kind: "screenplay"`；`priority: "extension"`；
   - `patterns: ["*.md", "*.txt", "*.fountain"]`；
   - `canOpen(address)`：解析文件地址，只认 `<配置的剧本目录>/` 下的文件；否则返回 false，交给内置预览；
   - `title(address)`：文件名；页地址返回「剧本模式」；
   - `keepMounted: true`（切 tab/切会话不丢批注草稿）；
   - `guide`：一张引导卡「剧本模式 / 在右栏批注剧本并发送给编剧 Agent」。
2. 注册正文 `sidebar.right.pane.tab`（key = 类型 id）与可选标题 `sidebar.right.pane.tab.title`。
3. 面板组件：
   - 解析 `tab.contentId` 得到会话 + 文件路径；工作台页则列出剧本目录；
   - 通过注入的 Remote 面读文件、监听文件、读版本索引；
   - 批注交互 + localStorage 草稿；
   - 发送/快照/恢复/初始化 → `remote.commands.execute(sessionId, "/screenplay …", [])`；
   - 版本抽屉与 diff。
4. 不写 DOM、不引 primitives 包、不接管全局布局。

### 6.3 宿主职责

1. 注册会话命令 `/screenplay`（`recordInput: false`：批注载荷不进会话日志）。
2. 维护 sidecar（index/revisions/snapshots），写操作走 `ctx.fs.writeText`（原子写）。
3. 发送：校验版本 → 记事务 → `agent.steer(createUserMessage(...))` 把受约束的改稿消息交给模型。
4. 文件监听：`ctx.fs.watch` + 4s 防抖；生成/补全版本；不写会话事件。
5. 恢复：快照 + 乐观写回（`replaceIfVersion`）。
6. 多会话共享同一 sidecar：以宿主进程内锁串行化。

### 6.4 接口清单（已核对现有运行时）

| 需求 | 接口 | 依据 |
|---|---|---|
| 右栏 tab 类型 | `ctx.sidebarRightTabs.register({id,kind,patterns,priority,canOpen,title,guide,keepMounted})` | `dsh-client-ui-sidebar-right` README 与注册源码 |
| tab 正文/标题 | keyed slot `sidebar.right.pane.tab` / `sidebar.right.pane.tab.title`（key = 类型 id） | 同上；`dsh-client-ui-sidebar-documentpreview` 为现成范例 |
| tab 信息 | `useTabInfo()` → `{tab.contentId, tab.navigation, tab.signal, tab.actions, sidebar, panel}` | 同上 |
| 打开页面/资源 | `tab.actions.openTab(kind, opts)` / `tab.actions.openResource(address, opts)`；全局侧栏 `ctx.sidebarRight.openTab/openResource` | 同上 |
| 指引卡 | `definition.guide` 条目：`{id, title(), description?(), order, commandId?}` | `GuideBody` 源码（title/description 是函数） |
| 客户端读文件 | `remote.workspaceFiles.read/stat/list/changes(sessionId, path, …)` | `dsh-api-workspace-files` README |
| 文件地址 | `dsh-resource://file/session/<sessionId>/<path>` | 同上 + `workspace-path` 源码 |
| UI → 宿主动作 | `ctx.remote.commands.execute(sessionId, line, [])` | `dsh-client-ui-plan` 的 `/plan off` 实现 |
| 宿主命令 | `ctx.commands.register({name, description, input, recordInput, handler})` | `dsh-commands` README 与 Service 合约 |
| 改稿消息 | `agent.steer(createUserMessage({content, source:{kind:'user'}}))` | `dsh-plan-mode` 源码同款路径 |
| 版本文件读写 | `ctx.fs.resolve/stat/readText/writeText/watch` | `dsh-fs` Service 合约与 `dsh-fs-local` 行为说明 |
| 工作区根 | `ctx.workingDirectory.get(session)` | Host Service 目录 |

待实现时验证的两点：
1. 从命令 handler 里把监听器挂到 `agent.ctx.effect` 以随 Agent 销毁清理（预期可行，plan-mode 有 per-agent 注册先例）。
2. 宿主 `index.js` 直接 `import { createUserMessage } from '@deepseek-ai/dsh-llm'` 在当前 profile 下的解析（plan-mode 是同一写法，预期可行）；若解析不到，改为本地构造等价消息（保留降级方案）。客户端 `client.js` 不 import 任何宿主包，只用浏览器模块表提供的 `react`。

### 6.5 命令协议

命令：`/screenplay <sub> <payload>`；payload 为 base64url(JSON)，避免空格/引号歧义；`recordInput:false` 使会话日志不记录 args。

| 子命令 | payload | 成功返回 | 主要错误 |
|---|---|---|---|
| `send` | `{doc, baseVersion, annotations[]}` | `OK {"revision":"r…"}` | `E_STALE` / `E_BUSY` / `E_TOO_MANY` / `E_NOT_FOUND` |
| `snapshot` | `{doc, label?}` | `OK {"revision":"r…"}` | `E_NOT_FOUND` |
| `restore` | `{doc, revision}` | `OK {"revision":"r…"}` | `E_STALE` / `E_NOT_FOUND` |
| `init` | `{dir?}` | `OK {"script":"…"}` | `E_EXISTS` / `E_IO` |

- 返回统一为文本：成功 `OK <json>`，失败 `ERR <code>: <message>`；客户端解析 code 决定提示与恢复动作。
- 命令 handler 内不写任何自定义会话事件；模型可见的只有 `steer` 的用户消息。
- 发送流程在宿主内串行执行；每个 doc 一个 `busy` 锁。

### 6.6 模型侧消息契约（steer 的用户消息）

发送时宿主拼一条紧凑消息，包含：

1. 目标文件（工作区相对路径）与当前版本号；
2. 纪律：只修改批注涉及的段落；不重排、不重命名场景标题、不润色未批注段落；用 `edit` 工具做最小改动；批注之间冲突时先指出；
3. 批注清单：`#1 [节奏] 引用段落前 80 字 → 意见…`；
4. 收尾要求：逐条回复"第 N 条落在第 X 段/未落实原因"；不要输出整篇新稿。

示例（节选）：

```text
用户对《剧本/第一集.md》（当前 v4）提交了 3 条批注。请只按批注修改，不要重写全文：
- 用 edit 工具做局部修改；未批注的段落、场景标题、格式保持原样。
- 批注冲突时先说明，再按用户意见择一执行。
- 完成后逐条列出：批注编号 → 落实位置（段落标记）或未落实原因。

批注：
#1 [节奏] 「林小满把行李箱摔在地上…」→ 这场太拖，删掉第 3 个来回
#2 [台词] 「我们明天再谈。」→ 太直，改成回避式的说法
#3 [逻辑] 「她掏出钥匙…」→ 上一场钥匙已经丢了，删掉这个动作
```

- 这条消息同时是用户可见的聊天记录，透明、可审计。
- 批注原文另存于 `revisions/<id>.json`，供版本追溯。

### 6.7 客户端读文件与监听

- 读：`workspaceFiles.read(sessionId, path, {offset, limit})` 循环翻页直到 eof（上限 5000 行/20 页，超出提示分段处理）。
- 监听：`workspaceFiles.changes(sessionId, path, signal)` 流；同时监听 `index.json`，任一变化就重读对应文件；`tab.signal` 中止时关闭。
- 版本索引与快照按需读取（快照只在打开版本对比时读）。
- 监听不支持（远程后端）→ 降级为手动刷新按钮 + 发送后自动重读。

## 7. 关键流程时序

### 7.1 发送

1. 客户端：清点未发送批注 → 组 payload → `remote.commands.execute`。
2. 宿主：校验 doc 在剧本目录内、批注数 ≤ 200、单条 ≤ 1000 字、无在途事务。
3. 宿主：`stat` 当前版本 vs `baseVersion` → 不一致返回 `E_STALE`。
4. 宿主：写 snapshot（若 hash 不存在）+ revision 文件 + index 中 pending revision。
5. 宿主：`agent.steer(createUserMessage(受约束消息))`。
6. 返回 `OK {revision}`；客户端进入 waiting，开始监听。
7. Agent 用 `edit` 改文件；监听触发，防抖 4s 稳定后宿主补 result、index 转 applied。
8. 客户端读到新 index → 显示新版本、批注标记落实状态、清空已发草稿。

### 7.2 外部改动

1. 宿主监听发现文件变化且无 pending → 读内容算 hash；
2. 与 head 的 resultHash 不同 → 写 snapshot + `external` revision；
3. 客户端收到变化 → 刷新正文与版本徽标 → 顶部提示"检测到面板外改动，已存为 vN"。

### 7.3 恢复

1. 客户端确认弹窗 → `restore` 命令；
2. 宿主快照当前 → 乐观写回目标快照 → 返回；
3. 客户端刷新；New version 类型 restore。

## 8. 异常与边界

| 场景 | 行为 |
|---|---|
| 文件被删除 | 面板空状态："文件已不存在"，保留批注草稿，可换文件 |
| 目录不存在 | 工作台页显示"创建剧本目录/模板"按钮（`init`，宿主建目录并写最小模板） |
| 发送时稿件已变 | `E_STALE` → 弹重定位对话框（按段落指纹迁移，标出无法匹配项） |
| 命令执行失败/超时 | 面板 toast + 保留草稿 + 可重试；不进入 waiting |
| Agent 未改文件 | 90s 后提示继续等待 / 重新发送 / 回滚到发送前 |
| 批注超限 | 发送按钮禁用 + 提示上限（200 条 / 单条 1000 字） |
| 文件监听不可用 | 显示手动刷新按钮，发送后自动重读一次 |
| 版本快照写入失败 | 发送中止并报错，不 steer（保证"无版本即无改稿"） |
| 同一脚本被两个会话同时改 | 最后写入为准，冲突时靠版本链回滚（已知限制） |

## 9. 验收标准

1. 安装插件并刷新页面后，右栏引导页出现「剧本模式」卡片；点开是剧本工作台，不报错。
2. 点开 `剧本/` 下任意 `.md` 文件，右栏以批注 tab 显示全文；非该目录的 `.md` 仍由内置预览打开。
3. 悬停段落出现「＋批注」，写 3 条并填标签；切 tab 再切回，批注仍在；刷新页面，批注草稿恢复。
4. 点「发送 3 条批注」后：
   - 会话里出现一条用户消息，包含 3 条批注与纪律约束；
   - Agent 按批注局部改稿；
   - 面板自动出现新版本（v2 或 chain 的下一个），3 条批注显示落实/未命中状态；
   - 原文件中未批注段落文本未被改动。
5. 版本链完整：时间线显示 initial/send/结果；任意两版可对比并正确标出增删改；恢复 v1 后文件内容等于 v1，且新增一条 restore 版本；可再恢复回最新版。
6. 外部用编辑器改一句 → 5 秒内面板出现新版本并提示面板外改动。
7. 发送过程中手动改文件 → 返回 E_STALE 提示重定位，不发生错改。
8. 关闭右栏/切会话/刷新页面后重新打开，版本链从磁盘恢复，不重复建链。
9. 插件卸载后右栏无残留；`.dsh-screenplay/` 保留在剧本目录（可手动删）。
10. 模型可见内容仅限那条用户消息；命令执行本身不进入模型上下文。

## 10. 分期与工作量

### M1（可用版，先做这个）

1. bundle 骨架 + 安装：宿主行、客户端模块、locale、图标、patch；右栏引导卡可见。
2. tab 类型注册 + 文件地址解析 + 剧本目录过滤 + 工作台页。
3. 面板：读取全文、段落切块、渲染、批注 UI、草稿持久化。
4. 宿主命令 send/snapshot/init + 版本存储 + steer 改稿消息。
5. 文件监听 + 版本补全 + 面板自动刷新。
6. 版本抽屉 + 快照预览 + 段落级 diff + 恢复。
7. 错误态、空态、i18n、手动刷新兜底。

### M2

- 句子级选区批注与定位；
- 批注落实状态自动判定 + 未落实一键重发；
- 聊天/文件树点文件直接开批注 tab（已包含在 M1 的 claim 里，M2 做打磨）；
- 输入框「剧本」按钮入口；命令面板入口；
- 版本对比双栏视图、版本命名/备注。

### M3

- 与分镜/视频生成流水线联动：定稿版本一键导出"分镜可投喂"的结构化稿（场次/台词/情绪/时长 sidecar）；
- 多集/多文件项目视图、跨集连续性检查（人物/道具/时间线提醒）；
- 写作规范 lint（时长估算、钩子位置、格式检查）接入批注面板。

## 11. 风险与待验证项

| 风险 | 影响 | 应对 |
|---|---|---|
| `ctx.fs` 无 mkdir 原语 | 无法用纯 fs 服务建 sidecar 目录 | 建目录用 `node:fs/promises.mkdir`；内容读写仍走 `ctx.fs`。若坚持零原生调用，可退化为"单文件 sidecar"方案 |
| 端口/插件客户端模块加载 | 安装后需刷新页面，开发期可能需重启 | 安装后用页面刷新验证；开发期先装骨架再迭代 |
| 命令载荷大小 | 批注极多时命令字符串过大 | 上限 200 条/单条 1000 字；超出前端拦截 |
| Agent 改稿越界 | 改了未批注段落 | 消息硬约束 + 版本回滚 + 接受前 diff 确认（M2 自动检测越界改动） |
| 文件监听在远程 FS 不可用 | 无法自动刷新 | 手动刷新兜底；发送后强制重读一次 |
| 段落锚点漂移 | 批注对错段 | 指纹 + 引用双锚；重定位对话框；M2 相似度迁移 |
| 会话内用户消息冗长 | 聊天观感 | 消息紧凑化：批注清单仅含引用前 80 字；完整原文在 sidecar |
| DSH 版本升级接口漂移 | 插件失效 | 只用公开 README/服务契约中的接口；升级时按 Config/Slots inspect 复核 |

## 12. 待拍板的默认值（不反对就按此实现）

1. 剧本目录：工作区下 `剧本/`（可在插件 config 改）。
2. sidecar 位置：`剧本/.dsh-screenplay/<文件名>/`，随稿走、可 git。
3. 批注粒度：段落级（M2 加句子级选区）。
4. 发送范围：全部未发送批注（一次事务）。
5. 改稿方式：Agent 直接改原文件（已确认），改前宿主自动快照。
6. 自动版本：发送前 / 改稿完成 / 外部改动 三处自动建版本。
7. 版本恢复：宿主直写，不经过模型。
8. 引导入口：只用右栏引导页卡片；输入框按钮放 M2。

---

确认以上默认值（或指出要改的条目）后，按 M1 顺序实现；验收按 §9 逐条走。

## 13. 实现状态（2026-11-07，M1）

已实现并安装到 `desktop` profile：

| 项 | 状态 |
|---|---|
| bundle（package/patch/locale/icon/README） | 已完成，`install_bundle` 结果 `application: applied`，`include:screenplay` fiberPhase=active |
| 右栏 tab 类型 + 引导卡（只认 `剧本/` 下文件） | 已完成，客户端 slot occupant `@local/dsh-screenplay` active |
| 批注面板（段落切块、标签、草稿 localStorage） | 已完成 |
| `/screenplay open/send/snapshot/restore/init` | 已完成 |
| 版本 sidecar（index/snapshots/revisions、内容寻址） | 已完成 |
| 宿主文件监听 + 改稿沉降 + 外部改动版本 | 已完成（watch 不可用时退化为 3s 轮询） |
| 版本抽屉（快照预览、行级 diff、恢复） | 已完成 |
| 宿主侧端到端 harness（mock ctx + 真实文件系统） | 20/20 通过：open/send/沉降/恢复/陈旧拒绝/并发拒绝/越界拒绝/非法载荷 |

M1 与本文档的已知差异：

1. 剧本目录在客户端固定为 `剧本/`（`canOpen` 需要同步判断，v1 不暴露配置项；后续通过 host 命令下发配置）。
2. 面板刷新采用 `workspaceFiles.stat` 轮询（2–4s，面板可见时）而非 `changes` 流，避免远程后端 watch 能力差异；宿主侧仍用 `fs.watch`。
3. 版本对比为行级 unified diff；段落级分组与批注自动落实判定在 M2。
4. sidecar 目录用 `node:fs/promises.mkdir` 创建，内容读写仍全部走 `ctx.fs`。
5. 视觉验证（面板实际渲染、明暗主题、slot 崩溃）无法在本环境用浏览器控制完成，待用户打开页面确认。
6. 沙箱策略修正（0.1.2）：宿主经 `ctx.fs` 写 sidecar 必须把 `ctx.sandboxPolicy.resolve({ session })` 作为 `writeText` 的第 5 参传入；否则 agentless 写入落到部署默认的 `read-only`，会被 `FS_SANDBOX_DENIED` 拒绝。
7. 自动打开（0.1.1+）：`剧本/.dsh-screenplay-open` 标记文件写明目标文件名，客户端通过 `ctx.inject(['sidebarRight'])` 在会话挂载后调用 `openResource` 自动展开右栏并打开该剧本；用后删除标记。
8. Desktop 生效方式：客户端半边由 Web 客户端重载，宿主半边由 Cordis 重装；`plugin_manager remove_bundle + install_bundle` 可触发两者热重载，必要时重启 DSH Desktop。
9. 排版面板（0.2.0）：行距 / 段距 / 字号三个滑块，写入 CSS 变量并持久化到 localStorage（`dsh.screenplay.typography.v1`）。
10. 目录（0.2.0）：从块首行识别 `## 幕` 与 `场景N`，生成目录抽屉，点击按 `data-spm-block` 滚动定位。
11. 句级批注（0.2.0）：鼠标选区 → 浮出「批注所选」→ 以选区文本作 `quote`、所在段落作锚点，`level:'sentence'`；同一段落支持多条批注；宿主 `normalizeAnnotations` 保留 `level`，模型消息标注「句级」。
12. 主题（0.2.0）：面板颜色全部使用 `--dsw-alias-*` token，diff 底色改用 `color-mix()` 派生，跟随应用深/浅色切换，无写死颜色（仅阴影/遮罩使用半透明黑）。
13. 插件热重载后旧 tab body 因 `keepMounted` 不会自动重挂；自动打开逻辑在重开前先关闭同内容 tab，用新代码新建 occurrence（0.2.1）。
14. 剧本块模型 v2（0.3.0）：客户端 `parseScreenplay` 把剧本解析为八类块（`scene_heading/action/character/parenthetical/dialogue/transition/shot/note`，另加内部 `heading`），块仍是批注单位，行类型驱动渲染、目录与后续导出；解析器带 `#region screenplay-parser` 标记，`npm test` 从 client.js 提取该区运行。
15. 卡住的 pending 修订（0.3.5）：Agent 没改文件时宿主 `pending` 修订会一直挂起。宿主现在在 `open` 时把非 head 的 pending 标为 `abandoned`、head pending 超 10 分钟也标 `abandoned` 并释放 busy；新增 `/screenplay cancel` 子命令；面板在 pending 时显示「结束等待」按钮，已 `abandoned` 的修订在版本列表里显示「已结束」。
16. 锚点 v2（0.4.0）：批注带 `{blockHash, contextSig, segments[]}`（`contextSig` = FNV-1a(前段+`\0`+本段+`\0`+后段)）。版本变化后客户端自动重锚定：签名命中优先，其次唯一哈希，再唯一上下文，最后唯一引文；同文重复段落按签名消歧；歧义或文本被改则标 `stale` 并保留横幅提示。旧批注无 anchor 时按哈希/引文迁移。
17. 改稿安全网（0.4.1）：发送时客户端把 base 正文与批注快照存进 pending；修订 applied 后重新读取正文，用块级 LCS 对齐 base 与新稿，按批注覆盖的块号判定越界修改/新增/删除（`删戏` 允许删、`加戏` 允许相邻新增）。越界时显示横幅 + 差异弹窗，可一键 `restore` 回发送前版本；发送消息同时给模型加硬约束（不增删段落、未批注段落逐字保留、字数 ±50%）。

