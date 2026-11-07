# Roadmap / 待优化清单

> 记录对标调研后的优化项。状态：⬜ 未开始 · 🟡 进行中 · ✅ 已完成
> 调研来源：[dsh-md-annotator](https://github.com/3361805598-gif/dsh-md-annotator)、[dsh-plugin-file-annotate](https://github.com/Arvin-work/dsh-plugin-file-annotate)、[dsh-markup](https://github.com/nickzhangcomes/dsh-markup)、[dsh-novel-craft](https://github.com/shiyan688/dsh-novel-craft)、[Narracore Format](https://github.com/xiaoanran0602-pixel/narracore-format)、[OpenWrite](https://github.com/LiPu-jpg/Openwrite)。

## P0 — 正确性（v0.3.0）

- ✅ **P0-1 剧本块模型 v2（八类块）**（v0.3.0）
  - 类型：`scene_heading / action / character / parenthetical / dialogue / transition / shot / note`（另加内部 `heading` 表示幕/标题）
  - 解析中文「第N场 / 场N / 内景 / 外景」、英文 `INT./EXT.`、`人物：台词` 内联对白、角色行+对白、括注、转场、`▲` 镜头行、`[[备注]]`
  - 渲染、目录、锚点、后续导出一律基于块模型
  - 验收：真实稿抽检块类型正确率 ≥95%（同步率稿：19 场 / 346 镜头 / 152 对白 / 8 标题）
- ✅ **P0-2 锚点 v2**（v0.4.0）
  - 批注锚点：`ref + blockHash + contextSig(prev/self/next) + quote + stale`
  - 重锚定：索引+内容+签名全中才接受；否则唯一哈希 → 唯一签名 → 唯一引文迁移；歧义一律标 stale
  - 多段句级批注按 segment 独立重锚定；旧数据（无 anchor）按哈希/引文迁移
  - 稿件版本变化后客户端自动重锚定，全部匹配则自动清除 stale 横幅
- ⬜ **P0-3 改稿安全网**
  - 改稿沉降后做块级 diff，检测「批注范围之外的段落被改动」
  - 越界横幅 + diff 查看 + 一键整版回滚（后续做局部回滚）
  - 模型消息补硬约束：不增删段落、不动未批注段落、字数 ±50%
- ⬜ **P0-4 批注协议升级**
  - 增加 `kind`（必须改/建议改/疑问）、`suggestion`（期望改法）、行号范围
  - 发送消息采用「编号 + 行号 + 围栏原文 + 批注 + 期望改法」

## P1 — 体验与交付（v0.4.0）

- ⬜ **P1-1 版本模型增强**：快照保留策略（自动版本上限 + 里程碑永久）、稿次标签（初稿/二稿/定稿/拍摄稿）、块级 diff、按场次折叠
- ⬜ **P1-2 标准格式导出**：Fountain / 块 JSON / 纯文本排版稿；PDF 走 Narracore 或外部管线
- ⬜ **P1-3 文档模式**：fork 子会话做多轮评论式改稿，`find/replace` 围栏 + undo/redo，退出摘要带回主会话

## P2 — 生态与项目化

- ⬜ **P2-1 可选接入 dsh-better-sidebar**：file viewer 适配层，复用文件树/分屏，不绑定版本
- ⬜ **P2-2 轻量电影项目结构**：项目目录（剧本/人物/场表/版本）、场号导航、跨文件跳转
- ⬜ **P2-3 生态互通**：导出场表/块 JSON 给短剧/分镜类工作台

## 不吸收

- 云协作 / 多人实时（Script Studio）：与本地优先定位冲突
- 短剧全生产流水线（Oh Story / ai-drama）：定位互补，不重复造
- 通用对话批注（dsh-annotation 类）：保持「工作区剧本文件」唯一源
