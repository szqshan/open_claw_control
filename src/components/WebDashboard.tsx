import { useEffect, useState, useRef, useCallback, createElement } from 'react'
import { RefreshCw, ExternalLink, Zap, ChevronRight, AlertCircle } from 'lucide-react'
import { useStore } from '../store/useStore'
import clsx from 'clsx'

export default function WebDashboard() {
  const { gatewayRunning, setActiveTab } = useStore()

  const webviewRef = useRef<HTMLElement>(null)
  const [dashboardUrl, setDashboardUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [webLoading, setWebLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchUrl = useCallback(async () => {
    setFetching(true)
    setError('')
    setDashboardUrl('')
    try {
      const url = await window.openclaw.getDashboardUrl()
      setDashboardUrl(url || 'http://127.0.0.1:18789')
    } catch (e) {
      setError('获取失败: ' + String(e))
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    if (gatewayRunning) {
      fetchUrl()
    } else {
      setDashboardUrl('')
      setError('')
    }
  }, [gatewayRunning, fetchUrl])

  // Attach webview load events after URL is set
  useEffect(() => {
    const wv = webviewRef.current as unknown as Electron.WebviewTag | null
    if (!wv || !dashboardUrl) return
    const onStart = () => setWebLoading(true)
    const onStop = () => setWebLoading(false)
    const onFail = () => { setWebLoading(false); setError('页面加载失败，Gateway 可能已停止') }
    wv.addEventListener('did-start-loading', onStart)
    wv.addEventListener('did-stop-loading', onStop)
    wv.addEventListener('did-fail-load', onFail)
    return () => {
      wv.removeEventListener('did-start-loading', onStart)
      wv.removeEventListener('did-stop-loading', onStop)
      wv.removeEventListener('did-fail-load', onFail)
    }
  }, [dashboardUrl])

  // ── Gateway not running ────────────────────────────────────────────────────

  if (!gatewayRunning) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-5 p-6">
        <div className="w-16 h-16 rounded-full bg-[#1a1a1a] flex items-center justify-center">
          <Zap size={28} className="text-[#333]" />
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-white font-semibold">Gateway 未运行</p>
          <p className="text-[#666] text-sm">启动 Gateway 后即可在此直接与 AI 对话</p>
        </div>
        <button
          onClick={() => setActiveTab('gateway')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-500/15 text-green-400 text-sm font-medium border border-green-500/20 hover:bg-green-500/25 transition-all"
        >
          <Zap size={14} /> 去启动 Gateway <ChevronRight size={13} />
        </button>
      </div>
    )
  }

  // ── Main view ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1e1e1e] bg-[#111] flex-shrink-0">
        <button
          onClick={fetchUrl}
          disabled={fetching}
          title="重新加载"
          className="p-1.5 rounded text-[#555] hover:text-[#aaa] hover:bg-[#1a1a1a] transition-all disabled:opacity-40"
        >
          <RefreshCw size={13} className={fetching || webLoading ? 'spinner' : ''} />
        </button>

        <div className={clsx(
          'flex-1 px-2 py-1 rounded text-[10px] font-mono truncate',
          dashboardUrl ? 'text-[#555]' : 'text-[#333]'
        )}>
          {dashboardUrl || (fetching ? '获取仪表盘地址...' : '—')}
        </div>

        <button
          onClick={() => dashboardUrl && window.openclaw.openExternal(dashboardUrl)}
          disabled={!dashboardUrl}
          title="在浏览器中打开"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-[#666] hover:text-[#aaa] hover:bg-[#1a1a1a] transition-all disabled:opacity-30 border border-[#222]"
        >
          <ExternalLink size={11} />
          浏览器打开
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Loading overlay */}
        {(fetching || (webLoading && !error)) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0f0f0f]">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw size={24} className="spinner text-[#444]" />
              <p className="text-[#555] text-xs">{fetching ? '获取登录令牌...' : '加载仪表盘...'}</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !fetching && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#0f0f0f]">
            <AlertCircle size={28} className="text-[#444]" />
            <p className="text-[#666] text-sm text-center px-8">{error}</p>
            <button
              onClick={fetchUrl}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1a1a] text-[#888] text-sm border border-[#2a2a2a] hover:text-white transition-all"
            >
              <RefreshCw size={13} /> 重试
            </button>
          </div>
        )}

        {/* WebView — only rendered when URL is ready */}
        {dashboardUrl && createElement('webview', {
          ref: webviewRef,
          src: dashboardUrl,
          allowpopups: 'true',
          style: { width: '100%', height: '100%', display: 'flex' },
        })}
      </div>
    </div>
  )
}
