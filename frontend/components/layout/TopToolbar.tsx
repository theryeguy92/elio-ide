'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  GitBranch,
  Loader,
  Play,
  Settings,
  Square,
} from 'lucide-react'
import { gitApi, type BranchEntry } from '@/lib/gitApi'
import { useRun } from '@/context/RunContext'
import { useEditor } from '@/context/EditorContext'

// ---------------------------------------------------------------------------
// Menu definitions
// ---------------------------------------------------------------------------

type MenuItem = { label: string; shortcut?: string; action: () => void; divider?: boolean }

// ---------------------------------------------------------------------------
// Dropdown menu
// ---------------------------------------------------------------------------

function MenuDropdown({
  label,
  items,
}: {
  label: string
  items: MenuItem[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-[#3c3c3c] rounded transition-colors"
      >
        {label}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-0.5 w-52 bg-[#252526] border border-[#3c3c3c] rounded shadow-xl z-50 py-1">
          {items.map((item, i) => (
            <div key={i}>
              {item.divider && <div className="my-1 border-t border-[#3c3c3c]" />}
              <button
                onClick={() => { setOpen(false); item.action() }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-gray-300 hover:bg-[#2a2d2e] hover:text-white transition-colors text-left"
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span className="text-gray-500 font-mono">{item.shortcut}</span>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TopToolbar
// ---------------------------------------------------------------------------

export default function TopToolbar() {
  const { runState, startRun, stopRun } = useRun()
  const {
    activeTab,
    saveActive,
    toggleSidebar,
    toggleTrace,
    toggleTerminal,
    setComputePanelOpen,
  } = useEditor()

  const [branch, setBranch] = useState<string>('main')
  const [branches, setBranches] = useState<BranchEntry[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const branchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    gitApi.status().then((s) => setBranch(s.branch)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!dropdownOpen) return
    gitApi.branches().then(setBranches).catch(() => {})
  }, [dropdownOpen])

  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (branchRef.current && !branchRef.current.contains(e.target as Node))
        setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  const handleCheckout = async (name: string) => {
    if (name === branch) { setDropdownOpen(false); return }
    setSwitching(true)
    try {
      await gitApi.checkout(name)
      setBranch(name)
    } catch {
      // leave branch unchanged
    } finally {
      setSwitching(false)
      setDropdownOpen(false)
    }
  }

  const localBranches = branches.filter((b) => !b.remote)

  const fileMenu: MenuItem[] = [
    { label: 'Save', shortcut: 'Ctrl+S', action: saveActive },
  ]

  const viewMenu: MenuItem[] = [
    { label: 'Toggle Sidebar', shortcut: 'Ctrl+B', action: toggleSidebar },
    { label: 'Toggle Terminal', shortcut: 'Ctrl+`', action: toggleTerminal },
    { label: 'Toggle Trace Panel', action: toggleTrace },
    { label: 'Compute Settings', divider: true, action: () => setComputePanelOpen(true) },
  ]

  const runMenu: MenuItem[] = [
    {
      label: runState === 'idle' ? 'Run Active File' : 'Stop',
      shortcut: 'F5',
      action: () => {
        if (runState !== 'idle') stopRun()
        else if (activeTab) startRun(activeTab)
      },
    },
  ]

  return (
    <header className="h-10 bg-[#323233] border-b border-[#3c3c3c] flex items-center px-3 gap-4 shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-white">⚡ Elio IDE</span>
      </div>

      <div className="h-4 w-px bg-[#4c4c4c]" />

      <nav className="flex items-center gap-1">
        <MenuDropdown label="File" items={fileMenu} />
        <MenuDropdown label="View" items={viewMenu} />
        <MenuDropdown label="Run" items={runMenu} />
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Run / Stop */}
        {runState === 'idle' ? (
          <button
            onClick={() => activeTab && startRun(activeTab)}
            disabled={!activeTab}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="h-3 w-3 text-white fill-white" />
            <span className="text-xs text-white font-medium">Run</span>
          </button>
        ) : runState === 'starting' ? (
          <button
            disabled
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-green-700 opacity-75 cursor-not-allowed"
          >
            <Loader className="h-3 w-3 text-white animate-spin" />
            <span className="text-xs text-white font-medium">Starting…</span>
          </button>
        ) : (
          <button
            onClick={stopRun}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 transition-colors"
          >
            <Square className="h-3 w-3 text-white fill-white" />
            <span className="text-xs text-white font-medium">Stop</span>
          </button>
        )}

        {/* Branch switcher */}
        <div className="relative" ref={branchRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#3c3c3c] transition-colors text-xs text-gray-400 hover:text-gray-200"
          >
            {switching ? (
              <Loader className="h-3 w-3 animate-spin" />
            ) : (
              <GitBranch className="h-3 w-3" />
            )}
            <span className="max-w-[100px] truncate">{branch}</span>
            <ChevronDown
              className={`h-3 w-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-[#252526] border border-[#3c3c3c] rounded shadow-xl z-50 py-1">
              {localBranches.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-500">No branches found</p>
              ) : (
                localBranches.map((b) => (
                  <button
                    key={b.name}
                    onClick={() => handleCheckout(b.name)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-[#2a2d2e] hover:text-white transition-colors text-left"
                  >
                    <Check
                      className={`h-3 w-3 shrink-0 ${b.name === branch ? 'text-blue-400' : 'text-transparent'}`}
                    />
                    <span className="truncate">{b.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => setComputePanelOpen(true)}
          className="p-1.5 rounded hover:bg-[#3c3c3c] transition-colors"
          aria-label="Compute settings"
        >
          <Settings className="h-4 w-4 text-gray-400" />
        </button>
      </div>
    </header>
  )
}
