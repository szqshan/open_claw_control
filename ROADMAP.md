# OpenClaw Control — 产品路线图

> 目标：从"安装向导"升级为完整的 OpenClaw 管理驾驶舱，对标 EasyClaw，深度服务中国用户场景。

---

## 产品定位

**EasyClaw**：偏向云端 24/7 + 技能生态，面向全球用户
**OpenClaw Control**：主打本地部署 + 微信/飞书深度集成 + 中国用户友好（国产模型预设、中文界面、中文技能）

---

## 竞品分析：EasyClaw 功能矩阵

EasyClaw 左侧导航（对应截图）：

| 模块 | EasyClaw 能力 |
|------|--------------|
| **Chat** | 内嵌聊天界面、多 Agent 切换、对话历史、模型快速切换、@mention 触发 |
| **Skill Store** | ClawHub 5400+ 技能、一键安装/卸载、分类搜索、自定义技能上传 |
| **Agent Store** | 创建/管理多个 Agent、SOUL.md 配置、分配技能、设置默认 Agent |
| **Cron Tasks** | 定时任务 UI、at/every/cron 三种模式、执行历史日志 |
| **Connectors** | WeChat/Feishu/Telegram/Discord/Slack 等 10+ 渠道统一管理 |

---

## 现状差距

| 功能模块 | EasyClaw | OpenClaw Control（现状） |
|---------|----------|----------------------|
| Chat | ✅ 完整聊天界面 | ❌ 无（只能跳转浏览器） |
| Skill Store | ✅ 5400+ 技能市场 | ❌ 无 |
| Agent Store | ✅ 多 Agent 创建/管理 | ❌ 无 |
| Cron Tasks | ✅ 定时任务 UI | ❌ 无 |
| Connectors | ✅ 10+ 渠道统一管理 | ⚠️ 仅 WeChat（4条命令手动安装） |
| 安装引导 | ✅ 零依赖，一键启动 | ✅ 有，但需要 Node.js 前置 |
| 网关管理 | ✅ 后台静默，系统托盘 | ⚠️ 独立 Tab，需手动启动 |
| 模型配置 | ✅ 预设 + 单字段 | ⚠️ 3 个输入框，全手填 |

---

## 路线图

### Phase 1 — 夯实基础（当前阶段）

**目标**：让小白 5 分钟内装好并跑起来，消除现有摩擦点。

#### 1.1 API 配置预设化
- [ ] 选 Provider 大按钮（OpenAI / Anthropic / DeepSeek / 通义 / 豆包 / 自定义）
- [ ] 点选后只需填写 API Key，其余字段自动填充
- [ ] 检测环境变量 `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` 自动预填
- [ ] "测试连接"按钮：保存前验证模型可用性

#### 1.2 网关自动化
- [ ] 安装完成后自动启动 Gateway，无需用户操作
- [ ] 崩溃自动重启（带指数退避）
- [ ] 开机自启选项（默认开启）
- [ ] Gateway 静默后台运行，状态图标显示在顶部栏

#### 1.3 内置 Node.js 运行时
- [ ] Electron 打包时捆绑便携版 Node.js（~50MB）
- [ ] `npm install -g openclaw` 改为使用内置 Node 执行
- [ ] 用户零感知，消除"先装 Node.js"的前置门槛

#### 1.4 导航精简
- [ ] 6 个 Tab → 合理分组（主页 + 设置）
- [ ] WebDashboard 从独立 Tab 改为悬浮按钮打开
- [ ] Doctor 诊断从独立 Tab 改为 Gateway 页内折叠区

**测试覆盖**：`openclaw-control-test` Skill（现有覆盖）

---

### Phase 2 — Chat（内嵌聊天）

**目标**：装完直接在 App 里聊，不用跳浏览器。

#### 导航新增：Chat

| 功能 | 实现方式 |
|------|---------|
| 聊天输入框 | 调用 Gateway REST API（POST /v1/messages） |
| 多 Agent 切换 | 左侧 Agent 列表，来自 `openclaw agents list` |
| 对话历史 | 从 Gateway `/conversations` API 获取 |
| 模型快速切换 | 输入框底部下拉，来自配置文件 |
| @mention 触发 | 输入 @ 弹出 Agent 选择器 |
| Markdown 渲染 | 支持代码块、表格、列表 |

