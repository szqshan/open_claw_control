import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { spawn, exec } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as net from 'net'
import * as http from 'http'
import * as https from 'https'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: true,
    backgroundColor: '#0f0f0f',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true
    },
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

  if (isDev) {
    // electron-vite sets VITE_DEV_SERVER_URL when running dev
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    mainWindow.loadURL(devUrl)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC: run CLI command
ipcMain.handle('cli:run', async (_event, args: string[]) => {
  return new Promise((resolve) => {
    const cmd = `openclaw ${args.join(' ')}`
    exec(cmd, { timeout: 30000, encoding: 'utf8' }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || (error?.message || ''),
        exitCode: error ? (error.code ?? 1) : 0
      })
    })
  })
})

// IPC: stream CLI output line by line
ipcMain.handle('cli:stream', async (event, args: string[], streamId: string) => {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('openclaw', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    })

    let buffer = ''

    const processChunk = (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        event.sender.send(`cli:stream:${streamId}`, { type: 'line', data: line })
      }
    }

    child.stdout?.on('data', processChunk)
    child.stderr?.on('data', (chunk) => {
      event.sender.send(`cli:stream:${streamId}`, { type: 'stderr', data: chunk.toString() })
    })

    child.on('close', (code) => {
      if (buffer) {
        event.sender.send(`cli:stream:${streamId}`, { type: 'line', data: buffer })
      }
      event.sender.send(`cli:stream:${streamId}`, { type: 'done', exitCode: code })
      resolve()
    })

    child.on('error', (err) => {
      event.sender.send(`cli:stream:${streamId}`, { type: 'error', data: err.message })
      resolve()
    })
  })
})

// IPC: check if openclaw is installed
ipcMain.handle('cli:check', async () => {
  return new Promise((resolve) => {
    exec('openclaw --version', { timeout: 5000, encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        resolve({ installed: false, version: null })
      } else {
        resolve({ installed: true, version: stdout.trim() })
      }
    })
  })
})

// IPC: read file
ipcMain.handle('file:read', async (_event, filePath: string) => {
  const expanded = filePath.replace(/^~/, process.env.HOME || process.env.USERPROFILE || '')
  return fs.readFileSync(expanded, 'utf8')
})

// IPC: write file
ipcMain.handle('file:write', async (_event, filePath: string, content: string) => {
  const expanded = filePath.replace(/^~/, process.env.HOME || process.env.USERPROFILE || '')
  const dir = path.dirname(expanded)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(expanded, content, 'utf8')
  return true
})

// IPC: check gateway port
ipcMain.handle('gateway:status', async () => {
  return new Promise((resolve) => {
    const conn = net.createConnection({ port: 18789, host: '127.0.0.1' })
    conn.setTimeout(2000)
    conn.on('connect', () => {
      conn.destroy()
      resolve(true)
    })
    conn.on('error', () => {
      resolve(false)
    })
    conn.on('timeout', () => {
      conn.destroy()
      resolve(false)
    })
  })
})

// IPC: stream any shell command (e.g. npm install -g openclaw)
ipcMain.handle('shell:stream', async (event, cmd: string, streamId: string) => {
  return new Promise<void>((resolve) => {
    const child = spawn(cmd, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    })

    let buffer = ''
    const processChunk = (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        event.sender.send(`shell:stream:${streamId}`, { type: 'line', data: line })
      }
    }

    child.stdout?.on('data', processChunk)
    child.stderr?.on('data', (chunk) => {
      event.sender.send(`shell:stream:${streamId}`, { type: 'stderr', data: chunk.toString() })
    })
    child.on('close', (code) => {
      if (buffer) event.sender.send(`shell:stream:${streamId}`, { type: 'line', data: buffer })
      event.sender.send(`shell:stream:${streamId}`, { type: 'done', exitCode: code })
      resolve()
    })
    child.on('error', (err) => {
      event.sender.send(`shell:stream:${streamId}`, { type: 'error', data: err.message })
      resolve()
    })
  })
})

// IPC: get current platform
ipcMain.handle('shell:platform', () => process.platform)

// IPC: run a shell command and return result (for prerequisite checks)
ipcMain.handle('shell:run', async (_event, cmd: string) => {
  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000, encoding: 'utf8' }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout?.trim() || '',
        stderr: stderr?.trim() || '',
        exitCode: error ? (error.code ?? 1) : 0
      })
    })
  })
})

// IPC: open URL in browser
ipcMain.handle('shell:open', async (_event, url: string) => {
  await shell.openExternal(url)
})

// IPC: test model API connectivity
ipcMain.handle('model:test', async (_event, opts: {
  baseUrl: string
  apiKey: string
  modelId: string
  apiType: string
}) => {
  const { baseUrl, apiKey, modelId, apiType } = opts
  return new Promise((resolve) => {
    try {
      const endpoint = apiType === 'anthropic-messages' ? '/messages' : '/chat/completions'
      const urlObj = new URL(baseUrl.replace(/\/$/, '') + endpoint)
      const isHttps = urlObj.protocol === 'https:'
      const proto = isHttps ? https : http

      let body: string
      let headers: Record<string, string>

      if (apiType === 'anthropic-messages') {
        body = JSON.stringify({ model: modelId, messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }], max_tokens: 5 })
        headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Length': String(Buffer.byteLength(body)) }
      } else {
        body = JSON.stringify({ model: modelId, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 })
        headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'Content-Length': String(Buffer.byteLength(body)) }
      }

      const startTime = Date.now()
      const req = proto.request({
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        port: urlObj.port || (isHttps ? 443 : 80),
        method: 'POST',
        headers,
        timeout: 20000
      }, (res) => {
        const statusCode = res.statusCode || 0
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => {
          const elapsed = Date.now() - startTime
          try {
            const json = JSON.parse(data)
            // Check for error in body regardless of status code
            if (json.error) {
              resolve({ ok: false, message: json.error.message || JSON.stringify(json.error) })
              return
            }
            // HTTP non-2xx without error field
            if (statusCode < 200 || statusCode >= 300) {
              resolve({ ok: false, message: `HTTP ${statusCode}: ${data.slice(0, 200)}` })
              return
            }
            // Verify actual content in response
            const content = json.choices?.[0]?.message?.content || json.content?.[0]?.text || ''
            if (json.choices || json.content) {
              resolve({ ok: true, message: `连接成功，模型正常响应（${elapsed}ms）✓${content ? '' : ' [空响应]'}` })
            } else {
              resolve({ ok: false, message: `HTTP ${statusCode} 但无有效内容: ${data.slice(0, 200)}` })
            }
          } catch {
            if (statusCode < 200 || statusCode >= 300) {
              resolve({ ok: false, message: `HTTP ${statusCode}: ${data.slice(0, 200)}` })
            } else {
              resolve({ ok: false, message: '响应解析失败: ' + data.slice(0, 200) })
            }
          }
        })
      })

      req.on('error', (err: Error) => {
        resolve({ ok: false, message: '连接失败: ' + err.message })
      })
      req.on('timeout', () => {
        req.destroy()
        resolve({ ok: false, message: '请求超时（20秒）' })
      })

      req.write(body)
      req.end()
    } catch (err) {
      resolve({ ok: false, message: '配置错误: ' + String(err) })
    }
  })
})
