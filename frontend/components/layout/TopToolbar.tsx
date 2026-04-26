'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Settings, GitBranch, Zap, ChevronDown, Check, Loader } from 'lucide-react'
import { gitApi, type BranchEntry } from '@/lib/gitApi'

const menuItems = ['File', 'Edit', 'View', 'Run', 'Help']

export default function TopToolbar() {
  const [branch, setBranch] = useState<string>('main')
  const [branches, setBranches] = useState<BranchEntry[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    gitApi.status().then((s) => setBranch(s.branch)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!dropdownOpen) return
    gitApi.branches().then(setBranches).catch(() => {})
  }, [dropdownOpen])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  const handleCheckout = async (name: string) => {
    if (name === branch) { setDropdownOpen(false); return }
    setSwitching(true)
    try {
      await gitApi.checkout(name)
      setBranch(name)
    } catch {
      // leave branch unchanged on error
    } finally {
      setSwitching(false)
      setDropdownOpen(false)
    }
  }

  const localBranches = branches.filter((b) => !b.remote)

  return (
    <header className="h-10 bg-[#323233] border-b border-[#3c3c3c] flex items-center px-3 gap-4 shrink-0">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-semibold text-white">Elio IDE</span>
      </div>

      <div className="h-4 w-px bg-[#4c4c4c]" />

      <nav className="flex items-center gap-1">
        {menuItems.map((item) => (
          <button
            key={item}
            className="px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {item}
          </button>
        ))}
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 transition-colors">
          <Play className="h-3 w-3 text-white fill-white" />
          <span className="text-xs text-white font-medium">Run Agent</span>
        </button>

        {/* Branch switcher */}
        <div className="relative" ref={dropdownRef}>
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
            <ChevronDown className={`h-3 w-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
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
          className="p-1.5 rounded hover:bg-[#3c3c3c] transition-colors"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4 text-gray-400" />
        </button>
      </div>
    </header>
  )
}
