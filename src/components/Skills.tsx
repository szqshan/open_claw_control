import { useEffect, useState } from 'react'
import { Puzzle, RefreshCw, Search, Download, ToggleLeft, ToggleRight, CheckCircle, XCircle, Package } from 'lucide-react'
import { useCLI } from '../hooks/useCLI'
import { useStore } from '../store/useStore'
import clsx from 'clsx'

interface Skill {
  name: string
  description?: string
  status?: string
  version?: string
}

interface Plugin {
  name: string
  description?: string
  enabled: boolean
  version?: string
}

type TabId = 'skills' | 'plugins' | 'clawhub'

export default function Skills() {
  const { ocInstalled } = useStore()
  const { run, stream } = useCLI()
  const [activeTab, setActiveTab] = useState<TabId>('skills')
  const [skills, setSkills] = useState<Skill[]>([])
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(false)

  // Skills search filter
  const [skillSearch, setSkillSearch] = useState('')

  // ClaWHub
  const [hubSearch, setHubSearch] = useState('')
  const [hubInstalling, setHubInstalling] = useState<string | null>(null)
  const [hubLogs, setHubLogs] = useState<string[]>([])

  // Plugin toggles
  const [togglingPlugin, setTogglingPlugin] = useState<string | null>(null)

  const parseList = (output: string, nameCol = 0): Skill[] => {
    try {
      const parsed = JSON.parse(output)
      if (Array.isArray(parsed)) return parsed.map((s: Record<string, unknown>) => ({
        name: String(s.name || ''),
        description: String(s.description || s.desc || ''),
        status: String(s.status || ''),
        version: String(s.version || '')
      }))
    } catch {
      // text parse
    }
    return output.trim().split('\n')
      .filter(l => l.trim() && !l.startsWith('NAME') && !l.startsWith('---'))
      .map(line => {
        const parts = line.split(/\s{2,}/).filter(p => p.trim())
        return {
          name: parts[nameCol]?.trim() || '',
          description: parts[nameCol + 1]?.trim() || '',
          status: parts[nameCol + 2]?.trim() || '',
          version: parts[nameCol + 3]?.trim() || ''
        }
      }).filter(s => s.name)
  }

  const parsePlugins = (output: string): Plugin[] => {
    try {
      const parsed = JSON.parse(output)
      if (Array.isArray(parsed)) return parsed.map((p: Record<string, unknown>) => ({
        name: String(p.name || ''),
        description: String(p.description || p.desc || ''),
        enabled: p.enabled === true || p.status === 'enabled',
        version: String(p.version || '')
      }))
    } catch {
      // text parse
    }
    return output.trim().split('\n')
      .filter(l => l.trim() && !l.startsWith('NAME') && !l.startsWith('---'))
      .map(line => {
        const parts = line.split(/\s{2,}/).filter(p => p.trim())
        const enabled = parts[1]?.toLowerCase().includes('enable') || parts[1]?.toLowerCase() === 'true'
        return {
          name: parts[0]?.trim() || '',
          description: parts[2]?.trim() || '',
          enabled,
          version: parts[3]?.trim() || ''
        }
      }).filter(p => p.name)
  }

  const loadSkills = async () => {
    setLoading(true)
    try {
      const res = await run(['skills', 'list'])
      if (res.exitCode === 0) setSkills(parseList(res.stdout))
    } catch { /* ignore */ }
    setLoading(false)
  }

  const loadPlugins = async () => {
    setLoading(true)
    try {
      const res = await run(['plugins', 'list'])
      if (res.exitCode === 0) setPlugins(parsePlugins(res.stdout))
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => {
    if (!ocInstalled) return
    if (activeTab === 'skills') loadSkills()
    if (activeTab === 'plugins') loadPlugins()
  }, [activeTab, ocInstalled])

  const handleTogglePlugin = async (plugin: Plugin) => {
    setTogglingPlugin(plugin.name)
    try {
      const action = plugin.enabled ? 'disable' : 'enable'
      const res = await run(['plugins', action, plugin.name])
      if (res.exitCode === 0) {
        setPlugins(prev => prev.map(p => p.name === plugin.name ? { ...p, enabled: !p.enabled } : p))
      }
    } catch { /* ignore */ }
    setTogglingPlugin(null)
  }

  const handleClawhubInstall = async () => {
    const name = hubSearch.trim()
    if (!name) return
    setHubInstalling(name)
    setHubLogs([])
    try {
      await stream(['clawhub', 'install', name], (line, type) => {
        if (line.trim()) {
          setHubLogs(prev => [...prev, line])
        }
      })
    } catch (err) {
      setHubLogs(prev => [...prev, 'Error: ' + String(err)])
    } finally {
      setHubInstalling(null)
    }
  }

  const TABS: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
    { id: 'skills', label: '已安装', icon: Puzzle },
    { id: 'plugins', label: 'Plugins', icon: Package },
    { id: 'clawhub', label: 'ClaWHub', icon: Download },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Skills & Plugins</h1>
        <p className="text-[#666] text-sm mt-0.5">管理技能、插件和社区扩展</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[#2a2a2a]">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={clsx(
              'flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all',
              activeTab === id ? 'tab-active' : 'tab-inactive'
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Skills Tab */}
      {activeTab === 'skills' && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
            <input
              type="text"
              value={skillSearch}
              onChange={e => setSkillSearch(e.target.value)}
              placeholder="搜索已安装技能..."
              className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm placeholder-[#444] focus:outline-none focus:border-orange-500/50"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[#666] text-sm">{skills.length} 个技能</p>
            <div className="flex gap-2">
              <button
                onClick={() => run(['skills', 'check']).then(loadSkills)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] text-xs hover:text-white transition-all"
              >
                <CheckCircle size={12} />
                检查状态
              </button>
              <button
                onClick={loadSkills}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] text-xs hover:text-white transition-all"
              >
                <RefreshCw size={12} className={loading ? 'spinner' : ''} />
                刷新
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#555]">
              <RefreshCw size={18} className="spinner mr-3" />
              加载中...
            </div>
          ) : skills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Puzzle size={40} className="text-[#333] mb-3" />
              <p className="text-[#666]">暂无技能</p>
            </div>
          ) : (
            <div className="space-y-2">
              {skills.filter(s => !skillSearch || s.name.toLowerCase().includes(skillSearch.toLowerCase())).map(skill => (
                <div key={skill.name} className="flex items-center justify-between rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-5 py-3.5 hover:border-[#3a3a3a] transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Puzzle size={15} className="text-purple-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{skill.name}</p>
                      {skill.description && (
                        <p className="text-[#666] text-xs mt-0.5">{skill.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {skill.version && (
                      <span className="text-[#555] text-xs font-mono">v{skill.version}</span>
                    )}
                    {skill.status && (
                      <span className={clsx(
                        'badge border text-xs',
                        skill.status.toLowerCase().includes('ok') || skill.status.toLowerCase().includes('active')
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : 'bg-[#2a2a2a] text-[#888] border-[#333]'
                      )}>
                        {skill.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Plugins Tab */}
      {activeTab === 'plugins' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[#666] text-sm">{plugins.length} 个插件</p>
            <button
              onClick={loadPlugins}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] text-xs hover:text-white transition-all"
            >
              <RefreshCw size={12} className={loading ? 'spinner' : ''} />
              刷新
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#555]">
              <RefreshCw size={18} className="spinner mr-3" />
              加载中...
            </div>
          ) : plugins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package size={40} className="text-[#333] mb-3" />
              <p className="text-[#666]">暂无插件</p>
            </div>
          ) : (
            <div className="space-y-2">
              {plugins.map(plugin => (
                <div key={plugin.name} className="flex items-center justify-between rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-5 py-3.5 hover:border-[#3a3a3a] transition-all">
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      plugin.enabled ? 'bg-green-500/20' : 'bg-[#2a2a2a]'
                    )}>
                      <Package size={15} className={plugin.enabled ? 'text-green-400' : 'text-[#555]'} />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{plugin.name}</p>
                      {plugin.description && (
                        <p className="text-[#666] text-xs mt-0.5">{plugin.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {plugin.version && (
                      <span className="text-[#555] text-xs font-mono">v{plugin.version}</span>
                    )}
                    <button
                      onClick={() => handleTogglePlugin(plugin)}
                      disabled={togglingPlugin === plugin.name}
                      className={clsx(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all border',
                        plugin.enabled
                          ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                          : 'bg-[#2a2a2a] text-[#666] border-[#333] hover:text-white',
                        togglingPlugin === plugin.name && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {togglingPlugin === plugin.name ? (
                        <RefreshCw size={12} className="spinner" />
                      ) : plugin.enabled ? (
                        <ToggleRight size={14} />
                      ) : (
                        <ToggleLeft size={14} />
                      )}
                      {plugin.enabled ? '已启用' : '已禁用'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ClaWHub Tab */}
      {activeTab === 'clawhub' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
            <p className="text-orange-300 text-sm font-medium mb-1">ClaWHub 社区注册表</p>
            <p className="text-orange-300/60 text-xs">从 OpenClaw 社区注册表安装技能和扩展</p>
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
              <input
                type="text"
                value={hubSearch}
                onChange={e => setHubSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleClawhubInstall()}
                placeholder="输入 skill 名称，如: web-search、code-runner..."
                className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm placeholder-[#444] focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <button
              onClick={handleClawhubInstall}
              disabled={!!hubInstalling || !hubSearch.trim() || !ocInstalled}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-500/20 text-orange-400 text-sm font-medium hover:bg-orange-500/30 transition-all border border-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {hubInstalling ? <RefreshCw size={14} className="spinner" /> : <Download size={14} />}
              安装
            </button>
          </div>

          {/* Install log */}
          <div>
            <p className="text-xs text-[#666] mb-2 uppercase tracking-wider">安装日志</p>
            <div className="terminal rounded-lg p-4 h-64 overflow-y-auto">
              {hubLogs.length === 0 ? (
                <p className="text-[#444] text-xs">
                  {hubInstalling ? '正在安装...' : '输入 skill 名称并点击安装'}
                </p>
              ) : (
                hubLogs.map((log, i) => (
                  <div key={i} className="text-xs mb-0.5">{log}</div>
                ))
              )}
            </div>
          </div>

          {/* Popular skills hint */}
          <div>
            <p className="text-xs text-[#555] mb-3 uppercase tracking-wider">常用技能参考</p>
            <div className="grid grid-cols-2 gap-2">
              {['web-search', 'code-runner', 'file-manager', 'database', 'image-gen', 'email'].map(skill => (
                <button
                  key={skill}
                  onClick={() => setHubSearch(skill)}
                  className="text-left px-4 py-2.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] hover:border-orange-500/30 hover:bg-[#1f1f1f] transition-all"
                >
                  <p className="text-white text-sm font-mono">{skill}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