**测试覆盖**：需更新 `openclaw-control-test` Skill 新增 Chat 模块测试

---

### Phase 3 — Connectors（渠道统一管理）

**目标**：把多渠道接入从"4条命令"变成界面点击。

#### 导航新增：Connectors

| 渠道 | 接入方式 | 优先级 |
|------|---------|-------|
| 微信（个人号） | QR 码扫描，内嵌显示 | P0 |
| 飞书 | AppID + AppSecret 填写 | P0 |
| Telegram | Bot Token 填写 | P1 |
| Discord | Bot Token + Guild ID | P1 |
| Slack | Workspace OAuth | P2 |
| DingTalk | 钉钉机器人 | P2 |

#### 界面设计
- 渠道卡片列表：已连接（绿色）/ 可连接（灰色）/ 错误（红色）
- 点击"连接"弹出对应配置表单
- 微信 QR 码在界面内直接渲染（不再需要解析终端 ASCII 输出）
- 状态实时监控，每 30 秒刷新一次
- 一键断开/重连

**测试覆盖**：需更新 `openclaw-control-test` Skill 新增 Connectors 模块测试

---

### Phase 4 — Cron Tasks（定时任务）

**目标**：通过界面设置自动化任务，不需要命令行。

#### 导航新增：Cron Tasks

| 功能 | 说明 |
|------|------|
| 任务列表 | 来自 `openclaw cron list` |
| 创建任务 | 自然语言描述 + 时间规则选择 |
| 时间规则 | at（单次）/ every（固定间隔）/ cron 表达式 |
| 启用/禁用 | 开关切换 |
| 执行历史 | 最近 N 次执行结果日志 |
| 删除任务 | 确认弹窗后删除 |

**常用模板**：
- 每天 8:00 早报（`every day at 08:00`）
- 每 6 小时检查收件箱
- 每周一生成周报
- 指定时间提醒（单次）

**测试覆盖**：需更新 `openclaw-control-test` Skill 新增 Cron Tasks 模块测试

---

### Phase 5 — Skill Store（技能商店）

**目标**：ClawHub 技能一键安装，不用命令行。

#### 导航新增：Skill Store

| 功能 | 说明 |
|------|------|
| 技能列表 | 接入 ClawHub API（5400+ 技能） |
| 分类浏览 | 日历、GitHub、邮件、文件、搜索等分类 |
| 搜索 | 关键词搜索技能名/描述 |
| 一键安装 | `openclaw skills install <skill>` |
| 一键卸载 | `openclaw skills uninstall <skill>` |
| 已安装管理 | 显示已安装技能列表，支持更新/卸载 |
| 自定义技能 | 导入本地 SKILL.md 文件 |

**测试覆盖**：需更新 `openclaw-control-test` Skill 新增 Skill Store 模块测试

---

### Phase 6 — Agent Store（Agent 管理）

**目标**：创建和管理多个专属 Agent。

#### 导航新增：Agent Store（或并入 Chat 左侧面板）

| 功能 | 说明 |
|------|------|
| Agent 列表 | 来自 `openclaw agents list` |
| 创建 Agent | 选模板，填名称/描述/系统提示 |
| 分配技能 | 为 Agent 勾选已安装技能 |
| 设为默认 | 切换默认 Agent |
| 导出/导入 | 分享 Agent 配置（SOUL.md） |

**Agent 模板预设**（面向中国用户）：
- 通用助手（默认）
- 跨境电商运营专家
- 代码审查助手
- 微信客服机器人
- 飞书行政助手

**测试覆盖**：需更新 `openclaw-control-test` Skill 新增 Agent Store 模块测试

---

## 中国用户差异化优势

相较 EasyClaw，OpenClaw Control 在以下方向深度差异化：

