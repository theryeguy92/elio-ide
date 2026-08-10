'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowUp, Check, Folder, Loader } from 'lucide-react'
import { settingsApi, type BrowseResult } from '@/lib/settingsApi'

export default function FolderPicker({
  initialPath,
  onSelect,
  onClose,
}: {
  initialPath: string
  onSelect: (path: string) => void
  onClose: () => void
}) {
  const [current, setCurrent] = useState<BrowseResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback((path: string) => {
    setError(null)
    settingsApi.browse(path).then(setCurrent).catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => { load(initialPath || '~') }, [initialPath, load])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-[440px] rounded-lg border border-elio-border-bright bg-elio-surface shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Current path + up */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-elio-border">
          <button
            onClick={() => current?.parent && load(current.parent)}
            disabled={!current?.parent}
            className="p-1 rounded hover:bg-elio-surface-2 disabled:opacity-30 transition-colors duration-150"
            aria-label="Up one level"
          >
            <ArrowUp className="h-3.5 w-3.5 text-elio-text-muted" />
          </button>
          <span className="text-[11px] font-mono text-elio-text truncate" title={current?.path}>
            {current?.path ?? '…'}
          </span>
        </div>

        {/* Directory list */}
        <div className="h-64 overflow-y-auto py-1">
          {error ? (
            <p className="px-3 py-2 text-[11px] text-elio-error">{error}</p>
          ) : !current ? (
            <div className="px-3 py-2 flex items-center gap-2 text-[11px] text-elio-text-dim">
              <Loader className="h-3 w-3 animate-spin" /> Loading…
            </div>
          ) : current.dirs.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-elio-text-dim">No subdirectories</p>
          ) : (
            current.dirs.map((dir) => (
              <button
                key={dir}
                onClick={() => load(`${current.path}/${dir}`)}
                onDoubleClick={() => onSelect(`${current.path}/${dir}`)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-elio-text-muted hover:bg-elio-surface-2 hover:text-elio-text transition-colors duration-75"
              >
                <Folder className="h-3.5 w-3.5 shrink-0 text-elio-primary opacity-60" />
                <span className="text-[11px] truncate">{dir}</span>
              </button>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-elio-border">
          <span className="text-[9px] text-elio-text-dim">Click to enter · select when inside the folder</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1 rounded text-[11px] text-elio-text-muted hover:text-elio-text hover:bg-elio-surface-2 transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              onClick={() => current && onSelect(current.path)}
              disabled={!current}
              className="flex items-center gap-1 px-3 py-1 rounded bg-elio-primary hover:bg-elio-primary-dim text-black text-[11px] font-semibold disabled:opacity-40 transition-colors duration-150"
            >
              <Check className="h-3 w-3" />
              Select this folder
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
