# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (opens Electron app with hot reload)
npm run dev

# Production build (NSIS/DMG/AppImage package)
npm run build

# Preview built renderer
npm run preview
```

> **Critical:** Never run `electron` or `electron-vite` directly — always use `npm run dev`. The `start-dev.mjs` launcher strips `ELECTRON_RUN_AS_NODE=1` from the environment before starting, which is essential when running inside Claude Code (Claude's parent Electron process sets this flag, which prevents child Electron windows from opening).

## Architecture

This is an **Electron + React + TypeScript** desktop management GUI for the OpenClaw AI agent framework. It provides a GUI alternative to the `openclaw` CLI.

### Process Split

- **Main process** (`electron/main.ts`): IPC handlers, shell execution, file I/O, HTTP probing
- **Preload** (`electron/preload.ts`): `contextBridge` that exposes `window.openclaw.*` to the renderer
- **Renderer** (`src/`): React UI consuming `window.openclaw.*` APIs

### Key IPC Channels (main ↔ renderer)

| Channel | Purpose |
|---|---|
| `cli:run` | Run `openclaw` CLI command, return stdout/stderr |
| `cli:stream` | Stream long-running command output line-by-line |
| `shell:run` / `shell:stream` | Run arbitrary shell commands |
| `gateway:status` | Probe `localhost:18789` to check if Gateway is running |
| `gateway:dashboardUrl` | Fetch Gateway dashboard URL with auth token |
| `file:read` / `file:write` | Read/write files (supports `~` expansion) |
| `cli:check` | Verify OpenClaw is installed, get version |
| `model:test` | HTTP request to LLM API to validate model connectivity |

### State Management

Single Zustand store (`src/store/useStore.ts`) tracks: `activeTab`, `ocInstalled`, `ocVersion`, `gatewayRunning`, `gatewayLogs` (capped at 300 lines), `showWelcome` (persisted to localStorage).

### Routing

Tab-based navigation via `activeTab` in Zustand store. `Layout.tsx` renders the nav bar; `App.tsx` switches between components based on `activeTab`.

### Styling

Tailwind CSS with dark theme. Brand colors: `brand-orange: #f97316`, `brand-dark: #0f0f0f`, `brand-card: #1a1a1a`, `brand-border: #2a2a2a`.

### Build System

- `electron.vite.config.ts` — primary config (electron-vite), used by `npm run build`
- `vite.config.ts` — alternative config (vite-plugin-electron), used by some tooling
- `electron-builder` handles native packaging: NSIS on Windows, DMG on Mac, AppImage on Linux

## Current Development Phase

Phase 1 (underway) — see `ROADMAP.md` for the full 6-phase plan. Key Phase 1 goals:
- Preset API providers with "Test Connection"
- Auto-start Gateway on app launch
- Embed Node.js runtime to eliminate Node.js prerequisite
- Simplify navigation from 6 tabs to 2–3 sections
