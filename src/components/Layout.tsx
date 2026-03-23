import { ReactNode } from 'react'
import {
  LayoutDashboard,
  Zap,
  Bot,
  Radio,
  Puzzle,
  Settings,
  HeartPulse,
  Package,
  HelpCircle
} from 'lucide-react'
import { useStore } from '../store/useStore'
import clsx from 'clsx'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'gateway', label: 'Gateway', icon: Zap },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'channels', label: 'Channels', icon: Radio },
  { id: 'skills', label: 'Skills & Plugins', icon: Puzzle },
  { id: 'config', label: 'Config', icon: Settings },
  { id: 'doctor', label: 'Doctor', icon: HeartPulse },
  { id: 'install', label: 'Install', icon: Package },
]

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { activeTab, setActiveTab, gatewayRunning, ocInstalled, setShowWelcome } = useStore()

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

        {/* Status badges */}
        <div className="px-4 py-3 border-b border-[#2a2a2a] flex gap-2">
          <span className={clsx(
            'badge text-[10px]',
            ocInstalled
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          )}>
            {ocInstalled ? '✓ Installed' : '✗ Not Found'}
          </span>
          <span className={clsx(
            'badge text-[10px]',
            gatewayRunning
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-[#2a2a2a] text-[#666] border border-[#333]'
          )}>
            {gatewayRunning ? '● GW On' : '○ GW Off'}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 text-sm',
                activeTab === id
                  ? 'bg-orange-500/15 text-orange-400 font-medium'
                  : 'text-[#888] hover:text-[#e5e5e5] hover:bg-[#1a1a1a]'
              )}
            >
              <Icon
                size={16}
                className={clsx(
                  'flex-shrink-0',
                  activeTab === id ? 'text-orange-400' : 'text-[#555]'
                )}
              />
              {label}
              {id === 'gateway' && gatewayRunning && (
                <span className="ml-auto w-2 h-2 rounded-full bg-green-400 pulse-dot" />
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#2a2a2a] space-y-2">
          <button
            onClick={() => setShowWelcome(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[#666] hover:text-[#aaa] hover:bg-[#1a1a1a] transition-all text-xs"
          >
            <HelpCircle size={13} className="text-[#555]" />
            新手引导
          </button>
          <p className="text-[#333] text-[10px] text-center">OpenClaw Control v1.0.0</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  )
}
