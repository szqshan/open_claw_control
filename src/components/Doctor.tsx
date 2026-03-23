import { useState, useRef } from 'react'
import { HeartPulse, Play, RefreshCw, CheckCircle, XCircle, AlertCircle, Terminal } from 'lucide-react'
import { useCLI } from '../hooks/useCLI'
import { useStore } from '../store/useStore'
import clsx from 'clsx'

interface CheckItem {
  label: string
  status: 'pass' | 'fail' | 'warn' | 'unknown'
  detail?: string
}

function parseCheckLine(line: string): CheckItem | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  // Try to detect status from common patterns
  let status: CheckItem['status'] = 'unknown'
  let label = trimmed
  let detail = ''

  if (/✓|✅|PASS|pass|OK|ok|\[ok\]|\[pass\]|success|found|installed/i.test(trimmed)) {
    status = 'pass'
  } else if (/✗|✘|❌|FAIL|fail|ERROR|error|\[error\]|\[fail\]|not found|missing|not installed/i.test(trimmed)) {
    status = 'fail'
  } else if (/⚠|WARN|warn|WARNING|warning|\[warn\]/i.test(trimmed)) {
    status = 'warn'
  }

  // Try to extract label and detail from formats like "✓ Gateway: running"
  const match = trimmed.match(/^[✓✗⚠✅❌]\s*(.+)/)
  if (match) {
    const rest = match[1]
    const colonIdx = rest.indexOf(':')
    if (colonIdx > 0) {
      label = rest.slice(0, colonIdx).trim()
      detail = rest.slice(colonIdx + 1).trim()
    } else {
      label = rest.trim()
    }
  }

  return { label, status, detail }
}

