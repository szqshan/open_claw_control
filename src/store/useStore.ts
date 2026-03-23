import { create } from 'zustand'

export interface LogEntry {
  text: string
  type: string
}

interface State {
  gatewayRunning: boolean
  setGatewayRunning: (v: boolean) => void
  activeTab: string
  setActiveTab: (tab: string) => void
  ocInstalled: boolean
  setOcInstalled: (v: boolean) => void
  ocVersion: string | null
  setOcVersion: (v: string | null) => void
  gatewayLogs: LogEntry[]
  setGatewayLogs: (logs: LogEntry[]) => void
  appendGatewayLog: (entry: LogEntry) => void
  clearGatewayLogs: () => void
  showWelcome: boolean
  setShowWelcome: (v: boolean) => void
}

export const useStore = create<State>((set) => ({
  gatewayRunning: false,
  setGatewayRunning: (v) => set({ gatewayRunning: v }),
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  ocInstalled: false,
  setOcInstalled: (v) => set({ ocInstalled: v }),
  ocVersion: null,
  setOcVersion: (v) => set({ ocVersion: v }),
  gatewayLogs: [],
  setGatewayLogs: (logs) => set({ gatewayLogs: logs }),
  appendGatewayLog: (entry) => set((s) => ({ gatewayLogs: [...s.gatewayLogs.slice(-299), entry] })),
  clearGatewayLogs: () => set({ gatewayLogs: [] }),
  showWelcome: !localStorage.getItem('oc_welcomed'),
  setShowWelcome: (v) => {
    if (!v) localStorage.setItem('oc_welcomed', '1')
    set({ showWelcome: v })
  },
}))
