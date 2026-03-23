import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquare, Send, Bot, RefreshCw, AlertCircle } from 'lucide-react'
import { useCLI } from '../hooks/useCLI'
import { useStore } from '../store/useStore'
import clsx from 'clsx'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
}

// ── Markdown renderer (minimal) ────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode {
  // Split on code blocks first
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const inner = part.slice(3, -3).replace(/^\w*\n/, '')
      return (
        <pre
          key={i}
          className="my-2 rounded bg-black/50 border border-brand-border p-3 text-xs font-mono text-green-400 overflow-x-auto whitespace-pre-wrap"
        >
          {inner}
        </pre>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="rounded bg-black/40 px-1 py-0.5 text-xs font-mono text-orange-300">
          {part.slice(1, -1)}
        </code>
      )
    }
    // Handle **bold**, line breaks
    const lines = part.split('\n')
    return (
      <span key={i}>
        {lines.map((line, li) => {
          const boldParts = line.split(/(\*\*[^*]+\*\*)/g)
          return (
            <span key={li}>
              {boldParts.map((bp, bi) =>
                bp.startsWith('**') && bp.endsWith('**') ? (
                  <strong key={bi} className="font-semibold text-white">
                    {bp.slice(2, -2)}
                  </strong>
                ) : (
                  <span key={bi}>{bp}</span>
                )
              )}
              {li < lines.length - 1 && <br />}
            </span>
          )
        })}
      </span>
    )
  })
}

// ── Agent list item ────────────────────────────────────────────────────────────

interface AgentCardProps {
  name: string
  selected: boolean
  onClick: () => void
}

