'use client'

import { useEffect, useState } from 'react'
import { X, Loader, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react'
import { stakeholderApi, type NodeDescription, type StakeholderNode } from '@/lib/stakeholderApi'

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  agent:  { label: 'Agent',  className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  tool:   { label: 'Tool',   className: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  memory: { label: 'Memory', className: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <CheckCircle className="h-3 w-3 text-elio-success shrink-0" />,
  failed:    <XCircle    className="h-3 w-3 text-elio-error shrink-0" />,
  running:   <Loader     className="h-3 w-3 text-blue-400 shrink-0 animate-spin" />,
}

function formatTs(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch {
    return ts
  }
}

export default function NodeSidebar({
  node,
  onClose,
}: {
  node: StakeholderNode
  onClose: () => void
}) {
  const [data, setData] = useState<NodeDescription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    setLoading(true)
    setError(null)

    stakeholderApi
      .describe(node.id)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [node.id])

  const badge = TYPE_BADGE[node.type]

  return (
    <div className="absolute right-0 top-0 bottom-0 w-56 bg-elio-bg border-l border-elio-border flex flex-col z-10 shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-elio-border shrink-0">
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badge.className}`}
        >
          {badge.label}
        </span>
        <span className="text-xs font-medium text-elio-text flex-1 truncate">{node.label}</span>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-elio-surface-3 transition-colors shrink-0"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5 text-elio-text-dim" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Description */}
        <div className="px-3 py-2.5 border-b border-elio-border">
          {loading && (
            <div className="flex items-center gap-2 text-elio-text-dim text-xs">
              <Loader className="h-3 w-3 animate-spin" />
              Asking Claude…
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-elio-error shrink-0 mt-0.5" />
              <p className="text-[11px] text-elio-error">{error}</p>
            </div>
          )}
          {data && (
            <p className="text-[11px] text-elio-text leading-relaxed">{data.description}</p>
          )}
        </div>

        {/* Stats */}
        <div className="px-3 py-2 border-b border-elio-border">
          <div className="grid grid-cols-2 gap-1.5">
            <Stat label="Calls" value={node.call_count} />
            <Stat
              label="Health"
              value={`${Math.round((node.metadata.success_rate ?? 1) * 100)}%`}
            />
            {node.type === 'memory' && (
              <>
                <Stat label="Reads"  value={node.metadata.read_count} />
                <Stat label="Writes" value={node.metadata.write_count} />
              </>
            )}
          </div>
        </div>

        {/* Recent steps */}
        {data && data.recent_steps.length > 0 && (
          <div className="px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-elio-text-dim mb-2">
              Recent activity
            </p>
            <div className="space-y-2">
              {data.recent_steps.map((step, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  {STATUS_ICON[step.status] ?? <Clock className="h-3 w-3 text-elio-text-dim shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-elio-text font-medium capitalize">
                      {step.type.replace('_', ' ')}
                    </p>
                    {step.input_summary && (
                      <p className="text-[9px] text-elio-text-dim truncate" title={step.input_summary}>
                        {step.input_summary}
                      </p>
                    )}
                    {step.latency_ms !== null && (
                      <p className="text-[9px] text-elio-text-dim">{step.latency_ms}ms</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-elio-surface-2 rounded px-2 py-1.5">
      <p className="text-[9px] text-elio-text-dim uppercase tracking-wider">{label}</p>
      <p className="text-xs font-semibold text-elio-text mt-0.5">{value}</p>
    </div>
  )
}
