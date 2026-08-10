'use client'

import { useEffect, useState } from 'react'
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Loader,
  RefreshCw,
  Search,
} from 'lucide-react'
import { vaultApi, type SearchHit, type VaultNode } from '@/lib/vaultApi'
import { useEditor } from '@/context/EditorContext'
import FileTreeNode from '@/components/layout/FileTreeNode'

export default function VaultPanel() {
  const [collapsed, setCollapsed] = useState(false)
  const [tree, setTree] = useState<VaultNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const { openNote, activeTab } = useEditor()
  const activeNote = activeTab?.startsWith('vault:') ? activeTab.slice(6) : null

  const loadTree = () => {
    setLoading(true)
    setError(null)
    vaultApi
      .tree()
      .then(setTree)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadTree() }, [])

  // ponytail: debounce-free search on submit only; add live search if typing lag matters
  const runSearch = () => {
    const q = query.trim()
    if (!q) {
      setHits(null)
      return
    }
    vaultApi.search(q).then(setHits).catch((e: Error) => setError(e.message))
  }

  return (
    <div className="border-t border-elio-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-elio-text-dim hover:text-elio-text-muted"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          <BookOpen className="h-3 w-3" />
          Vault
        </button>
        <button
          onClick={loadTree}
          className="p-1 rounded hover:bg-elio-surface-2 transition-colors duration-150"
          aria-label="Refresh vault"
        >
          <RefreshCw className="h-3 w-3 text-elio-text-dim hover:text-elio-text-muted" />
        </button>
      </div>

      {!collapsed && (
        <div className="pb-2">
          {/* Search */}
          <div className="flex items-center gap-1 mx-2 mb-1 px-2 py-1 rounded bg-elio-surface-2">
            <Search className="h-3 w-3 shrink-0 text-elio-text-dim" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="Search notes…"
              className="w-full bg-transparent text-[11px] text-elio-text placeholder:text-elio-text-dim outline-none"
            />
          </div>

          {loading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-elio-text-dim">
              <Loader className="h-3 w-3 animate-spin" />
              Loading…
            </div>
          ) : error ? (
            <p className="px-3 py-2 text-[11px] text-elio-error">{error}</p>
          ) : hits !== null ? (
            <>
              <button
                onClick={() => { setHits(null); setQuery('') }}
                className="px-3 py-1 text-[10px] text-elio-text-dim hover:text-elio-text-muted"
              >
                ← Back to tree ({hits.length} result{hits.length === 1 ? '' : 's'})
              </button>
              {hits.map((hit) => (
                <button
                  key={hit.path}
                  onClick={() => openNote(hit.path)}
                  className="w-full text-left px-3 py-1 hover:bg-elio-surface-2 transition-colors duration-150"
                >
                  <div className="text-[11px] text-elio-text truncate">
                    {hit.path.replace(/\.md$/i, '')}
                  </div>
                  <div className="text-[10px] text-elio-text-dim truncate">{hit.snippet}</div>
                </button>
              ))}
            </>
          ) : (
            tree.map((node) => (
              <FileTreeNode
                key={node.path}
                node={node}
                depth={0}
                activePath={activeNote}
                stripMd
                defaultOpenDepth={1}
                onOpen={openNote}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
