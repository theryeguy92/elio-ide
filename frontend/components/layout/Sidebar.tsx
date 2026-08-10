'use client'

import { useEffect, useState } from 'react'
import { Loader, RefreshCw } from 'lucide-react'
import { fsApi, type FileNode } from '@/lib/fsApi'
import { useEditor } from '@/context/EditorContext'
import GitPanel from '@/components/git/GitPanel'
import VaultPanel from '@/components/vault/VaultPanel'
import FileTreeNode from '@/components/layout/FileTreeNode'

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export default function Sidebar() {
  const [tree, setTree] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { openFile, activeTab } = useEditor()

  const loadTree = () => {
    setLoading(true)
    setError(null)
    fsApi
      .tree()
      .then(setTree)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadTree() }, [])

  return (
    <aside className="w-60 bg-elio-surface border-r border-elio-border flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-elio-border shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-elio-text-dim">
          Explorer
        </span>
        <button
          onClick={loadTree}
          className="p-1 rounded hover:bg-elio-surface-2 transition-colors duration-150"
          aria-label="Refresh tree"
        >
          <RefreshCw className="h-3 w-3 text-elio-text-dim hover:text-elio-text-muted" />
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-elio-text-dim">
            <Loader className="h-3 w-3 animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <p className="px-3 py-2 text-[11px] text-elio-error">{error}</p>
        ) : (
          tree.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              depth={0}
              activePath={activeTab}
              onOpen={openFile}
            />
          ))
        )}
        <GitPanel />
      </div>
      <VaultPanel />
    </aside>
  )
}
