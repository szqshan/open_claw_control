import { useState, useEffect, useCallback } from 'react'
import {
  Clock,
  Plus,
  Trash2,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Calendar,
  Repeat,
  X,
  AlignLeft,
} from 'lucide-react'
import { useCLI } from '../hooks/useCLI'
import { useStore } from '../store/useStore'
import clsx from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CronTask {
  id: string
  name: string
  description?: string
  prompt?: string
  schedule: string
  enabled: boolean
}

type ScheduleMode = 'once' | 'repeat' | 'cron'

interface NewTaskForm {
  name: string
  prompt: string
  mode: ScheduleMode
  // once
  datetime: string
  // repeat
  interval: string
  unit: 'minutes' | 'hours' | 'days' | 'weeks'
  // cron
  cronExpr: string
}

// ─── Templates ────────────────────────────────────────────────────────────────

interface Template {
  icon: string
  label: string
  name: string
  prompt: string
  mode: ScheduleMode
  datetime?: string
  interval?: string
  unit?: 'minutes' | 'hours' | 'days' | 'weeks'
  cronExpr?: string
}

const TEMPLATES: Template[] = [
  {
    icon: '📰',
    label: '每天早报',
    name: '每天早报',
    prompt: '请生成今天的早报摘要，包括重要新闻和天气预报。',
    mode: 'cron',
    cronExpr: '0 8 * * *',
  },
  {
    icon: '📬',
    label: '每6小时收件箱',
    name: '收件箱巡查',
    prompt: '请检查收件箱，汇总重要邮件和消息。',
    mode: 'repeat',
    interval: '6',
    unit: 'hours',
  },
  {
    icon: '📊',
    label: '每周一周报',
    name: '每周周报',
    prompt: '请生成本周工作总结和下周计划。',
    mode: 'cron',
    cronExpr: '0 9 * * 1',
  },
  {
    icon: '⏰',
    label: '30分钟后提醒',
    name: '30分钟提醒',
    prompt: '请提醒我：30分钟前设置的事项已到时间。',
    mode: 'once',
    datetime: (() => {
      const d = new Date(Date.now() + 30 * 60 * 1000)
      return d.toISOString().slice(0, 16)
    })(),
  },
]

// ─── Helper: parse CLI output ──────────────────────────────────────────────────

function parseTaskList(output: string): CronTask[] {
  // Try JSON first
  try {
    const parsed = JSON.parse(output)
    if (Array.isArray(parsed)) {
      return parsed.map((t: Record<string, unknown>) => ({
        id: String(t.id ?? t.name ?? ''),
        name: String(t.name ?? ''),
        description: String(t.description ?? t.desc ?? t.prompt ?? ''),
        prompt: String(t.prompt ?? t.message ?? t.description ?? ''),
        schedule: String(t.schedule ?? t.cron ?? ''),
        enabled: t.enabled !== false && t.status !== 'disabled',
      }))
    }
  } catch {
    // fall through to line parsing
  }

  // Line-by-line table parsing
  const lines = output.split('\n').filter(Boolean)
  const tasks: CronTask[] = []

  for (const line of lines) {
    // Skip header / divider lines
    if (/^[-─=\s]+$/.test(line)) continue
    if (/^(id|name|task)\s/i.test(line)) continue

    // Try to parse "id  name  schedule  status" pattern
    const cols = line.split(/\s{2,}|\t/).map((s) => s.trim()).filter(Boolean)
    if (cols.length >= 2) {
      tasks.push({
        id: cols[0],
        name: cols[1] ?? cols[0],
        description: cols[2] ?? '',
        prompt: '',
        schedule: cols[2] ?? '',
        enabled: !String(cols[cols.length - 1]).toLowerCase().includes('disab'),
      })
    }
  }

  return tasks
}

// ─── Helper: build schedule string ────────────────────────────────────────────

function buildSchedule(form: NewTaskForm): string {
  switch (form.mode) {
    case 'once':
      return form.datetime ? `at ${form.datetime}` : ''
    case 'repeat': {
      const n = parseInt(form.interval, 10)
      if (!n || n <= 0) return ''
      return `every ${n}${form.unit[0]}`  // e.g. every 6h, every 1d
    }
    case 'cron':
      return form.cronExpr.trim()
    default:
      return ''
  }
}

