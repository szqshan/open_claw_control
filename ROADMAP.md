# OpenClaw Control — 产品路线图

> 目标：从"安装向导"升级为完整的 OpenClaw 管理驾驶舱，对标 EasyClaw，深度服务中国用户场景。

---

## 产品定位

**EasyClaw**：偏向云端 24/7 + 技能生态，面向全球用户
**OpenClaw Control**：主打本地部署 + 微信/飞书深度集成 + 中国用户友好（国产模型预设、中文界面、中文技能）

---

## 当前进度（2026-03-23）

| Phase | 状态 | 说明 |
|-------|------|------|
| Phase 1 — 核心基础 | ✅ 100% | 安装引导、配置预设、Gateway 管理、模型测试 |
| Phase 2 — Chat | ✅ 100% | 内嵌聊天界面，Gateway API + CLI 双路 |
| Phase 3 — Connectors | ✅ 基础完成 | EasyClaw 风格目录页，8 种连接器 |
| Phase 4 — Cron Tasks | ✅ 100% | once/repeat/cron 三模式，4 个模板 |
| Phase 5 — Skill Store | 🔄 进行中 | 基础框架完成，需接入 ClawHub + 分类 |
| Phase 6 — Agent Store | ✅ 基础完成 | 我的 Agents + 5 个预设模板 |

---

## 优化计划（2026-03-23 确认）

### P0 — Skill Store 全面重写（EasyClaw 风格 + ClawHub 接入）

**目标**：对标 EasyClaw Skill Store，支持 ClawHub 插件市场（2026.3.22 新增）

- [ ] 顶部双 Tab：`Skill Store`（在线商店）+ `My Skills`（已安装）
- [ ] 右上角：搜索框 `Search skills, press Enter` + `+ Create Skill` 按钮
- [ ] 分类标签行：Featured / General / Creative / Academic / Development / Legal / Lifestyle / Marketing / Finance
- [ ] 技能卡片 3 列网格：彩色方形图标、名称、描述（截断）、右上角云下载图标
- [ ] 已安装状态显示绿色 `Added` 标签，已启用/禁用切换
- [ ] 数据来源：`openclaw plugins marketplace list clawhub`（在线）+ 静态精选兜底
- [ ] 安装：`openclaw plugins install clawhub:<name>` 流式进度
- [ ] 卸载：`openclaw plugins uninstall <name>`
- [ ] My Skills Tab：`openclaw plugins list` 展示已安装，支持 enable/disable

### P0 — 版本管理 & 自动升级

**背景**：当前最新版 `2026.3.22`，含安全漏洞修复 + ClawHub 插件市场

- [ ] Install 页新增「版本管理」区块
  - 显示当前版本（解析 `openclaw --version`）
  - 对比 npm registry 最新版（API: `https://registry.npmjs.org/openclaw/latest`）
  - 版本差异摘要（安全修复、新功能列表）
  - 「立即升级」按钮 → 流式执行 `npm install -g openclaw`
- [ ] Dashboard 顶部版本提示横幅
  - 检测到新版本时显示蓝色横幅
  - 可关闭（localStorage 记录已提示版本）
  - 点击跳转 Install 页

### P1 — Connectors 视觉细化

- [ ] 连接器图标改为品牌色纯色背景 + 英文缩写（去掉 emoji）
- [ ] 卡片间距和图标尺寸对齐 EasyClaw
- [ ] 连接状态实时轮询（每 30 秒刷新）

### P1 — Agent Store 重写

- [ ] 同 Skill Store 风格：在线模板 + 我的 Agents 双 Tab
- [ ] 支持从 `openclaw agents marketplace`（如有）拉取 Agent 模板
- [ ] 更丰富的 Agent 模板预设（10+）

### P2 — 导航结构精简（对标 EasyClaw 紧凑导航）

- [ ] 侧边栏收窄为图标+标签紧凑模式（可折叠）
- [ ] Doctor 诊断合并到 Gateway 页内折叠区
- [ ] WebDashboard 移到侧边栏底部按钮（已完成）

---

## 竞品分析：EasyClaw 功能矩阵

| 模块 | EasyClaw 能力 |
|------|--------------|
| **Chat** | 内嵌聊天界面、多 Agent 切换、对话历史、模型快速切换、@mention 触发 |
| **Skill Store** | ClawHub 5400+ 技能、一键安装/卸载、分类搜索、自定义技能上传 |
| **Agent Store** | 创建/管理多个 Agent、SOUL.md 配置、分配技能、设置默认 Agent |
| **Cron Tasks** | 定时任务 UI、at/every/cron 三种模式、执行历史日志 |
| **Connectors** | WeChat/Feishu/Telegram/Discord/Slack 等 10+ 渠道统一管理 |

