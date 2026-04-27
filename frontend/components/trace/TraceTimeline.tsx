'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, Clock, RefreshCw } from 'lucide-react'
import { traceApi, type Run } from '@/lib/traceApi'
import RunList from './RunList'
import StepView from './StepView'

export default function TraceTimeline() {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadRuns = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    try {
      const data = await traceApi.listRuns()
      setRuns(data)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
      if (showSpinner) setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadRuns() }, [loadRuns])

  useEffect(() => {
    if (selectedRunId) return
    const id = setInterval(() => loadRuns(), 10_000)
    return () => clearInterval(id)
  }, [selectedRunId, loadRuns])

  const handleBack = useCallback(() => {
    setSelectedRunId(null)
    loadRuns()
  }, [loadRuns])

  return (
    <aside className="w-72 bg-elio-surface border-l border-elio-border flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-elio-border shrink-0 h-9">
        {selectedRunId ? (
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-[11px] text-elio-text-muted hover:text-elio-text transition-colors duration-150"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Runs
          </button>
        ) : (
          <>
            <Clock className="h-3.5 w-3.5 text-elio-text-dim shrink-0" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-elio-text-dim flex-1">
              Trace
            </span>
            {runs.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-elio-surface-2 text-elio-text-muted border border-elio-border">
                {runs.length}
              </span>
            )}
            <button
              onClick={() => loadRuns(true)}
              disabled={refreshing}
              className="p-1 rounded hover:bg-elio-surface-2 transition-colors duration-150 disabled:opacity-40"
            >
              <RefreshCw className={`h-3 w-3 text-elio-text-dim ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </>
        )}
      </div>

      {/* Content */}
      {selectedRunId ? (
        <StepView runId={selectedRunId} onBack={handleBack} />
      ) : (
        <RunList runs={runs} loading={loading} onSelect={setSelectedRunId} />
      )}

      {/* Footer */}
      {!selectedRunId && (
        <div className="border-t border-elio-border px-3 py-1.5 shrink-0">
          <p className="text-[10px] text-elio-text-dim">
            {runs.length} run{runs.length !== 1 ? 's' : ''} · auto-refresh 10s
          </p>
        </div>
      )}
    </aside>
  )
}
