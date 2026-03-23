import { useEffect, useState, useCallback } from 'react'
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
  Star,
  Users,
  ChevronRight,
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
  isDefault?: boolean
}

interface AgentTemplate {
  emoji: string
  label: string
  name: string
  prompt: string
  description: string
}

const TEMPLATES: AgentTemplate[] = [
  {
    emoji: '🤖',
    label: '通用助手',
    name: 'assistant',
    description: '回答各类问题的通用 AI 助手',
    prompt: '你是一个通用 AI 助手，帮助用户回答各类问题。'
  },
  {
    emoji: '🛒',
    label: '跨境电商运营专家',
    name: 'ecommerce',
    description: '亚马逊/Shopify 运营与 listing 优化',
    prompt:
      '你是一名跨境电商运营专家，熟悉亚马逊/Shopify运营，帮助优化产品listing和运营策略。'
  },
  {
    emoji: '💻',
    label: '代码审查助手',
    name: 'code-review',
    description: '找出 bug、安全问题和改进空间',
    prompt:
      '你是一名资深工程师，专注代码审查。找出潜在bug、安全问题和改进空间。'
  },
  {
    emoji: '💬',
    label: '微信客服机器人',
    name: 'wechat-cs',
    description: '礼貌友好的专业微信客服',
    prompt: '你是一名专业的微信客服，礼貌友好，帮助用户解决问题。'
  },
  {
    emoji: '🏢',
    label: '飞书行政助手',
    name: 'feishu-admin',
    description: '日程、会议纪要与团队协作',
    prompt:
      '你是一名企业飞书行政助手，帮助处理日程、会议纪要和团队协作事项。'
  }
]

