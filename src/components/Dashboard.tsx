import { useEffect, useState, useCallback } from 'react'
import {
  Zap,
  Bot,
  MessageSquare,
  Globe,
  Stethoscope,
  RefreshCw,
  Play,
  Square,
  ArrowRight,
  AlertCircle,
  Radio,
  ChevronRight
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { useCLI } from '../hooks/useCLI'
import clsx from 'clsx'

export default function Dashboard() {
  const { gatewayRunning, setGatewayRunning, ocInstalled, ocVersion, setActiveTab } = useStore()
  const { run, stream } = useCLI()

  const [agentCount, setAgentCount] = useState<number | null>(null)
  const [channelCount, setChannelCount] = useState<number | null>(null)
  const [gatewayLoading, setGatewayLoading] = useState(false)
  const [activityLog, setActivityLog] = useState<Array<{ time: string; msg: string; type: 'info' | 'success' | 'error' }>>([])
  const [refreshing, setRefreshing] = useState(false)

  const addLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    setActivityLog(prev => [...prev.slice(-49), { time, msg, type }])
  }

  const checkGateway = useCallback(async () => {
    const running = await window.openclaw.gatewayStatus()
    setGatewayRunning(running)
    return running
  }, [setGatewayRunning])

  const loadStats = useCallback(async () => {
    if (!ocInstalled) return
    setRefreshing(true)
    try {
      const [agentsRes, channelsRes] = await Promise.allSettled([
        run(['agents', 'list']),
        run(['channels', 'list'])
      ])

      if (agentsRes.status === 'fulfilled') {
        const txt = agentsRes.value.stdout
        const lines = txt.trim().split('\n').filter(l => l.trim() && !l.includes('NAME') && !l.includes('---'))
        setAgentCount(lines.length)
      }

      if (channelsRes.status === 'fulfilled') {
        const txt = channelsRes.value.stdout
        const lines = txt.trim().split('\n').filter(l => l.trim() && !l.includes('NAME') && !l.includes('---'))
        setChannelCount(lines.length)
      }
    } catch {
      // ignore
    } finally {
      setRefreshing(false)
    }
  }, [ocInstalled, run])

  useEffect(() => {
    if (ocInstalled) {
      addLog('OpenClaw 已检测到，版本: ' + (ocVersion || 'unknown'), 'success')
    } else {
      addLog('OpenClaw 未安装，请前往 Install 页面安装', 'error')
    }
    checkGateway().then(running => {
      addLog(running ? 'Gateway 正在运行 (port 18789)' : 'Gateway 未运行', running ? 'success' : 'info')
    })
    loadStats()
  }, [ocInstalled])

  // Auto-refresh gateway status every 3s
  useEffect(() => {
    const timer = setInterval(checkGateway, 3000)
    return () => clearInterval(timer)
  }, [checkGateway])

  const handleGatewayToggle = async () => {
    setGatewayLoading(true)
    try {
      if (gatewayRunning) {
        addLog('正在停止 Gateway...', 'info')
        const res = await run(['gateway', 'stop'])
        if (res.exitCode === 0) {
          addLog('Gateway 已停止', 'success')
        } else {
          addLog('停止 Gateway 失败: ' + (res.stderr || res.stdout), 'error')
        }
      } else {
        addLog('正在启动 Gateway...', 'info')
        await stream(['gateway', 'start'], (line) => {
          if (line.trim()) addLog(line.trim(), 'info')
        })
        addLog('Gateway 启动命令已发送', 'success')
      }
      await checkGateway()
    } catch (err) {
      addLog('操作失败: ' + String(err), 'error')
    } finally {
      setGatewayLoading(false)
    }
  }

  const handleSendMessage = () => setActiveTab('agents')
  const handleOpenWeb = () => window.openclaw.openExternal('http://localhost:18789')
  const handleDoctor = () => setActiveTab('doctor')

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-[#666] text-sm mt-0.5">OpenClaw AI Agent 管理概览</p>
        </div>
        <button
          onClick={loadStats}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] text-sm hover:text-white hover:border-[#3a3a3a] transition-all"
        >
          <RefreshCw size={14} className={refreshing ? 'spinner' : ''} />
          刷新
        </button>
      </div>

      {/* Setup guide banner */}
      {!ocInstalled ? (
        <div className="rounded-xl border border-orange-500/25 bg-orange-500/5 p-4">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-xs font-bold text-orange-400 flex-shrink-0">1</div>
            <div className="flex-1">
              <p className="text-orange-300 text-sm font-semibold">第一步：安装 OpenClaw</p>
              <p className="text-[#777] text-xs mt-0.5">还没安装 OpenClaw，所有功能暂不可用。运行安装命令即可。</p>
            </div>
            <button
              onClick={() => setActiveTab('install')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 text-xs font-medium hover:bg-orange-500/30 transition-all border border-orange-500/25 flex-shrink-0"
            >
              去安装 <ChevronRight size={12} />
            </button>
          </div>
        </div>
      ) : !gatewayRunning ? (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-xs font-bold text-green-400 flex-shrink-0">3</div>
            <div className="flex-1">
              <p className="text-green-300 text-sm font-semibold">下一步：启动 Gateway</p>
              <p className="text-[#777] text-xs mt-0.5">OpenClaw 已安装 ✓ — Gateway 还未启动，微信 / 飞书暂时收不到 AI 消息。</p>
            </div>
            <button
              onClick={() => setActiveTab('gateway')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/30 transition-all border border-green-500/20 flex-shrink-0"
            >
              去启动 <ChevronRight size={12} />
            </button>
          </div>
        </div>
      ) : null}

      {/* Gateway Card */}
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={clsx(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              gatewayRunning ? 'bg-green-500/20' : 'bg-[#2a2a2a]'
            )}>
              <Zap size={20} className={gatewayRunning ? 'text-green-400' : 'text-[#666]'} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">Gateway</span>
                <span className={clsx(
                  'badge text-[10px]',
                  gatewayRunning
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-[#2a2a2a] text-[#666] border border-[#333]'
                )}>
                  {gatewayRunning ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot mr-1.5 inline-block" />运行中</>
                  ) : '已停止'}
                </span>
              </div>
              <p className="text-[#666] text-xs mt-0.5">端口 18789 · HTTP Gateway</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleGatewayToggle}
              disabled={gatewayLoading || !ocInstalled}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                gatewayRunning
                  ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20'
                  : 'bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/20',
                (gatewayLoading || !ocInstalled) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {gatewayLoading ? (
                <RefreshCw size={14} className="spinner" />
              ) : gatewayRunning ? (
                <Square size={14} />
              ) : (
                <Play size={14} />
              )}
              {gatewayRunning ? '停止' : '启动'}
            </button>
            <button
              onClick={() => setActiveTab('gateway')}
              className="px-4 py-2 rounded-lg text-sm text-[#888] hover:text-white bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-all"
            >
              管理
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Agents stat */}
        <div
          className="rounded-xl border border-[#2a2a2a] p-5 flex items-center gap-4 bg-[#1a1a1a] cursor-pointer hover:border-[#3a3a3a] hover:bg-[#1f1f1f] transition-all duration-150"
          onClick={() => setActiveTab('agents')}
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/80">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              {agentCount === null
                ? <span className="w-6 h-5 bg-[#2a2a2a] rounded animate-pulse inline-block" />
                : agentCount}
            </div>
            <div className="text-[#666] text-xs mt-0.5">已配置 Agents</div>
          </div>
          <ArrowRight size={14} className="ml-auto text-[#444]" />
        </div>

        {/* Channels stat */}
        <div
          className="rounded-xl border border-[#2a2a2a] p-5 flex items-center gap-4 bg-[#1a1a1a] cursor-pointer hover:border-[#3a3a3a] hover:bg-[#1f1f1f] transition-all duration-150"
          onClick={() => setActiveTab('channels')}
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/80">
            <Radio size={20} className="text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              {channelCount === null
                ? <span className="w-6 h-5 bg-[#2a2a2a] rounded animate-pulse inline-block" />
                : channelCount}
            </div>
            <div className="text-[#666] text-xs mt-0.5">已配置 Channels</div>
          </div>
          <ArrowRight size={14} className="ml-auto text-[#444]" />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-[#888] uppercase tracking-wider mb-3">快速操作</h2>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={handleSendMessage}
            disabled={!ocInstalled}
            className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] hover:border-orange-500/30 hover:bg-[#1f1f1f] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MessageSquare size={22} className="text-orange-400" />
            <span className="text-xs text-[#aaa]">向 Agent 发消息</span>
          </button>
          <button
            onClick={handleOpenWeb}
            disabled={!gatewayRunning}
            className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] hover:border-blue-500/30 hover:bg-[#1f1f1f] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Globe size={22} className="text-blue-400" />
            <span className="text-xs text-[#aaa]">打开 Web 界面</span>
          </button>
          <button
            onClick={handleDoctor}
            disabled={!ocInstalled}
            className="flex flex-col items-center gap-2.5 p-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] hover:border-green-500/30 hover:bg-[#1f1f1f] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Stethoscope size={22} className="text-green-400" />
            <span className="text-xs text-[#aaa]">运行诊断</span>
          </button>
        </div>
      </div>

      {/* Activity Log */}
      <div className="flex-1 min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#888] uppercase tracking-wider">活动日志</h2>
          <button
            onClick={() => setActivityLog([])}
            className="text-xs text-[#555] hover:text-[#888] transition-colors"
          >
            清除
          </button>
        </div>
        <div className="terminal rounded-lg p-4 h-48 overflow-y-auto">
          {activityLog.length === 0 ? (
            <p className="text-[#444] text-xs">暂无活动记录...</p>
          ) : (
            activityLog.map((entry, i) => (
              <div key={i} className="flex gap-3 text-xs mb-1">
                <span className="text-[#555] flex-shrink-0">{entry.time}</span>
                <span className={clsx(
                  entry.type === 'success' && 'text-green-400',
                  entry.type === 'error' && 'text-red-400',
                  entry.type === 'info' && 'text-[#aaa]'
                )}>
                  {entry.type === 'success' && '✓ '}
                  {entry.type === 'error' && '✗ '}
                  {entry.type === 'info' && '› '}
                  {entry.msg}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
