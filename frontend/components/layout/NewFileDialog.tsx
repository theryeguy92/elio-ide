'use client'

import { useEffect, useRef, useState } from 'react'
import { fsApi } from '@/lib/fsApi'
import { vaultApi } from '@/lib/vaultApi'
import { useEditor } from '@/context/EditorContext'

export default function NewFileDialog() {
  const { newFileTarget, setNewFileTarget, openFile, openNote } = useEditor()
  const [path, setPath] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!newFileTarget) return
    setPath('')
    setError(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [newFileTarget])

  if (!newFileTarget) return null
  const isVault = newFileTarget === 'vault'

  const create = async () => {
    let p = path.trim().replace(/^\/+/, '')
    if (!p || busy) return
    if (isVault && !p.toLowerCase().endsWith('.md')) p += '.md'
    setBusy(true)
    setError(null)
    try {
      if (isVault) {
        await vaultApi.writeNote(p, '')
        setNewFileTarget(null)
        openNote(p)
      } else {
        await fsApi.writeFile(p, '')
        setNewFileTarget(null)
        openFile(p)
      }
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/60"
      onClick={() => setNewFileTarget(null)}
    >
      <div
        className="w-[400px] rounded-lg border border-elio-border-bright bg-elio-surface shadow-2xl p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-semibold text-elio-text">
          {isVault ? 'New vault note' : 'New file'}
        </p>
        <input
          ref={inputRef}
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') create()
            if (e.key === 'Escape') setNewFileTarget(null)
          }}
          placeholder={isVault ? 'folder/note-name' : 'src/path/to/file.py'}
          className="w-full bg-elio-surface-2 border border-elio-border rounded px-2 py-1.5 text-[11px] font-mono text-elio-text placeholder:text-elio-text-dim outline-none focus:border-elio-primary transition-colors duration-150"
        />
        {isVault && (
          <p className="text-[10px] text-elio-text-dim">.md is added automatically if omitted.</p>
        )}
        {error && <p className="text-[10px] text-elio-error">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setNewFileTarget(null)}
            className="px-3 py-1 rounded text-[11px] text-elio-text-muted hover:text-elio-text hover:bg-elio-surface-2 transition-colors duration-150"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={!path.trim() || busy}
            className="px-3 py-1 rounded bg-elio-primary hover:bg-elio-primary-dim text-black text-[11px] font-semibold disabled:opacity-40 transition-colors duration-150"
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
