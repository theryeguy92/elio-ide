'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Cpu, Terminal, Trash2, Users } from 'lucide-react'
import AnsiToHtml from 'ansi-to-html'
import GPULauncher from '@/components/gpu/GPULauncher'
import StakeholderTab from '@/components/stakeholder/StakeholderTab'
import { useRun, type Stream } from '@/context/RunContext'
import { useEditor } from '@/context/EditorContext'

type TabId = 'terminal' | 'gpu' | 'stakeholder'

const tabs = [
  { id: 'terminal' as TabId, label: 'Terminal', icon: Terminal },
  { id: 'gpu' as TabId, label: 'GPU Launcher', icon: Cpu },
  { id: 'stakeholder' as TabId, label: 'Stakeholder', icon: Users },
]

// ---------------------------------------------------------------------------
// Terminal panel
// ---------------------------------------------------------------------------

const converter = new AnsiToHtml({ escapeXML: true })

const STREAM_COLOR: Record<Stream, string> = {
  stdout:   '#e5e7eb',
  stderr:   '#f87171',
  system:   '#60a5fa',
  exit_ok:  '#4ade80',
  exit_err: '#f87171',
}

function ansiToHtml(text: string): string {
  try {
    return converter.toHtml(text)
  } catch {
    return text.replace(/\x1B\[[0-9;]*m/g, '')
  }
}

function TerminalPanel() {
  const { lines, clearOutput, runState } = useRun()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines.length])

  return (
    <div className="h-full bg-[#0d0d0d] flex flex-col">
      <div className="flex items-center justify-between px-3 py-1 border-b border-[#1e1e1e] shrink-0">
        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
          Output
          {runState !== 'idle' && (
            <span className="ml-2 inline-flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
              </span>
              <span className="text-green-400">running</span>
            </span>
          )}
        </span>
        <button
          onClick={clearOutput}
          className="p-1 rounded hover:bg-[#1e1e1e] transition-colors"
          aria-label="Clear output"
        >
          <Trash2 className="h-3 w-3 text-gray-500 hover:text-gray-300" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed">
        {lines.length === 0 ? (
          <p className="text-gray-600">
            {runState === 'idle' ? 'Press Run to execute the current file.' : 'Starting…'}
          </p>
        ) : (
          lines.map((line, i) => (
            <pre
              key={i}
              style={{ color: STREAM_COLOR[line.stream] }}
              className="whitespace-pre-wrap break-all m-0"
              dangerouslySetInnerHTML={{ __html: ansiToHtml(line.text) }}
            />
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BottomTabBar
// ---------------------------------------------------------------------------

export default function BottomTabBar() {
  const [activeTab, setActiveTab] = useState<TabId>('terminal')
  const [collapsed, setCollapsed] = useState(false)
  const { terminalRevealCount } = useRun()
  const { terminalToggleSeq } = useEditor()

  // Expand + switch to terminal when a new run starts
  useEffect(() => {
    if (terminalRevealCount === 0) return
    setActiveTab('terminal')
    setCollapsed(false)
  }, [terminalRevealCount])

  // Toggle collapse when View > Toggle Terminal is invoked
  useEffect(() => {
    if (terminalToggleSeq === 0) return
    setCollapsed((c) => !c)
  }, [terminalToggleSeq])

  return (
    <div
      className={`bg-[#1e1e1e] border-t border-[#3c3c3c] flex flex-col shrink-0 transition-all duration-200 ${
        collapsed ? 'h-9' : activeTab === 'stakeholder' ? 'h-96' : 'h-52'
      }`}
    >
      {/* Tab bar */}
      <div className="h-9 flex items-center bg-[#252526] border-b border-[#3c3c3c] shrink-0">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              if (collapsed) setCollapsed(false)
              setActiveTab(id)
            }}
            className={`h-full flex items-center gap-1.5 px-4 text-xs font-medium border-t-2 transition-colors ${
              activeTab === id && !collapsed
                ? 'border-blue-500 text-white bg-[#1e1e1e]'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#2a2d2e]'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="px-2 py-1 mr-2 rounded hover:bg-[#3c3c3c] transition-colors"
          aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
        >
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
              collapsed ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-hidden">
          {activeTab === 'terminal' && <TerminalPanel />}
          {activeTab === 'gpu' && <GPULauncher />}
          {activeTab === 'stakeholder' && <StakeholderTab />}
        </div>
      )}
    </div>
  )
}
