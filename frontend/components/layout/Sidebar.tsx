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
// File extension → color
// ---------------------------------------------------------------------------

function fileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'py': return 'text-yellow-400'
    case 'ts': case 'tsx': return 'text-blue-400'
    case 'js': case 'jsx': return 'text-yellow-300'
    case 'json': return 'text-green-400'
    case 'md': return 'text-gray-300'
    case 'css': return 'text-pink-400'
    case 'html': return 'text-orange-400'
    default: return 'text-gray-400'
  }
}

// ---------------------------------------------------------------------------
// Tree node
// ---------------------------------------------------------------------------

function FileTreeNode({
  node,
  depth,
  onOpen,
}: {
  node: FileNode
  depth: number
  onOpen: (path: string) => void
}) {
  const [open, setOpen] = useState(depth === 0)
  const pl = depth * 12 + 8

  if (node.type === 'dir') {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-1 py-0.5 text-sm text-gray-300 hover:text-white hover:bg-[#2a2d2e] transition-colors"
          style={{ paddingLeft: pl }}
        >
          {open ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-gray-500" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-gray-500" />
          )}
          {open ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-yellow-400" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-yellow-400" />
          )}
          <span className="truncate text-xs">{node.name}</span>
        </button>
        {open &&
          node.children?.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onOpen={onOpen}
            />
          ))}
      </div>
    )
  }

  return (
    <button
      onClick={() => onOpen(node.path)}
      className="w-full flex items-center gap-1 py-0.5 text-xs text-gray-400 hover:text-white hover:bg-[#2a2d2e] transition-colors"
      style={{ paddingLeft: pl + 16 }}
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
  const { openFile } = useEditor()

  const loadTree = () => {
    setLoading(true)
    setError(null)
    fsApi
      .tree()
      .then(setTree)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadTree()
  }, [])

  return (
    <aside className="w-56 bg-[#252526] border-r border-[#3c3c3c] flex flex-col shrink-0 overflow-hidden">
      <div className="px-3 py-2 border-b border-[#3c3c3c] flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Explorer
        </span>
        <button
          onClick={loadTree}
          className="p-1 rounded hover:bg-[#3c3c3c] transition-colors"
          aria-label="Refresh tree"
        >
          <RefreshCw className="h-3 w-3 text-gray-500 hover:text-gray-300" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="py-1">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
              <Loader className="h-3 w-3 animate-spin" />
              Loading…
            </div>
          ) : error ? (
            <p className="px-3 py-2 text-xs text-red-400">{error}</p>
          ) : (
            tree.map((node) => (
              <FileTreeNode
                key={node.path}
                node={node}
                depth={0}
                onOpen={openFile}
              />
            ))
          )}
        </div>
        <GitPanel />
      </div>
    </aside>
  )
}
