import { useEffect, useState, useCallback } from 'react'
import {
  Package, Settings, Zap, MessageSquare,
  CheckCircle, Circle, ChevronRight, RefreshCw,
  Play, Globe, Stethoscope, ArrowRight, Bot, Radio
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { useCLI } from '../hooks/useCLI'
import JSON5 from 'json5'
import clsx from 'clsx'

const CONFIG_PATH = '~/.openclaw/openclaw.json'

// ── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 'install',
    num: 1,
    icon: Package,
    color: 'orange' as const,
    title: '安装 OpenClaw',
    pendingDesc: '运行一条命令，安装 OpenClaw 命令行工具',
    doneDesc: '已安装',
    tab: 'install',
    cta: '去安装',
  },
  {
    id: 'config',
    num: 2,
    icon: Settings,
    color: 'blue' as const,
    title: '配置 AI 模型',
    pendingDesc: '填入 API Key 和模型名称，让 OpenClaw 知道用哪个 AI',
    doneDesc: '模型已配置',
    tab: 'install',
    cta: '去配置',
  },
  {
    id: 'gateway',
    num: 3,
    icon: Zap,
    color: 'green' as const,
    title: '启动 Gateway',
    pendingDesc: '启动本地服务器（端口 18789），微信消息通过它传给 AI',
    doneDesc: '运行中 · 端口 18789',
    tab: 'gateway',
    cta: '去启动',
  },
  {
    id: 'wechat',
    num: 4,
    icon: MessageSquare,
    color: 'purple' as const,
    title: '连接微信',
    pendingDesc: '安装微信集成，之后直接在微信里和 AI 对话',
    doneDesc: '微信已连接',
    tab: 'install',
    cta: '去连接',
  },
] as const

type StepId = typeof STEPS[number]['id']

