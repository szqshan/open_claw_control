import { ReactNode } from 'react'
import {
  LayoutDashboard,
  Zap,
  Bot,
  Radio,
  Settings,
  Package,
  HelpCircle,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Circle,
  Globe,
  MessageSquare,
  Clock,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import clsx from 'clsx'

// Nav items split into setup (always visible) and advanced (secondary)
const SETUP_NAV = [
  { id: 'dashboard', label: 'Dashboard · 首页',   icon: LayoutDashboard },
  { id: 'chat',      label: 'Chat · 聊天',         icon: MessageSquare },
  { id: 'install',   label: 'Install · 安装配置',  icon: Package },
  { id: 'gateway',   label: 'Gateway',             icon: Zap },
]

const ADVANCED_NAV = [
  { id: 'agents',   label: 'Agents',            icon: Bot },
  { id: 'channels', label: 'Channels',          icon: Radio },
  { id: 'cron',     label: 'Cron Tasks · 定时', icon: Clock },
  { id: 'config',   label: 'Config · 配置',     icon: Settings },
]

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { activeTab, setActiveTab, gatewayRunning, ocInstalled, setShowWelcome } = useStore()

  // Derive status indicators for setup nav items
  const getStatusIcon = (id: string) => {
    switch (id) {
      case 'install':
        return ocInstalled
          ? <CheckCircle size={11} className="text-green-400 flex-shrink-0" />
          : <AlertCircle size={11} className="text-orange-400 flex-shrink-0" />
      case 'gateway':
        return gatewayRunning
          ? <span className="w-2 h-2 rounded-full bg-green-400 pulse-dot flex-shrink-0" />
          : <span className="w-2 h-2 rounded-full border border-[#444] flex-shrink-0" />
      case 'config':
        return <Circle size={11} className="text-[#444] flex-shrink-0" />
      default:
        return null
    }
  }

  const openWebDashboard = async () => {
    try {
      const url = await window.openclaw.getDashboardUrl()
      if (url) window.openclaw.openExternal(url)
      else setActiveTab('chat') // fallback: open WebDashboard tab
    } catch {
      setActiveTab('chat')
    }
  }

  // Current next-step hint for sidebar footer
  const nextStep = !ocInstalled
    ? { label: '安装 OpenClaw', tab: 'install', color: 'text-orange-400' }
    : !gatewayRunning
    ? { label: '启动 Gateway', tab: 'gateway', color: 'text-green-400' }
    : null

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0f0f0f' }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col w-56 flex-shrink-0 border-r border-[#2a2a2a]"
        style={{ background: '#111111' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[#2a2a2a]">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-base select-none">🦞</span>
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">OpenClaw</div>
            <div className="text-[#666] text-xs">Control Panel</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {/* Setup section */}
          {SETUP_NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all duration-150 text-sm',
                activeTab === id
                  ? 'bg-orange-500/15 text-orange-400 font-medium'
                  : 'text-[#888] hover:text-[#e5e5e5] hover:bg-[#1a1a1a]'
              )}
            >
              <Icon size={15} className={clsx('flex-shrink-0', activeTab === id ? 'text-orange-400' : 'text-[#555]')} />
              <span className="flex-1 truncate">{label}</span>
              {getStatusIcon(id)}
            </button>
          ))}

          {/* Advanced section divider */}
          <div className="pt-3 pb-1.5 px-1">
            <p className="text-[#333] text-[10px] uppercase tracking-widest font-semibold">高级管理</p>
          </div>

          {ADVANCED_NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all duration-150 text-sm',
                activeTab === id
                  ? 'bg-orange-500/15 text-orange-400 font-medium'
                  : 'text-[#555] hover:text-[#ccc] hover:bg-[#1a1a1a]'
              )}
            >
              <Icon size={15} className={clsx('flex-shrink-0', activeTab === id ? 'text-orange-400' : 'text-[#3a3a3a]')} />
              <span className="flex-1 truncate">{label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-[#1e1e1e]">
          {/* Next step hint */}
          {nextStep && (
            <button
              onClick={() => setActiveTab(nextStep.tab)}
              className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-[#1e1e1e] hover:bg-[#1a1a1a] transition-all group"
            >
              <span className="flex-1 text-left">
                <span className="block text-[#444] text-[9px] uppercase tracking-widest">下一步</span>
                <span className={clsx('text-xs font-medium', nextStep.color)}>{nextStep.label}</span>
              </span>
              <ChevronRight size={12} className="text-[#333] group-hover:text-[#666] transition-colors" />
            </button>
          )}

          {/* Help & version */}
          <div className="px-4 py-3 space-y-1.5">
            {/* Open Web Dashboard floating button */}
            {gatewayRunning && (
              <button
                onClick={openWebDashboard}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-green-500/70 hover:text-green-400 hover:bg-green-500/10 transition-all text-xs border border-green-500/20"
              >
                <Globe size={13} />
                打开 Web 仪表盘
              </button>
            )}
            <button
              onClick={() => setShowWelcome(true)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[#555] hover:text-[#aaa] hover:bg-[#1a1a1a] transition-all text-xs"
            >
              <HelpCircle size={13} />
              新手引导
            </button>
            <p className="text-[#2a2a2a] text-[10px] text-center">OpenClaw Control v1.0.0</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  )
}
