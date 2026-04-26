import dynamic from 'next/dynamic'
import TopToolbar from '@/components/layout/TopToolbar'
import Sidebar from '@/components/layout/Sidebar'
import BottomTabBar from '@/components/layout/BottomTabBar'
import TraceTimeline from '@/components/trace/TraceTimeline'

const MonacoEditor = dynamic(
  () => import('@/components/editor/MonacoEditor'),
  {
    ssr: false,
    loading: () => <div className="flex-1 bg-[#1e1e1e]" />,
  }
)

export default function IDEPage() {
  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-gray-100 overflow-hidden">
      <TopToolbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <main className="flex-1 overflow-hidden">
            <MonacoEditor />
          </main>
          <BottomTabBar />
        </div>
        <TraceTimeline />
      </div>
    </div>
  )
}
