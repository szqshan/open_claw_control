import { useEffect, useState, useCallback, useRef } from 'react'
import { Search, RefreshCw, Download, Check, Plus, X, ToggleLeft, ToggleRight, Info } from 'lucide-react'
import { useCLI } from '../hooks/useCLI'
import clsx from 'clsx'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MarketSkill {
  id: string
  name: string
  description: string
  category: string
  icon: string        // emoji or letter
  iconBg: string      // tailwind bg color
  author?: string
  hot?: boolean
}

interface InstalledSkill {
  name: string
  description?: string
  enabled: boolean
  version?: string
}

type TabId = 'store' | 'installed'
type Category = 'Featured' | 'General' | 'Creative' | 'Academic' | 'Development' | 'Legal' | 'Lifestyle' | 'Marketing' | 'Finance'

const CATEGORIES: Category[] = ['Featured', 'General', 'Creative', 'Academic', 'Development', 'Legal', 'Lifestyle', 'Marketing', 'Finance']

// ── Static skill catalog (fallback when CLI unavailable) ──────────────────────

const STATIC_SKILLS: MarketSkill[] = [
  // Featured
  { id: 'ppt-nano', name: 'PPT Nano', description: 'Generate whiteboard-style PPT slides with AI — marker handwriting aesthetic.', category: 'Featured', icon: 'P', iconBg: 'bg-orange-500', hot: true },
  { id: 'wechat-article', name: 'WeChat Article', description: 'Fu Sheng-style WeChat article creator: conversational, story-driven, opinionated.', category: 'Featured', icon: '🐾', iconBg: 'bg-red-500', hot: true },
  { id: 'educational-comic', name: 'Educational Comic Creator', description: 'Transform text into educational comics with support for multiple art styles.', category: 'Featured', icon: '💡', iconBg: 'bg-yellow-500' },
  { id: 'web-slides', name: 'Web Slides', description: 'One-click generation of web-based presentations, editable in browser.', category: 'Featured', icon: 'W', iconBg: 'bg-blue-500' },
  { id: 'ai-text-humanizer', name: 'AI Text Humanizer', description: 'Remove AI writing traces to make text sound natural and human.', category: 'Featured', icon: '✍', iconBg: 'bg-purple-500' },
  { id: 'daily-news-digest', name: 'Daily News Digest', description: 'Real-time aggregation of in-depth news from multiple sources, AI-powered.', category: 'Featured', icon: '📰', iconBg: 'bg-red-600' },
  { id: 'tech-news-curator', name: 'Tech News Curator', description: 'AI-powered tech digest from 90 top Hacker News blogs.', category: 'Featured', icon: '🦞', iconBg: 'bg-orange-600' },
  { id: 'x-twitter-automation', name: 'X/Twitter Automation', description: 'Automate X/Twitter via sh inference.sh CLI, supporting tweet posting, liking.', category: 'Featured', icon: 'X', iconBg: 'bg-black border border-[#333]' },
  { id: 'tavily-web-search', name: 'Tavily Web Search', description: 'Search the web via Tavily API, returning relevant page titles, URLs, and content.', category: 'Featured', icon: '↑', iconBg: 'bg-orange-400' },
  { id: 'github-cli', name: 'GitHub CLI Operations', description: 'Integrates core GitHub CLI features, supports managing PRs, tracking Issues.', category: 'Featured', icon: '⬤', iconBg: 'bg-gray-800' },
  { id: 'web-design-optimizer', name: 'Web Design Optimizer', description: 'Provides responsive layout design and rapid UI component generation.', category: 'Featured', icon: 'W', iconBg: 'bg-teal-600' },
  { id: 'visual-design-creator', name: 'Visual Design Creator', description: 'Full-process support from design concept to final deliverable.', category: 'Featured', icon: '🎨', iconBg: 'bg-pink-500' },
  { id: 'ai-auto-evolution', name: 'AI Auto-Evolution', description: 'Automatically and continuously learns from interactions to improve responses.', category: 'Featured', icon: '📈', iconBg: 'bg-green-600' },
  // Development
  { id: 'code-runner', name: 'Code Runner', description: 'Execute code snippets in multiple languages with sandboxed environment.', category: 'Development', icon: '▷', iconBg: 'bg-green-700' },
  { id: 'code-reviewer', name: 'Code Reviewer', description: 'Automated code review with security scanning and best practice suggestions.', category: 'Development', icon: '🔍', iconBg: 'bg-blue-700' },
  { id: 'database-query', name: 'Database Query', description: 'Natural language to SQL conversion, supports MySQL/PostgreSQL/SQLite.', category: 'Development', icon: 'DB', iconBg: 'bg-indigo-600' },
  { id: 'api-tester', name: 'API Tester', description: 'Test REST APIs directly from chat, supports all HTTP methods.', category: 'Development', icon: 'API', iconBg: 'bg-violet-600' },
  // General
  { id: 'web-search', name: 'Web Search', description: 'Real-time web search with result summarization and source citations.', category: 'General', icon: '🔍', iconBg: 'bg-blue-500' },
  { id: 'file-manager', name: 'File Manager', description: 'Read, write, and manage files on your local system.', category: 'General', icon: '📁', iconBg: 'bg-yellow-600' },
  { id: 'email-assistant', name: 'Email Assistant', description: 'Draft, summarize and send emails via SMTP integration.', category: 'General', icon: '✉', iconBg: 'bg-sky-600' },
  { id: 'calendar-manager', name: 'Calendar Manager', description: 'Create and manage calendar events with natural language.', category: 'General', icon: '📅', iconBg: 'bg-red-500' },
  // Creative
  { id: 'image-gen', name: 'Image Generator', description: 'Generate images from text descriptions using DALL-E or Stable Diffusion.', category: 'Creative', icon: '🖼', iconBg: 'bg-pink-600' },
  { id: 'story-writer', name: 'Story Writer', description: 'Long-form creative writing assistant with plot development support.', category: 'Creative', icon: '📖', iconBg: 'bg-purple-600' },
  // Academic
  { id: 'research-assistant', name: 'Research Assistant', description: 'Academic paper search, summarization and citation management.', category: 'Academic', icon: '🎓', iconBg: 'bg-blue-800' },
  { id: 'math-solver', name: 'Math Solver', description: 'Step-by-step solutions for algebra, calculus, and statistics problems.', category: 'Academic', icon: 'Σ', iconBg: 'bg-green-800' },
  // Marketing
  { id: 'seo-optimizer', name: 'SEO Optimizer', description: 'Keyword analysis, meta tag generation, and content optimization.', category: 'Marketing', icon: '📊', iconBg: 'bg-orange-600' },
  { id: 'ad-copy-writer', name: 'Ad Copy Writer', description: 'Generate compelling ad copy for Google, Facebook, and Xiaohongshu.', category: 'Marketing', icon: '📣', iconBg: 'bg-red-600' },
  // Finance
  { id: 'financial-analyzer', name: 'Financial Analyzer', description: 'Analyze financial data, generate reports and investment insights.', category: 'Finance', icon: '💹', iconBg: 'bg-green-700' },
  // Legal
  { id: 'contract-reviewer', name: 'Contract Reviewer', description: 'Review contracts for risks, ambiguities and standard clause compliance.', category: 'Legal', icon: '⚖', iconBg: 'bg-gray-700' },
  // Lifestyle
  { id: 'meal-planner', name: 'Meal Planner', description: 'Personalized meal plans, recipes and grocery lists.', category: 'Lifestyle', icon: '🍽', iconBg: 'bg-orange-500' },
  { id: 'fitness-coach', name: 'Fitness Coach', description: 'Custom workout plans and progress tracking.', category: 'Lifestyle', icon: '💪', iconBg: 'bg-blue-600' },
]

