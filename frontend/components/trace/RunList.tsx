import { CheckCircle, XCircle, Loader, Clock } from 'lucide-react'
import type { Run, RunStatus } from '@/lib/traceApi'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

function RunStatusIcon({ status }: { status: RunStatus }) {
  if (status === 'running') {
    return (
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-elio-primary opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-elio-primary" />
      </span>
    )
  }
  if (status === 'completed') return <CheckCircle className="h-3.5 w-3.5 shrink-0 text-elio-success" />
  return <XCircle className="h-3.5 w-3.5 shrink-0 text-elio-error" />
}

function RunRow({ run, onClick }: { run: Run; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-elio-surface-2 transition-colors duration-150 group"
    >
      <div className="mt-0.5">
        <RunStatusIcon status={run.status} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-elio-text-muted truncate group-hover:text-elio-text transition-colors duration-150">
          {run.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-elio-text-dim">{relativeTime(run.created_at)}</span>
          {run.total_tokens !== null && (
            <span className="text-[10px] text-elio-text-dim font-mono">
              {run.total_tokens.toLocaleString()}t
            </span>
          )}
          {run.total_cost !== null && (
            <span className="text-[10px] text-elio-text-dim font-mono">${run.total_cost.toFixed(4)}</span>
          )}
        </div>
      </div>

      <span
        className={`mt-0.5 shrink-0 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
          run.status === 'running'
            ? 'border-elio-primary/40 bg-elio-primary/10 text-elio-primary'
            : run.status === 'completed'
              ? 'border-elio-success/30 bg-elio-success/10 text-elio-success'
              : 'border-elio-error/30 bg-elio-error/10 text-elio-error'
        }`}
      >
        {run.status}
      </span>
    </button>
  )
}

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
      <div className="flex-1 flex items-center justify-center gap-2 text-elio-text-dim text-[11px]">
        <Loader className="h-3.5 w-3.5 animate-spin" />
        Loading runs…
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center">
        <Clock className="h-8 w-8 text-elio-text-dim opacity-40" />
        <p className="text-[11px] text-elio-text-muted">No runs yet.</p>
        <p className="text-[10px] text-elio-text-dim">
          Start an agent run and it will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto divide-y divide-elio-border">
      {runs.map((run) => (
        <RunRow key={run.id} run={run} onClick={() => onSelect(run.id)} />
      ))}
    </div>
  )
}
