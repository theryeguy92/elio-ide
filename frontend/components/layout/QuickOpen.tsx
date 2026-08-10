'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, FileCode } from 'lucide-react'
import { fsApi, type FileNode } from '@/lib/fsApi'
import { vaultApi, type VaultNode } from '@/lib/vaultApi'
import { useEditor } from '@/context/EditorContext'
import { fileColor } from '@/lib/fileColor'

type Item = { path: string; kind: 'file' | 'note'; label: string }

function flatten(nodes: (FileNode | VaultNode)[], kind: Item['kind'], out: Item[]) {
  for (const n of nodes) {
    if (n.type === 'dir') flatten(n.children ?? [], kind, out)
    else out.push({ path: n.path, kind, label: n.name })
  }
}

/** Subsequence match, ranked: basename startsWith > basename includes > path subsequence. */
function rank(query: string, item: Item): number {
  if (!query) return 1
  const q = query.toLowerCase()
  const base = item.label.toLowerCase()
  const path = item.path.toLowerCase()
  if (base.startsWith(q)) return 3
  if (base.includes(q)) return 2
  let i = 0
  for (const ch of path) if (ch === q[i]) i++
  return i === q.length ? 1 : 0
}

export default function QuickOpen() {
  const { quickOpenOpen, setQuickOpenOpen, openFile, openNote } = useEditor()
  const [items, setItems] = useState<Item[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!quickOpenOpen) return
    setQuery('')
    setSelected(0)
    const all: Item[] = []
    Promise.allSettled([fsApi.tree(), vaultApi.tree()]).then(([fs, vault]) => {
      if (fs.status === 'fulfilled') flatten(fs.value, 'file', all)
      if (vault.status === 'fulfilled') flatten(vault.value, 'note', all)
      setItems(all)
    })
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [quickOpenOpen])

  const matches = useMemo(
    () =>
      items
        .map((item) => ({ item, score: rank(query, item) }))
        .filter((m) => m.score > 0)
        .sort((a, b) => b.score - a.score || a.item.path.localeCompare(b.item.path))
        .slice(0, 30)
        .map((m) => m.item),
    [items, query],
  )

  if (!quickOpenOpen) return null

  const open = (item: Item) => {
    setQuickOpenOpen(false)
    if (item.kind === 'note') openNote(item.path)
    else openFile(item.path)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setQuickOpenOpen(false)
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, matches.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter' && matches[selected]) open(matches[selected])
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60"
      onClick={() => setQuickOpenOpen(false)}
    >
      <div
        className="w-[480px] rounded-lg border border-elio-border-bright bg-elio-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(0) }}
          onKeyDown={onKeyDown}
          placeholder="Type a file or note name…"
          className="w-full bg-transparent px-3 py-2.5 text-xs text-elio-text placeholder:text-elio-text-dim outline-none border-b border-elio-border"
        />
        <div className="max-h-[40vh] overflow-y-auto py-1">
          {matches.length === 0 ? (
            <p className="px-3 py-3 text-[11px] text-elio-text-dim">No matches</p>
          ) : (
            matches.map((item, i) => (
              <button
                key={`${item.kind}:${item.path}`}
                onClick={() => open(item)}
                onMouseEnter={() => setSelected(i)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors duration-75 ${
                  i === selected ? 'bg-elio-surface-2' : ''
                }`}
              >
                {item.kind === 'note' ? (
                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-elio-text-dim" />
                ) : (
                  <FileCode className={`h-3.5 w-3.5 shrink-0 ${fileColor(item.label)}`} />
                )}
                <span className="text-[11px] text-elio-text truncate">{item.label}</span>
                <span className="text-[10px] text-elio-text-dim truncate ml-auto pl-2">
                  {item.path}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
