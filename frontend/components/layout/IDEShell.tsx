'use client'

import dynamic from 'next/dynamic'
import { CodeJumpProvider } from '@/context/CodeJumpContext'
import { RunProvider } from '@/context/RunContext'
import { EditorProvider, useEditor } from '@/context/EditorContext'
import BottomTabBar from './BottomTabBar'
import Sidebar from './Sidebar'
import TopToolbar from './TopToolbar'
import TraceTimeline from '@/components/trace/TraceTimeline'
import ComputePanel from '@/components/compute/ComputePanel'

const MonacoEditor = dynamic(
  () => import('@/components/editor/MonacoEditor'),
  {
    ssr: false,
    loading: () => <div className="flex-1 bg-[#1e1e1e]" />,
  },
)

function IDELayout() {
  const { sidebarVisible, traceVisible } = useEditor()

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-gray-100 overflow-hidden">
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
