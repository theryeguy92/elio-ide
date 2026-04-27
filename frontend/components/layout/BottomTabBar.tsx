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
  { id: 'terminal'    as TabId, label: 'Terminal',    icon: Terminal },
  { id: 'gpu'         as TabId, label: 'GPU',         icon: Cpu },
  { id: 'stakeholder' as TabId, label: 'Stakeholder', icon: Users },
]

// ---------------------------------------------------------------------------
// Terminal panel
// ---------------------------------------------------------------------------

const converter = new AnsiToHtml({ escapeXML: true })

const STREAM_COLOR: Record<Stream, string> = {
  stdout:   'var(--elio-text-muted)',
  stderr:   'var(--elio-error)',
  system:   '#60a5fa',
  exit_ok:  'var(--elio-success)',
  exit_err: 'var(--elio-error)',
}

function ansiToHtml(text: string): string {
  try { return converter.toHtml(text) }
  catch { return text.replace(/\x1B\[[0-9;]*m/g, '') }
}

function TerminalPanel() {
  const { lines, clearOutput, runState } = useRun()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines.length])

  return (
    <div className="h-full bg-elio-bg flex flex-col">
      <div className="flex items-center justify-between px-3 py-1 border-b border-elio-border shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-elio-text-dim">
          Output
          {runState !== 'idle' && (
            <span className="ml-2 inline-flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-elio-primary opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-elio-primary" />
              </span>
              <span className="text-elio-primary">running</span>
            </span>
          )}
        </span>
        <button
          onClick={clearOutput}
          className="p-1 rounded hover:bg-elio-surface-2 transition-colors duration-150"
        >
          <Trash2 className="h-3 w-3 text-elio-text-dim hover:text-elio-text-muted" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed">
        {lines.length === 0 ? (
          <p className="text-elio-text-dim">
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

  useEffect(() => {
    if (terminalRevealCount === 0) return
    setActiveTab('terminal')
    setCollapsed(false)
  }, [terminalRevealCount])

  useEffect(() => {
    if (terminalToggleSeq === 0) return
    setCollapsed((c) => !c)
  }, [terminalToggleSeq])

  return (
    <div
      className={`bg-elio-bg border-t border-elio-border flex flex-col shrink-0 transition-all duration-200 ${
        collapsed ? 'h-8' : activeTab === 'stakeholder' ? 'h-96' : 'h-52'
      }`}
    >
      {/* Tab bar */}
      <div className="h-8 flex items-center bg-elio-bg border-b border-elio-border shrink-0">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { if (collapsed) setCollapsed(false); setActiveTab(id) }}
            className={`h-full flex items-center gap-1.5 px-3 text-[10px] font-medium border-b-2 transition-all duration-150 ${
              activeTab === id && !collapsed
                ? 'border-elio-primary text-elio-text'
                : 'border-transparent text-elio-text-dim hover:text-elio-text-muted hover:bg-elio-surface-2'
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="px-2 py-1 mr-1 rounded hover:bg-elio-surface-2 transition-colors duration-150"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 text-elio-text-dim transition-transform duration-200 ${
              collapsed ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-hidden">
          {activeTab === 'terminal'    && <TerminalPanel />}
          {activeTab === 'gpu'         && <GPULauncher />}
          {activeTab === 'stakeholder' && <StakeholderTab />}
        </div>
      )}
    </div>
  )
}
