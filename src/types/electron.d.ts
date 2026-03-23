declare global {
  interface Window {
    openclaw: {
      runCLI(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }>
      streamCLI(args: string[], onLine: (line: string, type?: string) => void): Promise<void>
      checkInstalled(): Promise<{ installed: boolean; version: string | null }>
      readFile(path: string): Promise<string>
      writeFile(path: string, content: string): Promise<void>
      gatewayStatus(): Promise<boolean>
      streamShell(cmd: string, onLine: (line: string, type?: string) => void): Promise<void>
      getPlatform(): Promise<string>
      runShell(cmd: string): Promise<{ stdout: string; stderr: string; exitCode: number }>
      openExternal(url: string): void
      testModel(opts: { baseUrl: string; apiKey: string; modelId: string; apiType: string }): Promise<{ ok: boolean; message: string }>
    }
  }
}

// Allow Electron's <webview> tag in JSX
declare namespace JSX {
  interface IntrinsicElements {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webview: any
  }
}

export {}