---

## Phase 详细设计

### Phase 1 — 夯实基础 ✅

**目标**：让小白 5 分钟内装好并跑起来，消除现有摩擦点。

#### 1.1 API 配置预设化 ✅
- [x] 选 Provider 大按钮（OpenAI / Anthropic / DeepSeek / 通义 / 豆包 / 自定义）
- [x] 点选后只需填写 API Key，其余字段自动填充
- [x] "测试连接"按钮：保存前验证模型可用性

#### 1.2 导航精简 ✅
- [x] WebDashboard 从独立 Tab 改为侧边栏悬浮按钮
- [x] 新增 Chat、Cron Tasks 到导航

---

### Phase 2 — Chat（内嵌聊天）✅

- [x] 聊天输入框，调用 Gateway REST API
- [x] 多 Agent 切换（左侧 Agent 列表）
- [x] Gateway 状态指示，未运行时显示警告横幅
- [x] Markdown 渲染（代码块、粗体、换行）

---

### Phase 3 — Connectors（渠道管理）✅ 基础

- [x] EasyClaw 风格目录页（3 列卡片网格）
- [x] 8 种连接器预设（WeChat/Feishu/Telegram/Discord/DingTalk/Slack/QQ/Webhook）
- [x] Connected 状态显示，Connect / Edit / Disconnect 按钮
- [x] 搜索过滤

**待完善**：
- [ ] 品牌色图标（当前用 emoji）
- [ ] 状态实时轮询

---

### Phase 4 — Cron Tasks ✅

- [x] 任务列表（`openclaw cron list`）
- [x] 创建任务：once / repeat / cron 三模式
- [x] 4 个快捷模板
- [x] 启用/禁用/删除

---

### Phase 5 — Skill Store（技能商店）🔄

**最新 CLI 命令（OpenClaw 2026.3.22）**：
```bash
openclaw plugins marketplace list clawhub   # 浏览在线插件
openclaw plugins install clawhub:<name>     # 安装插件
openclaw plugins list                       # 已安装列表
openclaw plugins enable/disable <name>      # 启用/禁用
openclaw plugins uninstall <name>           # 卸载
openclaw plugins update --all               # 全部更新
openclaw skills search <keyword>            # 搜索技能
```

---

### Phase 6 — Agent Store ✅ 基础

- [x] 我的 Agents 列表（卡片网格）
- [x] Agent 模板（5 个预设）
- [x] 新建 Agent（名称/workspace/prompt）
- [x] 设为默认、发消息、删除

---

## OpenClaw 版本信息

| 项目 | 版本 |
|------|------|
| 最新稳定版 | `2026.3.22` |
| npm 安装 | `npm install -g openclaw` |
| 升级命令 | `npm update -g openclaw` |

**2026.3.22 关键更新**：
- ClawHub 插件市场正式上线（`openclaw plugins marketplace`）
- Windows 安全漏洞修复（凭证泄露、环境变量注入）
- GPT-5.4-mini/nano、MiniMax M2.7 模型支持
- 飞书复杂交互卡片、Telegram 自动话题命名

---

## 中国用户差异化优势

### 国产模型预设 ✅
- OpenAI / Anthropic / DeepSeek / 通义千问 / 豆包 / 月之暗面 / 智谱 GLM / 第三方代理

### 微信深度集成（进行中）
- 个人微信号接入（扫码登录）
- QR 码在 App 内内嵌显示

### 飞书企业集成
- 飞书机器人一键配置
- App ID + App Secret 填写即可

---

## 测试策略

| Phase | 测试结果 | 分数 |
|-------|---------|------|
| Phase 0 (Cross-cutting) | ✅ 通过 | 11/11 100% |
| Phase 1 (Core) | ✅ 通过 | 59/59 100% |
| Phase 2 (Chat) | ✅ 通过 | 6/6 100% |
| Phase 3 (Connectors) | ○ SKIP | 测试标记为 planned |
| Phase 4 (Cron Tasks) | ✅ 通过 | 4/4 100% |
| Phase 5 (Skill Store) | ✅ 通过 | 5/5 100% |
| Phase 6 (Agent Store) | ✅ 通过 | 1/1 100% |

**VERDICT: 小白可顺利上手** — 零失败，零回归
