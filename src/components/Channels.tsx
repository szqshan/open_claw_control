import { useEffect, useState } from 'react'
import { Radio, Plus, Trash2, RefreshCw, X, Terminal, Info } from 'lucide-react'
import { useCLI } from '../hooks/useCLI'
import { useStore } from '../store/useStore'
import clsx from 'clsx'

interface Channel {
  name: string
  type: string
  status?: string
}

const CHANNEL_TYPE_COLORS: Record<string, string> = {
  telegram: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  slack: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
  discord: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/20',
  feishu: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
  lark: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
  wechat: 'bg-green-500/15 text-green-300 border-green-500/20',
  dingtalk: 'bg-orange-500/15 text-orange-300 border-orange-500/20',
  webhook: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
  http: 'bg-gray-500/15 text-gray-300 border-gray-500/20',
}

const getTypeStyle = (type: string) => {
  const key = type.toLowerCase()
  return CHANNEL_TYPE_COLORS[key] || 'bg-[#2a2a2a] text-[#888] border-[#333]'
}

const CHANNEL_SETUP_GUIDE = `# 添加频道指南

## Telegram
\`\`\`
openclaw channels add --type telegram --name my-tg --token <BOT_TOKEN>
\`\`\`

## Slack
\`\`\`
openclaw channels add --type slack --name my-slack --token <SLACK_TOKEN>
\`\`\`

## Discord
\`\`\`
openclaw channels add --type discord --name my-discord --token <DISCORD_TOKEN>
\`\`\`

## 飞书 (Feishu/Lark)
\`\`\`
openclaw channels add --type feishu --name my-feishu --app-id <APP_ID> --app-secret <SECRET>
\`\`\`

## WebHook
\`\`\`
openclaw channels add --type webhook --name my-webhook --port 8080
\`\`\`

配置完成后运行:
  openclaw channels list
查看所有已配置的频道。`

export default function Channels() {
  const { ocInstalled } = useStore()
  const { run } = useCLI()
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  const [deleteChannel, setDeleteChannel] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const parseChannels = (output: string): Channel[] => {
    const results: Channel[] = []
    // Try JSON first
    try {
      const parsed = JSON.parse(output)
      if (Array.isArray(parsed)) {
        return parsed.map((c: Record<string, unknown>) => ({
          name: String(c.name || ''),
          type: String(c.type || 'unknown'),
          status: String(c.status || '')
        }))
      }
    } catch {
      // text parse
    }

    const lines = output.trim().split('\n').filter(l => l.trim())
    for (const line of lines) {
      if (line.startsWith('NAME') || line.startsWith('---') || line.startsWith('=')) continue
      const parts = line.split(/\s{2,}/).filter(p => p.trim())
      if (parts.length >= 1) {
        results.push({
          name: parts[0].trim(),
          type: parts[1]?.trim() || 'unknown',
          status: parts[2]?.trim() || ''
        })
      }
    }
    return results
  }

  const loadChannels = async () => {
    if (!ocInstalled) return
    setLoading(true)
    setError('')
    try {
      const res = await run(['channels', 'list'])
      if (res.exitCode === 0) {
        setChannels(parseChannels(res.stdout))
      } else {
        setError(res.stderr || res.stdout || '获取频道列表失败')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadChannels() }, [ocInstalled])

  const handleDelete = async () => {
    if (!deleteChannel) return
    setDeleteLoading(true)
    try {
      const res = await run(['channels', 'remove', deleteChannel])
      if (res.exitCode === 0) {
        setDeleteChannel(null)
        await loadChannels()
      }
    } catch {
      // ignore
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Channels</h1>
          <p className="text-[#666] text-sm mt-0.5">管理消息频道连接</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadChannels}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] text-sm hover:text-white hover:border-[#3a3a3a] transition-all"
          >
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            刷新
          </button>
          <button
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/15 border border-orange-500/20 text-orange-400 text-sm hover:bg-orange-500/25 transition-all"
          >
            <Plus size={14} />
            添加频道
          </button>
        </div>
      </div>

      {/* Channel type legend */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-[#555]">支持的频道类型:</span>
        {['Telegram', 'Slack', 'Discord', '飞书', 'WeChat', 'DingTalk', 'WebHook'].map(type => (
          <span key={type} className={clsx('badge border', getTypeStyle(type.toLowerCase()))}>
            {type}
          </span>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Channels list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-[#555]">
          <RefreshCw size={20} className="spinner mr-3" />
          加载中...
        </div>
      ) : channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Radio size={48} className="text-[#333] mb-4" />
          <p className="text-[#666] font-medium">暂无频道</p>
          <p className="text-[#444] text-sm mt-1 mb-4">点击"添加频道"查看配置指南</p>
          <button
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/15 border border-orange-500/20 text-orange-400 text-sm hover:bg-orange-500/25 transition-all"
          >
            <Info size={14} />
            查看配置指南
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-[#2a2a2a] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a2a] bg-[#141414]">
                <th className="text-left text-xs text-[#666] font-medium uppercase tracking-wider px-5 py-3">频道名称</th>
                <th className="text-left text-xs text-[#666] font-medium uppercase tracking-wider px-5 py-3">类型</th>
                <th className="text-left text-xs text-[#666] font-medium uppercase tracking-wider px-5 py-3">状态</th>
                <th className="text-right text-xs text-[#666] font-medium uppercase tracking-wider px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((ch, i) => (
                <tr key={ch.name} className={clsx(
                  'border-b border-[#1e1e1e] hover:bg-[#1a1a1a] transition-colors',
                  i % 2 === 0 ? 'bg-[#161616]' : 'bg-[#141414]'
                )}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Radio size={14} className="text-purple-400" />
                      </div>
                      <span className="text-white text-sm font-medium">{ch.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={clsx('badge border', getTypeStyle(ch.type))}>
                      {ch.type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className={clsx(
                        'w-2 h-2 rounded-full',
                        ch.status?.toLowerCase().includes('active') || ch.status?.toLowerCase().includes('online')
                          ? 'bg-green-400'
                          : 'bg-[#444]'
                      )} />
                      <span className="text-[#888] text-xs">{ch.status || '—'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => setDeleteChannel(ch.name)}
                        className="p-1.5 rounded-lg text-[#666] hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="删除频道"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Setup Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-orange-400" />
                <h3 className="text-white font-semibold">频道配置指南</h3>
              </div>
              <button onClick={() => setShowGuide(false)} className="text-[#666] hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="terminal-amber p-6 max-h-[500px] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm">{CHANNEL_SETUP_GUIDE}</pre>
            </div>
            <div className="px-6 py-4 border-t border-[#2a2a2a] flex justify-end">
              <button
                onClick={() => setShowGuide(false)}
                className="px-4 py-2 rounded-lg bg-[#2a2a2a] text-[#888] text-sm hover:bg-[#333] transition-all"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteChannel && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-semibold mb-2">确认删除频道</h3>
            <p className="text-[#888] text-sm">
              确定要删除频道 <span className="text-red-400 font-mono">{deleteChannel}</span> 吗？
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30 transition-all disabled:opacity-50"
              >
                {deleteLoading ? <RefreshCw size={13} className="spinner" /> : <Trash2 size={13} />}
                删除
              </button>
              <button
                onClick={() => setDeleteChannel(null)}
                className="px-4 py-2 rounded-lg bg-[#2a2a2a] text-[#888] text-sm hover:bg-[#333] transition-all"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