function AgentCard({ name, selected, onClick }: AgentCardProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2',
        selected
          ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
          : 'text-gray-300 hover:bg-white/5 border border-transparent'
      )}
    >
      <Bot size={14} className={selected ? 'text-orange-400' : 'text-gray-500'} />
      <span className="truncate">{name}</span>
    </button>
  )
}

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'

  if (msg.pending) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[75%] rounded-2xl rounded-tl-sm px-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 text-sm">
          <span className="animate-pulse">思考中...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'rounded-tr-sm bg-orange-500 text-white'
            : 'rounded-tl-sm bg-[#1a1a1a] border border-[#2a2a2a] text-gray-200'
        )}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{msg.content}</span>
        ) : (
          <span>{renderMarkdown(msg.content)}</span>
        )}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Chat() {
  const { gatewayRunning, setActiveTab } = useStore()
  const { run } = useCLI()

  const [agents, setAgents] = useState<string[]>([])
  const [agentsLoading, setAgentsLoading] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pendingIdRef = useRef<string | null>(null)

  // ── Load agents ──────────────────────────────────────────────────────────────

  const loadAgents = useCallback(async () => {
    setAgentsLoading(true)
    try {
      const result = await run(['agents', 'list'])
      const raw = result.stdout + result.stderr
      // Parse agent names from CLI output — one per line, strip leading symbols/whitespace
      const lines = raw
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        // Filter out headers / decorative lines
        .filter((l) => !/^[-=]+$/.test(l))
        .filter((l) => !/^(name|agent|list|available|no agents)/i.test(l))

      // Extract agent names: lines that look like identifiers
      const parsed: string[] = []
      for (const line of lines) {
        // Strip leading bullet symbols, numbers, icons
        const cleaned = line.replace(/^[\s•*\->\d.]+/, '').trim()
        // Take only the first "word" segment if line has extra info (e.g. "agent1  description")
        const name = cleaned.split(/\s{2,}|\t/)[0].trim()
        if (name && /^[\w\-.]+$/.test(name)) {
          parsed.push(name)
        }
      }

      if (parsed.length > 0) {
        setAgents(parsed)
        if (!selectedAgent) setSelectedAgent(parsed[0])
      } else {
        setAgents([])
      }
    } catch {
      setAgents([])
    } finally {
      setAgentsLoading(false)
    }
  }, [run, selectedAgent])

  useEffect(() => {
    loadAgents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-scroll messages ─────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send message ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return

    setInput('')
    setSending(true)

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }

    const pendingId = `pending-${Date.now()}`
    pendingIdRef.current = pendingId
    const pendingMsg: Message = {
      id: pendingId,
      role: 'assistant',
      content: '',
      pending: true,
    }

    setMessages((prev) => [...prev, userMsg, pendingMsg])

    let replyContent = ''

    try {
      if (gatewayRunning) {
        // Primary: call Gateway OpenAI-compatible endpoint
        const resp = await fetch('http://localhost:18789/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: selectedAgent || 'default',
            messages: [{ role: 'user', content: text }],
            stream: false,
          }),
        })
        if (resp.ok) {
          const data = await resp.json()
          replyContent = data?.choices?.[0]?.message?.content ?? '(空响应)'
        } else {
          throw new Error(`HTTP ${resp.status}`)
        }
      } else {
        throw new Error('gateway not running')
      }
    } catch {
      // Fallback: CLI send command
      try {
        const agentName = selectedAgent || 'default'
        const result = await run(['send', '--agent', agentName, '--message', text])
        replyContent = (result.stdout || result.stderr || '').trim() || '(无响应)'
      } catch (cliErr) {
        replyContent = `发送失败: ${cliErr instanceof Error ? cliErr.message : String(cliErr)}`
      }
    }

    const assistantMsg: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: replyContent,
    }

    setMessages((prev) =>
      prev
        .filter((m) => m.id !== pendingId)
        .concat(assistantMsg)
    )
    pendingIdRef.current = null
    setSending(false)

    // Restore focus to input
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [input, sending, gatewayRunning, selectedAgent, run])

  // ── Keyboard handler ─────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full" style={{ background: '#0f0f0f' }}>
      {/* ── Left panel ── */}
      <div
        className="flex flex-col border-r border-[#2a2a2a] shrink-0"
        style={{ width: 200, background: '#111111' }}
      >
        {/* Panel title */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2a2a2a]">
          <MessageSquare size={16} className="text-orange-400" />
          <span className="text-sm font-semibold text-white">Chat · 聊天</span>
        </div>

        {/* Agent list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {agentsLoading ? (
            <div className="px-2 py-4 text-xs text-gray-500 text-center animate-pulse">
              加载中...
            </div>
          ) : agents.length === 0 ? (
            <div className="px-2 py-4 text-xs text-gray-600 text-center leading-relaxed">
              未找到 Agent
              <br />
              请先配置
            </div>
          ) : (
            agents.map((name) => (
              <AgentCard
                key={name}
                name={name}
                selected={selectedAgent === name}
                onClick={() => setSelectedAgent(name)}
              />
            ))
          )}
        </div>

        {/* Refresh button */}
        <div className="p-2 border-t border-[#2a2a2a]">
          <button
            onClick={loadAgents}
            disabled={agentsLoading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={agentsLoading ? 'animate-spin' : ''} />
            刷新列表
          </button>
        </div>
      </div>

      {/* ── Right main area ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a] shrink-0">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-orange-400" />
            <span className="text-sm font-semibold text-white">
              {selectedAgent || '未选择 Agent'}
            </span>
            <span className="text-xs text-[#555] px-1.5 py-0.5 rounded border border-[#2a2a2a]">Model: default</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#555]">对话历史</span>
            <div className="flex items-center gap-1.5">
              <span
                className={clsx(
                  'h-2 w-2 rounded-full',
                  gatewayRunning ? 'bg-green-500' : 'bg-gray-600'
                )}
              />
              <span className={clsx('text-xs', gatewayRunning ? 'text-green-400' : 'text-gray-500')}>
                {gatewayRunning ? 'Gateway 运行中' : 'Gateway 已停止'}
              </span>
            </div>
          </div>
        </div>

        {/* Gateway warning banner */}
        {!gatewayRunning && (
          <button
            onClick={() => setActiveTab('gateway')}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500/10 border-b border-orange-500/20 text-orange-400 text-xs hover:bg-orange-500/15 transition-colors shrink-0 text-left w-full"
          >
            <AlertCircle size={14} />
            <span>Gateway 未运行，请先启动 Gateway — 点击前往</span>
          </button>
        )}

        {/* Messages list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center select-none">
              <MessageSquare size={40} className="text-gray-700 mb-3" />
              <p className="text-gray-500 text-sm">
                {selectedAgent
                  ? `与 ${selectedAgent} 开始对话`
                  : '请先在左侧选择一个 Agent'}
              </p>
            </div>
          ) : (
            messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="shrink-0 px-4 pb-4 pt-2 border-t border-[#2a2a2a]">
          <div className="flex items-end gap-2 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 focus-within:border-orange-500/40 transition-colors">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedAgent
                  ? `输入消息给 ${selectedAgent}… (Enter 发送，Shift+Enter 换行)`
                  : '输入消息… (请先选择 Agent)'
              }
              disabled={sending || !selectedAgent}
              className="flex-1 resize-none bg-transparent text-sm text-gray-200 placeholder-gray-600 outline-none leading-relaxed max-h-40 overflow-y-auto disabled:opacity-50"
              style={{ minHeight: '24px' }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 160)}px`
              }}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim() || !selectedAgent}
              className={clsx(
                'shrink-0 flex items-center justify-center rounded-lg p-1.5 transition-colors',
                sending || !input.trim() || !selectedAgent
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-orange-400 hover:bg-orange-500/15'
              )}
            >
              <Send size={16} />
            <span className="text-xs">发送</span>
            </button>
          </div>
          <p className="mt-1.5 text-xs text-gray-700 text-right">
            Enter 发送 · Shift+Enter 换行
          </p>
        </div>
      </div>
    </div>
  )
}
