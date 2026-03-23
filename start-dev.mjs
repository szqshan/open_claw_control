/**
 * Dev launcher for OpenClaw Control.
 * Removes ELECTRON_RUN_AS_NODE from env before starting electron-vite.
 * This is needed when running inside Claude Code (or any Electron app that
 * sets ELECTRON_RUN_AS_NODE=1 to prevent child Electron processes from
 * opening GUI windows).
 */
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Clean environment - remove ELECTRON_RUN_AS_NODE
const env = Object.assign({}, process.env)
delete env.ELECTRON_RUN_AS_NODE

const eviteCli = resolve(__dirname, 'node_modules', 'electron-vite', 'dist', 'cli.js')

console.log('[openclaw-control] Starting with clean Electron environment...')

const child = spawn(process.execPath, [eviteCli, 'dev'], {
  env,
  stdio: 'inherit',
  cwd: __dirname
})

child.on('exit', code => process.exit(code || 0))
process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
