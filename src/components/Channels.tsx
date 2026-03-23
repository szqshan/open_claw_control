import { useEffect, useState, useCallback } from 'react'
import {
  Search, RefreshCw, X, Plus, Trash2, MessageSquare, Check,
} from 'lucide-react'
import { useCLI } from '../hooks/useCLI'
import clsx from 'clsx'

// ── Connector catalog ─────────────────────────────────────────────────────────

interface ConnectorDef {
  id: string
  name: string
  description: string
  icon: string        // emoji
  iconBg: string      // tailwind bg class
  cliType: string     // value passed to --type
}

const CONNECTORS: ConnectorDef[] = [
  {
    id: 'wechat',
    name: 'WeChat',
    description: '扫描二维码连接微信账号，支持私信与群聊智能回复。',
    icon: '💬',
    iconBg: 'bg-green-500',
    cliType: 'wechat',
  },
  {
    id: 'feishu',
    name: 'Feishu',
    description: '接入飞书 / Lark 企业应用，支持群消息与私信自动化。',
    icon: '🐦',
    iconBg: 'bg-blue-500',
    cliType: 'feishu',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: '快速接入 Telegram 官方 Bot，实现全球即时通讯覆盖。',
    icon: '✈️',
    iconBg: 'bg-sky-500',
    cliType: 'telegram',
  },
  {
    id: 'discord',
    name: 'Discord',
    description: '创建 Discord 社区 Bot，为服务器成员提供 AI 智能服务。',
    icon: '🎮',
    iconBg: 'bg-indigo-500',
    cliType: 'discord',
  },
  {
    id: 'dingtalk',
    name: 'DingTalk',
    description: '通过钉钉 Stream 模式接入企业 Bot，支持群聊与单聊。',
    icon: '📎',
    iconBg: 'bg-orange-500',
    cliType: 'dingtalk',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Socket Mode 接入 Slack，实现频道与私信实时自动互动。',
    icon: '⚡',
    iconBg: 'bg-purple-600',
    cliType: 'slack',
  },
  {
    id: 'qq',
    name: 'QQ',
    description: '接入 QQ 官方机器人，覆盖群聊、频道与私信场景。',
    icon: '🐧',
    iconBg: 'bg-cyan-500',
    cliType: 'qq',
  },
  {
    id: 'webhook',
    name: 'Webhook',
    description: '启动 HTTP Webhook 服务器，接收任意外部系统的消息推送。',
    icon: '🔗',
    iconBg: 'bg-violet-600',
    cliType: 'webhook',
  },
]

// ── Connected channel data ────────────────────────────────────────────────────

interface ConnectedChannel {
  name: string
  type: string
  status?: string
}

function parseChannels(output: string): ConnectedChannel[] {
  try {
    const parsed = JSON.parse(output)
    if (Array.isArray(parsed)) {
      return parsed.map((c: Record<string, unknown>) => ({
        name: String(c.name || ''),
        type: String(c.type || 'unknown'),
        status: String(c.status || ''),
      }))
    }
  } catch { /* fall through */ }
  const results: ConnectedChannel[] = []
  const lines = output.trim().split('\n').filter(l => l.trim())
  for (const line of lines) {
    if (line.startsWith('NAME') || line.startsWith('---') || line.startsWith('=')) continue
    const parts = line.split(/\s{2,}/).filter(p => p.trim())
    if (parts.length >= 1 && /^[\w\-]+$/.test(parts[0])) {
      results.push({
        name: parts[0].trim(),
        type: parts[1]?.trim() || 'unknown',
        status: parts[2]?.trim() || '',
      })
    }
  }
  return results
}

// ── Connect Modal ─────────────────────────────────────────────────────────────

interface ConnectModalProps {
  connector: ConnectorDef
  onClose: () => void
  onSuccess: () => void
}

