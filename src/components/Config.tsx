import { useEffect, useState } from 'react'
import {
  Settings, Save, RefreshCw, AlertTriangle, CheckCircle, FileText,
  ChevronRight, ChevronDown, List, Code2
} from 'lucide-react'
import JSON5 from 'json5'
import { useStore } from '../store/useStore'
import clsx from 'clsx'

const CONFIG_PATH = '~/.openclaw/openclaw.json'

// ─── JSON Tree View ──────────────────────────────────────────────────────────

type JsonValue = string | number | boolean | null | JsonObject | JsonArray
interface JsonObject { [key: string]: JsonValue }
type JsonArray = JsonValue[]

function ValueBadge({ val }: { val: JsonValue }) {
  if (val === null) return <span className="text-[#666] text-xs font-mono italic">null</span>
  if (typeof val === 'boolean') return <span className="text-orange-400 text-xs font-mono">{String(val)}</span>
  if (typeof val === 'number') return <span className="text-cyan-400 text-xs font-mono">{val}</span>
  if (typeof val === 'string') {
    const display = val.length > 60 ? val.slice(0, 60) + '…' : val
    return <span className="text-green-400 text-xs font-mono truncate max-w-xs">"{display}"</span>
  }
  return null
}

function JsonNode({ nodeKey, val, depth = 0, isLast = false }: {
  nodeKey?: string; val: JsonValue; depth?: number; isLast?: boolean
}) {
  const isExpandable = val !== null && typeof val === 'object'
  const [open, setOpen] = useState(depth < 2)

  const isArray = Array.isArray(val)
  const entries = isExpandable
    ? isArray
      ? (val as JsonArray).map((v, i) => [String(i), v] as [string, JsonValue])
      : Object.entries(val as JsonObject)
    : []
  const count = entries.length
  const INDENT = 20

  // Leaf value row
  if (!isExpandable) {
    return (
      <div
        className="flex items-center gap-2 px-2 py-[3px] rounded hover:bg-white/[0.03] group"
        style={{ paddingLeft: depth * INDENT + 8 }}
      >
        {/* Connector dot */}
        <span className="w-2 h-2 rounded-full border border-[#333] flex-shrink-0 group-hover:border-[#555]" />
        {nodeKey !== undefined && (
          <span className="text-[#7cb8ff] text-[13px] font-mono flex-shrink-0">{nodeKey}</span>
        )}
        {nodeKey !== undefined && <span className="text-[#444] text-xs flex-shrink-0">:</span>}
        <ValueBadge val={val} />
      </div>
    )
  }

  // Empty object/array
  if (count === 0) {
    return (
      <div
        className="flex items-center gap-2 px-2 py-[3px] rounded"
        style={{ paddingLeft: depth * INDENT + 8 }}
      >
        <span className="w-2 h-2 rounded-full border border-[#333] flex-shrink-0" />
        {nodeKey !== undefined && (
          <span className="text-[#7cb8ff] text-[13px] font-mono">{nodeKey}</span>
        )}
        {nodeKey !== undefined && <span className="text-[#444] text-xs">:</span>}
        <span className="text-[#555] text-xs font-mono">{isArray ? '[ ]' : '{ }'}</span>
      </div>
    )
  }

  // Expandable object/array
  return (
    <div>
      {/* Header row — click to expand/collapse */}
      <button
        onClick={() => setOpen(v => !v)}
        className={clsx(
          'flex items-center gap-2 w-full text-left px-2 py-[3px] rounded transition-colors',
          'hover:bg-white/[0.06] active:bg-white/[0.09]'
        )}
        style={{ paddingLeft: depth * INDENT + 4 }}
      >
        {/* Chevron */}
        <span className={clsx(
          'w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors',
          open ? 'text-[#aaa]' : 'text-[#666] hover:text-[#aaa]'
        )}>
          {open
            ? <ChevronDown size={14} strokeWidth={2.5} />
            : <ChevronRight size={14} strokeWidth={2.5} />}
        </span>

        {nodeKey !== undefined && (
          <span className="text-[#7cb8ff] text-[13px] font-mono font-semibold">{nodeKey}</span>
        )}
        {nodeKey !== undefined && <span className="text-[#444] text-xs">:</span>}

        {/* Inline summary when collapsed */}
        {open ? (
          <span className="text-[#555] text-xs font-mono">{isArray ? '[' : '{'}</span>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="text-[#555] text-xs font-mono">{isArray ? '[' : '{'}</span>
            <span className="text-[#555] text-[11px] italic">
              {isArray ? `${count} 项` : `${count} 个字段`}
            </span>
            <span className="text-[#555] text-xs font-mono">{isArray ? ']' : '}'}</span>
          </span>
        )}
      </button>

      {/* Children */}
      {open && (
        <div className="relative" style={{ marginLeft: depth * INDENT + 14 }}>
          {/* Vertical guide line */}
          <div className="absolute left-[3px] top-0 bottom-0 w-px bg-[#2a2a2a]" />
          <div className="ml-4">
            {entries.map(([ek, ev], idx) => (
              <JsonNode
                key={ek}
                nodeKey={isArray ? undefined : ek}
                val={ev}
                depth={depth + 1}
                isLast={idx === entries.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* Closing bracket */}
      {open && (
        <div
          className="text-[#555] text-xs font-mono px-2 py-[2px]"
          style={{ paddingLeft: depth * INDENT + 24 }}
        >
          {isArray ? ']' : '}'}
        </div>
      )}
    </div>
  )
}

function JsonTree({ content }: { content: string }) {
  const [parsed, setParsed] = useState<JsonValue | null>(null)
  const [parseErr, setParseErr] = useState('')

  useEffect(() => {
    if (!content.trim()) { setParsed(null); setParseErr(''); return }
    try {
      setParsed(JSON5.parse(content))
      setParseErr('')
    } catch (e) {
      setParsed(null)
      setParseErr('解析失败: ' + String(e))
    }
  }, [content])

  if (parseErr) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-red-400 text-xs">
        <AlertTriangle size={12} />
        {parseErr}（请切换到编辑器视图修复）
      </div>
    )
  }
  if (!parsed) {
    return <div className="text-[#555] text-xs px-3 py-2">配置文件为空</div>
  }

  return (
    <div className="px-3 py-2 overflow-auto h-full">
      <JsonNode val={parsed} depth={0} />
    </div>
  )
}

// ─── Main Config Component ───────────────────────────────────────────────────

export default function Config() {
  const { ocInstalled } = useStore()
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [viewMode, setViewMode] = useState<'editor' | 'tree'>('editor')
  const [needsRestart, setNeedsRestart] = useState(false)
  const [restarting, setRestarting] = useState(false)

  const loadConfig = async () => {
    setLoading(true)
    setError('')
    setSaveMsg('')
    try {
      const data = await window.openclaw.readFile(CONFIG_PATH)
      setContent(data)
      setOriginalContent(data)
      setIsDirty(false)
    } catch (err) {
      const msg = String(err)
      if (msg.includes('ENOENT') || msg.includes('no such file')) {
        setError('配置文件不存在。请先运行 openclaw onboard 初始化配置。')
        setContent('')
      } else {
        setError('读取配置失败: ' + msg)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (ocInstalled) loadConfig()
  }, [ocInstalled])

  const handleChange = (val: string) => {
    setContent(val)
    setIsDirty(val !== originalContent)
    setSaveMsg('')
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaveMsg('')
    try {
      // Validate with JSON5 before saving
      if (content.trim()) {
        try { JSON5.parse(content) } catch { /* JSON5 may be valid even if this fails, proceed */ }
      }
      await window.openclaw.writeFile(CONFIG_PATH, content)
      setOriginalContent(content)
      setIsDirty(false)
      setSaveMsg('保存成功！配置已更新。')
      setTimeout(() => setSaveMsg(''), 3000)
      // Check if gateway is running — needs restart to pick up new config
      const gwRunning = await window.openclaw.gatewayStatus()
      setNeedsRestart(gwRunning)
    } catch (err) {
      setError('保存失败: ' + String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleRestartGateway = async () => {
    setRestarting(true)
    try {
      await window.openclaw.runCLI(['gateway', 'stop'])
      await window.openclaw.runCLI(['gateway'])
      setNeedsRestart(false)
    } catch {
      // ignore
    } finally {
      setRestarting(false)
    }
  }

  const handleReset = () => {
    setContent(originalContent)
    setIsDirty(false)
    setSaveMsg('')
    setError('')
  }

  const lineCount = content.split('\n').length

  return (
    <div className="flex flex-col h-full p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Config</h1>
          <p className="text-[#666] text-sm mt-0.5">编辑 OpenClaw 配置文件</p>
        </div>
        <div className="flex gap-2 items-center">
          {/* View mode toggle */}
          <div className="flex rounded-lg border border-[#2a2a2a] overflow-hidden">
            <button
              onClick={() => setViewMode('editor')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs transition-all',
                viewMode === 'editor'
                  ? 'bg-[#2a2a2a] text-white'
                  : 'text-[#666] hover:text-[#aaa]'
              )}
            >
              <Code2 size={12} />
              编辑器
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs transition-all',
                viewMode === 'tree'
                  ? 'bg-[#2a2a2a] text-white'
                  : 'text-[#666] hover:text-[#aaa]'
              )}
            >
              <List size={12} />
              树状视图
            </button>
          </div>

          <button
            onClick={loadConfig}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] text-sm hover:text-white hover:border-[#3a3a3a] transition-all"
          >
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            重载
          </button>
          {isDirty && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] text-sm hover:text-white transition-all"
            >
              撤销修改
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !isDirty || !content.trim()}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border',
              isDirty
                ? 'bg-orange-500/20 text-orange-400 border-orange-500/20 hover:bg-orange-500/30'
                : 'bg-[#1a1a1a] text-[#555] border-[#2a2a2a] cursor-not-allowed',
              saving && 'opacity-60'
            )}
          >
            {saving ? <RefreshCw size={14} className="spinner" /> : <Save size={14} />}
            保存
          </button>
        </div>
      </div>

      {/* File path info */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#141414] border border-[#222]">
        <FileText size={13} className="text-[#555]" />
        <code className="text-[#888] text-xs font-mono">{CONFIG_PATH}</code>
        <span className="ml-auto text-[#444] text-xs">{lineCount} 行 · JSON5 格式</span>
      </div>

      {/* Warning notice */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
        <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
        <p className="text-yellow-400/80 text-xs leading-relaxed">
          修改配置后需要<strong>重启 Gateway</strong> 才能生效。文件使用 <strong>JSON5 格式</strong>（支持注释和尾随逗号）。
          请谨慎修改，错误的配置可能导致 OpenClaw 无法启动。
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5">
          <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Save success */}
      {saveMsg && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-green-500/20 bg-green-500/5">
          <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
          <p className="text-green-400 text-sm">{saveMsg}</p>
        </div>
      )}

      {/* Gateway restart warning */}
      {needsRestart && (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-orange-500/10 border border-orange-500/30">
          <AlertTriangle size={14} className="text-orange-400 flex-shrink-0" />
          <p className="text-orange-300 text-xs flex-1">Gateway 正在运行，需要重启才能使新配置生效</p>
          <button
            onClick={handleRestartGateway}
            disabled={restarting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 text-xs font-medium hover:bg-orange-500/30 transition-all border border-orange-500/30 disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw size={12} className={restarting ? 'spinner' : ''} />
            {restarting ? '重启中...' : '立即重启 Gateway'}
          </button>
        </div>
      )}

      {/* Editor / Tree view */}
      {loading ? (
        <div className="flex items-center justify-center flex-1 text-[#555]">
          <RefreshCw size={20} className="spinner mr-3" />
          加载配置...
        </div>
      ) : viewMode === 'tree' ? (
        <div className="flex-1 min-h-0 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] overflow-auto">
          {content.trim() ? (
            <JsonTree content={content} />
          ) : (
            <div className="flex items-center justify-center h-full text-[#555] text-sm">
              暂无配置内容
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="relative flex-1 min-h-0">
            {/* Line numbers */}
            <div className="absolute left-0 top-0 bottom-0 w-12 rounded-tl-lg rounded-bl-lg bg-[#0a0a0a] border border-[#2a2a2a] border-r-0 overflow-hidden pointer-events-none z-10">
              <div className="p-3 pt-3 text-right">
                {content.split('\n').map((_, i) => (
                  <div key={i} className="text-[#444] text-xs font-mono leading-[1.6] select-none">
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>
            <textarea
              value={content}
              onChange={e => handleChange(e.target.value)}
              spellCheck={false}
              className={clsx(
                'code-textarea h-full min-h-[400px] pl-16 rounded-lg',
                isDirty && 'border-orange-500/30'
              )}
              placeholder="// OpenClaw 配置文件 (JSON5格式)\n// 请先运行 openclaw onboard 初始化"
              style={{ resize: 'none' }}
            />
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between mt-2 px-2">
            <div className="flex items-center gap-3">
              {isDirty ? (
                <span className="text-xs text-orange-400/80 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                  有未保存的修改
                </span>
              ) : (
                <span className="text-xs text-[#555]">已保存</span>
              )}
            </div>
            <span className="text-xs text-[#444] font-mono">
              {content.length} 字节
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
