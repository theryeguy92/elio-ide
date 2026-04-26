'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  GitCommit,
  Loader,
  RefreshCw,
  Sparkles,
  Upload,
} from 'lucide-react'
import { gitApi, type CommitEntry, type FileStatus } from '@/lib/gitApi'

const STATUS_COLOR: Record<string, string> = {
  M: 'text-yellow-400',
  A: 'text-green-400',
  D: 'text-red-400',
  R: 'text-blue-400',
  '?': 'text-gray-500',
}

function FileBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? 'text-gray-400'
  return (
    <span className={`text-[10px] font-bold w-3 shrink-0 ${color}`}>
      {status === '?' ? 'U' : status}
    </span>
  )
}

export default function GitPanel() {
  const [open, setOpen] = useState(true)
  const [files, setFiles] = useState<FileStatus[]>([])
  const [commits, setCommits] = useState<CommitEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [commitMsg, setCommitMsg] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [status, log] = await Promise.all([gitApi.status(), gitApi.log(5)])
      setFiles(status.files)
      setCommits(log)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const toggleStage = async (file: FileStatus) => {
    try {
      if (file.staged) {
        await gitApi.unstage([file.path])
      } else {
        await gitApi.stage([file.path])
      }
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleSuggest = async () => {
    setSuggesting(true)
    try {
      const { message } = await gitApi.suggestMessage()
      setCommitMsg(message)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSuggesting(false)
    }
  }

  const handleCommit = async () => {
    if (!commitMsg.trim()) return
    setCommitting(true)
    setError(null)
    try {
      await gitApi.commit(commitMsg.trim())
      setCommitMsg('')
      setSuccessMsg('Committed')
      setTimeout(() => setSuccessMsg(null), 2000)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCommitting(false)
    }
  }

  const handlePush = async () => {
    setPushing(true)
    setError(null)
    try {
      await gitApi.push()
      setSuccessMsg('Pushed to remote')
      setTimeout(() => setSuccessMsg(null), 2000)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPushing(false)
    }
  }

  const stagedCount = files.filter((f) => f.staged).length

  return (
    <div className="border-t border-[#3c3c3c]">
      {/* Section header */}
      <div className="flex items-center">
        <button
          onClick={() => setOpen(!open)}
          className="flex-1 flex items-center gap-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-200 hover:bg-[#2a2d2e] transition-colors"
        >
          {open ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
          <span className="flex-1 text-left">Source Control</span>
          {files.length > 0 && (
            <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 rounded-full min-w-[16px] text-center">
              {files.length}
            </span>
          )}
        </button>
        <button
          onClick={refresh}
          className="p-1.5 rounded hover:bg-[#3c3c3c] transition-colors mr-1"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-3 w-3 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="pb-2">
          {error && (
            <p className="text-[10px] text-red-400 px-3 py-1 truncate" title={error}>
              {error}
            </p>
          )}
          {successMsg && (
            <p className="text-[10px] text-green-400 px-3 py-1">{successMsg}</p>
          )}

          {/* Changed files list */}
          {files.length > 0 ? (
            <div className="mb-1">
              {files.map((file) => (
                <label
                  key={file.path}
                  className="flex items-center gap-1.5 px-3 py-0.5 hover:bg-[#2a2d2e] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={file.staged}
                    onChange={() => toggleStage(file)}
                    className="h-3 w-3 shrink-0 accent-blue-500"
                  />
                  <FileBadge status={file.status} />
                  <span
                    className="text-[11px] text-gray-300 truncate flex-1"
                    title={file.path}
                  >
                    {file.path.includes('/') ? file.path.split('/').pop() : file.path}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            !loading && (
              <p className="text-[10px] text-gray-600 px-3 py-1">No changes</p>
            )
          )}

          {/* Commit area */}
          <div className="px-3 pt-1 pb-1 space-y-1.5">
            <div className="relative">
              <textarea
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                placeholder="Commit message…"
                rows={2}
                className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-2 py-1 pr-6 text-[11px] text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                onClick={handleSuggest}
                disabled={suggesting}
                title="Suggest with AI"
                className="absolute bottom-1.5 right-1 p-0.5 rounded hover:bg-[#3c3c3c] transition-colors disabled:opacity-40"
              >
                {suggesting ? (
                  <Loader className="h-3 w-3 text-purple-400 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3 text-purple-400" />
                )}
              </button>
            </div>

            <div className="flex gap-1.5">
              <button
                onClick={handleCommit}
                disabled={committing || !commitMsg.trim() || stagedCount === 0}
                className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[11px] text-white font-medium"
              >
                {committing ? (
                  <Loader className="h-3 w-3 animate-spin" />
                ) : (
                  <GitCommit className="h-3 w-3" />
                )}
                Commit
              </button>
              <button
                onClick={handlePush}
                disabled={pushing}
                title="Push to remote"
                className="flex items-center justify-center gap-1 px-2.5 py-1 rounded bg-[#3c3c3c] hover:bg-[#4c4c4c] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[11px] text-gray-300"
              >
                {pushing ? (
                  <Loader className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>

          {/* Recent commits */}
          {commits.length > 0 && (
            <div className="border-t border-[#2a2d2e] pt-1.5 mt-1">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-500 px-3 pb-1">
                Recent commits
              </p>
              {commits.map((c) => (
                <div key={c.hash} className="px-3 py-0.5">
                  <p className="text-[10px] text-gray-300 truncate" title={c.message}>
                    {c.message}
                  </p>
                  <p className="text-[9px] text-gray-600">
                    {c.short_hash} · {c.author}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
