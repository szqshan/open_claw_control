import { useState, useRef, useEffect } from 'react'
import {
  Package,
  CheckCircle,
  XCircle,
  Terminal,
  RefreshCw,
  Play,
  AlertTriangle,
  Trash2,
  X,
  Copy,
  Check,
  MessageCircle,
  ShieldCheck,
  Settings,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
  Loader2
} from 'lucide-react'
import { useCLI } from '../hooks/useCLI'
import { useStore } from '../store/useStore'
import clsx from 'clsx'
import JSON5 from 'json5'

const INSTALL_CMD = 'npm install -g openclaw'

interface ProviderPreset {
  id: string
  name: string
  baseUrl: string
  api: 'openai-completions' | 'anthropic-messages'
  modelId: string
  modelName: string
}

// Which env var holds the API key for each provider (for auto-fill)
const PROVIDER_ENV_KEY: Record<string, string> = {
  openai:     'OPENAI_API_KEY',
  anthropic:  'ANTHROPIC_API_KEY',
  deepseek:   'DEEPSEEK_API_KEY',
  qwen:       'DASHSCOPE_API_KEY',
  doubao:     'ARK_API_KEY',
  moonshot:   'MOONSHOT_API_KEY',
  glm:        'ZHIPUAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: 'openai',    name: 'OpenAI',       baseUrl: 'https://api.openai.com/v1',                         api: 'openai-completions',  modelId: 'gpt-4o',              modelName: 'GPT-4o' },
  { id: 'anthropic', name: 'Anthropic',    baseUrl: 'https://api.anthropic.com',                         api: 'anthropic-messages',  modelId: 'claude-sonnet-4-6',   modelName: 'Claude Sonnet 4.6' },
  { id: 'deepseek',  name: 'DeepSeek',     baseUrl: 'https://api.deepseek.com/v1',                       api: 'openai-completions',  modelId: 'deepseek-chat',       modelName: 'DeepSeek Chat' },
  { id: 'qwen',      name: '通义千问',      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', api: 'openai-completions',  modelId: 'qwen-max',            modelName: '通义千问 Max' },
  { id: 'doubao',    name: '豆包',          baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',          api: 'openai-completions',  modelId: 'doubao-pro-32k',      modelName: '豆包 Pro 32k' },
  { id: 'moonshot',  name: 'Moonshot',     baseUrl: 'https://api.moonshot.cn/v1',                        api: 'openai-completions',  modelId: 'moonshot-v1-8k',      modelName: 'Moonshot v1 8k' },
  { id: 'glm',       name: '智谱 GLM',     baseUrl: 'https://open.bigmodel.cn/api/paas/v4',              api: 'openai-completions',  modelId: 'glm-4-flash',         modelName: 'GLM-4-Flash' },
  { id: 'openrouter',name: 'OpenRouter',   baseUrl: 'https://openrouter.ai/api/v1',                      api: 'openai-completions',  modelId: 'openai/gpt-4o',       modelName: 'GPT-4o (via OpenRouter)' },
  { id: 'custom',    name: '自定义',        baseUrl: '',                                                  api: 'openai-completions',  modelId: '',                    modelName: '' },
]

const WEIXIN_STEPS_WIN = [
  { cmd: 'openclaw.cmd plugins install "@tencent-weixin/openclaw-weixin"', label: 'Step 1: 安装微信插件' },
  { cmd: 'openclaw.cmd channels login --channel openclaw-weixin',          label: 'Step 2: 登录微信（扫描二维码）' },
  { cmd: 'openclaw.cmd gateway stop',                                      label: 'Step 3: 停止 Gateway' },
  { cmd: 'openclaw.cmd gateway',                                           label: 'Step 4: 重启 Gateway（使插件生效）' },
]

const WEIXIN_CMD_UNIX = 'npx -y @tencent-weixin/openclaw-weixin-cli@latest install'

// Strip ANSI escape codes (\x1B[...m, cursor movement, etc.)
const stripAnsi = (str: string) =>
  str.replace(/\x1B\[[\d;]*[mGKHFABCDJsuhl]/g, '')
     .replace(/\x1B\][\d;]*[^\x07]*\x07/g, '')
     .replace(/\x1B[()][012AB]/g, '')
     .replace(/\r/g, '')  // remove bare CR

// Detect if a line is part of a QR code (dense block/space characters)
const isQrLine = (s: string) => {
  const blocks = (s.match(/[\u2580-\u259F\u2588█▀▄▐▌ ]/g) || []).length
  return blocks > s.length * 0.5 && s.length > 4
}

type EnvStatus = { checking: boolean; done: boolean; ok: boolean; nodeVer: string; npmVer: string; error: string }

export default function Install() {
  const { ocInstalled, setOcInstalled, setOcVersion, ocVersion, setGatewayRunning, setShowWelcome } = useStore()
  const { run, stream } = useCLI()

  const [installing, setInstalling] = useState(false)
  const [installLogs, setInstallLogs] = useState<string[]>([])

  const [onboarding, setOnboarding] = useState(false)
  const [onboardLogs, setOnboardLogs] = useState<string[]>([])

  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false)
  const [uninstalling, setUninstalling] = useState(false)
  const [uninstallLogs, setUninstallLogs] = useState<string[]>([])

  const [checking, setChecking] = useState(false)
  const [copied, setCopied] = useState(false)

  const [platform, setPlatform] = useState<string>('unknown')
  const [wxInstalling, setWxInstalling] = useState(false)
  const [wxLogs, setWxLogs] = useState<Array<{ text: string; isQr?: boolean }>>([])
  const [wxStep, setWxStep] = useState('')

  const [envStatus, setEnvStatus] = useState<EnvStatus>({ checking: false, done: false, ok: false, nodeVer: '', npmVer: '', error: '' })

  // GUI config wizard state
  const [selectedPreset, setSelectedPreset] = useState<string>('custom')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelId, setModelId] = useState('')
  const [modelName, setModelName] = useState('')
  const [providerApi, setProviderApi] = useState<'openai-completions' | 'anthropic-messages'>('openai-completions')
  const [showApiKey, setShowApiKey] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)
  const [configError, setConfigError] = useState('')
  const [showAdvancedOnboard, setShowAdvancedOnboard] = useState(false)
  const [testState, setTestState] = useState<'idle' | 'testing' | 'pass' | 'fail'>('idle')
  const [testMsg, setTestMsg] = useState('')
  const [needsRestart, setNeedsRestart] = useState(false)
  const [restarting, setRestarting] = useState(false)

  const installLogEndRef = useRef<HTMLDivElement>(null)
  const onboardLogEndRef = useRef<HTMLDivElement>(null)
  const uninstallLogEndRef = useRef<HTMLDivElement>(null)
  const wxLogEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.openclaw.getPlatform().then(setPlatform)
    loadExistingConfig()
  }, [])

  useEffect(() => {
    if (!showUninstallConfirm) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowUninstallConfirm(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showUninstallConfirm])

  const loadExistingConfig = async () => {
    let hasConfig = false
    try {
      const raw = await window.openclaw.readFile('~/.openclaw/openclaw.json')
      const config = JSON5.parse(raw) as {
        models?: { providers?: Record<string, { baseUrl?: string; apiKey?: string; api?: string; models?: Array<{ id?: string; name?: string }> }> }
        agents?: { defaults?: { model?: { primary?: string } } }
      }
      const provider = config?.models?.providers?.['custom-provider']
      if (provider) {
        if (provider.baseUrl) setBaseUrl(provider.baseUrl)
        if (provider.apiKey) setApiKey(provider.apiKey)
        if (provider.api === 'anthropic-messages' || provider.api === 'openai-completions') setProviderApi(provider.api)
        const m = provider.models?.[0]
        if (m?.id) setModelId(m.id)
        if (m?.name) setModelName(m.name)
        setSelectedPreset('custom')
        hasConfig = true
      }
    } catch {
      // Config doesn't exist yet
    }
    // If no config found, try common env vars to pre-fill API key
    if (!hasConfig) {
      try {
        const vars = await window.openclaw.getEnvVars([
          'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'DEEPSEEK_API_KEY',
        ])
        if (vars['ANTHROPIC_API_KEY']) {
          setApiKey(vars['ANTHROPIC_API_KEY'])
          const p = PROVIDER_PRESETS.find(p => p.id === 'anthropic')!
          setSelectedPreset('anthropic')
          setBaseUrl(p.baseUrl)
          setModelId(p.modelId)
          setModelName(p.modelName)
          setProviderApi(p.api)
        } else if (vars['OPENAI_API_KEY']) {
          setApiKey(vars['OPENAI_API_KEY'])
          const p = PROVIDER_PRESETS.find(p => p.id === 'openai')!
          setSelectedPreset('openai')
          setBaseUrl(p.baseUrl)
          setModelId(p.modelId)
          setModelName(p.modelName)
          setProviderApi(p.api)
        } else if (vars['DEEPSEEK_API_KEY']) {
          setApiKey(vars['DEEPSEEK_API_KEY'])
          const p = PROVIDER_PRESETS.find(p => p.id === 'deepseek')!
          setSelectedPreset('deepseek')
          setBaseUrl(p.baseUrl)
          setModelId(p.modelId)
          setModelName(p.modelName)
          setProviderApi(p.api)
        }
      } catch { /* ignore */ }
    }
  }

  const checkPrereqs = async () => {
    setEnvStatus({ checking: true, done: false, ok: false, nodeVer: '', npmVer: '', error: '' })
    try {
      const [nodeRes, npmRes] = await Promise.all([
        window.openclaw.runShell('node --version'),
        window.openclaw.runShell('npm --version'),
      ])
      const nodeOk = nodeRes.exitCode === 0
      const npmOk = npmRes.exitCode === 0
      const ok = nodeOk && npmOk
      setEnvStatus({
        checking: false, done: true, ok,
        nodeVer: nodeRes.stdout.trim() || nodeRes.stderr.trim(),
        npmVer: npmRes.stdout.trim() || npmRes.stderr.trim(),
        error: !nodeOk ? 'Node.js 未安装，请访问 nodejs.org 下载安装' : !npmOk ? 'npm 未找到，请重新安装 Node.js' : '',
      })
    } catch (e) {
      setEnvStatus({ checking: false, done: true, ok: false, nodeVer: '', npmVer: '', error: String(e) })
    }
  }

  const prereqsAllOk = envStatus.done && envStatus.ok

  const checkInstall = async () => {
    setChecking(true)
    try {
      const result = await window.openclaw.checkInstalled()
      setOcInstalled(result.installed)
      setOcVersion(result.version)
    } finally {
      setChecking(false)
    }
  }

  const handleInstall = async () => {
    setInstalling(true)
    setInstallLogs(['$ ' + INSTALL_CMD])
    try {
      await window.openclaw.streamShell(INSTALL_CMD, (line) => {
        if (line.trim()) {
          setInstallLogs(prev => [...prev, line])
          installLogEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
      })
      setInstallLogs(prev => [...prev, '', '安装完成，正在检测...'])
      await checkInstall()
    } catch (err) {
      setInstallLogs(prev => [...prev, 'Error: ' + String(err)])
    } finally {
      setInstalling(false)
    }
  }

  const handleOnboard = async () => {
    setOnboarding(true)
    setOnboardLogs(['$ openclaw onboard'])
    try {
      await stream(['onboard'], (line, type) => {
        if (line.trim()) {
          setOnboardLogs(prev => [...prev, line])
          onboardLogEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
      })
      setOnboardLogs(prev => [...prev, '', '向导已完成'])
    } catch (err) {
      setOnboardLogs(prev => [...prev, 'Error: ' + String(err)])
    } finally {
      setOnboarding(false)
    }
  }

  const isValidUrl = (url: string) => {
    try {
      const u = new URL(url.trim())
      return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
      return false
    }
  }

  const testModel = async () => {
    if (baseUrl.trim() && !isValidUrl(baseUrl)) {
      setTestState('fail')
      setTestMsg('Base URL 格式无效，请填写完整的 HTTP/HTTPS 地址（如 https://api.openai.com/v1）')
      return
    }
    if (!baseUrl.trim() || !apiKey.trim() || !modelId.trim()) {
      setTestState('fail')
      setTestMsg('请先填写 Base URL、API Key 和 Model ID')
      return
    }
    setTestState('testing')
    setTestMsg('')
    try {
      const result = await window.openclaw.testModel({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), modelId: modelId.trim(), apiType: providerApi })
      setTestState(result.ok ? 'pass' : 'fail')
      setTestMsg(result.message)
    } catch (err) {
      setTestState('fail')
      setTestMsg('测试失败: ' + String(err))
    }
  }

  const handleRestartGateway = async () => {
    setRestarting(true)
    try {
      await window.openclaw.runCLI(['gateway', 'stop'])
      await window.openclaw.runCLI(['gateway'])
      setNeedsRestart(false)
    } catch {
      // ignore
    } finally {
      setRestarting(false)
    }
  }

  const applyPreset = async (preset: ProviderPreset) => {
    setSelectedPreset(preset.id)
    if (preset.baseUrl) setBaseUrl(preset.baseUrl)
    if (preset.modelId) setModelId(preset.modelId)
    if (preset.modelName) setModelName(preset.modelName)
    setProviderApi(preset.api)
    // Auto-fill API key from environment variable if current field is empty
    const envKey = PROVIDER_ENV_KEY[preset.id]
    if (envKey && !apiKey) {
      try {
        const vars = await window.openclaw.getEnvVars([envKey])
        if (vars[envKey]) setApiKey(vars[envKey])
      } catch { /* ignore */ }
    }
  }

  const handleSaveConfig = async () => {
    if (!baseUrl.trim() || !apiKey.trim() || !modelId.trim()) {
      setConfigError('请填写 Base URL、API Key 和 Model ID')
      return
    }
    if (!isValidUrl(baseUrl)) {
      setConfigError('Base URL 格式无效，请填写完整的 HTTP/HTTPS 地址（如 https://api.openai.com/v1）')
      return
    }
    setConfigSaving(true)
    setConfigError('')
    try {
      // Try to read existing config
      let existingConfig: Record<string, unknown> = {}
      try {
        const raw = await window.openclaw.readFile('~/.openclaw/openclaw.json')
        existingConfig = JSON5.parse(raw)
      } catch {
        // Config doesn't exist yet — start fresh
      }

      const safeId = modelId.trim().replace(/[^a-zA-Z0-9\-_.]/g, '-')
      const existing = existingConfig as {
        models?: { mode?: string; providers?: Record<string, unknown> }
        agents?: { defaults?: { model?: unknown } }
        gateway?: { port?: number }
      }

      const config = {
        ...existingConfig,
        models: {
          ...(existing.models || {}),
          mode: 'merge',
          providers: {
            ...(existing.models?.providers || {}),
            'custom-provider': {
              baseUrl: baseUrl.trim(),
              apiKey: apiKey.trim(),
              api: providerApi,
              auth: 'api-key',
              models: [
                {
                  id: safeId,
                  name: modelName.trim() || safeId,
                  input: ['text'],
                  contextWindow: 128000,
                  maxTokens: 8192,
                },
              ],
            },
          },
        },
        agents: {
          ...(existing.agents || {}),
          defaults: {
            ...(existing.agents?.defaults || {}),
            model: {
              primary: `custom-provider/${safeId}`,
            },
          },
        },
        gateway: {
          ...(existing.gateway || {}),
          port: (existing.gateway?.port as number) || 18789,
        },
      }

      await window.openclaw.writeFile('~/.openclaw/openclaw.json', JSON.stringify(config, null, 2))
      setConfigSaved(true)
      setTimeout(() => setConfigSaved(false), 4000)
      // Check if gateway is running — if so, needs restart to pick up new config
      const gwRunning = await window.openclaw.gatewayStatus()
      setNeedsRestart(gwRunning)
      // Auto-test the model after saving
      await testModel()
    } catch (err) {
      setConfigError('保存失败: ' + String(err))
    } finally {
      setConfigSaving(false)
    }
  }

  const handleUninstall = async () => {
    setUninstalling(true)
    setShowUninstallConfirm(false)
    const addLog = (line: string) => {
      setUninstallLogs(prev => [...prev, line])
      uninstallLogEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    try {
      // Step 0: stop Gateway if running
      addLog('$ openclaw gateway stop')
      await stream(['gateway', 'stop'], (line) => {
        if (line.trim()) addLog(line)
      }).catch(() => {})
      setGatewayRunning(false)
      addLog('')

      // Step 1: openclaw uninstall --all (removes data/config dirs)
      addLog('$ openclaw uninstall --all --yes --non-interactive')
      await stream(['uninstall', '--all', '--yes', '--non-interactive'], (line) => {
        if (line.trim()) addLog(line)
      })

      // Step 2: remove npm CLI package
      addLog('')
      addLog('$ npm uninstall -g openclaw')
      await window.openclaw.streamShell('npm uninstall -g openclaw', (line) => {
        if (line.trim()) addLog(line)
      })

      // Step 3: clean up legacy dirs from previous names (clawdbot / moltbot)
      addLog('')
      addLog('$ 清理历史遗留目录 (~/.clawdbot, ~/.moltbot)...')
      await window.openclaw.streamShell(
        'node -e "const fs=require(\'fs\'),os=require(\'os\'),path=require(\'path\');' +
        '[\'clawdbot\',\'moltbot\'].forEach(n=>{const d=path.join(os.homedir(),\'.\'+n);' +
        'try{fs.rmSync(d,{recursive:true,force:true});console.log(\'Removed ~/.\'+n)}' +
        'catch{}})"',
        (line) => { if (line.trim()) addLog(line) }
      )

      addLog('')
      addLog('卸载完成')
      setGatewayRunning(false)
      // Reset welcome guide so next launch treats user as new
      localStorage.removeItem('oc_welcomed')
      setShowWelcome(true)
      await checkInstall()
    } catch (err) {
      addLog('Error: ' + String(err))
    } finally {
      setUninstalling(false)
    }
  }

  const handleWeixinInstall = async () => {
    setWxInstalling(true)
    setWxLogs([])
    const addLog = (raw: string) => {
      const text = stripAnsi(raw)
      if (!text.trim()) return
      const isQr = isQrLine(text)
      setWxLogs(prev => [...prev, { text, isQr }])
      wxLogEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    try {
      const isWin = platform === 'win32'
      if (isWin) {
        for (const step of WEIXIN_STEPS_WIN) {
          setWxStep(step.label)
          setWxLogs(prev => [...prev, { text: `\n# ${step.label}` }, { text: `$ ${step.cmd}` }])
          await window.openclaw.streamShell(step.cmd, (line) => { addLog(line) })
        }
      } else {
        setWxStep('安装微信集成...')
        setWxLogs(prev => [...prev, { text: `$ ${WEIXIN_CMD_UNIX}` }])
        await window.openclaw.streamShell(WEIXIN_CMD_UNIX, (line) => { addLog(line) })
      }
      setWxLogs(prev => [...prev, { text: '✓ 微信集成安装完成' }])
      setWxStep('')
      await checkInstall()
    } catch (err) {
      setWxLogs(prev => [...prev, { text: 'Error: ' + String(err) }])
    } finally {
      setWxInstalling(false)
      setWxStep('')
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">安装管理</h1>
        <p className="text-[#666] text-sm mt-0.5">管理 OpenClaw 的安装、初始化和卸载</p>
      </div>

      {/* Installation Status Card */}
      <div className={clsx(
        'rounded-xl border p-6',
        ocInstalled
          ? 'border-green-500/20 bg-green-500/5'
          : 'border-red-500/20 bg-red-500/5'
      )}>
        <div className="flex items-center gap-4">
          <div className={clsx(
            'w-14 h-14 rounded-full flex items-center justify-center',
            ocInstalled ? 'bg-green-500/20' : 'bg-red-500/20'
          )}>
            {ocInstalled
              ? <CheckCircle size={26} className="text-green-400" />
              : <XCircle size={26} className="text-red-400" />
            }
          </div>
          <div className="flex-1">
            <p className={clsx(
              'font-semibold text-lg',
              ocInstalled ? 'text-green-400' : 'text-red-400'
            )}>
              {ocInstalled ? 'OpenClaw 已安装' : 'OpenClaw 未安装'}
            </p>
            {ocInstalled && ocVersion ? (
              <p className="text-[#666] text-sm mt-0.5">版本: <code className="text-[#aaa] font-mono">{ocVersion}</code></p>
            ) : (
              <p className="text-[#666] text-sm mt-0.5">未检测到 openclaw 命令</p>
            )}
          </div>
          <button
            onClick={checkInstall}
            disabled={checking}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] text-sm hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={checking ? 'spinner' : ''} />
            {checking ? '检测中...' : '重新检测'}
          </button>
        </div>
      </div>

      {/* Install Section (shown when not installed) */}
      {!ocInstalled && (
        <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 space-y-5">
          <div>
            <h2 className="text-white font-semibold mb-1">安装 OpenClaw</h2>
            <p className="text-[#666] text-sm">通过 npm 全局安装 OpenClaw CLI 工具</p>
          </div>

          <div>
            <p className="text-xs text-[#666] mb-2 uppercase tracking-wider">安装命令</p>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a]">
              <Terminal size={13} className="text-[#555] flex-shrink-0" />
              <code className="text-green-400 text-sm font-mono flex-1">{INSTALL_CMD}</code>
              <button
                onClick={handleCopy}
                className="p-1.5 rounded text-[#555] hover:text-white transition-colors"
              >
                {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleInstall}
              disabled={installing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-500/20 text-orange-400 text-sm font-medium hover:bg-orange-500/30 transition-all border border-orange-500/20 disabled:opacity-50"
            >
              {installing ? <RefreshCw size={14} className="spinner" /> : <Package size={14} />}
              {installing ? '安装中...' : '自动安装'}
            </button>
            <p className="text-[#555] text-xs self-center">或在终端手动运行上方命令</p>
          </div>

          {installLogs.length > 0 && (
            <div>
              <p className="text-xs text-[#666] mb-2 uppercase tracking-wider">安装日志</p>
              <div className="terminal rounded-lg p-4 h-40 overflow-y-auto">
                {installLogs.map((log, i) => (
                  <div key={i} className="text-xs mb-0.5">{log}</div>
                ))}
                <div ref={installLogEndRef} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* GUI Config Wizard - replaces interactive terminal onboard */}
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-blue-400" />
          <div>
            <h2 className="text-white font-semibold">快速配置向导</h2>
            <p className="text-[#666] text-sm mt-0.5">设置 AI 模型提供商，配置直接写入 ~/.openclaw/openclaw.json</p>
          </div>
        </div>

        {/* Provider presets */}
        <div>
          <p className="text-xs text-[#666] mb-2 uppercase tracking-wider">选择提供商</p>
          <div className="flex gap-2 flex-wrap">
            {PROVIDER_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => applyPreset(p)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  selectedPreset === p.id
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                    : 'bg-[#0f0f0f] text-[#888] border-[#2a2a2a] hover:text-white hover:border-[#3a3a3a]'
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Form fields */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[#888] mb-1.5">API Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="Base URL (e.g. https://api.openai.com/v1)"
              className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm font-mono placeholder-[#444] focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-[#888] mb-1.5">API Key</label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 pr-10 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm font-mono placeholder-[#444] focus:outline-none focus:border-blue-500/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#aaa] transition-colors"
              >
                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#888] mb-1.5">Model ID</label>
              <input
                type="text"
                value={modelId}
                onChange={e => setModelId(e.target.value)}
                placeholder="gpt-4o"
                className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm font-mono placeholder-[#444] focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-[#888] mb-1.5">显示名称（可选）</label>
              <input
                type="text"
                value={modelName}
                onChange={e => setModelName(e.target.value)}
                placeholder="My Model"
                className="w-full px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white text-sm placeholder-[#444] focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#888] mb-1.5">API 类型</label>
            <div className="flex gap-2">
              {(['openai-completions', 'anthropic-messages'] as const).map(api => (
                <button
                  key={api}
                  onClick={() => setProviderApi(api)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-mono transition-all border',
                    providerApi === api
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                      : 'bg-[#0f0f0f] text-[#666] border-[#2a2a2a] hover:text-[#aaa]'
                  )}
                >
                  {api}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error / success */}
        {configError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-xs">{configError}</p>
          </div>
        )}
        {configSaved && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
            <p className="text-green-400 text-xs">配置已保存到 ~/.openclaw/openclaw.json</p>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleSaveConfig}
            disabled={configSaving || testState === 'testing'}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-500/15 text-blue-400 text-sm font-medium hover:bg-blue-500/25 transition-all border border-blue-500/20 disabled:opacity-50"
          >
            {configSaving ? <RefreshCw size={14} className="spinner" /> : <Check size={14} />}
            {configSaving ? '保存中...' : '保存配置'}
          </button>

          <button
            onClick={testModel}
            disabled={testState === 'testing' || configSaving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1a1a1a] text-[#888] text-sm font-medium hover:text-white transition-all border border-[#2a2a2a] hover:border-[#3a3a3a] disabled:opacity-50"
          >
            {testState === 'testing'
              ? <Loader2 size={14} className="spinner" />
              : testState === 'pass'
              ? <Wifi size={14} className="text-green-400" />
              : testState === 'fail'
              ? <WifiOff size={14} className="text-red-400" />
              : <Wifi size={14} />
            }
            {testState === 'testing' ? '测试中...' : '测试连接'}
          </button>
        </div>

        {/* Test result */}
        {testState === 'pass' && testMsg && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
            <p className="text-green-400 text-xs">{testMsg}</p>
          </div>
        )}
        {testState === 'fail' && testMsg && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <WifiOff size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-xs break-all">{testMsg}</p>
          </div>
        )}

        {/* Gateway restart warning */}
        {needsRestart && (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-orange-500/10 border border-orange-500/30">
            <AlertTriangle size={14} className="text-orange-400 flex-shrink-0" />
            <p className="text-orange-300 text-xs flex-1">Gateway 正在运行，需要重启才能使用新配置</p>
            <button
              onClick={handleRestartGateway}
              disabled={restarting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 text-xs font-medium hover:bg-orange-500/30 transition-all border border-orange-500/30 disabled:opacity-50 flex-shrink-0"
            >
              {restarting ? <RefreshCw size={12} className="spinner" /> : <RefreshCw size={12} />}
              {restarting ? '重启中...' : '立即重启 Gateway'}
            </button>
          </div>
        )}

        {/* Advanced: terminal onboard (collapsible) */}
        <div className="border-t border-[#2a2a2a] pt-4">
          <button
            onClick={() => setShowAdvancedOnboard(v => !v)}
            className="flex items-center gap-2 text-xs text-[#555] hover:text-[#888] transition-colors"
          >
            {showAdvancedOnboard ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            高级选项：运行命令行 onboard 向导
          </button>

          {showAdvancedOnboard && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-[#555]">
                命令行向导为交互式程序，在此界面中无法输入响应。建议使用上方图形配置。
              </p>
              <button
                onClick={handleOnboard}
                disabled={onboarding || !ocInstalled}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all border',
                  'bg-[#1e1e1e] text-[#777] border-[#2a2a2a] hover:text-[#aaa]',
                  (onboarding || !ocInstalled) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {onboarding ? <RefreshCw size={12} className="spinner" /> : <Play size={12} />}
                {onboarding ? '向导运行中...' : '运行 openclaw onboard'}
              </button>

              {!ocInstalled && (
                <p className="text-[#555] text-xs">请先安装 OpenClaw 再运行向导</p>
              )}

              {onboardLogs.length > 0 && (
                <div className="terminal rounded-lg p-3 h-40 overflow-y-auto">
                  {onboardLogs.map((log, i) => (
                    <div key={i} className="text-xs mb-0.5">{log}</div>
                  ))}
                  <div ref={onboardLogEndRef} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* WeChat Integration Section */}
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle size={15} className="text-green-400" />
              <h2 className="text-white font-semibold">安装微信集成</h2>
              <span className={clsx(
                'text-[10px] px-2 py-0.5 rounded-full border font-mono',
                platform === 'win32'
                  ? 'text-blue-400 border-blue-500/30 bg-blue-500/10'
                  : 'text-purple-400 border-purple-500/30 bg-purple-500/10'
              )}>
                {platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : platform === 'linux' ? 'Linux' : '检测中...'}
              </span>
            </div>
            <p className="text-[#666] text-sm">通过微信 Channel 接入 OpenClaw，接收并处理微信消息</p>
          </div>
        </div>

        {/* Commands preview */}
        <div>
          <p className="text-xs text-[#666] mb-2 uppercase tracking-wider">
            {platform === 'win32' ? '安装步骤（依次执行）' : '安装命令'}
          </p>
          <div className="rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] overflow-hidden">
            {platform === 'win32' ? (
              WEIXIN_STEPS_WIN.map((step, i) => (
                <div key={i} className="flex items-start gap-3 px-3 py-2 border-b border-[#1e1e1e] last:border-0">
                  <span className="text-[#444] text-xs font-mono mt-0.5 w-4 flex-shrink-0">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#555] text-[10px] mb-0.5">{step.label}</p>
                    <code className="text-green-400 text-xs font-mono break-all">{step.cmd}</code>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2 px-3 py-3">
                <Terminal size={13} className="text-[#555] flex-shrink-0" />
                <code className="text-green-400 text-sm font-mono">{WEIXIN_CMD_UNIX}</code>
              </div>
            )}
          </div>
        </div>

        {/* Prerequisites */}
        <div className="rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={13} className="text-[#666]" />
              <span className="text-xs text-[#666] uppercase tracking-wider">运行环境检测</span>
            </div>
            <button
              onClick={checkPrereqs}
              disabled={envStatus.checking}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-[#666] bg-[#1a1a1a] border border-[#2a2a2a] hover:text-white transition-all disabled:opacity-50"
            >
              <RefreshCw size={11} className={envStatus.checking ? 'spinner' : ''} />
              {envStatus.checking ? '检测中...' : '检测'}
            </button>
          </div>
          {/* Single combined env row */}
          <div className={clsx(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg border text-xs',
            !envStatus.done ? 'border-[#2a2a2a] text-[#555]' :
            envStatus.ok ? 'border-green-500/20 bg-green-500/5 text-green-400' :
                           'border-red-500/20 bg-red-500/5 text-red-400'
          )}>
            {envStatus.checking
              ? <RefreshCw size={13} className="spinner flex-shrink-0" />
              : envStatus.ok
                ? <CheckCircle size={13} className="flex-shrink-0" />
                : envStatus.done
                  ? <XCircle size={13} className="flex-shrink-0" />
                  : <span className="w-[13px] h-[13px] rounded-full border border-[#333] flex-shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="font-medium">Node.js 运行环境</div>
              {envStatus.done && envStatus.ok && (
                <div className="text-[10px] opacity-70 mt-0.5">
                  node {envStatus.nodeVer} · npm {envStatus.npmVer}
                </div>
              )}
              {envStatus.done && !envStatus.ok && (
                <div className="text-[10px] mt-0.5 opacity-90">{envStatus.error}</div>
              )}
              {!envStatus.done && !envStatus.checking && (
                <div className="text-[10px] opacity-50 mt-0.5">点击"检测"按钮验证</div>
              )}
            </div>
            {envStatus.done && !envStatus.ok && (
              <button
                onClick={() => window.openclaw.openExternal('https://nodejs.org')}
                className="text-[10px] text-blue-400 hover:text-blue-300 underline underline-offset-2 flex-shrink-0"
              >
                下载 Node.js
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleWeixinInstall}
            disabled={wxInstalling || !ocInstalled || (envStatus.done && !envStatus.ok)}
            className={clsx(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all border',
              'bg-green-500/15 text-green-400 border-green-500/20 hover:bg-green-500/25',
              (wxInstalling || !ocInstalled || (envStatus.done && !envStatus.ok)) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {wxInstalling ? <RefreshCw size={14} className="spinner" /> : <MessageCircle size={14} />}
            {wxInstalling ? '安装中...' : '一键安装微信集成'}
          </button>
          {wxInstalling && wxStep && (
            <span className="text-[#555] text-xs">{wxStep}</span>
          )}
          {!ocInstalled && (
            <span className="text-[#555] text-xs">请先安装 OpenClaw</span>
          )}
          {!envStatus.done && !wxInstalling && ocInstalled && (
            <span className="text-[#555] text-xs">建议先点击"检测"验证环境</span>
          )}
        </div>

        {wxLogs.length > 0 && (
          <div>
            <p className="text-xs text-[#666] mb-2 uppercase tracking-wider">安装日志</p>
            <div className="terminal rounded-lg p-4 h-64 overflow-y-auto">
              {wxLogs.map((log, i) => (
                <div key={i} className={clsx(
                  'mb-0',
                  log.isQr ? 'text-[11px] leading-[1.1] font-mono' : 'text-xs',
                  log.text.startsWith('#') && 'text-[#555] mt-2 mb-1',
                  log.text.startsWith('✓') && 'text-green-400 font-semibold mt-1'
                )}>{log.text}</div>
              ))}
              <div ref={wxLogEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Uninstall Section */}
      <div className="rounded-xl border border-red-500/10 bg-[#1a1a1a] p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-red-400 font-semibold mb-1">卸载 OpenClaw</h2>
            <p className="text-[#666] text-sm">
              此操作将删除所有 OpenClaw 数据、配置和 Agent 信息，<strong className="text-red-400">无法恢复</strong>。
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowUninstallConfirm(true)}
          aria-disabled={uninstalling || !ocInstalled}
          className={clsx(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all border',
            'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20',
            (uninstalling || !ocInstalled) && 'opacity-50 cursor-not-allowed'
          )}
        >
          {uninstalling ? <RefreshCw size={14} className="spinner" /> : <Trash2 size={14} />}
          {uninstalling ? '卸载中...' : '卸载 OpenClaw'}
        </button>

        {uninstallLogs.length > 0 && (
          <div>
            <p className="text-xs text-[#666] mb-2 uppercase tracking-wider">卸载日志</p>
            <div className="terminal rounded-lg p-4 h-40 overflow-y-auto">
              {uninstallLogs.map((log, i) => (
                <div key={i} className="text-xs mb-0.5">{log}</div>
              ))}
              <div ref={uninstallLogEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Uninstall Confirmation Modal */}
      {showUninstallConfirm && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
        >
          <div className="bg-[#1a1a1a] border border-red-500/30 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-red-400 font-semibold flex items-center gap-2">
                <AlertTriangle size={16} />
                确认卸载
              </h3>
              <button onClick={() => setShowUninstallConfirm(false)} className="text-[#666] hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 mb-5">
              <p className="text-[#aaa] text-sm">以下内容将被<strong className="text-red-400">永久删除</strong>，<strong className="text-red-400">不可撤销</strong>：</p>
              <ul className="text-[#888] text-sm space-y-1 ml-4">
                <li className="flex items-center gap-2"><span className="text-red-400">•</span>所有 Agent 配置和历史</li>
                <li className="flex items-center gap-2"><span className="text-red-400">•</span>所有 Channel 绑定</li>
                <li className="flex items-center gap-2"><span className="text-red-400">•</span>~/.openclaw/ 目录下全部数据</li>
                <li className="flex items-center gap-2"><span className="text-red-400">•</span>OpenClaw CLI 工具</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleUninstall}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500/25 text-red-400 text-sm font-medium hover:bg-red-500/35 transition-all border border-red-500/30"
              >
                <Trash2 size={14} />
                确认卸载
              </button>
              <button
                onClick={() => setShowUninstallConfirm(false)}
                className="px-5 py-2.5 rounded-lg bg-[#2a2a2a] text-[#888] text-sm hover:bg-[#333] transition-all"
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
