import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Dev/browser mock for window.openclaw (only when not in Electron)
if (typeof window !== 'undefined' && !window.openclaw) {
  window.openclaw = {
    runCLI: async () => ({ stdout: '(mock: not in Electron)', stderr: '', exitCode: 0 }),
    streamCLI: async () => {},
    checkInstalled: async () => ({ installed: false, version: null }),
    readFile: async () => '{}',
    writeFile: async () => {},
    gatewayStatus: async () => false,
    streamShell: async (_cmd: string, onLine: (l: string) => void) => { onLine('(mock: not in Electron)') },
    getPlatform: async () => 'win32',
    runShell: async () => ({ stdout: '(mock)', stderr: '', exitCode: 0 }),
    openExternal: () => {},
    testModel: async () => ({ ok: true, message: '(mock: browser env, skipping real test)' }),
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
