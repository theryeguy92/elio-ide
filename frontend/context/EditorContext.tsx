'use client'

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react'
import { fsApi } from '@/lib/fsApi'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Tab = {
  path: string
  language: string
  isDirty: boolean
  initialContent: string
}

type EditorContextValue = {
  tabs: Tab[]
  activeTab: string | null
  openFile: (path: string) => Promise<void>
  closeTab: (path: string) => void
  markDirty: (path: string, dirty: boolean) => void
  saveActive: () => Promise<void>
  sidebarVisible: boolean
  toggleSidebar: () => void
  traceVisible: boolean
  toggleTrace: () => void
  computePanelOpen: boolean
  setComputePanelOpen: (open: boolean) => void
  terminalToggleSeq: number
  toggleTerminal: () => void
  // Monaco bridge — MonacoEditor registers these on mount
  registerGetContent: (fn: (() => string) | null) => void
  registerSwitchModel: (fn: ((path: string, content: string, lang: string) => void) | null) => void
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

function langFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'ts': case 'tsx': return 'typescript'
    case 'js': case 'jsx': return 'javascript'
    case 'py': return 'python'
    case 'json': return 'json'
    case 'md': return 'markdown'
    case 'css': return 'css'
    case 'html': return 'html'
    case 'yaml': case 'yml': return 'yaml'
    case 'sh': case 'bash': return 'shell'
    case 'toml': return 'ini'
    case 'txt': return 'plaintext'
    default: return 'plaintext'
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const EditorContext = createContext<EditorContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [traceVisible, setTraceVisible] = useState(true)
  const [computePanelOpen, setComputePanelOpen] = useState(false)
  const [terminalToggleSeq, setTerminalToggleSeq] = useState(0)

  const getContentRef = useRef<(() => string) | null>(null)
  const switchModelRef = useRef<((path: string, content: string, lang: string) => void) | null>(null)

  const registerGetContent = useCallback((fn: (() => string) | null) => {
    getContentRef.current = fn
  }, [])

  const registerSwitchModel = useCallback((fn: ((path: string, content: string, lang: string) => void) | null) => {
    switchModelRef.current = fn
  }, [])

  const markDirty = useCallback((path: string, dirty: boolean) => {
    setTabs((prev) =>
      prev.map((t) => (t.path === path ? { ...t, isDirty: dirty } : t)),
    )
  }, [])

  const openFile = useCallback(async (path: string) => {
    // If already open, just switch to it
    const existing = tabs.find((t) => t.path === path)
    if (existing) {
      setActiveTab(path)
      switchModelRef.current?.(path, existing.initialContent, existing.language)
      return
    }

    const { content } = await fsApi.readFile(path)
    const language = langFromPath(path)

    setTabs((prev) => [...prev, { path, language, isDirty: false, initialContent: content }])
    setActiveTab(path)
    switchModelRef.current?.(path, content, language)
  }, [tabs])

  const closeTab = useCallback((path: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.path !== path)
      if (activeTab === path) {
        const newActive = next.length > 0 ? next[next.length - 1].path : null
        setActiveTab(newActive)
        if (newActive) {
          const tab = next.find((t) => t.path === newActive)
          if (tab) switchModelRef.current?.(tab.path, tab.initialContent, tab.language)
        }
      }
      return next
    })
  }, [activeTab])

  const saveActive = useCallback(async () => {
    if (!activeTab) return
    const content = getContentRef.current?.()
    if (content === undefined) return
    await fsApi.writeFile(activeTab, content)
    markDirty(activeTab, false)
  }, [activeTab, markDirty])

  const toggleSidebar = useCallback(() => setSidebarVisible((v) => !v), [])
  const toggleTrace = useCallback(() => setTraceVisible((v) => !v), [])
  const toggleTerminal = useCallback(() => setTerminalToggleSeq((n) => n + 1), [])

  return (
    <EditorContext.Provider
      value={{
        tabs,
        activeTab,
        openFile,
        closeTab,
        markDirty,
        saveActive,
        sidebarVisible,
        toggleSidebar,
        traceVisible,
        toggleTrace,
        computePanelOpen,
        setComputePanelOpen,
        terminalToggleSeq,
        toggleTerminal,
        registerGetContent,
        registerSwitchModel,
      }}
    >
      {children}
    </EditorContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor must be used inside <EditorProvider>')
  return ctx
}
