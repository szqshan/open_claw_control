/**
 * prepare-node-runtime.mjs
 *
 * Downloads a portable Node.js binary for the current (or target) platform
 * and extracts it to node-runtime/<platform>/.
 *
 * Usage:
 *   node scripts/prepare-node-runtime.mjs          # current platform
 *   node scripts/prepare-node-runtime.mjs win32     # Windows
 *   node scripts/prepare-node-runtime.mjs darwin    # macOS
 *   node scripts/prepare-node-runtime.mjs linux     # Linux
 *
 * After running this, `npm run build` will automatically bundle the runtime.
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { createGunzip } from 'zlib'
import { pipeline } from 'stream/promises'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const NODE_VERSION = '20.19.0'  // LTS — change to update

const PLATFORM_MAP = {
  win32:  { os: 'win32',  arch: 'x64', ext: 'zip',     strip: 1 },
  darwin: { os: 'darwin', arch: 'x64', ext: 'tar.gz',  strip: 1 },
  linux:  { os: 'linux',  arch: 'x64', ext: 'tar.gz',  strip: 1 },
}

const targetPlatform = process.argv[2] || process.platform

if (!PLATFORM_MAP[targetPlatform]) {
  console.error(`Unknown platform: ${targetPlatform}. Valid: win32, darwin, linux`)
  process.exit(1)
}

const { os, arch, ext } = PLATFORM_MAP[targetPlatform]
const distName = `node-v${NODE_VERSION}-${os}-${arch}`
const filename  = `${distName}.${ext}`
const downloadUrl = `https://nodejs.org/dist/v${NODE_VERSION}/${filename}`
const outDir  = path.resolve('node-runtime', os)
const tmpFile = path.resolve('node-runtime', filename)

async function downloadFile(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const file = fs.createWriteStream(dest)
  return new Promise((resolve, reject) => {
    function get(url) {
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          get(res.headers.location)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`))
          return
        }
        const total = parseInt(res.headers['content-length'] || '0', 10)
        let received = 0
        res.on('data', chunk => {
          received += chunk.length
          if (total) {
            const pct = Math.round((received / total) * 100)
            process.stdout.write(`\r  下载中... ${pct}% (${(received/1024/1024).toFixed(1)} MB)`)
          }
        })
        res.pipe(file)
        file.on('finish', () => { file.close(); process.stdout.write('\n'); resolve() })
      }).on('error', reject)
    }
    get(url)
  })
}

async function extractZip(src, dest) {
  // Use PowerShell on Windows (no unzip in PATH by default)
  const cmd = `powershell -Command "Expand-Archive -Path '${src}' -DestinationPath '${dest}_tmp' -Force"`
  await execAsync(cmd)
  // Move contents of extracted subfolder up one level
  const subdir = path.join(`${dest}_tmp`, fs.readdirSync(`${dest}_tmp`)[0])
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(subdir)) {
    fs.renameSync(path.join(subdir, entry), path.join(dest, entry))
  }
  fs.rmSync(`${dest}_tmp`, { recursive: true, force: true })
}

async function extractTarGz(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  const tarStream = fs.createReadStream(src)
  // Use tar command (available on macOS/Linux)
  await execAsync(`tar -xzf "${src}" --strip-components=1 -C "${dest}"`)
}

async function main() {
  console.log(`\n📦 准备 Node.js v${NODE_VERSION} (${os}-${arch})`)
  console.log(`   目标目录: node-runtime/${os}/`)

  if (fs.existsSync(path.join(outDir, process.platform === 'win32' ? 'node.exe' : 'bin/node'))) {
    console.log('  ✓ 已存在，跳过下载')
    return
  }

  console.log(`\n  下载: ${downloadUrl}`)
  await downloadFile(downloadUrl, tmpFile)

  console.log('  解压中...')
  if (ext === 'zip') {
    await extractZip(tmpFile, outDir)
  } else {
    await extractTarGz(tmpFile, outDir)
  }

  fs.rmSync(tmpFile, { force: true })

  const nodeBin = path.join(outDir, os === 'win32' ? 'node.exe' : 'bin/node')
  if (fs.existsSync(nodeBin)) {
    console.log(`  ✓ Node.js 运行时就绪: ${nodeBin}`)
  } else {
    console.error(`  ✗ 解压后未找到: ${nodeBin}`)
    process.exit(1)
  }
}

main().catch(err => { console.error('Error:', err); process.exit(1) })
