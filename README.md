# 剧本模式（Screenplay Mode）

[![CI](https://github.com/BaoZhengchen/dsh-screenplay/actions/workflows/ci.yml/badge.svg)](https://github.com/BaoZhengchen/dsh-screenplay/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/BaoZhengchen/dsh-screenplay?label=release)](https://github.com/BaoZhengchen/dsh-screenplay/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> 在 DeepSeek Harness 的右侧栏打开剧本，按段/按句批注，一键交给编剧 Agent 改稿；每轮改稿自动成版本，可对比、可回滚。

**Screenplay mode** is a plugin bundle for [DeepSeek Harness](https://deepseek.com/harness/). It opens a screenplay in the right sidebar, lets you annotate paragraphs or selected sentences, hands the notes to a writing agent, and keeps every revision with diff and rollback.

---

## 特性

- **右栏剧本面板**：注册独立 tab 类型，只接管工作区 `剧本/` 目录下的 `.md` / `.txt` / `.fountain`；其他文件仍由内置预览打开。
- **剧本块模型**：解析为八类块（场景标题/动作/角色/括注/对白/转场/镜头/备注），渲染、目录与后续导出一致。
- **段级 + 句级批注**：悬停段落写段级意见；鼠标划选句子后浮出「批注所选」，编辑器内直接展示所选原文，跨段选区整块包裹。
- **排版滑块**：行距 / 段距 / 字号，偏好记在本地。
- **目录**：按幕 / 场跳转，目标标题有淡出高亮动画。
- **版本链**：发送批注前自动快照，Agent 改稿后自动登记新版本；支持快照预览、行级 diff、回滚。
- **主题自适应**：颜色全部使用宿主 `--dsw-alias-*` token，跟随深/浅色主题。
- **桌面端友好**：回到顶部按钮；`.dsh-screenplay-open` 标记文件可让面板在启动后自动打开目标剧本。

## 环境要求

- DeepSeek Harness（Web 或 Desktop），且包含 `plugin-manager`。
- 无需构建步骤：客户端是纯 JS 模块，React 由 Harness 浏览器模块表提供。

## 安装

1. 把本仓库放到本机任意目录（例如 `~/dsh-screenplay`）。
2. 在 Harness 会话里让 Agent 执行 `plugin_manager` 的 `install_bundle`，目标指向仓库绝对路径。
3. 刷新 / 重载 Harness 界面；右侧栏的引导页会出现「剧本模式」卡片。

### 从 Release 安装

每个版本在 [Releases](https://github.com/BaoZhengchen/dsh-screenplay/releases) 提供源码快照与 `.tgz` 打包产物。

- **推荐**：`git clone` 或下载对应 tag 的源码目录，用 `install_bundle` 指向目录（插件无构建步骤，直接可用）。
- 也可下载 Release 中的 `.tgz`，交给支持本地安装包的 Harness 插件安装入口。
- 版本变更见 [CHANGELOG.md](CHANGELOG.md)。

> Desktop 下没有浏览器地址栏，插件改动通过 `plugin_manager remove_bundle → install_bundle` 热重载；个别情况下需要重启一次 Harness。

## 使用

1. 在会话工作区创建 `剧本/` 目录，把剧本放进去（Markdown 纯文本，段落之间空一行；`.fountain` 扩展名也可被面板接管）。
2. 展开右侧栏 →「剧本模式」；或直接在聊天/文件树里点开 `剧本/` 下的文件。
3. 悬停段落右侧「＋」= 段级批注；划选句子 →「＋ 批注所选」= 句级批注。
4. 右下角「发送 N 条批注」→ Agent 按批注局部改稿；顶部「版本」查看版本链、diff、回滚。
5. 顶部「Aa」调行距/段距/字号；「☰」打开目录。

## 目录结构

```
dsh-screenplay/
  package.json          # DSH bundle 清单（dsh.bundle.patch + dsh.client）
  cordis.patch.yml      # 宿主插件行
  index.js              # 宿主半：/screenplay 命令、版本 sidecar、文件监听、agent.steer
  client.js             # 浏览器半：右栏 tab、批注面板、版本抽屉
  locale/               # 插件管理器中显示的名称与描述
  icon.svg
  DESIGN.md             # 详细设计（交互、版本模型、命令协议）
  ROADMAP.md            # 待办与已完成优化项
  CHANGELOG.md          # 版本变更
  test/                 # 解析器 / 锚点 / 越界检测测试（node --test 风格，无依赖）
```

## 数据与隐私

- 插件**不联网、不上传**任何内容，也没有遥测。
- 剧本、版本快照、批注记录都保存在用户自己的工作区目录：`剧本/.dsh-screenplay/<文件名>/`。
- 发送批注时，只通过本机会话把批注作为一条用户消息交给所选模型。
- 未发送的批注草稿存在浏览器 `localStorage`。

## 开发说明

- B 端（浏览器）改动刷新页面或重载插件生效；宿主（`index.js`）改动需要重载插件。
- 面板根节点带 `data-screenplay-build` 构建戳，方便确认线上代码版本。
- 详细实现请读 [DESIGN.md](DESIGN.md)。

## License

[MIT](LICENSE)
