import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Zap, Play, Square, RotateCw, RefreshCw, Terminal,
  FileText, StopCircle, Wrench, AlertTriangle, CheckCircle,
  ChevronDown, ChevronRight, HeartPulse, XCircle, AlertCircle,
  ToggleLeft, ToggleRight
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { useCLI } from '../hooks/useCLI'
import JSON5 from 'json5'
import clsx from 'clsx'

const CONFIG_PATH = '~/.openclaw/openclaw.json'

// Strip ANSI escape sequences from terminal output
const stripAnsi = (s: string) =>
  s.replace(/\x1B\[[\d;]*[A-Za-z]/g, '')
   .replace(/\x1B[()][0-9A-Za-z]/g, '')
   .replace(/\x1B[^[]/g, '')
   .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
   .replace(/\r/g, '')

type FixState = 'idle' | 'needed' | 'fixing' | 'fixed' | 'error'

// ── Inline Doctor panel (shared logic) ────────────────────────────────────────

interface CheckItem { label: string; status: 'pass' | 'fail' | 'warn' | 'unknown'; detail?: string }

function parseCheckLine(line: string): CheckItem | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  let status: CheckItem['status'] = 'unknown'
  if (/✓|✅|PASS|pass|OK|ok|\[ok\]|\[pass\]|success|found|installed/i.test(trimmed)) status = 'pass'
  else if (/✗|✘|❌|FAIL|fail|ERROR|error|\[error\]|\[fail\]|not found|missing|not installed/i.test(trimmed)) status = 'fail'
  else if (/⚠|WARN|warn|WARNING|warning|\[warn\]/i.test(trimmed)) status = 'warn'
  const match = trimmed.match(/^[✓✗⚠✅❌]\s*(.+)/)
  let label = trimmed
  let detail = ''
  if (match) {
    const rest = match[1]
    const colonIdx = rest.indexOf(':')
    if (colonIdx > 0) { label = rest.slice(0, colonIdx).trim(); detail = rest.slice(colonIdx + 1).trim() }
    else label = rest.trim()
  }
  return { label, status, detail }
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Gateway() {
  const { gatewayRunning, setGatewayRunning, gatewayLogs, appendGatewayLog, setGatewayLogs, clearGatewayLogs, gatewayAutoStart, setGatewayAutoStart } = useStore()
  const { run, stream } = useCLI()
  const [loading, setLoading] = useState<'start' | 'stop' | 'restart' | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [tailing, setTailing] = useState(false)
  const [waitingForBoot, setWaitingForBoot] = useState(false)
  const [fixState, setFixState] = useState<FixState>('idle')
  const [fixMsg, setFixMsg] = useState('')
  const logEndRef = useRef<HTMLDivElement>(null)
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tailAbortRef = useRef(false)

  // Doctor section state
  const [showDoctor, setShowDoctor] = useState(false)
  const [doctorRunning, setDoctorRunning] = useState(false)
  const [doctorItems, setDoctorItems] = useState<CheckItem[]>([])
  const [doctorDone, setDoctorDone] = useState(false)
  const doctorLogEndRef = useRef<HTMLDivElement>(null)

  const addLog = useCallback((text: string, type = 'info') => {
    const clean = stripAnsi(text)
    if (!clean.trim()) return
    // Detect "Gateway start blocked" error → trigger fix UI
    if (clean.includes('Gateway start blocked') && clean.includes('gateway.mode')) {
      setFixState('needed')
    }
    appendGatewayLog({ text: clean, type })
  }, [appendGatewayLog])

  const checkStatus = useCallback(async () => {
    setCheckingStatus(true)
    const running = await window.openclaw.gatewayStatus()
    setGatewayRunning(running)
    setCheckingStatus(false)
    return running
  }, [setGatewayRunning])

  useEffect(() => {
    checkStatus()
    const timer = setInterval(checkStatus, 3000)
    return () => clearInterval(timer)
  }, [checkStatus])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [gatewayLogs])

  useEffect(() => {
    return () => {
      if (monitorRef.current) clearInterval(monitorRef.current)
    }
  }, [])

  // Background monitor: keep checking port until up (max 60s)
  const startBootMonitor = useCallback(() => {
    if (monitorRef.current) clearInterval(monitorRef.current)
    setWaitingForBoot(true)
    const deadline = Date.now() + 60_000
    let dots = 0
    monitorRef.current = setInterval(async () => {
      dots = (dots + 1) % 4
      const running = await window.openclaw.gatewayStatus()
      setGatewayRunning(running)
      if (running) {
        clearInterval(monitorRef.current!)
        monitorRef.current = null
        setWaitingForBoot(false)
        setFixState('idle')
        addLog('✓ Gateway 已成功启动，端口 18789 就绪', 'success')
      } else if (Date.now() > deadline) {
        clearInterval(monitorRef.current!)
        monitorRef.current = null
        setWaitingForBoot(false)
        addLog('⚠ Gateway 60 秒内未能启动，请查看上方错误信息', 'error')
      } else {
        const current = useStore.getState().gatewayLogs
        const last = current[current.length - 1]
        if (last?.type === 'waiting') {
          setGatewayLogs([...current.slice(0, -1), { text: '⏳ 等待 Gateway 启动' + '.'.repeat(dots + 1), type: 'waiting' }])
        }
      }
    }, 2000)
  }, [setGatewayRunning, addLog, setGatewayLogs])

  // ── Auto-fix: write gateway.mode=local to config and restart ──
  const handleAutoFix = async () => {
    setFixState('fixing')
    setFixMsg('')
    addLog('— 正在自动修复：设置 gateway.mode=local —', 'cmd')
    try {
      // Read current config
      let config: Record<string, unknown> = {}
      try {
        const raw = await window.openclaw.readFile(CONFIG_PATH)
        config = JSON5.parse(raw)
      } catch {
        // Config may not exist yet
      }

      // Set gateway.mode = "local"
      const gateway = (config.gateway as Record<string, unknown>) || {}
      gateway.mode = 'local'
      config.gateway = gateway

      await window.openclaw.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2))
      addLog('✓ 已写入 gateway.mode=local 到配置文件', 'success')
      setFixState('fixed')
      setFixMsg('配置已修复，正在重新启动 Gateway...')

      // Short delay then retry start
      await new Promise(r => setTimeout(r, 800))
      await runGateway()
    } catch (err) {
      setFixState('error')
      setFixMsg('修复失败: ' + String(err))
      addLog('修复失败: ' + String(err), 'error')
    }
  }

  // Core start logic (reusable for initial start and post-fix retry)
  const runGateway = async () => {
    setLoading('start')
    setFixState(s => s === 'fixed' ? s : 'idle')
    addLog('$ openclaw gateway', 'cmd')
    try {
      await stream(['gateway'], (line, type) => {
        addLog(line, type || 'info')
      })
      const up = await window.openclaw.gatewayStatus()
      setGatewayRunning(up)
      if (up) {
        addLog('✓ Gateway 已启动运行中', 'success')
        setFixState('idle')
      } else {
        appendGatewayLog({ text: '⏳ 等待 Gateway 启动...', type: 'waiting' })
        startBootMonitor()
      }
    } catch (err) {
      addLog('启动失败: ' + String(err), 'error')
    } finally {
      setLoading(null)
    }
  }

  const handleStart = () => {
    setFixState('idle')
    runGateway()
  }

  const handleStop = async () => {
    if (monitorRef.current) { clearInterval(monitorRef.current); monitorRef.current = null }
    setWaitingForBoot(false)
    setFixState('idle')
    setLoading('stop')
    addLog('$ openclaw gateway stop', 'cmd')
    try {
      const res = await run(['gateway', 'stop'])
      if (res.stdout) addLog(res.stdout.trim(), 'info')
      if (res.stderr) addLog(res.stderr.trim(), 'stderr')
      await checkStatus()
      addLog(res.exitCode === 0 ? '✓ Gateway 已停止' : `停止命令退出码: ${res.exitCode}`,
             res.exitCode === 0 ? 'success' : 'error')
    } catch (err) {
      addLog('停止失败: ' + String(err), 'error')
    } finally {
      setLoading(null)
    }
  }

  const handleRestart = async () => {
    if (monitorRef.current) { clearInterval(monitorRef.current); monitorRef.current = null }
    setWaitingForBoot(false)
    setFixState('idle')
    setLoading('restart')
    addLog('$ openclaw gateway stop', 'cmd')
    try {
      // Step 1: stop
      await stream(['gateway', 'stop'], (line, type) => {
        addLog(line, type || 'info')
      })
      addLog('$ openclaw gateway', 'cmd')
      // Step 2: start
      await stream(['gateway'], (line, type) => {
        addLog(line, type || 'info')
      })
      const up = await window.openclaw.gatewayStatus()
      setGatewayRunning(up)
      if (up) {
        addLog('✓ Gateway 已重启运行中', 'success')
      } else {
        appendGatewayLog({ text: '⏳ 等待 Gateway 重启...', type: 'waiting' })
        startBootMonitor()
      }
    } catch (err) {
      addLog('重启失败: ' + String(err), 'error')
    } finally {
      setLoading(null)
    }
  }

  // View logs: openclaw logs (not openclaw gateway logs)
  const handleTailLogs = async () => {
    setTailing(true)
    tailAbortRef.current = false
    addLog('$ openclaw logs', 'cmd')
    try {
      await stream(['logs'], (line, type) => {
        if (tailAbortRef.current) return
        addLog(line, type || 'info')
      })
    } catch (err) {
      if (!tailAbortRef.current) addLog('日志获取失败: ' + String(err), 'error')
    } finally {
      setTailing(false)
    }
  }

  const handleStopTail = () => {
    tailAbortRef.current = true
    setTailing(false)
    addLog('— 日志流已停止 —', 'info')
  }

  const getLogColor = (type: string) => {
    switch (type) {
      case 'cmd':     return 'text-yellow-400'
      case 'success': return 'text-green-400'
      case 'error':   return 'text-red-400'
      case 'stderr':  return 'text-red-300'
      case 'waiting': return 'text-blue-400'
      default:        return 'text-green-300'
    }
  }

  const handleToggleAutoStart = async (enable: boolean) => {
    setGatewayAutoStart(enable)
    if (enable) {
      await window.openclaw.startManagedGateway().catch(() => {})
    } else {
      await window.openclaw.stopManagedGateway().catch(() => {})
    }
  }

  const runDoctor = async () => {
    setDoctorRunning(true)
    setDoctorDone(false)
    setDoctorItems([])
    try {
      await stream(['doctor'], (line) => {
        doctorLogEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        const item = parseCheckLine(line)
        if (item && item.status !== 'unknown') {
          setDoctorItems(prev => [...prev, item])
        }
      })
    } catch { /* ignore */ }
    finally { setDoctorRunning(false); setDoctorDone(true) }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Gateway</h1>
        <p className="text-[#666] text-sm mt-0.5">管理 OpenClaw HTTP Gateway (端口 18789)</p>
      </div>

      {/* Contextual tip */}
      {!gatewayRunning && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-[#1e1e1e] bg-[#0f0f0f]">
          <Zap size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-[#777] text-xs leading-relaxed">
            <span className="text-[#aaa] font-medium">Gateway 是什么？</span> 运行在本地的 HTTP 服务器。
            微信/飞书把消息发给它 → 它转给 AI → AI 回复再发回来。
            <span className="text-green-400"> 点击下方"启动"按钮即可开始。</span>
          </p>
        </div>
      )}

      {/* Status Card */}
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className={clsx(
                'w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500',
                gatewayRunning
                  ? 'bg-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.2)]'
                  : waitingForBoot
                    ? 'bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                    : 'bg-[#2a2a2a]'
              )}>
                <Zap size={24} className={
                  gatewayRunning ? 'text-green-400' :
                  waitingForBoot ? 'text-blue-400' : 'text-[#555]'
                } />
              </div>
              {gatewayRunning && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-[#1a1a1a] pulse-dot" />
              )}
              {waitingForBoot && !gatewayRunning && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-blue-400 border-2 border-[#1a1a1a] animate-pulse" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white font-semibold text-lg">Gateway</span>
                <span className={clsx(
                  'badge',
                  gatewayRunning
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : waitingForBoot
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'bg-[#2a2a2a] text-[#666] border border-[#333]'
                )}>
                  {gatewayRunning ? '运行中' : waitingForBoot ? '启动中...' : '已停止'}
                </span>
              </div>
              <p className="text-[#666] text-sm">localhost:18789 · HTTP/WebSocket</p>
              <button
                onClick={checkStatus}
                disabled={checkingStatus}
                className="flex items-center gap-1 text-xs text-[#555] hover:text-[#888] transition-colors mt-1"
              >
                <RefreshCw size={11} className={checkingStatus ? 'spinner' : ''} />
                刷新状态
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleStart}
              disabled={!!loading || gatewayRunning || waitingForBoot}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border',
                'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20',
                (loading || gatewayRunning || waitingForBoot) && 'opacity-40 cursor-not-allowed'
              )}
            >
              {loading === 'start' ? <RefreshCw size={14} className="spinner" /> : <Play size={14} />}
              启动
            </button>
            <button
              onClick={handleStop}
              disabled={!!loading || (!gatewayRunning && !waitingForBoot)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border',
                'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20',
                (loading || (!gatewayRunning && !waitingForBoot)) && 'opacity-40 cursor-not-allowed'
              )}
            >
              {loading === 'stop' ? <RefreshCw size={14} className="spinner" /> : <Square size={14} />}
              停止
            </button>
            <button
              onClick={handleRestart}
              disabled={!!loading}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border',
                'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20',
                loading && 'opacity-40 cursor-not-allowed'
              )}
            >
              {loading === 'restart' ? <RefreshCw size={14} className="spinner" /> : <RotateCw size={14} />}
              重启
            </button>
          </div>
        </div>
      </div>

      {/* ── Auto-fix Banner ── */}
      {fixState === 'needed' && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-orange-400 font-semibold text-sm">Gateway 启动被阻止</p>
              <p className="text-orange-400/70 text-xs mt-1">
                配置文件缺少 <code className="bg-orange-500/15 px-1 rounded">gateway.mode</code> 字段。
                点击下方按钮自动写入 <code className="bg-orange-500/15 px-1 rounded">gateway.mode = "local"</code> 并重新启动。
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAutoFix}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 text-sm font-medium hover:bg-orange-500/30 transition-all border border-orange-500/30"
            >
              <Wrench size={14} />
              一键修复（写入配置并重启）
            </button>
            <button
              onClick={async () => {
                setFixState('idle')
                // Temporary workaround: --allow-unconfigured
                setLoading('start')
                addLog('$ openclaw gateway --allow-unconfigured', 'cmd')
                try {
                  await stream(['gateway', '--allow-unconfigured'], (line, type) => addLog(line, type || 'info'))
                  const up = await window.openclaw.gatewayStatus()
                  setGatewayRunning(up)
                  if (up) addLog('✓ Gateway 已启动（临时模式，建议执行一键修复持久化配置）', 'success')
                  else { appendGatewayLog({ text: '⏳ 等待 Gateway...', type: 'waiting' }); startBootMonitor() }
                } catch (err) { addLog('失败: ' + String(err), 'error') }
                finally { setLoading(null) }
              }}
              disabled={!!loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a2a2a] text-[#888] text-sm hover:text-white transition-all border border-[#333] disabled:opacity-40"
            >
              临时启动（不修改配置）
            </button>
          </div>
        </div>
      )}

      {fixState === 'fixing' && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-500/20 bg-blue-500/5">
          <RefreshCw size={14} className="text-blue-400 spinner flex-shrink-0" />
          <p className="text-blue-400 text-sm">正在修复配置并重启 Gateway...</p>
        </div>
      )}

      {fixState === 'fixed' && fixMsg && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-green-500/20 bg-green-500/5">
          <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
          <p className="text-green-400 text-sm">{fixMsg}</p>
        </div>
      )}

      {fixState === 'error' && fixMsg && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5">
          <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{fixMsg}</p>
        </div>
      )}

      {/* Terminal Log */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Terminal size={15} className="text-[#666]" />
            <span className="text-sm font-semibold text-[#888] uppercase tracking-wider">输出日志</span>
            {waitingForBoot && (
              <span className="flex items-center gap-1.5 text-xs text-blue-400 animate-pulse">
                <RefreshCw size={11} className="spinner" />
                等待端口就绪...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {tailing ? (
              <button
                onClick={handleStopTail}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded border border-red-500/20 bg-red-500/5"
              >
                <StopCircle size={12} />
                停止日志
              </button>
            ) : (
              <button
                onClick={handleTailLogs}
                disabled={!!loading}
                className="flex items-center gap-1.5 text-xs text-[#888] hover:text-white transition-colors px-2 py-1 rounded border border-[#2a2a2a] bg-[#1a1a1a] disabled:opacity-40"
              >
                <FileText size={12} />
                查看 Gateway 日志
              </button>
            )}
            <button
              onClick={() => clearGatewayLogs()}
              className="text-xs text-[#555] hover:text-[#888] transition-colors"
            >
              清除
            </button>
          </div>
        </div>
        <div className="terminal rounded-lg p-4 flex-1 min-h-[300px] max-h-[500px] overflow-y-auto">
          {gatewayLogs.length === 0 ? (
            <p className="text-[#444] text-xs">等待操作... 点击上方按钮管理 Gateway</p>
          ) : (
            gatewayLogs.map((log, i) => (
              <div key={i} className={clsx('text-xs mb-0.5 font-mono break-all', getLogColor(log.type))}>
                {log.text}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* ── Auto-start Options ── */}
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {gatewayAutoStart
              ? <ToggleRight size={18} className="text-green-400" />
              : <ToggleLeft size={18} className="text-[#555]" />
            }
            <div>
              <p className="text-sm font-medium text-white">应用启动时自动运行 Gateway</p>
              <p className="text-xs text-[#555] mt-0.5">开启后每次打开 OpenClaw Control 都会自动启动 Gateway，崩溃时自动重启（最多 5 次）</p>
            </div>
          </div>
          <button
            onClick={() => handleToggleAutoStart(!gatewayAutoStart)}
            className={clsx(
              'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
              gatewayAutoStart ? 'bg-green-500/60' : 'bg-[#333]'
            )}
          >
            <span className={clsx(
              'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
              gatewayAutoStart ? 'translate-x-5' : 'translate-x-0.5'
            )} />
          </button>
        </div>
      </div>

      {/* ── Doctor Diagnostic (collapsible) ── */}
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden">
        <button
          onClick={() => setShowDoctor(v => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
        >
          {showDoctor
            ? <ChevronDown size={14} className="text-[#555]" />
            : <ChevronRight size={14} className="text-[#555]" />
          }
          <HeartPulse size={15} className="text-[#555]" />
          <span className="text-sm font-medium text-[#888]">诊断 · Doctor</span>
          <span className="text-xs text-[#444] ml-1">— OpenClaw 健康检查</span>
        </button>

        {showDoctor && (
          <div className="border-t border-[#2a2a2a] p-4 space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={runDoctor}
                disabled={doctorRunning}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-[#888] text-sm hover:text-white transition-all disabled:opacity-50"
              >
                {doctorRunning ? <RefreshCw size={13} className="spinner" /> : <Play size={13} />}
                {doctorRunning ? '检测中...' : '运行诊断'}
              </button>
              {doctorDone && doctorItems.length > 0 && (
                <span className="text-xs text-[#555]">
                  <span className="text-green-400">{doctorItems.filter(i => i.status === 'pass').length} 通过</span>
                  {doctorItems.filter(i => i.status === 'fail').length > 0 && (
                    <span className="text-red-400 ml-2">{doctorItems.filter(i => i.status === 'fail').length} 失败</span>
                  )}
                  {doctorItems.filter(i => i.status === 'warn').length > 0 && (
                    <span className="text-yellow-400 ml-2">{doctorItems.filter(i => i.status === 'warn').length} 警告</span>
                  )}
                </span>
              )}
            </div>

            {doctorItems.length > 0 && (
              <div className="space-y-1">
                {doctorItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-[#0f0f0f]">
                    {item.status === 'pass' && <CheckCircle size={13} className="text-green-400 flex-shrink-0 mt-0.5" />}
                    {item.status === 'fail' && <XCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />}
                    {item.status === 'warn' && <AlertCircle size={13} className="text-yellow-400 flex-shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <span className="text-xs text-[#ccc]">{item.label}</span>
                      {item.detail && <span className="text-xs text-[#555] ml-1.5">{item.detail}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div ref={doctorLogEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}
