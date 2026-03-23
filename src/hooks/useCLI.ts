export function useCLI() {
  const run = async (args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    return window.openclaw.runCLI(args)
  }

  const stream = (args: string[], onLine: (line: string, type?: string) => void): Promise<void> => {
    return window.openclaw.streamCLI(args, onLine)
  }

  return { run, stream }
}
