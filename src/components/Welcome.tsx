import { Package, Settings, Zap, MessageSquare, X, ArrowRight, ChevronRight } from 'lucide-react'
import { useStore } from '../store/useStore'
import clsx from 'clsx'

const STEPS = [
  {
    num: 1,
    icon: Package,
    color: 'orange',
    title: '安装 OpenClaw',
    desc: '运行一条命令，把 OpenClaw 安装到你的电脑上',
    detail: 'npm install -g openclaw',
    tab: 'install',
    cta: '去安装',
  },
  {
    num: 2,
    icon: Settings,
    color: 'blue',
    title: '配置 AI 模型',
    desc: '填入 API Key 和模型名称，点击"测试连接"验证',
    detail: '需要：API 地址 + API Key + 模型名',
    tab: 'install',
    cta: '去配置',
  },
  {
    num: 3,
    icon: Zap,
    color: 'green',
    title: '启动 Gateway',
    desc: 'Gateway 是本地小服务器，微信/飞书的消息通过它传给 AI',
    detail: '端口 18789 · 不启动则 AI 收不到消息',
    tab: 'gateway',
    cta: '去启动',
  },
  {
    num: 4,
    icon: MessageSquare,
    color: 'purple',
    title: '连接微信 / 飞书',
    desc: '安装消息渠道插件，之后就能直接和 AI 聊天',
    detail: '支持微信个人号、企业微信、飞书',
    tab: 'install',
    cta: '去连接',
  },
]

const colorMap: Record<string, { bg: string; border: string; text: string; icon: string; num: string }> = {
  orange: {
    bg: 'bg-orange-500/8',
    border: 'border-orange-500/20',
    text: 'text-orange-300',
    icon: 'text-orange-400',
    num: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  },
  blue: {
    bg: 'bg-blue-500/8',
    border: 'border-blue-500/20',
    text: 'text-blue-300',
    icon: 'text-blue-400',
    num: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  green: {
    bg: 'bg-green-500/8',
    border: 'border-green-500/20',
    text: 'text-green-300',
    icon: 'text-green-400',
    num: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
  purple: {
    bg: 'bg-purple-500/8',
    border: 'border-purple-500/20',
    text: 'text-purple-300',
    icon: 'text-purple-400',
    num: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
}

interface WelcomeProps {
  onClose: () => void
}

export default function Welcome({ onClose }: WelcomeProps) {
  const { setActiveTab, ocInstalled, gatewayRunning } = useStore()

  const handleStep = (tab: string) => {
    setActiveTab(tab)
    onClose()
  }

  const handleStart = () => {
    // Navigate to the first incomplete step
    if (!ocInstalled) {
      setActiveTab('install')
    } else if (!gatewayRunning) {
      setActiveTab('gateway')
    } else {
      setActiveTab('dashboard')
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="relative w-full max-w-xl mx-4 rounded-2xl border border-[#2a2a2a] overflow-hidden"
        style={{ background: '#141414', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#555] hover:text-[#aaa] transition-colors z-10"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="px-7 pt-8 pb-5 border-b border-[#1e1e1e]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-xl select-none flex-shrink-0">
              🦞
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">欢迎使用 OpenClaw</h1>
              <p className="text-[#666] text-xs mt-0.5">让 AI 与微信 / 飞书互通的本地 Agent 框架</p>
            </div>
          </div>

          {/* What is OpenClaw */}
          <div className="rounded-xl border border-[#222] bg-[#0f0f0f] p-4">
            <p className="text-[#bbb] text-sm leading-relaxed">
              OpenClaw 运行在你的电脑上，让你用 <span className="text-white font-medium">微信 / 飞书</span> 直接跟 AI 对话，
              或让 AI 自动执行任务。这个控制台帮你安装、配置和启动它。
            </p>
          </div>

          {/* Gateway callout */}
          <div className="flex items-start gap-3 mt-3 px-3 py-2.5 rounded-lg bg-green-500/5 border border-green-500/15">
            <Zap size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-green-400 text-xs font-semibold">Gateway 是什么？</span>
              <p className="text-[#777] text-xs mt-0.5 leading-relaxed">
                一个跑在本地的小服务器（端口 18789）。
                微信把你的消息发给它 → 它转给 AI → AI 回复再发回去。
                <span className="text-[#999]"> Gateway 不启动，AI 就收不到任何消息。</span>
              </p>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="px-7 py-5">
          <p className="text-[#555] text-xs uppercase tracking-widest font-semibold mb-4">四步上手</p>
          <div className="space-y-2.5">
            {STEPS.map((step) => {
              const c = colorMap[step.color]
              const Icon = step.icon
              return (
                <div
                  key={step.num}
                  className={clsx('flex items-center gap-4 p-4 rounded-xl border', c.bg, c.border)}
                >
                  {/* Number */}
                  <div className={clsx('w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold flex-shrink-0', c.num)}>
                    {step.num}
                  </div>

                  {/* Icon */}
                  <Icon size={16} className={clsx('flex-shrink-0', c.icon)} />

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium">{step.title}</span>
                    </div>
                    <p className="text-[#777] text-xs mt-0.5">{step.desc}</p>
                    <p className={clsx('text-[10px] mt-0.5 font-mono opacity-70', c.text)}>{step.detail}</p>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => handleStep(step.tab)}
                    className={clsx(
                      'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-all border',
                      c.text, c.border,
                      'hover:opacity-90'
                    )}
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    {step.cta}
                    <ChevronRight size={11} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 pb-7 flex items-center justify-between gap-4">
          <button
            onClick={onClose}
            className="text-[#555] text-sm hover:text-[#888] transition-colors"
          >
            稍后再看
          </button>
          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-400 transition-all"
          >
            开始上手
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
