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
// Dropdown menu
// ---------------------------------------------------------------------------

type MenuItem = { label: string; shortcut?: string; action: () => void; divider?: boolean }

function MenuDropdown({ label, items }: { label: string; items: MenuItem[] }) {
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
        className="px-2 py-1 text-[11px] text-elio-text-muted hover:text-elio-text hover:bg-elio-surface-2 rounded transition-colors duration-150"
      >
        {label}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-0.5 w-52 bg-elio-surface border border-elio-border rounded shadow-2xl z-50 py-1">
          {items.map((item, i) => (
            <div key={i}>
              {item.divider && <div className="my-1 border-t border-elio-border" />}
              <button
                onClick={() => { setOpen(false); item.action() }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-elio-text-muted hover:bg-elio-surface-2 hover:text-elio-text transition-colors duration-150 text-left"
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span className="text-elio-text-dim font-mono text-[10px]">{item.shortcut}</span>
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
    tabs,
    activeTab,
    saveActive,
    toggleSidebar,
    toggleTrace,
    toggleTerminal,
    setComputePanelOpen,
  } = useEditor()

  const [branch, setBranch] = useState<string>('main')
  const [branches, setBranches] = useState<BranchEntry[]>([])
  const [branchOpen, setBranchOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const branchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    gitApi.status().then((s) => setBranch(s.branch)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!branchOpen) return
    gitApi.branches().then(setBranches).catch(() => {})
  }, [branchOpen])

  useEffect(() => {
    if (!branchOpen) return
    const handler = (e: MouseEvent) => {
      if (branchRef.current && !branchRef.current.contains(e.target as Node))
        setBranchOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [branchOpen])

  const handleCheckout = async (name: string) => {
    if (name === branch) { setBranchOpen(false); return }
    setSwitching(true)
    try { await gitApi.checkout(name); setBranch(name) } catch { /* keep current */ }
    finally { setSwitching(false); setBranchOpen(false) }
  }

  const activeTabMeta = tabs.find((t) => t.path === activeTab)
  const activeFileName = activeTab ? activeTab.split('/').pop() : null
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
    <header className="h-10 bg-elio-bg border-b border-elio-border flex items-center px-3 gap-3 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/elio-logo.png" alt="Elio" height={22} width={22} className="h-[22px] w-[22px] object-contain" />
        <span className="text-[13px] font-semibold text-elio-primary tracking-tight">elio</span>
      </div>

      <div className="h-4 w-px bg-elio-border shrink-0" />

      {/* Menu bar */}
      <nav className="flex items-center gap-0.5 shrink-0">
        <MenuDropdown label="File" items={fileMenu} />
        <MenuDropdown label="View" items={viewMenu} />
        <MenuDropdown label="Run" items={runMenu} />
      </nav>

      {/* Center — active filename */}
      <div className="flex-1 flex items-center justify-center">
        {activeFileName && (
          <span className="text-[11px] text-elio-text-muted font-mono select-none">
            {activeFileName}
            {activeTabMeta?.isDirty && (
              <span className="ml-1 text-elio-primary">●</span>
            )}
          </span>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Git branch pill */}
        <div className="relative" ref={branchRef}>
          <button
            onClick={() => setBranchOpen(!branchOpen)}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-elio-surface border border-elio-border hover:border-elio-border-bright text-[11px] text-elio-text-muted hover:text-elio-text transition-all duration-150"
          >
            {switching ? (
              <Loader className="h-3 w-3 animate-spin" />
            ) : (
              <GitBranch className="h-3 w-3" />
            )}
            <span className="max-w-[90px] truncate">{branch}</span>
            <ChevronDown
              className={`h-3 w-3 transition-transform duration-150 ${branchOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {branchOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-elio-surface border border-elio-border rounded shadow-2xl z-50 py-1">
              {localBranches.length === 0 ? (
                <p className="px-3 py-2 text-[11px] text-elio-text-dim">No branches found</p>
              ) : (
                localBranches.map((b) => (
                  <button
                    key={b.name}
                    onClick={() => handleCheckout(b.name)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-elio-text-muted hover:bg-elio-surface-2 hover:text-elio-text transition-colors duration-150 text-left"
                  >
                    <Check
                      className={`h-3 w-3 shrink-0 ${b.name === branch ? 'text-elio-primary' : 'text-transparent'}`}
                    />
                    <span className="truncate">{b.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Compute button */}
        <button
          onClick={() => setComputePanelOpen(true)}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-elio-surface border border-elio-border hover:border-elio-border-bright text-[11px] text-elio-text-muted hover:text-elio-text transition-all duration-150"
          aria-label="Compute settings"
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Compute</span>
        </button>

        {/* Run / Stop */}
        {runState === 'idle' ? (
          <button
            onClick={() => activeTab && startRun(activeTab)}
            disabled={!activeTab}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-elio-primary hover:bg-elio-primary-dim text-black font-semibold text-[11px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
          >
            <Play className="h-3 w-3 fill-black" />
            Run
          </button>
        ) : runState === 'starting' ? (
          <button
            disabled
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-elio-primary opacity-60 cursor-not-allowed text-black font-semibold text-[11px]"
          >
            <Loader className="h-3 w-3 animate-spin" />
            Starting…
          </button>
        ) : (
          <button
            onClick={stopRun}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-elio-error hover:opacity-90 text-white font-semibold text-[11px] transition-opacity duration-150"
          >
            <Square className="h-3 w-3 fill-white" />
            Stop
          </button>
        )}
      </div>
    </header>
  )
}
