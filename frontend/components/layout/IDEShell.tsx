'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { CodeJumpProvider } from '@/context/CodeJumpContext'
import { RunProvider } from '@/context/RunContext'
import { EditorProvider, useEditor } from '@/context/EditorContext'
import BottomTabBar from './BottomTabBar'
import Sidebar from './Sidebar'
import TopToolbar from './TopToolbar'
import TraceTimeline from '@/components/trace/TraceTimeline'
import ComputePanel from '@/components/compute/ComputePanel'
import SettingsModal from '@/components/settings/SettingsModal'
import { settingsApi } from '@/lib/settingsApi'

const MonacoEditor = dynamic(
  () => import('@/components/editor/MonacoEditor'),
  {
    ssr: false,
    loading: () => <div className="flex-1 bg-elio-bg" />,
  },
)

function IDELayout() {
  const { sidebarVisible, traceVisible, setSettingsOpen } = useEditor()

  // First run — no config.json yet → open setup
  useEffect(() => {
    settingsApi.get().then((s) => {
      if (s.needs_setup) setSettingsOpen(true)
    }).catch(() => {})
  }, [setSettingsOpen])

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
