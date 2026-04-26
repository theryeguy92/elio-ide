import { CheckCircle, XCircle, Loader, Clock, Coins } from 'lucide-react'
import type { Run, RunStatus } from '@/lib/traceApi'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

// ---------------------------------------------------------------------------
// Status indicator
// ---------------------------------------------------------------------------

function RunStatusDot({ status }: { status: RunStatus }) {
  if (status === 'running') {
    return (
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
      </span>
    )
  }
  if (status === 'completed') {
    return <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-400" />
  }
  return <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
}

// ---------------------------------------------------------------------------
// Single run row
// ---------------------------------------------------------------------------

function RunRow({ run, onClick }: { run: Run; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-[#2a2d2e] transition-colors group"
    >
      <div className="mt-0.5">
        <RunStatusDot status={run.status} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-200 truncate group-hover:text-white">
          {run.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-gray-500">{relativeTime(run.created_at)}</span>
          {run.total_tokens !== null && (
            <span className="text-[10px] text-gray-500">
              {run.total_tokens.toLocaleString()} tok
            </span>
          )}
          {run.total_cost !== null && (
            <span className="text-[10px] text-gray-500">${run.total_cost.toFixed(4)}</span>
          )}
        </div>
      </div>

      <span
        className={`mt-0.5 shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border capitalize ${
          run.status === 'running'
            ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
            : run.status === 'completed'
              ? 'border-green-500/40 bg-green-500/10 text-green-400'
              : 'border-red-500/40 bg-red-500/10 text-red-400'
        }`}
      >
        {run.status}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// RunList
// ---------------------------------------------------------------------------

export default function RunList({
  runs,
  loading,
  onSelect,
}: {
  runs: Run[]
  loading: boolean
  onSelect: (id: string) => void
}) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-gray-500 text-xs">
        <Loader className="h-3.5 w-3.5 animate-spin" />
        Loading runs…
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center">
        <Clock className="h-8 w-8 text-gray-600" />
        <p className="text-xs text-gray-500">No runs yet.</p>
        <p className="text-[10px] text-gray-600">
          Start an agent run and it will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto divide-y divide-[#2d2d2d]">
      {runs.map((run) => (
        <RunRow key={run.id} run={run} onClick={() => onSelect(run.id)} />
      ))}
    </div>
  )
}
