import { contextBridge, ipcRenderer } from 'electron'

let streamCounter = 0

contextBridge.exposeInMainWorld('openclaw', {
  // Run a CLI command and return result
  runCLI: (args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    return ipcRenderer.invoke('cli:run', args)
  },

  // Stream CLI output line by line
  streamCLI: (args: string[], onLine: (line: string, type?: string) => void): Promise<void> => {
    const streamId = `stream_${++streamCounter}_${Date.now()}`
    return new Promise((resolve) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { type: string; data?: string; exitCode?: number }) => {
        if (payload.type === 'done' || payload.type === 'error') {
          ipcRenderer.removeListener(`cli:stream:${streamId}`, listener)
          resolve()
        } else {
          onLine(payload.data || '', payload.type)
        }
      }
      ipcRenderer.on(`cli:stream:${streamId}`, listener)
      ipcRenderer.invoke('cli:stream', args, streamId)
    })
  },

  // Check if openclaw is installed
  checkInstalled: (): Promise<{ installed: boolean; version: string | null }> => {
    return ipcRenderer.invoke('cli:check')
  },

  // Read a file
  readFile: (path: string): Promise<string> => {
    return ipcRenderer.invoke('file:read', path)
  },

  // Write a file
  writeFile: (path: string, content: string): Promise<void> => {
    return ipcRenderer.invoke('file:write', path, content)
  },

  // Check if gateway port is open
  gatewayStatus: (): Promise<boolean> => {
    return ipcRenderer.invoke('gateway:status')
  },

  // Stream any shell command (for npm install etc.)
  streamShell: (cmd: string, onLine: (line: string, type?: string) => void): Promise<void> => {
    const streamId = `shell_${++streamCounter}_${Date.now()}`
    return new Promise((resolve) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { type: string; data?: string; exitCode?: number }) => {
        if (payload.type === 'done' || payload.type === 'error') {
          ipcRenderer.removeListener(`shell:stream:${streamId}`, listener)
          resolve()
        } else {
          onLine(payload.data || '', payload.type)
        }
      }
      ipcRenderer.on(`shell:stream:${streamId}`, listener)
      ipcRenderer.invoke('shell:stream', cmd, streamId)
    })
  },

  // Get platform string ('win32' | 'darwin' | 'linux')
  getPlatform: (): Promise<string> => {
    return ipcRenderer.invoke('shell:platform')
  },

  // Run a shell command and return result
  runShell: (cmd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    return ipcRenderer.invoke('shell:run', cmd)
  },

  // Get gateway dashboard URL with auth token (quick, 5s timeout)
  getDashboardUrl: (): Promise<string | null> => {
    return ipcRenderer.invoke('gateway:dashboardUrl')
  },

  // Open URL in external browser
  openExternal: (url: string): void => {
    ipcRenderer.invoke('shell:open', url)
  },

  // Test model API connectivity
  testModel: (opts: { baseUrl: string; apiKey: string; modelId: string; apiType: string }): Promise<{ ok: boolean; message: string }> => {
    return ipcRenderer.invoke('model:test', opts)
  },

  // Get environment variable values (for auto-filling API keys)
  getEnvVars: (keys: string[]): Promise<Record<string, string>> => {
    return ipcRenderer.invoke('env:get', keys)
  },

  // Gateway watchdog: start/stop background-managed gateway with crash recovery
  startManagedGateway: (): Promise<boolean> => {
    return ipcRenderer.invoke('gateway:watchdog-start')
  },
  stopManagedGateway: (): Promise<boolean> => {
    return ipcRenderer.invoke('gateway:watchdog-stop')
  },

  // Listen for watchdog restart events
  onGatewayWatchdogEvent: (cb: (event: { type: string; attempt?: number; delay?: number; attempts?: number }) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, payload: { type: string; attempt?: number; delay?: number; attempts?: number }) => cb(payload)
    ipcRenderer.on('gateway:watchdog-event', listener)
    return () => ipcRenderer.removeListener('gateway:watchdog-event', listener)
  },

  // System login item (auto-launch on OS boot)
  getLoginItemEnabled: (): Promise<boolean> => {
    return ipcRenderer.invoke('app:get-login-item')
  },
  setLoginItemEnabled: (enable: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('app:set-login-item', enable)
  },
})
