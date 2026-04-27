'use client'

import { createContext, useContext, useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Incremented seq prevents the same file+line from being deduplicated by React. */
type JumpRequest = { file: string; line: number; seq: number }

type CodeJumpContextValue = {
  jumpRequest: JumpRequest | null
  jumpToLine: (file: string, line: number) => void
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const CodeJumpContext = createContext<CodeJumpContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CodeJumpProvider({ children }: { children: React.ReactNode }) {
  const [jumpRequest, setJumpRequest] = useState<JumpRequest | null>(null)

  const jumpToLine = (file: string, line: number) => {
    setJumpRequest({ file, line, seq: Date.now() })
  }

  return (
    <CodeJumpContext.Provider value={{ jumpRequest, jumpToLine }}>
      {children}
    </CodeJumpContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCodeJump(): CodeJumpContextValue {
  const ctx = useContext(CodeJumpContext)
  if (!ctx) throw new Error('useCodeJump must be used inside <CodeJumpProvider>')
  return ctx
}