### 国产模型预设（Phase 1）
```
预设列表：
- OpenAI (api.openai.com)
- Anthropic (api.anthropic.com)
- DeepSeek (api.deepseek.com)
- 通义千问 (dashscope.aliyuncs.com)
- 豆包 (ark.cn-beijing.volces.com)
- 月之暗面 Moonshot (api.moonshot.cn)
- 智谱 GLM (open.bigmodel.cn)
- 第三方代理 (anyrouter / xueai / 自定义)
```

### 微信深度集成（Phase 3）
- 个人微信号接入（EasyClaw 需用户自行配置）
- 群聊 @mention 触发 Agent
- 朋友圈监控（可选）
- QR 码登录在 App 内内嵌扫码

### 飞书企业集成（Phase 3）
- 飞书机器人一键配置
- 多维表格数据读写
- 文档知识库接入
- 企业用户多人共用同一 OpenClaw 实例

---

## 技术架构演进

### 现阶段（Phase 1）
```
Electron Main Process
  ├── IPC Handlers (cli:run, gateway:status, file:read/write...)
  └── Child Processes (openclaw gateway, npm install...)

React Renderer
  ├── Dashboard（安装向导 + 状态）
  ├── Install（CLI + 配置 + 微信）
  ├── Gateway（启动/停止/日志）
  ├── Config（JSON 编辑器）
  └── Doctor（诊断）
```

### 目标架构（Phase 2-6）
```
Electron Main Process
  ├── IPC Handlers（扩展 chat/agents/skills/cron/connectors）
  ├── Gateway Manager（自动启动/重启/监控）
  └── Bundled Node.js Runtime

React Renderer
  ├── Chat（聊天界面 + Agent 切换）
  ├── Connectors（渠道管理）
  ├── Cron Tasks（定时任务）
  ├── Skill Store（技能市场）
  ├── Agent Store（Agent 管理）
  └── Settings（模型配置 + 高级设置）

External APIs
  ├── OpenClaw Gateway REST API（localhost:18789）
  ├── ClawHub Skills Registry API
  └── 各渠道平台 API（飞书/Telegram 等）
```

---

## 导航结构演进

### 现在（6个Tab）
```
Dashboard | Install | Gateway | Config | Doctor | WebDashboard
```

### Phase 2 目标
```
左侧导航：
  💬 Chat          ← 新增
  🏠 Home          ← 原 Dashboard（精简）
  ⚙️  Settings      ← 合并 Install + Config + Doctor
```

### Phase 3-6 目标（对标 EasyClaw）
```
左侧导航：
  💬 Chat
  🔧 Skill Store   ← 新增
  🤖 Agent Store   ← 新增
  ⏰ Cron Tasks    ← 新增
  🔌 Connectors    ← 新增（取代 Install 的微信安装）
  ⚙️  Settings
```

---

## 测试策略

每个 Phase 完成后通过 `openclaw-control-test` Skill 进行自动化评估：

| Phase | 测试重点 | 通过标准 |
|-------|---------|---------|
| Phase 1 | 小白上手旅程（Beginner Journey） | journey_* 全部 PASS |
| Phase 2 | Chat 界面功能完整性 | chat_* 测试项 ≥ 80% PASS |
| Phase 3 | Connectors 渠道管理 | connectors_* 测试项 ≥ 80% PASS |
| Phase 4 | Cron Tasks 创建/管理 | cron_* 测试项 ≥ 80% PASS |
| Phase 5 | Skill Store 浏览/安装 | skill_store_* ≥ 80% PASS |
| Phase 6 | Agent Store 创建/管理 | agent_store_* ≥ 80% PASS |

测试技能位置：`~/.claude/skills/openclaw-control-test/`

---

## 版本计划

| 版本 | Phase | 核心交付 |
|------|-------|---------|
| v0.x（当前） | — | 安装向导 + Gateway 管理 |
| v1.0 | Phase 1 | 零门槛安装 + 国产模型预设 + 自动网关 |
| v1.5 | Phase 2 | 内嵌 Chat 界面 |
| v2.0 | Phase 3 | Connectors 渠道管理（微信/飞书内嵌） |
| v2.5 | Phase 4 | Cron Tasks 定时任务 |
| v3.0 | Phase 5-6 | Skill Store + Agent Store |