// ─── Default form state ───────────────────────────────────────────────────────

function defaultForm(): NewTaskForm {
  const now = new Date(Date.now() + 5 * 60 * 1000)
  return {
    name: '',
    prompt: '',
    mode: 'repeat',
    datetime: now.toISOString().slice(0, 16),
    interval: '30',
    unit: 'minutes',
    cronExpr: '0 8 * * *',
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CronTasks() {
  const { ocInstalled } = useStore()
  const { run } = useCLI()

  const [tasks, setTasks] = useState<CronTask[]>([])
  const [loading, setLoading] = useState(false)
  const [slowLoading, setSlowLoading] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState<NewTaskForm>(defaultForm)

  // ── Fetch task list ──────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setSlowLoading(false)
    const t = setTimeout(() => setSlowLoading(true), 400)
    try {
      const { stdout } = await run(['cron', 'list'])
      setTasks(parseTaskList(stdout))
    } catch {
      setTasks([])
    } finally {
      clearTimeout(t)
      setLoading(false)
      setSlowLoading(false)
    }
  }, [run])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // ── Toggle enable/disable ────────────────────────────────────────────────────

  const handleToggle = async (task: CronTask) => {
    setTogglingId(task.id)
    try {
      const cmd = task.enabled ? 'disable' : 'enable'
      await run(['cron', cmd, task.id])
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, enabled: !t.enabled } : t))
      )
    } finally {
      setTogglingId(null)
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await run(['cron', 'delete', id])
      setTasks((prev) => prev.filter((t) => t.id !== id))
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  // ── Apply template ───────────────────────────────────────────────────────────

  const applyTemplate = (tpl: Template) => {
    setForm((prev) => ({
      ...prev,
      name: tpl.name,
      prompt: tpl.prompt,
      mode: tpl.mode,
      datetime: tpl.datetime ?? prev.datetime,
      interval: tpl.interval ?? prev.interval,
      unit: tpl.unit ?? prev.unit,
      cronExpr: tpl.cronExpr ?? prev.cronExpr,
    }))
    setDrawerOpen(true)
    setSaveError(null)
  }

  // ── Save new task ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaveError(null)
    if (!form.name.trim()) { setSaveError('请填写任务名称'); return }
    if (!form.prompt.trim()) { setSaveError('请填写执行指令 / Prompt'); return }
    const scheduleStr = buildSchedule(form)
    if (!scheduleStr) { setSaveError('请完整填写时间规则'); return }

    setSaving(true)
    try {
      const { exitCode, stderr } = await run([
        'cron', 'add',
        '--name', form.name.trim(),
        '--message', form.prompt.trim(),
        '--schedule', scheduleStr,
      ])
      if (exitCode !== 0) {
        setSaveError(stderr?.trim() || '创建失败，请检查参数')
        return
      }
      setDrawerOpen(false)
      setForm(defaultForm())
      await fetchTasks()
    } finally {
      setSaving(false)
    }
  }

  // ── UI ───────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#0f0f0f] text-white min-h-0">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a] shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-orange-400" />
          <h1 className="text-base font-semibold tracking-tight">
            Cron Tasks <span className="text-[#666] font-normal">· 定时任务</span>
          </h1>
          {tasks.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-[#1a1a1a] border border-[#2a2a2a] text-[#888]">
              {tasks.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTasks}
            disabled={loading}
            className="p-2 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-[#888] hover:text-white hover:border-[#3a3a3a] transition-colors disabled:opacity-50"
            title="刷新"
          >
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => { setForm(defaultForm()); setSaveError(null); setDrawerOpen(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
              bg-orange-500/20 text-orange-400 border border-orange-500/30
              hover:bg-orange-500/30 hover:border-orange-500/50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建任务
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Task list ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

          {/* Not installed warning */}
          {!ocInstalled && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
              <Clock className="w-4 h-4 shrink-0" />
              请先安装 OpenClaw CLI 再管理定时任务
            </div>
          )}

          {/* Loading skeleton — only shown after 400ms to avoid flash */}
          {loading && slowLoading && tasks.length === 0 && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] animate-pulse" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-[#555]">
              <div className="w-16 h-16 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                <Clock className="w-8 h-8 text-[#3a3a3a]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[#666]">任务列表为空 — No tasks yet</p>
                <p className="text-xs text-[#444] mt-1">点击右上角「新建任务」来创建第一个定时任务</p>
              </div>
              <button
                onClick={() => { setForm(defaultForm()); setSaveError(null); setDrawerOpen(true) }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                  bg-orange-500/20 text-orange-400 border border-orange-500/30
                  hover:bg-orange-500/30 transition-colors"
              >
                <Plus className="w-4 h-4" />
                新建第一个任务
              </button>
            </div>
          )}

          {/* Task cards */}
          {tasks.map((task) => (
            <div
              key={task.id}
              className="group flex items-start gap-4 p-4 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a]
                hover:border-[#3a3a3a] transition-colors"
            >
              {/* Left: toggle */}
              <button
                onClick={() => handleToggle(task)}
                disabled={togglingId === task.id}
                className={clsx(
                  'mt-0.5 shrink-0 transition-colors',
                  togglingId === task.id && 'opacity-50 cursor-wait',
                  task.enabled ? 'text-green-400 hover:text-green-300' : 'text-[#555] hover:text-[#888]'
                )}
                title={task.enabled ? '点击禁用' : '点击启用'}
              >
                {task.enabled
                  ? <ToggleRight className="w-6 h-6" />
                  : <ToggleLeft className="w-6 h-6" />
                }
              </button>

              {/* Center: info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">{task.name}</span>
                  <span
                    className={clsx(
                      'px-2 py-0.5 rounded-full text-xs border',
                      task.enabled
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-[#2a2a2a] text-[#666] border-[#333]'
                    )}
                  >
                    {task.enabled ? '运行中' : '已停用'}
                  </span>
                </div>

                {(task.description || task.prompt) && (
                  <p className="mt-1 text-xs text-[#888] line-clamp-2 leading-relaxed">
                    {(task.prompt || task.description || '').slice(0, 60)}
                    {(task.prompt || task.description || '').length > 60 ? '…' : ''}
                  </p>
                )}

                <div className="mt-2 flex items-center gap-1.5 text-xs text-[#555]">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <code className="font-mono text-[#666]">{task.schedule || '—'}</code>
                </div>
              </div>

              {/* Right: delete */}
              <div className="shrink-0">
                {confirmDeleteId === task.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#888]">确认删除?</span>
                    <button
                      onClick={() => handleDelete(task.id)}
                      disabled={deletingId === task.id}
                      className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400 border border-red-500/30
                        hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                      {deletingId === task.id ? '删除中…' : '确认'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 rounded text-xs bg-[#2a2a2a] text-[#888] border border-[#333]
                        hover:text-white transition-colors"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(task.id)}
                    className="p-1.5 rounded-lg text-[#444] hover:text-red-400 hover:bg-red-500/10
                      opacity-0 group-hover:opacity-100 transition-all"
                    title="删除任务"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Drawer ── */}
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
              onClick={() => !saving && setDrawerOpen(false)}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 bottom-0 z-40 w-[460px] max-w-full flex flex-col
              bg-[#111] border-l border-[#2a2a2a] shadow-2xl">

              {/* Drawer header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-semibold">新建定时任务</span>
                </div>
                <button
                  onClick={() => !saving && setDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-[#666] hover:text-white hover:bg-[#2a2a2a] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                {/* Templates */}
                <div>
                  <label className="block text-xs text-[#666] mb-2 uppercase tracking-wider">
                    快速模板
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.label}
                        onClick={() => applyTemplate(tpl)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs
                          bg-[#1a1a1a] border border-[#2a2a2a] text-[#aaa]
                          hover:border-orange-500/30 hover:text-orange-300 hover:bg-orange-500/5 transition-colors text-left"
                      >
                        <span className="text-base leading-none">{tpl.icon}</span>
                        <span>{tpl.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <hr className="border-[#2a2a2a]" />

                {/* Name */}
                <div>
                  <label className="block text-xs text-[#888] mb-1.5">
                    任务名称 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="例如：每日早报"
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]
                      text-sm text-white placeholder-[#444] focus:outline-none focus:border-orange-500/50
                      transition-colors"
                  />
                </div>

                {/* Prompt */}
                <div>
                  <label className="block text-xs text-[#888] mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <AlignLeft className="w-3.5 h-3.5" />
                      执行指令 / Prompt <span className="text-red-400">*</span>
                    </span>
                  </label>
                  <textarea
                    value={form.prompt}
                    onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
                    rows={4}
                    placeholder="发送给 Agent 的消息，例如：请生成今天的早报摘要…"
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]
                      text-sm text-white placeholder-[#444] focus:outline-none focus:border-orange-500/50
                      transition-colors resize-none leading-relaxed"
                  />
                </div>

                {/* Schedule type */}
                <div>
                  <label className="block text-xs text-[#888] mb-1.5">时间规则类型</label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
                    {(
                      [
                        { value: 'once', label: '单次', icon: Calendar },
                        { value: 'repeat', label: '重复', icon: Repeat },
                        { value: 'cron', label: 'Cron', icon: Clock },
                      ] as { value: ScheduleMode; label: string; icon: React.FC<{ className?: string }> }[]
                    ).map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => setForm((f) => ({ ...f, mode: value }))}
                        className={clsx(
                          'flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                          form.mode === value
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            : 'text-[#666] hover:text-[#aaa]'
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Schedule fields */}
                {form.mode === 'once' && (
                  <div>
                    <label className="block text-xs text-[#888] mb-1.5">执行时间</label>
                    <input
                      type="datetime-local"
                      value={form.datetime}
                      onChange={(e) => setForm((f) => ({ ...f, datetime: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]
                        text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors
                        [color-scheme:dark]"
                    />
                  </div>
                )}

                {form.mode === 'repeat' && (
                  <div>
                    <label className="block text-xs text-[#888] mb-1.5">执行间隔</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        value={form.interval}
                        onChange={(e) => setForm((f) => ({ ...f, interval: e.target.value }))}
                        className="w-24 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]
                          text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                      />
                      <select
                        value={form.unit}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, unit: e.target.value as NewTaskForm['unit'] }))
                        }
                        className="flex-1 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]
                          text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors
                          appearance-none cursor-pointer"
                      >
                        <option value="minutes">分钟</option>
                        <option value="hours">小时</option>
                        <option value="days">天</option>
                        <option value="weeks">周</option>
                      </select>
                    </div>
                  </div>
                )}

                {form.mode === 'cron' && (
                  <div>
                    <label className="block text-xs text-[#888] mb-1.5">
                      Cron 表达式
                      <span className="ml-2 text-[#555] font-normal normal-case">
                        （分 时 日 月 周）
                      </span>
                    </label>
                    <input
                      type="text"
                      value={form.cronExpr}
                      onChange={(e) => setForm((f) => ({ ...f, cronExpr: e.target.value }))}
                      placeholder="0 8 * * *"
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]
                        text-sm text-white font-mono placeholder-[#444] focus:outline-none
                        focus:border-orange-500/50 transition-colors"
                    />
                    <p className="mt-1 text-xs text-[#555]">
                      示例：<code className="text-[#666]">0 8 * * *</code> 每天8:00 ·{' '}
                      <code className="text-[#666]">0 9 * * 1</code> 每周一9:00
                    </p>
                  </div>
                )}

                {/* Error */}
                {saveError && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    <X className="w-4 h-4 shrink-0 mt-0.5" />
                    {saveError}
                  </div>
                )}
              </div>

              {/* Drawer footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#2a2a2a]">
                <button
                  onClick={() => !saving && setDrawerOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm text-[#888] bg-[#1a1a1a] border border-[#2a2a2a]
                    hover:text-white hover:border-[#3a3a3a] transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                    bg-orange-500/20 text-orange-400 border border-orange-500/30
                    hover:bg-orange-500/30 hover:border-orange-500/50 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      创建中…
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      创建任务
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
