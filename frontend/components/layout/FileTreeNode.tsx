'use client'

import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
} from 'lucide-react'
import { fileColor } from '@/lib/fileColor'

export type TreeNode = {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: TreeNode[]
}

/** Generic collapsible file tree row — shared by Sidebar and VaultPanel. */
export default function FileTreeNode({
  node,
  depth,
  activePath = null,
  stripMd = false,
  defaultOpenDepth = 2,
  onOpen,
}: {
  node: TreeNode
  depth: number
  activePath?: string | null
  stripMd?: boolean
  defaultOpenDepth?: number
  onOpen: (path: string) => void
}) {
  const [open, setOpen] = useState(depth < defaultOpenDepth)
  const pl = depth * 12 + 8
  const isActive = node.type === 'file' && node.path === activePath

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
              activePath={activePath}
              stripMd={stripMd}
              defaultOpenDepth={defaultOpenDepth}
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
      <span className="truncate">
        {stripMd ? node.name.replace(/\.md$/i, '') : node.name}
      </span>
    </button>
  )
}