export default function Doctor() {
  const { ocInstalled } = useStore()
  const { stream } = useCLI()
  const [running, setRunning] = useState(false)
  const [rawLogs, setRawLogs] = useState<string[]>([])
  const [checkItems, setCheckItems] = useState<CheckItem[]>([])
  const [done, setDone] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  const runDoctor = async () => {
    setRunning(true)
    setDone(false)
    setRawLogs([])
    setCheckItems([])

    try {
      await stream(['doctor'], (line, type) => {
        setRawLogs(prev => [...prev, line])
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' })

        const item = parseCheckLine(line)
        if (item && item.status !== 'unknown') {
          setCheckItems(prev => [...prev, item])
        }
      })
    } catch (err) {
      setRawLogs(prev => [...prev, 'Error: ' + String(err)])
    } finally {
      setRunning(false)
      setDone(true)
    }
  }

  const passCount = checkItems.filter(i => i.status === 'pass').length
  const failCount = checkItems.filter(i => i.status === 'fail').length
  const warnCount = checkItems.filter(i => i.status === 'warn').length

  const StatusIcon = ({ status }: { status: CheckItem['status'] }) => {
    switch (status) {
      case 'pass': return <CheckCircle size={15} className="text-green-400 flex-shrink-0" />
      case 'fail': return <XCircle size={15} className="text-red-400 flex-shrink-0" />
      case 'warn': return <AlertCircle size={15} className="text-yellow-400 flex-shrink-0" />
      default: return <AlertCircle size={15} className="text-[#555] flex-shrink-0" />
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Doctor</h1>
          <p className="text-[#666] text-sm mt-0.5">OpenClaw 健康检查与诊断</p>
        </div>
        <button
          onClick={runDoctor}
          disabled={running || !ocInstalled}
          className={clsx(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all border',
            'bg-green-500/15 text-green-400 border-green-500/20 hover:bg-green-500/25',
            (running || !ocInstalled) && 'opacity-50 cursor-not-allowed'
          )}
        >
          {running ? <RefreshCw size={15} className="spinner" /> : <Play size={15} />}
          {running ? '诊断中...' : '运行诊断'}
        </button>
      </div>

      {/* Summary (only when done) */}
      {done && checkItems.length > 0 && (
        <div className={clsx(
          'rounded-xl border p-5 flex items-center gap-6',
          failCount > 0
            ? 'border-red-500/20 bg-red-500/5'
            : warnCount > 0
              ? 'border-yellow-500/20 bg-yellow-500/5'
              : 'border-green-500/20 bg-green-500/5'
        )}>
          <div className={clsx(
            'w-12 h-12 rounded-full flex items-center justify-center',
            failCount > 0 ? 'bg-red-500/20' : warnCount > 0 ? 'bg-yellow-500/20' : 'bg-green-500/20'
          )}>
            <HeartPulse size={22} className={failCount > 0 ? 'text-red-400' : warnCount > 0 ? 'text-yellow-400' : 'text-green-400'} />
          </div>
          <div>
            <p className={clsx(
              'font-semibold text-base',
              failCount > 0 ? 'text-red-400' : warnCount > 0 ? 'text-yellow-400' : 'text-green-400'
            )}>
              {failCount > 0 ? '发现问题需要修复' : warnCount > 0 ? '存在警告项' : '一切正常！'}
            </p>
            <p className="text-[#666] text-sm mt-0.5">
              检查完成: {passCount} 通过 · {failCount} 失败 · {warnCount} 警告
            </p>
          </div>
          <div className="ml-auto flex gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{passCount}</div>
              <div className="text-xs text-[#666]">通过</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">{failCount}</div>
              <div className="text-xs text-[#666]">失败</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{warnCount}</div>
              <div className="text-xs text-[#666]">警告</div>
            </div>
          </div>
        </div>
      )}

      {/* Parsed check items */}
      {checkItems.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[#888] uppercase tracking-wider mb-3">检查项目</h2>
          <div className="space-y-2">
            {checkItems.map((item, i) => (
              <div
                key={i}
                className={clsx(
                  'flex items-start gap-3 rounded-xl border px-4 py-3 transition-all',
                  item.status === 'pass' && 'border-green-500/10 bg-green-500/5',
                  item.status === 'fail' && 'border-red-500/15 bg-red-500/5',
                  item.status === 'warn' && 'border-yellow-500/15 bg-yellow-500/5',
                  item.status === 'unknown' && 'border-[#2a2a2a] bg-[#1a1a1a]',
                )}
              >
                <StatusIcon status={item.status} />
                <div className="flex-1 min-w-0">
                  <p className={clsx(
                    'text-sm font-medium',
                    item.status === 'pass' && 'text-green-300',
                    item.status === 'fail' && 'text-red-300',
                    item.status === 'warn' && 'text-yellow-300',
                    item.status === 'unknown' && 'text-[#aaa]',
                  )}>
                    {item.label}
                  </p>
                  {item.detail && (
                    <p className="text-[#666] text-xs mt-0.5">{item.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw terminal output */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-[#666]" />
            <span className="text-sm font-semibold text-[#888] uppercase tracking-wider">原始输出</span>
          </div>
          {rawLogs.length > 0 && (
            <button
              onClick={() => { setRawLogs([]); setCheckItems([]); setDone(false) }}
              className="text-xs text-[#555] hover:text-[#888] transition-colors"
            >
              清除
            </button>
          )}
        </div>
        <div className="terminal rounded-lg p-4 min-h-[200px] max-h-[350px] overflow-y-auto">
          {rawLogs.length === 0 ? (
            <p className="text-[#444] text-xs">
              {running ? '正在运行诊断...' : '点击"运行诊断"开始检查'}
            </p>
          ) : (
            rawLogs.map((log, i) => (
              <div key={i} className="text-xs mb-0.5 leading-5 font-mono">
                {log}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* Idle hint */}
      {!running && !done && (
        <div className="text-center py-8">
          <HeartPulse size={48} className="text-[#333] mx-auto mb-4" />
          <p className="text-[#666] font-medium">运行诊断检查 OpenClaw 运行状态</p>
          <p className="text-[#444] text-sm mt-1">检测安装状态、Gateway 连接、Agent 配置等</p>
        </div>
      )}
    </div>
  )
}
