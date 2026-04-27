'use client'

import { useEffect, useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  Loader,
  RefreshCw,
} from 'lucide-react'
import { fsApi, type FileNode } from '@/lib/fsApi'
import { useEditor } from '@/context/EditorContext'
import GitPanel from '@/components/git/GitPanel'

// ---------------------------------------------------------------------------
// File extension → accent color
// ---------------------------------------------------------------------------

function fileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'py':           return 'text-[#F5A623]'   // amber — Python is first-class
    case 'ts': case 'tsx': return 'text-blue-400'
    case 'js': case 'jsx': return 'text-yellow-300'
    case 'json':         return 'text-green-400'
    case 'md':           return 'text-elio-text-muted'
    case 'css':          return 'text-pink-400'
    case 'html':         return 'text-orange-400'
    case 'yaml': case 'yml': return 'text-teal-400'
    default:             return 'text-elio-text-dim'
  }
}

// ---------------------------------------------------------------------------
// Tree node
// ---------------------------------------------------------------------------

function FileTreeNode({
  node,
  depth,
  activeTab,
  onOpen,
}: {
  node: FileNode
  depth: number
  activeTab: string | null
  onOpen: (path: string) => void
}) {
  const [open, setOpen] = useState(depth < 2)
  const pl = depth * 12 + 8
  const isActive = node.type === 'file' && node.path === activeTab

  if (node.type === 'dir') {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-1 py-[3px] text-elio-text-muted hover:text-elio-text hover:bg-elio-surface-2 transition-colors duration-150"
          style={{ paddingLeft: pl }}
        >
          {open ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-elio-text-dim" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-elio-text-dim" />
          )}
          {open ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-elio-primary opacity-70" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-elio-primary opacity-50" />
          )}
          <span className="truncate text-[11px]">{node.name}</span>
        </button>
        {open &&
          node.children?.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              activeTab={activeTab}
              onOpen={onOpen}
            />
          ))}
      </div>
    )
  }

  return (
    <button
      onClick={() => onOpen(node.path)}
      className={`w-full flex items-center gap-1 py-[3px] text-[11px] transition-colors duration-150 ${
        isActive
          ? 'bg-elio-surface-2 text-elio-text border-l-2 border-elio-primary'
          : 'text-elio-text-muted hover:text-elio-text hover:bg-elio-surface-2 border-l-2 border-transparent'
      }`}
      style={{ paddingLeft: isActive ? pl + 14 : pl + 16 }}
    >
      <File className={`h-3.5 w-3.5 shrink-0 ${fileColor(node.name)}`} />
      <span className="truncate">{node.name}</span>
    </button>
  )
}

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
              activeTab={activeTab}
              onOpen={openFile}
            />
          ))
        )}
        <GitPanel />
      </div>
    </aside>
  )
}