const palette = {
  orange: {
    ring: 'ring-orange-500/40',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/25',
    text: 'text-orange-400',
    btn: 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30',
    num: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    bar: 'bg-orange-400',
  },
  blue: {
    ring: 'ring-blue-500/40',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/25',
    text: 'text-blue-400',
    btn: 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30',
    num: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    bar: 'bg-blue-400',
  },
  green: {
    ring: 'ring-green-500/40',
    bg: 'bg-green-500/10',
    border: 'border-green-500/25',
    text: 'text-green-400',
    btn: 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30',
    num: 'bg-green-500/20 text-green-400 border-green-500/30',
    bar: 'bg-green-400',
  },
  purple: {
    ring: 'ring-purple-500/40',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/25',
    text: 'text-purple-400',
    btn: 'bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30',
    num: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    bar: 'bg-purple-400',
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { gatewayRunning, setGatewayRunning, ocInstalled, ocVersion, setActiveTab } = useStore()
  const { run, stream } = useCLI()

  const [configDone, setConfigDone] = useState(false)
  const [wechatDone, setWechatDone] = useState(false)
  const [configModel, setConfigModel] = useState('')
  const [agentCount, setAgentCount] = useState<number | null>(null)
  const [channelCount, setChannelCount] = useState<number | null>(null)
  const [dashboardOpening, setDashboardOpening] = useState(false)
  const [gatewayStarting, setGatewayStarting] = useState(false)
  const [checking, setChecking] = useState(true)

  // ── Detect step completion ──────────────────────────────────────────────────

  const checkConfig = useCallback(async () => {
    try {
      const raw = await window.openclaw.readFile(CONFIG_PATH)
      const cfg = JSON5.parse(raw)

      // Structure 1 (current): models.providers.<name>.{ baseUrl, apiKey, models[] }
      const providers = cfg?.models?.providers
      if (providers && typeof providers === 'object') {
        for (const p of Object.values(providers) as Record<string, unknown>[]) {
          const rec = p as Record<string, unknown>
          if (rec?.baseUrl && rec?.apiKey) {
            const models = rec.models as Array<Record<string, string>> | undefined
            const firstModel = models?.[0]
            setConfigModel(firstModel?.id || firstModel?.name || String(rec.baseUrl))
            setConfigDone(true)
            return
          }
        }
      }

      // Structure 2 (simple/legacy): model.{ baseUrl, apiKey, model }
      const model = cfg?.model || {}
      const baseUrl = model.baseUrl || model.base_url || model.apiUrl || ''
      const apiKey = model.apiKey || model.api_key || ''
      if (baseUrl && apiKey) {
        setConfigModel(model.model || model.modelId || '')
        setConfigDone(true)
        return
      }

      setConfigDone(false)
    } catch {
      setConfigDone(false)
    }
  }, [])

  const checkWechat = useCallback(async () => {
    if (!ocInstalled) { setWechatDone(false); return }
    try {
      const res = await run(['channels', 'list'])
      const txt = (res.stdout || '').toLowerCase()
      setWechatDone(txt.includes('wechat') || txt.includes('weixin') || txt.includes('wx'))
    } catch {
      setWechatDone(false)
    }
  }, [ocInstalled, run])

  const checkStats = useCallback(async () => {
    if (!ocInstalled) return
    try {
      const [ar, cr] = await Promise.allSettled([run(['agents', 'list']), run(['channels', 'list'])])
      if (ar.status === 'fulfilled') {
        const lines = ar.value.stdout.trim().split('\n').filter(l => l.trim() && !l.includes('NAME') && !l.includes('---'))
        setAgentCount(lines.length)
      }
      if (cr.status === 'fulfilled') {
        const lines = cr.value.stdout.trim().split('\n').filter(l => l.trim() && !l.includes('NAME') && !l.includes('---'))
        setChannelCount(lines.length)
      }
    } catch { /* ignore */ }
  }, [ocInstalled, run])

  // Open Gateway web dashboard with proper token URL
  // Output format: "Dashboard URL: http://127.0.0.1:18789/#token=xxx"
  const openDashboard = async () => {
    setDashboardOpening(true)
    try {
      const res = await run(['dashboard', '--no-open'])
      const output = res.stdout + res.stderr
      const match = output.match(/https?:\/\/[\w.]+:\d+[^\s\n]+/)
      window.openclaw.openExternal(match ? match[0].trim() : 'http://127.0.0.1:18789')
    } catch {
      window.openclaw.openExternal('http://127.0.0.1:18789')
    } finally {
      setDashboardOpening(false)
    }
  }

  const refresh = useCallback(async () => {
    setChecking(true)
    await Promise.allSettled([checkConfig(), checkWechat(), checkStats()])
    setChecking(false)
  }, [checkConfig, checkWechat, checkStats])

  useEffect(() => { refresh() }, [ocInstalled, gatewayRunning])

  // Auto-refresh gateway status
  useEffect(() => {
    const t = setInterval(async () => {
      const running = await window.openclaw.gatewayStatus()
      setGatewayRunning(running)
    }, 3000)
    return () => clearInterval(t)
  }, [setGatewayRunning])

  // ── Inline gateway start ────────────────────────────────────────────────────

  const handleStartGateway = async () => {
    setGatewayStarting(true)
    try {
      await stream(['gateway'], () => {})
      const up = await window.openclaw.gatewayStatus()
      setGatewayRunning(up)
    } catch { /* ignore */ }
    finally { setGatewayStarting(false) }
  }

  // ── Compute step statuses ──────────────────────────────────────────────────

  const done: Record<StepId, boolean> = {
    install: ocInstalled,
    config: configDone,
    gateway: gatewayRunning,
    wechat: wechatDone,
  }

  const allDone = STEPS.every(s => done[s.id])
  const activeIdx = STEPS.findIndex(s => !done[s.id])
  const completedCount = STEPS.filter(s => done[s.id]).length

  // ── All done view ──────────────────────────────────────────────────────────

  if (allDone) {
    return (
      <div className="flex flex-col h-full overflow-y-auto p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">首页</h1>
            <p className="text-[#666] text-sm mt-0.5">系统运行正常</p>
          </div>
          <button onClick={refresh} disabled={checking}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] text-sm hover:text-white transition-all">
            <RefreshCw size={13} className={checking ? 'spinner' : ''} />刷新
          </button>
        </div>

        {/* All done banner */}
        <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6 text-center space-y-2">
          <div className="text-3xl">🎉</div>
          <p className="text-green-400 font-bold text-lg">一切就绪！</p>
          <p className="text-[#777] text-sm">打开微信，给自己发条消息，AI 会回复你</p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button onClick={openDashboard} disabled={dashboardOpening}
              title="在浏览器中打开 Gateway 仪表盘，可直接与 AI 对话（用于测试）"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 text-green-400 text-sm border border-green-500/25 hover:bg-green-500/30 transition-all disabled:opacity-60">
              {dashboardOpening ? <RefreshCw size={14} className="spinner" /> : <Globe size={14} />}
              浏览器测试对话
            </button>
            <button onClick={() => setActiveTab('doctor')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1a1a] text-[#888] text-sm border border-[#2a2a2a] hover:text-white transition-all">
              <Stethoscope size={14} /> 运行诊断
            </button>
          </div>
        </div>

        {/* Status grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-500/15 flex items-center justify-center">
              <Zap size={18} className="text-green-400" />
            </div>
            <div>
              <p className="text-white text-sm font-medium flex items-center gap-1.5">
                Gateway
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot inline-block" />
              </p>
              <p className="text-[#666] text-xs">运行中 · 18789</p>
            </div>
          </div>
          <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Settings size={18} className="text-blue-400" />
            </div>
            <div>
              <p className="text-white text-sm font-medium">AI 模型</p>
              <p className="text-[#666] text-xs truncate max-w-[120px]">{configModel || '已配置'}</p>
            </div>
          </div>
          <div onClick={() => setActiveTab('agents')}
            className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 flex items-center gap-3 cursor-pointer hover:border-[#3a3a3a] transition-all">
            <div className="w-9 h-9 rounded-lg bg-blue-500/80 flex items-center justify-center">
              <Bot size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">{agentCount ?? '—'} Agents</p>
              <p className="text-[#666] text-xs">已配置</p>
            </div>
            <ArrowRight size={13} className="text-[#444]" />
          </div>
          <div onClick={() => setActiveTab('channels')}
            className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 flex items-center gap-3 cursor-pointer hover:border-[#3a3a3a] transition-all">
            <div className="w-9 h-9 rounded-lg bg-purple-500/80 flex items-center justify-center">
              <Radio size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">{channelCount ?? '—'} Channels</p>
              <p className="text-[#666] text-xs">已配置</p>
            </div>
            <ArrowRight size={13} className="text-[#444]" />
          </div>
        </div>

        {/* Completed steps recap */}
        <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-4 space-y-2">
          <p className="text-[#555] text-xs uppercase tracking-wider font-semibold mb-3">完成的步骤</p>
          {STEPS.map(s => {
            const Icon = s.icon
            const c = palette[s.color]
            return (
              <div key={s.id} className="flex items-center gap-3">
                <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                <Icon size={13} className={clsx(c.text, 'flex-shrink-0')} />
                <span className="text-[#777] text-xs">{s.title}</span>
                <span className={clsx('text-[10px] ml-auto', c.text)}>
                  {s.id === 'install' && ocVersion}
                  {s.id === 'config' && configModel}
                  {s.id === 'gateway' && '运行中'}
                  {s.id === 'wechat' && '已连接'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Setup progress view ────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">上手引导</h1>
          <p className="text-[#666] text-sm mt-0.5">按顺序完成以下步骤，几分钟内即可开始与 AI 对话</p>
        </div>
        <button onClick={refresh} disabled={checking}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] text-sm hover:text-white transition-all">
          <RefreshCw size={13} className={checking ? 'spinner' : ''} />刷新
        </button>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#666]">进度</span>
          <span className="text-[#888]">{completedCount} / {STEPS.length} 步</span>
        </div>
        <div className="h-1.5 rounded-full bg-[#1e1e1e] overflow-hidden">
          <div
            className="h-full rounded-full bg-orange-500 transition-all duration-700"
            style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {STEPS.map((step, idx) => {
          const isDone = done[step.id]
          const isActive = idx === activeIdx
          const isPending = !isDone && !isActive
          const Icon = step.icon
          const c = palette[step.color]

          return (
            <div key={step.id} className={clsx(
              'rounded-xl border transition-all duration-200',
              isDone
                ? 'border-[#1e1e1e] bg-[#111]'
                : isActive
                  ? clsx('border-2 p-0.5', c.border, c.ring, 'ring-2')
                  : 'border-[#1a1a1a] bg-[#0f0f0f]'
            )}>
              <div className={clsx(
                'flex items-center gap-4 p-4 rounded-[10px]',
                isDone ? '' : isActive ? c.bg : ''
              )}>
                {/* Status icon */}
                <div className="flex-shrink-0">
                  {isDone ? (
                    <CheckCircle size={22} className="text-green-400" />
                  ) : isActive ? (
                    <div className={clsx('w-6 h-6 rounded-full border-2 flex items-center justify-center text-[11px] font-bold', c.num)}>
                      {step.num}
                    </div>
                  ) : (
                    <Circle size={22} className="text-[#333]" />
                  )}
                </div>

                {/* Icon */}
                <Icon size={17} className={clsx(
                  'flex-shrink-0',
                  isDone ? 'text-[#444]' : isActive ? c.text : 'text-[#333]'
                )} />

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={clsx(
                    'text-sm font-medium',
                    isDone ? 'text-[#666]' : isActive ? 'text-white' : 'text-[#444]'
                  )}>
                    {step.title}
                  </p>
                  <p className={clsx(
                    'text-xs mt-0.5',
                    isDone ? 'text-[#3a3a3a]' : isActive ? 'text-[#999]' : 'text-[#2a2a2a]'
                  )}>
                    {isDone
                      ? (step.id === 'install' ? `已安装 ${ocVersion || ''}`.trim()
                        : step.id === 'config' ? `模型: ${configModel}`
                        : step.id === 'gateway' ? '运行中 · 端口 18789'
                        : '微信已连接')
                      : step.pendingDesc}
                  </p>
                </div>

                {/* Action */}
                {isDone ? (
                  <CheckCircle size={14} className="text-green-500/50 flex-shrink-0" />
                ) : isActive ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Gateway step has inline start button */}
                    {step.id === 'gateway' && ocInstalled && (
                      <button
                        onClick={handleStartGateway}
                        disabled={gatewayStarting}
                        className={clsx(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border',
                          c.btn
                        )}
                      >
                        {gatewayStarting
                          ? <RefreshCw size={12} className="spinner" />
                          : <Play size={12} />}
                        {gatewayStarting ? '启动中...' : '立即启动'}
                      </button>
                    )}
                    <button
                      onClick={() => setActiveTab(step.tab)}
                      className={clsx(
                        'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                        c.btn
                      )}
                    >
                      {step.cta}
                      <ChevronRight size={12} />
                    </button>
                  </div>
                ) : (
                  <span className="text-[#2a2a2a] text-xs flex-shrink-0">待完成</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Tip box for active step */}
      {activeIdx >= 0 && (
        <div className="rounded-xl border border-[#1e1e1e] bg-[#0f0f0f] p-4">
          <p className="text-[#555] text-[10px] uppercase tracking-wider font-semibold mb-2">当前步骤说明</p>
          {activeIdx === 0 && (
            <p className="text-[#888] text-xs leading-relaxed">
              OpenClaw 是运行在你电脑上的 AI Agent 框架。运行 <code className="bg-[#1a1a1a] text-orange-400 px-1.5 py-0.5 rounded text-[10px]">npm install -g openclaw</code> 安装，或前往安装页面一键完成。
            </p>
          )}
          {activeIdx === 1 && (
            <p className="text-[#888] text-xs leading-relaxed">
              在"安装"页的快速配置向导中，选择一个预设（如 OpenAI），填入 API Key 和模型名，点击"测试连接"验证后保存。
            </p>
          )}
          {activeIdx === 2 && (
            <p className="text-[#888] text-xs leading-relaxed">
              Gateway 是本地 HTTP 服务器（端口 18789），微信/飞书把消息发给它，它转给 AI，AI 的回复再原路发回。<strong className="text-[#aaa]">不启动 Gateway，AI 就收不到任何消息。</strong>
            </p>
          )}
          {activeIdx === 3 && (
            <p className="text-[#888] text-xs leading-relaxed">
              在"安装"页找到微信集成区域，按平台（Windows/macOS）安装对应的微信 Hook 组件，然后重启 Gateway 即可。
            </p>
          )}
        </div>
      )}
    </div>
  )
}
