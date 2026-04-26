'use client'

import { useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  Search,
  GitBranch,
  Package,
} from 'lucide-react'
import GitPanel from '@/components/git/GitPanel'

type FileNode = {
  name: string
  type: 'file' | 'folder'
  children?: FileNode[]
}

const fileTree: FileNode[] = [
  {
    name: 'agents',
    type: 'folder',
    children: [
      { name: 'main_agent.py', type: 'file' },
      { name: 'tools.py', type: 'file' },
      { name: 'prompts.py', type: 'file' },
    ],
  },
  {
    name: 'workflows',
    type: 'folder',
    children: [
      { name: 'pipeline.py', type: 'file' },
      { name: 'tasks.py', type: 'file' },
    ],
  },
  { name: 'config.yaml', type: 'file' },
  { name: 'requirements.txt', type: 'file' },
  { name: 'README.md', type: 'file' },
]

function FileTreeNode({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const [open, setOpen] = useState(depth === 0)
  const indent = depth * 12 + 8

  if (node.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-1 py-0.5 text-sm text-gray-300 hover:text-white hover:bg-[#2a2d2e] transition-colors"
          style={{ paddingLeft: indent }}
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
          <span className="truncate">{node.name}</span>
        </button>
        {open &&
          node.children?.map((child) => (
            <FileTreeNode key={child.name} node={child} depth={depth + 1} />
          ))}
      </div>
    )
  }

  return (
    <button
      className="w-full flex items-center gap-1 py-0.5 text-sm text-gray-400 hover:text-white hover:bg-[#2a2d2e] transition-colors"
      style={{ paddingLeft: indent + 16 }}
    >
      <File className="h-3.5 w-3.5 shrink-0 text-gray-500" />
      <span className="truncate">{node.name}</span>
    </button>
  )
}

export default function Sidebar() {
  return (
    <aside className="w-56 bg-[#252526] border-r border-[#3c3c3c] flex flex-col shrink-0 overflow-hidden">
      <div className="px-4 py-2 border-b border-[#3c3c3c]">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Explorer
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="py-1">
          <div className="px-3 py-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
            Elio Project
          </div>
          {fileTree.map((node) => (
            <FileTreeNode key={node.name} node={node} />
          ))}
        </div>
        <GitPanel />
      </div>

      <div className="border-t border-[#3c3c3c] p-2 flex gap-1">
        <button
          className="p-1.5 rounded hover:bg-[#3c3c3c] transition-colors"
          aria-label="Search"
        >
          <Search className="h-4 w-4 text-gray-400" />
        </button>
        <button
          className="p-1.5 rounded hover:bg-[#3c3c3c] transition-colors"
          aria-label="Source control"
        >
          <GitBranch className="h-4 w-4 text-gray-400" />
        </button>
        <button
          className="p-1.5 rounded hover:bg-[#3c3c3c] transition-colors"
          aria-label="Extensions"
        >
          <Package className="h-4 w-4 text-gray-400" />
        </button>
      </div>
    </aside>
  )
}