export default function Agents() {
  const { ocInstalled } = useStore()
  const { run } = useCLI()

  // Tab state
  const [activeTab, setActiveTab] = useState<'my-agents' | 'templates'>('my-agents')

  // Agent list
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Add agent form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newWorkspace, setNewWorkspace] = useState('')
  const [newPrompt, setNewPrompt] = useState('')
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

  // Template creation state
  const [templateLoading, setTemplateLoading] = useState<string | null>(null)
  const [templateSuccess, setTemplateSuccess] = useState<string | null>(null)

  // Set default loading
  const [setDefaultLoading, setSetDefaultLoading] = useState<string | null>(null)

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
          status: String(a.status || ''),
          isDefault: Boolean(a.isDefault || a.is_default || a.default)
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
          status: parts[3]?.trim() || '',
          isDefault: parts[3]?.includes('default') || parts[4]?.includes('default') || false
        })
      }
    }
    return results
  }

  const loadAgents = useCallback(async () => {
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
  }, [ocInstalled, run])

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  // Escape key closes all modals
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddForm(false)
        setAddError('')
        setShowMsgModal(false)
        setMsgResult('')
        setShowBindModal(false)
        setDeleteAgent(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleAdd = async () => {
    if (!newName.trim()) { setAddError('请输入 Agent 名称'); return }
    if (!newWorkspace.trim()) { setAddError('请输入工作目录'); return }
    setAddLoading(true)
    setAddError('')
    try {
      const args = ['agents', 'create', '--name', newName.trim(), '--workspace', newWorkspace.trim()]
      if (newPrompt.trim()) {
        args.push('--prompt', newPrompt.trim())
      }
      const res = await run(args)
      if (res.exitCode === 0) {
        setShowAddForm(false)
        setNewName('')
        setNewWorkspace('')
        setNewPrompt('')
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
      const res = await run(['send', '--agent', msgAgent, '--message', msgText.trim()])
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

  const handleSetDefault = async (name: string) => {
    setSetDefaultLoading(name)
    try {
      await run(['agents', 'set-default', name])
      await loadAgents()
    } catch {
      // ignore
    } finally {
      setSetDefaultLoading(null)
    }
  }

  const handleUseTemplate = async (template: AgentTemplate) => {
    setTemplateLoading(template.name)
    setTemplateSuccess(null)
    try {
      const res = await run([
        'agents', 'create',
        '--name', template.name,
        '--prompt', template.prompt
      ])
      if (res.exitCode === 0) {
        setTemplateSuccess(template.name)
        await loadAgents()
        setTimeout(() => setTemplateSuccess(null), 3000)
      }
    } catch {
      // ignore
    } finally {
      setTemplateLoading(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Agent Store</h1>
          <p className="text-[#666] text-sm mt-0.5">管理和部署 OpenClaw AI Agents</p>
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
          {activeTab === 'my-agents' && (
            <>
              <button
                onClick={() => {
                  setShowMsgModal(true)
                  if (agents.length > 0) setMsgAgent(agents[0].name)
                }}
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
                新建 Agent
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#141414] rounded-xl border border-[#2a2a2a] w-fit">
        <button
          onClick={() => setActiveTab('my-agents')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            activeTab === 'my-agents'
              ? 'bg-[#2a2a2a] text-white shadow-sm'
              : 'text-[#666] hover:text-[#999]'
          )}
        >
          <Users size={14} />
          我的 Agents
          {agents.length > 0 && (
            <span className="bg-orange-500/20 text-orange-400 text-xs px-1.5 py-0.5 rounded-full leading-none">
              {agents.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            activeTab === 'templates'
              ? 'bg-[#2a2a2a] text-white shadow-sm'
              : 'text-[#666] hover:text-[#999]'
          )}
        >
          <Star size={14} />
          Agent 模板
        </button>
      </div>

      {/* ---- MY AGENTS TAB ---- */}
      {activeTab === 'my-agents' && (
        <>
          {/* Add Agent Form */}
          {showAddForm && (
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-orange-400 font-medium">新建 Agent</h3>
                <button
                  onClick={() => { setShowAddForm(false); setAddError('') }}
                  className="text-[#666] hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[#888] mb-1.5 block">Agent 名称 *</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="my-agent"
                    className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm placeholder-[#444] focus:outline-none focus:border-orange-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#888] mb-1.5 block">工作目录 *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newWorkspace}
                      onChange={e => setNewWorkspace(e.target.value)}
                      placeholder="/path/to/workspace"
                      className="flex-1 px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm placeholder-[#444] focus:outline-none focus:border-orange-500/50"
                    />
                    <button
                      className="px-2.5 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#666] hover:text-white hover:border-[#3a3a3a] transition-all"
                      title="浏览目录"
                    >
                      <FolderOpen size={14} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <label className="text-xs text-[#888] mb-1.5 block">
                  系统 Prompt
                  <span className="text-[#555] ml-1">(可选，定义 Agent 的角色和行为)</span>
                </label>
                <textarea
                  value={newPrompt}
                  onChange={e => setNewPrompt(e.target.value)}
                  placeholder="你是一个 AI 助手，帮助用户..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm placeholder-[#444] focus:outline-none focus:border-orange-500/50 resize-none"
                />
              </div>
              {addError && <p className="text-red-400 text-xs mt-2">{addError}</p>}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleAdd}
                  disabled={addLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 text-sm hover:bg-orange-500/30 transition-all disabled:opacity-50"
                >
                  {addLoading ? <RefreshCw size={13} className="spinner" /> : <Plus size={13} />}
                  创建
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

          {/* Agents List */}
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#555]">
              <RefreshCw size={20} className="spinner mr-3" />
              加载中...
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bot size={48} className="text-[#333] mb-4" />
              <p className="text-[#666] font-medium">暂无 Agent</p>
              <p className="text-[#444] text-sm mt-1">点击"新建 Agent"或使用模板快速创建</p>
              <button
                onClick={() => setActiveTab('templates')}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] text-sm hover:text-white hover:border-orange-500/30 transition-all"
              >
                <Star size={13} />
                浏览模板
                <ChevronRight size={13} />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {agents.map(agent => (
                <div
                  key={agent.name}
                  className={clsx(
                    'bg-[#1a1a1a] border rounded-xl p-4 transition-all hover:border-[#3a3a3a]',
                    agent.isDefault ? 'border-green-500/30' : 'border-[#2a2a2a]'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: icon + info */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={clsx(
                        'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                        agent.isDefault ? 'bg-green-500/20' : 'bg-blue-500/15'
                      )}>
                        <Bot size={16} className={agent.isDefault ? 'text-green-400' : 'text-blue-400'} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-semibold">{agent.name}</span>
                          {agent.isDefault && (
                            <span className="bg-green-500/15 text-green-400 text-xs px-2 py-0.5 rounded">
                              默认
                            </span>
                          )}
                          {agent.status && agent.status !== 'active' && (
                            <span className="bg-[#2a2a2a] text-[#666] text-xs px-2 py-0.5 rounded">
                              {agent.status}
                            </span>
                          )}
                        </div>
                        {agent.workspace && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <FolderOpen size={11} className="text-[#555] flex-shrink-0" />
                            <span className="text-[#666] text-xs font-mono truncate">{agent.workspace}</span>
                          </div>
                        )}
                        {agent.channels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {agent.channels.map(ch => (
                              <span
                                key={ch}
                                className="bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs px-2 py-0.5 rounded"
                              >
                                {ch}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!agent.isDefault && (
                        <button
                          onClick={() => handleSetDefault(agent.name)}
                          disabled={setDefaultLoading === agent.name}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#666] hover:text-green-400 hover:bg-green-500/10 transition-all text-xs"
                          title="设为默认"
                        >
                          {setDefaultLoading === agent.name
                            ? <RefreshCw size={12} className="spinner" />
                            : <Star size={12} />
                          }
                          设为默认
                        </button>
                      )}
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ---- TEMPLATES TAB ---- */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <p className="text-[#666] text-sm">
            选择预设模板，一键创建配置好系统 Prompt 的 Agent。
          </p>
          <div className="grid grid-cols-1 gap-3">
            {TEMPLATES.map(template => {
              const alreadyExists = agents.some(a => a.name === template.name)
              const isLoading = templateLoading === template.name
              const isSuccess = templateSuccess === template.name

              return (
                <div
                  key={template.name}
                  className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 hover:border-orange-500/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-[#252525] border border-[#2a2a2a] flex items-center justify-center text-xl flex-shrink-0 select-none">
                        {template.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-semibold">{template.label}</span>
                          <span className="text-[#555] text-xs font-mono">{template.name}</span>
                          {alreadyExists && (
                            <span className="bg-[#2a2a2a] text-[#666] text-xs px-2 py-0.5 rounded">
                              已存在
                            </span>
                          )}
                        </div>
                        <p className="text-[#666] text-xs mt-0.5">{template.description}</p>
                        <p className="text-[#444] text-xs mt-1.5 font-mono line-clamp-2 leading-relaxed">
                          {template.prompt}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUseTemplate(template)}
                      disabled={isLoading || !ocInstalled}
                      className={clsx(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all flex-shrink-0 disabled:opacity-50',
                        isSuccess
                          ? 'bg-green-500/20 text-green-400 border border-green-500/20'
                          : 'bg-orange-500/15 border border-orange-500/20 text-orange-400 hover:bg-orange-500/25'
                      )}
                    >
                      {isLoading
                        ? <RefreshCw size={13} className="spinner" />
                        : isSuccess
                          ? <span className="text-green-400">✓</span>
                          : <Plus size={13} />
                      }
                      {isSuccess ? '已创建' : '使用此模板'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ---- SEND MESSAGE MODAL ---- */}
      {showMsgModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">发送消息给 Agent</h3>
              <button
                onClick={() => { setShowMsgModal(false); setMsgResult('') }}
                className="text-[#666] hover:text-white"
              >
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
                  {agents.map(a => (
                    <option key={a.name} value={a.name}>{a.name}</option>
                  ))}
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
                <div className="terminal rounded-lg p-3 text-xs max-h-36 overflow-y-auto whitespace-pre-wrap">
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

      {/* ---- BIND / UNBIND MODAL ---- */}
      {showBindModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">
                {bindMode === 'bind' ? '绑定频道' : '解绑频道'}
                <span className="text-[#666] font-normal ml-2">— {bindAgent}</span>
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
                {bindLoading
                  ? <RefreshCw size={13} className="spinner" />
                  : bindMode === 'bind'
                    ? <Link size={13} />
                    : <Unlink size={13} />
                }
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

      {/* ---- DELETE CONFIRMATION MODAL ---- */}
      {deleteAgent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-semibold mb-2">确认删除</h3>
            <p className="text-[#888] text-sm">
              确定要删除 Agent{' '}
              <span className="text-red-400 font-mono">{deleteAgent}</span> 吗？此操作不可撤销。
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