// ── Install progress modal ────────────────────────────────────────────────────

interface InstallModalProps {
  skill: MarketSkill
  onClose: () => void
  onSuccess: () => void
}

function InstallModal({ skill, onClose, onSuccess }: InstallModalProps) {
  const { stream } = useCLI()
  const [logs, setLogs] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && done) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [done, onClose])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  useEffect(() => {
    let cancelled = false
    setLogs([`Installing clawhub:${skill.id}...`])
    stream(['plugins', 'install', `clawhub:${skill.id}`], (line) => {
      if (!cancelled && line.trim()) setLogs(p => [...p, line])
    }).then(() => {
      if (!cancelled) {
        setLogs(p => [...p, '✓ Installation complete!'])
        setDone(true)
        setTimeout(() => onSuccess(), 1200)
      }
    }).catch((err: unknown) => {
      if (!cancelled) {
        setError(String(err))
        setDone(true)
      }
    })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold', skill.iconBg)}>
              {skill.icon}
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Installing {skill.name}</h3>
              <p className="text-[#555] text-xs">clawhub:{skill.id}</p>
            </div>
          </div>
          {done && (
            <button onClick={onClose} className="text-[#555] hover:text-white transition-colors">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="p-5">
          <div className="bg-black rounded-lg border border-[#2a2a2a] p-4 h-48 overflow-y-auto font-mono text-xs">
            {logs.map((log, i) => (
              <div key={i} className={clsx('mb-0.5', log.startsWith('✓') ? 'text-green-400' : 'text-[#aaa]')}>
                {log}
              </div>
            ))}
            {!done && (
              <span className="text-orange-400 animate-pulse">▋</span>
            )}
            <div ref={logsEndRef} />
          </div>
          {error && (
            <div className="mt-3 text-sm text-red-400 rounded-lg bg-red-500/5 border border-red-500/20 p-3">{error}</div>
          )}
          {done && !error && (
            <div className="mt-3 flex items-center gap-2 text-sm text-green-400">
              <Check size={16} /> 安装成功！页面将自动刷新。
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Skill Card ────────────────────────────────────────────────────────────────

interface SkillCardProps {
  skill: MarketSkill
  installed: boolean
  onInstall: () => void
}

function SkillCard({ skill, installed, onInstall }: SkillCardProps) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-[#1a1a1a] transition-colors group cursor-default border border-transparent hover:border-[#2a2a2a]">
      {/* Icon */}
      <div className={clsx(
        'w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0 relative',
        skill.iconBg
      )}>
        {typeof skill.icon === 'string' && skill.icon.length <= 2
          ? <span className="text-base font-bold">{skill.icon}</span>
          : <span className="text-2xl">{skill.icon}</span>
        }
        {skill.hot && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded">HOT</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[#e5e5e5] font-semibold text-sm leading-tight">{skill.name}</h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            {installed ? (
              <span className="text-xs text-green-400 border border-green-500/30 bg-green-500/10 px-2 py-0.5 rounded-full">Added</span>
            ) : (
              <button
                onClick={onInstall}
                className="text-[#555] hover:text-orange-400 transition-colors opacity-0 group-hover:opacity-100"
                title={`Install ${skill.name}`}
              >
                <Download size={18} />
              </button>
            )}
          </div>
        </div>
        <p className="text-[#777] text-xs mt-1 leading-relaxed line-clamp-2">{skill.description}</p>
        {skill.author && (
          <p className="text-[#444] text-xs mt-1">by {skill.author}</p>
        )}
      </div>
    </div>
  )
}

// ── Installed Skill Row ───────────────────────────────────────────────────────

interface InstalledSkillRowProps {
  skill: InstalledSkill
  toggling: boolean
  onToggle: () => void
  onUninstall: () => void
}

function InstalledSkillRow({ skill, toggling, onToggle, onUninstall }: InstalledSkillRowProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#333] transition-all">
      <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
        <span className="text-purple-400 text-sm font-bold">{skill.name[0]?.toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{skill.name}</p>
        {skill.description && (
          <p className="text-[#666] text-xs mt-0.5 truncate">{skill.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {skill.version && <span className="text-[#444] text-xs font-mono">v{skill.version}</span>}
        <button
          onClick={onToggle}
          disabled={toggling}
          className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-all',
            skill.enabled
              ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
              : 'bg-[#222] text-[#666] border-[#333] hover:text-white',
            toggling && 'opacity-50 cursor-not-allowed'
          )}
        >
          {toggling ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : skill.enabled ? (
            <ToggleRight size={14} />
          ) : (
            <ToggleLeft size={14} />
          )}
          {skill.enabled ? '已启用' : '已禁用'}
        </button>
        <button
          onClick={onUninstall}
          className="text-[#555] hover:text-red-400 transition-colors p-1"
          title="卸载"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Skills() {
  const { run, stream } = useCLI()

  const [tab, setTab] = useState<TabId>('store')
  const [category, setCategory] = useState<Category>('Featured')
  const [search, setSearch] = useState('')
  const [storeSkills, setStoreSkills] = useState<MarketSkill[]>(STATIC_SKILLS)
  const [installed, setInstalled] = useState<InstalledSkill[]>([])
  const [loadingStore, setLoadingStore] = useState(false)
  const [loadingInstalled, setLoadingInstalled] = useState(false)
  const [installingModal, setInstallingModal] = useState<MarketSkill | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // ── Load marketplace ────────────────────────────────────────────────────────

  const loadMarketplace = useCallback(async () => {
    setLoadingStore(true)
    try {
      const res = await run(['plugins', 'marketplace', 'list', 'clawhub'])
      if (res.exitCode === 0 && res.stdout.trim()) {
        try {
          const parsed = JSON.parse(res.stdout)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setStoreSkills(parsed.map((s: Record<string, unknown>) => ({
              id: String(s.id || s.name || ''),
              name: String(s.name || s.id || ''),
              description: String(s.description || s.desc || ''),
              category: String(s.category || 'General') as Category,
              icon: String(s.icon || (s.name as string)?.[0]?.toUpperCase() || '?'),
              iconBg: String(s.iconBg || 'bg-blue-600'),
              author: s.author ? String(s.author) : undefined,
              hot: Boolean(s.hot || s.featured),
            })))
          }
        } catch { /* keep static */ }
      }
    } catch { /* keep static */ }
    finally { setLoadingStore(false) }
  }, [run])

  // ── Load installed ──────────────────────────────────────────────────────────

  const loadInstalled = useCallback(async () => {
    setLoadingInstalled(true)
    try {
      const res = await run(['plugins', 'list'])
      if (res.exitCode === 0) {
        try {
          const parsed = JSON.parse(res.stdout)
          if (Array.isArray(parsed)) {
            setInstalled(parsed.map((p: Record<string, unknown>) => ({
              name: String(p.name || ''),
              description: String(p.description || p.desc || ''),
              enabled: p.enabled === true || String(p.status) === 'enabled',
              version: p.version ? String(p.version) : undefined,
            })))
            return
          }
        } catch { /* text parse */ }
        // text fallback
        const lines = res.stdout.trim().split('\n').filter(l => l.trim() && !l.startsWith('NAME') && !l.startsWith('---'))
        setInstalled(lines.map(line => {
          const parts = line.split(/\s{2,}/).filter(p => p.trim())
          return {
            name: parts[0] || '',
            description: parts[2] || '',
            enabled: (parts[1] || '').toLowerCase().includes('enabl'),
            version: parts[3] || undefined,
          }
        }).filter(s => s.name))
      }
    } catch { /* ignore */ }
    finally { setLoadingInstalled(false) }
  }, [run])

  useEffect(() => {
    loadMarketplace()
    loadInstalled()
  }, [loadMarketplace, loadInstalled])

  // ── Toggle skill ────────────────────────────────────────────────────────────

  const handleToggle = async (skill: InstalledSkill) => {
    setTogglingId(skill.name)
    try {
      await run(['plugins', skill.enabled ? 'disable' : 'enable', skill.name])
      setInstalled(prev => prev.map(s => s.name === skill.name ? { ...s, enabled: !s.enabled } : s))
    } catch { /* ignore */ }
    setTogglingId(null)
  }

  const handleUninstall = async (name: string) => {
    try {
      await run(['plugins', 'uninstall', name])
      setInstalled(prev => prev.filter(s => s.name !== name))
    } catch { /* ignore */ }
  }

  // ── Filter skills ───────────────────────────────────────────────────────────

  const installedIds = new Set(installed.map(s => s.name.toLowerCase()))

  const filteredStore = storeSkills.filter(s => {
    const matchCat = s.category === category
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const filteredInstalled = installed.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim()) {
      // trigger search across all categories
      setCategory('Featured')
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0f0f0f' }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#1e1e1e] flex-shrink-0">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-[#1a1a1a] rounded-lg p-1">
          <button
            onClick={() => setTab('store')}
            className={clsx(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
              tab === 'store' ? 'bg-white text-black shadow-sm' : 'text-[#888] hover:text-white'
            )}
          >
            Skill Store
          </button>
          <button
            onClick={() => { setTab('installed'); loadInstalled() }}
            className={clsx(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
              tab === 'installed' ? 'bg-white text-black shadow-sm' : 'text-[#888] hover:text-white'
            )}
          >
            已安装 · My Skills
            {installed.length > 0 && (
              <span className="ml-2 text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">
                {installed.length}
              </span>
            )}
          </button>
        </div>

        {/* Search + actions */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search skills, press Enter↵"
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#3a3a3a] w-56 transition-colors"
            />
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#111] border border-[#2a2a2a] text-[#aaa] text-sm font-medium hover:bg-[#1a1a1a] hover:text-white transition-all"
            onClick={() => { /* TODO: Create Skill */ }}
          >
            <Plus size={14} />
            Create Skill
          </button>
        </div>
      </div>

      {tab === 'store' && (
        <>
          {/* ── Featured notice ── */}
          <div className="flex items-center gap-2 px-6 py-2.5 border-b border-[#1a1a1a] flex-shrink-0">
            <Info size={13} className="text-[#555] flex-shrink-0" />
            <p className="text-[#555] text-xs">Featured professional skills, safe and reliable. We recommend enabling only one skill per function.</p>
          </div>

          {/* ── Category tabs ── */}
          <div className="flex items-center gap-0 px-6 border-b border-[#1a1a1a] flex-shrink-0 overflow-x-auto">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={clsx(
                  'px-4 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px relative',
                  category === cat
                    ? 'text-white border-white'
                    : 'text-[#666] border-transparent hover:text-[#aaa]'
                )}
              >
                {cat}
                {cat === 'Featured' && (
                  <span className="ml-1.5 text-[9px] bg-orange-500 text-white px-1 py-0.5 rounded font-bold">HOT</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Skill grid ── */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loadingStore ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-xl bg-[#1a1a1a] animate-pulse" />
                ))}
              </div>
            ) : filteredStore.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#555]">
                <p className="text-sm">No skills found for "{search}"</p>
                <button onClick={() => setSearch('')} className="mt-2 text-xs text-orange-400 hover:underline">Clear search</button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {filteredStore.map(skill => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    installed={installedIds.has(skill.id) || installedIds.has(skill.name.toLowerCase())}
                    onInstall={() => setInstallingModal(skill)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'installed' && (
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[#666] text-sm">{filteredInstalled.length} 个已安装</p>
            <button
              onClick={loadInstalled}
              disabled={loadingInstalled}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] text-xs hover:text-white transition-all"
            >
              <RefreshCw size={12} className={loadingInstalled ? 'animate-spin' : ''} />
              刷新
            </button>
          </div>

          {loadingInstalled ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-[#1a1a1a] animate-pulse" />
              ))}
            </div>
          ) : filteredInstalled.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Download size={40} className="text-[#333] mb-3" />
              <p className="text-[#666] font-medium">暂无已安装技能</p>
              <p className="text-[#444] text-sm mt-1 mb-4">去 Skill Store 浏览并安装技能</p>
              <button
                onClick={() => setTab('store')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/15 border border-orange-500/25 text-orange-400 text-sm hover:bg-orange-500/25 transition-all"
              >
                浏览 Skill Store
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredInstalled.map(skill => (
                <InstalledSkillRow
                  key={skill.name}
                  skill={skill}
                  toggling={togglingId === skill.name}
                  onToggle={() => handleToggle(skill)}
                  onUninstall={() => handleUninstall(skill.name)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Install modal */}
      {installingModal && (
        <InstallModal
          skill={installingModal}
          onClose={() => setInstallingModal(null)}
          onSuccess={() => { setInstallingModal(null); loadInstalled() }}
        />
      )}
    </div>
  )
}