function ConnectModal({ connector, onClose, onSuccess }: ConnectModalProps) {
  const { run, stream } = useCLI()

  const [name, setName]           = useState(`my-${connector.cliType}`)
  const [appId, setAppId]         = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [token, setToken]         = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [port, setPort]           = useState('8080')

  // WeChat QR stream
  const [qrOutput, setQrOutput]   = useState<string[]>([])
  const [qrRunning, setQrRunning] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')
  const [ok, setOk]                 = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleWechat = async () => {
    if (qrRunning) return
    setQrRunning(true)
    setQrOutput([])
    try {
      await stream(['channels', 'add', '--type', 'wechat', '--name', name],
        (line) => setQrOutput(prev => [...prev, line]))
      setOk(true)
      setTimeout(() => { onSuccess(); onClose() }, 1000)
    } finally {
      setQrRunning(false)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    let args: string[] = []
    switch (connector.cliType) {
      case 'feishu':
        args = ['channels', 'add', '--type', 'feishu', '--name', name, '--app-id', appId, '--app-secret', appSecret]
        break
      case 'telegram':
        args = ['channels', 'add', '--type', 'telegram', '--name', name, '--token', token]
        break
      case 'discord':
        args = ['channels', 'add', '--type', 'discord', '--name', name, '--token', token]
        break
      case 'dingtalk':
        args = ['channels', 'add', '--type', 'dingtalk', '--name', name, '--webhook', webhookUrl]
        break
      case 'webhook':
        args = ['channels', 'add', '--type', 'webhook', '--name', name, '--port', port]
        break
      default:
        args = ['channels', 'add', '--type', connector.cliType, '--name', name]
    }
    try {
      const res = await run(args)
      if (res.exitCode === 0) {
        setOk(true)
        setTimeout(() => { onSuccess(); onClose() }, 800)
      } else {
        setError(res.stderr || res.stdout || '连接失败')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const inp = 'w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#555] focus:outline-none focus:border-orange-500/40 transition-colors'
  const lbl = 'block text-xs text-[#888] mb-1'

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-lg', connector.iconBg)}>
              {connector.icon}
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Connect {connector.name}</h3>
              <p className="text-[#555] text-xs">配置并连接</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">

          {/* Channel name — always shown */}
          <div>
            <label className={lbl}>渠道名称</label>
            <input className={inp} value={name}
              onChange={e => setName(e.target.value)}
              placeholder={`my-${connector.cliType}`} />
          </div>

          {/* WeChat */}
          {connector.cliType === 'wechat' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-sm text-green-300">
                微信需要扫码登录。点击下方按钮，终端输出 ASCII 二维码后用微信扫描即可。
              </div>
              <button onClick={handleWechat} disabled={qrRunning || ok}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  'bg-green-500/15 border border-green-500/25 text-green-400 hover:bg-green-500/25 disabled:opacity-50'
                )}>
                {qrRunning ? <><RefreshCw size={13} className="animate-spin" />扫码中...</> :
                  ok ? <><Check size={13} />已连接!</> :
                  <><MessageSquare size={13} />开始扫码连接</>}
              </button>
              {qrOutput.length > 0 && (
                <div className="rounded-lg bg-black border border-[#2a2a2a] p-3 font-mono text-xs text-green-400 max-h-48 overflow-y-auto whitespace-pre">
                  {qrOutput.join('\n')}
                </div>
              )}
            </div>
          )}

          {/* Feishu */}
          {connector.cliType === 'feishu' && (
            <>
              <div>
                <label className={lbl}>App ID</label>
                <input className={inp} value={appId}
                  onChange={e => setAppId(e.target.value)} placeholder="cli_xxxxxxxx" />
              </div>
              <div>
                <label className={lbl}>App Secret</label>
                <input className={inp} type="password" value={appSecret}
                  onChange={e => setAppSecret(e.target.value)} placeholder="••••••••••••••••" />
              </div>
            </>
          )}

          {/* Telegram / Discord */}
          {(connector.cliType === 'telegram' || connector.cliType === 'discord') && (
            <div>
              <label className={lbl}>Bot Token</label>
              <input className={inp} type="password" value={token}
                onChange={e => setToken(e.target.value)}
                placeholder={connector.cliType === 'telegram' ? '123456:ABCdef...' : 'MTA0NTQ...'} />
            </div>
          )}

          {/* DingTalk */}
          {connector.cliType === 'dingtalk' && (
            <div>
              <label className={lbl}>Webhook URL</label>
              <input className={inp} value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." />
            </div>
          )}

          {/* Webhook */}
          {connector.cliType === 'webhook' && (
            <div>
              <label className={lbl}>监听端口</label>
              <input className={inp} type="number" value={port}
                onChange={e => setPort(e.target.value)} min={1} max={65535} />
            </div>
          )}

          {/* Slack / QQ / others — just name */}
          {(connector.cliType === 'slack' || connector.cliType === 'qq') && (
            <div className="rounded-lg border border-[#2a2a2a] bg-[#111] p-3 text-xs text-[#666]">
              将执行：<code className="text-orange-400">openclaw channels add --type {connector.cliType} --name {name || `my-${connector.cliType}`}</code>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">{error}</div>
          )}
          {ok && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-sm text-green-400 flex items-center gap-2">
              <Check size={14} /> 连接成功！
            </div>
          )}
        </div>

        {/* Footer — non-wechat only */}
        {connector.cliType !== 'wechat' && (
          <div className="px-5 py-4 border-t border-[#2a2a2a] flex justify-end gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#222] text-[#888] text-sm hover:bg-[#2a2a2a] transition-all">
              取消
            </button>
            <button onClick={handleSubmit} disabled={submitting || ok}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/15 border border-orange-500/25 text-orange-400 text-sm hover:bg-orange-500/25 transition-all disabled:opacity-50">
              {submitting ? <><RefreshCw size={13} className="animate-spin" />连接中...</> :
                ok ? <><Check size={13} />已连接</> :
                <><Plus size={13} />连接</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Disconnect Modal ──────────────────────────────────────────────────────────

interface DisconnectModalProps {
  channelName: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function DisconnectModal({ channelName, onConfirm, onCancel, loading }: DisconnectModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-white font-semibold mb-2">断开连接</h3>
        <p className="text-[#888] text-sm">
          确定要断开渠道 <span className="text-white font-mono">{channelName}</span> 吗？
        </p>
        <div className="flex gap-2 mt-5">
          <button onClick={onConfirm} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/15 text-red-400 text-sm border border-red-500/25 hover:bg-red-500/25 transition-all disabled:opacity-50">
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
            断开
          </button>
          <button onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-[#222] text-[#888] text-sm hover:bg-[#2a2a2a] transition-all">
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Connector Card ────────────────────────────────────────────────────────────

interface ConnectorCardProps {
  def: ConnectorDef
  connectedAs?: ConnectedChannel
  onConnect: () => void
  onDisconnect: () => void
}

function ConnectorCard({ def, connectedAs, onConnect, onDisconnect }: ConnectorCardProps) {
  const connected = !!connectedAs
  const isOnline = connected && (
    (connectedAs?.status || '').toLowerCase().includes('active') ||
    (connectedAs?.status || '').toLowerCase().includes('online') ||
    (connectedAs?.status || '').toLowerCase().includes('connected')
  )

  return (
    <div className={clsx(
      'relative flex flex-col rounded-xl border bg-[#1a1a1a] transition-all duration-200',
      connected
        ? 'border-[#3a3a3a] hover:border-[#444]'
        : 'border-[#2a2a2a] hover:border-[#333]'
    )}>
      {/* Connected badge */}
      {connected && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className={clsx(
            'h-2 w-2 rounded-full',
            isOnline ? 'bg-green-400' : 'bg-[#555]'
          )} />
          <span className={clsx(
            'text-xs font-medium',
            isOnline ? 'text-green-400' : 'text-[#666]'
          )}>
            {isOnline ? 'Connected' : connectedAs?.status || 'Configured'}
          </span>
        </div>
      )}

      {/* Card body */}
      <div className="p-5 flex flex-col flex-1">
        {/* Icon */}
        <div className={clsx(
          'w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 flex-shrink-0',
          def.iconBg + '/20'
        )}>
          {def.icon}
        </div>

        {/* Name */}
        <h3 className="text-white font-semibold text-base leading-tight mb-1.5">{def.name}</h3>

        {/* Description */}
        <p className="text-[#888] text-xs leading-relaxed flex-1">{def.description}</p>

        {/* Channel name (if connected) */}
        {connected && (
          <div className="mt-3 text-xs text-[#555] font-mono truncate">
            {connectedAs?.name}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-5 pb-4">
        <div className="border-t border-[#222] pt-3 flex items-center gap-2">
          {connected ? (
            <>
              <button
                onClick={onConnect}
                className="flex-1 text-center text-xs px-3 py-1.5 rounded-lg border border-[#333] text-[#888] hover:border-orange-500/40 hover:text-orange-400 transition-all"
              >
                Edit
              </button>
              <button
                onClick={onDisconnect}
                className="flex-1 text-center text-xs px-3 py-1.5 rounded-lg border border-[#333] text-[#888] hover:border-red-500/40 hover:text-red-400 transition-all"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={onConnect}
              className="flex-1 text-center text-xs px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-[#888] hover:border-orange-500/50 hover:text-orange-400 hover:bg-orange-500/5 transition-all"
            >
              Connect
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Channels() {
  const { run } = useCLI()

  const [channels, setChannels]       = useState<ConnectedChannel[]>([])
  const [loading, setLoading]         = useState(false)
  const [search, setSearch]           = useState('')
  const [connectTarget, setConnectTarget] = useState<ConnectorDef | null>(null)
  const [disconnectTarget, setDisconnectTarget] = useState<ConnectedChannel | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  const loadChannels = useCallback(async () => {
    setLoading(true)
    try {
      const res = await run(['channels', 'list'])
      setChannels(res.exitCode === 0 ? parseChannels(res.stdout) : [])
    } catch {
      setChannels([])
    } finally {
      setLoading(false)
    }
  }, [run])

  useEffect(() => { loadChannels() }, [loadChannels])

  const handleDisconnect = async () => {
    if (!disconnectTarget) return
    setDisconnecting(true)
    try {
      await run(['channels', 'delete', disconnectTarget.name])
      setDisconnectTarget(null)
      await loadChannels()
    } catch {
      // ignore
    } finally {
      setDisconnecting(false)
    }
  }

  // Match connected channels to connector definitions by type
  const getConnected = (def: ConnectorDef) =>
    channels.find(ch => ch.type.toLowerCase() === def.cliType.toLowerCase())

  const filtered = CONNECTORS.filter(def =>
    !search ||
    def.name.toLowerCase().includes(search.toLowerCase()) ||
    def.description.includes(search)
  )

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0f0f0f' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e1e] flex-shrink-0">
        <h1 className="text-lg font-bold text-white">Connectors</h1>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Connectors"
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#3a3a3a] w-52 transition-colors"
            />
          </div>
          {/* Refresh */}
          <button
            onClick={loadChannels}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] text-sm hover:text-white hover:border-[#3a3a3a] transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-4">
          {filtered.map(def => (
            <ConnectorCard
              key={def.id}
              def={def}
              connectedAs={getConnected(def)}
              onConnect={() => setConnectTarget(def)}
              onDisconnect={() => {
                const ch = getConnected(def)
                if (ch) setDisconnectTarget(ch)
              }}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-[#555]">
            <p className="text-sm">No connectors match "{search}"</p>
          </div>
        )}
      </div>

      {/* Connect Modal */}
      {connectTarget && (
        <ConnectModal
          connector={connectTarget}
          onClose={() => setConnectTarget(null)}
          onSuccess={() => { loadChannels(); setConnectTarget(null) }}
        />
      )}

      {/* Disconnect Modal */}
      {disconnectTarget && (
        <DisconnectModal
          channelName={disconnectTarget.name}
          onConfirm={handleDisconnect}
          onCancel={() => setDisconnectTarget(null)}
          loading={disconnecting}
        />
      )}
    </div>
  )
}
