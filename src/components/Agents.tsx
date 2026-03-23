import { useEffect, useState } from 'react'
import {
  Bot,
  Plus,
  Trash2,
  MessageSquare,
  Link,
  Unlink,
  RefreshCw,
  X,
  Send,
  FolderOpen
} from 'lucide-react'
import { useCLI } from '../hooks/useCLI'
import { useStore } from '../store/useStore'
import clsx from 'clsx'

interface Agent {
  name: string
  workspace: string
  channels: string[]
  status?: string
}

export default function Agents() {
  const { ocInstalled } = useStore()
  const { run } = useCLI()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Add agent form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newWorkspace, setNewWorkspace] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  // Send message modal
  const [showMsgModal, setShowMsgModal] = useState(false)
  const [msgAgent, setMsgAgent] = useState('')
  const [msgText, setMsgText] = useState('')
  const [msgLoading, setMsgLoading] = useState(false)
  const [msgResult, setMsgResult] = useState('')

  // Bind/unbind modal
  const [showBindModal, setShowBindModal] = useState(false)
  const [bindAgent, setBindAgent] = useState('')
  const [bindChannel, setBindChannel] = useState('')
  const [bindMode, setBindMode] = useState<'bind' | 'unbind'>('bind')
  const [bindLoading, setBindLoading] = useState(false)

  // Delete confirmation
  const [deleteAgent, setDeleteAgent] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const parseAgents = (output: string): Agent[] => {
    const lines = output.trim().split('\n').filter(l => l.trim())
    const results: Agent[] = []

    // Try JSON parse first
    try {
      const parsed = JSON.parse(output)
      if (Array.isArray(parsed)) {
        return parsed.map((a: Record<string, unknown>) => ({
          name: String(a.name || ''),
          workspace: String(a.workspace || a.path || ''),
          channels: Array.isArray(a.channels) ? a.channels.map(String) : [],
          status: String(a.status || '')
        }))
      }
    } catch {
      // fallback to text parsing
    }

    // Text table parsing - skip header/separator lines
    for (const line of lines) {
      if (line.startsWith('NAME') || line.startsWith('---') || line.startsWith('=')) continue
      const parts = line.split(/\s{2,}/).filter(p => p.trim())
      if (parts.length >= 1) {
        results.push({
          name: parts[0].trim(),
          workspace: parts[1]?.trim() || '',
          channels: parts[2] ? parts[2].split(',').map(c => c.trim()).filter(Boolean) : [],
          status: parts[3]?.trim() || ''
        })
      }
    }
    return results
  }

  const loadAgents = async () => {
    if (!ocInstalled) return
    setLoading(true)
    setError('')
    try {
      const res = await run(['agents', 'list'])
      if (res.exitCode === 0) {
        setAgents(parseAgents(res.stdout))
      } else {
        setError(res.stderr || res.stdout || '获取 Agent 列表失败')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAgents() }, [ocInstalled])

  const handleAdd = async () => {
    if (!newName.trim()) { setAddError('请输入 Agent 名称'); return }
    if (!newWorkspace.trim()) { setAddError('请输入工作目录'); return }
    setAddLoading(true)
    setAddError('')
    try {
      const res = await run(['agents', 'add', newName.trim(), '--workspace', newWorkspace.trim()])
      if (res.exitCode === 0) {
        setShowAddForm(false)
        setNewName('')
        setNewWorkspace('')
        await loadAgents()
      } else {
        setAddError(res.stderr || res.stdout || '添加失败')
      }
    } catch (err) {
      setAddError(String(err))
    } finally {
      setAddLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteAgent) return
    setDeleteLoading(true)
    try {
      const res = await run(['agents', 'delete', deleteAgent])
      if (res.exitCode === 0) {
        setDeleteAgent(null)
        await loadAgents()
      }
    } catch {
      // ignore
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!msgAgent || !msgText.trim()) return
    setMsgLoading(true)
    setMsgResult('')
    try {
      const res = await run(['agent', '--agent', msgAgent, '--message', msgText.trim()])
      setMsgResult(res.stdout || res.stderr || '(no output)')
    } catch (err) {
      setMsgResult('Error: ' + String(err))
    } finally {
      setMsgLoading(false)
    }
  }

  const handleBind = async () => {
    if (!bindAgent || !bindChannel.trim()) return
    setBindLoading(true)
    try {
      const action = bindMode === 'bind' ? 'bind' : 'unbind'
      await run(['agents', action, '--agent', bindAgent, '--bind', bindChannel.trim()])
      setShowBindModal(false)
      setBindChannel('')
      await loadAgents()
    } catch {
      // ignore
    } finally {
      setBindLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Agents</h1>
          <p className="text-[#666] text-sm mt-0.5">管理 OpenClaw AI Agents</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadAgents}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] text-sm hover:text-white hover:border-[#3a3a3a] transition-all"
          >
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            刷新
          </button>
          <button
            onClick={() => { setShowMsgModal(true); if (agents.length > 0) setMsgAgent(agents[0].name) }}
            disabled={agents.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/15 border border-blue-500/20 text-blue-400 text-sm hover:bg-blue-500/25 transition-all disabled:opacity-40"
          >
            <MessageSquare size={14} />
            发消息
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            disabled={!ocInstalled}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/15 border border-orange-500/20 text-orange-400 text-sm hover:bg-orange-500/25 transition-all disabled:opacity-40"
          >
            <Plus size={14} />
            添加 Agent
          </button>
        </div>
      </div>

      {/* Add Agent Form */}
      {showAddForm && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-orange-400 font-medium">添加新 Agent</h3>
            <button onClick={() => { setShowAddForm(false); setAddError('') }} className="text-[#666] hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#888] mb-1.5 block">Agent 名称</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="my-agent"
                className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm placeholder-[#444] focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-[#888] mb-1.5 block">工作目录</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newWorkspace}
                  onChange={e => setNewWorkspace(e.target.value)}
                  placeholder="/path/to/workspace"
                  className="flex-1 px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm placeholder-[#444] focus:outline-none focus:border-orange-500/50"
                />
              </div>
            </div>
          </div>
          {addError && <p className="text-red-400 text-xs mt-2">{addError}</p>}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAdd}
              disabled={addLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 text-sm hover:bg-orange-500/30 transition-all disabled:opacity-50"
            >
              {addLoading ? <RefreshCw size={13} className="spinner" /> : <Plus size={13} />}
              添加
            </button>
            <button
              onClick={() => { setShowAddForm(false); setAddError('') }}
              className="px-4 py-2 rounded-lg bg-[#2a2a2a] text-[#888] text-sm hover:bg-[#333] transition-all"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Agents Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-[#555]">
          <RefreshCw size={20} className="spinner mr-3" />
          加载中...
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bot size={48} className="text-[#333] mb-4" />
          <p className="text-[#666] font-medium">暂无 Agent</p>
          <p className="text-[#444] text-sm mt-1">点击"添加 Agent"创建第一个 Agent</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#2a2a2a] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a2a] bg-[#141414]">
                <th className="text-left text-xs text-[#666] font-medium uppercase tracking-wider px-5 py-3">名称</th>
                <th className="text-left text-xs text-[#666] font-medium uppercase tracking-wider px-5 py-3">工作目录</th>
                <th className="text-left text-xs text-[#666] font-medium uppercase tracking-wider px-5 py-3">绑定频道</th>
                <th className="text-right text-xs text-[#666] font-medium uppercase tracking-wider px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, i) => (
                <tr key={agent.name} className={clsx('border-b border-[#1e1e1e] hover:bg-[#1a1a1a] transition-colors', i % 2 === 0 ? 'bg-[#161616]' : 'bg-[#141414]')}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Bot size={14} className="text-blue-400" />
                      </div>
                      <span className="text-white text-sm font-medium">{agent.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-[#888] text-xs font-mono truncate max-w-[200px] block">
                      {agent.workspace || '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {agent.channels.length > 0
                        ? agent.channels.map(ch => (
                          <span key={ch} className="badge bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            {ch}
                          </span>
                        ))
                        : <span className="text-[#555] text-xs">—</span>
                      }
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => { setMsgAgent(agent.name); setShowMsgModal(true) }}
                        className="p-1.5 rounded-lg text-[#666] hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                        title="发消息"
                      >
                        <MessageSquare size={14} />
                      </button>
                      <button
                        onClick={() => { setBindAgent(agent.name); setBindMode('bind'); setShowBindModal(true) }}
                        className="p-1.5 rounded-lg text-[#666] hover:text-green-400 hover:bg-green-500/10 transition-all"
                        title="绑定频道"
                      >
                        <Link size={14} />
                      </button>
                      <button
                        onClick={() => { setBindAgent(agent.name); setBindMode('unbind'); setShowBindModal(true) }}
                        className="p-1.5 rounded-lg text-[#666] hover:text-yellow-400 hover:bg-yellow-500/10 transition-all"
                        title="解绑频道"
                      >
                        <Unlink size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteAgent(agent.name)}
                        className="p-1.5 rounded-lg text-[#666] hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="删除"
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

      {/* Send Message Modal */}
      {showMsgModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">发送消息给 Agent</h3>
              <button onClick={() => { setShowMsgModal(false); setMsgResult('') }} className="text-[#666] hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#888] mb-1.5 block">选择 Agent</label>
                <select
                  value={msgAgent}
                  onChange={e => setMsgAgent(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm focus:outline-none focus:border-orange-500/50"
                >
                  {agents.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#888] mb-1.5 block">消息内容</label>
                <textarea
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  placeholder="输入消息..."
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm placeholder-[#444] focus:outline-none focus:border-orange-500/50 resize-none"
                />
              </div>
              {msgResult && (
                <div className="terminal rounded-lg p-3 text-xs max-h-32 overflow-y-auto">
                  {msgResult}
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleSendMessage}
                disabled={msgLoading || !msgAgent || !msgText.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 text-sm hover:bg-orange-500/30 transition-all disabled:opacity-50"
              >
                {msgLoading ? <RefreshCw size={13} className="spinner" /> : <Send size={13} />}
                发送
              </button>
              <button
                onClick={() => { setShowMsgModal(false); setMsgResult('') }}
                className="px-4 py-2 rounded-lg bg-[#2a2a2a] text-[#888] text-sm hover:bg-[#333] transition-all"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bind/Unbind Modal */}
      {showBindModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">
                {bindMode === 'bind' ? '绑定频道' : '解绑频道'} — {bindAgent}
              </h3>
              <button onClick={() => setShowBindModal(false)} className="text-[#666] hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="text-xs text-[#888] mb-1.5 block">频道名称</label>
              <input
                type="text"
                value={bindChannel}
                onChange={e => setBindChannel(e.target.value)}
                placeholder="channel-name"
                className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm placeholder-[#444] focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleBind}
                disabled={bindLoading || !bindChannel.trim()}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50',
                  bindMode === 'bind'
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                )}
              >
                {bindLoading ? <RefreshCw size={13} className="spinner" /> : bindMode === 'bind' ? <Link size={13} /> : <Unlink size={13} />}
                {bindMode === 'bind' ? '绑定' : '解绑'}
              </button>
              <button
                onClick={() => setShowBindModal(false)}
                className="px-4 py-2 rounded-lg bg-[#2a2a2a] text-[#888] text-sm hover:bg-[#333] transition-all"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteAgent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-semibold mb-2">确认删除</h3>
            <p className="text-[#888] text-sm">
              确定要删除 Agent <span className="text-red-400 font-mono">{deleteAgent}</span> 吗？此操作不可撤销。
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
                onClick={() => setDeleteAgent(null)}
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
