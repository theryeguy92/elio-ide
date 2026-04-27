'use client'

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Stream = 'stdout' | 'stderr' | 'system' | 'exit_ok' | 'exit_err'
export type TerminalLine = { text: string; stream: Stream }
export type RunState = 'idle' | 'starting' | 'running'

type RunContextValue = {
  runState: RunState
  lines: TerminalLine[]
  terminalRevealCount: number
  startRun: (filePath: string) => void
  stopRun: () => void
  clearOutput: () => void
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const RunContext = createContext<RunContextValue | null>(null)

const WS_BASE =
  (typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
    : 'http://localhost:8000'
  ).replace(/^http/, 'ws')

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function RunProvider({ children }: { children: React.ReactNode }) {
  const [runState, setRunState] = useState<RunState>('idle')
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [terminalRevealCount, setTerminalRevealCount] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)

  const append = useCallback((text: string, stream: Stream) => {
    setLines((prev) => [...prev, { text, stream }])
  }, [])

  const stopRun = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    setRunState('idle')
  }, [])

  const startRun = useCallback((filePath: string) => {
    if (runState !== 'idle') return

    setRunState('starting')
    setLines([])
    setTerminalRevealCount((n) => n + 1)

    const url = `${WS_BASE}/run/execute/ws?file_path=${encodeURIComponent(filePath)}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setRunState('running')
      setLines([{ text: `▶ ${filePath}\n`, stream: 'system' }])
    }

    ws.onmessage = (e: MessageEvent) => {
      type Msg =
        | { type: 'stdout' | 'stderr'; text: string }
        | { type: 'exit'; code: number }
      const msg = JSON.parse(e.data as string) as Msg
      if (msg.type === 'stdout') {
        append(msg.text, 'stdout')
      } else if (msg.type === 'stderr') {
        append(msg.text, 'stderr')
      } else if (msg.type === 'exit') {
        const ok = msg.code === 0
        append(`\nProcess exited with code ${msg.code}\n`, ok ? 'exit_ok' : 'exit_err')
        setRunState('idle')
        wsRef.current = null
      }
    }

    ws.onerror = () => {
      append('Connection error — is the backend running?\n', 'stderr')
      setRunState('idle')
      wsRef.current = null
    }

    ws.onclose = () => {
      setRunState((prev) => {
        if (prev !== 'idle') {
          setLines((l) => [...l, { text: '\nProcess stopped.\n', stream: 'system' }])
        }
        return 'idle'
      })
      wsRef.current = null
    }
  }, [runState, append])

  const clearOutput = useCallback(() => setLines([]), [])

  return (
    <RunContext.Provider
      value={{
        runState,
        lines,
        terminalRevealCount,
        startRun,
        stopRun,
        clearOutput,
      }}
    >
      {children}
    </RunContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRun(): RunContextValue {
  const ctx = useContext(RunContext)
  if (!ctx) throw new Error('useRun must be used inside <RunProvider>')
  return ctx
}
