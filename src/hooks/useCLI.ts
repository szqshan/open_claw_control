import { useCallback } from 'react'

export function useCLI() {
  const run = useCallback(
    (args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
      return window.openclaw.runCLI(args)
    },
    []
  )

  const stream = useCallback(
    (args: string[], onLine: (line: string, type?: string) => void): Promise<void> => {
      return window.openclaw.streamCLI(args, onLine)
    },
    []
  )

  return { run, stream }
}
