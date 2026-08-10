'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { CodeJumpProvider } from '@/context/CodeJumpContext'
import { RunProvider, useRun } from '@/context/RunContext'
import { EditorProvider, useEditor } from '@/context/EditorContext'
import BottomTabBar from './BottomTabBar'
import Sidebar from './Sidebar'
import TopToolbar from './TopToolbar'
import TraceTimeline from '@/components/trace/TraceTimeline'
import ComputePanel from '@/components/compute/ComputePanel'
import SettingsModal from '@/components/settings/SettingsModal'
import QuickOpen from '@/components/layout/QuickOpen'
import NewFileDialog from '@/components/layout/NewFileDialog'
import { settingsApi } from '@/lib/settingsApi'

const MonacoEditor = dynamic(
  () => import('@/components/editor/MonacoEditor'),
  {
    ssr: false,
    loading: () => <div className="flex-1 bg-elio-bg" />,
  },
)

function IDELayout() {
  const {
    sidebarVisible,
    traceVisible,
    setSettingsOpen,
    toggleSidebar,
    toggleTerminal,
    setQuickOpenOpen,
    activeTab,
  } = useEditor()
  const { runState, startRun, stopRun } = useRun()

  // First run — no config.json yet → open setup
  useEffect(() => {
    settingsApi.get().then((s) => {
      if (s.needs_setup) setSettingsOpen(true)
    }).catch(() => {})
  }, [setSettingsOpen])

  // Global shortcuts — keep menu labels honest
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key === 'b') {
        e.preventDefault(); toggleSidebar()
      } else if (mod && e.key === '`') {
        e.preventDefault(); toggleTerminal()
      } else if (mod && e.key === 'p') {
        e.preventDefault(); setQuickOpenOpen(true)
      } else if (e.key === 'F5') {
        e.preventDefault()
        if (runState !== 'idle') stopRun()
        else if (activeTab && !activeTab.startsWith('vault:')) startRun(activeTab)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleSidebar, toggleTerminal, setQuickOpenOpen, runState, startRun, stopRun, activeTab])

  return (
    <div className="flex flex-col h-screen bg-elio-bg text-elio-text overflow-hidden">
      <TopToolbar />
      <div className="flex flex-1 overflow-hidden">
        {sidebarVisible && <Sidebar />}
        <div className="flex flex-col flex-1 overflow-hidden">
          <main className="flex-1 overflow-hidden">
            <MonacoEditor />
          </main>
          <BottomTabBar />
        </div>
        {traceVisible && <TraceTimeline />}
      </div>
      <ComputePanel />
      <SettingsModal />
      <QuickOpen />
      <NewFileDialog />
    </div>
  )
}

export default function IDEShell() {
  return (
    <EditorProvider>
      <CodeJumpProvider>
        <RunProvider>
          <IDELayout />
        </RunProvider>
      </CodeJumpProvider>
    </EditorProvider>
  )
}
